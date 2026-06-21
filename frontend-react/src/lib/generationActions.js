function normalizeText(value) {
  return String(value || '').trim();
}

function buildStatusMeta({
  successTitle,
  successText,
  cycleResult
}) {
  const qualityStatus = cycleResult?.qualityCheck?.status || '';
  const hasCompleteFeedback = !!cycleResult?.feedbackSaved && !!cycleResult?.qualityCheckSaved;
  const isDegraded = hasCompleteFeedback
    && (
      !!cycleResult?.usedLocalFallback
      || !cycleResult?.modelFeedbackGenerated
      || qualityStatus === 'degraded'
      || qualityStatus === 'not_run'
    );

  if (cycleResult?.contentSaved && hasCompleteFeedback && !isDegraded) {
    return {
      statusKind: 'success',
      statusTitle: successTitle,
      statusText: successText
    };
  }

  if (cycleResult?.contentSaved && hasCompleteFeedback) {
    const degradedReason = normalizeText(
      cycleResult?.qualityCheck?.degraded_reason
      || cycleResult?.feedbackGenerationError
      || cycleResult?.feedbackSaveError
    );
    return {
      statusKind: 'warning',
      statusTitle: `${successTitle}（降级）`,
      statusText: degradedReason
        ? `正文已保存，但摘要/质量检查走了降级链路：${degradedReason}。`
        : '正文已保存，但摘要/质量检查走了降级链路，建议人工复核后再继续下一章。'
    };
  }

  if (cycleResult?.contentSaved) {
    const detail = normalizeText(cycleResult?.feedbackSaveError || cycleResult?.feedbackGenerationError);
    return {
      statusKind: 'warning',
      statusTitle: `${successTitle}（部分完成）`,
      statusText: detail
        ? `正文已保存，但摘要/检查未完整保存：${detail}。`
        : '正文已保存，但摘要/检查未完整保存。'
    };
  }

  return {
    statusKind: 'error',
    statusTitle: '保存失败',
    statusText: '正文未成功写回。'
  };
}

export function buildGenerationStateFromCycle({
  content,
  chapterTitle,
  targetWordCount,
  chapterFeedback,
  cycleResult,
  successTitle,
  successText
}) {
  const statusMeta = buildStatusMeta({
    successTitle,
    successText,
    cycleResult
  });

  return {
    hasContent: true,
    content,
    statusKind: statusMeta.statusKind,
    statusTitle: statusMeta.statusTitle,
    statusText: statusMeta.statusText,
    metaText: chapterTitle,
    wordCountLabel: `实际约 ${String(content || '').length} 字 / 目标 ${targetWordCount} 字`,
    previewText: String(content || '').replace(/\s+/g, ' ').slice(0, 520),
    feedbackSummary: chapterFeedback?.chapter_summary || '',
    feedbackFocus: chapterFeedback?.next_chapter_focus || chapterFeedback?.open_hooks || ''
  };
}
