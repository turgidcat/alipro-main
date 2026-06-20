export function buildLinkedStorylineChapterDraft({
  draftChapterPlan,
  draftStoryline,
  createdStoryline
}) {
  const savedId = draftStoryline.id || createdStoryline?.id || '';
  const currentTargets = Array.isArray(draftChapterPlan.target_storylines) ? draftChapterPlan.target_storylines : [];
  return savedId
    ? {
        ...draftChapterPlan,
        main_storyline_id: draftChapterPlan.main_storyline_id || savedId,
        target_storylines: currentTargets.includes(savedId) ? currentTargets : [...currentTargets, savedId]
      }
    : draftChapterPlan;
}

export async function saveStorylineAndReloadAction({
  selectedBookId,
  chapterNumber,
  storylinePayload,
  draftChapterPlan,
  buildNextDraft = null,
  persistNextDraft = false,
  closeModal = false,
  saveStoryline,
  saveChapterPlan,
  reloadChapterSetup,
  withStructuredChapterPlan,
  emptyChapterStructure,
  setSavingState,
  setChapterModal
}) {
  if (!selectedBookId) return null;

  setSavingState({ loading: true, error: '' });
  try {
    const created = await saveStoryline(selectedBookId, storylinePayload);
    const nextDraft = typeof buildNextDraft === 'function'
      ? buildNextDraft(created)
      : draftChapterPlan;

    if (persistNextDraft) {
      await saveChapterPlan(
        selectedBookId,
        chapterNumber,
        withStructuredChapterPlan(nextDraft, nextDraft.chapter_structure || emptyChapterStructure)
      );
    }

    await reloadChapterSetup(nextDraft);
    if (closeModal) {
      setChapterModal(null);
    }
    setSavingState({ loading: false, error: '' });
    return created;
  } catch (saveError) {
    setSavingState({ loading: false, error: saveError.message });
    return null;
  }
}
