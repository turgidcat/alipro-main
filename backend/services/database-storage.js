const fs = require('fs');
const path = require('path');

const SQLITE_HEADER = 'SQLite format 3\u0000';
const DEFAULT_BACKUP_LIMIT = 12;
const DEFAULT_BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

function getBackupDirectory(databasePath) {
  return path.join(path.dirname(databasePath), 'backups');
}

function isSqliteFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size < 100) return false;
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(16);
    fs.readSync(fd, header, 0, header.length, 0);
    return header.toString('utf8') === SQLITE_HEADER;
  } finally {
    fs.closeSync(fd);
  }
}

function sanitizeReason(reason = 'automatic') {
  return String(reason || 'automatic')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'automatic';
}

function formatBackupTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function listDatabaseBackups(databasePath) {
  const backupDir = getBackupDirectory(databasePath);
  if (!fs.existsSync(backupDir)) return [];

  return fs.readdirSync(backupDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.db'))
    .map((entry) => {
      const filePath = path.join(backupDir, entry.name);
      const stat = fs.statSync(filePath);
      const reasonMatch = entry.name.match(/^novel-([a-z0-9_-]+)-\d{4}-/i);
      return {
        fileName: entry.name,
        filePath,
        reason: reasonMatch?.[1] || 'automatic',
        size: stat.size,
        createdAt: stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString()
      };
    })
    .sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
}

function pruneDatabaseBackups(databasePath, limit = DEFAULT_BACKUP_LIMIT) {
  const backups = listDatabaseBackups(databasePath);
  const normalizedLimit = Number(limit || DEFAULT_BACKUP_LIMIT);
  const safeLimit = Number.isFinite(normalizedLimit) ? Math.max(1, normalizedLimit) : DEFAULT_BACKUP_LIMIT;
  backups.slice(safeLimit).forEach((backup) => {
    fs.rmSync(backup.filePath, { force: true });
  });
}

function createDatabaseBackup(databasePath, options = {}) {
  if (!isSqliteFile(databasePath)) return null;

  const reason = sanitizeReason(options.reason);
  const force = Boolean(options.force);
  const minIntervalMs = Number(options.minIntervalMs ?? DEFAULT_BACKUP_INTERVAL_MS);
  const existing = listDatabaseBackups(databasePath);
  const newest = existing[0];
  if (!force && newest) {
    const ageMs = Date.now() - new Date(newest.modifiedAt).getTime();
    if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < minIntervalMs) {
      return null;
    }
  }

  const backupDir = getBackupDirectory(databasePath);
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `novel-${reason}-${formatBackupTimestamp()}.db`);
  const tempPath = `${backupPath}.${process.pid}.tmp`;
  fs.copyFileSync(databasePath, tempPath);
  fs.renameSync(tempPath, backupPath);
  pruneDatabaseBackups(databasePath, options.limit);
  return backupPath;
}

function writeFileAndSync(filePath, buffer) {
  const fd = fs.openSync(filePath, 'w');
  try {
    fs.writeFileSync(fd, buffer);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function replaceFileRecoverably(tempPath, targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.renameSync(tempPath, targetPath);
    return;
  }

  if (process.platform !== 'win32') {
    fs.renameSync(tempPath, targetPath);
    return;
  }

  const rollbackPath = `${targetPath}.${process.pid}.rollback`;
  fs.rmSync(rollbackPath, { force: true });
  fs.renameSync(targetPath, rollbackPath);
  try {
    fs.renameSync(tempPath, targetPath);
    fs.rmSync(rollbackPath, { force: true });
  } catch (error) {
    if (!fs.existsSync(targetPath) && fs.existsSync(rollbackPath)) {
      fs.renameSync(rollbackPath, targetPath);
    }
    throw error;
  }
}

function writeDatabaseAtomically(databasePath, buffer, options = {}) {
  const normalizedBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  if (options.backup !== false) {
    createDatabaseBackup(databasePath, {
      reason: options.backupReason || 'automatic',
      minIntervalMs: options.backupIntervalMs,
      limit: options.backupLimit
    });
  }

  const tempPath = `${databasePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileAndSync(tempPath, normalizedBuffer);
    replaceFileRecoverably(tempPath, databasePath);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

function resolveBackupPath(databasePath, fileName) {
  const safeName = path.basename(String(fileName || ''));
  const backupDir = getBackupDirectory(databasePath);
  const backupPath = path.join(backupDir, safeName);
  if (!safeName || path.dirname(backupPath) !== backupDir || !isSqliteFile(backupPath)) {
    throw new Error('备份文件不存在或格式无效');
  }
  return backupPath;
}

function scheduleDatabaseRestore(databasePath, fileName) {
  const backupPath = resolveBackupPath(databasePath, fileName);
  const markerPath = path.join(path.dirname(databasePath), 'restore-on-start.json');
  const currentStat = fs.existsSync(databasePath) ? fs.statSync(databasePath) : null;
  const payload = {
    backupFileName: path.basename(backupPath),
    requestedAt: new Date().toISOString(),
    databaseSize: currentStat?.size ?? null,
    databaseMtimeMs: currentStat?.mtimeMs ?? null
  };
  const tempPath = `${markerPath}.${process.pid}.tmp`;
  writeFileAndSync(tempPath, Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  replaceFileRecoverably(tempPath, markerPath);
  return payload;
}

function applyPendingDatabaseRestore(databasePath) {
  const markerPath = path.join(path.dirname(databasePath), 'restore-on-start.json');
  if (!fs.existsSync(markerPath)) return null;

  let request;
  try {
    request = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  } catch (error) {
    const invalidPath = `${markerPath}.invalid-${Date.now()}`;
    fs.renameSync(markerPath, invalidPath);
    return { cancelled: true, reason: 'invalid_restore_request', invalidPath };
  }

  const currentStat = fs.existsSync(databasePath) ? fs.statSync(databasePath) : null;
  const databaseChangedAfterRequest = currentStat
    && request.databaseSize !== null
    && request.databaseMtimeMs !== null
    && (
      Number(request.databaseSize) !== Number(currentStat.size)
      || Math.abs(Number(request.databaseMtimeMs) - Number(currentStat.mtimeMs)) > 1
    );
  if (databaseChangedAfterRequest) {
    const cancelledPath = `${markerPath}.cancelled-${Date.now()}`;
    fs.renameSync(markerPath, cancelledPath);
    return { cancelled: true, reason: 'database_changed_after_request', cancelledPath };
  }

  const backupPath = resolveBackupPath(databasePath, request.backupFileName);
  createDatabaseBackup(databasePath, { reason: 'before-restore', force: true });
  writeDatabaseAtomically(databasePath, fs.readFileSync(backupPath), { backup: false });
  fs.rmSync(markerPath, { force: true });
  return request;
}

module.exports = {
  DEFAULT_BACKUP_INTERVAL_MS,
  DEFAULT_BACKUP_LIMIT,
  applyPendingDatabaseRestore,
  createDatabaseBackup,
  getBackupDirectory,
  isSqliteFile,
  listDatabaseBackups,
  resolveBackupPath,
  scheduleDatabaseRestore,
  writeDatabaseAtomically
};
