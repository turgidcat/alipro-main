const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-safety-test-'));
const databasePath = path.join(tempDir, 'novel.db');
process.env.NOVEL_DB_PATH = databasePath;

const dbPromise = require('../database/init');
const {
  BookService,
  ChapterService,
  ChapterVersionService,
  execQueryOne
} = require('../services/database');
const {
  applyPendingDatabaseRestore,
  createDatabaseBackup,
  isSqliteFile,
  listDatabaseBackups,
  scheduleDatabaseRestore
} = require('../services/database-storage');

const bookService = new BookService();
const chapterService = new ChapterService();
const versionService = new ChapterVersionService();

test.after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

test('数据库原子保存后保持有效，并能创建轮转备份和恢复请求', async () => {
  await dbPromise;
  assert.equal(isSqliteFile(databasePath), true);

  const backupPath = createDatabaseBackup(databasePath, { reason: 'test', force: true });
  assert.ok(backupPath);
  assert.equal(isSqliteFile(backupPath), true);
  assert.ok(listDatabaseBackups(databasePath).some((item) => item.filePath === backupPath));

  const restoreRequest = scheduleDatabaseRestore(databasePath, path.basename(backupPath));
  assert.equal(restoreRequest.backupFileName, path.basename(backupPath));
  assert.equal(fs.existsSync(path.join(tempDir, 'restore-on-start.json')), true);
  fs.rmSync(path.join(tempDir, 'restore-on-start.json'), { force: true });
});

test('整库恢复只在数据库未继续变化时于下次启动应用', async () => {
  const restoreDir = path.join(tempDir, 'restore-check');
  const restoreDatabasePath = path.join(restoreDir, 'novel.db');
  fs.mkdirSync(restoreDir, { recursive: true });
  fs.copyFileSync(databasePath, restoreDatabasePath);
  const backupPath = createDatabaseBackup(restoreDatabasePath, { reason: 'restore-test', force: true });

  scheduleDatabaseRestore(restoreDatabasePath, path.basename(backupPath));
  const applied = applyPendingDatabaseRestore(restoreDatabasePath);
  assert.equal(applied.backupFileName, path.basename(backupPath));
  assert.equal(fs.existsSync(path.join(restoreDir, 'restore-on-start.json')), false);
  assert.equal(isSqliteFile(restoreDatabasePath), true);

  const guardedBackup = createDatabaseBackup(restoreDatabasePath, { reason: 'restore-guard', force: true });
  scheduleDatabaseRestore(restoreDatabasePath, path.basename(guardedBackup));
  fs.appendFileSync(restoreDatabasePath, Buffer.from('changed-after-request'));
  const cancelled = applyPendingDatabaseRestore(restoreDatabasePath);
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.reason, 'database_changed_after_request');
});

test('正文覆盖、恢复和删除都会保留可恢复版本', async () => {
  const book = await bookService.create('版本测试书', 'urban');
  const chapter = await chapterService.create(
    book.id,
    '第一章',
    '第一版正文',
    1,
    '起点',
    '',
    '',
    { nextVersionType: 'generation' }
  );

  await chapterService.update(chapter.id, { content: '第二版正文' }, {
    snapshotSource: 'ai_regeneration',
    snapshotReason: 'AI 重新生成前自动留档',
    nextVersionType: 'generation'
  });

  let versions = await versionService.list(book.id, 1);
  assert.equal(versions.length, 2);
  assert.equal(versions[0].source, 'ai_regeneration');
  assert.equal(versions[0].version_type, 'generation');
  assert.equal(Number(versions[0].version_number), 2);
  assert.equal(Number(versions[0].is_current), 1);
  assert.match(versions[0].preview, /第二版正文/);

  await chapterService.update(chapter.id, { content: '校改后的正文' }, {
    snapshotSource: 'revision_save',
    snapshotReason: '保存校改稿前自动留档',
    nextVersionType: 'revision',
    nextRevisionTarget: '增强冲突，同时保持原剧情不变'
  });
  versions = await versionService.list(book.id, 1);
  assert.equal(versions.length, 3);
  assert.equal(versions[0].version_type, 'revision');
  assert.equal(versions[0].revision_target, '增强冲突，同时保持原剧情不变');
  assert.equal(Number(versions[0].is_current), 1);

  const firstGeneration = versions.find((item) => Number(item.version_number) === 1);
  const restored = await versionService.restore(book.id, 1, firstGeneration.id);
  assert.equal(restored.content, '第一版正文');
  versions = await versionService.list(book.id, 1);
  assert.equal(versions.length, 3);
  assert.equal(Number(versions.find((item) => item.id === firstGeneration.id).is_current), 1);

  await chapterService.deleteByBookAndChapterNumber(book.id, 1, '', {
    snapshotSource: 'delete',
    snapshotReason: '删除正文前自动留档'
  });
  assert.equal(await chapterService.getByBookAndChapterNumber(book.id, 1), null);
  versions = await versionService.list(book.id, 1);
  const summaries = await versionService.listChapterSummaries(book.id);
  assert.equal(Number(summaries[0].chapter_number), 1);
  assert.ok(Number(summaries[0].version_count) >= 1);

  const restoredDeleted = await versionService.restore(book.id, 1, firstGeneration.id);
  assert.equal(restoredDeleted.content, '第一版正文');
});

test('空白章节首次生成从第 1 版开始且不保存空版本', async () => {
  const book = await bookService.create('首次生成测试书', 'urban');
  const chapter = await chapterService.create(book.id, '第一章', '', 1, '起点');

  await chapterService.update(chapter.id, { content: '首次生成正文' }, {
    snapshotSource: 'ai_generation',
    nextVersionType: 'generation'
  });

  const versions = await versionService.list(book.id, 1);
  assert.equal(versions.length, 1);
  assert.equal(Number(versions[0].version_number), 1);
  assert.match(versions[0].preview, /首次生成正文/);
});

test('删除书籍会清理版本与所有书籍级数据', async () => {
  const db = await dbPromise;
  const book = await bookService.create('级联测试书', 'urban');
  await chapterService.create(book.id, '第一章', '待删除正文', 1, '测试');
  db.run(`
    INSERT INTO storylines (
      id, book_id, volume_number, storyline_number, storyline_name,
      storyline_type, start_chapter, end_chapter
    ) VALUES (?, ?, 1, 1, '测试线', 'main', 1, 3)
  `, ['storyline-delete-test', book.id]);
  db.run(`
    INSERT INTO generation_runs (
      id, book_id, chapter_number, prompt_type, prompt_version, prompt_hash
    ) VALUES (?, ?, 1, 'chapter', 'test', 'hash')
  `, ['run-delete-test', book.id]);

  assert.equal(await bookService.delete(book.id), true);
  ['books', 'chapters', 'chapter_versions', 'storylines', 'generation_runs'].forEach((tableName) => {
    const row = execQueryOne(db, `SELECT COUNT(*) AS count FROM ${tableName} WHERE ${tableName === 'books' ? 'id' : 'book_id'} = ?`, [book.id]);
    assert.equal(Number(row.count || 0), 0, `${tableName} 未完整清理`);
  });
});
