const STORAGE_KEY = 'alipro-style-theme-v2';
const LEGACY_STORAGE_KEY = 'alipro-style-theme-v1';
const CUSTOM_THEME_STORAGE_KEY = 'alipro-style-theme-library-v1';
const ACTIVE_THEME_ID_STORAGE_KEY = 'alipro-style-theme-active-id-v1';

export const PAGE_THEME_OPTIONS = [
  { value: 'paper', label: '纸页留白' },
  { value: 'clear', label: '冷光留白' },
  { value: 'graphite', label: '石墨深幕' },
  { value: 'aurora', label: '极光渐层' }
];

export const BRAND_THEME_OPTIONS = [
  { value: 'amber', label: '琥珀橙' },
  { value: 'slate', label: '石墨灰' },
  { value: 'cobalt', label: '钴蓝' },
  { value: 'orchid', label: '电紫' },
  { value: 'mint', label: '薄荷青' }
];

export const NAV_THEME_OPTIONS = [
  { value: 'neutral', label: '系统导航' },
  { value: 'outline', label: '线框导航' },
  { value: 'warm', label: '品牌导航' }
];

export const ACTION_THEME_OPTIONS = [
  { value: 'neutral', label: '系统操作' },
  { value: 'outline', label: '线框操作' },
  { value: 'warm', label: '品牌操作' }
];

export const PANEL_THEME_OPTIONS = [
  { value: 'paper', label: '留白面板' },
  { value: 'frost', label: '透雾面板' },
  { value: 'frame', label: '线框面板' },
  { value: 'graphite', label: '深幕面板' },
  { value: 'contrast', label: '高对比面板' }
];

export const RADIUS_THEME_OPTIONS = [
  { value: 'soft', label: '柔和圆角' },
  { value: 'balanced', label: '平衡圆角' },
  { value: 'crisp', label: '利落圆角' }
];

export const DENSITY_THEME_OPTIONS = [
  { value: 'relaxed', label: '舒展密度' },
  { value: 'balanced', label: '平衡密度' },
  { value: 'compact', label: '紧凑密度' }
];

export const TITLE_THEME_OPTIONS = [
  { value: 'grand', label: '舒展标题' },
  { value: 'balanced', label: '平衡标题' },
  { value: 'compact', label: '紧凑标题' }
];

export const STATUS_THEME_OPTIONS = [
  { value: 'soft', label: '柔和提示' },
  { value: 'balanced', label: '平衡提示' },
  { value: 'strong', label: '强强调提示' }
];

export const DEFAULT_STYLE_THEME = {
  pageTheme: 'clear',
  brandTheme: 'slate',
  navTheme: 'neutral',
  actionTheme: 'neutral',
  panelTheme: 'frost',
  radiusTheme: 'crisp',
  densityTheme: 'compact',
  titleTheme: 'compact',
  statusTheme: 'soft',
  colorStrength: 90,
  backgroundGlow: 85,
  spacingScale: 95,
  controlScale: 95
};

export const STYLE_THEME_PRESETS = [
  {
    id: 'default',
    label: '系统冷光',
    summary: '参考 Linear / Vercel 的冷静产品页语气。',
    theme: {
      pageTheme: 'clear',
      brandTheme: 'slate',
      navTheme: 'neutral',
      actionTheme: 'neutral',
      panelTheme: 'frost',
      radiusTheme: 'crisp',
      densityTheme: 'compact',
      titleTheme: 'compact',
      statusTheme: 'soft',
      colorStrength: 90,
      backgroundGlow: 85,
      spacingScale: 95,
      controlScale: 95
    }
  },
  {
    id: 'quiet',
    label: '纸页留白',
    summary: '唯一保留的暖纸风，适合书稿与说明页。',
    theme: {
      pageTheme: 'paper',
      brandTheme: 'amber',
      navTheme: 'neutral',
      actionTheme: 'neutral',
      panelTheme: 'paper',
      radiusTheme: 'soft',
      densityTheme: 'balanced',
      titleTheme: 'balanced',
      statusTheme: 'soft',
      colorStrength: 95,
      backgroundGlow: 88,
      spacingScale: 100,
      controlScale: 98
    }
  },
  {
    id: 'structured',
    label: '深幕石墨',
    summary: '参考 Vercel 的深色产品展示，适合做强对比工作台。',
    theme: {
      pageTheme: 'graphite',
      brandTheme: 'cobalt',
      navTheme: 'neutral',
      actionTheme: 'outline',
      panelTheme: 'graphite',
      radiusTheme: 'crisp',
      densityTheme: 'compact',
      titleTheme: 'grand',
      statusTheme: 'balanced',
      colorStrength: 100,
      backgroundGlow: 95,
      spacingScale: 94,
      controlScale: 96
    }
  },
  {
    id: 'dramatic',
    label: '极光效率',
    summary: '参考 Raycast 的高效率工具感，冷色里带一点霓虹。',
    theme: {
      pageTheme: 'aurora',
      brandTheme: 'orchid',
      navTheme: 'outline',
      actionTheme: 'outline',
      panelTheme: 'frost',
      radiusTheme: 'balanced',
      densityTheme: 'compact',
      titleTheme: 'compact',
      statusTheme: 'strong',
      colorStrength: 112,
      backgroundGlow: 118,
      spacingScale: 94,
      controlScale: 96
    }
  },
  {
    id: 'signal',
    label: '钴蓝展台',
    summary: '参考 Framer 的品牌站气质，颜色更鲜明、更有展示感。',
    theme: {
      pageTheme: 'clear',
      brandTheme: 'cobalt',
      navTheme: 'warm',
      actionTheme: 'warm',
      panelTheme: 'contrast',
      radiusTheme: 'balanced',
      densityTheme: 'balanced',
      titleTheme: 'grand',
      statusTheme: 'strong',
      colorStrength: 118,
      backgroundGlow: 102,
      spacingScale: 102,
      controlScale: 102
    }
  },
  {
    id: 'mint-lab',
    label: '薄荷实验室',
    summary: '偏清爽、偏科技，适合资料页和操作页。',
    theme: {
      pageTheme: 'clear',
      brandTheme: 'mint',
      navTheme: 'neutral',
      actionTheme: 'outline',
      panelTheme: 'frame',
      radiusTheme: 'crisp',
      densityTheme: 'balanced',
      titleTheme: 'compact',
      statusTheme: 'soft',
      colorStrength: 102,
      backgroundGlow: 96,
      spacingScale: 98,
      controlScale: 98
    }
  }
];

