const express = require('express');
const router = express.Router();
const deepseekService = require('../services/deepseek');
const logger = require('../utils/logger');
const dbPromise = require('../database/init');
const { execQuery, execQueryOne, saveDatabase, syncStorylineProgressFromChapterPlan, ChapterPlanService } = require('../services/database');
const { recordGenerationRun } = require('../services/generation-run-service');
const {
  WORD_COUNT_POLICY,
  DEFAULT_WORD_COUNT,
  WORD_COUNT_TOLERANCE,
  countPlatformEffectiveWords,
  getWordCountBounds,
  clampWordCount,
  calculateRevisionTokenBudget,
  classifyWordCountDeviation,
  isCountWithinTolerance
} = require('../services/word-count-policy');
const { pickPreviousChapter } = require('../services/chapter-context-policy');
const { resolveDeepSeekModel, resolveDeepSeekJudgeModel, resolveDeepSeekRepairModel } = require('../config/runtime');
const { inspectDeterministicContent } = require('../harness/deterministic-judge');
const { loadRelevantLedgerSnapshot, syncFeedbackLedgers } = require('../services/continuity-ledger-service');
const { collectLedgerDenialConflicts, collectOpeningLocationCandidates, evaluateChapterPlanQuality, evaluatePreviousChapterRelease, formatAuditLedgerSnapshot, isAffirmativeAuditRisk, isNoisyCountFactNoun, shouldAcceptQualityRepair } = require('../services/chapter-quality-policy');

const CHAPTER_PROMPT_VERSION = 'chapter.v2';

