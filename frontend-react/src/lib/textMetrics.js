export function countPlatformEffectiveWords(value) {
  const text = String(value || '')
    .replace(/\uFFFD+/g, '')
    .replace(/�+/g, '')
    .trim()
    .replace(/[\s\p{Punctuation}\p{Symbol}]/gu, '');
  return Array.from(text).length;
}

export function formatExactWordCount(value) {
  const count = Math.max(0, Number(value || 0));
  return `${count.toLocaleString('zh-CN')}字`;
}

export function formatWordCountProgress(actual, target) {
  return `有效字数 ${formatExactWordCount(actual)} / 目标 ${formatExactWordCount(target)}`;
}
