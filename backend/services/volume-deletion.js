function rows(db, sql, params) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const result = [];
    while (stmt.step()) result.push(stmt.getAsObject());
    return result;
  } finally { stmt.free(); }
}

function fail(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function inspectVolumeDeletion(db, bookId, volumeNumber, userId) {
  const plan = rows(db, 'SELECT * FROM volume_plans WHERE book_id = ? AND volume_number = ? AND user_id = ?', [bookId, volumeNumber, userId])[0];
  if (!plan) fail('分卷不存在，请刷新后重试。', 404);
  const count = (table) => rows(db, 'SELECT COUNT(*) AS count FROM ' + table + ' WHERE book_id = ? AND volume_number = ?', [bookId, volumeNumber])[0].count;
  const chapterCount = count('chapter_plans');
  // 正文没有独立卷号；缺少章节规划时不能可靠判断归属，禁止猜测并删除。
  const unassignedChapterCount = rows(db, 'SELECT COUNT(*) AS count FROM chapters c WHERE c.book_id = ? AND NOT EXISTS (SELECT 1 FROM chapter_plans p WHERE p.book_id = c.book_id AND p.chapter_number = c.chapter_number)', [bookId])[0].count;
  const storylineIds = new Set(rows(db, 'SELECT id FROM storylines WHERE book_id = ? AND volume_number = ?', [bookId, volumeNumber]).map((item) => item.id));
  const referencedElsewhere = rows(db, 'SELECT main_storyline_id, target_storylines FROM chapter_plans WHERE book_id = ? AND volume_number != ?', [bookId, volumeNumber]).some((item) => {
    if (storylineIds.has(item.main_storyline_id)) return true;
    try { return JSON.parse(item.target_storylines || '[]').some((id) => storylineIds.has(typeof id === 'string' ? id : id?.id || id?.storyline_id)); }
    catch (_) { return [...storylineIds].some((id) => String(item.target_storylines).includes(id)); }
  });
  const blockedReason = chapterCount > 0
    ? '本卷已有 ' + chapterCount + ' 条章节规划或细纲，请先在“章节与正文”中处理章节归属，再删除本卷。'
    : unassignedChapterCount > 0
      ? '本书有 ' + unassignedChapterCount + ' 章正文尚未关联章节规划，无法确认卷归属。请先补齐归属后再删卷。'
      : referencedElsewhere ? '其他卷的章节仍引用本卷剧情线，请先调整这些章节的剧情线关联。' : '';
  return {
    volumeId: plan.id,
    volumeNumber,
    volumeName: plan.volume_name || '未命名分卷',
    chapterCount,
    unassignedChapterCount,
    storylineCount: storylineIds.size,
    timelineCount: count('volume_timelines'),
    laterVolumeCount: rows(db, 'SELECT COUNT(*) AS count FROM volume_plans WHERE book_id = ? AND user_id = ? AND volume_number > ?', [bookId, userId, volumeNumber])[0].count,
    blockedReason,
    canDelete: !blockedReason
  };
}

function deleteEmptyVolume(db, bookId, volumeNumber, userId, expectedVolumeId) {
  db.run('BEGIN TRANSACTION');
  try {
    const preview = inspectVolumeDeletion(db, bookId, volumeNumber, userId);
    if (expectedVolumeId && preview.volumeId !== expectedVolumeId) fail('分卷顺序已变化，请关闭确认框并刷新后重试。', 409);
    if (!preview.canDelete) fail(preview.blockedReason, 409);
    db.run('DELETE FROM volume_plans WHERE id = ? AND book_id = ? AND user_id = ?', [preview.volumeId, bookId, userId]);
    for (const table of ['volume_settings', 'storylines', 'volume_timelines']) {
      db.run('DELETE FROM ' + table + ' WHERE book_id = ? AND volume_number = ?', [bookId, volumeNumber]);
    }
    // 按原卷号递增移动，避免唯一索引冲突；章节随所属卷一起移动。
    for (const table of ['volume_plans', 'volume_settings', 'storylines', 'volume_timelines', 'chapter_plans']) {
      const scope = table === 'volume_plans' ? ' AND user_id = ?' : '';
      const params = table === 'volume_plans' ? [bookId, volumeNumber, userId] : [bookId, volumeNumber];
      const numbers = rows(db, 'SELECT DISTINCT volume_number FROM ' + table + ' WHERE book_id = ? AND volume_number > ?' + scope + ' ORDER BY volume_number ASC', params);
      for (const item of numbers) {
        db.run('UPDATE ' + table + ' SET volume_number = ? WHERE book_id = ? AND volume_number = ?' + scope,
          table === 'volume_plans' ? [item.volume_number - 1, bookId, item.volume_number, userId] : [item.volume_number - 1, bookId, item.volume_number]);
      }
    }
    db.run('COMMIT');
    return preview;
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

module.exports = { inspectVolumeDeletion, deleteEmptyVolume };
