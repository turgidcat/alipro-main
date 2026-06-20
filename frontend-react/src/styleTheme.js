const STORAGE_KEY = 'alipro-style-theme-v3';
const LEGACY_STORAGE_KEYS = ['alipro-style-theme-v2', 'alipro-style-theme-v1'];
const ACTIVE_THEME_ID_STORAGE_KEY = 'alipro-style-theme-active-id-v2';

export const STYLE_ATMOSPHERE_OPTIONS = [
  {
    value: 'paper',
    label: '中性浅色·暖白',
    shortLabel: '暖白',
    description: '大众化暖白文档感，适合长时间阅读和写作。'
  },
  {
    value: 'cool',
    label: '中性浅色·冷白',
    shortLabel: '冷白',
    description: '大众化冷白工具感，适合规划、编辑和资料整理。'
  },
  {
    value: 'deep',
    label: '常规产品·深灰',
    shortLabel: '深灰',
    description: '接近常见产品后台的深色版本，稳重、不跳。'
  },
  {
    value: 'signal',
    label: '常规产品·灰蓝',
    shortLabel: '灰蓝',
    description: '比纯中性多一点产品层次，但不过度发亮或发紫。'
  }
];

export const STYLE_TONE_OPTIONS = [
  {
    value: 'light',
    label: '浅',
    description: '留白更足，适合白天和资料整理。'
  },
  {
    value: 'dark',
    label: '深',
    description: '对比更稳，适合夜间和长时间写作。'
  }
];

export const DEFAULT_STYLE_THEME = {
  atmosphere: 'paper',
  tone: 'light'
};

export const STYLE_THEME_PRESETS = STYLE_ATMOSPHERE_OPTIONS.map((option) => ({
  id: option.value,
  label: option.label,
  shortLabel: option.shortLabel,
  summary: option.description,
  theme: { atmosphere: option.value, tone: 'light' }
}));

const THEME_RECIPES = {
  paper: {
    light: {
      pageTheme: 'paper',
      brandTheme: 'amber',
      navTheme: 'neutral',
      actionTheme: 'neutral',
      panelTheme: 'paper',
      radiusTheme: 'crisp',
      densityTheme: 'balanced',
      titleTheme: 'balanced',
      statusTheme: 'soft',
      colorStrength: 84,
      backgroundGlow: 74,
      spacingScale: 100,
      controlScale: 96
    },
    dark: {
      pageTheme: 'graphite',
      brandTheme: 'amber',
      navTheme: 'neutral',
      actionTheme: 'neutral',
      panelTheme: 'frost',
      radiusTheme: 'crisp',
      densityTheme: 'balanced',
      titleTheme: 'balanced',
      statusTheme: 'soft',
      colorStrength: 86,
      backgroundGlow: 70,
      spacingScale: 100,
      controlScale: 96
    }
  },
  cool: {
    light: {
      pageTheme: 'clear',
      brandTheme: 'slate',
      navTheme: 'neutral',
      actionTheme: 'neutral',
      panelTheme: 'paper',
      radiusTheme: 'crisp',
      densityTheme: 'compact',
      titleTheme: 'compact',
      statusTheme: 'soft',
      colorStrength: 84,
      backgroundGlow: 70,
      spacingScale: 95,
      controlScale: 95
    },
    dark: {
      pageTheme: 'graphite',
      brandTheme: 'slate',
      navTheme: 'neutral',
      actionTheme: 'neutral',
      panelTheme: 'frost',
      radiusTheme: 'crisp',
      densityTheme: 'compact',
      titleTheme: 'compact',
      statusTheme: 'soft',
      colorStrength: 84,
      backgroundGlow: 68,
      spacingScale: 95,
      controlScale: 95
    }
  },
  deep: {
    light: {
      pageTheme: 'clear',
      brandTheme: 'slate',
      navTheme: 'outline',
      actionTheme: 'neutral',
      panelTheme: 'frost',
      radiusTheme: 'crisp',
      densityTheme: 'compact',
      titleTheme: 'balanced',
      statusTheme: 'soft',
      colorStrength: 86,
      backgroundGlow: 72,
      spacingScale: 95,
      controlScale: 95
    },
    dark: {
      pageTheme: 'graphite',
      brandTheme: 'slate',
      navTheme: 'outline',
      actionTheme: 'neutral',
      panelTheme: 'frost',
      radiusTheme: 'crisp',
      densityTheme: 'compact',
      titleTheme: 'balanced',
      statusTheme: 'soft',
      colorStrength: 86,
      backgroundGlow: 70,
      spacingScale: 95,
      controlScale: 95
    }
  },
  signal: {
    light: {
      pageTheme: 'clear',
      brandTheme: 'cobalt',
      navTheme: 'neutral',
      actionTheme: 'neutral',
      panelTheme: 'frost',
      radiusTheme: 'crisp',
      densityTheme: 'balanced',
      titleTheme: 'compact',
      statusTheme: 'balanced',
      colorStrength: 90,
      backgroundGlow: 74,
      spacingScale: 98,
      controlScale: 96
    },
    dark: {
      pageTheme: 'graphite',
      brandTheme: 'cobalt',
      navTheme: 'neutral',
      actionTheme: 'neutral',
      panelTheme: 'frost',
      radiusTheme: 'crisp',
      densityTheme: 'balanced',
      titleTheme: 'compact',
      statusTheme: 'balanced',
      colorStrength: 90,
      backgroundGlow: 70,
      spacingScale: 98,
      controlScale: 96
    }
  }
};

