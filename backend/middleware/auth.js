const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * 认证中间件 - 验证JWT Token并提取用户信息
 * 使用方法：router.get('/path', authenticateToken, handler)
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // 如果没有Token，返回空用户（允许未登录用户访问，但数据隔离会基于空字符串）
    req.user = { userId: '', username: '', role: 'anonymous' };
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role
    };
    next();
  } catch (error) {
    // Token无效时，返回空用户而不是拒绝请求
    console.warn('️ Token验证失败:', error.message);
    req.user = { userId: '', username: '', role: 'anonymous' };
    next();
  }
}

/**
 * 强制认证中间件 - 必须提供有效的Token
 * 使用方法：router.post('/path', requireAuth, handler)
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: '未提供认证信息'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token已过期，请重新登录'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Token无效'
    });
  }
}

/**
 * 检查用户是否为管理员
 * @param {Object} user - req.user 对象
 * @returns {boolean}
 */
function isAdmin(user) {
  return user && user.role === 'admin';
}

module.exports = {
  authenticateToken,
  requireAuth,
  isAdmin
};
