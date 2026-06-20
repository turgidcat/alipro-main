import { normalizeChapterBundle } from './chapterBundle.js';

export function applyChapterSetupBundleAction({
  normalized,
  overrideDraft = null,
  serializeChapterPlanDraft,
  setChapterContext,
  setChapterView,
  setStorylineOptions,
  setDraftChapterPlan,
  setSavedChapterPlanSnapshot,
  setGenerationState
}) {
  const nextDraft = overrideDraft || normalized.draft;
  setChapterContext(normalized.context);
  setChapterView(normalized.view);
  setStorylineOptions(normalized.storylineOptions);
  setDraftChapterPlan(nextDraft);
  setSavedChapterPlanSnapshot(serializeChapterPlanDraft(nextDraft));
  setGenerationState(normalized.generation);
}

export async function reloadChapterSetupAction({
  selectedBookId,
  chapterNumber,
  overrideDraft = null,
  fetchChapterSetupBundle,
  serializeChapterPlanDraft,
  setChapterContext,
  setChapterView,
  setStorylineOptions,
  setDraftChapterPlan,
  setSavedChapterPlanSnapshot,
  setGenerationState
}) {
  if (!selectedBookId) return null;
  const bundle = await fetchChapterSetupBundle(selectedBookId, chapterNumber);
  const normalized = normalizeChapterBundle(bundle, chapterNumber);
  applyChapterSetupBundleAction({
    normalized,
    overrideDraft,
    serializeChapterPlanDraft,
    setChapterContext,
    setChapterView,
    setStorylineOptions,
    setDraftChapterPlan,
    setSavedChapterPlanSnapshot,
    setGenerationState
  });
  return normalized;
}

export async function saveChapterPlanAndReloadAction({
  selectedBookId,
  chapterNumber,
  planPayload,
  closeModal = true,
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
}) {
  setSavingState({ loading: true, error: '' });
  try {
    await saveChapterPlan(selectedBookId, chapterNumber, planPayload);
    const bundle = await fetchChapterSetupBundle(selectedBookId, chapterNumber);
    const normalized = normalizeChapterBundle(bundle, chapterNumber);
    applyChapterSetupBundleAction({
      normalized,
      serializeChapterPlanDraft,
      setChapterContext,
      setChapterView,
      setStorylineOptions,
      setDraftChapterPlan,
      setSavedChapterPlanSnapshot,
      setGenerationState
    });
    if (closeModal) {
      setChapterModal(null);
    }
  } catch (saveError) {
    setSavingState({ loading: false, error: saveError.message });
    return false;
  }
  setSavingState({ loading: false, error: '' });
  return true;
}
