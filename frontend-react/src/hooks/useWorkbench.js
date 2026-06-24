import { useEffect, useRef, useState } from 'react';
import { useWorkbenchData } from '../useWorkbenchData.js';
import { fetchChapterSetupBundle } from '../workbenchApi.js';
import { emptyChapterPlan, initialGenerationState, emptyStorylineDraft } from '../lib/constants.js';
import { normalizeChapterBundle } from '../lib/chapterBundle.js';

const CHAPTER_ENTRY_MODE_KEY = 'alipro-workbench-chapter-entry-mode';
const CHAPTER_ENTRY_MODES = new Set(['first', 'latest', 'next']);

function serializeChapterPlanSnapshot(plan) {
  return JSON.stringify(plan || emptyChapterPlan);
}

function getStoredChapterEntryMode() {
  try {
    const stored = window.localStorage.getItem(CHAPTER_ENTRY_MODE_KEY);
    return CHAPTER_ENTRY_MODES.has(stored) ? stored : 'first';
  } catch (_) {
    return 'first';
  }
}

function persistChapterEntryMode(mode) {
  try {
    window.localStorage.setItem(CHAPTER_ENTRY_MODE_KEY, CHAPTER_ENTRY_MODES.has(mode) ? mode : 'first');
  } catch (_) {
    // localStorage may be unavailable in embedded previews.
  }
}

function resolveEntryChapterNumber(mode, context = {}) {
  const suggested = Math.max(1, Number(context.suggestedChapterNumber || 1));
  const existingCount = Math.max(0, Number(context.existingChapterCount || 0));
  if (mode === 'latest') {
    return existingCount > 0 ? Math.max(1, suggested - 1) : 1;
  }
  if (mode === 'next') {
    return suggested;
  }
  return 1;
}

export function useWorkbench() {
  const [planningModal, setPlanningModal] = useState(null);
  const [chapterModal, setChapterModal] = useState(null);
  const [savingState, setSavingState] = useState({ loading: false, error: '' });
  const [planningNotice, setPlanningNotice] = useState(null);
  const [chapterNumber, setChapterNumber] = useState(1);
  const [chapterEntryMode, setChapterEntryModeState] = useState(getStoredChapterEntryMode);
  const [chapterContext, setChapterContext] = useState({});
  const [chapterView, setChapterView] = useState({});
  const [storylineOptions, setStorylineOptions] = useState([]);
  const [draftChapterPlan, setDraftChapterPlan] = useState(emptyChapterPlan);
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
  const [activeDrawer, setActiveDrawer] = useState(null);
  const [savedChapterPlanSnapshot, setSavedChapterPlanSnapshot] = useState(
    serializeChapterPlanSnapshot(emptyChapterPlan)
  );

  const workbenchData = useWorkbenchData();
  const { selectedBookId } = workbenchData;
  const appliedChapterEntryKeyRef = useRef('');

  function setChapterEntryMode(mode) {
    const nextMode = CHAPTER_ENTRY_MODES.has(mode) ? mode : 'first';
    persistChapterEntryMode(nextMode);
    setChapterEntryModeState(nextMode);
  }

  useEffect(() => {
    if (!selectedBookId) {
      setSavedChapterPlanSnapshot(serializeChapterPlanSnapshot(emptyChapterPlan));
      return;
    }

    let cancelled = false;
    async function loadChapter() {
      setLoadingChapter(true);
      try {
        const bundle = await fetchChapterSetupBundle(selectedBookId, chapterNumber);
        if (cancelled) return;
        const normalized = normalizeChapterBundle(bundle, chapterNumber);
        const entryKey = `${selectedBookId}:${chapterEntryMode}`;
        const entryChapterNumber = resolveEntryChapterNumber(chapterEntryMode, normalized.context);
        if (appliedChapterEntryKeyRef.current !== entryKey) {
          appliedChapterEntryKeyRef.current = entryKey;
          if (entryChapterNumber !== Number(chapterNumber || 1)) {
            setChapterNumber(entryChapterNumber);
            return;
          }
        }
        setChapterContext(normalized.context);
        setChapterView(normalized.view);
        setStorylineOptions(normalized.storylineOptions);
        setDraftChapterPlan(normalized.draft);
        setSavedChapterPlanSnapshot(serializeChapterPlanSnapshot(normalized.draft));
        setGenerationState(normalized.generation);
      } finally {
        if (!cancelled) setLoadingChapter(false);
      }
    }

    loadChapter();
    return () => {
      cancelled = true;
    };
  }, [selectedBookId, chapterNumber, chapterEntryMode]);

  return {
    ...workbenchData,
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
  };
}
