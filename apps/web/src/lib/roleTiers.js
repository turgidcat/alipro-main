export const roleTierOptions = [
  { value: 'protagonist', label: '主角', shortLabel: '主角 T0', defaultCount: 1, softLimit: '建议 1 个', max: 1, tone: 'role-tier-protagonist', order: 0 },
  { value: 'supporting_major', label: '主要配角', shortLabel: '主要配角 T1', defaultCount: 2, softLimit: '建议 1-4 个', max: 4, tone: 'role-tier-supporting-major', order: 1 },
  { value: 'supporting_secondary', label: '次要配角', shortLabel: '次要配角 T2', defaultCount: 2, softLimit: '建议 1-6 个', max: 6, tone: 'role-tier-supporting-secondary', order: 2 },
  { value: 'supporting_minor', label: '普通配角', shortLabel: '普通配角 T3', defaultCount: 3, softLimit: '建议 2-10 个', max: 10, tone: 'role-tier-supporting-minor', order: 3 },
  { value: 'antagonist_major', label: '大反派', shortLabel: '大反派 T0', defaultCount: 1, softLimit: '建议 1-2 个', max: 2, tone: 'role-tier-antagonist-major', order: 4 },
  { value: 'antagonist_minor', label: '普通反派', shortLabel: '普通反派 T1', defaultCount: 2, softLimit: '建议 1-6 个', max: 6, tone: 'role-tier-antagonist-minor', order: 5 }
];

export const roleTierLabelMap = Object.fromEntries(roleTierOptions.map((item) => [item.value, item.label]));
export const roleTierShortLabelMap = Object.fromEntries(roleTierOptions.map((item) => [item.value, item.shortLabel]));
export const roleTierToneMap = Object.fromEntries(roleTierOptions.map((item) => [item.value, item.tone]));
export const roleTierOrderMap = Object.fromEntries(roleTierOptions.map((item) => [item.value, item.order]));

export function getRoleTierLabel(roleTier = '') {
  return roleTierLabelMap[roleTier] || '普通配角';
}

export function getRoleTierShortLabel(roleTier = '') {
  return roleTierShortLabelMap[roleTier] || '普通配角 T3';
}

export function getRoleTierTone(roleTier = '') {
  return roleTierToneMap[roleTier] || 'role-tier-supporting-minor';
}

export function compareRoleTier(leftTier = '', rightTier = '') {
  return (roleTierOrderMap[leftTier] ?? 999) - (roleTierOrderMap[rightTier] ?? 999);
}

export function normalizeCharacterRoleRoster(characters = []) {
  const seenNames = new Set();
  return (Array.isArray(characters) ? characters : [])
    .filter((character) => character && typeof character === 'object')
    .map((character) => ({
      ...character,
      name: String(character.name || '').trim(),
      role_tier: roleTierLabelMap[character.role_tier] ? character.role_tier : 'supporting_minor'
    }))
    .filter((character) => {
      const key = character.name.toLocaleLowerCase('zh-Hans-CN');
      if (!key || seenNames.has(key) || ['全书角色设定', '本章新增角色'].includes(character.name)) return false;
      seenNames.add(key);
      return true;
    })
    .sort((left, right) => {
      const tierDiff = compareRoleTier(left.role_tier, right.role_tier);
      if (tierDiff !== 0) return tierDiff;
      return left.name.localeCompare(right.name, 'zh-Hans-CN');
    });
}

export function buildCharacterRosterPrompt(characters = []) {
  const roster = normalizeCharacterRoleRoster(characters);
  if (roster.length === 0) return '';
  const protagonists = roster.filter((character) => character.role_tier === 'protagonist');
  const lines = roster.map((character) => [
    `${getRoleTierLabel(character.role_tier)}（${character.role_tier}）｜姓名：${character.name}`,
    character.personality ? `性格：${String(character.personality).trim()}` : '',
    character.background ? `背景：${String(character.background).trim()}` : '',
    character.appearance ? `外形：${String(character.appearance).trim()}` : ''
  ].filter(Boolean).join('；'));
  return [
    '【角色档案硬约束，优先级最高】',
    protagonists.length === 1
      ? `唯一主角：${protagonists[0].name}。全文中的“主角”只能指此人。`
      : `当前主角数量：${protagonists.length}。请严格按下表角色定位，不得自行指定主角。`,
    '角色姓名和定位必须逐字遵守；不得改名、合并角色、互换主配角，也不得把配角或反派写成主角。',
    ...lines
  ].join('\n');
}

export function buildCharacterRosterSummary(characters = []) {
  return normalizeCharacterRoleRoster(characters)
    .map((character) => [
      `${getRoleTierLabel(character.role_tier)}｜${character.name}`,
      character.personality ? `性格：${String(character.personality).trim()}` : '',
      character.background ? `背景：${String(character.background).trim()}` : '',
      character.appearance ? `外形：${String(character.appearance).trim()}` : ''
    ].filter(Boolean).join('；'))
    .join('\n');
}

function escapeRoleNamePattern(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function inspectFullOutlineCharacterAlignment(outlineText = '', characters = []) {
  const roster = normalizeCharacterRoleRoster(characters);
  if (roster.length === 0) return { ok: true, issues: [] };
  const text = String(outlineText || '').replace(/\s+/g, ' ').trim();
  const protagonists = roster.filter((character) => character.role_tier === 'protagonist');
  const issues = [];
  if (protagonists.length !== 1) {
    issues.push(`角色资料中需要且只能有 1 位主角，当前为 ${protagonists.length} 位`);
  }
  protagonists.forEach((character) => {
    if (!text.includes(character.name)) issues.push(`大纲没有使用主角姓名“${character.name}”`);
    const escapedName = escapeRoleNamePattern(character.name);
    const wrongTierPattern = new RegExp(`(?:主要配角|次要配角|普通配角|大反派|普通反派)\\s*(?:是|为|：|:)?\\s*[《“\"'‘]*${escapedName}|${escapedName}[》”\"'’]*\\s*(?:是|为|担任|作为)\\s*(?:本书|全书|故事)?(?:的)?(?:配角|反派)`);
    if (wrongTierPattern.test(text)) issues.push(`大纲把主角“${character.name}”写成了配角或反派`);
  });
  roster.filter((character) => character.role_tier !== 'protagonist').forEach((character) => {
    const escapedName = escapeRoleNamePattern(character.name);
    const protagonistPattern = new RegExp(`(?:主角|男主|女主)\\s*(?:姓名|名字|角色)?\\s*(?:是|为|：|:)?\\s*[《“\"'‘]*${escapedName}|${escapedName}[》”\"'’]*\\s*(?:是|为|担任|作为)\\s*(?:本书|全书|故事)?(?:的)?(?:主角|男主|女主)`);
    if (protagonistPattern.test(text)) issues.push(`大纲把${getRoleTierLabel(character.role_tier)}“${character.name}”写成了主角`);
  });
  return { ok: issues.length === 0, issues };
}
