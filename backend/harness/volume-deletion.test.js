const test = require('node:test');
const assert = require('node:assert/strict');
const initSqlJs = require('sql.js');
const { inspectVolumeDeletion, deleteEmptyVolume } = require('../services/volume-deletion');

async function fixture() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run('CREATE TABLE volume_plans (id TEXT PRIMARY KEY, book_id TEXT, user_id TEXT, volume_number INTEGER, volume_name TEXT, UNIQUE(book_id,user_id,volume_number))');
  for (const table of ['volume_settings', 'volume_timelines']) db.run('CREATE TABLE ' + table + ' (id TEXT, book_id TEXT, volume_number INTEGER)');
  db.run('CREATE TABLE storylines (id TEXT, book_id TEXT, volume_number INTEGER)');
  db.run('CREATE TABLE chapter_plans (id TEXT, book_id TEXT, volume_number INTEGER, chapter_number INTEGER, main_storyline_id TEXT, target_storylines TEXT)');
  db.run('CREATE TABLE chapters (id TEXT, book_id TEXT, chapter_number INTEGER, content TEXT)');
  for (const book of ['book', 'other']) for (const number of [1,2,3]) {
    db.run('INSERT INTO volume_plans VALUES (?,?,?,?,?)', [book + number, book, 'owner', number, '卷' + number]);
    for (const table of ['volume_settings','storylines','volume_timelines']) db.run('INSERT INTO ' + table + ' VALUES (?,?,?)', [book + number,book,number]);
  }
  return db;
}
function values(db, sql) { return db.exec(sql)[0]?.values || []; }
function snapshot(db) { return JSON.stringify(['volume_plans','volume_settings','storylines','volume_timelines','chapter_plans','chapters'].map(table=>values(db,'SELECT * FROM '+table))); }

test('有章节的卷禁止删除，所有关联数据保持不变', async () => {
  const db = await fixture();
  try {
    db.run("INSERT INTO chapter_plans VALUES ('p','book',2,11,'book2','[]')");
    db.run("INSERT INTO chapters VALUES ('c','book',11,'正文')");
    const before = snapshot(db);
    assert.equal(inspectVolumeDeletion(db,'book',2,'owner').canDelete,false);
    assert.throws(()=>deleteEmptyVolume(db,'book',2,'owner','book2'),error=>error.statusCode===409);
    assert.equal(snapshot(db),before);
  } finally { db.close(); }
});

test('删除空中间卷时同步后续卷和章节归属，不改正文、章节号或其他书', async () => {
  const db = await fixture();
  try {
    db.run("INSERT INTO chapter_plans VALUES ('p','book',3,21,'book3','[]')");
    db.run("INSERT INTO chapters VALUES ('c','book',21,'保留正文')");
    deleteEmptyVolume(db,'book',2,'owner','book2');
    for(const table of ['volume_plans','volume_settings','storylines','volume_timelines']) {
      assert.deepEqual(values(db,"SELECT id,volume_number FROM "+table+" WHERE book_id='book' ORDER BY volume_number"),[['book1',1],['book3',2]]);
      assert.equal(values(db,"SELECT * FROM "+table+" WHERE book_id='other'").length,3);
    }
    assert.deepEqual(values(db,'SELECT chapter_number,volume_number FROM chapter_plans'),[[21,2]]);
    assert.deepEqual(values(db,'SELECT chapter_number,content FROM chapters'),[[21,'保留正文']]);
  } finally { db.close(); }
});

test('确认后卷号已变化、错误用户及缺失分卷均不删除', async () => {
  const db = await fixture();
  try {
    const before = snapshot(db);
    assert.throws(()=>deleteEmptyVolume(db,'book',2,'owner','old-id'),error=>error.statusCode===409);
    assert.throws(()=>deleteEmptyVolume(db,'book',2,'other-user'),error=>error.statusCode===404);
    assert.throws(()=>deleteEmptyVolume(db,'book',9,'owner'),error=>error.statusCode===404);
    assert.equal(snapshot(db),before);
  } finally { db.close(); }
});

test('删除与重编号之间失败时完整回滚', async () => {
  const db = await fixture();
  try {
    db.run("CREATE TRIGGER fail_remap BEFORE UPDATE ON volume_settings BEGIN SELECT RAISE(ABORT, '模拟重编号失败'); END");
    const before = snapshot(db);
    assert.throws(()=>deleteEmptyVolume(db,'book',2,'owner','book2'),/模拟重编号失败/);
    assert.equal(snapshot(db),before);
  } finally { db.close(); }
});

test('没有规划的旧正文和跨卷剧情线引用必须先处理', async () => {
  const db = await fixture();
  try {
    db.run("INSERT INTO chapters VALUES ('c','book',21,'旧正文')");
    assert.match(inspectVolumeDeletion(db,'book',2,'owner').blockedReason,/尚未关联/);
    db.run("INSERT INTO chapter_plans VALUES ('p','book',3,21,'','[\"book2\"]')");
    assert.match(inspectVolumeDeletion(db,'book',2,'owner').blockedReason,/引用本卷剧情线/);
    assert.throws(()=>deleteEmptyVolume(db,'book',2,'owner','book2'));
  } finally { db.close(); }
});

test('空尾卷和最后一个空卷可正常删除', async () => {
  const db = await fixture();
  try {
    for(const n of [3,2,1]) deleteEmptyVolume(db,'book',n,'owner','book'+n);
    assert.equal(values(db,"SELECT * FROM volume_plans WHERE book_id='book'").length,0);
    assert.equal(values(db,"SELECT * FROM volume_plans WHERE book_id='other'").length,3);
  } finally { db.close(); }
});

test('预览后新增章节时，删除接口重新检查并拒绝执行', async () => {
  const db = await fixture();
  try {
    const preview = inspectVolumeDeletion(db,'book',2,'owner');
    assert.equal(preview.canDelete,true);
    db.run("INSERT INTO chapter_plans VALUES ('new','book',2,12,'','[]')");
    const before = snapshot(db);
    assert.throws(()=>deleteEmptyVolume(db,'book',2,'owner',preview.volumeId),error=>error.statusCode===409);
    assert.equal(snapshot(db),before);
  } finally { db.close(); }
});
