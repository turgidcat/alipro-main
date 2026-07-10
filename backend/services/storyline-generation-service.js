const deepseekService = require('./deepseek');
const {
  STORYLINE_OUTLINE_SYSTEM,
  VOLUME_TIMELINE_SYSTEM,
  STORYLINE_OUTLINE_SCHEMA,
  VOLUME_TIMELINE_SCHEMA,
  buildControlNote
} = require('./outline-prompts');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function safeParseJson(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function redactForDebug(text) {
  return String(text || '')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [REDACTED]')
    .replace(/(api[_-]?key|token|secret|authorization)\s*[:=]\s*["']?[^"'\n]+/gi, '$1: [REDACTED]')
    .slice(0, 500);
}

function tryExtractJson(raw) {
  const text = String(raw || '').trim();
  if (!text) {
    throw new Error('模型返回为空');
  }

  try {
    return JSON.parse(text);
  } catch (_) {}

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    const fenced = fenceMatch[1].trim();
    try {
      return JSON.parse(fenced);
    } catch (_) {}
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const maybeObject = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(maybeObject);
    } catch (_) {}
  }

  if (firstBrace >= 0) {
    const maybeBalancedObject = extractBalancedJsonObject(text, firstBrace);
    if (maybeBalancedObject) {
      try {
        return JSON.parse(maybeBalancedObject);
      } catch (_) {}
    }
  }

  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    const maybeArray = text.slice(firstBracket, lastBracket + 1);
    try {
      return JSON.parse(maybeArray);
    } catch (_) {}
  }

  throw new Error('未能从模型返回中提取有效 JSON');
}

function extractBalancedJsonObject(text, startIndex = 0) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth += 1;
      continue;
    }

    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, i + 1);
      }
    }
  }

  return null;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampInteger(value, min, max, fallback = min) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function ensureVolumeStorylineSetShape(parsed, context = {}) {
  const source = Array.isArray(parsed) ? parsed : ensureArray(parsed?.storylines || parsed?.items);
  const volumePlan = context.volumePlan || {};
  const totalChapters = computeExpectedSlotCount(context);
  const quota = clampInteger(volumePlan.storyline_quota || context.storylineQuota || 3, 1, 5, 3);
  const normalized = source.slice(0, quota).map((item, index) => {
    const name = normalizeText(item?.storyline_name || item?.storylineName || item?.name || item?.title || '');
    if (!name) return null;
    const startChapter = clampInteger(item?.start_chapter || item?.startChapter || 1, 1, totalChapters, 1);
    const endChapter = clampInteger(item?.end_chapter || item?.endChapter || totalChapters, startChapter, totalChapters, totalChapters);
    return {
      storyline_name: name,
      storyline_type: String(item?.storyline_type || item?.storylineType || item?.type || '').toLowerCase() === 'main' ? 'main' : 'branch',
      description: normalizeText(item?.description || item?.service_goal || item?.serviceGoal || item?.summary || ''),
      core_conflict: normalizeText(item?.core_conflict || item?.coreConflict || item?.dramatic_question || item?.dramaticQuestion || ''),
      involved_characters: ensureArray(item?.involved_characters || item?.involvedCharacters || item?.relatedCharacters)
        .map((value) => normalizeText(typeof value === 'string' ? value : value?.name || ''))
        .filter(Boolean)
        .slice(0, 8),
      start_chapter: startChapter,
      end_chapter: endChapter,
      key_nodes: ensureArray(item?.key_nodes || item?.keyNodes).slice(0, 8),
      structured_content: {
        serviceGoal: normalizeText(item?.service_goal || item?.serviceGoal || item?.description || ''),
        canCrossVolume: Boolean(item?.can_cross_volume || item?.canCrossVolume),
        closureExpectation: normalizeText(item?.closure_expectation || item?.closureExpectation || ''),
        template: normalizeText(item?.template || item?.template_type || ''),
        generatedFromVolumePlan: true
      },
      order: index + 1
    };
  }).filter(Boolean);

  if (normalized.length === 0) {
    throw new Error('剧情线集合 JSON 没有可保存的剧情线');
  }
  if (!normalized.some((item) => item.storyline_type === 'main')) {
    normalized[0].storyline_type = 'main';
  }
  return normalized;
}

function computeExpectedSlotCount(context = {}) {
  const volumePlan = context.volumePlan || {};
  const volumeOutline = context.volumeOutline || {};
  const volumeStructured = safeParseJson(volumePlan.structured_content, {}) || {};
  const estimated = Number(
    context.expectedSlotCount ||
    context.totalChapters ||
    volumePlan.estimated_chapters ||
    volumeStructured.totalChapters ||
    volumeOutline.totalChapters ||
    0
  ) || 0;
  if (estimated > 0) {
    return estimated;
  }

  const storylines = ensureArray(context.storylines || context.existingStorylines);
  const storyRangeEnd = storylines.reduce((max, item) => {
    const end = Number(item?.end_chapter || item?.endChapter || 0) || 0;
    return Math.max(max, end);
  }, 0);
  if (storyRangeEnd > 0) {
    return storyRangeEnd;
  }

  const chapterPlanCount = ensureArray(context.chapterPlans).length;
  if (chapterPlanCount > 0) {
    return chapterPlanCount;
  }

  return 12;
}

