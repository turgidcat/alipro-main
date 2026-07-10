const initDatabase = require('../database/init');

// UUID生成函数（不依赖uuid包）
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 等待数据库初始化完成
let dbPromise = initDatabase.then(db => db);

// 保存数据库到文件
function saveDatabase(db) {
  const path = require('path');
  const fs = require('fs');
  const data = db.export();
  const buffer = Buffer.from(data);
  const dbPath = path.join(__dirname, '..', 'database', 'novel.db');
  fs.writeFileSync(dbPath, buffer);
}

// 辅助函数：执行查询并返回结果数组
function execQuery(db, sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const results = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();
  return results;
}

// 辅助函数：执行查询并返回单个结果
function execQueryOne(db, sql, params = []) {
  const results = execQuery(db, sql, params);
  return results.length > 0 ? results[0] : null;
}

function parseJsonObject(value) {
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

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sanitizeGeneratedText(value) {
  return String(value || '')
    .replace(/\uFFFD+/g, '')
    .replace(/�+/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();
}

function countPlatformEffectiveWords(value) {
  const text = sanitizeGeneratedText(value)
    .replace(/[\s\p{Punctuation}\p{Symbol}]/gu, '');
  return Array.from(text).length;
}

function buildBookWordStatsMap(db, bookIds = []) {
  const normalizedBookIds = [...new Set((Array.isArray(bookIds) ? bookIds : []).map((item) => String(item || '').trim()).filter(Boolean))];
  if (normalizedBookIds.length === 0) return new Map();

  const placeholders = normalizedBookIds.map(() => '?').join(', ');
  const chapterRows = execQuery(
    db,
    `SELECT book_id, content FROM chapters WHERE book_id IN (${placeholders})`,
    normalizedBookIds
  );

  const statsMap = new Map();
  normalizedBookIds.forEach((bookId) => {
    statsMap.set(bookId, { chapter_count: 0, word_count: 0 });
  });

  chapterRows.forEach((row) => {
    const bookId = String(row.book_id || '').trim();
    if (!bookId) return;
    const current = statsMap.get(bookId) || { chapter_count: 0, word_count: 0 };
    const effectiveWordCount = countPlatformEffectiveWords(row.content || '');
    if (effectiveWordCount > 0) {
      current.chapter_count += 1;
    }
    current.word_count += effectiveWordCount;
    statsMap.set(bookId, current);
  });

  return statsMap;
}

function normalizeJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function normalizeRoleNames(value) {
  return normalizeJsonArray(value)
    .map((item) => {
      if (typeof item === 'string') return normalizeText(item);
      if (item && typeof item === 'object') {
        return normalizeText(item.name || item.characterName || item.title || item.role || '');
      }
      return '';
    })
    .filter(Boolean);
}

function normalizeRoleExecutionItem(item) {
  if (!item || typeof item !== 'object') return null;
  const role = normalizeText(item.role || '');
  const personality = normalizeText(item.personality || item.baseline || '');
  const background = normalizeText(item.background || '');
  const appearance = normalizeText(item.appearance || item.appearance_marker || item.appearanceMarker || '');
  const baseline = normalizeText(item.baseline || personality || background || '');
  const appearanceMarker = appearance;
  const chapterFunction = normalizeText(item.chapter_function || item.chapterFunction || '');
  const allowedChange = normalizeText(item.allowed_change || item.allowedChange || '');
  const forbiddenChange = normalizeText(item.forbidden_change || item.forbiddenChange || '');
  const dimension = normalizeText(item.dimension || item.change_dimension || item.changeDimension || '') || 'story_function';
  const direction = normalizeText(item.direction || item.change_direction || item.changeDirection || '') || 'hold';
  const scope = normalizeText(item.scope || item.change_scope || item.changeScope || '') || 'temporary';
  const confidence = normalizeText(item.confidence || '') || 'low';
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
}

function normalizeRoleExecutionList(value) {
  return normalizeJsonArray(value).map(normalizeRoleExecutionItem).filter(Boolean);
}

function enrichRoleExecutionForGeneration(roleExecution = [], chapterMission = '', characterNotes = '') {
  const mission = normalizeText(chapterMission);
  const notes = normalizeText(characterNotes);
  return roleExecution.map((item) => {
    const personality = normalizeText(item.personality || item.baseline || '');
    const background = normalizeText(item.background || '');
    const appearance = normalizeText(item.appearance || item.appearance_marker || '');
    return {
      ...item,
      personality,
      background,
      appearance,
      baseline: normalizeText(item.baseline || personality || background || notes || '延续当前人物底色。'),
      appearance_marker: normalizeText(item.appearance_marker || appearance),
      chapter_function: normalizeText(item.chapter_function || '') || (
        mission ? `围绕本章任务“${mission}”承担推进作用。` : '承担本章推进作用。'
      ),
      allowed_change: normalizeText(item.allowed_change || '') || '只允许推进一步，不允许跨阶段突变。',
      forbidden_change: normalizeText(item.forbidden_change || '') || '不能直接完成长期关系翻转、立场逆转或真相彻底揭示。',
      dimension: normalizeText(item.dimension || '') || 'story_function',
      direction: normalizeText(item.direction || '') || 'hold',
      scope: normalizeText(item.scope || '') || 'temporary',
      confidence: normalizeText(item.confidence || '') || 'low'
    };
  });
}

function buildRoleExecutionFallback(appearingRoles = [], characterNotes = '', chapterMission = '') {
  return normalizeRoleNames(appearingRoles).map((role) => ({
    role,
    baseline: normalizeText(characterNotes) || '延续当前人物底色。',
    appearance_marker: '本章生成前必须补足可识别外形标识。',
    chapter_function: chapterMission
      ? `围绕本章任务“${normalizeText(chapterMission)}”承担推进作用。`
      : '承担本章推进作用。',
    allowed_change: '只允许推进一步，不允许跨阶段突变。',
    forbidden_change: '不能直接完成长期关系翻转、立场逆转或真相彻底揭示。',
    dimension: 'story_function',
    direction: 'hold',
    scope: 'temporary',
    confidence: 'low'
  }));
}

function buildChapterPlanRepairPayload(plan = {}) {
  const chapterGoal = normalizeChapterGoalPayload({
    chapter_mission: plan.chapter_mission,
    emotion_target: plan.emotion_target,
    appearing_roles: normalizeJsonArray(plan.appearing_roles),
    main_storyline_id: plan.main_storyline_id,
    target_storylines: normalizeJsonArray(plan.target_storylines),
    previous_hook: plan.previous_hook
  });
  const chapterOutline = normalizeChapterOutlinePayload({
    summary: plan.summary,
    outline_text: plan.outline_text,
    scene_outline: normalizeJsonArray(plan.scene_outline),
    ending_hook: plan.ending_hook,
    character_notes: plan.character_notes
  });
  const existingStructuredContent = parseJsonObject(plan.structured_content);
  const currentRoleNames = new Set(normalizeRoleNames(chapterGoal.appearing_roles));
  const repairedRoleExecution = normalizeRoleExecutionList(existingStructuredContent.role_execution)
    .filter((item) => item.role && currentRoleNames.has(normalizeText(item.role)));
  const structuredContent = buildChapterPlanStructuredContent(
    {
      structured_content: existingStructuredContent,
      role_execution: repairedRoleExecution.length > 0
        ? repairedRoleExecution
        : buildRoleExecutionFallback(
            chapterGoal.appearing_roles,
            chapterOutline.character_notes,
            chapterGoal.chapter_mission
          )
    },
    chapterGoal,
    chapterOutline
  );

  return { chapterGoal, chapterOutline, structuredContent };
}

function collectFeedbackAnchorTerms(structuredContent = {}) {
  const chapterGoalSnapshot = parseJsonObject(structuredContent.chapter_goal_snapshot);
  const storylineContext = parseJsonObject(structuredContent.storyline_context);

  const terms = [
    normalizeText(chapterGoalSnapshot.chapter_mission || ''),
    normalizeText(chapterGoalSnapshot.previous_hook || '')
  ];

  normalizeJsonArray(chapterGoalSnapshot.appearing_roles).forEach((item) => {
    const name = typeof item === 'string'
      ? normalizeText(item)
      : normalizeText(item?.name || item?.characterName || item?.title || '');
    if (name) terms.push(name);
  });

  normalizeJsonArray(storylineContext.relatedStorylines).forEach((item) => {
    const title = normalizeText(item?.title || item?.name || '');
    const summary = normalizeText(item?.summary || '');
    if (title) terms.push(title);
    if (summary) terms.push(summary);
  });

  normalizeJsonArray(storylineContext.currentBeats).forEach((item) => {
    const title = normalizeText(item?.title || '');
    const summary = normalizeText(item?.summary || '');
    if (title) terms.push(title);
    if (summary) terms.push(summary);
  });

  normalizeJsonArray(storylineContext.mustAdvance).forEach((item) => {
    const text = typeof item === 'string'
      ? normalizeText(item)
      : normalizeText(item?.summary || item?.title || '');
    if (text) terms.push(text);
  });

  return [...new Set(terms.filter(Boolean))];
}

function hasStorylineAnchorEvidence(text, anchorTerms = []) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return anchorTerms.some((term) => {
    if (!term) return false;
    if (term.length <= 12) {
      return normalized.includes(term);
    }
    const chunks = term
      .split(/[，。；：、\s]/)
      .map((item) => normalizeText(item))
      .filter((item) => item.length >= 2)
      .slice(0, 4);
    return chunks.some((item) => normalized.includes(item));
  });
}

function sanitizeStorylineFeedbackForProgress(feedback = {}, structuredContent = {}, requiresStorylineReview = false) {
  const rawChapterSummary = normalizeText(feedback.chapter_summary || '');
  const rawStoryProgress = normalizeText(feedback.story_progress || '');
  const rawNextFocus = normalizeText(feedback.next_chapter_focus || '');
  const rawOpenHooks = normalizeText(feedback.open_hooks || '');
  const anchorTerms = collectFeedbackAnchorTerms(structuredContent);
  const chapterSummary = hasStorylineAnchorEvidence(rawChapterSummary, anchorTerms) ? rawChapterSummary : '';
  const storyProgress = hasStorylineAnchorEvidence(rawStoryProgress, anchorTerms) ? rawStoryProgress : '';
  const nextFocus = hasStorylineAnchorEvidence(rawNextFocus, anchorTerms) ? rawNextFocus : '';
  const openHooks = hasStorylineAnchorEvidence(rawOpenHooks, anchorTerms) ? rawOpenHooks : '';
  const hasUnverifiedFeedback = [
    rawChapterSummary && !chapterSummary,
    rawStoryProgress && !storyProgress,
    rawNextFocus && !nextFocus,
    rawOpenHooks && !openHooks
  ].some(Boolean);

  if (requiresStorylineReview) {
    return {
      chapter_summary: chapterSummary,
      story_progress: '',
      next_chapter_focus: '',
      open_hooks: '',
      progress_note: '',
      open_question_note: hasUnverifiedFeedback
        ? '本章反馈含未锚定内容，需人工复核后再写入剧情线进度。'
        : ''
    };
  }

  return {
    chapter_summary: chapterSummary,
    story_progress: storyProgress,
    next_chapter_focus: nextFocus,
    open_hooks: openHooks,
    progress_note: storyProgress || nextFocus || '',
    open_question_note: !storyProgress && !nextFocus && !openHooks && hasUnverifiedFeedback
      ? '本章反馈含未锚定内容，需人工复核后再写入剧情线进度。'
      : ''
  };
}

function normalizeChapterGoalPayload(payload = {}) {
  return {
    chapter_mission: payload.chapter_mission || payload.chapterMission || '',
    emotion_target: payload.emotion_target || payload.emotionTarget || '',
    appearing_roles: Array.isArray(payload.appearing_roles)
      ? payload.appearing_roles
      : (Array.isArray(payload.appearingRoles) ? payload.appearingRoles : []),
    main_storyline_id: payload.main_storyline_id || payload.mainStorylineId || '',
    target_storylines: Array.isArray(payload.target_storylines)
      ? payload.target_storylines
      : (Array.isArray(payload.targetStorylines) ? payload.targetStorylines : []),
    previous_hook: payload.previous_hook || payload.previousHook || ''
  };
}

function normalizeChapterOutlinePayload(payload = {}) {
  return {
    summary: payload.summary || '',
    outline_text: payload.outline_text || payload.outlineText || '',
    scene_outline: Array.isArray(payload.scene_outline)
      ? payload.scene_outline
      : (Array.isArray(payload.sceneOutline) ? payload.sceneOutline : []),
    ending_hook: payload.ending_hook || payload.endingHook || '',
    character_notes: payload.character_notes || payload.characterNotes || ''
  };
}

function buildChapterPlanStructuredContent(payload = {}, chapterGoal = {}, chapterOutline = {}) {
  const structuredContent = parseJsonObject(payload.structured_content || payload.structuredContent);
  const {
    chapter_outline_structure: _legacyStructure,
    chapter_outline_snapshot: _legacySnapshot,
    ...remainingStructuredContent
  } = structuredContent;
  const roleExecution = enrichRoleExecutionForGeneration(
    normalizeRoleExecutionList(payload.role_execution || structuredContent.role_execution),
    chapterGoal.chapter_mission,
    chapterOutline.character_notes
  );
  const outlineSource = normalizeText(payload.source || structuredContent.chapter_outline_source || 'manual') || 'manual';
  return {
    ...remainingStructuredContent,
    plot_notes: normalizeText(payload.plot_notes || payload.plotNotes || structuredContent.plot_notes || ''),
    chapter_outline_mode: structuredContent.chapter_outline_mode || 'single_latest',
    chapter_outline_source: outlineSource,
    chapter_goal_snapshot: {
      chapter_mission: chapterGoal.chapter_mission || '',
      emotion_target: chapterGoal.emotion_target || '',
      appearing_roles: chapterGoal.appearing_roles || [],
      main_storyline_id: chapterGoal.main_storyline_id || '',
      target_storylines: chapterGoal.target_storylines || [],
      previous_hook: chapterGoal.previous_hook || ''
    },
    role_execution: roleExecution.length > 0
      ? roleExecution
      : buildRoleExecutionFallback(
          chapterGoal.appearing_roles,
          chapterOutline.character_notes,
          chapterGoal.chapter_mission
      )
  };
}

function formatChapterRoleNote(role, chapterNumber, characterNotes = '') {
  const marker = `【第${Number(chapterNumber || 0)}章角色速查】${role.role}`;
  const lines = [
    marker,
    role.appearance || role.appearance_marker ? `外形标识：${role.appearance || role.appearance_marker}` : '',
    role.personality || role.baseline ? `核心性格：${role.personality || role.baseline}` : '',
    role.background || role.chapter_function ? `身份背景：${role.background || role.chapter_function}` : '',
    characterNotes ? `人物备注：${normalizeText(characterNotes)}` : ''
  ].filter(Boolean);
  return lines.join('\n');
}

function syncChapterRolesToCharacterLibrary(db, {
  bookId,
  userId = '',
  chapterNumber,
  chapterOutline = {},
  structuredContent = {}
}) {
  const roles = normalizeRoleExecutionList(structuredContent.role_execution)
    .filter((role) => role.role);
  if (roles.length === 0) return 0;

  const uniqueRoles = [];
  const seenNames = new Set();
  roles.forEach((role) => {
    const name = normalizeText(role.role);
    if (!name || seenNames.has(name)) return;
    seenNames.add(name);
    uniqueRoles.push({ ...role, role: name });
  });

  let changedCount = 0;
  uniqueRoles.forEach((role) => {
    const existing = execQueryOne(
      db,
      'SELECT * FROM novel_characters WHERE book_id = ? AND user_id = ? AND name = ? LIMIT 1',
      [bookId, userId, role.role]
    );
    const chapterNote = formatChapterRoleNote(role, chapterNumber, chapterOutline.character_notes || '');

    if (!existing) {
      db.run(
        `INSERT INTO novel_characters (
          id, book_id, user_id, name, appearance, personality, background, notes,
          character_type, role_tier, avatar_image
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(),
          bookId,
          userId,
          role.role,
          role.appearance || role.appearance_marker || '',
          role.personality || role.baseline || '',
          role.background || role.chapter_function || '',
          chapterNote,
          'chapter_character',
          'supporting_major',
          ''
        ]
      );
      changedCount += 1;
      return;
    }

    const updates = {};
    if (!normalizeText(existing.personality) && (role.personality || role.baseline)) {
      updates.personality = role.personality || role.baseline;
    }
    if (!normalizeText(existing.appearance) && (role.appearance || role.appearance_marker)) {
      updates.appearance = role.appearance || role.appearance_marker;
    }
    if (!normalizeText(existing.background) && (role.background || role.chapter_function)) {
      updates.background = role.background || role.chapter_function;
    }
    if (!normalizeText(existing.character_type)) {
      updates.character_type = 'chapter_character';
    }
    if (!normalizeText(existing.role_tier)) {
      updates.role_tier = 'supporting_major';
    }

    const existingNotes = existing.notes || '';
    const noteMarker = `【第${Number(chapterNumber || 0)}章角色速查】${role.role}`;
    if (!existingNotes.includes(noteMarker)) {
      updates.notes = existingNotes
        ? `${existingNotes}\n\n${chapterNote}`
        : chapterNote;
    }

    const fields = Object.keys(updates);
    if (fields.length > 0) {
      db.run(
        `UPDATE novel_characters SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`,
        [...fields.map((field) => updates[field]), existing.id]
      );
      changedCount += 1;
    }
  });

  return changedCount;
}

function syncStorylineProgressFromChapterPlan(db, {
  bookId,
  chapterNumber,
  chapterGoal = {},
  chapterId = '',
  structuredContent = {}
}) {
  const feedback = parseJsonObject(structuredContent.chapter_feedback);
  if (!feedback.chapter_summary && !feedback.story_progress && !feedback.next_chapter_focus && !feedback.open_hooks) {
    return 0;
  }

  const storylineContext = parseJsonObject(structuredContent.storyline_context);
  const contextStorylineIds = Array.isArray(storylineContext.usedStorylineIds)
    ? storylineContext.usedStorylineIds
    : [];
  const contextBeatIds = Array.isArray(storylineContext.usedBeatIds)
    ? storylineContext.usedBeatIds
    : [];
  const isFallbackContext = !!storylineContext.isFallback;
  const requiresStorylineReview = isFallbackContext || contextBeatIds.length === 0;
  const sanitizedFeedback = sanitizeStorylineFeedbackForProgress(
    feedback,
    structuredContent,
    requiresStorylineReview
  );

  const storylineIds = [
    chapterGoal.main_storyline_id,
    ...(Array.isArray(chapterGoal.target_storylines) ? chapterGoal.target_storylines : []),
    ...contextStorylineIds
  ]
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  const uniqueIds = [...new Set(storylineIds)];
  if (uniqueIds.length === 0) return 0;

  const placeholders = uniqueIds.map(() => '?').join(',');
  const rows = execQuery(
    db,
    `SELECT id, structured_content, status FROM storylines WHERE book_id = ? AND id IN (${placeholders})`,
    [bookId, ...uniqueIds]
  );

  const progressEntry = {
    chapter_id: chapterId || '',
    chapter_number: Number(chapterNumber || 0),
    used_storyline_ids: contextStorylineIds,
    used_beat_ids: contextBeatIds,
    chapter_summary: sanitizedFeedback.chapter_summary,
    story_progress: sanitizedFeedback.story_progress,
    next_chapter_focus: sanitizedFeedback.next_chapter_focus,
    open_hooks: sanitizedFeedback.open_hooks,
    progress_note: sanitizedFeedback.progress_note,
    deviation_risk: requiresStorylineReview ? 'medium' : 'none',
    status: requiresStorylineReview ? 'needs_review' : 'advanced',
    requires_review: requiresStorylineReview,
    source: feedback.source || 'chapter_plan_feedback',
    updated_at: new Date().toISOString()
  };

  function isSameChapterProgressEntry(item) {
    const itemChapterId = String(item?.chapter_id || item?.chapterId || '').trim();
    const entryChapterId = String(progressEntry.chapter_id || '').trim();
    if (entryChapterId && itemChapterId) {
      return itemChapterId === entryChapterId;
    }
    return Number(item?.chapter_number || item?.chapterNumber || 0) === progressEntry.chapter_number;
  }

  rows.forEach((row) => {
    const storylineContent = parseJsonObject(row.structured_content);
    const existingProgress = Array.isArray(storylineContent.chapter_progress)
      ? storylineContent.chapter_progress
      : [];
    const nextProgress = [
      ...existingProgress.filter((item) => !isSameChapterProgressEntry(item)),
      progressEntry
    ].slice(-30);

    const existingCurrentProgress = parseJsonObject(storylineContent.currentProgress);
    const existingCompletedBeats = Array.isArray(existingCurrentProgress.completedBeats)
      ? existingCurrentProgress.completedBeats
      : [];
    const nextCompletedBeats = [...new Set([...existingCompletedBeats, ...contextBeatIds])].filter(Boolean);
    const nextChapterProgressEntries = nextProgress.map((item) => ({
      chapterId: item.chapter_id || '',
      chapterNumber: Number(item.chapter_number || 0),
      usedStorylineIds: Array.isArray(item.used_storyline_ids) ? item.used_storyline_ids : [],
      usedBeatIds: Array.isArray(item.used_beat_ids) ? item.used_beat_ids : [],
      summary: item.chapter_summary || '',
      storyProgress: item.story_progress || '',
      progressNote: item.progress_note || '',
      deviationRisk: item.deviation_risk || 'none',
      status: item.status || 'touched',
      requiresReview: !!item.requires_review,
      updatedAt: item.updated_at || ''
    }));
    const nextActiveBeats = [...new Set(
      nextChapterProgressEntries.flatMap((item) => Array.isArray(item.usedBeatIds) ? item.usedBeatIds : [])
    )].filter(Boolean);
    const existingOpenQuestions = Array.isArray(existingCurrentProgress.openQuestions)
      ? existingCurrentProgress.openQuestions
      : [];
    const storylineSummary = sanitizedFeedback.open_question_note
      || feedback.story_progress
      || feedback.next_chapter_focus
      || '';
    const nextOpenQuestions = requiresStorylineReview && storylineSummary
      ? [
        ...existingOpenQuestions.filter((item) => Number(item?.chapterNumber || 0) !== progressEntry.chapter_number),
        {
          chapterId: chapterId || '',
          chapterNumber: progressEntry.chapter_number,
          note: storylineSummary,
          updatedAt: progressEntry.updated_at
        }
      ].slice(-10)
      : existingOpenQuestions.filter((item) => Number(item?.chapterNumber || 0) !== progressEntry.chapter_number);

    const nextCurrentProgress = {
      ...existingCurrentProgress,
      lastUpdatedChapterId: chapterId || existingCurrentProgress.lastUpdatedChapterId || '',
      lastUpdatedChapterNumber: progressEntry.chapter_number,
      lastProgressSummary: progressEntry.story_progress || progressEntry.chapter_summary || progressEntry.next_chapter_focus || '',
      lastUsedStorylineIds: contextStorylineIds,
      lastUsedBeatIds: contextBeatIds,
      lifecycleStatus: requiresStorylineReview ? 'needs_review' : 'advanced',
      requiresReview: requiresStorylineReview,
      completedBeats: nextCompletedBeats,
      activeBeats: nextActiveBeats,
      openQuestions: nextOpenQuestions,
      chapterProgress: nextChapterProgressEntries
    };

    const nextContent = {
      ...storylineContent,
      last_chapter_feedback: progressEntry,
      chapter_progress: nextProgress,
      currentProgress: nextCurrentProgress,
      lifecycleStatus: nextCurrentProgress.lifecycleStatus
    };
    const nextStatus = requiresStorylineReview
      ? 'needs_review'
      : (['draft', 'generated', 'needs_review'].includes(row.status) ? 'active' : (row.status || 'active'));

    db.run(
      'UPDATE storylines SET structured_content = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(nextContent), nextStatus, row.id]
    );
  });

  return rows.length;
}

class BookService {
  /**
   * 创建新书籍
   */
  async create(title, genre, description = '', author = '', userId = '', subgenre = '') {
    const db = await dbPromise;
    const id = generateId();

    db.run(`
      INSERT INTO books (id, user_id, title, genre, subgenre, description, author)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, userId, title, genre, subgenre, description, author]);

    saveDatabase(db);
    return this.getById(id);
  }

  /**
   * 获取所有书籍（按用户筛选）
   */
  async getAll(userId = '') {
    const db = await dbPromise;
    const query = `
      SELECT b.*, u.username
      FROM books b
      LEFT JOIN users u ON b.user_id = u.id
      ${userId ? 'WHERE b.user_id = ?' : ''}
      ORDER BY b.updated_at DESC
    `;
    const results = userId
      ? execQuery(db, query, [userId])
      : execQuery(db, query);
    const statsMap = buildBookWordStatsMap(db, results.map((item) => item.id));
    return results.map((item) => {
      const stats = statsMap.get(String(item.id || '').trim()) || { chapter_count: 0, word_count: 0 };
      return {
        ...item,
        chapter_count: stats.chapter_count,
        word_count: stats.word_count
      };
    });
  }

  /**
   * 根据ID获取书籍
   */
  async getById(id) {
    const db = await dbPromise;
    const book = execQueryOne(db, 'SELECT * FROM books WHERE id = ?', [id]);
    if (!book) return null;
    const statsMap = buildBookWordStatsMap(db, [id]);
    const stats = statsMap.get(String(id || '').trim()) || { chapter_count: 0, word_count: 0 };
    return {
      ...book,
      chapter_count: stats.chapter_count,
      word_count: stats.word_count
    };
  }

  /**
   * 更新书籍信息
   */
  async update(id, updates) {
    const db = await dbPromise;
    const allowedFields = ['title', 'genre', 'subgenre', 'description', 'author', 'status', 'cover_image'];
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.run(`UPDATE books SET ${fields.join(', ')} WHERE id = ?`, values);
    saveDatabase(db);

    return this.getById(id);
  }

  /**
   * 删除书籍（级联删除所有相关数据）
   */
  async delete(id) {
    const db = await dbPromise;

    // sql.js 对外键 CASCADE 支持不稳定，全部手动删除

    // 1. 删除章节
    db.run('DELETE FROM chapters WHERE book_id = ?', [id]);

    // 2. 删除角色
    db.run('DELETE FROM novel_characters WHERE book_id = ?', [id]);

    // 3. 删除规划
    db.run('DELETE FROM book_plans WHERE book_id = ?', [id]);
    db.run('DELETE FROM volume_plans WHERE book_id = ?', [id]);
    db.run('DELETE FROM chapter_plans WHERE book_id = ?', [id]);

    // 4. 删除伏笔
    db.run('DELETE FROM foreshadowing WHERE book_id = ?', [id]);

    // 5. 删除书籍
    db.run('DELETE FROM books WHERE id = ?', [id]);

    saveDatabase(db);

    // 检查是否删除成功
    const result = execQueryOne(db, 'SELECT changes() as changes');
    return result && result.changes > 0;
  }
}

class ChapterService {
  /**
   * 创建新章节（关联用户）
   */
  async create(bookId, title, content = '', chapterNumber = null, chapterName = '', userId = '', outline = '') {
    const db = await dbPromise;
    const id = generateId();

    // 如果没有指定章节号，自动计算下一个
    if (chapterNumber === null) {
      const stmt = db.prepare('SELECT MAX(chapter_number) as max_num FROM chapters WHERE book_id = ?');
      stmt.bind([bookId]);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        chapterNumber = (row.max_num || 0) + 1;
      } else {
        chapterNumber = 1;
      }
    }

    const wordCount = content ? content.replace(/\s/g, '').length : 0;

    db.run(`
      INSERT INTO chapters (id, book_id, user_id, chapter_number, chapter_name, title, content, word_count, outline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, bookId, userId, chapterNumber, chapterName, title, content, wordCount, outline || '']);

    // 更新书籍的更新时间
    db.run('UPDATE books SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [bookId]);
    saveDatabase(db);

    return this.getById(id);
  }

  /**
   * 获取书籍的所有章节（按用户筛选）
   */
  async getByBookId(bookId, userId = '') {
    const db = await dbPromise;
    let sql = `
      SELECT * FROM chapters
      WHERE book_id = ?
    `;
    let params = [bookId];

    if (userId) {
      sql += 'AND user_id = ? ';
      params.push(userId);
    }

    sql += 'ORDER BY chapter_number ASC';

    return execQuery(db, sql, params);
  }

  /**
   * 根据ID获取章节
   */
  async getById(id) {
    const db = await dbPromise;
    return execQueryOne(db, 'SELECT * FROM chapters WHERE id = ?', [id]);
  }

  /**
   * 按书籍和章号获取章节
   */
  async getByBookAndChapterNumber(bookId, chapterNumber, userId = '') {
    const db = await dbPromise;
    let sql = 'SELECT * FROM chapters WHERE book_id = ? AND chapter_number = ?';
    const params = [bookId, chapterNumber];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    sql += ' LIMIT 1';
    return execQueryOne(db, sql, params);
  }

  async upsertByChapterNumber(bookId, chapterNumber, data = {}, userId = '') {
    const existing = await this.getByBookAndChapterNumber(bookId, chapterNumber, userId);

    if (existing) {
      return this.update(existing.id, {
        title: data.title || existing.title,
        chapter_name: data.chapter_name !== undefined ? data.chapter_name : existing.chapter_name,
        content: data.content !== undefined ? data.content : existing.content
      });
    }

    return this.create(
      bookId,
      data.title || `第${chapterNumber}章`,
      data.content || '',
      chapterNumber,
      data.chapter_name || '',
      userId,
      data.outline || ''
    );
  }

  /**
   * 更新章节内容
   */
  async update(id, updates) {
    const db = await dbPromise;
    const allowedFields = ['title', 'chapter_name', 'content', 'status'];
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);

        // 如果更新了内容，重新计算字数
        if (key === 'content') {
          fields.push('word_count = ?');
          values.push(value ? value.replace(/\s/g, '').length : 0);
        }
      }
    }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.run(`UPDATE chapters SET ${fields.join(', ')} WHERE id = ?`, values);

    // 更新书籍的更新时间
    const chapter = await this.getById(id);
    if (chapter) {
      db.run('UPDATE books SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [chapter.book_id]);
    }
    saveDatabase(db);

    return this.getById(id);
  }

  /**
   * 删除章节
   */
  async delete(id) {
    const db = await dbPromise;
    const chapter = await this.getById(id);
    if (!chapter) return false;

    db.run('DELETE FROM chapters WHERE id = ?', [id]);
    const result = execQueryOne(db, 'SELECT changes() as changes');

    if (result && result.changes > 0) {
      // 更新书籍的更新时间
      db.run('UPDATE books SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [chapter.book_id]);
      saveDatabase(db);
      return true;
    }

    return false;
  }

  async deleteByBookAndChapterNumber(bookId, chapterNumber, userId = '') {
    const existing = await this.getByBookAndChapterNumber(bookId, chapterNumber, userId);
    if (!existing) return false;
    return this.delete(existing.id);
  }

  async deleteByBookId(bookId, userId = '') {
    const db = await dbPromise;
    let sql = 'DELETE FROM chapters WHERE book_id = ?';
    const params = [bookId];
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    db.run(sql, params);
    const result = execQueryOne(db, 'SELECT changes() as changes');
    db.run('UPDATE books SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [bookId]);
    saveDatabase(db);
    return result ? Number(result.changes || 0) : 0;
  }

  /**
   * 批量导出章节为TXT
   */
  async exportToTxt(bookId, chapterIds = null) {
    const book = await new BookService().getById(bookId);
    if (!book) throw new Error('书籍不存在');

    let chapters;
    if (chapterIds && chapterIds.length > 0) {
      const db = await dbPromise;
      const placeholders = chapterIds.map(() => '?').join(',');
      chapters = execQuery(db, `
        SELECT * FROM chapters
        WHERE book_id = ? AND id IN (${placeholders})
        ORDER BY chapter_number ASC
      `, [bookId, ...chapterIds]);
    } else {
      chapters = await this.getByBookId(bookId);
    }

    // 构建TXT内容
    let txtContent = `${book.title}\n`;
    txtContent += `作者：${book.author || '未知'}\n`;
    txtContent += `类型：${book.genre}\n`;
    txtContent += `导出时间：${new Date().toLocaleString('zh-CN')}\n`;
    txtContent += '='.repeat(50) + '\n\n';

    for (const chapter of chapters) {
      // 使用 chapter_number 和 chapter_name 生成标题
      const chapterTitle = chapter.chapter_name
        ? `第${chapter.chapter_number}章 ${chapter.chapter_name}`
        : `第${chapter.chapter_number}章`;
      txtContent += `\n${chapterTitle}\n`;
      txtContent += '-'.repeat(30) + '\n\n';
      txtContent += chapter.content + '\n\n';
    }

    return {
      filename: `${book.title}.txt`,
      content: txtContent
    };
  }
}

class TemplateService {
  /**
   * 获取所有模板（按用户筛选）
   */
  async getAll(genre = null, userId = '') {
    const db = await dbPromise;
    let sql = 'SELECT * FROM templates';
    let params = [];

    if (userId) {
      sql += ' WHERE user_id = ?';
      params.push(userId);
    }

    if (genre) {
      sql += userId ? ' AND genre = ?' : ' WHERE genre = ?';
      params.push(genre);
    }

    sql += ' ORDER BY is_builtin DESC, created_at DESC';

    return execQuery(db, sql, params);
  }

  /**
   * 根据ID获取模板
   */
  async getById(id) {
    const db = await dbPromise;
    return execQueryOne(db, 'SELECT * FROM templates WHERE id = ?', [id]);
  }

  /**
   * 创建自定义模板（关联用户）
   */
  async create(name, genre, promptTemplate, description = '', defaultSettings = {}, userId = '') {
    const db = await dbPromise;
    const id = generateId();

    db.run(`
      INSERT INTO templates (id, user_id, name, genre, description, prompt_template, default_settings)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, userId, name, genre, description, promptTemplate, JSON.stringify(defaultSettings)]);

    saveDatabase(db);
    return this.getById(id);
  }

  /**
   * 删除模板（只能删除自定义模板）
   */
  async delete(id) {
    const template = await this.getById(id);
    if (!template) return false;
    if (template.is_builtin) throw new Error('不能删除内置模板');

    const db = await dbPromise;
    db.run('DELETE FROM templates WHERE id = ?', [id]);
    saveDatabase(db);
    const result = execQueryOne(db, 'SELECT changes() as changes');
    return result && result.changes > 0;
  }
}

