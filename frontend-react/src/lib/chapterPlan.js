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
  return normalizeNarrativeOutlineText(plan?.outline_text || '');
}

export function getGenerationChapterOutline(plan = {}) {
  return getLatestChapterOutline(plan);
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
      const personality = String(item.personality || item.baseline || '').trim();
      const background = String(item.background || '').trim();
      const appearance = String(item.appearance || item.appearance_marker || item.appearanceMarker || '').trim();
      const baseline = String(item.baseline || personality || background).trim();
      const appearanceMarker = appearance;
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
      if (!role && !personality && !background && !appearanceMarker && !chapterFunction && !allowedChange && !forbiddenChange) return null;
      return {
        role,
        personality,
        background,
        appearance,
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
    })
    .filter(Boolean);

  if (normalized.length > 0) return normalized;

  return normalizeRoleList(appearingRoles).map((role) => ({
    role,
    personality: String(characterNotes || '').trim() || '延续当前人物底色。',
    background: '',
    appearance: '',
    baseline: String(characterNotes || '').trim() || '延续当前人物底色。',
    appearance_marker: '本章生成前必须补足可识别外形标识。',
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
  const appearance = String(item?.appearance || item?.appearance_marker || item?.appearanceMarker || '').trim();
  const personality = String(item?.personality || item?.baseline || '').trim();
  const background = String(item?.background || item?.chapter_function || '').trim();
  return [
    personality ? `性格 ${personality}` : '',
    background ? `背景 ${background}` : '',
    appearance ? `外形 ${appearance}` : ''
  ].filter(Boolean).join('｜') || '角色资料待补充';
}

export function buildGenerationRiskReview(plan, generationConstraints) {
  const roleExecution = Array.isArray(plan?.role_execution) ? plan.role_execution : [];
  const stageRoles = roleExecution.filter((item) => item.scope === 'stage');
  const coreCandidateRoles = roleExecution.filter((item) => item.scope === 'core_candidate');
  const highConfidenceCoreCandidates = coreCandidateRoles.filter((item) => item.confidence === 'high' || item.confidence === 'medium');
  const items = [];

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

export function prepareOutlineModalPlan(plan) {
  const outlineText = normalizeNarrativeOutlineText(plan?.outline_text || '');
  const normalizedSummary = String(plan?.summary || '').trim();
  const normalizedCharacterNotes = String(plan?.character_notes || '').trim();
  const structuredContent = plan?.structured_content || {};
  const {
    chapter_outline_structure: _legacyStructure,
    chapter_outline_snapshot: _legacySnapshot,
    ...remainingStructuredContent
  } = structuredContent;

  return {
    ...plan,
    summary: normalizedSummary || buildOutlineExcerpt(outlineText, ''),
    outline_text: outlineText,
    character_notes: normalizedCharacterNotes,
    ending_hook: '',
    scene_outline: [],
    chapter_structure: { ...emptyChapterStructure },
    structured_content: {
      ...remainingStructuredContent,
      chapter_outline_mode: 'single_latest'
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
  return !!getGenerationChapterOutline(plan);
}
