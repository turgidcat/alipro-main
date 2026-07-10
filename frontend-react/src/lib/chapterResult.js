import { mergeFeedbackIntoPlan } from './chapterBundle.js';
import { buildLocalChapterFeedback } from './revisionDiff.js';
import { normalizeChapterName } from './chapterName.js';

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeQualityCheck(value = {}) {
  const normalized = value && typeof value === 'object' ? value : {};
  const allowedStatus = new Set(['passed', 'warning', 'failed', 'degraded', 'not_run']);
  const allowedSource = new Set(['model_audit', 'heuristic', 'local_fallback', 'none']);
  const status = normalizeText(normalized.status);
  const source = normalizeText(normalized.source);
  const checkedAt = normalizeText(normalized.checked_at || normalized.checkedAt);
  const degradedReason = normalizeText(normalized.degraded_reason || normalized.degradedReason);

  return {
    status: allowedStatus.has(status) ? status : 'not_run',
    source: allowedSource.has(source) ? source : 'none',
    verdict: normalizeText(normalized.verdict),
    signals: normalizeArray(normalized.signals).map((item) => normalizeText(item)).filter(Boolean),
    airdrop_items: normalizeArray(normalized.airdrop_items).map((item) => {
      if (!item || typeof item !== 'object') return null;
      const normalizedItem = {
        name: normalizeText(item.name),
        type: normalizeText(item.type),
        severity: normalizeText(item.severity),
        reason: normalizeText(item.reason),
        suggestion: normalizeText(item.suggestion)
      };
      return normalizedItem.name || normalizedItem.reason ? normalizedItem : null;
    }).filter(Boolean),
    risks: normalizeArray(normalized.risks).map((item) => normalizeText(item)).filter(Boolean),
    checked_at: checkedAt || new Date().toISOString(),
    degraded_reason: degradedReason || null
  };
}

function mapAuditVerdictToStatus(verdict = '') {
  const normalized = normalizeText(verdict).toLowerCase();
  if (normalized === 'stable') return 'passed';
  if (normalized === 'needs_review') return 'warning';
  if (normalized === 'risky') return 'failed';
  return 'not_run';
}

function buildQualityCheckFromAudit(generationAudit = {}, overrides = {}) {
  const audit = generationAudit && typeof generationAudit === 'object' ? generationAudit : {};
  return normalizeQualityCheck({
    status: overrides.status || mapAuditVerdictToStatus(audit.verdict),
    source: overrides.source || normalizeText(audit.source) || 'none',
    verdict: overrides.verdict ?? normalizeText(audit.verdict),
    signals: normalizeArray(overrides.signals || audit.signals),
    airdrop_items: normalizeArray(overrides.airdrop_items || audit.airdrop_items),
    risks: normalizeArray(overrides.risks || audit.risks),
    checked_at: overrides.checked_at || new Date().toISOString(),
    degraded_reason: overrides.degraded_reason || null
  });
}

function buildLocalFallbackQualityCheck(generationAudit = {}, degradedReason = '') {
  const hasAuditPayload = generationAudit
    && typeof generationAudit === 'object'
    && (
      normalizeText(generationAudit.verdict)
      || normalizeArray(generationAudit.signals).length > 0
      || normalizeArray(generationAudit.risks).length > 0
      || normalizeArray(generationAudit.airdrop_items).length > 0
    );

  if (!hasAuditPayload) {
    return normalizeQualityCheck({
      status: 'not_run',
      source: 'none',
      verdict: '',
      signals: [],
      airdrop_items: [],
      risks: [],
      checked_at: new Date().toISOString(),
      degraded_reason: degradedReason || 'feedback_generation_failed'
    });
  }

  return buildQualityCheckFromAudit(generationAudit, {
    status: 'degraded',
    source: 'local_fallback',
    degraded_reason: degradedReason || 'feedback_generation_failed'
  });
}

function canPersistFormalFeedback(feedback = {}) {
  const normalizedFeedback = feedback && typeof feedback === 'object' ? feedback : {};
  const normalizedSource = normalizeText(normalizedFeedback.source);
  const qualityCheck = normalizeQualityCheck(normalizedFeedback.quality_check || {});

  if (normalizedSource !== 'model_feedback') return false;
  if (!qualityCheck) return false;
  if (qualityCheck.source === 'local_fallback' || qualityCheck.source === 'none') return false;
  if (qualityCheck.status === 'degraded' || qualityCheck.status === 'not_run') return false;
  return true;
}

