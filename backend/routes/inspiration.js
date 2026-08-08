const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const deepseekService = require('../services/deepseek');
const {
  BookService,
  BookPlanService,
  ChapterService,
  ChapterPlanService,
  VolumePlanService,
  CharacterService
} = require('../services/database');
const dbPromise = require('../database/init');
const { execQuery } = require('../services/database');

const bookService = new BookService();
const bookPlanService = new BookPlanService();
const chapterService = new ChapterService();
const chapterPlanService = new ChapterPlanService();
const volumePlanService = new VolumePlanService();
const characterService = new CharacterService();

function text(value, fallback = '') {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

function parseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  const normalized = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  if (!normalized) return null;
  try {
    const parsed = JSON.parse(normalized);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    const match = normalized.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (_) {
      return null;
    }
  }
}

function normalizeArray(value, limit = 8) {
  const values = Array.isArray(value) ? value : [];
  return values
    .map((item) => (typeof item === 'object' ? item : text(item)))
    .filter((item) => (typeof item === 'object' ? Object.values(item).some(Boolean) : Boolean(item)))
    .slice(0, limit);
}

function normalizeCandidate(candidate = {}, index = 0) {
  const worldview = candidate.worldview || candidate.world_view || candidate.world || {};
  const characters = normalizeArray(candidate.characters || candidate.character_cards, 6).map((item) => {
    if (typeof item === 'string') return { name: item, role: '', personality: '', background: '', appearance: '' };
    return {
      name: text(item.name || item.character_name || item.title, `角色${index + 1}`),
      role: text(item.role || item.position),
      personality: text(item.personality || item.traits),
      background: text(item.background || item.backstory),
      appearance: text(item.appearance || item.visual_marker)
    };
  });
  return {
    id: text(candidate.id, `inspiration-${Date.now()}-${index + 1}`),
    title: text(candidate.title || candidate.name, `灵感方案 ${index + 1}`),
    genre: text(candidate.genre),
    tone: text(candidate.tone || candidate.emotion),
    premise: text(candidate.premise || candidate.core_idea || candidate.summary),
    worldview: {
      summary: text(worldview.summary || worldview.description || candidate.world_rules),
      rules: normalizeArray(worldview.rules || worldview.world_rules, 8).map((item) => text(item?.rule || item?.description || item?.name || item))
    },
    characters,
    centralConflict: text(candidate.central_conflict || candidate.core_conflict || candidate.conflict),
    storyDirection: text(candidate.story_direction || candidate.plot_direction || candidate.direction),
    plotOutline: text(candidate.plot_outline || candidate.outline || candidate.development),
    keyScenes: normalizeArray(candidate.key_scenes || candidate.scenes || candidate.beats, 8).map((item) => text(item?.title || item?.description || item?.beat || item)),
    openingHook: text(candidate.opening_hook || candidate.opening || candidate.hook),
    endingHook: text(candidate.ending_hook || candidate.next_hook || candidate.cliffhanger),
    fitReason: text(candidate.fit_reason || candidate.scope_fit || candidate.why_it_fits),
    strategicValue: text(candidate.strategic_value || candidate.value || candidate.story_value),
    risks: normalizeArray(candidate.risks || candidate.risk_points, 6).map((item) => text(item?.risk || item?.description || item)),
    nextSteps: normalizeArray(candidate.next_steps || candidate.follow_up || candidate.expansion_steps, 8).map((item) => text(item?.step || item?.description || item)),
    tags: normalizeArray(candidate.tags || candidate.keywords, 8).map((item) => text(item?.name || item))
  };
}

function parseStructured(value) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(String(value || '{}')); } catch (_) { return {}; }
}

function compactPlan(plan) {
  if (!plan) return '暂无';
  return [
    `第${plan.chapter_number || '?'}章《${text(plan.chapter_name || plan.title, '未命名')}》`,
    plan.summary ? `摘要：${text(plan.summary)}` : '',
    plan.chapter_mission ? `任务：${text(plan.chapter_mission)}` : '',
    plan.outline_text ? `大纲：${text(plan.outline_text).slice(0, 900)}` : '',
    plan.ending_hook ? `结尾钩子：${text(plan.ending_hook)}` : ''
  ].filter(Boolean).join('\n');
}

function compactVolume(volumePlan, volumeNumber) {
  if (!volumePlan) return `第${volumeNumber}卷尚未建立正式卷纲，可自由提出卷级方案。`;
  const structured = parseStructured(volumePlan.structured_content);
  return [
    `第${volumeNumber}卷《${text(volumePlan.volume_name, '未命名分卷')}》`,
    volumePlan.volume_theme ? `卷主题：${text(volumePlan.volume_theme)}` : '',
    volumePlan.stage_goal ? `阶段目标：${text(volumePlan.stage_goal)}` : '',
    volumePlan.core_conflict ? `卷核心冲突：${text(volumePlan.core_conflict)}` : '',
    volumePlan.start_role_state ? `开卷状态：${text(volumePlan.start_role_state)}` : '',
    volumePlan.end_role_state ? `收束状态：${text(volumePlan.end_role_state)}` : '',
    volumePlan.estimated_chapters ? `预计章节：${volumePlan.estimated_chapters}` : '',
    structured.summary ? `卷内补充：${text(structured.summary).slice(0, 1200)}` : '',
    volumePlan.notes ? `备注：${text(volumePlan.notes).slice(0, 800)}` : ''
  ].filter(Boolean).join('\n');
}

