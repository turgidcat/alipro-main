const test = require('node:test');
const assert = require('node:assert/strict');

const { DEFAULT_DATABASE_PATH } = require('../config/runtime');
const { assertIsolatedGenerateMode, evaluateChapterSnapshot } = require('../verify-batch-generation');

function createSnapshot(overrides = {}) {
  const qualityCheck = {
    status: 'passed',
    source: 'model_audit',
    verdict: 'stable',
    needsHumanReview: false,
    planAnchorAudit: { status: 'passed' },
    storylineAudit: {
      status: 'not_applicable',
      usedStorylineIds: [],
      usedBeatIds: [],
      requiresReview: false
    },
    wordCountAudit: { status: 'passed', target: 2000, actual: 1980 },
    ...(overrides.qualityCheck || {})
  };
  return {
    chapter: { content: '这是完整正文。' },
    plan: { chapter_name: '基准章', main_storyline_id: '', target_storylines: '[]' },
    feedback: { chapter_summary: '本章完成目标。' },
    feedbackSource: 'model_feedback',
    storylineContext: {},
    storylineProgress: null,
    storylineRows: [],
    ...overrides,
    qualityCheck
  };
}

test('正式模型审计全部通过时返回 ok', () => {
  const result = evaluateChapterSnapshot(1, createSnapshot());
  assert.equal(result.status, 'ok');
  assert.equal(result.qualityGreen, true);
  assert.equal(result.wordCountAuditOk, true);
});

test('质量状态 failed 不得假绿', () => {
  const result = evaluateChapterSnapshot(1, createSnapshot({
    qualityCheck: { status: 'failed', verdict: 'risky' }
  }));
  assert.equal(result.status, 'missing_required_link');
  assert.equal(result.formalQualityCheckOk, true);
  assert.equal(result.qualityGreen, false);
});

test('需要人工复核时不得自动通过', () => {
  const result = evaluateChapterSnapshot(1, createSnapshot({
    qualityCheck: { needsHumanReview: true }
  }));
  assert.equal(result.status, 'missing_required_link');
  assert.equal(result.needsHumanReview, true);
});

test('计划锚点跳过时不得自动通过', () => {
  const result = evaluateChapterSnapshot(1, createSnapshot({
    qualityCheck: { planAnchorAudit: { status: 'skipped' } }
  }));
  assert.equal(result.status, 'missing_required_link');
  assert.equal(result.planAnchorAuditOk, false);
});

test('剧情线 needs_review 不得等价于推进通过', () => {
  const result = evaluateChapterSnapshot(1, createSnapshot({
    plan: { chapter_name: '剧情线章', main_storyline_id: 'story-1', target_storylines: '[]' },
    storylineContext: { usedStorylineIds: ['story-1'], usedBeatIds: ['beat-1'] },
    storylineProgress: { summary: '推进摘要' },
    storylineRows: [{ chapterProgressNumbers: [1], lastUpdatedChapterNumber: 1 }],
    qualityCheck: {
      storylineAudit: {
        status: 'needs_review',
        usedStorylineIds: ['story-1'],
        usedBeatIds: ['beat-1'],
        requiresReview: true
      }
    }
  }));
  assert.equal(result.status, 'missing_required_link');
  assert.equal(result.storylineQualityOk, false);
});

test('字数审计缺失时不得自动通过', () => {
  const result = evaluateChapterSnapshot(1, createSnapshot({
    qualityCheck: { wordCountAudit: { status: 'not_run' } }
  }));
  assert.equal(result.status, 'missing_required_link');
  assert.equal(result.wordCountAuditOk, false);
});

test('generate 模式缺少隔离标记时必须拒绝', () => {
  assert.throws(
    () => assertIsolatedGenerateMode({ NOVEL_DB_PATH: 'temporary.db' }),
    /隔离 Harness/
  );
});

test('generate 模式不得把正式数据库伪装成隔离库', () => {
  assert.throws(
    () => assertIsolatedGenerateMode({ HARNESS_ISOLATED: '1', NOVEL_DB_PATH: DEFAULT_DATABASE_PATH }),
    /拒绝写入正式数据库/
  );
});

test('generate 模式允许显式隔离数据库', () => {
  assert.doesNotThrow(() => assertIsolatedGenerateMode({
    HARNESS_ISOLATED: '1',
    NOVEL_DB_PATH: `${DEFAULT_DATABASE_PATH}.harness-test`
  }));
});
