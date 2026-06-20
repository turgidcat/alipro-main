import { getGenerationChapterOutline } from './chapterPlan.js';
import { buildLocalChapterFeedback } from './revisionDiff.js';
import { mergeFeedbackIntoPlan } from './chapterBundle.js';

export function buildSyncedChapterListContext(chapterContext = {}, {
  chapterNumber = 1,
  chapterTitle = ''
} = {}) {
  const normalizedChapterNumber = Number(chapterNumber || 1);
  const currentItems = Array.isArray(chapterContext.chapterListItems) ? chapterContext.chapterListItems : [];
  const nextCount = Math.max(Number(chapterContext.totalChapterCount || 0), normalizedChapterNumber, 1);
  const itemByChapterNumber = new Map(
    currentItems
      .map((item) => [Number(item.chapterNumber || 0), item])
      .filter(([itemChapterNumber]) => itemChapterNumber > 0)
  );

  itemByChapterNumber.set(normalizedChapterNumber, {
    ...(itemByChapterNumber.get(normalizedChapterNumber) || {}),
    chapterNumber: normalizedChapterNumber,
    chapterName: String(chapterTitle || '').trim(),
    status: 'has-content'
  });

  const nextItems = Array.from({ length: nextCount }, (_, index) => {
    const itemChapterNumber = index + 1;
    return itemByChapterNumber.get(itemChapterNumber) || {
      chapterNumber: itemChapterNumber,
      chapterName: '',
      status: 'empty'
    };
  });

  return {
    ...chapterContext,
    totalChapterCount: nextCount,
    chapterListItems: nextItems
  };
}

export function buildGenerationSuccessState({
  content,
  successTitle,
  successText,
  chapterTitle,
  targetWordCount,
  chapterFeedback
}) {
  return {
    hasContent: true,
    content,
    statusKind: 'success',
    statusTitle: successTitle,
    statusText: successText,
    metaText: chapterTitle,
    wordCountLabel: `实际约 ${content.length} 字 / 目标 ${targetWordCount} 字`,
    previewText: String(content || ''),
    feedbackSummary: chapterFeedback.chapter_summary || '',
    feedbackFocus: chapterFeedback.next_chapter_focus || chapterFeedback.open_hooks || ''
  };
}

export async function persistChapterResultCycle({
  selectedBookId,
  chapterNumber,
  content,
  normalizedPlan,
  chapterStructure,
  chapterTitle,
  targetWordCount,
  successTitle,
  successText,
  openResultModal = false,
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
}) {
  await upsertGeneratedChapter(selectedBookId, {
    title: chapterTitle,
    chapterName: normalizedPlan.chapter_name || '',
    chapterNumber,
    content
  });

  let chapterFeedback = null;
  try {
    const feedbackResponse = await generateChapterFeedback({
      bookId: selectedBookId,
      chapterNumber,
      chapterTitle,
      content,
      outline: getGenerationChapterOutline(normalizedPlan)
    });
    chapterFeedback = feedbackResponse?.feedback || null;
  } catch (_) {
    chapterFeedback = null;
  }

  if (!chapterFeedback) {
    chapterFeedback = buildLocalChapterFeedback({
      content,
      plan: normalizedPlan,
      chapterStructure,
      mainStorylineLabel: selectedMainStorylineLabel,
      targetStorylineLabel: selectedTargetStorylineLabel,
      rhythmHints: storylineRhythmHints
    });
  }

  const feedbackPlan = mergeFeedbackIntoPlan(normalizedPlan, chapterFeedback);
  await saveChapterPlan(selectedBookId, chapterNumber, feedbackPlan);
  setDraftChapterPlan(feedbackPlan);
  setSavedChapterPlanSnapshot(serializeChapterPlanDraft(feedbackPlan));
  syncCurrentChapterListItem({
    chapterTitle: normalizedPlan.chapter_name || ''
  });
  setGenerationState(buildGenerationSuccessState({
    content,
    successTitle,
    successText,
    chapterTitle,
    targetWordCount,
    chapterFeedback
  }));
  setRevisionOriginal(String(content || ''));
  setRevisionDraft(String(content || ''));
  setRevisionSuggestions(null);
  setRevisionError('');
  if (openResultModal) {
    setResultModalOpen(true);
  }
  return { feedbackPlan, chapterFeedback };
}
