import './app-shell.css';
import './workbench-layout.css';
import {
  emptyChapterPlan,
  emptyChapterStructure,
  emptyStorylineDraft
} from './lib/constants.js';
import {
  describeRoleExecutionMeta,
  normalizeLines,
  normalizeRoleList,
  withStructuredChapterPlan
} from './lib/chapterPlan.js';
import GlobalBar from './components/workbench/GlobalBar.jsx';
import WorkbenchOverlays from './components/workbench/WorkbenchOverlays.jsx';
import WorkbenchStage from './components/workbench/WorkbenchStage.jsx';
import { useChapterWorkbenchViewModel } from './hooks/useChapterWorkbenchViewModel.js';
import { useDrawerMemory } from './hooks/useDrawerMemory.js';
import { useRevisionNavigator } from './hooks/useRevisionNavigator.js';
import { useWorkbench } from './hooks/useWorkbench.js';
import { useWorkbenchActions } from './hooks/useWorkbenchActions.js';
import { useWorkbenchEditors } from './hooks/useWorkbenchEditors.js';
import { useWorkbenchShortcuts } from './hooks/useWorkbenchShortcuts.js';

function serializeChapterPlanDraft(plan) {
  return JSON.stringify(plan || emptyChapterPlan);
}

export default function App() {
  const {
    selectedBookId,
    planningState,
    loadingBooks,
    error,
    planningModal, setPlanningModal,
    chapterModal, setChapterModal,
    savingState, setSavingState,
    chapterNumber, setChapterNumber,
    chapterContext, setChapterContext,
    chapterView, setChapterView,
    storylineOptions, setStorylineOptions,
    draftChapterPlan, setDraftChapterPlan,
    constraintOverrides, setConstraintOverrides,
    generationRiskConfirmed, setGenerationRiskConfirmed,
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

  const currentDraftSnapshot = serializeChapterPlanDraft(draftChapterPlan);
  const hasUnsavedChapterChanges = currentDraftSnapshot !== savedChapterPlanSnapshot;

  const {
    canGenerate,
    chapterStructure,
    generationReadiness,
    generationRecommendedItems,
    generationRequiredItems,
    hasOutlineAnchor,
    hasStorylineAnchor,
    generationRiskReview,
    missingRecommendedItems,
    missingRequiredItems,
    selectedMainStorylineLabel,
    selectedTargetStorylineLabel,
    selectedTargetStorylines,
    storylineRhythmHints
  } = useChapterWorkbenchViewModel({
    chapterNumber,
    draftChapterPlan,
    chapterView,
    chapterContext,
    storylineOptions,
    constraintOverrides,
    emptyChapterStructure
  });

  const {
    clearStorylineSelection,
    handleCloseDrawer,
    handleContextChipClick,
    openStorylineCreator,
    openStorylineEditor,
    selectMainStoryline,
    toggleTargetStoryline,
    updateChapterStructureField,
    updateDraftChapterPlanField,
    updateDraftStorylineField,
    updateGenerationSetting
  } = useWorkbenchEditors({
    chapterNumber,
    draftChapterPlan,
    emptyChapterStructure,
    emptyStorylineDraft,
    withStructuredChapterPlan,
    setDraftStoryline,
    setSavingState,
    setChapterModal,
    setDraftChapterPlan,
    setActiveDrawer
  });

  const {
    applyRevisionSuggestion,
    focusRevisionChange,
    registerRevisionChangeRef,
    registerRevisionParagraphRef,
    revisionChangeItems,
    revisionCurrentChange,
    revisionCurrentFocusIndex,
    revisionOriginalParagraphs,
    revisionSuggestionMarks
  } = useRevisionNavigator({
    revisionOriginal,
    revisionDraft,
    revisionSuggestions,
    revisionFocusIndex,
    setRevisionFocusIndex,
    setRevisionError,
    setRevisionDraft,
    setRevisionAppliedChangeKeys,
    setRevisionNotice,
    revisionParagraphRefs,
    revisionChangeRefs
  });

  useDrawerMemory({
    bookId: selectedBookId,
    chapterNumber,
    activeDrawer,
    setActiveDrawer
  });

  const {
    adjustStorylineRange,
    goToNextChapter,
    goToPreviousChapter,
    handleGenerateWithGuards,
    handleGenerateChapterOutline,
    handlePolishRevision,
    handleSaveChapterOutline,
    handleSaveChapterPlan,
    handleSaveRevision,
    handleSaveStoryline,
    openRevisionEditor,
    requestChapterChange
  } = useWorkbenchActions({
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
  });

  useWorkbenchShortcuts({
    activeDrawer,
    chapterModal,
    planningModal,
    promptPreviewOpen,
    resultModalOpen,
    handleCloseDrawer,
    handleGenerateWithGuards,
    goToNextChapter,
    goToPreviousChapter,
    setChapterModal,
    setPlanningModal,
    setPromptPreviewOpen,
    setResultModalOpen
  });

  function setConstraintOverride(key, mode) {
    setConstraintOverrides((prev) => ({
      ...prev,
      [key]: mode
    }));
  }

  const chapterConfigProps = {
    chapterNumber,
    draftChapterPlan,
    chapterContext,
    chapterView,
    storylineOptions,
    selectedTargetStorylines,
    storylineRhythmHints,
    hasOutlineAnchor,
    savingState,
    loadingChapter,
    selectedBookId,
    onChapterNumberChange: requestChapterChange,
    onSaveChapterPlan: handleSaveChapterPlan,
    onOpenOutlineModal: () => setChapterModal('outline'),
    onOpenCharacterModal: () => setChapterModal('character'),
    onOpenStorylineCreator: openStorylineCreator,
    onOpenStorylineEditor: openStorylineEditor,
    onClearStorylineSelection: clearStorylineSelection,
    onSelectMainStoryline: selectMainStoryline,
    onToggleTargetStoryline: toggleTargetStoryline,
    onAdjustStorylineRange: adjustStorylineRange,
    onContextChipClick: handleContextChipClick,
    activeDrawer
  };

  const contentWorkspaceProps = {
    chapterNumber,
    draftChapterPlan,
    chapterContext,
    constraintOverrides,
    canGenerate,
    generationRiskReview,
    generationReadiness,
    generationRequiredItems,
    generationRecommendedItems,
    generationState,
    generationRiskConfirmed,
    isGenerating,
    loadingChapter,
    onGenerateChapter: handleGenerateWithGuards,
    onOpenRevisionEditor: openRevisionEditor,
    onSetPromptPreview: () => setPromptPreviewOpen(true),
    onPrevChapter: goToPreviousChapter,
    onNextChapter: goToNextChapter,
    onChapterNumberChange: requestChapterChange,
    onSetConstraintOverride: setConstraintOverride,
    onGenerationRiskConfirm: setGenerationRiskConfirmed,
    onUpdateGenerationSetting: updateGenerationSetting
  };

  const revisionProps = {
    chapterNumber,
    revisionError,
    revisionNotice,
    revisionRequirement,
    setRevisionRequirement,
    revisionOriginal,
    revisionDraft,
    setRevisionDraft,
    revisionSuggestions,
    generationState,
    revisionPolishing,
    revisionSaving,
    revisionChangeItems,
    revisionCurrentChange,
    revisionCurrentFocusIndex,
    revisionOriginalParagraphs,
    revisionSuggestionMarks,
    revisionAppliedChangeKeys,
    onClose: () => setResultModalOpen(false),
    onPolish: handlePolishRevision,
    onSave: handleSaveRevision,
    onFocusRevisionChange: focusRevisionChange,
    onApplyRevisionSuggestion: applyRevisionSuggestion,
    registerRevisionChangeRef,
    registerRevisionParagraphRef
  };

  return (
    <main className="app-shell">
      <GlobalBar
        bookTitle={planningState?.currentBook?.title || ''}
        chapterNumber={chapterNumber}
        chapterName={draftChapterPlan.chapter_name}
        mainStorylineLabel={chapterView.mainStoryline}
        totalChapterCount={chapterContext.totalChapterCount}
        chapterListItems={chapterContext.chapterListItems}
        onPrevChapter={goToPreviousChapter}
        onNextChapter={goToNextChapter}
        onSelectChapter={requestChapterChange}
      />

      {error ? <div className="global-banner is-error">{error}</div> : null}
      {loadingBooks ? <div className="global-banner">正在读取书籍列表...</div> : null}

      <WorkbenchStage
        planningState={planningState}
        chapterConfigProps={chapterConfigProps}
        contentWorkspaceProps={contentWorkspaceProps}
      />

      <WorkbenchOverlays
        activeDrawer={activeDrawer}
        chapterModal={chapterModal}
        chapterNumber={chapterNumber}
        chapterStructure={chapterStructure}
        describeRoleExecutionMeta={describeRoleExecutionMeta}
        draftChapterPlan={draftChapterPlan}
        draftStoryline={draftStoryline}
        generationReadiness={generationReadiness}
        generationRiskReview={generationRiskReview}
        handleCloseDrawer={handleCloseDrawer}
        handleGenerateChapterOutline={handleGenerateChapterOutline}
        handleSaveChapterOutline={handleSaveChapterOutline}
        handleSaveChapterPlan={handleSaveChapterPlan}
        handleSaveStoryline={handleSaveStoryline}
        normalizeLines={normalizeLines}
        normalizeRoleList={normalizeRoleList}
        planningState={planningState}
        promptPreviewOpen={promptPreviewOpen}
        resultModalOpen={resultModalOpen}
        revisionProps={revisionProps}
        savingState={savingState}
        selectedMainStorylineLabel={selectedMainStorylineLabel}
        selectedTargetStorylineLabel={selectedTargetStorylineLabel}
        setChapterModal={setChapterModal}
        setPromptPreviewOpen={setPromptPreviewOpen}
        storylineOptions={storylineOptions}
        storylineRhythmHints={storylineRhythmHints}
        updateChapterStructureField={updateChapterStructureField}
        updateDraftChapterPlanField={updateDraftChapterPlanField}
        updateDraftStorylineField={updateDraftStorylineField}
      />
    </main>
  );
}
