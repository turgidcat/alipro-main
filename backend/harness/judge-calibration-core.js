const crypto = require('crypto');

const DEFECT_TYPES = [
  'text_integrity',
  'chapter_handoff',
  'fact_continuity',
  'character_continuity',
  'plan_mission',
  'outline_coverage',
  'forbidden_event',
  'summary_fidelity',
  'pacing',
  'dialogue',
  'prose_naturalness',
  'repetition',
  'ending_hook'
];

const LITERARY_DIMENSIONS = [
  'plot_progress',
  'character_consistency',
  'dialogue',
  'pacing',
  'hook',
  'prose_naturalness'
];

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = stableValue(value[key]);
    return result;
  }, {});
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function samplePayload(sample = {}) {
  return {
    id: String(sample.id || ''),
    book_id: String(sample.book_id || ''),
    chapter_number: Number(sample.chapter_number || 0),
    title: String(sample.title || ''),
    previous_chapter_tail: String(sample.previous_chapter_tail || ''),
    plan: stableValue(sample.plan || {}),
    content: String(sample.content || '')
  };
}

function computeSampleHash(sample = {}) {
  return sha256(JSON.stringify(stableValue(samplePayload(sample))));
}

function assignSplit(sample = {}) {
  const hash = computeSampleHash(sample);
  return Number.parseInt(hash.slice(0, 8), 16) % 10 < 3 ? 'holdout' : 'development';
}

function computeDatasetHash(samples = []) {
  const rows = samples.map((sample) => ({ id: String(sample.id || ''), sample_hash: computeSampleHash(sample) }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return sha256(JSON.stringify(rows));
}

function emptyReview() {
  return {
    semantic_pass: null,
    severe_defect: null,
    defect_types: [],
    literary_scores: Object.fromEntries(LITERARY_DIMENSIONS.map((item) => [item, null])),
    evidence: [],
    notes: '',
    reviewer: ''
  };
}

function createBlindSample(sample = {}) {
  return {
    ...samplePayload(sample),
    sample_hash: computeSampleHash(sample),
    reviews: {
      reviewer_a: emptyReview(),
      reviewer_b: emptyReview(),
      adjudication: emptyReview()
    }
  };
}

function isCompleteReview(review = {}) {
  return typeof review.semantic_pass === 'boolean'
    && typeof review.severe_defect === 'boolean'
    && String(review.reviewer || '').trim().length > 0
    && LITERARY_DIMENSIONS.every((item) => Number(review?.literary_scores?.[item]) >= 1 && Number(review?.literary_scores?.[item]) <= 5);
}

function normalizeTypes(value = []) {
  return [...new Set((Array.isArray(value) ? value : []).map(String).filter((item) => DEFECT_TYPES.includes(item)))].sort();
}

function resolveGoldLabel(sample = {}) {
  const reviews = sample.reviews || {};
  const left = reviews.reviewer_a || {};
  const right = reviews.reviewer_b || {};
  if (!isCompleteReview(left) || !isCompleteReview(right)) return { status: 'incomplete', label: null };
  const sameDecision = left.semantic_pass === right.semantic_pass && left.severe_defect === right.severe_defect;
  if (!sameDecision) {
    const adjudication = reviews.adjudication || {};
    return isCompleteReview(adjudication)
      ? { status: 'adjudicated', label: { ...adjudication, defect_types: normalizeTypes(adjudication.defect_types) } }
      : { status: 'disputed', label: null };
  }
  const scores = Object.fromEntries(LITERARY_DIMENSIONS.map((item) => [
    item,
    Number(((Number(left.literary_scores[item]) + Number(right.literary_scores[item])) / 2).toFixed(2))
  ]));
  return {
    status: 'agreed',
    label: {
      semantic_pass: left.semantic_pass,
      severe_defect: left.severe_defect,
      defect_types: normalizeTypes([...normalizeTypes(left.defect_types), ...normalizeTypes(right.defect_types)]),
      literary_scores: scores,
      evidence: [...(left.evidence || []), ...(right.evidence || [])],
      notes: [left.notes, right.notes].filter(Boolean).join(' | '),
      reviewer: `${left.reviewer}+${right.reviewer}`
    }
  };
}

function validatePrediction(sample = {}, prediction = {}) {
  const errors = [];
  if (prediction.sample_hash !== computeSampleHash(sample)) errors.push('sample_hash_mismatch');
  if (!['pass', 'review', 'fail'].includes(String(prediction.decision || ''))) errors.push('invalid_decision');
  const defects = Array.isArray(prediction.defects) ? prediction.defects : [];
  if (prediction.decision === 'pass' && defects.length > 0) errors.push('pass_with_defects');
  if (prediction.decision !== 'pass' && defects.length === 0) errors.push('non_pass_without_defects');
  for (const defect of defects) {
    if (!DEFECT_TYPES.includes(String(defect.code || ''))) errors.push(`invalid_defect_code:${defect.code || ''}`);
    if (!['low', 'medium', 'high', 'block'].includes(String(defect.severity || ''))) errors.push(`invalid_severity:${defect.severity || ''}`);
    if (!String(defect.claim || '').trim()) errors.push('missing_claim');
    const currentQuote = String(defect?.evidence?.current_quote || '').trim();
    const previousQuote = String(defect?.evidence?.previous_quote || '').trim();
    if (!currentQuote && !previousQuote) errors.push(`missing_evidence:${defect.code || ''}`);
    if (currentQuote && !String(sample.content || '').includes(currentQuote)) errors.push(`current_evidence_not_found:${defect.code || ''}`);
    if (previousQuote && !String(sample.previous_chapter_tail || '').includes(previousQuote)) errors.push(`previous_evidence_not_found:${defect.code || ''}`);
  }
  return { valid: errors.length === 0, errors };
}

function divide(numerator, denominator) {
  return denominator ? Number((numerator / denominator).toFixed(4)) : null;
}

function scoreRows(rows = []) {
  let tp = 0; let fp = 0; let tn = 0; let fn = 0; let severeFalseNegatives = 0;
  const disagreements = [];
  for (const row of rows) {
    const humanDefect = !row.gold.semantic_pass;
    const judgeDefect = row.prediction.decision !== 'pass';
    if (humanDefect && judgeDefect) tp += 1;
    else if (!humanDefect && judgeDefect) fp += 1;
    else if (!humanDefect && !judgeDefect) tn += 1;
    else {
      fn += 1;
      if (row.gold.severe_defect) severeFalseNegatives += 1;
    }
    if (humanDefect !== judgeDefect) disagreements.push({ id: row.sample.id, human_defect: humanDefect, judge_defect: judgeDefect });
  }
  return {
    samples: rows.length,
    confusion_matrix: { true_positive: tp, false_positive: fp, true_negative: tn, false_negative: fn },
    defect_precision: divide(tp, tp + fp),
    defect_recall: divide(tp, tp + fn),
    false_positive_rate: divide(fp, fp + tn),
    false_negative_rate: divide(fn, fn + tp),
    severe_false_negatives: severeFalseNegatives,
    disagreements
  };
}

module.exports = {
  DEFECT_TYPES,
  LITERARY_DIMENSIONS,
  assignSplit,
  computeDatasetHash,
  computeSampleHash,
  createBlindSample,
  emptyReview,
  isCompleteReview,
  resolveGoldLabel,
  scoreRows,
  validatePrediction
};
