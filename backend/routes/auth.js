const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const authConfig = require('../config/auth');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { execQuery, execQueryOne, saveDatabase } = require('../services/database');
const logger = require('../utils/logger');
const {
  authDbPromise,
  createPhoneUser,
  createSession,
  generateId,
  getUserById,
  normalizePhone,
  revokeSession,
  sqliteDate,
  upsertOAuthUser
} = require('../services/auth-service');
const { checkVerificationCode, getSmsConfiguration, sendVerificationCode } = require('../services/aliyun-sms');

const router = express.Router();
const validSmsPurposes = new Set(['register', 'login', 'bind_phone']);

function requestIp(req) {
  return String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '').slice(0, 80);
}

function recentSmsCount(db, whereSql, values, windowModifier) {
  const row = execQueryOne(db, `
    SELECT COUNT(*) AS count FROM sms_verification_codes
    WHERE ${whereSql} AND created_at > datetime('now', ?)
  `, [...values, windowModifier]);
  return Number(row?.count || 0);
}

function smsRateLimitError(db, phone, ipAddress) {
  const limits = authConfig.smsRateLimits;
  const recent = execQueryOne(db, `
    SELECT id FROM sms_verification_codes
    WHERE phone = ? AND created_at > datetime('now', ?)
    ORDER BY created_at DESC LIMIT 1
  `, [phone, `-${limits.minimumIntervalSeconds} seconds`]);
  if (recent) return { error: '验证码发送过于频繁，请稍后再试', retryAfter: limits.minimumIntervalSeconds };
  if (recentSmsCount(db, 'phone = ?', [phone], '-1 hour') >= limits.phoneHourly) {
    return { error: '该手机号请求次数过多，请一小时后再试', retryAfter: 3600 };
  }
  if (recentSmsCount(db, 'phone = ?', [phone], '-1 day') >= limits.phoneDaily) {
    return { error: '该手机号今日请求次数已达上限', retryAfter: 86400 };
  }
  if (recentSmsCount(db, 'request_ip = ?', [ipAddress], '-10 minutes') >= limits.ipTenMinutes) {
    return { error: '当前网络请求次数过多，请稍后再试', retryAfter: 600 };
  }
  if (recentSmsCount(db, 'request_ip = ?', [ipAddress], '-1 hour') >= limits.ipHourly) {
    return { error: '当前网络请求次数过多，请一小时后再试', retryAfter: 3600 };
  }
  if (recentSmsCount(db, 'request_ip = ?', [ipAddress], '-1 day') >= limits.ipDaily) {
    return { error: '当前网络今日请求次数已达上限', retryAfter: 86400 };
  }
  if (recentSmsCount(db, '1 = 1', [], '-1 day') >= limits.globalDaily) {
    return { error: '今日验证码发送量已达安全上限，请稍后再试', retryAfter: 86400 };
  }
  return null;
}

function requestMeta(req) {
  return {
    deviceName: req.body?.deviceName || req.get('X-Device-Name') || '',
    userAgent: req.get('User-Agent') || '',
    ipAddress: req.ip || req.socket?.remoteAddress || ''
  };
}

function isAllowedReturnUrl(value) {
  const returnUrl = String(value || '').trim();
  if (!returnUrl) return true;
  if (returnUrl.startsWith('alipro://auth/')) return true;
  try {
    const candidate = new URL(returnUrl);
    const publicOrigin = new URL(authConfig.publicAppUrl).origin;
    return candidate.origin === publicOrigin
      || candidate.origin === 'https://localhost'
      || candidate.origin === 'http://127.0.0.1:5173'
      || candidate.origin === 'http://localhost:5173';
  } catch (_) {
    return false;
  }
}

function providerConfiguration(provider) {
  if (provider === 'qq') return authConfig.qq;
  if (provider === 'wechat') return authConfig.wechat;
  return null;
}

function callbackUrl(provider) {
  return `${authConfig.publicApiUrl}/auth/oauth/${provider}/callback`;
}

function oauthFailureRedirect(returnUrl, message) {
  const target = isAllowedReturnUrl(returnUrl) && returnUrl ? returnUrl : `${authConfig.publicAppUrl}/auth/callback`;
  const separator = target.includes('?') ? '&' : '?';
  return `${target}${separator}error=${encodeURIComponent(message || '第三方登录失败')}`;
}

