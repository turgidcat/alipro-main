const test = require('node:test');
const assert = require('node:assert/strict');
const { evidenceAround, splitHooks, syncFeedbackLedgers } = require('../services/continuity-ledger-service');

test('伏笔文本拆分后保持稳定且去除空项', () => {
  assert.deepEqual(splitHooks('门后的脚步声；失踪的钥匙\n未寄出的信'), [
    '门后的脚步声', '失踪的钥匙', '未寄出的信'
  ]);
});

test('账本证据必须来自正文中的角色附近文本', () => {
  const content = '大厅里一片安静。林川把染血的钥匙交给周宁，然后关上了门。';
  const evidence = evidenceAround(content, '林川', 8);
  assert.match(evidence, /林川/);
  assert.equal(evidenceAround(content, '不存在的人'), '');
});

test('本章用原文证据兑现伏笔时会关闭旧账本项', () => {
  const calls = [];
  const db = { run(sql, params) { calls.push({ sql, params }); } };
  syncFeedbackLedgers(db, {
    bookId: 'book-1',
    chapterNumber: 7,
    content: '林烬终于从河岸脱身，确认自己还活着。',
    feedback: {
      source: 'model_feedback',
      resolved_hooks: [{ foreshadow_key: 'survival-hook', evidence: '确认自己还活着' }]
    }
  });
  const resolution = calls.find((item) => /UPDATE foreshadow_ledger SET state = 'resolved'/.test(item.sql));
  assert.deepEqual(resolution.params, ['确认自己还活着', 'book-1', 'survival-hook', 7]);
});