function createBuiltInThemeRecord(preset) {
  return {
    id: preset.id,
    label: preset.label,
    summary: preset.summary || '',
    theme: resolveStyleTheme(preset.theme),
    builtIn: true
  };
}

const PAGE_THEME_TOKENS = {
  warm: {
    '--bg': '#f5efe6',
    '--bg-radial': 'radial-gradient(circle at top left, rgba(255, 214, 170, 0.55), transparent 28%)',
    '--bg-gradient': 'linear-gradient(180deg, #f8f2ea 0%, #f3ebdf 100%)',
    '--nav-surface': 'rgba(255, 250, 244, 0.92)',
    '--panel-backdrop-blur': '12px',
    '--text': '#2f2419',
    '--muted': '#7a6754'
  },
  paper: {
    '--bg': '#f4f1ea',
    '--bg-radial': 'radial-gradient(circle at top left, rgba(221, 204, 177, 0.28), transparent 30%)',
    '--bg-gradient': 'linear-gradient(180deg, #f8f5ef 0%, #f1ece4 100%)',
    '--nav-surface': 'rgba(252, 249, 243, 0.94)',
    '--panel-backdrop-blur': '10px',
    '--text': '#2f2419',
    '--muted': '#746659'
  },
  clear: {
    '--bg': '#edf1f3',
    '--bg-radial': 'radial-gradient(circle at top left, rgba(189, 208, 227, 0.34), transparent 30%)',
    '--bg-gradient': 'linear-gradient(180deg, #f6f8fb 0%, #e9eef2 100%)',
    '--nav-surface': 'rgba(250, 252, 255, 0.82)',
    '--panel-backdrop-blur': '18px',
    '--text': '#243142',
    '--muted': '#697688'
  },
  graphite: {
    '--bg': '#0f1218',
    '--bg-radial': 'radial-gradient(circle at top left, rgba(85, 112, 178, 0.34), transparent 28%)',
    '--bg-gradient': 'linear-gradient(180deg, #131821 0%, #0e1218 100%)',
    '--nav-surface': 'rgba(15, 19, 27, 0.78)',
    '--panel-backdrop-blur': '18px',
    '--text': '#edf2ff',
    '--muted': '#9aa6ba'
  },
  aurora: {
    '--bg': '#edf3ff',
    '--bg-radial': 'radial-gradient(circle at top left, rgba(148, 119, 255, 0.24), transparent 26%), radial-gradient(circle at top right, rgba(84, 189, 255, 0.18), transparent 28%)',
    '--bg-gradient': 'linear-gradient(180deg, #f4f7ff 0%, #e9f0ff 46%, #edf8ff 100%)',
    '--nav-surface': 'rgba(250, 252, 255, 0.74)',
    '--panel-backdrop-blur': '20px',
    '--text': '#22314a',
    '--muted': '#667796'
  },
  dusk: {
    '--bg': '#ede6df',
    '--bg-radial': 'radial-gradient(circle at top left, rgba(212, 150, 122, 0.28), transparent 30%)',
    '--bg-gradient': 'linear-gradient(180deg, #f4eee8 0%, #e7ddd3 100%)',
    '--nav-surface': 'rgba(250, 243, 236, 0.9)',
    '--panel-backdrop-blur': '14px',
    '--text': '#2f2419',
    '--muted': '#7b695a'
  }
};

const BRAND_THEME_TOKENS = {
  amber: {
    '--brand': '#bf6a2a',
    '--brand-rgb': '191, 106, 42',
    '--brand-deep': '#8a4e1f',
    '--brand-soft': 'rgba(191, 106, 42, 0.14)',
    '--brand-soft-strong': 'rgba(191, 106, 42, 0.22)'
  },
  cinnabar: {
    '--brand': '#b85c43',
    '--brand-rgb': '184, 92, 67',
    '--brand-deep': '#8e3f2b',
    '--brand-soft': 'rgba(184, 92, 67, 0.14)',
    '--brand-soft-strong': 'rgba(184, 92, 67, 0.22)'
  },
  moss: {
    '--brand': '#6e8b58',
    '--brand-rgb': '110, 139, 88',
    '--brand-deep': '#4f6840',
    '--brand-soft': 'rgba(110, 139, 88, 0.16)',
    '--brand-soft-strong': 'rgba(110, 139, 88, 0.24)'
  },
  slate: {
    '--brand': '#5c6473',
    '--brand-rgb': '92, 100, 115',
    '--brand-deep': '#434b59',
    '--brand-soft': 'rgba(92, 100, 115, 0.14)',
    '--brand-soft-strong': 'rgba(92, 100, 115, 0.22)'
  },
  cobalt: {
    '--brand': '#4b72ff',
    '--brand-rgb': '75, 114, 255',
    '--brand-deep': '#3158d4',
    '--brand-soft': 'rgba(75, 114, 255, 0.14)',
    '--brand-soft-strong': 'rgba(75, 114, 255, 0.22)'
  },
  orchid: {
    '--brand': '#8f5cff',
    '--brand-rgb': '143, 92, 255',
    '--brand-deep': '#6d43cf',
    '--brand-soft': 'rgba(143, 92, 255, 0.14)',
    '--brand-soft-strong': 'rgba(143, 92, 255, 0.22)'
  },
  mint: {
    '--brand': '#20b29e',
    '--brand-rgb': '32, 178, 158',
    '--brand-deep': '#148471',
    '--brand-soft': 'rgba(32, 178, 158, 0.14)',
    '--brand-soft-strong': 'rgba(32, 178, 158, 0.22)'
  }
};