async function consumeSmsCode(db, phone, purpose, code) {
  const record = execQueryOne(db, `
    SELECT * FROM sms_verification_codes
    WHERE phone = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP
    ORDER BY created_at DESC LIMIT 1
  `, [phone, purpose]);
  if (!record || Number(record.attempt_count || 0) >= 5) return false;
  let matches = false;
  if (record.provider === 'aliyun-pnvs') {
    matches = await checkVerificationCode({
      phone,
      code,
      outId: record.provider_out_id || record.id
    });
  } else {
    matches = crypto.timingSafeEqual(
      Buffer.from(record.code_hash),
      Buffer.from(authConfig.hmac(`${phone}:${purpose}:${code}`))
    );
  }
  if (!matches) {
    db.run('UPDATE sms_verification_codes SET attempt_count = attempt_count + 1 WHERE id = ?', [record.id]);
    saveDatabase(db);
    return false;
  }
  db.run('UPDATE sms_verification_codes SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?', [record.id]);
  return true;
}

router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: {
      phone: true,
      smsConfigured: getSmsConfiguration().configured,
      qq: Boolean(authConfig.qq.appId && authConfig.qq.appKey),
      wechat: Boolean(authConfig.wechat.appId && authConfig.wechat.appSecret),
      serverData: true,
      dataRegion: String(process.env.DATA_REGION || (authConfig.isProduction ? 'aliyun-ecs' : 'local-development'))
    }
  });
});

router.post('/sms/send', optionalAuth, async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const purpose = String(req.body.purpose || 'login');
    if (!phone) return res.status(400).json({ success: false, error: '请输入正确的手机号' });
    if (!validSmsPurposes.has(purpose)) return res.status(400).json({ success: false, error: '验证码用途无效' });
    const db = await authDbPromise;
    if (purpose === 'bind_phone' && !req.user.userId) {
      return res.status(401).json({ success: false, error: '请先登录后绑定手机号' });
    }
    const existingUser = execQueryOne(db, 'SELECT id FROM users WHERE phone = ?', [phone]);
    if (purpose === 'register' && existingUser) {
      return res.status(409).json({ success: false, error: '该手机号已经注册，请直接登录' });
    }
    if (purpose === 'login' && !existingUser) {
      return res.status(404).json({ success: false, error: '该手机号尚未注册' });
    }
    if (purpose === 'bind_phone' && existingUser && existingUser.id !== req.user.userId) {
      return res.status(409).json({ success: false, error: '该手机号已经绑定其他账号' });
    }
    const ipAddress = requestIp(req);
    const limitError = smsRateLimitError(db, phone, ipAddress);
    if (limitError) {
      res.setHeader('Retry-After', String(limitError.retryAfter));
      return res.status(429).json({ success: false, ...limitError });
    }
    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + authConfig.smsCodeTtlMinutes * 60 * 1000);
    const codeRecordId = generateId();
    db.run(`
      UPDATE sms_verification_codes SET consumed_at = CURRENT_TIMESTAMP
      WHERE phone = ? AND purpose = ? AND consumed_at IS NULL
    `, [phone, purpose]);
    db.run(`
      INSERT INTO sms_verification_codes (id, phone, purpose, code_hash, request_ip, expires_at, provider, provider_out_id)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `, [codeRecordId, phone, purpose, authConfig.hmac(`${phone}:${purpose}:${code}`), ipAddress, sqliteDate(expiresAt), codeRecordId]);
    saveDatabase(db);
    let result;
    try {
      result = await sendVerificationCode({ phone, purpose, localCode: code, outId: codeRecordId });
    } catch (sendError) {
      db.run('DELETE FROM sms_verification_codes WHERE id = ?', [codeRecordId]);
      saveDatabase(db);
      throw sendError;
    }
    db.run(`
      UPDATE sms_verification_codes
      SET provider = ?, provider_out_id = ?, provider_biz_id = ?
      WHERE id = ?
    `, [result.provider, result.outId || codeRecordId, result.bizId || '', codeRecordId]);
    saveDatabase(db);
    res.json({
      success: true,
      data: {
        sent: result.sent,
        expiresIn: authConfig.smsCodeTtlMinutes * 60,
        ...(result.developmentCode ? { developmentCode: result.developmentCode } : {})
      }
    });
  } catch (error) {
    if (error.providerCode) {
      logger.error('Aliyun SMS send failed', {
        providerCode: error.providerCode,
        providerMessage: error.providerMessage || '',
        phoneSuffix: String(req.body?.phone || '').replace(/\D/g, '').slice(-4)
      });
    }
    res.status(error.statusCode || 500).json({ success: false, error: error.message || '验证码发送失败' });
  }
});

