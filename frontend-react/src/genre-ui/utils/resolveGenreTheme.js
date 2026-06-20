import {
  getGenreThemeByCategory,
  isBookCategoryKey,
  normalizeGenreThemeKey
} from '../config/categoryMapping.js';
import { getGenreVisualSystem } from '../config/genres.js';

export function resolveGenreTheme(categoryOrThemeKey, overrideTheme) {
  const normalizedThemeKey = normalizeGenreThemeKey(categoryOrThemeKey);

  if (normalizedThemeKey) {
    return getGenreVisualSystem(normalizedThemeKey);
  }

  if (isBookCategoryKey(categoryOrThemeKey) || overrideTheme) {
    return getGenreVisualSystem(getGenreThemeByCategory(categoryOrThemeKey, overrideTheme));
  }

  return getGenreVisualSystem('lightnovel');
}

export function getGenreCssVars(categoryOrThemeKey, overrideTheme) {
  const genre = resolveGenreTheme(categoryOrThemeKey, overrideTheme);
  const { colors } = genre;

  return {
    '--genre-bg': colors.bg,
    '--genre-panel': colors.panel,
    '--genre-primary': colors.primary,
    '--genre-secondary': colors.secondary,
    '--genre-accent': colors.accent,
    '--genre-muted': colors.muted,
    '--genre-text': colors.text,
    '--genre-line': colors.line,
    '--genre-glow': colors.glow
  };
}
