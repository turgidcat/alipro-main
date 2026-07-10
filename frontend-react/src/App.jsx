import { useEffect, useRef, useState } from 'react';
import {
  createBook,
  deleteChapterContentByNumber,
  fetchChapterSetupBundle,
  fetchPromptPreview,
  generateChapterContent,
  generateChapterFeedback,
  generateChapterName,
  generateChapterOutline,
  persistCurrentBookId,
  polishChapterContent,
  saveChapterPlan,
  saveStoryline,
  streamChapterContent,
  upsertGeneratedChapter
} from './workbenchApi.js';
import './app-shell.css';
import {
  emptyChapterPlan,
  emptyChapterStructure,
  emptyStorylineDraft
} from './lib/constants.js';
import {
  normalizeLines,
  normalizeRoleList,
  describeRoleExecutionMeta,
  buildGenerationRiskReview,
  getPlanWordCount,
  hasMountedStorylineAnchor,
  hasUsableChapterOutline,
  prepareOutlineModalPlan,
  hasText
} from './lib/chapterPlan.js';
import {
  buildRevisionDraftFromSuggestions,
  buildRevisionParagraphDiffRows,
  normalizeParagraphs,
  summarizeRevisionSuggestions,
  splitRevisionParagraphs
} from './lib/revisionDiff.js';
import { normalizeChapterBundle } from './lib/chapterBundle.js';
import { persistChapterResultCycle } from './lib/chapterResult.js';
import { buildGenerationStateFromCycle } from './lib/generationActions.js';
import { genreOptions, getSubgenreOptions } from './lib/bookGenres.js';
import { formatChapterLabel, normalizeChapterName } from './lib/chapterName.js';
import Modal from './components/workbench/Modal.jsx';
import './workbench-layout.css';
import GlobalBar from './components/workbench/GlobalBar.jsx';
import PromptManagerPage from './components/workbench/PromptManagerPage.jsx';
import ChapterConfigPanel from './components/workbench/ChapterConfigPanel.jsx';
import ContentWorkspace from './components/workbench/ContentWorkspace.jsx';
import RevisionEditor from './components/workbench/RevisionEditor.jsx';
import StatusNotice from './components/workbench/StatusNotice.jsx';
import ContextDrawer from './components/workbench/ContextDrawer.jsx';
import MetaCode from './components/workbench/MetaCode.jsx';
import IndentedTextBlock from './components/IndentedTextBlock.jsx';
import ProjectEntry from './components/app/ProjectEntry.jsx';
import BookSettingDrawer from './components/workbench/drawers/BookSettingDrawer.jsx';
import StorylineDrawer from './components/workbench/drawers/StorylineDrawer.jsx';
import CharacterDrawer from './components/workbench/drawers/CharacterDrawer.jsx';
import VolumeDrawer from './components/workbench/drawers/VolumeDrawer.jsx';
import { useWorkbench } from './hooks/useWorkbench.js';
import { compareRoleTier, getRoleTierShortLabel, getRoleTierTone } from './lib/roleTiers.js';
import {
  countPlatformEffectiveWords,
  formatExactWordCount,
  formatWordCountProgress
} from './lib/textMetrics.js';

const DRAWER_MEMORY_PREFIX = 'alipro-workbench-drawer';
const RECENT_WORKSPACE_PAGE_KEY = 'alipro-recent-workspace-page';
const CREATE_BOOK_SELECT_VALUE = '__create_book__';
const APP_BASE_PATH = String(import.meta.env.BASE_URL || '/');

function buildAppPath(pathname = '/') {
  const cleanPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  const cleanBase = APP_BASE_PATH.endsWith('/') ? APP_BASE_PATH : `${APP_BASE_PATH}/`;
  return cleanPath ? `${cleanBase}${cleanPath}` : cleanBase;
}

function getCurrentAppPathname() {
  if (typeof window === 'undefined') return '/';
  const rawPath = window.location.pathname || '/';
  const cleanBase = APP_BASE_PATH.replace(/\/+$/, '');
  if (cleanBase && cleanBase !== '/' && rawPath.startsWith(cleanBase)) {
    return rawPath.slice(cleanBase.length) || '/';
  }
  return rawPath;
}

const bookStatusLabels = {
  writing: '连载中',
  completed: '已完结',
  paused: '暂停中',
  draft: '草稿'
};

function getStoredWorkspacePage() {
  const currentPath = getCurrentAppPathname();
  if (currentPath === '/prompts') return 'prompts';
  try {
    const stored = window.localStorage.getItem(RECENT_WORKSPACE_PAGE_KEY);
    return stored === 'workbench' || stored === 'prompts' ? stored : 'library';
  } catch (_) {
    return 'library';
  }
}

function persistWorkspacePage(page) {
  try {
    const nextPage = page === 'prompts' ? 'prompts' : page === 'workbench' ? 'workbench' : 'library';
    window.localStorage.setItem(RECENT_WORKSPACE_PAGE_KEY, nextPage);
  } catch (_) {}
}

function syncAppPath(page, replace = false, bookId = '') {
  if (typeof window === 'undefined') return;
  const safeBookId = bookId ? encodeURIComponent(bookId) : '';
  const pathname =
    page === 'prompts'
      ? '/prompts'
      : page === 'workbench'
      ? '/workbench'
      : page === 'library'
        ? safeBookId ? `/books/${safeBookId}` : '/books'
        : '/';
  if (pathname.startsWith('/books')) {
    window.location.href = buildAppPath(pathname);
    return;
  }
  const nextPath = buildAppPath(pathname);
  if (window.location.pathname === nextPath) return;
  const nextUrl = `${nextPath}${window.location.search || ''}${window.location.hash || ''}`;
  const method = replace ? 'replaceState' : 'pushState';
  window.history[method](null, '', nextUrl);
}

function persistBookContext(bookId) {
  persistCurrentBookId(bookId);
  try {
    if (bookId) {
      window.localStorage.setItem('currentBookId', bookId);
      window.localStorage.setItem('current_book_id', bookId);
    } else {
      window.localStorage.removeItem('currentBookId');
      window.localStorage.removeItem('current_book_id');
    }
  } catch (_) {}
}

function getBookStatusLabel(status) {
  return bookStatusLabels[status] || status || '未设置状态';
}

function extractRepeatedChapterPhrases(titles = []) {
  const phraseCounts = new Map();
  const normalizedTitles = Array.isArray(titles)
    ? titles.map((title) => String(title || '').replace(/\s+/g, '').trim()).filter(Boolean)
    : [];

  normalizedTitles.forEach((title) => {
    const seen = new Set();
    for (let length = 2; length <= 4; length += 1) {
      for (let index = 0; index <= title.length - length; index += 1) {
        const phrase = title.slice(index, index + length);
        if (!/^[\u4e00-\u9fa5A-Za-z]{2,4}$/.test(phrase)) continue;
        if (seen.has(phrase)) continue;
        seen.add(phrase);
        phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
      }
    }
  });

  return Array.from(phraseCounts.entries())
    .filter(([, count]) => count >= 3)
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return right[0].length - left[0].length;
    })
    .map(([phrase]) => phrase)
    .filter((phrase, index, list) => !list.some((other, otherIndex) => otherIndex < index && other.includes(phrase)))
    .slice(0, 8);
}

function serializeChapterPlanDraft(plan) {
  return JSON.stringify(plan || emptyChapterPlan);
}

function parseChapterPlanSnapshot(snapshot) {
  try {
    return JSON.parse(snapshot || '{}') || {};
  } catch (_) {
    return {};
  }
}

function pickChapterPlanFields(plan = {}, fields = []) {
  return fields.reduce((result, field) => {
    result[field] = plan?.[field];
    return result;
  }, {});
}

function isChapterPlanGroupChanged(currentPlan = {}, savedPlan = {}, fields = []) {
  return JSON.stringify(pickChapterPlanFields(currentPlan, fields))
    !== JSON.stringify(pickChapterPlanFields(savedPlan, fields));
}

function getUnsavedChapterChangeLabels(currentPlan = {}, savedSnapshot = '') {
  const savedPlan = parseChapterPlanSnapshot(savedSnapshot);
  const groups = [
    {
      label: '章节基础信息',
      fields: ['volume_number', 'chapter_name', 'summary', 'previous_hook']
    },
    {
      label: '章节细纲',
      fields: ['chapter_mission', 'emotion_target', 'outline_text', 'ending_hook', 'scene_outline', 'chapter_structure']
    },
    {
      label: '本章角色',
      fields: ['character_notes', 'appearing_roles', 'role_execution']
    },
    {
      label: '叙事脉络选择',
      fields: ['main_storyline_id', 'target_storylines']
    },
    {
      label: '生成控制',
      fields: ['generation_settings']
    }
  ];
  const labels = groups
    .filter((group) => isChapterPlanGroupChanged(currentPlan, savedPlan, group.fields))
    .map((group) => group.label);
  return labels.length > 0 ? labels : ['章节配置'];
}

function getChapterStructuredContent(plan = {}) {
  return plan.structured_content && typeof plan.structured_content === 'object'
    ? plan.structured_content
    : {};
}

function buildFeedbackRoleExecution(plan = {}) {
  const structuredContent = getChapterStructuredContent(plan);
  const characterFeedback = structuredContent.character_feedback || {};
  const chapterFeedback = structuredContent.chapter_feedback || {};
  const candidates = [
    characterFeedback.characters,
    chapterFeedback.chapter_characters,
    characterFeedback.newCharacters,
    chapterFeedback.continuity_report?.new_characters
  ].find((items) => Array.isArray(items) && items.length > 0) || [];
  const seenNames = new Set();

  return candidates.reduce((items, candidate) => {
    const role = String(candidate?.name || candidate?.role || '').trim();
    if (!role || seenNames.has(role)) return items;
    seenNames.add(role);
    const rawStatus = String(candidate?.status || '').trim();
    const baseline = rawStatus && !['合理', '偏突兀'].includes(rawStatus)
      ? rawStatus
      : String(candidate?.relation || '').trim();
    items.push({
      role,
      personality: baseline || '延续当前人物底色。',
      background: String(candidate?.role || candidate?.chapter_function || '').trim(),
      appearance: String(candidate?.appearance || candidate?.appearance_marker || candidate?.appearanceMarker || '').trim()
    });
    return items;
  }, []);
}

