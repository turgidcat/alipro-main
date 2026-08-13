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
const { BookService, saveDatabase, getChapterFeedbackRecord, upsertChapterFeedbackRecord } = require('../services/database');

test.after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

test('隔离数据库包含章节版本、运行溯源和三类连续性账本', async () => {
  const db = await dbPromise;
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type = 'table'")[0].values.flat();
  [
    'chapter_versions',
    'chapter_feedback',
    'generation_runs',
    'continuity_events',
    'character_state_ledger',
    'foreshadow_ledger',
    'users',
    'auth_identities',
    'auth_sessions',
    'sms_verification_codes',
    'oauth_states',
    'auth_handoffs'
  ].forEach((name) => {
    assert.ok(tables.includes(name), `缺少表 ${name}`);
  });

  const versionColumns = db.exec("PRAGMA table_info('chapter_versions')")[0].values.map((row) => row[1]);
  ['version_type', 'version_number', 'revision_target'].forEach((name) => {
    assert.ok(versionColumns.includes(name), `chapter_versions 缺少字段 ${name}`);
  });

  const chapterColumns = db.exec("PRAGMA table_info('chapters')")[0].values.map((row) => row[1]);
  ['content_version_type', 'content_version_number', 'content_revision_target'].forEach((name) => {
    assert.ok(chapterColumns.includes(name), `chapters 缺少字段 ${name}`);
  });

  const feedbackColumns = db.exec("PRAGMA table_info('chapter_feedback')")[0].values.map((row) => row[1]);
  ['feedback_json', 'quality_status', 'needs_human_review', 'source'].forEach((name) => {
    assert.ok(feedbackColumns.includes(name), `chapter_feedback 缺少字段 ${name}`);
  });

  const userColumns = db.exec("PRAGMA table_info('users')")[0].values.map((row) => row[1]);
  ['phone', 'display_name', 'settings_json', 'password_enabled', 'phone_verified_at'].forEach((name) => {
    assert.ok(userColumns.includes(name), `users 缺少字段 ${name}`);
  });

  const smsColumns = db.exec("PRAGMA table_info('sms_verification_codes')")[0].values.map((row) => row[1]);
  ['provider', 'provider_out_id', 'provider_biz_id'].forEach((name) => {
    assert.ok(smsColumns.includes(name), `sms_verification_codes 缺少字段 ${name}`);
  });
});

test('章节反馈写入正式主表并保持可读取', async () => {
  const db = await dbPromise;
  const book = await new BookService().create('反馈主表测试书', 'urban');
  const feedback = upsertChapterFeedbackRecord(db, {
    bookId: book.id,
    chapterId: 'chapter-test',
    chapterNumber: 3,
    feedback: {
      source: 'model_feedback',
      chapter_summary: '本章完成一次推进。',
      quality_check: { status: 'passed', needs_human_review: false }
    }
  });
  saveDatabase(db);
  assert.equal(feedback.chapter_number, 3);
  assert.equal(feedback.feedback.chapter_summary, '本章完成一次推进。');
  assert.equal(feedback.quality_status, 'passed');
  assert.equal(Number(feedback.needs_human_review), 0);
  assert.equal(getChapterFeedbackRecord(db, book.id, 3).feedback.chapter_summary, '本章完成一次推进。');
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
