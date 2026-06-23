import { formatStorylineTypeLabel } from './lib/storylineLabel.js';
import { normalizeNarrativeOutlineText } from './lib/chapterPlan.js';

const API_BASE = '/api';
const CURRENT_BOOK_KEY = 'currentBookId';
const LEGACY_CURRENT_BOOK_KEY = 'current_book_id';
const CURRENT_BOOK_EVENT = 'alipro:current-book-changed';

function getAuthToken() {
  try {
    return localStorage.getItem('auth_token') || '';
  } catch (_) {
    return '';
  }
}

function createHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: createHeaders(),
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data.data;
}

function normalizeBook(book) {
  return {
    id: book.id,
    title: book.title || '未命名书籍',
    author: book.author || '',
    description: book.description || '',
    coverImage: book.cover_image || '',
    platform: book.target_platform || '未设置',
    genre: book.genre || '未设置',
    subgenre: book.subgenre || '',
    template: book.writing_style || 'fast_pace',
    status: book.status || 'draft'
  };
}

function normalizeStoryline(storyline) {
  const normalizedType = String(storyline.storyline_type || '').trim().toLowerCase() === 'main' ? 'main' : 'branch';
  const structuredContent = parseJsonObject(storyline.structured_content || storyline.structuredContent);
  const currentProgress = parseJsonObject(structuredContent.currentProgress);
  const chapterProgress = Array.isArray(structuredContent.chapter_progress)
    ? structuredContent.chapter_progress
    : [];
  return {
    id: storyline.id,
    volumeNumber: Number(storyline.volume_number || 1),
    storylineNumber: Number(storyline.storyline_number || 1),
    name: storyline.storyline_name || '未命名剧情线',
    type: normalizedType,
    description: storyline.description || '',
    coreConflict: storyline.core_conflict || '',
    startChapter: Number(storyline.start_chapter || 1),
    endChapter: Number(storyline.end_chapter || 10),
    status: storyline.status || structuredContent.lifecycleStatus || 'draft',
    structuredContent,
    currentProgress,
    chapterProgress,
    lastProgressSummary: currentProgress.lastProgressSummary || structuredContent?.last_chapter_feedback?.story_progress || '',
    lastUpdatedChapterNumber: Number(currentProgress.lastUpdatedChapterNumber || 0) || null,
    lastUsedBeatIds: Array.isArray(currentProgress.lastUsedBeatIds) ? currentProgress.lastUsedBeatIds : [],
    requiresReview: Boolean(currentProgress.requiresReview || storyline.status === 'needs_review')
  };
}

function summarizeText(text, fallback) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

function countCharacterParagraphs(text) {
  return String(text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function normalizeRoleExecutionItem(item) {
  if (!item || typeof item !== 'object') return null;
  const normalizedDimension = String(item.dimension || item.change_dimension || item.changeDimension || '').trim();
  const normalizedDirection = String(item.direction || item.change_direction || item.changeDirection || '').trim();
  const normalizedScope = String(item.scope || item.change_scope || item.changeScope || '').trim();
  const normalizedConfidence = String(item.confidence || '').trim();
  const role = String(item.role || item.name || '').trim();
  const baseline = String(item.baseline || '').trim();
  const chapterFunction = String(item.chapter_function || item.chapterFunction || '').trim();
  const allowedChange = String(item.allowed_change || item.allowedChange || '').trim();
  const forbiddenChange = String(item.forbidden_change || item.forbiddenChange || '').trim();
  if (!role && !baseline && !chapterFunction && !allowedChange && !forbiddenChange && !normalizedDimension && !normalizedDirection && !normalizedScope && !normalizedConfidence) return null;
  return {
    role,
    baseline,
    chapter_function: chapterFunction,
    allowed_change: allowedChange,
    forbidden_change: forbiddenChange,
    dimension: normalizedDimension,
    direction: normalizedDirection,
    scope: normalizedScope,
    confidence: normalizedConfidence
  };
}

function normalizeRoleExecutionList(value) {
  const raw = Array.isArray(value) ? value : parseJsonArray(value);
  return raw.map(normalizeRoleExecutionItem).filter(Boolean);
}

function buildRoleExecutionFallback(planData = {}) {
  const roles = Array.isArray(planData.appearing_roles) ? planData.appearing_roles : [];
  const baseline = String(planData.character_notes || '').trim();
  const mission = String(planData.chapter_mission || '').trim();
  return roles
    .map((role) => String(role || '').trim())
    .filter(Boolean)
    .map((role) => ({
      role,
      baseline: baseline || '延续当前人物底色。',
      chapter_function: mission ? `围绕本章任务“${mission}”承担推进作用。` : '承担本章推进作用。',
      allowed_change: '只允许推进一步，不允许跨阶段突变。',
      forbidden_change: '不能直接完成长期关系翻转、立场逆转或真相彻底揭示。',
      dimension: 'story_function',
      direction: 'hold',
      scope: 'temporary',
      confidence: 'low'
    }));
}

function normalizeChapterPlanRecord(plan) {
  if (!plan || typeof plan !== 'object') return null;
  const structuredContent = parseJsonObject(plan.structured_content || plan.structuredContent);
  return {
    ...plan,
    structured_content: structuredContent,
    structuredContent,
    target_storylines: parseJsonArray(plan.target_storylines),
    scene_outline: parseJsonArray(plan.scene_outline)
  };
}

function normalizeGenerationConstraints(value) {
  const raw = value && typeof value === 'object' ? value : {};
  const normalizeGroup = (group) => Array.isArray(group)
    ? group
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const label = String(item.label || '').trim();
        const source = String(item.source || '').trim();
        const rule = String(item.rule || '').trim();
        return {
          label,
          source,
          rule,
          items: Array.isArray(item.items)
            ? item.items.map((entry) => String(entry || '').trim()).filter(Boolean)
            : []
        };
      })
      .filter(Boolean)
    : [];

  return {
    summary: String(raw.summary || '').trim(),
    anchors: Array.isArray(raw.anchors) ? raw.anchors.map((item) => String(item || '').trim()).filter(Boolean) : [],
    allowed: normalizeGroup(raw.allowed),
    blocked: normalizeGroup(raw.blocked),
    rolePool: Array.isArray(raw.rolePool) ? raw.rolePool.map((item) => String(item || '').trim()).filter(Boolean) : []
  };
}

function buildVisibleGenerationConstraints({
  plan,
  previousCarry,
  previousFeedback,
  mainStoryline,
  matchedStorylines
}) {
  const anchors = [
    mainStoryline?.name || '',
    ...((Array.isArray(matchedStorylines) ? matchedStorylines : []).map((item) => item?.name || ''))
  ].map((item) => String(item || '').trim()).filter(Boolean);
  const planRoles = normalizeRoleList(parseJsonArray(plan?.appearing_roles));
  const previousElements = Array.isArray(previousFeedback?.continuity_report?.new_elements)
    ? previousFeedback.continuity_report.new_elements
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') return String(item.name || item.note || '').trim();
        return '';
      })
      .filter(Boolean)
    : [];
  const planTerms = [
    String(plan?.chapter_mission || '').trim(),
    String(plan?.previous_hook || '').trim(),
    String(plan?.ending_hook || '').trim()
  ].filter(Boolean);

  return normalizeGenerationConstraints({
    summary: '根据本章计划、上一章反馈和当前剧情线自动整理，生成前默认生效。',
    anchors,
    allowed: [
      previousCarry.length > 0 ? { label: '上一章承接项', items: previousCarry.slice(0, 4), source: 'chapter_feedback' } : null,
      previousElements.length > 0 ? { label: '上一章已入台账设定', items: previousElements.slice(0, 4), source: 'chapter_feedback' } : null,
      planRoles.length > 0 ? { label: '本章已挂接角色', items: planRoles.slice(0, 6), source: 'chapter_plan' } : null,
      planTerms.length > 0 ? { label: '本章计划重点', items: planTerms.slice(0, 3), source: 'chapter_plan' } : null
    ].filter(Boolean),
    blocked: [
      { label: '高影响背景空降', rule: '例如突然补出主角新亲属、父辈旧案真相、隐藏历史线，这类高影响背景没有提前铺垫时，不要直接写进本章核心推进。', source: 'system' },
      { label: '大型设定空降', rule: '例如突然出现新宗门势力、新世界规则、关键法宝/钥匙、终局目标，这类核心设定没有提前挂接时，不要直接接管剧情。', source: 'system' },
      { label: '偏离主线', rule: '例如正文突然花大篇幅去写和当前主线无关的新支线、新人物恩怨或临时事件，这类内容如果不能服务当前锚点，就不该占用本章核心篇幅。', source: 'system' }
    ],
    rolePool: planRoles
  });
}

