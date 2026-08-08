const express = require('express');
const dbPromise = require('../database/init');
const {
  execQuery,
  execQueryOne,
  generateId,
  saveDatabase
} = require('../services/database');
const {
  DEFECT_TYPES,
  LITERARY_DIMENSIONS,
  assignSplit,
  computeDatasetHash,
  createBlindSample,
  isCompleteReview,
  resolveGoldLabel,
  scoreRows
} = require('../harness/judge-calibration-core');

const router = express.Router();
const REVIEWERS = new Set(['reviewer_a', 'reviewer_b', 'adjudicator']);

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch (_) {
    return fallback;
  }
}

function normalizeReview(review = {}, reviewer = '') {
  const scores = Object.fromEntries(LITERARY_DIMENSIONS.map((key) => [key, Number(review?.literary_scores?.[key]) || null]));
  const evidence = Array.isArray(review.evidence)
    ? review.evidence.slice(0, 8).map((item) => ({
      source: item?.source === 'previous' ? 'previous' : 'current',
      quote: String(item?.quote || '').trim().slice(0, 500),
      note: String(item?.note || '').trim().slice(0, 500)
    })).filter((item) => item.quote || item.note)
    : [];
  return {
    semantic_pass: typeof review.semantic_pass === 'boolean' ? review.semantic_pass : null,
    severe_defect: typeof review.severe_defect === 'boolean' ? review.severe_defect : null,
    defect_types: [...new Set((Array.isArray(review.defect_types) ? review.defect_types : []).filter((item) => DEFECT_TYPES.includes(String(item))))],
    literary_scores: scores,
    evidence,
    notes: String(review.notes || '').trim().slice(0, 3000),
    reviewer
  };
}

function validateReview(review, sample) {
  const errors = [];
  if (typeof review.semantic_pass !== 'boolean') errors.push('semantic_pass_required');
  if (typeof review.severe_defect !== 'boolean') errors.push('severe_defect_required');
  if (review.semantic_pass === false && review.defect_types.length === 0) errors.push('defect_type_required');
  if (review.semantic_pass === false && review.evidence.filter((item) => item.quote).length === 0) errors.push('evidence_required_for_defect');
  for (const key of LITERARY_DIMENSIONS) {
    if (!Number.isInteger(Number(review?.literary_scores?.[key])) || Number(review.literary_scores[key]) < 1 || Number(review.literary_scores[key]) > 5) {
      errors.push(`literary_score_required:${key}`);
    }
  }
  for (const item of review.evidence || []) {
    if (item.source === 'current' && item.quote && !String(sample.content || '').includes(item.quote)) errors.push('evidence_not_found_in_content');
    if (item.source === 'previous' && item.quote && !String(sample.previous_chapter_tail || '').includes(item.quote)) errors.push('evidence_not_found_in_previous');
  }
  return errors;
}

function buildRawSample(db, bookId, chapterNumber) {
  const chapter = execQueryOne(db, `SELECT chapter_number, title, content FROM chapters WHERE book_id = ? AND chapter_number = ? LIMIT 1`, [bookId, chapterNumber]);
  if (!chapter) return null;
  const plan = execQueryOne(db, `SELECT chapter_number, chapter_name, chapter_mission, outline_text, appearing_roles, structured_content
    FROM chapter_plans WHERE book_id = ? AND chapter_number = ? ORDER BY updated_at DESC LIMIT 1`, [bookId, chapterNumber]) || {};
  const previous = execQueryOne(db, `SELECT content FROM chapters WHERE book_id = ? AND chapter_number = ? LIMIT 1`, [bookId, chapterNumber - 1]);
  const structured = parseJson(plan.structured_content, {});
  return {
    id: `${bookId}:${chapterNumber}`,
    book_id: bookId,
    chapter_number: Number(chapterNumber),
    title: chapter.title || plan.chapter_name || '',
    previous_chapter_tail: String(previous?.content || '').slice(-2000),
    plan: {
      mission: plan.chapter_mission || '',
      outline: plan.outline_text || '',
      appearing_roles: parseJson(plan.appearing_roles, []),
      storyline_context: structured.storyline_context || {}
    },
    content: chapter.content || ''
  };
}