function buildPrompt({ scope, mode, userPrompt, creativeFocus, constraints, book, bookPlan, characters, volumeNumber, chapterNumber, volumePlan, chapterPlans, storylines, targetChapter, previousChapter }) {
  const scopeText = scope === 'book'
    ? '当前探索层级是“全书”：允许重新定义题材支点、主线方向和长期悬念。'
    : scope === 'volume'
      ? `当前探索层级是“分卷”：围绕第 ${volumeNumber} 卷构建阶段目标、卷内冲突和可持续的剧情引擎。`
      : `当前探索层级是“章节”：目标是第 ${chapterNumber} 章，必须能落成章节细纲，同时承接所选卷和前置剧情。`;
  const modeText = mode === 'latest_chapter'
    ? '用户要求强承接已有最新章节，不能凭空推翻已建立的主线。'
    : '用户允许自由发散，但必须说明方案与现有设定的连接点。';
  const bookContext = book
    ? [
      `书名：${text(book.title, '未命名作品')}`,
      `题材：${text(book.genre, '未设置')}${book.subgenre ? ` / ${book.subgenre}` : ''}`,
      `简介：${text(book.description, '暂无')}`
    ].join('\n')
    : '当前没有关联作品。';
  const planContext = bookPlan
    ? [
      `全书前提：${text(bookPlan.premise, '暂无')}`,
      `主目标：${text(bookPlan.main_goal, '暂无')}`,
      `核心冲突：${text(bookPlan.core_conflict, '暂无')}`,
      `世界规则：${text(bookPlan.world_rules, '暂无')}`,
      `已有大纲：${text(bookPlan.main_outline, '暂无')}`
    ].join('\n')
    : '暂无全书规划。';
  const characterContext = characters.length > 0
    ? characters.slice(0, 12).map((item) => `${item.name}：${text(item.personality || item.background || item.notes, '暂无')}`).join('\n')
    : '暂无角色资料。';
  const volumeContext = compactVolume(volumePlan, volumeNumber);
  const chapterPlanContext = Array.isArray(chapterPlans) && chapterPlans.length > 0
    ? chapterPlans.slice(-12).map(compactPlan).join('\n---\n')
    : '暂无章节规划。';
  const storylineContext = Array.isArray(storylines) && storylines.length > 0
    ? storylines.slice(0, 12).map((item) => [
      `${text(item.storyline_name || item.name, '未命名剧情线')}（${text(item.storyline_type || item.type, 'branch')}）`,
      item.description ? `说明：${text(item.description).slice(0, 700)}` : '',
      item.core_conflict ? `冲突：${text(item.core_conflict)}` : '',
      item.start_chapter || item.end_chapter ? `范围：第${item.start_chapter || 1}-${item.end_chapter || '?'}章` : ''
    ].filter(Boolean).join('\n')).join('\n---\n')
    : '暂无剧情线资料。';
  const chapterContext = targetChapter
    ? `目标章节：第${targetChapter.chapter_number}章《${text(targetChapter.chapter_name || targetChapter.title, '未命名')}》\n${text(targetChapter.content, '暂无正文').slice(-1800)}`
    : previousChapter
      ? `上一章：第${previousChapter.chapter_number}章《${text(previousChapter.chapter_name || previousChapter.title, '未命名')}》\n${text(previousChapter.content, '暂无正文').slice(-1800)}`
      : '暂无章节正文。';
  const schema = '{"candidates":[{"id":"string","title":"string","genre":"string","tone":"string","premise":"string","worldview":{"summary":"string","rules":["string"]},"characters":[{"name":"string","role":"string","personality":"string","background":"string","appearance":"string"}],"central_conflict":"string","story_direction":"string","plot_outline":"string","key_scenes":["string"],"opening_hook":"string","ending_hook":"string","fit_reason":"string","strategic_value":"string","risks":["string"],"next_steps":["string"],"tags":["string"]}]}';

  return [
    '你是长篇小说的灵感策划编辑。',
    scopeText,
    modeText,
    '请给出 3 个彼此有明显差异、但都能落地写作的候选方案。三者可以分别走人物、事件、机制或阵营路线，不要只替换名词。',
    '每个方案必须包含：世界观摘要与规则、故事前提、人物卡、核心冲突、发展方向、关键场景、开场钩子、结尾钩子、适配当前层级的原因、战略价值、风险和下一步。',
    '如果用户没有给出具体要求，就保持高自由度；如果给出硬性约束，必须优先遵守，并明确哪些部分是新假设。',
    '只输出严格 JSON，不要 Markdown，不要解释过程。',
    '',
    'JSON schema：',
    schema,
    '',
    '用户补充要求：', text(userPrompt, '无，完全自由发挥。'),
    '用户指定的创作焦点：', text(creativeFocus, '由模型自行判断。'),
    '用户指定的硬性约束：', text(constraints, '无额外硬性约束。'),
    '',
    '作品上下文：', bookContext,
    '',
    '已有全书规划：', planContext,
    '',
    '目标分卷上下文：', volumeContext,
    '',
    '目标卷章节规划：', chapterPlanContext,
    '',
    '目标卷剧情线：', storylineContext,
    '',
    '已有角色：', characterContext,
    '',
    '章节上下文：', chapterContext
  ].join('\n');
}

