const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'pnvs-test-jwt-secret-longer-than-32-characters';
process.env.SMS_CODE_SECRET = 'pnvs-test-sms-secret-longer-than-32-characters';
process.env.ALIYUN_PNVS_CREDENTIAL_MODE = 'access_key';
process.env.ALIYUN_PNVS_ACCESS_KEY_ID = 'test-access-key-id';
process.env.ALIYUN_PNVS_ACCESS_KEY_SECRET = 'test-access-key-secret';
process.env.ALIYUN_PNVS_SIGN_NAME = '系统赠送签名';
process.env.ALIYUN_PNVS_SCHEME_NAME = 'alipro';

const DypnsapiModule = require('@alicloud/dypnsapi20170525');
const DypnsapiClient = DypnsapiModule.default || DypnsapiModule;
const sentRequests = [];
const checkedRequests = [];

DypnsapiClient.prototype.sendSmsVerifyCode = async function sendSmsVerifyCode(request) {
  sentRequests.push(request);
  return {
    body: {
      code: 'OK',
      success: true,
      model: { outId: request.outId, bizId: `biz-${sentRequests.length}` }
    }
  };
};

DypnsapiClient.prototype.checkSmsVerifyCode = async function checkSmsVerifyCode(request) {
  checkedRequests.push(request);
  return {
    body: {
      code: 'OK',
      success: true,
      model: { outId: request.outId, verifyResult: request.verifyCode === '654321' ? 'PASS' : 'UNKNOWN' }
    }
  };
};

const {
  checkVerificationCode,
  getSmsConfiguration,
  sendVerificationCode
} = require('../services/aliyun-sms');

test('号码认证适配器使用系统模板且不向正式环境返回验证码', async () => {
  assert.equal(getSmsConfiguration().configured, true);

  const registerResult = await sendVerificationCode({
    phone: '13800000001',
    purpose: 'register',
    localCode: '123456',
    outId: 'register-out-id'
  });
  assert.equal(registerResult.sent, true);
  assert.equal(registerResult.provider, 'aliyun-pnvs');
  assert.equal(registerResult.developmentCode, undefined);
  assert.equal(sentRequests[0].templateCode, '100001');
  assert.equal(sentRequests[0].signName, '系统赠送签名');
  assert.equal(sentRequests[0].returnVerifyCode, false);
  assert.equal(sentRequests[0].codeLength, 6);
  assert.deepEqual(JSON.parse(sentRequests[0].templateParam), { code: '##code##', min: '10' });

  await sendVerificationCode({
    phone: '13800000002',
    purpose: 'bind_phone',
    localCode: '123456',
    outId: 'bind-out-id'
  });
  assert.equal(sentRequests[1].templateCode, '100004');
});

test('号码认证适配器以同一方案和流水号调用云端验证码核验', async () => {
  assert.equal(await checkVerificationCode({
    phone: '13800000001',
    code: '654321',
    outId: 'register-out-id'
  }), true);
  assert.equal(await checkVerificationCode({
    phone: '13800000001',
    code: '000000',
    outId: 'register-out-id'
  }), false);
  assert.equal(checkedRequests[0].schemeName, 'alipro');
  assert.equal(checkedRequests[0].outId, 'register-out-id');
  assert.equal(checkedRequests[0].caseAuthPolicy, 2);
});
