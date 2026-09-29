// Passive local telemetry. This module must never change or fail a model request.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const { StringDecoder } = require('node:string_decoder');
const registry = require('../monitor/points.json');
const scope = new AsyncLocalStorage();
const root = path.resolve(__dirname, '../..');
const points = new Map(registry.points.map(p => [p.id, p]));
const pending = new Set();
const sessionId = crypto.randomUUID();
const startedAt = new Date().toISOString();
let captureWarning = '';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
let version = 'unknown';
try { version = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8')).version; } catch { /* Standalone backend deployments may omit the root manifest. */ }
const sourceHashes = Object.fromEntries([...new Set([...registry.points.map(p => p.file), 'backend/services/deepseek.js', 'backend/services/ai.js'])].map(file => {
  try { return [file, hash(fs.readFileSync(path.join(root, file)))]; } catch { return [file, 'unavailable']; }
}));
const generationPipelineHash = hash(['generation-context-policy.js', 'continuity-ledger-service.js', 'database.js', 'chapter-quality-policy.js']
  .map(file => { try { return fs.readFileSync(path.join(__dirname, file), 'utf8'); } catch { return 'unavailable:' + file; } }).join('\n'));

function dataDir() {
  return path.resolve(process.env.ALIPRO_AI_MONITOR_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local/share'), 'ALIPRO', 'model-monitor'));
}
function enabled() {
  return process.env.ALIPRO_AI_MONITOR === '1' || (process.env.ALIPRO_AI_MONITOR !== '0' && process.env.NODE_ENV !== 'production');
}
function guard(fn, fallback) {
  try { return fn(); } catch (error) {
    captureWarning = error.message;
    console.warn('[model-monitor] capture unavailable:', error.code || error.name);
    return fallback;
  }
}
function requestMiddleware(req, res, next) {
  startCollector();
  scope.run({ traceId: crypto.randomUUID(), sequence: 0, req }, next);
}
let heartbeatTimer;
function startCollector() {
  if (heartbeatTimer || !enabled()) return;
  const beat = () => guard(() => {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(path.join(dataDir(), `collector-${process.pid}.json`), JSON.stringify({ pid: process.pid, sessionId, enabled: enabled(), captureWarning, updatedAt: new Date().toISOString(), version, startedAt, environment: process.env.NODE_ENV || 'development' }), { mode: 0o600 });
  });
  beat(); heartbeatTimer = setInterval(beat, 5000); heartbeatTimer.unref();
}
function withContext(context, fn) {
  return scope.run({ traceId: crypto.randomUUID(), sequence: 0, ...context }, fn);
}
function annotateContext(details) {
  guard(() => { const current = scope.getStore(); if (current) Object.assign(current, details); });
}
function contextData() {
  const ctx = scope.getStore();
  const req = ctx?.req;
  const body = req?.body || {};
  const param = req?.params || {};
  return {
    traceId: ctx?.traceId || crypto.randomUUID(), sequence: ctx ? ++ctx.sequence : 1,
    route: req ? `${req.method} ${req.path}` : (ctx?.route || 'standalone'),
    bookId: String(param.bookId || body.bookId || body.book_id || ctx?.bookId || ''),
    chapter: String(param.chapterNumber || body.chapterNumber || body.chapter_number || ctx?.chapter || ''),
    promptType: String(body.promptType || ''), mode: String(body.mode || ''),
    bookTitle: String(body.bookTitle || body.book_title || ctx?.bookTitle || ''),
    contextHash: String(ctx?.contextHash || ''), sourceContextHash: String(ctx?.sourceContextHash || ''), feedbackFreshness: String(ctx?.feedbackFreshness || '')
  };
}
function outputOf(response) {
  return response?.choices?.[0]?.message?.content ?? response?.output?.text ?? '';
}
const noop = { chunk() {}, finish() {}, fail() {}, interrupt() {}, record: null };

function startCall({ pointId = 'unclassified', provider = 'deepseek', endpoint = '', request = {}, logicalCallId = crypto.randomUUID(), attempt = 1 } = {}) {
  if (!enabled()) return noop;
  return guard(() => {
    startCollector();
    const point = points.get(pointId);
    const record = {
      schema: 1, id: crypto.randomUUID(), logicalCallId, attempt, ...contextData(),
      pointId, label: point?.label || '未分类调用', group: point?.group || '未分类',
      source: point?.file || '', sourceHash: sourceHashes[point?.file] || '',
      generationPipelineVersion: 'generation-context.v2', generationPipelineHash,
      version, adapterHash: sourceHashes[provider === 'edge-tts' ? 'backend/services/tts-service.js' : provider === 'legacy-deepseek' || provider === 'aliyun' ? 'backend/services/ai.js' : 'backend/services/deepseek.js'],
      sessionId, processStartedAt: startedAt, pid: process.pid,
      environment: process.env.NODE_ENV || 'development', provider, endpoint,
      startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'running',
      request: JSON.parse(JSON.stringify(request)), response: null, output: '', reasoning: '', usage: null,
      inputChars: 0, outputChars: 0, inputHash: '', elapsedMs: 0, error: null
    };
    const messages = record.request.messages || record.request.input?.messages || [];
    const input = messages.length ? messages.map(m => String(m.content || '')).join('') : String(record.request.text || '');
    record.inputChars = [...input].length;
    record.inputHash = hash(JSON.stringify(messages.length ? messages : record.request));
    const dir = dataDir(); fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${record.id}.json`);
    let queue = Promise.resolve(), timer, closed = false, raw = '', buffer = '';
    const decoder = new StringDecoder('utf8');
    function persist() {
      clearTimeout(timer); timer = null;
      record.updatedAt = new Date().toISOString();
      record.elapsedMs = Date.now() - Date.parse(record.startedAt);
      record.outputChars = [...record.output].length;
      const snapshot = JSON.stringify(record);
      queue = queue.then(async () => {
        await fs.promises.writeFile(file + '.tmp', snapshot, { mode: 0o600 });
        await fs.promises.rename(file + '.tmp', file);
      }).catch(error => { captureWarning = error.message; console.warn('[model-monitor] write failed:', error.code); });
      const task = queue; pending.add(task); task.finally(() => pending.delete(task));
    }
    function parseBlock(block) {
      const data = block.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
      if (!data || data === '[DONE]') return;
      try {
        const obj = JSON.parse(data);
        record.output += obj.choices?.[0]?.delta?.content || '';
        record.reasoning += obj.choices?.[0]?.delta?.reasoning_content || '';
        if (obj.usage) record.usage = obj.usage;
        if (obj.model) record.responseModel = obj.model;
        if (obj.choices?.[0]?.finish_reason) record.finishReason = obj.choices[0].finish_reason;
      } catch { record.parseWarnings = (record.parseWarnings || 0) + 1; }
    }
    function consume(text) {
      raw += text; buffer += text;
      const parts = buffer.split(/\r?\n\r?\n/); buffer = parts.pop(); parts.forEach(parseBlock);
      record.response = { sse: raw };
    }
    function end(status, response, extra = {}) {
      if (closed) return;
      closed = true;
      if (raw) { consume(decoder.end()); if (buffer.trim()) parseBlock(buffer); }
      if (response !== undefined && response !== null) {
        record.response = response;
        record.output = String(outputOf(response));
        record.reasoning = response?.choices?.[0]?.message?.reasoning_content || '';
        record.usage = response?.usage || null;
        record.responseModel = response?.model;
        record.finishReason = response?.choices?.[0]?.finish_reason;
      }
      Object.assign(record, extra, { status, endedAt: new Date().toISOString() }); persist();
    }
    persist();
    return {
      record,
      chunk(chunk) { guard(() => { if (closed) return; consume(decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))); if (!timer) timer = setTimeout(() => guard(persist), 200); }); },
      finish(response, extra) { guard(() => end('completed', response, extra)); },
      fail(error, response) { guard(() => end(error?.name === 'AbortError' || error?.code === 'ERR_CANCELED' ? 'cancelled' : 'failed', response, { error: { message: String(error?.message || 'request failed'), code: error?.code || '', httpStatus: error?.response?.status || error?.statusCode || null } })); },
      interrupt() { guard(() => end('interrupted', null, { error: { message: '消费方提前结束或流未正常完成' } })); }
    };
  }, noop);
}

async function observedPost(client, url, payload, config = {}, meta = {}) {
  const call = startCall({ ...meta, endpoint: url, request: payload });
  try {
    const response = await client.post(url, payload, config);
    call.finish(response.data, { httpStatus: response.status });
    return response;
  } catch (error) {
    call.fail(error, error?.response?.data && typeof error.response.data.on !== 'function' ? error.response.data : undefined);
    throw error;
  }
}
async function flush() { await Promise.all([...pending]); }
module.exports = { startCall, observedPost, requestMiddleware, withContext, annotateContext, dataDir, enabled, flush, newId: crypto.randomUUID, status: () => ({ enabled: enabled(), captureWarning, sessionId }) };
