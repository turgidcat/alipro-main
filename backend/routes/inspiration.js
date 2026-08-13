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
  CharacterService,
  generateId,
  saveDatabase
} = require('../services/database');
const dbPromise = require('../database/init');
const { execQuery } = require('../services/database');
const { authenticateToken } = require('../middleware/auth');
const { requestedBookAccess } = require('../middleware/book-access');

const bookService = new BookService();
const bookPlanService = new BookPlanService();
const chapterService = new ChapterService();
const chapterPlanService = new ChapterPlanService();
const volumePlanService = new VolumePlanService();
const characterService = new CharacterService();

router.use(authenticateToken);
router.use(requestedBookAccess);

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
  const characters = normalizeArray(candidate.characters || candidate.character_cards, 4).map((item) => {
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
      rules: normalizeArray(worldview.rules || worldview.world_rules, 5).map((item) => text(item?.rule || item?.description || item?.name || item))
    },
    characters,
    centralConflict: text(candidate.centralConflict || candidate.central_conflict || candidate.core_conflict || candidate.conflict),
    storyDirection: text(candidate.storyDirection || candidate.story_direction || candidate.plot_direction || candidate.direction),
    plotOutline: text(candidate.plotOutline || candidate.plot_outline || candidate.outline || candidate.development),
    keyScenes: normalizeArray(candidate.keyScenes || candidate.key_scenes || candidate.scenes || candidate.beats, 6).map((item) => text(item?.title || item?.description || item?.beat || item)),
    openingHook: text(candidate.openingHook || candidate.opening_hook || candidate.opening || candidate.hook),
    endingHook: text(candidate.endingHook || candidate.ending_hook || candidate.next_hook || candidate.cliffhanger),
    fitReason: text(candidate.fitReason || candidate.fit_reason || candidate.scope_fit || candidate.why_it_fits),
    strategicValue: text(candidate.strategicValue || candidate.strategic_value || candidate.value || candidate.story_value),
    risks: normalizeArray(candidate.risks || candidate.risk_points, 4).map((item) => text(item?.risk || item?.description || item)),
    nextSteps: normalizeArray(candidate.nextSteps || candidate.next_steps || candidate.follow_up || candidate.expansion_steps, 5).map((item) => text(item?.step || item?.description || item)),
    tags: normalizeArray(candidate.tags || candidate.keywords, 6).map((item) => text(item?.name || item))
  };
}

function formatWorldRules(candidate) {
  return [candidate.worldview.summary, ...candidate.worldview.rules.map((rule) => `- ${rule}`)]
    .filter(Boolean)
    .join('\n');
}

function formatRoleSummary(candidate) {
  return candidate.characters
    .filter((character) => character?.name)
    .map((character) => {
      const description = [character.role, character.personality, character.background].filter(Boolean).join('；');
      return `${character.name}${description ? `：${description}` : ''}`;
    })
    .join('\n');
}

function inferRoleTier(character = {}, index = 0) {
  const role = text(character.role).toLowerCase();
  if (/反派|敌手|宿敌|antagonist|villain/.test(role)) return 'antagonist_major';
  if (/主角|男主|女主|主人公|protagonist|lead/.test(role) || index === 0) return 'protagonist';
  return index <= 2 ? 'supporting_major' : 'supporting_secondary';
}

function extractStoredInspirationCandidate(records = []) {
  for (const record of records) {
    const structured = parseStructured(record?.structured_content);
    const candidate = structured.inspiration_card
      || structured.inspirationCard
      || structured?.inspiration?.card
      || null;
    if (candidate && typeof candidate === 'object') return normalizeCandidate(candidate);
  }
  return null;
}

function parseStructured(value) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(String(value || '{}')); } catch (_) { return {}; }
}

function compactPlan(plan) {
  if (!plan) return '暂无';
  return [
    `第${plan.chapter_number || '?'}章《${text(plan.chapter_name || plan.title, '未命名')}》`,
    plan.summary ? `摘要：${text(plan.summary).slice(0, 180)}` : '',
    plan.chapter_mission ? `任务：${text(plan.chapter_mission).slice(0, 180)}` : '',
    plan.outline_text ? `大纲：${text(plan.outline_text).slice(0, 420)}` : '',
    plan.ending_hook ? `结尾钩子：${text(plan.ending_hook).slice(0, 160)}` : ''
  ].filter(Boolean).join('\n');
}

