const express = require('express');
const router = express.Router();
const { BookService, ChapterService, TemplateService, ForeshadowingService, CharacterService, ChapterPlanService, BookPlanService, execQuery, execQueryOne, saveDatabase } = require('../services/database');
const dbPromise = require('../database/init');
const logger = require('../utils/logger');
const { validateRequest } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const aiService = require('../services/ai');

const bookService = new BookService();
const chapterService = new ChapterService();
const templateService = new TemplateService();
const foreshadowingService = new ForeshadowingService();
const characterService = new CharacterService();
const chapterPlanService = new ChapterPlanService();
const bookPlanService = new BookPlanService();

const ROLE_TIER_VALUES = ['protagonist', 'supporting_major', 'supporting_secondary', 'supporting_minor', 'antagonist_major', 'antagonist_minor'];
const ROLE_TIER_LABELS = {
  protagonist: '主角',
  supporting_major: '主要配角',
  supporting_secondary: '次要配角',
  supporting_minor: '普通配角',
  antagonist_major: '大反派',
  antagonist_minor: '普通反派'
};

function normalizeJsonText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_) {
    const matched = raw.match(/\{[\s\S]*\}/);
    if (!matched) return null;
    try {
      return JSON.parse(matched[0]);
    } catch (error) {
      return null;
    }
  }
}

function buildRoleTierPromptSection() {
  return [
    '角色定位枚举：',
    '- protagonist：主角',
    '- supporting_major：主要配角',
    '- supporting_secondary：次要配角',
    '- supporting_minor：普通配角',
    '- antagonist_major：大反派',
    '- antagonist_minor：普通反派'
  ].join('\n');
}

async function buildCharacterGenerationContext(bookId) {
  const db = await dbPromise;
  const [book, bookPlan, characters] = await Promise.all([
    bookService.getById(bookId),
    bookPlanService.getByBookId(bookId, '').catch(() => null),
    characterService.getByBookId(bookId, '')
  ]);

  const volumePlans = execQuery(
    db,
    "SELECT volume_number, volume_name, volume_theme, stage_goal, core_conflict, notes FROM volume_plans WHERE book_id = ? ORDER BY volume_number ASC, CASE WHEN user_id = '' THEN 0 ELSE 1 END",
    [bookId]
  );
  const storylines = execQuery(
    db,
    "SELECT volume_number, storyline_number, storyline_name, storyline_type, description, core_conflict, involved_characters FROM storylines WHERE book_id = ? ORDER BY volume_number ASC, storyline_number ASC, CASE WHEN user_id = '' THEN 0 ELSE 1 END",
    [bookId]
  );

  const existingCharacters = Array.isArray(characters)
    ? characters
      .filter((item) => normalizeJsonText(item.name) && !['全书角色设定', '本章新增角色'].includes(normalizeJsonText(item.name)))
      .map((item) => ({
        name: normalizeJsonText(item.name),
        role_tier: normalizeJsonText(item.role_tier) || 'supporting_major',
        personality: normalizeJsonText(item.personality),
        background: normalizeJsonText(item.background),
        appearance: normalizeJsonText(item.appearance)
      }))
    : [];

  const volumePlanLines = volumePlans
    .slice(0, 8)
    .map((item) => {
      const parts = [
        `第${item.volume_number || 1}卷`,
        normalizeJsonText(item.volume_name),
        normalizeJsonText(item.stage_goal) ? `阶段目标：${normalizeJsonText(item.stage_goal)}` : '',
        normalizeJsonText(item.core_conflict) ? `核心冲突：${normalizeJsonText(item.core_conflict)}` : '',
        normalizeJsonText(item.notes) ? `卷内说明：${normalizeJsonText(item.notes)}` : ''
      ].filter(Boolean);
      return parts.join('｜');
    })
    .filter(Boolean);

  const storylineLines = storylines
    .slice(0, 12)
    .map((item) => {
      const involved = (() => {
        try {
          const parsed = JSON.parse(item.involved_characters || '[]');
          return Array.isArray(parsed) ? parsed.join('、') : '';
        } catch (_) {
          return '';
        }
      })();
      const parts = [
        `第${item.volume_number || 1}卷·线${item.storyline_number || 1}`,
        normalizeJsonText(item.storyline_name),
        normalizeJsonText(item.storyline_type) ? `类型：${normalizeJsonText(item.storyline_type)}` : '',
        normalizeJsonText(item.description) ? `说明：${normalizeJsonText(item.description)}` : '',
        normalizeJsonText(item.core_conflict) ? `冲突：${normalizeJsonText(item.core_conflict)}` : '',
        involved ? `涉及人物：${involved}` : ''
      ].filter(Boolean);
      return parts.join('｜');
    })
    .filter(Boolean);

  const characterPoolLines = existingCharacters
    .slice(0, 12)
    .map((item) => {
      const parts = [
        item.name,
        `定位：${ROLE_TIER_LABELS[item.role_tier] || item.role_tier}`,
        item.background ? `背景：${item.background}` : '',
        item.appearance ? `外形：${item.appearance}` : ''
      ].filter(Boolean);
      return parts.join('｜');
    });

  return {
    book,
    bookPlan,
    existingCharacters,
    volumePlanLines,
    storylineLines,
    characterPoolLines
  };
}

// ==================== 书籍管理 ====================

/**
 * GET /api/books
 * 获取所有书籍（纯前端应用，无需认证）
 */