const PAGE_THEME_TOKENS = {
  paper: {
    '--bg': '#fbf8f1',
    '--bg-radial': 'radial-gradient(circle at 18% 20%, rgba(224, 120, 86, 0.09), transparent 28%), radial-gradient(circle at 82% 72%, rgba(122, 158, 126, 0.08), transparent 32%)',
    '--bg-gradient': 'linear-gradient(180deg, #fbf8f1 0%, #f4eee2 100%)',
    '--nav-surface': 'rgba(251, 248, 241, 0.86)',
    '--panel-backdrop-blur': '14px',
    '--text': '#3d3530',
    '--muted': '#6b6157'
  },
  clear: {
    '--bg': '#f8f6f0',
    '--bg-radial': 'radial-gradient(circle at 14% 18%, rgba(224, 120, 86, 0.07), transparent 26%), radial-gradient(circle at 84% 24%, rgba(122, 158, 126, 0.06), transparent 28%)',
    '--bg-gradient': 'linear-gradient(180deg, #fbfaf6 0%, #f1ede5 100%)',
    '--nav-surface': 'rgba(252, 249, 243, 0.84)',
    '--panel-backdrop-blur': '14px',
    '--text': '#39414a',
    '--muted': '#68707a'
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
    '--bg': '#faf6fb',
    '--bg-radial': 'radial-gradient(circle at top left, rgba(193, 151, 235, 0.14), transparent 26%), radial-gradient(circle at top right, rgba(224, 120, 86, 0.08), transparent 28%)',
    '--bg-gradient': 'linear-gradient(180deg, #fcf9fc 0%, #f5eef5 52%, #f4eef2 100%)',
    '--nav-surface': 'rgba(252, 249, 252, 0.82)',
    '--panel-backdrop-blur': '14px',
    '--text': '#41384a',
    '--muted': '#746a82'
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

const PANEL_SURFACE_BASES = {
  paper: {
    panel: 'linear-gradient(180deg, rgba(255, 253, 248, 0.96), rgba(246, 241, 233, 0.92))',
    strong: '#fffdf8',
    card: 'linear-gradient(180deg, rgba(255, 253, 248, 0.98), rgba(247, 242, 234, 0.94))',
    note: 'linear-gradient(180deg, rgba(248, 242, 232, 0.94), rgba(243, 236, 226, 0.9))',
    line: 'rgba(61, 53, 48, 0.12)',
    lineStrong: 'rgba(61, 53, 48, 0.22)',
    shadow: '0 8px 24px -8px rgba(61, 53, 48, 0.12), 0 2px 6px rgba(61, 53, 48, 0.07)'
  },
  clear: {
    panel: 'linear-gradient(180deg, rgba(255, 253, 249, 0.95), rgba(245, 241, 235, 0.92))',
    strong: '#fffdfa',
    card: 'linear-gradient(180deg, rgba(255, 255, 252, 0.98), rgba(245, 241, 235, 0.94))',
    note: 'linear-gradient(180deg, rgba(250, 247, 241, 0.96), rgba(242, 237, 230, 0.92))',
    line: 'rgba(74, 79, 88, 0.12)',
    lineStrong: 'rgba(74, 79, 88, 0.22)',
    shadow: '0 8px 24px -8px rgba(61, 53, 48, 0.1), 0 2px 6px rgba(61, 53, 48, 0.06)'
  },
  aurora: {
    panel: 'linear-gradient(180deg, rgba(255, 252, 250, 0.96), rgba(247, 240, 247, 0.92))',
    strong: '#fffdfa',
    card: 'linear-gradient(180deg, rgba(255, 255, 252, 0.98), rgba(246, 239, 247, 0.94))',
    note: 'linear-gradient(180deg, rgba(252, 248, 252, 0.98), rgba(244, 237, 247, 0.94))',
    line: 'rgba(115, 101, 132, 0.16)',
    lineStrong: 'rgba(115, 101, 132, 0.24)',
    shadow: '0 8px 24px -8px rgba(84, 72, 101, 0.12), 0 2px 6px rgba(84, 72, 101, 0.06)'
  },
  graphite: {
    panel: 'linear-gradient(180deg, rgba(19, 24, 33, 0.96), rgba(14, 18, 24, 0.94))',
    strong: '#161b24',
    card: 'linear-gradient(180deg, rgba(24, 31, 42, 0.98), rgba(18, 24, 34, 0.96))',
    note: 'linear-gradient(180deg, rgba(28, 35, 47, 0.98), rgba(20, 26, 36, 0.96))',
    line: 'rgba(233, 239, 255, 0.1)',
    lineStrong: 'rgba(233, 239, 255, 0.18)',
    shadow: '0 22px 54px rgba(0, 0, 0, 0.38)'
  }
};

const RADIUS_THEME_TOKENS = {
  balanced: {
    '--radius-panel-xl': '18px',
    '--radius-panel-lg': '14px',
    '--radius-panel-md': '10px',
    '--radius-panel-sm': '8px',
    '--radius-panel-xs': '8px',
    '--radius-button': '12px',
    '--radius-control': '10px'
  },
  crisp: {
    '--radius-panel-xl': '18px',
    '--radius-panel-lg': '14px',
    '--radius-panel-md': '10px',
    '--radius-panel-sm': '8px',
    '--radius-panel-xs': '8px',
    '--radius-button': '12px',
    '--radius-control': '10px'
  }
};

const DENSITY_THEME_TOKENS = {
  balanced: {
    '--page-shell-pad-top': '40px',
    '--page-shell-pad-bottom': '56px',
    '--section-gap': '16px',
    '--card-gap': '14px',
    '--control-gap': '10px',
    '--panel-padding': '22px',
    '--panel-padding-lg': '26px',
    '--button-height': '40px',
    '--button-padding-x': '16px'
  },
  compact: {
    '--page-shell-pad-top': '32px',
    '--page-shell-pad-bottom': '44px',
    '--section-gap': '12px',
    '--card-gap': '10px',
    '--control-gap': '8px',
    '--panel-padding': '18px',
    '--panel-padding-lg': '20px',
    '--button-height': '36px',
    '--button-padding-x': '14px'
  }
};

const TITLE_THEME_TOKENS = {
  grand: {
    '--font-size-hero': 'clamp(30px, 4vw, 48px)',
    '--font-size-display': 'clamp(32px, 3.4vw, 44px)',
    '--font-size-card-title': '32px',
    '--font-size-section-title': '28px',
    '--font-size-panel-title': '16px',
    '--font-size-metric': 'clamp(30px, 3vw, 40px)'
  },
  balanced: {
    '--font-size-hero': 'clamp(28px, 3.8vw, 42px)',
    '--font-size-display': 'clamp(30px, 3.2vw, 40px)',
    '--font-size-card-title': '30px',
    '--font-size-section-title': '24px',
    '--font-size-panel-title': '15px',
    '--font-size-metric': 'clamp(28px, 2.8vw, 36px)'
  },
  compact: {
    '--font-size-hero': 'clamp(26px, 3.4vw, 38px)',
    '--font-size-display': 'clamp(28px, 3vw, 36px)',
    '--font-size-card-title': '28px',
    '--font-size-section-title': '22px',
    '--font-size-panel-title': '15px',
    '--font-size-metric': 'clamp(24px, 2.4vw, 32px)'
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
    '--status-error-border': 'rgba(185, 52, 52, 0.18)',
    '--status-error-text': '#8d3035'
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
    '--status-error-border': 'rgba(185, 52, 52, 0.22)',
    '--status-error-text': '#8d3035'
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
    '--status-error-border': 'rgba(185, 52, 52, 0.34)',
    '--status-error-text': '#7c232a'
  }
};

const DARK_BRAND_DEEP_TOKENS = {
  amber: '#ffd5ae',
  slate: '#dbe4f0',
  cobalt: '#c8d6ff',
  orchid: '#e2d3ff'
};

const SEMANTIC_THEME_TOKENS = {
  light: {
    '--background': '#fafaf9',
    '--foreground': '#292524',
    '--primary': '#ea580c',
    '--primary-foreground': '#fff7ed',
    '--border': '#d6d3d1',
    '--muted-bg': '#f5f5f4',
    '--muted-foreground': '#78716c',
    '--accent': '#ffedd5',
    '--surface': '#fdfcf9'
  },
  dark: {
    '--background': '#1c1917',
    '--foreground': '#f5f5f4',
    '--primary': '#f97316',
    '--primary-foreground': '#431407',
    '--border': '#44403c',
    '--muted-bg': '#292524',
    '--muted-foreground': '#a8a29e',
    '--accent': '#7c2d12',
    '--surface': '#221f1c'
  }
};

function rgba(rgb, alpha) {
  const safeAlpha = Math.max(0, Math.min(1, Number(alpha) || 0));
  return `rgba(${rgb}, ${safeAlpha.toFixed(3)})`;
}

function scalePx(value, factor) {
  const matched = /^(-?\d+(?:\.\d+)?)px$/.exec(String(value || '').trim());
  if (!matched) return value;
  return `${Math.round(Number(matched[1]) * factor)}px`;
}

function normalizeAtmosphere(value) {
  return STYLE_ATMOSPHERE_OPTIONS.some((option) => option.value === value)
    ? value
    : DEFAULT_STYLE_THEME.atmosphere;
}

function normalizeTone(value) {
  return STYLE_TONE_OPTIONS.some((option) => option.value === value)
    ? value
    : DEFAULT_STYLE_THEME.tone;
}

function migrateLegacyTheme(theme) {
  const legacy = theme || {};
  const tone = legacy.pageTheme === 'graphite' ? 'dark' : 'light';

  if (legacy.pageTheme === 'aurora' || legacy.brandTheme === 'orchid') {
    return { atmosphere: 'signal', tone };
  }

  if (legacy.brandTheme === 'slate') {
    return { atmosphere: 'cool', tone };
  }

  if (legacy.brandTheme === 'amber' || legacy.pageTheme === 'paper' || legacy.panelTheme === 'paper') {
    return { atmosphere: 'paper', tone };
  }

  if (legacy.brandTheme === 'cobalt' || legacy.panelTheme === 'contrast' || legacy.panelTheme === 'graphite') {
    return { atmosphere: 'deep', tone };
  }

  return DEFAULT_STYLE_THEME;
}

export function resolveStyleTheme(theme) {
  if (theme && typeof theme === 'object' && ('atmosphere' in theme || 'tone' in theme)) {
    return {
      atmosphere: normalizeAtmosphere(theme.atmosphere),
      tone: normalizeTone(theme.tone)
    };
  }

  return migrateLegacyTheme(theme);
}

function buildEffectiveTheme(theme) {
  const safeTheme = resolveStyleTheme(theme);
  return THEME_RECIPES[safeTheme.atmosphere]?.[safeTheme.tone] || THEME_RECIPES.paper.light;
}

function resolveThemeRecord(record) {
  const safeTheme = resolveStyleTheme(record?.theme || record);
  const preset = STYLE_THEME_PRESETS.find((item) => item.id === safeTheme.atmosphere);
  return {
    id: String(record?.id || safeTheme.atmosphere || '').trim() || safeTheme.atmosphere,
    label: String(record?.label || preset?.label || '未命名主题').trim(),
    summary: String(record?.summary || preset?.summary || '').trim(),
    theme: safeTheme,
    builtIn: record?.builtIn !== false
  };
}

function getStoredThemeFromKeys(keys) {
  if (typeof window === 'undefined') return null;
  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      return resolveStyleTheme(JSON.parse(raw));
    } catch {
      // Ignore malformed payloads and keep scanning.
    }
  }
  return null;
}