class ForeshadowingService {
  /**
   * 添加伏笔（关联用户）
   */
  async create(bookId, title, description, chapterId = null, userId = '') {
    const db = await dbPromise;
    const id = generateId();

    db.run(`
      INSERT INTO foreshadowing (id, book_id, user_id, title, description, chapter_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, bookId, userId, title, description, chapterId]);

    saveDatabase(db);
    return this.getById(id);
  }

  /**
   * 获取书籍的所有伏笔（按用户筛选）
   */
  async getByBookId(bookId, status = null, userId = '') {
    const db = await dbPromise;
    let sql = `
      SELECT f.*, c.title as chapter_title
      FROM foreshadowing f
      LEFT JOIN chapters c ON f.chapter_id = c.id
      WHERE f.book_id = ?
    `;
    let params = [bookId];

    if (userId) {
      sql += 'AND f.user_id = ? ';
      params.push(userId);
    }

    if (status) {
      sql += 'AND f.status = ? ';
      params.push(status);
    }

    sql += 'ORDER BY f.created_at DESC';

    return execQuery(db, sql, params);
  }

  /**
   * 根据ID获取伏笔
   */
  async getById(id) {
    const db = await dbPromise;
    return execQueryOne(db, `
      SELECT f.*, c.title as chapter_title
      FROM foreshadowing f
      LEFT JOIN chapters c ON f.chapter_id = c.id
      WHERE f.id = ?
    `, [id]);
  }

  /**
   * 更新伏笔状态
   */
  async updateStatus(id, status, chapterId = null) {
    const db = await dbPromise;
    const allowedStatuses = ['pending', 'hinted', 'resolved'];
    if (!allowedStatuses.includes(status)) {
      throw new Error('无效的伏笔状态');
    }

    if (status === 'resolved') {
      db.run(`
        UPDATE foreshadowing
        SET status = ?, resolved_at = CURRENT_TIMESTAMP, chapter_id = ?
        WHERE id = ?
      `, [status, chapterId, id]);
    } else {
      db.run(`
        UPDATE foreshadowing
        SET status = ?, chapter_id = ?
        WHERE id = ?
      `, [status, chapterId, id]);
    }

    saveDatabase(db);
    return this.getById(id);
  }

  /**
   * 删除伏笔
   */
  async delete(id) {
    const db = await dbPromise;
    db.run('DELETE FROM foreshadowing WHERE id = ?', [id]);
    saveDatabase(db);
    const result = execQueryOne(db, 'SELECT changes() as changes');
    return result && result.changes > 0;
  }
}

// ==================== 角色管理 ====================

/**
 * 智能推断角色类型
 * @param {string} name - 角色名称
 * @param {string} createdAt - 创建时间
 * @returns {string} 'main_character' 或 'chapter_character'
 */
function inferCharacterType(name, createdAt) {
  // 关键词匹配：如果名称包含这些词，很可能是章节新增角色
  const chapterKeywords = ['本章', '新增', '临时', '路人', '配角', '小角色', '龙套'];
  const isChapterCharacter = chapterKeywords.some(keyword =>
    name && name.includes(keyword)
  );

  if (isChapterCharacter) {
    return 'chapter_character';
  }

  // 如果角色是在最近7天内创建的，且没有明确标记，可能是章节新增
  // （这个逻辑可以根据实际情况调整）
  if (createdAt) {
    const createdDate = new Date(createdAt);
    const now = new Date();
    const daysDiff = (now - createdDate) / (1000 * 60 * 60 * 24);

    // 如果超过30天，更可能是主角/重要配角
    if (daysDiff > 30) {
      return 'main_character';
    }
  }

  // 默认为主角/重要配角
  return 'main_character';
}

class CharacterService {
  /**
   * 添加角色（关联用户）
   */
  async create(bookId, name, appearance = '', personality = '', background = '', notes = '', userId = '', characterType = 'main_character', roleTier = 'supporting_major', avatarImage = '') {
    const db = await dbPromise;
    const id = generateId();

    db.run(`
      INSERT INTO novel_characters (id, book_id, user_id, name, appearance, personality, background, notes, character_type, role_tier, avatar_image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, bookId, userId, name, appearance, personality, background, notes, characterType, roleTier, avatarImage]);

    saveDatabase(db);
    return this.getById(id);
  }

