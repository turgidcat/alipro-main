import { genreVisualGrammar } from '../config/visualGrammar.js';
import { resolveGenreTheme } from './resolveGenreTheme.js';

export function resolveGenreGrammar(categoryOrThemeKey, overrideTheme) {
  const resolvedTheme = resolveGenreTheme(categoryOrThemeKey, overrideTheme);
  return genreVisualGrammar[resolvedTheme.key] || genreVisualGrammar.lightnovel;
}
