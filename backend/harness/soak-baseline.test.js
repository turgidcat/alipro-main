const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const initSqlJs = require('sql.js');
const { DEFAULT_DATABASE_PATH } = require('../config/runtime');
const { buildSyntheticPlan, buildVolumeRanges, prepareSoakBaseline, resetSoakRange } = require('./prepare-soak-baseline');

test('长篇基准按分卷预计章数生成连续边界', () => {
  const ranges = buildVolumeRanges([
    { volume_number: 1, volume_name: '第一卷', estimated_chapters: 15 },
    { volume_number: 2, volume_name: '第二卷', estimated_chapters: 15 },
    { volume_number: 3, volume_name: '第三卷', estimated_chapters: 15 },
    { volume_number: 4, volume_name: '第四卷', estimated_chapters: 15 }
  ], 50);
  assert.deepEqual(ranges.map((item) => [item.startChapter, item.endChapter]), [[1, 15], [16, 30], [31, 45], [46, 60]]);
});

test('合成长篇章节规划包含结构化目标和字数设置', () => {
  const plan = buildSyntheticPlan({
    bookId: 'book', chapterNumber: 16,
    volume: { volume_number: 2, volume_name: '第二卷', startChapter: 16, endChapter: 30, stage_goal: '进入深渊' },
    characterNames: ['主角', '同伴'], targetWordCount: 1400
  });
  const structured = JSON.parse(plan.structuredContent);
  assert.equal(plan.volumeNumber, 2);
  assert.equal(structured.generation_settings.word_count, 1400);
  assert.match(structured.chapter_outline_structure.chapter_goal, /进入深渊/);
});

test('50 章基准只在临时副本补齐并跨越多个分卷', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-soak-prep-'));
  const databasePath = path.join(tempDir, 'novel.db');
  try {
    fs.copyFileSync(DEFAULT_DATABASE_PATH, databasePath);
    const result = await prepareSoakBaseline({
      databasePath,
      bookId: 'e0d5c656-a25e-438b-8b7a-7e3d0ac0dfb6',
      targetChapters: 50,
      targetWordCount: 1400
    });
    assert.equal(result.inserted, 46);
    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync(databasePath));
    const coverage = db.exec(`SELECT COUNT(*), COUNT(DISTINCT volume_number), MAX(chapter_number)
      FROM chapter_plans WHERE book_id = 'e0d5c656-a25e-438b-8b7a-7e3d0ac0dfb6'`)[0].values[0];
    db.close();
    assert.deepEqual(coverage, [50, 4, 50]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

test('隔离重跑会清空目标范围旧正文和反馈但保留章节规划', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-soak-reset-'));
  const databasePath = path.join(tempDir, 'novel.db');
  const bookId = 'e0d5c656-a25e-438b-8b7a-7e3d0ac0dfb6';
  try {
    fs.copyFileSync(DEFAULT_DATABASE_PATH, databasePath);
    const result = await resetSoakRange({ databasePath, bookId, chapters: [1, 2, 3] });
    assert.equal(result.resetChapters, 3);
    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync(databasePath));
    const chapterCount = db.exec(`SELECT COUNT(*) FROM chapters WHERE book_id = '${bookId}' AND chapter_number BETWEEN 1 AND 3`)[0].values[0][0];
    const planRows = db.exec(`SELECT structured_content FROM chapter_plans WHERE book_id = '${bookId}' AND chapter_number BETWEEN 1 AND 3`)[0].values;
    db.close();
    assert.equal(chapterCount, 0);
    assert.equal(planRows.length, 3);
    planRows.forEach(([structuredText]) => {
      const structured = JSON.parse(structuredText || '{}');
      assert.equal(Object.hasOwn(structured, 'chapter_feedback'), false);
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
