const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const databasePromise = require('../database/init');
const authConfig = require('../config/auth');
const { execQuery, execQueryOne, saveDatabase } = require('./database');
const { ensureAuthSchema } = require('./auth-schema');

const authDbPromise = databasePromise.then((db) => {
  ensureAuthSchema(db);
  saveDatabase(db);
  return db;
});

function generateId() {
  return crypto.randomUUID();
}

function sqliteDate(date) {
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  const local = digits.startsWith('86') && digits.length === 13 ? digits.slice(2) : digits;
  return /^1[3-9]\d{9}$/.test(local) ? local : '';
}

function safeUser(user, providers = []) {
  if (!user) return null;
  let settings = {};
  try { settings = JSON.parse(user.settings_json || '{}'); } catch (_) {}
  return {
    userId: user.id,
    username: user.username,
    phone: user.phone || '',
    phoneVerified: Boolean(user.phone_verified_at),
    passwordEnabled: user.password_enabled !== 0,
    email: user.email || '',
    displayName: user.display_name || user.username,
    avatar: user.avatar || '',
    role: user.role || 'user',
    status: user.status || 'active',
    settings,
    providers: providers.map((item) => ({
      provider: item.provider,
      displayName: item.display_name || '',
      avatar: item.avatar || ''
    })),
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at
  };
}

async function getUserById(userId) {
  const db = await authDbPromise;
  const user = execQueryOne(db, 'SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return null;
  const providers = execQuery(db, 'SELECT provider, display_name, avatar FROM auth_identities WHERE user_id = ? ORDER BY created_at ASC', [userId]);
  return safeUser(user, providers);
}

async function createSession(user, requestMeta = {}) {
  const db = await authDbPromise;
  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const token = jwt.sign({
    userId: user.id,
    username: user.username,
    role: user.role,
    sessionId
  }, authConfig.jwtSecret, { expiresIn: authConfig.jwtExpiresIn });
  db.run(`
    INSERT INTO auth_sessions (id, user_id, token_hash, device_name, user_agent, ip_address, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    sessionId,
    user.id,
    authConfig.hash(token),
    String(requestMeta.deviceName || '').slice(0, 120),
    String(requestMeta.userAgent || '').slice(0, 300),
    String(requestMeta.ipAddress || '').slice(0, 80),
    sqliteDate(expiresAt)
  ]);
  db.run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
  saveDatabase(db);
  return { token, user: await getUserById(user.id) };
}

async function getActiveSession(token) {
  if (!token) return null;
  let decoded;
  try {
    decoded = jwt.verify(token, authConfig.jwtSecret);
  } catch (_) {
    return null;
  }
  const db = await authDbPromise;
  if (!decoded.sessionId) return null;
  const session = execQueryOne(db, `
    SELECT s.*, u.username, u.role, u.status
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.user_id = ? AND s.token_hash = ?
      AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP
    LIMIT 1
  `, [decoded.sessionId, decoded.userId, authConfig.hash(token)]);
  if (!session || session.status !== 'active') return null;
  return {
    sessionId: session.id,
    userId: session.user_id,
    username: session.username,
    role: session.role
  };
}

async function revokeSession(sessionId, userId) {
  const db = await authDbPromise;
  db.run('UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [sessionId, userId]);
  saveDatabase(db);
}

async function createPhoneUser({ phone, password = '', displayName = '' }) {
  const db = await authDbPromise;
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) throw new Error('手机号格式不正确');
  const existing = execQueryOne(db, 'SELECT * FROM users WHERE phone = ?', [normalizedPhone]);
  if (existing) return existing;
  const userId = generateId();
  const username = `u_${normalizedPhone.slice(-4)}_${crypto.randomBytes(3).toString('hex')}`;
  const passwordHash = await bcrypt.hash(password || crypto.randomBytes(32).toString('hex'), 10);
  db.run(`
    INSERT INTO users (id, username, password_hash, password_enabled, phone, display_name, role, status, phone_verified_at)
    VALUES (?, ?, ?, ?, ?, ?, 'user', 'active', CURRENT_TIMESTAMP)
  `, [userId, username, passwordHash, password ? 1 : 0, normalizedPhone, String(displayName || '').trim().slice(0, 40)]);
  saveDatabase(db);
  return execQueryOne(db, 'SELECT * FROM users WHERE id = ?', [userId]);
}

async function upsertOAuthUser(provider, profile, linkUserId = '') {
  const db = await authDbPromise;
  const providerUserId = String(profile.providerUserId || '').trim();
  if (!providerUserId) throw new Error('第三方账号标识缺失');
  const existingIdentity = execQueryOne(db, 'SELECT * FROM auth_identities WHERE provider = ? AND provider_user_id = ?', [provider, providerUserId]);
  if (existingIdentity) {
    if (linkUserId && existingIdentity.user_id !== linkUserId) {
      const error = new Error('该第三方账号已绑定其他用户');
      error.statusCode = 409;
      throw error;
    }
    db.run('UPDATE auth_identities SET display_name = ?, avatar = ?, union_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [profile.displayName || '', profile.avatar || '', profile.unionId || '', existingIdentity.id]);
    saveDatabase(db);
    return execQueryOne(db, 'SELECT * FROM users WHERE id = ?', [existingIdentity.user_id]);
  }
  const userId = linkUserId || generateId();
  if (!linkUserId) {
    const username = `${provider}_${crypto.randomBytes(6).toString('hex')}`;
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    db.run('INSERT INTO users (id, username, password_hash, password_enabled, display_name, avatar, role, status) VALUES (?, ?, ?, 0, ?, ?, \'user\', \'active\')', [userId, username, passwordHash, profile.displayName || '', profile.avatar || '']);
  }
  db.run(`
    INSERT INTO auth_identities (id, user_id, provider, provider_user_id, union_id, display_name, avatar)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [generateId(), userId, provider, providerUserId, profile.unionId || '', profile.displayName || '', profile.avatar || '']);
  saveDatabase(db);
  return execQueryOne(db, 'SELECT * FROM users WHERE id = ?', [userId]);
}

module.exports = {
  authDbPromise,
  createPhoneUser,
  createSession,
  generateId,
  getActiveSession,
  getUserById,
  normalizePhone,
  revokeSession,
  safeUser,
  sqliteDate,
  upsertOAuthUser
};