router.post('/generate', async (req, res) => {
  try {
    const requestedScope = text(req.body?.scope || req.body?.targetScope).toLowerCase();
    const scope = ['book', 'volume', 'chapter'].includes(requestedScope)
      ? requestedScope
      : (req.body?.mode === 'latest_chapter' ? 'chapter' : 'volume');
    const mode = req.body?.mode === 'latest_chapter' || req.body?.contextMode === 'strong_continuity'
      ? 'latest_chapter'
      : 'general';
    const userPrompt = text(req.body?.prompt);
    const creativeFocus = text(req.body?.creativeFocus || req.body?.focus);
    const constraints = text(req.body?.constraints || req.body?.hardConstraints);
    const bookId = text(req.body?.bookId);
    const book = bookId ? await bookService.getById(bookId) : null;
    if (bookId && !book) return res.status(404).json({ success: false, error: '关联作品不存在' });

    const bookPlan = bookId ? await bookPlanService.getByBookId(bookId, '') : null;
    const characters = bookId ? await characterService.getByBookId(bookId, '') : [];
    const chapters = bookId ? await chapterService.getByBookId(bookId, '') : [];
    const sortedChapters = [...chapters].sort((a, b) => Number(a.chapter_number || 0) - Number(b.chapter_number || 0));
    const allVolumePlans = bookId ? await volumePlanService.getByBookId(bookId, '') : [];
    const volumeNumber = Math.max(1, Number(req.body?.volumeNumber || req.body?.volume_number || 0) || (allVolumePlans.length ? Number(allVolumePlans[allVolumePlans.length - 1].volume_number || 1) : 1));
    const latestChapterNumber = Number(sortedChapters[sortedChapters.length - 1]?.chapter_number || 0) || 0;
    const chapterNumber = Math.max(1, Number(req.body?.chapterNumber || req.body?.chapter_number || req.body?.targetChapterNumber || 0) || (latestChapterNumber + 1 || 1));
    const volumePlan = allVolumePlans.find((item) => Number(item.volume_number || 0) === volumeNumber) || null;
    const db = await dbPromise;
    const chapterPlans = bookId
      ? await chapterPlanService.getByBookId(bookId, '')
      : [];
    const targetChapter = sortedChapters.find((item) => Number(item.chapter_number || 0) === chapterNumber) || null;
    const previousChapter = sortedChapters.filter((item) => Number(item.chapter_number || 0) < chapterNumber).slice(-1)[0] || null;
    const volumeChapterPlans = chapterPlans.filter((item) => Number(item.volume_number || 1) === volumeNumber);
    const storylines = bookId
      ? execQuery(db, 'SELECT * FROM storylines WHERE book_id = ? AND volume_number = ? ORDER BY storyline_number ASC, created_at ASC', [bookId, volumeNumber])
      : [];
    const result = await deepseekService.generate({
      prompt: buildPrompt({ scope, mode, userPrompt, creativeFocus, constraints, book, bookPlan, characters, volumeNumber, chapterNumber, volumePlan, chapterPlans: volumeChapterPlans, storylines, targetChapter, previousChapter }),
      temperature: mode === 'latest_chapter' ? 0.78 : 0.92,
      maxTokens: 6200,
      responseFormat: { type: 'json_object' }
    });
    if (!result.success) return res.status(result.statusCode || 500).json({ success: false, error: result.error });

    const parsed = parseJsonObject(result.content);
    const rawCandidates = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
    const candidates = rawCandidates.slice(0, 3).map(normalizeCandidate);
    if (candidates.length < 3) throw new Error('模型没有返回 3 个可用灵感方案');

    res.json({
      success: true,
      data: {
        mode,
        scope,
        volumeNumber,
        chapterNumber,
        targetChapterNumber: chapterNumber,
        candidates,
        usage: result.usage || null
      }
    });
  } catch (error) {
    logger.error('灵感探索生成失败', { error: error.message, stack: error.stack });
    res.status(error.statusCode || 500).json({ success: false, error: error.message || '灵感生成失败' });
  }
});

module.exports = router;
