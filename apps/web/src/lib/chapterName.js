const CHAPTER_NUMBER_PREFIX = /^第\s*[0-9０-９一二三四五六七八九十百千万零〇两]+\s*章(?:\s*[·:：\-—]\s*|\s+|(?=\S)|$)/i;

function cleanChapterNameText(value) {
  let normalized = String(value || '').trim();
  if (normalized === '[object Object]' || normalized === '[object Array]') return '';

  let previous = '';
  while (normalized && normalized !== previous && CHAPTER_NUMBER_PREFIX.test(normalized)) {
    previous = normalized;
    normalized = normalized.replace(CHAPTER_NUMBER_PREFIX, '').trim();
  }
  return normalized;
}

export function normalizeChapterName(value) {
  if (typeof value === 'string') {
    return cleanChapterNameText(value);
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
    .map((item) => (typeof item === 'string' ? cleanChapterNameText(item) : ''))
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
