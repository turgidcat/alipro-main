const dbPromise = require('../database/init');
const authConfig = require('../config/auth');
const { execQueryOne } = require('../services/database');
const { isAdmin } = require('./auth');

function normalizeBookId(value) {
  return String(value || '').trim();
}

async function verifyBookAccess(req, res, next, rawBookId) {
  try {
    const bookId = normalizeBookId(rawBookId);
    if (!bookId) return next();

    const db = await dbPromise;
    const book = execQueryOne(db, 'SELECT * FROM books WHERE id = ?', [bookId]);
    if (!book) {
      return res.status(404).json({ success: false, error: '作品不存在' });
    }

    const userId = String(req.user?.userId || '');
    const ownerId = String(book.user_id || '');
    const canUseAnonymousLegacyData = authConfig.allowAnonymousData && !userId && !ownerId;
    if (!isAdmin(req.user) && ownerId !== userId && !canUseAnonymousLegacyData) {
      return res.status(403).json({ success: false, error: '无权访问此作品' });
    }

    req.book = book;
    return next();
  } catch (error) {
    return next(error);
  }
}

function bookIdParamAccess(req, res, next, bookId) {
  return verifyBookAccess(req, res, next, bookId);
}

function requestedBookAccess(req, res, next) {
  const bookId = req.params?.bookId
    || req.body?.bookId
    || req.body?.book_id
    || req.query?.bookId
    || req.query?.book_id;
  return verifyBookAccess(req, res, next, bookId);
}

module.exports = {
  bookIdParamAccess,
  requestedBookAccess,
  verifyBookAccess
};
