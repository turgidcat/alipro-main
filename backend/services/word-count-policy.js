const WORD_COUNT_POLICY = require('../../shared/word-count-policy.json');

const DEFAULT_WORD_COUNT = WORD_COUNT_POLICY.default_target;
const MIN_WORD_COUNT = WORD_COUNT_POLICY.min_target;
const MAX_WORD_COUNT = WORD_COUNT_POLICY.max_target;
const WORD_COUNT_TOLERANCE = WORD_COUNT_POLICY.tolerance_ratio;
const MIN_WORD_RATIO = WORD_COUNT_POLICY.min_ratio;
const MAX_WORD_RATIO = WORD_COUNT_POLICY.max_ratio;

function sanitizeWordCountText(value) {
  return String(value || '')
    .replace(/\uFFFD+/g, '')
    .replace(/�+/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();
}

/**
 * 统一的“有效字数”口径：去掉乱码、空白、标点和符号后，按 Unicode code point 计数。
 */
function countPlatformEffectiveWords(value = '') {
  const text = sanitizeWordCountText(value)
    .replace(/[\s\p{Punctuation}\p{Symbol}]/gu, '');
  return Array.from(text).length;
}

function getWordCountBounds(targetCount = 0, tolerance = WORD_COUNT_TOLERANCE) {
  const target = Number(targetCount || 0) || 0;
  const normalizedTolerance = Math.max(0, Number(tolerance || 0) || 0);
  return {
    target,
    min: Math.floor(target * (1 - normalizedTolerance)),
    max: Math.ceil(target * (1 + normalizedTolerance))
  };
}

function clampWordCount(value = DEFAULT_WORD_COUNT) {
  const target = Number(value || 0) || DEFAULT_WORD_COUNT;
  return Math.min(MAX_WORD_COUNT, Math.max(MIN_WORD_COUNT, target));
}

function isCountWithinTolerance(actualCount = 0, targetCount = 0, tolerance = WORD_COUNT_TOLERANCE) {
  const actual = Number(actualCount || 0) || 0;
  const target = Number(targetCount || 0) || 0;
  if (!target || !actual) return true;
  const bounds = getWordCountBounds(target, tolerance);
  return actual >= bounds.min && actual <= bounds.max;
}

function classifyWordCountDeviation(actualCount = 0, targetCount = 0, tolerance = WORD_COUNT_TOLERANCE) {
  const actual = Number(actualCount || 0) || 0;
  const target = Number(targetCount || 0) || 0;
  if (!target || !actual) return 'not_applicable';
  return isCountWithinTolerance(actual, target, tolerance) ? 'passed' : 'risky';
}

function calculateRevisionTokenBudget({
  currentLength = 0,
  targetCount = 0,
  draftTargetCount = 0,
  previousAttempt = null,
  needsExpansion = false
} = {}) {
  const current = Math.max(1, Number(currentLength || 0) || 1);
  const target = Math.max(MIN_WORD_COUNT, Number(targetCount || 0) || MIN_WORD_COUNT);
  const draftTarget = Math.max(MIN_WORD_COUNT, Number(draftTargetCount || 0) || target);
  const desiredLength = Math.max(MIN_WORD_COUNT, Math.floor(target * WORD_COUNT_POLICY.soft_target_ratio));
  const previousBudget = Number(previousAttempt?.tokenBudget || 0) || 0;
  const proportionalBudget = previousBudget > 0
    ? Math.ceil(previousBudget * (desiredLength / current) * (needsExpansion ? WORD_COUNT_POLICY.revision.expansion_multiplier : 1))
    : Math.ceil(draftTarget * (needsExpansion
      ? WORD_COUNT_POLICY.revision.expansion_multiplier
      : WORD_COUNT_POLICY.revision.compression_multiplier));
  return Math.min(
    WORD_COUNT_POLICY.revision.token_budget_max,
    Math.max(WORD_COUNT_POLICY.revision.token_budget_min, proportionalBudget)
  );
}

module.exports = {
  WORD_COUNT_POLICY,
  DEFAULT_WORD_COUNT,
  MIN_WORD_COUNT,
  MAX_WORD_COUNT,
  WORD_COUNT_TOLERANCE,
  MIN_WORD_RATIO,
  MAX_WORD_RATIO,
  sanitizeWordCountText,
  countPlatformEffectiveWords,
  getWordCountBounds,
  clampWordCount,
  calculateRevisionTokenBudget,
  classifyWordCountDeviation,
  isCountWithinTolerance
};