router.get('/books', async (req, res) => {
  try {
    const userId = ''; // 纯前端应用，显示所有书籍
    const books = await bookService.getAll(userId);
    res.json({
      success: true,
      data: books
    });
  } catch (error) {
    logger.error('获取书籍列表失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * POST /api/books
 * 创建新书籍（纯前端应用，无需认证）
 */
router.post('/books',
  validateRequest({
    title: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    genre: { type: 'string', required: true, maxLength: 50 },
    subgenre: { type: 'string', required: false, maxLength: 80 },
    description: { type: 'string', required: false, maxLength: 1000 },
    author: { type: 'string', required: false, maxLength: 100 },
    cover_image: { type: 'string', required: false, maxLength: 2000000 },
    status: { type: 'string', required: false, maxLength: 20 }
  }),
  async (req, res) => {
  try {
    const userId = ''; // 纯前端应用，不关联用户
    const { title, genre, subgenre = '', description, author, cover_image = '', status } = req.body;

    if (!title || !genre) {
      return res.status(400).json({
        success: false,
        error: '标题和类型不能为空'
      });
    }

    let book = await bookService.create(title, genre, description || '', author || '', userId, subgenre || '');
    if (status || cover_image) {
      book = await bookService.update(book.id, { status, cover_image });
    }

    logger.info('创建书籍成功', {
      bookId: book.id,
      userId,
      title
    });

    res.status(201).json({
      success: true,
      data: book
    });
  } catch (error) {
    logger.error('创建书籍失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * GET /api/books/stats
 * 获取全局创作统计数据
 */
router.get('/books/stats', async (req, res) => {
  try {
    const db = await dbPromise;

    const totalBooksResult = execQueryOne(db, 'SELECT COUNT(*) as count FROM books');
    const totalBooks = totalBooksResult ? totalBooksResult.count : 0;

    const totalChaptersResult = execQueryOne(db, 'SELECT COUNT(*) as count FROM chapters');
    const totalChapters = totalChaptersResult ? totalChaptersResult.count : 0;

    const totalWordsResult = execQueryOne(db, 'SELECT COALESCE(SUM(word_count), 0) as total FROM chapters');
    const totalWords = totalWordsResult ? totalWordsResult.total : 0;

    const totalCharactersResult = execQueryOne(db, `SELECT COUNT(*) as count FROM novel_characters`);
    const totalCharacters = totalCharactersResult ? totalCharactersResult.count : 0;

    const statusResult = execQuery(db, 'SELECT status, COUNT(*) as count FROM books GROUP BY status');
    const statusBreakdown = { writing: 0, completed: 0, paused: 0 };
    statusResult.forEach(row => { statusBreakdown[row.status] = row.count; });

    const recentResult = execQueryOne(db, "SELECT COUNT(*) as count FROM books WHERE updated_at >= datetime('now', '-7 days')");
    const recent7Days = recentResult ? recentResult.count : 0;

    const topBooksResult = execQuery(db, `
      SELECT b.id, b.title, b.status, COUNT(c.id) as chapter_count, COALESCE(SUM(c.word_count), 0) as word_count
      FROM books b
      LEFT JOIN chapters c ON b.id = c.book_id
      GROUP BY b.id
      ORDER BY word_count DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        totalBooks,
        totalChapters,
        totalWords,
        totalCharacters,
        statusBreakdown,
        recent7Days,
        topBooks: topBooksResult
      }
    });
  } catch (error) {
    logger.error('获取创作统计失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * GET /api/books/:id
 * 获取单本书籍（按用户筛选）
 */
router.get('/books/:id', async (req, res) => {
  try {
    const userId = '';
    const book = await bookService.getById(req.params.id);

    if (!book) {
      return res.status(404).json({
        success: false,
        error: '书籍不存在'
      });
    }

    // 验证用户权限
    if (userId && book.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: '无权访问此书籍'
      });
    }

    res.json({
      success: true,
      data: book
    });
  } catch (error) {
    logger.error('获取书籍失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * PUT /api/books/:id
 * 更新书籍信息（验证用户权限）
 */
router.put('/books/:id', async (req, res) => {
  try {
    const userId = '';
    const book = await bookService.update(req.params.id, req.body);

    if (!book) {
      return res.status(404).json({
        success: false,
        error: '书籍不存在'
      });
    }

    // 验证用户权限
    if (userId && book.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: '无权修改此书籍'
      });
    }

    res.json({
      success: true,
      data: book
    });
  } catch (error) {
    logger.error('更新书籍失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * DELETE /api/books/:id
 * 删除书籍（验证用户权限）
 */
router.delete('/books/:id', async (req, res) => {
  try {
    const userId = '';

    // 先检查书籍是否存在及权限
    const book = await bookService.getById(req.params.id);
    if (!book) {
      return res.status(404).json({
        success: false,
        error: '书籍不存在'
      });
    }

    // 验证用户权限
    if (userId && book.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: '无权删除此书籍'
      });
    }

    const success = await bookService.delete(req.params.id);

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    logger.error('删除书籍失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * POST /api/books/batch-delete
 * 批量删除书籍
 */
router.post('/books/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供要删除的书籍ID列表'
      });
    }

    let deletedCount = 0;
    let failedIds = [];

    for (const id of ids) {
      try {
        const success = await bookService.delete(id);
        if (success) {
          deletedCount++;
        } else {
          failedIds.push(id);
        }
      } catch (err) {
        logger.error(`删除书籍 ${id} 失败:`, err.message);
        failedIds.push(id);
      }
    }

    res.json({
      success: true,
      message: `成功删除 ${deletedCount} 本书籍${failedIds.length > 0 ? `，${failedIds.length} 本删除失败` : ''}`,
      deletedCount,
      failedIds
    });
  } catch (error) {
    logger.error('批量删除书籍失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// ==================== 章节管理 ====================

/**
 * GET /api/books/:bookId/chapters
 * 获取书籍的所有章节（按用户筛选）
 */
router.get('/books/:bookId/chapters', async (req, res) => {
  try {
    const userId = '';
    const chapters = await chapterService.getByBookId(req.params.bookId, userId);

    res.json({
      success: true,
      data: chapters
    });
  } catch (error) {
    logger.error('获取章节列表失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * POST /api/books/:bookId/chapters
 * 创建新章节（纯前端应用，无需认证）
 */
router.post('/books/:bookId/chapters',
  validateRequest({
    title: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    chapterName: { type: 'string', required: false, maxLength: 200 },
    content: { type: 'string', required: false, maxLength: 50000 },
    chapterNumber: { type: 'number', required: false, min: 1 }
  }),
  async (req, res) => {
  try {
    const userId = ''; // 纯前端应用，不关联用户
    const { title, chapterName, content, chapterNumber } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: '章节标题不能为空'
      });
    }

    const chapter = await chapterService.create(req.params.bookId, title, content, chapterNumber, chapterName || '', userId);

    res.status(201).json({
      success: true,
      data: chapter
    });
  } catch (error) {
    logger.error('创建章节失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * DELETE /api/books/:bookId/chapters/:chapterNumber
 * 删除单章正文与对应细纲（纯前端应用，无需认证）
 */
router.delete('/books/:bookId/chapters/:chapterNumber', async (req, res) => {
  try {
    const userId = '';
    const { bookId } = req.params;
    const chapterNumber = Number.parseInt(req.params.chapterNumber, 10);

    if (!Number.isFinite(chapterNumber) || chapterNumber < 1) {
      return res.status(400).json({
        success: false,
        error: '章节编号无效'
      });
    }

    const [chapter, plan] = await Promise.all([
      chapterService.getByBookAndChapterNumber(bookId, chapterNumber, userId),
      chapterPlanService.getByBookAndChapterNumber(bookId, chapterNumber, userId)
    ]);

    if (!chapter && !plan) {
      return res.status(404).json({
        success: false,
        error: '章节不存在'
      });
    }

    const deletedChapter = chapter
      ? await chapterService.deleteByBookAndChapterNumber(bookId, chapterNumber, userId)
      : false;
    const deletedPlanCount = await chapterPlanService.deleteByBookAndChapterNumber(bookId, chapterNumber, userId);

    res.json({
      success: true,
      data: {
        chapterNumber,
        deletedChapter,
        deletedPlanCount
      }
    });
  } catch (error) {
    logger.error('删除章节失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * DELETE /api/books/:bookId/chapters/:chapterNumber/content
 * 仅删除单章正文，保留章节计划、章节名和细纲。
 */
router.delete('/books/:bookId/chapters/:chapterNumber/content', async (req, res) => {
  try {
    const userId = '';
    const { bookId } = req.params;
    const chapterNumber = Number.parseInt(req.params.chapterNumber, 10);

    if (!Number.isFinite(chapterNumber) || chapterNumber < 1) {
      return res.status(400).json({ success: false, error: '章节编号无效' });
    }

    const chapter = await chapterService.getByBookAndChapterNumber(bookId, chapterNumber, userId);
    if (!chapter) {
      return res.status(404).json({ success: false, error: '本章没有可删除的正文' });
    }

    const deletedChapter = await chapterService.deleteByBookAndChapterNumber(bookId, chapterNumber, userId);
    res.json({ success: true, data: { chapterNumber, deletedChapter } });
  } catch (error) {
    logger.error('删除章节正文失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

/**
 * DELETE /api/books/:bookId/chapters
 * 清空当前书籍的全部章节正文与章节计划。
 */
router.delete('/books/:bookId/chapters', async (req, res) => {
  try {
    const userId = '';
    const { bookId } = req.params;
    const book = await bookService.getById(bookId);
    if (!book) {
      return res.status(404).json({ success: false, error: '书籍不存在' });
    }

    const deletedChapterCount = await chapterService.deleteByBookId(bookId, userId);
    const deletedPlanCount = await chapterPlanService.deleteByBookId(bookId, userId);
    res.json({
      success: true,
      data: {
        deletedChapterCount,
        deletedPlanCount
      }
    });
  } catch (error) {
    logger.error('清空书籍章节失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

/**
 * GET /api/chapters/:id
 * 获取单个章节（按用户筛选）
 */
router.get('/chapters/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const chapter = await chapterService.getById(req.params.id);

    if (!chapter) {
      return res.status(404).json({
        success: false,
        error: '章节不存在'
      });
    }

    // 验证用户权限
    if (userId && chapter.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: '无权访问此章节'
      });
    }

    res.json({
      success: true,
      data: chapter
    });
  } catch (error) {
    logger.error('获取章节失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * PUT /api/chapters/:id
 * 更新章节（验证用户权限）
 */
router.put('/chapters/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const chapter = await chapterService.update(req.params.id, req.body);

    if (!chapter) {
      return res.status(404).json({
        success: false,
        error: '章节不存在'
      });
    }

    // 验证用户权限
    if (userId && chapter.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: '无权修改此章节'
      });
    }

    res.json({
      success: true,
      data: chapter
    });
  } catch (error) {
    logger.error('更新章节失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * DELETE /api/chapters/:id
 * 删除章节（验证用户权限）
 */
router.delete('/chapters/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 先检查章节是否存在及权限
    const chapter = await chapterService.getById(req.params.id);
    if (!chapter) {
      return res.status(404).json({
        success: false,
        error: '章节不存在'
      });
    }

    // 验证用户权限
    if (userId && chapter.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: '无权删除此章节'
      });
    }

    const success = await chapterService.delete(req.params.id);

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    logger.error('删除章节失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * GET /api/books/:bookId/export
 * 导出书籍为TXT
 */
router.get('/books/:bookId/export', async (req, res) => {
  try {
    const { chapters } = req.query;
    const chapterIds = chapters ? chapters.split(',') : null;

    const result = await chapterService.exportToTxt(req.params.bookId, chapterIds);

    // 设置响应头，触发下载
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="novel.txt"; filename*=UTF-8''${encodeURIComponent(result.filename)}`
    );

    res.send(result.content);
  } catch (error) {
    logger.error('导出失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: error.message || '导出失败'
    });
  }
});

// ==================== 模板管理 ====================

/**
 * GET /api/templates
 * 获取所有模板（按用户筛选）
 */
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { genre } = req.query;
    const templates = await templateService.getAll(genre, userId);

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    logger.error('获取模板失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * POST /api/templates
 * 创建自定义模板（关联当前用户）
 */
router.post('/templates',
  authenticateToken,
  validateRequest({
    name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    genre: { type: 'string', required: true, maxLength: 50 },
    promptTemplate: { type: 'string', required: true, minLength: 10, maxLength: 5000 },
    description: { type: 'string', required: false, maxLength: 500 }
  }),
  async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, genre, promptTemplate, description, defaultSettings } = req.body;

    if (!name || !genre || !promptTemplate) {
      return res.status(400).json({
        success: false,
        error: '名称、类型和提示词模板不能为空'
      });
    }

    const template = await templateService.create(name, genre, promptTemplate, description, defaultSettings, userId);

    res.status(201).json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error('创建模板失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * DELETE /api/templates/:id
 * 删除模板（验证用户权限）
 */
router.delete('/templates/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 先检查模板是否存在及权限
    const template = await templateService.getById(req.params.id);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: '模板不存在'
      });
    }

    // 验证用户权限（只允许删除自定义模板）
    if (userId && template.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: '无权删除此模板'
      });
    }

    const success = await templateService.delete(req.params.id);

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    logger.error('删除模板失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: error.message || '删除失败'
    });
  }
});

// ==================== 伏笔管理 ====================

/**
 * GET /api/books/:bookId/foreshadowing
 * 获取书籍的所有伏笔（按用户筛选）
 */
router.get('/books/:bookId/foreshadowing', async (req, res) => {
  try {
    const userId = '';
    const { status } = req.query;
    const foreshadows = await foreshadowingService.getByBookId(req.params.bookId, status, userId);

    res.json({
      success: true,
      data: foreshadows
    });
  } catch (error) {
    logger.error('获取伏笔列表失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * POST /api/books/:bookId/foreshadowing
 * 添加伏笔（关联当前用户）
 */
router.post('/books/:bookId/foreshadowing',
  authenticateToken,
  validateRequest({
    title: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    description: { type: 'string', required: true, minLength: 5, maxLength: 1000 },
    chapterId: { type: 'string', required: false, maxLength: 50 }
  }),
  async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, description, chapterId } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: '标题和描述不能为空'
      });
    }

    const foreshadow = await foreshadowingService.create(req.params.bookId, title, description, chapterId, userId);

    res.status(201).json({
      success: true,
      data: foreshadow
    });
  } catch (error) {
    logger.error('添加伏笔失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * PUT /api/foreshadowing/:id
 * 更新伏笔状态（验证用户权限）
 */
router.put('/foreshadowing/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, chapterId } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: '状态不能为空'
      });
    }

    const foreshadow = await foreshadowingService.updateStatus(req.params.id, status, chapterId);

    if (!foreshadow) {
      return res.status(404).json({
        success: false,
        error: '伏笔不存在'
      });
    }

    // 验证用户权限
    if (userId && foreshadow.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: '无权修改此伏笔'
      });
    }

    res.json({
      success: true,
      data: foreshadow
    });
  } catch (error) {
    logger.error('更新伏笔失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: error.message || '更新失败'
    });
  }
});

