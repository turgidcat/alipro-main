const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-schema-test-'));
process.env.NOVEL_DB_PATH = path.join(tempDir, 'novel.db');

const dbPromise = require('../database/init');
const { recordGenerationRun } = require('../services/generation-run-service');
const { syncFeedbackLedgers } = require('../services/continuity-ledger-service');
const { saveDatabase } = require('../services/database');

test.after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

test('隔离数据库包含运行溯源和三类连续性账本', async () => {
  const db = await dbPromise;
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type = 'table'")[0].values.flat();
  ['generation_runs', 'continuity_events', 'character_state_ledger', 'foreshadow_ledger'].forEach((name) => {
    assert.ok(tables.includes(name), `缺少表 ${name}`);
  });
});

test('生成运行台账分别保存原始 Judge 与归一化结果', async () => {
  const db = await dbPromise;
  const run = await recordGenerationRun({
    bookId: 'book-test', chapterNumber: 3, promptText: '测试 Prompt', contextSnapshot: { version: 1 },
    model: 'deepseek-v4-flash', temperature: 0.7, maxTokens: 1000,
    rawOutput: '原始正文', finalOutput: '最终正文', finishReason: 'stop',
    audit: { verdict: 'stable', raw_model_output: '{"verdict":"stable"}' }
  });
  const stmt = db.prepare('SELECT judge_raw_json, judge_normalized_json, gate_decision FROM generation_runs WHERE id = ?');
  stmt.bind([run.id]);
  assert.equal(stmt.step(), true);
  const row = stmt.getAsObject();
  stmt.free();
  assert.match(row.judge_raw_json, /verdict/);
  assert.doesNotMatch(row.judge_normalized_json, /raw_model_output/);
  assert.equal(row.gate_decision, 'passed');
});

test('同章反馈重跑时账本幂等替换且保留正文证据', async () => {
  const db = await dbPromise;
  const payload = {
    bookId: 'book-test', chapterNumber: 3, content: '林川把钥匙放在桌上，门后传来脚步声。',
    feedback: {
      source: 'model_feedback', chapter_summary: '林川留下钥匙。', story_progress: '线索推进。',
      chapter_characters: [{ name: '林川', status: '警觉' }], open_hooks: '门后的脚步声'
    }
  };
  syncFeedbackLedgers(db, payload);
  syncFeedbackLedgers(db, payload);
  saveDatabase(db);
  const count = (table) => db.exec(`SELECT COUNT(*) FROM ${table} WHERE book_id = 'book-test' AND chapter_number = 3`)[0].values[0][0];
  assert.equal(count('character_state_ledger'), 1);
  assert.equal(count('foreshadow_ledger'), 1);
  assert.equal(count('continuity_events'), 2);
});