function buildBackgroundTokens(recipe) {
  const glowScale = Math.max(0.76, Math.min(1.18, recipe.backgroundGlow / 100));

  if (recipe.pageTheme === 'paper') {
    return {
      '--bg-radial': `radial-gradient(circle at 18% 20%, ${rgba('224, 120, 86', 0.09 * glowScale)}, transparent 28%), radial-gradient(circle at 82% 72%, ${rgba('122, 158, 126', 0.08 * glowScale)}, transparent 32%)`
    };
  }

  if (recipe.pageTheme === 'clear') {
    return {
      '--bg-radial': `radial-gradient(circle at 14% 18%, ${rgba('224, 120, 86', 0.07 * glowScale)}, transparent 26%), radial-gradient(circle at 84% 24%, ${rgba('122, 158, 126', 0.06 * glowScale)}, transparent 28%)`
    };
  }

  if (recipe.pageTheme === 'graphite') {
    return {
      '--bg-radial': `radial-gradient(circle at top left, ${rgba('85, 112, 178', 0.34 * glowScale)}, transparent 28%)`
    };
  }

  return {
    '--bg-radial': `radial-gradient(circle at top left, ${rgba('193, 151, 235', 0.14 * glowScale)}, transparent 26%), radial-gradient(circle at top right, ${rgba('224, 120, 86', 0.08 * glowScale)}, transparent 28%)`
  };
}

