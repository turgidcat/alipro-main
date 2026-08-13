const express = require('express');
const crypto = require('crypto');
const logger = require('../utils/logger');
const authConfig = require('../config/auth');
const { BookService, ChapterService } = require('../services/database');
const ttsService = require('../services/tts-service');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { bookIdParamAccess, requestedBookAccess } = require('../middleware/book-access');

const router = express.Router();
const bookService = new BookService();
const chapterService = new ChapterService();

function signAudioTicket(audioId, userId, expiresAt) {
  return crypto.createHmac('sha256', authConfig.audioTicketSecret)
    .update(`${audioId}:${userId}:${expiresAt}`)
    .digest('hex');
}

function withAudioTicket(entry, userId) {
  if (!entry) return entry;
  const expiresAt = Date.now() + 10 * 60 * 1000;
  return {
    ...entry,
    audioTicket: signAudioTicket(entry.id, userId, expiresAt),
    audioTicketExpiresAt: expiresAt,
    audioTicketUser: userId
  };
}

function validAudioTicket(req) {
  const expiresAt = Number(req.query.expires || 0);
  const userId = String(req.query.user || '');
  const provided = String(req.query.ticket || '');
  if (!provided || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  const expected = signAudioTicket(req.params.id, userId, expiresAt);
  if (provided.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected)) ? userId : null;
}

router.get('/audio/:id', async (req, res) => {
  const ticketUserId = validAudioTicket(req);
  const resolved = ttsService.resolveAudioFile(req.params.id);
  if (!resolved) return sendError(res, 404, '音频不存在或已被删除');
  if (ticketUserId === null && !authConfig.allowAnonymousData) return sendError(res, 401, '音频播放凭证已失效');
  if (ticketUserId !== null) {
    const entryOwner = String(resolved.entry.ownerUserId || '');
    if (entryOwner && entryOwner !== ticketUserId) return sendError(res, 403, '无权播放此音频');
    if (!entryOwner && resolved.entry.bookId === 'custom') return sendError(res, 403, '旧的自定义音频需要重新生成');
    if (!entryOwner && resolved.entry.bookId !== 'custom') {
      const book = await bookService.getById(resolved.entry.bookId);
      if (!book || (String(book.user_id || '') !== ticketUserId && ticketUserId !== 'admin')) return sendError(res, 403, '无权播放此音频');
    }
  }
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, no-store');
  return res.sendFile(resolved.file, (error) => {
    if (error && !res.headersSent) sendError(res, 404, '音频文件读取失败');
  });
});

router.use(authenticateToken);
router.param('bookId', bookIdParamAccess);
router.use(requestedBookAccess);

function sendError(res, status, message) {
  return res.status(status).json({ success: false, error: message });
}

/**
 * GET /api/tts/voices
 * 获取可用中文音色（实时拉取，带缓存与离线回退）。
 */
router.get('/voices', async (req, res) => {
  try {
    const data = await ttsService.getZhVoices();
    res.json({ success: true, data });
  } catch (error) {
    logger.error('获取 TTS 音色失败', { error: error.message });
    sendError(res, 500, '获取音色列表失败，请稍后重试');
  }
});

/**
 * POST /api/tts/synthesize
 * 生成一章有声书。两种方式：
 *  - 传 bookId + chapterNumber：读取数据库中的章节正文；
 *  - 传 text：直接合成自定义文本（最多 50000 字）。
 */
router.post('/synthesize', async (req, res) => {
  const { bookId, chapterNumber, text, voice, rate, volume, pitch, outputFormat } = req.body || {};
  const voiceName = String(voice || '').trim();

  if (!voiceName) {
    return sendError(res, 400, '请选择朗读音色');
  }

  let chapter = null;
  let chapterTitle = '';
  let bookTitle = '';
  let content = '';

  if (text !== undefined) {
    content = String(text || '');
    if (!content.trim()) {
      return sendError(res, 400, '没有可合成的文本');
    }
    if (content.length > 50000) {
      return sendError(res, 400, '单次合成文本不能超过 50000 字');
    }
  } else {
    const parsedChapter = Number(chapterNumber);
    if (!bookId || !Number.isFinite(parsedChapter) || parsedChapter < 1) {
      return sendError(res, 400, '请提供有效的书籍与章节');
    }
    if (!ttsService.isValidBookId(bookId)) {
      return sendError(res, 400, '书籍 ID 无效');
    }

    try {
      const book = await bookService.getById(bookId);
      chapter = await chapterService.getByBookAndChapterNumber(bookId, parsedChapter);
      bookTitle = book?.title || '';
      content = String(chapter?.content || '');
      chapterTitle = chapter?.chapter_name
        || chapter?.title
        || `第${parsedChapter}章`;
    } catch (error) {
      logger.error('读取章节正文失败', { error: error.message, bookId, chapterNumber });
      return sendError(res, 500, '读取章节正文失败');
    }

    if (!content.trim()) {
      return sendError(res, 400, `第${parsedChapter}章还没有正文，请先创作章节内容`);
    }
  }

  try {
    const voices = await ttsService.getZhVoices();
    const known = voices.voices.some((v) => v.shortName === voiceName);
    if (voices.source === 'live' && !known) {
      return sendError(res, 400, '所选音色不存在，请重新选择');
    }

    const entry = await ttsService.createChapterAudio({
      bookId: bookId || 'custom',
      chapterNumber: chapterNumber || 0,
      chapterTitle: chapterTitle || '自定义文本',
      bookTitle: bookTitle || '自定义文本',
      text: content,
      voice: voiceName,
      rate: Number(rate) || 0,
      volume: Number(volume) || 0,
      pitch: Number(pitch) || 0,
      outputFormat,
      ownerUserId: req.user.userId
    });
    logger.info('有声书章节生成成功', {
      id: entry.id,
      bookId: entry.bookId,
      chapterNumber: entry.chapterNumber,
      voice: entry.voice
    });
    res.json({ success: true, data: withAudioTicket(entry, req.user.userId) });
  } catch (error) {
    logger.error('有声书生成失败', {
      error: error.message,
      bookId,
      chapterNumber,
      voice: voiceName
    });
    const status = error.status || 500;
    const message = status === 400 ? error.message : '有声书生成失败，请检查网络后重试';
    sendError(res, status, message);
  }
});