function collectValidTimelineBeatIds(context = {}) {
  const storylines = ensureArray(context.storylines || context.existingStorylines);
  return new Set(
    storylines.flatMap((item) => {
      const structured = safeParseJson(item?.structured_content, {});
      return ensureArray(structured?.keyBeats).map((beat) => normalizeText(beat?.beatId || beat?.beat_id || '')).filter(Boolean);
    })
  );
}

function ensureStorylineOutlineShape(parsed, context = {}) {
  const storyline = context.storyline || {};
  const existingStructured = safeParseJson(storyline.structured_content, {});
  const currentProgress = existingStructured?.progress_tracking || existingStructured?.currentProgress || {};
  const title = normalizeText(
    parsed.title || parsed.storylineName || parsed.storyline_title || storyline.storyline_name || ''
  );
  if (!title) {
    throw new Error('剧情线 JSON 缺少 title/storylineName');
  }

  const type = normalizeText(
    parsed.type || parsed.storylineType || storyline.storyline_type || 'branch'
  ) || 'branch';

  const summary = normalizeText(
    parsed.summary || parsed.coreConflict || parsed.core_conflict || storyline.description || storyline.core_conflict || ''
  );

  const dramaticQuestion = normalizeText(
    parsed.dramaticQuestion || parsed.theme_function || parsed.coreConflict || storyline.core_conflict || ''
  );

  const startState = normalizeText(
    parsed.startState || parsed.initialState || parsed.opening?.initialState || ''
  );

  const targetEndState = normalizeText(
    parsed.targetEndState || parsed.endCondition || parsed.climax?.resolution || ''
  );

  const developmentBeats = ensureArray(parsed.development).map((item, index) => ({
    beatId: normalizeText(item.beatId || item.beat_id || `dev-${index + 1}`),
    stage: 'development',
    chapterApprox: Number(item.chapterApprox || item.chapter || 0) || null,
    title: normalizeText(item.title || item.beat || `发展节点${index + 1}`),
    summary: normalizeText(item.summary || item.beat || ''),
    conflictLevel: Number(item.conflictLevel || item.conflict_level || 0) || null,
    keyInteraction: normalizeText(item.keyInteraction || item.key_interaction || ''),
    expectedChange: normalizeText(item.expectedChange || item.expected_change || '')
  }));

  const providedKeyBeats = ensureArray(parsed.keyBeats || parsed.key_beats).map((item, index) => ({
    beatId: normalizeText(item?.beatId || item?.beat_id || `beat-${index + 1}`),
    stage: normalizeText(item?.stage || 'development'),
    chapterApprox: Number(item?.chapterApprox || item?.chapter_approx || item?.chapter || 0) || null,
    title: normalizeText(item?.title || item?.objective || item?.summary || `剧情节点${index + 1}`),
    summary: normalizeText(item?.summary || item?.objective || item?.title || ''),
    conflictLevel: Number(item?.conflictLevel || item?.conflict_level || 0) || null,
    keyInteraction: normalizeText(item?.keyInteraction || item?.key_interaction || ''),
    expectedChange: normalizeText(item?.expectedChange || item?.expected_change || ''),
    mustInclude: ensureArray(item?.mustInclude || item?.must_include).map((entry) => normalizeText(entry)).filter(Boolean),
    mustAvoid: ensureArray(item?.mustNotHappen || item?.must_not_happen || item?.mustAvoid || item?.must_avoid).map((entry) => normalizeText(entry)).filter(Boolean)
  })).filter((item) => item.chapterApprox && item.chapterApprox >= Number(storyline.start_chapter || 1));

  const beats = [...providedKeyBeats];
  if (beats.length === 0 && (parsed.opening || startState)) {
    beats.push({
      beatId: normalizeText(parsed.opening?.beatId || parsed.opening?.beat_id || 'opening'),
      stage: 'opening',
      chapterApprox: Number(parsed.opening?.chapterApprox || parsed.opening?.chapter || storyline.start_chapter || 0) || null,
      title: normalizeText(parsed.opening?.title || parsed.opening?.hook || '开场钩子'),
      summary: normalizeText(parsed.opening?.hook || parsed.opening?.summary || ''),
      conflictLevel: Number(parsed.opening?.conflictLevel || 0) || null,
      keyInteraction: normalizeText(parsed.opening?.keyInteraction || ''),
      expectedChange: normalizeText(parsed.opening?.expectedChange || startState || '')
    });
  }
  if (beats.length === 0) beats.push(...developmentBeats);
  if (beats.length === 0 && (parsed.climax || targetEndState)) {
    beats.push({
      beatId: normalizeText(parsed.climax?.beatId || parsed.climax?.beat_id || 'climax'),
      stage: 'climax',
      chapterApprox: Number(parsed.climax?.chapterApprox || parsed.climax?.chapter || storyline.end_chapter || 0) || null,
      title: normalizeText(parsed.climax?.title || parsed.climax?.event || '高潮节点'),
      summary: normalizeText(parsed.climax?.event || parsed.climax?.summary || ''),
      conflictLevel: Number(parsed.climax?.conflictLevel || 0) || null,
      keyInteraction: normalizeText(parsed.climax?.keyInteraction || ''),
      expectedChange: normalizeText(parsed.climax?.resolution || targetEndState || '')
    });
  }

  const relatedCharacters = ensureArray(
    parsed.relatedCharacters || parsed.participants || parsed.involvedCharacters
  ).map((item) => {
    if (typeof item === 'string') {
      return { name: normalizeText(item) };
    }
    return {
      name: normalizeText(item?.name || item?.characterName || ''),
      role: normalizeText(item?.role || item?.role_in_line || item?.roleInLine || ''),
      motivation: normalizeText(item?.motivation || '')
    };
  }).filter((item) => item.name);

  const foreshadowingToPlant = ensureArray(
    parsed.foreshadowingToPlant || parsed.relatedForeshadowing || parsed.foreshadowing
  ).map((item) => {
    if (typeof item === 'string') {
      return { title: normalizeText(item) };
    }
    return {
      title: normalizeText(item?.title || item?.setup || ''),
      setupChapter: Number(item?.setupChapter || item?.chapterApprox || 0) || null,
      payoffChapter: Number(item?.payoffChapter || 0) || null,
      payoffHint: normalizeText(item?.payoffHint || '')
    };
  }).filter((item) => item.title);

  const payoffs = ensureArray(parsed.payoffs).map((item) => {
    if (typeof item === 'string') {
      return { title: normalizeText(item) };
    }
    return {
      title: normalizeText(item?.title || item?.name || ''),
      chapterApprox: Number(item?.chapterApprox || item?.chapter || 0) || null,
      result: normalizeText(item?.result || item?.resolution || '')
    };
  }).filter((item) => item.title);

  const isFallback = !summary || !dramaticQuestion || beats.length === 0;
  const planningWarnings = ensureArray(parsed.planningWarnings || parsed.planning_warnings)
    .map((item) => normalizeText(item))
    .filter(Boolean);

  return {
    title,
    type,
    summary,
    dramaticQuestion,
    startState,
    targetEndState,
    keyBeats: beats,
    relatedCharacters,
    foreshadowingToPlant,
    payoffs,
    planningWarnings,
    currentProgress,
    sourceContext: {
      bookId: context.bookId || '',
      volumeNumber: Number(context.volumeNumber || storyline.volume_number || 0) || null,
      chapterRange: {
        start: Number(storyline.start_chapter || 0) || null,
        end: Number(storyline.end_chapter || 0) || null
      },
      relatedStorylineCount: ensureArray(context.existingStorylines).length,
      chapterPlanCount: ensureArray(context.chapterPlans).length
    },
    isFallback
  };
}

