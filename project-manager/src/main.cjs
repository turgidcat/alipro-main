const { app, BrowserWindow, Menu, ipcMain, shell, dialog, Notification } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { DatabaseSync } = require('node:sqlite');
const https = require('node:https');

const execFileAsync = promisify(execFile);
const APP_TITLE = 'ALIPRO 项目管理台';
const SCAN_MARKERS = ['.git', 'package.json', 'Cargo.toml', '*.sln', 'pyproject.toml', 'go.mod'];
let mainWindow;
let db;
const operationQueue = [];
let operationRunning = false;
let operationPaused = false;
let nextOperationId = 1;
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

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
    );
    CREATE TABLE IF NOT EXISTS remote_cache (
      project_id INTEGER PRIMARY KEY, provider TEXT NOT NULL, payload TEXT NOT NULL,
      synced_at TEXT NOT NULL, error TEXT
    );
    CREATE TABLE IF NOT EXISTS metric_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT, captured_at TEXT NOT NULL,
      project_count INTEGER NOT NULL, dirty_count INTEGER NOT NULL,
      open_task_count INTEGER NOT NULL, unavailable_count INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workspaces (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS metric_daily (day TEXT PRIMARY KEY, project_count INTEGER NOT NULL, dirty_count INTEGER NOT NULL, open_task_count INTEGER NOT NULL, unavailable_count INTEGER NOT NULL, updated_at TEXT NOT NULL);`);
  try { db.exec('ALTER TABLE projects ADD COLUMN workspace_id INTEGER NOT NULL DEFAULT 1'); } catch (_) {}
  try { db.exec('ALTER TABLE projects ADD COLUMN remote_override TEXT'); } catch (_) {}
  db.prepare('INSERT OR IGNORE INTO workspaces(id,name,created_at) VALUES (1,?,?)').run('默认工作区', now());
  db.prepare('UPDATE projects SET workspace_id=1 WHERE workspace_id IS NULL').run();
  seedSetting('theme', 'dark');
  seedSetting('scanRoots', JSON.stringify([path.join(os.homedir(), 'Desktop'), path.join(os.homedir(), 'Documents'), path.join(os.homedir(), 'Downloads')]));
  seedSetting('notificationEnabled', 'true');
  seedSetting('notifyWarning', 'true');
  seedSetting('notifyCritical', 'true');
  seedSetting('quietStart', '23:00');
  seedSetting('quietEnd', '08:00');
  seedSetting('startupEnabled', 'false');
  seedSetting('logRetentionDays', '0');
  seedSetting('activeWorkspaceId', '1');
  seedTasks();
}
function seedSetting(key, value) { db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)').run(key, value); }
function setting(key) { const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key); return row ? row.value : null; }
function setSetting(key, value) { db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value); }
function boolSetting(key) { return setting(key) === 'true'; }
function readSettings() {
  return {
    theme: setting('theme'), scanRoots: JSON.parse(setting('scanRoots') || '[]'),
    notificationEnabled: boolSetting('notificationEnabled'), notifyWarning: boolSetting('notifyWarning'), notifyCritical: boolSetting('notifyCritical'),
    quietStart: setting('quietStart') || '23:00', quietEnd: setting('quietEnd') || '08:00', startupEnabled: boolSetting('startupEnabled'),
    logRetentionDays: Number(setting('logRetentionDays') || 0), activeWorkspaceId: Number(setting('activeWorkspaceId') || 1)
  };
}
function activeWorkspaceId() { const id = Number(setting('activeWorkspaceId') || 1); return rows('SELECT id FROM workspaces WHERE id=?', id).length ? id : 1; }
function workspaceList() { return rows('SELECT * FROM workspaces ORDER BY id'); }
function pruneLogs() {
  const days = Number(setting('logRetentionDays') || 0);
  if (!Number.isFinite(days) || days <= 0) return;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  db.prepare('DELETE FROM operation_logs WHERE COALESCE(finished_at, started_at) < ?').run(cutoff);
}
function isQuietHours() {
  const start = setting('quietStart') || '23:00'; const end = setting('quietEnd') || '08:00';
  if (start === end) return false;
  const current = new Date(); const minutes = current.getHours() * 60 + current.getMinutes();
  const toMinutes = (value) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; };
  const startMinutes = toMinutes(start); const endMinutes = toMinutes(end);
  return startMinutes < endMinutes ? minutes >= startMinutes && minutes < endMinutes : minutes >= startMinutes || minutes < endMinutes;
}
function showNotification({ title, body, severity = 'warning' }) {
  if (!Notification.isSupported() || !boolSetting('notificationEnabled')) return false;
  if (severity === 'critical' ? !boolSetting('notifyCritical') : !boolSetting('notifyWarning')) return false;
  if (severity !== 'critical' && isQuietHours()) return false;
  new Notification({ title, body }).show(); return true;
}
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
function getGiteeToken() { return process.env.GITEE_TOKEN || process.env.GITEE_ACCESS_TOKEN || ''; }
function parseRemote(remote) {
  const match = String(remote || '').match(/gitee\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/i);
  return match ? { owner: match[1], repo: match[2] } : null;
}
function requestJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'ALIPRO-Project-Manager', Accept: 'application/json', ...headers } }, (response) => {
      let body = ''; response.setEncoding('utf8'); response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => { try { const payload = JSON.parse(body); if (response.statusCode >= 200 && response.statusCode < 300) resolve(payload); else reject(new Error(payload.message || `HTTP ${response.statusCode}`)); } catch (error) { reject(error); } });
    });
    request.setTimeout(12000, () => request.destroy(new Error('Gitee 请求超时'))); request.on('error', reject);
  });
}
async function giteeSnapshot(project) {
  const remote = parseRemote(project.remote); if (!remote) return { ok: false, error: '未识别 Gitee remote' };
  const token = getGiteeToken(); const query = token ? `?access_token=${encodeURIComponent(token)}` : '';
  try {
    const [repo, prs, issues, milestones, branches, commits] = await Promise.all([
      requestJson(`https://gitee.com/api/v5/repos/${remote.owner}/${remote.repo}${query}`),
      requestJson(`https://gitee.com/api/v5/repos/${remote.owner}/${remote.repo}/pulls?state=all&per_page=20${token ? `&access_token=${encodeURIComponent(token)}` : ''}`),
      requestJson(`https://gitee.com/api/v5/repos/${remote.owner}/${remote.repo}/issues?state=all&per_page=20${token ? `&access_token=${encodeURIComponent(token)}` : ''}`),
      requestJson(`https://gitee.com/api/v5/repos/${remote.owner}/${remote.repo}/milestones?state=all&per_page=20${token ? `&access_token=${encodeURIComponent(token)}` : ''}`),
      requestJson(`https://gitee.com/api/v5/repos/${remote.owner}/${remote.repo}/branches?per_page=30${token ? `&access_token=${encodeURIComponent(token)}` : ''}`),
      requestJson(`https://gitee.com/api/v5/repos/${remote.owner}/${remote.repo}/commits?per_page=20${token ? `&access_token=${encodeURIComponent(token)}` : ''}`)
    ]);
    return { ok: true, payload: { provider: 'gitee', repo: { fullName: repo.full_name, description: repo.description, defaultBranch: repo.default_branch, stars: repo.stargazers_count, forks: repo.forks_count }, prs: prs.map((item) => ({ number: item.number, title: item.title, state: item.state, user: item.user?.name || item.user?.login, updatedAt: item.updated_at, htmlUrl: item.html_url, merged: Boolean(item.merged) })), issues: issues.map((item) => ({ number: item.number, title: item.title, state: item.state, user: item.user?.name || item.user?.login, updatedAt: item.updated_at, htmlUrl: item.html_url })), milestones: milestones.map((item) => ({ number: item.number, title: item.title, state: item.state, dueOn: item.due_on, openIssues: item.open_issues, closedIssues: item.closed_issues })), branches: branches.map((item) => ({ name: item.name, protected: item.protected })), commits: commits.map((item) => ({ sha: item.sha, shortSha: item.sha?.slice(0, 7), title: item.commit?.message?.split('\n')[0] || '', author: item.commit?.author?.name || item.author?.login || '', date: item.commit?.author?.date || '', htmlUrl: item.html_url })) } };
  } catch (error) { return { ok: false, error: error.message }; }
}
function cachedRemote(projectId) { const row = db.prepare('SELECT * FROM remote_cache WHERE project_id=?').get(projectId); if (!row) return null; return { ...JSON.parse(row.payload), syncedAt: row.synced_at, error: row.error || null }; }
function saveRemote(projectId, result) {
  const existing = db.prepare('SELECT payload FROM remote_cache WHERE project_id=?').get(projectId);
  const payload = result.ok ? result.payload || {} : existing ? JSON.parse(existing.payload) : {};
  db.prepare('INSERT INTO remote_cache(project_id,provider,payload,synced_at,error) VALUES (?,?,?,?,?) ON CONFLICT(project_id) DO UPDATE SET provider=excluded.provider,payload=excluded.payload,synced_at=excluded.synced_at,error=excluded.error').run(projectId, 'gitee', JSON.stringify(payload), now(), result.ok ? null : result.error);
}