function buildPanelTokens(recipe) {
  const base = PANEL_SURFACE_BASES[recipe.pageTheme] || PANEL_SURFACE_BASES.clear;
  const isDarkPage = recipe.pageTheme === 'graphite';

  if (recipe.panelTheme === 'paper') {
    return {
      '--panel': base.panel,
      '--panel-strong': base.strong,
      '--panel-card-bg': base.card,
      '--panel-note-bg': base.note,
      '--line': base.line,
      '--line-strong': base.lineStrong,
      '--shadow': base.shadow
    };
  }

  if (recipe.panelTheme === 'frost') {
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
          '--panel': 'linear-gradient(180deg, rgba(255, 253, 249, 0.84), rgba(246, 241, 234, 0.76))',
          '--panel-strong': '#fffdfa',
          '--panel-card-bg': 'linear-gradient(180deg, rgba(255, 255, 252, 0.94), rgba(245, 241, 235, 0.82))',
          '--panel-note-bg': 'linear-gradient(180deg, rgba(250, 247, 241, 0.94), rgba(242, 237, 230, 0.84))',
          '--line': base.line,
          '--line-strong': base.lineStrong,
          '--shadow': '0 8px 24px -8px rgba(61, 53, 48, 0.1), 0 2px 6px rgba(61, 53, 48, 0.06)'
        };
  }

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
        '--panel': 'linear-gradient(180deg, rgba(255, 253, 249, 0.98), rgba(246, 241, 234, 0.96))',
        '--panel-strong': '#fffdfa',
        '--panel-card-bg': 'linear-gradient(180deg, rgba(255, 255, 252, 0.98), rgba(245, 241, 235, 0.96))',
        '--panel-note-bg': 'linear-gradient(180deg, rgba(250, 247, 241, 0.98), rgba(242, 237, 230, 0.94))',
        '--line': 'rgba(74, 79, 88, 0.18)',
        '--line-strong': 'rgba(74, 79, 88, 0.3)',
        '--shadow': '0 8px 24px -8px rgba(61, 53, 48, 0.12), 0 2px 6px rgba(61, 53, 48, 0.06)'
      };
}

