const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('./judge-calibration-core');

function sample() {
  return { id: 'book:2', book_id: 'book', chapter_number: 2, title: '第二章', previous_chapter_tail: '上一章黑鸦已经被铁钉钉死。', plan: { mission: '进山' }, content: '林烬回忆黑鸦昨夜飞进院子。' };
}

function completedReview(overrides = {}) {
  return {
    ...core.emptyReview(),
    semantic_pass: false,
    severe_defect: true,
    defect_types: ['fact_continuity'],
    literary_scores: { plot_progress: 4, character_consistency: 2, dialogue: 3, pacing: 4, hook: 4, prose_naturalness: 4 },
    reviewer: 'reviewer',
    ...overrides
  };
}

test('盲标样本不包含 Judge 预测且内容变化会改变哈希', () => {
  const blind = core.createBlindSample({ ...sample(), judge_prediction: { decision: 'fail' } });
  assert.equal(Object.hasOwn(blind, 'judge_prediction'), false);
  assert.notEqual(core.computeSampleHash(sample()), core.computeSampleHash({ ...sample(), content: '不同正文' }));
});

test('双人意见不一致时必须裁决', () => {
  const blind = core.createBlindSample(sample());
  blind.reviews.reviewer_a = completedReview();
  blind.reviews.reviewer_b = completedReview({ semantic_pass: true, severe_defect: false, defect_types: [] });
  assert.equal(core.resolveGoldLabel(blind).status, 'disputed');
  blind.reviews.adjudication = completedReview({ reviewer: 'adjudicator' });
  assert.equal(core.resolveGoldLabel(blind).status, 'adjudicated');
});

test('Judge 缺少正文原句证据时预测无效', () => {
  const prediction = {
    sample_hash: core.computeSampleHash(sample()),
    decision: 'fail',
    defects: [{ code: 'fact_continuity', severity: 'high', claim: '黑鸦状态冲突', evidence: { current_quote: '正文里没有这句话', previous_quote: '' } }]
  };
  assert.equal(core.validatePrediction(sample(), prediction).valid, false);
  prediction.defects[0].evidence = { current_quote: '黑鸦昨夜飞进院子', previous_quote: '黑鸦已经被铁钉钉死' };
  assert.equal(core.validatePrediction(sample(), prediction).valid, true);
});
