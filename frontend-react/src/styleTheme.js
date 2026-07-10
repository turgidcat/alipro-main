// styleTheme.js -- Simplified: single fixed theme, CSS handles all tokens statically.

const STORAGE_KEY = 'alipro-style-theme-v3';
const ACTIVE_THEME_ID_STORAGE_KEY = 'alipro-style-theme-active-id-v2';
const THEME_POPOVER_STORAGE_KEY = 'alipro-theme-popover-v1';

export const DEFAULT_STYLE_THEME = {
  atmosphere: 'paper',
  tone: 'light'
};

export const DEFAULT_THEME_POPOVER_SETTINGS = {
  mode: 'light',
  warmth: 'standard',
  proseFont: 'serif'
};

/** No-op: CSS (styles.css) now provides all token values statically. */
export function applyStyleTheme(_theme) {
  // no-op
}

/** No-op: popover token overrides handled by CSS. */
export function applyThemePopoverSettings(_settings) {
  // no-op
}

/** No-op: token overrides removed; CSS is static. */
export function applyThemePopoverTokenOverrides(_settings) {
  // no-op
}

export function getStoredStyleTheme() {
  if (typeof window === 'undefined') return DEFAULT_STYLE_THEME;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore malformed payload
  }
  return DEFAULT_STYLE_THEME;
}

export function getStoredThemePopoverSettings() {
  if (typeof window === 'undefined') return DEFAULT_THEME_POPOVER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(THEME_POPOVER_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore malformed payload
  }
  return DEFAULT_THEME_POPOVER_SETTINGS;
}

export function getStyleThemeLibrary() {
  return [
    {
      id: 'paper',
      label: '中性浅色·暖白',
      shortLabel: '暖白',
      summary: '大众化暖白文档感，适合长时间阅读和写作。',
      theme: { ...DEFAULT_STYLE_THEME },
      builtIn: true
    }
  ];
}

export function getStoredActiveStyleThemeId() {
  if (typeof window === 'undefined') return DEFAULT_STYLE_THEME.atmosphere;
  return window.localStorage.getItem(ACTIVE_THEME_ID_STORAGE_KEY) || DEFAULT_STYLE_THEME.atmosphere;
}

export function saveStoredActiveStyleThemeId(themeId) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACTIVE_THEME_ID_STORAGE_KEY, String(themeId || DEFAULT_STYLE_THEME.atmosphere));
}

export function saveStyleTheme(theme) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(theme || DEFAULT_STYLE_THEME));
}

export function saveThemePopoverSettings(settings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_POPOVER_STORAGE_KEY, JSON.stringify(settings || DEFAULT_THEME_POPOVER_SETTINGS));
}

export function resolveStyleTheme(theme) {
  if (theme && typeof theme === 'object' && ('atmosphere' in theme || 'tone' in theme)) {
    return {
      atmosphere: theme.atmosphere || DEFAULT_STYLE_THEME.atmosphere,
      tone: theme.tone || DEFAULT_STYLE_THEME.tone
    };
  }
  return { ...DEFAULT_STYLE_THEME };
}

export function exportStyleTheme(theme) {
  return JSON.stringify(resolveStyleTheme(theme), null, 2);
}

export function resetStyleTheme() {
  saveStyleTheme(DEFAULT_STYLE_THEME);
}