function normalizeRoleEntry(role) {
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

function normalizeRoleList(value) {
  return parseJsonArray(value)
    .map(normalizeRoleEntry)
    .filter(Boolean);
}

export function getStoredCurrentBookId() {
  try {
    return localStorage.getItem(CURRENT_BOOK_KEY) || localStorage.getItem(LEGACY_CURRENT_BOOK_KEY) || '';
  } catch (_) {
    return '';
  }
}

export function persistCurrentBookId(bookId) {
  try {
    if (bookId) {
      localStorage.setItem(CURRENT_BOOK_KEY, bookId);
      localStorage.setItem(LEGACY_CURRENT_BOOK_KEY, bookId);
    } else {
      localStorage.removeItem(CURRENT_BOOK_KEY);
      localStorage.removeItem(LEGACY_CURRENT_BOOK_KEY);
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(CURRENT_BOOK_EVENT, {
        detail: { bookId: bookId || '' }
      }));
    }
  } catch (_) {}
}

export async function fetchBookList() {
  const books = await request('/books');
  return Array.isArray(books) ? books.map(normalizeBook) : [];
}

export async function createBook(payload) {
  return request('/books', {
    method: 'POST',
    body: JSON.stringify({
      title: payload.title,
      genre: payload.genre,
      subgenre: payload.subgenre || '',
      description: payload.description || '',
      author: payload.author || '',
      cover_image: payload.cover_image || payload.coverImage || '',
      status: payload.status || 'writing'
    })
  });
}

