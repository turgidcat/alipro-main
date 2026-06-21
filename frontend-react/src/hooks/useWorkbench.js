import { useEffect, useRef, useState } from 'react';
import { useWorkbenchData } from '../useWorkbenchData.js';
import { fetchChapterSetupBundle } from '../workbenchApi.js';
import { emptyChapterPlan, initialGenerationState, emptyStorylineDraft } from '../lib/constants.js';
import { normalizeChapterBundle } from '../lib/chapterBundle.js';

function serializeChapterPlanSnapshot(plan) {
  return JSON.stringify(plan || emptyChapterPlan);
}

export function useWorkbench() {
  const [planningModal, setPlanningModal] = useState(null);
  const [chapterModal, setChapterModal] = useState(null);
  const [savingState, setSavingState] = useState({ loading: false, error: '' });
  const [planningNotice, setPlanningNotice] = useState('');
  const [chapterNumber, setChapterNumber] = useState(1);
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
  }, [selectedBookId, chapterNumber]);

  return {
    ...workbenchData,
    planningModal, setPlanningModal,
    chapterModal, setChapterModal,
    savingState, setSavingState,
    planningNotice, setPlanningNotice,
    chapterNumber, setChapterNumber,
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