const NAV_THEME_TOKENS = {
  warm: {
    '--btn-nav-bg': 'rgba(var(--brand-rgb), 0.1)',
    '--btn-nav-border': 'rgba(var(--brand-rgb), 0.24)',
    '--btn-nav-text': 'var(--brand-deep)',
    '--btn-nav-shadow': 'inset 0 0 0 1px rgba(255, 255, 255, 0.28)',
    '--btn-nav-hover-bg': 'rgba(var(--brand-rgb), 0.16)',
    '--btn-nav-hover-border': 'rgba(var(--brand-rgb), 0.38)',
    '--btn-nav-primary-bg': 'linear-gradient(180deg, color-mix(in srgb, var(--brand) 82%, white), var(--brand))',
    '--btn-nav-primary-text': '#fffaf4',
    '--btn-nav-primary-shadow': '0 10px 22px rgba(var(--brand-rgb), 0.2)',
    '--btn-nav-primary-hover-bg': 'linear-gradient(180deg, color-mix(in srgb, var(--brand) 72%, white), color-mix(in srgb, var(--brand) 92%, black))'
  },
  neutral: {
    '--btn-nav-bg': 'rgba(255, 255, 255, 0.92)',
    '--btn-nav-border': 'rgba(148, 163, 184, 0.24)',
    '--btn-nav-text': '#403a33',
    '--btn-nav-shadow': 'inset 0 0 0 1px rgba(255, 255, 255, 0.22)',
    '--btn-nav-hover-bg': 'rgba(245, 242, 238, 0.96)',
    '--btn-nav-hover-border': 'rgba(110, 101, 92, 0.28)',
    '--btn-nav-primary-bg': 'linear-gradient(180deg, #615b54, #45403a)',
    '--btn-nav-primary-text': '#fffaf4',
    '--btn-nav-primary-shadow': '0 10px 22px rgba(69, 64, 58, 0.16)',
    '--btn-nav-primary-hover-bg': 'linear-gradient(180deg, #6c655d, #4d4841)'
  },
  outline: {
    '--btn-nav-bg': 'transparent',
    '--btn-nav-border': 'rgba(var(--brand-rgb), 0.3)',
    '--btn-nav-text': 'var(--brand-deep)',
    '--btn-nav-shadow': 'none',
    '--btn-nav-hover-bg': 'rgba(var(--brand-rgb), 0.08)',
    '--btn-nav-hover-border': 'rgba(var(--brand-rgb), 0.44)',
    '--btn-nav-primary-bg': 'rgba(var(--brand-rgb), 0.12)',
    '--btn-nav-primary-text': 'var(--brand-deep)',
    '--btn-nav-primary-shadow': 'none',
    '--btn-nav-primary-hover-bg': 'rgba(var(--brand-rgb), 0.18)'
  }
};

const ACTION_THEME_TOKENS = {
  neutral: {
    '--btn-action-bg': 'rgba(255, 255, 255, 0.74)',
    '--btn-action-border': 'rgba(148, 163, 184, 0.24)',
    '--btn-action-text': 'var(--text)',
    '--btn-action-shadow': 'none',
    '--btn-action-solid-bg': 'linear-gradient(180deg, color-mix(in srgb, var(--brand) 18%, white), color-mix(in srgb, var(--brand) 86%, #3b4557))',
    '--btn-action-solid-text': '#f8fbff',
    '--btn-action-solid-border': 'rgba(88, 102, 126, 0.34)',
    '--btn-action-solid-shadow': '0 10px 22px rgba(68, 82, 108, 0.18)'
  },
  warm: {
    '--btn-action-bg': 'rgba(var(--brand-rgb), 0.08)',
    '--btn-action-border': 'rgba(var(--brand-rgb), 0.2)',
    '--btn-action-text': 'var(--brand-deep)',
    '--btn-action-shadow': 'inset 0 0 0 1px rgba(255,255,255,0.22)',
    '--btn-action-solid-bg': 'linear-gradient(180deg, color-mix(in srgb, var(--brand) 78%, white), var(--brand))',
    '--btn-action-solid-text': '#fffaf4',
    '--btn-action-solid-border': 'transparent',
    '--btn-action-solid-shadow': '0 10px 22px rgba(var(--brand-rgb), 0.2)'
  },
  outline: {
    '--btn-action-bg': 'transparent',
    '--btn-action-border': 'var(--line-strong)',
    '--btn-action-text': 'var(--text)',
    '--btn-action-shadow': 'none',
    '--btn-action-solid-bg': 'rgba(var(--brand-rgb), 0.12)',
    '--btn-action-solid-text': 'var(--brand-deep)',
    '--btn-action-solid-border': 'rgba(var(--brand-rgb), 0.3)',
    '--btn-action-solid-shadow': 'none'
  }
};