router.post('/phone/register', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const code = String(req.body.code || '').trim();
    const password = String(req.body.password || '');
    if (!phone || !/^\d{6}$/.test(code)) return res.status(400).json({ success: false, error: '手机号或验证码不正确' });
    if (password && password.length < 8) return res.status(400).json({ success: false, error: '密码至少需要 8 位' });
    const db = await authDbPromise;
    if (execQueryOne(db, 'SELECT id FROM users WHERE phone = ?', [phone])) return res.status(409).json({ success: false, error: '该手机号已经注册' });
    if (!await consumeSmsCode(db, phone, 'register', code)) return res.status(400).json({ success: false, error: '验证码错误或已过期' });
    const user = await createPhoneUser({ phone, password, displayName: req.body.displayName });
    res.json({ success: true, data: await createSession(user, requestMeta(req)) });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message || '注册失败' });
  }
});

router.post('/phone/login', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const code = String(req.body.code || '').trim();
    if (!phone || !/^\d{6}$/.test(code)) return res.status(400).json({ success: false, error: '手机号或验证码不正确' });
    const db = await authDbPromise;
    if (!await consumeSmsCode(db, phone, 'login', code)) return res.status(400).json({ success: false, error: '验证码错误或已过期' });
    const user = execQueryOne(db, 'SELECT * FROM users WHERE phone = ?', [phone]);
    if (!user) return res.status(404).json({ success: false, error: '该手机号尚未注册' });
    if (user.status !== 'active') return res.status(403).json({ success: false, error: '账号已被禁用' });
    res.json({ success: true, data: await createSession(user, requestMeta(req)) });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message || '登录失败' });
  }
});

// Temporary compatibility for the existing desktop/web account flow. New
// mobile registrations use /phone/register and SMS verification.
router.post('/register', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const email = String(req.body.email || '').trim();
    if (!username || !password) return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
    if (username.length < 3 || username.length > 20) return res.status(400).json({ success: false, error: '用户名长度必须在3-20个字符之间' });
    if (password.length < 6) return res.status(400).json({ success: false, error: '密码长度至少6位' });
    const db = await authDbPromise;
    if (execQueryOne(db, 'SELECT id FROM users WHERE username = ?', [username])) {
      return res.status(409).json({ success: false, error: '用户名已存在' });
    }
    const userId = generateId();
    const passwordHash = await bcrypt.hash(password, 10);
    db.run(`
      INSERT INTO users (id, username, password_hash, password_enabled, email, display_name, role, status)
      VALUES (?, ?, ?, 1, ?, ?, 'user', 'active')
    `, [userId, username, passwordHash, email, username]);
    saveDatabase(db);
    const session = await createSession(execQueryOne(db, 'SELECT * FROM users WHERE id = ?', [userId]), requestMeta(req));
    res.json({
      success: true,
      message: '注册成功',
      data: { ...session, userId, username }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: '注册失败，请稍后重试' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const account = String(req.body.account || req.body.username || req.body.phone || '').trim();
    const password = String(req.body.password || '');
    if (!account || !password) return res.status(400).json({ success: false, error: '账号和密码不能为空' });
    const db = await authDbPromise;
    const phone = normalizePhone(account);
    const user = phone
      ? execQueryOne(db, 'SELECT * FROM users WHERE phone = ?', [phone])
      : execQueryOne(db, 'SELECT * FROM users WHERE username = ?', [account]);
    if (!user || user.password_enabled === 0 || !await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ success: false, error: '账号或密码错误' });
    if (user.status !== 'active') return res.status(403).json({ success: false, error: '账号已被禁用' });
    const session = await createSession(user, requestMeta(req));
    res.json({
      success: true,
      data: { ...session, userId: user.id, username: user.username, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: '登录失败，请稍后重试' });
  }
});

router.get('/profile', requireAuth, async (req, res) => {
  const user = await getUserById(req.user.userId);
  if (!user) return res.status(404).json({ success: false, error: '用户不存在' });
  res.json({ success: true, data: user });
});

router.put('/profile', requireAuth, async (req, res) => {
  const db = await authDbPromise;
  const displayName = String(req.body.displayName || '').trim().slice(0, 40);
  const avatar = String(req.body.avatar || '').trim().slice(0, 2000000);
  db.run('UPDATE users SET display_name = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [displayName, avatar, req.user.userId]);
  saveDatabase(db);
  res.json({ success: true, data: await getUserById(req.user.userId) });
});

router.put('/settings', requireAuth, async (req, res) => {
  const allowed = ['theme', 'readerFontSize', 'readerLineHeight', 'generationSound', 'privacyMode'];
  const current = await getUserById(req.user.userId);
  const settings = { ...(current?.settings || {}) };
  allowed.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) settings[key] = req.body[key];
  });
  const db = await authDbPromise;
  db.run('UPDATE users SET settings_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(settings), req.user.userId]);
  saveDatabase(db);
  res.json({ success: true, data: await getUserById(req.user.userId) });
});

