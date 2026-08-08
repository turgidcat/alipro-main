const test = require('node:test');
const assert = require('node:assert/strict');
const { pickPreviousChapter } = require('../services/chapter-context-policy');

const rows = [
  { chapter_number: 1, content: '第一章旧正文' },
  { chapter_number: 2, content: '第二章旧正文' },
  { chapter_number: 8, content: '最后一章旧正文' }
];

test('生成第 1 章时不得把现有最后一章当成上一章', () => {
  assert.equal(pickPreviousChapter(rows, 1), null);
});

test('后续章节只选择章节号更小的最近正文', () => {
  assert.equal(pickPreviousChapter(rows, 2)?.chapter_number, 1);
  assert.equal(pickPreviousChapter(rows, 8)?.chapter_number, 2);
});