export async function updateBook(bookId, payload) {
  return request(`/books/${bookId}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: payload.title,
      genre: payload.genre,
      subgenre: payload.subgenre || '',
      description: payload.description || '',
      author: payload.author || '',
      cover_image: payload.cover_image || payload.coverImage || '',
      status: payload.status || 'writing'
    })
  });
}

export async function fetchBookPlanningBundle(bookId) {
  const [book, bookPlan, characters, outline, volumePlans] = await Promise.all([
    request(`/books/${bookId}`),
    request(`/books/${bookId}/book-plan`).catch(() => null),
    request(`/books/${bookId}/characters`).catch(() => []),
    request(`/books/${bookId}/outline`).catch(() => null),
    request(`/books/${bookId}/volume-plans`).catch(() => [])
  ]);

  const normalizedBook = normalizeBook(book);
  const roleSummaryRecord = Array.isArray(characters)
    ? characters.find((item) => item.name === '全书角色设定' && (item.background || '').trim())
    : null;

  const roleSummary = bookPlan?.role_summary || roleSummaryRecord?.background || '';
  const outlineMain = bookPlan?.main_outline || outline?.main_outline || '';
  const outlineVolume = bookPlan?.volume_outline || outline?.volume_outline || '';
  const outlineDetailed = bookPlan?.detailed_outline || outline?.detailed_outline || '';
  const outlineParts = [outlineMain, outlineVolume, outlineDetailed]
        .map((item) => String(item || '').trim())
        .filter(Boolean);
  const outlineSummary = outlineParts.join('\n\n');
  const normalizedVolumePlans = Array.isArray(volumePlans)
    ? volumePlans
      .map(normalizeVolumePlan)
      .sort((left, right) => left.volumeNumber - right.volumeNumber)
    : [];
  const visibleCharacters = Array.isArray(characters)
    ? characters
      .filter((item) => item && item.name !== '全书角色设定')
      .map((item) => ({
        id: item.id,
        name: item.name || '未命名角色',
        avatar_image: item.avatar_image || '',
        personality: String(item.personality || '').trim(),
        background: String(item.background || '').trim(),
        appearance: String(item.appearance || '').trim(),
        notes: String(item.notes || '').trim()
      }))
    : [];

  return {
    currentBook: normalizedBook,
    bookPlanning: {
      characterSummaryRaw: roleSummary,
      characterSummary: summarizeText(
        roleSummary,
        '还没有整理全书角色摘要。建议先收主角定位、核心配角、关系变化和冲突支点。'
      ),
      characterCountLabel: roleSummary
        ? `${countCharacterParagraphs(roleSummary)} 条角色摘要已就位`
        : '待补角色摘要',
      outlineMain,
      outlineVolume,
      outlineDetailed,
      outlineSummary: summarizeText(
        outlineSummary,
        '还没有整理全书大纲摘要。建议先写主线目标、阶段任务、卷别推进和关键转折。'
      ),
      outlineCountLabel: outlineParts.length > 0 ? `${outlineParts.length} 段已引用` : '待补全书大纲',
      sourceLabel: bookPlan ? 'book_plans' : 'legacy_outline',
      volumePlans: normalizedVolumePlans,
      characters: visibleCharacters
    }
  };
}

function normalizeVolumePlan(volumePlan) {
  return {
    id: volumePlan.id,
    volumeNumber: Number(volumePlan.volume_number || volumePlan.volumeNumber || 1),
    volume_name: volumePlan.volume_name || '',
    volume_theme: volumePlan.volume_theme || '',
    estimated_chapters: Number(volumePlan.estimated_chapters || volumePlan.estimatedChapters || 0),
    notes: volumePlan.notes || '',
    stage_goal: volumePlan.stage_goal || '',
    core_conflict: volumePlan.core_conflict || '',
    start_role_state: volumePlan.start_role_state || '',
    end_role_state: volumePlan.end_role_state || '',
    storyline_quota: Number(volumePlan.storyline_quota || 0),
    cover_image: volumePlan.cover_image || '',
    source: volumePlan.source || ''
  };
}

function buildChapterGoalPayload(planData = {}) {
  return {
    chapter_mission: planData.chapter_mission || '',
    emotion_target: planData.emotion_target || '',
    appearing_roles: Array.isArray(planData.appearing_roles) ? planData.appearing_roles : [],
    main_storyline_id: planData.main_storyline_id || '',
    target_storylines: Array.isArray(planData.target_storylines) ? planData.target_storylines : [],
    previous_hook: planData.previous_hook || ''
  };
}

function buildChapterOutlinePayload(planData = {}) {
  return {
    summary: planData.summary || '',
    outline_text: normalizeNarrativeOutlineText(planData.outline_text || ''),
    scene_outline: Array.isArray(planData.scene_outline) ? planData.scene_outline : [],
    ending_hook: planData.ending_hook || '',
    character_notes: planData.character_notes || ''
  };
}

function buildChapterStructuredContent(planData = {}, chapterGoal, chapterOutline) {
  const structuredContent = parseJsonObject(planData.structured_content || planData.structuredContent);
  const roleExecution = normalizeRoleExecutionList(planData.role_execution || structuredContent.role_execution);
  const outlineSource = String(planData.source || structuredContent.chapter_outline_source || 'manual').trim() || 'manual';
  return {
    ...structuredContent,
    chapter_outline_mode: structuredContent.chapter_outline_mode || 'single_latest',
    chapter_outline_source: outlineSource,
    chapter_goal_snapshot: {
      chapter_mission: chapterGoal.chapter_mission,
      emotion_target: chapterGoal.emotion_target,
      appearing_roles: chapterGoal.appearing_roles,
      main_storyline_id: chapterGoal.main_storyline_id,
      target_storylines: chapterGoal.target_storylines,
      previous_hook: chapterGoal.previous_hook
    },
    chapter_outline_snapshot: {
      summary: chapterOutline.summary,
      outline_text: chapterOutline.outline_text,
      scene_outline: chapterOutline.scene_outline,
      ending_hook: chapterOutline.ending_hook,
      character_notes: chapterOutline.character_notes,
      source: outlineSource,
      mode: 'single_latest'
    },
    role_execution: roleExecution.length > 0 ? roleExecution : buildRoleExecutionFallback({
      ...planData,
      chapter_mission: chapterGoal.chapter_mission,
      appearing_roles: chapterGoal.appearing_roles,
      character_notes: chapterOutline.character_notes
    })
  };
}

export async function saveCharacterSummary(bookId, summary) {
  const current = await request(`/books/${bookId}/book-plan`).catch(() => null);
  return request(`/books/${bookId}/book-plan`, {
    method: 'POST',
    body: JSON.stringify({
      ...(current || {}),
      role_summary: summary || '',
      source: current?.source || 'manual'
    })
  });
}

export async function saveOutlineSummary(bookId, outlineData) {
  const current = await request(`/books/${bookId}/book-plan`).catch(() => null);
  return request(`/books/${bookId}/book-plan`, {
    method: 'POST',
    body: JSON.stringify({
      ...(current || {}),
      main_outline: outlineData.main_outline || '',
      volume_outline: outlineData.volume_outline || '',
      detailed_outline: outlineData.detailed_outline || '',
      source: current?.source || 'manual'
    })
  });
}

export async function generateVolumePlansFromBookPlan(bookId, options = {}) {
  return request(`/books/${bookId}/volume-plans/generate`, {
    method: 'POST',
    body: JSON.stringify({
      overwrite: options.overwrite !== false,
      target_volume_count: Number(options.targetVolumeCount || 0) || 0
    })
  });
}

export async function fetchStorylines(bookId) {
  const storylines = await request(`/storyline-workbench/${bookId}/storylines`).catch(() => []);
  return Array.isArray(storylines) ? storylines.map(normalizeStoryline) : [];
}

export async function saveStoryline(bookId, storylineData) {
  return request(`/storyline-workbench/${bookId}/storylines`, {
    method: 'POST',
    body: JSON.stringify({
      id: storylineData.id || '',
      volume_number: storylineData.volume_number || 1,
      storyline_name: storylineData.storyline_name || '',
      storyline_type: storylineData.storyline_type || 'branch',
      description: storylineData.description || '',
      core_conflict: storylineData.core_conflict || '',
      involved_characters: storylineData.involved_characters || [],
      start_chapter: storylineData.start_chapter || 1,
      end_chapter: storylineData.end_chapter || 10,
      key_nodes: storylineData.key_nodes || []
    })
  });
}

function buildChapterContext(chapters = []) {
  const normalizedChapters = Array.isArray(chapters) ? chapters : [];
  if (normalizedChapters.length === 0) {
    return {
      suggestedChapterNumber: 1,
      latestChapterLabel: '还没有正式记录，建议从第 1 章开始。',
      existingChapterCount: 0
    };
  }

  const sorted = [...normalizedChapters].sort(
    (a, b) => Number(a.chapter_number || 0) - Number(b.chapter_number || 0)
  );
  const latest = sorted[sorted.length - 1];
  const latestNumber = Number(latest.chapter_number || sorted.length || 1);
  const latestName = String(latest.chapter_name || latest.title || '').trim();

  return {
    suggestedChapterNumber: latestNumber + 1,
    latestChapterLabel: latestName
      ? `当前已有 ${latestNumber} 章内容，上一章是《${latestName}》，下一章建议从第 ${latestNumber + 1} 章开始。`
      : `当前已有 ${latestNumber} 章内容，下一章建议从第 ${latestNumber + 1} 章开始。`,
    existingChapterCount: sorted.length,
    previousFeedbackLabel: '',
    previousFeedbackFocus: ''
  };
}

function hasAnyPlanContent(plan = {}) {
  if (!plan || typeof plan !== 'object') return false;
  const structuredContent = parseJsonObject(plan.structured_content || plan.structuredContent);
  const chapterStructure = parseJsonObject(
    plan.chapter_structure
    || structuredContent.chapter_structure
    || structuredContent.chapterStructure
  );

  const textFields = [
    plan.chapter_name,
    plan.summary,
    plan.chapter_mission,
    plan.emotion_target,
    plan.outline_text,
    plan.character_notes,
    plan.previous_hook,
    plan.ending_hook,
    chapterStructure.chapter_goal,
    chapterStructure.key_scenes,
    chapterStructure.conflict_escalation,
    chapterStructure.character_change,
    chapterStructure.reader_payoff,
    chapterStructure.ending_hook
  ];

  if (textFields.some((value) => String(value || '').trim())) {
    return true;
  }

  const listFields = [
    parseJsonArray(plan.scene_outline),
    parseJsonArray(plan.appearing_roles),
    parseJsonArray(plan.target_storylines),
    normalizeRoleExecutionList(plan.role_execution || structuredContent.role_execution)
  ];

  return listFields.some((items) => Array.isArray(items) && items.length > 0);
}

function buildVolumeRanges(volumeRecords = []) {
  let cursor = 1;
  return (Array.isArray(volumeRecords) ? volumeRecords : [])
    .map(normalizeVolumePlan)
    .filter(Boolean)
    .sort((left, right) => Number(left.volumeNumber || 0) - Number(right.volumeNumber || 0))
    .map((volume) => {
      const estimatedChapters = Math.max(0, Number(volume.estimated_chapters || 0));
      const startChapter = cursor;
      const endChapter = estimatedChapters > 0
        ? cursor + estimatedChapters - 1
        : cursor;
      cursor = endChapter + 1;
      return {
        ...volume,
        startChapter,
        endChapter
      };
    });
}

function findVolumeForChapter(chapterNumber, volumeRanges = []) {
  const normalizedChapterNumber = Number(chapterNumber || 0);
  if (normalizedChapterNumber <= 0) return null;
  return volumeRanges.find((volume) => (
    normalizedChapterNumber >= Number(volume.startChapter || 0) &&
    normalizedChapterNumber <= Number(volume.endChapter || 0)
  )) || null;
}

function buildChapterListItems(chapters = [], chapterPlans = [], currentChapterNumber = 1, volumeRecords = [], fallbackVolumeNumber = 1) {
  const chapterMap = new Map();
  const planMap = new Map();
  const volumeRanges = buildVolumeRanges(volumeRecords);

  (Array.isArray(chapters) ? chapters : []).forEach((chapter) => {
    const chapterNumber = Number(chapter?.chapter_number || 0);
    if (chapterNumber > 0) {
      chapterMap.set(chapterNumber, chapter);
    }
  });

  (Array.isArray(chapterPlans) ? chapterPlans : []).forEach((plan) => {
    const chapterNumber = Number(plan?.chapter_number || 0);
    if (chapterNumber > 0) {
      planMap.set(chapterNumber, normalizeChapterPlanRecord(plan));
    }
  });

  const allNumbers = [...chapterMap.keys(), ...planMap.keys()];
  const maxChapterNumber = allNumbers.length > 0 ? Math.max(...allNumbers) : 0;
  const normalizedCurrentChapterNumber = Number(currentChapterNumber || 1);
  const count = Math.max(1, maxChapterNumber, normalizedCurrentChapterNumber);

  const items = Array.from({ length: count }, (_, index) => {
    const chapterNumber = index + 1;
    const chapter = chapterMap.get(chapterNumber);
    const plan = planMap.get(chapterNumber);
    const hasContent = Boolean(String(chapter?.content || '').trim());
    const planOnly = !hasContent && hasAnyPlanContent(plan);
    const inferredVolume = findVolumeForChapter(chapterNumber, volumeRanges);
    const volumeNumber = Number(
      plan?.volume_number
      || chapter?.volume_number
      || inferredVolume?.volumeNumber
      || fallbackVolumeNumber
      || 1
    );
    const matchedVolume = volumeRanges.find((volume) => Number(volume.volumeNumber || 0) === volumeNumber);
    const chapterName = String(
      chapter?.chapter_name
      || chapter?.title
      || plan?.chapter_name
      || ''
    ).trim();

    return {
      chapterNumber,
      chapterName,
      volumeNumber,
      volumeLabel: matchedVolume?.volume_name
        ? `第 ${volumeNumber} 卷 · ${matchedVolume.volume_name}`
        : `第 ${volumeNumber} 卷`,
      status: hasContent ? 'has-content' : planOnly ? 'plan-only' : 'empty'
    };
  });

  return {
    totalChapterCount: count,
    items
  };
}

export async function fetchChapterSetupBundle(bookId, chapterNumber) {
  const previousChapterNumber = Math.max(1, Number(chapterNumber || 1) - 1);
  const [chapters, rawPlan, rawPreviousPlan, rawChapterPlans, allStorylines, volumePlans, volumeSettings] = await Promise.all([
    request(`/books/${bookId}/chapters`).catch(() => []),
    request(`/books/${bookId}/chapter-plans/${chapterNumber}`).catch(() => null),
    Number(chapterNumber) > 1
      ? request(`/books/${bookId}/chapter-plans/${previousChapterNumber}`).catch(() => null)
      : Promise.resolve(null),
    request(`/books/${bookId}/chapter-plans`).catch(() => []),
    request(`/storyline-workbench/${bookId}/storylines`).catch(() => []),
    request(`/books/${bookId}/volume-plans`).catch(() => []),
    request(`/storyline-workbench/${bookId}/volume-settings`).catch(() => [])
  ]);
  const plan = normalizeChapterPlanRecord(rawPlan);
  const previousPlan = normalizeChapterPlanRecord(rawPreviousPlan);
  const chapterPlans = Array.isArray(rawChapterPlans)
    ? rawChapterPlans.map(normalizeChapterPlanRecord).filter(Boolean)
    : [];

  const chapterContext = buildChapterContext(chapters);
  const currentChapter = Array.isArray(chapters)
    ? chapters.find((item) => Number(item.chapter_number || 0) === Number(chapterNumber))
    : null;
  const parsedPreviousStructuredContent = parseJsonObject(previousPlan?.structured_content);
  const previousChapterFeedback = parsedPreviousStructuredContent?.chapter_feedback || null;
  const previousContinuityCarry = (() => {
    const raw = previousChapterFeedback?.continuity_report?.must_carry_forward;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          return String(item.note || item.summary || item.name || '').trim();
        }
        return '';
      })
      .filter(Boolean);
  })();
  const parsedStructuredContent = parseJsonObject(plan?.structured_content);
  const chapterFeedback = parsedStructuredContent?.chapter_feedback || null;
  const parsedTargetStorylines = parseJsonArray(plan?.target_storylines);
  const normalizedStorylines = Array.isArray(allStorylines)
    ? allStorylines.map(normalizeStoryline)
    : [];
  const matchedStorylines = normalizedStorylines
    ? normalizedStorylines.filter((item) => parsedTargetStorylines.includes(item.id))
    : [];
  const mainStoryline = normalizedStorylines.length > 0 && plan?.main_storyline_id
    ? normalizedStorylines.find((item) => item.id === plan.main_storyline_id)
    : null;
  const volumeNumber = Number(
    plan?.volume_number
    || mainStoryline?.volumeNumber
    || matchedStorylines[0]?.volumeNumber
    || 1
  );
  const normalizedVolumePlans = Array.isArray(volumePlans)
    ? volumePlans.map(normalizeVolumePlan)
    : [];
  const normalizedVolumeSettings = Array.isArray(volumeSettings)
    ? volumeSettings.map(normalizeVolumePlan)
    : [];
  const volumeRecords = normalizedVolumePlans.length > 0
    ? normalizedVolumePlans
    : normalizedVolumeSettings;
  const volumeSetting = Array.isArray(volumeRecords)
    ? volumeRecords.find((item) => Number(item.volumeNumber || 0) === volumeNumber)
    : null;
  const chapterList = buildChapterListItems(chapters, chapterPlans, chapterNumber, volumeRecords, volumeNumber);
  const volumeList = buildVolumeRanges(volumeRecords).map((volume) => ({
    volumeNumber: Number(volume.volumeNumber || 1),
    volumeLabel: volume.volume_name
      ? `第 ${Number(volume.volumeNumber || 1)} 卷 · ${volume.volume_name}`
      : `第 ${Number(volume.volumeNumber || 1)} 卷`,
    estimatedChapters: Number(volume.estimated_chapters || 0),
    startChapter: Number(volume.startChapter || 1),
    endChapter: Number(volume.endChapter || 1)
  }));
  const normalizedPreviousFeedbackLabel = previousChapterFeedback?.chapter_summary
    || previousChapterFeedback?.story_progress
    || '';
  const continuityCarryFocus = previousContinuityCarry.length > 0
    ? previousContinuityCarry.slice(0, 2).join('\n')
    : '';
  const normalizedPreviousFeedbackFocus = continuityCarryFocus
    || previousChapterFeedback?.next_chapter_focus
    || previousChapterFeedback?.open_hooks
    || '';

  chapterContext.previousFeedbackLabel = normalizedPreviousFeedbackLabel;
  chapterContext.previousFeedbackFocus = normalizedPreviousFeedbackFocus;
  chapterContext.totalChapterCount = chapterList.totalChapterCount;
  chapterContext.chapterListItems = chapterList.items;
  chapterContext.volumeList = volumeList;
  chapterContext.generationConstraints = buildVisibleGenerationConstraints({
    plan,
    previousCarry: previousContinuityCarry,
    previousFeedback: previousChapterFeedback,
    mainStoryline,
    matchedStorylines
  });

  const normalizedPlan = plan
      ? {
      chapterNumber: Number(chapterNumber),
      volumeNumber,
      volumeLabel: volumeSetting?.volume_name
      ? `第 ${volumeNumber} 卷 · ${volumeSetting.volume_name}`
      : `第 ${volumeNumber} 卷`,
      summary: plan.summary || '',
        volumeSummary: volumeSetting?.stage_goal
          || volumeSetting?.core_conflict
          || volumeSetting?.volume_theme
          || volumeSetting?.notes
          || '这一章还没有明确卷级推进说明。',
        chapterTitle: plan.chapter_name || '',
        chapterMission: plan.chapter_mission || '',
        emotionTarget: plan.emotion_target || '',
      previousHook: normalizedPreviousFeedbackFocus || plan.previous_hook || '',
      outlineText: normalizeNarrativeOutlineText(plan.outline_text || ''),
      source: plan.source || 'manual',
      characterNotes: plan.character_notes || '',
        endingHook: plan.ending_hook || '',
        mainStorylineId: plan.main_storyline_id || '',
        mainStorylineLabel: mainStoryline
          ? `${mainStoryline.name} · ${formatStorylineTypeLabel(mainStoryline.type)}`
          : '',
        targetStorylines: parsedTargetStorylines,
        targetStorylineLabels: matchedStorylines.map((item) => item.name).filter(Boolean),
        sceneOutline: parseJsonArray(plan.scene_outline),
        appearingRoles: normalizeRoleList(plan.appearing_roles),
        roleExecution: normalizeRoleExecutionList(parsedStructuredContent.role_execution),
        structuredContent: parsedStructuredContent,
        chapterFeedback,
        generatedContent: currentChapter?.content || ''
      }
    : {
        chapterNumber: Number(chapterNumber),
        volumeNumber: 1,
        volumeLabel: '第 1 卷',
        summary: '',
        volumeSummary: '这一章还没有明确卷级推进说明。',
        chapterTitle: '',
        chapterMission: '',
        emotionTarget: '',
        previousHook: normalizedPreviousFeedbackFocus || '',
        outlineText: '',
        characterNotes: '',
        endingHook: '',
        mainStorylineId: '',
        mainStorylineLabel: '',
        targetStorylines: [],
        targetStorylineLabels: [],
        sceneOutline: [],
        appearingRoles: [],
        roleExecution: [],
        structuredContent: {},
        chapterFeedback: null,
        generatedContent: currentChapter?.content || ''
      };

  return {
    chapterContext,
    chapterPlan: normalizedPlan,
    storylineOptions: normalizedStorylines
  };
}

export async function saveChapterPlan(bookId, chapterNumber, planData) {
  const chapterGoal = buildChapterGoalPayload(planData);
  const chapterOutline = buildChapterOutlinePayload(planData);
  const structuredContent = buildChapterStructuredContent(planData, chapterGoal, chapterOutline);
  const summarySource = String(chapterOutline.summary || '').trim() || String(chapterOutline.outline_text || '').trim();
  const summary = summarySource
    ? summarySource.replace(/\s+/g, ' ').slice(0, 120)
    : String(chapterGoal.chapter_mission || chapterOutline.ending_hook || '').trim();

  return request(`/books/${bookId}/chapter-plans/${chapterNumber}`, {
    method: 'POST',
    body: JSON.stringify({
      volume_number: planData.volume_number || 1,
      chapter_name: planData.chapter_name || '',
      summary,
      chapter_mission: chapterGoal.chapter_mission,
      emotion_target: chapterGoal.emotion_target,
      outline_text: chapterOutline.outline_text,
      character_notes: chapterOutline.character_notes,
      previous_hook: chapterGoal.previous_hook,
      ending_hook: chapterOutline.ending_hook,
      scene_outline: chapterOutline.scene_outline,
      appearing_roles: chapterGoal.appearing_roles,
      main_storyline_id: chapterGoal.main_storyline_id,
      target_storylines: chapterGoal.target_storylines,
      structured_content: structuredContent,
      status: chapterOutline.outline_text ? 'draft' : 'generated',
      source: planData.source || 'manual'
    })
  });
}

export async function generateChapterOutline(payload) {
  return request('/generate', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      promptType: 'outline'
    })
  });
}

export async function generateChapterContent(payload) {
  return request('/generate', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

function splitSseEventBlocks(buffer) {
  const normalized = String(buffer || '');
  const blocks = normalized.split(/\r?\n\r?\n/);
  return {
    blocks: blocks.slice(0, -1),
    rest: blocks.at(-1) || ''
  };
}

function parseSseEventBlock(block) {
  const lines = String(block || '').split(/\r?\n/);
  let eventName = '';
  const dataLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('event:')) {
      eventName = trimmed.slice(6).trim();
      continue;
    }
    if (trimmed.startsWith('data:')) {
      dataLines.push(trimmed.slice(5).trimStart());
    }
  }

  if (!dataLines.length) return null;
  return {
    eventName,
    data: dataLines.join('\n')
  };
}

export async function streamChapterContent(payload, {
  signal,
  onDelta,
  onUsage,
  onAudit,
  onDone,
  onError
} = {}) {
  const response = await fetch(`${API_BASE}/generate/stream`, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error('流式响应不可用，当前浏览器没有返回可读取的数据流。');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let latestUsage = null;
  let latestAudit = null;
  let donePayload = null;
  let errorHandled = false;

  const processBlock = (block) => {
    const parsedBlock = parseSseEventBlock(block);
    if (!parsedBlock?.data) return false;

    let eventPayload;
    try {
      eventPayload = JSON.parse(parsedBlock.data);
    } catch (_) {
      return false;
    }

    const eventType = eventPayload.type || parsedBlock.eventName || 'message';

    if (eventType === 'delta') {
      const delta = String(eventPayload.content || '');
      fullContent += delta;
      onDelta?.({
        delta,
        content: fullContent,
        contentLength: Number(eventPayload.content_length || fullContent.length)
      });
      return false;
    }

    if (eventType === 'usage') {
      latestUsage = eventPayload.usage || latestUsage;
      onUsage?.({
        ...eventPayload,
        content: fullContent
      });
      return false;
    }

    if (eventType === 'audit') {
      latestAudit = eventPayload;
      onAudit?.({
        ...eventPayload,
        content: fullContent
      });
      return false;
    }

    if (eventType === 'done') {
      const finalContent = typeof eventPayload.content === 'string' ? eventPayload.content : fullContent;
      donePayload = {
        ...eventPayload,
        content: finalContent,
        usage: eventPayload.usage || latestUsage,
        audit: latestAudit
      };
      onDone?.(donePayload);
      return true;
    }

    if (eventType === 'error') {
      const streamError = new Error(eventPayload.message || '流式生成失败');
      errorHandled = true;
      onError?.(streamError.message);
      throw streamError;
    }

    return false;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { blocks, rest } = splitSseEventBlocks(buffer);
      buffer = rest;

      for (const block of blocks) {
        if (processBlock(block)) {
          return donePayload;
        }
      }
    }

    buffer += decoder.decode();
    const { blocks } = splitSseEventBlocks(`${buffer}\n\n`);
    for (const block of blocks) {
      if (processBlock(block)) {
        return donePayload;
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    if (!errorHandled) {
      onError?.(error.message || '流式生成失败');
    }
    throw error;
  } finally {
    try {
      reader.releaseLock();
    } catch (_) {}
  }

  if (donePayload) {
    return donePayload;
  }

  throw new Error('流式响应提前结束，未收到完成事件。');
}

export async function generateChapterFeedback(payload) {
  return request('/generate', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      promptType: 'chapter_feedback'
    })
  });
}

export async function polishChapterContent(content, requirements = '', options = {}) {
  return request('/polish', {
    method: 'POST',
    body: JSON.stringify({
      content,
      requirements,
      ...options
    })
  });
}

export async function upsertGeneratedChapter(bookId, chapterData) {
  return request(`/books/${bookId}/chapters/upsert`, {
    method: 'POST',
    body: JSON.stringify({
      title: chapterData.title,
      chapterName: chapterData.chapterName || '',
      chapterNumber: chapterData.chapterNumber,
      content: chapterData.content || ''
    })
  });
}

const DEMO_WORKSPACE_TITLE = '血月残卷';

async function seedDemoWorkspace(book) {
  const bookId = book?.id || '';
  const bookTitle = typeof book?.title === 'string' ? book.title.trim() : '';
  if (!bookId || bookTitle !== DEMO_WORKSPACE_TITLE) {
    throw new Error('演示数据只能写入演示书，不能灌入当前正式作品。');
  }

  await saveCharacterSummary(
    bookId,
    [
      '主角沈破雾：外冷内热，警惕心强，目标明确，遇事先退一步，但一旦认定方向就会咬住不放。',
      '陆听澜：理性克制，嘴上不饶人，负责把主角带进更大的真相与冲突里。',
      '白照夜、雾门守卒等角色分别承担答案提供者、压迫感制造者与秩序阻拦者的作用。'
    ].join('\n')
  );

  await saveOutlineSummary(bookId, {
    main_outline: '《破雾修真录》讲一个少年在浓雾与旧约中寻找真相的故事，前期以逃离和觉醒为主，中期进入宗门与旧势力冲突，后期逐步揭开“破雾”背后的命运代价。',
    volume_outline: '第一卷写主角从边境小镇逃入雾海，第二卷写宗门试炼与旧案牵连，第三卷写血脉真相与命运反转。',
    detailed_outline: '每一卷都要保证：主角目标明确、压力持续升级、关系链不断收紧。章节推进尽量让每次突破都伴随代价，避免单纯打怪升级。'
  });

  const existingStorylines = await fetchStorylines(bookId);
  let bloodMoonLine = existingStorylines.find((item) => item.name === '血月旧案主线')
    || existingStorylines.find((item) => item.name === '血月追索线');
  let pursuitLine = existingStorylines.find((item) => item.name === '雾海逃亡线');

  if (!bloodMoonLine) {
    const created = await saveStoryline(bookId, {
      volume_number: 1,
      storyline_name: '血月旧案主线',
      storyline_type: 'main',
      description: '围绕血月旧案、破雾之力来源和沈破雾身世逐步推进。',
      core_conflict: '主角越追查旧案，越会暴露自身与雾门旧约的关系。',
      start_chapter: 1,
      end_chapter: 12
    });
    bloodMoonLine = { id: created.id, name: '血月旧案主线' };
  }

  if (!pursuitLine) {
    const created = await saveStoryline(bookId, {
      volume_number: 1,
      storyline_name: '雾海逃亡线',
      storyline_type: 'branch',
      description: '主角在逃亡中被迫卷入宗门与雾海旧案，目标从“活下去”变成“查清真相”。',
      core_conflict: '逃避与追查并存，路线越走越窄。',
      start_chapter: 1,
      end_chapter: 10
    });
    pursuitLine = { id: created.id, name: '雾海逃亡线' };
  }

  await saveChapterPlan(bookId, 1, {
    chapter_name: '雾起离镇',
    chapter_mission: '让主角离开危险源头，并第一次意识到自己身上的异常不是偶然。',
    emotion_target: '紧张、压迫、带一点逃出生天的侥幸。',
    previous_hook: '边境小镇的异常彻底失控，主角被迫踏上逃亡路。',
    outline_text: '本章重点是离开、追逐与觉醒。开场制造危机，中段让主角第一次使用异常能力，结尾把他推向更大的雾海。',
    character_notes: '沈破雾为本章核心，陆听澜在后段登场并提供关键引导。',
    ending_hook: '雾门方向出现了不该存在的回响，真正的追索才刚开始。',
    main_storyline_id: bloodMoonLine.id || '',
    target_storylines: [bloodMoonLine.id, pursuitLine.id].filter(Boolean)
  });

  await saveChapterPlan(bookId, 2, {
    chapter_name: '入雾见门',
    summary: '沈破雾跟着雾门回响闯入更明确的规则场，正式接触宗门、旧案和与自己身世相关的线索。',
    chapter_mission: '让主角第一次进入更明确的规则场，并接触宗门和旧案线索。',
    emotion_target: '未知感增强，紧张中带一点探索欲。',
    previous_hook: '雾门回响引导主角继续向前，退路开始变窄。',
    outline_text: '本章重点是规则建立与线索投放。主角进入新环境，认识新人物，发现自己已经被卷进一场更大的旧案。',
    character_notes: '陆听澜、白照夜与雾门守卒的轮流登场，分别承担解释、试探与阻拦。',
    ending_hook: '宗门旧案中出现了与主角家族有关的名字。',
    scene_outline: [
      '雾海旧界碑显现，主角第一次看见真正的“门”。',
      '陆听澜递出旧案纸页，把主角拖进更大范围的谜局。',
      '主角在雾海路径错乱中确认自己不是普通旁观者。',
      '宗门巡守灯火出现，但安全感并没有随之到来。'
    ],
    appearing_roles: ['沈破雾', '陆听澜', '白照夜', '雾门守卒'],
    main_storyline_id: bloodMoonLine.id || '',
    target_storylines: [bloodMoonLine.id, pursuitLine.id].filter(Boolean),
    structured_content: { generation_settings: { word_count: 3000 } }
  });

  await saveChapterPlan(bookId, 3, {
    chapter_name: '灯下旧名',
    summary: '白照夜把主角带进宗门外站，以旧案卷宗和雾门守卒的追查把“家族旧约”这一层真正掀开。',
    chapter_mission: '让主角确认父辈旧案与自己血脉有关，并意识到宗门既是保护者也是新的束缚来源。',
    emotion_target: '压迫中带一点求知欲，最后收在被迫接受现实的冷硬感。',
    previous_hook: '宗门旧案里出现了与沈家相关的名字，主角不得不继续追下去。',
    outline_text: '本章重点是抛出旧案真相的第一层。前半段借卷宗和问询建立信息密度，中段让守卒压迫逼近，后半段让主角知道自己已经没有退路。',
    character_notes: '白照夜负责解释和施压，陆听澜负责在冷硬规则里给主角留一丝空间，沈破雾的态度要从抗拒转为强撑着接受。',
    ending_hook: '卷宗最后一页提到“血月夜归门者”，而下一次血月将在三日后升起。',
    scene_outline: [
      '外站灯火下翻出沈家旧卷，旧案名称第一次被完整念出。',
      '白照夜用宗门规矩问话，主角意识到自己被当成关键变量。',
      '雾门守卒顺着踪迹逼近外站，宗门保护与控制同时显形。',
      '主角看见卷宗末页的血月记录，真正意识到时间不站在自己这边。'
    ],
    appearing_roles: ['沈破雾', '陆听澜', '白照夜', '雾门守卒'],
    main_storyline_id: bloodMoonLine.id || '',
    target_storylines: [bloodMoonLine.id, pursuitLine.id].filter(Boolean),
    structured_content: { generation_settings: { word_count: 3000 } }
  });

  await saveChapterPlan(bookId, 4, {
    chapter_name: '血月试锋',
    summary: '血月升起前的试探战提前爆发，沈破雾第一次在宗门视线下正面用出破雾之力，也第一次付出明显代价。',
    chapter_mission: '让主角完成一次可被旁人见证的能力爆发，同时明确“破雾”不是白拿的，它会反噬。',
    emotion_target: '高压、爆发、短暂反杀后的虚脱与更深危机。',
    previous_hook: '三日后的血月正在逼近，所有人都知道下一次开门不会只是试探。',
    outline_text: '本章重点是用一场短促但有代价的战斗，把主角能力、宗门态度和雾门追索同时往前推一格。前段蓄压，中段爆发，尾段必须留下更大门槛。',
    character_notes: '沈破雾承担爆发与代价，陆听澜负责协同与见证，白照夜要表现出既欣赏又警惕的态度，敌方守卒要逼出真正压力。',
    ending_hook: '主角虽然挡下第一轮试探，却在昏沉中听见血月门后的呼唤，像是有人在叫他的名字。',
    scene_outline: [
      '血月将升未升，外站周围先出现小规模试探性异动。',
      '守卒逼近，宗门修士选择观望一线，主角被迫顶上去。',
      '破雾之力第一次被旁人完整看见，短暂压制敌方。',
      '战后反噬发作，主角在意识恍惚中听见门后呼唤。'
    ],
    appearing_roles: ['沈破雾', '陆听澜', '白照夜', '雾门守卒'],
    main_storyline_id: bloodMoonLine.id || '',
    target_storylines: [bloodMoonLine.id, pursuitLine.id].filter(Boolean),
    structured_content: { generation_settings: { word_count: 3000 } }
  });

  await saveChapterPlan(bookId, 5, {
    chapter_name: '门后回声',
    summary: '沈破雾在血月试锋后的反噬中，第一次认真面对“门后呼唤”不是幻听，而是一条直指沈家旧案的线索；宗门的保护与监视也在这一章正式变成双重压力。',
    chapter_mission: '让主角在反噬后仍主动追查门后呼唤的来源，并第一次意识到自己在旧案里可能既是钥匙，也是祭品。',
    emotion_target: '虚弱、疑惧、被逼着冷静下来，最后收在咬牙主动往更深处走的决心。',
    previous_hook: '主角虽然挡下第一轮试探，却在昏沉中听见血月门后的呼唤，像是有人在叫他的名字。',
    outline_text: '本章重点是承接血月试锋后的代价，把“门后呼唤”从异象推进成可追查的线索。前段先处理反噬与宗门态度，中段借旧卷和禁区线索抬高信息密度，后段让主角主动做出继续追查的决定。',
    character_notes: '沈破雾要从硬撑求生转向带伤主动追查；陆听澜负责把情感支点留住；白照夜既提供线索也代表宗门控制力。',
    ending_hook: '残缺卷宗指向一页被提前抽走的旧约记录，而那一页很可能就在宗门不允许外人触碰的禁区里。',
    scene_outline: [
      '沈破雾在反噬余波中醒来，确认那道呼唤与沈家旧案不是巧合。',
      '陆听澜与白照夜分别给出保护和试探，宗门态度从旁观变成半收编。',
      '主角从残缺卷宗或外站旧档里找到与“门后回声”对应的缺页线索。',
      '主角决定在下一次血月前主动追查缺页去向，不再只被动等追兵上门。'
    ],
    appearing_roles: ['沈破雾', '陆听澜', '白照夜'],
    main_storyline_id: bloodMoonLine.id || '',
    target_storylines: [bloodMoonLine.id].filter(Boolean),
    structured_content: {
      generation_settings: { word_count: 3000 },
      chapter_outline_structure: {
        chapter_goal: '让主角在反噬后仍主动追查门后呼唤的来源，并第一次意识到自己在旧案里可能既是钥匙，也是祭品。',
        key_scenes: '1. 反噬醒来，确认呼唤并非幻听\n2. 宗门保护与试探同时压上来\n3. 旧卷缺页线索浮出\n4. 主角决定主动追查禁区与缺页',
        conflict_escalation: '主角越想弄清门后呼唤，就越要接受宗门的监视与旧案的真正危险。',
        character_change: '沈破雾从被动承受代价，转为带伤也要主动查下去。',
        reader_payoff: '读者会明确看到门后呼唤和沈家旧案接上，不再只是抽象悬念。',
        ending_hook: '残缺卷宗指向被抽走的旧约记录，而真正答案藏在宗门禁区。'
      }
    }
  });

  await saveChapterPlan(bookId, 6, {
    chapter_name: '禁区残页',
    summary: '沈破雾顺着缺页线索第一次把脚真正踏进宗门禁区，查到旧约残页与自身血脉之间更直接的关联，也把自己暴露在更高层的注视里。',
    chapter_mission: '让主角第一次主动越线调查，并把“缺页线索”推进成可验证的旧约证据。',
    emotion_target: '潜入时的绷紧、逼近真相时的战栗，以及被更高层目光盯上的寒意。',
    previous_hook: '残缺卷宗指向一页被提前抽走的旧约记录，而那一页很可能就在宗门不允许外人触碰的禁区里。',
    outline_text: '本章重点是潜入、取证和代价升级。前段处理潜入禁区的紧张感，中段用残页内容抬高信息密度，尾段让主角知道自己已经被宗门更深层注意到。',
    character_notes: '沈破雾负责主动越线与承担风险；陆听澜负责协助遮掩并制造信任支点；白照夜不必正面阻拦，但要让读者感觉他可能早就知道。',
    ending_hook: '残页里提到的“归门血钥”并不只有开启作用，它更像是一份会反过来吞主的旧约印记。',
    scene_outline: [
      '沈破雾带着伤势与陆听澜夜探宗门禁区，第一次主动违背别人给他划好的安全边界。',
      '两人在封存旧档里找到被抽走的残页，确认沈家旧案与归门血钥直接相关。',
      '残页内容触发主角腕上雾纹异动，证明他和旧约不是旁观关系。',
      '离开禁区后，主角察觉自己虽然暂时拿到线索，却也已经被宗门更高层记住。'
    ],
    appearing_roles: ['沈破雾', '陆听澜', '白照夜'],
    main_storyline_id: bloodMoonLine.id || '',
    target_storylines: [bloodMoonLine.id].filter(Boolean),
    structured_content: {
      generation_settings: { word_count: 3000 },
      chapter_outline_structure: {
        chapter_goal: '让主角第一次主动越线调查，并把缺页线索推进成可验证的旧约证据。',
        key_scenes: '1. 夜探禁区\n2. 找到残页\n3. 雾纹异动验证旧约关联\n4. 带着更高层注视离开',
        conflict_escalation: '主角离真相更近一步，也离被宗门彻底控制更近一步。',
        character_change: '沈破雾从决定去查，推进到真正敢为真相越过规矩。',
        reader_payoff: '读者会看到主线从抽象追查进入可触摸的证据阶段。',
        ending_hook: '归门血钥不只是钥匙，更像会反噬宿主的旧约印记。'
      }
    }
  });

  await upsertGeneratedChapter(bookId, {
    title: '第 1 章 雾起离镇',
    chapterName: '雾起离镇',
    chapterNumber: 1,
    content: [
      '边境小镇的雾一夜之间变得异常浓，像是有人在天与地之间拉下了一层看不见的幕布。沈破雾站在巷口，手腕上的雾纹隐隐发烫，他知道这不是普通的天气。',
      '当追赶者的脚步声从街尾压过来时，他第一次清楚地感觉到自己体内有什么东西被唤醒了。那股力量并不温顺，像碎裂的冰，又像从深处翻涌出的潮声。',
      '他没法再继续留在这里。要么被抓住，要么往更深的雾里走。就在他准备冲出去的时候，一个背着窄剑的少女挡在了前面，冷冷地说了一句：现在才想走，已经晚了。',
      '那一刻，沈破雾明白，自己离开的不是一座小镇，而是过去那层假装安全的壳。真正的故事，才刚刚开始。',
      '而在更远处，雾门的方向传来了一声低沉的回响。'
    ].join('\n\n')
  });

  await upsertGeneratedChapter(bookId, {
    title: '第 2 章 入雾见门',
    chapterName: '入雾见门',
    chapterNumber: 2,
    content: [
      '进入雾海之后，沈破雾第一次看见真正意义上的“门”。那不是一扇门，而是一道立在废墟里的旧界碑，上面刻着早已被磨损的纹路。',
      '陆听澜在那里等他，像是早就知道他会来。她没有多说，只递给他一张被折过很多次的旧纸，说里面记着最近几起失踪案的共同点。',
      '雾海里并没有表面上那么安静。每走一步，脚下的路都会像在改写，过去看似无关的线索也开始彼此咬合，逼着沈破雾承认自己不是局外人。',
      '当他终于看见宗门巡守的灯火时，心里却没有松口气，反而更清楚地意识到：这只是更深一层棋局的开端。'
    ].join('\n\n')
  });

  await upsertGeneratedChapter(bookId, {
    title: '第 3 章 灯下旧名',
    chapterName: '灯下旧名',
    chapterNumber: 3,
    content: [
      '宗门外站建在雾海边缘，灯火被风吹得细长，像一排不肯熄灭的针。沈破雾踏进去的时候，第一眼看见的不是人，而是一张摊在长案上的旧卷宗。',
      '白照夜用指节点了点纸页边缘，没有催他坐下，只淡淡地问了一句：“沈家这个名字，你听过几回？”那语气不重，却比刀背压在喉咙上更让人难受。',
      '卷宗里记着二十年前那场“归门失序”，其中有一栏被人用朱砂重重圈住，写的正是沈家长辈的名字。沈破雾盯着那几个字，忽然明白自己这些年躲着雾、躲着旧事，根本不是在避祸，而是在往早就写好的局里退。',
      '外站外头忽然响起低沉的铃音，雾门守卒顺着痕迹逼到门前。陆听澜拔剑横在门口，白照夜却只是把卷宗翻到最后一页，让沈破雾看清那行血月记录。',
      '“三日后，血月再起。”白照夜说，“到那时，你可以继续躲，也可以亲自去把这页后面的名字翻出来。”'
    ].join('\n\n')
  });

  await upsertGeneratedChapter(bookId, {
    title: '第 4 章 血月试锋',
    chapterName: '血月试锋',
    chapterNumber: 4,
    content: [
      '血月升起前的夜色比前几日更沉，外站四周的雾像被谁反复揉过，层层叠叠压在檐下。沈破雾站在石阶上，掌心已经渗出冷汗，却比第一次离镇时平静得多。',
      '守卒没有等到血月彻底爬上天幕就先逼了过来，像是在试探，也像是在提前验货。宗门修士没有立刻全压上去，所有人的目光都若有若无地落在沈破雾身上，等着看这个沈家后人到底值不值得保。',
      '陆听澜替他拦下第一记杀招，低声只说了两个字：“上前。”那一瞬间，沈破雾忽然觉得自己再退一步，往后所有路都会塌掉。',
      '破雾之力炸开的刹那，四周雾层像被硬生生撕开一线。守卒的灰面具裂出细纹，白照夜也终于第一次收起了那副温和旁观的样子。可下一刻，沈破雾胸口像被反着攥住，喉间直接涌上血腥味。',
      '他勉强站住没有倒下，却在意识最乱的时候听见雾门深处传来一句极轻的呼唤，像有人隔着多年旧约，在门后叫了他一声。'
    ].join('\n\n')
  });

  await upsertGeneratedChapter(bookId, {
    title: '第 5 章 门后回声',
    chapterName: '门后回声',
    chapterNumber: 5,
    content: [
      '沈破雾醒来的时候，窗纸外的天色还没有亮透，胸口却像压着一整块没有化开的寒铁。血月试锋留下的反噬并没有退干净，指尖一动，腕上的雾纹就跟着发烫，像是在提醒他昨夜那声从门后传来的呼唤并不是幻觉。',
      '陆听澜端着药盏进门，见他坐起，只淡淡说了一句“命还在”，却把药碗先放到了他手边。白照夜随后带来一卷宗门旧档，语气仍旧温和，话里的意思却比昨夜更直白：从这一刻起，宗门既会护着他，也会盯着他，因为血月门后的那道回声，多半只会冲着沈家的人来。',
      '沈破雾本想继续装作不在意，可旧档里那页残卷一展开，他的目光就再也挪不开。纸页边角被人提前撕走，只剩下半句“夜归门者，以血为钥”的旧约残字，旁边还压着一行批注，提到外站禁区曾封存过与“门后回声”对应的缺页。那一瞬间，他第一次真正意识到，自己在这桩旧案里也许不只是被追的人，还是会被拿去开门的人。',
      '屋里安静了片刻。陆听澜没有劝他退，白照夜也没有替他做决定，像是都在等他自己把这口气咽下去。沈破雾慢慢把残卷合上，胸口仍旧发疼，脑子却比血月试锋前更清楚：如果继续只等着别人来追，他迟早会连自己为什么被卷进来都弄不明白。',
      '“那一页缺卷，我自己去找。”他说这句话时声音并不高，却没有半分迟疑。白照夜看了他一眼，只提醒禁区不是外人能随便碰的地方；陆听澜则把佩剑按回鞘中，像是默认这一次不会让他一个人走。窗外晨雾正缓慢漫进外站长廊，沈破雾抬头看向雾更深的地方，忽然觉得那扇门后的回声已经不再只是威胁，而是一条逼着他主动往前走的线。'
    ].join('\n\n')
  });

  await upsertGeneratedChapter(bookId, {
    title: '第 6 章 禁区残页',
    chapterName: '禁区残页',
    chapterNumber: 6,
    content: [
      '夜色压下来后，宗门外站比白日安静得过分。沈破雾换了身不显眼的深衣，胸口的闷痛还没有彻底散去，可一想到那页被抽走的旧约残卷，他反而比前几日更稳。既然已经知道答案就在禁区里，继续躲着只会让别人先一步把门关死。',
      '陆听澜没有和他争论要不要去，只在翻过回廊时替他挡开了一队夜巡。她压低声音提醒，禁区里封的从来不只是旧纸旧案，还有宗门最不愿被外人知道的失控记录。沈破雾点了点头，腕上的雾纹却在靠近石库时自行发热，像是那里面真的有什么东西在隔着墙认他。',
      '两人潜进封档石室，最里面一格木匣果然少了一页整齐裁断的卷纸。沈破雾把夹在匣底的残页抽出来，只看了第一眼，呼吸就顿了一瞬。残页上写着“归门血钥”四字，后面紧跟着的批注说得更狠: 此印若寄于活人，既可引门，亦可反噬其主。',
      '字迹映进眼里的同时，他左腕的雾纹忽然像被火擦过，疼得他几乎握不住纸。陆听澜一把按住他，才没让木匣摔在地上。那一刻沈破雾反而彻底明白了，自己和这桩旧案根本不是被动牵连，而是从一开始就被写在钥匙的位置上。',
      '他们离开禁区时没有惊动明面上的守卫，可回到长廊尽头，白照夜已经站在风灯下，像是早就算准了他们会从哪条路回来。他没有追问残页内容，只看了沈破雾一眼，淡淡说了一句“看来门已经认人了”。夜风从廊外卷进来，沈破雾把残页按进袖中，忽然意识到自己虽然抢到了线索，却也从今晚开始，真正被宗门更高处的人记住了。'
    ].join('\n\n')
  });
}

export async function createDemoWorkspace() {
  const existingBooks = await fetchBookList().catch(() => []);
  const existingDemoBook = existingBooks.find((book) => book.title === DEMO_WORKSPACE_TITLE);

  if (existingDemoBook) {
    await seedDemoWorkspace(existingDemoBook);
    return {
      ...existingDemoBook,
      reused: true
    };
  }

  const demoBook = await createBook({
    title: DEMO_WORKSPACE_TITLE,
    genre: 'fantasy',
    description: 'React 工作台演示用样例书籍',
    author: '演示数据'
  });

  await seedDemoWorkspace(demoBook);

  return demoBook;
}