const PANEL_THEME_TOKENS = {
  paper: { mode: 'paper' },
  frost: { mode: 'frost' },
  frame: { mode: 'frame' },
  graphite: { mode: 'graphite' },
  contrast: { mode: 'contrast' },
  warm: { mode: 'paper' }
};

const PANEL_SURFACE_BASES = {
  paper: {
    panel: 'linear-gradient(180deg, rgba(255, 255, 253, 0.98), rgba(246, 242, 236, 0.94))',
    strong: '#fffefb',
    card: 'linear-gradient(180deg, rgba(255, 255, 252, 0.99), rgba(244, 240, 233, 0.95))',
    note: 'linear-gradient(180deg, rgba(253, 251, 247, 0.98), rgba(245, 239, 231, 0.94))',
    line: 'rgba(123, 108, 87, 0.16)',
    lineStrong: 'rgba(123, 108, 87, 0.24)',
    shadow: '0 18px 40px rgba(104, 87, 67, 0.08)'
  },
  clear: {
    panel: 'linear-gradient(180deg, rgba(251, 253, 255, 0.96), rgba(236, 242, 248, 0.94))',
    strong: '#ffffff',
    card: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(239, 245, 252, 0.94))',
    note: 'linear-gradient(180deg, rgba(251, 254, 255, 0.97), rgba(233, 240, 248, 0.94))',
    line: 'rgba(96, 112, 136, 0.18)',
    lineStrong: 'rgba(96, 112, 136, 0.28)',
    shadow: '0 18px 42px rgba(78, 95, 118, 0.1)'
  },
  aurora: {
    panel: 'linear-gradient(180deg, rgba(252, 252, 255, 0.96), rgba(236, 243, 255, 0.94))',
    strong: '#ffffff',
    card: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(235, 242, 255, 0.94))',
    note: 'linear-gradient(180deg, rgba(252, 252, 255, 0.98), rgba(233, 239, 255, 0.94))',
    line: 'rgba(105, 117, 170, 0.18)',
    lineStrong: 'rgba(105, 117, 170, 0.3)',
    shadow: '0 18px 46px rgba(95, 108, 168, 0.12)'
  },
  graphite: {
    panel: 'linear-gradient(180deg, rgba(19, 24, 33, 0.96), rgba(14, 18, 24, 0.94))',
    strong: '#161b24',
    card: 'linear-gradient(180deg, rgba(24, 31, 42, 0.98), rgba(18, 24, 34, 0.96))',
    note: 'linear-gradient(180deg, rgba(28, 35, 47, 0.98), rgba(20, 26, 36, 0.96))',
    line: 'rgba(233, 239, 255, 0.1)',
    lineStrong: 'rgba(233, 239, 255, 0.18)',
    shadow: '0 22px 54px rgba(0, 0, 0, 0.38)'
  },
  warm: {
    panel: 'linear-gradient(180deg, rgba(255, 252, 247, 0.96), rgba(248, 237, 221, 0.92))',
    strong: '#fff8ef',
    card: 'linear-gradient(180deg, rgba(255, 250, 242, 0.98), rgba(247, 236, 220, 0.92))',
    note: 'linear-gradient(180deg, rgba(255, 247, 236, 0.98), rgba(250, 233, 210, 0.9))',
    line: 'rgba(113, 74, 33, 0.16)',
    lineStrong: 'rgba(113, 74, 33, 0.28)',
    shadow: '0 20px 50px rgba(80, 50, 20, 0.12)'
  },
  dusk: {
    panel: 'linear-gradient(180deg, rgba(250, 244, 239, 0.96), rgba(236, 225, 216, 0.94))',
    strong: '#fff7f2',
    card: 'linear-gradient(180deg, rgba(255, 248, 242, 0.98), rgba(238, 226, 217, 0.94))',
    note: 'linear-gradient(180deg, rgba(253, 244, 239, 0.98), rgba(239, 225, 214, 0.94))',
    line: 'rgba(123, 91, 67, 0.18)',
    lineStrong: 'rgba(123, 91, 67, 0.28)',
    shadow: '0 18px 42px rgba(93, 63, 44, 0.12)'
  }
};

const RADIUS_THEME_TOKENS = {
  soft: {
    '--radius-panel-xl': '32px',
    '--radius-panel-lg': '26px',
    '--radius-panel-md': '20px',
    '--radius-panel-sm': '16px',
    '--radius-panel-xs': '14px',
    '--radius-button': '999px',
    '--radius-control': '16px'
  },
  balanced: {
    '--radius-panel-xl': '28px',
    '--radius-panel-lg': '22px',
    '--radius-panel-md': '18px',
    '--radius-panel-sm': '14px',
    '--radius-panel-xs': '12px',
    '--radius-button': '999px',
    '--radius-control': '14px'
  },
  crisp: {
    '--radius-panel-xl': '22px',
    '--radius-panel-lg': '18px',
    '--radius-panel-md': '14px',
    '--radius-panel-sm': '12px',
    '--radius-panel-xs': '10px',
    '--radius-button': '12px',
    '--radius-control': '12px'
  }
};

