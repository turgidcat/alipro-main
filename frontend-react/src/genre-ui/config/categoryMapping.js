export const BOOK_CATEGORY_KEYS = [
  'urban',
  'fantasy',
  'xianxia',
  'scifi',
  'history',
  'game',
  'mystery',
  'sports',
  'lightnovel',
  'fanfic',
  'military',
  'western_fantasy',
  'wuxia',
  'supernatural',
  'system'
];

export const categoryLabels = {
  urban: '都市异能',
  fantasy: '玄幻修真',
  xianxia: '仙侠修真',
  scifi: '科幻末世',
  history: '历史穿越',
  game: '游戏竞技',
  mystery: '悬疑惊悚',
  sports: '体育竞技',
  lightnovel: '轻小说动漫',
  fanfic: '同人衍生',
  military: '军事战争',
  western_fantasy: '西幻魔幻',
  wuxia: '传统武侠',
  supernatural: '灵异鬼怪',
  system: '系统流'
};

export const GENRE_THEME_KEYS = [
  'urban',
  'fantasy',
  'scifi',
  'mystery',
  'game',
  'lightnovel'
];

export const genreThemeLabels = {
  urban: '都市现代',
  fantasy: '东方幻想',
  scifi: '科幻末世',
  mystery: '悬疑灵异',
  game: '游戏竞技',
  lightnovel: '轻小说动漫'
};

export const categoryToGenreTheme = {
  urban: 'urban',
  fantasy: 'fantasy',
  xianxia: 'fantasy',
  scifi: 'scifi',
  history: 'fantasy',
  game: 'game',
  mystery: 'mystery',
  sports: 'urban',
  lightnovel: 'lightnovel',
  fanfic: 'lightnovel',
  military: 'scifi',
  western_fantasy: 'fantasy',
  wuxia: 'fantasy',
  supernatural: 'mystery',
  system: 'game'
};

export const LEGACY_THEME_KEY_ALIASES = {
  lightNovel: 'lightnovel',
  suspense: 'mystery',
  xuanhuan: 'fantasy',
  xianxia: 'fantasy'
};

export function isGenreThemeKey(key) {
  return GENRE_THEME_KEYS.includes(key);
}

export function isBookCategoryKey(key) {
  return BOOK_CATEGORY_KEYS.includes(key);
}

export function normalizeGenreThemeKey(key) {
  if (isGenreThemeKey(key)) return key;
  if (Object.prototype.hasOwnProperty.call(LEGACY_THEME_KEY_ALIASES, key)) {
    return LEGACY_THEME_KEY_ALIASES[key];
  }
  return '';
}

export function getGenreThemeByCategory(category, overrideTheme) {
  const normalizedOverride = normalizeGenreThemeKey(overrideTheme);
  if (normalizedOverride) return normalizedOverride;

  const normalizedTheme = normalizeGenreThemeKey(category);
  if (normalizedTheme) return normalizedTheme;

  if (Object.prototype.hasOwnProperty.call(categoryToGenreTheme, category)) {
    return categoryToGenreTheme[category];
  }

  return 'lightnovel';
}
