export {
  genreVisualSystems,
  genreKeys,
  getGenreVisualSystem
} from './config/genres.js';

export {
  chapterStageLabels,
  chapterStageKeys,
  characterRoleLabels,
  characterRoleKeys,
  worldElementLabels,
  worldElementKeys,
  sharedUiStyleKeys
} from './config/tokens.js';

export {
  BOOK_CATEGORY_KEYS,
  categoryLabels,
  GENRE_THEME_KEYS,
  genreThemeLabels,
  categoryToGenreTheme,
  LEGACY_THEME_KEY_ALIASES,
  isGenreThemeKey,
  isBookCategoryKey,
  normalizeGenreThemeKey,
  getGenreThemeByCategory
} from './config/categoryMapping.js';

export {
  genreDisplayPresets,
  getGenreDisplayPreset
} from './config/presets.js';

export {
  genreVisualGrammar
} from './config/visualGrammar.js';

export {
  resolveGenreTheme,
  getGenreCssVars
} from './utils/resolveGenreTheme.js';

export {
  resolveGenreGrammar
} from './utils/resolveGenreGrammar.js';

export {
  GenreButton,
  GenreBadge,
  GenreCard,
  GenrePanel
} from './components/index.js';

export {
  ChapterStageIcon,
  CharacterRoleIcon,
  WorldElementIcon,
  GenreMainIcon,
  GenreDivider,
  GenreCorner
} from './icons/index.js';

export {
  DESIGN_PACK_SCHEMA,
  DESIGN_PACK_REQUIRED_TOP_LEVEL_KEYS,
  DESIGN_PACK_THEME_BUCKETS,
  sampleDesignPack,
  normalizeDesignPack
} from './design-import/index.js';
