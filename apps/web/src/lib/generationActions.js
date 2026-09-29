import { countPlatformEffectiveWords, formatWordCountProgress } from './textMetrics.js';

function normalizeText(value) {
  return String(value || '').trim();
}

function sanitizeGeneratedText(value) {
  return String(value || '')
    .replace(/\uFFFD+/g, '')
    .replace(/�+/g, '')
    .trim();
}

function normalizeQualityCheck(rawQualityCheck = {}) {
  const qualityCheck = rawQualityCheck && typeof rawQualityCheck === 'object' ? rawQualityCheck : {};
  const storylineAudit = qualityCheck.storyline_audit && typeof qualityCheck.storyline_audit === 'object'
    ? qualityCheck.storyline_audit
    : {};
  const wordCountAudit = qualityCheck.word_count_audit && typeof qualityCheck.word_count_audit === 'object'
    ? qualityCheck.word_count_audit
    : {};
  return {
    status: normalizeText(qualityCheck.status) || 'not_run',
    source: normalizeText(qualityCheck.source) || 'none',
    verdict: normalizeText(qualityCheck.verdict),
    degradedReason: normalizeText(qualityCheck.degraded_reason || qualityCheck.degradedReason),
    signals: Array.isArray(qualityCheck.signals) ? qualityCheck.signals.map((item) => normalizeText(item)).filter(Boolean) : [],
    risks: Array.isArray(qualityCheck.risks) ? qualityCheck.risks.map((item) => normalizeText(item)).filter(Boolean) : [],
    airdropItems: Array.isArray(qualityCheck.airdrop_items)
      ? qualityCheck.airdrop_items
        .map((item) => {
          if (!item || typeof item !== 'object') return '';
          return normalizeText(item.name || item.reason || item.suggestion);
        })
        .filter(Boolean)
      : []
    ,
    storylineAudit: {
      status: normalizeText(storylineAudit.status) || 'not_applicable',
      usedStorylineIds: Array.isArray(storylineAudit.used_storyline_ids)
        ? storylineAudit.used_storyline_ids.map((item) => normalizeText(item)).filter(Boolean)
        : [],
      usedBeatIds: Array.isArray(storylineAudit.used_beat_ids)
        ? storylineAudit.used_beat_ids.map((item) => normalizeText(item)).filter(Boolean)
        : [],
      summary: normalizeText(storylineAudit.summary),
      risks: Array.isArray(storylineAudit.risks) ? storylineAudit.risks.map((item) => normalizeText(item)).filter(Boolean) : [],
      requiresReview: Boolean(storylineAudit.requires_review || storylineAudit.requiresReview)
    },
    wordCountAudit: {
      status: normalizeText(wordCountAudit.status) || 'not_applicable',
      target: Number(wordCountAudit.target || 0) || 0,
      actual: Number(wordCountAudit.actual || 0) || 0,
      deviationRatio: Number(wordCountAudit.deviation_ratio || wordCountAudit.deviationRatio || 0) || 0,
      summary: normalizeText(wordCountAudit.summary)
    }
  };
}

function formatQualitySource(source) {
  return {
    model_audit: '模型质检',
    local_fallback: '本地兜底检查',
    none: ''
  }[source] || source;
}

function formatAuditStatus(status) {
  return {
    passed: '通过',
    warning: '需要复查',
    failed: '未通过',
    degraded: '降级完成',
    not_run: '未检查',
    not_applicable: '',
    advanced: '推进充分',
    needs_review: '需要复查',
    stable: '稳定',
    ok: '正常'
  }[status] || status;
}

export function buildQualityCheckState(chapterFeedback = {}) {
  const qualityCheck = normalizeQualityCheck(chapterFeedback?.quality_check);
  const statusMeta = {
    passed: {
      kind: 'success',
      title: '创作审校通过'
    },
    warning: {
      kind: 'warning',
      title: '创作审校提示复核'
    },
    failed: {
      kind: 'error',
      title: '创作审校未通过'
    },
    degraded: {
      kind: 'warning',
      title: '创作审校走了降级链路'
    },
    not_run: {
      kind: 'warning',
      title: '本章还没有正式创作审校'
    }
  }[qualityCheck.status] || {
    kind: 'warning',
    title: '创作审校状态未知'
  };

  const detailParts = [];
  if (qualityCheck.verdict) {
    detailParts.push(`判定：${qualityCheck.verdict}`);
  }
  if (qualityCheck.source && qualityCheck.source !== 'none') {
    detailParts.push(`来源：${formatQualitySource(qualityCheck.source)}`);
  }
  if (qualityCheck.degradedReason) {
    detailParts.push(`原因：${qualityCheck.degradedReason}`);
  }
  if (qualityCheck.storylineAudit.status && qualityCheck.storylineAudit.status !== 'not_applicable') {
    detailParts.push(`叙事脉络：${formatAuditStatus(qualityCheck.storylineAudit.status)}`);
  }
  if (qualityCheck.wordCountAudit.status && qualityCheck.wordCountAudit.status !== 'not_applicable') {
    detailParts.push(`字数：${formatAuditStatus(qualityCheck.wordCountAudit.status)}`);
  }

  let summary = detailParts.join(' · ');
  if (!summary) {
    summary = qualityCheck.status === 'passed'
      ? '本章摘要、创作审校和正文已形成完整回写。'
      : qualityCheck.status === 'not_run'
        ? '当前只看到正文和反馈，还没有拿到正式质检结果。'
        : '建议结合正文和反馈一起人工复核这一章。';
  }

  return {
    kind: statusMeta.kind,
    title: statusMeta.title,
    summary,
    signals: qualityCheck.signals,
    risks: [
      ...qualityCheck.risks,
      ...qualityCheck.storylineAudit.risks
    ],
    airdropItems: qualityCheck.airdropItems,
    storylineAudit: qualityCheck.storylineAudit,
    wordCountAudit: qualityCheck.wordCountAudit
  };
}