function buildFineTuneTokens(recipe) {
  const brandRgb = BRAND_THEME_TOKENS[recipe.brandTheme]['--brand-rgb'];
  const densityTokens = DENSITY_THEME_TOKENS[recipe.densityTheme];
  const colorScale = Math.max(0.84, Math.min(1.18, recipe.colorStrength / 100));
  const spacingFactor = Math.max(0.9, Math.min(1.08, recipe.spacingScale / 100));
  const controlFactor = Math.max(0.92, Math.min(1.08, recipe.controlScale / 100));

  return {
    ...buildBackgroundTokens(recipe),
    '--brand-soft': rgba(brandRgb, 0.14 * colorScale),
    '--brand-soft-strong': rgba(brandRgb, 0.22 * colorScale),
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
}

function buildDarkContrastTokens(recipe) {
  if (recipe.pageTheme !== 'graphite') return {};

  const brandRgb = BRAND_THEME_TOKENS[recipe.brandTheme]['--brand-rgb'];
  const brandDeep = DARK_BRAND_DEEP_TOKENS[recipe.brandTheme] || '#dbe7ff';

  return {
    '--muted': '#b5c0d4',
    '--brand-deep': brandDeep,
    '--brand-soft': rgba(brandRgb, 0.22),
    '--brand-soft-strong': rgba(brandRgb, 0.34),
    '--badge-text': '#f3f7ff',
    '--btn-nav-text': '#eef4ff',
    '--btn-nav-bg': 'rgba(255, 255, 255, 0.06)',
    '--btn-nav-border': 'rgba(233, 239, 255, 0.18)',
    '--btn-nav-hover-bg': 'rgba(255, 255, 255, 0.1)',
    '--btn-nav-hover-border': 'rgba(233, 239, 255, 0.28)',
    '--btn-nav-primary-bg': `linear-gradient(180deg, ${rgba(brandRgb, 0.38)}, ${rgba(brandRgb, 0.24)})`,
    '--btn-nav-primary-text': '#f8fbff',
    '--btn-action-bg': 'rgba(255, 255, 255, 0.04)',
    '--btn-action-border': 'rgba(233, 239, 255, 0.18)',
    '--btn-action-text': '#eef4ff',
    '--btn-action-solid-bg': `linear-gradient(180deg, ${rgba(brandRgb, 0.42)}, ${rgba(brandRgb, 0.26)})`,
    '--btn-action-solid-text': '#f8fbff',
    '--btn-action-solid-border': 'rgba(233, 239, 255, 0.18)',
    '--status-warning-bg': 'rgba(120, 84, 20, 0.28)',
    '--status-warning-border': 'rgba(255, 193, 92, 0.34)',
    '--status-success-bg': 'rgba(30, 92, 56, 0.26)',
    '--status-success-border': 'rgba(112, 210, 148, 0.3)',
    '--status-error-bg': 'rgba(126, 38, 45, 0.28)',
    '--status-error-border': 'rgba(255, 140, 150, 0.34)',
    '--status-error-text': '#ffd9df'
  };
}

function buildSemanticThemeTokens(theme) {
  return theme.tone === 'dark' ? SEMANTIC_THEME_TOKENS.dark : SEMANTIC_THEME_TOKENS.light;
}

export function getStyleThemeLibrary() {
  return STYLE_THEME_PRESETS.map((preset) => resolveThemeRecord({
    id: preset.id,
    label: preset.label,
    summary: preset.summary,
    theme: preset.theme,
    builtIn: true
  }));
}

export function getStoredActiveStyleThemeId() {
  if (typeof window === 'undefined') return DEFAULT_STYLE_THEME.atmosphere;
  const activeId = String(window.localStorage.getItem(ACTIVE_THEME_ID_STORAGE_KEY) || '').trim();
  if (STYLE_THEME_PRESETS.some((preset) => preset.id === activeId)) return activeId;
  return getStoredStyleTheme().atmosphere;
}

export function saveStoredActiveStyleThemeId(themeId) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACTIVE_THEME_ID_STORAGE_KEY, normalizeAtmosphere(themeId));
}

