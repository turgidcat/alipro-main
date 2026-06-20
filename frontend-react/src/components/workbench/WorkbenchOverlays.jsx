import ChapterCharacterModal from './ChapterCharacterModal.jsx';
import ChapterOutlineModal from './ChapterOutlineModal.jsx';
import PromptPreviewModal from './PromptPreviewModal.jsx';
import RevisionEditor from './RevisionEditor.jsx';
import StorylineEditorModal from './StorylineEditorModal.jsx';
import ContextDrawer from './ContextDrawer.jsx';
import BookSettingDrawer from './drawers/BookSettingDrawer.jsx';
import StorylineDrawer from './drawers/StorylineDrawer.jsx';
import CharacterDrawer from './drawers/CharacterDrawer.jsx';
import VolumeDrawer from './drawers/VolumeDrawer.jsx';

export default function WorkbenchOverlays(props) {
  const {
    activeDrawer,
    chapterModal,
    chapterNumber,
    chapterStructure,
    describeRoleExecutionMeta,
    draftChapterPlan,
    draftStoryline,
    generationReadiness,
    generationRiskReview,
    handleCloseDrawer,
    handleGenerateChapterOutline,
    handleSaveChapterOutline,
    handleSaveChapterPlan,
    handleSaveStoryline,
    normalizeLines,
    normalizeRoleList,
    planningState,
    promptPreviewOpen,
    resultModalOpen,
    revisionProps,
    savingState,
    selectedMainStorylineLabel,
    selectedTargetStorylineLabel,
    setChapterModal,
    setPromptPreviewOpen,
    storylineOptions,
    storylineRhythmHints,
    updateChapterStructureField,
    updateDraftChapterPlanField,
    updateDraftStorylineField
  } = props;

  return (
    <>
      <ContextDrawer
        open={activeDrawer === 'book'}
        title="全书设定"
        onClose={handleCloseDrawer}
      >
        <BookSettingDrawer book={planningState?.currentBook} />
      </ContextDrawer>

      <ContextDrawer
        open={activeDrawer === 'storyline'}
        title="剧情线"
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
        title="角色档案"
        onClose={handleCloseDrawer}
      >
        <CharacterDrawer
          characters={planningState?.bookPlanning?.characters || []}
          appearingRoles={draftChapterPlan.appearing_roles}
        />
      </ContextDrawer>

      <ContextDrawer
        open={activeDrawer === 'volume'}
        title="分卷规划"
        onClose={handleCloseDrawer}
      >
        <VolumeDrawer
          volumePlans={planningState?.bookPlanning?.volumePlans || []}
          currentVolumeNumber={draftChapterPlan.volume_number}
        />
      </ContextDrawer>

      <ChapterOutlineModal
        open={chapterModal === 'outline'}
        chapterNumber={chapterNumber}
        savingState={savingState}
        draftChapterPlan={draftChapterPlan}
        normalizeRoleList={normalizeRoleList}
        normalizeLines={normalizeLines}
        onClose={() => setChapterModal(null)}
        onGenerate={handleGenerateChapterOutline}
        onSave={handleSaveChapterOutline}
        onChangePlanField={updateDraftChapterPlanField}
        onChangeStructureField={updateChapterStructureField}
      />

      <ChapterCharacterModal
        open={chapterModal === 'character'}
        chapterNumber={chapterNumber}
        savingState={savingState}
        draftChapterPlan={draftChapterPlan}
        describeRoleExecutionMeta={describeRoleExecutionMeta}
        onClose={() => setChapterModal(null)}
        onSave={handleSaveChapterPlan}
        onChangePlanField={updateDraftChapterPlanField}
      />

      <StorylineEditorModal
        open={chapterModal === 'storyline'}
        draftStoryline={draftStoryline}
        savingState={savingState}
        onClose={() => setChapterModal(null)}
        onSave={handleSaveStoryline}
        onChangeField={updateDraftStorylineField}
      />

      {resultModalOpen ? <RevisionEditor {...revisionProps} /> : null}

      <PromptPreviewModal
        chapterNumber={chapterNumber}
        open={promptPreviewOpen}
        onClose={() => setPromptPreviewOpen(false)}
        generationReadiness={generationReadiness}
        draftChapterPlan={draftChapterPlan}
        chapterStructure={chapterStructure}
        selectedMainStorylineLabel={selectedMainStorylineLabel}
        selectedTargetStorylineLabel={selectedTargetStorylineLabel}
        storylineRhythmHints={storylineRhythmHints}
        describeRoleExecutionMeta={describeRoleExecutionMeta}
        generationRiskReview={generationRiskReview}
      />
    </>
  );
}