function ensureFeedbackQualityCheck(feedback, { generationAudit, usedLocalFallback = false, degradedReason = '' } = {}) {
  const normalizedFeedback = feedback && typeof feedback === 'object' ? { ...feedback } : {};
  const existingQualityCheck = normalizedFeedback.quality_check
    ? normalizeQualityCheck(normalizedFeedback.quality_check)
    : null;

  if (usedLocalFallback) {
    normalizedFeedback.source = 'local_fallback';
    normalizedFeedback.quality_check = buildLocalFallbackQualityCheck(generationAudit, degradedReason);
    return normalizedFeedback;
  }

  normalizedFeedback.source = normalizeText(normalizedFeedback.source) || 'model_feedback';
  normalizedFeedback.quality_check = existingQualityCheck || buildQualityCheckFromAudit(generationAudit);
  return normalizedFeedback;
}

export async function persistChapterResultCycle({
  bookId,
  chapterNumber,
  content,
  normalizedPlan,
  chapterStructure,
  chapterTitle,
  mainStorylineLabel,
  targetStorylineLabel,
  rhythmHints,
  generationAudit,
  generateChapterFeedback,
  saveChapterPlan,
  upsertGeneratedChapter
}) {
  const cycleResult = {
    contentSaved: false,
    modelFeedbackGenerated: false,
    feedbackSaved: false,
    qualityCheckSaved: false,
    usedLocalFallback: false,
    feedbackGenerationError: '',
    feedbackSaveError: '',
    storylineProgressUpdated: false,
    storylineProgressError: '',
    storylineProgress: null,
    chapterFeedback: null,
    feedbackPlan: null,
    qualityCheck: null
  };

  await upsertGeneratedChapter(bookId, {
    title: chapterTitle,
    chapterName: normalizeChapterName(normalizedPlan.chapter_name || ''),
    chapterNumber,
    content
  });
  cycleResult.contentSaved = true;

  const outline = normalizeText(normalizedPlan.outline_text);
  let feedbackResponse = null;

  try {
    feedbackResponse = await generateChapterFeedback({
      bookId,
      chapterNumber,
      chapterTitle,
      content,
      outline
    });
  } catch (error) {
    cycleResult.feedbackGenerationError = error.message;
  }

  if (feedbackResponse?.feedback) {
    const metadata = feedbackResponse.metadata || {};
    cycleResult.usedLocalFallback = !!metadata.usedLocalFallback;
    cycleResult.modelFeedbackGenerated = !cycleResult.usedLocalFallback && metadata.feedbackGenerated !== false;
    cycleResult.chapterFeedback = ensureFeedbackQualityCheck(feedbackResponse.feedback, {
      generationAudit,
      usedLocalFallback: cycleResult.usedLocalFallback,
      degradedReason: metadata.degradedReason || ''
    });
    const canPersistFeedback = canPersistFormalFeedback(cycleResult.chapterFeedback);
    cycleResult.feedbackSaved = canPersistFeedback && !!metadata.feedbackSaved;
    cycleResult.qualityCheckSaved = canPersistFeedback && !!metadata.qualityCheckSaved;
    cycleResult.storylineProgressUpdated = !!metadata.storylineProgressUpdated;
    cycleResult.storylineProgressError = normalizeText(metadata.storylineProgressError || '');
    cycleResult.storylineProgress = metadata.storylineProgress || cycleResult.chapterFeedback?.storyline_progress || null;
  } else {
    cycleResult.usedLocalFallback = true;
    cycleResult.chapterFeedback = ensureFeedbackQualityCheck(
      buildLocalChapterFeedback({
        content,
        plan: normalizedPlan,
        chapterStructure,
        mainStorylineLabel,
        targetStorylineLabel,
        rhythmHints
      }),
      {
        generationAudit,
        usedLocalFallback: true,
        degradedReason: cycleResult.feedbackGenerationError || 'feedback_generation_failed'
      }
    );
    cycleResult.feedbackSaved = false;
    cycleResult.qualityCheckSaved = false;
    cycleResult.storylineProgressUpdated = false;
    cycleResult.storylineProgress = cycleResult.chapterFeedback?.storyline_progress || null;
  }

  cycleResult.qualityCheck = cycleResult.chapterFeedback?.quality_check || null;

  const canPersistFeedback = canPersistFormalFeedback(cycleResult.chapterFeedback);
  const needsLocalPersistence = canPersistFeedback && !cycleResult.feedbackSaved;
  cycleResult.feedbackPlan = canPersistFeedback
    ? mergeFeedbackIntoPlan(normalizedPlan, cycleResult.chapterFeedback)
    : null;

  if (needsLocalPersistence) {
    try {
      await saveChapterPlan(bookId, chapterNumber, cycleResult.feedbackPlan);
      cycleResult.feedbackSaved = true;
      cycleResult.qualityCheckSaved = !!cycleResult.chapterFeedback?.quality_check;
    } catch (error) {
      cycleResult.feedbackSaveError = error.message;
    }
  }

  return cycleResult;
}
