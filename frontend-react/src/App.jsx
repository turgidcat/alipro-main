import { useEffect, useRef, useState } from 'react';
import {
  breakdownChapterOutline,
  createBook,
  fetchChapterSetupBundle,
  generateChapterContent,
  generateChapterFeedback,
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
  composeStructuredOutline,
  describeRoleExecutionMeta,
  buildGenerationRiskReview,
  getPlanWordCount,
  hasMountedStorylineAnchor,
  hasUsableChapterOutline,
  prepareOutlineModalPlan,
  withStructuredChapterPlan,
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
import Modal from './components/workbench/Modal.jsx';
import './workbench-layout.css';
import GlobalBar from './components/workbench/GlobalBar.jsx';
import ChapterConfigPanel from './components/workbench/ChapterConfigPanel.jsx';
import ContentWorkspace from './components/workbench/ContentWorkspace.jsx';
import RevisionEditor from './components/workbench/RevisionEditor.jsx';
import StatusNotice from './components/workbench/StatusNotice.jsx';
import ContextDrawer from './components/workbench/ContextDrawer.jsx';
import MetaCode from './components/workbench/MetaCode.jsx';
import IndentedTextBlock from './components/IndentedTextBlock.jsx';
import ThemePopover from './components/theme/ThemePopover.jsx';
import ProjectEntry from './components/app/ProjectEntry.jsx';
import BookSettingDrawer from './components/workbench/drawers/BookSettingDrawer.jsx';
import StorylineDrawer from './components/workbench/drawers/StorylineDrawer.jsx';
import CharacterDrawer from './components/workbench/drawers/CharacterDrawer.jsx';
import VolumeDrawer from './components/workbench/drawers/VolumeDrawer.jsx';
import { useWorkbench } from './hooks/useWorkbench.js';

function countPlatformEffectiveWords(value) {
  const text = String(value || '')
    .replace(/\uFFFD+/g, '')
    .replace(/�+/g, '')
    .trim()
    .replace(/[\s\p{Punctuation}\p{Symbol}]/gu, '');
  return Array.from(text).length;
}

const DRAWER_MEMORY_PREFIX = 'alipro-workbench-drawer';
const RECENT_WORKSPACE_PAGE_KEY = 'alipro-recent-workspace-page';

const bookStatusLabels = {
  writing: '连载中',
  completed: '已完结',
  paused: '暂停中',
  draft: '草稿'
};

function getStoredWorkspacePage() {
  try {
    const stored = window.localStorage.getItem(RECENT_WORKSPACE_PAGE_KEY);
    return stored === 'workbench' ? 'workbench' : 'library';
  } catch (_) {
    return 'library';
  }
}

function persistWorkspacePage(page) {
  try {
    window.localStorage.setItem(RECENT_WORKSPACE_PAGE_KEY, page === 'workbench' ? 'workbench' : 'library');
  } catch (_) {}
}

function syncAppPath(page, replace = false, bookId = '') {
  if (typeof window === 'undefined') return;
  const safeBookId = bookId ? encodeURIComponent(bookId) : '';
  const pathname =
    page === 'workbench'
      ? '/workbench'
      : page === 'library'
        ? safeBookId ? `/books/${safeBookId}` : '/books'
        : '/';
  if (pathname.startsWith('/books')) {
    window.location.href = pathname;
    return;
  }
  if (window.location.pathname === pathname) return;
  const nextUrl = `${pathname}${window.location.search || ''}${window.location.hash || ''}`;
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
      label: '剧情线选择',
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
    genre: '都市异能',
    author: '',
    description: ''
  });
  const [createState, setCreateState] = useState({ loading: false, error: '' });
  const [outlineDraftText, setOutlineDraftText] = useState('');
  const [outlineBreakdownState, setOutlineBreakdownState] = useState({ loading: false, error: '' });
  const [chapterEntryMenuOpen, setChapterEntryMenuOpen] = useState(false);
  const outlineDraftModalKeyRef = useRef('');

  useEffect(() => {
    if (!workbenchSidebarCollapsed) {
      setWorkbenchSidebarPeek(false);
    }
  }, [workbenchSidebarCollapsed]);

  useEffect(() => {
    if (chapterModal !== 'outline') {
      outlineDraftModalKeyRef.current = '';
      return;
    }
    const modalKey = `${selectedBookId || ''}:${Number(chapterNumber || 1)}`;
    if (outlineDraftModalKeyRef.current === modalKey) return;
    setOutlineDraftText(buildOutlineDraftTextFromPlan(draftChapterPlan));
    setOutlineBreakdownState({ loading: false, error: '' });
    outlineDraftModalKeyRef.current = modalKey;
  }, [chapterModal, selectedBookId, chapterNumber, draftChapterPlan]);

  function switchSurface(page, bookId = selectedBookId || currentBook?.id || '') {
    const nextPage = page === 'workbench' ? 'workbench' : 'library';
    setActiveSurface(nextPage);
    persistWorkspacePage(nextPage);
    syncAppPath(nextPage, false, bookId);
  }

  function selectBookForSurface(bookId, page = 'library') {
    if (!bookId) return;
    persistBookContext(bookId);
    setSelectedBookId(bookId);
    switchSurface(page, bookId);
  }

  function handleSwitchBook() {
    persistBookContext('');
    setSelectedBookId('');
    syncAppPath('entry', true);
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
        genre: createDraft.genre.trim() || '都市异能',
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
        genre: '都市异能',
        author: '',
        description: ''
      });
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
      successText: draftChapterPlan.main_storyline_id
        ? '剧情线挂载和本章主推都已写回，可以继续生成或切到下一章。'
        : '剧情线挂载已写回；如果想让这章主线更明确，建议再点一次“本章主推”。',
      failureTitle: '保存本章挂载失败'
    });
  }

  async function handleSaveChapterCharacters() {
    await persistCurrentChapterPlan({
      plan: prepareOutlineModalPlan(draftChapterPlan),
      successTitle: '本章角色已保存',
      successText: '角色说明已写回当前章节，可以继续生成或打开校改。',
      failureTitle: '保存本章角色失败',
      closeModal: true
    });
  }

  async function handleSaveChapterOutline() {
    await persistCurrentChapterPlan({
      plan: prepareOutlineModalPlan(draftChapterPlan),
      successTitle: '章节细纲已保存',
      successText: '本章目标、关键场景、冲突升级和结尾钩子已写回。',
      failureTitle: '保存章节细纲失败',
      closeModal: true
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
      const normalizedPlan = withStructuredChapterPlan(
        draftChapterPlan,
        draftChapterPlan.chapter_structure || emptyChapterStructure
      );
      const chapterStructure = normalizedPlan.chapter_structure || emptyChapterStructure;
      const chapterTitle = draftChapterPlan.chapter_name
        ? `第 ${chapterNumber} 章 ${draftChapterPlan.chapter_name}`
        : `第 ${chapterNumber} 章`;
      const cycleResult = await handlePersistChapterResult({
        content: nextContent,
        normalizedPlan,
        chapterStructure,
        chapterTitle,
        targetWordCount: getPlanWordCount(normalizedPlan),
        successTitle: '正文已校改',
        successText: '校改后的正文、摘要和质量检查都已写回。'
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
      pushPlanningNotice(
        'success',
        draftStoryline.id ? '剧情线已保存' : '剧情线已创建并挂到当前章节',
        draftStoryline.id
          ? '剧情线范围和核心冲突已更新。'
          : '新剧情线已自动挂到当前章节；如果这章主要推进它，记得点“本章主推”。'
      );
    } catch (saveError) {
      setSavingState({ loading: false, error: saveError.message });
      pushPlanningNotice('error', draftStoryline.id ? '保存剧情线失败' : '创建剧情线失败', saveError.message);
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

    if (missingRequiredItems.length > 0) {
      setGenerationState({
        ...generationState,
        statusKind: 'warning',
        statusTitle: '缺少章节必填信息',
        statusText: `请先补齐：${missingRequiredItems.map((item) => item.label).join('、')}。`
      });
      return;
    }

    setIsGenerating(true);
    setPlanningNotice(null);
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
          constraintBrief: ''
        },
        promptType: 'chapter'
      };
      let streamedContent = '';
      let response = null;
      try {
        response = await streamChapterContent(generationPayload, {
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
              statusText: `已实时接收约 ${effectiveWordCount} 有效字，生成完成后会继续写回摘要、质检和剧情线进度。`,
              wordCountLabel: `生成中约 ${effectiveWordCount} 有效字 / 目标 ${targetWordCount} 字`,
              previewText: safeNextContent.replace(/\s+/g, ' ').slice(0, 520)
            }));
            setRevisionDraft(safeNextContent);
          }
        });
      } catch (streamError) {
        if (streamedContent) {
          throw streamError;
        }
        pushPlanningNotice('warning', '流式生成不可用，已切换同步生成', streamError.message);
        response = await generateChapterContent(generationPayload);
      }
      const content = response?.content || response?.text || response || '';
      const cycleResult = await handlePersistChapterResult({
        content,
        normalizedPlan,
        chapterStructure,
        chapterTitle,
        targetWordCount,
        successTitle: '正文已生成',
        successText: '正文、摘要和质量检查都已写回，下一章会自动读取这份承接信息。',
        generationAudit: response?.metadata?.continuityAudit || response?.audit?.audit || null,
        openResultModal: true
      });
      pushPlanningNotice(
        cycleResult.nextGenerationState.statusKind,
        cycleResult.nextGenerationState.statusTitle,
        cycleResult.nextGenerationState.statusText
      );
    } catch (generateError) {
      pushPlanningNotice('error', '生成失败', generateError.message);
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

  function buildOutlineDraftTextFromPlan(plan = {}) {
    const savedOutline = String(plan.outline_text || '').trim();
    if (savedOutline) return savedOutline;
    return composeStructuredOutline(plan.chapter_structure || emptyChapterStructure).trim();
  }

  async function handleBreakdownChapterOutline() {
    const source = String(outlineDraftText || '').trim();
    if (!source) {
      setOutlineBreakdownState({ loading: false, error: '请先输入一段章节细纲。' });
      return;
    }

    setOutlineBreakdownState({ loading: true, error: '' });
    try {
      const result = await breakdownChapterOutline({
        outlineText: source,
        chapterTitle: draftChapterPlan.chapter_name
          ? `第 ${chapterNumber} 章 ${draftChapterPlan.chapter_name}`
          : `第 ${chapterNumber} 章`
      });
      setDraftChapterPlan((prev) => {
        const nextStructure = {
          ...(prev.chapter_structure || emptyChapterStructure),
          chapter_goal: String(result.chapter_goal || '').trim(),
          key_scenes: String(result.key_scenes || '').trim(),
          conflict_escalation: String(result.conflict_escalation || '').trim(),
          ending_hook: String(result.ending_hook || '').trim()
        };
        return withStructuredChapterPlan(prev, nextStructure);
      });
      setOutlineBreakdownState({ loading: false, error: '' });
    } catch (breakdownError) {
      setOutlineBreakdownState({
        loading: false,
        error: breakdownError.message || 'AI 拆解细纲失败。'
      });
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
  const drawerOutlineText = String(
    draftChapterPlan.outline_text
    || composeStructuredOutline(chapterStructure)
    || draftChapterPlan.summary
    || ''
  ).trim() || '尚未建立章节细纲。';
  const generationRequiredItems = [
    { key: 'goal', label: '本章目标', value: chapterStructure.chapter_goal },
    { key: 'scenes', label: '关键场景', value: chapterStructure.key_scenes },
    { key: 'conflict', label: '冲突升级', value: chapterStructure.conflict_escalation },
    { key: 'ending', label: '结尾钩子', value: chapterStructure.ending_hook || draftChapterPlan.ending_hook }
  ];
  const generationRecommendedItems = [
    { key: 'storyline', label: '剧情线承接', value: selectedTargetStorylines.length > 0 ? selectedTargetStorylineLabel : '' }
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
        ? '本章目标、关键场景、冲突升级、结尾钩子已具备。'
        : '先点“编辑细纲”，补齐本章目标、关键场景、冲突升级、结尾钩子并保存。'
    },
    {
      key: 'storyline',
      label: '挂载剧情线（推荐）',
      done: hasStorylineAnchor,
      detail: hasStorylineAnchor
        ? (hasMainStoryline ? '已挂载，且已经指定本章主推。' : '已挂载；如需更明确推进，建议再点“本章主推”。')
        : '这一步不是硬性门槛，但先挂载剧情线，会更利于连续章节承接。'
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
        chapterName: draftChapterPlan.chapter_name,
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
  const currentLocalChapterNumber = getVolumeLocalChapterNumber(currentChapterNavigationItem || visibleVolumeChapters[0]);
  const currentChapterSelectLabel = `第 ${currentLocalChapterNumber} 章${draftChapterPlan.chapter_name ? ` · ${draftChapterPlan.chapter_name}` : ''}`;
  const chapterSelectItems = visibleVolumeChapters.map((item) => ({
    value: Number(item.chapterNumber || 1),
    label: `第 ${getVolumeLocalChapterNumber(item)} 章${item.chapterName ? ` · ${item.chapterName}` : ''}`,
    meta: `全书第 ${item.chapterNumber} 章`,
    status: item.status || 'empty',
    active: Number(item.chapterNumber || 0) === Number(chapterNumber)
  }));
  const currentBookTitle = planningState?.currentBook?.title || currentBook.title || '未选择书籍';
  const bookSelectItems = books.map((book) => ({
    value: book.id,
    label: book.title || '未命名作品',
    meta: getBookStatusLabel(book.status),
    active: book.id === currentBook.id
  }));
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
          title: '已经可以生成，但建议先挂剧情线',
          text: '当前任务表已满足生成条件；如果要让后续章节更稳承接，建议再挂 1 条剧情线。'
        }
      : !hasMainStoryline
        ? {
            kind: 'warning',
            title: '可以生成，但建议指定本章主推',
            text: '已挂载剧情线，不过还没标明这章主要推进哪条线；点“本章主推”会更清楚。'
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

  const isEntryPath = typeof window !== 'undefined' && window.location.pathname === '/';

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
                  className="workbench-surface-tab is-active"
                  onClick={() => switchSurface('workbench')}
                  aria-current="page"
                >
                  <span>WORKBENCH</span>
                  <strong>创作台</strong>
                </button>
                <button
                  type="button"
                  className="workbench-surface-tab"
                  onClick={() => switchSurface('library')}
                >
                  <span>LIBRARY</span>
                  <strong>资料库</strong>
                </button>
              </div>
              <GlobalBar
                bookTitle={planningState?.currentBook?.title || currentBook.title || ''}
                volumeLabel={chapterView.volumeLabel || '第 1 卷'}
                chapterNumber={chapterNumber}
                chapterName={draftChapterPlan.chapter_name}
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
            <div className="workbench-dual-pane">
              <div
                className="workbench-sidebar-hotzone"
                onMouseEnter={() => {
                  if (workbenchSidebarCollapsed) setWorkbenchSidebarPeek(true);
                }}
                aria-hidden="true"
              />
              <div className="workbench-dual-pane-left">
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
                      <div className="workbench-nav-theme-control">
                        <MetaCode>THEME</MetaCode>
                        <ThemePopover triggerLabel="页面氛围" compact />
                      </div>
                    </section>
                  </div>
                </aside>
              </div>
              <div className="workbench-dual-pane-right">
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
                  onOpenCharacterModal={() => setChapterModal('character')}
                  onOpenStorylineCreator={openStorylineCreator}
                  onOpenStorylineEditor={openStorylineEditor}
                  onClearStorylineSelection={clearStorylineSelection}
                  onSelectMainStoryline={selectMainStoryline}
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
              onOpenRevisionEditor={openRevisionEditor}
              onSetPromptPreview={() => setPromptPreviewOpen(true)}
              onPrevChapter={goToPreviousChapter}
              onNextChapter={goToNextChapter}
              onChapterNumberChange={requestChapterChange}
              onUpdateGenerationSetting={updateGenerationSetting}
              onContextChipClick={handleContextChipClick}
              onOpenOutlineModal={() => setChapterModal('outline')}
              onOpenCharacterModal={() => setChapterModal('character')}
              onOpenStorylinePicker={() => setChapterModal('storyline-picker')}
            />
              </div>
            </div>
          </section>
        </>
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
                编辑细纲
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
                  setChapterModal('character');
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
                      {item.chapter_function || item.allowed_change || '本章角色执行要求待补充'}
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
        title="🗺 剧情线"
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
          title={'第 ' + chapterNumber + ' 章细纲速填'}
          description=""
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
            <label className="editor-field chapter-outline-title-field">
              <span>章节名</span>
              <input
                className="chapter-number-input text-input"
                value={draftChapterPlan.chapter_name}
                onChange={(event) => updateDraftChapterPlanField('chapter_name', event.target.value)}
              />
            </label>
            <section className="chapter-outline-ai-input editor-field-full">
              <label className="editor-field">
                <span>章节细纲</span>
                <textarea
                  className="modal-textarea modal-textarea-compact"
                  value={outlineDraftText}
                  onChange={(event) => setOutlineDraftText(event.target.value)}
                  placeholder="直接写一段你对本章的想法。"
                />
              </label>
              <div className="chapter-outline-ai-actions">
                {outlineBreakdownState.error ? <span>{outlineBreakdownState.error}</span> : null}
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={handleBreakdownChapterOutline}
                  disabled={outlineBreakdownState.loading}
                >
                  {outlineBreakdownState.loading ? '正在拆解...' : 'AI 拆解细纲'}
                </button>
              </div>
            </section>
            <label className="editor-field chapter-outline-goal-field">
              <span>本章目标</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftChapterPlan.chapter_structure?.chapter_goal || ''}
                onChange={(event) => updateChapterStructureField('chapter_goal', event.target.value)}
                placeholder="这一章必须完成什么推进？"
              />
            </label>
            <label className="editor-field editor-field-full">
              <span>关键场景</span>
              <textarea
                className="modal-textarea"
                value={draftChapterPlan.chapter_structure?.key_scenes || ''}
                onChange={(event) => updateChapterStructureField('key_scenes', event.target.value)}
                placeholder="一行一个场景。"
              />
            </label>
            <label className="editor-field editor-field-full">
              <span>冲突升级</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={draftChapterPlan.chapter_structure?.conflict_escalation || ''}
                onChange={(event) => updateChapterStructureField('conflict_escalation', event.target.value)}
                placeholder="矛盾如何变得更危险？"
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
              <button type="button" className="solid-btn" onClick={handleSaveChapterCharacters} disabled={savingState.loading}>
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

      {chapterModal === 'storyline-picker' ? (
        <Modal
          title={'选择第 ' + chapterNumber + ' 章剧情线'}
          description="选择本章要推进的剧情线，并指定主推线。"
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
                清空
              </button>
              <button type="button" className="ghost-btn" onClick={() => setChapterModal(null)}>取消</button>
              <button type="button" className="solid-btn" onClick={handleSaveMountedStorylines} disabled={savingState.loading}>
                {savingState.loading ? '正在保存...' : '保存剧情线选择'}
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
              onOpenCharacterModal={() => setChapterModal('character')}
              onOpenStorylineCreator={openStorylineCreator}
              onOpenStorylineEditor={openStorylineEditor}
              onClearStorylineSelection={clearStorylineSelection}
              onSelectMainStoryline={selectMainStoryline}
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
              <span>章节目标</span>
              <pre className="modal-pre">
                {[
                  '章名：' + (draftChapterPlan.chapter_name || '未命名章节'),
                  '本章目标：' + (chapterStructure.chapter_goal || '暂无填写'),
                  '关键场景：' + (chapterStructure.key_scenes || '暂无填写'),
                  '冲突升级：' + (chapterStructure.conflict_escalation || '暂无填写'),
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
              <span>章节细纲</span>
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
