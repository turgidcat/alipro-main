import policy from '../../../shared/word-count-policy.json' with { type: 'json' };

export const WORD_COUNT_POLICY = Object.freeze(policy);
export const DEFAULT_WORD_COUNT = policy.default_target;
export const MIN_WORD_COUNT = policy.min_target;
export const MAX_WORD_COUNT = policy.max_target;
export const WORD_COUNT_TOLERANCE = policy.tolerance_ratio;

export function getWordCountBounds(target = 0, tolerance = WORD_COUNT_TOLERANCE) {
  const normalizedTarget = Number(target || 0) || 0;
  const normalizedTolerance = Math.max(0, Number(tolerance || 0) || 0);
  return {
    target: normalizedTarget,
    min: Math.floor(normalizedTarget * (1 - normalizedTolerance)),
    max: Math.ceil(normalizedTarget * (1 + normalizedTolerance))
  };
}

export function clampWordCount(value) {
  const target = Number(value || 0) || DEFAULT_WORD_COUNT;
  return Math.min(MAX_WORD_COUNT, Math.max(MIN_WORD_COUNT, target));
}