const DENSITY_THEME_TOKENS = {
  relaxed: {
    '--page-shell-pad-top': '48px',
    '--page-shell-pad-bottom': '62px',
    '--section-gap': '20px',
    '--card-gap': '18px',
    '--control-gap': '12px',
    '--panel-padding': '24px',
    '--panel-padding-lg': '28px',
    '--button-height': '46px',
    '--button-padding-x': '18px'
  },
  balanced: {
    '--page-shell-pad-top': '40px',
    '--page-shell-pad-bottom': '56px',
    '--section-gap': '16px',
    '--card-gap': '14px',
    '--control-gap': '10px',
    '--panel-padding': '22px',
    '--panel-padding-lg': '26px',
    '--button-height': '42px',
    '--button-padding-x': '16px'
  },
  compact: {
    '--page-shell-pad-top': '32px',
    '--page-shell-pad-bottom': '42px',
    '--section-gap': '12px',
    '--card-gap': '10px',
    '--control-gap': '8px',
    '--panel-padding': '18px',
    '--panel-padding-lg': '20px',
    '--button-height': '38px',
    '--button-padding-x': '14px'
  }
};

const TITLE_THEME_TOKENS = {
  grand: {
    '--font-size-hero': 'clamp(34px, 4.4vw, 52px)',
    '--font-size-display': 'clamp(36px, 3.8vw, 50px)',
    '--font-size-card-title': '36px',
    '--font-size-section-title': '30px',
    '--font-size-panel-title': '18px',
    '--font-size-metric': 'clamp(32px, 3.4vw, 46px)'
  },
  balanced: {
    '--font-size-hero': 'clamp(30px, 4vw, 46px)',
    '--font-size-display': 'clamp(34px, 3.4vw, 46px)',
    '--font-size-card-title': '34px',
    '--font-size-section-title': '28px',
    '--font-size-panel-title': '16px',
    '--font-size-metric': 'clamp(30px, 3.2vw, 42px)'
  },
  compact: {
    '--font-size-hero': 'clamp(28px, 3.4vw, 40px)',
    '--font-size-display': 'clamp(30px, 3vw, 40px)',
    '--font-size-card-title': '28px',
    '--font-size-section-title': '24px',
    '--font-size-panel-title': '15px',
    '--font-size-metric': 'clamp(26px, 2.8vw, 34px)'
  }
};

const STATUS_THEME_TOKENS = {
  soft: {
    '--badge-bg': 'rgba(var(--brand-rgb), 0.08)',
    '--badge-border': 'rgba(var(--brand-rgb), 0.14)',
    '--badge-text': 'var(--brand-deep)',
    '--status-warning-bg': 'rgba(255, 247, 230, 0.78)',
    '--status-warning-border': 'rgba(214, 141, 33, 0.22)',
    '--status-success-bg': 'rgba(240, 250, 241, 0.78)',
    '--status-success-border': 'rgba(77, 143, 88, 0.18)',
    '--status-error-bg': 'rgba(255, 238, 238, 0.76)',
    '--status-error-border': 'rgba(185, 52, 52, 0.18)'
  },
  balanced: {
    '--badge-bg': 'rgba(var(--brand-rgb), 0.12)',
    '--badge-border': 'rgba(var(--brand-rgb), 0.2)',
    '--badge-text': 'var(--brand-deep)',
    '--status-warning-bg': 'rgba(255, 247, 230, 0.9)',
    '--status-warning-border': 'rgba(214, 141, 33, 0.28)',
    '--status-success-bg': 'rgba(240, 250, 241, 0.9)',
    '--status-success-border': 'rgba(77, 143, 88, 0.22)',
    '--status-error-bg': 'rgba(255, 238, 238, 0.9)',
    '--status-error-border': 'rgba(185, 52, 52, 0.22)'
  },
  strong: {
    '--badge-bg': 'rgba(var(--brand-rgb), 0.18)',
    '--badge-border': 'rgba(var(--brand-rgb), 0.34)',
    '--badge-text': 'var(--brand-deep)',
    '--status-warning-bg': 'rgba(255, 240, 209, 0.96)',
    '--status-warning-border': 'rgba(214, 141, 33, 0.42)',
    '--status-success-bg': 'rgba(232, 247, 234, 0.96)',
    '--status-success-border': 'rgba(77, 143, 88, 0.34)',
    '--status-error-bg': 'rgba(255, 229, 229, 0.96)',
    '--status-error-border': 'rgba(185, 52, 52, 0.34)'
  }
};

function resolveThemeValue(theme, field, tokenMap) {
  const value = theme?.[field];
  return tokenMap[value] ? value : DEFAULT_STYLE_THEME[field];
}

function clampThemeNumber(value, fallback, min, max, step = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const clamped = Math.min(max, Math.max(min, numeric));
  return Math.round(clamped / step) * step;
}

function scalePx(value, factor) {
  const matched = /^(-?\d+(?:\.\d+)?)px$/.exec(String(value || '').trim());
  if (!matched) return value;
  return `${Math.round(Number(matched[1]) * factor)}px`;
}

function rgba(rgb, alpha) {
  const safeAlpha = Math.max(0, Math.min(1, Number(alpha) || 0));
  return `rgba(${rgb}, ${safeAlpha.toFixed(3)})`;
}