function ensureVolumeTimelineShape(parsed, context = {}) {
  const volumePlan = context.volumePlan || {};
  const volumeOutline = context.volumeOutline || {};
  const expectedSlotCount = computeExpectedSlotCount(context);
  const validBeatIds = collectValidTimelineBeatIds(context);
  const volumeId = context.volumeId || context.volumeNumber || volumePlan.id || `volume-${context.volumeNumber || volumeOutline.volumeNumber || ''}`;
  const volumeTheme = normalizeText(
    parsed.volumeTheme || parsed.pacingDesign || volumePlan.volume_theme || volumeOutline.volumeTitle || ''
  );
  const startState = normalizeText(
    parsed.startState || volumePlan.start_role_state || volumeOutline.startState || ''
  );
  const endState = normalizeText(
    parsed.endState || volumePlan.end_role_state || volumeOutline.endState || ''
  );

  const stages = ensureArray(parsed.stages).map((item, index) => ({
    stage: normalizeText(item?.stage || item?.name || `stage-${index + 1}`),
    focus: normalizeText(item?.focus || item?.summary || ''),
    chapterRange: ensureArray(item?.chapterRange || item?.chapter_range).slice(0, 2),
    primaryStoryline: normalizeText(item?.primaryStoryline || item?.primary_storyline || '')
  }));

  const chapterSlots = ensureArray(parsed.chapterSlots || parsed.timeline).map((item, index) => ({
    chapter: Number(item?.chapter || item?.chapterNumber || index + 1) || index + 1,
    title: normalizeText(item?.title || item?.titleHint || ''),
    primaryStoryline: normalizeText(item?.primaryStoryline || item?.primary_storyline || ''),
    activeStorylines: ensureArray(item?.activeStorylines).map((line) => ({
      name: normalizeText(line?.name || ''),
      priority: normalizeText(line?.priority || ''),
      beat: normalizeText(line?.beat || ''),
      progressType: normalizeText(line?.progressType || line?.progress_type || '')
    })).filter((line) => line.name),
    atmosphere: normalizeText(item?.atmosphere || ''),
    pacingNote: normalizeText(item?.pacingNote || item?.pacing_note || ''),
    emotionPeak: Number(item?.emotionPeak || item?.emotion_peak || 0) || null,
    foreshadowOps: ensureArray(item?.foreshadowOps).filter(Boolean),
    stage: normalizeText(item?.stage || ''),
    focus: normalizeText(item?.focus || ''),
    relatedBeatIds: ensureArray(item?.relatedBeatIds || item?.related_beat_ids)
      .map((beatId) => normalizeText(beatId))
      .filter((beatId) => beatId && (validBeatIds.size === 0 || validBeatIds.has(beatId))),
    mustAdvance: ensureArray(item?.mustAdvance || item?.must_advance).map((entry) => normalizeText(entry)).filter(Boolean),
    mustNotHappen: ensureArray(item?.mustNotHappen || item?.must_not_happen).map((entry) => normalizeText(entry)).filter(Boolean)
  })).filter((item) => item.chapter > 0);

  const uniqueChapterSlots = Array.from(
    chapterSlots.reduce((map, item) => {
      if (!map.has(item.chapter)) {
        map.set(item.chapter, item);
      }
      return map;
    }, new Map()).values()
  ).sort((a, b) => a.chapter - b.chapter);

  const normalizedStages = stages.length > 0
    ? stages
    : buildStagesFromTimeline(uniqueChapterSlots);

  const normalizedChapterSlots = uniqueChapterSlots.map((item) => ({
    chapterNumber: item.chapter,
    stage: item.stage || stageNameForChapter(normalizedStages, item.chapter),
    focus: item.focus || item.title || item.pacingNote || '',
    relatedBeatIds: item.relatedBeatIds,
    mustAdvance: item.mustAdvance.length > 0
      ? item.mustAdvance
      : ensureArray(item.activeStorylines).map((line) => normalizeText(line.beat)).filter(Boolean),
    mustNotHappen: item.mustNotHappen
  }));

  const actualSlotCount = normalizedChapterSlots.length;
  const coverageWarning = expectedSlotCount > 0 && actualSlotCount < expectedSlotCount
    ? `chapterSlots 覆盖不足：期望 ${expectedSlotCount}，实际 ${actualSlotCount}`
    : '';
  const isFallback = !volumeTheme || actualSlotCount === 0;

  return {
    volumeId,
    volumeTheme,
    startState,
    endState,
    stages: normalizedStages,
    chapterSlots: normalizedChapterSlots,
    rhythmCheck: parsed.rhythmCheck || {},
    totalChapters: expectedSlotCount || Number(parsed.totalChapters || actualSlotCount || context.totalChapters || 0) || 0,
    expectedSlotCount,
    actualSlotCount,
    coverageWarning,
    requiresReview: !!coverageWarning,
    isFallback
  };
}

