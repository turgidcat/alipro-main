import { GENRE_THEME_KEYS, normalizeGenreThemeKey } from '../config/categoryMapping.js';

function normalizeMeta(meta = {}) {
  return {
    name: meta.name || 'unnamed design pack',
    version: meta.version || '0.0.0',
    source: meta.source || 'unknown',
    createdAt: meta.createdAt || new Date(0).toISOString()
  };
}

function normalizeThemeBucket(theme = {}) {
  return {
    tokens: {
      colors: theme.tokens?.colors || {},
      shape: theme.tokens?.shape || {},
      shadow: theme.tokens?.shadow || {},
      surface: theme.tokens?.surface || {},
      ornament: theme.tokens?.ornament || {},
      interaction: theme.tokens?.interaction || {}
    },
    icons: {
      main: theme.icons?.main || '',
      chapterStages: theme.icons?.chapterStages || {},
      characterRoles: theme.icons?.characterRoles || {},
      worldElements: theme.icons?.worldElements || {},
      dividers: theme.icons?.dividers || {},
      corners: theme.icons?.corners || {}
    },
    components: {
      button: theme.components?.button || {},
      badge: theme.components?.badge || {},
      card: theme.components?.card || {},
      panel: theme.components?.panel || {},
      sectionHeader: theme.components?.sectionHeader || {}
    },
    pageTemplates: {
      showcase: theme.pageTemplates?.showcase || {},
      bookDetail: theme.pageTemplates?.bookDetail || {},
      chapterList: theme.pageTemplates?.chapterList || {}
    }
  };
}

export function normalizeDesignPack(designPack = {}) {
  const inputThemes = designPack.themes || {};

  const normalizedThemes = GENRE_THEME_KEYS.reduce((result, themeKey) => {
    result[themeKey] = normalizeThemeBucket(inputThemes[themeKey]);
    return result;
  }, {});

  Object.entries(inputThemes).forEach(([rawKey, themeValue]) => {
    const normalizedKey = normalizeGenreThemeKey(rawKey);
    if (normalizedKey) {
      normalizedThemes[normalizedKey] = normalizeThemeBucket(themeValue);
    }
  });

  return {
    meta: normalizeMeta(designPack.meta),
    themes: normalizedThemes
  };
}