function buildStatusMeta({
  successTitle,
  successText,
  cycleResult
}) {
  const qualityStatus = cycleResult?.qualityCheck?.status || '';
  const hasCompleteFeedback = !!cycleResult?.feedbackSaved && !!cycleResult?.qualityCheckSaved;
  const needsHumanReview = Boolean(cycleResult?.qualityCheck?.needs_human_review);
  const auditFailed = hasCompleteFeedback && qualityStatus === 'failed';
  const auditWarning = hasCompleteFeedback && (qualityStatus === 'warning' || needsHumanReview);
  const isDegraded = hasCompleteFeedback
    && (
      !!cycleResult?.usedLocalFallback
      || !cycleResult?.modelFeedbackGenerated
      || qualityStatus === 'degraded'
      || qualityStatus === 'not_run'
    );

  if (cycleResult?.contentSaved && auditFailed) {
    return {
      statusKind: 'error',
      statusTitle: `${successTitle}（审校未通过）`,
      statusText: '正文已保存为待审草稿，但正式审校未通过；修复或人工确认前不应自动继续下一章。'
    };
  }

  if (cycleResult?.contentSaved && auditWarning) {
    return {
      statusKind: 'warning',
      statusTitle: `${successTitle}（需要复核）`,
      statusText: '正文与正式反馈已保存，但审校要求人工复核；确认前不应自动继续下一章。'
    };
  }

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
        ? `正文已保存，但摘要/创作审校走了降级链路：${degradedReason}。`
        : '正文已保存，但摘要/创作审校走了降级链路，建议人工复核后再继续下一章。'
    };
  }

  if (cycleResult?.contentSaved) {
    const detail = normalizeText(
      cycleResult?.storylineProgressError
      || cycleResult?.feedbackSaveError
      || cycleResult?.feedbackGenerationError
    );
    return {
      statusKind: 'warning',
      statusTitle: `${successTitle}（部分完成）`,
      statusText: detail
        ? `正文已保存，但正式反馈/摘要/质检未写回：${detail}。`
        : '正文已保存，但正式反馈/摘要/质检未写回。'
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
  const safeContent = sanitizeGeneratedText(content);
  const statusMeta = buildStatusMeta({
    successTitle,
    successText,
    cycleResult
  });

  const actualLength = countPlatformEffectiveWords(safeContent);
  const safeTarget = Number(targetWordCount || 0) || 0;
  const deviationRatio = safeTarget > 0 ? (actualLength - safeTarget) / safeTarget : 0;
  const deviationLabel = safeTarget > 0
    ? `，偏差 ${deviationRatio >= 0 ? '+' : ''}${(deviationRatio * 100).toFixed(1)}%`
    : '';

  return {
    hasContent: true,
    content: safeContent,
    statusKind: statusMeta.statusKind,
    statusTitle: statusMeta.statusTitle,
    statusText: statusMeta.statusText,
    metaText: chapterTitle,
    wordCountLabel: `${formatWordCountProgress(actualLength, targetWordCount)}${deviationLabel}`,
    previewText: safeContent.replace(/\s+/g, ' ').slice(0, 520),
    feedbackSummary: chapterFeedback?.chapter_summary || '',
    feedbackFocus: chapterFeedback?.next_chapter_focus || chapterFeedback?.open_hooks || '',
    qualityCheck: buildQualityCheckState(chapterFeedback),
    storylineProgress: chapterFeedback?.storyline_progress || null,
    storylineProgressUpdated: !!cycleResult?.storylineProgressUpdated,
    storylineProgressError: normalizeText(cycleResult?.storylineProgressError || '')
  };
}