function buildStagesFromTimeline(chapterSlots = []) {
  if (!Array.isArray(chapterSlots) || chapterSlots.length === 0) {
    return [];
  }

  const total = chapterSlots.length;
  const boundaries = [
    { stage: 'opening', start: 1, end: Math.max(1, Math.ceil(total * 0.3)) },
    { stage: 'development', start: Math.max(2, Math.ceil(total * 0.3) + 1), end: Math.max(2, Math.ceil(total * 0.8)) },
    { stage: 'climax', start: Math.max(3, Math.ceil(total * 0.8) + 1), end: total }
  ].filter((item) => item.start <= item.end);

  return boundaries.map((item) => {
    const rangeSlots = chapterSlots.filter((slot) => slot.chapter >= item.start && slot.chapter <= item.end);
    return {
      stage: item.stage,
      focus: rangeSlots.map((slot) => slot.title || slot.primaryStoryline || slot.pacingNote).filter(Boolean).slice(0, 2).join('；'),
      chapterRange: [item.start, item.end],
      primaryStoryline: rangeSlots[0]?.primaryStoryline || ''
    };
  });
}

function stageNameForChapter(stages = [], chapterNumber = 0) {
  const chapter = Number(chapterNumber || 0);
  if (!chapter) return '';
  const matched = ensureArray(stages).find((stage) => {
    const range = ensureArray(stage.chapterRange);
    const start = Number(range[0] || 0);
    const end = Number(range[1] || 0);
    return start && end && chapter >= start && chapter <= end;
  });
  return normalizeText(matched?.stage || '');
}

function buildVolumeTimelineFallback(context = {}, reason = '', raw = '') {
  const volumePlan = context.volumePlan || {};
  const volumeOutline = context.volumeOutline || {};
  const expectedSlotCount = computeExpectedSlotCount(context);
  const volumeId = context.volumeId || context.volumeNumber || volumePlan.id || `volume-${context.volumeNumber || volumeOutline.volumeNumber || ''}`;
  return {
    volumeId,
    volumeTheme: normalizeText(volumePlan.volume_theme || volumeOutline.volumeTitle || ''),
    startState: normalizeText(volumePlan.start_role_state || volumeOutline.startState || ''),
    endState: normalizeText(volumePlan.end_role_state || volumeOutline.endState || ''),
    stages: [],
    chapterSlots: [],
    rhythmCheck: {},
    totalChapters: expectedSlotCount,
    expectedSlotCount,
    actualSlotCount: 0,
    coverageWarning: '',
    isFallback: true,
    parseError: normalizeText(reason || '未能从模型返回中提取有效 JSON'),
    requiresReview: true,
    rawPreview: redactForDebug(raw)
  };
}

function formatCharacters(characters = []) {
  return ensureArray(characters).map((item, index) => {
    if (!item) return '';
    const name = normalizeText(item.name || item.character_name || '');
    const parts = [
      name ? `${index + 1}. ${name}` : `${index + 1}. 未命名角色`,
      normalizeText(item.personality) ? `性格：${normalizeText(item.personality)}` : '',
      normalizeText(item.background) ? `背景：${normalizeText(item.background)}` : '',
      normalizeText(item.character_arc) ? `弧光：${normalizeText(item.character_arc)}` : '',
      normalizeText(item.notes) ? `补充：${normalizeText(item.notes)}` : ''
    ].filter(Boolean);
    return parts.join('；');
  }).filter(Boolean).join('\n');
}