  /**
   * 获取书籍的所有角色（按用户和类型筛选）
   */
  async getByBookId(bookId, userId = '', characterType = null) {
    const db = await dbPromise;
    let sql = `
      SELECT * FROM novel_characters
      WHERE book_id = ?
    `;
    let params = [bookId];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    if (characterType) {
      sql += ' AND character_type = ?';
      params.push(characterType);
    }

    sql += ' ORDER BY created_at ASC';

    return execQuery(db, sql, params);
  }

  /**
   * 根据ID获取角色
   */
  async getById(id) {
    const db = await dbPromise;
    return execQueryOne(db, 'SELECT * FROM novel_characters WHERE id = ?', [id]);
  }

  /**
   * 更新角色
   */
  async update(id, updates) {
    const db = await dbPromise;
    const allowedFields = ['name', 'appearance', 'personality', 'background', 'notes', 'character_type', 'role_tier', 'avatar_image'];
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates || {})) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return this.getById(id);

    values.push(id);
    db.run(`UPDATE novel_characters SET ${fields.join(', ')} WHERE id = ?`, values);
    saveDatabase(db);

    return this.getById(id);
  }

  /**
   * 删除角色
   */
  async delete(id) {
    const db = await dbPromise;
    db.run('DELETE FROM novel_characters WHERE id = ?', [id]);
    saveDatabase(db);
    const result = execQueryOne(db, 'SELECT changes() as changes');
    return result && result.changes > 0;
  }

  /**
   * 清空某本书的全部角色
   */
  async deleteByBookId(bookId) {
    const db = await dbPromise;
    db.run('DELETE FROM novel_characters WHERE book_id = ?', [bookId]);
    saveDatabase(db);
    const result = execQueryOne(db, 'SELECT changes() as changes');
    return result ? Number(result.changes || 0) : 0;
  }
}