function buildBackgroundTokens(pageTheme, glowScale) {
  const glow = Math.max(0.68, Math.min(1.38, glowScale));
  if (pageTheme === 'paper') {
    return {
      '--bg-radial': `radial-gradient(circle at top left, ${rgba('221, 204, 177', 0.28 * glow)}, transparent 30%)`
    };
  }
  if (pageTheme === 'clear') {
    return {
      '--bg-radial': `radial-gradient(circle at top left, ${rgba('189, 208, 227', 0.34 * glow)}, transparent 30%)`
    };
  }
  if (pageTheme === 'graphite') {
    return {
      '--bg-radial': `radial-gradient(circle at top left, ${rgba('85, 112, 178', 0.34 * glow)}, transparent 28%)`
    };
  }
  if (pageTheme === 'aurora') {
    return {
      '--bg-radial': `radial-gradient(circle at top left, ${rgba('148, 119, 255', 0.24 * glow)}, transparent 26%), radial-gradient(circle at top right, ${rgba('84, 189, 255', 0.18 * glow)}, transparent 28%)`
    };
  }
  if (pageTheme === 'dusk') {
    return {
      '--bg-radial': `radial-gradient(circle at top left, ${rgba('212, 150, 122', 0.28 * glow)}, transparent 30%)`
    };
  }
  return {
    '--bg-radial': `radial-gradient(circle at top left, ${rgba('255, 214, 170', 0.55 * glow)}, transparent 28%)`
  };
}

function buildPanelTokens(theme) {
  const base = PANEL_SURFACE_BASES[theme.pageTheme] || PANEL_SURFACE_BASES.clear;
  const isDarkPage = theme.pageTheme === 'graphite';
  const baseVars = {
    '--panel': base.panel,
    '--panel-strong': base.strong,
    '--panel-card-bg': base.card,
    '--panel-note-bg': base.note,
    '--line': base.line,
    '--line-strong': base.lineStrong,
    '--shadow': base.shadow
  };

  if (theme.panelTheme === 'paper') {
    return baseVars;
  }

  if (theme.panelTheme === 'frost') {
    return isDarkPage
      ? {
          '--panel': 'linear-gradient(180deg, rgba(23, 29, 40, 0.88), rgba(15, 20, 28, 0.78))',
          '--panel-strong': '#18202b',
          '--panel-card-bg': 'linear-gradient(180deg, rgba(30, 38, 52, 0.9), rgba(20, 28, 40, 0.8))',
          '--panel-note-bg': 'linear-gradient(180deg, rgba(32, 41, 56, 0.9), rgba(22, 30, 43, 0.8))',
          '--line': 'rgba(233, 239, 255, 0.12)',
          '--line-strong': 'rgba(233, 239, 255, 0.22)',
          '--shadow': '0 20px 48px rgba(0, 0, 0, 0.3)'
        }
      : {
          '--panel': 'linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(241, 245, 250, 0.74))',
          '--panel-strong': '#ffffff',
          '--panel-card-bg': 'linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(239, 244, 250, 0.8))',
          '--panel-note-bg': 'linear-gradient(180deg, rgba(252, 254, 255, 0.92), rgba(236, 242, 249, 0.8))',
          '--line': base.line,
          '--line-strong': base.lineStrong,
          '--shadow': '0 18px 42px rgba(78, 95, 118, 0.14)'
        };
  }

  if (theme.panelTheme === 'frame') {
    return {
      '--panel': base.panel,
      '--panel-strong': base.strong,
      '--panel-card-bg': isDarkPage ? 'rgba(19, 24, 33, 0.98)' : 'rgba(255, 255, 255, 0.98)',
      '--panel-note-bg': isDarkPage ? 'rgba(23, 29, 40, 0.98)' : 'rgba(251, 253, 255, 0.98)',
      '--line': isDarkPage ? 'rgba(233, 239, 255, 0.16)' : 'rgba(96, 112, 136, 0.22)',
      '--line-strong': isDarkPage ? 'rgba(233, 239, 255, 0.28)' : 'rgba(96, 112, 136, 0.38)',
      '--shadow': isDarkPage ? '0 10px 24px rgba(0, 0, 0, 0.24)' : '0 10px 24px rgba(78, 95, 118, 0.08)'
    };
  }

  if (theme.panelTheme === 'contrast') {
    return isDarkPage
      ? {
          '--panel': 'linear-gradient(180deg, rgba(20, 26, 36, 0.98), rgba(14, 18, 24, 0.96))',
          '--panel-strong': '#171d28',
          '--panel-card-bg': 'linear-gradient(180deg, rgba(31, 39, 53, 0.99), rgba(21, 29, 41, 0.97))',
          '--panel-note-bg': 'linear-gradient(180deg, rgba(35, 43, 58, 0.99), rgba(23, 30, 43, 0.97))',
          '--line': 'rgba(233, 239, 255, 0.16)',
          '--line-strong': 'rgba(233, 239, 255, 0.28)',
          '--shadow': '0 24px 56px rgba(0, 0, 0, 0.42)'
        }
      : {
          '--panel': 'linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(239, 244, 250, 0.96))',
          '--panel-strong': '#ffffff',
          '--panel-card-bg': 'linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(233, 240, 248, 0.96))',
          '--panel-note-bg': 'linear-gradient(180deg, rgba(252, 254, 255, 0.99), rgba(229, 237, 247, 0.94))',
          '--line': 'rgba(41, 56, 78, 0.22)',
          '--line-strong': 'rgba(41, 56, 78, 0.38)',
          '--shadow': '0 24px 56px rgba(32, 44, 63, 0.16)'
        };
  }

  if (theme.panelTheme === 'graphite') {
    return isDarkPage
      ? baseVars
      : {
          '--panel': 'linear-gradient(180deg, rgba(245, 248, 252, 0.98), rgba(229, 236, 245, 0.96))',
          '--panel-strong': '#f5f8fd',
          '--panel-card-bg': 'linear-gradient(180deg, rgba(250, 252, 255, 0.99), rgba(226, 234, 244, 0.96))',
          '--panel-note-bg': 'linear-gradient(180deg, rgba(246, 250, 255, 0.99), rgba(223, 232, 243, 0.96))',
          '--line': 'rgba(63, 79, 104, 0.18)',
          '--line-strong': 'rgba(63, 79, 104, 0.32)',
          '--shadow': '0 18px 44px rgba(56, 70, 90, 0.14)'
        };
  }

  return baseVars;
}

