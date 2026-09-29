const test = require('node:test');
const assert = require('node:assert/strict');
const { contentHash, generationContractHash, chapterPlanningHash, feedbackIsCurrent, applyChapterDraft, verifiedCompletedBeats } = require('../services/generation-context-policy');
test('generation contract tracks canon changes but ignores derived progress and temporary cards', () => {
  const base = { bookPlan: { theme: '生存' }, characters: [{ id: 'a', name: '甲', notes: '剑骨' }], storylines: [{ id: 's', structured_content: JSON.stringify({ keyBeats: [{ summary: '反噬' }] }) }] };
  const hash = generationContractHash(base);
  assert.notEqual(generationContractHash({ ...base, bookPlan: { theme: '复仇' } }), hash);
  assert.notEqual(generationContractHash({ ...base, characters: [{ ...base.characters[0], notes: '定位能力' }] }), hash);
  assert.notEqual(generationContractHash({ ...base, storylines: [{ id: 's', structured_content: { keyBeats: [{ summary: '解除' }] } }] }), hash);
  assert.equal(generationContractHash({ ...base, characters: [{ ...base.characters[0], updated_at: 'now', notes: '剑骨【第12章角色速查】救援' }, { name: '临时', character_type: 'chapter_character' }], storylines: [{ id: 's', status: 'needs_review', structured_content: { keyBeats: [{ summary: '反噬' }], currentProgress: { completedBeats: ['x'] }, chapter_progress: [] } }] }), hash);
});
test('feedback is bound to exact content, including restored versions', () => {
  const feedback = { source_content_hash: contentHash('版本甲') };
  assert.equal(feedbackIsCurrent(feedback, '版本甲'), true);
  assert.equal(feedbackIsCurrent(feedback, '版本乙'), false);
  assert.equal(feedbackIsCurrent({}, '版本甲'), false);
});
test('same prose with changed task or role allocation invalidates old feedback', () => {
  const plan = { chapter_mission: '观察异常', appearing_roles: ['甲'] };
  const feedback = { source_content_hash: contentHash('正文'), source_planning_hash: chapterPlanningHash(plan) };
  assert.equal(feedbackIsCurrent(feedback, '正文', plan), true);
  assert.equal(feedbackIsCurrent(feedback, '正文', { ...plan, chapter_mission: '完成解封' }), false);
  assert.equal(feedbackIsCurrent(feedback, '正文', { ...plan, appearing_roles: ['乙'] }), false);
});
test('draft requirements override stored values without injecting book identity or feedback', () => {
  const old = { book_id: 'book', chapter_mission: '旧任务', structured_content: '{"plot_notes":"旧意见","chapter_feedback":{"source":"old"}}' };
  const next = applyChapterDraft(old, { book_id: 'other', chapter_mission: '新任务', appearing_roles: [], structured_content: { plot_notes: '新意见', chapter_feedback: { source: 'fake' } } });
  assert.equal(next.book_id, 'book');
  assert.equal(next.chapter_mission, '新任务');
  assert.equal(next.structured_content.plot_notes, '新意见');
  assert.equal(next.structured_content.chapter_feedback.source, 'old');
  assert.equal(old.chapter_mission, '旧任务');
});
test('using a beat is not completing it; only approved matching evidence can complete', () => {
  const content = '晶核暴走已被压制。';
  const feedback = { source_content_hash: contentHash(content), quality_check: { status: 'passed' }, completed_beats: [{ beat_id: 'beat', evidence: '暴走已被压制' }, { beat_id: 'foreign', evidence: '晶核' }, { beat_id: 'beat2', evidence: '已完全恢复' }] };
  assert.deepEqual(verifiedCompletedBeats(feedback, content, ['beat', 'beat2']), ['beat']);
  assert.deepEqual(verifiedCompletedBeats({ ...feedback, quality_check: { status: 'needs_review' } }, content, ['beat']), []);
  assert.deepEqual(verifiedCompletedBeats(feedback, '不同正文', ['beat']), []);
  assert.deepEqual(verifiedCompletedBeats({ ...feedback, completed_beats: [] }, content, ['beat']), []);
});