function formatChapterPlans(chapterPlans = []) {
  return ensureArray(chapterPlans).slice(-10).map((item) => {
    const parts = [
      `第${Number(item.chapter_number || 0) || '?'}章`,
      normalizeText(item.chapter_name) || normalizeText(item.title) || '',
      normalizeText(item.chapter_mission) ? `任务：${normalizeText(item.chapter_mission)}` : '',
      normalizeText(item.summary) ? `摘要：${normalizeText(item.summary)}` : '',
      normalizeText(item.outline_text) ? `细纲：${normalizeText(item.outline_text)}` : '',
      normalizeText(item.ending_hook) ? `结尾钩子：${normalizeText(item.ending_hook)}` : ''
    ].filter(Boolean);
    return parts.join('｜');
  }).join('\n');
}

function formatChapterFeedback(chapterPlans = []) {
  return ensureArray(chapterPlans).slice(-8).map((item) => {
    const structured = safeParseJson(item.structured_content, {});
    const feedback = structured?.chapter_feedback || structured?.chapterFeedback || null;
    if (!feedback) return '';
    const chapterNumber = Number(item.chapter_number || 0) || '?';
    const parts = [
      `第${chapterNumber}章反馈`,
      normalizeText(feedback.chapter_summary) ? `本章结果：${normalizeText(feedback.chapter_summary)}` : '',
      normalizeText(feedback.story_progress) ? `剧情推进：${normalizeText(feedback.story_progress)}` : '',
      normalizeText(feedback.next_chapter_focus) ? `下章重点：${normalizeText(feedback.next_chapter_focus)}` : '',
      ensureArray(feedback.open_hooks).length > 0 ? `未闭合钩子：${ensureArray(feedback.open_hooks).join('；')}` : ''
    ].filter(Boolean);
    return parts.join('｜');
  }).filter(Boolean).join('\n');
}

function formatExistingStorylines(storylines = [], currentStorylineId = '') {
  return ensureArray(storylines).map((item) => {
    const structured = safeParseJson(item.structured_content, {});
    const beatCount = ensureArray(structured?.keyBeats || structured?.development || structured?.beats).length;
    const parts = [
      item.id === currentStorylineId ? '[当前目标线]' : '',
      normalizeText(item.storyline_name || item.title || ''),
      normalizeText(item.storyline_type || item.type) ? `类型：${normalizeText(item.storyline_type || item.type)}` : '',
      normalizeText(item.core_conflict || structured?.dramaticQuestion || '') ? `冲突：${normalizeText(item.core_conflict || structured?.dramaticQuestion || '')}` : '',
      beatCount ? `已存节点数：${beatCount}` : '',
      structured?.currentProgress ? `当前进度：${JSON.stringify(structured.currentProgress)}` : ''
    ].filter(Boolean);
    return parts.join('｜');
  }).filter(Boolean).join('\n');
}

function formatTimelineStorylines(storylines = []) {
  return ensureArray(storylines).map((item, index) => {
    const structured = safeParseJson(item.structured_content, {});
    const title = normalizeText(item.storyline_name || structured?.title || item.title || '');
    const summary = normalizeText(structured?.summary || item.description || item.core_conflict || structured?.dramaticQuestion || '');
    const keyBeats = ensureArray(structured?.keyBeats).map((beat, beatIndex) => {
      const beatId = normalizeText(beat?.beatId || beat?.beat_id || `beat-${beatIndex + 1}`);
      const beatTitle = normalizeText(beat?.title || beat?.summary || '');
      const beatSummary = normalizeText(beat?.summary || beat?.title || '');
      const chapterApprox = Number(
        beat?.chapterApprox || beat?.chapter_approx || beat?.suggestedChapter || beat?.targetChapter || beat?.chapterNumber || beat?.chapter || 0
      ) || null;
      return [
        `  - beatId: ${beatId}`,
        beatTitle ? `title: ${beatTitle}` : '',
        `chapterApprox: ${chapterApprox || 'null'}`,
        beatSummary ? `summary: ${beatSummary}` : ''
      ].filter(Boolean).join(' | ');
    });

    return [
      `${index + 1}. storylineId: ${item.id || ''}`,
      `title: ${title || '[缺失]'}`,
      normalizeText(item.storyline_type || structured?.type || '') ? `type: ${normalizeText(item.storyline_type || structured?.type || '')}` : '',
      summary ? `summary: ${summary}` : '',
      `chapterRange: ${Number(item.start_chapter || 0) || '?'}-${Number(item.end_chapter || 0) || '?'}`,
      'keyBeats:',
      keyBeats.length > 0 ? keyBeats.join('\n') : '  - [无 keyBeats]'
    ].filter(Boolean).join('\n');
  }).filter(Boolean).join('\n\n');
}

function formatForeshadowing(items = []) {
  return ensureArray(items).map((item) => {
    const title = normalizeText(item.title || item.setup || '');
    const desc = normalizeText(item.description || item.payoffHint || '');
    return title ? `- ${title}${desc ? `：${desc}` : ''}` : '';
  }).filter(Boolean).join('\n');
}

