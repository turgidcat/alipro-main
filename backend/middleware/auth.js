const authConfig = require('../config/auth');
const { getActiveSession } = require('../services/auth-service');

function readBearerToken(req) {
  const authHeader = String(req.headers.authorization || '');
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

async function resolveAuthentication(req) {
  const token = readBearerToken(req);
  const session = token ? await getActiveSession(token) : null;
  if (session) return { ...session, token };
  return { userId: '', username: '', role: 'anonymous', sessionId: '', token: '' };
}

async function authenticateToken(req, res, next) {
  try {
    req.user = await resolveAuthentication(req);
    if (!req.user.userId && !authConfig.allowAnonymousData) {
      return res.status(401).json({ success: false, error: '请先登录后继续' });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

async function optionalAuth(req, res, next) {
  try {
    req.user = await resolveAuthentication(req);
    return next();
  } catch (error) {
    return next(error);
  }
}

async function requireAuth(req, res, next) {
  try {
    req.user = await resolveAuthentication(req);
    if (!req.user.userId) {
      return res.status(401).json({ success: false, error: '登录状态已失效，请重新登录' });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

function isAdmin(user) {
  return Boolean(user && user.role === 'admin');
}

module.exports = {
  authenticateToken,
  isAdmin,
  optionalAuth,
  readBearerToken,
  requireAuth,
  resolveAuthentication
};
