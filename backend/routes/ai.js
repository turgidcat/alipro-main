const express = require('express');
const router = express.Router();
const deepseekService = require('../services/deepseek');
const logger = require('../utils/logger');
const dbPromise = require('../database/init');
const { execQuery, execQueryOne, saveDatabase, syncStorylineProgressFromChapterPlan, ChapterPlanService } = require('../services/database');

const chapterPlanService = new ChapterPlanService();

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function stripOutlineListMarker(line = '') {
  return String(line || '')
    .replace(/^[-*•]\s*/, '')
    .replace(/^\d+[\.\)、]\s*/, '')
    .replace(/^[（(]?\d+[)）]\s*/, '')
    .replace(/^要点\s*\d+\s*[:：]?\s*/, '')
    .replace(/^第[\d一二三四五六七八九十百]+点\s*[:：]?\s*/, '')
    .replace(/^(章节细纲|章节大纲|细纲正文|正文细纲|以下是细纲|以下为细纲|本章细纲)\s*[:：]?\s*/, '')
    .replace(/^(本章目标|关键场景|冲突升级|角色变化|读者爽点\s*\/\s*情绪落点|读者爽点|情绪落点|结尾钩子|剧情线约束|剧情线推进|剧情推进|章节任务)\s*[:：]?\s*/, '')
    .trim();
}

function ensureSentenceEnding(text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) return '';
  if (/[。！？!?]$/.test(normalized)) return normalized;
  return normalized + '。';
}

function normalizeOutlineNarrativeOutput(value) {
  const raw = String(value || '').replace(/\r/g, '').trim();
  if (!raw) return '';

  const fragments = raw
    .split('\n')
    .map(stripOutlineListMarker)
    .map((line) => line.replace(/[：:]\s*$/g, '').trim())
    .filter(Boolean)
    .flatMap((line) => line.split(/[;；]+/))
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^(同时|接着|随后|然后|最后)\s*[，,]/, '$1'))
    .map((line) => line.replace(/[，,；;。！？!?]+$/g, '').trim())
    .filter(Boolean);

  if (fragments.length === 0) return '';

  return ensureSentenceEnding(
    fragments
      .join('，')
      .replace(/，{2,}/g, '，')
      .replace(/。\s*，/g, '，')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function looksLikeOutlineList(value = '') {
  const text = String(value || '').trim();
  if (!text) return false;
  return /(^|\s)(\d+[\.\)、]|[（(]?\d+[)）]|要点\s*\d+|第[一二三四五六七八九十百]+点|本章目标\s*[:：]|关键场景\s*[:：]|冲突升级\s*[:：]|角色变化\s*[:：]|读者爽点\s*[:：]|情绪落点\s*[:：]|结尾钩子\s*[:：])/m.test(text);
}

function mergeUsage(primary, secondary) {
  const first = primary && typeof primary === 'object' ? primary : {};
  const second = secondary && typeof secondary === 'object' ? secondary : {};
  const merged = {
    prompt_tokens: Number(first.prompt_tokens || 0) + Number(second.prompt_tokens || 0),
    completion_tokens: Number(first.completion_tokens || 0) + Number(second.completion_tokens || 0),
    total_tokens: Number(first.total_tokens || 0) + Number(second.total_tokens || 0)
  };
  return merged.prompt_tokens || merged.completion_tokens || merged.total_tokens ? merged : (primary || secondary || null);
}

function normalizeJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function parseStructuredContent(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function normalizePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getRelatedBeatIdsFromSlot(slot = {}) {
  return normalizeJsonArray(slot.relatedBeatIds || slot.related_beat_ids)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function storylineContainsBeatId(storyline = {}, beatIds = []) {
  if (!Array.isArray(beatIds) || beatIds.length === 0) return false;
  const structured = parseStructuredContent(storyline.structured_content);
  const keyBeats = normalizeJsonArray(structured.keyBeats || structured.beats || structured.development);
  const knownBeatIds = new Set(
    keyBeats
      .map((item) => normalizeText(item?.beatId || item?.beat_id || ''))
      .filter(Boolean)
  );
  return beatIds.some((item) => knownBeatIds.has(normalizeText(item)));
}

function pickPreferredStorylineId(storylines = []) {
  if (!Array.isArray(storylines) || storylines.length === 0) return '';
  const preferred = storylines.find((item) => ['main', '主线'].includes(normalizeText(item.storyline_type).toLowerCase()))
    || storylines[0];
  return normalizeText(preferred?.id || '');
}

function inferVolumeNumberForChapter({
  requestedVolumeNumber,
  chapterNumber,
  storylines = [],
  volumePlans = [],
  volumeTimelineRows = []
}) {
  const explicitVolumeNumber = normalizePositiveInteger(requestedVolumeNumber);
  if (explicitVolumeNumber) {
    return {
      volumeNumber: explicitVolumeNumber,
      source: 'request'
    };
  }

  const matchingStoryline = storylines.find((item) => {
    const startChapter = normalizePositiveInteger(item.start_chapter || item.startChapter);
    const endChapter = normalizePositiveInteger(item.end_chapter || item.endChapter);
    return startChapter > 0 && endChapter >= startChapter && chapterNumber >= startChapter && chapterNumber <= endChapter;
  });
  if (matchingStoryline) {
    return {
      volumeNumber: normalizePositiveInteger(matchingStoryline.volume_number || matchingStoryline.volumeNumber) || 1,
      source: 'storyline_range'
    };
  }

  for (const row of volumeTimelineRows) {
    const timelineData = parseStructuredContent(row.timeline_data);
    const matchedSlot = normalizeJsonArray(timelineData.chapterSlots || timelineData.timeline)
      .find((slot) => normalizePositiveInteger(slot.chapterNumber || slot.chapter) === chapterNumber);
    if (matchedSlot) {
      return {
        volumeNumber: normalizePositiveInteger(row.volume_number) || 1,
        source: 'volume_timeline'
      };
    }
  }

  const sortedVolumePlans = [...volumePlans]
    .map((item) => ({
      volumeNumber: normalizePositiveInteger(item.volume_number || item.volumeNumber),
      estimatedChapters: normalizePositiveInteger(item.estimated_chapters || item.estimatedChapters)
    }))
    .filter((item) => item.volumeNumber > 0 && item.estimatedChapters > 0)
    .sort((a, b) => a.volumeNumber - b.volumeNumber);

  if (sortedVolumePlans.length > 0) {
    let consumedChapters = 0;
    for (const item of sortedVolumePlans) {
      consumedChapters += item.estimatedChapters;
      if (chapterNumber <= consumedChapters) {
        return {
          volumeNumber: item.volumeNumber,
          source: 'estimated_chapters'
        };
      }
    }
    return {
      volumeNumber: sortedVolumePlans[sortedVolumePlans.length - 1].volumeNumber,
      source: 'estimated_chapters_fallback'
    };
  }

  const fallbackVolumeNumber = normalizePositiveInteger(storylines[0]?.volume_number || storylines[0]?.volumeNumber) || 1;
  return {
    volumeNumber: fallbackVolumeNumber,
    source: fallbackVolumeNumber === 1 ? 'default' : 'first_storyline'
  };
}

function resolveAutoChapterPlanStorylines({
  requestBody = {},
  storylines = [],
  volumeNumber = 1,
  matchedSlot = null
}) {
  const requestedMainStorylineId = normalizeText(requestBody.main_storyline_id || requestBody.mainStorylineId || '');
  const requestedTargetStorylines = normalizeJsonArray(requestBody.target_storylines || requestBody.targetStorylines)
    .map((item) => normalizeText(item))
    .filter(Boolean);

  const storylineById = new Map(
    storylines
      .filter((item) => normalizeText(item.id))
      .map((item) => [normalizeText(item.id), item])
  );

  const validRequestedMainStorylineId = storylineById.has(requestedMainStorylineId) ? requestedMainStorylineId : '';
  const validRequestedTargetStorylines = [...new Set(requestedTargetStorylines.filter((item) => storylineById.has(item)))];
  if (validRequestedMainStorylineId || validRequestedTargetStorylines.length > 0) {
    return {
      mainStorylineId: validRequestedMainStorylineId,
      targetStorylineIds: validRequestedTargetStorylines,
      source: 'request',
      fallback: false
    };
  }

  const volumeStorylines = storylines.filter((item) => normalizePositiveInteger(item.volume_number || item.volumeNumber) === volumeNumber);
  const slotBeatIds = getRelatedBeatIdsFromSlot(matchedSlot);
  const beatMatchedStorylines = volumeStorylines.filter((item) => storylineContainsBeatId(item, slotBeatIds));
  const effectiveStorylines = beatMatchedStorylines.length > 0 ? beatMatchedStorylines : volumeStorylines;
  const mainStorylineId = pickPreferredStorylineId(effectiveStorylines);
  const targetStorylineIds = [...new Set(effectiveStorylines.map((item) => normalizeText(item.id)).filter(Boolean))];

  return {
    mainStorylineId,
    targetStorylineIds,
    source: beatMatchedStorylines.length > 0 ? 'timeline_related_beats' : (volumeStorylines.length > 0 ? 'volume_storylines' : 'fallback_empty'),
    fallback: !mainStorylineId && targetStorylineIds.length === 0
  };
}

async function ensureChapterPlanForOutlineGeneration({ bookId, chapterNumber, requestBody = {} }) {
  if (!normalizeText(bookId) || !normalizePositiveInteger(chapterNumber)) {
    return { chapterPlan: null, autoCreated: false };
  }

  const db = await dbPromise;
  const existingPlan = execQueryOne(
    db,
    'SELECT * FROM chapter_plans WHERE book_id = ? AND chapter_number = ? ORDER BY updated_at DESC LIMIT 1',
    [bookId, chapterNumber]
  );

  if (existingPlan) {
    return {
      chapterPlan: existingPlan,
      autoCreated: false
    };
  }

  const storylines = execQuery(
    db,
    'SELECT id, volume_number, storyline_number, storyline_name, storyline_type, start_chapter, end_chapter, structured_content FROM storylines WHERE book_id = ? ORDER BY volume_number ASC, storyline_number ASC, created_at ASC',
    [bookId]
  );
  const volumePlans = execQuery(
    db,
    'SELECT volume_number, estimated_chapters FROM volume_plans WHERE book_id = ? ORDER BY volume_number ASC, updated_at DESC, created_at DESC',
    [bookId]
  );
  const volumeTimelineRows = execQuery(
    db,
    'SELECT volume_number, timeline_data FROM volume_timelines WHERE book_id = ? ORDER BY volume_number ASC, updated_at DESC',
    [bookId]
  );

  const volumeResolution = inferVolumeNumberForChapter({
    requestedVolumeNumber: requestBody.volume_number || requestBody.volumeNumber,
    chapterNumber,
    storylines,
    volumePlans,
    volumeTimelineRows
  });

  const matchedTimelineRow = volumeTimelineRows.find((item) => normalizePositiveInteger(item.volume_number) === volumeResolution.volumeNumber) || null;
  const matchedTimelineData = matchedTimelineRow ? parseStructuredContent(matchedTimelineRow.timeline_data) : {};
  const matchedSlot = normalizeJsonArray(matchedTimelineData.chapterSlots || matchedTimelineData.timeline)
    .find((item) => normalizePositiveInteger(item.chapterNumber || item.chapter) === chapterNumber) || null;

  const storylineResolution = resolveAutoChapterPlanStorylines({
    requestBody,
    storylines,
    volumeNumber: volumeResolution.volumeNumber,
    matchedSlot
  });

  const chapterName = normalizeText(requestBody.chapter_name || requestBody.chapterName || requestBody.chapterTitle || '');
  const structuredContent = {
    autoCreatedChapterPlan: true,
    autoCreateReason: 'missing_chapter_plan_for_outline_generation',
    autoCreateFallback: volumeResolution.source === 'default' || storylineResolution.fallback,
    autoCreateMeta: {
      volumeNumberSource: volumeResolution.source,
      storylineSource: storylineResolution.source
    }
  };

  const createdPlan = await chapterPlanService.upsert(bookId, chapterNumber, {
    volume_number: volumeResolution.volumeNumber,
    chapter_name: chapterName,
    main_storyline_id: storylineResolution.mainStorylineId,
    target_storylines: storylineResolution.targetStorylineIds,
    structured_content: structuredContent,
    source: 'ai',
    status: 'draft'
  }, '');

  return {
    chapterPlan: createdPlan,
    autoCreated: true
  };
}

function tryParseJsonObject(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  try {
    return JSON.parse(normalized);
  } catch (_) {
    const match = normalized.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (_) {
      return null;
    }
  }
}

function truncate(text, maxLength = 800) {
  const normalized = normalizeText(text);
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function buildStoredCharacterContext(characters = []) {
  if (!Array.isArray(characters) || characters.length === 0) return '';
  const legacySummaryNames = new Set(['全书角色设定', '本章新增角色']);
  return characters
    .filter((character) => !legacySummaryNames.has(normalizeText(character.name)))
    .map((character) => {
      const parts = [];
      if (normalizeText(character.appearance)) parts.push(`外形：${normalizeText(character.appearance)}`);
      if (normalizeText(character.personality)) parts.push(`性格：${normalizeText(character.personality)}`);
      if (normalizeText(character.background)) parts.push(`背景：${normalizeText(character.background)}`);
      if (normalizeText(character.notes)) parts.push(`备注：${normalizeText(character.notes)}`);
      if (parts.length === 0) return normalizeText(character.name);
      return `${normalizeText(character.name)}：${parts.join('；')}`;
    })
    .filter(Boolean)
    .join('\n');
}

function buildCharacterSummaryContext(characters = []) {
  if (!Array.isArray(characters) || characters.length === 0) return '';
  const globalSummary = characters.find((character) => normalizeText(character.name) === '全书角色设定');
  const chapterSummary = characters.find((character) => normalizeText(character.name) === '本章新增角色');
  const summaryParts = [];
  if (normalizeText(globalSummary?.background)) {
    summaryParts.push(`全书角色摘要：${normalizeText(globalSummary.background)}`);
  }
  if (normalizeText(chapterSummary?.background)) {
    summaryParts.push(`章节临时角色摘要：${normalizeText(chapterSummary.background)}`);
  }
  return summaryParts.join('\n\n');
}

function collectStoredCharacterNames(characters = []) {
  if (!Array.isArray(characters)) return [];
  return characters
    .map((character) => normalizeText(character.name))
    .filter((name) => name && name !== '全书角色设定' && name !== '本章新增角色');
}

function hasAnyCharacterNameInText(text, characterNames = []) {
  const normalizedText = normalizeText(text);
  if (!normalizedText || !Array.isArray(characterNames) || characterNames.length === 0) return false;
  return characterNames.some((name) => name && normalizedText.includes(name));
}

function validateChapterGenerationContext({ requestCharacters = '', storedContext = {} }) {
  const storedCharacterNames = Array.isArray(storedContext.characterNames) ? storedContext.characterNames : [];
  const requestCharacterText = normalizeText(requestCharacters);
  if (storedCharacterNames.length === 0 && !requestCharacterText) {
    return '当前作品还没有可用角色设定。请先在工作台补齐角色卡，避免模型临时乱造人物名。';
  }

  const chapterSnapshots = [
    { label: '当前章正文', content: storedContext.currentChapter?.content || '' },
    { label: '上一章正文', content: storedContext.previousChapter?.content || '' }
  ];

  for (const snapshot of chapterSnapshots) {
    const normalizedContent = normalizeText(snapshot.content);
    if (!normalizedContent || normalizedContent.length < 80 || storedCharacterNames.length === 0) continue;
    if (!hasAnyCharacterNameInText(normalizedContent, storedCharacterNames)) {
      return `${snapshot.label}与当前角色库对不上，疑似混入了其他作品内容。请先清理污染正文或修正角色设定，再继续生成。`;
    }
  }

  return '';
}

function hasMountedStorylineSelectionForGeneration(plan = {}) {
  const mainStorylineId = normalizeText(plan?.main_storyline_id || plan?.mainStorylineId || '');
  const targetStorylines = normalizeJsonArray(plan?.target_storylines || plan?.targetStorylines);
  return !!mainStorylineId || targetStorylines.some((item) => normalizeText(item));
}

function hasUsableChapterOutlineForGeneration({ outline = '', chapterPlan = {}, chapterStructure = {} }) {
  if (normalizeText(outline)) return true;
  const effectiveStructure = chapterStructure && typeof chapterStructure === 'object'
    ? chapterStructure
    : {};
  const chapterGoal = normalizeText(
    effectiveStructure.chapter_goal
    || effectiveStructure.chapterGoal
    || chapterPlan?.chapter_mission
    || ''
  );
  const keyScenes = normalizeText(effectiveStructure.key_scenes || effectiveStructure.keyScenes || '');
  const endingHook = normalizeText(
    effectiveStructure.ending_hook
    || effectiveStructure.endingHook
    || chapterPlan?.ending_hook
    || ''
  );
  return !!chapterGoal && !!keyScenes && !!endingHook;
}

function buildGenerationBriefText(generationBrief = {}) {
  if (!generationBrief || typeof generationBrief !== 'object') return '';
  const normalizeBriefItems = (value) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (typeof item === 'string') return normalizeText(item);
        if (!item || typeof item !== 'object') return '';
        const label = normalizeText(item.label || item.key || item.name || '');
        const detail = normalizeText(item.value || item.text || item.status || '');
        return [label, detail].filter(Boolean).join('：');
      })
      .filter(Boolean);
  };
  const parts = [];
  const requiredItems = normalizeBriefItems(generationBrief.requiredItems);
  const recommendedItems = normalizeBriefItems(generationBrief.recommendedItems);
  const missingRequiredItems = normalizeBriefItems(generationBrief.missingRequiredItems);
  const missingRecommendedItems = normalizeBriefItems(generationBrief.missingRecommendedItems);
  const generationRiskItems = normalizeBriefItems(generationBrief.riskItems);
  if (requiredItems.length > 0) {
    parts.push(`必填项：${requiredItems.join(' / ')}`);
  }
  if (recommendedItems.length > 0) {
    parts.push(`建议项：${recommendedItems.join(' / ')}`);
  }
  if (missingRequiredItems.length > 0) {
    parts.push(`缺失必填项：${missingRequiredItems.join(' / ')}`);
  }
  if (missingRecommendedItems.length > 0) {
    parts.push(`缺失建议项：${missingRecommendedItems.join(' / ')}`);
  }
  if (normalizeText(generationBrief.mainStoryline)) {
    parts.push(`主剧情线：${normalizeText(generationBrief.mainStoryline)}`);
  }
  if (normalizeText(generationBrief.targetStorylines)) {
    parts.push(`关联剧情线：${normalizeText(generationBrief.targetStorylines)}`);
  }
  if (Array.isArray(generationBrief.rhythmHints) && generationBrief.rhythmHints.length > 0) {
    parts.push(`节奏提示：${generationBrief.rhythmHints.map((item) => normalizeText(item)).filter(Boolean).join(' / ')}`);
  }
  if (normalizeText(generationBrief.constraintBrief)) {
    parts.push(`人工约束：\n${normalizeText(generationBrief.constraintBrief)}`);
  }
  if (generationRiskItems.length > 0) {
    parts.push(`高风险提醒：\n${generationRiskItems.join('\n')}`);
  }
  if (Number.isFinite(Number(generationBrief.wordCount))) {
    parts.push(`目标字数：${Number(generationBrief.wordCount)}`);
  }
  return parts.join('\n');
}

