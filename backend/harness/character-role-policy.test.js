const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCharacterRosterPrompt,
  enforceRoleTierQuotas,
  inspectFullOutlineCharacterAlignment,
  normalizeCharacterRoster
} = require('../services/character-role-policy');

const roster = [
  { name: '沈遥', role_tier: 'supporting_major', personality: '冷静' },
  { name: '林烬', role_tier: 'protagonist', personality: '执着' }
];

test('角色清单按定位排序并明确唯一主角', () => {
  assert.deepEqual(normalizeCharacterRoster(roster).map((item) => item.name), ['林烬', '沈遥']);
  const prompt = buildCharacterRosterPrompt(roster);
  assert.match(prompt, /唯一主角：林烬/);
  assert.match(prompt, /主要配角（supporting_major）｜姓名：沈遥/);
  assert.match(prompt, /不得改名、合并角色、互换主配角/);
});

test('大纲角色检查能拦截主配角倒置', () => {
  assert.equal(
    inspectFullOutlineCharacterAlignment('主角林烬与主要配角沈遥共同追查旧案。', roster).ok,
    true
  );
  assert.deepEqual(
    inspectFullOutlineCharacterAlignment('主角是沈遥，林烬作为本书配角。', roster).issues,
    ['大纲把主角“林烬”写成了配角或反派', '大纲把主要配角“沈遥”写成了主角']
  );
});

test('批量角色层级严格服从请求配额', () => {
  const generated = [
    { name: '甲', role_tier: 'supporting_major' },
    { name: '乙', role_tier: 'protagonist' },
    { name: '丙', role_tier: 'protagonist' },
    { name: '丁', role_tier: 'antagonist_major' }
  ];
  const assigned = enforceRoleTierQuotas(generated, [
    { roleTier: 'protagonist', count: 1 },
    { roleTier: 'supporting_major', count: 2 },
    { roleTier: 'antagonist_major', count: 1 }
  ]);
  const counts = assigned.reduce((result, item) => {
    result[item.role_tier] = (result[item.role_tier] || 0) + 1;
    return result;
  }, {});
  assert.deepEqual(counts, {
    supporting_major: 2,
    protagonist: 1,
    antagonist_major: 1
  });
});
