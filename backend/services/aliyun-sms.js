const authConfig = require('../config/auth');

let smsClient = null;
let smsClientKey = '';

const purposeTemplates = {
  register: '100001',
  login: '100001',
  bind_phone: '100004'
};

function getSmsConfiguration() {
  const accessKeyId = String(process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || process.env.ALIYUN_PNVS_ACCESS_KEY_ID || '').trim();
  const accessKeySecret = String(process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || process.env.ALIYUN_PNVS_ACCESS_KEY_SECRET || '').trim();
  const credentialMode = String(process.env.ALIYUN_PNVS_CREDENTIAL_MODE || 'access_key').trim().toLowerCase();
  const ecsRamRoleName = String(process.env.ALIBABA_CLOUD_ECS_METADATA || process.env.ALIYUN_PNVS_ECS_RAM_ROLE_NAME || '').trim();
  const signName = String(process.env.ALIYUN_PNVS_SIGN_NAME || '').trim();
  const schemeName = String(process.env.ALIYUN_PNVS_SCHEME_NAME || '').trim().slice(0, 20);
  const regionId = String(process.env.ALIYUN_PNVS_REGION_ID || 'cn-hangzhou').trim();
  const hasCredentials = (accessKeyId && accessKeySecret) || credentialMode === 'ecs_ram_role';
  return {
    accessKeyId,
    accessKeySecret,
    credentialMode,
    ecsRamRoleName,
    signName,
    schemeName,
    regionId,
    configured: Boolean(signName && hasCredentials)
  };
}

function getClient(configuration) {
  const clientKey = `${configuration.credentialMode}:${configuration.accessKeyId}:${configuration.ecsRamRoleName}:${configuration.regionId}`;
  if (smsClient && smsClientKey === clientKey) return smsClient;

  const DypnsapiModule = require('@alicloud/dypnsapi20170525');
  const OpenApiModule = require('@alicloud/openapi-client');
  const CredentialsModule = require('@alicloud/credentials');
  const DypnsapiClient = DypnsapiModule.default || DypnsapiModule;
  const OpenApiConfig = OpenApiModule.Config || OpenApiModule.default?.Config;
  const Credential = CredentialsModule.default || CredentialsModule;
  const credentials = configuration.credentialMode === 'ecs_ram_role'
    ? new Credential({
      type: 'ecs_ram_role',
      roleName: configuration.ecsRamRoleName || undefined,
      disableIMDSv1: true
    })
    : null;
  const config = new OpenApiConfig({
    ...(credentials
      ? { credential: credentials }
      : {
        accessKeyId: configuration.accessKeyId,
        accessKeySecret: configuration.accessKeySecret
      }),
    endpoint: 'dypnsapi.aliyuncs.com',
    regionId: configuration.regionId,
    connectTimeout: 5000,
    readTimeout: 8000
  });
  smsClient = new DypnsapiClient(config);
  smsClientKey = clientKey;
  return smsClient;
}

function providerError(body, fallbackMessage) {
  const error = new Error(fallbackMessage);
  error.statusCode = 502;
  error.providerCode = String(body?.code || 'UNKNOWN');
  error.providerMessage = String(body?.message || '');
  return error;
}

async function sendVerificationCode({ phone, purpose, localCode, outId }) {
  const configuration = getSmsConfiguration();
  if (!configuration.configured) {
    if (!authConfig.isProduction) {
      return { sent: false, developmentCode: localCode, provider: 'development', outId };
    }
    const error = new Error('阿里云短信认证尚未配置');
    error.statusCode = 503;
    throw error;
  }

  const DypnsapiModule = require('@alicloud/dypnsapi20170525');
  const SendSmsVerifyCodeRequest = DypnsapiModule.SendSmsVerifyCodeRequest
    || DypnsapiModule.default?.SendSmsVerifyCodeRequest;
  const request = new SendSmsVerifyCodeRequest({
    phoneNumber: phone,
    countryCode: '86',
    signName: configuration.signName,
    templateCode: purposeTemplates[purpose] || purposeTemplates.login,
    templateParam: JSON.stringify({ code: '##code##', min: String(authConfig.smsCodeTtlMinutes) }),
    codeLength: 6,
    codeType: 1,
    validTime: authConfig.smsCodeTtlMinutes * 60,
    interval: authConfig.smsRateLimits.minimumIntervalSeconds,
    duplicatePolicy: 1,
    returnVerifyCode: false,
    autoRetry: 1,
    outId,
    ...(configuration.schemeName ? { schemeName: configuration.schemeName } : {})
  });
  const response = await getClient(configuration).sendSmsVerifyCode(request);
  const body = response?.body || response || {};
  if (String(body.code || '').toUpperCase() !== 'OK' || body.success === false) {
    throw providerError(body, '短信认证暂时不可用，请稍后重试');
  }
  return {
    sent: true,
    provider: 'aliyun-pnvs',
    outId: String(body.model?.outId || outId),
    bizId: String(body.model?.bizId || '')
  };
}

async function checkVerificationCode({ phone, code, outId }) {
  const configuration = getSmsConfiguration();
  if (!configuration.configured) return false;

  const DypnsapiModule = require('@alicloud/dypnsapi20170525');
  const CheckSmsVerifyCodeRequest = DypnsapiModule.CheckSmsVerifyCodeRequest
    || DypnsapiModule.default?.CheckSmsVerifyCodeRequest;
  const request = new CheckSmsVerifyCodeRequest({
    phoneNumber: phone,
    countryCode: '86',
    verifyCode: code,
    caseAuthPolicy: 2,
    outId,
    ...(configuration.schemeName ? { schemeName: configuration.schemeName } : {})
  });
  const response = await getClient(configuration).checkSmsVerifyCode(request);
  const body = response?.body || response || {};
  if (String(body.code || '').toUpperCase() !== 'OK' || body.success === false) {
    throw providerError(body, '验证码核验服务暂时不可用，请稍后重试');
  }
  return String(body.model?.verifyResult || '').toUpperCase() === 'PASS';
}

module.exports = { checkVerificationCode, getSmsConfiguration, sendVerificationCode };