function buildFineTuneTokens(theme) {
  const brandRgb = BRAND_THEME_TOKENS[theme.brandTheme]['--brand-rgb'];
  const densityTokens = DENSITY_THEME_TOKENS[theme.densityTheme];
  const colorScale = Math.max(0.7, Math.min(1.4, theme.colorStrength / 100));
  const glowScale = Math.max(0.68, Math.min(1.38, theme.backgroundGlow / 100));
  const spacingFactor = Math.max(0.85, Math.min(1.2, theme.spacingScale / 100));
  const controlFactor = Math.max(0.9, Math.min(1.2, theme.controlScale / 100));
  const statusBase =
    theme.statusTheme === 'soft'
      ? { badgeBg: 0.08, badgeBorder: 0.14 }
      : theme.statusTheme === 'strong'
        ? { badgeBg: 0.18, badgeBorder: 0.34 }
        : { badgeBg: 0.12, badgeBorder: 0.2 };

  const nextTokens = {
    ...buildBackgroundTokens(theme.pageTheme, glowScale),
    '--brand-soft': rgba(brandRgb, 0.14 * colorScale),
    '--brand-soft-strong': rgba(brandRgb, 0.22 * colorScale),
    '--badge-bg': rgba(brandRgb, statusBase.badgeBg * colorScale),
    '--badge-border': rgba(brandRgb, statusBase.badgeBorder * colorScale),
    '--page-shell-pad-top': scalePx(densityTokens['--page-shell-pad-top'], spacingFactor),
    '--page-shell-pad-bottom': scalePx(densityTokens['--page-shell-pad-bottom'], spacingFactor),
    '--section-gap': scalePx(densityTokens['--section-gap'], spacingFactor),
    '--card-gap': scalePx(densityTokens['--card-gap'], spacingFactor),
    '--control-gap': scalePx(densityTokens['--control-gap'], spacingFactor),
    '--panel-padding': scalePx(densityTokens['--panel-padding'], spacingFactor),
    '--panel-padding-lg': scalePx(densityTokens['--panel-padding-lg'], spacingFactor),
    '--button-height': scalePx(densityTokens['--button-height'], controlFactor),
    '--button-padding-x': scalePx(densityTokens['--button-padding-x'], controlFactor)
  };

  if (theme.navTheme === 'warm') {
    nextTokens['--btn-nav-bg'] = rgba(brandRgb, 0.1 * colorScale);
    nextTokens['--btn-nav-border'] = rgba(brandRgb, 0.24 * colorScale);
    nextTokens['--btn-nav-hover-bg'] = rgba(brandRgb, 0.16 * colorScale);
    nextTokens['--btn-nav-hover-border'] = rgba(brandRgb, 0.38 * colorScale);
    nextTokens['--btn-nav-primary-shadow'] = `0 10px 22px ${rgba(brandRgb, 0.2 * colorScale)}`;
  }

  if (theme.navTheme === 'outline') {
    nextTokens['--btn-nav-border'] = rgba(brandRgb, 0.3 * colorScale);
    nextTokens['--btn-nav-hover-bg'] = rgba(brandRgb, 0.08 * colorScale);
    nextTokens['--btn-nav-hover-border'] = rgba(brandRgb, 0.44 * colorScale);
    nextTokens['--btn-nav-primary-bg'] = rgba(brandRgb, 0.12 * colorScale);
    nextTokens['--btn-nav-primary-hover-bg'] = rgba(brandRgb, 0.18 * colorScale);
  }

  if (theme.actionTheme === 'warm') {
    nextTokens['--btn-action-bg'] = rgba(brandRgb, 0.08 * colorScale);
    nextTokens['--btn-action-border'] = rgba(brandRgb, 0.2 * colorScale);
    nextTokens['--btn-action-solid-shadow'] = `0 10px 22px ${rgba(brandRgb, 0.2 * colorScale)}`;
  }

  if (theme.actionTheme === 'outline') {
    nextTokens['--btn-action-solid-bg'] = rgba(brandRgb, 0.12 * colorScale);
    nextTokens['--btn-action-solid-border'] = rgba(brandRgb, 0.3 * colorScale);
  }

  return nextTokens;
}

