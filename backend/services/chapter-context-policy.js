function pickPreviousChapter(chapterRows = [], chapterNumber) {
  const rows = Array.isArray(chapterRows) ? chapterRows : [];
  const current = Number(chapterNumber);
  if (!Number.isFinite(current)) return rows[rows.length - 1] || null;
  if (current <= 1) return null;
  return [...rows].reverse().find((row) => Number(row?.chapter_number || 0) < current) || null;
}

module.exports = { pickPreviousChapter };