function attachOwnReview(db, sample, reviewer) {
  const row = reviewer ? execQueryOne(db, `SELECT review_json FROM calibration_reviews WHERE book_id = ? AND sample_id = ? AND reviewer = ?`, [sample.book_id, sample.id, reviewer]) : null;
  const result = createBlindSample(sample);
  if (row) result.reviews[reviewer] = parseJson(row.review_json, {});
  if (reviewer === 'adjudicator') {
    for (const independentReviewer of ['reviewer_a', 'reviewer_b']) {
      const independentRow = execQueryOne(db, `SELECT review_json FROM calibration_reviews WHERE book_id = ? AND sample_id = ? AND reviewer = ?`, [sample.book_id, sample.id, independentReviewer]);
      if (independentRow) result.reviews[independentReviewer] = parseJson(independentRow.review_json, {});
    }
  }
  return result;
}

function loadSamples(db, bookId, from = 1, to = 50, reviewer = '') {
  const chapters = execQuery(db, `SELECT chapter_number FROM chapters WHERE book_id = ? AND chapter_number BETWEEN ? AND ? ORDER BY chapter_number`, [bookId, from, to]);
  return chapters.map((row) => buildRawSample(db, bookId, Number(row.chapter_number))).filter(Boolean).map((sample) => attachOwnReview(db, sample, reviewer));
}

function loadReview(db, bookId, sampleId, reviewer) {
  const row = execQueryOne(db, `SELECT review_json FROM calibration_reviews WHERE book_id = ? AND sample_id = ? AND reviewer = ?`, [bookId, sampleId, reviewer]);
  return row ? parseJson(row.review_json, {}) : null;
}

