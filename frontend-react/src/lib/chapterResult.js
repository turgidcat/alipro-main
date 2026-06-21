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
  chapterFeedback,
  statusKind = 'success',
  feedbackFallbackUsed = false
}) {
  return {
    hasContent: true,
    content,
    statusKind,
    statusTitle: successTitle,
    statusText: successText,
    metaText: chapterTitle,
    wordCountLabel: `实际约 ${content.length} 字 / 目标 ${targetWordCount} 字`,
    previewText: String(content).replace(/\s+/g, ' ').slice(0, 520),
    feedbackSummary: chapterFeedback.chapter_summary || '',
    feedbackFocus: chapterFeedback.next_chapter_focus || chapterFeedback.open_hooks || '',
    feedbackFallbackUsed
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
  const normalizedContent = String(content || '').trim();
  if (!normalizedContent) {
    throw new Error('正文内容为空，已停止保存，避免写入空章节。');
  }

  await upsertGeneratedChapter(selectedBookId, {
    title: chapterTitle,
    chapterName: normalizedPlan.chapter_name || '',
    chapterNumber,
    content: normalizedContent
  });

  let chapterFeedback = null;
  let feedbackFallbackUsed = false;
  try {
    const feedbackResponse = await generateChapterFeedback({
      bookId: selectedBookId,
      chapterNumber,
      chapterTitle,
      content: normalizedContent,
      outline: getGenerationChapterOutline(normalizedPlan)
    });
    chapterFeedback = feedbackResponse?.feedback || null;
    feedbackFallbackUsed = !!(
      feedbackResponse?.metadata?.feedbackFallbackUsed
      || feedbackResponse?.feedback_compat?.feedback_fallback_used
      || chapterFeedback?.feedback_fallback_used
    );
  } catch (_) {
    chapterFeedback = null;
  }

  if (!chapterFeedback) {
    feedbackFallbackUsed = true;
    chapterFeedback = buildLocalChapterFeedback({
      content: normalizedContent,
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
    content: normalizedContent,
    successTitle: feedbackFallbackUsed ? '正文已保存，反馈已降级生成' : successTitle,
    successText: feedbackFallbackUsed
      ? '正文已写入，但本章反馈接口失败，当前展示的是本地回退结果。下一章承接信息建议先人工复核。'
      : successText,
    chapterTitle,
    targetWordCount,
    chapterFeedback,
    statusKind: feedbackFallbackUsed ? 'warning' : 'success',
    feedbackFallbackUsed
  }));
  setRevisionOriginal(normalizedContent);
  setRevisionDraft(normalizedContent);
  setRevisionSuggestions(null);
  setRevisionError('');
  if (openResultModal) {
    setResultModalOpen(true);
  }
  return { feedbackPlan, chapterFeedback };
}
