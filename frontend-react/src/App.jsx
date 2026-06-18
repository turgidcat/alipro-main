import { Fragment, useEffect, useRef, useState } from 'react';
import { workflowSteps } from './mockData.js';
import { useWorkbenchData } from './useWorkbenchData.js';
import {
  createDemoWorkspace,
  fetchChapterSetupBundle,
  generateChapterContent,
  generateChapterFeedback,
  polishChapterContent,
  saveChapterPlan,
  saveStoryline,
  upsertGeneratedChapter
} from './workbenchApi.js';
import './app-shell.css';
import {
  emptyChapterStructure,
  emptyChapterPlan,
  initialGenerationState,
  emptyStorylineDraft,
  ROLE_EXECUTION_DIMENSIONS,
  ROLE_EXECUTION_DIRECTIONS,
  ROLE_EXECUTION_SCOPES,
  ROLE_EXECUTION_CONFIDENCE,
  ROLE_DIMENSION_LABELS,
  ROLE_DIRECTION_LABELS,
  ROLE_SCOPE_LABELS,
  ROLE_CONFIDENCE_LABELS,
  PLATFORM_LABELS,
  GENRE_LABELS,
  SUBGENRE_LABELS,
  TEMPLATE_LABELS
} from './lib/constants.js';

function normalizeLines(text) {
  return String(text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeRoleName(role) {
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

function normalizeRoleList(roles) {
  if (!Array.isArray(roles)) return [];
  return roles.map(normalizeRoleName).filter(Boolean);
}

function summarizeText(text, fallback = '') {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  return normalized || String(fallback || '').trim();
}

function buildSvgDataUrl(markup) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markup)}`;
}

function createBookCoverDataUrl(title = '未命名书籍') {
  const safeTitle = String(title || '未命名书籍').trim().slice(0, 18) || '未命名书籍';
  return buildSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 960">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#122033"/>
          <stop offset="45%" stop-color="#1e3250"/>
          <stop offset="100%" stop-color="#d0a76c"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="25%" r="60%">
          <stop offset="0%" stop-color="#f8e2a4" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#f8e2a4" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="720" height="960" rx="44" fill="url(#bg)"/>
      <rect width="720" height="960" rx="44" fill="url(#glow)"/>
      <circle cx="555" cy="170" r="92" fill="#f7e7b5" fill-opacity="0.18"/>
      <path d="M110 720C220 620 302 590 372 596C458 604 522 674 620 652V884H110Z" fill="#101927" fill-opacity="0.86"/>
      <path d="M120 762C212 692 296 666 378 674C470 682 546 742 620 724V884H120Z" fill="#e7bc71" fill-opacity="0.32"/>
      <text x="360" y="240" text-anchor="middle" font-size="40" fill="#f4ddb1" font-family="'Microsoft YaHei', sans-serif" letter-spacing="6">ALIPRO</text>
      <text x="360" y="392" text-anchor="middle" font-size="92" font-weight="700" fill="#fff1c4" font-family="'Microsoft YaHei', sans-serif">${safeTitle}</text>
      <text x="360" y="458" text-anchor="middle" font-size="26" fill="#f4ddb1" font-family="'Microsoft YaHei', sans-serif">全书规划主视觉</text>
      <rect x="184" y="554" width="352" height="2" fill="#f4ddb1" fill-opacity="0.6"/>
      <text x="360" y="820" text-anchor="middle" font-size="28" fill="#fff7df" font-family="'Microsoft YaHei', sans-serif">书籍封面示意图</text>
    </svg>
  `);
}

function createVolumePosterDataUrl(volumeLabel = '第1卷') {
  const safeLabel = String(volumeLabel || '第1卷').trim().slice(0, 12) || '第1卷';
  return buildSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 520">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#18263c"/>
          <stop offset="55%" stop-color="#314d73"/>
          <stop offset="100%" stop-color="#d7b071"/>
        </linearGradient>
      </defs>
      <rect width="360" height="520" rx="28" fill="url(#bg)"/>
      <rect x="14" y="14" width="332" height="492" rx="20" fill="none" stroke="#f1d79d" stroke-opacity="0.7" stroke-width="3"/>
      <circle cx="284" cy="126" r="74" fill="#fff1c9" fill-opacity="0.18"/>
      <path d="M0 402C72 350 124 332 184 336C256 340 306 382 360 364V520H0Z" fill="#0f1624" fill-opacity="0.88"/>
      <path d="M0 434C64 394 126 384 182 390C258 398 304 430 360 420V520H0Z" fill="#efc27a" fill-opacity="0.3"/>
      <text x="180" y="104" text-anchor="middle" font-size="44" font-weight="700" fill="#fff5dc" font-family="'Microsoft YaHei', sans-serif">${safeLabel}</text>
      <text x="180" y="458" text-anchor="middle" font-size="24" fill="#fff1cf" font-family="'Microsoft YaHei', sans-serif">分卷展示示意图</text>
    </svg>
  `);
}

function createCharacterBadgeDataUrl(name = '角色') {
  const safeName = String(name || '角色').trim().slice(0, 4) || '角色';
  return buildSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">
      <defs>
        <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1b2e47"/>
          <stop offset="100%" stop-color="#d7b071"/>
        </linearGradient>
        <radialGradient id="face" cx="50%" cy="38%" r="56%">
          <stop offset="0%" stop-color="#fff4d6"/>
          <stop offset="100%" stop-color="#dbc18e"/>
        </radialGradient>
      </defs>
      <circle cx="110" cy="110" r="104" fill="url(#ring)"/>
      <circle cx="110" cy="110" r="92" fill="#f7f2e8"/>
      <circle cx="110" cy="110" r="84" fill="#24374f"/>
      <circle cx="110" cy="100" r="46" fill="url(#face)"/>
      <path d="M54 176C68 144 88 128 110 128C132 128 152 144 166 176Z" fill="#ead6a8"/>
      <text x="110" y="196" text-anchor="middle" font-size="28" font-weight="700" fill="#f8e8bb" font-family="'Microsoft YaHei', sans-serif">${safeName}</text>
    </svg>
  `);
}

function buildCharacterSubtitle(character) {
  const pieces = [
    String(character?.personality || '').trim(),
    String(character?.background || '').trim(),
    String(character?.appearance || '').trim(),
    String(character?.notes || '').trim()
  ].filter(Boolean);
  return pieces[0] || '角色档案待补充';
}

