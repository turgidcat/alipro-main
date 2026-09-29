const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'character-rename-sync-'));
process.env.NOVEL_DB_PATH = path.join(tempDir, 'novel.db');

const dbPromise = require('../database/init');
const {
  BookService,
  CharacterService,
  execQuery,
  execQueryOne,
  saveDatabase
} = require('../services/database');

const bookService = new BookService();
const characterService = new CharacterService();

test.after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

function assertCurrentRowUsesOnlyNewName(row, oldName, newName, fields) {
  fields.forEach((field) => {
    const value = String(row?.[field] || '');
    assert.equal(value.includes(oldName), false, `${field} 仍包含旧名`);
    assert.equal(value.includes(newName), true, `${field} 未写入新名`);
  });
}

test('角色改名事务同步当前创作数据并保留历史记录', async () => {
  const db = await dbPromise;
  const oldName = '林川';
  const newName = '林澈';
  const book = await bookService.create('角色改名测试书', 'urban', `${oldName}参与作品简介`);
  const untouchedBook = await bookService.create('跨书隔离测试书', 'urban');
  const character = await characterService.create(
    book.id,
    oldName,
    '林川佩戴旧徽章',
    '林川沉稳',
    '林川来自旧城',
    '林川自己的备注'
  );
  const relatedCharacter = await characterService.create(book.id, '周宁', '', '', '周宁认识林川', '与林川同行');
  await characterService.create(book.id, '全书角色设定', '', '', `主角：${oldName}\n性格：谨慎`, '兼容摘要');
  await characterService.create(untouchedBook.id, oldName, '', '', '另一部书的林川', '不得被改名');

  db.run(`INSERT INTO book_plans (
    id, book_id, role_summary, main_outline, volume_outline, detailed_outline, structured_content
  ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
    'rename-book-plan', book.id, `主角：${oldName}`, `${oldName}追查真相`, `${oldName}进入第二卷`,
    `${oldName}完成关键选择`, JSON.stringify({ characterStates: { [oldName]: `${oldName}待命` }, cast: [oldName] })
  ]);
  db.run(`INSERT INTO book_plans (id, book_id, main_outline)
    VALUES (?, ?, ?)`, ['rename-other-book-plan', untouchedBook.id, `${oldName}留在另一部书`]);
  db.run(`INSERT INTO volume_plans (
    id, book_id, volume_number, volume_name, volume_theme, stage_goal, core_conflict,
    start_role_state, end_role_state, notes, structured_content
  ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    'rename-volume-plan', book.id, `${oldName}卷`, `${oldName}成长`, `${oldName}破局`, `${oldName}与敌人对抗`,
    `${oldName}尚未觉醒`, `${oldName}完成觉醒`, `${oldName}保持谨慎`, JSON.stringify({ protagonist: oldName, note: `${oldName}推进` })
  ]);
  db.run(`INSERT INTO volume_settings (id, book_id, volume_number, volume_name, volume_theme, notes)
    VALUES (?, ?, 1, ?, ?, ?)`, ['rename-volume-setting', book.id, `${oldName}卷`, `${oldName}成长`, `${oldName}推进`]);
  db.run(`INSERT INTO chapters (
    id, book_id, chapter_number, chapter_name, title, content, outline, word_count,
    content_version_type, content_version_number
  ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, 'generation', 3)`, [
    'rename-chapter', book.id, `${oldName}登场`, `第一章 ${oldName}`, `${oldName}走进雨夜，${oldName}找到线索。`,
    `${oldName}发现异常`, 12
  ]);
  db.run(`INSERT INTO chapter_plans (
    id, book_id, chapter_id, chapter_number, chapter_name, summary, chapter_mission,
    emotion_target, outline_text, scene_outline, character_notes, appearing_roles,
    previous_hook, ending_hook, structured_content
  ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    'rename-chapter-plan', book.id, 'rename-chapter', `${oldName}登场`, `${oldName}发现线索`, `${oldName}必须破局`,
    `${oldName}保持警觉`, `${oldName}进入旧宅`, JSON.stringify([{ title: `${oldName}查门` }]), `${oldName}不可突变`,
    JSON.stringify([oldName]), `${oldName}听见脚步`, `${oldName}看见黑影`,
    JSON.stringify({
      characterStates: { [oldName]: `${oldName}警觉` },
      chapter_goal_snapshot: { appearing_roles: [oldName] },
      role_execution: [{ role: oldName, chapter_function: `${oldName}推进调查` }],
      chapter_feedback: {
        chapter_characters: [{ name: oldName, note: `${oldName}状态稳定` }],
        continuity_report: { new_characters: [{ name: oldName }] }
      }
    })
  ]);
  db.run(`INSERT INTO storylines (
    id, book_id, volume_number, storyline_number, storyline_name, description,
    involved_characters, key_nodes, core_conflict, structured_content
  ) VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?, ?)`, [
    'rename-storyline', book.id, `${oldName}成长线`, `${oldName}逐步揭开真相`, JSON.stringify([oldName]),
    JSON.stringify([{ title: `${oldName}取得证据` }]), `${oldName}面对抉择`,
    JSON.stringify({ relatedCharacters: [{ name: oldName }], currentProgress: { summary: `${oldName}已推进` } })
  ]);
  db.run(`INSERT INTO chapter_feedback (
    id, book_id, chapter_id, chapter_number, feedback_json
  ) VALUES (?, ?, ?, 1, ?)`, [
    'rename-feedback', book.id, 'rename-chapter', JSON.stringify({
      chapter_summary: `${oldName}找到线索`,
      chapter_characters: [{ name: oldName }]
    })
  ]);
  db.run(`INSERT INTO volume_timelines (
    id, book_id, volume_number, timeline_data
  ) VALUES (?, ?, 1, ?)`, [
    'rename-timeline', book.id, JSON.stringify({ stages: [{ summary: `${oldName}推进` }], characters: [oldName] })
  ]);
  db.run(`INSERT INTO foreshadowing (id, book_id, title, description)
    VALUES (?, ?, ?, ?)`, ['rename-foreshadowing', book.id, `${oldName}的钥匙`, `${oldName}尚未发现用途`]);
  db.run(`INSERT INTO continuity_events (
    id, book_id, chapter_number, event_type, subject, fact_text, evidence_text
  ) VALUES (?, ?, 1, 'character_progress', ?, ?, ?)`, [
    'rename-continuity', book.id, oldName, `${oldName}取得钥匙`, `${oldName}把钥匙收好`
  ]);
  db.run(`INSERT INTO character_state_ledger (
    id, book_id, chapter_number, character_name, role_text, relationship_text,
    state_text, appearance_text, note_text, evidence_text
  ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`, [
    'rename-character-ledger', book.id, oldName, `${oldName}是主角`, `周宁信任${oldName}`, `${oldName}警觉`,
    `${oldName}佩戴徽章`, `${oldName}继续调查`, `${oldName}站在门前`
  ]);
  db.run(`INSERT INTO foreshadow_ledger (
    id, book_id, chapter_number, foreshadow_key, title, evidence_text
  ) VALUES (?, ?, 1, 'rename-hook', ?, ?)`, [
    'rename-foreshadow-ledger', book.id, `${oldName}的钥匙`, `${oldName}收起钥匙`
  ]);
  db.run(`INSERT INTO chapter_characters (
    id, book_id, chapter_id, character_id, role_in_chapter, state_snapshot
  ) VALUES (?, ?, ?, ?, ?, ?)`, [
    'rename-chapter-character', book.id, 'rename-chapter', character.id, `${oldName}推动剧情`, `${oldName}保持警觉`
  ]);
  db.run(`INSERT INTO chapter_versions (
    id, chapter_id, book_id, chapter_number, title, chapter_name, content, word_count,
    source, version_type, version_number
  ) VALUES (?, ?, ?, 1, ?, ?, ?, 8, 'history_seed', 'generation', 1)`, [
    'rename-history', 'rename-chapter', book.id, `旧版本 ${oldName}`, `${oldName}旧章`, `${oldName}仍在历史版本中`
  ]);
  db.run(`INSERT INTO generation_runs (
    id, book_id, chapter_number, prompt_type, prompt_version, prompt_hash,
    prompt_text, context_snapshot_json, raw_output, final_output
  ) VALUES (?, ?, 1, 'chapter', 'test', 'rename-hash', ?, ?, ?, ?)`, [
    'rename-generation-run', book.id, `请生成${oldName}的故事`, JSON.stringify({ character: oldName }),
    `${oldName}原始输出`, `${oldName}最终输出`
  ]);
  saveDatabase(db);

  const updated = await characterService.update(character.id, {
    name: newName,
    appearance: `${oldName}佩戴新徽章`,
    personality: `${oldName}更加坚定`,
    background: `${oldName}来自旧城`,
    notes: `${oldName}自己的新备注`
  });

  assert.equal(updated.name, newName);
  assert.equal(updated.rename_sync.renamed, true);
  assert.equal(updated.rename_sync.old_name, oldName);
  assert.equal(updated.rename_sync.new_name, newName);
  assert.equal(updated.rename_sync.chapter_snapshots, 1);
  assert.ok(updated.rename_sync.rows_updated >= 10);
  assertCurrentRowUsesOnlyNewName(updated, oldName, newName, ['appearance', 'personality', 'background', 'notes']);
  assertCurrentRowUsesOnlyNewName(
    execQueryOne(db, 'SELECT description FROM books WHERE id = ?', [book.id]),
    oldName,
    newName,
    ['description']
  );

  const renamedBookPlan = execQueryOne(db, 'SELECT * FROM book_plans WHERE id = ?', ['rename-book-plan']);
  assertCurrentRowUsesOnlyNewName(
    renamedBookPlan,
    oldName,
    newName,
    ['role_summary', 'main_outline', 'volume_outline', 'detailed_outline', 'structured_content']
  );
  assert.equal(renamedBookPlan.version, 2);
  const renamedVolumePlan = execQueryOne(db, 'SELECT * FROM volume_plans WHERE id = ?', ['rename-volume-plan']);
  assertCurrentRowUsesOnlyNewName(
    renamedVolumePlan,
    oldName,
    newName,
    ['volume_name', 'volume_theme', 'stage_goal', 'core_conflict', 'start_role_state', 'end_role_state', 'notes', 'structured_content']
  );
  assert.equal(renamedVolumePlan.version, 2);
  assertCurrentRowUsesOnlyNewName(
    execQueryOne(db, 'SELECT * FROM chapter_plans WHERE id = ?', ['rename-chapter-plan']),
    oldName,
    newName,
    ['chapter_name', 'summary', 'chapter_mission', 'emotion_target', 'outline_text', 'scene_outline', 'character_notes', 'appearing_roles', 'previous_hook', 'ending_hook', 'structured_content']
  );
  assertCurrentRowUsesOnlyNewName(
    execQueryOne(db, 'SELECT * FROM storylines WHERE id = ?', ['rename-storyline']),
    oldName,
    newName,
    ['storyline_name', 'description', 'involved_characters', 'key_nodes', 'core_conflict', 'structured_content']
  );
  assertCurrentRowUsesOnlyNewName(
    execQueryOne(db, 'SELECT * FROM chapters WHERE id = ?', ['rename-chapter']),
    oldName,
    newName,
    ['chapter_name', 'title', 'content', 'outline']
  );
  assertCurrentRowUsesOnlyNewName(
    execQueryOne(db, 'SELECT * FROM chapter_feedback WHERE id = ?', ['rename-feedback']),
    oldName,
    newName,
    ['feedback_json']
  );
  assertCurrentRowUsesOnlyNewName(
    execQueryOne(db, 'SELECT * FROM character_state_ledger WHERE id = ?', ['rename-character-ledger']),
    oldName,
    newName,
    ['character_name', 'role_text', 'relationship_text', 'state_text', 'appearance_text', 'note_text', 'evidence_text']
  );
  assertCurrentRowUsesOnlyNewName(
    execQueryOne(db, 'SELECT * FROM continuity_events WHERE id = ?', ['rename-continuity']),
    oldName,
    newName,
    ['subject', 'fact_text', 'evidence_text']
  );
  assertCurrentRowUsesOnlyNewName(
    execQueryOne(db, 'SELECT * FROM chapter_characters WHERE id = ?', ['rename-chapter-character']),
    oldName,
    newName,
    ['role_in_chapter', 'state_snapshot']
  );
  assert.equal(
    execQueryOne(db, 'SELECT character_id FROM chapter_characters WHERE id = ?', ['rename-chapter-character']).character_id,
    character.id
  );
  assertCurrentRowUsesOnlyNewName(
    execQueryOne(db, 'SELECT * FROM novel_characters WHERE id = ?', [relatedCharacter.id]),
    oldName,
    newName,
    ['background', 'notes']
  );

  const versions = execQuery(db, 'SELECT source, content FROM chapter_versions WHERE book_id = ? ORDER BY rowid', [book.id]);
  assert.equal(versions.length, 2);
  assert.deepEqual(versions.find((item) => item.source === 'history_seed'), {
    source: 'history_seed',
    content: `${oldName}仍在历史版本中`
  });
  assert.deepEqual(versions.find((item) => item.source === 'character_rename'), {
    source: 'character_rename',
    content: `${oldName}走进雨夜，${oldName}找到线索。`
  });
  const generationRun = execQueryOne(db, 'SELECT * FROM generation_runs WHERE id = ?', ['rename-generation-run']);
  assert.match(generationRun.prompt_text, new RegExp(oldName));
  assert.match(generationRun.context_snapshot_json, new RegExp(oldName));
  assert.match(generationRun.final_output, new RegExp(oldName));

  const untouchedPlan = execQueryOne(db, 'SELECT main_outline FROM book_plans WHERE id = ?', ['rename-other-book-plan']);
  assert.equal(untouchedPlan.main_outline, `${oldName}留在另一部书`);
  assert.equal(await characterService.ensureLegacySummarySplit(book.id, ''), 0);
  assert.equal(
    Number(execQueryOne(db, 'SELECT COUNT(*) AS count FROM novel_characters WHERE book_id = ? AND name = ?', [book.id, oldName]).count),
    0
  );
});

test('同书重名（忽略大小写）时拒绝改名且不产生正文快照', async () => {
  const db = await dbPromise;
  const book = await bookService.create('角色重名测试书', 'urban');
  const first = await characterService.create(book.id, '甲', '', '', '', '甲备注');
  await characterService.create(book.id, 'Alice');
  db.run(`INSERT INTO chapters (id, book_id, chapter_number, title, content)
    VALUES ('rename-conflict-chapter', ?, 1, '甲登场', '甲正在行动')`, [book.id]);
  saveDatabase(db);

  await assert.rejects(
    characterService.update(first.id, { name: 'alice', notes: '不应保存' }),
    (error) => error?.code === 'CHARACTER_NAME_CONFLICT' && error?.statusCode === 409
  );

  assert.equal((await characterService.getById(first.id)).name, '甲');
  assert.equal((await characterService.getById(first.id)).notes, '甲备注');
  assert.equal(execQueryOne(db, 'SELECT content FROM chapters WHERE id = ?', ['rename-conflict-chapter']).content, '甲正在行动');
  assert.equal(
    Number(execQueryOne(db, 'SELECT COUNT(*) AS count FROM chapter_versions WHERE book_id = ?', [book.id]).count),
    0
  );
});

test('结构化键冲突会回滚整次角色改名', async () => {
  const db = await dbPromise;
  const book = await bookService.create('角色改名回滚测试书', 'urban');
  const character = await characterService.create(book.id, '旧名');
  db.run(`INSERT INTO book_plans (id, book_id, role_summary, structured_content)
    VALUES (?, ?, ?, ?)`, [
    'rename-rollback-plan',
    book.id,
    '旧名仍在摘要',
    JSON.stringify({ characterStates: { 旧名: '旧状态', 新名: '新状态' } })
  ]);
  db.run(`INSERT INTO chapters (id, book_id, chapter_number, title, content)
    VALUES ('rename-rollback-chapter', ?, 1, '旧名登场', '旧名正在行动')`, [book.id]);
  saveDatabase(db);

  await assert.rejects(
    characterService.update(character.id, { name: '新名' }),
    (error) => error?.code === 'CHARACTER_RENAME_JSON_KEY_CONFLICT'
  );

  assert.equal((await characterService.getById(character.id)).name, '旧名');
  assert.equal(execQueryOne(db, 'SELECT role_summary FROM book_plans WHERE id = ?', ['rename-rollback-plan']).role_summary, '旧名仍在摘要');
  assert.equal(execQueryOne(db, 'SELECT content FROM chapters WHERE id = ?', ['rename-rollback-chapter']).content, '旧名正在行动');
  assert.equal(
    Number(execQueryOne(db, 'SELECT COUNT(*) AS count FROM chapter_versions WHERE book_id = ?', [book.id]).count),
    0
  );
});