function buildStorylinePrompt(context) {
  const storyline = context.storyline || {};
  const bookPlan = context.bookPlan || {};
  const volumePlan = context.volumePlan || {};
  const bookOutline = context.bookOutline || {};
  const volumeOutline = context.volumeOutline || {};
  const controlNote = buildControlNote({
    chaptersPerStoryline: Math.max(1, Number(storyline.end_chapter || 0) - Number(storyline.start_chapter || 0) + 1)
  });

  const lines = [
    STORYLINE_OUTLINE_SYSTEM.replace('${controlNote}', controlNote),
    '',
    '【额外强约束】',
    '1. 你不是在整理字段，而是在设计这条剧情线在当前卷内的真实推进轨迹。',
    '2. 必须结合全书目标、本卷目标、角色弧光、已有章节进度和已有剧情线状态来生成新的节点。',
    '3. 严格输出 JSON，不要解释。',
    '4. 除了既有 schema，请额外补充以下顶层字段：title、type、summary、dramaticQuestion、startState、targetEndState、keyBeats、relatedCharacters、foreshadowingToPlant、payoffs、currentProgress、planningWarnings。',
    '5. keyBeat.chapterApprox 不得早于剧情线 start_chapter，也不得晚于 end_chapter。',
    '6. 每个 keyBeat 只描述该节点实际发生的核心事件与状态变化，不为开始章节之前的内容生成前置节点。',
    '',
    '【输出结构示例】',
    '{"title":"剧情线名称","type":"branch","summary":"剧情线摘要","dramaticQuestion":"核心问题","startState":"正式开始状态","targetEndState":"目标状态","keyBeats":[{"beatId":"opening","chapterApprox":4,"title":"正式节点","summary":"推进内容","expectedChange":"状态变化"}],"relatedCharacters":[],"foreshadowingToPlant":[],"payoffs":[],"currentProgress":{},"planningWarnings":[]}',
    '',
    `bookId: ${context.bookId || ''}`,
    `volumeId: ${context.volumeId || context.volumeNumber || ''}`,
    `目标剧情线ID: ${storyline.id || ''}`,
    '',
    '【当前生成目标】',
    normalizeText(context.userGoal || `为“${storyline.storyline_name || '未命名剧情线'}”生成当前卷内剧情线大纲 JSON`),
    '',
    '【全书规划】',
    `作品前提：${normalizeText(bookPlan.premise || bookOutline.summary || bookOutline.mainPlot || '') || '[缺失，fallback：仅使用旧全书大纲文本]'}`,
    `全书主目标：${normalizeText(bookPlan.main_goal || '') || '[缺失]'}`,
    `核心冲突：${normalizeText(bookPlan.core_conflict || bookOutline.mainPlot || '') || '[缺失]'}`,
    `世界规则：${normalizeText(bookPlan.world_rules || '') || '[缺失]'}`,
    `角色摘要：${normalizeText(bookPlan.role_summary || '') || '[缺失]'}`,
    `全书主线：${normalizeText(bookPlan.main_outline || bookOutline.mainPlot || '') || '[缺失]'}`,
    `全书详细推进：${normalizeText(bookPlan.detailed_outline || '') || '[缺失]'}`,
    '',
    '【分卷规划】',
    `卷号：${context.volumeNumber || storyline.volume_number || volumeOutline.volumeNumber || 1}`,
    `卷名：${normalizeText(volumePlan.volume_name || volumeOutline.volumeTitle || '') || '[缺失]'}`,
    `卷主题：${normalizeText(volumePlan.volume_theme || '') || '[缺失]'}`,
    `卷目标：${normalizeText(volumePlan.stage_goal || '') || '[缺失]'}`,
    `卷核心冲突：${normalizeText(volumePlan.core_conflict || volumeOutline.coreConflict || '') || '[缺失]'}`,
    `起始角色状态：${normalizeText(volumePlan.start_role_state || '') || '[缺失]'}`,
    `目标终局状态：${normalizeText(volumePlan.end_role_state || '') || '[缺失]'}`,
    `分卷旧大纲补充：${normalizeText(volumeOutline.coreConflict || '') || '[缺失]'}`,
    '',
    '【当前剧情线基础信息】',
    `名称：${normalizeText(storyline.storyline_name || '') || '[缺失]'}`,
    `类型：${normalizeText(storyline.storyline_type || 'branch')}`,
    `基础描述：${normalizeText(storyline.description || '') || '[缺失]'}`,
    `核心冲突：${normalizeText(storyline.core_conflict || '') || '[缺失]'}`,
    `章节范围：第${Number(storyline.start_chapter || 1)}章 - 第${Number(storyline.end_chapter || storyline.start_chapter || 1)}章`,
    `已有关键节点：${storyline.key_nodes || '[]'}`,
    '',
    '【主要角色】',
    formatCharacters(context.characters) || '[缺失，fallback：无角色资料]',
    '',
    '【已有剧情线】',
    formatExistingStorylines(context.existingStorylines, storyline.id) || '[缺失，fallback：无其他剧情线]',
    '',
    '【已有章节计划】',
    formatChapterPlans(context.chapterPlans) || '[缺失，fallback：无章节计划]',
    '',
    '【已有章节反馈】',
    formatChapterFeedback(context.chapterPlans) || '[缺失，fallback：暂无章节反馈]',
    '',
    '【待处理伏笔】',
    formatForeshadowing(context.pendingForeshadowing) || '[缺失，fallback：暂无待处理伏笔]'
  ];

  return lines.join('\n');
}

