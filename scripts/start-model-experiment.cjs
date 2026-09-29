const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const localRoot = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local/share'), 'ALIPRO');
const tables = ['books', 'book_plans', 'chapters', 'storylines', 'volume_plans', 'novel_characters', 'chapter_plans', 'chapter_feedback', 'chapter_versions', 'character_state_ledger', 'continuity_events', 'foreshadow_ledger', 'generation_runs'];

function snapshotFile() {
  const argument = process.argv.find(a => a.startsWith('--snapshot='));
  if (argument) return path.resolve(argument.slice('--snapshot='.length));
  const dir = path.join(localRoot, 'debug-exports');
  const files = fs.readdirSync(dir).filter(f => /^血裔迷途-云端单书数据-.*\.json$/.test(f)).sort();
  if (!files.length) throw new Error('未找到《血裔迷途》单书导出。可用 --snapshot=完整路径 指定已有导出。');
  return path.join(dir, files.at(-1));
}

async function prepareDataset() {
  const file = snapshotFile();
  const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!snapshot.book?.id || !snapshot.tables || snapshot.book.id !== snapshot.book_id) throw new Error('单书导出格式不正确');
  const experiments = path.join(localRoot, 'model-experiments');
  fs.mkdirSync(experiments, { recursive: true });
  const folder = fs.mkdtempSync(path.join(experiments, 'run-'));
  const database = path.join(folder, 'novel.db');
  process.env.NOVEL_DB_PATH = database;
  const db = await require('../backend/database/init');
  const counts = {};
  let emptyChapterReferences = 0;
  db.run('BEGIN');
  try {
    for (const table of tables) {
      const rows = table === 'books' ? [snapshot.book] : snapshot.tables[table] || [];
      const columns = new Set(db.exec(`PRAGMA table_info("${table}")`)[0]?.values.map(r => r[1]) || []);
      if (rows.length && !columns.size) throw new Error(`当前数据库缺少导出表 ${table}`);
      for (const row of rows) {
        if (table !== 'books' && row.book_id !== snapshot.book_id) throw new Error(`导出包含其他作品：${table}`);
        const names = Object.keys(row);
        if (names.some(name => !columns.has(name))) throw new Error(`导出字段与当前版本不一致：${table}`);
        const values = names.map(name => {
          if (name === 'user_id') return ''; // This isolated single-user copy uses the existing local anonymous access.
          if (table === 'chapter_plans' && name === 'chapter_id' && row[name] === '') {
            emptyChapterReferences++; return null; // Empty optional FK in the cloud export means no chapter link.
          }
          return row[name];
        });
        db.run(`INSERT INTO "${table}" (${names.map(n => `"${n}"`).join(',')}) VALUES (${names.map(() => '?').join(',')})`, values);
      }
      counts[table] = rows.length;
    }
    const missingReferences = db.exec('PRAGMA foreign_key_check');
    if (missingReferences.length) throw new Error('导出数据的关联检查失败：' + JSON.stringify(missingReferences[0].values));
    db.run('COMMIT');
    fs.writeFileSync(database, Buffer.from(db.export()));
  } catch (error) { db.run('ROLLBACK'); throw error; }
  finally { db.close(); }
  const templateFile = path.join(root, 'backend', 'data', 'templates.json');
  if (fs.existsSync(templateFile)) fs.copyFileSync(templateFile, path.join(folder, 'templates.json'));
  const manifest = { title: snapshot.book.title, bookId: snapshot.book_id, snapshot: file, exportedAt: snapshot.exported_at_utc, createdAt: new Date().toISOString(), counts, copyAdjustments: { userOwnership: 'local-anonymous', emptyChapterReferencesConvertedToNull: emptyChapterReferences } };
  fs.writeFileSync(path.join(folder, 'experiment.json'), JSON.stringify(manifest, null, 2));
  return { folder, database, manifest };
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function launch() {
  process.env.NODE_ENV = 'development';
  const dataset = await prepareDataset();
  console.log(`实验作品：${dataset.manifest.title}（本地副本）\n导出时间：${dataset.manifest.exportedAt}\n实验目录：${dataset.folder}`);
  if (process.argv.includes('--prepare-only')) return;
  const electron = path.join(root, 'apps/windows/node_modules/electron/dist/electron.exe');
  if (!fs.existsSync(electron) || !fs.existsSync(path.join(root, 'apps/web/dist/index.html'))) throw new Error('需要先在开发机执行 npm run build:windows；本实验入口使用项目已有 Electron 和当前构建界面。');
  const port = await freePort();
  const env = { ...process.env, NODE_ENV: 'development', PORT: String(port), ALIPRO_BIND_HOST: '127.0.0.1', ALLOW_ANONYMOUS_DATA: 'true',
    NOVEL_DB_PATH: dataset.database, ALIPRO_DATA_DIR: dataset.folder, ALIPRO_LOG_DIR: path.join(dataset.folder, 'logs'), ALIPRO_TTS_DIR: path.join(dataset.folder, 'audio'),
    ALIPRO_AI_MONITOR: '1', ALIPRO_AI_MONITOR_DIR: path.join(dataset.folder, 'model-monitor'),
    ALIPRO_API_ORIGIN: `http://127.0.0.1:${port}/api`, ALIPRO_EXPERIMENT: '1', ALIPRO_IDE_USER_DATA: path.join(dataset.folder, 'desktop'), ALIPRO_IDE_LOAD_URL: 'app://bundle/model-monitor' };
  // Use the same explicitly isolated paths for templates, database, logs, UI storage and telemetry.
  const log = fs.openSync(path.join(dataset.folder, 'backend.log'), 'a');
  const backend = spawn(process.execPath, ['server.js'], { cwd: path.join(root, 'backend'), env, stdio: ['ignore', log, log], windowsHide: true });
  fs.closeSync(log);
  let stopped = false, client;
  function stop() { if (stopped) return; stopped = true; client?.kill(); backend.kill(); }
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  backend.on('error', error => { console.error(error.message); stop(); process.exitCode = 1; });
  backend.on('exit', code => { if (!stopped) { console.error(`实验后端已退出（${code}），请查看 ${path.join(dataset.folder, 'backend.log')}`); stop(); process.exitCode = 1; } });
  try {
    let ready = false;
    for (let i = 0; i < 120 && !stopped; i++) {
      try { const response = await fetch(`http://127.0.0.1:${port}/api/books`, { signal: AbortSignal.timeout(1000) }); const body = await response.json(); ready = response.ok && JSON.stringify(body).includes(dataset.manifest.bookId); } catch { /* wait for database startup */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error(`实验后端未就绪，请查看 ${path.join(dataset.folder, 'backend.log')}`);
    console.log(`已连接本地实验后端 ${env.ALIPRO_API_ORIGIN}\n生成仍会消耗模型额度；关闭客户端后自动停止本次实验后端，记录保留。`);
    if (process.argv.includes('--backend-only')) return;
    client = spawn(electron, ['.'], { cwd: path.join(root, 'apps/windows'), env, stdio: 'ignore', windowsHide: false });
    client.once('error', error => { console.error(error.message); stop(); process.exitCode = 1; });
    client.once('exit', stop);
  } catch (error) { stop(); throw error; }
}
if (require.main === module) launch().catch(error => { console.error('实验启动失败：', error.message); process.exitCode = 1; });
module.exports = { prepareDataset, freePort };