/**
 * DELETE /api/foreshadowing/:id
 * 删除伏笔（验证用户权限）
 */
router.delete('/foreshadowing/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 先检查伏笔是否存在及权限
    const foreshadow = await foreshadowingService.getById(req.params.id);
    if (!foreshadow) {
      return res.status(404).json({
        success: false,
        error: '伏笔不存在'
      });
    }

    // 验证用户权限
    if (userId && foreshadow.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: '无权删除此伏笔'
      });
    }

    const success = await foreshadowingService.delete(req.params.id);

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    logger.error('删除伏笔失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// ==================== 角色管理 ====================

/**
 * GET /api/books/:bookId/characters
 * 获取书籍的所有角色（按用户和类型筛选）
 */
router.get('/books/:bookId/characters', async (req, res) => {
  try {
    const userId = '';
    const characterType = req.query.type || null; // 可选的类型筛选参数
    // 兼容旧作品：历史摘要会在首次读取时拆成独立角色卡，原摘要记录保留给生成链路使用。
    await characterService.ensureLegacySummarySplit(req.params.bookId, userId);
    const characters = await characterService.getByBookId(req.params.bookId, userId, characterType);

    res.json({
      success: true,
      data: characters || []
    });
  } catch (error) {
    logger.error('获取角色列表失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * POST /api/books/:bookId/characters
 * 添加角色（纯前端应用，无需认证）
 */
router.post('/books/:bookId/characters',
  validateRequest({
    name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    appearance: { type: 'string', required: false, maxLength: 2000 },
    personality: { type: 'string', required: false, maxLength: 2000 },
    background: { type: 'string', required: false, maxLength: 5000 },
    notes: { type: 'string', required: false, maxLength: 2000 },
    avatar_image: { type: 'string', required: false, maxLength: 2000000 },
    character_type: { type: 'string', required: false, enum: ['main_character', 'chapter_character'] },
    role_tier: { type: 'string', required: false, enum: ROLE_TIER_VALUES }
  }),
  async (req, res) => {
  try {
    const userId = ''; // 纯前端应用，不关联用户
    const { name, appearance = '', personality = '', background = '', notes = '', avatar_image = '', character_type = 'main_character', role_tier = 'supporting_major' } = req.body;
    // 与生成卡片/批量生成保持一致：role_tier 只接受合法枚举，非法值回落为重要配角
    const safeRoleTier = ROLE_TIER_VALUES.includes(role_tier) ? role_tier : 'supporting_major';

    const character = await characterService.create(
      req.params.bookId,
      name,
      appearance,
      personality,
      background,
      notes,
      userId,
      character_type,
      safeRoleTier,
      avatar_image
    );

    res.status(201).json({
      success: true,
      data: character
    });
  } catch (error) {
    logger.error('添加角色失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * PUT /api/books/:bookId/characters/:characterId
 * 更新角色档案（纯前端应用，无需认证）
 */
router.put('/books/:bookId/characters/:characterId',
  validateRequest({
    name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    appearance: { type: 'string', required: false, maxLength: 2000 },
    personality: { type: 'string', required: false, maxLength: 2000 },
    background: { type: 'string', required: false, maxLength: 5000 },
    notes: { type: 'string', required: false, maxLength: 2000 },
    avatar_image: { type: 'string', required: false, maxLength: 2000000 },
    character_type: { type: 'string', required: false, enum: ['main_character', 'chapter_character'] },
    role_tier: { type: 'string', required: false, enum: ROLE_TIER_VALUES }
  }),
  async (req, res) => {
    try {
      const { bookId, characterId } = req.params;
      const current = await characterService.getById(characterId);

      if (!current || current.book_id !== bookId) {
        return res.status(404).json({
          success: false,
          error: '角色不存在'
        });
      }

      const updated = await characterService.update(characterId, {
        name: req.body.name,
        appearance: req.body.appearance || '',
        personality: req.body.personality || '',
        background: req.body.background || '',
        notes: req.body.notes || '',
        avatar_image: req.body.avatar_image || '',
        character_type: req.body.character_type || current.character_type || 'main_character',
        role_tier: req.body.role_tier || current.role_tier || 'supporting_major'
      });

      res.json({
        success: true,
        data: updated
      });
    } catch (error) {
      logger.error('更新角色失败', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: '服务器内部错误'
      });
    }
  }
);

/**
 * DELETE /api/books/:bookId/characters/:characterId
 * 删除单个角色档案（纯前端应用，无需认证）
 */
router.delete('/books/:bookId/characters/:characterId', async (req, res) => {
  try {
    const { bookId, characterId } = req.params;
    const current = await characterService.getById(characterId);

    if (!current || current.book_id !== bookId) {
      return res.status(404).json({
        success: false,
        error: '角色不存在'
      });
    }

    const deleted = await characterService.delete(characterId);
    res.json({
      success: true,
      data: {
        deleted
      }
    });
  } catch (error) {
    logger.error('删除角色失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * POST /api/books/:bookId/characters/generate-card
 * 用模型生成角色底色卡（结构化输出）
 */
router.post('/books/:bookId/characters/generate-card',
  validateRequest({
    name: { type: 'string', required: false, maxLength: 100 },
    hint: { type: 'string', required: false, maxLength: 2000 },
    role_tier: { type: 'string', required: false, enum: ROLE_TIER_VALUES }
  }),
  async (req, res) => {
    try {
      const { bookId } = req.params;
      const name = normalizeJsonText(req.body.name) || '新角色';
      const hint = normalizeJsonText(req.body.hint);
      const roleTier = ROLE_TIER_VALUES.includes(req.body.role_tier) ? req.body.role_tier : 'supporting_major';
      const { book, bookPlan, existingCharacters, volumePlanLines, storylineLines, characterPoolLines } = await buildCharacterGenerationContext(bookId);

      if (!book) {
        return res.status(404).json({
          success: false,
          error: '书籍不存在'
        });
      }

      const prompt = [
        '你是小说角色设定助手。请基于给定书籍信息，生成一个适合本书的角色底色卡。',
        '要求：只输出 JSON，不要额外解释，不要 markdown 代码块。',
        '字段固定为：name, role_tier, personality, background, appearance。',
        buildRoleTierPromptSection(),
        '字段要求：',
        '- name：角色名，尽量保留用户提供的名字；如果名字为空，可以自行补一个贴合题材的名字。',
        '- role_tier：必须返回当前要求的角色定位枚举值，不要返回中文。',
        '- personality：只写长期稳定的核心性格底色，1-2句。',
        '- background：只写身份背景、阵营位置、出身或社会位置，1-2句。',
        '- appearance：只写最有辨识度的外形标记，1句。',
        '- 不要输出年龄、生日、数值设定、复杂小传。',
        '- 角色必须服务现有主线、分卷或剧情线，不能脱离当前小说世界观。',
        '- 姓名风格、身份背景、外形标记必须与题材、已有角色池和整体基调一致。',
        '',
        `书名：${book.title || '未命名书籍'}`,
        `题材：${book.genre || '未设置'}`,
        `简介：${normalizeJsonText(book.description) || '暂无简介'}`,
        `作品前提：${normalizeJsonText(bookPlan?.premise) || '暂无作品前提'}`,
        `主线目标：${normalizeJsonText(bookPlan?.main_goal) || '暂无主线目标'}`,
        `核心冲突：${normalizeJsonText(bookPlan?.core_conflict) || '暂无核心冲突'}`,
        `世界规则：${normalizeJsonText(bookPlan?.world_rules) || '暂无世界规则'}`,
        `全书大纲：${normalizeJsonText(bookPlan?.main_outline).slice(0, 1200) || '暂无全书大纲'}`,
        `分卷补充：${normalizeJsonText(bookPlan?.volume_outline).slice(0, 800) || '暂无分卷补充'}`,
        volumePlanLines.length > 0 ? `分卷规划：\n${volumePlanLines.map((item, index) => `${index + 1}. ${item}`).join('\n')}` : '分卷规划：暂无',
        storylineLines.length > 0 ? `剧情线规划：\n${storylineLines.map((item, index) => `${index + 1}. ${item}`).join('\n')}` : '剧情线规划：暂无',
        characterPoolLines.length > 0 ? `已有角色池：\n${characterPoolLines.map((item, index) => `${index + 1}. ${item}`).join('\n')}` : '已有角色池：暂无',
        `本次指定角色定位：${roleTier}（${ROLE_TIER_LABELS[roleTier]}）`,
        `用户指定角色名：${name}`,
        hint ? `补充提示：${hint}` : '补充提示：无',
        '',
        '请返回示例：',
        '{"name":"角色名","role_tier":"supporting_major","personality":"核心性格","background":"身份背景","appearance":"外形标记"}'
      ].join('\n');

      const result = await aiService.generate({
        prompt,
        task: 'outline',
        temperature: 0.7,
        maxTokens: 600
      });

      const parsed = extractJsonObject(result.content);
      if (!parsed || typeof parsed !== 'object') {
        return res.status(502).json({
          success: false,
          error: '模型返回格式无法解析，请重试'
        });
      }

      res.json({
        success: true,
        data: {
          name: normalizeJsonText(parsed.name) || name,
          role_tier: ROLE_TIER_VALUES.includes(parsed.role_tier) ? parsed.role_tier : roleTier,
          personality: normalizeJsonText(parsed.personality),
          background: normalizeJsonText(parsed.background),
          appearance: normalizeJsonText(parsed.appearance)
        }
      });
    } catch (error) {
      logger.error('生成角色底色卡失败', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: error.message || '服务器内部错误'
      });
    }
  }
);

/**
 * POST /api/books/:bookId/characters/generate-batch
 * 按角色定位批量生成角色卡（结构化输出）
 */
router.post('/books/:bookId/characters/generate-batch',
  async (req, res) => {
    try {
      const { bookId } = req.params;
      const roleCounts = req.body && typeof req.body.role_counts === 'object' ? req.body.role_counts : {};
      const hint = normalizeJsonText(req.body?.hint);
      const validEntries = ROLE_TIER_VALUES
        .map((roleTier) => ({
          roleTier,
          count: Math.max(0, Math.min(10, Number(roleCounts[roleTier] || 0)))
        }))
        .filter((item) => item.count > 0);

      if (validEntries.length === 0) {
        return res.status(400).json({
          success: false,
          error: '请至少填写一种角色定位的生成数量'
        });
      }

      const { book, bookPlan, existingCharacters, volumePlanLines, storylineLines, characterPoolLines } = await buildCharacterGenerationContext(bookId);

      if (!book) {
        return res.status(404).json({
          success: false,
          error: '书籍不存在'
        });
      }

      const totalCount = validEntries.reduce((sum, item) => sum + item.count, 0);
      const roleText = validEntries.map((item) => `${ROLE_TIER_LABELS[item.roleTier]}：${item.count}个`).join('；');

      const prompt = [
        '你是小说角色设定助手。请根据小说创作常识，为这本书批量生成角色底色卡。',
        '要求：只输出 JSON 数组，不要额外解释，不要 markdown 代码块。',
        '数组总数必须严格等于用户要求的总数量。',
        '每个对象字段固定为：name, role_tier, personality, background, appearance。',
        buildRoleTierPromptSection(),
        '字段要求：',
        '- name：角色名，要贴合题材，彼此不要重复。',
        '- role_tier：必须使用枚举值，不要返回中文。',
        '- personality：长期稳定的核心性格底色，1-2句。',
        '- background：身份背景、阵营位置、出身或社会位置，1-2句。',
        '- appearance：最有辨识度的外形标记，1句。',
        '- 不要输出年龄、生日、数值设定、复杂小传。',
        '- 所有角色必须能嵌入现有世界观、分卷推进和剧情线冲突，不能生成与小说背景无关的人。',
        '- 姓名、外形、背景、阵营风格必须与已有角色池和作品基调一致，不能像串书。',
        '',
        `书名：${book.title || '未命名书籍'}`,
        `题材：${book.genre || '未设置'}`,
        `简介：${normalizeJsonText(book.description) || '暂无简介'}`,
        `作品前提：${normalizeJsonText(bookPlan?.premise) || '暂无作品前提'}`,
        `主线目标：${normalizeJsonText(bookPlan?.main_goal) || '暂无主线目标'}`,
        `核心冲突：${normalizeJsonText(bookPlan?.core_conflict) || '暂无核心冲突'}`,
        `世界规则：${normalizeJsonText(bookPlan?.world_rules) || '暂无世界规则'}`,
        `全书大纲：${normalizeJsonText(bookPlan?.main_outline).slice(0, 1200) || '暂无全书大纲'}`,
        `分卷补充：${normalizeJsonText(bookPlan?.volume_outline).slice(0, 800) || '暂无分卷补充'}`,
        volumePlanLines.length > 0 ? `分卷规划：\n${volumePlanLines.map((item, index) => `${index + 1}. ${item}`).join('\n')}` : '分卷规划：暂无',
        storylineLines.length > 0 ? `剧情线规划：\n${storylineLines.map((item, index) => `${index + 1}. ${item}`).join('\n')}` : '剧情线规划：暂无',
        characterPoolLines.length > 0 ? `已有角色池：\n${characterPoolLines.map((item, index) => `${index + 1}. ${item}`).join('\n')}` : '已有角色池：暂无',
        `本次生成数量：${roleText}`,
        hint ? `补充提示：${hint}` : '补充提示：无',
        '',
        `最终必须返回 ${totalCount} 个对象组成的 JSON 数组。`
      ].join('\n');

      const result = await aiService.generate({
        prompt,
        task: 'outline',
        temperature: 0.8,
        maxTokens: 1800
      });

      let parsed = [];
      try {
        parsed = JSON.parse(String(result.content || '').trim());
      } catch (_) {
        const matched = String(result.content || '').match(/\[[\s\S]*\]/);
        parsed = matched ? JSON.parse(matched[0]) : [];
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        return res.status(502).json({
          success: false,
          error: '模型返回格式无法解析，请重试'
        });
      }

      const normalized = parsed
        .map((item, index) => ({
          name: normalizeJsonText(item?.name) || `角色${index + 1}`,
          role_tier: ROLE_TIER_VALUES.includes(item?.role_tier) ? item.role_tier : validEntries[0].roleTier,
          personality: normalizeJsonText(item?.personality),
          background: normalizeJsonText(item?.background),
          appearance: normalizeJsonText(item?.appearance)
        }))
        .slice(0, totalCount);

      res.json({
        success: true,
        data: normalized
      });
    } catch (error) {
      logger.error('批量生成角色卡失败', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: error.message || '服务器内部错误'
      });
    }
  }
);

/**
 * DELETE /api/books/:bookId/characters
 * 清空某本书的全部角色档案（纯前端应用，无需认证）
 */
router.delete('/books/:bookId/characters', async (req, res) => {
  try {
    const { bookId } = req.params;
    const book = await bookService.getById(bookId);

    if (!book) {
      return res.status(404).json({
        success: false,
        error: '书籍不存在'
      });
    }

    const deletedCount = await characterService.deleteByBookId(bookId);

    res.json({
      success: true,
      data: { deletedCount }
    });
  } catch (error) {
    logger.error('清空角色档案失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * DELETE /api/characters/:id
 * 删除角色（验证用户权限）
 */
router.delete('/characters/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 先检查角色是否存在及权限
    const character = await characterService.getById(req.params.id);
    if (!character) {
      return res.status(404).json({
        success: false,
        error: '角色不存在'
      });
    }

    // 验证用户权限
    if (userId && character.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: '无权删除此角色'
      });
    }

    const success = await characterService.delete(req.params.id);

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    logger.error('删除角色失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * GET /api/characters/:id
 * 获取单个角色（按用户筛选）
 */
router.get('/characters/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const character = await characterService.getById(req.params.id);

    if (!character) {
      return res.status(404).json({
        success: false,
        error: '角色不存在'
      });
    }

    // 验证用户权限
    if (userId && character.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: '无权访问此角色'
      });
    }

    res.json({
      success: true,
      data: character
    });
  } catch (error) {
    logger.error('获取角色失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * PUT /api/characters/:id
 * 更新角色（验证用户权限）
 */
router.put('/characters/:id',
  authenticateToken,
  validateRequest({
    name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    appearance: { type: 'string', required: false, maxLength: 2000 },
    personality: { type: 'string', required: false, maxLength: 2000 },
    background: { type: 'string', required: false, maxLength: 5000 },
    notes: { type: 'string', required: false, maxLength: 2000 },
    character_type: { type: 'string', required: false, enum: ['main_character', 'chapter_character'] }
  }),
  async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, appearance = '', personality = '', background = '', notes = '', character_type } = req.body;

    // 先获取旧角色
    const oldCharacter = await characterService.getById(req.params.id);
    if (!oldCharacter) {
      return res.status(404).json({
        success: false,
        error: '角色不存在'
      });
    }

    // 验证用户权限
    if (userId && oldCharacter.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: '无权修改此角色'
      });
    }

    // 删除旧角色
    await characterService.delete(req.params.id);

    // 创建新角色（使用相同的ID和用户ID）
    const character = await characterService.create(
      oldCharacter.book_id,
      name,
      appearance,
      personality,
      background,
      notes,
      userId,
      character_type || oldCharacter.character_type // 保持原有类型或使用新类型
    );

    res.json({
      success: true,
      data: character
    });
  } catch (error) {
    logger.error('更新角色失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * POST /api/books/:bookId/characters/batch-update-type
 * 批量修改角色类型
 */
router.post('/books/:bookId/characters/batch-update-type',
  authenticateToken,
  async (req, res) => {
  try {
    const userId = req.user.userId;
    const { characterIds, targetType } = req.body;

    if (!characterIds || !Array.isArray(characterIds) || characterIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供角色ID列表'
      });
    }

    if (!targetType || !['main_character', 'chapter_character'].includes(targetType)) {
      return res.status(400).json({
        success: false,
        error: '无效的目标类型'
      });
    }

    const db = require('../services/database.js');
    let updatedCount = 0;

    // 逐个更新角色类型
    for (const characterId of characterIds) {
      const character = await characterService.getById(characterId);

      if (!character) {
        continue; // 跳过不存在的角色
      }

      // 验证用户权限
      if (userId && character.user_id !== userId) {
        continue; // 跳过无权访问的角色
      }

      // 删除旧角色
      await characterService.delete(characterId);

      // 创建新角色（使用新类型）
      await characterService.create(
        character.book_id,
        character.name,
        character.appearance,
        character.personality,
        character.background,
        character.notes,
        userId,
        targetType
      );

      updatedCount++;
    }

    res.json({
      success: true,
      data: {
        updatedCount,
        targetType
      },
      message: `成功更新 ${updatedCount} 个角色的类型`
    });
  } catch (error) {
    logger.error('批量修改角色类型失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * POST /api/books/:bookId/characters/auto-classify
 * 自动分类所有未明确类型的角色
 */
router.post('/books/:bookId/characters/auto-classify',
  authenticateToken,
  async (req, res) => {
  try {
    const userId = req.user.userId;
    const characters = await characterService.getByBookId(req.params.bookId, userId);

    let updatedCount = 0;

    for (const character of characters) {
      // 只对类型为 main_character 且可能错误的角色进行重新分类
      if (character.character_type === 'main_character') {
        const inferredType = require('../services/database.js').inferCharacterType(
          character.name,
          character.created_at
        );

        // 如果推断结果不同，则更新
        if (inferredType !== character.character_type) {
          await characterService.delete(character.id);
          await characterService.create(
            character.book_id,
            character.name,
            character.appearance,
            character.personality,
            character.background,
            character.notes,
            userId,
            inferredType
          );
          updatedCount++;
        }
      }
    }

    res.json({
      success: true,
      data: {
        updatedCount,
        totalChecked: characters.length
      },
      message: `检查了 ${characters.length} 个角色，更新了 ${updatedCount} 个`
    });
  } catch (error) {
    logger.error('自动分类角色失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// ==================== 大纲管理 ====================

/**
 * GET /api/books/:bookId/outline
 * 获取书籍的大纲（按用户筛选）
 */
router.get('/books/:bookId/outline', async (req, res) => {
  try {
    const userId = '';
    const bookPlan = await bookPlanService.getByBookId(req.params.bookId, userId);
    res.json({
      success: true,
      data: bookPlan || null
    });
  } catch (error) {
    logger.error('获取大纲失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * POST /api/books/:bookId/outline
 * 创建或更新大纲（纯前端应用，无需认证）
 */
router.post('/books/:bookId/outline',
  validateRequest({
    main_outline: { type: 'string', required: false, maxLength: 10000 },
    volume_outline: { type: 'string', required: false, maxLength: 10000 },
    detailed_outline: { type: 'string', required: false, maxLength: 20000 }
  }),
  async (req, res) => {
  try {
    const userId = ''; // 纯前端应用，不关联用户
    const { main_outline = '', volume_outline = '', detailed_outline = '' } = req.body;

    const outline = await bookPlanService.upsert(req.params.bookId, {
      main_outline,
      volume_outline,
      detailed_outline,
      source: 'manual',
      status: 'draft'
    }, userId);

    res.json({
      success: true,
      data: outline
    });
  } catch (error) {
    logger.error('保存大纲失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * POST /api/books/:bookId/chapters/upsert
 * 按章号创建或更新章节（纯前端应用，无需认证）
 */
router.post('/books/:bookId/chapters/upsert',
  validateRequest({
    title: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    chapterName: { type: 'string', required: false, maxLength: 200 },
    content: { type: 'string', required: false, maxLength: 50000 },
    chapterNumber: { type: 'number', required: true, min: 1 }
  }),
  async (req, res) => {
  try {
    const userId = '';
    const { title, chapterName, content, chapterNumber } = req.body;

    const chapter = await chapterService.upsertByChapterNumber(
      req.params.bookId,
      chapterNumber,
      {
        title,
        chapter_name: chapterName || '',
        content: content || ''
      },
      userId
    );

    res.json({
      success: true,
      data: chapter
    });
  } catch (error) {
    logger.error('按章号保存章节失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * POST /api/books/:bookId/character-summary
 * 保存全书角色摘要（纯前端应用，无需认证）
 */
router.post('/books/:bookId/character-summary',
  validateRequest({
    summary: { type: 'string', required: false, maxLength: 20000 }
  }),
  async (req, res) => {
  try {
    const userId = '';
    const bookId = req.params.bookId;
    const summary = String(req.body.summary || '').trim();
    const legacyNames = ['全书角色设定', '本章新增角色'];

    const existingCharacters = await characterService.getByBookId(bookId, userId);
    for (const character of existingCharacters) {
      if (legacyNames.includes(character.name)) {
        await characterService.delete(character.id);
      }
    }

    let savedRecord = null;
    if (summary) {
      savedRecord = await characterService.create(
        bookId,
        '全书角色设定',
        '',
        '',
        summary,
        '',
        userId,
        'main_character'
      );
    }

    res.json({
      success: true,
      data: {
        summary,
        record: savedRecord
      }
    });
  } catch (error) {
    logger.error('保存全书角色摘要失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * GET /api/books/:bookId/chapter-plans
 * 获取书籍的所有章节规划
 */
router.get('/books/:bookId/chapter-plans', async (req, res) => {
  try {
    const userId = '';
    const plans = await chapterPlanService.getByBookId(req.params.bookId, userId);
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    logger.error('获取章节规划失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * GET /api/books/:bookId/chapter-plans/:chapterNumber
 * 获取单章规划
 */
router.get('/books/:bookId/chapter-plans/:chapterNumber', async (req, res) => {
  try {
    const userId = '';
    const chapterNumber = Number.parseInt(req.params.chapterNumber, 10);
    const plan = await chapterPlanService.getByBookAndChapterNumber(req.params.bookId, chapterNumber, userId);
    res.json({
      success: true,
      data: plan || null
    });
  } catch (error) {
    logger.error('获取单章规划失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * POST /api/books/:bookId/chapter-plans/:chapterNumber
 * 创建或更新单章规划
 */
router.post('/books/:bookId/chapter-plans/:chapterNumber',
  validateRequest({
    volume_number: { type: 'number', required: false, min: 1 },
    chapter_name: { type: 'string', required: false, maxLength: 200 },
    summary: { type: 'string', required: false, maxLength: 1000 },
    chapter_mission: { type: 'string', required: false, maxLength: 1000 },
    emotion_target: { type: 'string', required: false, maxLength: 500 },
    outline_text: { type: 'string', required: false, maxLength: 20000 },
    scene_outline: { type: 'array', required: false, maxLength: 50 },
    character_notes: { type: 'string', required: false, maxLength: 10000 },
    appearing_roles: { type: 'array', required: false, maxLength: 50 },
    previous_hook: { type: 'string', required: false, maxLength: 1000 },
    ending_hook: { type: 'string', required: false, maxLength: 1000 },
    main_storyline_id: { type: 'string', required: false, maxLength: 100 },
    target_storylines: { type: 'array', required: false, maxLength: 20 },
    structured_content: { type: 'object', required: false },
    source: { type: 'string', required: false, enum: ['manual', 'ai', 'imported'] },
    status: { type: 'string', required: false, enum: ['draft', 'generated', 'locked'] }
  }),
  async (req, res) => {
    try {
      const userId = '';
      const chapterNumber = Number.parseInt(req.params.chapterNumber, 10);
      const plan = await chapterPlanService.upsert(req.params.bookId, chapterNumber, req.body, userId);
      res.json({
        success: true,
        data: plan
      });
    } catch (error) {
      logger.error('保存单章规划失败', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        error: '服务器内部错误'
      });
    }
  }
);

/**
 * POST /api/books/:bookId/chapter-plans/:chapterNumber/review-confirm
 * 人工确认放行：在章节审计的 quality_check 上打 human_confirmed 标记，
 * 之后生成下一章时不再被"上一章质量门禁"阻塞。
 */
router.post('/books/:bookId/chapter-plans/:chapterNumber/review-confirm', async (req, res) => {
  try {
    const userId = '';
    const chapterNumber = Number.parseInt(req.params.chapterNumber, 10);
    if (!Number.isFinite(chapterNumber) || chapterNumber < 1) {
      return res.status(400).json({ success: false, error: 'chapterNumber 必须大于 0' });
    }

    const db = await dbPromise;
    const plan = execQueryOne(
      db,
      'SELECT * FROM chapter_plans WHERE book_id = ? AND chapter_number = ? ORDER BY updated_at DESC LIMIT 1',
      [req.params.bookId, chapterNumber]
    );
    if (!plan) {
      return res.status(404).json({ success: false, error: '章节规划不存在' });
    }

    let structuredContent = {};
    try {
      structuredContent = JSON.parse(plan.structured_content || '{}');
    } catch (_) {
      structuredContent = {};
    }
    if (!structuredContent.chapter_feedback || typeof structuredContent.chapter_feedback !== 'object') {
      structuredContent.chapter_feedback = {};
    }
    if (!structuredContent.chapter_feedback.quality_check || typeof structuredContent.chapter_feedback.quality_check !== 'object') {
      structuredContent.chapter_feedback.quality_check = {};
    }
    structuredContent.chapter_feedback.quality_check.human_confirmed = true;
    structuredContent.chapter_feedback.quality_check.human_confirmed_at = new Date().toISOString();

    db.run(
      'UPDATE chapter_plans SET structured_content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(structuredContent), plan.id]
    );
    saveDatabase(db);

    res.json({
      success: true,
      data: { confirmed: true, chapterNumber }
    });
  } catch (error) {
    logger.error('人工确认放行失败', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

module.exports = router;
