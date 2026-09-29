const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'alipro-monitor-tests-'));
process.env.ALIPRO_AI_MONITOR = '1';
process.env.ALIPRO_AI_MONITOR_DIR = sandbox;
process.env.DEEPSEEK_API_KEY = 'synthetic-test-no-network';
const monitor = require('../services/model-monitor');
const deepseek = require('../services/deepseek');
const { createServer } = require('../../apps/model-monitor/server.cjs');
const registry = require('../monitor/points.json');
let sequence = 0;
test.beforeEach(() => {
  process.env.ALIPRO_AI_MONITOR = '1';
  process.env.ALIPRO_AI_MONITOR_DIR = path.join(sandbox, String(++sequence));
});
test.after(async () => { await monitor.flush(); fs.rmSync(sandbox, { recursive: true, force: true }); });
async function records() {
  await monitor.flush();
  return fs.readdirSync(monitor.dataDir()).filter(f => /^[0-9a-f-]{36}\.json$/.test(f)).map(f => JSON.parse(fs.readFileSync(path.join(monitor.dataDir(), f))));
}
const response = (text = '模型结果') => ({ status: 200, data: { model: 'mock', choices: [{ message: { content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 15, completion_tokens: 3 } } });

test('记录最终载荷与原始返回；不改变请求、不采集密钥请求头', async () => {
  const payload = { model: 'mock', messages: [{ role: 'system', content: '规则' }, { role: 'user', content: '内容😀' }], temperature: 0.2 };
  const reply = response();
  const result = await monitor.observedPost({ post: async (url, body, config) => { assert.equal(body, payload); assert.equal(config.headers.Authorization, 'Bearer private'); return reply; } }, '/chat', payload, { headers: { Authorization: 'Bearer private' } }, { pointId: 'chapter.generate' });
  assert.equal(result, reply);
  const [r] = await records();
  assert.deepEqual(r.request, payload); assert.deepEqual(r.response, reply.data);
  assert.equal(r.inputChars, 5); assert.equal(r.output, '模型结果'); assert.equal(r.status, 'completed');
  assert.equal(JSON.stringify(r).includes('Bearer private'), false);
});
test('并发操作的调用链相互隔离，同一操作的调用保持序号', async () => {
  await Promise.all(['book-a', 'book-b'].map(bookId => monitor.withContext({ bookId }, async () => {
    const a = monitor.startCall({ pointId: 'chapter.generate', request: { messages: [{ role: 'user', content: bookId }] } });
    await new Promise(r => setTimeout(r, 5)); a.finish(response().data);
    monitor.startCall({ pointId: 'chapter.audit' }).finish(response().data);
  })));
  const all = await records(); const a = all.filter(r => r.bookId === 'book-a'), b = all.filter(r => r.bookId === 'book-b');
  assert.equal(a[0].traceId, a[1].traceId); assert.notEqual(a[0].traceId, b[0].traceId);
  assert.deepEqual(a.map(r => r.sequence).sort(), [1, 2]);
});
test('诊断记录包含资料快照和反馈版本状态', async () => {
  await monitor.withContext({ bookId: 'book' }, async () => {
    monitor.annotateContext({ contextHash: 'input-context', sourceContextHash: 'source-version', feedbackFreshness: 'stale' });
    monitor.startCall({ pointId: 'outline.generate' }).finish(response().data);
  });
  const [record] = await records();
  assert.equal(record.contextHash, 'input-context');
  assert.equal(record.sourceContextHash, 'source-version');
  assert.equal(record.feedbackFreshness, 'stale');
});
test('UTF8被拆包的流仍保留准确原始输出、用量和部分结果', async () => {
  const call = monitor.startCall({ pointId: 'chapter.stream', request: { stream: true } });
  const raw = 'data: ' + JSON.stringify({ choices: [{ delta: { content: '你好😀' } }] }) + '\n\ndata: ' + JSON.stringify({ usage: { prompt_tokens: 8 } }) + '\n\n';
  const bytes = Buffer.from(raw);
  for (let i = 0; i < bytes.length; i++) call.chunk(bytes.subarray(i, i + 1));
  call.fail(Object.assign(new Error('断开'), { code: 'ERR_CANCELED' }));
  const [r] = await records();
  assert.equal(r.response.sse, raw); assert.equal(r.output, '你好😀'); assert.equal(r.status, 'cancelled'); assert.equal(r.usage.prompt_tokens, 8);
});
test('真实DeepSeek适配器的非流式请求透传monitorPoint，提示词无变化', async () => {
  let sent;
  deepseek.client.post = async (_, payload) => { sent = JSON.parse(JSON.stringify(payload)); return response('正文'); };
  const r = await deepseek.generate({ monitorPoint: 'chapter.generate', prompt: '原始提示', systemPrompt: '原始系统指令', temperature: 0.1, maxTokens: 123 });
  const [saved] = await records();
  assert.equal(r.content, '正文'); assert.deepEqual(saved.request, sent); assert.equal(saved.pointId, 'chapter.generate');
  assert.equal(sent.monitorPoint, undefined); assert.deepEqual(sent.messages.map(x => x.content), ['原始系统指令', '原始提示']);
});
test('HTTP重试每次独立保留，逻辑调用一致，失败不伪装成成功', async () => {
  let count = 0;
  deepseek.client.post = async () => { if (++count === 1) throw Object.assign(new Error('临时失败'), { response: { status: 503, data: { error: { message: 'busy' } } } }); return response(); };
  await monitor.withContext({}, () => deepseek.generate({ monitorPoint: 'book.title', prompt: '起名' }));
  const all = (await records()).sort((a, b) => a.attempt - b.attempt);
  assert.equal(all.length, 2); assert.equal(all[0].status, 'failed'); assert.equal(all[1].status, 'completed');
  assert.equal(all[0].logicalCallId, all[1].logicalCallId); assert.equal(all[0].traceId, all[1].traceId);
});
test('真实流式适配器保留每段返回且不影响消费结果', async () => {
  const stream = ['data: {"choices":[{"delta":{"content":"正文"}}]}\n\n', 'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":7}}\n\n', 'data: [DONE]\n\n'];
  deepseek.client.post = async () => ({ status: 200, data: Readable.from(stream.map(s => Buffer.from(s))) });
  const result = []; for await (const event of deepseek.generateStream({ monitorPoint: 'chapter.stream', prompt: '写正文' })) result.push(event);
  const [r] = await records();
  assert.equal(result[0].content, '正文'); assert.equal(r.output, '正文'); assert.equal(r.response.sse, stream.join('')); assert.equal(r.status, 'completed');
});
test('消费方提前结束流时标为中断，保留已收到的内容', async () => {
  deepseek.client.post = async () => ({ status: 200, data: Readable.from([Buffer.from('data: {"choices":[{"delta":{"content":"部分正文"}}]}\n\n')]) });
  for await (const event of deepseek.generateStream({ monitorPoint: 'chapter.stream', prompt: 'test' })) { if (event.type === 'delta') break; }
  const [r] = await records(); assert.equal(r.status, 'interrupted'); assert.equal(r.output, '部分正文');
});
test('采集目录不可写不影响模型响应；关闭采集不写入请求', async () => {
  const file = path.join(sandbox, 'not-a-directory'); fs.writeFileSync(file, 'occupied');
  process.env.ALIPRO_AI_MONITOR_DIR = file;
  const reply = response();
  assert.equal(await monitor.observedPost({ post: async () => reply }, '/', {}), reply);
  process.env.ALIPRO_AI_MONITOR = '0';
  process.env.ALIPRO_AI_MONITOR_DIR = path.join(sandbox, 'disabled');
  assert.equal(await monitor.observedPost({ post: async () => reply }, '/', {}), reply);
  assert.equal(fs.existsSync(monitor.dataDir()), false);
});
test('阿里云与DeepSeek回退同属一次逻辑调用，两种输入格式完整记录', async () => {
  const axios = require('axios'), original = axios.create;
  const legacy = require('../services/ai'); legacy.aliyunApiKey = 'mock'; legacy.deepseekApiKey = 'mock';
  axios.create = config => ({ post: async () => {
    if (config.baseURL.includes('dashscope')) throw Object.assign(new Error('unavailable'), { response: { status: 503, data: { message: 'unavailable' } } });
    return response('fallback');
  } });
  try { await monitor.withContext({}, () => legacy.generate({ monitorPoint: 'character.card', task: 'naming', prompt: '角色' })); }
  finally { axios.create = original; }
  const all = await records(); assert.equal(all.length, 2);
  assert.equal(all[0].logicalCallId, all[1].logicalCallId);
  assert.deepEqual(all.find(r => r.provider === 'aliyun').request.input.messages, [{ role: 'user', content: '角色' }]);
  assert.equal(all.find(r => r.provider === 'legacy-deepseek').output, 'fallback');
  assert.equal(all.find(r => r.provider === 'legacy-deepseek').attempt, 2);
});
test('独立观察台限制本机Host、Origin和读取令牌，历史详情可读取', async () => {
  monitor.startCall({ pointId: 'book.title' }).finish(response().data); const [r] = await records();
  const { server, token } = createServer({ dir: monitor.dataDir() }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(url + '/api/calls')).status, 401);
    assert.equal((await fetch(url + '/api/calls', { headers: { 'X-Monitor-Token': token, Origin: 'https://evil.example' } })).status, 403);
    const list = await (await fetch(url + '/api/calls', { headers: { 'X-Monitor-Token': token } })).json(); assert.equal(list.total, 1); assert.equal(list.records[0].request, undefined);
    const detail = await (await fetch(url + '/api/calls/' + r.id, { headers: { 'X-Monitor-Token': token } })).json(); assert.equal(detail.output, '模型结果');
    assert.equal((await fetch(url + '/')).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('点位矩阵覆盖所有文本模型调用点，包装器不重复登记', () => {
  const parser = require('../../apps/web/node_modules/@babel/parser');
  const files = [...new Set(registry.points.filter(p => p.id !== 'audio.synthesize').map(p => p.file))];
  const found = [];
  for (const file of files) {
    const ast = parser.parse(fs.readFileSync(path.join(__dirname, '../..', file), 'utf8'), { sourceType: 'unambiguous' });
    function walk(node, scope = '') {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'FunctionDeclaration') scope = node.id.name;
      if (node.type === 'CallExpression') {
        const c = node.callee;
        if (scope !== 'runTextGeneration' && ((c.type === 'Identifier' && c.name === 'runTextGeneration') || (c.type === 'MemberExpression' && ['deepseekService', 'aiService'].includes(c.object?.name) && ['generate', 'generateStream'].includes(c.property?.name)))) {
          const options = node.arguments[c.type === 'Identifier' ? 1 : 0];
          const point = options.properties.find(p => p.key?.name === 'monitorPoint')?.value?.value;
          assert.ok(point, `${file}:${node.loc.start.line} 未登记`); found.push(point);
        }
      }
      for (const [key, value] of Object.entries(node)) { if (key === 'loc') continue; if (Array.isArray(value)) value.forEach(v => walk(v, scope)); else if (value && typeof value === 'object') walk(value, scope); }
    }
    walk(ast);
  }
  assert.deepEqual(found.sort(), registry.points.filter(p => p.id !== 'audio.synthesize').map(p => p.id).sort());
});