function buildConstraintBriefText(generationConstraints, overrides) {
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

function renderBlockedConstraints(generationConstraints, constraintOverrides, setConstraintOverride) {
  const blocked = Array.isArray(generationConstraints?.blocked) ? generationConstraints.blocked : [];
  if (blocked.length === 0) return null;

  return (
    <div className="chapter-constraint-inline">
      <div className="chapter-constraint-head">
        <span>禁止项</span>
        <p>例如突然冒出没铺垫的新亲属、直接改写主线走向的新真相，或临时接管剧情的新势力/新规则。</p>
      </div>
      <div className="chapter-constraint-group">
        {blocked.map((group, groupIndex) => (
          <div key={`${group.label}-${groupIndex}`} className="chapter-constraint-row">
            <div className="chapter-constraint-copy">
              <span>{group.label}</span>
              <p>{group.rule}</p>
            </div>
            <div className="chapter-constraint-actions">
              {[
                { value: 'ban', label: '禁止' },
                { value: 'allow', label: '放开' }
              ].map((option) => {
                const key = `blocked-${group.label}-${groupIndex}`;
                const active = (constraintOverrides[key] || 'ban') === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`constraint-toggle-btn${active ? ' is-active' : ''}`}
                    onClick={() => setConstraintOverride(key, option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function composeStructuredOutline(structure) {
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

function composeSceneOutlineText(sceneOutline) {
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

function buildChapterStructureFromPlan(plan) {
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

function normalizeRoleExecution(roleExecution, appearingRoles = [], characterNotes = '', mission = '') {
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

function describeRoleExecutionMeta(item) {
  const dimension = ROLE_DIMENSION_LABELS[item.dimension] || '剧情职责';
  const direction = ROLE_DIRECTION_LABELS[item.direction] || '保持当前底色';
  const scope = ROLE_SCOPE_LABELS[item.scope] || '本章表现';
  const confidence = ROLE_CONFIDENCE_LABELS[item.confidence] || '低';
  return `${dimension}｜${direction}｜${scope}｜把握度 ${confidence}`;
}

function buildGenerationRiskReview(plan, generationConstraints, overrides = {}) {
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

  if (!String(plan?.main_storyline_id || '').trim() && (!Array.isArray(plan?.target_storylines) || plan.target_storylines.length === 0)) {
    items.push({
      level: 'warning',
      title: '本章没有挂主剧情线',
      text: '当前章节计划缺少剧情线锚点，模型更容易只根据上一章反馈临场续写。',
      action: '建议至少挂一条主剧情线，避免章节目标和长期推进脱节。'
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

function getPlanWordCount(plan) {
  const saved = Number(
    plan?.structured_content?.generation_settings?.word_count
    || plan?.structuredContent?.generation_settings?.word_count
    || plan?.generation_settings?.word_count
    || 3000
  );
  return Number.isFinite(saved) ? Math.min(10000, Math.max(500, saved)) : 3000;
}

function normalizeChapterStructureForSave(plan) {
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

function prepareOutlineModalPlan(plan) {
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

function withStructuredChapterPlan(plan, structure) {
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

function hasText(value) {
  return String(value || '').trim().length > 0;
}

function normalizeParagraphs(text) {
  return String(text || '')
    .split(/\n{2,}|\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitRevisionParagraphs(text) {
  return String(text || '')
    .split(/\n{2,}|\r?\n/)
    .map((line) => line.trim());
}

function normalizeRevisionText(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function normalizeSentences(text) {
  return normalizeParagraphs(text)
    .flatMap((paragraph) => paragraph.match(/[^銆傦紒锛??锛?]+[銆傦紒锛??锛?]?/g) || [paragraph])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function similarityScore(left, right) {
  const leftSet = new Set(String(left || '').replace(/\s+/g, '').split(''));
  const rightSet = new Set(String(right || '').replace(/\s+/g, '').split(''));
  if (leftSet.size === 0 || rightSet.size === 0) return 0;
  let overlap = 0;
  leftSet.forEach((char) => {
    if (rightSet.has(char)) overlap += 1;
  });
  return overlap / Math.max(leftSet.size, rightSet.size);
}

function buildRevisionDiff(original, draft) {
  const originalParagraphs = normalizeParagraphs(original);
  const draftParagraphs = normalizeParagraphs(draft);
  const maxLength = Math.max(originalParagraphs.length, draftParagraphs.length);

  return Array.from({ length: maxLength }, (_, index) => {
    const before = originalParagraphs[index] || '';
    const after = draftParagraphs[index] || '';
    if (before && after && before === after) {
      return { id: index, type: 'same', label: '未改', before, after };
    }
    if (!before && after) {
      return { id: index, type: 'added', label: '新增', before, after };
    }
    if (before && !after) {
      return { id: index, type: 'removed', label: '删除', before, after };
    }
    const score = similarityScore(before, after);
    return {
      id: index,
      type: score > 0.45 ? 'changed' : 'rewritten',
      label: score > 0.45 ? '改写' : '重写',
      before,
      after
    };
  });
}

function buildRevisionSentenceDiff(original, draft) {
  const originalSentences = normalizeSentences(original);
  const draftSentences = normalizeSentences(draft);
  const maxLength = Math.max(originalSentences.length, draftSentences.length);

  return Array.from({ length: maxLength }, (_, index) => {
    const before = originalSentences[index] || '';
    const after = draftSentences[index] || '';
    if (before && after && before === after) {
      return { id: index, type: 'same', label: '未改', before, after };
    }
    if (!before && after) {
      return { id: index, type: 'added', label: '新增', before, after };
    }
    if (before && !after) {
      return { id: index, type: 'removed', label: '删除', before, after };
    }
    const score = similarityScore(before, after);
    return {
      id: index,
      type: score > 0.5 ? 'changed' : 'rewritten',
      label: score > 0.5 ? '鏀瑰啓' : '閲嶅啓',
      before,
      after
    };
  });
}

function buildRevisionEvaluation(original, draft, diffItems) {
  const originalLength = String(original || '').length;
  const draftLength = String(draft || '').length;
  const originalParagraphs = normalizeParagraphs(original).length;
  const draftParagraphs = normalizeParagraphs(draft).length;
  const changedItems = diffItems.filter((item) => item.type !== 'same');
  const changedRatio = diffItems.length ? changedItems.length / diffItems.length : 0;
  const lengthRatio = originalLength ? draftLength / originalLength : 1;
  const issues = [];
  const gains = [];

  if (changedRatio < 0.12) {
    issues.push('变化幅度很小，可能只是替换措辞，整体价值有限。');
  } else if (changedRatio > 0.65) {
    issues.push('变化幅度很大，建议重点检查剧情事实、人物语气和节奏是否被改偏。');
  } else {
    gains.push('有一定实质改动，适合人工挑选保留。');
  }

  if (lengthRatio > 1.18) {
    issues.push('校改稿明显变长，可能增加解释和赘述。');
  } else if (lengthRatio < 0.82) {
    issues.push('校改稿明显变短，可能删掉了铺垫、情绪或动作细节。');
  } else {
    gains.push('字数变化较克制，没有明显膨胀或缩水。');
  }

  if (Math.abs(draftParagraphs - originalParagraphs) >= 3) {
    issues.push('段落结构变化较大，阅读节奏可能已经被重排。');
  }

  const verdict = issues.length === 0
    ? '值得保留'
    : changedRatio < 0.12
      ? '价值偏低'
      : '只适合参考';
  const action = verdict === '鍊煎緱鑰冭檻'
    ? '可以通读全文后决定是否保留。'
    : '不建议整版直接保存，先挑选局部可用改动。';

  return {
    verdict,
    action,
    changedCount: changedItems.length,
    totalCount: diffItems.length,
    originalLength,
    draftLength,
    originalParagraphs,
    draftParagraphs,
    gains: gains.slice(0, 3),
    issues: issues.slice(0, 3)
  };
}

function buildLocalChapterFeedback({
  content,
  plan,
  chapterStructure,
  mainStorylineLabel,
  targetStorylineLabel,
  rhythmHints
}) {
  const contentPreview = String(content || '').replace(/\s+/g, ' ').trim().slice(0, 220);
  const storyProgress = [
    chapterStructure.chapter_goal ? `完成本章目标：${chapterStructure.chapter_goal}` : '',
    mainStorylineLabel && mainStorylineLabel !== '暂未指定' ? `主线推进：${mainStorylineLabel}` : '',
    targetStorylineLabel && targetStorylineLabel !== '暂未挂接' ? `关联剧情线：${targetStorylineLabel}` : ''
  ].filter(Boolean);
  const rhythmText = Array.isArray(rhythmHints)
    ? rhythmHints.map((hint) => hint.text).filter(Boolean).join('\n')
    : '';

  return {
    chapter_summary: contentPreview || '本章已生成正文。',
    story_progress: storyProgress.join('\n') || chapterStructure.key_scenes || '',
    character_changes: chapterStructure.character_change || plan.character_notes || '',
    emotion_result: chapterStructure.reader_payoff || plan.emotion_target || '',
    open_hooks: chapterStructure.ending_hook || plan.ending_hook || '',
    next_chapter_focus: chapterStructure.ending_hook || plan.ending_hook || '承接本章结果，继续推进主要冲突。',
    continuity_report: {
      new_characters: [],
      new_elements: [],
      must_carry_forward: [chapterStructure.ending_hook || plan.ending_hook || '承接本章结果，继续推进主要冲突。'].filter(Boolean),
      continuity_risks: []
    },
    rhythm_notes: rhythmText,
    source: 'local_generation',
    generated_at: new Date().toISOString()
  };
}

function WorkflowTabs({ activeStep, onChange }) {
  return (
    <div className="workflow-tabs" role="tablist" aria-label="创作主链">
      {workflowSteps.map((step) => (
        <button
          key={step.id}
          type="button"
          className={`workflow-tab${step.id === activeStep ? ' is-active' : ''}`}
          onClick={() => onChange(step.id)}
          role="tab"
          aria-selected={step.id === activeStep}
        >
          <span className="workflow-tab-index">{step.index}</span>
          <span className="workflow-tab-title">{step.title}</span>
          <span className="workflow-tab-note">{step.note}</span>
        </button>
      ))}
    </div>
  );
}

function PanelCard({ eyebrow, title, description, children, actions, headerActions, className = '' }) {
  return (
    <section className={`panel-card${className ? ` ${className}` : ''}`}>
      {eyebrow || title || description || headerActions ? (
        <div className="panel-card-head">
          <div className="panel-card-head-main">
            {eyebrow ? <span className="panel-card-eyebrow">{eyebrow}</span> : null}
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {headerActions ? <div className="panel-card-head-actions">{headerActions}</div> : null}
        </div>
      ) : null}
      <div className="panel-card-body">{children}</div>
      {actions ? <div className="panel-card-actions">{actions}</div> : null}
    </section>
  );
}

function Modal({ title, description, children, onClose, actions }) {
  const modalClassName = title.includes('正文校改') ? 'modal-panel modal-panel-revision' : 'modal-panel';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={modalClassName} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <button type="button" className="ghost-btn modal-close-btn" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  );
}

function normalizeChapterBundle(bundle, chapterNumber) {
  const plan = bundle?.chapterPlan || {};
  const context = bundle?.chapterContext || {};
  const content = String(plan.generatedContent || '').trim();
  const feedback = plan.chapterFeedback || {};
  const appearingRoles = normalizeRoleList(plan.appearingRoles);

  return {
    context: {
      latestChapterLabel: context.latestChapterLabel || '还没有章节记录，建议从第 1 章开始。',
      previousFeedbackLabel: context.previousFeedbackLabel || '',
      previousFeedbackFocus: context.previousFeedbackFocus || '',
      generationConstraints: context.generationConstraints || {
        summary: '',
        anchors: [],
        allowed: [],
        blocked: [],
        rolePool: []
      }
    },
    draft: {
      volume_number: plan.volumeNumber || 1,
      chapter_name: plan.chapterTitle || '',
      summary: plan.summary || '',
      chapter_mission: plan.chapterMission || '',
      emotion_target: plan.emotionTarget || '',
      previous_hook: plan.previousHook || context.previousFeedbackFocus || '',
      outline_text: plan.outlineText || '',
      character_notes: plan.characterNotes || '',
      ending_hook: plan.endingHook || '',
      scene_outline: plan.sceneOutline || [],
      appearing_roles: appearingRoles,
      role_execution: normalizeRoleExecution(
        plan.roleExecution,
        appearingRoles,
        plan.characterNotes || '',
        plan.chapterMission || ''
      ),
      structured_content: plan.structuredContent || {},
      chapter_structure: buildChapterStructureFromPlan(plan),
      generation_settings: plan.structuredContent?.generation_settings || { word_count: 3000 },
      main_storyline_id: plan.mainStorylineId || '',
      target_storylines: Array.isArray(plan.targetStorylines) ? plan.targetStorylines : []
    },
    view: {
      volumeLabel: plan.volumeLabel || `第 ${plan.volumeNumber || 1} 卷`,
      volumeSummary: plan.volumeSummary || '这一章还没有明确卷级推进说明。',
      mainStoryline: plan.mainStorylineLabel || '暂未指定剧情线',
      targetStorylinesLabel: Array.isArray(plan.targetStorylineLabels) && plan.targetStorylineLabels.length
        ? plan.targetStorylineLabels.join(' / ')
        : '暂未挂接并行剧情线'
    },
    storylineOptions: Array.isArray(bundle?.storylineOptions) ? bundle.storylineOptions : [],
    generation: content
      ? {
          hasContent: true,
          content,
          statusKind: 'success',
          statusTitle: '本章已有正文',
          statusText: '可以查看正文，也可以调整章节规划后重新生成。',
          metaText: `第 ${chapterNumber} 章 · ${plan.chapterTitle || '未命名章节'}`,
          wordCountLabel: `实际约 ${content.length} 字 / 目标 ${getPlanWordCount(plan)} 字`,
          previewText: content.replace(/\s+/g, ' ').slice(0, 520),
          feedbackSummary: feedback.chapter_summary || '本章已有正文，生成反馈可后续继续增强。',
          feedbackFocus: feedback.next_chapter_focus || feedback.open_hooks || '下一章重点暂未整理。'
        }
      : initialGenerationState
  };
}

function mergeFeedbackIntoPlan(plan, chapterFeedback) {
  const structuredContent = {
    ...(plan.structured_content || {}),
    chapter_feedback: chapterFeedback
  };
  return {
    ...plan,
    structured_content: structuredContent,
    structuredContent
  };
}

export default function App() {
  const [activeStep, setActiveStep] = useState('book');
  const [planningModal, setPlanningModal] = useState(null);
  const [chapterModal, setChapterModal] = useState(null);
  const [savingState, setSavingState] = useState({ loading: false, error: '' });
  const [planningNotice, setPlanningNotice] = useState('');
  const [chapterNumber, setChapterNumber] = useState(1);
  const [chapterContext, setChapterContext] = useState({});
  const [chapterView, setChapterView] = useState({});
  const [storylineOptions, setStorylineOptions] = useState([]);
  const [draftChapterPlan, setDraftChapterPlan] = useState(emptyChapterPlan);
  const [constraintOverrides, setConstraintOverrides] = useState({});
  const [generationRiskConfirmed, setGenerationRiskConfirmed] = useState(false);
  const [draftStoryline, setDraftStoryline] = useState(emptyStorylineDraft);
  const [generationState, setGenerationState] = useState(initialGenerationState);
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [revisionOriginal, setRevisionOriginal] = useState('');
  const [revisionDraft, setRevisionDraft] = useState('');
  const [revisionRequirement, setRevisionRequirement] = useState('增强画面感和爽点，保持原剧情不变。');
  const [revisionSuggestions, setRevisionSuggestions] = useState(null);
  const [revisionSaving, setRevisionSaving] = useState(false);
  const [revisionPolishing, setRevisionPolishing] = useState(false);
  const [revisionError, setRevisionError] = useState('');
  const [revisionNotice, setRevisionNotice] = useState('');
  const [revisionFocusIndex, setRevisionFocusIndex] = useState(0);
  const [revisionAppliedChangeKeys, setRevisionAppliedChangeKeys] = useState([]);
  const revisionParagraphRefs = useRef(new Map());
  const revisionChangeRefs = useRef(new Map());
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false);

  const {
    books,
    selectedBookId,
    setSelectedBookId,
    planningState,
    loadingBooks,
    loadingPlanning,
    error,
    reloadPlanning,
    reloadBooks
  } = useWorkbenchData();

  useEffect(() => {
    if (!selectedBookId) return;

    let cancelled = false;
    async function loadChapter() {
      setLoadingChapter(true);
      try {
        const bundle = await fetchChapterSetupBundle(selectedBookId, chapterNumber);
        if (cancelled) return;
        const normalized = normalizeChapterBundle(bundle, chapterNumber);
        setChapterContext(normalized.context);
        setChapterView(normalized.view);
        setStorylineOptions(normalized.storylineOptions);
        setDraftChapterPlan(normalized.draft);
        setGenerationState(normalized.generation);
      } finally {
        if (!cancelled) setLoadingChapter(false);
      }
    }

    loadChapter();
    return () => {
      cancelled = true;
    };
  }, [selectedBookId, chapterNumber]);

  useEffect(() => {
    setConstraintOverrides({});
    setGenerationRiskConfirmed(false);
  }, [selectedBookId, chapterNumber]);

  function setConstraintOverride(key, mode) {
    setConstraintOverrides((prev) => ({
      ...prev,
      [key]: mode
    }));
  }

  async function handleSaveChapterPlan() {
    setSavingState({ loading: true, error: '' });
    try {
      await saveChapterPlan(
        selectedBookId,
        chapterNumber,
        prepareOutlineModalPlan(draftChapterPlan)
      );
      const bundle = await fetchChapterSetupBundle(selectedBookId, chapterNumber);
      const normalized = normalizeChapterBundle(bundle, chapterNumber);
      setChapterContext(normalized.context);
      setChapterView(normalized.view);
      setStorylineOptions(normalized.storylineOptions);
      setDraftChapterPlan(normalized.draft);
      setGenerationState(normalized.generation);
      setChapterModal(null);
    } catch (saveError) {
      setSavingState({ loading: false, error: saveError.message });
      return;
    }
    setSavingState({ loading: false, error: '' });
  }

  async function handleSaveChapterOutline() {
    setSavingState({ loading: true, error: '' });
    try {
      const outlinePlan = prepareOutlineModalPlan(draftChapterPlan);
      await saveChapterPlan(selectedBookId, chapterNumber, outlinePlan);
      const bundle = await fetchChapterSetupBundle(selectedBookId, chapterNumber);
      const normalized = normalizeChapterBundle(bundle, chapterNumber);
      setChapterContext(normalized.context);
      setChapterView(normalized.view);
      setStorylineOptions(normalized.storylineOptions);
      setDraftChapterPlan(normalized.draft);
      setGenerationState(normalized.generation);
      setChapterModal(null);
    } catch (saveError) {
      setSavingState({ loading: false, error: saveError.message });
      return;
    }
    setSavingState({ loading: false, error: '' });
  }

  async function reloadChapterSetup(overrideDraft = null) {
    if (!selectedBookId) return;
    const bundle = await fetchChapterSetupBundle(selectedBookId, chapterNumber);
    const normalized = normalizeChapterBundle(bundle, chapterNumber);
    setChapterContext(normalized.context);
    setChapterView(normalized.view);
    setStorylineOptions(normalized.storylineOptions);
    setDraftChapterPlan(overrideDraft || normalized.draft);
    setGenerationState(normalized.generation);
    return normalized;
  }

  async function persistChapterResultCycle({
    content,
    normalizedPlan,
    chapterStructure,
    chapterTitle,
    targetWordCount,
    successTitle,
    successText,
    openResultModal = false
  }) {
    await upsertGeneratedChapter(selectedBookId, {
      title: chapterTitle,
      chapterName: normalizedPlan.chapter_name || '',
      chapterNumber,
      content
    });

    let chapterFeedback = null;
    try {
      const feedbackResponse = await generateChapterFeedback({
        bookId: selectedBookId,
        chapterNumber,
        chapterTitle,
        content,
        outline: String(normalizedPlan.outline_text || composeStructuredOutline(chapterStructure)).trim()
      });
      chapterFeedback = feedbackResponse?.feedback || null;
    } catch (_) {
      chapterFeedback = null;
    }

    if (!chapterFeedback) {
      chapterFeedback = buildLocalChapterFeedback({
        content,
        plan: normalizedPlan,
        chapterStructure,
        mainStorylineLabel: selectedMainStorylineLabel,
        targetStorylineLabel: selectedTargetStorylineLabel,
        rhythmHints: storylineRhythmHints
      });
    }

    const feedbackPlan = mergeFeedbackIntoPlan(normalizedPlan, chapterFeedback);
    await saveChapterPlan(selectedBookId, chapterNumber, feedbackPlan);
    setDraftChapterPlan(feedbackPlan);
    setGenerationState({
      hasContent: true,
      content,
      statusKind: 'success',
      statusTitle: successTitle,
      statusText: successText,
      metaText: chapterTitle,
      wordCountLabel: `实际约 ${content.length} 字 / 目标 ${targetWordCount} 字`,
      previewText: String(content).replace(/\s+/g, ' ').slice(0, 520),
      feedbackSummary: chapterFeedback.chapter_summary || '',
      feedbackFocus: chapterFeedback.next_chapter_focus || chapterFeedback.open_hooks || ''
    });
    setRevisionOriginal(String(content || ''));
    setRevisionDraft(String(content || ''));
    setRevisionSuggestions(null);
    setRevisionError('');
    if (openResultModal) {
      setResultModalOpen(true);
    }
    return { feedbackPlan, chapterFeedback };
  }

  function goToPreviousChapter() {
    setChapterNumber((current) => Math.max(1, Number(current || 1) - 1));
  }

  function goToNextChapter() {
    setChapterNumber((current) => Math.max(1, Number(current || 1) + 1));
  }

  function openRevisionEditor() {
    const currentContent = generationState.content || '';
    revisionParagraphRefs.current = new Map();
    revisionChangeRefs.current = new Map();
    setRevisionOriginal(currentContent);
    setRevisionDraft(currentContent);
    setRevisionSuggestions(null);
    setRevisionError('');
    setRevisionNotice('');
    setRevisionFocusIndex(0);
    setRevisionAppliedChangeKeys([]);
    setResultModalOpen(true);
  }

  function registerRevisionParagraphRef(paragraphNumber, element) {
    const refs = revisionParagraphRefs.current;
    if (!refs) return;
    if (element) {
      refs.set(paragraphNumber, element);
    } else {
      refs.delete(paragraphNumber);
    }
  }

  function focusRevisionParagraph(paragraphNumber) {
    const target = revisionParagraphRefs.current.get(Number(paragraphNumber));
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('is-revision-focus');
      window.setTimeout(() => {
        target.classList.remove('is-revision-focus');
      }, 1200);
    }
  }

  function registerRevisionChangeRef(changeKey, element) {
    if (!changeKey) return;
    const refs = revisionChangeRefs.current;
    if (!refs) return;
    if (element) {
      refs.set(changeKey, element);
    } else {
      refs.delete(changeKey);
    }
  }

  function focusRevisionChangeItem(changeItem) {
    if (!changeItem) return;
    const target = revisionChangeRefs.current.get(changeItem.key);
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('is-revision-focus');
      window.setTimeout(() => {
        target.classList.remove('is-revision-focus');
      }, 1200);
    }
  }

  function focusRevisionChange(direction) {
    if (revisionChangeItems.length === 0) return;
    const currentIndex = Math.min(revisionFocusIndex, revisionChangeItems.length - 1);
    const nextIndex = direction > 0
      ? (currentIndex + 1) % revisionChangeItems.length
      : (currentIndex - 1 + revisionChangeItems.length) % revisionChangeItems.length;
    setRevisionFocusIndex(nextIndex);
    focusRevisionChangeItem(revisionChangeItems[nextIndex]);
  }

  function applyRevisionSuggestion(suggestion, changeKey) {
    const baseContent = String(revisionDraft || revisionOriginal || '').trim();
    if (!baseContent) {
      setRevisionError('没有可编辑的正文。');
      return;
    }

    const paragraphs = splitRevisionParagraphs(baseContent);
    const mode = suggestion?.action;
    const replacement = String(suggestion?.suggested_text || '').trim();

    let nextParagraphs = [...paragraphs];
    if (mode === 'replace') {
      if (!replacement) {
        setRevisionError('这条修改没有可写入的正文。');
        return;
      }
      const paragraphIndex = Number(suggestion?.paragraph || 0) - 1;
      if (paragraphIndex < 0 || paragraphIndex >= nextParagraphs.length) {
        setRevisionError('替换段落编号超出范围。');
        return;
      }
      nextParagraphs[paragraphIndex] = replacement;
    } else if (mode === 'insert_after') {
      if (!replacement) {
        setRevisionError('这条新增没有可写入的正文。');
        return;
      }
      const anchorIndex = Number(suggestion?.afterParagraph || suggestion?.paragraph || 0) - 1;
      if (anchorIndex < 0 || anchorIndex >= nextParagraphs.length) {
        setRevisionError('鎻掑叆浣嶇疆瓒呭嚭鑼冨洿銆?');
        return;
      }
      nextParagraphs.splice(anchorIndex + 1, 0, replacement);
    } else if (mode === 'delete') {
      const paragraphIndex = Number(suggestion?.paragraph || 0) - 1;
      if (paragraphIndex < 0 || paragraphIndex >= nextParagraphs.length) {
        setRevisionError('删除段落编号超出范围。');
        return;
      }
      nextParagraphs[paragraphIndex] = '';
    } else {
      setRevisionError('涓嶆敮鎸佺殑寤鸿绫诲瀷銆?');
      return;
    }

    setRevisionDraft(nextParagraphs.join('\n\n'));
    if (changeKey) {
      setRevisionAppliedChangeKeys((current) => (current.includes(changeKey) ? current : [...current, changeKey]));
    }
    setRevisionNotice(`已应用第 ${suggestion?.paragraph || suggestion?.afterParagraph || '?'} 条建议到校改稿。`);
    window.setTimeout(() => focusRevisionParagraph(suggestion?.paragraph || suggestion?.afterParagraph || 1), 0);
  }

  async function handlePolishRevision() {
    const sourceContent = String(revisionDraft || '').trim();
    if (sourceContent.length < 5) {
      setRevisionError('正文太短，暂时无法生成校改稿。');
      return;
    }

    setRevisionPolishing(true);
    setRevisionError('');
    setRevisionNotice('');
    setRevisionSuggestions(null);
    try {
      const response = await polishChapterContent(sourceContent, revisionRequirement, {
        mode: 'revision_suggestions',
        maxChangeCount: 6
      });
      const suggestions = Array.isArray(response?.suggestions) ? response.suggestions : [];
      if (!response || (!suggestions.length && !response.regeneration_notes && !response.raw_content)) {
        setRevisionError('校改接口没有返回可用建议。');
        return;
      }
      setRevisionSuggestions(response);
      setRevisionNotice('已生成局部修改建议，正文不会自动替换，请挑选可用改动手动写入校改稿。');
    } catch (polishError) {
      setRevisionError(polishError.message);
    } finally {
      setRevisionPolishing(false);
    }
  }

  async function handleSaveRevision() {
    const nextContent = String(revisionDraft || '').trim();
    if (!nextContent) {
      setRevisionError('正文不能为空。');
      return;
    }

    setRevisionSaving(true);
    setRevisionError('');
    try {
      const normalizedPlan = withStructuredChapterPlan(
        draftChapterPlan,
        draftChapterPlan.chapter_structure || emptyChapterStructure
      );
      const chapterStructure = normalizedPlan.chapter_structure || emptyChapterStructure;
      const chapterTitle = draftChapterPlan.chapter_name
        ? `第 ${chapterNumber} 章 ${draftChapterPlan.chapter_name}`
        : `第 ${chapterNumber} 章`;
      await persistChapterResultCycle({
        content: nextContent,
        normalizedPlan,
        chapterStructure,
        chapterTitle,
        targetWordCount: getPlanWordCount(normalizedPlan),
        successTitle: '正文已校改',
        successText: '校改后的正文、反馈和剧情线承接都已同步写回。'
      });
      setResultModalOpen(false);
    } catch (saveError) {
      setRevisionError(saveError.message);
    } finally {
      setRevisionSaving(false);
    }
  }

  function openStorylineCreator() {
    setDraftStoryline({
      ...emptyStorylineDraft,
      volume_number: draftChapterPlan.volume_number || 1,
      start_chapter: chapterNumber,
      end_chapter: Math.max(chapterNumber + 6, chapterNumber)
    });
    setSavingState({ loading: false, error: '' });
    setChapterModal('storyline');
  }

  function openStorylineEditor(storyline) {
    setDraftStoryline({
      id: storyline.id,
      volume_number: storyline.volumeNumber || 1,
      storyline_name: storyline.name || '',
      storyline_type: storyline.type || 'branch',
      description: storyline.description || '',
      core_conflict: storyline.coreConflict || '',
      start_chapter: storyline.startChapter || chapterNumber,
      end_chapter: storyline.endChapter || Math.max(chapterNumber + 6, chapterNumber)
    });
    setSavingState({ loading: false, error: '' });
    setChapterModal('storyline');
  }

  function updateDraftStorylineField(field, value) {
    setDraftStoryline((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSaveStoryline() {
    if (!selectedBookId) return;
    if (!draftStoryline.storyline_name.trim()) {
      setSavingState({ loading: false, error: '剧情线名称不能为空。' });
      return;
    }

    setSavingState({ loading: true, error: '' });
    try {
      const created = await saveStoryline(selectedBookId, draftStoryline);
      const savedId = draftStoryline.id || created?.id || '';
      const currentTargets = Array.isArray(draftChapterPlan.target_storylines) ? draftChapterPlan.target_storylines : [];
      const nextPlan = savedId
        ? {
            ...draftChapterPlan,
            main_storyline_id: draftChapterPlan.main_storyline_id || savedId,
            target_storylines: currentTargets.includes(savedId) ? currentTargets : [...currentTargets, savedId]
          }
        : draftChapterPlan;
      if (savedId && !draftStoryline.id) {
        await saveChapterPlan(
          selectedBookId,
          chapterNumber,
          withStructuredChapterPlan(nextPlan, nextPlan.chapter_structure || emptyChapterStructure)
        );
      }
      await reloadChapterSetup(nextPlan);
      setChapterModal(null);
    } catch (saveError) {
      setSavingState({ loading: false, error: saveError.message });
      return;
    }
    setSavingState({ loading: false, error: '' });
  }

  async function handleGenerateChapter() {
    const normalizedPlan = withStructuredChapterPlan(
      draftChapterPlan,
      draftChapterPlan.chapter_structure || emptyChapterStructure
    );
    const chapterStructure = normalizedPlan.chapter_structure || emptyChapterStructure;
    const autoOutline = String(normalizedPlan.outline_text || composeStructuredOutline(chapterStructure)).trim();
    const constraintBrief = buildConstraintBriefText(chapterContext.generationConstraints, constraintOverrides);

    if (missingRequiredItems.length > 0) {
      setGenerationState({
        ...generationState,
        statusKind: 'warning',
        statusTitle: '缺少章节必填信息',
        statusText: `请先补齐：${missingRequiredItems.map((item) => item.label).join('、')}。`
      });
      setActiveStep('chapter');
      return;
    }

    if (generationRiskReview.hasCritical && !generationRiskConfirmed) {
      setGenerationState({
        ...generationState,
        statusKind: 'warning',
        statusTitle: '请先确认高风险放开项',
        statusText: '你已经放开至少一条禁止项。先确认你知道这会明显降低剧情掌控度，再继续生成。'
      });
      return;
    }

    setIsGenerating(true);
    setGenerationState({
      ...generationState,
      statusKind: 'info',
      statusTitle: '正在生成正文',
      statusText: '正在把本章计划送进生成链路。'
    });

    try {
      const chapterTitle = draftChapterPlan.chapter_name
        ? `第 ${chapterNumber} 章 ${draftChapterPlan.chapter_name}`
        : `第 ${chapterNumber} 章`;
      const targetWordCount = getPlanWordCount(normalizedPlan);
      const response = await generateChapterContent({
        bookId: selectedBookId,
        bookTitle: planningState.currentBook.title,
        genre: planningState.currentBook.genre,
        subgenre: planningState.currentBook.subgenre,
        platform: planningState.currentBook.platform,
        template: planningState.currentBook.template,
        chapterNumber,
        wordCount: targetWordCount,
        outline: autoOutline,
        chapterName: normalizedPlan.chapter_name || '',
        chapterTitle,
        chapterPlan: normalizedPlan,
        chapterStructure,
        generationBrief: {
          requiredItems: generationRequiredItems,
          recommendedItems: generationRecommendedItems,
          missingRequiredItems,
          missingRecommendedItems,
          riskItems: generationRiskReview.items.map((item) => ({
            label: item.title,
            value: item.text
          })),
          mainStoryline: selectedMainStorylineLabel,
          targetStorylines: selectedTargetStorylineLabel,
          wordCount: targetWordCount,
          rhythmHints: storylineRhythmHints.map((hint) => hint.text),
          constraintBrief
        },
        promptType: 'chapter'
      });
      const content = response?.content || response?.text || response || '';
      await persistChapterResultCycle({
        content,
        normalizedPlan,
        chapterStructure,
        chapterTitle,
        targetWordCount,
        successTitle: '正文已生成',
        successText: '正文和本章反馈都已写回，下一章会自动读取这份承接信息。',
        openResultModal: true
      });
    } catch (generateError) {
      setGenerationState({
        ...generationState,
        statusKind: 'error',
        statusTitle: '生成失败',
        statusText: generateError.message
      });
    } finally {
      setIsGenerating(false);
    }
  }

  function updateDraftChapterPlanField(field, value) {
    setDraftChapterPlan((prev) => ({ ...prev, [field]: value }));
  }

  function updateChapterStructureField(field, value) {
    setDraftChapterPlan((prev) => {
      const nextStructure = {
        ...(prev.chapter_structure || emptyChapterStructure),
        [field]: value
      };
      return withStructuredChapterPlan(prev, nextStructure);
    });
  }

  function updateGenerationSetting(field, value) {
    setDraftChapterPlan((prev) => ({
      ...prev,
      generation_settings: {
        ...(prev.generation_settings || {}),
        [field]: value
      },
      structured_content: {
        ...(prev.structured_content || {}),
        generation_settings: {
          ...((prev.structured_content || {}).generation_settings || {}),
          [field]: value
        }
      }
    }));
  }

  function toggleTargetStoryline(storylineId) {
    setDraftChapterPlan((prev) => {
      const current = Array.isArray(prev.target_storylines) ? prev.target_storylines : [];
      const next = current.includes(storylineId)
        ? current.filter((id) => id !== storylineId)
        : [...current, storylineId];
      return { ...prev, target_storylines: next };
    });
  }

  function selectMainStoryline(storylineId) {
    setDraftChapterPlan((prev) => {
      const currentTargets = Array.isArray(prev.target_storylines) ? prev.target_storylines : [];
      return {
        ...prev,
        main_storyline_id: storylineId,
        target_storylines: storylineId && !currentTargets.includes(storylineId)
          ? [...currentTargets, storylineId]
          : currentTargets
      };
    });
  }

  function clearStorylineSelection() {
    setDraftChapterPlan((prev) => ({
      ...prev,
      main_storyline_id: '',
      target_storylines: []
    }));
  }

  async function adjustStorylineRange(storyline, field) {
    if (!selectedBookId) return;
    setSavingState({ loading: true, error: '' });
    try {
      await saveStoryline(selectedBookId, {
        id: storyline.id,
        volume_number: storyline.volumeNumber,
        storyline_name: storyline.name,
        storyline_type: storyline.type,
        description: storyline.description,
        core_conflict: storyline.coreConflict,
        start_chapter: field === 'start' ? chapterNumber : storyline.startChapter,
        end_chapter: field === 'end' ? chapterNumber : storyline.endChapter
      });
      await reloadChapterSetup(draftChapterPlan);
    } catch (saveError) {
      setSavingState({ loading: false, error: saveError.message });
      return;
    }
    setSavingState({ loading: false, error: '' });
  }

  const selectedMainStoryline = storylineOptions.find((item) => item.id === draftChapterPlan.main_storyline_id);
  const selectedTargetStorylines = storylineOptions.filter((item) =>
    Array.isArray(draftChapterPlan.target_storylines) && draftChapterPlan.target_storylines.includes(item.id)
  );
  const selectedMainStorylineLabel = selectedMainStoryline
    ? `${selectedMainStoryline.name} 路 ${selectedMainStoryline.type}`
    : chapterView.mainStoryline || '暂未指定';
  const selectedTargetStorylineLabel = selectedTargetStorylines.length > 0
    ? selectedTargetStorylines.map((item) => item.name).join(' / ')
    : chapterView.targetStorylinesLabel || '暂未挂接';
  const chapterStructure = draftChapterPlan.chapter_structure || emptyChapterStructure;
  const generationRequiredItems = [
    { key: 'goal', label: '本章目标', value: chapterStructure.chapter_goal },
    { key: 'scenes', label: '关键场景', value: chapterStructure.key_scenes },
    { key: 'ending', label: '结尾钩子', value: chapterStructure.ending_hook || draftChapterPlan.ending_hook }
  ];
  const generationRecommendedItems = [
    { key: 'conflict', label: '冲突升级', value: chapterStructure.conflict_escalation },
    { key: 'character', label: '角色变化', value: chapterStructure.character_change },
    { key: 'payoff', label: '情绪落点', value: chapterStructure.reader_payoff },
    { key: 'storyline', label: '剧情线承接', value: selectedTargetStorylines.length > 0 ? selectedTargetStorylineLabel : '' }
  ];
  const missingRequiredItems = generationRequiredItems.filter((item) => !hasText(item.value));
  const missingRecommendedItems = generationRecommendedItems.filter((item) => !hasText(item.value));
  const revisionOriginalParagraphs = normalizeParagraphs(revisionOriginal);
  const revisionSuggestionItems = Array.isArray(revisionSuggestions?.suggestions) ? revisionSuggestions.suggestions : [];
  const revisionSuggestionMarks = revisionSuggestionItems.reduce((acc, item) => {
    const action = String(item?.action || '').trim();
    const paragraph = Number(item?.paragraph || 0);
    const afterParagraph = Number(item?.afterParagraph || item?.paragraph || 0);
    if (action === 'replace' && paragraph > 0) {
      acc.replaceByParagraph.set(paragraph, item);
    } else if (action === 'delete' && paragraph > 0) {
      acc.deleteByParagraph.set(paragraph, item);
    } else if (action === 'insert_after' && afterParagraph > 0) {
      if (!acc.insertAfterParagraph.has(afterParagraph)) {
        acc.insertAfterParagraph.set(afterParagraph, []);
      }
      acc.insertAfterParagraph.get(afterParagraph).push(item);
    }
    return acc;
  }, {
    replaceByParagraph: new Map(),
    deleteByParagraph: new Map(),
    insertAfterParagraph: new Map()
  });
  const revisionChangeItems = revisionOriginalParagraphs.reduce((items, _, index) => {
    const paragraphNumber = index + 1;
    if (revisionSuggestionMarks.replaceByParagraph.has(paragraphNumber)) {
      items.push({
        key: `replace-${paragraphNumber}`,
        kind: 'replace',
        paragraphNumber,
        label: `第 ${paragraphNumber} 段修改`
      });
    }
    if (revisionSuggestionMarks.deleteByParagraph.has(paragraphNumber)) {
      items.push({
        key: `delete-${paragraphNumber}`,
        kind: 'delete',
        paragraphNumber,
        label: `第 ${paragraphNumber} 段删除`
      });
    }
    const insertSuggestions = revisionSuggestionMarks.insertAfterParagraph.get(paragraphNumber) || [];
    insertSuggestions.forEach((item, insertIndex) => {
      items.push({
        key: `insert-${paragraphNumber}-${insertIndex}`,
        kind: 'insert',
        paragraphNumber,
        label: `第 ${paragraphNumber} 段后新增`
      });
    });
    return items;
  }, []);
  const revisionCurrentFocusIndex = revisionChangeItems.length > 0
    ? Math.min(revisionFocusIndex, revisionChangeItems.length - 1)
    : 0;
  const revisionCurrentChange = revisionChangeItems[revisionCurrentFocusIndex] || null;
  const generationReadiness = missingRequiredItems.length > 0
    ? {
        kind: 'warning',
        title: '生成前还有必填信息缺失',
        text: `建议先补齐：${missingRequiredItems.map((item) => item.label).join('、')}。`
      }
    : missingRecommendedItems.length > 0
      ? {
          kind: 'warning',
          title: '可以生成，但建议再补充',
          text: `建议补充：${missingRecommendedItems.map((item) => item.label).join('、')}。`
        }
      : {
          kind: 'success',
          title: '生成简报已就绪',
          text: '本章目标、关键场景、冲突推进和收尾信息都已就位。'
      };
  const generationRiskReview = buildGenerationRiskReview(
    draftChapterPlan,
    chapterContext.generationConstraints,
    constraintOverrides
  );
  const storylineRhythmHints = selectedTargetStorylines
    .map((storyline) => {
      if (chapterNumber < storyline.startChapter) {
        return {
          id: storyline.id,
          text: storyline.name + ' 预计从第 ' + storyline.startChapter + ' 章开始，现在提前使用，适合做伏笔或预热。',
          actionLabel: '改为本章启动',
          actionField: 'start',
          storyline
        };
      }
      if (chapterNumber > storyline.endChapter) {
        return {
          id: storyline.id,
          text: storyline.name + ' 预计第 ' + storyline.endChapter + ' 章前后收束，现在继续使用，建议确认是否延后回收。',
          actionLabel: '延后到本章',
          actionField: 'end',
          storyline
        };
      }
      return {
        id: storyline.id,
        text: storyline.name + ' 正处在预计活跃范围内。',
        actionLabel: '',
        actionField: '',
        storyline
      };
    });

  return (
    <main className="app-shell">
      <header className="hero-section">
        <div>
          <span className="hero-eyebrow">React Workbench Prototype</span>
          <h1>创作台新架构</h1>
          <p>这一版先把全书规划、单章设置、正文生成收拢成一个清晰的业务区，继续复用现有后端接口。</p>
        </div>
        <div className="hero-note-card">
          <strong>当前阶段</strong>
          <p>先保证 React 工作台能稳定读写，再继续补复杂交互。</p>
        </div>
      </header>

      <WorkflowTabs activeStep={activeStep} onChange={setActiveStep} />

      {error ? <div className="global-banner is-error">{error}</div> : null}
      {loadingBooks ? <div className="global-banner">正在读取书籍列表...</div> : null}
      <section className="workbench-stage">
        {activeStep === 'book' ? (
          <div className="panel-grid panel-grid-book">
            <PanelCard
              className="book-planning-card book-planning-card-entry"
              eyebrow=""
              title=""
              description=""
            >
              <div className="book-planning-entry-badge">书籍操作</div>
              <div className="book-planning-entry-row">
                <button
                  type="button"
                  className="solid-btn action-btn"
                  onClick={() => { window.location.href = '/books?action=create'; }}
                >
                  新建书籍
                </button>
                <button
                  type="button"
                  className="ghost-btn nav-btn"
                  onClick={() => {
                    const target = selectedBookId ? `/books?bookId=${encodeURIComponent(selectedBookId)}` : '/books';
                    window.location.href = target;
                  }}
                  disabled={!selectedBookId}
                >
                  编辑书籍
                </button>
                <label className="select-wrap book-planning-entry-select">
                  <select
                    className="book-select"
                    value={selectedBookId}
                    onChange={(event) => setSelectedBookId(event.target.value)}
                    disabled={loadingBooks || books.length === 0}
                  >
                    {books.length === 0 ? <option value="">暂无书籍</option> : null}
                    {books.map((book) => (
                      <option key={book.id} value={book.id}>{book.title}</option>
                    ))}
                  </select>
                </label>
              </div>
            </PanelCard>

            <PanelCard
              className="book-planning-card book-planning-card-book"
              eyebrow="书籍"
              title={planningState.currentBook.title || '未命名书籍'}
              description=""
            >
              <div className="book-planning-hero">
                <div className="book-planning-cover-frame">
                  <img
                    className="book-planning-cover-image"
                    src={planningState.currentBook.coverImage || createBookCoverDataUrl(planningState.currentBook.title)}
                    alt={`${planningState.currentBook.title}封面示意图`}
                  />
                </div>
                <div className="book-planning-book-copy">
                  <p>{planningState.currentBook.author ? `作者：${planningState.currentBook.author}` : '作者：未填写'}</p>
                  <div className="book-planning-book-summary-card">
                    <span className="book-planning-book-summary-label">书籍简介</span>
                    <p>{planningState.currentBook.description || '这本书的基础设定和定位会从这里开始进入后续创作链路。'}</p>
                  </div>
                </div>
                <div className="book-planning-meta-grid">
                  <div className="book-planning-meta-item">
                    <span>平台</span>
                    <strong>{PLATFORM_LABELS[planningState.currentBook.platform] || planningState.currentBook.platform || '未设置'}</strong>
                  </div>
                  <div className="book-planning-meta-item">
                    <span>题材</span>
                    <strong>{GENRE_LABELS[planningState.currentBook.genre] || planningState.currentBook.genre || '未设置'}</strong>
                  </div>
                  <div className="book-planning-meta-item">
                    <span>子分类</span>
                    <strong>{SUBGENRE_LABELS[planningState.currentBook.subgenre] || planningState.currentBook.subgenre || '未设置'}</strong>
                  </div>
                  <div className="book-planning-meta-item">
                    <span>写法模板</span>
                    <strong>{TEMPLATE_LABELS[planningState.currentBook.template] || planningState.currentBook.template || '未设置'}</strong>
                  </div>
                </div>
              </div>
            </PanelCard>

            <PanelCard
              className="book-planning-card book-planning-card-character"
              eyebrow="角色"
              title="主要角色"
              description=""
            >
              <div className="book-planning-character-list">
                {(planningState.bookPlanning.characters || []).slice(0, 6).map((character) => (
                  <article key={character.id || character.name} className="book-planning-character-card character-card-standard">
                    <img
                      className="book-planning-character-avatar"
                      src={character.avatar_image || createCharacterBadgeDataUrl(character.name)}
                      alt={`${character.name}头像示意图`}
                    />
                    <div className="book-planning-character-copy">
                      <strong>{character.name}</strong>
                      <p>{buildCharacterSubtitle(character)}</p>
                    </div>
                  </article>
                ))}
                {(planningState.bookPlanning.characters || []).length === 0 ? (
                  <div className="book-planning-empty-note">
                    <p className="summary-state">暂无主体角色明细</p>
                  </div>
                ) : (
                  null
                )}
              </div>
            </PanelCard>

            <PanelCard
              className="book-planning-card book-planning-card-outline"
              eyebrow="大纲"
              title="分卷概览"
              description=""
            >
              <div className="book-planning-outline-layout">
                <div className="book-planning-volume-grid">
                  {(planningState.bookPlanning.volumePlans || []).slice(0, 6).map((plan) => (
                    <article key={plan.id || plan.volumeNumber} className="book-planning-volume-card">
                      <img
                        className="book-planning-volume-image"
                        src={plan.cover_image || createVolumePosterDataUrl(`第${plan.volumeNumber}卷`)}
                        alt={`第${plan.volumeNumber}卷示意图`}
                      />
                      <div className="book-planning-volume-copy">
                        <strong>{`第 ${plan.volumeNumber} 卷`}</strong>
                        <p>{plan.volume_name || '未命名分卷'}</p>
                      </div>
                    </article>
                  ))}
                </div>
                {(planningState.bookPlanning.volumePlans || []).length === 0 ? (
                  <div className="book-planning-empty-note">
                    <p className="summary-state">暂无分卷信息</p>
                  </div>
                ) : (
                  null
                )}
              </div>
            </PanelCard>
          </div>
        ) : null}

        {activeStep === 'chapter' ? (
          <div className="panel-grid panel-grid-chapter">
            <PanelCard
              eyebrow="章节入口"
              title={'第 ' + chapterNumber + ' 章 · ' + (draftChapterPlan.chapter_name || '未命名章节')}
              description="这一层只处理本章要写什么。"
            >
              <div className="chapter-control-row">
                <label className="editor-field chapter-number-field">
                  <span>当前章号</span>
                  <input
                    className="chapter-number-input"
                    type="number"
                    min="1"
                    value={chapterNumber}
                    onChange={(event) => setChapterNumber(Math.max(1, Number(event.target.value) || 1))}
                  />
                </label>
                <div className="chapter-context-note">{loadingChapter ? '正在读取本章计划...' : chapterContext.latestChapterLabel}</div>
              </div>
              <ul className="meta-list">
                <li>当前卷：{chapterView.volumeLabel || '第 1 卷'}</li>
                <li>主剧情线：{selectedMainStorylineLabel}</li>
                <li>章节任务：{draftChapterPlan.chapter_mission || '建议补充本章推进目标'}</li>
                <li>情绪目标：{draftChapterPlan.emotion_target || '建议补充本章情绪方向'}</li>
              </ul>
              {(chapterContext.previousFeedbackLabel || chapterContext.previousFeedbackFocus) ? (
                <div className="chapter-feedback-carryover">
                  <span>上一章反馈</span>
                  {chapterContext.previousFeedbackLabel ? <p>{chapterContext.previousFeedbackLabel}</p> : null}
                  {chapterContext.previousFeedbackFocus ? <p>{chapterContext.previousFeedbackFocus}</p> : null}
                </div>
              ) : null}
            </PanelCard>

            <PanelCard
              eyebrow="卷与剧情线"
              title="本章承接哪一层推进"
              description="主线像本章主任务，关联线像顺手推进的支线。"
              actions={
                <>
                  <button type="button" className="ghost-btn" onClick={openStorylineCreator} disabled={!selectedBookId}>
                    新建剧情线
                  </button>
                  <button type="button" className="ghost-btn" onClick={clearStorylineSelection} disabled={!selectedBookId || selectedTargetStorylines.length === 0}>
                    清空选择
                  </button>
                  <button type="button" className="solid-btn" onClick={handleSaveChapterPlan} disabled={!selectedBookId || savingState.loading}>
                    保存剧情线选择
                  </button>
                </>
              }
            >
              <ul className="meta-list">
                <li>卷级定位：{chapterView.volumeLabel || '第 1 卷'}</li>
                <li>卷内目标：{chapterView.volumeSummary || '暂无卷级说明'}</li>
                <li>主剧情线：{selectedMainStorylineLabel}</li>
                <li>关联剧情线：{selectedTargetStorylineLabel}</li>
              </ul>
              <div className="storyline-picker">
                <label className="editor-field">
                  <span>主推进剧情线</span>
                  <select
                    className="book-select storyline-select"
                    value={draftChapterPlan.main_storyline_id}
                    onChange={(event) => selectMainStoryline(event.target.value)}
                    disabled={storylineOptions.length === 0}
                  >
                    <option value="">暂不指定</option>
                    {storylineOptions.map((storyline) => (
                      <option key={storyline.id} value={storyline.id}>
                        第 {storyline.volumeNumber} 卷 · {storyline.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="editor-field">
                  <span>关联剧情线</span>
                  {storylineOptions.length > 0 ? (
                    <div className="storyline-checkbox-list">
                      {storylineOptions.map((storyline) => (
                        <label key={storyline.id} className="storyline-checkbox-item">
                          <input
                            type="checkbox"
                            checked={Array.isArray(draftChapterPlan.target_storylines) && draftChapterPlan.target_storylines.includes(storyline.id)}
                            onChange={() => toggleTargetStoryline(storyline.id)}
                          />
                          <span>
                            第 {storyline.volumeNumber} 卷 · {storyline.name}
                            <em>{storyline.type} · 预计第 {storyline.startChapter}-{storyline.endChapter} 章</em>
                          </span>
                          <button
                            type="button"
                            className="inline-link-btn storyline-edit-btn"
                            onClick={(event) => {
                              event.preventDefault();
                              openStorylineEditor(storyline);
                            }}
                          >
                            编辑
                          </button>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="excerpt-text">当前书籍还没有剧情线。可以先用演示书籍测试，再继续接剧情线创建入口。</p>
                  )}
                </div>
                {storylineRhythmHints.length > 0 ? (
                  <div className="storyline-rhythm-hints">
                    <span>节奏提示</span>
                    {storylineRhythmHints.map((hint) => (
                      <div key={hint.id} className="storyline-rhythm-hint-row">
                        <p>{hint.text}</p>
                        {hint.actionLabel ? (
                          <button
                            type="button"
                            className="inline-link-btn storyline-rhythm-action"
                            onClick={() => adjustStorylineRange(hint.storyline, hint.actionField)}
                            disabled={savingState.loading}
                          >
                            {hint.actionLabel}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </PanelCard>

            <PanelCard
              eyebrow="章节大纲"
              title="本章计划说明"
              description="正文生成前最重要的信息。"
              actions={<button type="button" className="solid-btn" onClick={() => setChapterModal('outline')}>编辑大纲</button>}
            >
              <span className="info-chip info-chip-required">必要信息</span>
              <p className="summary-state">{draftChapterPlan.outline_text ? '已填写' : '未填写'}</p>
              {draftChapterPlan.outline_text ? (
                <div className="structured-outline-summary">
                  <p><strong>本章目标：</strong>{draftChapterPlan.chapter_structure?.chapter_goal || draftChapterPlan.chapter_mission || '未填写'}</p>
                  <p><strong>关键场景：</strong>{draftChapterPlan.chapter_structure?.key_scenes || '未填写'}</p>
                  <p><strong>冲突升级：</strong>{draftChapterPlan.chapter_structure?.conflict_escalation || '未填写'}</p>
                  <p><strong>结尾钩子：</strong>{draftChapterPlan.chapter_structure?.ending_hook || draftChapterPlan.ending_hook || '未填写'}</p>
                </div>
              ) : (
                <p className="excerpt-text">还没有章节任务表。建议先写本章目标、关键场景、冲突升级和结尾钩子。</p>
              )}
            </PanelCard>

            <PanelCard
              eyebrow="章节角色"
              title="本章出场角色"
              description="有人物变化或新角色登场时再补。"
              actions={<button type="button" className="solid-btn" onClick={() => setChapterModal('character')}>编辑角色</button>}
            >
              <span className="info-chip info-chip-optional">建议信息</span>
              <p className="summary-state">{draftChapterPlan.character_notes ? '已补充' : '可留空'}</p>
              <p className="excerpt-text">{draftChapterPlan.character_notes || '还没有本章角色说明。'}</p>
              {Array.isArray(draftChapterPlan.role_execution) && draftChapterPlan.role_execution.length > 0 ? (
                <div className="structured-outline-summary">
                  {draftChapterPlan.role_execution.slice(0, 3).map((item, index) => (
                    <div key={`${item.role || 'role'}-${index}`} className="role-execution-summary-item">
                      <p>
                        <strong>{item.role || '未命名角色'}：</strong>
                        {item.chapter_function || item.allowed_change || '本章角色执行要求待补充'}
                      </p>
                      <p className="summary-meta-text">{describeRoleExecutionMeta(item)}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </PanelCard>
          </div>
        ) : null}

        {activeStep === 'generate' ? (
          <div className="panel-grid panel-grid-generation">
            <PanelCard
              eyebrow="生成前"
              title={'开始第 ' + chapterNumber + ' 章'}
              description="按第二步的章节计划生成正文，这里只处理生成控制与生成前检查。"
              actions={
                <>
                  <button type="button" className="ghost-btn" onClick={() => setPromptPreviewOpen(true)}>查看生成摘要</button>
                  <button
                    type="button"
                    className="solid-btn"
                    onClick={handleGenerateChapter}
                    disabled={isGenerating || (generationRiskReview.hasCritical && !generationRiskConfirmed)}
                  >
                    {isGenerating ? '正在生成...' : '生成章节'}
                  </button>
                </>
              }
            >
              <div className="generation-chapter-switcher">
                <button type="button" className="ghost-btn" onClick={goToPreviousChapter} disabled={chapterNumber <= 1 || loadingChapter || isGenerating}>
                  上一章
                </button>
                <label className="editor-field generation-chapter-number-field">
                  <span>当前章号</span>
                  <input
                    className="chapter-number-input"
                    type="number"
                    min="1"
                    value={chapterNumber}
                    onChange={(event) => setChapterNumber(Math.max(1, Number(event.target.value) || 1))}
                    disabled={loadingChapter || isGenerating}
                  />
                </label>
                <button type="button" className="ghost-btn" onClick={goToNextChapter} disabled={loadingChapter || isGenerating}>
                  下一章
                </button>
              </div>
              <section className={'inline-status-banner is-' + generationReadiness.kind}>
                <strong>{generationReadiness.title}</strong>
                <span>{generationReadiness.text}</span>
              </section>
              <div className="generation-settings-row">
                <label className="editor-field generation-word-count-field">
                  <span>目标字数</span>
                  <input
                    className="chapter-number-input"
                    type="number"
                    min="500"
                    max="10000"
                    step="500"
                    value={getPlanWordCount(draftChapterPlan)}
                    onChange={(event) => updateGenerationSetting('word_count', Math.min(10000, Math.max(500, Number(event.target.value) || 3000)))}
                    disabled={loadingChapter || isGenerating}
                  />
                </label>
              </div>
              {renderBlockedConstraints(
                chapterContext.generationConstraints,
                constraintOverrides,
                setConstraintOverride
              )}
              {generationRiskReview.items.length > 0 ? (
                <div className="generation-risk-review">
                  <div className="generation-risk-review-head">
                    <span>关键控制端点</span>
                    <p>这些地方一旦放松，最容易让章节失控、空降大设定或把人物推得过头。</p>
                  </div>
                  <div className="generation-risk-review-list">
                    {generationRiskReview.items.map((item, index) => (
                      <article key={`${item.title}-${index}`} className={`generation-risk-item is-${item.level}`}>
                        <strong>{item.title}</strong>
                        <p>{item.text}</p>
                        <p className="generation-risk-action">{item.action}</p>
                      </article>
                    ))}
                  </div>
                  {generationRiskReview.hasCritical ? (
                    <label className="generation-risk-confirm">
                      <input
                        type="checkbox"
                        checked={generationRiskConfirmed}
                        onChange={(event) => setGenerationRiskConfirmed(event.target.checked)}
                        disabled={isGenerating}
                      />
                      <span>我确认：本章已主动放开高风险禁止项，接受剧情掌控度会明显下降。</span>
                    </label>
                  ) : null}
                </div>
              ) : null}
              <div className="generation-brief">
                <div className="summary-group">
                  <p className="summary-group-title">计划引用</p>
                  <p className="excerpt-text">本次会直接按第二步已保存的章节计划生成；如需改目标、场景、角色或钩子，请先回第二步调整。</p>
                </div>
                <div className="summary-group">
                  <p className="summary-group-title">必填信息</p>
                  <div className="brief-check-list">
                    {generationRequiredItems.map((item) => (
                      <span key={item.key} className={'brief-check-item' + (hasText(item.value) ? ' is-ready' : ' is-missing')}>
                        {item.label}：{hasText(item.value) ? '已填写' : '未填写'}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="summary-group">
                  <p className="summary-group-title">建议补充</p>
                  <div className="brief-check-list">
                    {generationRecommendedItems.map((item) => (
                      <span key={item.key} className={'brief-check-item' + (hasText(item.value) ? ' is-ready' : ' is-missing')}>
                        {item.label}：{hasText(item.value) ? '已填写' : '可补充'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </PanelCard>

            <PanelCard
              eyebrow="生成后"
              title={generationState.hasContent ? '正文与下一章衔接' : '生成结果'}
              description="这里集中查看正文结果和下一章承接。"
              actions={<button type="button" className="solid-btn" onClick={openRevisionEditor} disabled={!generationState.hasContent}>查看/校改正文</button>}
            >
              <p className="summary-state">{generationState.metaText}</p>
              <p className="summary-substate">{generationState.wordCountLabel}</p>
              <p className="excerpt-text preview-excerpt-text">{generationState.previewText}</p>
              <span className="info-chip info-chip-optional">反馈来源：本地整理</span>
              <p className="excerpt-text">{generationState.feedbackSummary}</p>
              <p className="excerpt-text">{generationState.feedbackFocus}</p>
            </PanelCard>
          </div>
        ) : null}
      </section>

      {chapterModal === 'outline' ? (
        <Modal
          title={'编辑第 ' + chapterNumber + ' 章任务表'}
          description="把本章目标、关键场景、冲突升级和结尾钩子拆开写。系统会自动合成旧版章节大纲文本。"
          onClose={() => setChapterModal(null)}
          actions={
            <>
              {savingState.error ? <div className="modal-error">{savingState.error}</div> : null}
              <button type="button" className="ghost-btn" onClick={() => setChapterModal(null)}>取消</button>
              <button type="button" className="solid-btn" onClick={handleSaveChapterOutline} disabled={savingState.loading}>
                {savingState.loading ? '正在保存...' : '保存章节任务表'}
              </button>
            </>
          }
        >
          <div className="chapter-task-editor">
            <label className="editor-field">
              <span>章名</span>
              <input className="chapter-number-input text-input" value={draftChapterPlan.chapter_name} onChange={(event) => updateDraftChapterPlanField('chapter_name', event.target.value)} />
            </label>
            <label className="editor-field">
              <span>本章目标</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftChapterPlan.chapter_structure?.chapter_goal || ''}
                onChange={(event) => updateChapterStructureField('chapter_goal', event.target.value)}
                placeholder="这一章必须完成什么推进？例如：逼主角首次公开动用禁血之力。"
              />
            </label>
            <label className="editor-field editor-field-full">
              <span>章节摘要</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftChapterPlan.summary || ''}
                onChange={(event) => updateDraftChapterPlanField('summary', event.target.value)}
                placeholder="用一小段话概括本章实际会发生什么。"
              />
            </label>
            <label className="editor-field">
              <span>读者爽点 / 情绪落点</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftChapterPlan.chapter_structure?.reader_payoff || ''}
                onChange={(event) => updateChapterStructureField('reader_payoff', event.target.value)}
                placeholder="这一章要给读者什么情绪？例如：压抑、反杀、危机升级、关系撕裂。"
              />
            </label>
            <label className="editor-field editor-field-full">
              <span>承接上一章</span>
              <textarea className="modal-textarea modal-textarea-compact" value={draftChapterPlan.previous_hook} onChange={(event) => updateDraftChapterPlanField('previous_hook', event.target.value)} />
            </label>
            <label className="editor-field editor-field-full">
              <span>关键场景</span>
              <textarea
                className="modal-textarea"
                value={draftChapterPlan.chapter_structure?.key_scenes || ''}
                onChange={(event) => updateChapterStructureField('key_scenes', event.target.value)}
                placeholder="一行一个场景。例如：荒原伏击压出危机；护人暴露能力；远处祭坛感应血月。"
              />
            </label>
            <label className="editor-field">
              <span>冲突升级</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftChapterPlan.chapter_structure?.conflict_escalation || ''}
                onChange={(event) => updateChapterStructureField('conflict_escalation', event.target.value)}
                placeholder="这一章如何让矛盾变得更危险？"
              />
            </label>
            <label className="editor-field">
              <span>角色变化</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftChapterPlan.chapter_structure?.character_change || ''}
                onChange={(event) => updateChapterStructureField('character_change', event.target.value)}
                placeholder="人物立场、关系、状态或认知发生什么变化？"
              />
            </label>
            <label className="editor-field editor-field-full">
              <span>本章出场角色</span>
              <textarea
                className="modal-textarea"
                value={normalizeRoleList(draftChapterPlan.appearing_roles).join('\n')}
                onChange={(event) => updateDraftChapterPlanField('appearing_roles', normalizeLines(event.target.value))}
                placeholder="每行一个角色名，或简单写角色组合。"
              />
            </label>
            <label className="editor-field editor-field-full">
              <span>结尾钩子</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftChapterPlan.chapter_structure?.ending_hook || ''}
                onChange={(event) => updateChapterStructureField('ending_hook', event.target.value)}
                placeholder="这一章最后把读者钩在哪个点上？"
              />
            </label>
            <section className="outline-preview-block editor-field-full">
              <span>自动合成的大纲预览</span>
              <pre className="modal-pre">{draftChapterPlan.outline_text || '填完上面的结构化字段后，这里会自动生成章节大纲文本。'}</pre>
            </section>
            <label className="editor-field editor-field-full">
              <span>原始大纲微调</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftChapterPlan.outline_text}
                onChange={(event) => updateDraftChapterPlanField('outline_text', event.target.value)}
                placeholder="一般不需要手改。只有想覆盖自动合成文本时再改这里。"
              />
            </label>
          </div>
        </Modal>
      ) : null}

      {chapterModal === 'character' ? (
        <Modal
          title={'编辑第 ' + chapterNumber + ' 章角色'}
          description="只写这一章真正会出场、会影响推进的人物。"
          onClose={() => setChapterModal(null)}
          actions={
            <>
              {savingState.error ? <div className="modal-error">{savingState.error}</div> : null}
              <button type="button" className="ghost-btn" onClick={() => setChapterModal(null)}>取消</button>
              <button type="button" className="solid-btn" onClick={handleSaveChapterPlan} disabled={savingState.loading}>
                {savingState.loading ? '正在保存...' : '保存本章角色'}
              </button>
            </>
          }
        >
          <div className="outline-preview-stack">
            <textarea
              className="modal-textarea"
              value={draftChapterPlan.character_notes}
              onChange={(event) => updateDraftChapterPlanField('character_notes', event.target.value)}
              placeholder="例如：主角当前状态、关键配角立场、新增人物的作用。"
            />
            <section className="outline-preview-block editor-field-full">
              <span>章节角色执行层（v2）</span>
              <pre className="modal-pre">
                {Array.isArray(draftChapterPlan.role_execution) && draftChapterPlan.role_execution.length > 0
                  ? draftChapterPlan.role_execution.map((item) => [
                    `角色：${item.role || '未命名角色'}`,
                    `当前底色：${item.baseline || '未填写'}`,
                    `本章功能：${item.chapter_function || '未填写'}`,
                    `参数层：${describeRoleExecutionMeta(item)}`,
                    `允许变化：${item.allowed_change || '未填写'}`,
                    `禁止变化：${item.forbidden_change || '未填写'}`
                  ].join('\n')).join('\n\n')
                  : '当前还没有角色执行拆解。系统会先按出场角色生成兜底版本，后续再接模型生成草稿。'}
              </pre>
            </section>
          </div>
        </Modal>
      ) : null}

      {chapterModal === 'storyline' ? (
        <Modal
          title={draftStoryline.id ? '编辑剧情线' : '新建剧情线'}
          description={draftStoryline.id
            ? '调整这条剧情线的预计节奏和核心冲突。章节范围只作参考，不会强制限制使用。'
            : '先创建这本书的一条主线或支线，然后自动挂到当前章节。章节范围只作节奏参考，不会强制限制剧情线使用。'}
          onClose={() => setChapterModal(null)}
          actions={
            <>
              {savingState.error ? <div className="modal-error">{savingState.error}</div> : null}
              <button type="button" className="ghost-btn" onClick={() => setChapterModal(null)}>取消</button>
              <button type="button" className="solid-btn" onClick={handleSaveStoryline} disabled={savingState.loading}>
                {savingState.loading
                  ? '正在保存...'
                  : draftStoryline.id ? '保存剧情线' : '创建并挂到当前章节'}
              </button>
            </>
          }
        >
          <div className="storyline-editor-grid">
            <label className="editor-field editor-field-full">
              <span>剧情线名称</span>
              <input
                className="chapter-number-input text-input"
                value={draftStoryline.storyline_name}
                onChange={(event) => updateDraftStorylineField('storyline_name', event.target.value)}
                placeholder="例如：血月之力暴露线"
              />
            </label>
            <label className="editor-field">
              <span>剧情线类型</span>
              <select
                className="book-select storyline-select"
                value={draftStoryline.storyline_type}
                onChange={(event) => updateDraftStorylineField('storyline_type', event.target.value)}
              >
                <option value="main">主线</option>
                <option value="branch">支线</option>
                <option value="emotion">情感线</option>
                <option value="conflict">冲突线</option>
              </select>
            </label>
            <label className="editor-field">
              <span>所属卷号</span>
              <input
                className="chapter-number-input text-input"
                type="number"
                min="1"
                value={draftStoryline.volume_number}
                onChange={(event) => updateDraftStorylineField('volume_number', Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
            <label className="editor-field">
              <span>预计起始章</span>
              <input
                className="chapter-number-input text-input"
                type="number"
                min="1"
                value={draftStoryline.start_chapter}
                onChange={(event) => updateDraftStorylineField('start_chapter', Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
            <label className="editor-field">
              <span>预计结束章</span>
              <input
                className="chapter-number-input text-input"
                type="number"
                min="1"
                value={draftStoryline.end_chapter}
                onChange={(event) => updateDraftStorylineField('end_chapter', Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
            <label className="editor-field editor-field-full">
              <span>节奏说明</span>
              <p className="form-helper-text">
                这里填的是预计活跃范围。后续如果剧情提前爆发、延后回收或需要拆分，可以再调整，不会卡住正文生成。
              </p>
            </label>
            <label className="editor-field editor-field-full">
              <span>核心冲突</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftStoryline.core_conflict}
                onChange={(event) => updateDraftStorylineField('core_conflict', event.target.value)}
                placeholder="例如：主角越想隐藏力量，越会被逼在救人时暴露。"
              />
            </label>
            <label className="editor-field editor-field-full">
              <span>简要说明</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftStoryline.description}
                onChange={(event) => updateDraftStorylineField('description', event.target.value)}
                placeholder="这条线主要推进什么、牵涉哪些人物、最后落到什么结果。"
              />
            </label>
          </div>
        </Modal>
      ) : null}

      {resultModalOpen ? (
        <Modal
          title={'第 ' + chapterNumber + ' 章正文校改'}
          description="直接修改当前章节正文，保存后会写回章节记录。"
          onClose={() => setResultModalOpen(false)}
          actions={
            <>
              {revisionError ? <div className="modal-error">{revisionError}</div> : null}
              {revisionNotice ? <div className="modal-success">{revisionNotice}</div> : null}
              <button type="button" className="ghost-btn" onClick={() => setResultModalOpen(false)}>取消</button>
              <button type="button" className="ghost-btn" onClick={handlePolishRevision} disabled={revisionPolishing || revisionSaving}>
                {revisionPolishing ? '正在分析...' : '生成局部建议'}
              </button>
              <button type="button" className="solid-btn" onClick={handleSaveRevision} disabled={revisionSaving}>
                {revisionSaving ? '正在保存...' : '保存校改'}
              </button>
            </>
          }
        >
          <div className="revision-editor">
            <label className="editor-field">
              <span>校改目标</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={revisionRequirement}
                onChange={(event) => setRevisionRequirement(event.target.value)}
                placeholder="例如：增强画面感、删除重复解释、加强结尾钩子。"
              />
            </label>
            <div className="revision-editor-meta">
              <span>原文 {revisionOriginal.length} 字</span>
              <span>校改稿 {revisionDraft.length} 字</span>
              <span>{generationState.metaText}</span>
            </div>
            {revisionChangeItems.length > 0 ? (
              <div className="revision-change-nav">
              <div className="revision-change-nav-info">
                  <strong>修改导航</strong>
                  <span>{revisionCurrentChange ? revisionCurrentChange.label : '已找到修改点'}</span>
                  <em>{revisionCurrentFocusIndex + 1} / {revisionChangeItems.length}</em>
                </div>
                <div className="revision-change-nav-actions">
                  <button type="button" className="ghost-btn" onClick={() => focusRevisionChange(-1)}>
                    上一处修改
                  </button>
                  <button type="button" className="ghost-btn" onClick={() => focusRevisionChange(1)}>
                    下一处修改
                  </button>
                </div>
              </div>
            ) : null}
            <section className="revision-original-panel">
              <div className="revision-original-head">
                <span>原文标注</span>
                <em>{revisionOriginal.length} 字</em>
              </div>
              <div className="revision-original-list">
                {revisionOriginalParagraphs.length > 0 ? revisionOriginalParagraphs.map((paragraph, index) => {
                  const paragraphNumber = index + 1;
                  const replaceSuggestion = revisionSuggestionMarks.replaceByParagraph.get(paragraphNumber);
                  const deleteSuggestion = revisionSuggestionMarks.deleteByParagraph.get(paragraphNumber);
                  const insertSuggestions = revisionSuggestionMarks.insertAfterParagraph.get(paragraphNumber) || [];
                  const hasReplace = !!replaceSuggestion;
                  const hasDelete = !!deleteSuggestion;
                  const hasInsert = insertSuggestions.length > 0;
                  const changeKey = hasDelete
                    ? 'delete-' + paragraphNumber
                    : hasReplace
                      ? 'replace-' + paragraphNumber
                      : null;
                  const insertChangeKeys = insertSuggestions.map((_, insertIndex) => 'insert-' + paragraphNumber + '-' + insertIndex);
                  const isCurrentChange = changeKey && revisionCurrentChange?.key === changeKey;
                  const originalText = paragraph || '（空段）';
                  return (
                    <Fragment key={index + '-' + paragraph.slice(0, 16)}>
                      <article
                        className={'revision-original-paragraph' + (hasReplace ? ' is-replace' : '') + (hasDelete ? ' is-delete' : '') + (isCurrentChange ? ' is-revision-focus' : '')}
                        ref={(element) => {
                          registerRevisionChangeRef(changeKey, element);
                          registerRevisionParagraphRef(paragraphNumber, element);
                        }}
                      >
                        <div className="revision-original-paragraph-head">
                          <span className="revision-paragraph-tag">第 {paragraphNumber} 段</span>
                          <div className="revision-paragraph-badges">
                            {hasReplace ? <strong className="revision-paragraph-badge is-replace">修改</strong> : null}
                            {hasDelete ? <strong className="revision-paragraph-badge is-delete">删除</strong> : null}
                            {!hasReplace && !hasDelete && hasInsert ? <strong className="revision-paragraph-badge is-insert">新增</strong> : null}
                          </div>
                          <div className="revision-paragraph-actions">
                            {replaceSuggestion ? (
                              <button
                                type="button"
                                className="ghost-btn"
                                disabled={revisionAppliedChangeKeys.includes(changeKey)}
                                onClick={() => applyRevisionSuggestion(replaceSuggestion, changeKey)}
                              >
                                {revisionAppliedChangeKeys.includes(changeKey) ? '已应用修改' : '应用修改'}
                              </button>
                            ) : null}
                            {deleteSuggestion ? (
                              <button
                                type="button"
                                className="ghost-btn"
                                disabled={revisionAppliedChangeKeys.includes(changeKey)}
                                onClick={() => applyRevisionSuggestion(deleteSuggestion, changeKey)}
                              >
                                {revisionAppliedChangeKeys.includes(changeKey) ? '已应用删除' : '应用删除'}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        {hasDelete ? (
                          <div className="revision-original-change is-delete">
                            <p className="revision-original-change-original"><s>{originalText}</s></p>
                            <p className="revision-original-change-new">（删除后保留空段）</p>
                          </div>
                        ) : hasReplace ? (
                          <div className="revision-original-change is-replace">
                            <p className="revision-original-change-original"><s>{originalText}</s></p>
                            <p className="revision-original-change-new">{replaceSuggestion.suggested_text}</p>
                          </div>
                        ) : (
                          <p className="revision-paragraph-text">{originalText}</p>
                        )}
                      </article>
                      {hasInsert ? insertSuggestions.map((suggestion, insertIndex) => (
                        (() => {
                          const insertChangeKey = insertChangeKeys[insertIndex];
                          const isCurrentInsertChange = revisionCurrentChange?.key === insertChangeKey;
                          return (
                        <article
                          className={'revision-original-paragraph is-insert' + (isCurrentInsertChange ? ' is-revision-focus' : '')}
                          key={paragraphNumber + '-insert-' + insertIndex}
                          ref={(element) => registerRevisionChangeRef(insertChangeKey, element)}
                        >
                          <div className="revision-original-paragraph-head">
                            <span className="revision-paragraph-tag">第 {paragraphNumber} 段后新增</span>
                            <div className="revision-paragraph-badges">
                               <strong className="revision-paragraph-badge is-insert">新增</strong>
                            </div>
                            <div className="revision-paragraph-actions">
                              <button
                                type="button"
                                className="ghost-btn"
                                disabled={revisionAppliedChangeKeys.includes(insertChangeKey)}
                                onClick={() => applyRevisionSuggestion(suggestion, insertChangeKey)}
                              >
                                {revisionAppliedChangeKeys.includes(insertChangeKey) ? '已应用新增' : '应用新增'}
                              </button>
                            </div>
                          </div>
                          <div className="revision-original-change is-insert">
                            <p className="revision-original-change-new">{suggestion.suggested_text}</p>
                          </div>
                        </article>
                          );
                        })()
                      )) : null}
                    </Fragment>
                  );
                }) : (
                  <p className="revision-original-empty">当前还没有正文结果。</p>
                )}
              </div>
            </section>
          </div>
        </Modal>
      ) : null}

      {promptPreviewOpen ? (
        <Modal
          title={'第 ' + chapterNumber + ' 章生成摘要'}
          description="这里展示生成前会优先参考的核心上下文。"
          onClose={() => setPromptPreviewOpen(false)}
          actions={<button type="button" className="solid-btn" onClick={() => setPromptPreviewOpen(false)}>知道了</button>}
        >
          <div className="outline-preview-stack prompt-preview-stack">
              <section className={'inline-status-banner is-' + generationReadiness.kind}>
              <strong>{generationReadiness.title}</strong>
              <span>{generationReadiness.text}</span>
            </section>
            <section className="outline-preview-block">
              <span>章节目标</span>
              <pre className="modal-pre">
                {[
                  '章名：' + (draftChapterPlan.chapter_name || '未命名章节'),
                  '本章目标：' + (chapterStructure.chapter_goal || '暂无填写'),
                  '关键场景：' + (chapterStructure.key_scenes || '暂无填写'),
                  '冲突升级：' + (chapterStructure.conflict_escalation || '暂无填写'),
                  '角色变化：' + (chapterStructure.character_change || '暂无填写'),
                  '情绪落点：' + (chapterStructure.reader_payoff || '暂无填写'),
                  '结尾钩子：' + (chapterStructure.ending_hook || draftChapterPlan.ending_hook || '暂无填写')
                ].join('\n')}
              </pre>
            </section>
            <section className="outline-preview-block">
              <span>剧情线承接</span>
              <pre className="modal-pre">
                {[
                  '主剧情线：' + selectedMainStorylineLabel,
                  '关联剧情线：' + selectedTargetStorylineLabel,
                  '节奏提示：' + (storylineRhythmHints.length > 0 ? storylineRhythmHints.map((hint) => '- ' + hint.text).join(' | ') : '暂无挂接剧情线')
                ].join('\n')}
              </pre>
            </section>
            <section className="outline-preview-block">
              <span>自动合成大纲</span>
              <pre className="modal-pre">{draftChapterPlan.outline_text || '暂无填写本章大纲。'}</pre>
            </section>
            <section className="outline-preview-block">
              <span>本章角色</span>
              <pre className="modal-pre">
                {[
                  draftChapterPlan.character_notes || '暂无补充本章角色说明。',
                  '',
                  '角色执行参数：',
                  Array.isArray(draftChapterPlan.role_execution) && draftChapterPlan.role_execution.length > 0
                    ? draftChapterPlan.role_execution.map((item) => `- ${item.role || '未命名角色'}｜${describeRoleExecutionMeta(item)}｜${item.forbidden_change || '暂无禁止项'}`).join('\n')
                    : '- 暂无角色执行参数'
                ].join('\n')}
              </pre>
            </section>
            <section className="outline-preview-block">
              <span>高风险提醒</span>
              <pre className="modal-pre">
                {generationRiskReview.items.length > 0
                  ? generationRiskReview.items.map((item) => `- [${item.level === 'critical' ? '高风险' : '提醒'}] ${item.title}：${item.text}`).join('\n')
                  : '当前没有额外高风险提醒。'}
              </pre>
            </section>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