/**
 * POST /api/tts/preview
 * 用当前参数试听一段短文本（不写入 manifest），返回 base64 音频。
 */
router.post('/preview', async (req, res) => {
  const { text, voice, rate, volume, pitch, outputFormat } = req.body || {};
  const voiceName = String(voice || '').trim();
  const previewText = String(text || '').trim();

  if (!voiceName) {
    return sendError(res, 400, '请选择朗读音色');
  }
  if (!previewText) {
    return sendError(res, 400, '没有可试听的文本');
  }
  if (previewText.length > 500) {
    return sendError(res, 400, '试听文本不能超过 500 字');
  }

  try {
    const voices = await ttsService.getZhVoices();
    const known = voices.voices.some((v) => v.shortName === voiceName);
    if (voices.source === 'live' && !known) {
      return sendError(res, 400, '所选音色不存在，请重新选择');
    }

    const { audio } = await ttsService.synthesizeText(previewText, {
      voice: voiceName,
      rate: Number(rate) || 0,
      volume: Number(volume) || 0,
      pitch: Number(pitch) || 0,
      outputFormat
    });
    res.json({
      success: true,
      data: {
        audioBase64: audio.toString('base64'),
        mimeType: 'audio/mpeg'
      }
    });
  } catch (error) {
    logger.error('TTS 试听失败', {
      error: error.message,
      voice: voiceName,
      textLength: previewText.length
    });
    const status = error.status || 500;
    const message = status === 400 ? error.message : '试听生成失败，请检查网络后重试';
    sendError(res, status, message);
  }
});

/**
 * GET /api/tts/books/:bookId/audio
 * 查询一本书已生成的有声书章节。
 */
router.get('/books/:bookId/audio', (req, res) => {
  const { bookId } = req.params;
  res.json({
    success: true,
    data: ttsService.listBookAudio(bookId).map((entry) => withAudioTicket(entry, req.user.userId))
  });
});

/**
 * GET /api/tts/books/:bookId/download
 * 批量下载一本书的有声书：zip 内为「书名/章节名.mp3」。
 */
router.get('/books/:bookId/download', (req, res) => {
  const { bookId } = req.params;
  const result = ttsService.buildBookAudioZip(bookId);
  if (!result) {
    return sendError(res, 404, '这本书还没有可下载的有声书');
  }
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="audiobook.zip"; filename*=UTF-8''${encodeURIComponent(result.zipName)}`
  );
  res.setHeader('Content-Length', String(result.buffer.length));
  return res.send(result.buffer);
});

/**
 * GET /api/tts/audio/:id
 * 流式返回音频文件（支持 <audio> 的 Range 请求）。
 */
router.delete('/audio/:id', async (req, res) => {
  const resolved = ttsService.resolveAudioFile(req.params.id);
  if (!resolved) return sendError(res, 404, '音频不存在或已被删除');
  const ownerUserId = String(resolved.entry.ownerUserId || '');
  if (!isAdmin(req.user) && ownerUserId && ownerUserId !== req.user.userId) return sendError(res, 403, '无权删除此音频');
  if (!isAdmin(req.user) && !ownerUserId) {
    if (resolved.entry.bookId === 'custom') return sendError(res, 403, '无权删除此旧音频');
    const book = await bookService.getById(resolved.entry.bookId);
    if (!book || String(book.user_id || '') !== req.user.userId) return sendError(res, 403, '无权删除此音频');
  }
  const removed = ttsService.deleteAudio(req.params.id);
  if (!removed) {
    return sendError(res, 404, '音频不存在或已被删除');
  }
  res.json({ success: true, data: { removed: true } });
});

module.exports = router;
