const crypto = require('crypto');

const isProduction = String(process.env.NODE_ENV || 'development').toLowerCase() === 'production';
const configuredSecret = String(process.env.JWT_SECRET || '').trim();

if (isProduction && configuredSecret.length < 32) {
  throw new Error('生产环境必须配置至少 32 位的 JWT_SECRET');
}

const jwtSecret = configuredSecret || 'alipro-local-development-secret-change-before-production';

function positiveInteger(value, fallback, minimum = 1) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : fallback;
}

module.exports = {
  isProduction,
  jwtSecret,
  jwtExpiresIn: String(process.env.JWT_EXPIRES_IN || '30d'),
  smsCodeSecret: String(process.env.SMS_CODE_SECRET || jwtSecret),
  audioTicketSecret: String(process.env.AUDIO_TICKET_SECRET || jwtSecret),
  smsCodeTtlMinutes: positiveInteger(process.env.SMS_CODE_TTL_MINUTES, 10, 2),
  smsRateLimits: {
    minimumIntervalSeconds: positiveInteger(process.env.SMS_MIN_INTERVAL_SECONDS, 60, 30),
    phoneHourly: positiveInteger(process.env.SMS_PHONE_HOURLY_LIMIT, 5),
    phoneDaily: positiveInteger(process.env.SMS_PHONE_DAILY_LIMIT, 10),
    ipTenMinutes: positiveInteger(process.env.SMS_IP_TEN_MINUTE_LIMIT, 10),
    ipHourly: positiveInteger(process.env.SMS_IP_HOURLY_LIMIT, 30),
    ipDaily: positiveInteger(process.env.SMS_IP_DAILY_LIMIT, 100),
    globalDaily: positiveInteger(process.env.SMS_GLOBAL_DAILY_LIMIT, 500)
  },
  allowAnonymousData: String(process.env.ALLOW_ANONYMOUS_DATA || (!isProduction ? 'true' : 'false')).toLowerCase() === 'true',
  publicAppUrl: String(process.env.PUBLIC_APP_URL || 'https://turgidcat.space').replace(/\/+$/, ''),
  publicApiUrl: String(process.env.PUBLIC_API_URL || 'https://turgidcat.space/projects/alipro/api').replace(/\/+$/, ''),
  qq: {
    appId: String(process.env.QQ_APP_ID || '').trim(),
    appKey: String(process.env.QQ_APP_KEY || '').trim()
  },
  wechat: {
    appId: String(process.env.WECHAT_APP_ID || '').trim(),
    appSecret: String(process.env.WECHAT_APP_SECRET || '').trim()
  },
  hash(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex');
  },
  hmac(value) {
    return crypto.createHmac('sha256', module.exports.smsCodeSecret).update(String(value || '')).digest('hex');
  }
};
