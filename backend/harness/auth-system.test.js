const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alipro-auth-test-'));
process.env.NODE_ENV = 'development';
process.env.PORT = '0';
process.env.NOVEL_DB_PATH = path.join(tempDir, 'novel.db');
process.env.JWT_SECRET = 'auth-system-test-secret-longer-than-32-characters';
process.env.SMS_CODE_SECRET = 'sms-code-test-secret-longer-than-32-characters';
process.env.ALLOW_ANONYMOUS_DATA = 'false';
process.env.DEEPSEEK_API_KEY = 'test-only-not-used';

const app = require('../server');
const dbPromise = require('../database/init');
const server = app.httpServer;

function baseUrl() {
  const address = server.address();
  return `http://127.0.0.1:${address.port}/api`;
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl()}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    }
  });
  return { response, payload: await response.json().catch(() => ({})) };
}

async function register(phone, displayName) {
  const sent = await request('/auth/sms/send', {
    method: 'POST',
    body: JSON.stringify({ phone, purpose: 'register' })
  });
  assert.equal(sent.response.status, 200);
  assert.match(sent.payload.data.developmentCode, /^\d{6}$/);
  const registered = await request('/auth/phone/register', {
    method: 'POST',
    body: JSON.stringify({ phone, code: sent.payload.data.developmentCode, password: 'test-password', displayName })
  });
  assert.equal(registered.response.status, 200);
  assert.ok(registered.payload.data.token);
  return registered.payload.data;
}

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