router.put('/password', requireAuth, async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  if (newPassword.length < 8) return res.status(400).json({ success: false, error: '新密码至少需要 8 位' });
  const db = await authDbPromise;
  const user = execQueryOne(db, 'SELECT * FROM users WHERE id = ?', [req.user.userId]);
  if (!user || (user.password_enabled !== 0 && !await bcrypt.compare(currentPassword, user.password_hash))) {
    return res.status(400).json({ success: false, error: '当前密码不正确' });
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  db.run('UPDATE users SET password_hash = ?, password_enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [passwordHash, req.user.userId]);
  saveDatabase(db);
  res.json({ success: true, data: { passwordChanged: true } });
});

router.post('/phone/bind', requireAuth, async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const code = String(req.body.code || '').trim();
  if (!phone || !/^\d{6}$/.test(code)) return res.status(400).json({ success: false, error: '手机号或验证码不正确' });
  const db = await authDbPromise;
  const occupied = execQueryOne(db, 'SELECT id FROM users WHERE phone = ? AND id <> ?', [phone, req.user.userId]);
  if (occupied) return res.status(409).json({ success: false, error: '该手机号已经绑定其他账号' });
  if (!await consumeSmsCode(db, phone, 'bind_phone', code)) return res.status(400).json({ success: false, error: '验证码错误或已过期' });
  db.run('UPDATE users SET phone = ?, phone_verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [phone, req.user.userId]);
  saveDatabase(db);
  res.json({ success: true, data: await getUserById(req.user.userId) });
});

router.post('/logout', requireAuth, async (req, res) => {
  await revokeSession(req.user.sessionId, req.user.userId);
  res.json({ success: true, data: { loggedOut: true } });
});

router.post('/verify', requireAuth, async (req, res) => {
  res.json({ success: true, data: await getUserById(req.user.userId) });
});

router.post('/oauth/:provider/start', optionalAuth, async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();
  const configuration = providerConfiguration(provider);
  if (!configuration) return res.status(404).json({ success: false, error: '不支持的登录方式' });
  if (!configuration.appId || !(configuration.appKey || configuration.appSecret)) return res.status(503).json({ success: false, error: `${provider === 'qq' ? 'QQ' : '微信'}登录尚未配置` });
  const returnUrl = String(req.body.returnUrl || `${authConfig.publicAppUrl}/auth/callback`);
  if (!isAllowedReturnUrl(returnUrl)) return res.status(400).json({ success: false, error: '登录返回地址不安全' });
  const state = crypto.randomBytes(24).toString('base64url');
  const db = await authDbPromise;
  db.run(`INSERT INTO oauth_states (id, state_hash, provider, user_id, return_url, expires_at) VALUES (?, ?, ?, ?, ?, ?)`, [generateId(), authConfig.hash(state), provider, req.user.userId || '', returnUrl, sqliteDate(new Date(Date.now() + 10 * 60 * 1000))]);
  saveDatabase(db);
  const redirectUri = callbackUrl(provider);
  const authUrl = provider === 'qq'
    ? `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=${encodeURIComponent(configuration.appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`
    : `https://open.weixin.qq.com/connect/qrconnect?appid=${encodeURIComponent(configuration.appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_login&state=${encodeURIComponent(state)}#wechat_redirect`;
  res.json({ success: true, data: { authUrl } });
});

