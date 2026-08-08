const test = require('node:test');
const assert = require('node:assert/strict');
const {
  WORD_COUNT_POLICY,
  DEFAULT_WORD_COUNT,
  MIN_WORD_COUNT,
  MAX_WORD_COUNT,
  WORD_COUNT_TOLERANCE,
  calculateRevisionTokenBudget,
  classifyWordCountDeviation,
  isCountWithinTolerance,
  countPlatformEffectiveWords,
  clampWordCount
} = require('../services/word-count-policy');

test('前后端共享同一份字数策略', () => {
  assert.equal(WORD_COUNT_POLICY.version, '1.0.0');
  assert.equal(DEFAULT_WORD_COUNT, 3000);
  assert.equal(MIN_WORD_COUNT, 500);
  assert.equal(MAX_WORD_COUNT, 10000);
  assert.equal(WORD_COUNT_TOLERANCE, 0.15);
  assert.equal(countPlatformEffectiveWords('甲， 乙。\n丙'), 3);
  assert.equal(clampWordCount(20000), 10000);
  assert.equal(clampWordCount(100), 500);
});

test('中文扩写修订获得足够的 token 预算', () => {
  const firstBudget = calculateRevisionTokenBudget({ currentLength: 919, targetCount: 1400, draftTargetCount: 1428, needsExpansion: true });
  assert.ok(firstBudget >= 1750);
  const retryBudget = calculateRevisionTokenBudget({
    currentLength: 1092,
    targetCount: 1400,
    draftTargetCount: 1428,
    previousAttempt: { tokenBudget: firstBudget },
    needsExpansion: true
  });
  assert.ok(retryBudget > firstBudget);
});

test('字数门禁同时检查 85% 下限和 115% 上限', () => {
  assert.equal(isCountWithinTolerance(2549, 3000), false);
  assert.equal(isCountWithinTolerance(2550, 3000), true);
  assert.equal(isCountWithinTolerance(3450, 3000), true);
  assert.equal(isCountWithinTolerance(3451, 3000), false);
});

test('超出双向容差时字数审计不得通过', () => {
  assert.equal(classifyWordCountDeviation(2421, 3000), 'risky');
  assert.equal(classifyWordCountDeviation(3000, 3000), 'passed');
  assert.equal(classifyWordCountDeviation(3600, 3000), 'risky');
});