async function git(projectPath, args) {
  try {
    const result = await execFileAsync('git', ['-C', projectPath, ...args], { windowsHide: true, timeout: 12000, maxBuffer: 2 * 1024 * 1024 });
    return { ok: true, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
  } catch (error) {
    return { ok: false, stdout: error.stdout?.trim() || '', stderr: error.stderr?.trim() || error.message };
  }
}
async function projectStatus(project, includeRemote = true) {
  const [branch, status, last, remotes] = await Promise.all([
    git(project.path, ['branch', '--show-current']),
    git(project.path, ['status', '--short']),
    git(project.path, ['log', '-1', '--format=%h|%s|%an|%ad', '--date=iso-short']),
    git(project.path, ['remote', '-v'])
  ]);
  const parsed = (last.stdout || '').split('|');
  const detectedRemote = (remotes.stdout || '').split('\n').find((line) => line.includes('(fetch)')) || '';
  const result = {
    ...project,
    branch: branch.ok ? branch.stdout || '无分支' : '暂不可用',
    dirtyCount: status.ok ? (status.stdout ? status.stdout.split('\n').filter(Boolean).length : 0) : null,
    lastCommit: parsed[0] || '—', commitMessage: parsed[1] || '暂无提交', commitAuthor: parsed[2] || '—', commitDate: parsed[3] || '—',
    remote: project.remote_override || detectedRemote.replace(/\s+\(fetch\)$/, '').replace(/^\S+\s+/, ''), detectedRemote: detectedRemote.replace(/\s+\(fetch\)$/, '').replace(/^\S+\s+/, ''), gitAvailable: branch.ok
  };
  if (includeRemote) result.gitee = cachedRemote(project.id);
  return result;
}
async function listProjects() {
  const stored = rows('SELECT * FROM projects WHERE workspace_id=? ORDER BY pinned DESC, favorite DESC, updated_at DESC', activeWorkspaceId());
  const missing = stored.filter((project) => !fs.existsSync(project.path)).map((project) => project.id);
  if (missing.length) db.prepare(`DELETE FROM projects WHERE id IN (${missing.map(() => '?').join(',')})`).run(...missing);
  const projects = await Promise.all(stored.filter((project) => !missing.includes(project.id)).map(projectStatus));
  const dirtyCount = projects.filter((project) => project.dirtyCount > 0).length;
  const unavailableCount = projects.filter((project) => !project.gitAvailable).length;
  const openTaskCount = db.prepare("SELECT COUNT(*) AS count FROM tasks WHERE status <> 'done'").get().count;
  db.prepare('INSERT INTO metric_snapshots(captured_at,project_count,dirty_count,open_task_count,unavailable_count) VALUES (?,?,?,?,?)').run(now(), projects.length, dirtyCount, openTaskCount, unavailableCount);
  const day = new Date().toISOString().slice(0, 10);
  db.prepare('INSERT INTO metric_daily(day,project_count,dirty_count,open_task_count,unavailable_count,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(day) DO UPDATE SET project_count=excluded.project_count,dirty_count=excluded.dirty_count,open_task_count=excluded.open_task_count,unavailable_count=excluded.unavailable_count,updated_at=excluded.updated_at').run(day, projects.length, dirtyCount, openTaskCount, unavailableCount, now());
  return projects;
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
function projectDocuments(projectPath) {
  const names = ['README.md', 'README.txt', 'CHANGELOG.md', 'CHANGELOG.txt', 'task-board.md', 'latest-task-status.md', 'docs/task-board.md', 'docs/latest-task-status.md'];
  return names.map((name) => {
    const filePath = path.join(projectPath, name); if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8'); const lines = content.split(/\r?\n/).filter((line) => line.trim());
    return { name, path: filePath, summary: lines.slice(0, 8).join('\n'), content: content.slice(0, 30000), updatedAt: fs.statSync(filePath).mtime.toISOString() };
  }).filter(Boolean);
}
function createWindow() {
  mainWindow = new BrowserWindow({ width: 1500, height: 960, minWidth: 1100, minHeight: 720, title: APP_TITLE, backgroundColor: '#11151d', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false } });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}
function logOperation(projectId, operation, command, result, startedAt) { db.prepare('INSERT INTO operation_logs(project_id,operation,status,command,output,started_at,finished_at) VALUES (?,?,?,?,?,?,?)').run(projectId || null, operation, result.ok ? 'success' : 'failed', command, `${result.stdout}\n${result.stderr}`.trim(), startedAt, now()); }
const HIGH_RISK = new Set(['push', 'merge', 'branch-delete', 'reset']);
async function runGitOperation(project, operation, args) {
  const startedAt = now(); const command = `git -C "${project.path}" ${args.join(' ')}`; const result = await git(project.path, args); logOperation(project.id, operation, command, result, startedAt); return { ...result, command };
}
function queueGitOperation(project, operation, args, confirmed = false) {
  const command = `git -C "${project.path}" ${args.join(' ')}`;
  if (HIGH_RISK.has(operation) && !confirmed) return Promise.resolve({ needsConfirmation: true, command, operation, project: project.name, impact: '该操作可能改变远程或本地分支历史。' });
  return new Promise((resolve) => { operationQueue.push({ id: nextOperationId++, project, operation, args, resolve, command, queuedAt: now() }); processOperationQueue(); });
}
async function processOperationQueue() {
  if (operationRunning || operationPaused || !operationQueue.length) return;
  operationRunning = true; const item = operationQueue.shift();
  try { item.resolve(await runGitOperation(item.project, item.operation, item.args)); } catch (error) { item.resolve({ ok: false, command: item.command, stderr: error.message }); }
  operationRunning = false; processOperationQueue();
}

if (gotSingleInstanceLock) app.whenReady().then(() => {
  openDb();
  pruneLogs();
  ipcMain.handle('pm:bootstrap', async () => ({ projects: await listProjects(), tasks: rows('SELECT * FROM tasks ORDER BY position, id'), settings: readSettings(), workspaces: workspaceList(), candidates: candidates() }));
  ipcMain.handle('pm:refresh', async () => ({ projects: await listProjects(), candidates: candidates() }));
  ipcMain.handle('pm:workspaces', () => workspaceList());
  ipcMain.handle('pm:workspace:create', (_e, name) => { const stamp = now(); db.prepare('INSERT INTO workspaces(name,created_at) VALUES (?,?)').run(String(name).trim(), stamp); return workspaceList(); });
  ipcMain.handle('pm:workspace:switch', async (_e, id) => { setSetting('activeWorkspaceId', String(id)); return { projects: await listProjects(), settings: readSettings() }; });
  ipcMain.handle('pm:documents', (_e, projectPath) => projectDocuments(projectPath));
  ipcMain.handle('pm:git:commit', async (_e, { project, commitMessage }) => { const add = await queueGitOperation(project, 'commit', ['add', '-A'], true); if (!add.ok) return add; return queueGitOperation(project, 'commit', ['commit', '-m', commitMessage], true); });
  ipcMain.handle('pm:git:show', async (_e, { project, commit }) => git(project.path, ['show', '--stat', '--format=fuller', commit || 'HEAD']));
  ipcMain.handle('pm:git:diff', async (_e, { project, commit }) => git(project.path, ['show', '--format=', '--find-renames', commit || 'HEAD']));
  ipcMain.handle('pm:gitee:create-pr', async (_e, { project, title, body, head, base }) => {
    const remote = parseRemote(project.remote); if (!remote) return { ok: false, error: '未识别 Gitee remote' };
    const token = getGiteeToken(); if (!token) return { ok: false, error: '未找到 GITEE_TOKEN 或 GITEE_ACCESS_TOKEN' };
    const payload = JSON.stringify({ access_token: token, title, body: body || '', head, base });
    return new Promise((resolve) => { const request = https.request(`https://gitee.com/api/v5/repos/${remote.owner}/${remote.repo}/pulls`, { method: 'POST', headers: { 'User-Agent': 'ALIPRO-Project-Manager', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (response) => { let data = ''; response.on('data', (chunk) => { data += chunk; }); response.on('end', () => { try { const result = JSON.parse(data); resolve(response.statusCode >= 200 && response.statusCode < 300 ? { ok: true, pullRequest: result } : { ok: false, error: result.message || `HTTP ${response.statusCode}` }); } catch (error) { resolve({ ok: false, error: error.message }); } }); }); request.on('error', (error) => resolve({ ok: false, error: error.message })); request.write(payload); request.end(); });
  });
  ipcMain.handle('pm:gitee:merge-pr', async (_e, { project, number, mergeMethod = 'merge' }) => {
    const remote = parseRemote(project.remote); const token = getGiteeToken(); if (!remote || !token) return { ok: false, error: '未识别 Gitee remote 或未找到访问令牌' };
    const payload = JSON.stringify({ access_token: token, merge_method: mergeMethod });
    return new Promise((resolve) => { const request = https.request(`https://gitee.com/api/v5/repos/${remote.owner}/${remote.repo}/pulls/${number}/merge`, { method: 'PUT', headers: { 'User-Agent': 'ALIPRO-Project-Manager', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (response) => { let data = ''; response.on('data', (chunk) => { data += chunk; }); response.on('end', () => { try { const result = JSON.parse(data); resolve(response.statusCode >= 200 && response.statusCode < 300 ? { ok: true, result } : { ok: false, error: result.message || `HTTP ${response.statusCode}` }); } catch (error) { resolve({ ok: false, error: error.message }); } }); }); request.on('error', (error) => resolve({ ok: false, error: error.message })); request.write(payload); request.end(); });
  });
  ipcMain.handle('pm:project:remote', async (_e, { id, remote }) => { db.prepare('UPDATE projects SET remote_override=?, updated_at=? WHERE id=?').run(String(remote || '').trim() || null, now(), id); return listProjects(); });
  ipcMain.handle('pm:gitee:sync', async (_e, project) => { const result = await giteeSnapshot(project); saveRemote(project.id, result); return { ...(result.ok ? result.payload : cachedRemote(project.id)), syncedAt: now(), error: result.ok ? null : result.error }; });
  ipcMain.handle('pm:gitee:open', (_e, url) => shell.openExternal(url));
  ipcMain.handle('pm:git:run', async (_e, { project, operation, args, confirmed }) => queueGitOperation(project, operation, args, confirmed));
  ipcMain.handle('pm:git:risk', (_e, operation) => HIGH_RISK.has(operation));
  ipcMain.handle('pm:queue', () => ({ running: operationRunning, paused: operationPaused, queued: operationQueue.map((item) => ({ id: item.id, operation: item.operation, project: item.project.name, command: item.command, queuedAt: item.queuedAt })) }));
  ipcMain.handle('pm:queue:pause', () => { operationPaused = true; return true; });
  ipcMain.handle('pm:queue:resume', () => { operationPaused = false; processOperationQueue(); return true; });
  ipcMain.handle('pm:queue:cancel', (_e, id) => { const index = operationQueue.findIndex((item) => item.id === id); if (index < 0) return false; const [item] = operationQueue.splice(index, 1); item.resolve({ ok: false, cancelled: true, command: item.command, stderr: '已取消队列任务' }); return true; });
  ipcMain.handle('pm:queue:clear', () => { operationQueue.splice(0, operationQueue.length).forEach((item) => item.resolve({ ok: false, cancelled: true, command: item.command, stderr: '已从队列清除' })); return true; });
  ipcMain.handle('pm:scan', () => candidates());
  ipcMain.handle('pm:add-project', async (_e, projectPath) => { const stamp = now(); db.prepare('INSERT OR IGNORE INTO projects(path,name,workspace_id,created_at,updated_at) VALUES (?,?,?,?,?)').run(projectPath, path.basename(projectPath), activeWorkspaceId(), stamp, stamp); return listProjects(); });
  ipcMain.handle('pm:choose-project', async () => { const result = await dialog.showOpenDialog({ title: '选择本地项目目录', properties: ['openDirectory'] }); if (result.canceled || !result.filePaths[0]) return null; const projectPath = result.filePaths[0]; const stamp = now(); db.prepare('INSERT OR IGNORE INTO projects(path,name,workspace_id,created_at,updated_at) VALUES (?,?,?,?,?)').run(projectPath, path.basename(projectPath), activeWorkspaceId(), stamp, stamp); return listProjects(); });
  ipcMain.handle('pm:remove-project', (_e, id) => { db.prepare('DELETE FROM projects WHERE id=?').run(id); return true; });
  ipcMain.handle('pm:toggle-project', (_e, { id, field }) => { if (!['favorite', 'pinned'].includes(field)) return false; db.prepare(`UPDATE projects SET ${field}=1-${field}, updated_at=? WHERE id=?`).run(now(), id); return true; });
  ipcMain.handle('pm:open-path', (_e, target) => shell.openPath(target));
  ipcMain.handle('pm:open-terminal', (_e, target) => { const child = spawn(process.env.ComSpec || 'cmd.exe', ['/K', `cd /d "${target}"`], { detached: true, windowsHide: false }); child.unref(); return true; });
  ipcMain.handle('pm:task:create', (_e, task) => { const stamp = now(); const max = db.prepare('SELECT COALESCE(MAX(position), -1) AS max FROM tasks').get().max; db.prepare('INSERT INTO tasks(title,description,status,position,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(task.title, task.description || '', task.status || 'todo', max + 1, stamp, stamp); return rows('SELECT * FROM tasks ORDER BY position,id'); });
  ipcMain.handle('pm:task:update', (_e, task) => { db.prepare('UPDATE tasks SET title=?,description=?,status=?,position=?,updated_at=? WHERE id=?').run(task.title, task.description || '', task.status, task.position, now(), task.id); return rows('SELECT * FROM tasks ORDER BY position,id'); });
  ipcMain.handle('pm:task:delete', (_e, id) => { db.prepare('DELETE FROM tasks WHERE id=?').run(id); return rows('SELECT * FROM tasks ORDER BY position,id'); });
  ipcMain.handle('pm:settings', (_e, settings) => { const keys = ['theme', 'quietStart', 'quietEnd', 'logRetentionDays']; keys.forEach((key) => { if (settings[key] !== undefined) setSetting(key, String(settings[key])); }); ['scanRoots', 'notificationEnabled', 'notifyWarning', 'notifyCritical', 'startupEnabled'].forEach((key) => { if (settings[key] !== undefined) setSetting(key, Array.isArray(settings[key]) ? JSON.stringify(settings[key]) : String(settings[key])); }); if (settings.startupEnabled !== undefined) app.setLoginItemSettings({ openAtLogin: Boolean(settings.startupEnabled), path: process.execPath, args: [app.getAppPath()] }); pruneLogs(); return readSettings(); });
  ipcMain.handle('pm:logs', () => rows('SELECT * FROM operation_logs ORDER BY id DESC LIMIT 200'));
  ipcMain.handle('pm:metrics', () => rows('SELECT * FROM metric_snapshots ORDER BY id DESC LIMIT 500'));
  ipcMain.handle('pm:metrics:daily', () => rows('SELECT * FROM metric_daily ORDER BY day DESC LIMIT 365'));
  ipcMain.handle('pm:notify', (_e, payload) => showNotification(payload));
  ipcMain.handle('pm:export', async () => { const target = await dialog.showSaveDialog({ defaultPath: 'alipro-project-manager-backup.json', filters: [{ name: 'JSON', extensions: ['json'] }] }); if (target.canceled) return null; const payload = { exportedAt: now(), projects: rows('SELECT * FROM projects'), tasks: rows('SELECT * FROM tasks'), logs: rows('SELECT * FROM operation_logs'), metricsDaily: rows('SELECT * FROM metric_daily'), workspaces: workspaceList(), settings: rows('SELECT * FROM settings') }; fs.writeFileSync(target.filePath, JSON.stringify(payload, null, 2), 'utf8'); return target.filePath; });
  ipcMain.handle('pm:export:csv', async () => { const target = await dialog.showSaveDialog({ defaultPath: 'alipro-project-manager-metrics.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] }); if (target.canceled) return null; const data = rows('SELECT * FROM metric_snapshots ORDER BY captured_at'); const csv = ['captured_at,project_count,dirty_count,open_task_count,unavailable_count', ...data.map((item) => [item.captured_at, item.project_count, item.dirty_count, item.open_task_count, item.unavailable_count].join(','))].join('\n'); fs.writeFileSync(target.filePath, `\ufeff${csv}\n`, 'utf8'); return target.filePath; });
  ipcMain.handle('pm:export:zip', async () => { const target = await dialog.showSaveDialog({ defaultPath: 'alipro-project-manager-backup.zip', filters: [{ name: 'ZIP', extensions: ['zip'] }] }); if (target.canceled) return null; const temp = path.join(app.getPath('temp'), `alipro-manager-backup-${Date.now()}`); fs.mkdirSync(temp, { recursive: true }); const payload = { exportedAt: now(), projects: rows('SELECT * FROM projects'), tasks: rows('SELECT * FROM tasks'), logs: rows('SELECT * FROM operation_logs'), metrics: rows('SELECT * FROM metric_snapshots'), metricsDaily: rows('SELECT * FROM metric_daily'), workspaces: workspaceList(), settings: rows('SELECT * FROM settings') }; fs.writeFileSync(path.join(temp, 'backup.json'), JSON.stringify(payload, null, 2), 'utf8'); await execFileAsync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path ${JSON.stringify(path.join(temp, '*'))} -DestinationPath ${JSON.stringify(target.filePath)} -Force`]); fs.rmSync(temp, { recursive: true, force: true }); return target.filePath; });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: '文件', submenu: [{ label: '导出备份', click: () => mainWindow.webContents.send('pm:export-request') }, { role: 'quit', label: '退出' }] }, { label: '视图', submenu: [{ role: 'reload', label: '重新加载' }, { role: 'toggleDevTools', label: '开发者工具' }] }]));
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