router.get('/samples', async (req, res) => {
  try {
    const bookId = String(req.query.bookId || '').trim();
    const reviewer = String(req.query.reviewer || 'reviewer_a').trim();
    if (!bookId) return res.status(400).json({ success: false, error: 'bookId 必填' });
    if (!REVIEWERS.has(reviewer)) return res.status(400).json({ success: false, error: 'reviewer 无效' });
    const db = await dbPromise;
    const from = Math.max(1, Number(req.query.from || 1) || 1);
    const to = Math.max(from, Number(req.query.to || 50) || 50);
    const samples = loadSamples(db, bookId, from, to, reviewer);
    const reviewed = samples.filter((sample) => isCompleteReview(sample.reviews[reviewer])).length;
    return res.json({ success: true, data: { samples, progress: { total: samples.length, reviewed, reviewer } } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/reviews', async (req, res) => {
  try {
    const bookId = String(req.body?.bookId || '').trim();
    const sampleId = String(req.body?.sampleId || '').trim();
    const reviewer = String(req.body?.reviewer || '').trim();
    if (!bookId || !sampleId || !REVIEWERS.has(reviewer)) return res.status(400).json({ success: false, error: 'bookId、sampleId、reviewer 必填且有效' });
    const db = await dbPromise;
    const chapterNumber = Number(sampleId.split(':').pop());
    const raw = buildRawSample(db, bookId, chapterNumber);
    if (!raw || raw.id !== sampleId) return res.status(404).json({ success: false, error: '盲标样本不存在' });
    const sample = createBlindSample(raw);
    if (String(req.body.sampleHash || '') !== sample.sample_hash) return res.status(409).json({ success: false, error: '样本已变化，请刷新后重试' });
    const review = normalizeReview(req.body.review || {}, reviewer);
    const errors = validateReview(review, sample);
    if (errors.length || !isCompleteReview(review)) return res.status(400).json({ success: false, error: '标注尚未完整', details: errors });
    const existing = execQueryOne(db, `SELECT id FROM calibration_reviews WHERE book_id = ? AND sample_id = ? AND reviewer = ?`, [bookId, sampleId, reviewer]);
    if (existing) {
      db.run(`UPDATE calibration_reviews SET sample_hash = ?, review_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [sample.sample_hash, JSON.stringify(review), existing.id]);
    } else {
      db.run(`INSERT INTO calibration_reviews (id, book_id, sample_id, sample_hash, reviewer, review_json) VALUES (?, ?, ?, ?, ?, ?)`, [generateId(), bookId, sampleId, sample.sample_hash, reviewer, JSON.stringify(review)]);
    }
    saveDatabase(db);
    return res.json({ success: true, data: { sampleId, reviewer, review } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metrics', async (req, res) => {
  try {
    const bookId = String(req.query.bookId || '').trim();
    if (!bookId) return res.status(400).json({ success: false, error: 'bookId 必填' });
    const db = await dbPromise;
    const samples = loadSamples(db, bookId, 1, 10000, '');
    const fullSamples = samples.map((sample) => {
      const result = createBlindSample(sample);
      for (const reviewer of REVIEWERS) result.reviews[reviewer] = loadReview(db, bookId, sample.id, reviewer) || result.reviews[reviewer];
      return result;
    });
    const statusCounts = { agreed: 0, adjudicated: 0, disputed: 0, incomplete: 0 };
    const resolved = [];
    fullSamples.forEach((sample) => {
      const resolution = resolveGoldLabel(sample);
      statusCounts[resolution.status] += 1;
      if (resolution.label) resolved.push({ sample, gold: resolution.label, split: assignSplit(sample) });
    });
    const progress = { total: fullSamples.length, reviewerA: fullSamples.filter((s) => isCompleteReview(s.reviews.reviewer_a)).length, reviewerB: fullSamples.filter((s) => isCompleteReview(s.reviews.reviewer_b)).length, ...statusCounts };
    if (String(req.query.reveal || '').toLowerCase() !== 'true') return res.json({ success: true, data: { reveal: false, progress } });
    const rows = resolved.map((row) => {
      const run = execQueryOne(db, `SELECT judge_normalized_json, gate_decision, model, prompt_version FROM generation_runs WHERE book_id = ? AND chapter_number = ? ORDER BY created_at DESC LIMIT 1`, [bookId, row.sample.chapter_number]);
      const judge = parseJson(run?.judge_normalized_json, {});
      const decision = judge.verdict === 'stable' && run?.gate_decision === 'passed' ? 'pass' : (judge.verdict === 'risky' ? 'fail' : 'review');
      return { ...row, prediction: { decision, defects: [] }, judge: { verdict: judge.verdict || '', risks: Array.isArray(judge.risks) ? judge.risks : [], model: run?.model || '', prompt_version: run?.prompt_version || '' } };
    });
    const score = scoreRows(rows);
    return res.json({ success: true, data: { reveal: true, progress, score, rows: rows.map(({ sample, gold, prediction, judge, split }) => ({ id: sample.id, chapter_number: sample.chapter_number, title: sample.title, split, gold, prediction, judge })) } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const bookId = String(req.query.bookId || '').trim();
    if (!bookId) return res.status(400).json({ success: false, error: 'bookId 必填' });
    const db = await dbPromise;
    const samples = loadSamples(db, bookId, 1, 10000, '');
    const packetSamples = samples.map((sample) => {
      const result = createBlindSample(sample);
      for (const reviewer of REVIEWERS) result.reviews[reviewer] = loadReview(db, bookId, sample.id, reviewer) || result.reviews[reviewer];
      return result;
    });
    return res.json({ success: true, data: { schema_version: 2, generated_at: new Date().toISOString(), book_id: bookId, dataset_hash: computeDatasetHash(packetSamples), defect_types: DEFECT_TYPES, samples: packetSamples } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