router.get('/oauth/:provider/callback', async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();
  const configuration = providerConfiguration(provider);
    const db = await authDbPromise;
  const stateRecord = execQueryOne(db, `SELECT * FROM oauth_states WHERE provider = ? AND state_hash = ? AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP LIMIT 1`, [provider, authConfig.hash(req.query.state || '')]);
  const returnUrl = stateRecord?.return_url || `${authConfig.publicAppUrl}/auth/callback`;
  if (!configuration || !stateRecord || !req.query.code) return res.redirect(oauthFailureRedirect(returnUrl, '登录授权已失效'));
  try {
    db.run('UPDATE oauth_states SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?', [stateRecord.id]);
    let profile;
    if (provider === 'qq') {
      const tokenResponse = await fetch(`https://graph.qq.com/oauth2.0/token?grant_type=authorization_code&client_id=${encodeURIComponent(configuration.appId)}&client_secret=${encodeURIComponent(configuration.appKey)}&code=${encodeURIComponent(req.query.code)}&redirect_uri=${encodeURIComponent(callbackUrl(provider))}&fmt=json`);
      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) throw new Error(tokenData.error_description || 'QQ 授权失败');
      const openIdText = await (await fetch(`https://graph.qq.com/oauth2.0/me?access_token=${encodeURIComponent(tokenData.access_token)}`)).text();
      const openIdData = JSON.parse(openIdText.replace(/^callback\s*\(/, '').replace(/\);?\s*$/, ''));
      const info = await (await fetch(`https://graph.qq.com/user/get_user_info?access_token=${encodeURIComponent(tokenData.access_token)}&oauth_consumer_key=${encodeURIComponent(configuration.appId)}&openid=${encodeURIComponent(openIdData.openid)}`)).json();
      profile = { providerUserId: openIdData.openid, displayName: info.nickname || 'QQ 用户', avatar: info.figureurl_qq_2 || info.figureurl_qq_1 || '' };
    } else {
      const tokenData = await (await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${encodeURIComponent(configuration.appId)}&secret=${encodeURIComponent(configuration.appSecret)}&code=${encodeURIComponent(req.query.code)}&grant_type=authorization_code`)).json();
      if (!tokenData.access_token || !tokenData.openid) throw new Error(tokenData.errmsg || '微信授权失败');
      const info = await (await fetch(`https://api.weixin.qq.com/sns/userinfo?access_token=${encodeURIComponent(tokenData.access_token)}&openid=${encodeURIComponent(tokenData.openid)}&lang=zh_CN`)).json();
      profile = { providerUserId: tokenData.openid, unionId: tokenData.unionid || info.unionid || '', displayName: info.nickname || '微信用户', avatar: info.headimgurl || '' };
    }
    const user = await upsertOAuthUser(provider, profile, stateRecord.user_id || '');
    const handoff = crypto.randomBytes(32).toString('base64url');
    db.run('INSERT INTO auth_handoffs (id, handoff_hash, user_id, expires_at) VALUES (?, ?, ?, ?)', [generateId(), authConfig.hash(handoff), user.id, sqliteDate(new Date(Date.now() + 3 * 60 * 1000))]);
    saveDatabase(db);
    const separator = returnUrl.includes('?') ? '&' : '?';
    return res.redirect(`${returnUrl}${separator}handoff=${encodeURIComponent(handoff)}`);
  } catch (error) {
    saveDatabase(db);
    return res.redirect(oauthFailureRedirect(returnUrl, error.message));
  }
});

router.post('/oauth/exchange', async (req, res) => {
  const handoff = String(req.body.handoff || '');
    const db = await authDbPromise;
  const record = execQueryOne(db, `SELECT * FROM auth_handoffs WHERE handoff_hash = ? AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP LIMIT 1`, [authConfig.hash(handoff)]);
  if (!record) return res.status(400).json({ success: false, error: '登录交接码无效或已过期' });
  db.run('UPDATE auth_handoffs SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?', [record.id]);
  const user = execQueryOne(db, 'SELECT * FROM users WHERE id = ?', [record.user_id]);
  saveDatabase(db);
  res.json({ success: true, data: await createSession(user, requestMeta(req)) });
});

router.post('/claim-legacy-data', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, error: '只有管理员可以认领旧数据' });
    const db = await authDbPromise;
  const legacyBooks = execQuery(db, "SELECT id FROM books WHERE TRIM(COALESCE(user_id, '')) = ''");
  if (legacyBooks.length === 0) return res.json({ success: true, data: { claimedBooks: 0 } });
  const bookIds = legacyBooks.map((item) => item.id);
  const placeholders = bookIds.map(() => '?').join(',');
  db.run("UPDATE books SET user_id = ? WHERE TRIM(COALESCE(user_id, '')) = ''", [req.user.userId]);
  const scopedTables = ['chapters', 'chapter_versions', 'chapter_plans', 'chapter_feedback', 'book_plans', 'volume_plans', 'foreshadowing', 'novel_characters', 'volume_settings', 'storylines', 'volume_timelines'];
  for (const table of scopedTables) {
    const columns = execQuery(db, `PRAGMA table_info(${table})`).map((item) => item.name);
    if (!columns.includes('user_id')) continue;
    db.run(`UPDATE ${table} SET user_id = ? WHERE book_id IN (${placeholders}) AND TRIM(COALESCE(user_id, '')) = ''`, [req.user.userId, ...bookIds]);
  }
  saveDatabase(db);
  res.json({ success: true, data: { claimedBooks: bookIds.length } });
});

module.exports = router;
