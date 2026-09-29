const ROLE_TIER_VALUES = [
  'protagonist',
  'supporting_major',
  'supporting_secondary',
  'supporting_minor',
  'antagonist_major',
  'antagonist_minor'
];

const ROLE_TIER_LABELS = {
  protagonist: '主角',
  supporting_major: '主要配角',
  supporting_secondary: '次要配角',
  supporting_minor: '普通配角',
  antagonist_major: '大反派',
  antagonist_minor: '普通反派'
};

function normalizeText(value, maxLength = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeCharacterRoster(characters = []) {
  const seenNames = new Set();
  return (Array.isArray(characters) ? characters : [])
    .filter((character) => character && typeof character === 'object')
    .map((character) => ({
      name: normalizeText(character.name, 100),
      role_tier: ROLE_TIER_VALUES.includes(character.role_tier) ? character.role_tier : 'supporting_minor',
      personality: normalizeText(character.personality, 1200),
      background: normalizeText(character.background, 1800),
      appearance: normalizeText(character.appearance, 1000)
    }))
    .filter((character) => {
      const key = character.name.toLocaleLowerCase('zh-Hans-CN');
      if (!key || seenNames.has(key) || ['全书角色设定', '本章新增角色'].includes(character.name)) return false;
      seenNames.add(key);
      return true;
    })
    .sort((left, right) => {
      const tierDiff = ROLE_TIER_VALUES.indexOf(left.role_tier) - ROLE_TIER_VALUES.indexOf(right.role_tier);
      if (tierDiff !== 0) return tierDiff;
      return left.name.localeCompare(right.name, 'zh-Hans-CN');
    });
}

function buildRoleTierPromptSection() {
  return [
    '角色定位枚举：',
    '- protagonist：主角',
    '- supporting_major：主要配角',
    '- supporting_secondary：次要配角',
    '- supporting_minor：普通配角',
    '- antagonist_major：大反派',
    '- antagonist_minor：普通反派'
  ].join('\n');
}

function buildCharacterRosterPrompt(characters = []) {
  const roster = normalizeCharacterRoster(characters);
  if (roster.length === 0) return '';
  const protagonists = roster.filter((character) => character.role_tier === 'protagonist');
  return [
    '【角色档案硬约束，优先级最高】',
    protagonists.length === 1
      ? `唯一主角：${protagonists[0].name}。全文中的“主角”只能指此人。`
      : `当前主角数量：${protagonists.length}。必须严格按角色表定位，不得自行指定主角。`,
    '角色姓名和定位必须逐字遵守；不得改名、合并角色、互换主配角，也不得把配角或反派写成主角。',
    ...roster.map((character) => [
      `${ROLE_TIER_LABELS[character.role_tier]}（${character.role_tier}）｜姓名：${character.name}`,
      character.personality ? `性格：${character.personality}` : '',
      character.background ? `背景：${character.background}` : '',
      character.appearance ? `外形：${character.appearance}` : ''
    ].filter(Boolean).join('；'))
  ].join('\n');
}

function escapePattern(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inspectFullOutlineCharacterAlignment(outlineText = '', characters = []) {
  const roster = normalizeCharacterRoster(characters);
  if (roster.length === 0) return { ok: true, issues: [] };
  const text = String(outlineText || '').replace(/\s+/g, ' ').trim();
  const protagonists = roster.filter((character) => character.role_tier === 'protagonist');
  const issues = [];
  if (protagonists.length !== 1) {
    issues.push(`角色资料中需要且只能有 1 位主角，当前为 ${protagonists.length} 位`);
  }
  protagonists.forEach((character) => {
    if (!text.includes(character.name)) issues.push(`大纲没有使用主角姓名“${character.name}”`);
    const name = escapePattern(character.name);
    const wrongTier = new RegExp(`(?:主要配角|次要配角|普通配角|大反派|普通反派)\\s*(?:是|为|：|:)?\\s*[《“\"'‘]*${name}|${name}[》”\"'’]*\\s*(?:是|为|担任|作为)\\s*(?:本书|全书|故事)?(?:的)?(?:配角|反派)`);
    if (wrongTier.test(text)) issues.push(`大纲把主角“${character.name}”写成了配角或反派`);
  });
  roster.filter((character) => character.role_tier !== 'protagonist').forEach((character) => {
    const name = escapePattern(character.name);
    const asProtagonist = new RegExp(`(?:主角|男主|女主)\\s*(?:姓名|名字|角色)?\\s*(?:是|为|：|:)?\\s*[《“\"'‘]*${name}|${name}[》”\"'’]*\\s*(?:是|为|担任|作为)\\s*(?:本书|全书|故事)?(?:的)?(?:主角|男主|女主)`);
    if (asProtagonist.test(text)) issues.push(`大纲把${ROLE_TIER_LABELS[character.role_tier]}“${character.name}”写成了主角`);
  });
  return { ok: issues.length === 0, issues };
}

function enforceRoleTierQuotas(items = [], requestedEntries = []) {
  const requested = (Array.isArray(requestedEntries) ? requestedEntries : [])
    .filter((entry) => ROLE_TIER_VALUES.includes(entry?.roleTier) && Number(entry?.count) > 0)
    .map((entry) => ({ roleTier: entry.roleTier, count: Math.max(0, Number(entry.count) || 0) }));
  const totalCount = requested.reduce((sum, entry) => sum + entry.count, 0);
  const candidates = (Array.isArray(items) ? items : []).slice(0, totalCount);
  const remaining = new Map(requested.map((entry) => [entry.roleTier, entry.count]));
  const assignments = new Array(candidates.length).fill('');

  candidates.forEach((item, index) => {
    const tier = item?.role_tier;
    if (!ROLE_TIER_VALUES.includes(tier) || Number(remaining.get(tier) || 0) <= 0) return;
    assignments[index] = tier;
    remaining.set(tier, Number(remaining.get(tier) || 0) - 1);
  });

  const missingTiers = requested.flatMap((entry) => (
    Array.from({ length: Number(remaining.get(entry.roleTier) || 0) }, () => entry.roleTier)
  ));
  let missingIndex = 0;
  return candidates.map((item, index) => ({
    ...item,
    role_tier: assignments[index] || missingTiers[missingIndex++] || requested[0]?.roleTier || 'supporting_major'
  }));
}

module.exports = {
  ROLE_TIER_VALUES,
  ROLE_TIER_LABELS,
  normalizeCharacterRoster,
  buildRoleTierPromptSection,
  buildCharacterRosterPrompt,
  inspectFullOutlineCharacterAlignment,
  enforceRoleTierQuotas
};