function createRoleNameKey(roleName = '') {
  return String(roleName || '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();
}

function buildRoleExecutionFromLibraryCharacter(character = {}) {
  return {
    role: String(character?.name || '').trim(),
    personality: String(character?.personality || '').trim(),
    background: String(character?.background || '').trim(),
    appearance: String(character?.appearance || '').trim()
  };
}

function getFeedbackChapterSummary(plan = {}) {
  const structuredContent = getChapterStructuredContent(plan);
  return String(
    structuredContent.plot_feedback?.chapterSummary
    || structuredContent.chapter_feedback?.chapter_summary
    || structuredContent.plot_feedback?.summary
    || structuredContent.chapter_feedback?.story_progress
    || ''
  ).trim();
}

function WorkbenchNavSelect({ label, valueLabel, items, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="workbench-nav-select">
      <span className="workbench-nav-select-label">{label}</span>
      <button
        type="button"
        className={`workbench-nav-select-trigger${open ? ' is-open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <strong>{valueLabel}</strong>
        <em>⌄</em>
      </button>
      {open ? (
        <div className="workbench-nav-select-menu" role="listbox">
          {items.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`workbench-nav-select-option${item.status ? ' has-status' : ''}${item.active ? ' is-active' : ''}`}
              aria-selected={item.active}
              onClick={() => {
                onSelect(item.value);
                setOpen(false);
              }}
            >
              {item.status ? <span className={`chapter-list-dot ${item.status}`} aria-hidden="true" /> : null}
              <span>{item.label}</span>
              {item.meta ? <small>{item.meta}</small> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function isTypingTarget(target) {
  if (!target || typeof target !== 'object') return false;
  const tagName = String(target.tagName || '').toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  return Boolean(target.isContentEditable);
}

function getDrawerMemoryKey(bookId, chapterNumber) {
  if (!bookId) return '';
  return `${DRAWER_MEMORY_PREFIX}:${bookId}:${Number(chapterNumber || 1)}`;
}

export default function App() {
  const {
    books,
    currentBook,
    selectedBookId,
    setSelectedBookId,
    planningState,
    loadingBooks,
    loadingPlanning,
    error,
    reloadPlanning,
    reloadBooks,
    planningModal, setPlanningModal,
    chapterModal, setChapterModal,
    savingState, setSavingState,
    planningNotice, setPlanningNotice,
    chapterNumber, setChapterNumber,
    chapterEntryMode, setChapterEntryMode,
    chapterContext, setChapterContext,
    chapterView, setChapterView,
    storylineOptions, setStorylineOptions,
    draftChapterPlan, setDraftChapterPlan,
    draftStoryline, setDraftStoryline,
    generationState, setGenerationState,
    loadingChapter, setLoadingChapter,
    isGenerating, setIsGenerating,
    resultModalOpen, setResultModalOpen,
    revisionOriginal, setRevisionOriginal,
    revisionDraft, setRevisionDraft,
    revisionRequirement, setRevisionRequirement,
    revisionSuggestions, setRevisionSuggestions,
    revisionSaving, setRevisionSaving,
    revisionPolishing, setRevisionPolishing,
    revisionError, setRevisionError,
    revisionNotice, setRevisionNotice,
    revisionFocusIndex, setRevisionFocusIndex,
    revisionAppliedChangeKeys, setRevisionAppliedChangeKeys,
    revisionParagraphRefs,
    revisionChangeRefs,
    promptPreviewOpen, setPromptPreviewOpen,
    activeDrawer, setActiveDrawer,
    savedChapterPlanSnapshot, setSavedChapterPlanSnapshot
  } = useWorkbench();
  const [drawerMemoryLoadedKey, setDrawerMemoryLoadedKey] = useState('');
  const [activeSurface, setActiveSurface] = useState(getStoredWorkspacePage);
  const [workbenchSidebarCollapsed, setWorkbenchSidebarCollapsed] = useState(false);
  const [workbenchSidebarPeek, setWorkbenchSidebarPeek] = useState(false);
  const [createDraft, setCreateDraft] = useState({
    title: '',
    genre: 'urban',
    subgenre: '',
    author: '',
    description: ''
  });
  const [createState, setCreateState] = useState({ loading: false, error: '' });
  const [createBookModalOpen, setCreateBookModalOpen] = useState(false);
  const [chapterOutlineGenerationState, setChapterOutlineGenerationState] = useState({ loading: false, error: '' });
  const [chapterEntryMenuOpen, setChapterEntryMenuOpen] = useState(false);
  const [chapterDeleteLoading, setChapterDeleteLoading] = useState(false);
  const [selectedLibraryCharacterName, setSelectedLibraryCharacterName] = useState('');
  const [promptManagerState, setPromptManagerState] = useState({
    loading: false,
    error: '',
    entries: [],
    updatedAt: ''
  });
  const generationAbortRef = useRef(null);

  useEffect(() => () => {
    generationAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!workbenchSidebarCollapsed) {
      setWorkbenchSidebarPeek(false);
    }
  }, [workbenchSidebarCollapsed]);

  useEffect(() => {
    const currentPath = getCurrentAppPathname();
    if (currentPath !== '/prompts') return;
    if (!selectedBookId || !planningState.currentBook) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setPromptManagerState((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const data = await fetchPromptPreview(buildPromptPreviewPayload());
        if (cancelled) return;
        setPromptManagerState({
          loading: false,
          error: '',
          entries: Array.isArray(data?.entries) ? data.entries : [],
          updatedAt: data?.updatedAt || new Date().toISOString()
        });
      } catch (previewError) {
        if (cancelled) return;
        setPromptManagerState((prev) => ({
          ...prev,
          loading: false,
          error: previewError.message || 'Prompt 预览加载失败'
        }));
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    selectedBookId,
    chapterNumber,
    draftChapterPlan,
    generationState.content,
    revisionDraft,
    planningState.currentBook,
    chapterContext.chapterListItems
  ]);

  function switchSurface(page, bookId = selectedBookId || currentBook?.id || '') {
    const nextPage = page === 'prompts' ? 'prompts' : page === 'workbench' ? 'workbench' : 'library';
    setActiveSurface(nextPage);
    persistWorkspacePage(nextPage);
    syncAppPath(nextPage, false, bookId);
  }

  function selectBookForSurface(bookId, page = 'library') {
    if (!bookId) return;
    if (bookId === CREATE_BOOK_SELECT_VALUE) {
      setCreateState({ loading: false, error: '' });
      setCreateBookModalOpen(true);
      return;
    }
    persistBookContext(bookId);
    setSelectedBookId(bookId);
    switchSurface(page, bookId);
  }

  function handleSwitchBook() {
    persistBookContext('');
    setSelectedBookId('');
    syncAppPath('entry', true);
  }

  async function handleRefreshPromptManager() {
    if (!selectedBookId || !planningState.currentBook) return;
    setPromptManagerState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const data = await fetchPromptPreview(buildPromptPreviewPayload());
      setPromptManagerState({
        loading: false,
        error: '',
        entries: Array.isArray(data?.entries) ? data.entries : [],
        updatedAt: data?.updatedAt || new Date().toISOString()
      });
    } catch (previewError) {
      setPromptManagerState((prev) => ({
        ...prev,
        loading: false,
        error: previewError.message || 'Prompt 预览加载失败'
      }));
    }
  }

  function buildPromptPreviewPayload() {
    const sourcePlan = draftChapterPlan;
    const normalizedPlan = sourcePlan;
    const chapterStructure = normalizedPlan.chapter_structure || emptyChapterStructure;
    const autoOutline = String(normalizedPlan.outline_text || '').trim();
    const targetWordCount = getPlanWordCount(normalizedPlan);
    const generationSettings = {
      ...((normalizedPlan.structured_content || {}).generation_settings || {}),
      ...(normalizedPlan.generation_settings || {})
    };
    const chapterTitle = formatChapterLabel(chapterNumber, normalizedPlan.chapter_name, ' ');
    const chapterTitleHistory = (Array.isArray(chapterContext.chapterListItems) ? chapterContext.chapterListItems : [])
      .map((item) => normalizeChapterName(item?.chapterName))
      .filter(Boolean);
    const repeatedChapterPhrases = extractRepeatedChapterPhrases(chapterTitleHistory);
    const requiredItems = [{ key: 'outline', label: '章节细纲', value: autoOutline }];
    const missingItems = requiredItems.filter((item) => !hasText(item.value));
    const missingRecommendedItems = generationRecommendedItems
      .filter((item) => !item.passed)
      .map((item) => item.label);

    return {
      bookId: selectedBookId,
      bookTitle: planningState.currentBook?.title || '',
      genre: planningState.currentBook?.genre || 'urban',
      subgenre: planningState.currentBook?.subgenre || '',
      platform: planningState.currentBook?.platform || 'qidian',
      template: planningState.currentBook?.template || '',
      chapterNumber,
      outline: autoOutline,
      outlineText: autoOutline,
      chapterName: normalizeChapterName(normalizedPlan.chapter_name || ''),
      chapterTitle,
      chapterPlan: normalizedPlan,
      chapterStructure,
      generationSettings,
      temperature: Number(generationSettings.temperature ?? 0.7),
      custom_instruction: String(generationSettings.custom_instruction || ''),
      emotionIntensity: Number(generationSettings.emotionIntensity ?? 70),
      colloquialLevel: Number(generationSettings.colloquialLevel ?? 80),
      dialogueRatio: Number(generationSettings.dialogueRatio ?? 30),
      addCliffhanger: generationSettings.addCliffhanger !== false,
      enhanceDialogue: generationSettings.enhanceDialogue !== false,
      avoidAIFeel: generationSettings.avoidAIFeel !== false,
      fastPace: Boolean(generationSettings.fastPace),
      detailedDesc: Boolean(generationSettings.detailedDesc),
      generationBrief: {
        requiredItems,
        recommendedItems: generationRecommendedItems,
        missingRequiredItems: missingItems,
        missingRecommendedItems,
        riskItems: generationRiskReview.items.map((item) => ({
          label: item.title,
          value: item.text
        })),
        mainStoryline: selectedMainStorylineLabel,
        targetStorylines: selectedTargetStorylineLabel,
        wordCount: targetWordCount,
        rhythmHints: storylineRhythmHints.map((hint) => hint.text),
        constraintBrief: ''
      },
      content: String(revisionDraft || generationState.content || '').trim(),
      recentTitles: chapterTitleHistory,
      avoidPhrases: repeatedChapterPhrases,
      previewTypes: ['chapter_name', 'outline', 'chapter_outline_breakdown', 'chapter', 'chapter_feedback']
    };
  }

  function updateCreateDraft(field, value) {
    setCreateDraft((draft) => ({
      ...draft,
      [field]: value
    }));
  }

  async function handleCreateBook(event) {
    event.preventDefault();
    const title = createDraft.title.trim();
    if (!title) {
      setCreateState({ loading: false, error: '请先填写书名。' });
      return;
    }

    setCreateState({ loading: true, error: '' });
    try {
      const created = await createBook({
        title,
        genre: createDraft.genre.trim() || 'urban',
        subgenre: createDraft.subgenre.trim(),
        author: createDraft.author.trim(),
        description: createDraft.description.trim(),
        status: 'writing'
      });
      const createdId = created?.id || '';
      if (createdId) {
        persistBookContext(createdId);
        setSelectedBookId(createdId);
        switchSurface('library', createdId);
        await reloadBooks(createdId);
      } else {
        await reloadBooks();
      }
      setCreateDraft({
        title: '',
        genre: 'urban',
        subgenre: '',
        author: '',
        description: ''
      });
      setCreateBookModalOpen(false);
    } catch (createError) {
      setCreateState({ loading: false, error: createError.message });
      return;
    }
    setCreateState({ loading: false, error: '' });
  }

  function pushPlanningNotice(kind, title, text) {
    setPlanningNotice({ kind, title, text });
  }

  async function persistCurrentChapterPlan({
    plan,
    successTitle,
    successText,
    failureTitle = '保存失败',
    closeModal = false
  }) {
    setPlanningNotice(null);
    setSavingState({ loading: true, error: '' });
    setPlanningNotice(null);
    try {
      await saveChapterPlan(selectedBookId, chapterNumber, plan);
      const bundle = await fetchChapterSetupBundle(selectedBookId, chapterNumber);
      const normalized = normalizeChapterBundle(bundle, chapterNumber);
      setChapterContext(normalized.context);
      setChapterView(normalized.view);
      setStorylineOptions(normalized.storylineOptions);
      setDraftChapterPlan(normalized.draft);
      setSavedChapterPlanSnapshot(serializeChapterPlanDraft(normalized.draft));
      setGenerationState(normalized.generation);
      if (closeModal) {
        setChapterModal(null);
      }
      pushPlanningNotice('success', successTitle, successText);
    } catch (saveError) {
      setSavingState({ loading: false, error: saveError.message });
      pushPlanningNotice('error', failureTitle, saveError.message);
      return null;
    }
    setSavingState({ loading: false, error: '' });
    return true;
  }

  async function handleSaveMountedStorylines() {
    await persistCurrentChapterPlan({
      plan: prepareOutlineModalPlan(draftChapterPlan),
      successTitle: '本章挂载已保存',
      successText: '当前卷主线与本章支线挂载已写回，可以继续生成或切到下一章。',
      failureTitle: '保存本章挂载失败'
    });
  }

  function buildChapterMaterialPlan() {
    const roleNames = (Array.isArray(draftChapterPlan.role_execution) ? draftChapterPlan.role_execution : [])
      .map((item) => String(item?.role || '').trim())
      .filter(Boolean);
    const plan = {
      ...draftChapterPlan,
      appearing_roles: roleNames.length > 0 ? roleNames : draftChapterPlan.appearing_roles,
      structured_content: {
        ...(draftChapterPlan.structured_content || {}),
        plot_notes: String(draftChapterPlan.plot_notes || '').trim()
      }
    };
    return prepareOutlineModalPlan(plan);
  }

  async function handleSaveChapterMaterials(kind, regenerate = false) {
    const plan = buildChapterMaterialPlan();
    const isPlot = kind === 'plot';
    const saved = await persistCurrentChapterPlan({
      plan,
      successTitle: isPlot ? '本章情节笔记已保存' : '本章角色已保存',
      successText: isPlot
        ? '情节修订已写回当前章节，后续生成会读取这份资料。'
        : '人物修订已写回当前章节，后续生成会读取这份资料。',
      failureTitle: isPlot ? '保存情节笔记失败' : '保存本章角色失败',
      closeModal: true
    });
    if (saved && regenerate) {
      await handleGenerateChapter(plan);
    }
  }

  async function handleSaveChapterCharacters(regenerate = false) {
    await handleSaveChapterMaterials('character', regenerate);
  }

  async function handleSaveChapterPlot(regenerate = false) {
    await handleSaveChapterMaterials('plot', regenerate);
  }

  async function handleSaveChapterOutline() {
    await persistCurrentChapterPlan({
      plan: prepareOutlineModalPlan(draftChapterPlan),
      successTitle: '章节细纲已保存',
      successText: '章节细纲已写回，后续正文生成会优先读取这份细纲。',
      failureTitle: '保存章节细纲失败',
      closeModal: true
    });
  }

  async function handleSaveGenerationSettings() {
    await persistCurrentChapterPlan({
      plan: prepareOutlineModalPlan(draftChapterPlan),
      successTitle: '生成控制已保存',
      successText: '目标字数、写法预设和正文控制参数已写回当前章节。',
      failureTitle: '保存生成控制失败'
    });
  }

  async function reloadChapterSetup(overrideDraft = null) {
    if (!selectedBookId) return;
    const bundle = await fetchChapterSetupBundle(selectedBookId, chapterNumber);
    const normalized = normalizeChapterBundle(bundle, chapterNumber);
    setChapterContext(normalized.context);
    setChapterView(normalized.view);
    setStorylineOptions(normalized.storylineOptions);
    setDraftChapterPlan(overrideDraft || normalized.draft);
    setSavedChapterPlanSnapshot(serializeChapterPlanDraft(overrideDraft || normalized.draft));
    setGenerationState(normalized.generation);
    return normalized;
  }

  async function handlePersistChapterResult({
    content,
    normalizedPlan,
    chapterStructure,
    chapterTitle,
    targetWordCount,
    successTitle,
    successText,
    generationAudit,
    openResultModal = false
  }) {
    const cycleResult = await persistChapterResultCycle({
      bookId: selectedBookId,
      chapterNumber,
      content,
      normalizedPlan,
      chapterStructure,
      chapterTitle,
      mainStorylineLabel: selectedMainStorylineLabel,
      targetStorylineLabel: selectedTargetStorylineLabel,
      rhythmHints: storylineRhythmHints,
      generationAudit,
      generateChapterFeedback,
      saveChapterPlan,
      upsertGeneratedChapter
    });

    if (cycleResult.feedbackSaved && cycleResult.feedbackPlan) {
      setDraftChapterPlan(cycleResult.feedbackPlan);
      setSavedChapterPlanSnapshot(serializeChapterPlanDraft(cycleResult.feedbackPlan));
    }

    const nextGenerationState = buildGenerationStateFromCycle({
      content,
      chapterTitle,
      targetWordCount,
      chapterFeedback: cycleResult.chapterFeedback,
      cycleResult,
      successTitle,
      successText
    });
    setGenerationState(nextGenerationState);
    try {
      const refreshedBundle = await fetchChapterSetupBundle(selectedBookId, chapterNumber);
      const refreshed = normalizeChapterBundle(refreshedBundle, chapterNumber);
      setStorylineOptions(refreshed.storylineOptions);
      setChapterView(refreshed.view);
      setChapterContext(refreshed.context);
    } catch (_) {}
    setRevisionOriginal(String(content || ''));
    setRevisionDraft(String(content || ''));
    setRevisionSuggestions(null);
    setRevisionError('');
    if (openResultModal) {
      setResultModalOpen(true);
    }
    return {
      ...cycleResult,
      nextGenerationState
    };
  }

  function goToPreviousChapter() {
    requestChapterChange(Math.max(1, Number(chapterNumber || 1) - 1));
  }

  function goToNextChapter() {
    requestChapterChange(Math.max(1, Number(chapterNumber || 1) + 1));
  }

  async function handleDeleteCurrentChapter() {
    if (!selectedBookId) return;
    const currentNumber = Math.max(1, Number(chapterNumber || 1));
    const currentItem = chapterNavigationItems.find((item) => Number(item.chapterNumber || 0) === currentNumber);
    const currentChapterName = normalizeChapterName(currentItem?.chapterName);
    const currentLabel = currentChapterName ? `第 ${currentNumber} 章《${currentChapterName}》` : `第 ${currentNumber} 章`;
    const confirmText = hasUnsavedChapterChanges
      ? `${currentLabel} 还有未保存修改。确定只删除已生成的正文吗？章节名称和细纲会保留。`
      : `确定删除${currentLabel}的正文吗？章节名称和细纲会保留。`;
    if (!window.confirm(confirmText)) return;

    setChapterDeleteLoading(true);
    setPlanningNotice(null);
    try {
      await deleteChapterContentByNumber(selectedBookId, currentNumber);
      await reloadBooks(selectedBookId);
      await reloadPlanning(selectedBookId);
      await reloadChapterSetup();
      setChapterModal(null);
      pushPlanningNotice('success', '正文已删除', `${currentLabel}的章节名称和细纲已保留，可以重新生成正文。`);
    } catch (deleteError) {
      pushPlanningNotice('error', '删除正文失败', deleteError.message);
    } finally {
      setChapterDeleteLoading(false);
    }
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
      const hasRevisionPayload = Boolean(
        response && (
          suggestions.length > 0
          || response.summary
          || response.regeneration_notes
          || response.raw_content
        )
      );
      if (!hasRevisionPayload) {
        setRevisionError('校改接口没有返回可用建议。');
        return;
      }
      setRevisionSuggestions(response);
      if (suggestions.length > 0) {
        setRevisionDraft(buildRevisionDraftFromSuggestions(sourceContent, suggestions));
      }
      setRevisionNotice(
        suggestions.length > 0
          ? '已生成逐段校改稿。'
          : '本轮没有逐段建议，可以直接在校改稿里编辑。'
      );
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
      const normalizedPlan = prepareOutlineModalPlan(draftChapterPlan);
      const chapterStructure = normalizedPlan.chapter_structure || emptyChapterStructure;
      const chapterTitle = formatChapterLabel(chapterNumber, draftChapterPlan.chapter_name, ' ');
      const cycleResult = await handlePersistChapterResult({
        content: nextContent,
        normalizedPlan,
        chapterStructure,
        chapterTitle,
        targetWordCount: getPlanWordCount(normalizedPlan),
        successTitle: '正文已校改',
        successText: '校改后的正文、摘要和创作审校都已写回。'
      });
      pushPlanningNotice(
        cycleResult.nextGenerationState.statusKind,
        cycleResult.nextGenerationState.statusTitle,
        cycleResult.nextGenerationState.statusText
      );
      setResultModalOpen(false);
    } catch (saveError) {
      setRevisionError(saveError.message);
      pushPlanningNotice('error', '保存校改失败', saveError.message);
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
      setSavingState({ loading: false, error: '叙事脉络名称不能为空。' });
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
          prepareOutlineModalPlan(nextPlan)
        );
      }
      await reloadChapterSetup(nextPlan);
      setChapterModal(null);
      pushPlanningNotice(
        'success',
        draftStoryline.id ? '叙事脉络已保存' : '叙事脉络已创建并挂到当前章节',
        draftStoryline.id
          ? '叙事脉络范围和核心冲突已更新。'
          : '新叙事脉络已保存，后续会按主线与预计章节范围自动挂载。'
      );
    } catch (saveError) {
      setSavingState({ loading: false, error: saveError.message });
      pushPlanningNotice('error', draftStoryline.id ? '保存叙事脉络失败' : '创建叙事脉络失败', saveError.message);
      return;
    }
    setSavingState({ loading: false, error: '' });
  }

  async function handleGenerateChapter(planOverride = null) {
    const sourcePlan = planOverride || draftChapterPlan;
    const normalizedPlan = sourcePlan;
    const chapterStructure = normalizedPlan.chapter_structure || emptyChapterStructure;
    const autoOutline = String(normalizedPlan.outline_text || '').trim();
    const requiredItems = [{ key: 'outline', label: '章节细纲', value: autoOutline }];
    const missingItems = requiredItems.filter((item) => !hasText(item.value));

    if (missingItems.length > 0) {
      setGenerationState({
        ...generationState,
        statusKind: 'warning',
        statusTitle: '缺少章节必填信息',
        statusText: `请先补齐：${missingItems.map((item) => item.label).join('、')}。`
      });
      return;
    }

    generationAbortRef.current?.abort();
    const generationAbortController = new AbortController();
    generationAbortRef.current = generationAbortController;
    setIsGenerating(true);
    setPlanningNotice(null);
    setGenerationState({
      ...generationState,
      statusKind: 'info',
      statusTitle: '正在生成正文',
      statusText: '正在把本章计划送进生成链路。'
    });

    let streamedContent = '';
    try {
      const chapterTitle = formatChapterLabel(chapterNumber, normalizedPlan.chapter_name, ' ');
      const targetWordCount = getPlanWordCount(normalizedPlan);
      const generationSettings = {
        ...((normalizedPlan.structured_content || {}).generation_settings || {}),
        ...(normalizedPlan.generation_settings || {})
      };
      const generationPayload = {
        bookId: selectedBookId,
        bookTitle: planningState.currentBook.title,
        genre: planningState.currentBook.genre,
        subgenre: planningState.currentBook.subgenre,
        platform: planningState.currentBook.platform,
        template: planningState.currentBook.template,
        chapterNumber,
        wordCount: targetWordCount,
        outline: autoOutline,
        chapterName: normalizeChapterName(normalizedPlan.chapter_name || ''),
        chapterTitle,
        chapterPlan: normalizedPlan,
        chapterStructure,
        generationSettings,
        temperature: Number(generationSettings.temperature ?? 0.7),
        custom_instruction: String(generationSettings.custom_instruction || ''),
        emotionIntensity: Number(generationSettings.emotionIntensity ?? 70),
        colloquialLevel: Number(generationSettings.colloquialLevel ?? 80),
        dialogueRatio: Number(generationSettings.dialogueRatio ?? 30),
        addCliffhanger: generationSettings.addCliffhanger !== false,
        enhanceDialogue: generationSettings.enhanceDialogue !== false,
        avoidAIFeel: generationSettings.avoidAIFeel !== false,
        fastPace: Boolean(generationSettings.fastPace),
        detailedDesc: Boolean(generationSettings.detailedDesc),
        generationBrief: {
          requiredItems,
          recommendedItems: generationRecommendedItems,
          missingRequiredItems: missingItems,
          missingRecommendedItems,
          riskItems: generationRiskReview.items.map((item) => ({
            label: item.title,
            value: item.text
          })),
          mainStoryline: selectedMainStorylineLabel,
          targetStorylines: selectedTargetStorylineLabel,
          wordCount: targetWordCount,
          rhythmHints: storylineRhythmHints.map((hint) => hint.text),
          constraintBrief: ''
        },
        promptType: 'chapter'
      };
      let response = null;
      try {
        response = await streamChapterContent(generationPayload, {
          signal: generationAbortController.signal,
          onDelta: ({ content: nextContent }) => {
            const safeNextContent = String(nextContent || '').replace(/\uFFFD+/g, '').replace(/�+/g, '');
            const effectiveWordCount = countPlatformEffectiveWords(safeNextContent);
            streamedContent = safeNextContent;
            setGenerationState((prev) => ({
              ...prev,
              hasContent: true,
              content: safeNextContent,
              statusKind: 'info',
              statusTitle: '正在流式生成正文',
              statusText: `已实时接收 ${formatExactWordCount(effectiveWordCount)}，生成完成后会继续写回摘要、创作审校和叙事脉络进度。`,
              wordCountLabel: `生成中 · ${formatWordCountProgress(effectiveWordCount, targetWordCount)}`,
              previewText: safeNextContent.replace(/\s+/g, ' ').slice(0, 520)
            }));
            setRevisionDraft(safeNextContent);
          }
        });
      } catch (streamError) {
        if (generationAbortController.signal.aborted || streamError?.name === 'AbortError') {
          throw streamError;
        }
        if (streamedContent) {
          throw streamError;
        }
        pushPlanningNotice('warning', '流式生成不可用，已切换同步生成', streamError.message);
        response = await generateChapterContent(generationPayload, {
          signal: generationAbortController.signal
        });
      }
      const content = response?.content || response?.text || response || '';
      const cycleResult = await handlePersistChapterResult({
        content,
        normalizedPlan,
        chapterStructure,
        chapterTitle,
        targetWordCount,
        successTitle: '正文已生成',
        successText: '正文、摘要和创作审校都已写回，下一章会自动读取这份承接信息。',
        generationAudit: response?.metadata?.continuityAudit || response?.audit?.audit || null,
        openResultModal: true
      });
      pushPlanningNotice(
        cycleResult.nextGenerationState.statusKind,
        cycleResult.nextGenerationState.statusTitle,
        cycleResult.nextGenerationState.statusText
      );
    } catch (generateError) {
      if (generationAbortController.signal.aborted || generateError?.name === 'AbortError') {
        setGenerationState((prev) => ({
          ...prev,
          statusKind: 'warning',
          statusTitle: '已停止生成',
          statusText: streamedContent
            ? '已停止接收正文，当前片段仅供查看，未保存到资料库。'
            : '生成请求已停止，未保存任何正文。'
        }));
        pushPlanningNotice('warning', '已停止生成', '本次生成未保存，也不会继续执行摘要、审校和剧情线回写。');
        return;
      }
      pushPlanningNotice('error', '生成失败', generateError.message);
      setGenerationState({
        ...generationState,
        statusKind: 'error',
        statusTitle: '生成失败',
        statusText: generateError.message
      });
    } finally {
      if (generationAbortRef.current === generationAbortController) {
        generationAbortRef.current = null;
      }
      setIsGenerating(false);
    }
  }

  function updateDraftChapterPlanField(field, value) {
    setDraftChapterPlan((prev) => ({ ...prev, [field]: value }));
  }

  function openCharacterEditor() {
    const libraryCharacters = Array.isArray(planningState?.bookPlanning?.characters) ? planningState.bookPlanning.characters : [];
    const libraryCharacterMap = new Map(
      libraryCharacters.map((item) => [createRoleNameKey(item?.name || ''), item])
    );
    setDraftChapterPlan((prev) => {
      const mergeWithLibrary = (roleExecution = []) => roleExecution.map((item) => {
        const libraryCharacter = libraryCharacterMap.get(createRoleNameKey(item?.role || ''));
        if (!libraryCharacter) return item;
        const librarySeed = buildRoleExecutionFromLibraryCharacter(libraryCharacter);
        return {
          ...item,
          personality: librarySeed.personality || item.personality || item.baseline || '',
          background: librarySeed.background || item.background || item.chapter_function || '',
          appearance: librarySeed.appearance || item.appearance || item.appearance_marker || ''
        };
      });

      if (Array.isArray(prev.role_execution) && prev.role_execution.length > 0) {
        const nextRoleExecution = mergeWithLibrary(prev.role_execution);
        return JSON.stringify(nextRoleExecution) === JSON.stringify(prev.role_execution)
          ? prev
          : { ...prev, role_execution: nextRoleExecution };
      }

      const feedbackRoles = mergeWithLibrary(buildFeedbackRoleExecution(prev));
      return feedbackRoles.length > 0 ? { ...prev, role_execution: feedbackRoles } : prev;
    });
    setSelectedLibraryCharacterName('');
    setChapterModal('character');
  }

  function openPlotEditor() {
    setDraftChapterPlan((prev) => {
      if (String(prev.plot_notes || '').trim()) return prev;
      const feedbackSummary = getFeedbackChapterSummary(prev);
      return feedbackSummary ? { ...prev, plot_notes: feedbackSummary } : prev;
    });
    setChapterModal('plot');
  }

  function updateRoleExecutionField(index, field, value) {
    setDraftChapterPlan((prev) => ({
      ...prev,
      role_execution: (Array.isArray(prev.role_execution) ? prev.role_execution : []).map((item, itemIndex) => (
        itemIndex === index ? { ...item, [field]: value } : item
      ))
    }));
  }

  function addRoleExecutionItem() {
    setDraftChapterPlan((prev) => ({
      ...prev,
      role_execution: [
        ...(Array.isArray(prev.role_execution) ? prev.role_execution : []),
        {
          role: '',
          personality: '',
          background: '',
          appearance: ''
        }
      ]
    }));
  }

  function addLibraryCharacterToChapter() {
    const selectedName = String(selectedLibraryCharacterName || '').trim();
    if (!selectedName) return;
    const libraryCharacters = Array.isArray(planningState?.bookPlanning?.characters) ? planningState.bookPlanning.characters : [];
    const selectedCharacter = libraryCharacters.find((item) => String(item?.name || '').trim() === selectedName);
    if (!selectedCharacter) return;

    setDraftChapterPlan((prev) => {
      const currentRoleExecution = Array.isArray(prev.role_execution) ? prev.role_execution : [];
      const targetKey = createRoleNameKey(selectedName);
      const existingIndex = currentRoleExecution.findIndex((item) => createRoleNameKey(item?.role || '') === targetKey);
      const nextRoleExecution = existingIndex >= 0
        ? currentRoleExecution.map((item, itemIndex) => (
          itemIndex === existingIndex
            ? {
                ...buildRoleExecutionFromLibraryCharacter(selectedCharacter),
                ...item,
                role: selectedCharacter.name || item.role || ''
              }
            : item
        ))
        : [...currentRoleExecution, buildRoleExecutionFromLibraryCharacter(selectedCharacter)];
      const currentAppearingRoles = Array.isArray(prev.appearing_roles) ? prev.appearing_roles : [];
      const nextAppearingRoles = currentAppearingRoles.some((item) => createRoleNameKey(item) === targetKey)
        ? currentAppearingRoles
        : [...currentAppearingRoles, selectedName];
      return {
        ...prev,
        appearing_roles: nextAppearingRoles,
        role_execution: nextRoleExecution
      };
    });

    setSelectedLibraryCharacterName('');
  }

  function removeRoleExecutionItem(index) {
    setDraftChapterPlan((prev) => ({
      ...prev,
      role_execution: (Array.isArray(prev.role_execution) ? prev.role_execution : []).filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  async function handleGenerateCurrentChapterOutline() {
    if (!selectedBookId || !planningState.currentBook) return;

    setChapterOutlineGenerationState({ loading: true, error: '' });
    setPlanningNotice(null);
    try {
      const libraryCharacters = Array.isArray(planningState?.bookPlanning?.characters)
        ? planningState.bookPlanning.characters
        : [];
      const characterNames = [...new Set([
        ...libraryCharacters.map((item) => String(item?.name || '').trim()),
        ...(Array.isArray(draftChapterPlan.appearing_roles) ? draftChapterPlan.appearing_roles : []),
        ...(Array.isArray(draftChapterPlan.role_execution)
          ? draftChapterPlan.role_execution.map((item) => String(item?.role || '').trim())
          : [])
      ].filter(Boolean))];
      const generated = await generateChapterOutline({
        bookId: selectedBookId,
        chapterNumber,
        genre: planningState.currentBook.genre || 'urban',
        subgenre: planningState.currentBook.subgenre || '',
        bookTitle: planningState.currentBook.title || '',
        chapterTitle: formatChapterLabel(chapterNumber, draftChapterPlan.chapter_name, ' '),
        characters: characterNames.join(' / ')
      });
      const generatedText = String(generated?.content || generated || '').trim();
      if (!generatedText) throw new Error('AI 没有返回可用章节细纲');

      const chapterTitleHistory = (Array.isArray(chapterContext.chapterListItems) ? chapterContext.chapterListItems : [])
        .map((item) => normalizeChapterName(item?.chapterName))
        .filter(Boolean);
      const repeatedChapterPhrases = extractRepeatedChapterPhrases(chapterTitleHistory);
      const generatedChapterName = normalizeChapterName(draftChapterPlan.chapter_name || '')
        ? null
        : await generateChapterName({
          genre: planningState.currentBook.genre || 'urban',
          subgenre: planningState.currentBook.subgenre || '',
          chapterNumber,
          outlineText: generatedText,
          bookTitle: planningState.currentBook.title || '',
          recentTitles: chapterTitleHistory,
          avoidPhrases: repeatedChapterPhrases
        });
      const resolvedChapterName = normalizeChapterName(
        draftChapterPlan.chapter_name
        || generatedChapterName?.content
        || generatedChapterName
        || ''
      );
      setDraftChapterPlan((prev) => ({
        ...prev,
        source: 'ai',
        chapter_name: resolvedChapterName || prev.chapter_name,
        outline_text: generatedText
      }));
      setChapterOutlineGenerationState({ loading: false, error: '' });
      pushPlanningNotice('success', '当前章节细纲已生成', '内容已填入创作台但尚未保存，请检查后点击“保存”。');
    } catch (generateError) {
      const message = generateError.message || 'AI 生成当前章节细纲失败';
      setChapterOutlineGenerationState({ loading: false, error: message });
      pushPlanningNotice('error', '生成章节细纲失败', message);
    }
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

  function clearStorylineSelection() {
    setDraftChapterPlan((prev) => ({
      ...prev,
      target_storylines: prev.main_storyline_id ? [prev.main_storyline_id] : []
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

  function handleContextChipClick(chip) {
    setActiveDrawer((prev) => (prev === chip ? null : chip));
  }
  function handleCloseDrawer() {
    setActiveDrawer(null);
  }

  const currentDraftSnapshot = serializeChapterPlanDraft(draftChapterPlan);
  const hasUnsavedChapterChanges = currentDraftSnapshot !== savedChapterPlanSnapshot;
  const drawerMemoryKey = getDrawerMemoryKey(selectedBookId, chapterNumber);

  function confirmDiscardUnsavedChanges(actionLabel) {
    if (!hasUnsavedChapterChanges) return true;
    const changedLabels = getUnsavedChapterChangeLabels(draftChapterPlan, savedChapterPlanSnapshot);
    return window.confirm(`当前章节还有未保存修改：${changedLabels.join('、')}。\n继续${actionLabel}会丢失这些改动。要继续吗？`);
  }

  function requestChapterChange(nextChapterNumber) {
    const safeChapterNumber = Math.max(1, Number(nextChapterNumber || 1));
    if (safeChapterNumber === Number(chapterNumber || 1)) return;
    if (!confirmDiscardUnsavedChanges(`切换到第 ${safeChapterNumber} 章`)) return;
    setChapterNumber(safeChapterNumber);
  }

  function handleGenerateWithGuards() {
    if (!confirmDiscardUnsavedChanges('生成正文')) return;
    handleGenerateChapter();
  }

  function handleStopGeneration() {
    const controller = generationAbortRef.current;
    if (!controller || controller.signal.aborted) return;
    setGenerationState((prev) => ({
      ...prev,
      statusKind: 'warning',
      statusTitle: '正在停止生成',
      statusText: '正在中断模型连接，本次内容不会保存。'
    }));
    controller.abort();
  }

  useEffect(() => {
    if (!drawerMemoryKey) {
      setDrawerMemoryLoadedKey('');
      setActiveDrawer(null);
      return;
    }

    let nextDrawer = null;
    try {
      const raw = window.localStorage.getItem(drawerMemoryKey);
      nextDrawer = raw || null;
    } catch (_) {
      nextDrawer = null;
    }
    setActiveDrawer(nextDrawer);
    setDrawerMemoryLoadedKey(drawerMemoryKey);
  }, [drawerMemoryKey, setActiveDrawer]);

  useEffect(() => {
    if (!drawerMemoryKey || drawerMemoryLoadedKey !== drawerMemoryKey) return;
    try {
      if (activeDrawer) {
        window.localStorage.setItem(drawerMemoryKey, activeDrawer);
      } else {
        window.localStorage.removeItem(drawerMemoryKey);
      }
    } catch (_) {}
  }, [activeDrawer, drawerMemoryKey, drawerMemoryLoadedKey]);

  useEffect(() => {
    function handleKeyDown(event) {
      const typing = isTypingTarget(event.target);
      const hasBlockingModal = Boolean(chapterModal || resultModalOpen || promptPreviewOpen || planningModal);

      if (event.key === 'Escape') {
        if (promptPreviewOpen) {
          event.preventDefault();
          setPromptPreviewOpen(false);
          return;
        }
        if (resultModalOpen) {
          event.preventDefault();
          setResultModalOpen(false);
          return;
        }
        if (chapterModal) {
          event.preventDefault();
          setChapterModal(null);
          return;
        }
        if (planningModal) {
          event.preventDefault();
          setPlanningModal(null);
          return;
        }
        if (activeDrawer) {
          event.preventDefault();
          handleCloseDrawer();
        }
        return;
      }

      if (typing || hasBlockingModal) return;

      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        handleGenerateWithGuards();
        return;
      }

      if (event.key === '[') {
        event.preventDefault();
        goToPreviousChapter();
        return;
      }

      if (event.key === ']') {
        event.preventDefault();
        goToNextChapter();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeDrawer,
    chapterModal,
    planningModal,
    promptPreviewOpen,
    resultModalOpen,
    chapterNumber,
    hasUnsavedChapterChanges,
    generationState,
    draftChapterPlan
  ]);

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
  const hasMainStoryline = hasText(draftChapterPlan.main_storyline_id);
  const hasStorylineAnchor = hasMountedStorylineAnchor(draftChapterPlan);
  const hasOutlineAnchor = hasUsableChapterOutline(draftChapterPlan);
  const chapterStructure = draftChapterPlan.chapter_structure || emptyChapterStructure;
  const distinctOutlineText = String(draftChapterPlan.outline_text || '').trim();
  const drawerOutlineText = String(
    distinctOutlineText
    || ''
  ).trim() || '尚未建立章节细纲。';
  const generationRequiredItems = [{ key: 'outline', label: '章节细纲', value: drawerOutlineText }];
  const generationRecommendedItems = [
    { key: 'storyline', label: '叙事脉络承接', value: selectedTargetStorylines.length > 0 ? selectedTargetStorylineLabel : '' }
  ];
  const missingRequiredItems = generationRequiredItems.filter((item) => !hasText(item.value));
  const missingRecommendedItems = generationRecommendedItems.filter((item) => !hasText(item.value));
  const canGenerate = Boolean(selectedBookId) && missingRequiredItems.length === 0 && !loadingChapter;
  const generationChecklistItems = [
    {
      key: 'outline',
      label: '保存章节细纲',
      done: hasOutlineAnchor,
      detail: hasOutlineAnchor
        ? '章节细纲已保存，可以用于生成正文。'
        : '先点“补细纲”，填写本章完整剧情摘要并保存。'
    },
    {
      key: 'storyline',
      label: '挂载叙事脉络（推荐）',
      done: hasStorylineAnchor,
      detail: hasStorylineAnchor
        ? (hasMainStoryline ? '当前卷主线与本章支线已挂载。' : '已挂载支线，当前卷主线待系统补齐。')
        : '这一步不是硬性门槛，但先挂载叙事脉络，会更利于连续章节承接。'
    },
    {
      key: 'generate',
      label: '点击生成章节',
      done: canGenerate,
      detail: canGenerate
        ? '当前按钮已可用，可以直接生成。'
        : '完成任务表保存后，这里的按钮会自动亮起。'
    }
  ];
  const chapterNavigationItems = Array.isArray(chapterContext.chapterListItems) && chapterContext.chapterListItems.length > 0
    ? chapterContext.chapterListItems
    : [{
        chapterNumber,
        chapterName: normalizeChapterName(draftChapterPlan.chapter_name),
        volumeNumber: draftChapterPlan.volume_number || 1,
        volumeLabel: chapterView.volumeLabel || '第 1 卷',
        status: 'empty'
      }];
  const currentChapterNavigationItem = chapterNavigationItems.find((item) => Number(item.chapterNumber || 0) === Number(chapterNumber));
  const currentNavigationVolumeNumber = Number(
    currentChapterNavigationItem?.volumeNumber
    || draftChapterPlan.volume_number
    || 1
  );
  const volumeNavigationItems = Array.isArray(chapterContext.volumeList) && chapterContext.volumeList.length > 0
    ? chapterContext.volumeList
    : [{
        volumeNumber: currentNavigationVolumeNumber,
        volumeLabel: chapterView.volumeLabel || `第 ${currentNavigationVolumeNumber} 卷`,
        startChapter: Math.min(...chapterNavigationItems.map((item) => Number(item.chapterNumber || chapterNumber))),
        endChapter: Math.max(...chapterNavigationItems.map((item) => Number(item.chapterNumber || chapterNumber)))
      }];
  const currentVolumeNavigationItem = volumeNavigationItems.find((volume) => Number(volume.volumeNumber || 0) === currentNavigationVolumeNumber)
    || volumeNavigationItems[0];
  const currentVolumeChapters = chapterNavigationItems.filter((item) => Number(item.volumeNumber || currentNavigationVolumeNumber) === currentNavigationVolumeNumber);
  const visibleVolumeChapters = currentVolumeChapters.length > 0
    ? currentVolumeChapters
    : chapterNavigationItems;
  function getVolumeLocalChapterNumber(item, volume = currentVolumeNavigationItem) {
    const startChapter = Number(volume?.startChapter || visibleVolumeChapters[0]?.chapterNumber || 1);
    return Math.max(1, Number(item?.chapterNumber || 1) - startChapter + 1);
  }
  function handleVolumeNavigationChange(nextVolumeNumber) {
    const nextVolume = volumeNavigationItems.find((volume) => Number(volume.volumeNumber || 0) === Number(nextVolumeNumber));
    const firstChapterInVolume = chapterNavigationItems.find((item) => Number(item.volumeNumber || 0) === Number(nextVolumeNumber));
    const targetChapter = Number(firstChapterInVolume?.chapterNumber || nextVolume?.startChapter || chapterNumber);
    requestChapterChange(targetChapter);
  }
  const currentVolumeSelectLabel = currentVolumeNavigationItem?.volumeLabel || `第 ${currentNavigationVolumeNumber} 卷`;
  const volumeSelectItems = volumeNavigationItems.map((volume) => ({
    value: Number(volume.volumeNumber || 1),
    label: volume.volumeLabel || `第 ${volume.volumeNumber || 1} 卷`,
    meta: volume.estimatedChapters
      ? `${volume.estimatedChapters} 章`
      : `${volume.startChapter || '?'}-${volume.endChapter || '?'} 章`,
    active: Number(volume.volumeNumber || 0) === currentNavigationVolumeNumber
  }));
  const currentChapterSelectLabel = formatChapterLabel(chapterNumber, draftChapterPlan.chapter_name);
  const chapterSelectItems = visibleVolumeChapters.map((item) => ({
    value: Number(item.chapterNumber || 1),
    label: formatChapterLabel(item.chapterNumber, item.chapterName),
    meta: `第 ${currentNavigationVolumeNumber} 卷`,
    status: item.status || 'empty',
    active: Number(item.chapterNumber || 0) === Number(chapterNumber)
  }));
  const currentBookTitle = planningState?.currentBook?.title || currentBook?.title || '未选择书籍';
  const bookSelectItems = [
    ...books.map((book) => ({
      value: book.id,
      label: book.title || '未命名作品',
      meta: getBookStatusLabel(book.status),
      active: book.id === currentBook?.id
    })),
    {
      value: CREATE_BOOK_SELECT_VALUE,
      label: '新建书籍',
      meta: '创建新作品'
    }
  ];
  const chapterEntryModeItems = [
    { value: 'first', label: '第 1 章' },
    { value: 'latest', label: '最新章' },
    { value: 'next', label: '下一章' }
  ];
  const currentChapterEntryModeItem = chapterEntryModeItems.find((item) => item.value === chapterEntryMode) || chapterEntryModeItems[0];
  const revisionOriginalParagraphs = normalizeParagraphs(revisionOriginal);
  const revisionSuggestionItems = Array.isArray(revisionSuggestions?.suggestions) ? revisionSuggestions.suggestions : [];
  const revisionDiffRows = buildRevisionParagraphDiffRows(revisionOriginal, revisionSuggestionItems);
  const revisionSummaryStats = summarizeRevisionSuggestions(revisionSuggestionItems);
  const revisionSummaryText = revisionSuggestionItems.length > 0
    ? `本次校改新增 ${revisionSummaryStats.added} 段，删除 ${revisionSummaryStats.removed} 段，修改 ${revisionSummaryStats.changed} 段。`
    : (revisionSuggestions?.summary || revisionSuggestions?.regeneration_notes || revisionNotice || '待生成校改稿。');
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
        title: '新章节还没进入可生成状态',
        text: `还差这几项：${missingRequiredItems.map((item) => item.label).join('、')}。先保存任务表，再点生成。`
      }
    : !hasStorylineAnchor
      ? {
          kind: 'warning',
          title: '已经可以生成，但建议先挂叙事脉络',
          text: '当前任务表已满足生成条件；如果要让后续章节更稳承接，建议再挂 1 条叙事脉络。'
        }
      : !hasMainStoryline
        ? {
            kind: 'warning',
            title: '当前卷主线待补齐',
            text: '已挂载叙事脉络，但当前卷主线尚未写入；重新加载章节后系统会自动补齐。'
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
          text: '章节细纲和生成所需信息都已就位。'
      };
  const generationRiskReview = buildGenerationRiskReview(
    draftChapterPlan,
    chapterContext.generationConstraints
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

  const currentChapterStructuredContent = getChapterStructuredContent(draftChapterPlan);
  const currentChapterFeedback = currentChapterStructuredContent.chapter_feedback || {};
  const characterFeedbackSummary = String(
    currentChapterStructuredContent.character_feedback?.summary
    || currentChapterFeedback.character_progress
    || ''
  ).trim();
  const plotFeedbackSummary = String(
    currentChapterStructuredContent.plot_feedback?.summary
    || currentChapterFeedback.story_progress
    || ''
  ).trim();
  const hasManualCharacterQuickReference = Array.isArray(draftChapterPlan.role_execution)
    && draftChapterPlan.role_execution.length > 0;
  const hasManualPlotNotes = Boolean(String(draftChapterPlan.plot_notes || '').trim());
  const feedbackRoleExecution = buildFeedbackRoleExecution(draftChapterPlan);
  const libraryCharacters = (Array.isArray(planningState?.bookPlanning?.characters) ? planningState.bookPlanning.characters : [])
    .slice()
    .sort((left, right) => {
      const tierDiff = compareRoleTier(left?.role_tier, right?.role_tier);
      if (tierDiff !== 0) return tierDiff;
      return String(left?.name || '').localeCompare(String(right?.name || ''), 'zh-Hans-CN');
    });
  const libraryCharacterByKey = new Map(
    libraryCharacters.map((item) => [createRoleNameKey(item?.name || ''), item])
  );
  const libraryCharacterNames = libraryCharacters
    .map((item) => String(item?.name || '').trim())
    .filter(Boolean);
  const libraryCharacterNameSet = new Set(libraryCharacterNames.map(createRoleNameKey));
  const seenCharacterQuickReferenceKeys = new Set();
  const characterQuickReferenceEntries = [
    ...(Array.isArray(draftChapterPlan.appearing_roles) ? draftChapterPlan.appearing_roles : []),
    ...(Array.isArray(draftChapterPlan.role_execution) ? draftChapterPlan.role_execution.map((item) => item?.role || '') : []),
    ...feedbackRoleExecution.map((item) => item?.role || '')
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((roleName) => {
      const key = createRoleNameKey(roleName);
      if (!key || seenCharacterQuickReferenceKeys.has(key)) return false;
      seenCharacterQuickReferenceKeys.add(key);
      return true;
    })
    .map((roleName) => ({
      roleName,
      isLibraryExisting: libraryCharacterNameSet.has(createRoleNameKey(roleName)),
      roleTier: libraryCharacterByKey.get(createRoleNameKey(roleName))?.role_tier || ''
    }));

  const currentWorkbenchPath = getCurrentAppPathname();
  const isPromptManagerSurface = currentWorkbenchPath === '/prompts';
  const currentWorkbenchSurface = isPromptManagerSurface ? 'prompts' : 'workbench';
  const isEntryPath = currentWorkbenchPath === '/';

  if (!currentBook || isEntryPath) {
    return (
      <ProjectEntry
        books={books}
        loadingBooks={loadingBooks}
        error={error}
        createDraft={createDraft}
        createState={createState}
        onCreateDraftChange={updateCreateDraft}
        onCreateBook={handleCreateBook}
        onSelectBook={selectBookForSurface}
      />
    );
  }

  return (
    <main className="app-shell">
      {error ? <div className="global-banner is-error">{error}</div> : null}
      {loadingBooks ? <div className="global-banner">正在读取作品列表...</div> : null}
      {planningNotice ? (
        <StatusNotice
          kind={planningNotice.kind}
          title={planningNotice.title}
          text={planningNotice.text}
          className="mb-4"
        />
      ) : null}
      <>
          <section className="workbench-stage workbench-app-shell">
            <div className="workbench-worktop">
              <div className="workbench-surface-tabs" aria-label="当前作品区域切换">
                <button
                  type="button"
                  className={`workbench-surface-tab${currentWorkbenchSurface === 'workbench' ? ' is-active' : ''}`}
                  onClick={() => switchSurface('workbench')}
                  aria-current={currentWorkbenchSurface === 'workbench' ? 'page' : undefined}
                >
                  <span>章节创作</span>
                  <strong>创作台</strong>
                </button>
                <button
                  type="button"
                  className="workbench-surface-tab"
                  onClick={() => switchSurface('library')}
                >
                  <span>资料管理</span>
                  <strong>资料库</strong>
                </button>
              </div>
              <GlobalBar
                bookTitle={planningState?.currentBook?.title || currentBook?.title || ''}
                volumeLabel={chapterView.volumeLabel || '第 1 卷'}
                chapterNumber={chapterNumber}
                chapterName={normalizeChapterName(draftChapterPlan.chapter_name)}
                mainStorylineLabel={chapterView.mainStoryline}
                totalChapterCount={chapterContext.totalChapterCount}
                chapterListItems={chapterContext.chapterListItems}
                onPrevChapter={goToPreviousChapter}
                onNextChapter={goToNextChapter}
                onSelectChapter={requestChapterChange}
                onSwitchBook={handleSwitchBook}
                showNavigation={false}
              />
            </div>
            <div className={`workbench-triple-pane${isPromptManagerSurface ? ' is-prompt-manager' : ''}`}>
              <div
                className="workbench-sidebar-hotzone"
                onMouseEnter={() => {
                  if (workbenchSidebarCollapsed) setWorkbenchSidebarPeek(true);
                }}
                aria-hidden="true"
              />
              <div className="workbench-triple-pane-left">
                <aside
                  className="workbench-sidebar-shell"
                  aria-label="创作台导航"
                  onMouseEnter={() => {
                    if (workbenchSidebarCollapsed) setWorkbenchSidebarPeek(true);
                  }}
                  onMouseLeave={() => {
                    if (workbenchSidebarCollapsed) setWorkbenchSidebarPeek(false);
                  }}
                >
                  <div className="workbench-sidebar-config">
                    <section className="workbench-nav-section">
                      <div className="workbench-nav-section-head">
                        <MetaCode>BOOK</MetaCode>
                      </div>
                      <WorkbenchNavSelect
                        label="书籍"
                        valueLabel={currentBookTitle}
                        items={bookSelectItems}
                        onSelect={(bookId) => selectBookForSurface(bookId, 'workbench')}
                      />
                      <button
                        type="button"
                        className="workbench-nav-link"
                        onClick={() => switchSurface('library')}
                      >
                        资料库
                      </button>
                    </section>

                    <section className="workbench-nav-section">
                      <div className="workbench-nav-section-head">
                        <MetaCode>CHAPTERS</MetaCode>
                        <span>{chapterNumber} / {chapterContext.totalChapterCount || '?'}</span>
                      </div>
                      <WorkbenchNavSelect
                        label="卷"
                        valueLabel={currentVolumeSelectLabel}
                        items={volumeSelectItems}
                        onSelect={handleVolumeNavigationChange}
                      />
                      <WorkbenchNavSelect
                        label="章"
                        valueLabel={currentChapterSelectLabel}
                        items={chapterSelectItems}
                        onSelect={requestChapterChange}
                      />
                      <div className="workbench-nav-chapter-switch">
                        <button
                          type="button"
                          onClick={goToPreviousChapter}
                          disabled={chapterNumber <= 1}
                        >
                          上一章
                        </button>
                        <button type="button" onClick={goToNextChapter}>
                          下一章
                        </button>
                      </div>
                      <button
                        type="button"
                        className="workbench-nav-link workbench-nav-link-danger"
                        onClick={handleDeleteCurrentChapter}
                        disabled={chapterDeleteLoading}
                      >
                        {chapterDeleteLoading ? '删除正文中...' : '删除正文'}
                      </button>
                      <div className="workbench-entry-mode">
                        <button
                          type="button"
                          className="workbench-entry-mode-trigger"
                          onClick={() => setChapterEntryMenuOpen((open) => !open)}
                        >
                          <span>设置默认显示章节</span>
                          <strong>{currentChapterEntryModeItem.label}</strong>
                        </button>
                        {chapterEntryMenuOpen ? (
                          <div className="workbench-entry-mode-menu">
                            {chapterEntryModeItems.map((item) => (
                              <button
                                type="button"
                                key={item.value}
                                className={chapterEntryMode === item.value ? 'is-active' : ''}
                                onClick={() => {
                                  setChapterEntryMode(item.value);
                                  setChapterEntryMenuOpen(false);
                                }}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </section>
                  </div>
                </aside>
              </div>
              <div className="workbench-triple-pane-center">
                {isPromptManagerSurface ? (
                  <div className="prompt-manager-modal-backdrop" role="presentation" onMouseDown={() => switchSurface('library')}>
                    <div
                      className="prompt-manager-modal-panel"
                      role="dialog"
                      aria-modal="true"
                      aria-label="Prompt 管理"
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <button type="button" className="ghost-btn prompt-manager-modal-close" onClick={() => switchSurface('library')}>
                        关闭
                      </button>
                      <PromptManagerPage
                        bookTitle={planningState?.currentBook?.title || currentBook?.title || ''}
                        chapterNumber={chapterNumber}
                        loading={promptManagerState.loading}
                        error={promptManagerState.error}
                        entries={promptManagerState.entries}
                        updatedAt={promptManagerState.updatedAt}
                        onRefresh={handleRefreshPromptManager}
                      />
                    </div>
                  </div>
                ) : (
                <ContentWorkspace
              chapterConfigPanel={
                <ChapterConfigPanel
                  sectionMode="config"
                  draftChapterPlan={draftChapterPlan}
                  chapterView={chapterView}
                  storylineOptions={storylineOptions}
                  selectedTargetStorylines={selectedTargetStorylines}
                  storylineRhythmHints={storylineRhythmHints}
                  savingState={savingState}
                  selectedBookId={selectedBookId}
                  onSaveChapterPlan={handleSaveMountedStorylines}
                  onOpenOutlineModal={() => setChapterModal('outline')}
                  onOpenCharacterModal={openCharacterEditor}
                  onOpenStorylineCreator={openStorylineCreator}
                  onOpenStorylineEditor={openStorylineEditor}
                  onClearStorylineSelection={clearStorylineSelection}
                  onToggleTargetStoryline={toggleTargetStoryline}
                  onAdjustStorylineRange={adjustStorylineRange}
                  onContextChipClick={handleContextChipClick}
                  activeDrawer={activeDrawer}
                />
              }
              chapterNumber={chapterNumber}
              draftChapterPlan={draftChapterPlan}
              chapterContext={chapterContext}
              generationRiskReview={generationRiskReview}
              generationReadiness={generationReadiness}
              generationRequiredItems={generationRequiredItems}
              generationRecommendedItems={generationRecommendedItems}
              generationChecklistItems={generationChecklistItems}
              canGenerate={canGenerate}
              generationState={generationState}
              isGenerating={isGenerating}
              loadingChapter={loadingChapter}
              onGenerateChapter={handleGenerateWithGuards}
              onStopGeneration={handleStopGeneration}
              onSaveGenerationSettings={handleSaveGenerationSettings}
              onOpenRevisionEditor={openRevisionEditor}
              onSetPromptPreview={() => setPromptPreviewOpen(true)}
              onPrevChapter={goToPreviousChapter}
              onNextChapter={goToNextChapter}
              onChapterNumberChange={requestChapterChange}
              onUpdateGenerationSetting={updateGenerationSetting}
              onContextChipClick={handleContextChipClick}
              onOpenOutlineModal={() => setChapterModal('outline')}
              onOpenCharacterModal={openCharacterEditor}
              onOpenStorylinePicker={() => setChapterModal('storyline-picker')}
            />
                )}
              </div>
              {isPromptManagerSurface ? null : (
              <div className="workbench-triple-pane-right">
                {/* 作品概要 - Book Summary Card */}
                <div className="workbench-info-card">
                  <h3 className="workbench-info-card-title">作品概要</h3>
                  <div className="workbench-info-card-body">
                    <div className="workbench-info-row"><span className="workbench-info-label">书名</span><strong>{currentBook?.title || '未选择'}</strong></div>
                    <div className="workbench-info-row"><span className="workbench-info-label">作者</span><strong>{currentBook?.author || '—'}</strong></div>
                    <div className="workbench-info-row"><span className="workbench-info-label">总字数</span><strong>{formatExactWordCount(currentBook?.totalWordCount || 0)}</strong></div>
                    <div className="workbench-info-row"><span className="workbench-info-label">章节</span><strong>{chapterContext.existingChapterCount || 0}</strong></div>
                  </div>
                </div>

                {/* 人物速查 - Character Quick Reference */}
                <div className="workbench-info-card">
                  <button type="button" className="workbench-info-card-title workbench-info-card-edit" onClick={openCharacterEditor}>
                    <span>人物速查</span><em>{!hasManualCharacterQuickReference && characterFeedbackSummary ? 'AI 回顾 · 修改' : '修改'}</em>
                  </button>
                  <div className="workbench-info-card-body">
                    {characterQuickReferenceEntries.length > 0
                      ? characterQuickReferenceEntries.map((item, i) => (
                          <div
                            key={i}
                            className={`workbench-info-character workbench-info-character-name-only${item.isLibraryExisting ? ' is-library-existing' : ' is-chapter-new'}`}
                          >
                            <div className="workbench-info-character-head">
                              <strong>{item.roleName || '角色' + (i+1)}</strong>
                              {item.roleTier ? (
                                <span className={`workbench-role-tier-badge ${getRoleTierTone(item.roleTier)}`}>
                                  {getRoleTierShortLabel(item.roleTier)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ))
                      : characterFeedbackSummary
                        ? <div className="workbench-info-character"><strong>AI 人物进展</strong><p>{characterFeedbackSummary}</p></div>
                        : <p className="workbench-info-empty">暂无角色信息</p>
                    }
                  </div>
                </div>

                {/* 情节笔记 - Plot Notes */}
                <div className="workbench-info-card">
                  <button type="button" className="workbench-info-card-title workbench-info-card-edit" onClick={openPlotEditor}>
                    <span>情节笔记</span><em>{!hasManualPlotNotes && plotFeedbackSummary ? 'AI 回顾 · 修改' : '修改'}</em>
                  </button>
                  <div className="workbench-info-card-body">
                    <p className="workbench-info-note">{draftChapterPlan.plot_notes || plotFeedbackSummary || '暂无情节修订'}</p>
                  </div>
                </div>
              </div>
              )}
            </div>
          </section>
        </>
      {createBookModalOpen ? (
        <Modal
          title="新建书籍"
          description="填完基础信息就能保存。"
          onClose={() => {
            if (!createState.loading) setCreateBookModalOpen(false);
          }}
          actions={
            <>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setCreateBookModalOpen(false)}
                disabled={createState.loading}
              >
                取消
              </button>
              <button
                type="submit"
                form="workbench-create-book-form"
                className="solid-btn"
                disabled={createState.loading}
              >
                {createState.loading ? '正在创建...' : '创建新书'}
              </button>
            </>
          }
        >
          <form id="workbench-create-book-form" className="workbench-book-editor-form" onSubmit={handleCreateBook}>
            {createState.error ? <div className="global-banner is-error">{createState.error}</div> : null}
            <label className="editor-field editor-field-full">
              <span>书名</span>
              <input
                value={createDraft.title}
                onChange={(event) => updateCreateDraft('title', event.target.value)}
                placeholder="输入书名"
              />
            </label>
            <div className="workbench-book-editor-grid">
              <label className="editor-field">
                <span>题材</span>
                <select
                  value={createDraft.genre}
                  onChange={(event) => {
                    updateCreateDraft('genre', event.target.value);
                    updateCreateDraft('subgenre', '');
                  }}
                >
                  {genreOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="editor-field">
                <span>子分类</span>
                <select
                  value={createDraft.subgenre}
                  onChange={(event) => updateCreateDraft('subgenre', event.target.value)}
                >
                  <option value="">未细分</option>
                  {getSubgenreOptions(createDraft.genre).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="editor-field editor-field-full">
              <span>作者</span>
              <input
                value={createDraft.author}
                onChange={(event) => updateCreateDraft('author', event.target.value)}
                placeholder="可选"
              />
            </label>
            <label className="editor-field editor-field-full">
              <span>简介</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={createDraft.description}
                onChange={(event) => updateCreateDraft('description', event.target.value)}
                placeholder="一句话写下故事核心"
              />
            </label>
          </form>
        </Modal>
      ) : null}
      <ContextDrawer
        open={activeDrawer === 'outline'}
        title="章节细纲"
        onClose={handleCloseDrawer}
      >
        <div className="drawer-detail-stack">
          <section className="drawer-detail-card">
            <div className="drawer-detail-actions">
              <MetaCode>SUMMARY</MetaCode>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  handleCloseDrawer();
                  setChapterModal('outline');
                }}
              >
                编辑规划
              </button>
            </div>
            <IndentedTextBlock
              text={drawerOutlineText}
              className="mt-3"
              paragraphClassName="cn-text-paragraph text-[15px] leading-8 text-[color:var(--text)]"
            />
          </section>
        </div>
      </ContextDrawer>
      <ContextDrawer
        open={activeDrawer === 'character-config'}
        title="角色相关配置"
        onClose={handleCloseDrawer}
      >
        <div className="drawer-detail-stack">
          <section className="drawer-detail-card">
            <div className="drawer-detail-actions">
              <MetaCode>NOTES</MetaCode>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  handleCloseDrawer();
                  openCharacterEditor();
                }}
              >
                编辑角色
              </button>
            </div>
            <p className="mt-3 break-words text-[15px] leading-8 text-[color:var(--muted)]">
              {draftChapterPlan.character_notes || '还没有角色说明。'}
            </p>
          </section>
          {Array.isArray(draftChapterPlan.role_execution) && draftChapterPlan.role_execution.length > 0 ? (
            <section className="drawer-detail-card">
              <MetaCode>ROLE EXECUTION</MetaCode>
              <div className="mt-3 grid gap-3">
                {draftChapterPlan.role_execution.map((item, index) => (
                  <section
                    key={`${item.role || 'role'}-${index}`}
                    className="drawer-inline-item"
                  >
                    <MetaCode>ROLE {String(index + 1).padStart(2, '0')}</MetaCode>
                    <p className="mt-2 break-words text-[14px] leading-7 text-[color:var(--text)]">
                      <strong>{item.role || '未命名角色'}：</strong>
                      {item.background || item.chapter_function || item.personality || item.baseline || '角色资料待补充'}
                    </p>
                    <p className="mt-1 break-words text-[13px] leading-6 text-[color:var(--muted)]">
                      {describeRoleExecutionMeta(item)}
                    </p>
                  </section>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </ContextDrawer>
      <ContextDrawer
        open={activeDrawer === 'book'}
        title="📖 全书设定"
        onClose={handleCloseDrawer}
      >
        <BookSettingDrawer book={planningState?.currentBook} />
      </ContextDrawer>
      <ContextDrawer
        open={activeDrawer === 'storyline'}
        title="🗺 叙事脉络"
        onClose={handleCloseDrawer}
      >
        <StorylineDrawer
          storylines={storylineOptions}
          mainStorylineId={draftChapterPlan.main_storyline_id}
          targetStorylineIds={draftChapterPlan.target_storylines}
          currentChapter={chapterNumber}
        />
      </ContextDrawer>
      <ContextDrawer
        open={activeDrawer === 'character'}
        title="👤 角色档案"
        onClose={handleCloseDrawer}
      >
        <CharacterDrawer
          characters={planningState?.bookPlanning?.characters || []}
          appearingRoles={draftChapterPlan.appearing_roles}
        />
      </ContextDrawer>
      <ContextDrawer
        open={activeDrawer === 'volume'}
        title="📚 分卷"
        onClose={handleCloseDrawer}
      >
        <VolumeDrawer
          volumePlans={planningState?.bookPlanning?.volumePlans || []}
          currentVolumeNumber={draftChapterPlan.volume_number}
        />
      </ContextDrawer>

      {chapterModal === 'outline' ? (
        <Modal
          title={'第 ' + chapterNumber + ' 章章节细纲'}
          description="用一段连贯的剧情摘要写清本章从开头到结尾具体发生什么。"
          onClose={() => setChapterModal(null)}
          actions={
            <>
              {savingState.error ? <div className="modal-error">{savingState.error}</div> : null}
              <button type="button" className="ghost-btn" onClick={() => setChapterModal(null)}>取消</button>
              <button type="button" className="solid-btn" onClick={handleSaveChapterOutline} disabled={savingState.loading}>
                {savingState.loading ? '正在保存...' : '保存细纲'}
              </button>
            </>
          }
        >
          <div className="chapter-task-editor">
            <section className="chapter-outline-heading-row editor-field-full">
              <label className="editor-field chapter-outline-title-field">
                <span>章节名</span>
                <input
                  className="chapter-number-input text-input"
                  value={normalizeChapterName(draftChapterPlan.chapter_name)}
                  onChange={(event) => updateDraftChapterPlanField('chapter_name', event.target.value)}
                />
              </label>
              <div className="chapter-outline-ai-actions">
                {chapterOutlineGenerationState.error ? <span>{chapterOutlineGenerationState.error}</span> : null}
                <button
                  type="button"
                  className="solid-btn"
                  onClick={handleGenerateCurrentChapterOutline}
                  disabled={chapterOutlineGenerationState.loading}
                >
                  {chapterOutlineGenerationState.loading ? '正在生成细纲...' : 'AI 生成当前章细纲'}
                </button>
              </div>
            </section>
            <label className="editor-field editor-field-full">
              <span>章节细纲</span>
              <textarea
                className="modal-textarea modal-textarea-longform"
                value={draftChapterPlan.outline_text || ''}
                onChange={(event) => updateDraftChapterPlanField('outline_text', event.target.value)}
                placeholder="按剧情发生顺序概括本章：如何承接前文、发生哪些关键事件、人物如何行动、局面如何变化，以及本章最终停在哪里。"
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
              <button type="button" className="ghost-btn" onClick={() => handleSaveChapterCharacters(true)} disabled={savingState.loading || isGenerating}>
                保存并重生成本章
              </button>
              <button type="button" className="solid-btn" onClick={() => handleSaveChapterCharacters(false)} disabled={savingState.loading}>
                {savingState.loading ? '正在保存...' : '仅保存角色设置'}
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
              <div className="chapter-character-panel">
                <div className="chapter-character-panel-copy">
                  <span className="chapter-character-panel-eyebrow">章节角色执行层</span>
                  <strong>先挂载已有角色，再补充本章临时人物</strong>
                  <small>这里只保留本章真的会出场、会影响推进的人物。</small>
                </div>
                <div className="chapter-character-toolbar">
                  <label className="chapter-character-picker">
                    <span>从资料库挂载</span>
                    <select
                      value={selectedLibraryCharacterName}
                      onChange={(event) => setSelectedLibraryCharacterName(event.target.value)}
                    >
                      <option value="">选择角色</option>
                      {libraryCharacters.map((character) => (
                        <option key={character.id || character.name} value={character.name || ''}>
                          {`${getRoleTierShortLabel(character.role_tier)} · ${character.name || '未命名角色'}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="ghost-btn" onClick={addLibraryCharacterToChapter} disabled={!selectedLibraryCharacterName}>
                    加入本章
                  </button>
                  <button type="button" className="ghost-btn" onClick={addRoleExecutionItem}>手动添加</button>
                </div>
              </div>
              <div className="role-execution-editor-head">
                <strong>本章已加入角色</strong>
                <span>{Array.isArray(draftChapterPlan.role_execution) ? draftChapterPlan.role_execution.length : 0} 人</span>
              </div>
              <div className="role-execution-editor">
                {(Array.isArray(draftChapterPlan.role_execution) ? draftChapterPlan.role_execution : []).map((item, index) => (
                  <article key={`role-execution-${index}`} className="role-execution-editor-item">
                    <div className="role-execution-editor-item-head">
                      <div className="role-execution-item-head">
                        <strong>{item.role || `人物 ${index + 1}`}</strong>
                        {libraryCharacterByKey.get(createRoleNameKey(item.role || ''))?.role_tier ? (
                          <span className={`workbench-role-tier-badge ${getRoleTierTone(libraryCharacterByKey.get(createRoleNameKey(item.role || ''))?.role_tier)}`}>
                            {getRoleTierShortLabel(libraryCharacterByKey.get(createRoleNameKey(item.role || ''))?.role_tier)}
                          </span>
                        ) : null}
                      </div>
                      <button type="button" className="ghost-btn" onClick={() => removeRoleExecutionItem(index)}>移除</button>
                    </div>
                    <label className="editor-field">
                      <span>人物名</span>
                      <input
                        list={`chapter-role-library-${index}`}
                        value={item.role || ''}
                        onChange={(event) => updateRoleExecutionField(index, 'role', event.target.value)}
                      />
                      <datalist id={`chapter-role-library-${index}`}>
                        {libraryCharacters.map((character) => (
                          <option key={character.id || character.name} value={character.name || ''}>
                            {getRoleTierShortLabel(character.role_tier)}
                          </option>
                        ))}
                      </datalist>
                    </label>
                    <label className="editor-field"><span>核心性格</span><textarea className="modal-textarea modal-textarea-compact" value={item.personality || item.baseline || ''} onChange={(event) => updateRoleExecutionField(index, 'personality', event.target.value)} placeholder="长期稳定的性格底色" /></label>
                    <label className="editor-field"><span>身份背景</span><textarea className="modal-textarea modal-textarea-compact" value={item.background || item.chapter_function || ''} onChange={(event) => updateRoleExecutionField(index, 'background', event.target.value)} placeholder="出身、阵营、身份位置" /></label>
                    <label className="editor-field"><span>外形标记</span><textarea className="modal-textarea modal-textarea-compact" value={item.appearance || item.appearance_marker || ''} onChange={(event) => updateRoleExecutionField(index, 'appearance', event.target.value)} placeholder="最有辨识度的外观特征" /></label>
                  </article>
                ))}
                {(!Array.isArray(draftChapterPlan.role_execution) || draftChapterPlan.role_execution.length === 0) ? (
                  <p className="excerpt-text">还没有本章人物，点击“添加人物”建立速查资料。</p>
                ) : null}
              </div>
            </section>
          </div>
        </Modal>
      ) : null}

      {chapterModal === 'plot' ? (
        <Modal
          title={'编辑第 ' + chapterNumber + ' 章情节笔记'}
          description="记录本章必须遵守的事实、因果和修订方向，保存后会参与下一次生成。"
          onClose={() => setChapterModal(null)}
          actions={
            <>
              {savingState.error ? <div className="modal-error">{savingState.error}</div> : null}
              <button type="button" className="ghost-btn" onClick={() => setChapterModal(null)}>取消</button>
              <button type="button" className="ghost-btn" onClick={() => handleSaveChapterPlot(true)} disabled={savingState.loading || isGenerating}>保存并重生成本章</button>
              <button type="button" className="solid-btn" onClick={() => handleSaveChapterPlot(false)} disabled={savingState.loading}>
                {savingState.loading ? '正在保存...' : '仅保存情节笔记'}
              </button>
            </>
          }
        >
          <textarea
            className="modal-textarea"
            rows={10}
            value={draftChapterPlan.plot_notes || ''}
            onChange={(event) => updateDraftChapterPlanField('plot_notes', event.target.value)}
            placeholder="例如：角色此处已经知道真相；时间线必须发生在雨夜；不能提前揭示幕后人物。"
          />
        </Modal>
      ) : null}

      {chapterModal === 'storyline-picker' ? (
        <Modal
          title={'选择第 ' + chapterNumber + ' 章叙事脉络'}
          description="当前卷主线由系统自动挂载；这里仅调整本章需要关联的支线。"
          onClose={() => setChapterModal(null)}
          actions={
            <>
              {savingState.error ? <div className="modal-error">{savingState.error}</div> : null}
              <button
                type="button"
                className="ghost-btn"
                onClick={clearStorylineSelection}
                disabled={!selectedBookId || selectedTargetStorylines.length === 0}
              >
                清空支线
              </button>
              <button type="button" className="ghost-btn" onClick={() => setChapterModal(null)}>取消</button>
              <button type="button" className="solid-btn" onClick={handleSaveMountedStorylines} disabled={savingState.loading}>
                {savingState.loading ? '正在保存...' : '保存叙事脉络选择'}
              </button>
            </>
          }
        >
          <div className="storyline-picker-modal">
            <ChapterConfigPanel
              sectionMode="config"
              draftChapterPlan={draftChapterPlan}
              chapterView={chapterView}
              storylineOptions={storylineOptions}
              selectedTargetStorylines={selectedTargetStorylines}
              storylineRhythmHints={storylineRhythmHints}
              savingState={savingState}
              selectedBookId={selectedBookId}
              onSaveChapterPlan={handleSaveMountedStorylines}
              onOpenOutlineModal={() => setChapterModal('outline')}
              onOpenCharacterModal={openCharacterEditor}
              onOpenStorylineCreator={openStorylineCreator}
              onOpenStorylineEditor={openStorylineEditor}
              onClearStorylineSelection={clearStorylineSelection}
              onToggleTargetStoryline={toggleTargetStoryline}
              onAdjustStorylineRange={adjustStorylineRange}
              onContextChipClick={handleContextChipClick}
              activeDrawer={activeDrawer}
              showActionRow={false}
            />
          </div>
        </Modal>
      ) : null}

      {chapterModal === 'storyline' ? (
        <Modal
          title={draftStoryline.id ? '编辑叙事脉络' : '新建叙事脉络'}
          description={draftStoryline.id
            ? '调整这条叙事脉络的预计节奏和核心冲突。章节范围只作参考，不会强制限制使用。'
            : '先创建这本书的一条主线或支线，然后自动挂到当前章节。章节范围只作节奏参考，不会强制限制叙事脉络使用。'}
          onClose={() => setChapterModal(null)}
          actions={
            <>
              {savingState.error ? <div className="modal-error">{savingState.error}</div> : null}
              <button type="button" className="ghost-btn" onClick={() => setChapterModal(null)}>取消</button>
              <button type="button" className="solid-btn" onClick={handleSaveStoryline} disabled={savingState.loading}>
                {savingState.loading
                  ? '正在保存...'
                  : draftStoryline.id ? '保存叙事脉络' : '创建并挂到当前章节'}
              </button>
            </>
          }
        >
          <div className="storyline-editor-grid">
            <label className="editor-field editor-field-full">
              <span>脉络名称</span>
              <input
                className="chapter-number-input text-input"
                value={draftStoryline.storyline_name}
                onChange={(event) => updateDraftStorylineField('storyline_name', event.target.value)}
                placeholder="例如：血月之力暴露线"
              />
            </label>
            <label className="editor-field">
              <span>脉络类型</span>
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
                这里填的是预计活跃范围。后续如果剧情提前爆发、延后回收或需要拆分，可以再调整，不会卡住章节创作。
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
        <RevisionEditor
          chapterNumber={chapterNumber}
          revisionError={revisionError}
          revisionNotice={revisionNotice}
          revisionRequirement={revisionRequirement}
          setRevisionRequirement={setRevisionRequirement}
          revisionOriginal={revisionOriginal}
          revisionDraft={revisionDraft}
          revisionSuggestions={revisionSuggestions}
          revisionDiffRows={revisionDiffRows}
          revisionSummaryText={revisionSummaryText}
          generationState={generationState}
          revisionPolishing={revisionPolishing}
          revisionSaving={revisionSaving}
          revisionChangeItems={revisionChangeItems}
          revisionCurrentChange={revisionCurrentChange}
          revisionCurrentFocusIndex={revisionCurrentFocusIndex}
          revisionOriginalParagraphs={revisionOriginalParagraphs}
          revisionSuggestionMarks={revisionSuggestionMarks}
          revisionAppliedChangeKeys={revisionAppliedChangeKeys}
          onClose={() => setResultModalOpen(false)}
          onPolish={handlePolishRevision}
          onSave={handleSaveRevision}
          onFocusRevisionChange={focusRevisionChange}
          onApplyRevisionSuggestion={applyRevisionSuggestion}
          registerRevisionChangeRef={registerRevisionChangeRef}
          registerRevisionParagraphRef={registerRevisionParagraphRef}
        />
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
              <span>章节细纲</span>
              <pre className="modal-pre">
                {[
                  '章名：' + (normalizeChapterName(draftChapterPlan.chapter_name) || '未命名章节'),
                  '章节细纲：' + (drawerOutlineText || '暂无填写')
                ].join('\n')}
              </pre>
            </section>
            <section className="outline-preview-block">
              <span>叙事脉络承接</span>
              <pre className="modal-pre">
                {[
                  '当前卷主线：' + selectedMainStorylineLabel,
                  '关联脉络：' + selectedTargetStorylineLabel,
                  '节奏提示：' + (storylineRhythmHints.length > 0 ? storylineRhythmHints.map((hint) => '- ' + hint.text).join(' | ') : '暂无挂接叙事脉络')
                ].join('\n')}
              </pre>
            </section>
            {distinctOutlineText ? (
              <section className="outline-preview-block">
                <span>章节细纲</span>
                <pre className="modal-pre">{distinctOutlineText}</pre>
              </section>
            ) : null}
            <section className="outline-preview-block">
              <span>本章角色</span>
              <pre className="modal-pre">
                {[
                  draftChapterPlan.character_notes || '暂无补充本章角色说明。',
                  '',
                  '本章角色速查：',
                  Array.isArray(draftChapterPlan.role_execution) && draftChapterPlan.role_execution.length > 0
                    ? draftChapterPlan.role_execution.map((item) => `- ${item.role || '未命名角色'}｜${describeRoleExecutionMeta(item)}`).join('\n')
                    : '- 暂无角色资料'
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