class BookPlanService {
  async getByBookId(bookId, userId = '') {
    const db = await dbPromise;
    return execQueryOne(
      db,
      userId
        ? 'SELECT * FROM book_plans WHERE book_id = ? AND user_id = ? ORDER BY updated_at DESC LIMIT 1'
        : "SELECT * FROM book_plans WHERE book_id = ? ORDER BY CASE WHEN user_id = '' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1",
      userId ? [bookId, userId] : [bookId]
    );

  }

  async upsert(bookId, payload = {}, userId = '') {
    const db = await dbPromise;
    const existing = execQueryOne(
      db,
      userId
        ? 'SELECT id, version FROM book_plans WHERE book_id = ? AND user_id = ? LIMIT 1'
        : "SELECT id, version FROM book_plans WHERE book_id = ? AND user_id = '' LIMIT 1",
      userId ? [bookId, userId] : [bookId]
    );

    const normalized = {
      premise: payload.premise || '',
      main_goal: payload.main_goal || payload.mainGoal || '',
      core_conflict: payload.core_conflict || payload.coreConflict || '',
      world_rules: payload.world_rules || payload.worldRules || '',
      role_summary: payload.role_summary || payload.roleSummary || '',
      main_outline: payload.main_outline || payload.mainOutline || '',
      volume_outline: payload.volume_outline || payload.volumeOutline || '',
      detailed_outline: payload.detailed_outline || payload.detailedOutline || '',
      structured_content: typeof payload.structured_content === 'string'
        ? payload.structured_content
        : JSON.stringify(payload.structured_content || payload.structuredContent || {}),
      source: payload.source || 'manual',
      status: payload.status || 'draft'
    };

    if (existing) {
      db.run(`
        UPDATE book_plans
        SET premise = ?, main_goal = ?, core_conflict = ?, world_rules = ?, role_summary = ?,
            main_outline = ?, volume_outline = ?, detailed_outline = ?, structured_content = ?,
            source = ?, status = ?, version = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        normalized.premise,
        normalized.main_goal,
        normalized.core_conflict,
        normalized.world_rules,
        normalized.role_summary,
        normalized.main_outline,
        normalized.volume_outline,
        normalized.detailed_outline,
        normalized.structured_content,
        normalized.source,
        normalized.status,
        Number(existing.version || 1) + 1,
        existing.id
      ]);
    } else {
      db.run(`
        INSERT INTO book_plans (
          id, book_id, user_id, premise, main_goal, core_conflict, world_rules, role_summary,
          main_outline, volume_outline, detailed_outline, structured_content, source, status, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        generateId(),
        bookId,
        userId,
        normalized.premise,
        normalized.main_goal,
        normalized.core_conflict,
        normalized.world_rules,
        normalized.role_summary,
        normalized.main_outline,
        normalized.volume_outline,
        normalized.detailed_outline,
        normalized.structured_content,
        normalized.source,
        normalized.status,
        1
      ]);
    }

    // 兼容同步到旧“全书角色摘要”
    if (normalized.role_summary.trim()) {
      const existingSummary = execQueryOne(
        db,
        "SELECT id FROM novel_characters WHERE book_id = ? AND user_id = ? AND name = '全书角色设定' LIMIT 1",
        [bookId, userId]
      );

      if (existingSummary) {
        db.run(
          `UPDATE novel_characters
           SET background = ?, notes = ?, character_type = 'main_character'
           WHERE id = ?`,
          [normalized.role_summary, 'P2 迁移后的全书角色摘要镜像', existingSummary.id]
        );
      } else {
        db.run(
          `INSERT INTO novel_characters(id, book_id, user_id, name, appearance, personality, background, notes, character_type)
           VALUES (?, ?, ?, '全书角色设定', '', '', ?, ?, 'main_character')`,
          [generateId(), bookId, userId, normalized.role_summary, 'P2 迁移后的全书角色摘要镜像']
        );
      }
    }

    saveDatabase(db);
    return this.getByBookId(bookId, userId);
  }
}