function normalizeRoleExecutionItem(item) {
  if (!item || typeof item !== 'object') return null;
  const role = normalizeText(item.role || item.name || '');
  const baseline = normalizeText(item.baseline || '');
  const chapterFunction = normalizeText(item.chapter_function || item.chapterFunction || '');
  const allowedChange = normalizeText(item.allowed_change || item.allowedChange || '');
  const forbiddenChange = normalizeText(item.forbidden_change || item.forbiddenChange || '');
  const dimension = normalizeText(item.dimension || item.change_dimension || item.changeDimension || '');
  const direction = normalizeText(item.direction || item.change_direction || item.changeDirection || '');
  const scope = normalizeText(item.scope || item.change_scope || item.changeScope || '');
  const confidence = normalizeText(item.confidence || '');
  if (!role && !baseline && !chapterFunction && !allowedChange && !forbiddenChange && !dimension && !direction && !scope && !confidence) {
    return null;
  }
  return {
    role,
    baseline,
    chapter_function: chapterFunction,
    allowed_change: allowedChange,
    forbidden_change: forbiddenChange,
    dimension,
    direction,
    scope,
    confidence
  };
}

function normalizeRoleExecutionList(value) {
  return normalizeJsonArray(value).map(normalizeRoleExecutionItem).filter(Boolean);
}

function normalizeFeedbackLedgerItems(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const name = normalizeText(item.name || item.title || item.label || '');
      const role = normalizeText(item.role || item.function || item.purpose || '');
      const relation = normalizeText(item.relation || item.link || item.connection || '');
      const status = normalizeText(item.status || item.reasonability || item.keep || '');
      const note = normalizeText(item.note || item.summary || item.description || '');
      if (!name && !note) return null;
      return { name, role, relation, status, note };
    })
    .filter(Boolean)
    .slice(0, 8);
}

function extractKnownRoleNames(chapterPlan = {}) {
  return normalizeJsonArray(chapterPlan.appearing_roles)
    .map((item) => {
      if (typeof item === 'string') return normalizeText(item);
      if (item && typeof item === 'object') return normalizeText(item.name || item.characterName || item.title || '');
      return '';
    })
    .filter(Boolean);
}

function collectKnownTerms(chapterPlan = {}, extraTexts = []) {
  const sources = [
    normalizeText(chapterPlan.chapter_name || ''),
    normalizeText(chapterPlan.summary || ''),
    normalizeText(chapterPlan.chapter_mission || ''),
    normalizeText(chapterPlan.outline_text || ''),
    normalizeText(chapterPlan.character_notes || ''),
    normalizeText(chapterPlan.previous_hook || ''),
    normalizeText(chapterPlan.ending_hook || ''),
    ...extraTexts.map((item) => normalizeText(item))
  ].filter(Boolean);

  const known = new Set();
  const titledPattern = /《([^》]{1,16})》/g;
  const namedPattern = /[\u4e00-\u9fa5]{2,12}(?:堂|阁|殿|院|司|门|宗|宫|府|城|谷|山|海|洲|印|令|诀|图|录|卷|铃|碑|门)/g;

  sources.forEach((text) => {
    let match;
    while ((match = titledPattern.exec(text)) !== null) {
      const term = normalizeText(match[1]);
      if (term.length >= 2) known.add(term);
    }
    const terms = text.match(namedPattern) || [];
    terms.forEach((term) => {
      const normalized = normalizeText(term);
      if (normalized.length >= 2) known.add(normalized);
    });
  });

  return [...known];
}

function collectNovelTerms(text = '', pattern) {
  const normalized = normalizeText(text);
  const terms = new Set();
  let match;
  while ((match = pattern.exec(normalized)) !== null) {
    const raw = normalizeText(match[1] || match[0] || '');
    if (raw.length >= 2) terms.add(raw);
  }
  return [...terms];
}

