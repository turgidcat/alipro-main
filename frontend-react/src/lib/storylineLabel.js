export function formatStorylineTypeLabel(type) {
  const normalized = String(type || '').trim().toLowerCase();
  if (normalized === 'main') return '主线';
  if (normalized === 'branch') return '支线';
  return normalized ? '剧情线' : '剧情线';
}
