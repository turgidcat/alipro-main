export function useWorkbenchEditors({
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
}) {
  function normalizeStorylineType(type) {
    return String(type || '').trim().toLowerCase() === 'main' ? 'main' : 'branch';
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
      storyline_type: normalizeStorylineType(storyline.type),
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
      const isRemoving = current.includes(storylineId);
      const next = isRemoving
        ? current.filter((id) => id !== storylineId)
        : [...current, storylineId];
      return {
        ...prev,
        main_storyline_id: isRemoving && prev.main_storyline_id === storylineId ? '' : prev.main_storyline_id,
        target_storylines: next
      };
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

  function handleContextChipClick(chip) {
    setActiveDrawer((prev) => (prev === chip ? null : chip));
  }

  function handleCloseDrawer() {
    setActiveDrawer(null);
  }

  return {
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
  };
}