function resolveStyleTheme(theme) {
  return {
    pageTheme: resolveThemeValue(theme, 'pageTheme', PAGE_THEME_TOKENS),
    brandTheme: resolveThemeValue(theme, 'brandTheme', BRAND_THEME_TOKENS),
    navTheme: resolveThemeValue(theme, 'navTheme', NAV_THEME_TOKENS),
    actionTheme: resolveThemeValue(theme, 'actionTheme', ACTION_THEME_TOKENS),
    panelTheme: resolveThemeValue(theme, 'panelTheme', PANEL_THEME_TOKENS),
    radiusTheme: resolveThemeValue(theme, 'radiusTheme', RADIUS_THEME_TOKENS),
    densityTheme: resolveThemeValue(theme, 'densityTheme', DENSITY_THEME_TOKENS),
    titleTheme: resolveThemeValue(theme, 'titleTheme', TITLE_THEME_TOKENS),
    statusTheme: resolveThemeValue(theme, 'statusTheme', STATUS_THEME_TOKENS),
    colorStrength: clampThemeNumber(theme?.colorStrength, DEFAULT_STYLE_THEME.colorStrength, 70, 140, 5),
    backgroundGlow: clampThemeNumber(theme?.backgroundGlow, DEFAULT_STYLE_THEME.backgroundGlow, 70, 140, 5),
    spacingScale: clampThemeNumber(theme?.spacingScale, DEFAULT_STYLE_THEME.spacingScale, 85, 120, 5),
    controlScale: clampThemeNumber(theme?.controlScale, DEFAULT_STYLE_THEME.controlScale, 90, 120, 5)
  };
}

function resolveThemeRecord(record) {
  return {
    id: String(record?.id || '').trim(),
    label: String(record?.label || '').trim() || '未命名主题',
    summary: String(record?.summary || '').trim(),
    theme: resolveStyleTheme(record?.theme),
    builtIn: Boolean(record?.builtIn)
  };
}

function getBuiltInThemeLibrary() {
  return STYLE_THEME_PRESETS.map(createBuiltInThemeRecord);
}

function getStoredCustomThemeLibrary() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((record) => resolveThemeRecord({ ...record, builtIn: false }))
      .filter((record) => record.id);
  } catch {
    return [];
  }
}

function saveCustomThemeLibrary(records) {
  if (typeof window === 'undefined') return;
  const safeRecords = Array.isArray(records)
    ? records
      .map((record) => resolveThemeRecord({ ...record, builtIn: false }))
      .filter((record) => record.id)
    : [];
  window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(safeRecords));
}

export function getStyleThemeLibrary() {
  return [...getBuiltInThemeLibrary(), ...getStoredCustomThemeLibrary()];
}

export function getStoredActiveStyleThemeId() {
  if (typeof window === 'undefined') return STYLE_THEME_PRESETS[0]?.id || 'default';
  const activeId = String(window.localStorage.getItem(ACTIVE_THEME_ID_STORAGE_KEY) || '').trim();
  const library = getStyleThemeLibrary();
  if (activeId && library.some((record) => record.id === activeId)) return activeId;
  return library[0]?.id || STYLE_THEME_PRESETS[0]?.id || 'default';
}

export function saveStoredActiveStyleThemeId(themeId) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACTIVE_THEME_ID_STORAGE_KEY, String(themeId || '').trim());
}

export function saveCustomStyleTheme(record) {
  const safeRecord = resolveThemeRecord({ ...record, builtIn: false });
  const library = getStoredCustomThemeLibrary();
  const nextLibrary = library.some((item) => item.id === safeRecord.id)
    ? library.map((item) => (item.id === safeRecord.id ? safeRecord : item))
    : [...library, safeRecord];
  saveCustomThemeLibrary(nextLibrary);
  return safeRecord;
}

export function deleteCustomStyleTheme(themeId) {
  const nextLibrary = getStoredCustomThemeLibrary().filter((record) => record.id !== themeId);
  saveCustomThemeLibrary(nextLibrary);
}

export function getStoredStyleTheme() {
  if (typeof window === 'undefined') return DEFAULT_STYLE_THEME;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return resolveStyleTheme(JSON.parse(raw));
    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) return resolveStyleTheme(JSON.parse(legacyRaw));
    return DEFAULT_STYLE_THEME;
  } catch {
    return DEFAULT_STYLE_THEME;
  }
}

export function saveStyleTheme(theme) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resolveStyleTheme(theme)));
}

export function applyStyleTheme(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const safeTheme = resolveStyleTheme(theme);
  const merged = {
    ...PAGE_THEME_TOKENS[safeTheme.pageTheme],
    ...BRAND_THEME_TOKENS[safeTheme.brandTheme],
    ...NAV_THEME_TOKENS[safeTheme.navTheme],
    ...ACTION_THEME_TOKENS[safeTheme.actionTheme],
    ...buildPanelTokens(safeTheme),
    ...RADIUS_THEME_TOKENS[safeTheme.radiusTheme],
    ...DENSITY_THEME_TOKENS[safeTheme.densityTheme],
    ...TITLE_THEME_TOKENS[safeTheme.titleTheme],
    ...STATUS_THEME_TOKENS[safeTheme.statusTheme],
    ...buildFineTuneTokens(safeTheme)
  };
  Object.entries(merged).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  root.dataset.pageTheme = safeTheme.pageTheme;
  root.dataset.brandTheme = safeTheme.brandTheme;
  root.dataset.navTheme = safeTheme.navTheme;
  root.dataset.actionTheme = safeTheme.actionTheme;
  root.dataset.panelTheme = safeTheme.panelTheme;
  root.dataset.radiusTheme = safeTheme.radiusTheme;
  root.dataset.densityTheme = safeTheme.densityTheme;
  root.dataset.titleTheme = safeTheme.titleTheme;
  root.dataset.statusTheme = safeTheme.statusTheme;
}

export function resetStyleTheme() {
  saveStyleTheme(DEFAULT_STYLE_THEME);
  applyStyleTheme(DEFAULT_STYLE_THEME);
}

export function exportStyleTheme(theme) {
  return JSON.stringify(resolveStyleTheme(theme), null, 2);
}