class VolumePlanService {
  async getByBookId(bookId, userId = '') {
    const db = await dbPromise;
    const rows = execQuery(
      db,
      userId
        ? 'SELECT * FROM volume_plans WHERE book_id = ? AND user_id = ? ORDER BY volume_number ASC'
        : "SELECT * FROM volume_plans WHERE book_id = ? ORDER BY volume_number ASC, CASE WHEN user_id = '' THEN 0 ELSE 1 END",
      userId ? [bookId, userId] : [bookId]
    );

    if (rows.length > 0) {
      return rows;
    }

    return [];
  }

  async deleteByBookId(bookId, userId = '') {
    const db = await dbPromise;
    if (userId) {
      db.run('DELETE FROM volume_plans WHERE book_id = ? AND user_id = ?', [bookId, userId]);
      db.run('DELETE FROM volume_settings WHERE book_id = ? AND user_id = ?', [bookId, userId]);
    } else {
      db.run("DELETE FROM volume_plans WHERE book_id = ? AND user_id = ''", [bookId]);
      db.run('DELETE FROM volume_settings WHERE book_id = ?', [bookId]);
    }
    saveDatabase(db);
    return true;
  }

  async upsert(bookId, volumeNumber, payload = {}, userId = '') {
    const db = await dbPromise;
    const existing = execQueryOne(
      db,
      userId
        ? 'SELECT id, version FROM volume_plans WHERE book_id = ? AND volume_number = ? AND user_id = ? LIMIT 1'
        : "SELECT id, version FROM volume_plans WHERE book_id = ? AND volume_number = ? AND user_id = '' LIMIT 1",
      userId ? [bookId, volumeNumber, userId] : [bookId, volumeNumber]
    );

    const normalized = {
      volume_name: payload.volume_name || payload.volumeName || '',
      volume_theme: payload.volume_theme || payload.volumeTheme || '',
      stage_goal: payload.stage_goal || payload.stageGoal || '',
      core_conflict: payload.core_conflict || payload.coreConflict || '',
      start_role_state: payload.start_role_state || payload.startRoleState || '',
      end_role_state: payload.end_role_state || payload.endRoleState || '',
      estimated_chapters: Number(payload.estimated_chapters || payload.estimatedChapters || 15) || 15,
      storyline_quota: Number(payload.storyline_quota || payload.storylineQuota || 3) || 3,
      structured_content: typeof payload.structured_content === 'string'
        ? payload.structured_content
        : JSON.stringify(payload.structured_content || payload.structuredContent || {}),
      notes: payload.notes || '',
      cover_image: payload.cover_image || payload.coverImage || '',
      source: payload.source || 'manual',
      status: payload.status || 'draft'
    };

    if (existing) {
      db.run(`
        UPDATE volume_plans
        SET volume_name = ?, volume_theme = ?, stage_goal = ?, core_conflict = ?, start_role_state = ?,
            end_role_state = ?, estimated_chapters = ?, storyline_quota = ?, structured_content = ?,
            notes = ?, cover_image = ?, source = ?, status = ?, version = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        normalized.volume_name,
        normalized.volume_theme,
        normalized.stage_goal,
        normalized.core_conflict,
        normalized.start_role_state,
        normalized.end_role_state,
        normalized.estimated_chapters,
        normalized.storyline_quota,
        normalized.structured_content,
        normalized.notes,
        normalized.cover_image,
        normalized.source,
        normalized.status,
        Number(existing.version || 1) + 1,
        existing.id
      ]);
    } else {
      db.run(`
        INSERT INTO volume_plans (
          id, book_id, user_id, volume_number, volume_name, volume_theme, stage_goal, core_conflict,
          start_role_state, end_role_state, estimated_chapters, storyline_quota, structured_content,
          notes, cover_image, source, status, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        generateId(),
        bookId,
        userId,
        volumeNumber,
        normalized.volume_name,
        normalized.volume_theme,
        normalized.stage_goal,
        normalized.core_conflict,
        normalized.start_role_state,
        normalized.end_role_state,
        normalized.estimated_chapters,
        normalized.storyline_quota,
        normalized.structured_content,
        normalized.notes,
        normalized.cover_image,
        normalized.source,
        normalized.status,
        1
      ]);
    }

    // 兼容同步 volume_settings
    const existingSetting = execQueryOne(
      db,
      'SELECT id FROM volume_settings WHERE book_id = ? AND volume_number = ?',
      [bookId, volumeNumber]
    );

    if (existingSetting) {
      db.run(
        `UPDATE volume_settings
         SET volume_name = ?, volume_theme = ?, estimated_chapters = ?, storyline_count = ?,
             notes = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          normalized.volume_name,
          normalized.volume_theme,
          normalized.estimated_chapters,
          normalized.storyline_quota,
          normalized.notes,
          normalized.status,
          existingSetting.id
        ]
      );
    } else {
      db.run(
        `INSERT INTO volume_settings(
          id, book_id, user_id, volume_number, volume_name, volume_theme,
          estimated_chapters, volume_position, storyline_count, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'middle', ?, ?, ?)`,
        [
          generateId(),
          bookId,
          userId,
          volumeNumber,
          normalized.volume_name,
          normalized.volume_theme,
          normalized.estimated_chapters,
          normalized.storyline_quota,
          normalized.notes,
          normalized.status
        ]
      );
    }

    saveDatabase(db);
    return this.getByBookId(bookId, userId);
  }
}

class ChapterPlanService {
  async getByBookId(bookId, userId = '') {
    const db = await dbPromise;
    let sql = 'SELECT * FROM chapter_plans WHERE book_id = ?';
    const params = [bookId];
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    sql += ' ORDER BY chapter_number ASC';
    return execQuery(db, sql, params);
  }

  /**
   * 按章号创建或更新章节
   */
  async upsertByChapterNumber(bookId, chapterNumber, data = {}, userId = '') {
    const existing = await this.getByBookAndChapterNumber(bookId, chapterNumber, userId);

    if (existing) {
      return this.update(existing.id, {
        title: data.title || existing.title,
        chapter_name: data.chapter_name !== undefined ? data.chapter_name : existing.chapter_name,
        content: data.content !== undefined ? data.content : existing.content
      });
    }

    return this.create(
      bookId,
      data.title || `第${chapterNumber}章`,
      data.content || '',
      chapterNumber,
      data.chapter_name || '',
      userId,
      data.outline || ''
    );
  }

  async getByBookAndChapterNumber(bookId, chapterNumber, userId = '') {
    const db = await dbPromise;
    let sql = 'SELECT * FROM chapter_plans WHERE book_id = ? AND chapter_number = ?';
    const params = [bookId, chapterNumber];
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    sql += ' ORDER BY updated_at DESC LIMIT 1';
    return execQueryOne(db, sql, params);
  }

  async deleteByBookAndChapterNumber(bookId, chapterNumber, userId = '') {
    const db = await dbPromise;
    let sql = 'DELETE FROM chapter_plans WHERE book_id = ? AND chapter_number = ?';
    const params = [bookId, chapterNumber];
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    db.run(sql, params);
    saveDatabase(db);
    const result = execQueryOne(db, 'SELECT changes() as changes');
    return result ? Number(result.changes || 0) : 0;
  }

  async deleteByBookId(bookId, userId = '') {
    const db = await dbPromise;
    let sql = 'DELETE FROM chapter_plans WHERE book_id = ?';
    const params = [bookId];
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    db.run(sql, params);
    saveDatabase(db);
    const result = execQueryOne(db, 'SELECT changes() as changes');
    return result ? Number(result.changes || 0) : 0;
  }

  async upsert(bookId, chapterNumber, payload = {}, userId = '') {
    const db = await dbPromise;
    const existing = await this.getByBookAndChapterNumber(bookId, chapterNumber, userId);
    const chapterGoal = normalizeChapterGoalPayload(payload);
    const chapterOutline = normalizeChapterOutlinePayload(payload);
    const normalizedStructuredContent = buildChapterPlanStructuredContent(payload, chapterGoal, chapterOutline);
    const chapterId = payload.chapter_id || payload.chapterId || '';
    const volumeNumber = Number.parseInt(payload.volume_number ?? payload.volumeNumber ?? 1, 10) || 1;
    const chapterName = payload.chapter_name || payload.chapterName || '';
    const summary = chapterOutline.summary || payload.summary || '';
    const chapterMission = chapterGoal.chapter_mission;
    const emotionTarget = chapterGoal.emotion_target;
    const outlineText = chapterOutline.outline_text;
    const sceneOutline = typeof payload.scene_outline === 'string'
      ? payload.scene_outline
      : JSON.stringify(chapterOutline.scene_outline || []);
    const characterNotes = chapterOutline.character_notes;
    const appearingRoles = typeof payload.appearing_roles === 'string'
      ? payload.appearing_roles
      : JSON.stringify(chapterGoal.appearing_roles || []);
    const previousHook = chapterGoal.previous_hook;
    const endingHook = chapterOutline.ending_hook;
    const mainStorylineId = chapterGoal.main_storyline_id;
    const targetStorylines = JSON.stringify(chapterGoal.target_storylines || []);
    const structuredContent = typeof payload.structured_content === 'string'
      ? payload.structured_content
      : JSON.stringify(normalizedStructuredContent);
    const source = payload.source || 'manual';
    const status = payload.status || 'draft';

    if (existing) {
      db.run(`
        UPDATE chapter_plans
        SET chapter_id = ?, volume_number = ?, chapter_name = ?, summary = ?, chapter_mission = ?,
            emotion_target = ?, outline_text = ?, scene_outline = ?, character_notes = ?, appearing_roles = ?,
            previous_hook = ?, ending_hook = ?, main_storyline_id = ?, target_storylines = ?,
            structured_content = ?, source = ?, status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        chapterId, volumeNumber, chapterName, summary, chapterMission,
        emotionTarget, outlineText, sceneOutline, characterNotes, appearingRoles,
        previousHook, endingHook, mainStorylineId, targetStorylines,
        structuredContent, source, status,
        existing.id
      ]);
    } else {
      const id = generateId();
      db.run(`
        INSERT INTO chapter_plans (
          id, book_id, chapter_id, user_id, volume_number, chapter_number, chapter_name, summary,
          chapter_mission, emotion_target, outline_text, scene_outline, character_notes, appearing_roles,
          previous_hook, ending_hook, main_storyline_id, target_storylines, structured_content, source, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, bookId, chapterId, userId, volumeNumber, chapterNumber, chapterName, summary,
        chapterMission, emotionTarget, outlineText, sceneOutline, characterNotes, appearingRoles,
        previousHook, endingHook, mainStorylineId, targetStorylines, structuredContent, source, status
      ]);
    }

    syncStorylineProgressFromChapterPlan(db, {
      bookId,
      chapterNumber,
      chapterGoal,
      structuredContent: normalizedStructuredContent
    });
    syncChapterRolesToCharacterLibrary(db, {
      bookId,
      userId,
      chapterNumber,
      chapterOutline,
      structuredContent: normalizedStructuredContent
    });

    saveDatabase(db);
    return this.getByBookAndChapterNumber(bookId, chapterNumber, userId);
  }

  async repairChapterPlanConsistency(bookId, chapterNumber, userId = '') {
    const db = await dbPromise;
    const existing = await this.getByBookAndChapterNumber(bookId, chapterNumber, userId);
    if (!existing) return null;

    const { chapterGoal, structuredContent } = buildChapterPlanRepairPayload(existing);

    db.run(`
      UPDATE chapter_plans
      SET structured_content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      JSON.stringify(structuredContent),
      existing.id
    ]);

    syncStorylineProgressFromChapterPlan(db, {
      bookId,
      chapterNumber,
      chapterId: existing.chapter_id || '',
      chapterGoal,
      structuredContent
    });
    syncChapterRolesToCharacterLibrary(db, {
      bookId,
      userId,
      chapterNumber,
      chapterOutline: {
        character_notes: existing.character_notes || ''
      },
      structuredContent
    });

    saveDatabase(db);
    return this.getByBookAndChapterNumber(bookId, chapterNumber, userId);
  }
}

module.exports = {
  BookService,
  ChapterService,
  TemplateService,
  ForeshadowingService,
  CharacterService,
  BookPlanService,
  VolumePlanService,
  ChapterPlanService,
  syncStorylineProgressFromChapterPlan,
  syncChapterRolesToCharacterLibrary,
  generateId,
  saveDatabase,
  execQuery,
  execQueryOne,
  inferCharacterType // 导出智能推断函数
};
