import { getWordCountBounds, WORD_COUNT_TOLERANCE } from './wordCountPolicy.js';

export function countPlatformEffectiveWords(value) {
  const text = String(value || '')
    .replace(/\uFFFD+/g, '')
    .replace(/�+/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .replace(/[\s\p{Punctuation}\p{Symbol}]/gu, '');
  return Array.from(text).length;
}

export function isWordCountWithinTolerance(actual, target, tolerance = WORD_COUNT_TOLERANCE) {
  const normalizedActual = Number(actual || 0) || 0;
  const normalizedTarget = Number(target || 0) || 0;
  if (!normalizedActual || !normalizedTarget) return true;
  const bounds = getWordCountBounds(normalizedTarget, tolerance);
  return normalizedActual >= bounds.min && normalizedActual <= bounds.max;
}

export function formatExactWordCount(value) {
  const count = Math.max(0, Number(value || 0));
  return `${count.toLocaleString('zh-CN')}字`;
}

export function formatWordCountProgress(actual, target) {
  return `有效字数 ${formatExactWordCount(actual)} / 目标 ${formatExactWordCount(target)}`;
}