function buildVolumeStorylineSetPrompt(context) {
  const bookPlan = context.bookPlan || {};
  const volumePlan = context.volumePlan || {};
  const volumeOutline = context.volumeOutline || {};
  const totalChapters = computeExpectedSlotCount(context);
  const quota = clampInteger(volumePlan.storyline_quota || context.storylineQuota || 3, 1, 5, 3);
  return [
    '你是一名网文卷内剧情线策划编辑。请根据全书规划、分卷目标、核心冲突和角色状态，设计当前卷应存在的剧情线集合。',
    '严格输出一个 JSON 对象，不要解释，不要 Markdown。',
    `storylines 必须包含 ${quota} 条剧情线，其中至少 1 条 main，其余为 branch。`,
    `章节范围只能在 1-${totalChapters} 之间，允许多条线交叠，不要把章节切成互斥区间。`,
    '每条剧情线都必须服务本卷目标，不能生成与现有世界观和人物无关的孤立事件。',
    '',
    'JSON schema:',
    '{"storylines":[{"storyline_name":"名称","storyline_type":"main|branch","description":"服务目标和推进说明","core_conflict":"核心冲突","involved_characters":["角色名"],"start_chapter":1,"end_chapter":12,"key_nodes":["关键节点"],"can_cross_volume":false,"closure_expectation":"本卷收束预期","template":"贯穿型|阶段成长型|主题推进型|钩子伏笔型"}]}',
    '',
    '【全书规划】',
    `作品前提：${normalizeText(bookPlan.premise || '') || '[缺失]'}`,
    `全书主目标：${normalizeText(bookPlan.main_goal || '') || '[缺失]'}`,
    `全书核心冲突：${normalizeText(bookPlan.core_conflict || '') || '[缺失]'}`,
    `全书主线：${normalizeText(bookPlan.main_outline || '') || '[缺失]'}`,
    `角色摘要：${normalizeText(bookPlan.role_summary || '') || '[缺失]'}`,
    '',
    '【当前分卷】',
    `卷号：${context.volumeNumber || 1}`,
    `卷名：${normalizeText(volumePlan.volume_name || volumeOutline.volumeTitle || '') || '[缺失]'}`,
    `卷主题：${normalizeText(volumePlan.volume_theme || '') || '[缺失]'}`,
    `阶段目标：${normalizeText(volumePlan.stage_goal || '') || '[缺失]'}`,
    `核心冲突：${normalizeText(volumePlan.core_conflict || volumeOutline.coreConflict || '') || '[缺失]'}`,
    `卷初角色状态：${normalizeText(volumePlan.start_role_state || '') || '[缺失]'}`,
    `卷末角色状态：${normalizeText(volumePlan.end_role_state || '') || '[缺失]'}`,
    `预计章节数：${totalChapters}`,
    '',
    '【角色资料】',
    formatCharacters(context.characters) || '[缺失]',
    '',
    '【已有剧情线，避免重复】',
    formatExistingStorylines(context.existingStorylines) || '[无]',
    '',
    normalizeText(context.userGoal || '') ? `【用户补充要求】\n${normalizeText(context.userGoal)}` : ''
  ].filter(Boolean).join('\n');
}

function buildVolumeTimelinePrompt(context) {
  const bookPlan = context.bookPlan || {};
  const volumePlan = context.volumePlan || {};
  const bookOutline = context.bookOutline || {};
  const volumeOutline = context.volumeOutline || {};
  const totalChapters = computeExpectedSlotCount(context);
  const lines = [
    VOLUME_TIMELINE_SYSTEM,
    '',
    '【额外强约束】',
    '1. 你不是在写分析报告，而是在为本卷生成可落地的 chapterSlots。',
    '2. 优先保证 JSON 完整闭合，宁可字段少，也不要输出过长说明。',
    '3. 严格只输出一个 JSON 对象，不要解释，不要 Markdown，不要代码块，不要前言后记。',
    '4. 顶层只允许：volumeId、volumeTheme、stages、chapterSlots、isFallback。',
    `5. chapterSlots 必须生成 ${totalChapters} 个，覆盖 1 到 ${totalChapters} 的每一章。`,
    '6. relatedBeatIds 只能从下方 keyBeats 的 beatId 中选择，不允许编造不存在的 beatId。',
    '7. 如果某章没有对应 beat，可让 relatedBeatIds 为 []。',
    '8. 每个 focus 不超过 30 字；每章 mustAdvance 最多 2 条；每章 mustNotHappen 最多 2 条；每条不超过 30 字。',
    '9. 如果 stages 会显著拉长输出，可以只输出 3 个短阶段；不要输出 timeline、rhythmCheck 或其他重复结构。',
    '10. 不要只为关键 beat 生成 slot；没有 keyBeat 的普通推进章节也必须生成 slot。',
    '11. 每个 chapterNumber 必须唯一，且按本卷章节顺序连续生成。',
    '',
    `bookId: ${context.bookId || ''}`,
    `volumeId: ${context.volumeId || context.volumeNumber || ''}`,
    '',
    '【分卷规划】',
    `卷号：${context.volumeNumber || volumeOutline.volumeNumber || 1}`,
    `卷名：${normalizeText(volumePlan.volume_name || volumeOutline.volumeTitle || '') || '[缺失]'}`,
    `卷主题：${normalizeText(volumePlan.volume_theme || '') || '[缺失]'}`,
    `卷目标：${normalizeText(volumePlan.stage_goal || '') || '[缺失]'}`,
    `卷核心冲突：${normalizeText(volumePlan.core_conflict || volumeOutline.coreConflict || '') || '[缺失]'}`,
    `起始状态：${normalizeText(volumePlan.start_role_state || '') || '[缺失]'}`,
    `结束状态：${normalizeText(volumePlan.end_role_state || '') || '[缺失]'}`,
    `预计总章节：${totalChapters || '[缺失]'}`,
    '',
    '【本卷剧情线】',
    formatTimelineStorylines(context.storylines || []) || '[缺失，fallback：无剧情线]',
    '',
    '【本卷章节计划】',
    formatChapterPlans(context.chapterPlans) || '[缺失，fallback：无章节计划]',
    '',
    '【本卷章节反馈】',
    formatChapterFeedback(context.chapterPlans) || '[缺失，fallback：暂无章节反馈]'
  ];
  return lines.join('\n');
}

