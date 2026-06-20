import {
  fetchChapterSetupBundle,
  generateChapterOutline,
  generateChapterContent,
  generateChapterFeedback,
  polishChapterContent,
  saveChapterPlan,
  saveStoryline,
  upsertGeneratedChapter
} from '../workbenchApi.js';
import { emptyChapterPlan, emptyChapterStructure } from '../lib/constants.js';
import {
  buildLatestOutlinePlan,
  getPlanWordCount,
  prepareOutlineModalPlan,
  withStructuredChapterPlan
} from '../lib/chapterPlan.js';
import {
  openRevisionEditorSession,
  polishRevisionAction,
  saveRevisionAction
} from '../lib/revisionActions.js';
import {
  reloadChapterSetupAction,
  saveChapterPlanAndReloadAction
} from '../lib/chapterSetupActions.js';
import { generateChapterAction } from '../lib/generationActions.js';
import {
  buildLinkedStorylineChapterDraft,
  saveStorylineAndReloadAction
} from '../lib/storylineActions.js';
import {
  buildSyncedChapterListContext,
  persistChapterResultCycle
} from '../lib/chapterResult.js';

function serializeChapterPlanDraft(plan) {
  return JSON.stringify(plan || emptyChapterPlan);
}

export function useWorkbenchActions({
  selectedBookId,
  chapterNumber,
  setChapterNumber,
  planningState,
  chapterContext,
  setChapterContext,
  setChapterView,
  setStorylineOptions,
  draftChapterPlan,
  setDraftChapterPlan,
  constraintOverrides,
  generationRiskConfirmed,
  generationState,
  setGenerationState,
  setIsGenerating,
  setLoadingChapter,
  setSavingState,
  draftStoryline,
  setSavedChapterPlanSnapshot,
  hasUnsavedChapterChanges,
  setChapterModal,
  setResultModalOpen,
  selectedMainStorylineLabel,
  selectedTargetStorylineLabel,
  storylineRhythmHints,
  generationReadiness,
  generationRequiredItems,
  generationRecommendedItems,
  missingRequiredItems,
  missingRecommendedItems,
  generationRiskReview,
  setRevisionOriginal,
  revisionDraft,
  setRevisionDraft,
  revisionRequirement,
  revisionParagraphRefs,
  revisionChangeRefs,
  setRevisionSuggestions,
  setRevisionSaving,
  setRevisionPolishing,
  setRevisionError,
  setRevisionNotice,
  setRevisionFocusIndex,
  setRevisionAppliedChangeKeys
}) {
  async function saveChapterPlanAndReload(planPayload, { closeModal = true } = {}) {
    await saveChapterPlanAndReloadAction({
      selectedBookId,
      chapterNumber,
      planPayload,
      closeModal,
      saveChapterPlan,
      fetchChapterSetupBundle,
      serializeChapterPlanDraft,
      setChapterContext,
      setChapterView,
      setStorylineOptions,
      setDraftChapterPlan,
      setSavedChapterPlanSnapshot,
      setGenerationState,
      setSavingState,
      setChapterModal
    });
  }

  async function handleSaveChapterPlan() {
    await saveChapterPlanAndReload(prepareOutlineModalPlan(draftChapterPlan));
  }

  async function handleSaveChapterOutline() {
    const latestPlan = buildLatestOutlinePlan(
      draftChapterPlan,
      draftChapterPlan.outline_text,
      'manual'
    );
    await saveChapterPlanAndReload(latestPlan);
  }

  async function handleGenerateChapterOutline() {
    if (!selectedBookId) return;
    setSavingState({ loading: true, error: '' });
    try {
      const chapterTitle = draftChapterPlan.chapter_name
        ? `第 ${chapterNumber} 章 ${draftChapterPlan.chapter_name}`
        : `第 ${chapterNumber} 章`;
      const response = await generateChapterOutline({
        bookId: selectedBookId,
        chapterNumber,
        bookTitle: planningState.currentBook.title,
        genre: planningState.currentBook.genre,
        subgenre: planningState.currentBook.subgenre,
        chapterTitle
      });
      const latestPlan = buildLatestOutlinePlan(
        draftChapterPlan,
        response?.content || '',
        'ai'
      );
      await saveChapterPlanAndReload(latestPlan, { closeModal: false });
    } catch (error) {
      setSavingState({ loading: false, error: error.message || '章节细纲生成失败。' });
    }
  }

  async function reloadChapterSetup(overrideDraft = null) {
    setLoadingChapter(true);
    try {
      return await reloadChapterSetupAction({
        selectedBookId,
        chapterNumber,
        overrideDraft,
        fetchChapterSetupBundle,
        serializeChapterPlanDraft,
        setChapterContext,
        setChapterView,
        setStorylineOptions,
        setDraftChapterPlan,
        setSavedChapterPlanSnapshot,
        setGenerationState
      });
    } finally {
      setLoadingChapter(false);
    }
  }

  function syncCurrentChapterListItem({ chapterTitle = '' }) {
    setChapterContext((prev) => buildSyncedChapterListContext(prev, {
      chapterNumber,
      chapterTitle
    }));
  }

  async function handlePersistChapterResultCycle({
    content,
    normalizedPlan,
    chapterStructure,
    chapterTitle,
    targetWordCount,
    successTitle,
    successText,
    openResultModal = false
  }) {
    return persistChapterResultCycle({
      selectedBookId,
      chapterNumber,
      content,
      normalizedPlan,
      chapterStructure,
      chapterTitle,
      targetWordCount,
      successTitle,
      successText,
      openResultModal,
      selectedMainStorylineLabel,
      selectedTargetStorylineLabel,
      storylineRhythmHints,
      upsertGeneratedChapter,
      generateChapterFeedback,
      saveChapterPlan,
      syncCurrentChapterListItem,
      serializeChapterPlanDraft,
      setDraftChapterPlan,
      setSavedChapterPlanSnapshot,
      setGenerationState,
      setRevisionOriginal,
      setRevisionDraft,
      setRevisionSuggestions,
      setRevisionError,
      setResultModalOpen
    });
  }

  function openRevisionEditor() {
    openRevisionEditorSession({
      content: generationState.content || '',
      revisionParagraphRefs,
      revisionChangeRefs,
      setRevisionOriginal,
      setRevisionDraft,
      setRevisionSuggestions,
      setRevisionError,
      setRevisionNotice,
      setRevisionFocusIndex,
      setRevisionAppliedChangeKeys,
      setResultModalOpen
    });
  }

  async function handlePolishRevision() {
    await polishRevisionAction({
      revisionDraft,
      revisionRequirement,
      polishChapterContent,
      setRevisionPolishing,
      setRevisionError,
      setRevisionNotice,
      setRevisionSuggestions
    });
  }

  async function handleSaveRevision() {
    await saveRevisionAction({
      revisionDraft,
      draftChapterPlan,
      chapterNumber,
      emptyChapterStructure,
      withStructuredChapterPlan,
      getPlanWordCount,
      handlePersistChapterResultCycle,
      setRevisionSaving,
      setRevisionError,
      setResultModalOpen
    });
  }

  async function handleSaveStoryline() {
    if (!selectedBookId) return;
    if (!draftStoryline.storyline_name.trim()) {
      setSavingState({ loading: false, error: '剧情线名称不能为空。' });
      return;
    }

    await saveStorylineAndReloadAction({
      selectedBookId,
      chapterNumber,
      storylinePayload: draftStoryline,
      draftChapterPlan,
      buildNextDraft: (created) => buildLinkedStorylineChapterDraft({
        draftChapterPlan,
        draftStoryline,
        createdStoryline: created
      }),
      persistNextDraft: !draftStoryline.id,
      closeModal: true,
      saveStoryline,
      saveChapterPlan,
      reloadChapterSetup,
      withStructuredChapterPlan,
      emptyChapterStructure,
      setSavingState,
      setChapterModal
    });
  }

  async function adjustStorylineRange(storyline, field) {
    if (!selectedBookId) return;
    await saveStorylineAndReloadAction({
      selectedBookId,
      chapterNumber,
      storylinePayload: {
        id: storyline.id,
        volume_number: storyline.volumeNumber,
        storyline_name: storyline.name,
        storyline_type: storyline.type,
        description: storyline.description,
        core_conflict: storyline.coreConflict,
        start_chapter: field === 'start' ? chapterNumber : storyline.startChapter,
        end_chapter: field === 'end' ? chapterNumber : storyline.endChapter
      },
      draftChapterPlan,
      buildNextDraft: () => draftChapterPlan,
      saveStoryline,
      saveChapterPlan,
      reloadChapterSetup,
      withStructuredChapterPlan,
      emptyChapterStructure,
      setSavingState,
      setChapterModal
    });
  }

  async function handleGenerateChapter() {
    await generateChapterAction({
      selectedBookId,
      chapterNumber,
      planningState,
      draftChapterPlan,
      emptyChapterStructure,
      chapterContext,
      constraintOverrides,
      generationReadiness,
      missingRequiredItems,
      generationState,
      generationRiskReview,
      generationRiskConfirmed,
      generationRequiredItems,
      generationRecommendedItems,
      missingRecommendedItems,
      selectedMainStorylineLabel,
      selectedTargetStorylineLabel,
      storylineRhythmHints,
      setGenerationState,
      setIsGenerating,
      generateChapterContent,
      handlePersistChapterResultCycle
    });
  }

  function confirmDiscardUnsavedChanges(actionLabel) {
    if (!hasUnsavedChapterChanges) return true;
    return window.confirm(`当前章节还有未保存修改，继续${actionLabel}会丢失这些改动。要继续吗？`);
  }

  function requestChapterChange(nextChapterNumber) {
    const safeChapterNumber = Math.max(1, Number(nextChapterNumber || 1));
    if (safeChapterNumber === Number(chapterNumber || 1)) return;
    if (!confirmDiscardUnsavedChanges(`切换到第 ${safeChapterNumber} 章`)) return;
    setChapterNumber(safeChapterNumber);
  }

  function goToPreviousChapter() {
    requestChapterChange(Math.max(1, Number(chapterNumber || 1) - 1));
  }

  function goToNextChapter() {
    requestChapterChange(Math.max(1, Number(chapterNumber || 1) + 1));
  }

  function handleGenerateWithGuards() {
    if (!confirmDiscardUnsavedChanges('生成正文')) return;
    handleGenerateChapter();
  }

  return {
    draftStoryline,
    adjustStorylineRange,
    goToNextChapter,
    goToPreviousChapter,
    handleGenerateChapter,
    handleGenerateWithGuards,
    handlePersistChapterResultCycle,
    handlePolishRevision,
    handleGenerateChapterOutline,
    handleSaveChapterOutline,
    handleSaveChapterPlan,
    handleSaveRevision,
    handleSaveStoryline,
    openRevisionEditor,
    reloadChapterSetup,
    requestChapterChange
  };
}
