import {
  emptyChapterStructure,
  ROLE_EXECUTION_DIMENSIONS,
  ROLE_EXECUTION_DIRECTIONS,
  ROLE_EXECUTION_SCOPES,
  ROLE_EXECUTION_CONFIDENCE,
  ROLE_DIMENSION_LABELS,
  ROLE_DIRECTION_LABELS,
  ROLE_SCOPE_LABELS,
  ROLE_CONFIDENCE_LABELS
} from './constants.js';

export function normalizeLines(text) {
  return String(text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function normalizeRoleName(role) {
  if (typeof role === 'string') return role.trim();
  if (!role || typeof role !== 'object') return '';
  return String(
    role.name
    || role.roleName
    || role.label
    || role.title
    || role.value
    || ''
  ).trim();
}

export function normalizeRoleList(roles) {
  if (!Array.isArray(roles)) return [];
  return roles.map(normalizeRoleName).filter(Boolean);
}

export function summarizeText(text, fallback = '') {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  return normalized || String(fallback || '').trim();
}

function stripNarrativeOutlineMarker(line = '') {
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

function ensureNarrativeSentenceEnding(text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) return '';
  if (/[。！？!?]$/.test(normalized)) return normalized;
  return `${normalized}。`;
}

export function normalizeNarrativeOutlineText(outlineText = '') {
  const raw = String(outlineText || '').replace(/\r/g, '').trim();
  if (!raw) return '';

  const looksLikeList = /(^|\s)(\d+[\.\)、]|[（(]?\d+[)）]|要点\s*\d+|第[一二三四五六七八九十百]+点|本章目标\s*[:：]|关键场景\s*[:：]|冲突升级\s*[:：]|角色变化\s*[:：]|读者爽点\s*[:：]|情绪落点\s*[:：]|结尾钩子\s*[:：])/m.test(raw);
  if (!looksLikeList) return raw;

  const prepared = raw
    .replace(/([。！？!?])\s*(?=(\d+[\.\)、]|[（(]?\d+[)）]|要点\s*\d+|第[一二三四五六七八九十百]+点))/g, '$1\n')
    .replace(/\s+(?=(\d+[\.\)、]|[（(]?\d+[)）]|要点\s*\d+|第[一二三四五六七八九十百]+点))/g, '\n');

  const fragments = prepared
    .split(/\n+/)
    .map(stripNarrativeOutlineMarker)
    .map((line) => line.replace(/[：:]\s*$/g, '').trim())
    .filter(Boolean)
    .flatMap((line) => line.split(/[;；]+/))
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/[，,；;。！？!?]+$/g, '').trim())
    .filter(Boolean);

  if (fragments.length === 0) return raw;

  return ensureNarrativeSentenceEnding(
    fragments
      .join('，')
      .replace(/，{2,}/g, '，')
      .replace(/。\s*，/g, '，')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export function getLatestChapterOutline(plan = {}) {
  const directOutline = normalizeNarrativeOutlineText(plan?.outline_text || '');
  if (directOutline) return directOutline;

  const snapshotOutline = normalizeNarrativeOutlineText(
    plan?.structured_content?.chapter_outline_snapshot?.outline_text
    || plan?.structuredContent?.chapter_outline_snapshot?.outline_text
    || ''
  );
  return snapshotOutline;
}

export function getGenerationChapterOutline(plan = {}) {
  const latestOutline = getLatestChapterOutline(plan);
  if (latestOutline) return latestOutline;

  const chapterStructure = plan?.chapter_structure || emptyChapterStructure;
  return composeStructuredOutline({
    chapter_goal: chapterStructure.chapter_goal || plan?.chapter_mission || '',
    key_scenes: chapterStructure.key_scenes || '',
    conflict_escalation: chapterStructure.conflict_escalation || '',
    character_change: chapterStructure.character_change || plan?.character_notes || '',
    reader_payoff: chapterStructure.reader_payoff || plan?.emotion_target || '',
    ending_hook: chapterStructure.ending_hook || plan?.ending_hook || ''
  }).trim();
}

export function buildOutlineExcerpt(outlineText = '', fallback = '尚未建立章节细纲') {
  const normalized = String(outlineText || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  const sentenceBreakIndex = normalized.search(/[。！？!?]/);
  if (sentenceBreakIndex === -1) return normalized;
  return normalized.slice(0, sentenceBreakIndex + 1).trim();
}

export function getOutlineSourceLabel(source) {
  const normalized = String(source || '').trim().toLowerCase();
  if (normalized === 'ai') return '系统生成';
  if (normalized === 'imported') return '导入';
  return '手动编辑';
}

export function buildConstraintBriefText(generationConstraints, overrides) {
  if (!generationConstraints || typeof generationConstraints !== 'object') return '';
  const lines = [];
  (Array.isArray(generationConstraints.blocked) ? generationConstraints.blocked : []).forEach((group, index) => {
    const key = `blocked-${group.label}-${index}`;
    const mode = overrides?.[key] || 'ban';
    if (mode === 'ban') return;
    const detail = group.rule || '';
    lines.push(`本章放开限制：${group.label}${detail ? `｜${detail}` : ''}`);
  });
  return lines.join('\n');
}

export function composeStructuredOutline(structure) {
  const sections = [
    ['本章目标', structure.chapter_goal],
    ['关键场景', structure.key_scenes],
    ['冲突升级', structure.conflict_escalation],
    ['角色变化', structure.character_change],
    ['读者爽点 / 情绪落点', structure.reader_payoff],
    ['结尾钩子', structure.ending_hook]
  ];

  return sections
    .map(([label, value]) => {
      const normalized = String(value || '').trim();
      return normalized ? `${label}\n${normalized}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

export function composeSceneOutlineText(sceneOutline) {
  if (!Array.isArray(sceneOutline) || sceneOutline.length === 0) return '';
  return sceneOutline
    .map((item, index) => {
      if (typeof item === 'string') {
        return item.trim();
      }
      if (item && typeof item === 'object') {
        const summary = String(item.summary || item.action || item.content || '').trim();
        return summary || '';
      }
      return '';
    })
    .filter(Boolean)
    .map((line, index) => `${index + 1}. ${line.replace(/^\d+\.\s*/, '')}`)
    .join('\n');
}

export function buildChapterStructureFromPlan(plan) {
  const structuredContent = plan.structuredContent || {};
  const saved = structuredContent.chapter_outline_structure || {};
  const outlineSnapshot = structuredContent.chapter_outline_snapshot || {};
  const sceneOutlineText = composeSceneOutlineText(plan.sceneOutline || outlineSnapshot.scene_outline || []);
  return {
    chapter_goal: saved.chapter_goal || plan.chapterMission || '',
    key_scenes: saved.key_scenes || sceneOutlineText || '',
    conflict_escalation: saved.conflict_escalation || '',
    character_change: saved.character_change || outlineSnapshot.character_notes || plan.characterNotes || '',
    reader_payoff: saved.reader_payoff || plan.emotionTarget || '',
    ending_hook: saved.ending_hook || outlineSnapshot.ending_hook || plan.endingHook || ''
  };
}

export function normalizeRoleExecution(roleExecution, appearingRoles = [], characterNotes = '', mission = '') {
  const raw = Array.isArray(roleExecution) ? roleExecution : [];
  const normalizeEnum = (value, allowed, fallback) => {
    const normalized = String(value || '').trim();
    return allowed.has(normalized) ? normalized : fallback;
  };
  const normalized = raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const role = String(item.role || '').trim();
      const baseline = String(item.baseline || '').trim();
      const chapterFunction = String(item.chapter_function || item.chapterFunction || '').trim();
      const allowedChange = String(item.allowed_change || item.allowedChange || '').trim();
      const forbiddenChange = String(item.forbidden_change || item.forbiddenChange || '').trim();
      const dimension = normalizeEnum(
        item.dimension || item.change_dimension || item.changeDimension,
        ROLE_EXECUTION_DIMENSIONS,
        'story_function'
      );
      const direction = normalizeEnum(
        item.direction || item.change_direction || item.changeDirection,
        ROLE_EXECUTION_DIRECTIONS,
        'hold'
      );
      const scope = normalizeEnum(
        item.scope || item.change_scope || item.changeScope,
        ROLE_EXECUTION_SCOPES,
        'temporary'
      );
      const confidence = normalizeEnum(item.confidence, ROLE_EXECUTION_CONFIDENCE, 'low');
      if (!role && !baseline && !chapterFunction && !allowedChange && !forbiddenChange) return null;
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
    })
    .filter(Boolean);

  if (normalized.length > 0) return normalized;

  return normalizeRoleList(appearingRoles).map((role) => ({
    role,
    baseline: String(characterNotes || '').trim() || '延续当前人物底色。',
    chapter_function: mission ? `围绕本章任务“${mission}”承担推进作用。` : '承担本章推进作用。',
    allowed_change: '只允许推进一步，不允许跨阶段突变。',
    forbidden_change: '不能直接完成长期关系翻转、立场逆转或真相彻底揭示。',
    dimension: 'story_function',
    direction: 'hold',
    scope: 'temporary',
    confidence: 'low'
  }));
}

export function describeRoleExecutionMeta(item) {
  const dimension = ROLE_DIMENSION_LABELS[item.dimension] || '剧情职责';
  const direction = ROLE_DIRECTION_LABELS[item.direction] || '保持当前底色';
  const scope = ROLE_SCOPE_LABELS[item.scope] || '本章表现';
  const confidence = ROLE_CONFIDENCE_LABELS[item.confidence] || '低';
  return `${dimension}｜${direction}｜${scope}｜把握度 ${confidence}`;
}

export function buildGenerationRiskReview(plan, generationConstraints, overrides = {}) {
  const blocked = Array.isArray(generationConstraints?.blocked) ? generationConstraints.blocked : [];
  const roleExecution = Array.isArray(plan?.role_execution) ? plan.role_execution : [];
  const allowedBlocked = blocked.filter((group, index) => {
    const key = `blocked-${group.label}-${index}`;
    return (overrides[key] || 'ban') === 'allow';
  });
  const stageRoles = roleExecution.filter((item) => item.scope === 'stage');
  const coreCandidateRoles = roleExecution.filter((item) => item.scope === 'core_candidate');
  const highConfidenceCoreCandidates = coreCandidateRoles.filter((item) => item.confidence === 'high' || item.confidence === 'medium');
  const items = [];

  if (allowedBlocked.length > 0) {
    items.push({
      level: 'critical',
      title: '你已手动放开禁止项',
      text: `当前放开的高风险项：${allowedBlocked.map((item) => item.label).join('、')}。这类内容最容易让本章直接引入未铺垫的大设定或偏离主线。`,
      action: '建议先回第二步把相关信息补进章节计划或剧情线，再决定是否放开。'
    });
  }

  if (highConfidenceCoreCandidates.length > 0) {
    items.push({
      level: 'warning',
      title: '本章触及底色候选变化',
      text: `这些角色被标成“底色候选”：${highConfidenceCoreCandidates.map((item) => item.role || '未命名角色').join('、')}。这类变化不应一章定性。`,
      action: '建议生成后重点复核这些角色，确认只是阶段表现还是已形成长期新常态。'
    });
  }

  if (stageRoles.length >= 3) {
    items.push({
      level: 'warning',
      title: '同章承载的角色阶段变化过多',
      text: `当前有 ${stageRoles.length} 个角色被标记为阶段变化，容易让一章内的人物推进过满、失去重点。`,
      action: '建议把阶段变化控制在 1 到 2 个核心角色，其余角色维持承接或辅助功能。'
    });
  }

  if (normalizeRoleList(plan?.appearing_roles).length > 0 && roleExecution.length === 0) {
    items.push({
      level: 'warning',
      title: '本章出场角色没有执行层',
      text: '角色名单已有，但还没有稳定的执行参数，模型更容易自由发挥人物作用。',
      action: '建议至少补齐关键角色的本章功能、允许变化和禁止变化。'
    });
  }

  const criticalCount = items.filter((item) => item.level === 'critical').length;
  const warningCount = items.filter((item) => item.level === 'warning').length;

  return {
    items,
    hasCritical: criticalCount > 0,
    criticalCount,
    warningCount
  };
}

export function getPlanWordCount(plan) {
  const saved = Number(
    plan?.structured_content?.generation_settings?.word_count
    || plan?.structuredContent?.generation_settings?.word_count
    || plan?.generation_settings?.word_count
    || 3000
  );
  return Number.isFinite(saved) ? Math.min(10000, Math.max(500, saved)) : 3000;
}

export function normalizeChapterStructureForSave(plan) {
  const currentStructure = plan?.chapter_structure || emptyChapterStructure;
  const sceneText = String(currentStructure.key_scenes || '').trim();
  const fallbackSceneText = composeSceneOutlineText(plan?.scene_outline || []);

  return {
    chapter_goal: String(currentStructure.chapter_goal || plan?.chapter_mission || '').trim(),
    key_scenes: sceneText || fallbackSceneText,
    conflict_escalation: String(currentStructure.conflict_escalation || '').trim(),
    character_change: String(currentStructure.character_change || plan?.character_notes || '').trim(),
    reader_payoff: String(currentStructure.reader_payoff || plan?.emotion_target || '').trim(),
    ending_hook: String(currentStructure.ending_hook || plan?.ending_hook || '').trim()
  };
}

export function prepareOutlineModalPlan(plan) {
  const normalizedStructure = normalizeChapterStructureForSave(plan);
  const normalizedSummary = String(plan?.summary || '').trim();
  const normalizedCharacterNotes = String(
    plan?.character_notes
    || normalizedStructure.character_change
    || ''
  ).trim();

  return withStructuredChapterPlan(
    {
      ...plan,
      summary: normalizedSummary,
      character_notes: normalizedCharacterNotes,
      ending_hook: normalizedStructure.ending_hook || plan?.ending_hook || ''
    },
    normalizedStructure
  );
}

export function buildLatestOutlinePlan(plan, outlineText, source = 'manual') {
  const normalizedOutline = normalizeNarrativeOutlineText(outlineText);
  const summary = buildOutlineExcerpt(normalizedOutline, '');
  const emptyStructure = { ...emptyChapterStructure };
  const previousStructuredContent = plan?.structured_content || {};
  const previousSnapshot = previousStructuredContent.chapter_outline_snapshot || {};

  return {
    ...plan,
    summary,
    outline_text: normalizedOutline,
    source,
    chapter_structure: emptyStructure,
    structured_content: {
      ...previousStructuredContent,
      chapter_outline_mode: 'single_latest',
      chapter_outline_structure: emptyStructure,
      chapter_outline_snapshot: {
        ...previousSnapshot,
        summary,
        outline_text: normalizedOutline,
        source,
        mode: 'single_latest'
      }
    }
  };
}

export function withStructuredChapterPlan(plan, structure) {
  const outlineText = composeStructuredOutline(structure);
  return {
    ...plan,
    summary: plan.summary || summarizeText(outlineText, structure.chapter_goal || ''),
    chapter_mission: structure.chapter_goal || plan.chapter_mission || '',
    emotion_target: structure.reader_payoff || plan.emotion_target || '',
    outline_text: outlineText,
    ending_hook: structure.ending_hook || plan.ending_hook || '',
    scene_outline: normalizeLines(structure.key_scenes).map((line, index) => ({
      order: index + 1,
      summary: line
    })),
    chapter_structure: structure,
    structured_content: {
      ...(plan.structured_content || {}),
      chapter_outline_structure: structure,
      generation_settings: {
        ...((plan.structured_content || {}).generation_settings || {}),
        word_count: getPlanWordCount(plan)
      }
    }
  };
}

export function hasText(value) {
  return String(value || '').trim().length > 0;
}

export function hasMountedStorylineAnchor(plan = {}) {
  const mainStorylineId = String(plan?.main_storyline_id || '').trim();
  const targetStorylines = Array.isArray(plan?.target_storylines) ? plan.target_storylines : [];
  return !!mainStorylineId || targetStorylines.some((item) => String(item || '').trim());
}

export function hasUsableChapterOutline(plan = {}) {
  if (getLatestChapterOutline(plan)) return true;
  const chapterStructure = plan?.chapter_structure || emptyChapterStructure;
  const chapterGoal = String(chapterStructure?.chapter_goal || plan?.chapter_mission || '').trim();
  const keyScenes = String(chapterStructure?.key_scenes || '').trim();
  const endingHook = String(chapterStructure?.ending_hook || plan?.ending_hook || '').trim();
  return !!chapterGoal && !!keyScenes && !!endingHook;
}
