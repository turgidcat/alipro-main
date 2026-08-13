const { app, BrowserWindow, Menu, ipcMain, shell, dialog, Notification } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { DatabaseSync } = require('node:sqlite');

const execFileAsync = promisify(execFile);
const APP_TITLE = 'ALIPRO 项目管理台';
const SCAN_MARKERS = ['.git', 'package.json', 'Cargo.toml', '*.sln', 'pyproject.toml', 'go.mod'];
let mainWindow;
let db;

function dbPath() { return path.join(app.getPath('userData'), 'project-manager.sqlite'); }
function openDb() {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  db = new DatabaseSync(dbPath());
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      favorite INTEGER NOT NULL DEFAULT 0, pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo', position INTEGER NOT NULL DEFAULT 0,
      project_id INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER, operation TEXT NOT NULL,
      status TEXT NOT NULL, command TEXT, output TEXT, started_at TEXT NOT NULL, finished_at TEXT
    );`);
  seedSetting('theme', 'dark');
  seedSetting('scanRoots', JSON.stringify([path.join(os.homedir(), 'Desktop'), path.join(os.homedir(), 'Documents'), path.join(os.homedir(), 'Downloads')]));
  seedTasks();
}
function seedSetting(key, value) { db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)').run(key, value); }
function setting(key) { const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key); return row ? row.value : null; }
function setSetting(key, value) { db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value); }
function seedTasks() {
  if (db.prepare('SELECT COUNT(*) AS count FROM tasks').get().count) return;
  const now = new Date().toISOString();
  const insert = db.prepare('INSERT INTO tasks(title,description,status,position,created_at,updated_at) VALUES (?,?,?,?,?,?)');
  insert.run('接入 Gitee 仓库与 PR 数据', '读取仓库、分支、PR 和 Issues 基础信息。', 'todo', 0, now, now);
  insert.run('实现操作队列与风险确认', '低风险直接执行，高风险操作展示命令与影响范围。', 'todo', 1, now, now);
  insert.run('增加指标历史趋势与备份', '本机长期保存历史，支持 JSON、CSV 和 ZIP。', 'todo', 2, now, now);
}
function rows(sql, ...args) { return db.prepare(sql).all(...args); }
function now() { return new Date().toISOString(); }

async function git(projectPath, args) {
  try {
    const result = await execFileAsync('git', ['-C', projectPath, ...args], { windowsHide: true, timeout: 12000, maxBuffer: 2 * 1024 * 1024 });
    return { ok: true, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
  } catch (error) {
    return { ok: false, stdout: error.stdout?.trim() || '', stderr: error.stderr?.trim() || error.message };
  }
}
async function projectStatus(project) {
  const [branch, status, last, remotes] = await Promise.all([
    git(project.path, ['branch', '--show-current']),
    git(project.path, ['status', '--short']),
    git(project.path, ['log', '-1', '--format=%h|%s|%an|%ad', '--date=iso-short']),
    git(project.path, ['remote', '-v'])
  ]);
  const parsed = (last.stdout || '').split('|');
  const remote = (remotes.stdout || '').split('\n').find((line) => line.includes('(fetch)')) || '';
  return {
    ...project,
    branch: branch.ok ? branch.stdout || '无分支' : '暂不可用',
    dirtyCount: status.ok ? (status.stdout ? status.stdout.split('\n').filter(Boolean).length : 0) : null,
    lastCommit: parsed[0] || '—', commitMessage: parsed[1] || '暂无提交', commitAuthor: parsed[2] || '—', commitDate: parsed[3] || '—',
    remote: remote.replace(/\s+\(fetch\)$/, '').replace(/^\S+\s+/, ''), gitAvailable: branch.ok
  };
}
async function listProjects() {
  const stored = rows('SELECT * FROM projects ORDER BY pinned DESC, favorite DESC, updated_at DESC');
  const missing = stored.filter((project) => !fs.existsSync(project.path)).map((project) => project.id);
  if (missing.length) db.prepare(`DELETE FROM projects WHERE id IN (${missing.map(() => '?').join(',')})`).run(...missing);
  return Promise.all(stored.filter((project) => !missing.includes(project.id)).map(projectStatus));
}
function isProject(dir) {
  try {
    return SCAN_MARKERS.some((marker) => marker === '.git' ? fs.existsSync(path.join(dir, marker)) : marker.startsWith('*') ? fs.readdirSync(dir, { withFileTypes: true }).some((e) => e.name.endsWith(marker.slice(1))) : fs.existsSync(path.join(dir, marker)));
  } catch (_) { return false; }
}
function scanDirectory(root, found, depth = 0) {
  if (depth > 2 || !fs.existsSync(root)) return;
  let entries; try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch (_) { return; }
  if (isProject(root)) { found.push(root); return; }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || ['node_modules', 'dist', 'build', 'release'].includes(entry.name)) continue;
    scanDirectory(path.join(root, entry.name), found, depth + 1);
  }
}
function candidates() {
  const found = []; const roots = JSON.parse(setting('scanRoots') || '[]'); roots.forEach((root) => scanDirectory(root, found));
  const known = new Set(rows('SELECT path FROM projects').map((p) => path.normalize(p.path)));
  return [...new Set(found.map(path.normalize))].filter((p) => !known.has(p)).map((p) => ({ path: p, name: path.basename(p) }));
}
function createWindow() {
  mainWindow = new BrowserWindow({ width: 1500, height: 960, minWidth: 1100, minHeight: 720, title: APP_TITLE, backgroundColor: '#11151d', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false } });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}
function logOperation(projectId, operation, command, result, startedAt) { db.prepare('INSERT INTO operation_logs(project_id,operation,status,command,output,started_at,finished_at) VALUES (?,?,?,?,?,?,?)').run(projectId || null, operation, result.ok ? 'success' : 'failed', command, `${result.stdout}\n${result.stderr}`.trim(), startedAt, now()); }

app.whenReady().then(() => {
  openDb();
  ipcMain.handle('pm:bootstrap', async () => ({ projects: await listProjects(), tasks: rows('SELECT * FROM tasks ORDER BY position, id'), settings: { theme: setting('theme'), scanRoots: JSON.parse(setting('scanRoots') || '[]') }, candidates: candidates() }));
  ipcMain.handle('pm:refresh', async () => ({ projects: await listProjects(), candidates: candidates() }));
  ipcMain.handle('pm:scan', () => candidates());
  ipcMain.handle('pm:add-project', async (_e, projectPath) => { const stamp = now(); db.prepare('INSERT OR IGNORE INTO projects(path,name,created_at,updated_at) VALUES (?,?,?,?)').run(projectPath, path.basename(projectPath), stamp, stamp); return listProjects(); });
  ipcMain.handle('pm:choose-project', async () => { const result = await dialog.showOpenDialog({ title: '选择本地项目目录', properties: ['openDirectory'] }); if (result.canceled || !result.filePaths[0]) return null; const projectPath = result.filePaths[0]; const stamp = now(); db.prepare('INSERT OR IGNORE INTO projects(path,name,created_at,updated_at) VALUES (?,?,?,?)').run(projectPath, path.basename(projectPath), stamp, stamp); return listProjects(); });
  ipcMain.handle('pm:remove-project', (_e, id) => { db.prepare('DELETE FROM projects WHERE id=?').run(id); return true; });
  ipcMain.handle('pm:toggle-project', (_e, { id, field }) => { if (!['favorite', 'pinned'].includes(field)) return false; db.prepare(`UPDATE projects SET ${field}=1-${field}, updated_at=? WHERE id=?`).run(now(), id); return true; });
  ipcMain.handle('pm:open-path', (_e, target) => shell.openPath(target));
  ipcMain.handle('pm:open-terminal', (_e, target) => { const child = spawn(process.env.ComSpec || 'cmd.exe', ['/K', `cd /d "${target}"`], { detached: true, windowsHide: false }); child.unref(); return true; });
  ipcMain.handle('pm:task:create', (_e, task) => { const stamp = now(); const max = db.prepare('SELECT COALESCE(MAX(position), -1) AS max FROM tasks').get().max; db.prepare('INSERT INTO tasks(title,description,status,position,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(task.title, task.description || '', task.status || 'todo', max + 1, stamp, stamp); return rows('SELECT * FROM tasks ORDER BY position,id'); });
  ipcMain.handle('pm:task:update', (_e, task) => { db.prepare('UPDATE tasks SET title=?,description=?,status=?,position=?,updated_at=? WHERE id=?').run(task.title, task.description || '', task.status, task.position, now(), task.id); return rows('SELECT * FROM tasks ORDER BY position,id'); });
  ipcMain.handle('pm:task:delete', (_e, id) => { db.prepare('DELETE FROM tasks WHERE id=?').run(id); return rows('SELECT * FROM tasks ORDER BY position,id'); });
  ipcMain.handle('pm:settings', (_e, settings) => { if (settings.theme) setSetting('theme', settings.theme); if (settings.scanRoots) setSetting('scanRoots', JSON.stringify(settings.scanRoots)); return true; });
  ipcMain.handle('pm:logs', () => rows('SELECT * FROM operation_logs ORDER BY id DESC LIMIT 200'));
  ipcMain.handle('pm:notify', (_e, { title, body }) => { if (Notification.isSupported()) new Notification({ title, body }).show(); return true; });
  ipcMain.handle('pm:export', async () => { const target = await dialog.showSaveDialog({ defaultPath: 'alipro-project-manager-backup.json', filters: [{ name: 'JSON', extensions: ['json'] }] }); if (target.canceled) return null; const payload = { exportedAt: now(), projects: rows('SELECT * FROM projects'), tasks: rows('SELECT * FROM tasks'), logs: rows('SELECT * FROM operation_logs'), settings: rows('SELECT * FROM settings') }; fs.writeFileSync(target.filePath, JSON.stringify(payload, null, 2), 'utf8'); return target.filePath; });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: '文件', submenu: [{ label: '导出备份', click: () => mainWindow.webContents.send('pm:export-request') }, { role: 'quit', label: '退出' }] }, { label: '视图', submenu: [{ role: 'reload', label: '重新加载' }, { role: 'toggleDevTools', label: '开发者工具' }] }]));
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
