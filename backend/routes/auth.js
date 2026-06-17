const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dbPromise = require('../database/init');
const { execQuery, execQueryOne } = require('../services/database');

const router = express.Router();

// UUID生成函数（不依赖uuid包）
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// JWT密钥（应从环境变量读取）
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d'; // Token有效期7天

/**
 * 用户注册接口
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '用户名和密码不能为空'
      });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({
        success: false,
        error: '用户名长度必须在3-20个字符之间'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: '密码长度至少6位'
      });
    }

    // 获取数据库实例（异步初始化）
    const db = await dbPromise;

    // 检查用户名是否已存在
    const existingUsers = execQuery(db, 'SELECT id FROM users WHERE username = ?', [username]);
    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        error: '用户名已存在'
      });
    }

    // 密码加密
    const passwordHash = await bcrypt.hash(password, 10);

    // 插入用户
    const userId = generateId();
    db.run(
      `INSERT INTO users (id, username, password_hash, email, role, status) VALUES (?, ?, ?, ?, 'user', 'active')`,
      [userId, username, passwordHash, email || '']
    );

    // 生成JWT Token
    const token = jwt.sign(
      { userId, username, role: 'user' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log(`✅ 用户注册成功: ${username}`);

    res.json({
      success: true,
      message: '注册成功',
      data: {
        userId,
        username,
        token
      }
    });

  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({
      success: false,
      error: '注册失败，请稍后重试'
    });
  }
});

/**
 * 用户登录接口
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '用户名和密码不能为空'
      });
    }

    // 获取数据库实例（异步初始化）
    const db = await dbPromise;

    // 查找用户
    const users = execQuery(db, 'SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }

    const user = users[0];

    // 检查用户状态
    if (user.status === 'disabled') {
      return res.status(403).json({
        success: false,
        error: '账号已被禁用'
      });
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }

    // 更新最后登录时间
    db.run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    // 生成JWT Token
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log(`✅ 用户登录成功: ${username}`);

    res.json({
      success: true,
      message: '登录成功',
      data: {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        token
      }
    });

  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({
      success: false,
      error: '登录失败，请稍后重试'
    });
  }
});

/**
 * 验证Token接口
 * POST /api/auth/verify
 */
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token不能为空'
      });
    }

    // 验证Token
    const decoded = jwt.verify(token, JWT_SECRET);

    // 获取数据库实例（异步初始化）
    const db = await dbPromise;

    // 查询用户信息
    const users = execQuery(db, 'SELECT id, username, email, role, status FROM users WHERE id = ?', [decoded.userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }

    const user = users[0];

    if (user.status === 'disabled') {
      return res.status(403).json({
        success: false,
        error: '账号已被禁用'
      });
    }

    res.json({
      success: true,
      data: {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token无效或已过期'
      });
    }

    console.error('Token验证失败:', error);
    res.status(500).json({
      success: false,
      error: 'Token验证失败'
    });
  }
});

/**
 * 获取用户信息接口
 * GET /api/auth/profile
 */
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: '未提供认证信息'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // 获取数据库实例（异步初始化）
    const db = await dbPromise;

    // 查询用户信息
    const users = execQuery(db, 'SELECT id, username, email, role, status, created_at, last_login_at FROM users WHERE id = ?', [decoded.userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }

    const user = users[0];

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token无效或已过期'
      });
    }

    console.error('获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      error: '获取用户信息失败'
    });
  }
});

module.exports = router;