test('手机号注册、会话与用户数据隔离形成完整闭环', async () => {
  const db = await dbPromise;
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type = 'table'")[0].values.flat();
  ['users', 'auth_identities', 'auth_sessions', 'sms_verification_codes', 'oauth_states', 'auth_handoffs'].forEach((name) => {
    assert.ok(tables.includes(name), `缺少用户系统表 ${name}`);
  });

  const unauthenticatedTts = await request('/tts/voices');
  assert.equal(unauthenticatedTts.response.status, 401);
  assert.notEqual(unauthenticatedTts.payload.error, '接口不存在');

  const first = await register('13800000001', '甲作者');
  const firstProfile = await request('/auth/profile', { token: first.token });
  assert.equal(firstProfile.response.status, 200);
  assert.equal(firstProfile.payload.data.displayName, '甲作者');

  const createdBook = await request('/books', {
    method: 'POST',
    token: first.token,
    body: JSON.stringify({ title: '甲的作品', genre: 'urban' })
  });
  assert.equal(createdBook.response.status, 201);
  const bookId = createdBook.payload.data.id;

  const inspirationBookPlan = await request(`/books/${bookId}/book-plan`, {
    method: 'POST',
    token: first.token,
    body: JSON.stringify({
      premise: '灵感模式生成的故事前提',
      main_goal: '找到能够直接开写的主线目标',
      core_conflict: '主角必须在真相和代价之间选择',
      world_rules: '规则一：代价不可逆',
      role_summary: '甲：主角',
      main_outline: '主角发现异常，追查真相并作出最终选择。',
      volume_outline: '第一卷完成异常发现与第一次代价。',
      detailed_outline: '1. 异常出现\n2. 追查线索\n3. 付出代价',
      source: 'inspiration'
    })
  });
  assert.equal(inspirationBookPlan.response.status, 200);
  assert.equal(inspirationBookPlan.payload.data.source, 'ai');
  assert.ok(inspirationBookPlan.payload.data.main_outline);

  const initializedInspirationBook = await request('/inspiration/initialize-book', {
    method: 'POST',
    token: first.token,
    body: JSON.stringify({
      bookId,
      volumeNumber: 1,
      chapterNumber: 1,
      candidate: {
        title: '代价之门',
        genre: '都市悬疑',
        tone: '紧张',
        premise: '主角发现一扇每次开启都会遗忘一个人的门。',
        worldview: { summary: '记忆可以交换。', rules: ['交换不可逆', '每次只能交换一段记忆'] },
        characters: [
          { name: '甲', role: '主角', personality: '谨慎', background: '调查员' },
          { name: '乙', role: '反派', personality: '冷静', background: '守门人' }
        ],
        centralConflict: '找回真相会失去最重要的人。',
        storyDirection: '调查门的来源并决定是否再次开启。',
        plotOutline: '发现异常，追查守门人，面对最终选择。',
        keyScenes: ['第一次开门', '发现交换规则', '与守门人对峙', '作出选择'],
        openingHook: '照片里的人突然没有了名字。',
        endingHook: '门后传来主角自己的声音。'
      }
    })
  });
  assert.equal(initializedInspirationBook.response.status, 200);
  assert.ok(initializedInspirationBook.payload.data.mainStorylineId);

  const initializedInspirationBookAgain = await request('/inspiration/initialize-book', {
    method: 'POST',
    token: first.token,
    body: JSON.stringify({ bookId, volumeNumber: 1, chapterNumber: 1 })
  });
  assert.equal(initializedInspirationBookAgain.response.status, 200);
  assert.equal(initializedInspirationBookAgain.payload.data.mainStorylineId, initializedInspirationBook.payload.data.mainStorylineId);

  const initializedStorylines = await request(`/storyline-workbench/${bookId}/storylines`, { token: first.token });
  assert.equal(initializedStorylines.response.status, 200);
  assert.equal(initializedStorylines.payload.data.filter((item) => item.storyline_type === 'main').length, 1);

  const initializedChapterPlan = await request(`/books/${bookId}/chapter-plans/1`, { token: first.token });
  assert.equal(initializedChapterPlan.response.status, 200);
  assert.equal(initializedChapterPlan.payload.data.main_storyline_id, initializedInspirationBook.payload.data.mainStorylineId);

  const createdChapter = await request(`/books/${bookId}/chapters`, {
    method: 'POST',
    token: first.token,
    body: JSON.stringify({
      title: '第一章 测试',
      chapterName: '测试',
      chapterNumber: 1,
      content: '这是一段只应在单章接口返回的正文。'
    })
  });
  assert.equal(createdChapter.response.status, 201);

  const chapterSummaries = await request(`/books/${bookId}/chapters?includeContent=false`, { token: first.token });
  assert.equal(chapterSummaries.response.status, 200);
  assert.equal(chapterSummaries.payload.data.length, 1);
  assert.equal('content' in chapterSummaries.payload.data[0], false);
  assert.ok(Number(chapterSummaries.payload.data[0].word_count) > 0);

  const chapterDetail = await request(`/books/${bookId}/chapters/1`, { token: first.token });
  assert.equal(chapterDetail.response.status, 200);
  assert.equal(chapterDetail.payload.data.content, '这是一段只应在单章接口返回的正文。');

  const second = await register('13800000002', '乙作者');
  const secondBooks = await request('/books', { token: second.token });
  assert.equal(secondBooks.response.status, 200);
  assert.equal(secondBooks.payload.data.length, 0);

  const forbidden = await request(`/books/${bookId}`, { token: second.token });
  assert.equal(forbidden.response.status, 403);

  const forbiddenChapter = await request(`/books/${bookId}/chapters/1`, { token: second.token });
  assert.equal(forbiddenChapter.response.status, 403);

  const firstStats = await request('/books/stats', { token: first.token });
  const secondStats = await request('/books/stats', { token: second.token });
  assert.equal(firstStats.payload.data.totalBooks, 1);
  assert.equal(secondStats.payload.data.totalBooks, 0);

  const loggedOut = await request('/auth/logout', { method: 'POST', token: first.token, body: '{}' });
  assert.equal(loggedOut.response.status, 200);
  const expiredProfile = await request('/auth/profile', { token: first.token });
  assert.equal(expiredProfile.response.status, 401);
});

test('短信验证码限制匿名绑定、无效用途和重复发送', async () => {
  const anonymousBind = await request('/auth/sms/send', {
    method: 'POST',
    body: JSON.stringify({ phone: '13800000003', purpose: 'bind_phone' })
  });
  assert.equal(anonymousBind.response.status, 401);

  const unsupportedPurpose = await request('/auth/sms/send', {
    method: 'POST',
    body: JSON.stringify({ phone: '13800000003', purpose: 'reset_password' })
  });
  assert.equal(unsupportedPurpose.response.status, 400);

  const firstSend = await request('/auth/sms/send', {
    method: 'POST',
    body: JSON.stringify({ phone: '13800000003', purpose: 'register' })
  });
  assert.equal(firstSend.response.status, 200);

  const duplicateSend = await request('/auth/sms/send', {
    method: 'POST',
    body: JSON.stringify({ phone: '13800000003', purpose: 'register' })
  });
  assert.equal(duplicateSend.response.status, 429);
  assert.equal(duplicateSend.response.headers.get('retry-after'), '60');
});