function collectInstitutionTerms(text = '') {
  const normalized = normalizeText(text);
  const terms = new Set();
  const pattern = /(?:^|[，。！？；：“”"'‘’\s])([\u4e00-\u9fa5]{2,8}(?:堂|阁|殿|院|司|宗|宫|府|城|谷|山|海|洲))(?![\u4e00-\u9fa5])/g;
  let match;

  while ((match = pattern.exec(normalized)) !== null) {
    const term = normalizeText(match[1] || '');
    if (term.length >= 2) terms.add(term);
  }

  return [...terms];
}

function collectNamedTitleTerms(text = '') {
  const normalized = normalizeText(text);
  const terms = new Set();
  const titlePattern = /《([^》]{2,16})》/g;
  let match;

  while ((match = titlePattern.exec(normalized)) !== null) {
    const raw = normalizeText(match[1] || '');
    if (!raw || /[，。！？；：、“”"'‘’\s]/.test(raw)) continue;
    terms.add(raw);
  }

  return [...terms];
}

function calcCharOverlapScore(term = '', text = '') {
  const normalizedTerm = normalizeEvidenceText(term);
  const normalizedText = normalizeEvidenceText(text);
  if (!normalizedTerm || !normalizedText) return 0;
  const termChars = [...new Set(normalizedTerm.split(''))];
  let overlap = 0;
  termChars.forEach((char) => {
    if (normalizedText.includes(char)) overlap += 1;
  });
  return overlap / termChars.length;
}

function normalizeEvidenceText(value = '') {
  return normalizeText(value)
    .replace(/[“”"'‘’《》【】\[\]（）()：:，。！？；、\s]/g, '');
}

function buildEvidenceNameCandidates(name = '') {
  const raw = normalizeText(name);
  if (!raw) return [];
  const candidates = new Set([
    raw,
    raw.replace(/（.*?）|\(.*?\)/g, '').trim(),
    raw.replace(/[\-—:：].*$/, '').trim()
  ]);
  return [...candidates]
    .map((item) => normalizeEvidenceText(item))
    .filter((item) => item.length >= 2);
}

function collectContextEvidenceTerms({ content = '', chapterPlan = {}, mainStoryline = '', targetStorylines = [] }) {
  const text = normalizeText(content);
  return [
    ...extractKnownRoleNames(chapterPlan),
    ...collectKnownTerms(chapterPlan, [mainStoryline, ...(Array.isArray(targetStorylines) ? targetStorylines : [])]),
    ...collectNamedTitleTerms(text),
    ...collectInstitutionTerms(text),
    ...collectNovelTerms(text, /([\u4e00-\u9fa5]{2,16}(?:印|令|诀|图|录|卷|铃|碑|室|库|台|阵|匙|钥|纹|页))/g)
  ].filter(Boolean);
}

function buildDynamicGenerationConstraints({
  chapterPlan = {},
  previousChapterFeedback = null,
  characterRows = [],
  storylineRows = []
}) {
  const roleNames = characterRows
    .map((item) => normalizeText(item?.name || ''))
    .filter((name) => name && name !== '全书角色设定' && name !== '本章新增角色')
    .slice(0, 12);
  const appearingRoles = extractKnownRoleNames(chapterPlan);
  const mainStoryline = normalizeText(
    storylineRows.find((item) => item.id === chapterPlan.main_storyline_id)?.storyline_name || ''
  );
  const targetIds = normalizeJsonArray(chapterPlan.target_storylines);
  const targetLabels = storylineRows
    .filter((item) => targetIds.includes(item.id))
    .map((item) => normalizeText(item.storyline_name || ''))
    .filter(Boolean)
    .slice(0, 4);
  const previousCarry = normalizeJsonArray(previousChapterFeedback?.continuity_report?.must_carry_forward)
    .map((item) => typeof item === 'string'
      ? normalizeText(item)
      : normalizeText(item?.note || item?.summary || item?.name || ''))
    .filter(Boolean)
    .slice(0, 4);
  const previousElements = normalizeFeedbackLedgerItems(previousChapterFeedback?.continuity_report?.new_elements)
    .map((item) => normalizeText(item.name || item.note || ''))
    .filter(Boolean)
    .slice(0, 4);
  const currentKnownTerms = collectKnownTerms(chapterPlan, [
    mainStoryline,
    ...targetLabels,
    ...previousCarry,
    ...previousElements
  ]).slice(0, 12);
  const allowedLines = [
    previousCarry.length > 0 ? `上一章已挂接承接项：${previousCarry.join(' / ')}` : '',
    previousElements.length > 0 ? `上一章已入台账设定：${previousElements.join(' / ')}` : '',
    appearingRoles.length > 0 ? `本章已挂接角色关系：${appearingRoles.join(' / ')}` : '',
    currentKnownTerms.length > 0 ? `当前已挂接设定与冲突：${currentKnownTerms.join(' / ')}` : ''
  ].filter(Boolean);

  return [
    '书籍动态约束：',
    '1. 只能扩写已挂接信息的直接后果，不能把补背景当成主要推进手段。',
    allowedLines.length > 0
      ? `2. 当前允许扩写的范围：\n${allowedLines.map((item, index) => `${index + 1}. ${item}`).join('\n')}`
      : '2. 当前允许扩写的范围：仅限本章任务表与已有正文已经明确出现的信息。',
    '3. 当前禁止空降的内容：',
    '1. 未在当前计划、上一章反馈或既有台账中出现的高影响背景，不能直接进入正文核心推进。',
    '2. 会直接改变主线走向、人物关系或世界基础规则的新信息，必须先被挂接或由模型明确交代来源。',
    '3. 未提前挂接的新势力、新规则、新核心道具、新终局目标，不能直接接管当前冲突。',
    '4. 如果确实需要新增信息，只能是服务当前章节任务的低影响补充，不能直接改写主线结构。',
    roleNames.length > 0
      ? `5. 本书当前核心角色池：${roleNames.join(' / ')}。优先在这套角色关系里推进，不要靠陌生关键人物接管剧情。`
      : '5. 优先在已挂接角色关系里推进，不要靠陌生关键人物接管剧情。',
    [mainStoryline, ...targetLabels].filter(Boolean).length > 0
      ? `6. 当前主线锚点：${[mainStoryline, ...targetLabels].filter(Boolean).join(' / ')}。新增内容如果不能直接服务这些锚点，就不应进入正文核心推进。`
      : '6. 新增内容如果不能直接服务当前主线，就不应进入正文核心推进。'
  ].join('\n');
}

function buildDynamicGenerationConstraintState({
  chapterPlan = {},
  previousChapterFeedback = null,
  characterRows = [],
  storylineRows = []
}) {
  const roleNames = characterRows
    .map((item) => normalizeText(item?.name || ''))
    .filter((name) => name && name !== '全书角色设定' && name !== '本章新增角色')
    .slice(0, 12);
  const appearingRoles = extractKnownRoleNames(chapterPlan);
  const mainStoryline = normalizeText(
    storylineRows.find((item) => item.id === chapterPlan.main_storyline_id)?.storyline_name || ''
  );
  const targetIds = normalizeJsonArray(chapterPlan.target_storylines);
  const targetLabels = storylineRows
    .filter((item) => targetIds.includes(item.id))
    .map((item) => normalizeText(item.storyline_name || ''))
    .filter(Boolean)
    .slice(0, 4);
  const previousCarry = normalizeJsonArray(previousChapterFeedback?.continuity_report?.must_carry_forward)
    .map((item) => typeof item === 'string'
      ? normalizeText(item)
      : normalizeText(item?.note || item?.summary || item?.name || ''))
    .filter(Boolean)
    .slice(0, 4);
  const previousElements = normalizeFeedbackLedgerItems(previousChapterFeedback?.continuity_report?.new_elements)
    .map((item) => normalizeText(item.name || item.note || ''))
    .filter(Boolean)
    .slice(0, 4);
  const currentKnownTerms = collectKnownTerms(chapterPlan, [
    mainStoryline,
    ...targetLabels,
    ...previousCarry,
    ...previousElements
  ]).slice(0, 12);

  return {
    summary: buildDynamicGenerationConstraints({
      chapterPlan,
      previousChapterFeedback,
      characterRows,
      storylineRows
    }),
    anchors: [mainStoryline, ...targetLabels].filter(Boolean),
    allowed: [
      previousCarry.length > 0 ? { label: '上一章已挂接承接项', items: previousCarry, source: 'chapter_feedback' } : null,
      previousElements.length > 0 ? { label: '上一章已入台账设定', items: previousElements, source: 'chapter_feedback' } : null,
      appearingRoles.length > 0 ? { label: '本章已挂接角色关系', items: appearingRoles, source: 'chapter_plan' } : null,
      currentKnownTerms.length > 0 ? { label: '当前已挂接设定与冲突', items: currentKnownTerms, source: 'chapter_plan' } : null
    ].filter(Boolean),
    blocked: [
      { label: '高影响背景', rule: '例如突然补出主角新亲属、父辈旧案真相、隐藏历史线，这类高影响背景没有提前铺垫时，不能直接进入正文核心推进。', source: 'system' },
      { label: '改变主线的新信息', rule: '例如会直接改写主线走向、人物关系基础或世界规则的新真相、新身份、新规则，必须先被挂接或由模型明确交代来源。', source: 'system' },
      { label: '未挂接的核心设定', rule: '例如新势力、新规则、新核心道具、新终局目标，这类核心设定未提前挂接时，不能直接接管当前冲突。', source: 'system' }
    ],
    rolePool: roleNames
  };
}

function hasEvidenceForLedgerName(name = '', evidenceTerms = [], content = '') {
  const nameCandidates = buildEvidenceNameCandidates(name);
  if (nameCandidates.length === 0) return false;
  const normalizedContent = normalizeEvidenceText(content);
  if (nameCandidates.some((candidate) => normalizedContent.includes(candidate))) return true;

  return evidenceTerms.some((term) => {
    const normalizedTerm = normalizeEvidenceText(term);
    if (!normalizedTerm) return false;
    return nameCandidates.some((candidate) => {
      if (candidate.includes(normalizedTerm) || normalizedTerm.includes(candidate)) return true;
      return calcCharOverlapScore(candidate, normalizedTerm) >= 0.66;
    });
  });
}

function sanitizeFeedbackLedgerItems(items = [], options = {}) {
  const evidenceTerms = collectContextEvidenceTerms(options);
  const content = normalizeText(options.content || '');
  const droppedItems = [];
  const keptItems = normalizeFeedbackLedgerItems(items).filter((item) => {
    const ledgerName = normalizeText(item.name || '');
    if (!ledgerName) return true;
    const hasEvidence = hasEvidenceForLedgerName(ledgerName, evidenceTerms, content);
    if (!hasEvidence) {
      droppedItems.push(ledgerName);
    }
    return hasEvidence;
  });

  return {
    keptItems,
    droppedItems
  };
}

function mergeFeedbackContinuityReport(baseReport = {}, auditResult = {}) {
  const mergedCharacters = normalizeFeedbackLedgerItems(baseReport.new_characters);
  const mergedElements = normalizeFeedbackLedgerItems(baseReport.new_elements);

  const auditRisks = normalizeJsonArray(auditResult.risks)
    .map((item) => typeof item === 'string' ? normalizeText(item) : '')
    .filter(Boolean);

  return {
    new_characters: mergedCharacters.slice(0, 8),
    new_elements: mergedElements.slice(0, 8),
    must_carry_forward: normalizeJsonArray(baseReport.must_carry_forward)
      .map((item) => typeof item === 'string' ? normalizeText(item) : normalizeText(item?.note || item?.summary || item?.name || ''))
      .filter(Boolean)
      .slice(0, 8),
    continuity_risks: [...new Set([
      ...normalizeJsonArray(baseReport.continuity_risks)
        .map((item) => typeof item === 'string' ? normalizeText(item) : normalizeText(item?.note || item?.summary || item?.name || ''))
        .filter(Boolean),
      ...auditRisks
    ])].slice(0, 8)
  };
}

function createFallbackLedgerItem(name = '', role = '', relation = '', note = '', status = '待确认') {
  const normalizedName = normalizeText(name);
  if (!normalizedName) return null;
  return {
    name: normalizedName,
    role: normalizeText(role),
    relation: normalizeText(relation),
    status: normalizeText(status) || '待确认',
    note: normalizeText(note)
  };
}

function isLikelyNamedEntityTerm(term = '') {
  const normalized = normalizeText(term);
  if (!normalized || normalized.length < 2 || normalized.length > 14) return false;
  if (/[，。！？；：、“”"'‘’（）()\s]/.test(normalized)) return false;
  if (/^(他|她|它|我|你|我们|你们|他们|她们|这|那|一个|以前|后来|用力|一直|已经|如果|因为|不是|只是|然后|但|却|就)/.test(normalized)) return false;
  if (/(他说|她说|我说|你说|看见|听见|知道|觉得|以为|推开|打开|关上|拿到|拿着|带着|看着|问他|问她|外站一个|以前堆|这把钥匙|用它|他把门|但我听)/.test(normalized)) return false;
  return true;
}

function extractTailArtifactTerm(term = '') {
  const normalized = normalizeText(term);
  if (!normalized) return '';

  const artifactSuffix =
    '(?:印记|血契|契印|契约|残页|残卷|卷轴|手札|石碑|石匣|石室|古卷|钥匙|血钥|玉简|阵图|阵盘|命牌|令牌|禁制|法阵|符印|符箓|纹路|灵纹|雾纹|真解|旧约|秘录|图谱|碑文|遗令|遗书|血月)';
  const source = normalized
    .split(/[，。！？；：“”"'‘’（）()【】\[\]\s]/)
    .filter(Boolean)
    .pop() || normalized;

  const stripped = source
    .replace(/^.*?的/, '')
    .replace(/^(?:这|那|一|两)?(?:卷|页|道|份|块|枚|把|册|张)/, '')
    .replace(/^(?:左腕上|腕上|手上|身上|怀里|袖中|地上|门后|纸上|纸里的)/, '');

  const exact = stripped.match(new RegExp(`([\\u4e00-\\u9fa5]{0,6}${artifactSuffix})$`));
  if (!exact) return '';

  const candidate = normalizeText(exact[1] || '');
  if (!candidate) return '';
  if (/(掏出|拿到|看到|写着|写的|摊开|塞进|放进|压住|盯着|看着|想着|记着|变成|是旧约|钥匙的奴仆)/.test(candidate)) {
    return '';
  }
  return candidate;
}

function normalizeElementTerm(term = '') {
  const normalized = normalizeText(term);
  if (!normalized) return '';

  const institutionNamed = normalized.match(/([\u4e00-\u9fa5]{2,8}(?:堂|阁|殿|院|司|宗|宫|府|城|谷|山|海|洲))$/);
  if (institutionNamed) return normalizeText(institutionNamed[1] || '');

  const artifactNamed = extractTailArtifactTerm(normalized);
  if (artifactNamed) return artifactNamed;
  if (/(印记|血契|契印|契约|残页|残卷|卷轴|手札|石碑|石匣|石室|古卷|钥匙|血钥|玉简|阵图|阵盘|命牌|令牌|禁制|法阵|符印|符箓|纹路|灵纹|雾纹|真解|旧约|秘录|图谱|碑文|遗令|遗书|血月)/.test(normalized)) {
    return '';
  }

  return normalized;
}

function collectUnplannedCharacterSignals(text = '', knownRoles = []) {
  const knownRoleSet = new Set((Array.isArray(knownRoles) ? knownRoles : []).map((item) => normalizeText(item)));
  const found = [];
  const rolePatterns = [
    /(?:^|[，。！？；：“”"'‘’\s])([\u4e00-\u9fa5]{2,4}(?:长老|执事|堂主|司主|掌院|护法|师兄|师姐|师叔|真人|尊者|家主|宗主))(?![\u4e00-\u9fa5])/g,
    /(?:^|[，。！？；：“”"'‘’\s])((?:巡夜|守库|守阁|守殿|外事|内务)[\u4e00-\u9fa5]{0,4}(?:弟子|修士|执事))(?![\u4e00-\u9fa5])/g
  ];

  rolePatterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = normalizeText(match[1] || match[0] || '');
      if (!name || knownRoleSet.has(name) || !isLikelyNamedEntityTerm(name)) continue;
      found.push(name);
    }
  });

  return [...new Set(found)].slice(0, 4);
}

function collectUnplannedElementSignals(text = '', knownTerms = []) {
  const knownSet = new Set((Array.isArray(knownTerms) ? knownTerms : []).map((item) => normalizeText(item)));
  const candidates = [
    ...collectInstitutionTerms(text),
    ...collectNovelTerms(text, /([\u4e00-\u9fa5]{2,12}(?:印记|血契|契印|契约|残页|残卷|卷轴|手札|石碑|石匣|石室|古卷|钥匙|血钥|玉简|阵图|阵盘|命牌|令牌|禁制|法阵|符印|符箓|纹路|灵纹|雾纹|真解|旧约|秘录|图谱|碑文|遗令|遗书|血月))/g)
  ];

  return [...new Set(candidates
    .map((item) => normalizeElementTerm(item))
    .filter((item) => item && !knownSet.has(item) && isLikelyNamedEntityTerm(item))
  )].slice(0, 6);
}

function inferCarryForwardItems({ content = '', chapterPlan = {}, newElements = [], newCharacters = [] }) {
  const carry = [];
  const endingHook = normalizeText(chapterPlan.ending_hook || '');
  const previousHook = normalizeText(chapterPlan.previous_hook || '');
  const mission = normalizeText(chapterPlan.chapter_mission || '');
  const summary = normalizeText(chapterPlan.summary || '');

  if (endingHook) carry.push(endingHook);
  if (mission) carry.push(`继续完成章节任务：${mission}`);
  if (summary && !endingHook) carry.push(`承接本章结果：${summary}`);
  newElements.forEach((item) => {
    if (item?.name) carry.push(`确认“${item.name}”是否需要在下一章继续处理。`);
  });
  newCharacters.forEach((item) => {
    if (item?.name) carry.push(`确认“${item.name}”是否需要在下一章继续保留。`);
  });
  if (!endingHook && previousHook && carry.length === 0) {
    carry.push(previousHook);
  }

  return [...new Set(carry.map((item) => normalizeText(item)).filter(Boolean))].slice(0, 6);
}

function buildFallbackContinuityReport({ content = '', chapterPlan = {}, mainStoryline = '', targetStorylines = [] }) {
  const knownRoles = extractKnownRoleNames(chapterPlan);
  const risks = [];
  const text = normalizeText(content);
  const knownTerms = collectKnownTerms(chapterPlan, [mainStoryline, ...(Array.isArray(targetStorylines) ? targetStorylines : [])]);
  const newCharacters = collectUnplannedCharacterSignals(text, knownRoles)
    .map((name) => createFallbackLedgerItem(
      name,
      '正文中出现的疑似新角色称谓',
      '需确认是否需要纳入基础信息或后续章节',
      '程序兜底发现正文出现了未在当前规划中明确挂接的角色名称，建议由模型或人工确认。',
      '待确认'
    ))
    .filter(Boolean);
  const newElements = [];
  const institutionTerms = collectInstitutionTerms(text);
  institutionTerms.forEach((term) => {
    if (!knownTerms.includes(term)) {
      risks.push(`正文出现了未挂接的组织或地点“${term}”，需确认是否需要纳入基础信息。`);
      const item = createFallbackLedgerItem(
        term,
        '正文中首次出现的组织或地点',
        '需确认是否需要纳入基础信息或后续章节',
        '程序兜底发现的新名词，只用于提醒核对，不代表已经判断其剧情价值。',
        '待确认'
      );
      if (item) newElements.push(item);
    }
  });

  collectUnplannedElementSignals(text, knownTerms).forEach((term) => {
    const item = createFallbackLedgerItem(
      term,
      '正文中首次出现的设定或线索名词',
      '需确认是否需要纳入基础信息或后续章节',
      '程序兜底发现的新名词，只用于提醒核对，不代表已经判断其剧情价值。',
      '待确认'
    );
    if (item && !newElements.some((existing) => existing.name === item.name)) {
      newElements.push(item);
    }
  });

  const mustCarryForward = inferCarryForwardItems({
    content,
    chapterPlan,
    newElements,
    newCharacters
  });

  return {
    new_characters: newCharacters.slice(0, 6),
    new_elements: newElements.slice(0, 6),
    must_carry_forward: mustCarryForward,
    continuity_risks: [...new Set(risks)].slice(0, 6)
  };
}

function buildFallbackChapterFeedback({
  content = '',
  chapterPlan = {},
  mainStoryline = '',
  targetStorylines = []
}) {
  const preview = truncate(content, 120);
  const mission = normalizeText(chapterPlan.chapter_mission || '');
  const summary = normalizeText(chapterPlan.summary || '');
  const endingHook = normalizeText(chapterPlan.ending_hook || '');
  const continuityReport = buildFallbackContinuityReport({
    content,
    chapterPlan,
    mainStoryline,
    targetStorylines
  });

  return {
    chapter_summary: summary
      || mission
      || preview
      || '本章已生成正文，但反馈抽取退回到本地兜底模式。',
    story_progress: mission
      ? `本章围绕任务推进：${mission}`
      : '本章已生成正文，但连续性反馈暂时仅能提供基础核对提示。',
    character_progress: normalizeText(chapterPlan.character_notes || '') || '关键角色的后续承接暂需结合模型判断或人工复核。',
    open_hooks: endingHook || continuityReport.must_carry_forward.join(' / ') || '下一章仍需承接当前冲突或新出现的关键信息。',
    next_chapter_focus: continuityReport.must_carry_forward[0] || endingHook || '承接本章结果，先确认哪些新内容需要转入后续。',
    continuity_report: continuityReport,
    updated_at: new Date().toISOString(),
    source: 'fallback_audit'
  };
}

function isLowConfidenceFeedback(feedback = {}, content = '') {
  const hasContent = normalizeText(content).length > 0;
  if (!hasContent) return false;
  const summary = normalizeText(feedback.chapter_summary || '');
  const progress = normalizeText(feedback.story_progress || '');
  const focus = normalizeText(feedback.next_chapter_focus || '');
  const joined = [summary, progress, focus].join('\n');
  return /内容未提供|无内容|无法总结|无法确定|正文缺失|未推进/.test(joined);
}

function auditGeneratedContentHeuristic({ content = '', chapterPlan = {}, mainStoryline = '', targetStorylineLabels = [] }) {
  const text = normalizeText(content);
  const knownRoles = extractKnownRoleNames(chapterPlan);
  const risks = [];
  const signals = [];
  const knownTerms = collectKnownTerms(chapterPlan, [mainStoryline, ...(Array.isArray(targetStorylineLabels) ? targetStorylineLabels : [])]);

  if (!text) {
    risks.push('生成结果为空，无法进入连续性链路。');
    return { risks, signals };
  }

  knownRoles.forEach((name) => {
    if (name && text.includes(name)) {
      signals.push(`命中角色：${name}`);
    }
  });

  knownTerms.slice(0, 12).forEach((term) => {
    if (term && text.includes(term)) {
      signals.push(`命中已挂接设定：${term}`);
    }
  });

  if (knownRoles.length > 0 && !knownRoles.some((name) => text.includes(name))) {
    risks.push('正文没有明确命中当前任务表里的核心出场角色，需确认是否存在角色锚点不足。');
  }

  const institutionTerms = collectInstitutionTerms(text);
  institutionTerms.forEach((term) => {
    if (!knownTerms.includes(term)) {
      risks.push(`正文出现了未挂接的组织或地点“${term}”，需确认是否需要纳入基础信息。`);
    }
  });

  const quotedTerms = collectNamedTitleTerms(text);
  quotedTerms.forEach((term) => {
    if (!knownTerms.includes(term) && !knownRoles.includes(term)) {
      risks.push(`正文出现了未挂接的新专有名词“${term}”，需确认是否需要纳入基础信息。`);
    }
  });

  if (mainStoryline) {
    signals.push(`主剧情线：${mainStoryline}`);
  }
  if (Array.isArray(targetStorylineLabels) && targetStorylineLabels.length > 0) {
    signals.push(`关联剧情线：${targetStorylineLabels.join(' / ')}`);
  }

  return {
    risks: [...new Set(risks)].slice(0, 8),
    signals: [...new Set(signals)].slice(0, 12)
  };
}

function buildContinuityAuditPrompt({ bookTitle, chapterNumber, chapterTitle, chapterPlan = {}, mainStoryline = '', targetStorylineLabels = [], content = '' }) {
  const outline = buildOutlineFromChapterPlan(chapterPlan);
  const roleNames = extractKnownRoleNames(chapterPlan);
  const knownTerms = collectKnownTerms(chapterPlan, [mainStoryline, ...(Array.isArray(targetStorylineLabels) ? targetStorylineLabels : [])]);

  return [
    '你是一名长篇小说连续性审计编辑。',
    '请基于章节计划、既有主线锚点和已生成正文，判断这章是否出现了失控扩写、空降背景、角色介入失真、主线偏移等问题。',
    '输出严格 JSON，不要添加代码块或解释。',
    '',
    'JSON schema:',
    '{',
    '  "risks": ["需要提醒的问题，若无则返回空数组"],',
    '  "signals": ["本章实际命中的关键承接点或主线锚点"],',
    '  "airdrop_items": [{"name":"疑似空降内容","type":"角色/背景/势力/规则/道具/历史信息","severity":"low/medium/high","reason":"为什么判定为疑似空降","suggestion":"建议保留/建议回收/建议先挂接再写"}],',
    '  "verdict": "stable/needs_review/risky"',
    '}',
    '',
    '审计原则：',
    '1. 允许对已挂接信息做自然扩写，但不允许把未挂接的高影响背景直接写成推动主线的核心信息。',
    '2. 如果新增信息会明显改写主线走向、角色关系基础或世界规则，且计划与上下文没有提前挂接，应判为疑似空降。',
    '3. 不要因为出现新名词就一律判错，重点看它是否承担了高影响剧情职责。',
    '4. signals 只保留正文真实命中的关键承接点，不要脑补。',
    '5. 如果正文整体围绕当前任务稳定推进，verdict 可给 stable；若有明显高风险空降或偏移，给 risky；中间态给 needs_review。',
    '',
    `书名：${bookTitle || '未命名作品'}`,
    `章节：第 ${chapterNumber || '?'} 章 ${chapterTitle || ''}`,
    `章节任务：${normalizeText(chapterPlan.chapter_mission || '') || '未提供'}`,
    `主剧情线：${mainStoryline || '未指定'}`,
    `关联剧情线：${Array.isArray(targetStorylineLabels) && targetStorylineLabels.length > 0 ? targetStorylineLabels.join(' / ') : '未指定'}`,
    `已挂接角色：${roleNames.length > 0 ? roleNames.join(' / ') : '未提供'}`,
    `已挂接设定锚点：${knownTerms.length > 0 ? knownTerms.join(' / ') : '未提供'}`,
    '',
    '章节计划：',
    outline || '未提供',
    '',
    '已生成正文：',
    content || '未提供'
  ].join('\n');
}

async function auditGeneratedContent({ bookTitle = '', chapterNumber = 0, chapterTitle = '', content = '', chapterPlan = {}, mainStoryline = '', targetStorylineLabels = [] }) {
  const fallback = auditGeneratedContentHeuristic({ content, chapterPlan, mainStoryline, targetStorylineLabels });
  if (!normalizeText(content)) return { ...fallback, airdrop_items: [], verdict: 'risky', source: 'heuristic' };

  const prompt = buildContinuityAuditPrompt({
    bookTitle,
    chapterNumber,
    chapterTitle,
    chapterPlan,
    mainStoryline,
    targetStorylineLabels,
    content
  });

  const result = await runTextGeneration(prompt, {
    temperature: 0.2,
    maxTokens: 900,
    responseFormat: { type: 'json_object' }
  });

  if (!result.success) {
    return { ...fallback, airdrop_items: [], verdict: fallback.risks.length > 0 ? 'needs_review' : 'stable', source: 'heuristic' };
  }

  const parsed = tryParseJsonObject(result.content);
  if (!parsed) {
    return { ...fallback, airdrop_items: [], verdict: fallback.risks.length > 0 ? 'needs_review' : 'stable', source: 'heuristic' };
  }

  const risks = normalizeJsonArray(parsed.risks).map((item) => normalizeText(item)).filter(Boolean).slice(0, 8);
  const signals = normalizeJsonArray(parsed.signals).map((item) => normalizeText(item)).filter(Boolean).slice(0, 12);
  const airdropItems = Array.isArray(parsed.airdrop_items)
    ? parsed.airdrop_items
      .map((item) => ({
        name: normalizeText(item?.name || ''),
        type: normalizeText(item?.type || ''),
        severity: normalizeText(item?.severity || ''),
        reason: normalizeText(item?.reason || ''),
        suggestion: normalizeText(item?.suggestion || '')
      }))
      .filter((item) => item.name || item.reason)
      .slice(0, 8)
    : [];
  const verdict = normalizeText(parsed.verdict || '') || (risks.length > 0 ? 'needs_review' : 'stable');

  return {
    risks: risks.length > 0 ? risks : fallback.risks.slice(0, 4),
    signals: signals.length > 0 ? signals : fallback.signals.slice(0, 8),
    airdrop_items: airdropItems,
    verdict,
    source: 'model_audit'
  };
}

function getChapterOutlineStructure(plan) {
  if (!plan) return {};
  return parseStructuredContent(plan.structured_content).chapter_outline_structure || {};
}

function buildStructuredOutlineText(outlineStructure = {}) {
  if (!outlineStructure || typeof outlineStructure !== 'object') return '';
  const sections = [
    ['本章目标', outlineStructure.chapter_goal],
    ['关键场景', outlineStructure.key_scenes],
    ['冲突升级', outlineStructure.conflict_escalation],
    ['角色变化', outlineStructure.character_change],
    ['读者爽点 / 情绪落点', outlineStructure.reader_payoff],
    ['结尾钩子', outlineStructure.ending_hook]
  ];

  return sections
    .map(([label, value]) => {
      const normalized = normalizeText(value);
      return normalized ? `${label}\n${normalized}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

function buildOutlineFromChapterPlan(plan) {
  if (!plan) return '';
  const sections = [];
  const outlineStructure = getChapterOutlineStructure(plan);
  const structuredOutlineText = buildStructuredOutlineText(outlineStructure);
  const chapterName = normalizeText(plan.chapter_name || '');
  const summary = normalizeText(plan.summary || '');
  const mission = normalizeText(plan.chapter_mission || '');
  const emotion = normalizeText(plan.emotion_target || '');
  const previousHook = normalizeText(plan.previous_hook || '');
  const endingHook = normalizeText(plan.ending_hook || '');
  const outlineText = normalizeText(plan.outline_text || '');
  const sceneOutline = normalizeJsonArray(plan.scene_outline);
  const characterNotes = normalizeText(plan.character_notes || '');
  const appearingRoles = normalizeJsonArray(plan.appearing_roles);
  const mainStorylineId = normalizeText(plan.main_storyline_id || '');
  const targetStorylines = normalizeJsonArray(plan.target_storylines);

  if (outlineText) return outlineText;
  if (structuredOutlineText) return structuredOutlineText;
  if (chapterName) sections.push(`章节名：${chapterName}`);
  if (summary) sections.push(`章节摘要：${summary}`);
  if (mission) sections.push(`本章任务：${mission}`);
  if (emotion) sections.push(`情绪目标：${emotion}`);
  if (previousHook) sections.push(`上章承接：${previousHook}`);
  if (characterNotes) sections.push(`本章角色说明：${characterNotes}`);

  if (appearingRoles.length > 0) {
    const roleLines = appearingRoles
      .map((item, index) => {
        if (typeof item === 'string') return `${index + 1}. ${item.trim()}`;
        if (item && typeof item === 'object') {
          const name = normalizeText(item.name || item.characterName || item.title || '');
          const role = normalizeText(item.role || item.summary || item.description || '');
          return [name, role].filter(Boolean).join('：');
        }
        return '';
      })
      .filter(Boolean);
    if (roleLines.length > 0) sections.push(`出场角色：\n${roleLines.join('\n')}`);
  }

  if (sceneOutline.length > 0) {
    const sceneLines = sceneOutline
      .map((item, index) => {
        if (typeof item === 'string') return `${index + 1}. ${item.trim()}`;
        if (item && typeof item === 'object') {
          const title = normalizeText(item.title || item.sceneTitle || item.name || '');
          const action = normalizeText(item.action || item.summary || item.content || '');
          const merged = [title, action].filter(Boolean).join('：');
          return merged ? `${index + 1}. ${merged}` : '';
        }
        return '';
      })
      .filter(Boolean);
    if (sceneLines.length > 0) sections.push(`场景拆解：\n${sceneLines.join('\n')}`);
  }

  if (mainStorylineId) sections.push(`主推进剧情线 ID：${mainStorylineId}`);
  if (targetStorylines.length > 0) sections.push(`关联剧情线 ID：${targetStorylines.join(' / ')}`);
  if (endingHook) sections.push(`结尾钩子：${endingHook}`);
  return sections.join('\n\n');
}

function normalizeChapterRange(value) {
  if (Array.isArray(value) && value.length >= 2) {
    const start = Number(value[0]);
    const end = Number(value[1]);
    if (Number.isFinite(start) && Number.isFinite(end)) return [start, end];
  }
  if (value && typeof value === 'object') {
    const start = Number(value.start || value.from || value.begin || 0);
    const end = Number(value.end || value.to || value.finish || 0);
    if (Number.isFinite(start) && Number.isFinite(end) && start > 0 && end > 0) return [start, end];
  }
  return null;
}

function pickBeatForChapter(chapterIndex, storylineContent = {}, fallbackRow = {}) {
  const beats = normalizeJsonArray(storylineContent.keyBeats || storylineContent.beats || storylineContent.development);
  if (beats.length === 0) return null;

  const exact = beats.find((beat) => {
    const chapterApprox = Number(beat.chapterApprox || beat.chapter || 0);
    if (Number.isFinite(chapterApprox) && chapterApprox > 0) {
      return chapterApprox === chapterIndex;
    }
    const range = normalizeChapterRange(beat.suggested_chapter_range || beat.suggestedChapterRange || beat.chapterRange);
    return range ? chapterIndex >= range[0] && chapterIndex <= range[1] : false;
  });
  if (exact) return exact;

  const sorted = beats
    .map((beat) => ({
      beat,
      chapterApprox: Number(beat.chapterApprox || beat.chapter || 0) || Number(fallbackRow.start_chapter || 0) || 0
    }))
    .sort((a, b) => a.chapterApprox - b.chapterApprox);

  let candidate = null;
  sorted.forEach((item) => {
    if (item.chapterApprox && item.chapterApprox <= chapterIndex) {
      candidate = item.beat;
    }
  });
  return candidate || sorted[0]?.beat || null;
}

function buildChapterStorylineContext({
  bookId,
  volumeId,
  chapterIndex,
  chapterPlan,
  storylines,
  volumeTimeline
}) {
  const mainStorylineId = normalizeText(chapterPlan?.main_storyline_id || '');
  const targetStorylineIds = normalizeJsonArray(chapterPlan?.target_storylines);
  const selectedIds = [...new Set([mainStorylineId, ...targetStorylineIds].filter(Boolean))];
  const selectedStorylines = Array.isArray(storylines)
    ? storylines.filter((item) => selectedIds.includes(item.id))
    : [];

  const timelineSlots = normalizeJsonArray(volumeTimeline?.chapterSlots || volumeTimeline?.timeline);
  const matchedSlot = timelineSlots.find((slot) => Number(slot.chapter || slot.chapterNumber || 0) === Number(chapterIndex)) || null;

  const storylineContexts = selectedStorylines.map((row) => {
    const structured = parseStructuredContent(row.structured_content);
    const beat = pickBeatForChapter(chapterIndex, structured, row);
    const payoffs = normalizeJsonArray(structured.payoffs).filter((item) => {
      const chapterApprox = Number(item?.chapterApprox || item?.chapter || 0);
      return chapterApprox === Number(chapterIndex);
    });
    const foreshadowingToPlant = normalizeJsonArray(structured.foreshadowingToPlant || structured.relatedForeshadowing).filter((item) => {
      const setupChapter = Number(item?.setupChapter || item?.chapterApprox || 0);
      return setupChapter === Number(chapterIndex);
    });
    return {
      storylineId: row.id,
      title: normalizeText(structured.title || row.storyline_name || ''),
      type: normalizeText(structured.type || row.storyline_type || ''),
      dramaticQuestion: normalizeText(structured.dramaticQuestion || row.core_conflict || ''),
      summary: normalizeText(structured.summary || row.description || ''),
      beatId: normalizeText(beat?.beatId || beat?.beat_id || ''),
      beatTitle: normalizeText(beat?.title || beat?.beat || ''),
      beatSummary: normalizeText(beat?.summary || beat?.beat || ''),
      expectedChange: normalizeText(beat?.expectedChange || beat?.expected_change || ''),
      mustInclude: normalizeJsonArray(beat?.must_include || beat?.mustInclude),
      mustAvoid: normalizeJsonArray(beat?.must_avoid || beat?.mustAvoid),
      relatedCharacters: normalizeJsonArray(structured.relatedCharacters || []).map((item) => item?.name || item).filter(Boolean),
      foreshadowingToPlant,
      payoffs,
      currentProgress: structured.currentProgress || {}
    };
  });

  const usedBeatIds = storylineContexts.map((item) => item.beatId).filter(Boolean);
  const usedStorylineIds = storylineContexts.map((item) => item.storylineId).filter(Boolean);
  const hasStructuredStorylines = storylineContexts.some((item) => item.beatId || item.dramaticQuestion || item.summary);
  const hasVolumeTimeline = !!matchedSlot;
  const isFallback = !hasStructuredStorylines && !hasVolumeTimeline;

  const lines = ['【本章剧情线约束】'];
  if (storylineContexts.length === 0) {
    lines.push('- 暂无已挂接剧情线；仅能依赖章节任务与章节目标。');
  } else {
    storylineContexts.forEach((item, index) => {
      lines.push(`- 关联剧情线 ${index + 1}：${item.title || '未命名'}${item.type ? `（${item.type}）` : ''}`);
      lines.push(`  - 当前剧情节点：${item.beatTitle || '未定位到结构化 beat，fallback 到剧情线摘要'}`);
      if (item.beatSummary) lines.push(`  - 本章必须推进：${item.beatSummary}`);
      else if (item.summary) lines.push(`  - 本章必须推进（fallback）：${item.summary}`);
      if (item.expectedChange) lines.push(`  - 角色 / 局势变化：${item.expectedChange}`);
      if (item.dramaticQuestion) lines.push(`  - 冲突升级方向：${item.dramaticQuestion}`);
      if (item.mustInclude.length > 0) lines.push(`  - 本章必须出现：${item.mustInclude.join('；')}`);
      if (item.mustAvoid.length > 0) lines.push(`  - 本章禁止提前发生：${item.mustAvoid.join('；')}`);
      if (item.relatedCharacters.length > 0) lines.push(`  - 相关角色：${item.relatedCharacters.join(' / ')}`);
      if (item.foreshadowingToPlant.length > 0) {
        lines.push(`  - 需要埋下的伏笔：${item.foreshadowingToPlant.map((entry) => normalizeText(entry.title || entry.setup || '')).filter(Boolean).join('；')}`);
      }
      if (item.payoffs.length > 0) {
        lines.push(`  - 需要回收的伏笔：${item.payoffs.map((entry) => normalizeText(entry.title || entry.name || '')).filter(Boolean).join('；')}`);
      }
    });
  }

  if (matchedSlot) {
    lines.push(`- 卷级时间线槽位：第${Number(matchedSlot.chapter || matchedSlot.chapterNumber || chapterIndex)}章`);
    if (normalizeText(matchedSlot.primaryStoryline || '')) lines.push(`  - 时间线主推进：${normalizeText(matchedSlot.primaryStoryline || '')}`);
    if (normalizeText(matchedSlot.pacingNote || matchedSlot.atmosphere || '')) lines.push(`  - 节奏 / 氛围：${normalizeText(matchedSlot.pacingNote || matchedSlot.atmosphere || '')}`);
    const activeStorylines = normalizeJsonArray(matchedSlot.activeStorylines)
      .map((item) => [normalizeText(item?.name || ''), normalizeText(item?.beat || ''), normalizeText(item?.progressType || item?.progress_type || '')].filter(Boolean).join('｜'))
      .filter(Boolean);
    if (activeStorylines.length > 0) lines.push(`  - 时间线要求：${activeStorylines.join(' / ')}`);
    const foreshadowOps = normalizeJsonArray(matchedSlot.foreshadowOps).filter(Boolean);
    if (foreshadowOps.length > 0) lines.push(`  - 时间线伏笔操作：${foreshadowOps.join('；')}`);
  } else {
    lines.push('- 卷级时间线：当前章未命中结构化 slot，fallback 到章节任务与剧情线摘要。');
  }

  if (isFallback) {
    lines.push('- fallback 说明：暂无结构化剧情线节点与卷级时间线命中，本章只能使用章节目标兜底，不能假装有明确剧情线 beat。');
  }

  return {
    bookId,
    volumeId,
    chapterIndex,
    usedStorylineIds,
    usedBeatIds,
    usedVolumeTimeline: hasVolumeTimeline,
    isFallback,
    matchedSlot,
    storylineContexts,
    promptText: lines.join('\n')
  };
}

function buildPersistedStorylineContext(storylineContext = {}) {
  const relatedStorylines = Array.isArray(storylineContext.storylineContexts)
    ? storylineContext.storylineContexts.map((item) => ({
      storylineId: normalizeText(item.storylineId || ''),
      title: normalizeText(item.title || ''),
      type: normalizeText(item.type || ''),
      summary: normalizeText(item.summary || ''),
      dramaticQuestion: normalizeText(item.dramaticQuestion || '')
    })).filter((item) => item.storylineId || item.title)
    : [];

  const currentBeats = Array.isArray(storylineContext.storylineContexts)
    ? storylineContext.storylineContexts.map((item) => ({
      storylineId: normalizeText(item.storylineId || ''),
      beatId: normalizeText(item.beatId || ''),
      title: normalizeText(item.beatTitle || ''),
      summary: normalizeText(item.beatSummary || ''),
      expectedChange: normalizeText(item.expectedChange || '')
    })).filter((item) => item.storylineId || item.beatId || item.title)
    : [];

  const mustAdvance = Array.isArray(storylineContext.storylineContexts)
    ? storylineContext.storylineContexts
      .map((item) => normalizeText(item.beatSummary || item.summary || ''))
      .filter(Boolean)
    : [];

  const mustNotHappen = Array.isArray(storylineContext.storylineContexts)
    ? storylineContext.storylineContexts.flatMap((item) => normalizeJsonArray(item.mustAvoid).map((entry) => normalizeText(entry)).filter(Boolean))
    : [];

  const foreshadowingToPlant = Array.isArray(storylineContext.storylineContexts)
    ? storylineContext.storylineContexts.flatMap((item) =>
      normalizeJsonArray(item.foreshadowingToPlant).map((entry) => ({
        storylineId: normalizeText(item.storylineId || ''),
        title: normalizeText(entry?.title || entry?.setup || ''),
        setupChapter: Number(entry?.setupChapter || entry?.chapterApprox || 0) || null,
        payoffHint: normalizeText(entry?.payoffHint || '')
      })).filter((entry) => entry.title)
    )
    : [];

  const foreshadowingToPayoff = Array.isArray(storylineContext.storylineContexts)
    ? storylineContext.storylineContexts.flatMap((item) =>
      normalizeJsonArray(item.payoffs).map((entry) => ({
        storylineId: normalizeText(item.storylineId || ''),
        title: normalizeText(entry?.title || entry?.name || ''),
        chapterApprox: Number(entry?.chapterApprox || entry?.chapter || 0) || null,
        result: normalizeText(entry?.result || entry?.resolution || '')
      })).filter((entry) => entry.title)
    )
    : [];

  const characterChangeBoundaries = Array.isArray(storylineContext.storylineContexts)
    ? storylineContext.storylineContexts
      .map((item) => ({
        storylineId: normalizeText(item.storylineId || ''),
        beatId: normalizeText(item.beatId || ''),
        expectedChange: normalizeText(item.expectedChange || ''),
        relatedCharacters: normalizeJsonArray(item.relatedCharacters).map((entry) => normalizeText(entry)).filter(Boolean)
      }))
      .filter((item) => item.expectedChange || item.relatedCharacters.length > 0)
    : [];

  const conflictEscalation = Array.isArray(storylineContext.storylineContexts)
    ? storylineContext.storylineContexts
      .map((item) => ({
        storylineId: normalizeText(item.storylineId || ''),
        beatId: normalizeText(item.beatId || ''),
        dramaticQuestion: normalizeText(item.dramaticQuestion || '')
      }))
      .filter((item) => item.dramaticQuestion)
    : [];

  const matchedSlot = storylineContext.matchedSlot || null;
  const timelineSlot = matchedSlot
    ? {
      chapter: Number(matchedSlot.chapter || matchedSlot.chapterNumber || 0) || null,
      primaryStoryline: normalizeText(matchedSlot.primaryStoryline || ''),
      pacingNote: normalizeText(matchedSlot.pacingNote || matchedSlot.atmosphere || ''),
      activeStorylines: normalizeJsonArray(matchedSlot.activeStorylines).map((item) => ({
        name: normalizeText(item?.name || ''),
        beat: normalizeText(item?.beat || ''),
        progressType: normalizeText(item?.progressType || item?.progress_type || '')
      })).filter((item) => item.name || item.beat),
      foreshadowOps: normalizeJsonArray(matchedSlot.foreshadowOps).map((entry) => normalizeText(entry)).filter(Boolean)
    }
    : null;

  const isFallback = !!storylineContext.isFallback;

  return {
    usedStorylineIds: normalizeJsonArray(storylineContext.usedStorylineIds).map((item) => normalizeText(item)).filter(Boolean),
    usedBeatIds: normalizeJsonArray(storylineContext.usedBeatIds).map((item) => normalizeText(item)).filter(Boolean),
    usedVolumeTimeline: !!storylineContext.usedVolumeTimeline,
    isFallback,
    relatedStorylines,
    currentBeats,
    mustAdvance,
    mustNotHappen,
    foreshadowingToPlant,
    foreshadowingToPayoff,
    characterChangeBoundaries,
    conflictEscalation,
    timelineSlot,
    source: isFallback ? 'fallback' : 'structured_storyline'
  };
}

function buildDraftStorylineConstraintText(storylineContext = {}) {
  const usedStorylineIds = normalizeJsonArray(storylineContext.usedStorylineIds).map((item) => normalizeText(item)).filter(Boolean);
  const usedBeatIds = normalizeJsonArray(storylineContext.usedBeatIds).map((item) => normalizeText(item)).filter(Boolean);
  const relatedStorylines = normalizeJsonArray(storylineContext.relatedStorylines);
  const currentBeats = normalizeJsonArray(storylineContext.currentBeats);
  const mustAdvance = normalizeJsonArray(storylineContext.mustAdvance).map((item) => normalizeText(typeof item === 'string' ? item : item?.summary || item?.title || '')).filter(Boolean);
  const mustNotHappen = normalizeJsonArray(storylineContext.mustNotHappen).map((item) => normalizeText(typeof item === 'string' ? item : item?.summary || item?.title || '')).filter(Boolean);
  const foreshadowingToPlant = normalizeJsonArray(storylineContext.foreshadowingToPlant);
  const foreshadowingToPayoff = normalizeJsonArray(storylineContext.foreshadowingToPayoff);
  const characterChangeBoundaries = normalizeJsonArray(storylineContext.characterChangeBoundaries);
  const conflictEscalation = normalizeJsonArray(storylineContext.conflictEscalation);
  const timelineSlot = storylineContext.timelineSlot && typeof storylineContext.timelineSlot === 'object'
    ? storylineContext.timelineSlot
    : null;
  const isFallback = !!storylineContext.isFallback;

  if (
    usedStorylineIds.length === 0 &&
    usedBeatIds.length === 0 &&
    relatedStorylines.length === 0 &&
    currentBeats.length === 0 &&
    mustAdvance.length === 0 &&
    mustNotHappen.length === 0 &&
    !timelineSlot
  ) {
    return {
      applied: false,
      usedStorylineIds: [],
      usedBeatIds: [],
      usedVolumeTimeline: false,
      isFallback: true,
      text: '【本章剧情线约束】\n当前没有结构化 storyline_context，仅使用章节计划和已有上下文兜底。'
    };
  }

  const lines = ['【本章剧情线约束】'];
  if (isFallback) {
    lines.push('当前没有完整结构化剧情线命中，仅使用章节计划和已有上下文兜底。');
  }

  if (relatedStorylines.length > 0) {
    lines.push(`- 关联剧情线：${relatedStorylines.map((item) => {
      const title = normalizeText(item?.title || '');
      const type = normalizeText(item?.type || '');
      return [title, type ? `(${type})` : ''].filter(Boolean).join('');
    }).filter(Boolean).join(' / ')}`);
  }

  if (currentBeats.length > 0) {
    lines.push(`- 当前剧情节点：${currentBeats.map((item) => {
      const title = normalizeText(item?.title || '');
      const summary = normalizeText(item?.summary || '');
      return [title, summary].filter(Boolean).join('：');
    }).filter(Boolean).join(' / ')}`);
  }

  if (mustAdvance.length > 0) {
    lines.push(`- 本章必须推进：${mustAdvance.join('；')}`);
  }

  if (mustNotHappen.length > 0) {
    lines.push(`- 本章禁止提前发生：${mustNotHappen.join('；')}`);
  }

  if (foreshadowingToPlant.length > 0) {
    lines.push(`- 需要埋下的伏笔：${foreshadowingToPlant.map((item) => normalizeText(item?.title || '')).filter(Boolean).join('；')}`);
  }

  if (foreshadowingToPayoff.length > 0) {
    lines.push(`- 需要回收的伏笔：${foreshadowingToPayoff.map((item) => normalizeText(item?.title || '')).filter(Boolean).join('；')}`);
  }

  if (characterChangeBoundaries.length > 0) {
    lines.push(`- 角色变化边界：${characterChangeBoundaries.map((item) => {
      const chars = normalizeJsonArray(item?.relatedCharacters).map((entry) => normalizeText(entry)).filter(Boolean);
      const change = normalizeText(item?.expectedChange || '');
      return [chars.join('/'), change].filter(Boolean).join('：');
    }).filter(Boolean).join(' / ')}`);
  }

  if (conflictEscalation.length > 0) {
    lines.push(`- 冲突升级方向：${conflictEscalation.map((item) => normalizeText(item?.dramaticQuestion || '')).filter(Boolean).join('；')}`);
  }

  if (timelineSlot) {
    const activeStorylines = normalizeJsonArray(timelineSlot.activeStorylines).map((item) => {
      return [normalizeText(item?.name || ''), normalizeText(item?.beat || ''), normalizeText(item?.progressType || '')]
        .filter(Boolean)
        .join('｜');
    }).filter(Boolean);
    lines.push(`- 卷级时间线槽位：第${Number(timelineSlot.chapter || 0) || '?'}章${normalizeText(timelineSlot.primaryStoryline || '') ? `，主推进 ${normalizeText(timelineSlot.primaryStoryline || '')}` : ''}`);
    if (normalizeText(timelineSlot.pacingNote || '')) {
      lines.push(`- 时间线节奏提示：${normalizeText(timelineSlot.pacingNote || '')}`);
    }
    if (activeStorylines.length > 0) {
      lines.push(`- 时间线要求：${activeStorylines.join(' / ')}`);
    }
    const foreshadowOps = normalizeJsonArray(timelineSlot.foreshadowOps).map((item) => normalizeText(item)).filter(Boolean);
    if (foreshadowOps.length > 0) {
      lines.push(`- 时间线伏笔操作：${foreshadowOps.join('；')}`);
    }
  }

  lines.push('- 执行要求：不要提前写后续剧情节点，不要跳过本章必须推进项，不要随意回收未到时机的伏笔，角色变化不能超过本章边界，冲突升级必须符合当前节奏。');

  return {
    applied: true,
    usedStorylineIds,
    usedBeatIds,
    usedVolumeTimeline: !!storylineContext.usedVolumeTimeline,
    isFallback,
    text: lines.join('\n')
  };
}

function relatedStorylineTitlesFromContext(storylineContext = {}) {
  return normalizeJsonArray(storylineContext.relatedStorylines)
    .map((item) => normalizeText(item?.title || ''))
    .filter(Boolean);
}

function relatedStorylineTitleFromContext(storylineContext = {}, preferFirst = false) {
  const titles = relatedStorylineTitlesFromContext(storylineContext);
  if (titles.length === 0) return '';
  return preferFirst ? titles[0] : titles.join(' / ');
}

async function saveChapterStorylineContext({ bookId, chapterNumber, storylineContext }) {
  const db = await dbPromise;
  const existingPlan = execQueryOne(
    db,
    'SELECT id, structured_content FROM chapter_plans WHERE book_id = ? AND chapter_number = ? ORDER BY updated_at DESC LIMIT 1',
    [bookId, chapterNumber]
  );

  if (!existingPlan) return null;

  const structuredContent = parseStructuredContent(existingPlan.structured_content);
  structuredContent.storyline_context = buildPersistedStorylineContext(storylineContext);

  db.run(
    'UPDATE chapter_plans SET structured_content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(structuredContent), existingPlan.id]
  );
  saveDatabase(db);
  return structuredContent.storyline_context;
}

async function saveChapterFeedback({ bookId, chapterNumber, feedback }) {
  const db = await dbPromise;
  const existingPlan = execQueryOne(
    db,
    'SELECT id, chapter_id, main_storyline_id, target_storylines, structured_content FROM chapter_plans WHERE book_id = ? AND chapter_number = ? ORDER BY updated_at DESC LIMIT 1',
    [bookId, chapterNumber]
  );

  if (!existingPlan) return null;

  const structuredContent = parseStructuredContent(existingPlan.structured_content);
  structuredContent.chapter_feedback = feedback;

  let storylineProgressUpdated = false;
  let requiresStorylineReview = false;

  db.run(
    'UPDATE chapter_plans SET structured_content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(structuredContent), existingPlan.id]
  );

  try {
    const updatedCount = syncStorylineProgressFromChapterPlan(db, {
      bookId,
      chapterNumber,
      chapterId: existingPlan.chapter_id || '',
      chapterGoal: {
        main_storyline_id: existingPlan.main_storyline_id || '',
        target_storylines: normalizeJsonArray(existingPlan.target_storylines)
      },
      structuredContent
    });
    storylineProgressUpdated = updatedCount > 0;
    requiresStorylineReview = !!parseStructuredContent(structuredContent.storyline_context)?.isFallback;
  } catch (error) {
    logger.error('Storyline progress writeback failed', {
      error: error.message,
      bookId,
      chapterNumber
    });
  }

  saveDatabase(db);
  return {
    feedback,
    storylineProgressUpdated,
    requiresStorylineReview
  };
}

async function loadBookGenerationContext(bookId, chapterNumber) {
  if (!bookId) {
    return {
      bookTitle: '',
      contextNotes: '',
      storedCharacters: '',
      characterSummary: '',
      chapterPlan: null,
      currentChapter: null,
      previousChapter: null
    };
  }

  const db = await dbPromise;
  const book = execQueryOne(db, 'SELECT title FROM books WHERE id = ?', [bookId]);

  let outlineRow = null;
  try {
    outlineRow = execQueryOne(
      db,
      'SELECT * FROM novel_outlines WHERE book_id = ? ORDER BY updated_at DESC, created_at DESC LIMIT 1',
      [bookId]
    );
  } catch (_) {}

  let bookPlanRow = null;
  try {
    bookPlanRow = execQueryOne(
      db,
      'SELECT premise, main_goal, core_conflict, world_rules, role_summary, main_outline, volume_outline, detailed_outline FROM book_plans WHERE book_id = ? ORDER BY updated_at DESC, created_at DESC LIMIT 1',
      [bookId]
    );
  } catch (_) {}

  let characterRows = [];
  try {
    characterRows = execQuery(db, 'SELECT * FROM novel_characters WHERE book_id = ? ORDER BY id ASC', [bookId]);
  } catch (_) {}

  let chapterRows = [];
  try {
    chapterRows = execQuery(
      db,
      'SELECT id, chapter_number, chapter_name, title, outline, content, structured_content FROM chapters WHERE book_id = ? ORDER BY chapter_number ASC',
      [bookId]
    );
  } catch (_) {}

  let chapterPlanRows = [];
  try {
    chapterPlanRows = execQuery(
      db,
      'SELECT * FROM chapter_plans WHERE book_id = ? ORDER BY chapter_number ASC, updated_at DESC',
      [bookId]
    );
  } catch (_) {}

  let storylineRows = [];
  try {
    storylineRows = execQuery(
      db,
      'SELECT id, storyline_name, storyline_type, volume_number, storyline_number, description, core_conflict, start_chapter, end_chapter, structured_content FROM storylines WHERE book_id = ? ORDER BY volume_number ASC, storyline_number ASC, created_at ASC',
      [bookId]
    );
  } catch (_) {}

  let volumeTimelineRows = [];
  try {
    volumeTimelineRows = execQuery(
      db,
      'SELECT * FROM volume_timelines WHERE book_id = ? ORDER BY volume_number ASC, updated_at DESC',
      [bookId]
    );
  } catch (_) {}

  const currentChapterNumber = Number(chapterNumber);
  const currentChapter = Number.isFinite(currentChapterNumber)
    ? chapterRows.find((row) => Number(row.chapter_number || 0) === currentChapterNumber) || null
    : null;
  const previousChapter = Number.isFinite(currentChapterNumber)
    ? [...chapterRows].reverse().find((row) => Number(row.chapter_number || 0) < currentChapterNumber) || null
    : chapterRows[chapterRows.length - 1] || null;
  const chapterPlanRow = Number.isFinite(currentChapterNumber)
    ? chapterPlanRows.find((row) => Number(row.chapter_number || 0) === currentChapterNumber) || null
    : null;
  const previousChapterPlan = Number.isFinite(currentChapterNumber)
    ? [...chapterPlanRows].reverse().find((row) => Number(row.chapter_number || 0) < currentChapterNumber) || null
    : null;

  const previousChapterFeedback = parseStructuredContent(previousChapterPlan?.structured_content)?.chapter_feedback || null;
  const bookPremise = normalizeText(bookPlanRow?.premise || '');
  const bookMainGoal = normalizeText(bookPlanRow?.main_goal || '');
  const bookCoreConflict = normalizeText(bookPlanRow?.core_conflict || '');
  const bookWorldRules = normalizeText(bookPlanRow?.world_rules || '');
  const bookRoleSummary = normalizeText(bookPlanRow?.role_summary || '');
  const bookOutline = normalizeText(outlineRow?.content || outlineRow?.main_outline || '');
  const volumeOutline = normalizeText(outlineRow?.volume_outline || '');
  const detailedOutline = normalizeText(outlineRow?.detailed_outline || '');
  const bookPlanMainOutline = normalizeText(bookPlanRow?.main_outline || '');
  const bookPlanVolumeOutline = normalizeText(bookPlanRow?.volume_outline || '');
  const bookPlanDetailedOutline = normalizeText(bookPlanRow?.detailed_outline || '');
  const chapterOutline = normalizeText(buildOutlineFromChapterPlan(chapterPlanRow));
  const chapterOutlineStructure = getChapterOutlineStructure(chapterPlanRow);
  const structuredOutlineText = normalizeText(buildStructuredOutlineText(chapterOutlineStructure));
  const characterSummary = buildCharacterSummaryContext(characterRows);
  const storedCharacters = buildStoredCharacterContext(characterRows);
  const previousHook = normalizeText(chapterPlanRow?.previous_hook || '');
  const chapterCharacterNotes = normalizeText(chapterPlanRow?.character_notes || '');
  const chapterMission = normalizeText(chapterPlanRow?.chapter_mission || '');
  const emotionTarget = normalizeText(chapterPlanRow?.emotion_target || '');
  const endingHook = normalizeText(chapterPlanRow?.ending_hook || '');
  const summary = normalizeText(chapterPlanRow?.summary || '');

  const mainStoryline = chapterPlanRow?.main_storyline_id
    ? storylineRows.find((item) => item.id === chapterPlanRow.main_storyline_id) || null
    : null;
  const targetStorylineIds = normalizeJsonArray(chapterPlanRow?.target_storylines);
  const targetStorylineLabels = storylineRows
    .filter((item) => targetStorylineIds.includes(item.id))
    .map((item) => item.storyline_name)
    .filter(Boolean);
  const currentVolumeNumber = Number(chapterPlanRow?.volume_number || mainStoryline?.volume_number || targetStorylineIds.map((id) => storylineRows.find((item) => item.id === id)?.volume_number).find(Boolean) || 0) || 0;
  const volumeTimelineRow = currentVolumeNumber
    ? volumeTimelineRows.find((item) => Number(item.volume_number || 0) === currentVolumeNumber) || null
    : null;
  const volumeTimeline = volumeTimelineRow ? parseStructuredContent(volumeTimelineRow.timeline_data) : null;
  const keyCharacterNames = characterRows
    .map((item) => normalizeText(item.name))
    .filter((name) => name && name !== '全书角色设定' && name !== '本章新增角色')
    .slice(0, 8);
  const chapterStorylineContext = buildChapterStorylineContext({
    bookId,
    volumeId: volumeTimelineRow?.id || '',
    chapterIndex: currentChapterNumber,
    chapterPlan: chapterPlanRow || {},
    storylines: storylineRows,
    volumeTimeline
  });

  const notes = [];
  if (bookPremise) notes.push(`作品前提：${bookPremise}`);
  if (bookMainGoal) notes.push(`阶段主目标：${bookMainGoal}`);
  if (bookCoreConflict) notes.push(`核心冲突：${bookCoreConflict}`);
  if (bookWorldRules) notes.push(`世界规则：${bookWorldRules}`);
  if (bookRoleSummary) notes.push(`全书角色摘要：${bookRoleSummary}`);
  if (keyCharacterNames.length > 0) {
    notes.push(`姓名硬约束：本书当前可用核心角色名为 ${keyCharacterNames.join(' / ')}。正文只能使用这套人物体系，严禁替换主角姓名或串入其他作品人物名。`);
  }
  if (bookOutline) notes.push(`全书大纲：${bookOutline}`);
  if (bookPlanMainOutline && bookPlanMainOutline !== bookOutline) notes.push(`全书主线：${bookPlanMainOutline}`);
  if (volumeOutline) notes.push(`分卷大纲：${volumeOutline}`);
  if (bookPlanVolumeOutline && bookPlanVolumeOutline !== volumeOutline) notes.push(`分卷规划：${bookPlanVolumeOutline}`);
  if (detailedOutline) notes.push(`详细大纲：${detailedOutline}`);
  if (bookPlanDetailedOutline && bookPlanDetailedOutline !== detailedOutline) notes.push(`详细推进：${bookPlanDetailedOutline}`);
  if (summary) notes.push(`章节摘要：${summary}`);
  if (structuredOutlineText) notes.push(`结构化细纲：\n${structuredOutlineText}`);
  if (chapterOutline && chapterOutline !== structuredOutlineText) notes.push(`章节规划：${chapterOutline}`);
  if (chapterMission) notes.push(`章节任务：${chapterMission}`);
  if (emotionTarget) notes.push(`情绪目标：${emotionTarget}`);
  if (previousHook) notes.push(`上章承接：${previousHook}`);
  if (chapterCharacterNotes) notes.push(`本章角色说明：${chapterCharacterNotes}`);
  if (endingHook) notes.push(`结尾钩子：${endingHook}`);
  if (mainStoryline) notes.push(`主剧情线：${mainStoryline.storyline_name}${mainStoryline.storyline_type ? ' · ' + mainStoryline.storyline_type : ''}`);
  if (targetStorylineLabels.length > 0) notes.push(`关联剧情线：${targetStorylineLabels.join(' / ')}`);
  if (characterSummary) notes.push(`角色摘要：\n${characterSummary}`);
  if (previousChapterFeedback) {
    const continuityReport = previousChapterFeedback.continuity_report || {};
    const newCharacters = normalizeFeedbackLedgerItems(continuityReport.new_characters);
    const newElements = normalizeFeedbackLedgerItems(continuityReport.new_elements);
    const continuityRisks = normalizeJsonArray(continuityReport.continuity_risks)
      .map((item) => typeof item === 'string' ? normalizeText(item) : normalizeText(item?.note || item?.summary || ''))
      .filter(Boolean);
    const carryForward = normalizeJsonArray(continuityReport.must_carry_forward)
      .map((item) => typeof item === 'string' ? normalizeText(item) : normalizeText(item?.note || item?.summary || item?.name || ''))
      .filter(Boolean);

    if (carryForward.length > 0) {
      notes.push(`下一章必须承接：\n${carryForward.join('\n')}`);
    }
    const feedbackLines = [
      previousChapterFeedback.chapter_summary,
      previousChapterFeedback.story_progress,
      previousChapterFeedback.character_progress,
      previousChapterFeedback.open_hooks,
      previousChapterFeedback.next_chapter_focus
    ].map((item) => normalizeText(item)).filter(Boolean);
    if (feedbackLines.length > 0) {
      notes.push(`上一章反馈：\n${feedbackLines.join('\n')}`);
    }
    if (newCharacters.length > 0) {
      notes.push(`上一章新增角色台账：\n${newCharacters.map((item, index) => `${index + 1}. ${[item.name, item.role, item.relation, item.note].filter(Boolean).join('｜')}`).join('\n')}`);
    }
    if (newElements.length > 0) {
      notes.push(`上一章新增设定台账：\n${newElements.map((item, index) => `${index + 1}. ${[item.name, item.role, item.relation, item.note].filter(Boolean).join('｜')}`).join('\n')}`);
    }
    if (continuityRisks.length > 0) {
      notes.push(`连续性风险提醒：\n${continuityRisks.join('\n')}`);
    }
  }
  notes.push(buildDynamicGenerationConstraints({
    chapterPlan: chapterPlanRow || {},
    previousChapterFeedback,
    characterRows,
    storylineRows
  }));
  const generationConstraints = buildDynamicGenerationConstraintState({
    chapterPlan: chapterPlanRow || {},
    previousChapterFeedback,
    characterRows,
    storylineRows
  });
  if (previousChapter?.content) {
    notes.push(`上一章正文片段：${truncate(previousChapter.content, 600)}`);
  }

  return {
    bookTitle: normalizeText(book?.title || ''),
    contextNotes: notes.join('\n\n'),
    generationConstraints,
    chapterStorylineContext,
    characterNames: collectStoredCharacterNames(characterRows),
    storedCharacters,
    characterSummary,
    chapterPlan: chapterPlanRow || null,
    currentChapter,
    previousChapter
  };
}

function buildChapterFeedbackPrompt({ bookTitle, chapterNumber, chapterTitle, outline, mission, emotionTarget, mainStoryline, targetStorylines, content }) {
  return [
    '你是一名连续性审计编辑。请根据本章规划和已生成正文，输出这一章对后续创作真正有用的推进反馈。',
    '你的任务不是润色，不是夸奖，也不是改写正文，而是抽取事实、识别新增内容、判断这些新增内容是否合理。',
    '请严格输出 JSON，不要加代码块，不要加额外解释。',
    '输出内容必须是合法 JSON 对象，且全文必须包含 JSON 所需字段，不要返回自然语言段落。',
    '',
    'JSON schema:',
    '{',
    '  "chapter_summary": "用 1-2 句话总结这一章实际发生了什么",',
    '  "story_progress": "这一章把主剧情推进到了哪里",',
    '  "character_progress": "关键角色关系或状态发生了什么变化",',
    '  "open_hooks": "这一章结束时还悬着什么",',
    '  "next_chapter_focus": "下一章最值得优先承接的写作重点",',
    '  "continuity_report": {',
    '    "new_characters": [{"name": "新增角色名", "role": "本章职责", "relation": "与主角/主线关系", "status": "合理/偏突兀", "note": "是否值得继续保留"}],',
    '    "new_elements": [{"name": "新增势力/地点/规则/道具", "role": "本章职责", "relation": "与当前主线关系", "status": "合理/偏突兀", "note": "后续是否应继续使用"}],',
    '    "must_carry_forward": ["下一章必须继续承接的信息"],',
    '    "continuity_risks": ["本章里可能导致后续失控的点"]',
    '  }',
    '}',
    '',
    '审计规则：',
    '1. 只能依据提供的正文和规划抽取信息，禁止脑补正文里没有发生的内容。',
    '2. 如果正文里已经明确出现角色、设定、地点、势力、规则变化，就必须如实提取。',
    '3. 如果新增内容缺少已知挂接来源，或与当前主线的连接证据不足，必须写进 continuity_risks。',
    '4. 如果正文内容足够明确，就不能返回“内容缺失”或“无法判断”之类的空泛话术。',
    '5. chapter_summary / story_progress / character_progress 都要写成具体事实，不要写评价性语言。',
    '6. must_carry_forward 只保留真正会影响下一章主线推进、角色关系、规则约束或关键线索的内容；低影响场景细节不要塞进去。',
    '7. 不要把你对风险的判断反推成新的设定台账项；风险就是风险，设定就是设定，两者分开。',
    '',
    '如果本章没有合理新增角色或新增设定，就返回空数组，不要硬编。',
    '如果本章新增内容缺少已知挂接来源，或与当前主线连接证据不足，请在 continuity_risks 里直接指出。',
    'must_carry_forward 只保留真正需要下章继续处理的内容，不要泛泛而谈。',
    '',
    '书名：' + (bookTitle || '未命名作品'),
    '章节：第 ' + (chapterNumber || '?') + ' 章 ' + (chapterTitle || ''),
    '章节任务：' + (mission || '未提供'),
    '情绪目标：' + (emotionTarget || '未提供'),
    '主剧情线：' + (mainStoryline || '未指定'),
    '关联剧情线：' + (Array.isArray(targetStorylines) && targetStorylines.length > 0 ? targetStorylines.join(' / ') : '未指定'),
    '',
    '本章规划：',
    outline || '未提供',
    '',
    '已生成正文：',
    content || '未提供',
    '',
    '再次提醒：只抽取正文里已经写出来的事实，不要脑补缺失情节。'
  ].join('\n');
}

function buildBookTitlePrompt({ genre, subgenre }) {
  const typeInfo = subgenre ? genre + ' - ' + subgenre : genre;
  return [
    '你是一位资深网文编辑。',
    '请为以下类型小说生成一个书名。',
    '',
    '类型：' + typeInfo,
    '',
    '要求：',
    '1. 只输出一个书名，不要解释。',
    '2. 书名要简洁、有记忆点。',
    '3. 不要包含“第X章”或过长修饰。',
    '4. 书名要符合类型氛围。'
  ].join('\n');
}

function buildChapterNamePrompt({ genre, subgenre, chapterNumber }) {
  const typeInfo = subgenre ? genre + ' - ' + subgenre : genre;
  return [
    '你是一位精通网文章节节奏的编辑。',
    '请为第 ' + chapterNumber + ' 章生成一个章节名。',
    '',
    '类型：' + typeInfo,
    '',
    '要求：',
    '1. 只输出一个章节名，不要解释。',
    '2. 章节名要有画面感。',
    '3. 不要带“第X章”前缀。',
    '4. 要体现本章核心冲突或转折。'
  ].join('\n');
}

function buildOutlinePrompt({ genre, subgenre, bookTitle, chapterTitle, characters, contextNotes, chapterStorylinePrompt }) {
  const typeInfo = subgenre ? genre + ' - ' + subgenre : genre;
  return [
    '请为以下章节创作一段给作者直接使用的章节细纲。',
    '你必须优先遵守章节任务与剧情线约束，不要自由偏航。',
    '这份细纲是前端正式展示稿，不是内部任务清单。',
    '',
    '类型：' + typeInfo,
    '书名：' + (bookTitle || '未提供'),
    '章节名：' + (chapterTitle || '未提供'),
    '角色：' + (characters || '未提供'),
    '',
    contextNotes ? '上下文：\n' + contextNotes : '',
    chapterStorylinePrompt ? '\n剧情线约束：\n' + chapterStorylinePrompt : '\n剧情线约束：\n暂无结构化剧情线，仅使用章节目标兜底。',
    '输出要求：',
    '1. 直接输出一版内容完整的章节细纲草稿，优先把剧情推进信息写全。',
    '2. 必须使用完整自然句，严禁小标题，严禁写“本章目标/关键场景/冲突升级”这类栏目名。',
    '3. 总字数控制在 110-180 字之间，够清楚即可，不要膨胀成剧情正文。',
    '4. 只按 5W1H 章纲方式写：谁在什么处境下，于哪里展开行动，要做什么，为什么会这样推进，最后形成什么结果或钩子。',
    '5. 保持章纲粒度，允许概括“前段/中段/后段”的推进，不要展开成逐场景描写、心理细描或对白片段。',
    '6. 每一句都必须服务当前章必须推进的剧情节点，不能提前写出被禁止发生的事件。',
    '7. 不要输出解释性话术，不要说“以下是细纲”或“要点如下”，直接给细纲正文。'
  ].filter(Boolean).join('\n');
}

function buildOutlineNarrativeRewritePrompt({
  genre,
  subgenre,
  bookTitle,
  chapterTitle,
  contextNotes,
  chapterStorylinePrompt,
  draftOutline
}) {
  const typeInfo = subgenre ? genre + ' - ' + subgenre : genre;
  return [
    '请把下面的章节细纲草稿，改写成给作者直接阅读的自然叙事稿。',
    '你的任务不是重写剧情，而是保留全部有效信息，只优化表达方式。',
    '',
    '类型：' + typeInfo,
    '书名：' + (bookTitle || '未提供'),
    '章节名：' + (chapterTitle || '未提供'),
    '',
    contextNotes ? '上下文：\n' + contextNotes : '',
    chapterStorylinePrompt ? '\n剧情线约束：\n' + chapterStorylinePrompt : '',
    '',
    '原始细纲草稿：',
    draftOutline || '未提供',
    '',
    '改写要求：',
    '1. 只输出最终叙事稿，不要解释。',
    '2. 必须改写成单段或双段的自然叙事型章纲，像编辑写给作者的正式章节说明，不是正文。',
    '3. 绝对不能删掉原稿里的推进点、冲突点、角色动作、结尾钩子和真假目标信息。',
    '4. 可以补足连接词和承接语，让因果与节奏更顺，但不能新增原稿没有的重要剧情事实。',
    '5. 不要分点，不要编号，不要栏目名，不要字段拼接感。',
    '6. 语言要自然，但保持“章纲抽象层级”：只概括推进，不展开成具体画面、对白、长动作链或细腻心理描写。',
    '7. 按 5W1H 收束表达：谁、在什么处境、于哪里、要做什么、为什么这样推进、结果与后续钩子是什么。',
    '8. 优先使用“前段/中段/后段”“先…再…最后…”这类概括表达，而不是把每个瞬间写成小说段落。',
    '9. 总字数控制在 120-180 字，信息完整，但不要写得像正文。'
  ].filter(Boolean).join('\n');
}

async function rewriteOutlineNarratively({
  genre,
  subgenre,
  bookTitle,
  chapterTitle,
  contextNotes,
  chapterStorylinePrompt,
  rawOutline
}) {
  const rewritePrompt = buildOutlineNarrativeRewritePrompt({
    genre,
    subgenre,
    bookTitle,
    chapterTitle,
    contextNotes,
    chapterStorylinePrompt,
    draftOutline: rawOutline
  });
  return runTextGeneration(rewritePrompt, { temperature: 0.65, maxTokens: 900 });
}

function buildCharacterNamesPrompt({ genre, subgenre, importantCount = 5, otherCount = 5 }) {
  const typeInfo = subgenre ? genre + ' - ' + subgenre : genre;
  return [
    '你是一位资深网文作者。',
    '请为以下类型小说生成角色名字列表。',
    '',
    '类型：' + typeInfo,
    '重要配角数：' + importantCount,
    '其他角色数：' + otherCount,
    '',
    '要求：',
    '1. 只输出角色名字，每行一个。',
    '2. 名字要符合类型氛围。',
    '3. 不要解释。'
  ].join('\n');
}

function buildCharacterProfilesPrompt({ genre, subgenre, characterNames, characterConfig }) {
  const typeInfo = subgenre ? genre + ' - ' + subgenre : genre;
  return [
    '你是一位资深网文作者。',
    '请根据以下信息生成角色设定。',
    '',
    '类型：' + typeInfo,
    '角色名单：\n' + (characterNames || '未提供'),
    characterConfig ? '\n角色配置：\n' + characterConfig : '',
    '',
    '要求：',
    '1. 输出 JSON 数组。',
    '2. 每项包含 name、personality、background。',
    '3. 不要解释。'
  ].filter(Boolean).join('\n');
}

function buildFullOutlinePrompt({ genre, subgenre, bookTitle, description, characters }) {
  const typeInfo = subgenre ? genre + ' - ' + subgenre : genre;
  return [
    '你是一位资深网文编辑和策划。',
    '请根据以下信息输出完整书籍大纲。',
    '',
    '类型：' + typeInfo,
    '书名：' + (bookTitle || '未提供'),
    description ? '作品描述：\n' + description : '',
    characters ? '角色设定：\n' + characters : '',
    '',
    '输出要求：',
    '1. 输出 JSON 对象。',
    '2. 包含 main_outline、volume_outline、detailed_outline。',
    '3. 不要解释。'
  ].filter(Boolean).join('\n');
}

function buildCleanPolishPrompt(content, requirements, options = {}) {
  const parts = [
    '请根据以下要求润色网文正文。',
    '',
    '【原文】',
    content,
    '',
    '【润色要求】',
    requirements || '保持原文风格，提升流畅度和画面感。'
  ];

  if (normalizeText(options.targetStyle)) {
    parts.push('', '【目标风格】', normalizeText(options.targetStyle));
  }

  if (normalizeText(options.notes)) {
    parts.push('', '【补充说明】', normalizeText(options.notes));
  }

  parts.push('', '请直接输出润色后的正文，不要解释。');
  return parts.join('\n');
}

function buildContinuePrompt(content, continueWordCount = 1000) {
  return [
    '请根据以下内容继续创作：',
    '',
    '【上文】',
    content,
    '',
    '【续写要求】',
    '1. 保持情节连贯。',
    '2. 保持角色性格一致。',
    '3. 延续上文风格和语气。',
    '4. 目标字数控制在 ' + continueWordCount + ' 字左右。',
    '5. 为续写生成一个合适的章节标题。',
    '',
    '【重要提醒】',
    '续写内容中不要包含章节序号或章节标题。',
    '只返回 JSON，不要附加任何说明。',
    '{',
    '  "content": "续写的正文内容（不包含章节序号）",',
    '  "suggestedTitle": "建议的章节标题（例如：第2章 青铜钥匙）"',
    '}'
  ].join('\n');
}

function buildCharacterCheckPrompt(characters, content) {
  return [
    '请检查以下网文内容与角色设定的一致性：',
    '',
    '【角色设定】',
    characters,
    '',
    '【生成内容】',
    truncate(content, 3000),
    '',
    '【检查要求】',
    '1. 角色性格是否符合设定。',
    '2. 角色行为是否合理。',
    '3. 角色语言风格是否一致。',
    '4. 是否存在人设崩坏。',
    '5. 给出具体改进建议。',
    '',
    '请以 JSON 格式返回检查结果，包含 consistent、issues、suggestions、score。'
  ].join('\n');
}

function buildPlotCheckPrompt(content) {
  return [
    '请检查以下网文内容的剧情逻辑冲突：',
    '',
    '【章节内容】',
    truncate(content, 3000),
    '',
    '【检测要求】',
    '1. 时间线是否矛盾。',
    '2. 事件因果关系是否合理。',
    '3. 人物行为是否有逻辑漏洞。',
    '4. 设定是否前后不一致。',
    '5. 是否存在明显剧情 bug。',
    '',
    '请以 JSON 格式返回检测结果，包含 hasConflict、conflicts、severity、recommendations。'
  ].join('\n');
}

function buildForeshadowPrompt(content) {
  return [
    '请分析以下网文内容，识别其中可能埋下的伏笔：',
    '',
    '【章节内容】',
    truncate(content, 2000),
    '',
    '【检测要求】',
    '1. 找出可能成为后续剧情关键的物品、人物、事件。',
    '2. 识别暗示性对话或描述。',
    '3. 注意神秘或未解释的元素。',
    '4. 每个伏笔给出简短描述。',
    '',
    '请以 JSON 数组格式返回，每项包含 title、description、type。'
  ].join('\n');
}

function buildOptimizePrompt(content, recommendations) {
  return [
    '请根据以下修改建议优化网文内容：',
    '',
    '【原文】',
    truncate(content, 3000),
    '',
    '【修改建议】',
    recommendations,
    '',
    '【优化要求】',
    '1. 保持原文风格和情节走向。',
    '2. 针对性解决提到的问题。',
    '3. 优化语言表达，使其更流畅。',
    '4. 不要大幅改动剧情。',
    '',
    '请直接输出优化后的内容。'
  ].join('\n');
}

function buildTranslatePrompt(content, targetLanguage) {
  return [
    '请将以下中文网文内容翻译成 ' + targetLanguage + '：',
    '',
    '【原文】',
    truncate(content, 2000),
    '',
    '【翻译要求】',
    '1. 保持原文的文学性和美感。',
    '2. 对话要自然流畅。',
    '3. 专有名词保留原文或音译。',
    '4. 文化特色词汇适当解释。',
    '5. 保持段落结构。',
    '',
    '请直接输出翻译结果，不要添加额外说明。'
  ].join('\n');
}

async function runTextGeneration(prompt, {
  model = 'deepseek-chat',
  temperature = 0.7,
  maxTokens = 2000,
  responseFormat = null
} = {}) {
  return deepseekService.generate({
    prompt,
    model,
    temperature,
    maxTokens,
    responseFormat
  });
}

function writeSseEvent(res, eventName, payload) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function prepareSseResponse(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }
}

async function prepareChapterContentGenerationContext(requestBody = {}) {
  const {
    bookId,
    bookTitle,
    genre = 'urban',
    subgenre,
    platform = 'qidian',
    template,
    chapterTitle = '',
    outline = '',
    characters = '',
    shuangTags = [],
    emotionIntensity = 70,
    colloquialLevel = 80,
    dialogueRatio = 30,
    wordCount = 2000,
    addCliffhanger,
    enhanceDialogue,
    avoidAIFeel,
    fastPace,
    detailedDesc,
    model
  } = requestBody;

  const chapterNumber = Number.parseInt(requestBody.chapterNumber, 10);
  const storedContext = await loadBookGenerationContext(bookId, chapterNumber);
  const chapterPlan = storedContext.chapterPlan || {};
  const storylineContext = parseStructuredContent(chapterPlan.structured_content).storyline_context || {};
  const draftStorylineConstraint = buildDraftStorylineConstraintText(storylineContext);
  const finalBookTitle = normalizeText(bookTitle) || storedContext.bookTitle;
  const finalCharacters = [storedContext.storedCharacters, normalizeText(characters)].filter(Boolean).join('\n\n');
  const briefText = buildGenerationBriefText(requestBody.generationBrief);
  const finalContextNotes = [storedContext.contextNotes, draftStorylineConstraint.text, briefText].filter(Boolean).join('\n\n');
  const structuredOutline = normalizeText(buildStructuredOutlineText(getChapterOutlineStructure(chapterPlan)));
  const requestChapterPlan = requestBody.chapterPlan && typeof requestBody.chapterPlan === 'object' ? requestBody.chapterPlan : {};
  const requestChapterStructure = requestBody.chapterStructure && typeof requestBody.chapterStructure === 'object' ? requestBody.chapterStructure : {};
  const mergedChapterPlanForValidation = {
    ...chapterPlan,
    ...requestChapterPlan,
    chapter_structure: {
      ...(chapterPlan.chapter_structure || {}),
      ...requestChapterStructure,
      ...(requestChapterPlan.chapter_structure || {})
    }
  };
  const roleExecution = normalizeRoleExecutionList(
    requestBody.chapterPlan?.role_execution
    || requestBody.chapterPlan?.structured_content?.role_execution
    || chapterPlan?.structured_content?.role_execution
  );
  const requestedOutline = normalizeText(outline);
  const finalOutlineCandidate = requestedOutline
    || structuredOutline
    || normalizeText(chapterPlan.outline_text || buildOutlineFromChapterPlan(chapterPlan));
  const hasOutlineAnchor = hasUsableChapterOutlineForGeneration({
    outline: finalOutlineCandidate,
    chapterPlan: mergedChapterPlanForValidation,
    chapterStructure: requestChapterStructure
  });
  const hasStorylineAnchor = hasMountedStorylineSelectionForGeneration(mergedChapterPlanForValidation);
  const finalOutline = finalOutlineCandidate || (
    hasStorylineAnchor
      ? '当前章节未填写细纲，请严格围绕已挂接剧情线、卷任务与现有上下文推进，不得擅自扩线或跳出既定承接。'
      : ''
  );

  if (!hasOutlineAnchor && !hasStorylineAnchor) {
    const error = new Error('当前既没有章节细纲，也没有剧情线挂载。请先补齐章节细纲，或至少挂载一条剧情线后再生成。');
    error.statusCode = 400;
    throw error;
  }

  const generationContextError = validateChapterGenerationContext({
    requestCharacters: characters,
    storedContext
  });
  if (generationContextError) {
    const error = new Error(generationContextError);
    error.statusCode = 400;
    throw error;
  }

  const requestedWordCount = Number(wordCount) || 2000;
  const maxTokens = Math.max(900, Math.ceil(requestedWordCount * 0.66));
  const safeModel = model || 'deepseek-chat';
  const prompt = deepseekService.buildCreativePrompt({
    bookTitle: finalBookTitle,
    genre,
    subgenre,
    platform,
    template,
    chapterTitle,
    chapterSummary: normalizeText(chapterPlan.summary || ''),
    outline: finalOutline,
    characters: finalCharacters,
    appearingRoles: normalizeJsonArray(chapterPlan.appearing_roles),
    roleExecution,
    contextNotes: finalContextNotes,
    shuangTags: Array.isArray(shuangTags) ? shuangTags : [],
    emotionIntensity: emotionIntensity || 70,
    colloquialLevel: colloquialLevel || 80,
    dialogueRatio: dialogueRatio || 30,
    wordCount: requestedWordCount,
    addCliffhanger: addCliffhanger !== undefined ? addCliffhanger : true,
    enhanceDialogue: enhanceDialogue !== undefined ? enhanceDialogue : true,
    avoidAIFeel: avoidAIFeel !== undefined ? avoidAIFeel : true,
    fastPace: fastPace || false,
    detailedDesc: detailedDesc || false
  });

  return {
    bookId,
    chapterNumber,
    chapterTitle,
    chapterPlan,
    storylineContext,
    finalBookTitle,
    finalCharacters,
    finalContextNotes,
    finalOutline,
    requestedWordCount,
    maxTokens,
    model: safeModel,
    prompt,
    draftStorylineConstraint,
    storedContext
  };
}

async function handleBookTitleGeneration(req, res) {
  try {
    const { genre = 'urban', subgenre } = req.body;
    const prompt = buildBookTitlePrompt({ genre, subgenre });
    const result = await runTextGeneration(prompt, { temperature: 0.95, maxTokens: 64 });
    if (!result.success) {
      return res.status(result.statusCode || 500).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: { content: normalizeText(result.content), usage: result.usage } });
  } catch (error) {
    logger.error('Book title generation failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function handleChapterNameGeneration(req, res) {
  try {
    const { genre = 'urban', subgenre, chapterNumber = '1' } = req.body;
    const prompt = buildChapterNamePrompt({ genre, subgenre, chapterNumber });
    const result = await runTextGeneration(prompt, { temperature: 0.95, maxTokens: 64 });
    if (!result.success) {
      return res.status(result.statusCode || 500).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: { content: normalizeText(result.content), usage: result.usage } });
  } catch (error) {
    logger.error('Chapter name generation failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function handleOutlineGeneration(req, res) {
  try {
    const {
      genre = 'urban',
      subgenre,
      bookTitle = '',
      chapterTitle = '',
      characters = '',
      contextNotes = '',
      bookId = '',
      chapterNumber
    } = req.body;
    let mergedContextNotes = contextNotes;
    let storylineContextMeta = {
      usedStorylineIds: [],
      usedBeatIds: [],
      usedVolumeTimeline: false,
      isFallback: true
    };

    if (normalizeText(bookId || '') && Number.parseInt(chapterNumber, 10)) {
      await ensureChapterPlanForOutlineGeneration({
        bookId: normalizeText(bookId),
        chapterNumber: Number.parseInt(chapterNumber, 10),
        requestBody: req.body || {}
      });
      const storedContext = await loadBookGenerationContext(normalizeText(bookId), Number.parseInt(chapterNumber, 10));
      mergedContextNotes = [storedContext.contextNotes, contextNotes].filter(Boolean).join('\n\n');
      storylineContextMeta = storedContext.chapterStorylineContext || storylineContextMeta;
    }

    const prompt = buildOutlinePrompt({
      genre,
      subgenre,
      bookTitle,
      chapterTitle,
      characters,
      contextNotes: mergedContextNotes,
      chapterStorylinePrompt: storylineContextMeta?.promptText || ''
    });
    const result = await runTextGeneration(prompt, { temperature: 0.85, maxTokens: 800 });
    if (!result.success) {
      return res.status(result.statusCode || 500).json({ success: false, error: result.error });
    }
    const firstPassContent = normalizeText(result.content);
    const rewrittenResult = await rewriteOutlineNarratively({
      genre,
      subgenre,
      bookTitle,
      chapterTitle,
      contextNotes: mergedContextNotes,
      chapterStorylinePrompt: storylineContextMeta?.promptText || '',
      rawOutline: firstPassContent
    });
    const finalRawContent = rewrittenResult.success
      ? rewrittenResult.content
      : firstPassContent;
    const normalizedContent = normalizeOutlineNarrativeOutput(finalRawContent);
    const finalContent = (
      (!looksLikeOutlineList(normalizedContent) && normalizedContent.length >= 120)
        ? normalizedContent
        : normalizeOutlineNarrativeOutput(firstPassContent)
    ) || normalizedContent || firstPassContent;
    let persistedStorylineContext = null;
    if (normalizeText(bookId || '') && Number.parseInt(chapterNumber, 10)) {
      persistedStorylineContext = await saveChapterStorylineContext({
        bookId: normalizeText(bookId),
        chapterNumber: Number.parseInt(chapterNumber, 10),
        storylineContext: storylineContextMeta
      });
    }
    return res.json({
      success: true,
      data: {
        content: finalContent,
        usage: mergeUsage(result.usage, rewrittenResult.success ? rewrittenResult.usage : null),
        storylineContext: {
          ...(persistedStorylineContext || buildPersistedStorylineContext(storylineContextMeta))
        },
        persistedStorylineContext: !!persistedStorylineContext
      }
    });
  } catch (error) {
    logger.error('Outline generation failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function handleCharacterNamesGeneration(req, res) {
  try {
    const { genre = 'urban', subgenre, importantCount = 5, otherCount = 5 } = req.body;
    const prompt = buildCharacterNamesPrompt({ genre, subgenre, importantCount, otherCount });
    const result = await runTextGeneration(prompt, { temperature: 0.95, maxTokens: 200 });
    if (!result.success) {
      return res.status(result.statusCode || 500).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: { content: normalizeText(result.content), usage: result.usage } });
  } catch (error) {
    logger.error('Character names generation failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function handleCharacterProfilesGeneration(req, res) {
  try {
    const { genre = 'urban', subgenre, characterNames = '', characterConfig = '' } = req.body;
    const prompt = buildCharacterProfilesPrompt({ genre, subgenre, characterNames, characterConfig });
    const result = await runTextGeneration(prompt, { temperature: 0.75, maxTokens: 1200 });
    if (!result.success) {
      return res.status(result.statusCode || 500).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: { content: normalizeText(result.content), usage: result.usage } });
  } catch (error) {
    logger.error('Character profiles generation failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function handleFullOutlineGeneration(req, res) {
  try {
    const { genre = 'urban', subgenre, bookTitle = '', description = '', characters = '' } = req.body;
    const prompt = buildFullOutlinePrompt({ genre, subgenre, bookTitle, description, characters });
    const result = await runTextGeneration(prompt, { temperature: 0.8, maxTokens: 2000 });
    if (!result.success) {
      return res.status(result.statusCode || 500).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: { content: normalizeText(result.content), usage: result.usage } });
  } catch (error) {
    logger.error('Full outline generation failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function handleChapterFeedbackGeneration(req, res) {
  try {
    const bookId = normalizeText(req.body.bookId || '');
    const chapterNumber = Number.parseInt(req.body.chapterNumber, 10);
    const content = normalizeText(req.body.content || '');
    const outline = normalizeText(req.body.outline || '');
    const chapterTitle = normalizeText(req.body.chapterTitle || '');

    if (!bookId || !chapterNumber || !content) {
      return res.status(400).json({ success: false, error: 'bookId, chapterNumber and content are required' });
    }

    const storedContext = await loadBookGenerationContext(bookId, chapterNumber);
    const chapterPlan = storedContext.chapterPlan || {};

    let mainStoryline = '';
    if (normalizeText(chapterPlan.main_storyline_id || '')) {
      const db = await dbPromise;
      const storylineRow = execQueryOne(db, 'SELECT storyline_name, storyline_type FROM storylines WHERE id = ?', [chapterPlan.main_storyline_id]);
      if (storylineRow) {
        mainStoryline = [storylineRow.storyline_name, storylineRow.storyline_type].filter(Boolean).join(' · ');
      }
    }

    let targetStorylines = [];
    try {
      const ids = normalizeJsonArray(chapterPlan.target_storylines);
      if (ids.length > 0) {
        const db = await dbPromise;
        const placeholders = ids.map(() => '?').join(',');
        const rows = execQuery(db, `SELECT storyline_name FROM storylines WHERE id IN (${placeholders})`, ids);
        targetStorylines = rows.map((item) => normalizeText(item.storyline_name)).filter(Boolean);
      }
    } catch (_) {}

    const prompt = buildChapterFeedbackPrompt({
      bookTitle: storedContext.bookTitle,
      chapterNumber,
      chapterTitle,
      outline: outline || buildOutlineFromChapterPlan(chapterPlan),
      mission: normalizeText(chapterPlan.chapter_mission || ''),
      emotionTarget: normalizeText(chapterPlan.emotion_target || ''),
      mainStoryline,
      targetStorylines,
      content
    });

    const result = await runTextGeneration(prompt, {
      temperature: 0.4,
      maxTokens: 900,
      responseFormat: { type: 'json_object' }
    });
    if (!result.success) {
      return res.status(result.statusCode || 500).json({ success: false, error: result.error || '反馈生成失败' });
    }

    const parsed = tryParseJsonObject(result.content);
    if (!parsed) {
      return res.status(500).json({ success: false, error: '反馈解析失败' });
    }

    const auditResult = await auditGeneratedContent({
      bookTitle: storedContext.bookTitle,
      chapterNumber,
      chapterTitle,
      content,
      chapterPlan,
      mainStoryline,
      targetStorylineLabels: targetStorylines
    });

    const sanitizedCharacters = sanitizeFeedbackLedgerItems(parsed?.continuity_report?.new_characters, {
      content,
      chapterPlan,
      mainStoryline,
      targetStorylines
    });
    const sanitizedElements = sanitizeFeedbackLedgerItems(parsed?.continuity_report?.new_elements, {
      content,
      chapterPlan,
      mainStoryline,
      targetStorylines
    });

    let feedback = {
      chapter_summary: normalizeText(parsed.chapter_summary || ''),
      story_progress: normalizeText(parsed.story_progress || ''),
      character_progress: normalizeText(parsed.character_progress || ''),
      open_hooks: normalizeText(parsed.open_hooks || ''),
      next_chapter_focus: normalizeText(parsed.next_chapter_focus || ''),
      continuity_report: mergeFeedbackContinuityReport({
        new_characters: sanitizedCharacters.keptItems,
        new_elements: sanitizedElements.keptItems,
        must_carry_forward: normalizeJsonArray(parsed?.continuity_report?.must_carry_forward)
          .map((item) => typeof item === 'string' ? normalizeText(item) : normalizeText(item?.note || item?.summary || item?.name || ''))
          .filter(Boolean)
          .slice(0, 8),
        continuity_risks: normalizeJsonArray(parsed?.continuity_report?.continuity_risks)
          .map((item) => typeof item === 'string' ? normalizeText(item) : normalizeText(item?.note || item?.summary || item?.name || ''))
          .filter(Boolean)
          .concat(
            sanitizedCharacters.droppedItems.map((name) => `反馈草稿里出现了正文未证实的新增角色“${name}”，已阻止写入连续性台账。`),
            sanitizedElements.droppedItems.map((name) => `反馈草稿里出现了正文未证实的新增设定“${name}”，已阻止写入连续性台账。`)
          )
          .slice(0, 8)
      }, auditResult),
      updated_at: new Date().toISOString()
    };

    if (isLowConfidenceFeedback(feedback, content)) {
      feedback = buildFallbackChapterFeedback({
        content,
        chapterPlan,
        mainStoryline,
        targetStorylines
      });
    }

    const feedbackSaveResult = await saveChapterFeedback({ bookId, chapterNumber, feedback });
    return res.json({
      success: true,
      data: {
        feedback: feedbackSaveResult?.feedback || feedback,
        metadata: {
          storylineProgressUpdated: !!feedbackSaveResult?.storylineProgressUpdated,
          requiresStorylineReview: !!feedbackSaveResult?.requiresStorylineReview
        }
      }
    });
  } catch (error) {
    logger.error('Chapter feedback generation failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, error: '反馈生成失败' });
  }
}

async function handleChapterContentGeneration(req, res) {
  try {
    const prepared = await prepareChapterContentGenerationContext(req.body);
    const {
      bookId,
      chapterNumber,
      chapterTitle,
      chapterPlan,
      storylineContext,
      finalBookTitle,
      finalContextNotes,
      requestedWordCount,
      maxTokens,
      model,
      prompt,
      draftStorylineConstraint,
      storedContext
    } = prepared;

    logger.info('Starting content generation', {
      bookId: bookId || '',
      bookTitle: finalBookTitle || '',
      genre: req.body.genre || 'urban',
      chapterTitle: chapterTitle || 'Untitled chapter',
      hasStoredContext: !!finalContextNotes,
      hasStoredCharacters: !!storedContext.storedCharacters,
      targetWordCount: requestedWordCount,
      maxTokens
    });

    const result = await runTextGeneration(prompt, {
      model,
      temperature: 0.7,
      maxTokens
    });

    if (!result.success) {
      logger.error('Content generation failed', { error: result.error, statusCode: result.statusCode });
      return res.status(result.statusCode || 500).json({ success: false, error: result.error });
    }

    const generatedContent = normalizeText(result.content);
    const auditResult = await auditGeneratedContent({
      bookTitle: finalBookTitle,
      chapterNumber,
      chapterTitle,
      content: generatedContent,
      chapterPlan,
      mainStoryline: normalizeText(relatedStorylineTitleFromContext(storylineContext, true)),
      targetStorylineLabels: relatedStorylineTitlesFromContext(storylineContext)
    });
    logger.info('Content generation succeeded', {
      model,
      targetWordCount: requestedWordCount,
      actualLength: generatedContent.length,
      continuityRiskCount: auditResult.risks.length
    });

    return res.json({
      success: true,
      data: {
        content: generatedContent,
        usage: result.usage,
        metadata: {
          model,
          timestamp: new Date().toISOString(),
          targetWordCount: requestedWordCount,
          actualLength: generatedContent.length,
          storylineConstraintApplied: !!draftStorylineConstraint.applied,
          usedStorylineIds: draftStorylineConstraint.usedStorylineIds || [],
          usedBeatIds: draftStorylineConstraint.usedBeatIds || [],
          usedVolumeTimeline: !!draftStorylineConstraint.usedVolumeTimeline,
          isFallback: !!draftStorylineConstraint.isFallback,
          continuityAudit: auditResult,
          context: {
            bookId: bookId || null,
            bookTitle: finalBookTitle || null,
            hasStoredContext: !!finalContextNotes,
            hasStoredCharacters: !!storedContext.storedCharacters
          }
        }
      }
    });
  } catch (error) {
    logger.error('Server error', {
      error: error.message,
      stack: error.stack,
      route: '/api/generate'
    });
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function handleChapterContentGenerationStream(req, res) {
  let clientClosed = false;
  const abortController = new AbortController();
  req.on('close', () => {
    clientClosed = true;
    abortController.abort();
  });

  try {
    const prepared = await prepareChapterContentGenerationContext(req.body);
    const {
      bookId,
      chapterNumber,
      chapterTitle,
      chapterPlan,
      storylineContext,
      finalBookTitle,
      requestedWordCount,
      maxTokens,
      model,
      prompt,
      draftStorylineConstraint
    } = prepared;

    prepareSseResponse(res);

    logger.info('Starting streaming content generation', {
      bookId: bookId || '',
      bookTitle: finalBookTitle || '',
      chapterNumber,
      chapterTitle: chapterTitle || 'Untitled chapter',
      targetWordCount: requestedWordCount,
      maxTokens
    });

    let generatedContent = '';
    let usage = null;

    for await (const event of deepseekService.generateStream({
      prompt,
      model,
      temperature: 0.7,
      maxTokens,
      signal: abortController.signal
    })) {
      if (clientClosed) return;

      if (event.type === 'delta') {
        generatedContent = event.fullContent || generatedContent;
        writeSseEvent(res, 'delta', {
          type: 'delta',
          content: event.content,
          content_length: generatedContent.length
        });
      }

      if (event.type === 'usage') {
        usage = event.usage || usage;
        if (usage) {
          writeSseEvent(res, 'usage', {
            type: 'usage',
            usage
          });
        }
      }
    }

    if (clientClosed) return;

    const auditResult = await auditGeneratedContent({
      bookTitle: finalBookTitle,
      chapterNumber,
      chapterTitle,
      content: generatedContent,
      chapterPlan,
      mainStoryline: normalizeText(relatedStorylineTitleFromContext(storylineContext, true)),
      targetStorylineLabels: relatedStorylineTitlesFromContext(storylineContext)
    });

    if (clientClosed) return;

    writeSseEvent(res, 'audit', {
      type: 'audit',
      ...auditResult
    });

    writeSseEvent(res, 'done', {
      type: 'done',
      content_length: generatedContent.length,
      usage,
      model,
      metadata: {
        targetWordCount: requestedWordCount,
        storylineConstraintApplied: !!draftStorylineConstraint.applied,
        usedStorylineIds: draftStorylineConstraint.usedStorylineIds || [],
        usedBeatIds: draftStorylineConstraint.usedBeatIds || [],
        usedVolumeTimeline: !!draftStorylineConstraint.usedVolumeTimeline,
        isFallback: !!draftStorylineConstraint.isFallback
      }
    });

    res.end();
  } catch (error) {
    if (clientClosed || res.writableEnded) return;

    if (!res.headersSent) {
      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || '流式生成失败'
      });
    }

    writeSseEvent(res, 'error', {
      type: 'error',
      message: error.message || '流式生成失败'
    });
    res.end();
  }
}

router.post('/generate', async (req, res) => {
  const promptType = normalizeText(req.body.promptType || 'chapter') || 'chapter';
  if (promptType === 'book_title') return handleBookTitleGeneration(req, res);
  if (promptType === 'chapter_name') return handleChapterNameGeneration(req, res);
  if (promptType === 'outline') return handleOutlineGeneration(req, res);
  if (promptType === 'character_names') return handleCharacterNamesGeneration(req, res);
  if (promptType === 'character_profiles') return handleCharacterProfilesGeneration(req, res);
  if (promptType === 'full_outline') return handleFullOutlineGeneration(req, res);
  if (promptType === 'chapter_feedback') return handleChapterFeedbackGeneration(req, res);
  return handleChapterContentGeneration(req, res);
});

router.post('/generate/stream', async (req, res) => {
  const promptType = normalizeText(req.body.promptType || 'chapter') || 'chapter';
  if (promptType !== 'chapter') {
    return res.status(400).json({
      success: false,
      error: '流式生成目前仅支持正文生成（promptType: chapter）'
    });
  }

  return handleChapterContentGenerationStream(req, res);
});

router.post('/polish', async (req, res) => {
  try {
    const content = normalizeText(req.body.content || '');
    const requirements = normalizeText(req.body.requirements || '');
    if (!content) {
      return res.status(400).json({ success: false, error: 'Please provide the content to revise' });
    }

    const prompt = buildCleanPolishPrompt(content, requirements, req.body.options || {});
    const result = await runTextGeneration(prompt, { temperature: 0.6, maxTokens: 4000 });
    if (!result.success) {
      return res.status(result.statusCode || 500).json({ success: false, error: result.error });
    }

    return res.json({ success: true, data: { content: normalizeText(result.content), usage: result.usage } });
  } catch (error) {
    logger.error('Polish failed', { error: error.message, stack: error.stack, route: '/api/polish' });
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/continue', async (req, res) => {
  try {
    const content = normalizeText(req.body.content || '');
    const wordCount = Number(req.body.wordCount) || 1000;
    if (!content) {
      return res.status(400).json({ success: false, error: 'Please provide context content' });
    }

    const prompt = buildContinuePrompt(content.slice(-500), wordCount);
    const result = await runTextGeneration(prompt, {
      temperature: 0.7,
      maxTokens: Math.max(700, Math.ceil(wordCount * 0.8))
    });
    if (!result.success) {
      return res.status(result.statusCode || 500).json({ success: false, error: result.error });
    }

    const parsed = tryParseJsonObject(result.content);
    return res.json({
      success: true,
      data: {
        content: normalizeText(parsed?.content || result.content),
        suggestedTitle: normalizeText(parsed?.suggestedTitle || ''),
        usage: result.usage
      }
    });
  } catch (error) {
    logger.error('Continue failed', { error: error.message, stack: error.stack, route: '/api/continue' });
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/check-character', async (req, res) => {
  try {
    const characters = normalizeText(req.body.characters || '');
    const content = normalizeText(req.body.content || '');
    if (!characters || !content) {
      return res.status(400).json({ success: false, error: 'Please provide character config and generated content' });
    }

    const prompt = buildCharacterCheckPrompt(characters, content);
    const result = await runTextGeneration(prompt, { temperature: 0.3, maxTokens: 1000 });
    if (!result.success) {
      return res.status(result.statusCode || 500).json({ success: false, error: result.error });
    }

    let analysis = tryParseJsonObject(result.content);
    if (!analysis) {
      analysis = { consistent: true, issues: [], suggestions: [normalizeText(result.content).slice(0, 200)], score: 80 };
    }

    return res.json({ success: true, data: analysis });
  } catch (error) {
    logger.error('Character check failed', { error: error.message, stack: error.stack, route: '/api/check-character' });
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/check-plot', async (req, res) => {
  try {
    const content = normalizeText(req.body.content || '');
    if (!content) {
      return res.status(400).json({ success: false, error: 'Please provide chapter content' });
    }

    const prompt = buildPlotCheckPrompt(content);
    const result = await runTextGeneration(prompt, { temperature: 0.3, maxTokens: 1000 });
    if (!result.success) {
      return res.status(result.statusCode || 500).json({ success: false, error: result.error });
    }

    let analysis = tryParseJsonObject(result.content);
    if (!analysis) {
      analysis = { hasConflict: false, conflicts: [], severity: 'low', recommendations: [normalizeText(result.content).slice(0, 200)] };
    }

    return res.json({ success: true, data: analysis });
  } catch (error) {
    logger.error('Story check failed', { error: error.message, stack: error.stack, route: '/api/check-plot' });
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/detect-foreshadowing', async (req, res) => {
  try {
    const content = normalizeText(req.body.content || '');
    if (!content) {
      return res.status(400).json({ success: false, error: 'Please provide chapter content' });
    }

    const prompt = buildForeshadowPrompt(content);
    const result = await runTextGeneration(prompt, { temperature: 0.4, maxTokens: 1000 });
    if (!result.success) {
      return res.status(result.statusCode || 500).json({ success: false, error: result.error });
    }

    let analysis = tryParseJsonObject(result.content);
    if (!analysis) {
      analysis = [
        {
          title: '潜在线索',
          description: normalizeText(result.content).slice(0, 200),
          type: 'other'
        }
      ];
    }

    return res.json({ success: true, data: analysis });
  } catch (error) {
    logger.error('Foreshadowing detection failed', { error: error.message, stack: error.stack, route: '/api/detect-foreshadowing' });
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/optimize-plot', async (req, res) => {
  try {
    const content = normalizeText(req.body.content || '');
    const recommendations = normalizeText(req.body.recommendations || '');
    if (!content || !recommendations) {
      return res.status(400).json({ success: false, error: 'Please provide content and optimization suggestions' });
    }

    const prompt = buildOptimizePrompt(content, recommendations);
    const result = await runTextGeneration(prompt, { temperature: 0.6, maxTokens: 4000 });
    if (!result.success) {
      return res.status(result.statusCode || 500).json({ success: false, error: result.error });
    }

    return res.json({ success: true, data: { content: normalizeText(result.content), usage: result.usage } });
  } catch (error) {
    logger.error('Plot optimization failed', { error: error.message, stack: error.stack, route: '/api/optimize-plot' });
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/translate', async (req, res) => {
  try {
    const content = normalizeText(req.body.content || '');
    const targetLanguage = normalizeText(req.body.targetLanguage || '');
    if (!content || !targetLanguage) {
      return res.status(400).json({ success: false, error: 'Please provide content and target style' });
    }

    const prompt = buildTranslatePrompt(content, targetLanguage);
    const result = await runTextGeneration(prompt, { temperature: 0.5, maxTokens: 4000 });
    if (!result.success) {
      return res.status(result.statusCode || 500).json({ success: false, error: result.error });
    }

    return res.json({ success: true, data: { content: normalizeText(result.content), usage: result.usage } });
  } catch (error) {
    logger.error('Translate failed', { error: error.message, stack: error.stack, route: '/api/translate' });
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
