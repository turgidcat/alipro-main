const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { dataDir } = require('../../backend/services/model-monitor');
const matrix = require('../../backend/monitor/points.json');
const cache = new Map();
const publicDir = path.join(__dirname, 'public');
const uuid = /^[0-9a-f-]{36}$/;

function summarize(record) {
  const { request, response, output, reasoning, ...summary } = record;
  if (summary.status === 'running' && summary.pid) {
    try { process.kill(summary.pid, 0); } catch (e) { if (e.code === 'ESRCH') summary.status = 'interrupted'; }
  }
  return summary;
}
async function listRecords(dir) {
  let files;
  try { files = (await fs.promises.readdir(dir)).filter(f => uuid.test(f.slice(0, -5)) && f.endsWith('.json')); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  const exists = new Set(files);
  for (const key of cache.keys()) if (!exists.has(key)) cache.delete(key);
  for (const file of files) {
    const stat = await fs.promises.stat(path.join(dir, file)).catch(() => null);
    if (!stat) continue;
    if (cache.get(file)?.mtime === stat.mtimeMs && cache.get(file)?.size === stat.size) continue;
    try {
      const record = JSON.parse(await fs.promises.readFile(path.join(dir, file), 'utf8'));
      cache.set(file, { mtime: stat.mtimeMs, size: stat.size, summary: summarize(record) });
    } catch { /* Atomic writes may be in flight; the previous complete record remains usable. */ }
  }
  return [...cache.values()].map(e => summarize(e.summary)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
function createServer({ dir = dataDir(), token = crypto.randomBytes(24).toString('hex'), client = null } = {}) {
  const server = http.createServer(async (req, res) => {
    const host = req.headers.host;
    const address = server.address();
    const expected = `127.0.0.1:${address.port}`;
    if (host !== expected || (req.headers.origin && req.headers.origin !== `http://${expected}`)) {
      res.writeHead(403); return res.end('Local access only');
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'");
    if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
    const url = new URL(req.url, `http://${expected}`);
    function json(value, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); }
    try {
      if (url.pathname.startsWith('/api/')) {
        if (req.headers['x-monitor-token'] !== token) return json({ error: '请用启动时显示的完整链接打开监控台。' }, 401);
        if (url.pathname === '/api/status') {
          const files = await fs.promises.readdir(dir).catch(() => []);
          const collectors = (await Promise.all(files.filter(f => /^collector-\d+\.json$/.test(f)).map(async f => {
            try { return JSON.parse(await fs.promises.readFile(path.join(dir, f), 'utf8')); } catch { return null; }
          }))).filter(c => c && Date.now() - Date.parse(c.updatedAt) < 15000);
          return json({ version: matrix.version, dir, collectors, source: 'local', client });
        }
        if (url.pathname === '/api/matrix') return json(matrix);
        if (url.pathname === '/api/calls') {
          let records = await listRecords(dir);
          const q = (url.searchParams.get('q') || '').toLowerCase();
          const group = url.searchParams.get('group'), status = url.searchParams.get('status');
          const total = records.length;
          if (q) records = records.filter(r => [r.label, r.pointId, r.bookId, r.bookTitle, r.chapter, r.traceId, r.route].join(' ').toLowerCase().includes(q));
          if (group) records = records.filter(r => r.group === group);
          if (status) records = records.filter(r => r.status === status);
          const count = records.length;
          const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit')) || 150));
          return json({ records: records.slice(0, limit), count, total });
        }
        if (url.pathname.startsWith('/api/calls/')) {
          const id = url.pathname.slice('/api/calls/'.length);
          if (!uuid.test(id)) return json({ error: '无效记录编号' }, 400);
          const record = JSON.parse(await fs.promises.readFile(path.join(dir, id + '.json'), 'utf8'));
          return json({ ...record, status: summarize(record).status });
        }
        return json({ error: 'Not found' }, 404);
      }
      const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
      const file = files[url.pathname];
      if (!file) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': file[1] + '; charset=utf-8' });
      res.end(await fs.promises.readFile(path.join(publicDir, file[0])));
    } catch (error) { json({ error: error.code === 'ENOENT' ? '记录不存在或尚未完成首次写入' : error.message }, 500); }
  });
  return { server, token };
}
if (require.main === module) {
  const { server, token } = createServer();
  server.on('error', e => { console.error('监控台启动失败：', e.message); process.exitCode = 1; });
  server.listen(Number(process.env.ALIPRO_MONITOR_PORT || 4318), '127.0.0.1', () => {
    const url = `http://127.0.0.1:${server.address().port}/#${token}`;
    console.log(`模型调用观察台 v${matrix.version}\n${url}\n数据目录：${dataDir()}\n仅本机访问；Ctrl+C 停止观察台，不影响生成。`);
    if (process.argv.includes('--open')) {
      const { spawn } = require('node:child_process');
      const child = process.platform === 'win32'
        ? spawn('cmd.exe', ['/c', 'start', '', url], { windowsHide: true, stdio: 'ignore' })
        : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore' });
      child.on('error', () => console.log('请手动打开上方链接。'));
    }
  });
}
module.exports = { createServer, listRecords };
