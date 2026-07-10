export function normalizeChapterName(value) {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized === '[object Object]' || normalized === '[object Array]' ? '' : normalized;
  }
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return value
      .map(normalizeChapterName)
      .filter(Boolean)
      .join(' / ')
      .trim();
  }
  if (!value || typeof value !== 'object') return '';

  const direct = [
    value.chapter_name,
    value.chapterName,
    value.name,
    value.label,
    value.title,
    value.value,
    value.text,
    value.summary
  ]
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .find(Boolean);

  if (direct) return direct;

  return Object.values(value)
    .map(normalizeChapterName)
    .filter(Boolean)
    .join(' / ')
    .trim();
}

export function formatChapterLabel(chapterNumber, chapterName = '', separator = ' · ') {
  const normalizedNumber = Math.max(1, Number(chapterNumber || 1));
  const normalizedName = normalizeChapterName(chapterName);
  return normalizedName
    ? `第 ${normalizedNumber} 章${separator}${normalizedName}`
    : `第 ${normalizedNumber} 章`;
}
