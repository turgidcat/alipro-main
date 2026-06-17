const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const dbPromise = require('../database/init');
const { execQuery, generateId, ChapterPlanService } = require('../services/database');

const chapterPlanService = new ChapterPlanService();

function ensureBookPermission(db, user, bookId) {
  if (isAdmin(user)) {
    return true;
  }

  const bookCheck = execQuery(db, 'SELECT user_id FROM books WHERE id = ?', [bookId]);
  return bookCheck.length > 0 && bookCheck[0].user_id === user.userId;
}

router.get('/:bookId', authenticateToken, async (req, res) => {
  try {
    const { bookId } = req.params;
    const db = await dbPromise;

    if (!ensureBookPermission(db, req.user, bookId)) {
      return res.status(403).json({ success: false, error: '无权访问' });
    }

    const bookOutlines = execQuery(
      db,
      'SELECT * FROM novel_outlines WHERE book_id = ? AND type = "book" ORDER BY created_at DESC LIMIT 1',
      [bookId]
    );
    const volumeOutlines = execQuery(
      db,
      'SELECT * FROM novel_outlines WHERE book_id = ? AND type = "volume" ORDER BY volume_number ASC',
      [bookId]
    );
    const chapterOutlines = execQuery(
      db,
      'SELECT o.*, c.chapter_number, c.chapter_name FROM novel_outlines o LEFT JOIN chapters c ON o.chapter_id = c.id WHERE o.book_id = ? AND o.type = "chapter" ORDER BY c.chapter_number ASC',
      [bookId]
    );

    res.json({
      success: true,
      data: {
        book: bookOutlines.length > 0 ? bookOutlines[0] : null,
        volumes: volumeOutlines,
        chapters: chapterOutlines
      }
    });
  } catch (error) {
    console.error('获取大纲失败:', error);
    res.status(500).json({ success: false, error: '获取大纲失败' });
  }
});

router.post('/:bookId/book', authenticateToken, async (req, res) => {
  try {
    const { bookId } = req.params;
    const { content } = req.body;
    const db = await dbPromise;

    if (!ensureBookPermission(db, req.user, bookId)) {
      return res.status(403).json({ success: false, error: '无权操作' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: '大纲内容不能为空' });
    }

    const existing = execQuery(
      db,
      'SELECT id FROM novel_outlines WHERE book_id = ? AND type = "book"',
      [bookId]
    );

    if (existing.length > 0) {
      db.run(
        'UPDATE novel_outlines SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [content, existing[0].id]
      );
    } else {
      const outlineId = generateId();
      db.run(
        'INSERT INTO novel_outlines(id, book_id, user_id, type, content) VALUES(?,?,?,?,?)',
        [outlineId, bookId, req.user.userId, 'book', content]
      );
    }

    res.json({ success: true, message: '全书大纲保存成功' });
  } catch (error) {
    console.error('保存全书大纲失败:', error);
    res.status(500).json({ success: false, error: '保存失败' });
  }
});

router.post('/:bookId/volume', authenticateToken, async (req, res) => {
  try {
    const { bookId } = req.params;
    const { volume_number, volume_title, content } = req.body;
    const db = await dbPromise;

    if (!ensureBookPermission(db, req.user, bookId)) {
      return res.status(403).json({ success: false, error: '无权操作' });
    }

    if (!volume_number || volume_number < 1) {
      return res.status(400).json({ success: false, error: '卷号必须大于 0' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: '大纲内容不能为空' });
    }

    const existing = execQuery(
      db,
      'SELECT id FROM novel_outlines WHERE book_id = ? AND type = "volume" AND volume_number = ?',
      [bookId, volume_number]
    );

    if (existing.length > 0) {
      db.run(
        'UPDATE novel_outlines SET volume_title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [volume_title || '', content, existing[0].id]
      );
    } else {
      const outlineId = generateId();
      db.run(
        'INSERT INTO novel_outlines(id, book_id, user_id, type, volume_number, volume_title, content) VALUES(?,?,?,?,?,?,?)',
        [outlineId, bookId, req.user.userId, 'volume', volume_number, volume_title || '', content]
      );
    }

    res.json({ success: true, message: '分卷大纲保存成功' });
  } catch (error) {
    console.error('保存分卷大纲失败:', error);
    res.status(500).json({ success: false, error: '保存失败' });
  }
});

router.delete('/:bookId/volume/:volumeNumber', authenticateToken, async (req, res) => {
  try {
    const { bookId, volumeNumber } = req.params;
    const db = await dbPromise;

    if (!ensureBookPermission(db, req.user, bookId)) {
      return res.status(403).json({ success: false, error: '无权操作' });
    }

    db.run(
      'DELETE FROM novel_outlines WHERE book_id = ? AND type = "volume" AND volume_number = ?',
      [bookId, volumeNumber]
    );

    res.json({ success: true, message: '分卷大纲已删除' });
  } catch (error) {
    console.error('删除分卷大纲失败:', error);
    res.status(500).json({ success: false, error: '删除失败' });
  }
});

router.post('/:bookId/chapter/:chapterId', authenticateToken, async (req, res) => {
  try {
    const { bookId, chapterId } = req.params;
    const { content } = req.body;
    const db = await dbPromise;

    if (!ensureBookPermission(db, req.user, bookId)) {
      return res.status(403).json({ success: false, error: '无权操作' });
    }

    const chapterCheck = execQuery(
      db,
      'SELECT id, chapter_number, chapter_name FROM chapters WHERE id = ? AND book_id = ?',
      [chapterId, bookId]
    );

    if (chapterCheck.length === 0) {
      return res.status(404).json({ success: false, error: '章节不存在' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: '大纲内容不能为空' });
    }

    const existing = execQuery(
      db,
      'SELECT id FROM novel_outlines WHERE chapter_id = ?',
      [chapterId]
    );

    if (existing.length > 0) {
      db.run(
        'UPDATE novel_outlines SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [content, existing[0].id]
      );
    } else {
      const outlineId = generateId();
      db.run(
        'INSERT INTO novel_outlines(id, book_id, user_id, type, chapter_id, content) VALUES(?,?,?,?,?,?)',
        [outlineId, bookId, req.user.userId, 'chapter', chapterId, content]
      );
    }

    const chapterInfo = chapterCheck[0];
    const chapterNumber = Number.parseInt(chapterInfo.chapter_number, 10);
    if (Number.isFinite(chapterNumber) && chapterNumber > 0) {
      await chapterPlanService.upsert(bookId, chapterNumber, {
        chapter_id: chapterId,
        chapter_name: chapterInfo.chapter_name || '',
        summary: content.replace(/\s+/g, ' ').trim().slice(0, 120),
        outline_text: content,
        source: 'manual',
        status: 'draft'
      }, req.user.userId);
    }

    res.json({ success: true, message: '章节大纲保存成功' });
  } catch (error) {
    console.error('保存章节大纲失败:', error);
    res.status(500).json({ success: false, error: '保存失败' });
  }
});

module.exports = router;
