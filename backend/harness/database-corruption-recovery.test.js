const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const initSqlJs = require('sql.js');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-corruption-test-'));
const databasePath = path.join(tempDir, 'novel.db');
const backupDir = path.join(tempDir, 'backups');
process.env.NOVEL_DB_PATH = databasePath;

test.after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

test('主数据库损坏时自动回退最近有效备份并保留损坏文件', async () => {
  const SQL = await initSqlJs();
  const source = new SQL.Database();
  source.run('CREATE TABLE recovery_probe (value TEXT)');
  source.run("INSERT INTO recovery_probe (value) VALUES ('from-backup')");
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, 'novel-test-2026-08-09T00-00-00-000Z.db'), Buffer.from(source.export()));
  source.close();
  fs.writeFileSync(databasePath, Buffer.from('not-a-sqlite-database'));

  const db = await require('../database/init');
  const probe = db.exec('SELECT value FROM recovery_probe');
  assert.equal(probe[0].values[0][0], 'from-backup');
  assert.ok(fs.readdirSync(tempDir).some((name) => name.startsWith('novel.db.corrupt-')));
});
