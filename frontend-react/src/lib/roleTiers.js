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