function compactVolume(volumePlan, volumeNumber) {
  if (!volumePlan) return `第${volumeNumber}卷尚未建立正式卷纲，可自由提出卷级方案。`;
  const structured = parseStructured(volumePlan.structured_content);
  return [
    `第${volumeNumber}卷《${text(volumePlan.volume_name, '未命名分卷')}》`,
    volumePlan.volume_theme ? `卷主题：${text(volumePlan.volume_theme).slice(0, 180)}` : '',
    volumePlan.stage_goal ? `阶段目标：${text(volumePlan.stage_goal).slice(0, 220)}` : '',
    volumePlan.core_conflict ? `卷核心冲突：${text(volumePlan.core_conflict).slice(0, 220)}` : '',
    volumePlan.start_role_state ? `开卷状态：${text(volumePlan.start_role_state).slice(0, 180)}` : '',
    volumePlan.end_role_state ? `收束状态：${text(volumePlan.end_role_state).slice(0, 180)}` : '',
    volumePlan.estimated_chapters ? `预计章节：${volumePlan.estimated_chapters}` : '',
    structured.summary ? `卷内补充：${text(structured.summary).slice(0, 500)}` : '',
    volumePlan.notes ? `备注：${text(volumePlan.notes).slice(0, 320)}` : ''
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
      `简介：${text(book.description, '暂无').slice(0, 360)}`
    ].join('\n')
    : '当前没有关联作品。';
  const planContext = bookPlan
    ? [
      `全书前提：${text(bookPlan.premise, '暂无').slice(0, 320)}`,
      `主目标：${text(bookPlan.main_goal, '暂无').slice(0, 260)}`,
      `核心冲突：${text(bookPlan.core_conflict, '暂无').slice(0, 260)}`,
      `世界规则：${text(bookPlan.world_rules, '暂无').slice(0, 360)}`,
      `已有大纲：${text(bookPlan.main_outline, '暂无').slice(0, 700)}`
    ].join('\n')
    : '暂无全书规划。';
  const characterContext = characters.length > 0
    ? characters.slice(0, 8).map((item) => `${item.name}：${text(item.personality || item.background || item.notes, '暂无').slice(0, 240)}`).join('\n')
    : '暂无角色资料。';
  const volumeContext = compactVolume(volumePlan, volumeNumber);
  const chapterPlanContext = Array.isArray(chapterPlans) && chapterPlans.length > 0
    ? chapterPlans.slice(-6).map(compactPlan).join('\n---\n')
    : '暂无章节规划。';
  const storylineContext = Array.isArray(storylines) && storylines.length > 0
    ? storylines.slice(0, 6).map((item) => [
      `${text(item.storyline_name || item.name, '未命名剧情线')}（${text(item.storyline_type || item.type, 'branch')}）`,
      item.description ? `说明：${text(item.description).slice(0, 320)}` : '',
      item.core_conflict ? `冲突：${text(item.core_conflict).slice(0, 240)}` : '',
      item.start_chapter || item.end_chapter ? `范围：第${item.start_chapter || 1}-${item.end_chapter || '?'}章` : ''
    ].filter(Boolean).join('\n')).join('\n---\n')
    : '暂无剧情线资料。';
  const chapterContext = targetChapter
    ? `目标章节：第${targetChapter.chapter_number}章《${text(targetChapter.chapter_name || targetChapter.title, '未命名')}》\n${text(targetChapter.content, '暂无正文').slice(-900)}`
    : previousChapter
      ? `上一章：第${previousChapter.chapter_number}章《${text(previousChapter.chapter_name || previousChapter.title, '未命名')}》\n${text(previousChapter.content, '暂无正文').slice(-900)}`
      : '暂无章节正文。';
  const schema = '{"candidates":[{"id":"string","title":"string","genre":"string","tone":"string","premise":"string","worldview":{"summary":"string","rules":["string"]},"characters":[{"name":"string","role":"string","personality":"string","background":"string","appearance":"string"}],"central_conflict":"string","story_direction":"string","plot_outline":"string","key_scenes":["string"],"opening_hook":"string","ending_hook":"string","fit_reason":"string","strategic_value":"string","risks":["string"],"next_steps":["string"],"tags":["string"]}]}';

  return [
    '你是长篇小说的灵感策划编辑。',
    scopeText,
    modeText,
    '请给出 3 个彼此有明显差异、但都能落地写作的候选方案。三者可以分别走人物、事件、机制或阵营路线，不要只替换名词。',
    '每个方案必须包含：世界观摘要与规则、故事前提、人物卡、核心冲突、发展方向、关键场景、开场钩子、结尾钩子、适配当前层级的原因、战略价值、风险和下一步。',
    '保持精炼：每个长文本字段控制在 1 至 2 句短句；人物卡 2 至 3 张；世界规则 3 条；关键场景 4 个；风险 2 条；下一步 3 条。必须完整返回 3 个方案后再结束 JSON。',
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

router.post('/initialize-book', async (req, res) => {
  try {
    const bookId = text(req.body?.bookId || req.body?.book_id);
    const userId = req.user.userId;
    const book = req.book || (bookId ? await bookService.getById(bookId) : null);
    if (!bookId || !book) return res.status(404).json({ success: false, error: '作品不存在' });

    const volumeNumber = Math.max(1, Number(req.body?.volumeNumber || req.body?.volume_number || 1) || 1);
    const chapterNumber = Math.max(1, Number(req.body?.chapterNumber || req.body?.chapter_number || 1) || 1);
    const estimatedChapters = Math.max(10, Number(req.body?.estimatedChapters || req.body?.estimated_chapters || 15) || 15);
    const existingBookPlan = await bookPlanService.getByBookId(bookId, userId);
    const existingVolumePlans = await volumePlanService.getByBookId(bookId, userId);
    const existingChapterPlan = await chapterPlanService.getByBookAndChapterNumber(bookId, chapterNumber, userId);
    const storedCandidate = extractStoredInspirationCandidate([existingChapterPlan, ...existingVolumePlans, existingBookPlan]);
    const candidateSource = req.body?.candidate || storedCandidate;
    if (!candidateSource || typeof candidateSource !== 'object') {
      return res.json({ success: true, data: { bookId, skipped: true, reason: 'not_inspiration_book' } });
    }
    const candidate = normalizeCandidate(candidateSource);
    const record = {
      inspiration_source: 'inspiration_explorer',
      scope: text(req.body?.scope, 'volume'),
      volume_number: volumeNumber,
      chapter_number: chapterNumber,
      user_prompt: text(req.body?.prompt),
      creative_focus: text(req.body?.creativeFocus),
      constraints: text(req.body?.constraints),
      inspiration_card: candidate,
      key_scenes: candidate.keyScenes,
      opening_hook: candidate.openingHook,
      ending_hook: candidate.endingHook
    };
    const created = { bookPlan: false, volumePlan: false, storyline: false, chapterPlan: false, characters: 0 };

    const hasBookOutline = [existingBookPlan?.main_outline, existingBookPlan?.volume_outline, existingBookPlan?.detailed_outline]
      .some((value) => text(value));
    if (!hasBookOutline) {
      await bookPlanService.upsert(bookId, {
        premise: candidate.premise || book.description,
        main_goal: candidate.storyDirection || candidate.premise,
        core_conflict: candidate.centralConflict,
        world_rules: formatWorldRules(candidate),
        role_summary: formatRoleSummary(candidate),
        main_outline: candidate.plotOutline || candidate.storyDirection || candidate.premise,
        volume_outline: `第 ${volumeNumber} 卷《${candidate.title}》：${candidate.storyDirection || candidate.premise}`,
        detailed_outline: candidate.keyScenes.map((scene, index) => `${index + 1}. ${scene}`).join('\n'),
        structured_content: record,
        source: 'ai',
        status: 'draft'
      }, userId);
      created.bookPlan = true;
    }

    const hasVolumePlan = existingVolumePlans.some((plan) => Number(plan.volume_number || 0) === volumeNumber);
    if (!hasVolumePlan) {
      await volumePlanService.upsert(bookId, volumeNumber, {
        volume_name: candidate.title,
        volume_theme: candidate.tone,
        stage_goal: candidate.storyDirection || candidate.premise,
        core_conflict: candidate.centralConflict,
        start_role_state: candidate.premise,
        end_role_state: candidate.endingHook,
        estimated_chapters: estimatedChapters,
        storyline_quota: 1,
        notes: [candidate.premise, candidate.strategicValue].filter(Boolean).join('\n'),
        structured_content: record,
        source: 'ai',
        status: 'draft'
      }, userId);
      created.volumePlan = true;
    }

    const db = await dbPromise;
    let mainStoryline = execQuery(
      db,
      "SELECT * FROM storylines WHERE book_id = ? AND volume_number = ? AND storyline_type = 'main' AND (user_id = ? OR user_id = '') ORDER BY created_at ASC LIMIT 1",
      [bookId, volumeNumber, userId]
    )[0] || null;
    if (!mainStoryline) {
      const storylineId = generateId();
      const maxRow = execQuery(db, 'SELECT MAX(storyline_number) AS max_number FROM storylines WHERE book_id = ? AND volume_number = ?', [bookId, volumeNumber])[0];
      db.run(
        `INSERT INTO storylines(
          id, book_id, user_id, volume_number, storyline_number, storyline_name,
          storyline_type, description, involved_characters, start_chapter, end_chapter,
          key_nodes, core_conflict, structured_content, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'main', ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [
          storylineId,
          bookId,
          userId,
          volumeNumber,
          Number(maxRow?.max_number || 0) + 1,
          `${candidate.title}主线`,
          candidate.storyDirection || candidate.plotOutline || candidate.premise,
          JSON.stringify(candidate.characters.map((character) => character.name).filter(Boolean)),
          1,
          estimatedChapters,
          JSON.stringify(candidate.keyScenes.map((scene, index) => ({
            chapter: Math.max(1, Math.round((index / Math.max(1, candidate.keyScenes.length - 1)) * (estimatedChapters - 1)) + 1),
            description: scene
          }))),
          candidate.centralConflict,
          JSON.stringify({ inspiration_source: 'inspiration_explorer', inspiration_card: candidate })
        ]
      );
      saveDatabase(db);
      mainStoryline = { id: storylineId };
      created.storyline = true;
    }

    const existingCharacters = await characterService.getByBookId(bookId, userId);
    const existingNames = new Set(existingCharacters.map((character) => text(character.name)).filter(Boolean));
    for (const [index, character] of candidate.characters.entries()) {
      if (!character.name || existingNames.has(character.name)) continue;
      await characterService.create(
        bookId,
        character.name,
        character.appearance,
        character.personality,
        character.background,
        [character.role ? `定位：${character.role}` : '', character.personality ? `性格：${character.personality}` : ''].filter(Boolean).join('\n'),
        userId,
        'main_character',
        inferRoleTier(character, index)
      );
      existingNames.add(character.name);
      created.characters += 1;
    }

    const targetStorylines = mainStoryline?.id ? [mainStoryline.id] : [];
    const existingSceneOutline = Array.isArray(existingChapterPlan?.scene_outline)
      ? existingChapterPlan.scene_outline
      : (() => { try { const parsed = JSON.parse(existingChapterPlan?.scene_outline || '[]'); return Array.isArray(parsed) ? parsed : []; } catch (_) { return []; } })();
    const existingAppearingRoles = Array.isArray(existingChapterPlan?.appearing_roles)
      ? existingChapterPlan.appearing_roles
      : (() => { try { const parsed = JSON.parse(existingChapterPlan?.appearing_roles || '[]'); return Array.isArray(parsed) ? parsed : []; } catch (_) { return []; } })();
    const existingTargetStorylines = Array.isArray(existingChapterPlan?.target_storylines)
      ? existingChapterPlan.target_storylines
      : (() => { try { const parsed = JSON.parse(existingChapterPlan?.target_storylines || '[]'); return Array.isArray(parsed) ? parsed : []; } catch (_) { return []; } })();
    await chapterPlanService.upsert(bookId, chapterNumber, {
      volume_number: volumeNumber,
      chapter_name: existingChapterPlan?.chapter_name || candidate.title,
      summary: existingChapterPlan?.summary || candidate.premise,
      chapter_mission: existingChapterPlan?.chapter_mission || candidate.storyDirection || candidate.premise,
      emotion_target: existingChapterPlan?.emotion_target || candidate.tone,
      outline_text: existingChapterPlan?.outline_text || candidate.plotOutline || candidate.storyDirection || candidate.premise,
      scene_outline: existingSceneOutline.length > 0 ? existingSceneOutline : candidate.keyScenes,
      character_notes: existingChapterPlan?.character_notes || [formatWorldRules(candidate), candidate.centralConflict, candidate.fitReason].filter(Boolean).join('\n\n'),
      appearing_roles: existingAppearingRoles.length > 0 ? existingAppearingRoles : candidate.characters.map((character) => character.name).filter(Boolean),
      main_storyline_id: existingChapterPlan?.main_storyline_id || mainStoryline?.id || '',
      target_storylines: existingTargetStorylines.length > 0 ? existingTargetStorylines : targetStorylines,
      previous_hook: existingChapterPlan?.previous_hook || candidate.openingHook,
      ending_hook: existingChapterPlan?.ending_hook || candidate.endingHook,
      structured_content: { ...parseStructured(existingChapterPlan?.structured_content), ...record },
      source: 'ai',
      status: 'draft'
    }, userId);
    created.chapterPlan = !existingChapterPlan;

    res.json({
      success: true,
      data: {
        bookId,
        volumeNumber,
        chapterNumber,
        mainStorylineId: mainStoryline?.id || '',
        created
      }
    });
  } catch (error) {
    logger.error('初始化灵感作品失败', { error: error.message, stack: error.stack });
    res.status(error.statusCode || 500).json({ success: false, error: error.message || '初始化灵感作品失败' });
  }
});

router.post('/generate', async (req, res) => {
  const startedAt = Date.now();
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
    const userId = req.user.userId;
    const book = bookId ? await bookService.getById(bookId) : null;
    if (bookId && !book) return res.status(404).json({ success: false, error: '关联作品不存在' });

    const bookPlan = bookId ? await bookPlanService.getByBookId(bookId, userId) : null;
    const characters = bookId ? await characterService.getByBookId(bookId, userId) : [];
    const chapters = bookId ? await chapterService.getByBookId(bookId, userId) : [];
    const sortedChapters = [...chapters].sort((a, b) => Number(a.chapter_number || 0) - Number(b.chapter_number || 0));
    const allVolumePlans = bookId ? await volumePlanService.getByBookId(bookId, userId) : [];
    const volumeNumber = Math.max(1, Number(req.body?.volumeNumber || req.body?.volume_number || 0) || (allVolumePlans.length ? Number(allVolumePlans[allVolumePlans.length - 1].volume_number || 1) : 1));
    const latestChapterNumber = Number(sortedChapters[sortedChapters.length - 1]?.chapter_number || 0) || 0;
    const chapterNumber = Math.max(1, Number(req.body?.chapterNumber || req.body?.chapter_number || req.body?.targetChapterNumber || 0) || (latestChapterNumber + 1 || 1));
    const volumePlan = allVolumePlans.find((item) => Number(item.volume_number || 0) === volumeNumber) || null;
    const db = await dbPromise;
    const chapterPlans = bookId
      ? await chapterPlanService.getByBookId(bookId, userId)
      : [];
    const targetChapter = sortedChapters.find((item) => Number(item.chapter_number || 0) === chapterNumber) || null;
    const previousChapter = sortedChapters.filter((item) => Number(item.chapter_number || 0) < chapterNumber).slice(-1)[0] || null;
    const volumeChapterPlans = chapterPlans.filter((item) => Number(item.volume_number || 1) === volumeNumber);
    const storylines = bookId
      ? execQuery(db, "SELECT * FROM storylines WHERE book_id = ? AND volume_number = ? AND (user_id = ? OR user_id = '') ORDER BY storyline_number ASC, created_at ASC", [bookId, volumeNumber, userId])
      : [];
    const result = await deepseekService.generate({
      prompt: buildPrompt({ scope, mode, userPrompt, creativeFocus, constraints, book, bookPlan, characters, volumeNumber, chapterNumber, volumePlan, chapterPlans: volumeChapterPlans, storylines, targetChapter, previousChapter }),
      temperature: mode === 'latest_chapter' ? 0.78 : 0.92,
      maxTokens: mode === 'latest_chapter' ? 5200 : 4800,
      responseFormat: { type: 'json_object' }
    });
    if (!result.success) return res.status(result.statusCode || 500).json({ success: false, error: result.error });

    const parsed = parseJsonObject(result.content);
    const rawCandidates = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
    const candidates = rawCandidates.slice(0, 3).map(normalizeCandidate);
    if (candidates.length < 3) {
      logger.warn('灵感探索候选数量不足', {
        candidateCount: candidates.length,
        finishReason: result.finishReason || null,
        usage: result.usage || null
      });
      throw new Error('模型没有返回 3 个可用灵感方案');
    }

    res.json({
      success: true,
      data: {
        mode,
        scope,
        volumeNumber,
        chapterNumber,
        targetChapterNumber: chapterNumber,
        candidates,
        usage: result.usage || null,
        elapsedMs: Date.now() - startedAt
      }
    });
  } catch (error) {
    logger.error('灵感探索生成失败', { error: error.message, stack: error.stack });
    res.status(error.statusCode || 500).json({ success: false, error: error.message || '灵感生成失败' });
  }
});

module.exports = router;
