const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'alipro-generation-lifecycle-'));
process.env.NOVEL_DB_PATH = path.join(temp, 'novel.db');
process.env.ALIPRO_AI_MONITOR = '0';
const dbPromise = require('../database/init');
const { BookService, ChapterService, ChapterVersionService, ChapterPlanService, CharacterService,
  syncChapterRolesToCharacterLibrary, syncStorylineProgressFromChapterPlan, execQueryOne } = require('../services/database');
const { syncFeedbackLedgers, loadRelevantLedgerSnapshot } = require('../services/continuity-ledger-service');
const { contentHash, chapterPlanningHash, markChapterDerivedStale } = require('../services/generation-context-policy');
test.after(async () => { (await dbPromise).close(); fs.rmSync(temp, { recursive: true, force: true }); });
async function fixture() {
  const db = await dbPromise;
  const book = await new BookService().create('生成生命周期测试', 'fantasy');
  const chapter = await new ChapterService().create(book.id, '第1章', '谢藏锋仍能行动。晶核暴走已被压制。', 1);
  await new ChapterPlanService().upsert(book.id, 1, { chapter_id: chapter.id, chapter_mission: '压制晶核暴走', outline_text: '谢藏锋协助主角压制晶核暴走，暂时稳定伤势。' });
  return { db, book, chapter };
}
test('formal character cards never receive chapter task or history append', async () => {
  const { db, book } = await fixture();
  const character = await new CharacterService().create(book.id, '谢藏锋', '', '', '', '正式设定');
  syncChapterRolesToCharacterLibrary(db, { bookId: book.id, chapterNumber: 1,
    structuredContent: { role_execution: [{ role: '谢藏锋', baseline: '本章重伤', chapter_function: '断后' }] } });
  const row = execQueryOne(db, 'SELECT * FROM novel_characters WHERE id = ?', [character.id]);
  assert.equal(row.notes, '正式设定');
  assert.equal(row.personality, '');
  assert.equal(row.background, '');
});
test('ledger records disappear after source changes and can be rebuilt', async () => {
  const { db, book, chapter } = await fixture();
  const feedback = { chapter_summary: '晶核暂时稳定。', chapter_characters: [{ name: '谢藏锋', status: '仍能行动' }] };
  syncFeedbackLedgers(db, { bookId: book.id, chapterNumber: 1, feedback, content: chapter.content });
  let snapshot = loadRelevantLedgerSnapshot(db, { bookId: book.id, chapterNumber: 2, characterNames: ['谢藏锋'] });
  assert.equal(snapshot.characterRows[0].certainty, 'verified');
  await new ChapterService().update(chapter.id, { content: '谢藏锋已经无法行动。' });
  snapshot = loadRelevantLedgerSnapshot(db, { bookId: book.id, chapterNumber: 2, characterNames: ['谢藏锋'] });
  assert.equal(snapshot.characterRows.length, 0);
  const plan = execQueryOne(db, 'SELECT structured_content FROM chapter_plans WHERE book_id = ?', [book.id]);
  assert.equal(JSON.parse(plan.structured_content).derived_state.status, 'stale');
  syncFeedbackLedgers(db, { bookId: book.id, chapterNumber: 1, feedback: { chapter_characters: [{ name: '谢藏锋', status: '无法行动' }] }, content: '谢藏锋已经无法行动。' });
  const parsed = JSON.parse(plan.structured_content);
  parsed.derived_state = { status: 'current' };
  db.run('UPDATE chapter_plans SET structured_content = ? WHERE book_id = ?', [JSON.stringify(parsed), book.id]);
  snapshot = loadRelevantLedgerSnapshot(db, { bookId: book.id, chapterNumber: 2, characterNames: ['谢藏锋'] });
  assert.equal(snapshot.characterRows[0].state_text, '无法行动');
});
test('latest state per character is not squeezed out by another character history', async () => {
  const { db, book } = await fixture();
  for (let number = 1; number <= 30; number++) db.run('INSERT INTO character_state_ledger (id,book_id,chapter_number,character_name,state_text) VALUES (?,?,?,?,?)', [book.id + number, book.id, number, '主角', '历史状态']);
  db.run('INSERT INTO character_state_ledger (id,book_id,chapter_number,character_name,state_text) VALUES (?,?,?,?,?)', [book.id + 'guard', book.id, 1, '谢藏锋', '重伤未恢复']);
  const snapshot = loadRelevantLedgerSnapshot(db, { bookId: book.id, chapterNumber: 31, characterNames: ['主角', '谢藏锋'], limit: 24 });
  assert.equal(snapshot.characterRows.length, 2);
  assert.equal(snapshot.characterRows.find(row => row.character_name === '谢藏锋').state_text, '重伤未恢复');
});
test('progress completion requires evidence and stays within its own storyline', async () => {
  const { db, book, chapter } = await fixture();
  for (const id of ['main', 'branch']) db.run('INSERT INTO storylines (id,book_id,storyline_name,structured_content) VALUES (?,?,?,?)', [book.id + id, book.id, id, '{}']);
  const context = { usedStorylineIds: [book.id + 'main', book.id + 'branch'], usedBeatIds: ['main-beat', 'branch-beat'], currentBeats: [{ storylineId: book.id + 'main', beatId: 'main-beat' }, { storylineId: book.id + 'branch', beatId: 'branch-beat' }] };
  const feedback = { chapter_summary: '晶核暴走已被压制。', source_content_hash: contentHash(chapter.content), quality_check: { status: 'passed' }, completed_beats: [] };
  feedback.source_planning_hash = chapterPlanningHash(execQueryOne(db, 'SELECT * FROM chapter_plans WHERE book_id = ?', [book.id]));
  const sync = () => syncStorylineProgressFromChapterPlan(db, { bookId: book.id, chapterNumber: 1, chapterGoal: { main_storyline_id: book.id + 'main', target_storylines: [book.id + 'branch'] }, structuredContent: { chapter_feedback: feedback, storyline_context: context } });
  sync();
  const progress = id => JSON.parse(execQueryOne(db, 'SELECT structured_content FROM storylines WHERE id = ?', [book.id + id]).structured_content).currentProgress;
  assert.deepEqual(progress('main').completedBeats, []);
  assert.deepEqual(progress('branch').lastUsedBeatIds, ['branch-beat']);
  feedback.completed_beats = [{ beat_id: 'branch-beat', evidence: '晶核暴走已被压制' }];
  sync();
  assert.deepEqual(progress('main').completedBeats, []);
  assert.deepEqual(progress('branch').completedBeats, ['branch-beat']);
  markChapterDerivedStale(db, book.id, 1, '尚未压制');
  assert.deepEqual(progress('branch').completedBeats, []);
  assert.equal(progress('branch').requiresReview, true);
  db.run('UPDATE chapters SET content = ? WHERE id = ?', ['尚未压制', chapter.id]);
  assert.equal(sync(), 0);
});
test('history restore invalidates feedback and ledger snapshots', async () => {
  const { db, book, chapter } = await fixture();
  await new ChapterService().update(chapter.id, { content: '新版正文' });
  const version = execQueryOne(db, 'SELECT id FROM chapter_versions WHERE book_id = ? AND content = ?', [book.id, chapter.content]);
  await new ChapterVersionService().restore(book.id, 1, version.id);
  const plan = execQueryOne(db, 'SELECT structured_content FROM chapter_plans WHERE book_id = ?', [book.id]);
  assert.equal(JSON.parse(plan.structured_content).derived_state.status, 'stale');
});
test('saving a changed chapter task marks old feedback stale even if prose is unchanged', async () => {
  const { db, book } = await fixture();
  await new ChapterPlanService().upsert(book.id, 1, { chapter_mission: '暂时撤退，不完成晶核压制' });
  const plan = execQueryOne(db, 'SELECT structured_content FROM chapter_plans WHERE book_id = ?', [book.id]);
  assert.equal(JSON.parse(plan.structured_content).derived_state.status, 'stale');
});
