const APP_BASE_PATH = String(import.meta.env.BASE_URL || '/');

export function getApiBase() {
  const configured = String(import.meta.env.VITE_API_BASE || '').trim();
  if (configured) return configured.replace(/\/+$/, '');

  // 阿里云上的正式 Node 服务位于项目专属 API 路径；本地开发仍走 Vite 的 /api 代理。
  if (typeof window !== 'undefined' && window.location.hostname === 'turgidcat.space') {
    return 'https://turgidcat.space/projects/alipro/api';
  }

  return `${APP_BASE_PATH.replace(/\/+$/, '')}/api`;
}