export function getStoredStyleTheme() {
  if (typeof window === 'undefined') return DEFAULT_STYLE_THEME;
  return getStoredThemeFromKeys([STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) || DEFAULT_STYLE_THEME;
}

export function saveStyleTheme(theme) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resolveStyleTheme(theme)));
}

export function applyStyleTheme(theme) {
  if (typeof document === 'undefined') return;

  const safeTheme = resolveStyleTheme(theme);
  const recipe = buildEffectiveTheme(safeTheme);
  const merged = {
    ...PAGE_THEME_TOKENS[recipe.pageTheme],
    ...BRAND_THEME_TOKENS[recipe.brandTheme],
    ...NAV_THEME_TOKENS[recipe.navTheme],
    ...ACTION_THEME_TOKENS[recipe.actionTheme],
    ...buildPanelTokens(recipe),
    ...RADIUS_THEME_TOKENS[recipe.radiusTheme],
    ...DENSITY_THEME_TOKENS[recipe.densityTheme],
    ...TITLE_THEME_TOKENS[recipe.titleTheme],
    ...STATUS_THEME_TOKENS[recipe.statusTheme],
    ...buildFineTuneTokens(recipe),
    ...buildDarkContrastTokens(recipe),
    ...buildSemanticThemeTokens(safeTheme)
  };

  const root = document.documentElement;
  Object.entries(merged).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  root.style.colorScheme = safeTheme.tone === 'dark' ? 'dark' : 'light';

  root.dataset.atmosphere = safeTheme.atmosphere;
  root.dataset.tone = safeTheme.tone;

  // 保留旧 data-*，避免历史 CSS 兼容层直接失效。
  root.dataset.pageTheme = recipe.pageTheme;
  root.dataset.brandTheme = recipe.brandTheme;
  root.dataset.navTheme = recipe.navTheme;
  root.dataset.actionTheme = recipe.actionTheme;
  root.dataset.panelTheme = recipe.panelTheme;
  root.dataset.radiusTheme = recipe.radiusTheme;
  root.dataset.densityTheme = recipe.densityTheme;
  root.dataset.titleTheme = recipe.titleTheme;
  root.dataset.statusTheme = recipe.statusTheme;
}

export function resetStyleTheme() {
  saveStyleTheme(DEFAULT_STYLE_THEME);
  applyStyleTheme(DEFAULT_STYLE_THEME);
}

export function exportStyleTheme(theme) {
  return JSON.stringify(resolveStyleTheme(theme), null, 2);
}