class StorylineGenerationService {
  parseStorylineOutlineResponse(raw, context = {}) {
    try {
      const parsed = tryExtractJson(raw);
      return {
        ok: true,
        data: ensureStorylineOutlineShape(parsed, context),
        rawPreview: redactForDebug(raw)
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
        rawPreview: redactForDebug(raw)
      };
    }
  }

  parseVolumeTimelineResponse(raw, context = {}) {
    try {
      const parsed = tryExtractJson(raw);
      return {
        ok: true,
        data: ensureVolumeTimelineShape(parsed, context),
        rawPreview: redactForDebug(raw)
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
        data: buildVolumeTimelineFallback(context, error.message, raw),
        rawPreview: redactForDebug(raw)
      };
    }
  }

  parseVolumeStorylineSetResponse(raw, context = {}) {
    try {
      const parsed = tryExtractJson(raw);
      return {
        ok: true,
        data: ensureVolumeStorylineSetShape(parsed, context),
        rawPreview: redactForDebug(raw)
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
        rawPreview: redactForDebug(raw)
      };
    }
  }

  async generateVolumeStorylineSet(context = {}) {
    const prompt = buildVolumeStorylineSetPrompt(context);
    const result = await deepseekService.generate({
      prompt,
      model: 'deepseek-v4-pro',
      temperature: 0.65,
      maxTokens: 2600,
      responseFormat: { type: 'json_object' }
    });
    if (!result.success) return result;

    const parsed = this.parseVolumeStorylineSetResponse(result.content, context);
    if (!parsed.ok) {
      return {
        success: false,
        error: `解析剧情线集合失败：${parsed.error}`,
        rawPreview: parsed.rawPreview,
        usage: result.usage || null
      };
    }
    return {
      success: true,
      content: result.content,
      usage: result.usage || null,
      prompt,
      parsed: parsed.data,
      rawPreview: parsed.rawPreview
    };
  }

  async generateStorylineOutline(context = {}) {
    const prompt = buildStorylinePrompt(context);
    const result = await deepseekService.generate({
      prompt,
      model: 'deepseek-v4-pro',
      temperature: 0.7,
      maxTokens: 3200,
      responseFormat: { type: 'json_object' }
    });
    if (!result.success) return result;

    const parsed = this.parseStorylineOutlineResponse(result.content, context);
    if (!parsed.ok) {
      return {
        success: false,
        error: `解析剧情线生成结果失败：${parsed.error}`,
        rawPreview: parsed.rawPreview,
        usage: result.usage || null
      };
    }

    return {
      success: true,
      content: result.content,
      usage: result.usage || null,
      prompt,
      parsed: parsed.data,
      rawPreview: parsed.rawPreview
    };
  }

  async generateVolumeTimeline(context = {}) {
    const prompt = buildVolumeTimelinePrompt(context);
    const result = await deepseekService.generate({
      prompt,
      model: 'deepseek-v4-pro',
      temperature: 0.65,
      maxTokens: 4500,
      responseFormat: { type: 'json_object' }
    });

    if (!result.success) {
      return result;
    }

    const parsed = this.parseVolumeTimelineResponse(result.content, context);
    if (!parsed.ok) {
      return {
        success: true,
        error: null,
        content: result.content,
        rawPreview: parsed.rawPreview,
        usage: result.usage || null,
        prompt,
        parsed: parsed.data,
        fallbackReason: parsed.error
      };
    }

    return {
      success: true,
      content: result.content,
      usage: result.usage || null,
      prompt,
      parsed: parsed.data,
      rawPreview: parsed.rawPreview
    };
  }

  getSchemas() {
    return {
      storyline: STORYLINE_OUTLINE_SCHEMA,
      volumeTimeline: VOLUME_TIMELINE_SCHEMA
    };
  }
}

module.exports = new StorylineGenerationService();
