const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DEEPSEEK_API_KEY ||= 'harness-placeholder-key';
const deepseekService = require('../services/deepseek');

const fixture = {
  bookTitle: '破雾修真录', genre: 'xuanhuan', platform: 'qidian', chapterTitle: '雾门试炼',
  outline: '沈破雾进入雾门试炼，在不暴露底牌的前提下取得第一枚信物，并发现守卒与旧案有关。',
  characters: '沈破雾：谨慎、克制。陆听澜：观察敏锐，与主角暂时合作。',
  appearingRoles: ['沈破雾', '陆听澜'],
  roleExecution: [{ name: '沈破雾', objective: '取得信物', boundary: '不能暴露底牌' }],
  contextNotes: '上一章结尾：雾门打开。\n必须推进：取得第一枚信物。\n禁止提前发生：揭晓幕后主使。',
  wordCount: 3000, shuangTags: ['智斗', '反转'], fastPace: true
};

test('chapter.v2 使用 system/user 两层消息', () => {
  const systemPrompt = deepseekService.getCreativeSystemPrompt();
  const userPrompt = deepseekService.buildCreativePrompt(fixture);
  const messages = deepseekService.buildMessages({ systemPrompt, prompt: userPrompt });
  assert.deepEqual(messages.map((item) => item.role), ['system', 'user']);
  assert.match(messages[0].content, /mustNotHappen/);
  assert.match(messages[0].content, /只有提及、暗示、征兆、讨论或尝试不算完成/);
  assert.match(messages[1].content, /逐项确认 mustAdvance 已在正文发生并产生结果/);
  assert.match(messages[1].content, /雾门试炼/);
});

test('chapter.v2 去重后总 Prompt 明显短于 chapter.v1', () => {
  const legacy = deepseekService.buildCreativePromptLegacy(fixture);
  const compact = `${deepseekService.getCreativeSystemPrompt()}\n${deepseekService.buildCreativePrompt(fixture)}`;
  assert.ok(compact.length < legacy.length * 0.8, `v1=${legacy.length}, v2=${compact.length}`);
});
