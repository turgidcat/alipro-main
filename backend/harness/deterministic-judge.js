const { countPlatformEffectiveWords, MIN_WORD_RATIO, MAX_WORD_RATIO } = require('../services/word-count-policy');

function normalizeText(value) {
  return String(value || '').trim();
}

function includesAny(content, values) {
  const text = normalizeText(content);
  for (const item of (Array.isArray(values) ? values : [])) {
    const phrase = normalizeText(typeof item === 'string' ? item : item?.text || item?.summary || item?.name);
    if (phrase && text.includes(phrase)) return phrase;
  }
  return null;
}

function inspectDeterministicContent(input = {}) {
  const content = normalizeText(input.content);
  const issues = [];
  const add = (code, severity, message, evidence = '') => issues.push({ code, severity, message, evidence });

  if (!content) add('EMPTY_CONTENT', 'block', '正文为空');
  if (/^\s{0,3}#{1,6}\s+/m.test(content)) add('MARKDOWN_HEADING', 'block', '正文包含 Markdown 标题');
  if (/```/.test(content)) add('CODE_FENCE', 'block', '正文包含代码块标记');
  if (/\uFFFD/.test(content)) add('REPLACEMENT_CHARACTER', 'block', '正文包含乱码替换字符');
  if (content && !/[。！？!?…”’」』】）)]$/.test(content)) add('TRUNCATED_END', 'block', '正文结尾疑似截断', content.slice(-30));

  const effectiveWordCount = countPlatformEffectiveWords(content);
  const targetWordCount = Number(input.targetWordCount || 0);
  if (targetWordCount > 0 && effectiveWordCount < Math.floor(targetWordCount * Number(input.minWordRatio || MIN_WORD_RATIO))) {
    add('WORD_COUNT_LOW', 'review', '正文字数显著低于目标', `${effectiveWordCount}/${targetWordCount}`);
  }
  if (targetWordCount > 0 && effectiveWordCount > Math.ceil(targetWordCount * Number(input.maxWordRatio || MAX_WORD_RATIO))) {
    add('WORD_COUNT_HIGH', 'review', '正文字数超过允许上限', `${effectiveWordCount}/${targetWordCount}`);
  }

  const forbiddenPhrase = includesAny(content, input.forbiddenPhrases);
  if (forbiddenPhrase) add('MUST_NOT_HAPPEN_TRIGGERED', 'block', '正文明确触发禁止提前发生事项', normalizeText(forbiddenPhrase));
  const forbiddenCharacter = includesAny(content, input.forbiddenCharacterNames);
  if (forbiddenCharacter) add('FORBIDDEN_CHARACTER_NAME', 'block', '正文出现禁止角色名', normalizeText(forbiddenCharacter));
  const forbiddenSetting = includesAny(content, input.forbiddenSettingNames);
  if (forbiddenSetting) add('FORBIDDEN_SETTING', 'block', '正文出现禁止的新设定', normalizeText(forbiddenSetting));

  const blockingIssues = issues.filter((item) => item.severity === 'block');
  return {
    status: blockingIssues.length > 0 ? 'blocked' : (issues.length > 0 ? 'review' : 'passed'),
    effective_word_count: effectiveWordCount,
    issues,
    blocking_issue_codes: blockingIssues.map((item) => item.code)
  };
}

module.exports = { countEffectiveWords: countPlatformEffectiveWords, inspectDeterministicContent };