const chapterPlanService = new ChapterPlanService();

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeGeneratedText(value) {
  return normalizeText(value)
    .replace(/\uFFFD+/g, '')
    .replace(/�+/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
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

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function normalizePercentage(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : fallback;
}

function normalizeTemperature(value, fallback = 0.7) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(1.2, Math.max(0, parsed)) : fallback;
}

function getRelatedBeatIdsFromSlot(slot = {}) {
  const safeSlot = slot && typeof slot === 'object' ? slot : {};
  return normalizeJsonArray(safeSlot.relatedBeatIds || safeSlot.related_beat_ids)
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
  const mainStorylineId = pickPreferredStorylineId(volumeStorylines);
  const activeBranchStorylines = volumeStorylines.filter((item) => {
    const storylineId = normalizeText(item.id);
    if (!storylineId || storylineId === mainStorylineId) return false;
    const startChapter = normalizePositiveInteger(item.start_chapter || item.startChapter) || 1;
    const endChapter = normalizePositiveInteger(item.end_chapter || item.endChapter) || Number.MAX_SAFE_INTEGER;
    return Number(requestBody.chapterNumber || requestBody.chapter_number || 0) >= startChapter
      && Number(requestBody.chapterNumber || requestBody.chapter_number || 0) <= endChapter;
  });
  const targetStorylineIds = [...new Set([
    mainStorylineId,
    ...activeBranchStorylines.map((item) => normalizeText(item.id))
  ].filter(Boolean))];

  return {
    mainStorylineId,
    targetStorylineIds,
    source: volumeStorylines.length > 0 ? 'volume_main_and_active_branches' : 'fallback_empty',
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

  const existingTargetStorylineIds = normalizeJsonArray(existingPlan?.target_storylines)
    .map((item) => normalizeText(item))
    .filter(Boolean);
  if (existingPlan && normalizeText(existingPlan.main_storyline_id) && existingTargetStorylineIds.length > 0) {
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
    requestBody: { ...requestBody, chapterNumber },
    storylines,
    volumeNumber: volumeResolution.volumeNumber,
    matchedSlot
  });

  const chapterName = normalizeText(requestBody.chapter_name || requestBody.chapterName || requestBody.chapterTitle || '');
  const structuredContent = {
    ...parseStructuredContent(existingPlan?.structured_content),
    autoCreatedChapterPlan: !existingPlan,
    autoCreateReason: existingPlan
      ? 'missing_storyline_link_for_outline_generation'
      : 'missing_chapter_plan_for_outline_generation',
    autoCreateFallback: volumeResolution.source === 'default' || storylineResolution.fallback,
    autoCreateMeta: {
      volumeNumberSource: volumeResolution.source,
      storylineSource: storylineResolution.source
    }
  };

  if (existingPlan) {
    db.run(
      `UPDATE chapter_plans
       SET volume_number = ?, main_storyline_id = ?, target_storylines = ?, structured_content = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        volumeResolution.volumeNumber,
        storylineResolution.mainStorylineId,
        JSON.stringify(storylineResolution.targetStorylineIds),
        JSON.stringify(structuredContent),
        existingPlan.id
      ]
    );
    saveDatabase(db);
    return {
      chapterPlan: execQueryOne(db, 'SELECT * FROM chapter_plans WHERE id = ?', [existingPlan.id]),
      autoCreated: false,
      storylineLinked: true
    };
  }

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
  const normalized = normalizeText(text).replace(/^\uFEFF/, '').trim();
  if (!normalized) return null;
  const candidates = [];
  const pushCandidate = (value) => {
    const candidate = normalizeText(value).replace(/^\uFEFF/, '').trim();
    if (candidate) candidates.push(candidate);
  };
  const extractBalancedJsonObject = (value) => {
    const source = normalizeText(value);
    if (!source) return null;
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaping = false;

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (inString) {
        if (escaping) {
          escaping = false;
          continue;
        }
        if (char === '\\') {
          escaping = true;
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === '{') {
        if (depth === 0) start = index;
        depth += 1;
        continue;
      }
      if (char === '}') {
        if (depth === 0) continue;
        depth -= 1;
        if (depth === 0 && start >= 0) {
          return source.slice(start, index + 1);
        }
      }
    }
    return null;
  };
  const repairCommonJsonIssues = (value) => {
    const source = normalizeText(value);
    if (!source) return '';
    return source
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, '\'')
      .replace(/\u00A0/g, ' ')
      .replace(/,\s*([}\]])/g, '$1');
  };

  pushCandidate(normalized);

  const fencedMatches = normalized.match(/```(?:json)?\s*([\s\S]*?)```/gi) || [];
  fencedMatches.forEach((block) => {
    const inner = block.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '');
    pushCandidate(inner);
  });

  const balancedObject = extractBalancedJsonObject(normalized);
  if (balancedObject) pushCandidate(balancedObject);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (_) {
      const repaired = repairCommonJsonIssues(candidate);
      if (repaired && repaired !== candidate) {
        try {
          return JSON.parse(repaired);
        } catch (_) {
          // Keep trying more tolerant extraction candidates.
        }
      }
    }
  }
  return null;
}

function looksLikeIncompleteJsonObject(text) {
  const normalized = normalizeText(text).replace(/^\uFEFF/, '').trim();
  if (!normalized || !normalized.startsWith('{')) return false;
  try {
    JSON.parse(normalized);
    return false;
  } catch (_) {
    let depth = 0;
    let inString = false;
    let escaping = false;

    for (let index = 0; index < normalized.length; index += 1) {
      const char = normalized[index];
      if (inString) {
        if (escaping) {
          escaping = false;
          continue;
        }
        if (char === '\\') {
          escaping = true;
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === '{') {
        depth += 1;
        continue;
      }
      if (char === '}') {
        if (depth > 0) depth -= 1;
      }
    }

    return depth > 0 || inString;
  }
}

function getModelAuditParseErrorReason({ finishReason = '', rawPreview = '' } = {}) {
  const normalizedFinishReason = normalizeText(finishReason).toLowerCase();
  const finishReasonSuggestsTruncation =
    normalizedFinishReason === 'length'
    || normalizedFinishReason === 'max_tokens'
    || normalizedFinishReason === 'max_tokens_exceeded'
    || normalizedFinishReason.includes('length')
    || normalizedFinishReason.includes('max_tokens');

  if (finishReasonSuggestsTruncation) return 'model_audit_output_truncated';
  if (looksLikeIncompleteJsonObject(rawPreview)) return 'model_audit_json_incomplete';
  return 'model_audit_json_parse_failed';
}

function truncate(text, maxLength = 800) {
  const normalized = normalizeText(text);
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function truncateTail(text, maxLength = 1000) {
  const normalized = normalizeText(text);
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(Math.max(0, normalized.length - maxLength));
}

function extractFirstKeySceneFromOutlineStructure(outlineStructure = {}) {
  const raw = normalizeText(outlineStructure?.key_scenes || '');
  if (!raw) return '';
  return raw
    .split(/\n|；|;|。/)
    .map((item) => normalizeText(item))
    .find(Boolean) || '';
}

function buildChapterOpeningBridgeText({ previousChapterTail = '', firstKeyScene = '', chapterGoal = '' } = {}) {
  const tail = normalizeText(previousChapterTail);
  const entry = normalizeText(firstKeyScene || chapterGoal);
  if (!tail && !entry) return '';

  const lines = [
    '开章承接要求：',
    tail ? '1. 必须先承接上一章结尾的最后场景、最后动作或最后悬念。' : '',
    entry ? '2. 再自然进入本章第一关键场景或本章目标，不要直接跳过中间因果。' : '',
    '3. 如果上一章结尾与本章第一关键场景之间存在时间、地点、人物状态或事件因果缺口，用 1-3 段补足过渡。',
    '4. 不要跳过“发现问题—确认问题—决定行动”的因果链。'
  ].filter(Boolean);

  if (entry) lines.push(`本章第一关键场景：${entry}`);
  return lines.join('\n');
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

function buildOutlineCharacterContext(characters = [], chapterPlan = null) {
  if (!Array.isArray(characters) || characters.length === 0) return '';
  const ignoredNames = new Set(['全书角色设定', '本章新增角色']);
  const formalNames = characters
    .filter((character) => normalizeText(character.character_type || '') !== 'chapter_character')
    .map((character) => normalizeText(character.name))
    .filter((name) => name && !ignoredNames.has(name));
  const formalNameSet = new Set(formalNames);
  const selectedNames = normalizeJsonArray(chapterPlan?.appearing_roles)
    .map((item) => typeof item === 'string'
      ? normalizeText(item)
      : normalizeText(item?.name || item?.characterName || item?.title || ''))
    .filter((name) => formalNameSet.has(name));
  const allowedNames = selectedNames.length > 0 ? [...new Set(selectedNames)] : [...new Set(formalNames)];
  return allowedNames.join(' / ');
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
  const mainStoryline = normalizeText(generationBrief.mainStoryline);
  if (mainStoryline && !/未设|未指定|无/.test(mainStoryline)) {
    parts.push(`主剧情线：${mainStoryline}`);
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
  return parts.join('\n');
}

function normalizeRoleExecutionItem(item) {
  if (!item || typeof item !== 'object') return null;
  const role = normalizeText(item.role || item.name || '');
  const baseline = normalizeText(item.baseline || '');
  const appearanceMarker = normalizeText(item.appearance_marker || item.appearanceMarker || item.appearance || '');
  const chapterFunction = normalizeText(item.chapter_function || item.chapterFunction || '');
  const allowedChange = normalizeText(item.allowed_change || item.allowedChange || '');
  const forbiddenChange = normalizeText(item.forbidden_change || item.forbiddenChange || '');
  const dimension = normalizeText(item.dimension || item.change_dimension || item.changeDimension || '');
  const direction = normalizeText(item.direction || item.change_direction || item.changeDirection || '');
  const scope = normalizeText(item.scope || item.change_scope || item.changeScope || '');
  const confidence = normalizeText(item.confidence || '');
  if (!role && !baseline && !appearanceMarker && !chapterFunction && !allowedChange && !forbiddenChange && !dimension && !direction && !scope && !confidence) {
    return null;
  }
  return {
    role,
    baseline,
    appearance_marker: appearanceMarker,
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

const MODEL_AUDIT_DIMENSIONS = [
  'text_integrity',
  'chapter_handoff',
  'generated_fact_conflicts',
  'generated_character_state_continuity',
  'summary_continuity',
  'plan_anchor_audit',
  'outline_coverage_audit'
];

function normalizePlanAnchorItems(value = [], limit = 6) {
  return normalizeJsonArray(value)
    .map((item) => typeof item === 'string'
      ? normalizeText(item)
      : normalizeText(item?.summary || item?.title || item?.note || item?.name || '')
    )
    .filter((item) => item && item.replace(/[，。！？、；：,.!?;:\s]/g, '').length >= 6)
    .slice(0, limit);
}

function buildPlanAnchorAuditContext(chapterPlan = {}) {
  const storylineContext = parseStructuredContent(chapterPlan?.structured_content).storyline_context || {};
  const chapterMission = normalizeText(chapterPlan?.chapter_mission || '');
  const mustAdvance = normalizePlanAnchorItems(storylineContext.mustAdvance, 6);
  const mustNotHappen = normalizePlanAnchorItems(storylineContext.mustNotHappen, 6);
  return {
    chapter_mission: chapterMission,
    must_advance: mustAdvance,
    must_not_happen: mustNotHappen
  };
}

function createSkippedPlanAnchorAudit(chapterPlan = {}, reason = '') {
  const context = buildPlanAnchorAuditContext(chapterPlan);
  return {
    status: 'skipped',
    chapter_mission: context.chapter_mission,
    must_advance: context.must_advance.map((item) => ({
      item,
      status: 'skipped',
      note: normalizeText(reason || '')
    })),
    must_not_happen: context.must_not_happen.map((item) => ({
      item,
      status: 'skipped',
      note: normalizeText(reason || '')
    })),
    summary: normalizeText(reason || '')
  };
}

function normalizePlanAnchorAudit(value = {}, chapterPlan = {}) {
  const context = buildPlanAnchorAuditContext(chapterPlan);
  const planAnchorAudit = value && typeof value === 'object' ? value : {};
  const allowedStatus = new Set(['passed', 'needs_review', 'risky', 'skipped', 'not_applicable']);
  const normalizeItems = (items = [], fallbackStatus = 'skipped') => normalizeJsonArray(items)
    .map((item) => {
      if (typeof item === 'string') {
        return {
          item: normalizeText(item),
          status: fallbackStatus,
          note: ''
        };
      }
      const text = normalizeText(item?.item || item?.title || item?.summary || item?.name || '');
      if (!text) return null;
      const itemStatus = normalizeText(item?.status || '') || fallbackStatus;
      return {
        item: text,
        status: itemStatus,
        note: normalizeText(item?.note || item?.reason || '')
      };
    })
    .filter((item) => item && item.item)
    .slice(0, 6);

  const status = normalizeText(planAnchorAudit.status || '');
  return {
    status: allowedStatus.has(status) ? status : ((context.chapter_mission || context.must_advance.length > 0 || context.must_not_happen.length > 0) ? 'skipped' : 'not_applicable'),
    chapter_mission: normalizeText(planAnchorAudit.chapter_mission || planAnchorAudit.mission || context.chapter_mission || ''),
    must_advance: normalizeItems(
      planAnchorAudit.must_advance || planAnchorAudit.mustAdvance || context.must_advance,
      context.must_advance.length > 0 ? 'skipped' : 'not_applicable'
    ),
    must_not_happen: normalizeItems(
      planAnchorAudit.must_not_happen || planAnchorAudit.mustNotHappen || context.must_not_happen,
      context.must_not_happen.length > 0 ? 'skipped' : 'not_applicable'
    ),
    summary: normalizeText(planAnchorAudit.summary || planAnchorAudit.note || '')
  };
}

function normalizeOutlineCoverageAudit(value = {}, chapterPlan = {}) {
  const outline = normalizeText(buildOutlineFromChapterPlan(chapterPlan));
  const audit = value && typeof value === 'object' ? value : {};
  const allowedStatus = new Set(['passed', 'needs_review', 'risky', 'skipped', 'not_applicable']);
  const status = normalizeText(audit.status || '');
  return {
    status: allowedStatus.has(status) ? status : (outline ? 'skipped' : 'not_applicable'),
    covered_beats: normalizeJsonArray(audit.covered_beats || audit.coveredBeats).map((item) => normalizeText(item)).filter(Boolean).slice(0, 8),
    missing_beats: normalizeJsonArray(audit.missing_beats || audit.missingBeats).map((item) => normalizeText(item)).filter(Boolean).slice(0, 8),
    carryover_beats: normalizeJsonArray(audit.carryover_beats || audit.carryoverBeats).map((item) => normalizeText(item)).filter(Boolean).slice(0, 8),
    summary: normalizeText(audit.summary || audit.note || '')
  };
}

function derivePlanAnchorAuditRisks(planAnchorAudit = {}) {
  const normalized = normalizePlanAnchorAudit(planAnchorAudit);
  const risks = [];
  if (normalized.status === 'risky' || normalized.status === 'needs_review') {
    if (normalized.summary) risks.push(normalized.summary);
  }
  normalized.must_advance.forEach((item) => {
    if (normalizeText(item?.status || '') === 'missing') {
      risks.push(normalizeText(item.note || `本章应推进但未明显完成：${item.item}`));
    }
  });
  normalized.must_not_happen.forEach((item) => {
    if (normalizeText(item?.status || '') === 'triggered') {
      risks.push(normalizeText(item.note || `本章提前触发了不应发生的事项：${item.item}`));
    }
  });
  return [...new Set(risks.map((item) => normalizeText(item)).filter(Boolean))].slice(0, 4);
}

function sliceTextHead(text = '', limit = 500) {
  return String(text || '').slice(0, Math.max(0, Number(limit) || 0)).trim();
}

function sliceTextTail(text = '', limit = 500) {
  const normalized = String(text || '');
  const max = Math.max(0, Number(limit) || 0);
  return normalized.slice(Math.max(0, normalized.length - max)).trim();
}

function sliceTextCap(text = '', limit = 12000) {
  return String(text || '').slice(0, Math.max(0, Number(limit) || 0)).trim();
}

function toSnippet(text = '', limit = 120) {
  return truncate(normalizeText(text), limit);
}

function createLocalSignal(type = '', severity = 'low', evidence = '', detail = '') {
  const normalizedType = normalizeText(type);
  if (!normalizedType) return null;
  return {
    type: normalizedType,
    severity: normalizeText(severity) || 'low',
    evidence: normalizeText(evidence),
    detail: normalizeText(detail)
  };
}

function collectRoleSnippets(text = '', roleName = '', window = 24, max = 3) {
  const source = String(text || '');
  const name = normalizeText(roleName);
  if (!source || !name) return [];
  const snippets = [];
  let index = 0;
  while (index < source.length) {
    const found = source.indexOf(name, index);
    if (found < 0) break;
    const start = Math.max(0, found - window);
    const end = Math.min(source.length, found + name.length + window);
    snippets.push(source.slice(start, end));
    if (snippets.length >= max) break;
    index = found + name.length;
  }
  return snippets;
}

function collectRoleSignalSnippets(text = '', roleName = '', max = 3) {
  const source = String(text || '');
  const name = normalizeText(roleName);
  if (!source || !name) return [];
  const patterns = [
    new RegExp(`${name}[\\s\\S]{0,120}`, 'g'),
    new RegExp(`[\\s\\S]{0,120}${name}`, 'g')
  ];
  const snippets = [];
  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const snippet = String(match[0] || '').trim();
      if (snippet) snippets.push(snippet);
      if (snippets.length >= max) break;
    }
  });
  return [...new Set(snippets)].slice(0, max);
}

function inferGenderHints(text = '') {
  const normalized = String(text || '');
  const femaleMatches = (normalized.match(/(她|女子|女人|姑娘|少女|小姐)/g) || []);
  const maleMatches = (normalized.match(/(他|男子|男人|少年|公子)/g) || []);
  return {
    female: femaleMatches,
    male: maleMatches
  };
}

function classifyRoleStateSignals(text = '') {
  const normalized = String(text || '');
  return {
    femaleStrong: /(她|女子|姑娘|少女|女人|小姐)/.test(normalized),
    maleStrong: /(他|男子|男人|公子)/.test(normalized),
    neutralYoungPerson: /年轻人/.test(normalized)
  };
}

function parseChineseCountToken(token = '') {
  const normalized = String(token || '').trim();
  if (!normalized) return null;
  if (/^\d+$/.test(normalized)) return Number(normalized);
  const map = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10
  };
  if (normalized === '十') return 10;
  if (normalized.length === 2 && normalized.startsWith('十')) {
    return 10 + (map[normalized[1]] || 0);
  }
  if (normalized.length === 2 && normalized.endsWith('十')) {
    return (map[normalized[0]] || 0) * 10;
  }
  if (normalized.length === 3 && normalized[1] === '十') {
    return (map[normalized[0]] || 0) * 10 + (map[normalized[2]] || 0);
  }
  return map[normalized] ?? null;
}

function collectCountFacts(text = '') {
  const source = String(text || '');
  const facts = [];
  const pattern = /([零一二两三四五六七八九十\d]+)(?:个|名|位|只|条|头|道)?([\u4e00-\u9fa5]{1,6})(?![\u4e00-\u9fa5])/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const count = parseChineseCountToken(match[1]);
    const noun = normalizeText(match[2]);
    if (!Number.isFinite(count) || !noun || isNoisyCountFactNoun(noun)) continue;
    facts.push({
      count,
      noun,
      raw: normalizeText(match[0] || '')
    });
  }
  return facts.slice(0, 24);
}

function collectPossibleTruncationSignals(text = '') {
  const source = String(text || '').trim();
  if (!source) return [];
  const signals = [];
  const tail = source.slice(-40);
  const lastChar = source.slice(-1);
  const unmatchedQuote = ((source.match(/“/g) || []).length !== (source.match(/”/g) || []).length)
    || ((source.match(/‘/g) || []).length !== (source.match(/’/g) || []).length);
  const unmatchedBracket = ((source.match(/（/g) || []).length !== (source.match(/）/g) || []).length)
    || ((source.match(/\(/g) || []).length !== (source.match(/\)/g) || []).length);

  if (/[，、：；—\-]$/.test(lastChar)) {
    signals.push(createLocalSignal('possible_truncation', 'high', tail, '章节结尾停在逗号、冒号或破折号后，疑似未写完。'));
  } else if (/(然后|因为|但是|而且|如果|只是|并且|于是|可我|可他|可她|再)$/.test(tail)) {
    signals.push(createLocalSignal('possible_truncation', 'high', tail, '章节结尾停在明显连接词或半句上，疑似截断。'));
  } else if (!/[。！？…』】”"]$/.test(lastChar)) {
    signals.push(createLocalSignal('possible_truncation', 'medium', tail, '章节结尾缺少自然收束标点，需复核是否被截断。'));
  }

  if (unmatchedQuote) {
    signals.push(createLocalSignal('possible_truncation', 'medium', tail, '章节内引号未闭合，需复核是否存在截断。'));
  }
  if (unmatchedBracket) {
    signals.push(createLocalSignal('possible_truncation', 'medium', tail, '章节内括号未闭合，需复核是否存在截断。'));
  }
  return signals.filter(Boolean).slice(0, 3);
}

function buildGenerationTruncationState({ content = '', finishReason = '' } = {}) {
  const truncationSignals = collectPossibleTruncationSignals(content);
  const normalizedFinishReason = normalizeText(finishReason).toLowerCase();
  const finishReasonSuggestsTruncation =
    normalizedFinishReason === 'length'
    || normalizedFinishReason === 'max_tokens'
    || normalizedFinishReason === 'max_tokens_exceeded'
    || normalizedFinishReason.includes('length')
    || normalizedFinishReason.includes('max_tokens');
  const highRiskSignals = truncationSignals.filter((item) => normalizeText(item?.severity || '') === 'high');
  const mediumRiskSignals = truncationSignals.filter((item) => normalizeText(item?.severity || '') === 'medium');
  const needsContinuation = finishReasonSuggestsTruncation || highRiskSignals.length > 0;

  return {
    finish_reason: normalizedFinishReason || null,
    detected: finishReasonSuggestsTruncation || truncationSignals.length > 0,
    needs_continuation: needsContinuation,
    severity: needsContinuation ? 'high' : (mediumRiskSignals.length > 0 ? 'medium' : 'none'),
    reason: finishReasonSuggestsTruncation
      ? 'model_length_limit'
      : (highRiskSignals.length > 0 ? 'local_truncation_signal' : (mediumRiskSignals.length > 0 ? 'local_truncation_warning' : 'none')),
    signals: truncationSignals
  };
}

function buildEndingRepairPrompt({
  tail = '',
  chapterTitle = '',
  targetWordCount = 0,
  currentWordCount = 0
} = {}) {
  return [
    '你是网文章节结尾修复编辑。下面的章节结尾疑似停在半句或缺少自然收束，请只重写这段结尾片段。',
    '',
    chapterTitle ? `章节标题：${chapterTitle}` : '',
    targetWordCount ? `目标有效字数：${targetWordCount}` : '',
    currentWordCount ? `当前全文有效字数约：${currentWordCount}` : '',
    '',
    '【修复要求】',
    '1. 只处理下面提供的结尾片段，不要重写整章。',
    '2. 保留已有事实、人物状态、动作结果和悬念，不要新增支线、新人物或新设定。',
    '3. 如果片段停在半句，补足为自然完整的 1-3 段。',
    '4. 允许轻微调整最后几句，让结尾有完整标点和自然停顿。',
    '5. 不要为了补尾大幅扩写，尽量保持和原片段接近的长度。',
    '6. 只输出修复后的结尾片段，不要解释、不要标题、不要 Markdown。',
    '',
    '【待修复结尾片段】',
    sanitizeGeneratedText(tail)
  ].filter(Boolean).join('\n');
}

function ensureNaturalEndingPunctuation(content = '') {
  const normalized = sanitizeGeneratedText(content);
  if (!normalized) return normalized;
  if (/[。！？…』】”"]$/.test(normalized.slice(-1))) return normalized;
  return `${normalized}。`;
}

async function repairGeneratedEndingIfNeeded({
  content = '',
  finishReason = '',
  chapterTitle = '',
  targetWordCount = 0,
  model = ''
} = {}) {
  const initialContent = sanitizeGeneratedText(content);
  const initialTruncation = buildGenerationTruncationState({
    content: initialContent,
    finishReason
  });
  if (!initialTruncation.detected) {
    return {
      content: initialContent,
      truncation: initialTruncation,
      repair: {
        attempted: false,
        success: false,
        reason: 'no_truncation_signal'
      }
    };
  }

  const paragraphs = splitRevisionParagraphs(initialContent).filter(Boolean);
  const tailParagraphCount = Math.min(3, Math.max(1, paragraphs.length));
  const prefixParagraphs = paragraphs.slice(0, Math.max(0, paragraphs.length - tailParagraphCount));
  const tailParagraphs = paragraphs.slice(Math.max(0, paragraphs.length - tailParagraphCount));
  const tail = tailParagraphs.join('\n\n') || initialContent.slice(-900);
  const result = await runTextGeneration(buildEndingRepairPrompt({
    tail,
    chapterTitle,
    targetWordCount,
    currentWordCount: countPlatformEffectiveWords(initialContent)
  }), {
    model,
    temperature: 0.25,
    maxTokens: 900
  });

  if (!result.success) {
    return {
      content: initialContent,
      truncation: initialTruncation,
      repair: {
        attempted: true,
        success: false,
        reason: result.error || 'ending_repair_failed'
      }
    };
  }

  const repairedTail = ensureNaturalEndingPunctuation(result.content);
  const repairedContent = sanitizeGeneratedText(
    [...prefixParagraphs, repairedTail].filter(Boolean).join('\n\n')
  );
  const repairedTruncation = buildGenerationTruncationState({
    content: repairedContent,
    finishReason: ''
  });

  return {
    content: repairedContent,
    truncation: repairedTruncation,
    repair: {
      attempted: true,
      success: !repairedTruncation.detected,
      reason: repairedTruncation.detected ? repairedTruncation.reason : 'ending_repaired',
      originalTail: truncate(tail, 280),
      repairedTail: truncate(repairedTail, 280),
      originalEffectiveLength: countPlatformEffectiveWords(initialContent),
      repairedEffectiveLength: countPlatformEffectiveWords(repairedContent),
      usage: result.usage || null
    }
  };
}

function collectPossibleGeneratedCharacterStateConflictSignals({ currentText = '', previousText = '', roleNames = [] }) {
  const signals = [];
  const roles = [...new Set((Array.isArray(roleNames) ? roleNames : []).map((item) => normalizeText(item)).filter(Boolean))].slice(0, 10);
  roles.forEach((roleName) => {
    const previousSnippets = [
      ...collectRoleSnippets(previousText, roleName, 80, 4),
      ...collectRoleSignalSnippets(previousText, roleName, 4)
    ].join('\n');
    const currentSnippets = [
      ...collectRoleSnippets(currentText, roleName, 80, 4),
      ...collectRoleSignalSnippets(currentText, roleName, 4)
    ].join('\n');
    if (!previousSnippets || !currentSnippets) return;
    const previousState = classifyRoleStateSignals(previousSnippets);
    const currentState = classifyRoleStateSignals(currentSnippets);
    const previousLooksFemale = previousState.femaleStrong && !previousState.maleStrong;
    const previousLooksMale = previousState.maleStrong && !previousState.femaleStrong;
    const currentLooksFemale = currentState.femaleStrong && !currentState.maleStrong;
    const currentLooksMale = currentState.maleStrong && !currentState.femaleStrong;
    if ((previousLooksFemale && currentLooksMale) || (previousLooksMale && currentLooksFemale)) {
      signals.push(createLocalSignal(
        'possible_generated_character_state_conflict',
        'high',
        `${roleName}｜前文：${toSnippet(previousSnippets, 60)}｜本章：${toSnippet(currentSnippets, 60)}`,
        '同一角色在前后已生成正文中出现了相反的性别/称谓信号，模型需主审是否构成生成角色状态连续性冲突。'
      ));
      return;
    }
    if (previousLooksFemale && currentState.neutralYoungPerson && /他/.test(currentSnippets)) {
      signals.push(createLocalSignal(
        'possible_generated_character_state_conflict',
        'high',
        `${roleName}｜前文：${toSnippet(previousSnippets, 60)}｜本章：${toSnippet(currentSnippets, 60)}`,
        '前文已出现明确女性信号，而当前章在同一角色附近出现“年轻人”并伴随“他”指代，模型需主审是否构成生成角色状态连续性冲突。'
      ));
    }
  });
  return signals.filter(Boolean).slice(0, 4);
}

function collectPossibleGeneratedFactConflictSignals({ currentText = '', previousText = '' }) {
  const signals = [];
  const previousFacts = collectCountFacts(previousText);
  const currentFacts = collectCountFacts(currentText);
  const normalizedPreviousText = String(previousText || '');
  const normalizedCurrentText = String(currentText || '');
  const currentHasRecallCue = /(昨晚|那晚|上次|此前|之前|刚才|先前|又|再)/.test(currentText);
  if (previousFacts.length > 0 && currentFacts.length > 0) {
    currentFacts.forEach((currentFact) => {
      const matched = previousFacts.find((item) => item.noun === currentFact.noun && item.count !== currentFact.count);
      if (!matched) return;
      signals.push(createLocalSignal(
        'possible_generated_fact_conflict',
        currentHasRecallCue ? 'high' : 'medium',
        `前文：${matched.raw}｜本章：${currentFact.raw}`,
        '相同实体在前后已生成正文中出现数量差异，模型需判断是否为明确回指冲突。'
      ));
    });
  }

  const previousSingleGuard =
    /一个人影[\s\S]{0,140}雾门守卒/.test(normalizedPreviousText)
    || /一个高大的身影[\s\S]{0,140}雾门守卒/.test(normalizedPreviousText)
    || /一个人影[\s\S]{0,140}守卒/.test(normalizedPreviousText);
  const currentThreeGuards =
    /接触过雾门守卒[\s\S]{0,40}几个[\s\S]{0,20}三个/.test(normalizedCurrentText)
    || /雾门守卒[\s\S]{0,40}几个[\s\S]{0,20}三个/.test(normalizedCurrentText);
  if (previousSingleGuard && currentThreeGuards) {
    signals.push(createLocalSignal(
      'possible_generated_fact_conflict',
      'high',
      '前文疑似单个雾门守卒｜本章对话回指为“三个”',
      '上一章已生成正文和当前章回指对话之间可能存在数量冲突，模型需主审是否构成生成事实矛盾。'
    ));
  }
  return signals.filter(Boolean).slice(0, 4);
}

function collectPossibleHandoffGapSignals({ currentOpening = '', previousSummary = '', previousTail = '', chapterPlan = {} }) {
  const signals = [];
  const opening = String(currentOpening || '');
  if (!opening) return signals;
  const previousContext = [previousSummary, previousTail, buildOutlineFromChapterPlan(chapterPlan)].join('\n');
  const locationCandidates = collectOpeningLocationCandidates(opening);
  locationCandidates.forEach((candidate) => {
    if (!candidate || previousContext.includes(candidate)) return;
    signals.push(createLocalSignal(
      'possible_handoff_gap',
      'medium',
      `${candidate}｜开头：${toSnippet(opening, 80)}`,
      '当前章开头出现了上一章生成摘要、上一章已生成结尾和当前章计划里都未明显铺垫的场景或地点，模型需复核章节承接是否自然。'
    ));
  });
  return signals.filter(Boolean).slice(0, 3);
}

function collectPossibleFalsePositiveRiskSignals({ riskCandidates = [] }) {
  const signals = [];
  normalizeJsonArray(riskCandidates).forEach((risk) => {
    const text = normalizeText(risk);
    const quoted = text.match(/“([^”]+)”/);
    const candidate = normalizeText(quoted?.[1] || '');
    if (!candidate) return;
    if (/(我|你|他|她|它|的|了|着|正好|还留|需要|想要|不是|因为)/.test(candidate)) {
      signals.push(createLocalSignal(
        'possible_false_positive_risk',
        'medium',
        candidate,
        '候选风险里的引号内容更像普通句子片段，不像稳定的组织、地点或设定名词，模型需复核是否误报。'
      ));
    }
  });
  return signals.filter(Boolean).slice(0, 4);
}

function collectPossibleSummaryDriftSignals({ summary = '', content = '' }) {
  const normalizedSummary = normalizeText(summary);
  const normalizedContent = String(content || '');
  if (!normalizedSummary || !normalizedContent) return [];
  const candidates = [
    ...collectInstitutionTerms(normalizedSummary),
    ...collectNovelTerms(normalizedSummary, /([\u4e00-\u9fa5]{2,12}(?:雾门守卒|破雾之力|旧案卷宗|宗门|旧案|血月))/g)
  ];
  const missing = [...new Set(candidates.filter((item) => item && !normalizedContent.includes(item)))];
  if (missing.length === 0) return [];
  return [createLocalSignal(
    'possible_summary_drift',
    'medium',
    missing.join(' / '),
    '当前章摘要里存在正文未明显命中的关键事实或名词，模型需复核摘要是否忠实反映正文。'
  )];
}

// 模型是主审，local_signals 只提供证据，不直接替代模型判案。
function collectAuditLocalSignals({
  content = '',
  chapterPlan = {},
  previousChapterSummary = '',
  previousChapterTail = '',
  currentChapterSummary = '',
  previousChapterAuditText = '',
  riskCandidates = []
}) {
  const currentText = String(content || '');
  const previousText = [previousChapterSummary, previousChapterTail, previousChapterAuditText].filter(Boolean).join('\n');
  const currentOpening = sliceTextHead(currentText, 1000);
  const roleNames = extractKnownRoleNames(chapterPlan);
  const localSignals = [
    ...collectPossibleTruncationSignals(currentText),
    ...collectPossibleGeneratedCharacterStateConflictSignals({
      currentText: [currentOpening, currentText].filter(Boolean).join('\n'),
      previousText,
      roleNames
    }),
    ...collectPossibleGeneratedFactConflictSignals({
      currentText: [currentChapterSummary, currentText].filter(Boolean).join('\n'),
      previousText
    }),
    ...collectPossibleHandoffGapSignals({
      currentOpening,
      previousSummary: previousChapterSummary,
      previousTail: previousChapterTail,
      chapterPlan
    }),
    ...collectPossibleFalsePositiveRiskSignals({
      riskCandidates
    }),
    ...collectPossibleSummaryDriftSignals({
      summary: currentChapterSummary,
      content: currentText
    })
  ];

  return localSignals.filter(Boolean).slice(0, 12);
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
    chapter_characters: normalizeJsonArray(continuityReport.new_characters),
    open_hooks: endingHook || continuityReport.must_carry_forward.join(' / ') || '下一章仍需承接当前冲突或新出现的关键信息。',
    next_chapter_focus: continuityReport.must_carry_forward[0] || endingHook || '承接本章结果，先确认哪些新内容需要转入后续。',
    continuity_report: continuityReport,
    updated_at: new Date().toISOString(),
    source: 'local_fallback'
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
    signals: [...new Set(signals)].slice(0, 12),
    risk_candidates: [...new Set(risks)].slice(0, 8)
  };
}

function buildContinuityAuditPrompt({
  bookTitle,
  chapterNumber,
  chapterTitle,
  chapterPlan = {},
  mainStoryline = '',
  targetStorylineLabels = [],
  content = '',
  currentChapterSummary = '',
  previousChapterSummary = '',
  previousChapterAuditText = '',
  previousChapterTail = '',
  currentChapterOpening = '',
  localSignals = [],
  ledgerSnapshot = {},
  priorRoles = []
}) {
  const outline = buildOutlineFromChapterPlan(chapterPlan);
  const planAnchorContext = buildPlanAnchorAuditContext(chapterPlan);
  const serializedLocalSignals = JSON.stringify(
    normalizeJsonArray(localSignals).map((item) => ({
      type: normalizeText(item?.type || ''),
      severity: normalizeText(item?.severity || ''),
      evidence: normalizeText(item?.evidence || ''),
      detail: normalizeText(item?.detail || '')
    })).filter((item) => item.type),
    null,
    2
  );
  const serializedPlanAnchorContext = JSON.stringify(planAnchorContext, null, 2);
  const serializedLedgerSnapshot = formatAuditLedgerSnapshot(ledgerSnapshot);

  return [
    '你是一名长篇小说连续性审计编辑。',
    '请基于已生成正文、已生成摘要、上一章结尾与上一章已生成事实，对当前章做 continuity_audit（持续性审计）。',
    '本轮不要做人设卡 / 大纲 / 世界观 / 章节目标的一致性裁定；只检查生成数据之间是否连续、完整、可承接。',
    '你的职责不是改写正文，也不是机械套规则，而是结合生成证据判断是否存在跨章持续性问题、摘要失真或风险误报。',
    'risks 只记录会实质改变事实、事件顺序、角色状态、结果或章节锚点的问题。正文与摘要语义一致时，不得因同义改写、概括粒度或未逐字出现“首次”“公开”等标签而判风险。',
    '输出必须精简：risks 最多 5 项且每项不超过 80 个汉字，signals 最多 6 项且每项不超过 50 个汉字，note/summary 每项不超过 100 个汉字。',
    '只输出最终结论和成立证据；不得罗列“无冲突”“不构成问题”的逐项排除过程，不得复述整段上一章正文。',
    '输出严格 JSON，不要添加代码块或解释。',
    '',
    'JSON schema:',
    '{',
    '  "risks": ["需要提醒的问题，若无则返回空数组"],',
    '  "signals": ["本章实际命中的关键承接点或主线锚点"],',
    '  "airdrop_items": [{"name":"疑似空降内容","type":"角色/背景/势力/规则/道具/历史信息","severity":"low/medium/high","reason":"为什么判定为疑似空降","suggestion":"建议保留/建议回收/建议先挂接再写"}],',
    '  "plan_anchor_audit": {"status":"passed/needs_review/risky/skipped/not_applicable","chapter_mission":"本章任务文本或空字符串","must_advance":[{"item":"应推进事项","status":"done/missing/skipped/not_applicable","note":"判断依据"}],"must_not_happen":[{"item":"不应提前发生的事项","status":"ok/triggered/skipped/not_applicable","note":"判断依据"}],"summary":"本维度结论摘要"},',
    '  "outline_coverage_audit": {"status":"passed/needs_review/risky/skipped/not_applicable","covered_beats":["已实际发生的关键事件"],"missing_beats":["本章应完成但尚未发生的关键事件"],"carryover_beats":["明显属于下一章承接、本章未完成不算缺失的节点"],"summary":"覆盖结论"},',
    '  "verdict": "stable/needs_review/risky"',
    '}',
    '',
    'continuity_audit 范围：',
    '1. 只审生成数据，不做完整 consistency_audit。',
    '2. 生成数据包括：已生成正文、已生成摘要、上一章结尾、当前章开头、上一章已生成事实、已生成角色状态。',
    '3. 除 plan_anchor_audit 明确给出的 chapter_mission、mustAdvance、mustNotHappen 外，其他章节计划内容只作为辅助理解，不作为本轮正式 consistency_audit 判错依据。',
    '',
    '本次必查维度：',
    'A. text_integrity：检查正文是否疑似截断、半句结束、引号未闭合、格式破坏。',
    'B. chapter_handoff：检查上一章结尾与当前章开头是否自然衔接，当前章开头是否出现未铺垫的新场景、新地点、新状态。',
    '   - “上一章没有提到”本身不是风险。章节计划明确要求的新事件、新地点、新线索或悬念属于正常推进，不要求上一章预先解释原因。',
    '   - 只有出现无法由章节计划、时间推进或当前章开头解释的事实矛盾、人物状态跳变，才写入 risks。普通转场和刻意留下的谜团只能写入 signals。',
    '   - 失踪原因、记忆缺失原因、人物身份或悬念答案尚未揭晓，属于开放谜团，不是连续性风险；除非它与前文已经明确的事实直接矛盾。',
    Number(chapterNumber || 0) <= 1
      ? '   - 当前是第 1 章，没有上一章属于正常情况；不得仅因上一章材料未提供而判定衔接风险。只检查本章开头自身是否清楚。'
      : '   - 当前不是第 1 章，必须结合已提供的上一章材料判断承接。',
    'C. generated_fact_conflicts：检查当前章回忆、引用、延续上一章事件时，是否与上一章已生成事实矛盾。',
    'D. generated_character_state_continuity：只检查已生成正文之间的角色状态是否互相矛盾，例如同一角色在前后章里出现她/他漂移。',
    '   - 必须对照长期事实账本。当前章若声称主角不认识、没听过或第一次见到一个账本中已经接触过的人，属于明确事实冲突。',
    'E. summary_continuity：检查当前章摘要是否忠实反映当前章正文，以及上一章摘要是否足以支持下一章承接。允许不改变事实的概括和同义改写，不做逐字匹配。',
    'F. risks 误报复核：如果 local_signals 或候选风险更像普通句子片段，而不是正式风险，请明确指出并避免误报。',
    'G. plan_anchor_audit：只做一个最小预设计划锚点检查，只对照 chapter_mission、mustAdvance、mustNotHappen，检查两件事：',
    '   - 本章是否已经明显完成了应该推进的事项；',
    '   - 本章是否提前触发了不该发生的事项。',
    '   - mustAdvance 只包含本章明确要求推进的剧情线节点；剧情线相关人物（如感情线女主）不必每章出现，剧情线本身允许有平静期。',
    '   - 未列入 mustAdvance 的剧情线只作背景参考，不得仅因某剧情线人物本章未出场、或某条剧情线未在本章推进，就把 status 判为 needs_review 或写入 risks。',
    '   - 如果没有可用的 chapter_mission / mustAdvance / mustNotHappen，就把 plan_anchor_audit.status 设为 skipped 或 not_applicable，不要硬判。',
    '   - 如果正文明显没有完成 chapter_mission 或 mustAdvance，请写入 risks，或至少在 plan_anchor_audit 中明确标成 needs_review / missing。',
    '   - 如果正文提前触发 mustNotHappen，请写入 risks，并把 plan_anchor_audit.status 设为 risky。',
    'H. outline_coverage_audit：从章节细纲提炼关键节点，先区分“本章应完成”与“下一章承接”。',
    '   - 本章应完成节点：章节任务或细纲明确要求在本章形成结果的节点，逐项核对正文是否发生。',
    '   - 下一章承接节点：细纲事件链中明显需要后续章节才能完成的部分（如细纲已经写明“本章停在这里、下章再继续”），或正文已经走到本章合理停点、剩余节点需要新的场景和时间推进才能发生；这类节点放入 carryover_beats，未发生不算缺失，不得写入 missing_beats。',
    '   - 只有提及、暗示、准备或尝试而没有结果，不能算覆盖。',
    '   - missing_beats 只放“本章应完成但正文未落实”的节点；缺少会导致章节结果不完整的节点时设为 needs_review；正文在中途停止或遗漏本章应完成的结局节点时设为 risky。',
    '   - 不要把环境描写、过场动作、同义改写差异，或已归入 carryover_beats 的节点当成缺失节点。',
    'I. airdrop_items：检查正文是否让前文从未出场、也没有铺垫的角色空降承担关键功能（救人、点破真相、提供决定性情报或证据、扭转局势）。',
    '   - 只有角色库设定但前文从未出场，同样按前文未出场处理，不能因角色库有设定就豁免；',
    '   - 命中时写入 airdrop_items（severity 至少 medium），并写入 risks；',
    '   - 仅背景提及、路人、有自然引入交代（承接前文接触、他人提及后首次露面且只承担次要功能）的角色不算空降。',
    '',
    '使用 local_signals 的规则：',
    '1. local_signals 只是本地函数提取的可疑证据，不是最终结论。',
    '2. 只有当正文和承接材料能够支持时，才能把 local_signals 升格为正式 risks。',
    '3. 如果 local_signals 证据不足，请不要硬判风险。',
    '4. 你必须逐条处理 local_signals，尤其是 possible_handoff_gap、possible_generated_fact_conflict、possible_generated_character_state_conflict：',
    '   - 如果证据成立，就把它写进正式 risks；',
    '   - 如果证据不足，只能写入 signals，不得写成 risk，也不得因此把 verdict 设为 needs_review；',
    '   - possible_handoff_gap 若只是章节计划内的新场景、正常时间推进或悬念，不构成风险，可直接排除。',
    '',
    `书名：${bookTitle || '未命名作品'}`,
    `章节：第 ${chapterNumber || '?'} 章 ${chapterTitle || ''}`,
    `上一章摘要：${previousChapterSummary || '未提供'}`,
    `上一章完整审计片段（生成数据，最长约 12000 字）：${previousChapterAuditText || '未提供'}`,
    `上一章正文结尾（约 500 字）：${previousChapterTail || '未提供'}`,
    `当前章摘要：${currentChapterSummary || '未提供'}`,
    `当前章开头（约 500 字）：${currentChapterOpening || '未提供'}`,
    `plan_anchor_context（正式小范围对照项）：\n${serializedPlanAnchorContext}`,
    `local_signals（只作证据，不是定案）：\n${serializedLocalSignals}`,
    `长期事实与伏笔账本（正式连续性证据）：\n${serializedLedgerSnapshot || '未提供'}`,
    `前文已出场角色（用于 airdrop_items 空降判断）：${priorRoles.join('、') || '未提供'}`,
    '',
    '章节计划（仅辅助理解，不做正式 consistency_audit 判错）：',
    outline || '未提供',
    '',
    '已生成正文：',
    content || '未提供'
  ].join('\n');
}

// quality_check 的目标是防止跨章连续性漏检，模型主审，本地信号只供证据。
async function auditGeneratedContent({
  bookTitle = '',
  chapterNumber = 0,
  chapterTitle = '',
  content = '',
  chapterPlan = {},
  mainStoryline = '',
  targetStorylineLabels = [],
  currentChapterSummary = '',
  previousChapterSummary = '',
  previousChapterAuditText = '',
  previousChapterTail = '',
  deterministicConstraints = {},
  ledgerSnapshot = {},
  priorRoles = [],
}) {
  const deterministicCheck = inspectDeterministicContent({ content, ...deterministicConstraints });
  const deterministicFallbackVerdict = deterministicCheck.status === 'blocked'
    ? 'risky'
    : (deterministicCheck.status === 'review' ? 'needs_review' : '');
  const fallback = auditGeneratedContentHeuristic({ content, chapterPlan, mainStoryline, targetStorylineLabels });
  const collectedLocalSignals = collectAuditLocalSignals({
    content,
    chapterPlan,
    previousChapterSummary,
    previousChapterTail,
    currentChapterSummary,
    previousChapterAuditText,
    riskCandidates: fallback.risk_candidates || fallback.risks
  });
  const localSignals = Number(chapterNumber || 0) <= 1
    ? collectedLocalSignals.filter((item) => ![
        'possible_handoff_gap',
        'possible_generated_fact_conflict',
        'possible_generated_character_state_conflict'
      ].includes(normalizeText(item?.type || '')))
    : collectedLocalSignals;
  const currentChapterOpening = sliceTextHead(content, 1000);
  if (!normalizeText(content)) {
    return {
      ...fallback,
      airdrop_items: [],
      verdict: 'risky',
      source: 'heuristic',
      deterministic_check: deterministicCheck,
      local_signals: localSignals,
      audit_layers: {
        model_audit_run: false,
        local_signal_extraction_run: true,
        heuristic_fallback_used: true
      },
      model_audit_dimensions: MODEL_AUDIT_DIMENSIONS,
      plan_anchor_audit: createSkippedPlanAnchorAudit(chapterPlan, '正文为空，未执行模型计划锚点检查。'),
      needs_human_review: true
    };
  }

  const prompt = buildContinuityAuditPrompt({
    bookTitle,
    chapterNumber,
    chapterTitle,
    chapterPlan,
    mainStoryline,
    targetStorylineLabels,
    content,
    currentChapterSummary,
    previousChapterSummary,
    previousChapterAuditText,
    previousChapterTail,
    currentChapterOpening,
    localSignals,
    ledgerSnapshot,
    priorRoles
  });

  const result = await runTextGeneration(prompt, {
    model: resolveDeepSeekJudgeModel(),
    temperature: 0.2,
    maxTokens: 3000,
    responseFormat: { type: 'json_object' }
  });

  if (!result.success) {
    return {
      ...fallback,
      airdrop_items: [],
      verdict: deterministicFallbackVerdict || (fallback.risks.length > 0 ? 'needs_review' : 'stable'),
      source: 'heuristic',
      deterministic_check: deterministicCheck,
      local_signals: localSignals,
      audit_layers: {
        model_audit_run: false,
        local_signal_extraction_run: true,
        heuristic_fallback_used: true
      },
      model_audit_dimensions: MODEL_AUDIT_DIMENSIONS,
      plan_anchor_audit: createSkippedPlanAnchorAudit(chapterPlan, '模型审计未执行，计划锚点检查已跳过。'),
      needs_human_review: deterministicCheck.status !== 'passed' || fallback.risks.length > 0 || localSignals.length > 0
    };
  }

  const parsed = tryParseJsonObject(result.content);
  if (!parsed) {
    const rawPreview = normalizeText(result.content || '').replace(/^\uFEFF/, '').trim().slice(0, 1000);
    const auditFinishReason = normalizeText(result.finishReason || '').toLowerCase() || null;
    const parseErrorReason = getModelAuditParseErrorReason({
      finishReason: auditFinishReason,
      rawPreview
    });
    return {
      ...fallback,
      airdrop_items: [],
      verdict: deterministicFallbackVerdict || (fallback.risks.length > 0 ? 'needs_review' : 'stable'),
      source: 'heuristic',
      deterministic_check: deterministicCheck,
      local_signals: localSignals,
      audit_layers: {
        model_audit_run: false,
        local_signal_extraction_run: true,
        heuristic_fallback_used: true,
        parse_error: true,
        parse_error_reason: parseErrorReason,
        audit_finish_reason: auditFinishReason,
        raw_preview: rawPreview || null
      },
      raw_model_output: result.content || '',
      model_audit_dimensions: MODEL_AUDIT_DIMENSIONS,
      plan_anchor_audit: createSkippedPlanAnchorAudit(chapterPlan, '模型审计结果解析失败，计划锚点检查已跳过。'),
      needs_human_review: deterministicCheck.status !== 'passed' || fallback.risks.length > 0 || localSignals.length > 0
    };
  }

  const rawParsedRisks = normalizeJsonArray(parsed.risks).map((item) => normalizeText(item)).filter(Boolean).slice(0, 8);
  const risks = rawParsedRisks.filter(isAffirmativeAuditRisk);
  const signals = normalizeJsonArray(parsed.signals).map((item) => normalizeText(item)).filter(Boolean).slice(0, 12);
  const planAnchorAudit = normalizePlanAnchorAudit(parsed.plan_anchor_audit, chapterPlan);
  const outlineCoverageAudit = normalizeOutlineCoverageAudit(parsed.outline_coverage_audit, chapterPlan);
  const planAnchorRisks = derivePlanAnchorAuditRisks(planAnchorAudit);
  const outlineCoverageRisks = ['needs_review', 'risky'].includes(outlineCoverageAudit.status) && outlineCoverageAudit.missing_beats.length > 0
    ? [outlineCoverageAudit.summary || `章节细纲仍有关键事件未落实：${outlineCoverageAudit.missing_beats.join('；')}`]
    : [];
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
  const mergedRisks = [...new Set([...risks, ...planAnchorRisks, ...outlineCoverageRisks].map((item) => normalizeText(item)).filter(Boolean))].slice(0, 8);
  const deterministicRisks = deterministicCheck.issues.map((item) => item.message);
  const ledgerDenialRisks = collectLedgerDenialConflicts(content, ledgerSnapshot);
  const allRisks = [...new Set([...mergedRisks, ...deterministicRisks, ...ledgerDenialRisks])].slice(0, 12);
  let verdict = normalizeText(parsed.verdict || '') || (allRisks.length > 0 ? 'needs_review' : 'stable');
  if (
    verdict === 'needs_review'
    && rawParsedRisks.length > 0
    && risks.length === 0
    && allRisks.length === 0
    && ['passed', 'not_applicable'].includes(planAnchorAudit.status)
    && ['passed', 'not_applicable'].includes(outlineCoverageAudit.status)
  ) {
    verdict = 'stable';
  }
  if (allRisks.length > 0 && verdict === 'stable') {
    verdict = 'needs_review';
  }
  if (deterministicCheck.status === 'blocked') {
    verdict = 'risky';
  } else if (deterministicCheck.status === 'review' && verdict === 'stable') {
    verdict = 'needs_review';
  }
  if (planAnchorAudit.status === 'risky') {
    verdict = 'risky';
  } else if (planAnchorAudit.status === 'needs_review' && verdict === 'stable') {
    verdict = 'needs_review';
  }
  if (outlineCoverageAudit.status === 'risky') {
    verdict = 'risky';
  } else if (outlineCoverageAudit.status === 'needs_review' && verdict === 'stable') {
    verdict = 'needs_review';
  }

  return {
    risks: allRisks,
    signals: signals.length > 0 ? signals : fallback.signals.slice(0, 8),
    airdrop_items: airdropItems,
    verdict,
    source: 'model_audit',
    judge_model: result.model || resolveDeepSeekJudgeModel(),
    raw_model_output: result.content || '',
    deterministic_check: deterministicCheck,
    local_signals: localSignals,
    audit_layers: {
      model_audit_run: true,
      local_signal_extraction_run: true,
      heuristic_fallback_used: false
    },
    model_audit_dimensions: MODEL_AUDIT_DIMENSIONS,
    plan_anchor_audit: planAnchorAudit,
    outline_coverage_audit: outlineCoverageAudit,
    needs_human_review: verdict !== 'stable' || allRisks.length > 0 || ['needs_review', 'risky'].includes(planAnchorAudit.status) || ['needs_review', 'risky'].includes(outlineCoverageAudit.status)
  };
}

function mapAuditVerdictToQualityStatus(verdict = '') {
  const normalized = normalizeText(verdict).toLowerCase();
  if (normalized === 'stable') return 'passed';
  if (normalized === 'needs_review') return 'warning';
  if (normalized === 'risky') return 'failed';
  return 'not_run';
}

function normalizeQualityCheck(value = {}) {
  const qualityCheck = value && typeof value === 'object' ? value : {};
  const status = normalizeText(qualityCheck.status);
  const source = normalizeText(qualityCheck.source);
  const allowedStatus = new Set(['passed', 'warning', 'failed', 'degraded', 'not_run']);
  const allowedSource = new Set(['model_audit', 'heuristic', 'local_fallback', 'none']);
  const normalizedLocalSignals = Array.isArray(qualityCheck.local_signals)
    ? qualityCheck.local_signals
      .map((item) => createLocalSignal(item?.type, item?.severity, item?.evidence, item?.detail))
      .filter(Boolean)
      .slice(0, 12)
    : [];
  const normalizedPlanAnchorAudit = normalizePlanAnchorAudit(qualityCheck.plan_anchor_audit || qualityCheck.planAnchorAudit || {});
  const normalizedOutlineCoverageAudit = normalizeOutlineCoverageAudit(qualityCheck.outline_coverage_audit || qualityCheck.outlineCoverageAudit || {});
  const storylineAudit = qualityCheck.storyline_audit && typeof qualityCheck.storyline_audit === 'object'
    ? qualityCheck.storyline_audit
    : {};
  const wordCountAudit = qualityCheck.word_count_audit && typeof qualityCheck.word_count_audit === 'object'
    ? qualityCheck.word_count_audit
    : {};

  return {
    status: allowedStatus.has(status) ? status : 'not_run',
    source: allowedSource.has(source) ? source : 'none',
    verdict: normalizeText(qualityCheck.verdict || ''),
    signals: normalizeJsonArray(qualityCheck.signals)
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 12),
    airdrop_items: Array.isArray(qualityCheck.airdrop_items)
      ? qualityCheck.airdrop_items
        .map((item) => ({
          name: normalizeText(item?.name || ''),
          type: normalizeText(item?.type || ''),
          severity: normalizeText(item?.severity || ''),
          reason: normalizeText(item?.reason || ''),
          suggestion: normalizeText(item?.suggestion || '')
        }))
        .filter((item) => item.name || item.reason)
        .slice(0, 8)
      : [],
    risks: normalizeJsonArray(qualityCheck.risks)
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 8),
    checked_at: normalizeText(qualityCheck.checked_at || qualityCheck.checkedAt || '') || new Date().toISOString(),
    degraded_reason: normalizeText(qualityCheck.degraded_reason || qualityCheck.degradedReason || '') || null,
    local_signals: normalizedLocalSignals,
    audit_layers: {
      model_audit_run: !!qualityCheck?.audit_layers?.model_audit_run,
      local_signal_extraction_run: !!qualityCheck?.audit_layers?.local_signal_extraction_run,
      heuristic_fallback_used: !!qualityCheck?.audit_layers?.heuristic_fallback_used,
      ...(qualityCheck?.audit_layers?.parse_error ? {
        parse_error: true,
        parse_error_reason: normalizeText(qualityCheck?.audit_layers?.parse_error_reason || '') || null,
        audit_finish_reason: normalizeText(qualityCheck?.audit_layers?.audit_finish_reason || '').toLowerCase() || null,
        raw_preview: normalizeText(qualityCheck?.audit_layers?.raw_preview || '').slice(0, 1000) || null
      } : {})
    },
    model_audit_dimensions: normalizeJsonArray(qualityCheck.model_audit_dimensions)
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 12),
    plan_anchor_audit: normalizedPlanAnchorAudit,
    outline_coverage_audit: normalizedOutlineCoverageAudit,
    storyline_audit: {
      status: normalizeText(storylineAudit.status || '') || 'not_applicable',
      used_storyline_ids: normalizeJsonArray(storylineAudit.used_storyline_ids || storylineAudit.usedStorylineIds)
        .map((item) => normalizeText(item))
        .filter(Boolean),
      used_beat_ids: normalizeJsonArray(storylineAudit.used_beat_ids || storylineAudit.usedBeatIds)
        .map((item) => normalizeText(item))
        .filter(Boolean),
      summary: normalizeText(storylineAudit.summary || ''),
      risks: normalizeJsonArray(storylineAudit.risks)
        .map((item) => normalizeText(item))
        .filter(Boolean)
        .slice(0, 6),
      requires_review: Boolean(storylineAudit.requires_review || storylineAudit.requiresReview)
    },
    word_count_audit: {
      status: normalizeText(wordCountAudit.status || '') || 'not_applicable',
      target: Number(wordCountAudit.target || 0) || 0,
      actual: Number(wordCountAudit.actual || 0) || 0,
      deviation_ratio: Number(wordCountAudit.deviation_ratio || wordCountAudit.deviationRatio || 0) || 0,
      summary: normalizeText(wordCountAudit.summary || '')
    },
    needs_human_review: Boolean(qualityCheck.needs_human_review)
  };
}

function buildQualityCheckFromAuditResult(auditResult = {}, overrides = {}) {
  const defaultStatus = overrides.status || mapAuditVerdictToQualityStatus(auditResult.verdict || '');
  const defaultNeedsHumanReview = Object.prototype.hasOwnProperty.call(overrides, 'needs_human_review')
    ? !!overrides.needs_human_review
    : (defaultStatus !== 'passed' || !!auditResult.needs_human_review || normalizeJsonArray(auditResult.risks).length > 0);
  return normalizeQualityCheck({
    // 降级结果不能伪装成模型审计通过。
    status: overrides.status || mapAuditVerdictToQualityStatus(auditResult.verdict || ''),
    source: overrides.source || normalizeText(auditResult.source || '') || 'none',
    verdict: overrides.verdict ?? normalizeText(auditResult.verdict || ''),
    signals: overrides.signals || normalizeJsonArray(auditResult.signals),
    airdrop_items: overrides.airdrop_items || normalizeJsonArray(auditResult.airdrop_items),
    risks: overrides.risks || normalizeJsonArray(auditResult.risks),
    checked_at: overrides.checked_at || new Date().toISOString(),
    degraded_reason: overrides.degraded_reason || null,
    local_signals: overrides.local_signals || auditResult.local_signals || [],
    audit_layers: overrides.audit_layers || auditResult.audit_layers || {
      model_audit_run: normalizeText(auditResult.source || '') === 'model_audit',
      local_signal_extraction_run: Array.isArray(auditResult.local_signals) && auditResult.local_signals.length > 0,
      heuristic_fallback_used: normalizeText(auditResult.source || '') !== 'model_audit'
    },
    model_audit_dimensions: overrides.model_audit_dimensions || auditResult.model_audit_dimensions || MODEL_AUDIT_DIMENSIONS,
    plan_anchor_audit: overrides.plan_anchor_audit || auditResult.plan_anchor_audit || createSkippedPlanAnchorAudit({}, ''),
    outline_coverage_audit: overrides.outline_coverage_audit || auditResult.outline_coverage_audit || normalizeOutlineCoverageAudit({}, {}),
    needs_human_review: defaultNeedsHumanReview
  });
}

function buildOutlineFromChapterPlan(plan) {
  return normalizeText(plan?.outline_text || '');
}

function buildChapterQualityRepairPrompt({ content = '', audit = {}, chapterPlan = {}, targetWordCount = 0 } = {}) {
  const planContext = buildPlanAnchorAuditContext(chapterPlan);
  const risks = normalizeJsonArray(audit.risks).map((item) => normalizeText(item)).filter(Boolean);
  const anchorRisks = normalizeJsonArray(audit?.plan_anchor_audit?.risks).map((item) => normalizeText(item)).filter(Boolean);
  const outlineAudit = normalizeOutlineCoverageAudit(audit?.outline_coverage_audit, chapterPlan);
  const carryoverBeats = normalizeJsonArray(outlineAudit.carryover_beats).map((item) => normalizeText(item)).filter(Boolean);
  return [
    '你是长篇中文网文的定点修稿编辑。请修复审计指出的问题，输出完整修订正文。',
    '只输出正文，不要标题、解释、修改说明、Markdown 或审计 JSON。',
    '不得改变未被审计指出的问题，不得新增改变主线的角色、势力、道具、规则或支线。',
    `修订后保持约 ${Number(targetWordCount || 0)} 有效字，结尾必须是完整句。`,
    '',
    `【章节任务】${normalizeText(planContext.chapter_mission || chapterPlan.chapter_mission || '') || '未提供'}`,
    `【必须发生】${normalizeJsonArray(planContext.must_advance).join('；') || '未提供'}`,
    `【禁止提前发生】${normalizeJsonArray(planContext.must_not_happen).join('；') || '无'}`,
    `【章节细纲】${normalizeText(buildOutlineFromChapterPlan(chapterPlan)) || '未提供'}`,
    `【本次必须修复】${[...new Set([...risks, ...anchorRisks])].join('；') || '按审计结论修复连续性与章节推进问题'}`,
    carryoverBeats.length > 0
      ? `【下章承接节点（本章不需要强行补写）】${carryoverBeats.join('；')}`
      : '',
    '',
    '【原正文】',
    normalizeText(content)
  ].join('\n');
}

function needsChapterQualityRepair(audit = {}) {
  if (normalizeText(audit.source) !== 'model_audit') return false;
  return normalizeText(audit.verdict) !== 'stable'
    || !['passed', 'not_applicable'].includes(normalizeText(audit?.plan_anchor_audit?.status))
    || !['passed', 'not_applicable'].includes(normalizeText(audit?.outline_coverage_audit?.status))
    || normalizeText(audit?.deterministic_check?.status) !== 'passed';
}

async function runChapterQualityRepairLoop({
  content = '',
  audit = {},
  auditInput = {},
  chapterPlan = {},
  chapterTitle = '',
  targetWordCount = 0,
  model = '',
  enabled = true
} = {}) {
  const attempts = [];
  if (!enabled || !needsChapterQualityRepair(audit)) {
    return { content, audit, attempts, applied: false, usage: null };
  }

  let currentContent = content;
  let currentAudit = audit;
  let applied = false;
  const usages = [];
  for (let attemptNumber = 1; attemptNumber <= 2 && needsChapterQualityRepair(currentAudit); attemptNumber += 1) {
    const repairResult = await runTextGeneration(buildChapterQualityRepairPrompt({
      content: currentContent,
      audit: currentAudit,
      chapterPlan,
      targetWordCount
    }), {
      model,
      temperature: 0.2,
      maxTokens: Math.min(
        WORD_COUNT_POLICY.revision.repair_max_tokens,
        Math.max(
          WORD_COUNT_POLICY.revision.repair_min_tokens,
          Math.ceil(Number(targetWordCount || DEFAULT_WORD_COUNT) * WORD_COUNT_POLICY.revision.expansion_multiplier)
        )
      ),
      systemPrompt: '你只负责定点修复小说正文。保留正确内容，逐条消除审计风险，严格覆盖细纲，只输出完整修订正文。'
    });
    if (repairResult.usage) usages.push(repairResult.usage);
    if (!repairResult.success || !normalizeText(repairResult.content)) {
      attempts.push({ attempt: attemptNumber, accepted: false, reason: 'repair_generation_failed', error: normalizeText(repairResult.error || '') });
      break;
    }

    try {
      const wordCountResult = await reviseGeneratedContentToWordCount({
        content: repairResult.content,
        targetWordCount,
        chapterTitle,
        model,
        preserveRequirements: [
          normalizeText(chapterPlan.chapter_mission || ''),
          ...normalizeJsonArray(currentAudit?.outline_coverage_audit?.missing_beats).map((item) => normalizeText(item)),
          normalizeText(buildOutlineFromChapterPlan(chapterPlan))
        ].filter(Boolean).join('\n')
      });
      const repairedContent = wordCountResult.content;
      const repairedAudit = await auditGeneratedContent({ ...auditInput, content: repairedContent });
      const accepted = shouldAcceptQualityRepair(currentAudit, repairedAudit);
      attempts.push({
        attempt: attemptNumber,
        accepted,
        reason: accepted ? 'quality_score_improved' : 'quality_score_not_improved',
        before_verdict: normalizeText(currentAudit.verdict),
        after_verdict: normalizeText(repairedAudit.verdict),
        before_risk_count: normalizeJsonArray(currentAudit.risks).length,
        after_risk_count: normalizeJsonArray(repairedAudit.risks).length,
        before_plan_status: normalizeText(currentAudit?.plan_anchor_audit?.status),
        after_plan_status: normalizeText(repairedAudit?.plan_anchor_audit?.status),
        before_outline_status: normalizeText(currentAudit?.outline_coverage_audit?.status),
        after_outline_status: normalizeText(repairedAudit?.outline_coverage_audit?.status),
        word_count_audit: wordCountResult.audit
      });
      if (!accepted) break;
      currentContent = repairedContent;
      currentAudit = repairedAudit;
      applied = true;
    } catch (error) {
      attempts.push({ attempt: attemptNumber, accepted: false, reason: 'repair_validation_failed', error: normalizeText(error.message || '') });
      break;
    }
  }
  return { content: currentContent, audit: currentAudit, attempts, applied, usage: usages };
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
  // 只把“本章正式节点”作为必须推进项；剧情线人物/剧情线本身不要求每章都出场。
  // 未命中节点的章节按背景参考处理，不借用之前或之后的节点当作 mustAdvance。
  return exact || null;
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
    ? storylines
      .filter((item) => selectedIds.includes(item.id)
        && Number(chapterIndex) >= Number(item.start_chapter || 1)
        && Number(chapterIndex) <= Number(item.end_chapter || Number.MAX_SAFE_INTEGER))
      .sort((left, right) => Number(right.id === mainStorylineId) - Number(left.id === mainStorylineId))
    : [];

  const timelineSlots = normalizeJsonArray(volumeTimeline?.chapterSlots || volumeTimeline?.timeline);
  const matchedSlot = timelineSlots.find((slot) => Number(slot.chapter || slot.chapterNumber || 0) === Number(chapterIndex)) || null;
  const futureFormalBoundaries = (Array.isArray(storylines) ? storylines : []).flatMap((row) => {
    const structured = parseStructuredContent(row.structured_content);
    return normalizeJsonArray(structured.keyBeats || structured.beats || structured.development)
      .filter((item) => Number(item?.chapterApprox || item?.chapter || 0) > Number(chapterIndex))
      .map((item) => ({
        storylineId: row.id,
        storylineTitle: normalizeText(structured.title || row.storyline_name || ''),
        chapterApprox: Number(item?.chapterApprox || item?.chapter || 0),
        title: normalizeText(item?.title || ''),
        summary: [
          normalizeText(item?.summary || item?.title || ''),
          normalizeText(item?.expectedChange || item?.expected_change || '')
        ].filter(Boolean).join('；')
      }))
      .filter((item) => item.summary);
  });

  const storylineContexts = selectedStorylines.map((row) => {
    const structured = parseStructuredContent(row.structured_content);
    const structuredBeats = normalizeJsonArray(structured.keyBeats || structured.beats || structured.development);
    // 兼容顶层 key_nodes 的“第N章：事件”字符串数组（旧数据格式），
    // 让现有剧情线节点能被识别为本章正式节点，而不是整条线摘要兜底。
    const legacyKeyNodes = normalizeJsonArray(row.key_nodes)
      .map((entry) => {
        const text = normalizeText(typeof entry === 'string' ? entry : entry?.text || entry?.event || '');
        const match = text.match(/^第\s*(\d+)\s*章[：:]\s*(.+)$/);
        return match
          ? { chapterApprox: Number(match[1]), title: match[2].trim(), summary: match[2].trim() }
          : null;
      })
      .filter(Boolean);
    const beat = pickBeatForChapter(
      chapterIndex,
      { keyBeats: [...structuredBeats, ...legacyKeyNodes] },
      row
    );
    const orderedBeats = normalizeJsonArray(structured.keyBeats || structured.beats || structured.development)
      .map((item) => ({ item, chapter: Number(item?.chapterApprox || item?.chapter || 0) }))
      .filter((item) => item.chapter > 0)
      .sort((left, right) => left.chapter - right.chapter);
    const beatChapter = Number(beat?.chapterApprox || beat?.chapter || row.start_chapter || chapterIndex);
    const nextBeatChapter = orderedBeats.find((item) => item.chapter > beatChapter)?.chapter || Number(row.end_chapter || chapterIndex) + 1;
    const beatSpan = Math.max(1, nextBeatChapter - beatChapter);
    const beatStep = Math.min(beatSpan, Math.max(1, Number(chapterIndex) - beatChapter + 1));
    const futureFormalBeats = normalizeJsonArray(structured.keyBeats || structured.key_beats)
      .filter((item) => Number(item?.chapterApprox || item?.chapter_approx || item?.chapter || 0) > Number(chapterIndex))
      .map((item) => {
        const chapterApprox = Number(item?.chapterApprox || item?.chapter_approx || item?.chapter || 0);
        const content = [
          normalizeText(item?.summary || item?.title || item?.beat || ''),
          normalizeText(item?.expectedChange || item?.expected_change || '')
        ].filter(Boolean).join('；');
        return content ? `第${chapterApprox}章正式节点不得提前发生：${content}` : '';
      })
      .filter(Boolean);
    const explicitBeatId = normalizeText(beat?.beatId || beat?.beat_id || '');
    const fallbackBeatId = row.id
      ? `fallback:${row.id}:chapter:${Number(chapterIndex || 0) || 'unknown'}`
      : '';
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
      isMain: row.id === mainStorylineId,
      title: normalizeText(structured.title || row.storyline_name || ''),
      type: normalizeText(structured.type || row.storyline_type || ''),
      dramaticQuestion: normalizeText(structured.dramaticQuestion || row.core_conflict || ''),
      summary: normalizeText(structured.summary || row.description || ''),
      beatId: explicitBeatId || fallbackBeatId,
      beatTitle: normalizeText(beat?.title || beat?.beat || ''),
      beatSummary: normalizeText(beat?.summary || beat?.beat || ''),
      expectedChange: normalizeText(beat?.expectedChange || beat?.expected_change || ''),
      beatStep,
      beatSpan,
      isFallbackBeat: !explicitBeatId && !!fallbackBeatId,
      mustInclude: normalizeJsonArray(beat?.must_include || beat?.mustInclude),
      mustAvoid: [...new Set([
        ...normalizeJsonArray(beat?.must_avoid || beat?.mustAvoid).map((entry) => normalizeText(entry)).filter(Boolean),
        ...futureFormalBeats
      ])],
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
      lines.push(`- ${item.isMain ? '当前剧情主线' : `关联剧情线 ${index + 1}`}：${item.title || '未命名'}${item.type ? `（${item.type}）` : ''}`);
      lines.push(`  - 当前剧情节点：${item.beatTitle || '本章无该线正式节点（按背景参考，不强制推进）'}`);
      if (item.beatSummary) lines.push(`  - 本章必须推进：${item.beatSummary}`);
      else if (item.summary) lines.push(`  - 剧情线背景：${item.summary}`);
      if (item.expectedChange) lines.push(`  - 角色 / 局势变化：${item.expectedChange}`);
      if (item.beatSummary && item.beatSpan > 1) lines.push(`  - 节点内进度：第 ${item.beatStep}/${item.beatSpan} 段；只写本段新增进展，不得重新讲述该节点起点。`);
      if (item.dramaticQuestion) lines.push(`  - 冲突升级方向：${item.dramaticQuestion}`);
      if (item.beatSummary && item.mustInclude.length > 0) lines.push(`  - 本章必须出现：${item.mustInclude.join('；')}`);
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

  if (futureFormalBoundaries.length > 0) {
    lines.push('- 全局未来正式节点（仅作为时间禁区，当前章不得提前兑现）：');
    futureFormalBoundaries.forEach((item) => {
      lines.push(`  - 第${item.chapterApprox}章 · ${item.storylineTitle}${item.title ? ` · ${item.title}` : ''}：${item.summary}`);
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
    futureFormalBoundaries,
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
      .filter((item) => !item.isFallbackBeat)
      .map((item) => normalizeText(item.beatSummary || ''))
      .filter((item) => item.replace(/[，。！？、；：,.!?;:\s]/g, '').length >= 6)
    : [];

  const mustNotHappen = [
    ...(Array.isArray(storylineContext.storylineContexts)
      ? storylineContext.storylineContexts.flatMap((item) => normalizeJsonArray(item.mustAvoid).map((entry) => normalizeText(entry)).filter(Boolean))
      : []),
    ...normalizeJsonArray(storylineContext.futureFormalBoundaries)
      .map((item) => normalizeText(item?.summary || item?.title || ''))
      .filter(Boolean)
  ];

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
    mustAdvance: [...new Set(mustAdvance)],
    mustNotHappen: [...new Set(mustNotHappen)],
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
  const mustAdvance = normalizeJsonArray(storylineContext.mustAdvance)
    .map((item) => normalizeText(typeof item === 'string' ? item : item?.summary || item?.title || ''))
    .filter((item) => item.replace(/[，。！？、；：,.!?;:\s]/g, '').length >= 6);
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

function buildStorylineProgressAudit({ feedback = {}, structuredContent = {}, chapterPlan = {} } = {}) {
  const storylineContext = parseStructuredContent(structuredContent.storyline_context);
  const usedStorylineIds = normalizeJsonArray(storylineContext.usedStorylineIds)
    .map((item) => normalizeText(item))
    .filter(Boolean);
  const usedBeatIds = normalizeJsonArray(storylineContext.usedBeatIds)
    .map((item) => normalizeText(item))
    .filter(Boolean);
  const mustAdvanceItems = normalizeJsonArray(storylineContext.mustAdvance)
    .map((item) => normalizeText(typeof item === 'string' ? item : item?.summary || item?.title || ''))
    .filter(Boolean);
  const targetStorylineIds = normalizeJsonArray(chapterPlan.target_storylines)
    .map((item) => normalizeText(item))
    .filter(Boolean);
  const mainStorylineId = normalizeText(chapterPlan.main_storyline_id || '');
  const hasStorylineTarget = !!mainStorylineId || targetStorylineIds.length > 0 || usedStorylineIds.length > 0;
  const isFallback = !!storylineContext.isFallback;
  const summary = normalizeText(
    feedback.story_progress
    || feedback.chapter_summary
    || feedback.next_chapter_focus
    || ''
  );
  const risks = [];

  if (hasStorylineTarget && usedStorylineIds.length === 0) {
    risks.push('本章已有剧情线挂载或主推，但生成 metadata 没有记录 usedStorylineIds。');
  }
  if (hasStorylineTarget && mustAdvanceItems.length > 0 && usedBeatIds.length === 0) {
    risks.push('本章存在正式剧情线节点（mustAdvance），但生成 metadata 没有记录 usedBeatIds。');
  }
  if (isFallback) {
    risks.push('本章剧情线约束来自 fallback，上线前需要复核结构化 beat 是否完整。');
  }
  if (hasStorylineTarget && !summary) {
    risks.push('本章反馈没有给出剧情线推进摘要。');
  }

  const status = !hasStorylineTarget
    ? 'not_applicable'
    : risks.length > 0
      ? 'needs_review'
      : 'advanced';

  return {
    status,
    used_storyline_ids: usedStorylineIds,
    used_beat_ids: usedBeatIds,
    summary,
    risks,
    requires_review: risks.length > 0
  };
}

function buildWordCountAudit({ content = '', targetWordCount = 0 } = {}) {
  const target = Number(targetWordCount || 0) || 0;
  const actual = countPlatformEffectiveWords(content);
  if (!target || !actual) {
    return {
      status: 'not_applicable',
      target,
      actual,
      deviation_ratio: 0,
      summary: '目标字数或实际字数缺失，未执行字数偏差检查。'
    };
  }

  const deviationRatio = Number(((actual - target) / target).toFixed(4));
  const status = classifyWordCountDeviation(actual, target, WORD_COUNT_TOLERANCE);
  const percent = `${deviationRatio >= 0 ? '+' : ''}${(deviationRatio * 100).toFixed(1)}%`;
  return {
    status,
    target,
    actual,
    deviation_ratio: deviationRatio,
    summary: `目标 ${target} 字，实际约 ${actual} 字，偏差 ${percent}。`
  };
}

function enforceGeneratedWordCount(content = '', targetWordCount = 0) {
  const normalized = sanitizeGeneratedText(content);
  const effectiveLength = countPlatformEffectiveWords(normalized);
  const target = Number(targetWordCount || 0) || 0;
  return {
    content: normalized,
    audit: {
      trimmed: false,
      target,
      originalLength: effectiveLength,
      finalLength: effectiveLength,
      rawCharacterLength: normalized.length,
      deviationRatio: target > 0 ? Number(((effectiveLength - target) / target).toFixed(4)) : 0,
      reason: '未执行硬截断，仅清理乱码替换字符并记录字数偏差。'
    }
  };
}

function isWordCountWithinTolerance(content = '', targetWordCount = 0, tolerance = WORD_COUNT_TOLERANCE) {
  const target = Number(targetWordCount || 0) || 0;
  const actual = countPlatformEffectiveWords(content);
  if (!target || !actual) return true;
  return isCountWithinTolerance(actual, target, tolerance);
}

function buildWordCountRevisionPrompt({
  content = '',
  targetWordCount = 0,
  draftTargetWordCount = 0,
  previousEffectiveLength = 0,
  chapterTitle = '',
  preserveRequirements = ''
} = {}) {
  const target = Number(targetWordCount || 0) || 0;
  const { min, max } = getWordCountBounds(target);
  const previousLength = Number(previousEffectiveLength || 0) || countPlatformEffectiveWords(content);
  const draftTarget = Number(draftTargetWordCount || 0) || Math.max(
    Math.floor(target * WORD_COUNT_POLICY.revision.low_draft_ratio),
    Math.floor(target * WORD_COUNT_POLICY.revision.high_draft_ratio)
  );
  const needsExpansion = previousLength < min;
  const action = needsExpansion ? '扩写' : '压缩';
  return [
    `你是网文章节定稿编辑。请把下面这章正文${action}定稿到目标字数允许范围内。`,
    '',
    '【硬性目标】',
    `目标有效字数：${target} 字。`,
    `硬上限：${max} 有效字，超过即不合格。`,
    `建议区间：${min}-${max} 有效字。`,
    previousLength
      ? needsExpansion
        ? `当前稿约 ${previousLength} 有效字，低于下限，必须在不改变剧情走向的前提下自然扩写。`
        : `当前稿约 ${previousLength} 有效字，已经超过上限，必须明显压缩。`
      : '',
    `本次改写请瞄准约 ${draftTarget} 有效字，不要贴近上限；最终正文必须自然完整。`,
    '统计口径：按网文平台发布口径估算，空格、换行、标点符号不计入有效字数。',
    chapterTitle ? `章节标题：${chapterTitle}` : '',
    preserveRequirements ? `【压缩或扩写时绝不能删除的剧情结果】\n${preserveRequirements}` : '',
    '',
    `【${action}定稿要求】`,
    '1. 保留原章节的主要剧情、人物关系、线索和结尾钩子。',
    needsExpansion
      ? '2. 只补足既有场景中的动作过程、人物反应、有效对话、环境阻力和因果过渡，不得用重复句或空泛心理凑字数。'
      : '2. 必须主动压缩重复心理、重复环境描写、重复解释、过长对话和额外尾声。',
    needsExpansion
      ? '3. 不要新增支线、新设定、新人物或改变事件结果；不要让后续章节计划中的事件提前发生。'
      : '3. 每个关键场景只保留必要动作、冲突和转折，不要扩写新的支线、新设定或新人物。',
    needsExpansion
      ? '4. 优先把原文中跳跃过快的动作、对话和因果连接写完整，保持原有叙事风格。'
      : '4. 优先删减过渡铺陈和重复感受，不要新增场景来补字数。',
    '5. 不要直接截断或机械拼接原文，要自然改写成完整章节。',
    '6. 不要输出说明、标题、Markdown 或字数统计。',
    `7. 只输出${action}后的章节正文。`,
    '',
    '【原章节正文】',
    sanitizeGeneratedText(content)
  ].filter(Boolean).join('\n');
}

async function reviseGeneratedContentToWordCount({
  content = '',
  targetWordCount = 0,
  chapterTitle = '',
  model = '',
  preserveRequirements = ''
} = {}) {
  let currentContent = sanitizeGeneratedText(content);
  const target = Number(targetWordCount || 0) || 0;
  const originalLength = countPlatformEffectiveWords(currentContent);
  const attempts = [];
  if (!target || !currentContent || isWordCountWithinTolerance(currentContent, target, WORD_COUNT_TOLERANCE)) {
    return {
      content: currentContent,
      audit: {
        trimmed: false,
        revised: false,
        target,
        originalLength,
        finalLength: countPlatformEffectiveWords(currentContent),
        rawCharacterLength: currentContent.length,
        deviationRatio: target ? Number(((countPlatformEffectiveWords(currentContent) - target) / target).toFixed(4)) : 0,
        attempts,
        reason: currentContent === normalizeText(content) ? '' : '已清理正文中的乱码替换字符。'
      }
    };
  }

  const configuredMaxAttempts = Number(
    process.env.WORD_COUNT_REVISION_MAX_ATTEMPTS || WORD_COUNT_POLICY.revision.max_attempts
  );
  const maxRevisionAttempts = Number.isFinite(configuredMaxAttempts)
    ? Math.min(WORD_COUNT_POLICY.revision.max_attempts, Math.max(1, Math.floor(configuredMaxAttempts)))
    : WORD_COUNT_POLICY.revision.max_attempts;
  for (let attempt = 1; attempt <= maxRevisionAttempts; attempt += 1) {
    const currentLength = countPlatformEffectiveWords(currentContent);
    const { min: lowerLimit, max: upperLimit } = getWordCountBounds(target);
    const needsExpansion = currentLength < lowerLimit;
    const currentRatio = target > 0 && currentLength > 0 ? target / currentLength : 1;
    const draftTarget = currentLength > upperLimit
      ? Math.max(
        Math.floor(target * WORD_COUNT_POLICY.revision.compression_floor_ratio),
        Math.floor(target * Math.min(
          WORD_COUNT_POLICY.revision.high_draft_ratio,
          currentRatio * WORD_COUNT_POLICY.revision.compression_target_ratio
        ))
      )
      : Math.min(
        Math.ceil(target * WORD_COUNT_POLICY.revision.expansion_floor_ratio),
        Math.ceil(target * WORD_COUNT_POLICY.revision.expansion_target_ratio)
      );
    const previousMeasuredAttempt = [...attempts].reverse().find((item) => item.success && item.tokenBudget && item.length);
    const revisionMaxTokens = calculateRevisionTokenBudget({
      currentLength,
      targetCount: target,
      draftTargetCount: draftTarget,
      previousAttempt: previousMeasuredAttempt,
      needsExpansion
    });
    const result = await runTextGeneration(buildWordCountRevisionPrompt({
      content: currentContent,
      targetWordCount: target,
      draftTargetWordCount: draftTarget,
      previousEffectiveLength: currentLength,
      chapterTitle,
      preserveRequirements
    }), {
      model,
      temperature: 0.2,
      maxTokens: revisionMaxTokens
    });
    if (!result.success) {
      attempts.push({
        attempt,
        success: false,
        error: result.error || '模型重写失败',
        length: countPlatformEffectiveWords(currentContent),
        rawCharacterLength: currentContent.length
      });
      continue;
    }
    currentContent = sanitizeGeneratedText(result.content);
    const revisionTruncation = buildGenerationTruncationState({
      content: currentContent,
      finishReason: result.finishReason || ''
    });
    let revisionEndingRepair = null;
    if (revisionTruncation.detected) {
      revisionEndingRepair = await repairGeneratedEndingIfNeeded({
        content: currentContent,
        finishReason: result.finishReason || '',
        chapterTitle,
        targetWordCount: target,
        model
      });
      currentContent = sanitizeGeneratedText(revisionEndingRepair.content);
    }
    const effectiveLength = countPlatformEffectiveWords(currentContent);
    const deviationRatio = target ? Number(((effectiveLength - target) / target).toFixed(4)) : 0;
    attempts.push({
      attempt,
      success: true,
      length: effectiveLength,
      rawCharacterLength: currentContent.length,
      deviationRatio,
      tokenBudget: revisionMaxTokens,
      finishReason: normalizeText(result.finishReason || '') || null,
      endingRepairAttempted: !!revisionEndingRepair,
      endingRepairSucceeded: revisionEndingRepair ? !!revisionEndingRepair.repair?.success : null
    });
    const finalRevisionTruncation = buildGenerationTruncationState({ content: currentContent, finishReason: '' });
    if (isWordCountWithinTolerance(currentContent, target, WORD_COUNT_TOLERANCE) && !finalRevisionTruncation.detected) {
      return {
        content: currentContent,
        audit: {
          trimmed: false,
          revised: true,
          target,
          originalLength,
          finalLength: effectiveLength,
          rawCharacterLength: currentContent.length,
          deviationRatio,
          attempts,
          reason: originalLength < getWordCountBounds(target).min
            ? `初稿字数低于 ${(WORD_COUNT_TOLERANCE * 100).toFixed(0)}% 下限，已通过模型扩写补足到可接受范围。`
            : `初稿字数超过 ${(WORD_COUNT_TOLERANCE * 100).toFixed(0)}% 上限，已通过模型重写收束到可接受范围。`
        }
      };
    }
  }

  const finalEffectiveLength = countPlatformEffectiveWords(currentContent);
  const finalDeviationRatio = target ? Number(((finalEffectiveLength - target) / target).toFixed(4)) : 0;
  const { min: lowerLimit, max: upperLimit } = getWordCountBounds(target);
  const finalTruncation = buildGenerationTruncationState({ content: currentContent, finishReason: '' });
  const error = new Error(finalTruncation.detected
    ? `字数定稿后的正文结尾仍疑似截断，已阻止保存。当前约 ${finalEffectiveLength} 有效字。`
    : `生成有效字数未落入允许范围，已阻止保存。目标 ${target} 字，允许 ${lowerLimit}-${upperLimit} 字，当前约 ${finalEffectiveLength} 有效字，偏差 ${(finalDeviationRatio * 100).toFixed(1)}%。`);
  error.statusCode = 422;
  error.wordCountAudit = {
    trimmed: false,
    revised: attempts.some((item) => item.success),
    target,
    originalLength,
    finalLength: finalEffectiveLength,
    rawCharacterLength: currentContent.length,
    deviationRatio: finalDeviationRatio,
    attempts,
    reason: finalTruncation.detected
      ? '模型字数定稿后结尾仍疑似截断。'
      : '模型重写后仍未落入允许字数范围。'
  };
  throw error;
}

function enrichFeedbackWithAudits({ feedback = {}, structuredContent = {}, chapterPlan = {}, content = '' } = {}) {
  const enriched = feedback && typeof feedback === 'object' ? { ...feedback } : {};
  const qualityCheck = normalizeQualityCheck(enriched.quality_check || {});
  const storylineAudit = buildStorylineProgressAudit({ feedback: enriched, structuredContent, chapterPlan });
  const planStructured = parseStructuredContent(chapterPlan.structured_content);
  const targetWordCount = Number(planStructured?.generation_settings?.word_count || 0) || 0;
  const wordCountAudit = buildWordCountAudit({ content, targetWordCount });
  const risks = [
    ...normalizeJsonArray(qualityCheck.risks).map((item) => normalizeText(item)).filter(Boolean),
    ...storylineAudit.risks,
    ...(wordCountAudit.status === 'risky' ? [wordCountAudit.summary] : [])
  ].filter(Boolean);

  enriched.storyline_progress = {
    status: storylineAudit.status,
    usedStorylineIds: storylineAudit.used_storyline_ids,
    usedBeatIds: storylineAudit.used_beat_ids,
    summary: storylineAudit.summary,
    requiresReview: storylineAudit.requires_review,
    risks: storylineAudit.risks
  };
  enriched.quality_check = normalizeQualityCheck({
    ...qualityCheck,
    risks,
    storyline_audit: storylineAudit,
    word_count_audit: wordCountAudit,
    needs_human_review: qualityCheck.needs_human_review || storylineAudit.requires_review || wordCountAudit.status === 'risky'
  });
  return enriched;
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
  structuredContent.storyline_context = Array.isArray(storylineContext?.storylineContexts)
    ? buildPersistedStorylineContext(storylineContext)
    : parseStructuredContent(storylineContext);

  db.run(
    'UPDATE chapter_plans SET structured_content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(structuredContent), existingPlan.id]
  );
  saveDatabase(db);
  return structuredContent.storyline_context;
}

async function saveChapterFeedback({ bookId, chapterNumber, feedback, content = '' }) {
  const db = await dbPromise;
  const existingPlan = execQueryOne(
    db,
    'SELECT id, chapter_id, main_storyline_id, target_storylines, structured_content FROM chapter_plans WHERE book_id = ? AND chapter_number = ? ORDER BY updated_at DESC LIMIT 1',
    [bookId, chapterNumber]
  );

  if (!existingPlan) return null;

  const structuredContent = parseStructuredContent(existingPlan.structured_content);
  const normalizedFeedback = feedback && typeof feedback === 'object'
    ? {
        ...feedback,
        quality_check: feedback.quality_check
          ? normalizeQualityCheck(feedback.quality_check)
          : undefined
      }
    : feedback;
  const enrichedFeedback = enrichFeedbackWithAudits({
    feedback: normalizedFeedback,
    structuredContent,
    chapterPlan: existingPlan,
    content
  });
  structuredContent.chapter_feedback = enrichedFeedback;
  structuredContent.character_feedback = {
    summary: normalizeText(enrichedFeedback.character_progress || ''),
    characters: normalizeJsonArray(enrichedFeedback.chapter_characters),
    newCharacters: normalizeJsonArray(enrichedFeedback?.continuity_report?.new_characters),
    updatedAt: enrichedFeedback.updated_at || new Date().toISOString(),
    source: enrichedFeedback.source || 'model_feedback'
  };
  structuredContent.plot_feedback = {
    chapterSummary: normalizeText(enrichedFeedback.chapter_summary || ''),
    summary: normalizeText(enrichedFeedback.story_progress || ''),
    openHooks: normalizeText(enrichedFeedback.open_hooks || ''),
    nextChapterFocus: normalizeText(enrichedFeedback.next_chapter_focus || ''),
    newElements: normalizeJsonArray(enrichedFeedback?.continuity_report?.new_elements),
    updatedAt: enrichedFeedback.updated_at || new Date().toISOString(),
    source: enrichedFeedback.source || 'model_feedback'
  };

  let storylineProgressUpdated = false;
  let requiresStorylineReview = false;
  let storylineProgressError = '';

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
    storylineProgressError = error.message || '剧情线进度写回失败';
    logger.error('Storyline progress writeback failed', {
      error: error.message,
      bookId,
      chapterNumber
    });
  }

  syncFeedbackLedgers(db, {
    bookId,
    chapterNumber,
    feedback: enrichedFeedback,
    content
  });
  saveDatabase(db);
  logger.info('Chapter feedback persisted', {
    bookId,
    chapterNumber,
    hasCharacterFeedback: !!structuredContent.character_feedback.summary,
    hasPlotFeedback: !!structuredContent.plot_feedback.summary,
    storylineProgressUpdated,
    requiresStorylineReview,
    storylineProgressError: storylineProgressError || null
  });
  return {
    feedback: enrichedFeedback,
    storylineProgressUpdated,
    requiresStorylineReview,
    storylineProgressError
  };
}

function mergeLedgerSnapshots(primary = {}, fallback = {}) {
  const mergeRows = (first, second) => {
    const seen = new Set();
    return [...(Array.isArray(first) ? first : []), ...(Array.isArray(second) ? second : [])].filter((item) => {
      const key = normalizeText(item?.id || '') || JSON.stringify(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  return {
    characterRows: mergeRows(primary.characterRows, fallback.characterRows),
    foreshadowRows: mergeRows(primary.foreshadowRows, fallback.foreshadowRows),
    continuityRows: mergeRows(primary.continuityRows, fallback.continuityRows)
  };
}

async function loadContentAwareLedgerSnapshot({ bookId, chapterNumber, content = '', baseSnapshot = {} }) {
  const db = await dbPromise;
  const mentionedSnapshot = loadRelevantLedgerSnapshot(db, {
    bookId,
    chapterNumber,
    relevantText: content,
    limit: 24
  });
  return mergeLedgerSnapshots(mentionedSnapshot, baseSnapshot);
}

async function loadBookGenerationContext(bookId, chapterNumber, options = {}) {
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
      'SELECT id, chapter_number, chapter_name, title, outline, content FROM chapters WHERE book_id = ? ORDER BY chapter_number ASC',
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

  let volumePlanRows = [];
  try {
    volumePlanRows = execQuery(
      db,
      'SELECT * FROM volume_plans WHERE book_id = ? ORDER BY volume_number ASC, updated_at DESC',
      [bookId]
    );
  } catch (_) {}

  const currentChapterNumber = Number(chapterNumber);
  const currentChapter = Number.isFinite(currentChapterNumber)
    ? chapterRows.find((row) => Number(row.chapter_number || 0) === currentChapterNumber) || null
    : null;
  const previousChapter = pickPreviousChapter(chapterRows, currentChapterNumber);
  const chapterPlanRow = Number.isFinite(currentChapterNumber)
    ? chapterPlanRows.find((row) => Number(row.chapter_number || 0) === currentChapterNumber) || null
    : null;
  const contextCharacterRows = options.forOutline
    ? characterRows.filter((character) => normalizeText(character.character_type || '') !== 'chapter_character')
    : characterRows;
  const previousChapterPlan = Number.isFinite(currentChapterNumber) && currentChapterNumber > 1
    ? [...chapterPlanRows].reverse().find((row) => Number(row.chapter_number || 0) < currentChapterNumber) || null
    : null;

  const previousChapterFeedback = parseStructuredContent(previousChapterPlan?.structured_content)?.chapter_feedback || null;
  const previousChapterOutline = normalizeText(buildOutlineFromChapterPlan(previousChapterPlan));
  const bookPremise = normalizeText(bookPlanRow?.premise || '');
  const bookMainGoal = normalizeText(bookPlanRow?.main_goal || '');
  const bookCoreConflict = normalizeText(bookPlanRow?.core_conflict || '');
  const bookWorldRules = normalizeText(bookPlanRow?.world_rules || '');
  const bookRoleSummary = normalizeText(bookPlanRow?.role_summary || '');
  const bookPlanMainOutline = normalizeText(bookPlanRow?.main_outline || '');
  const bookPlanVolumeOutline = normalizeText(bookPlanRow?.volume_outline || '');
  const bookPlanDetailedOutline = normalizeText(bookPlanRow?.detailed_outline || '');
  const includeCurrentOutline = !options.excludeCurrentOutline;
  const chapterOutline = includeCurrentOutline ? normalizeText(buildOutlineFromChapterPlan(chapterPlanRow)) : '';
  const firstKeyScene = chapterOutline;
  const characterSummary = buildCharacterSummaryContext(contextCharacterRows);
  const storedCharacters = buildStoredCharacterContext(characterRows);
  const outlineCharacters = buildOutlineCharacterContext(contextCharacterRows, chapterPlanRow);
  const previousHook = currentChapterNumber > 1 ? normalizeText(chapterPlanRow?.previous_hook || '') : '';
  const chapterCharacterNotes = normalizeText(chapterPlanRow?.character_notes || '');
  const chapterStructuredContent = parseStructuredContent(chapterPlanRow?.structured_content);
  const chapterPlotNotes = normalizeText(chapterStructuredContent.plot_notes || '');
  const chapterMission = normalizeText(chapterPlanRow?.chapter_mission || '');
  const emotionTarget = normalizeText(chapterPlanRow?.emotion_target || '');
  const endingHook = normalizeText(chapterPlanRow?.ending_hook || '');
  const summary = normalizeText(chapterPlanRow?.summary || '');

  const mainStoryline = chapterPlanRow?.main_storyline_id
    ? storylineRows.find((item) => item.id === chapterPlanRow.main_storyline_id) || null
    : null;
  const targetStorylineIds = normalizeJsonArray(chapterPlanRow?.target_storylines);
  const targetStorylineLabels = storylineRows
    .filter((item) => targetStorylineIds.includes(item.id)
      && currentChapterNumber >= Number(item.start_chapter || 1)
      && currentChapterNumber <= Number(item.end_chapter || Number.MAX_SAFE_INTEGER))
    .map((item) => item.storyline_name)
    .filter(Boolean);
  const currentVolumeNumber = Number(chapterPlanRow?.volume_number || mainStoryline?.volume_number || targetStorylineIds.map((id) => storylineRows.find((item) => item.id === id)?.volume_number).find(Boolean) || 0) || 0;
  const volumeTimelineRow = currentVolumeNumber
    ? volumeTimelineRows.find((item) => Number(item.volume_number || 0) === currentVolumeNumber) || null
    : null;
  const volumeTimeline = volumeTimelineRow ? parseStructuredContent(volumeTimelineRow.timeline_data) : null;
  const currentVolumePlan = currentVolumeNumber
    ? volumePlanRows.find((item) => Number(item.volume_number || 0) === currentVolumeNumber) || null
    : null;
  const keyCharacterNames = contextCharacterRows
    .map((item) => normalizeText(item.name))
    .filter((name) => name && name !== '全书角色设定' && name !== '本章新增角色')
    .slice(0, 8);
  const ledgerSnapshot = loadRelevantLedgerSnapshot(db, {
    bookId,
    chapterNumber: currentChapterNumber,
    characterNames: [
      ...keyCharacterNames,
      ...normalizeJsonArray(chapterPlanRow?.appearing_roles)
    ],
    limit: 24
  });
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
  if (bookRoleSummary && !storedCharacters) notes.push(`全书角色摘要：${bookRoleSummary}`);
  if (keyCharacterNames.length > 0) {
    notes.push(`姓名硬约束：本书当前可用核心角色名为 ${keyCharacterNames.join(' / ')}。${options.forOutline ? '细纲' : '正文'}只能使用这套人物体系，严禁替换主角姓名或串入其他作品人物名。`);
  }
  if (bookPlanMainOutline) notes.push(`全书规划边界：${bookPlanMainOutline}`);
  if (bookPlanVolumeOutline) notes.push(`全书分卷总规划：${bookPlanVolumeOutline}`);
  if (currentVolumePlan) {
    notes.push([
      `当前分卷规划：第 ${currentVolumeNumber} 卷${currentVolumePlan.volume_name ? `《${currentVolumePlan.volume_name}》` : ''}`,
      currentVolumePlan.volume_theme ? `卷主题：${currentVolumePlan.volume_theme}` : '',
      currentVolumePlan.stage_goal ? `阶段目标：${currentVolumePlan.stage_goal}` : '',
      currentVolumePlan.core_conflict ? `卷核心冲突：${currentVolumePlan.core_conflict}` : '',
      currentVolumePlan.start_role_state ? `卷初角色状态：${currentVolumePlan.start_role_state}` : '',
      currentVolumePlan.end_role_state ? `卷末角色状态：${currentVolumePlan.end_role_state}` : '',
      currentVolumePlan.notes ? `卷内推进：${currentVolumePlan.notes}` : ''
    ].filter(Boolean).join('\n'));
  }
  if (bookPlanDetailedOutline) notes.push(`详细推进：${bookPlanDetailedOutline}`);
  if (chapterOutline) notes.push(`章节细纲：${chapterOutline}`);
  if (chapterMission) notes.push(`章节任务：${chapterMission}`);
  if (emotionTarget) notes.push(`情绪目标：${emotionTarget}`);
  if (previousHook) notes.push(`上章承接：${previousHook}`);
  if (includeCurrentOutline && chapterCharacterNotes) notes.push(`本章角色说明：${chapterCharacterNotes}`);
  if (chapterPlotNotes) notes.push(`用户修订的本章情节约束：${chapterPlotNotes}`);
  if (mainStoryline) notes.push(`主剧情线：${mainStoryline.storyline_name}${mainStoryline.storyline_type ? ' · ' + mainStoryline.storyline_type : ''}`);
  if (targetStorylineLabels.length > 0) notes.push(`关联剧情线：${targetStorylineLabels.join(' / ')}`);
  if (characterSummary) notes.push(`角色摘要：\n${characterSummary}`);
  if (ledgerSnapshot.characterRows.length > 0) {
    notes.push(`相关角色状态账本：\n${ledgerSnapshot.characterRows.map((item) =>
      `第${item.chapter_number}章｜${item.character_name}｜${[item.state_text, item.relationship_text, item.note_text].filter(Boolean).join('；')}`
    ).join('\n')}`);
  }
  if (ledgerSnapshot.foreshadowRows.length > 0) {
    notes.push(`待处理伏笔账本：\n${ledgerSnapshot.foreshadowRows.map((item) =>
      `第${item.chapter_number}章种下｜${item.title}｜状态：${item.state}`
    ).join('\n')}`);
  }
  if (ledgerSnapshot.continuityRows.length > 0) {
    notes.push(`近期事实事件：\n${ledgerSnapshot.continuityRows.map((item) =>
      `第${item.chapter_number}章｜${item.event_type}｜${item.fact_text}`
    ).join('\n')}`);
  }
  if (previousChapterOutline) {
    notes.push(`上一章细纲（已发生事实，只能承接其结尾，不得重新概述或改写）：\n${previousChapterOutline}`);
  }
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
  }
  const previousChapterTail = previousChapter?.content ? truncateTail(previousChapter.content, 1200) : '';
  if (previousChapterTail) {
    notes.push(`上一章正文结尾：\n${previousChapterTail}`);
  }
  const openingBridgeText = buildChapterOpeningBridgeText({
    previousChapterTail,
    firstKeyScene,
    chapterGoal: chapterMission
  });
  if (openingBridgeText) {
    notes.push(openingBridgeText);
  }

  notes.push(buildDynamicGenerationConstraints({
    chapterPlan: chapterPlanRow || {},
    previousChapterFeedback,
    characterRows: contextCharacterRows,
    storylineRows
  }));
  const generationConstraints = buildDynamicGenerationConstraintState({
    chapterPlan: chapterPlanRow || {},
    previousChapterFeedback,
    characterRows: contextCharacterRows,
    storylineRows
  });
  return {
    bookTitle: normalizeText(book?.title || ''),
    contextNotes: notes.join('\n\n'),
    generationConstraints,
    chapterStorylineContext,
    storedCharacters,
    outlineCharacters,
    characterSummary,
    chapterPlan: chapterPlanRow || null,
    currentChapter,
    previousChapter,
    previousChapterFeedback,
    ledgerSnapshot
  };
}

function buildChapterFeedbackPrompt({ bookTitle, chapterNumber, chapterTitle, outline, mission, emotionTarget, mainStoryline, targetStorylines, content, openForeshadows = [] }) {
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
    '  "chapter_characters": [{"name": "本章实际出场角色名", "role": "本章职责", "appearance": "正文中可确认的外形标识，没有则为空", "relation": "本章关系变化", "status": "章末状态", "note": "后续连续性提醒"}],',
    '  "open_hooks": "这一章结束时还悬着什么",',
    '  "resolved_hooks": [{"foreshadow_key":"只能填写待处理伏笔中的原 key","title":"已兑现伏笔标题","evidence":"本章正文逐字证据"}],',
    '  "next_chapter_focus": "下一章最值得优先承接的写作重点",',
    '  "continuity_report": {',
    '    "new_characters": [{"name": "新增角色名", "role": "本章职责", "appearance": "最有辨识度的外形标识，没有则为空", "relation": "与主角/主线关系", "status": "合理/偏突兀", "note": "是否值得继续保留"}],',
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
    '8. chapter_characters 必须覆盖正文中实际参与事件的主要人物，不限于新增角色；只保留正文能够证明姓名或明确称谓的角色。',
    '9. appearance 只提取正文已经写出的外形或辨识标记，不要凭空补设定；正文没有就留空，交给下一章人物速查补约束。',
    '10. resolved_hooks 只填写本章已经明确兑现、回答或结束的旧伏笔。只推进但尚未回答的不算解决；evidence 必须是本章正文原句。',
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
    '当前待处理伏笔（只能从这里选择 resolved_hooks）：',
    JSON.stringify((Array.isArray(openForeshadows) ? openForeshadows : []).map((item) => ({
      foreshadow_key: item.foreshadow_key,
      title: item.title,
      planted_chapter: item.chapter_number
    })).slice(0, 24), null, 2),
    '',
    '已生成正文：',
    content || '未提供',
    '',
    '再次提醒：只抽取正文里已经写出来的事实，不要脑补缺失情节。'
  ].join('\n');
}

function buildChapterFeedbackRepairPrompt(rawOutput = '') {
  return [
    '你是一名 JSON 修复助手。请把下面这段“章节反馈失败输出”修复成严格合法的 JSON 对象。',
    '不要添加代码块，不要解释，不要补充失败输出里没有出现的新事实。',
    '如果某个字段缺失，请尽量从现有内容里抽取；实在缺失就返回空字符串或空数组，不要编造。',
    '输出必须严格符合这个 schema：',
    '{',
    '  "chapter_summary": "用 1-2 句话总结这一章实际发生了什么",',
    '  "story_progress": "这一章把主剧情推进到了哪里",',
    '  "character_progress": "关键角色关系或状态发生了什么变化",',
    '  "chapter_characters": [{"name": "本章实际出场角色名", "role": "本章职责", "appearance": "正文中可确认的外形标识，没有则为空", "relation": "本章关系变化", "status": "章末状态", "note": "后续连续性提醒"}],',
    '  "open_hooks": "这一章结束时还悬着什么",',
    '  "resolved_hooks": [{"foreshadow_key":"旧伏笔 key","title":"伏笔标题","evidence":"本章正文逐字证据"}],',
    '  "next_chapter_focus": "下一章最值得优先承接的写作重点",',
    '  "continuity_report": {',
    '    "new_characters": [{"name": "新增角色名", "role": "本章职责", "appearance": "最有辨识度的外形标识，没有则为空", "relation": "与主角/主线关系", "status": "合理/偏突兀", "note": "是否值得继续保留"}],',
    '    "new_elements": [{"name": "新增势力/地点/规则/道具", "role": "本章职责", "relation": "与当前主线关系", "status": "合理/偏突兀", "note": "后续是否应继续使用"}],',
    '    "must_carry_forward": ["下一章必须继续承接的信息"],',
    '    "continuity_risks": ["本章里可能导致后续失控的点"]',
    '  }',
    '}',
    '',
    '待修复输出：',
    rawOutput || '{}'
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

function buildChapterNamePrompt({
  genre,
  subgenre,
  chapterNumber,
  outlineText = '',
  bookTitle = '',
  recentTitles = [],
  avoidPhrases = []
}) {
  const typeInfo = subgenre ? genre + ' - ' + subgenre : genre;
  const normalizedRecentTitles = Array.isArray(recentTitles)
    ? recentTitles.map((title) => normalizeText(title)).filter(Boolean).slice(0, 12)
    : [];
  const normalizedAvoidPhrases = Array.isArray(avoidPhrases)
    ? avoidPhrases.map((phrase) => normalizeText(phrase)).filter(Boolean).slice(0, 8)
    : [];
  return [
    '你是一位受严格约束的网文大神作家，擅长给长篇连载章节命名。',
    '你要像成熟作者一样命名，但不能自由发挥；你的唯一任务是为第 ' + chapterNumber + ' 章生成一个贴合细纲、区别于本书其他章节、避免重复意象的章节名。',
    '如果标题空泛、套词、重复已有高频意象，或与本章细纲不贴合，就视为失败。',
    '',
    '类型：' + typeInfo,
    bookTitle ? `书名：${bookTitle}` : '',
    outlineText ? `章节细纲：\n${normalizeText(outlineText)}` : '',
    normalizedRecentTitles.length > 0 ? `本书已有章节名：\n${normalizedRecentTitles.join('\n')}` : '',
    normalizedAvoidPhrases.length > 0 ? `近期高频重复词/意象：${normalizedAvoidPhrases.join('、')}` : '',
    '',
    '要求：',
    '1. 只输出一个章节名，不要解释。',
    '2. 不要带“第X章”前缀，优先控制在 4-10 个汉字内。',
    '3. 标题必须从章节细纲里提炼，优先抓本章最关键的冲突、动作、物件、地点或转折，不要脱离细纲另起炉灶。',
    '4. 不要空泛，不要只写情绪词或抽象词，尽量落到具体意象或具体事件。',
    '5. 避免重复字词、重复意象和同义堆叠，不要把相近词硬拼在一个标题里。',
    '6. 如果提供了已有章节名，默认视为避重参考；除非本章细纲确实强制要求，否则不要复用已有标题里的核心词和主意象。',
    '7. 如果提供了高频重复词/意象，默认禁止继续复用它们；只有当细纲核心悬念完全离不开该词时才允许保留。',
    '8. 如果细纲里有明确的核心物件、事件、场景或悬念，优先围绕它命名；如果没有，再围绕本章决定性冲突命名。',
    '9. 风格要像网文章名，但不要油滑，不要模板化套词。'
  ].join('\n');
}

function normalizeChapterTitleCandidate(title = '') {
  const extractTitleText = (value, depth = 0) => {
    if (depth > 4 || value === null || value === undefined) return '';
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          return extractTitleText(JSON.parse(trimmed), depth + 1) || trimmed;
        } catch (_) {}
      }
      return trimmed;
    }
    if (Array.isArray(value)) {
      return value.map((item) => extractTitleText(item, depth + 1)).find(Boolean) || '';
    }
    if (typeof value === 'object') {
      const preferredKeys = ['title', 'chapterTitle', 'chapter_title', 'chapterName', 'chapter_name', 'name', 'text', 'content', 'output'];
      for (const key of preferredKeys) {
        const extracted = extractTitleText(value[key], depth + 1);
        if (extracted) return extracted;
      }
      for (const nestedValue of Object.values(value)) {
        const extracted = extractTitleText(nestedValue, depth + 1);
        if (extracted && extracted !== 'text' && extracted !== 'output_text') return extracted;
      }
    }
    return '';
  };
  const candidate = extractTitleText(title);
  return normalizeText(candidate)
    .replace(/^第\s*\d+\s*章\s*/i, '')
    .replace(/\s+/g, '')
    .trim();
}

function collectTitleBigrams(title = '') {
  const normalized = normalizeChapterTitleCandidate(title);
  const result = new Set();
  for (let index = 0; index <= normalized.length - 2; index += 1) {
    result.add(normalized.slice(index, index + 2));
  }
  return result;
}

function inspectChapterTitleCandidate(candidate = '', recentTitles = [], avoidPhrases = []) {
  const normalizedCandidate = normalizeChapterTitleCandidate(candidate);
  if (!normalizedCandidate) {
    return { ok: false, reasons: ['标题为空'], normalizedCandidate };
  }

  const normalizedAvoidPhrases = Array.isArray(avoidPhrases)
    ? avoidPhrases.map((phrase) => normalizeChapterTitleCandidate(phrase)).filter(Boolean)
    : [];
  const hitAvoidPhrase = normalizedAvoidPhrases.find((phrase) => normalizedCandidate.includes(phrase));
  if (hitAvoidPhrase) {
    return { ok: false, reasons: [`命中禁用高频词“${hitAvoidPhrase}”`], normalizedCandidate };
  }

  const normalizedRecentTitles = Array.isArray(recentTitles)
    ? recentTitles.map((title) => normalizeChapterTitleCandidate(title)).filter(Boolean)
    : [];
  if (normalizedRecentTitles.includes(normalizedCandidate)) {
    return { ok: false, reasons: ['与已有章节名完全重复'], normalizedCandidate };
  }

  const candidateBigrams = collectTitleBigrams(normalizedCandidate);
  const overlapTitle = normalizedRecentTitles.find((title) => {
    if (!title || title === normalizedCandidate) return false;
    const titleBigrams = collectTitleBigrams(title);
    const overlapCount = [...candidateBigrams].filter((item) => titleBigrams.has(item)).length;
    return overlapCount >= 2 || (normalizedCandidate.length >= 4 && title.includes(normalizedCandidate));
  });
  if (overlapTitle) {
    return { ok: false, reasons: [`与已有标题“${overlapTitle}”重合过高`], normalizedCandidate };
  }

  return { ok: true, reasons: [], normalizedCandidate };
}

function buildChapterNameRetryPrompt(basePrompt, rejectedTitle, reasons = []) {
  return [
    basePrompt,
    '',
    `上一版候选标题：${normalizeChapterTitleCandidate(rejectedTitle) || '空标题'}`,
    `退回原因：${reasons.filter(Boolean).join('；') || '与限制冲突'}`,
    '重新生成时必须避开上一版标题及其核心意象，禁止再次输出同类词。'
  ].join('\n');
}

function buildOutlinePrompt({ genre, subgenre, bookTitle, chapterTitle, chapterNumber, characters, contextNotes, chapterStorylinePrompt }) {
  const typeInfo = subgenre ? genre + ' - ' + subgenre : genre;
  const isFirstChapter = Number(chapterNumber) === 1;
  return [
    '你是一位受严格约束的长篇网文章节策划师。你的任务是为当前一章制定可直接执行的章节细纲，不是续写正文，也不是扩写世界观。',
    '',
    '【信息优先级】',
    '章节细纲必须满足包含关系：章节细纲 ⊆ 当前剧情主线 ⊆ 当前分卷规划 ⊆ 全书规划。',
    '1. 先锁定“当前剧情主线”的本章节点，章节核心事件必须直接推进该节点。',
    '2. 当前剧情主线不得超出当前卷阶段目标、核心冲突和卷末状态。',
    '3. 当前分卷规划不得偏离全书主线；全书规划只校验方向，不能把远期事件塞进本章。',
    '4. 章节任务和上一章承接事项只能决定本章如何推进，不能替换或绕开当前剧情主线。',
    '不同信息冲突时必须服从更高优先级；没有明确依据的内容不得自行补设定。',
    '',
    '【当前章节】',
    '类型：' + typeInfo,
    '书名：' + (bookTitle || '未提供'),
    '章节：' + (chapterTitle || '未提供'),
    '当前正式角色名单（仅名称）：' + (characters || '暂无明确角色'),
    '角色名单是本章可用人物的唯一边界；历史摘要、旧正文或反馈中出现但不在名单内的人名，一律视为失效信息，不得写入细纲。',
    '角色出场连续性：前文从未出场、也没有铺垫的角色，不得直接承担关键功能（救人、点破真相、提供决定性情报或证据、扭转局势）；必须由前文已出场的角色完成，或在本章先写清自然引入方式（承接前文接触、他人提及后首次露面、自然遭遇且只承担次要功能）再逐步参与。',
    '',
    contextNotes ? '【背景事实与连续性】\n' + contextNotes : '',
    chapterStorylinePrompt ? '【本章剧情线硬约束】\n' + chapterStorylinePrompt : '【本章剧情线硬约束】\n暂无结构化剧情线，只围绕已给出的章节任务推进。',
    '',
    '【规划方法】',
    isFirstChapter
      ? '这是全书第 1 章：从全书或本卷设定的初始状态直接开篇，按“初始状态 → 触发事件 → 冲突推进 → 角色选择 → 产生明确结果 → 形成下一章承接”建立因果链。严禁声称存在上一章、前文或前情。'
      : '先确定本章唯一核心目标，再按“承接上章 → 触发事件 → 冲突推进 → 角色选择 → 产生明确结果 → 形成下一章承接”建立因果链。',
    '每个剧情节点必须由上一个节点的结果触发，并产生一个可验证的新结果；删除任何不影响本章目标的闲笔、背景介绍和无关支线。',
    '本章通常只重点推进 1 条主线；关联线只有在直接影响主线因果时才能出现，不要求平均照顾所有剧情线。',
    '【本章事件容量】',
    '一章正文目标字数约 3000 有效字，只允许安排 2-3 个关键事件节点，最多不超过 4 个；一个关键事件节点是“有开始、有过程、有明确结果”的完整事件（如“破解密信”“当场抓获”），不能靠并列动词把多个事件堆成一条长链。',
    '每个关键事件节点按正文 600-900 字估算容量：如果某个事件完整展开需要超过一章的可用篇幅，就必须拆到下一章，不能压缩进本章。',
    '细纲只规划本章能完成的事件链；放不下的节点必须拆到下一章，并在细纲中明确写出“本章停在哪里、下一章承接什么”。禁止把“触发→调查→破解→抓捕→善后”这类完整大闭环全部塞进一章。',
    '如果剧情要求推进的事件超过 4 个，必须把部分事件明确标注为下一章承接，而不是压缩进本章。',
    '细纲正文必须控制在 220-400 字；超过 400 字视为不合格，需要删减事件或拆分到下一章。',
    '',
    '【输出要求】',
    '只输出一段连贯的章节剧情摘要，不要标题、编号、列表、字段名、前言或解释。',
    isFirstChapter
      ? '按实际发生顺序写清：初始状态如何建立、触发什么事件、人物为何行动、冲突如何逐步升级、关键选择造成什么结果，以及本章最终停在哪里。'
      : '按实际发生顺序写清：如何承接前文、触发什么事件、人物为何行动、冲突如何逐步升级、关键选择造成什么结果，以及本章最终停在哪里。',
    '保持在剧情规划层：只写事件节点、行动目的、关键选择、信息变化和事件结果，不设计正文的具体表达。',
    '人物动机只需说明“为何作出选择”，不要描写思考过程、情绪感受或内心独白；地点只在影响事件成立时简短交代。',
    '摘要要足以指导正文作者从头到尾完成本章，但必须给正文创作保留对白、氛围、动作过程、心理活动和描写空间。',
    '关键事件节点控制在 2-3 个（最多 4 个）；超过的事件必须明确拆到下一章，并在摘要末尾写明本章停点与下章承接内容。',
    '输出前自检：逐句数一遍本章实际展开的关键事件，如果超过 3 个，删除靠后的节点、只保留一句下章承接。',
    '',
    '【质量禁区】',
    '1. 禁止引入上下文没有支持的新人物、新势力、新规则、新道具或新任务。',
    '1.1 禁止让前文从未出场且无铺垫的角色空降承担救人、点破真相、提供关键情报等关键功能；如需新角色出场，必须写明它是如何被引入的。',
    '2. 禁止提前完成后续章节、后续分卷才允许发生的事件。',
    '3. 禁止写任何直接或间接对白、对白意图示例、人物语气，以及可直接复制进正文的句子。',
    '4. 禁止让角色无动机地行动；关键选择必须能从已知目标、关系或压力中推出。',
    '5. 禁止环境氛围、感官细节、外貌神态、动作过程、心理活动、修辞和镜头语言；禁止用这些内容填充篇幅。',
    '6. 禁止重复事件或用不同说法堆叠同一信息；每句话都必须推动因果链。',
    '7. 输出控制在 220-400 字，语言简洁、客观、概括，不写创作建议。'
  ].filter(Boolean).join('\n');
}

async function auditGeneratedOutlineAgainstStorylineContext(outlineText, storylineContext = {}, chapterNumber = 0) {
  const persisted = buildPersistedStorylineContext(storylineContext);
  const mustAdvance = normalizeJsonArray(persisted.mustAdvance).map((item) => normalizeText(item)).filter(Boolean);
  const mustNotHappen = normalizeJsonArray(persisted.mustNotHappen).map((item) => normalizeText(item)).filter(Boolean);
  const isFirstChapter = Number(chapterNumber) === 1;
  if (mustAdvance.length === 0 && mustNotHappen.length === 0 && !isFirstChapter) {
    return { status: 'not_applicable', missingSetup: [], triggeredForbidden: [], summary: '' };
  }

  const auditPrompt = [
    '你是章节细纲约束审校员。只判断细纲是否完成本章要求，以及是否提前兑现未来剧情。',
    '严格输出 JSON：{"status":"passed|needs_revision","missingSetup":[],"triggeredForbidden":[],"summary":""}',
    '判断规则：mustAdvance 缺失则放入 missingSetup；mustNotHappen 已经实际发生或完成则放入 triggeredForbidden；仅提及问题或线索不等于提前完成。',
    'mustAdvance 只包含本章正式剧情线节点；未列入 mustAdvance 的剧情线人物（如感情线女主）不要求在本章出场，不得因为某人物未出现而判定缺失。',
    '冲突规则：mustNotHappen 的优先级高于 mustAdvance；如果某个 mustAdvance 会导致未来正式节点或禁止项提前发生，不得要求补写该 mustAdvance，也不得将其列为缺失。',
    isFirstChapter ? '第一章规则：不得出现“承接上一章”“承接上章”“承接前文”“延续前情”等声称已有前置章节的内容；命中时列入 triggeredForbidden。' : '',
    '',
    `mustAdvance：${JSON.stringify(mustAdvance)}`,
    `mustNotHappen：${JSON.stringify(mustNotHappen)}`,
    '',
    `待审章节细纲：${normalizeText(outlineText)}`
  ].join('\n');
  const result = await runTextGeneration(auditPrompt, { temperature: 0.1, maxTokens: 500 });
  if (!result.success) {
    return { status: 'skipped', missingSetup: [], triggeredForbidden: [], summary: result.error || '细纲审校未执行' };
  }
  const parsed = tryParseJsonObject(result.content) || {};
  const missingSetup = normalizeJsonArray(parsed.missingSetup || parsed.missing_setup).map((item) => normalizeText(item)).filter(Boolean);
  const triggeredForbidden = normalizeJsonArray(parsed.triggeredForbidden || parsed.triggered_forbidden).map((item) => normalizeText(item)).filter(Boolean);
  if (isFirstChapter && /承接(?:上一章|上章|前文)|延续前情/.test(normalizeText(outlineText))) {
    triggeredForbidden.push('第1章不得声称承接上一章、前文或前情');
  }
  return {
    status: missingSetup.length > 0 || triggeredForbidden.length > 0 ? 'needs_revision' : 'passed',
    missingSetup,
    triggeredForbidden: [...new Set(triggeredForbidden)],
    summary: normalizeText(parsed.summary || '')
  };
}

/**
 * 章节细纲事件容量审校：判断细纲是否超出单章可承载的关键事件节点数。
 * 一章正文目标约 3000 有效字，通常只能完成 2-4 个关键事件节点；
 * 超过 4 个且无法自然拆到后续章节时，判定为 overloaded 并给出建议后移的节点。
 */
async function auditOutlineEventDensity(outlineText) {
  const normalized = normalizeText(outlineText);
  if (!normalized) {
    return { status: 'ok', eventCount: 0, suggestedCarryover: [], note: '细纲为空' };
  }
  const prompt = [
    '你是章节细纲容量审校员。只判断一段章节细纲是否超出单章事件容量，不修改内容。',
    '严格输出 JSON：{"status":"ok|overloaded","eventCount":0,"suggestedCarryover":[],"note":""}',
    '容量标准：本章正文目标约 3000 有效字，一章通常只能完成 2-4 个关键事件节点。',
    '一个关键事件节点 = 有过程、有明确结果的完整事件（“破解密信”“当场抓获”“识破身份”各算一个节点）；背景交代、环境铺垫、人物状态描写不算节点；同一事件的连续动作只算一个节点。',
    '如果细纲中必须在本章完成的关键事件节点超过 4 个，status 为 overloaded；suggestedCarryover 列出按剧情顺序应拆到下一章的事件；note 用一句话说明超载原因。',
    '细纲正文超过 400 字同样视为 overloaded（note 说明“字数超限”），因为过长细纲通常代表事件过多或描写过细，正文容量不足。',
    '如果关键事件节点在 4 个以内，或超出部分可以自然拆到后续章节，status 为 ok。',
    '细纲结尾“本章停点/下一章承接”部分提到的未来事件属于下一章，不计入本章 eventCount。',
    '',
    `待审章节细纲：${normalized}`
  ].join('\n');
  const result = await runTextGeneration(prompt, { temperature: 0.1, maxTokens: 700 });
  if (!result.success) {
    return { status: 'ok', eventCount: 0, suggestedCarryover: [], note: result.error || '密度审校未执行' };
  }
  const parsed = tryParseJsonObject(result.content) || {};
  return {
    status: normalizeText(parsed.status || '') === 'overloaded' ? 'overloaded' : 'ok',
    eventCount: Number.parseInt(parsed.eventCount ?? parsed.event_count, 10) || 0,
    suggestedCarryover: normalizeJsonArray(parsed.suggestedCarryover || parsed.suggested_carryover)
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 5),
    note: normalizeText(parsed.note || '')
  };
}

/**
 * 收集某一章之前已经实际出场过的角色名：
 * - 前文正文中出现的角色库角色
 * - 前文章节规划里挂接的出场角色 / 角色执行条目
 */
async function collectPriorRoleContext(bookId, chapterNumber) {
  const current = Number(chapterNumber || 0);
  const libraryRoles = [];
  const priorRoles = [];
  if (!bookId || current <= 1) {
    return { libraryRoles, priorRoles };
  }
  const db = await dbPromise;
  try {
    const rows = execQuery(db, 'SELECT name FROM novel_characters WHERE book_id = ?', [bookId]);
    rows.forEach((row) => {
      const name = normalizeText(row.name);
      if (name) libraryRoles.push(name);
    });
  } catch (_) {}
  let priorChapterContents = [];
  try {
    priorChapterContents = execQuery(
      db,
      'SELECT content FROM chapters WHERE book_id = ? AND chapter_number < ? AND content IS NOT NULL',
      [bookId, current]
    );
  } catch (_) {}
  const foundPrior = new Set();
  libraryRoles.forEach((roleName) => {
    const matched = priorChapterContents.some((row) => String(row.content || '').includes(roleName));
    if (matched) foundPrior.add(roleName);
  });
  let priorPlans = [];
  try {
    priorPlans = execQuery(
      db,
      'SELECT appearing_roles, structured_content FROM chapter_plans WHERE book_id = ? AND chapter_number < ?',
      [bookId, current]
    );
  } catch (_) {}
  const addName = (name) => {
    const normalized = normalizeText(name);
    if (normalized) foundPrior.add(normalized);
  };
  priorPlans.forEach((plan) => {
    normalizeJsonArray(plan.appearing_roles).forEach(addName);
    const structured = parseStructuredContent(plan.structured_content);
    normalizeRoleExecutionList(structured.role_execution).forEach((item) => addName(item.role));
  });
  return { libraryRoles: [...new Set(libraryRoles)], priorRoles: [...foundPrior] };
}

/**
 * 章节细纲角色连续性审校：检查细纲是否让前文从未出场、没有铺垫的角色
 * 空降承担救人、点破真相、提供关键情报等关键功能。
 */
async function auditOutlineRoleContinuity(outlineText, priorRoles = [], libraryRoles = []) {
  const normalized = normalizeText(outlineText);
  if (!normalized) {
    return { status: 'ok', airdropRoles: [], suggestions: [], note: '细纲为空' };
  }
  const prompt = [
    '你是章节细纲角色连续性审校员。只判断细纲是否让前文从未出场、没有铺垫的角色空降承担关键功能，不修改内容。',
    '严格输出 JSON：{"status":"ok|needs_revision","airdropRoles":[],"suggestions":[],"note":""}',
    `前文已出场角色：${priorRoles.length > 0 ? priorRoles.join('、') : '（无）'}`,
    `角色库角色：${libraryRoles.length > 0 ? libraryRoles.join('、') : '（无）'}`,
    '关键功能 = 救人、点破真相、提供决定性情报/证据、给出结论、扭转局势等直接影响本章结果的功能。',
    '判定规则：',
    '1. 细纲中承担关键功能的角色，必须在前文已出场角色名单中；如果不在名单内，但细纲明确写清了自然引入方式（承接前文接触、他人提及后首次露面、自然遭遇且只承担次要功能），不算空降。',
    '2. 前文从未出场、细纲也没有引入交代，却直接承担救人、点破真相、提供关键情报等关键功能的角色，status 为 needs_revision；airdropRoles 列出这些角色；suggestions 给出处理建议（删除该角色改用已出场角色，或改为先写自然引入）。',
    '3. 主角、前文已出场的角色、仅作为背景提及（路过、被提到名字、未参与关键行动）不算空降。',
    '4. 角色库存在但前文从未出场，同样按前文未出场处理，不能因为角色库有设定就豁免。',
    '',
    `待审章节细纲：${normalized}`
  ].join('\n');
  const result = await runTextGeneration(prompt, { temperature: 0.1, maxTokens: 700 });
  if (!result.success) {
    return { status: 'ok', airdropRoles: [], suggestions: [], note: result.error || '角色连续性审校未执行' };
  }
  const parsed = tryParseJsonObject(result.content) || {};
  return {
    status: normalizeText(parsed.status || '') === 'needs_revision' ? 'needs_revision' : 'ok',
    airdropRoles: normalizeJsonArray(parsed.airdropRoles || parsed.airdrop_roles)
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 5),
    suggestions: normalizeJsonArray(parsed.suggestions)
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 4),
    note: normalizeText(parsed.note || '')
  };
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

function buildChapterOutlineBreakdownPrompt({
  outlineText = '',
  chapterTitle = '',
  bookTitle = '',
  characters = '',
  contextNotes = '',
  chapterStorylinePrompt = ''
} = {}) {
  return [
    '你是网文章节细纲编辑。请把用户输入的一段章节细纲整理成 3 个必需字段。',
    '你必须把全书设定、分卷大纲、剧情线约束、章节任务都视为客观事实。',
    '你的工作不是自由重写细纲，而是在不违背这些客观事实的前提下，把已有细纲整理成可编辑字段。',
    '',
    bookTitle ? `【书名】${bookTitle}` : '',
    chapterTitle ? `【章节】${chapterTitle}` : '',
    characters ? `【角色】\n${characters}` : '',
    contextNotes ? `【全书与章节上下文】\n${contextNotes}` : '',
    chapterStorylinePrompt ? `【剧情线约束】\n${chapterStorylinePrompt}` : '',
    '【用户输入的章节细纲】',
    normalizeText(outlineText),
    '',
    '【输出要求】',
    '只输出 JSON 对象，不要 Markdown，不要解释。',
    '字段必须是：',
    '{',
    '  "chapter_goal": "本章目标：一句话说明本章必须完成的剧情推进",',
    '  "key_scenes": "关键场景：按行列出 3-6 个有因果关系的场景节点，每个节点包含冲突、角色或局势结果及有效兑现",',
    '  "ending_hook": "章末结果与下章承接：说明章末局面、人物状态和下一章需要接续的问题"',
    '}',
    '',
    '约束：',
    '1. 不要新增用户没有暗示的大设定。',
    '2. 必须在不改变整体书籍设定、分卷大纲、人物关系和既有剧情线事实的前提下，让三个字段与章节名称形成一定呼应。',
    '3. 如果章节名称带有意象、事件或情绪倾向，要把它自然落到本章目标、关键场景或章末结果里；不要为了贴题硬造新设定。',
    '4. 可以补足表达，但不要替用户扩写成正文，也不要把剧情线尚未允许发生的事件提前写进字段。',
    '5. key_scenes 用换行分隔，不要输出数组。',
    '6. 三个字段必须保持同一条因果链，不得把上下文中的远期事件或无关支线重新塞回细纲。',
    '7. 每个字段都要尽量可直接用于生成正文。'
  ].filter(Boolean).join('\n');
}

function splitRevisionParagraphs(content) {
  return normalizeText(content)
    .split(/\n{2,}|\r?\n/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function buildRevisionSuggestionsPrompt(content, requirements, options = {}) {
  const paragraphs = splitRevisionParagraphs(content);
  const maxChangeCount = Math.min(Math.max(Number(options.maxChangeCount || 6) || 6, 3), 10);
  const numberedParagraphs = paragraphs
    .map((paragraph, index) => `【第 ${index + 1} 段】${paragraph}`)
    .join('\n\n');

  return [
    '你是网文正文逐段校改助手。你的任务不是泛泛点评，而是像代码 diff 一样给出可执行的段落级修改。',
    '你必须判断哪些段落要删除、哪些段落后要新增、哪些段落要修改，并输出结构化 JSON。',
    '',
    '【校改目标】',
    requirements || '增强画面感和爽点，保持原剧情不变。',
    '校改目标是用户的明确要求，优先级高于默认目标；若其中包含对具体细节（如金额、数字、人物性格表现）的修改要求，必须落实，不能因为“保持原剧情”而保留原文。',
    '',
    '【正文分段】',
    numberedParagraphs || content,
    '',
    '【输出 JSON】',
    '只输出 JSON 对象，不要 Markdown，不要解释。',
    '字段格式：',
    '{',
    '  "summary": "一句话说明本轮校改重点",',
    '  "suggestions": [',
    '    {',
    '      "id": "rev-001",',
    '      "action": "replace | insert_after | delete",',
    '      "paragraph": 1,',
    '      "afterParagraph": 1,',
    '      "category": "节奏 | 人物 | 逻辑 | 文风 | 画面 | 钩子",',
    '      "severity": "suggestion | important",',
    '      "original_text": "对应原文片段，insert_after 可为空",',
    '      "suggested_text": "建议替换/新增文本，delete 可为空",',
    '      "reason": "为什么这样改"',
    '    }',
    '  ]',
    '}',
    '',
    '约束：',
    '1. paragraph 必须对应上方段落编号。',
    `2. 必须返回 3-${maxChangeCount} 条段落级修改，除非正文为空或无法理解。`,
    '3. replace 的 suggested_text 必须是完整替换段落，不要只给点评。',
    '4. insert_after 的 suggested_text 必须是可直接插入的新段落。',
    '5. delete 的 suggested_text 留空，并在 reason 里说明删除原因。',
    '6. 不要改变主线剧情事实与既定设定，不要新增大设定；但用户在校改目标中明确要求修改的细节（如具体数字、金额、人物性格表现等）必须执行，不得以“保持原剧情”为由忽略用户要求。',
    '7. 如果原文整体可用，也要从画面、节奏、重复、钩子、人物动作里挑可微调处。',
    '8. 不要输出整章重写稿，只输出 suggestions。'
  ].join('\n');
}

function normalizeRevisionSuggestionItem(item, index, paragraphs) {
  const rawAction = normalizeText(item?.action || 'replace').toLowerCase();
  const actionMap = {
    modify: 'replace',
    update: 'replace',
    rewrite: 'replace',
    insert: 'insert_after',
    add: 'insert_after',
    remove: 'delete',
    修改: 'replace',
    改写: 'replace',
    替换: 'replace',
    新增: 'insert_after',
    增加: 'insert_after',
    插入: 'insert_after',
    删除: 'delete'
  };
  const action = ['replace', 'insert_after', 'delete'].includes(rawAction)
    ? rawAction
    : (actionMap[rawAction] || 'replace');
  const paragraph = Math.max(1, Number.parseInt(item?.paragraph || item?.afterParagraph || index + 1, 10) || index + 1);
  const afterParagraph = Math.max(1, Number.parseInt(item?.afterParagraph || paragraph, 10) || paragraph);
  const paragraphIndex = Math.min(Math.max(paragraph - 1, 0), Math.max(paragraphs.length - 1, 0));
  const fallbackOriginal = action === 'insert_after' ? '' : normalizeText(paragraphs[paragraphIndex] || '');
  const originalText = normalizeText(item?.original_text || item?.originalText || fallbackOriginal);
  const suggestedText = normalizeText(
    item?.suggested_text
    || item?.suggestedText
    || item?.suggestion
    || item?.new_text
    || item?.newText
    || item?.replacement
    || item?.revised_text
    || item?.revisedText
    || ''
  );

  return {
    id: normalizeText(item?.id || `rev-${String(index + 1).padStart(3, '0')}`),
    action,
    paragraph,
    afterParagraph,
    category: normalizeText(item?.category || '文风') || '文风',
    severity: normalizeText(item?.severity || 'suggestion') || 'suggestion',
    original_text: originalText,
    suggested_text: suggestedText,
    reason: normalizeText(item?.reason || item?.note || '')
  };
}

function normalizeRevisionSuggestionsResponse(rawContent, originalContent) {
  const paragraphs = splitRevisionParagraphs(originalContent);
  const parsed = tryParseJsonObject(rawContent);
  if (!parsed || typeof parsed !== 'object') {
    return {
      summary: '模型返回了非结构化校改内容。',
      suggestions: [],
      raw_content: normalizeText(rawContent)
    };
  }

  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions
      .map((item, index) => normalizeRevisionSuggestionItem(item, index, paragraphs))
      .filter((item) => item.action === 'delete' || item.suggested_text)
      .slice(0, 12)
    : [];

  return {
    summary: normalizeText(parsed.summary || parsed.regeneration_notes || ''),
    regeneration_notes: normalizeText(parsed.summary || parsed.regeneration_notes || ''),
    suggestions,
    raw_content: normalizeText(parsed.raw_content || '')
  };
}

function buildContinuePrompt(content, continueWordCount = DEFAULT_WORD_COUNT) {
  const bounds = getWordCountBounds(continueWordCount);
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
    `4. 目标字数为 ${continueWordCount} 有效字，允许范围 ${bounds.min}-${bounds.max} 有效字。`,
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
  model = '',
  temperature = 0.7,
  maxTokens = 2000,
  responseFormat = null,
  systemPrompt = ''
} = {}) {
  return deepseekService.generate({
    prompt,
    model,
    temperature,
    maxTokens,
    responseFormat,
    systemPrompt
  });
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
    const {
      genre = 'urban',
      subgenre,
      chapterNumber = '1',
      outlineText = '',
      outline_text = '',
      bookTitle = '',
      book_title = '',
      recentTitles = [],
      recent_titles = [],
      avoidPhrases = [],
      avoid_phrases = []
    } = req.body;
    const recentTitleList = Array.isArray(recentTitles) ? recentTitles : recent_titles;
    const avoidPhraseList = Array.isArray(avoidPhrases) ? avoidPhrases : avoid_phrases;
    const basePrompt = buildChapterNamePrompt({
      genre,
      subgenre,
      chapterNumber,
      outlineText: outlineText || outline_text || '',
      bookTitle: bookTitle || book_title || '',
      recentTitles: recentTitleList,
      avoidPhrases: avoidPhraseList
    });

    let finalResult = null;
    let lastInspection = { ok: false, reasons: ['未生成结果'] };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const prompt = attempt === 0
        ? basePrompt
        : buildChapterNameRetryPrompt(basePrompt, finalResult?.content || '', lastInspection.reasons);
      const result = await runTextGeneration(prompt, { temperature: 0.35, maxTokens: 48 });
      if (!result.success) {
        return res.status(result.statusCode || 500).json({ success: false, error: result.error });
      }
      finalResult = result;
      lastInspection = inspectChapterTitleCandidate(result.content, recentTitleList, avoidPhraseList);
      if (lastInspection.ok) break;
    }

    if (!finalResult) {
      return res.status(502).json({ success: false, error: '章节名生成失败：未返回结果。' });
    }

    if (!lastInspection.ok) {
      logger.warn('Chapter name generation fell back with duplicated candidate', {
        chapterNumber,
        candidate: normalizeChapterTitleCandidate(finalResult.content),
        reasons: lastInspection.reasons
      });
    }
    return res.json({
      success: true,
      data: {
        content: normalizeChapterTitleCandidate(finalResult.content),
        usage: finalResult.usage
      }
    });
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
      characters: requestedCharacters = '',
      contextNotes = '',
      bookId = '',
      chapterNumber
    } = req.body;
    let characters = normalizeText(requestedCharacters);
    let mergedContextNotes = contextNotes;
    let storylineContextMeta = {
      usedStorylineIds: [],
      usedBeatIds: [],
      usedVolumeTimeline: false,
      isFallback: true
    };

    if (normalizeText(bookId || '') && Number.parseInt(chapterNumber, 10)) {
      const ensuredPlan = await ensureChapterPlanForOutlineGeneration({
        bookId: normalizeText(bookId),
        chapterNumber: Number.parseInt(chapterNumber, 10),
        requestBody: req.body || {}
      });
      if (!normalizeText(ensuredPlan.chapterPlan?.main_storyline_id || '')) {
        return res.status(400).json({
          success: false,
          error: '当前章节没有可用的剧情主线，请先为当前分卷建立主线后再生成章节细纲。'
        });
      }
      const storedContext = await loadBookGenerationContext(
        normalizeText(bookId),
        Number.parseInt(chapterNumber, 10),
        { excludeCurrentOutline: true, forOutline: true }
      );
      mergedContextNotes = [storedContext.contextNotes, contextNotes].filter(Boolean).join('\n\n');
      characters = storedContext.outlineCharacters || '';
      storylineContextMeta = storedContext.chapterStorylineContext || storylineContextMeta;
    }

    const prompt = buildOutlinePrompt({
      genre,
      subgenre,
      bookTitle,
      chapterTitle,
      chapterNumber: Number.parseInt(chapterNumber, 10),
      characters,
      contextNotes: mergedContextNotes,
      chapterStorylinePrompt: storylineContextMeta?.promptText || ''
    });
    let result = await runTextGeneration(prompt, { temperature: 0.45, maxTokens: 1200 });
    if (!result.success) {
      return res.status(result.statusCode || 500).json({ success: false, error: result.error });
    }
    const roleContext = await collectPriorRoleContext(
      normalizeText(bookId),
      Number.parseInt(chapterNumber, 10)
    );
    let outlineAudit = await auditGeneratedOutlineAgainstStorylineContext(result.content, storylineContextMeta, chapterNumber);
    let outlineDensity = await auditOutlineEventDensity(result.content);
    let outlineRoleAudit = await auditOutlineRoleContinuity(
      result.content,
      roleContext.priorRoles,
      roleContext.libraryRoles
    );
    let lastOutlineContent = result.content;
    let outlineRevisionRound = 0;
    const MAX_OUTLINE_REVISION_ROUNDS = 2;
    while (
      (outlineAudit.status === 'needs_revision' || outlineDensity.status === 'overloaded' || outlineRoleAudit.status === 'needs_revision')
      && outlineRevisionRound < MAX_OUTLINE_REVISION_ROUNDS
    ) {
      outlineRevisionRound += 1;
      const revisionReasons = [
        outlineAudit.status === 'needs_revision' && outlineAudit.missingSetup.length > 0
          ? `缺少铺垫：${outlineAudit.missingSetup.join('；')}`
          : '',
        outlineAudit.status === 'needs_revision' && outlineAudit.triggeredForbidden.length > 0
          ? `提前兑现：${outlineAudit.triggeredForbidden.join('；')}`
          : '',
        outlineDensity.status === 'overloaded'
          ? `本章事件过多（约 ${outlineDensity.eventCount || '?'} 个关键节点，单章容量 2-3 个）${outlineDensity.note ? `：${outlineDensity.note}` : ''}`
          : '',
        outlineDensity.status === 'overloaded' && outlineDensity.suggestedCarryover.length > 0
          ? `必须从本章细纲中移除的节点：${outlineDensity.suggestedCarryover.join('；')}`
          : '',
        outlineRoleAudit.status === 'needs_revision' && outlineRoleAudit.airdropRoles.length > 0
          ? `角色空降无铺垫：${outlineRoleAudit.airdropRoles.join('、')} 前文从未出场${outlineRoleAudit.note ? `（${outlineRoleAudit.note}）` : ''}`
          : '',
        outlineRoleAudit.status === 'needs_revision' && outlineRoleAudit.suggestions.length > 0
          ? `处理建议：${outlineRoleAudit.suggestions.join('；')}`
          : ''
      ].filter(Boolean);
      const correctionPrompt = [
        prompt,
        '',
        `【上一版细纲（第 ${outlineRevisionRound} 次修正）】`,
        lastOutlineContent,
        '',
        '【上一版细纲审校未通过，必须纠正】',
        ...revisionReasons,
        '重新输出完整章节细纲：只保留 2-3 个关键事件节点；上面列出的“必须移除”节点一律不得作为本章事件展开，只能压缩为结尾一句“本章停点/下一章承接”；空降角色必须删除或改为已出场角色，或写清自然引入方式；全文控制在 220-400 字；不要解释。'
      ].filter(Boolean).join('\n');
      const repairedResult = await runTextGeneration(correctionPrompt, { temperature: 0.35, maxTokens: 1200 });
      if (!repairedResult.success || !normalizeText(repairedResult.content)) break;
      lastOutlineContent = repairedResult.content;
      result = repairedResult;
      outlineAudit = await auditGeneratedOutlineAgainstStorylineContext(result.content, storylineContextMeta, chapterNumber);
      outlineDensity = await auditOutlineEventDensity(result.content);
      outlineRoleAudit = await auditOutlineRoleContinuity(
        result.content,
        roleContext.priorRoles,
        roleContext.libraryRoles
      );
    }
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
        content: normalizeText(result.content),
        usage: result.usage,
        outlineAudit,
        outlineDensity,
        outlineRoleAudit,
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

async function handleChapterOutlineBreakdown(req, res) {
  try {
    const outlineText = normalizeText(req.body.outlineText || req.body.outline_text || req.body.content || '');
    const chapterTitle = normalizeText(req.body.chapterTitle || req.body.chapter_title || '');
    const bookId = normalizeText(req.body.bookId || req.body.book_id || '');
    const chapterNumber = Number.parseInt(req.body.chapterNumber || req.body.chapter_number, 10);
    let bookTitle = normalizeText(req.body.bookTitle || req.body.book_title || '');
    let characters = normalizeText(req.body.characters || '');
    let mergedContextNotes = normalizeText(req.body.contextNotes || req.body.context_notes || '');
    let chapterStorylinePrompt = normalizeText(req.body.chapterStorylinePrompt || req.body.chapter_storyline_prompt || '');
    if (!outlineText) {
      return res.status(400).json({ success: false, error: '请先输入章节细纲。' });
    }

    if (bookId && chapterNumber) {
      const storedContext = await loadBookGenerationContext(bookId, chapterNumber, { excludeCurrentOutline: true, forOutline: true });
      bookTitle = bookTitle || storedContext.bookTitle || '';
      characters = [storedContext.storedCharacters, characters].filter(Boolean).join('\n\n');
      mergedContextNotes = [storedContext.contextNotes, mergedContextNotes].filter(Boolean).join('\n\n');
      chapterStorylinePrompt = chapterStorylinePrompt || storedContext.chapterStorylineContext?.promptText || '';
    }

    const result = await runTextGeneration(buildChapterOutlineBreakdownPrompt({
      outlineText,
      chapterTitle,
      bookTitle,
      characters,
      contextNotes: mergedContextNotes,
      chapterStorylinePrompt
    }), {
      temperature: 0.35,
      maxTokens: 900
    });
    if (!result.success) {
      return res.status(result.statusCode || 500).json({ success: false, error: result.error });
    }

    const parsed = tryParseJsonObject(result.content);
    if (!parsed || typeof parsed !== 'object') {
      return res.status(502).json({
        success: false,
        error: 'AI 拆解细纲失败：未返回可解析结构。'
      });
    }

    return res.json({
      success: true,
      data: {
        chapter_goal: normalizeText(parsed.chapter_goal || parsed.chapterGoal || ''),
        key_scenes: normalizeText(parsed.key_scenes || parsed.keyScenes || ''),
        ending_hook: normalizeText(parsed.ending_hook || parsed.endingHook || ''),
        raw_content: normalizeText(result.content),
        usage: result.usage
      }
    });
  } catch (error) {
    logger.error('Chapter outline breakdown failed', { error: error.message, stack: error.stack });
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
    const auditLedgerSnapshot = await loadContentAwareLedgerSnapshot({
      bookId,
      chapterNumber,
      content,
      baseSnapshot: storedContext.ledgerSnapshot
    });
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
      content,
      openForeshadows: storedContext.ledgerSnapshot?.foreshadowRows || []
    });

    const result = await runTextGeneration(prompt, {
      temperature: 0.35,
      maxTokens: 1800,
      responseFormat: { type: 'json_object' }
    });
    if (!result.success) {
      return res.status(result.statusCode || 500).json({ success: false, error: result.error || '反馈生成失败' });
    }

    let parsed = tryParseJsonObject(result.content);
    let feedbackJsonRecovered = false;
    if (!parsed) {
      const rawPreview = normalizeText(result.content || '').replace(/^\uFEFF/, '').trim();
      const parseErrorReason = getModelAuditParseErrorReason({
        finishReason: normalizeText(result.finishReason || '').toLowerCase(),
        rawPreview: rawPreview.slice(0, 1000)
      });

      logger.warn('Chapter feedback JSON parse failed, attempting recovery', {
        bookId,
        chapterNumber,
        parseErrorReason,
        finishReason: normalizeText(result.finishReason || '').toLowerCase() || null,
        rawPreview: rawPreview.slice(0, 1000) || null
      });

      const needsFullRetry = parseErrorReason === 'model_audit_output_truncated' || parseErrorReason === 'model_audit_json_incomplete';
      if (needsFullRetry) {
        const retryResult = await runTextGeneration(prompt, {
          temperature: 0.2,
          maxTokens: 2200,
          responseFormat: { type: 'json_object' }
        });
        if (retryResult.success) {
          parsed = tryParseJsonObject(retryResult.content);
          feedbackJsonRecovered = !!parsed;
        }
      }

      if (!parsed && rawPreview) {
        const repairResult = await runTextGeneration(buildChapterFeedbackRepairPrompt(rawPreview), {
          temperature: 0.1,
          maxTokens: 1800,
          responseFormat: { type: 'json_object' }
        });
        if (repairResult.success) {
          parsed = tryParseJsonObject(repairResult.content);
          feedbackJsonRecovered = !!parsed;
        }
      }

      if (!parsed) {
        return res.status(500).json({ success: false, error: '反馈解析失败' });
      }
    }

    const sanitizedCharacters = sanitizeFeedbackLedgerItems(parsed?.continuity_report?.new_characters, {
      content,
      chapterPlan,
      mainStoryline,
      targetStorylines
    });
    const sanitizedChapterCharacters = sanitizeFeedbackLedgerItems(parsed?.chapter_characters, {
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
    const availableHooks = storedContext.ledgerSnapshot?.foreshadowRows || [];
    const resolvedHooks = normalizeJsonArray(parsed?.resolved_hooks).map((item) => {
      const requestedKey = normalizeText(item?.foreshadow_key || item?.key || '');
      const requestedTitle = normalizeText(item?.title || '');
      const matched = availableHooks.find((hook) => normalizeText(hook.foreshadow_key) === requestedKey)
        || availableHooks.find((hook) => requestedTitle && normalizeText(hook.title) === requestedTitle);
      const evidence = normalizeText(item?.evidence || '');
      if (!matched || !evidence || !content.includes(evidence)) return null;
      return { foreshadow_key: matched.foreshadow_key, title: matched.title, evidence };
    }).filter(Boolean).slice(0, 12);

    let feedback = {
      chapter_summary: normalizeText(parsed.chapter_summary || ''),
      story_progress: normalizeText(parsed.story_progress || ''),
      character_progress: normalizeText(parsed.character_progress || ''),
      chapter_characters: sanitizedChapterCharacters.keptItems.slice(0, 12),
      open_hooks: normalizeText(parsed.open_hooks || ''),
      resolved_hooks: resolvedHooks,
      next_chapter_focus: normalizeText(parsed.next_chapter_focus || ''),
      continuity_report: {
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
      },
      updated_at: new Date().toISOString(),
      source: 'model_feedback'
    };

    const auditResult = await auditGeneratedContent({
      bookTitle: storedContext.bookTitle,
      chapterNumber,
      chapterTitle,
      content,
      chapterPlan,
      mainStoryline,
      targetStorylineLabels: targetStorylines,
      currentChapterSummary: feedback.chapter_summary,
      previousChapterSummary: normalizeText(storedContext.previousChapterFeedback?.chapter_summary || ''),
      previousChapterAuditText: sliceTextCap(storedContext.previousChapter?.content || '', 12000),
      previousChapterTail: sliceTextTail(storedContext.previousChapter?.content || '', 2000),
      ledgerSnapshot: auditLedgerSnapshot
    });

    delete auditResult.raw_model_output;
    feedback.continuity_report = mergeFeedbackContinuityReport(feedback.continuity_report, auditResult);

    let usedLocalFallback = false;
    let degradedReason = null;
    if (isLowConfidenceFeedback(feedback, content)) {
      feedback = buildFallbackChapterFeedback({
        content,
        chapterPlan,
        mainStoryline,
        targetStorylines
      });
      usedLocalFallback = true;
      degradedReason = 'low_confidence_feedback';
    }

    feedback.quality_check = buildQualityCheckFromAuditResult(
      auditResult,
      usedLocalFallback
        ? {
            status: 'degraded',
            source: 'local_fallback',
            degraded_reason: degradedReason,
            needs_human_review: true
          }
        : {}
    );

    const feedbackSaveResult = await saveChapterFeedback({ bookId, chapterNumber, feedback, content });
    return res.json({
      success: true,
      data: {
        feedback: feedbackSaveResult?.feedback || feedback,
        metadata: {
          feedbackGenerated: !usedLocalFallback,
          feedbackSaved: !!feedbackSaveResult,
          feedbackJsonRecovered,
          usedLocalFallback,
          feedbackSource: normalizeText((feedbackSaveResult?.feedback || feedback)?.source || ''),
          qualityCheckSaved: !!feedbackSaveResult?.feedback?.quality_check,
          qualityCheck: (feedbackSaveResult?.feedback || feedback)?.quality_check || null,
          degradedReason,
          storylineProgressUpdated: !!feedbackSaveResult?.storylineProgressUpdated,
          requiresStorylineReview: !!feedbackSaveResult?.requiresStorylineReview,
          storylineProgressError: normalizeText(feedbackSaveResult?.storylineProgressError || ''),
          storylineProgress: (feedbackSaveResult?.feedback || feedback)?.storyline_progress || null
        }
      }
    });
  } catch (error) {
    logger.error('Chapter feedback generation failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, error: '反馈生成失败' });
  }
}

async function prepareChapterContentGeneration(body = {}) {
  const requestGenerationSettings = body.generationSettings && typeof body.generationSettings === 'object'
    ? body.generationSettings
    : {};
  const planGenerationSettings = {
    ...((body.chapterPlan || {}).structured_content || {}).generation_settings,
    ...((body.chapterPlan || {}).generation_settings || {})
  };
  const mergedGenerationSettings = {
    ...planGenerationSettings,
    ...requestGenerationSettings
  };
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
    emotionIntensity = normalizePercentage(
      body.emotionIntensity ?? mergedGenerationSettings.emotionIntensity,
      70
    ),
    colloquialLevel = normalizePercentage(
      body.colloquialLevel ?? mergedGenerationSettings.colloquialLevel,
      80
    ),
    dialogueRatio = normalizePercentage(
      body.dialogueRatio ?? mergedGenerationSettings.dialogueRatio,
      30
    ),
    wordCount = clampWordCount(
      body.wordCount
      ?? mergedGenerationSettings.word_count
      ?? mergedGenerationSettings.wordCount
      ?? DEFAULT_WORD_COUNT
    ),
    addCliffhanger = normalizeBoolean(
      body.addCliffhanger ?? mergedGenerationSettings.addCliffhanger,
      true
    ),
    enhanceDialogue = normalizeBoolean(
      body.enhanceDialogue ?? mergedGenerationSettings.enhanceDialogue,
      true
    ),
    avoidAIFeel = normalizeBoolean(
      body.avoidAIFeel ?? mergedGenerationSettings.avoidAIFeel,
      true
    ),
    fastPace = normalizeBoolean(
      body.fastPace ?? mergedGenerationSettings.fastPace,
      false
    ),
    detailedDesc = normalizeBoolean(
      body.detailedDesc
      ?? mergedGenerationSettings.detailedDesc
      ?? mergedGenerationSettings.detailedDescription,
      false
    ),
    temperature = normalizeTemperature(
      body.temperature ?? mergedGenerationSettings.temperature,
      0.7
    ),
    customInstruction = normalizeText(
      body.custom_instruction
      || body.customInstruction
      || mergedGenerationSettings.custom_instruction
      || mergedGenerationSettings.customInstruction
      || ''
    ),
    model
  } = body;

  const chapterNumber = Number.parseInt(body.chapterNumber, 10);
  const storedContext = await loadBookGenerationContext(bookId, chapterNumber);
  let chapterPlan = storedContext.chapterPlan || {};
  const structuredContent = parseStructuredContent(chapterPlan.structured_content);
  const savedStorylineContext = parseStructuredContent(structuredContent.storyline_context);
  const liveStorylineContext = buildPersistedStorylineContext(storedContext.chapterStorylineContext || {});
  const savedUsedStorylineIds = normalizeJsonArray(savedStorylineContext.usedStorylineIds);
  const savedUsedBeatIds = normalizeJsonArray(savedStorylineContext.usedBeatIds);
  const liveUsedBeatIds = normalizeJsonArray(liveStorylineContext.usedBeatIds);
  const shouldRefreshStorylineContext =
    Object.keys(savedStorylineContext).length === 0
    || (savedUsedStorylineIds.length > 0 && savedUsedBeatIds.length === 0 && liveUsedBeatIds.length > 0);
  const rawStorylineContext = !shouldRefreshStorylineContext
    ? savedStorylineContext
    : liveStorylineContext;
  const storylineContext = {
    ...rawStorylineContext,
    mustAdvance: normalizeJsonArray(rawStorylineContext.mustAdvance)
      .map((item) => normalizeText(typeof item === 'string' ? item : item?.summary || item?.title || ''))
      .filter((item) => item.replace(/[，。！？、；：,.!?;:\s]/g, '').length >= 6),
    mustNotHappen: normalizeJsonArray(rawStorylineContext.mustNotHappen)
      .map((item) => normalizeText(typeof item === 'string' ? item : item?.summary || item?.title || ''))
      .filter((item) => item.replace(/[，。！？、；：,.!?;:\s]/g, '').length >= 6)
  };
  chapterPlan = {
    ...chapterPlan,
    structured_content: {
      ...structuredContent,
      storyline_context: storylineContext
    }
  };
  const draftStorylineConstraint = buildDraftStorylineConstraintText(storylineContext);
  const storylineContextChanged = JSON.stringify(savedStorylineContext) !== JSON.stringify(storylineContext);
  if (draftStorylineConstraint.applied && (shouldRefreshStorylineContext || storylineContextChanged)) {
    await saveChapterStorylineContext({
      bookId,
      chapterNumber,
      storylineContext: shouldRefreshStorylineContext
        ? (storedContext.chapterStorylineContext || {})
        : storylineContext
    });
  }
  const finalBookTitle = normalizeText(bookTitle) || storedContext.bookTitle;
  const finalCharacters = [storedContext.storedCharacters, normalizeText(characters)].filter(Boolean).join('\n\n');
  const briefText = buildGenerationBriefText(body.generationBrief);
  const requestedWordCount = Number(wordCount) || DEFAULT_WORD_COUNT;
  const requestedBounds = getWordCountBounds(requestedWordCount);
  const wordCountConstraint = `【字数约束】本章目标 ${requestedWordCount} 有效字，允许范围 ${requestedBounds.min}-${requestedBounds.max} 有效字。统计口径按统一有效字数口径：空格、换行、标点和符号不计入。可以略短，但不要为了铺陈额外扩写；接近上限时必须收束。`;
  let finalContextNotes = [storedContext.contextNotes, draftStorylineConstraint.text, wordCountConstraint, briefText].filter(Boolean).join('\n\n');
  const roleExecution = normalizeRoleExecutionList(
    body.chapterPlan?.role_execution
    || body.chapterPlan?.structured_content?.role_execution
    || chapterPlan?.structured_content?.role_execution
  );
  const finalOutline = normalizeText(outline)
    || normalizeText(chapterPlan.outline_text)
    || normalizeText(buildOutlineFromChapterPlan(chapterPlan));

  const qualityGateMode = normalizeText(
    body.qualityGateMode
    || body.quality_gate_mode
    || mergedGenerationSettings.qualityGateMode
    || mergedGenerationSettings.quality_gate_mode
    || 'strict'
  ).toLowerCase();
  const planQualityAudit = evaluateChapterPlanQuality({ chapterPlan, outline: finalOutline, chapterNumber });
  if (qualityGateMode !== 'off' && !planQualityAudit.can_generate) {
    const error = new Error(`章节规划质量门禁未通过：${planQualityAudit.issues.filter((item) => item.severity === 'block').map((item) => item.message).join('；')}`);
    error.statusCode = 422;
    error.planQualityAudit = planQualityAudit;
    throw error;
  }
  finalContextNotes = [
    finalContextNotes,
    `【本章可验收推进目标】\n${planQualityAudit.must_advance.map((item) => `- ${item}`).join('\n')}\n【禁止提前发生】\n${planQualityAudit.must_not_happen.map((item) => `- ${item}`).join('\n') || '- 无'}`
  ].filter(Boolean).join('\n\n');
  const previousReleaseAudit = evaluatePreviousChapterRelease({
    chapterNumber,
    previousChapter: storedContext.previousChapter,
    previousFeedback: storedContext.previousChapterFeedback
  });
  if (qualityGateMode !== 'off' && !previousReleaseAudit.can_continue) {
    const error = new Error(`上一章质量门禁未通过：${previousReleaseAudit.issues.map((item) => item.message).join('；')}`);
    error.statusCode = 409;
    error.previousReleaseAudit = previousReleaseAudit;
    throw error;
  }
  const autoQualityRepair = normalizeBoolean(
    body.autoQualityRepair
    ?? body.auto_quality_repair
    ?? mergedGenerationSettings.autoQualityRepair
    ?? mergedGenerationSettings.auto_quality_repair,
    true
  );

  // 中文正文的 token/有效字比例波动较大；预留约 25% 空间，避免在完整句处触顶却漏掉细纲后半段。
  const maxTokens = Math.min(
    WORD_COUNT_POLICY.revision.repair_max_tokens,
    Math.max(
      WORD_COUNT_POLICY.revision.repair_min_tokens,
      Math.ceil(requestedWordCount * WORD_COUNT_POLICY.revision.expansion_multiplier)
    )
  );
  const promptVersion = normalizeText(body.promptVersion || body.prompt_version) === 'chapter.v1'
    ? 'chapter.v1'
    : CHAPTER_PROMPT_VERSION;
  const promptParams = {
      bookTitle: finalBookTitle,
      genre,
      subgenre,
      platform,
      template,
      chapterTitle,
      chapterSummary: '',
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
      detailedDesc: detailedDesc || false,
      customInstruction
    };
  const prompt = promptVersion === 'chapter.v1'
    ? deepseekService.buildCreativePromptLegacy(promptParams)
    : deepseekService.buildCreativePrompt(promptParams);
  const systemPrompt = promptVersion === 'chapter.v1' ? '' : deepseekService.getCreativeSystemPrompt();

  const contextSnapshot = {
    schema_version: 1,
    book_contract_version: 1,
    volume_contract_version: 1,
    chapter_contract: {
      chapter_number: Number(chapterNumber || 0),
      chapter_title: normalizeText(chapterTitle),
      outline: truncate(finalOutline, 5000),
      mission: normalizeText(chapterPlan?.chapter_mission || ''),
      target_word_count: requestedWordCount,
      appearing_roles: normalizeJsonArray(chapterPlan?.appearing_roles),
      role_execution: roleExecution
    },
    recent_continuity: {
      previous_chapter_number: Number(storedContext?.previousChapter?.chapter_number || 0),
      previous_chapter_tail: truncateTail(storedContext?.previousChapter?.content || '', 1200),
      previous_feedback: storedContext?.previousChapterFeedback || null
    },
    relevant_character_states: storedContext?.ledgerSnapshot?.characterRows || [],
    relevant_foreshadowing: storedContext?.ledgerSnapshot?.foreshadowRows || [],
    retrieved_evidence: storedContext?.ledgerSnapshot?.continuityRows || [],
    relevant_storylines: storylineContext || {},
    generation_constraints: storedContext?.generationConstraints || {}
  };

  return {
    bookId,
    genre,
    chapterNumber,
    chapterTitle,
    model,
    finalBookTitle,
    finalContextNotes,
    finalCharacters,
      storedContext,
      chapterPlan,
      storylineContext,
      draftStorylineConstraint,
      requestedWordCount,
      generationTemperature: temperature,
      maxTokens,
    prompt,
    systemPrompt,
    promptVersion,
    contextSnapshot,
    qualityGateMode,
    planQualityAudit,
    previousReleaseAudit,
    autoQualityRepair
  };
}

async function handlePromptPreview(req, res) {
  try {
    const body = req.body || {};
    const bookId = normalizeText(body.bookId || '');
    const chapterNumber = Number.parseInt(body.chapterNumber, 10);

    if (!bookId || !chapterNumber) {
      return res.status(400).json({ success: false, error: 'bookId and chapterNumber are required' });
    }

    await ensureChapterPlanForOutlineGeneration({
      bookId,
      chapterNumber,
      requestBody: body
    });

    const previewTypes = Array.isArray(body.previewTypes) && body.previewTypes.length > 0
      ? body.previewTypes
      : ['chapter_name', 'outline', 'chapter_outline_breakdown', 'chapter', 'chapter_feedback'];
    const storedContext = await loadBookGenerationContext(bookId, chapterNumber);
    const outlineStoredContext = await loadBookGenerationContext(bookId, chapterNumber, { excludeCurrentOutline: true, forOutline: true });
    const chapterPlan = storedContext.chapterPlan || {};
    const effectiveBookTitle = normalizeText(body.bookTitle || body.book_title || '') || storedContext.bookTitle || '';
    const effectiveChapterTitle = normalizeText(body.chapterTitle || body.chapter_title || '')
      || normalizeText(body.chapterName || body.chapter_name || '')
      || normalizeText(chapterPlan.chapter_name || '')
      || `第 ${chapterNumber} 章`;
    const effectiveOutline = normalizeText(body.outlineText || body.outline_text || body.outline || '')
      || normalizeText(buildOutlineFromChapterPlan(chapterPlan));
    const effectiveCharacters = outlineStoredContext.outlineCharacters || '';
    const effectiveContextNotes = [
      storedContext.contextNotes,
      normalizeText(body.contextNotes || body.context_notes || '')
    ].filter(Boolean).join('\n\n');
    const effectiveOutlineContextNotes = [
      outlineStoredContext.contextNotes,
      normalizeText(body.contextNotes || body.context_notes || '')
    ].filter(Boolean).join('\n\n');
    const effectiveStorylinePrompt = normalizeText(
      body.chapterStorylinePrompt
      || body.chapter_storyline_prompt
      || storedContext.chapterStorylineContext?.promptText
      || ''
    );
    const recentTitles = Array.isArray(body.recentTitles)
      ? body.recentTitles
      : normalizeJsonArray(body.recent_titles);
    const avoidPhrases = Array.isArray(body.avoidPhrases)
      ? body.avoidPhrases
      : normalizeJsonArray(body.avoid_phrases);
    const entries = [];
    const requestedTypes = new Set(previewTypes.map((item) => normalizeText(item)).filter(Boolean));

    const pushEntry = (entry) => {
      entries.push({
        key: normalizeText(entry.key || ''),
        title: normalizeText(entry.title || ''),
        description: normalizeText(entry.description || ''),
        system_prompt: normalizeText(entry.systemPrompt || ''),
        prompt: normalizeText(entry.prompt || ''),
        status: normalizeText(entry.status || 'ready') || 'ready',
        reason: normalizeText(entry.reason || ''),
        meta: Array.isArray(entry.meta) ? entry.meta.map((item) => normalizeText(item)).filter(Boolean) : []
      });
    };

    if (requestedTypes.has('chapter_name')) {
      if (!effectiveOutline) {
        pushEntry({
          key: 'chapter_name',
          title: '章节名生成',
          description: '根据当前章节细纲提炼章节名。',
          status: 'empty',
          reason: '当前还没有可用章节细纲。'
        });
      } else {
        pushEntry({
          key: 'chapter_name',
          title: '章节名生成',
          description: '根据当前章节细纲提炼章节名。',
          prompt: buildChapterNamePrompt({
            genre: body.genre || 'urban',
            subgenre: body.subgenre || '',
            chapterNumber,
            outlineText: effectiveOutline,
            bookTitle: effectiveBookTitle,
            recentTitles,
            avoidPhrases
          }),
          meta: [
            `题材：${body.genre || 'urban'}`,
            recentTitles.length > 0 ? `历史标题：${recentTitles.length} 条` : '',
            avoidPhrases.length > 0 ? `禁复用短语：${avoidPhrases.join(' / ')}` : ''
          ]
        });
      }
    }

    if (requestedTypes.has('outline')) {
      pushEntry({
        key: 'outline',
        title: '章节细纲生成',
        description: '根据当前书籍设定、剧情线与章节上下文生成细纲。',
        prompt: buildOutlinePrompt({
          genre: body.genre || 'urban',
          subgenre: body.subgenre || '',
          bookTitle: effectiveBookTitle,
          chapterTitle: effectiveChapterTitle,
          chapterNumber,
          characters: effectiveCharacters,
          contextNotes: effectiveOutlineContextNotes,
          chapterStorylinePrompt: effectiveStorylinePrompt
        }),
        meta: [
          `题材：${body.genre || 'urban'}`,
          effectiveStorylinePrompt ? '已挂接剧情线约束' : '当前无剧情线约束'
        ]
      });
    }

    if (requestedTypes.has('chapter_outline_breakdown')) {
      if (!effectiveOutline) {
        pushEntry({
          key: 'chapter_outline_breakdown',
          title: '细纲拆解',
          description: '把章节细纲拆成结构化字段。',
          status: 'empty',
          reason: '当前还没有可拆解的章节细纲。'
        });
      } else {
        pushEntry({
          key: 'chapter_outline_breakdown',
          title: '细纲拆解',
          description: '把章节细纲拆成结构化字段。',
          prompt: buildChapterOutlineBreakdownPrompt({
            outlineText: effectiveOutline,
            chapterTitle: effectiveChapterTitle,
            bookTitle: effectiveBookTitle,
            characters: effectiveCharacters,
            contextNotes: effectiveContextNotes,
            chapterStorylinePrompt: effectiveStorylinePrompt
          }),
          meta: ['结构化拆解', '输出 JSON']
        });
      }
    }

    if (requestedTypes.has('chapter')) {
      try {
        const prepared = await prepareChapterContentGeneration(body);
        pushEntry({
          key: 'chapter',
          title: '正文生成',
          description: '根据当前章节细纲与控制参数生成正文。',
          systemPrompt: prepared.systemPrompt,
          prompt: prepared.prompt,
          meta: [
            `Prompt：${prepared.promptVersion}`,
            `目标字数：${prepared.requestedWordCount}`,
            `temperature：${prepared.generationTemperature}`,
            `maxTokens：${prepared.maxTokens}`
          ]
        });
      } catch (error) {
        pushEntry({
          key: 'chapter',
          title: '正文生成',
          description: '根据当前章节细纲与控制参数生成正文。',
          status: 'error',
          reason: error.message || '当前正文生成 prompt 无法预览。'
        });
      }
    }

    if (requestedTypes.has('chapter_feedback')) {
      const content = normalizeText(body.content || body.generatedContent || '');
      if (!content) {
        pushEntry({
          key: 'chapter_feedback',
          title: '章节反馈',
          description: '根据当前正文和章节细纲生成反馈。',
          status: 'empty',
          reason: '当前还没有可供分析的正文内容。'
        });
      } else {
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

        pushEntry({
          key: 'chapter_feedback',
          title: '章节反馈',
          description: '根据当前正文和章节细纲生成反馈。',
          prompt: buildChapterFeedbackPrompt({
            bookTitle: storedContext.bookTitle,
            chapterNumber,
            chapterTitle: effectiveChapterTitle,
            outline: effectiveOutline || buildOutlineFromChapterPlan(chapterPlan),
            mission: normalizeText(chapterPlan.chapter_mission || ''),
            emotionTarget: normalizeText(chapterPlan.emotion_target || ''),
            mainStoryline,
            targetStorylines,
            content
          }),
          meta: [
            `正文长度：${countPlatformEffectiveWords(content)} 字`,
            mainStoryline ? `主推脉络：${mainStoryline}` : '',
            targetStorylines.length > 0 ? `关联脉络：${targetStorylines.join(' / ')}` : ''
          ]
        });
      }
    }

    return res.json({
      success: true,
      data: {
        entries,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Prompt preview failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, error: 'Prompt 预览失败' });
  }
}

async function handleChapterContentGeneration(req, res) {
  try {
    const prepared = await prepareChapterContentGeneration(req.body || {});
    const {
      bookId,
      genre,
      chapterNumber,
      chapterTitle,
      model,
      finalBookTitle,
      finalContextNotes,
      storedContext,
      chapterPlan,
      storylineContext,
      draftStorylineConstraint,
      requestedWordCount,
      generationTemperature,
      maxTokens,
      prompt,
      systemPrompt,
      promptVersion,
      contextSnapshot,
      qualityGateMode,
      planQualityAudit,
      previousReleaseAudit,
      autoQualityRepair
    } = prepared;
    const generationStartedAt = Date.now();
    const resolvedModel = resolveDeepSeekModel(model);

    logger.info('Starting content generation', {
      bookId: bookId || '',
      bookTitle: finalBookTitle || '',
      genre,
      chapterTitle: chapterTitle || 'Untitled chapter',
      hasStoredContext: !!finalContextNotes,
      hasStoredCharacters: !!storedContext.storedCharacters,
      targetWordCount: requestedWordCount,
      maxTokens
    });

    const result = await runTextGeneration(prompt, {
      model: resolvedModel,
      temperature: generationTemperature,
      maxTokens,
      systemPrompt
    });

    if (!result.success) {
      logger.error('Content generation failed', { error: result.error, statusCode: result.statusCode });
      return res.status(result.statusCode || 500).json({ success: false, error: result.error });
    }

    const endingRepair = await repairGeneratedEndingIfNeeded({
      content: result.content,
      finishReason: result.finishReason,
      chapterTitle,
      targetWordCount: requestedWordCount,
      model: resolvedModel
    });
    const wordCountEnforcement = await reviseGeneratedContentToWordCount({
      content: endingRepair.content,
      targetWordCount: requestedWordCount,
      chapterTitle,
      model: resolvedModel
    });
    let generatedContent = wordCountEnforcement.content;
    const truncationState = endingRepair.truncation;
    const auditLedgerSnapshot = await loadContentAwareLedgerSnapshot({
      bookId,
      chapterNumber,
      content: generatedContent,
      baseSnapshot: storedContext.ledgerSnapshot
    });
    const priorRoleContext = await collectPriorRoleContext(bookId, chapterNumber);
    const auditInput = {
      bookTitle: finalBookTitle,
      chapterNumber,
      chapterTitle,
      chapterPlan,
      mainStoryline: normalizeText(relatedStorylineTitleFromContext(storylineContext, true)),
      targetStorylineLabels: relatedStorylineTitlesFromContext(storylineContext),
      previousChapterSummary: normalizeText(storedContext.previousChapterFeedback?.chapter_summary || ''),
      previousChapterAuditText: sliceTextCap(storedContext.previousChapter?.content || '', 12000),
      previousChapterTail: sliceTextTail(storedContext.previousChapter?.content || '', 2000),
      ledgerSnapshot: auditLedgerSnapshot,
      priorRoles: priorRoleContext.priorRoles,
      deterministicConstraints: {
        targetWordCount: requestedWordCount,
        forbiddenPhrases: normalizeJsonArray(storylineContext?.mustNotHappen)
      }
    };
    let auditResult = await auditGeneratedContent({ ...auditInput, content: generatedContent });
    const qualityRepair = await runChapterQualityRepairLoop({
      content: generatedContent,
      audit: auditResult,
      auditInput,
      chapterPlan,
      chapterTitle,
      targetWordCount: requestedWordCount,
      model: resolveDeepSeekRepairModel(),
      enabled: autoQualityRepair
    });
    generatedContent = qualityRepair.content;
    auditResult = {
      ...qualityRepair.audit,
      repair_loop: {
        enabled: autoQualityRepair,
        applied: qualityRepair.applied,
        attempts: qualityRepair.attempts
      }
    };
    const generationRun = await recordGenerationRun({
      bookId,
      chapterNumber,
      promptType: 'chapter',
      promptVersion,
      promptText: `[system]\n${systemPrompt}\n\n[user]\n${prompt}`,
      contextSnapshot,
      model: result.model || resolvedModel,
      temperature: generationTemperature,
      maxTokens,
      rawOutput: result.content,
      finalOutput: generatedContent,
      finishReason: result.finishReason,
      usage: result.usage,
      durationMs: Date.now() - generationStartedAt,
      audit: auditResult
    });
    delete auditResult.raw_model_output;
    logger.info('Content generation succeeded', {
      model: result.model || resolvedModel,
      targetWordCount: requestedWordCount,
      actualLength: countPlatformEffectiveWords(generatedContent),
      rawCharacterLength: generatedContent.length,
      continuityRiskCount: auditResult.risks.length,
      finishReason: result.finishReason || '',
      needsContinuation: truncationState.needs_continuation
    });

    return res.json({
      success: true,
      data: {
        content: generatedContent,
        usage: result.usage,
        metadata: {
          model: result.model || resolvedModel,
          finishReason: result.finishReason || null,
          generationRun,
          qualityGateMode,
          planQualityAudit,
          previousReleaseAudit,
          qualityRepair: auditResult.repair_loop,
          qualityRepairUsage: qualityRepair.usage,
          timestamp: new Date().toISOString(),
          targetWordCount: requestedWordCount,
          maxTokens,
          actualLength: countPlatformEffectiveWords(generatedContent),
          rawCharacterLength: generatedContent.length,
          wordCountEnforcement: wordCountEnforcement.audit,
          endingRepair: endingRepair.repair,
          truncation: truncationState,
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
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Server error',
      ...(error.planQualityAudit ? { planQualityAudit: error.planQualityAudit } : {}),
      ...(error.previousReleaseAudit ? { previousReleaseAudit: error.previousReleaseAudit } : {})
    });
  }
}

function writeSseEvent(res, type, payload = {}) {
  res.write(`event: ${type}\n`);
  res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
}

async function handleChapterContentStream(req, res) {
  const abortController = new AbortController();
  const abortUpstream = () => {
    if (!abortController.signal.aborted) abortController.abort();
  };
  const handleResponseClose = () => {
    if (!res.writableEnded) abortUpstream();
  };
  req.once('aborted', abortUpstream);
  res.once('close', handleResponseClose);
  let prepared = null;
  try {
    prepared = await prepareChapterContentGeneration(req.body || {});
    if (abortController.signal.aborted) return;
    const {
      bookId,
      genre,
      chapterNumber,
      chapterTitle,
      model,
      finalBookTitle,
      finalContextNotes,
      storedContext,
      chapterPlan,
      storylineContext,
      draftStorylineConstraint,
      requestedWordCount,
      generationTemperature,
      maxTokens,
      prompt,
      systemPrompt,
      promptVersion,
      contextSnapshot,
      qualityGateMode,
      planQualityAudit,
      previousReleaseAudit,
      autoQualityRepair
    } = prepared;
    const generationStartedAt = Date.now();
    const resolvedModel = resolveDeepSeekModel(model);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    logger.info('Starting streaming content generation', {
      bookId: bookId || '',
      bookTitle: finalBookTitle || '',
      genre,
      chapterTitle: chapterTitle || 'Untitled chapter',
      hasStoredContext: !!finalContextNotes,
      hasStoredCharacters: !!storedContext.storedCharacters,
      targetWordCount: requestedWordCount,
      maxTokens
    });

    let generatedContent = '';
    let latestUsage = null;
    let latestFinishReason = null;
    for await (const event of deepseekService.generateStream({
      prompt,
      systemPrompt,
      model: resolvedModel,
      temperature: generationTemperature,
      maxTokens,
      signal: abortController.signal
    })) {
      if (abortController.signal.aborted || res.destroyed) return;
      if (event.type === 'delta') {
        generatedContent = String(event.fullContent || `${generatedContent}${event.content || ''}`);
        writeSseEvent(res, 'delta', {
          content: event.content,
        content_length: generatedContent.length,
        effective_word_count: countPlatformEffectiveWords(generatedContent)
        });
      }
      if (event.type === 'usage') {
        latestUsage = event.usage || latestUsage;
        latestFinishReason = event.finishReason || latestFinishReason;
        generatedContent = String(event.fullContent || generatedContent);
        writeSseEvent(res, 'usage', {
          usage: latestUsage,
          content_length: generatedContent.length
        });
      }
    }

    if (abortController.signal.aborted || res.destroyed) return;

    const rawGeneratedContent = generatedContent;
    const endingRepair = await repairGeneratedEndingIfNeeded({
      content: generatedContent,
      finishReason: latestFinishReason || '',
      chapterTitle,
      targetWordCount: requestedWordCount,
      model: resolvedModel
    });
    if (abortController.signal.aborted || res.destroyed) return;
    const wordCountEnforcement = await reviseGeneratedContentToWordCount({
      content: endingRepair.content,
      targetWordCount: requestedWordCount,
      chapterTitle,
      model: resolvedModel
    });
    if (abortController.signal.aborted || res.destroyed) return;
    generatedContent = wordCountEnforcement.content;
    const truncationState = endingRepair.truncation;
    const auditLedgerSnapshot = await loadContentAwareLedgerSnapshot({
      bookId,
      chapterNumber,
      content: generatedContent,
      baseSnapshot: storedContext.ledgerSnapshot
    });
    const priorRoleContext = await collectPriorRoleContext(bookId, chapterNumber);
    const auditInput = {
      bookTitle: finalBookTitle,
      chapterNumber,
      chapterTitle,
      chapterPlan,
      mainStoryline: normalizeText(relatedStorylineTitleFromContext(storylineContext, true)),
      targetStorylineLabels: relatedStorylineTitlesFromContext(storylineContext),
      previousChapterSummary: normalizeText(storedContext.previousChapterFeedback?.chapter_summary || ''),
      previousChapterAuditText: sliceTextCap(storedContext.previousChapter?.content || '', 12000),
      previousChapterTail: sliceTextTail(storedContext.previousChapter?.content || '', 2000),
      ledgerSnapshot: auditLedgerSnapshot,
      priorRoles: priorRoleContext.priorRoles,
      deterministicConstraints: {
        targetWordCount: requestedWordCount,
        forbiddenPhrases: normalizeJsonArray(storylineContext?.mustNotHappen)
      }
    };
    let auditResult = await auditGeneratedContent({ ...auditInput, content: generatedContent });
    const qualityRepair = await runChapterQualityRepairLoop({
      content: generatedContent,
      audit: auditResult,
      auditInput,
      chapterPlan,
      chapterTitle,
      targetWordCount: requestedWordCount,
      model: resolveDeepSeekRepairModel(),
      enabled: autoQualityRepair
    });
    generatedContent = qualityRepair.content;
    auditResult = {
      ...qualityRepair.audit,
      repair_loop: {
        enabled: autoQualityRepair,
        applied: qualityRepair.applied,
        attempts: qualityRepair.attempts
      }
    };
    if (abortController.signal.aborted || res.destroyed) return;

    const generationRun = await recordGenerationRun({
      bookId,
      chapterNumber,
      promptType: 'chapter',
      promptVersion,
      promptText: `[system]\n${systemPrompt}\n\n[user]\n${prompt}`,
      contextSnapshot,
      model: resolvedModel,
      temperature: generationTemperature,
      maxTokens,
      rawOutput: rawGeneratedContent,
      finalOutput: generatedContent,
      finishReason: latestFinishReason,
      usage: latestUsage,
      durationMs: Date.now() - generationStartedAt,
      audit: auditResult
    });

    delete auditResult.raw_model_output;
    writeSseEvent(res, 'audit', {
      audit: auditResult,
      content_length: generatedContent.length
    });

    writeSseEvent(res, 'done', {
      content: generatedContent,
      content_length: generatedContent.length,
      effective_word_count: countPlatformEffectiveWords(generatedContent),
      usage: latestUsage,
      metadata: {
        model: resolvedModel,
        generationRun,
        finishReason: latestFinishReason || null,
        qualityGateMode,
        planQualityAudit,
        previousReleaseAudit,
        qualityRepair: auditResult.repair_loop,
        qualityRepairUsage: qualityRepair.usage,
        timestamp: new Date().toISOString(),
        targetWordCount: requestedWordCount,
        maxTokens,
        actualLength: countPlatformEffectiveWords(generatedContent),
        rawCharacterLength: generatedContent.length,
        wordCountEnforcement: wordCountEnforcement.audit,
        endingRepair: endingRepair.repair,
        truncation: truncationState,
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
    });
    res.end();
  } catch (error) {
    if (abortController.signal.aborted || res.destroyed) {
      logger.info('Streaming content generation stopped by client');
      return;
    }
    logger.error('Streaming content generation failed', { error: error.message, stack: error.stack });
    if (!res.headersSent) {
      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || '流式生成失败',
        ...(error.planQualityAudit ? { planQualityAudit: error.planQualityAudit } : {}),
        ...(error.previousReleaseAudit ? { previousReleaseAudit: error.previousReleaseAudit } : {})
      });
    }
    writeSseEvent(res, 'error', { message: error.message || '流式生成失败' });
    res.end();
  } finally {
    req.removeListener('aborted', abortUpstream);
    res.removeListener('close', handleResponseClose);
  }
}

router.post('/generate/stream', handleChapterContentStream);
router.post('/generate/prompt-preview', handlePromptPreview);

router.post('/generate', async (req, res) => {
  const promptType = normalizeText(req.body.promptType || 'chapter') || 'chapter';
  if (promptType === 'book_title') return handleBookTitleGeneration(req, res);
  if (promptType === 'chapter_name') return handleChapterNameGeneration(req, res);
  if (promptType === 'outline') return handleOutlineGeneration(req, res);
  if (promptType === 'chapter_outline_breakdown') return handleChapterOutlineBreakdown(req, res);
  if (promptType === 'character_names') return handleCharacterNamesGeneration(req, res);
  if (promptType === 'character_profiles') return handleCharacterProfilesGeneration(req, res);
  if (promptType === 'full_outline') return handleFullOutlineGeneration(req, res);
  if (promptType === 'chapter_feedback') return handleChapterFeedbackGeneration(req, res);
  return handleChapterContentGeneration(req, res);
});

router.post('/polish', async (req, res) => {
  try {
    const content = normalizeText(req.body.content || '');
    const requirements = normalizeText(req.body.requirements || '');
    const options = {
      ...(req.body.options || {}),
      mode: req.body?.options?.mode || req.body.mode,
      maxChangeCount: req.body?.options?.maxChangeCount || req.body.maxChangeCount
    };
    if (!content) {
      return res.status(400).json({ success: false, error: 'Please provide the content to revise' });
    }

    const isRevisionSuggestionsMode = normalizeText(options.mode) === 'revision_suggestions';
    const prompt = isRevisionSuggestionsMode
      ? buildRevisionSuggestionsPrompt(content, requirements, options)
      : buildCleanPolishPrompt(content, requirements, options);
    const result = await runTextGeneration(prompt, {
      temperature: isRevisionSuggestionsMode ? 0.35 : 0.6,
      maxTokens: isRevisionSuggestionsMode ? 3200 : 4000
    });
    if (!result.success) {
      return res.status(result.statusCode || 500).json({ success: false, error: result.error });
    }

    if (isRevisionSuggestionsMode) {
      const revisionPayload = normalizeRevisionSuggestionsResponse(result.content, content);
      return res.json({
        success: true,
        data: {
          ...revisionPayload,
          usage: result.usage
        }
      });
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
    const wordCount = clampWordCount(req.body.wordCount);
    if (!content) {
      return res.status(400).json({ success: false, error: 'Please provide context content' });
    }

    const prompt = buildContinuePrompt(content.slice(-500), wordCount);
    const result = await runTextGeneration(prompt, {
      temperature: 0.7,
      maxTokens: Math.min(
        WORD_COUNT_POLICY.revision.repair_max_tokens,
        Math.max(
          WORD_COUNT_POLICY.revision.repair_min_tokens,
          Math.ceil(wordCount * WORD_COUNT_POLICY.revision.compression_multiplier)
        )
      )
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
