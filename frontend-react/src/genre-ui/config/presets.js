import {
  chapterStageKeys,
  characterRoleKeys,
  worldElementKeys
} from './tokens.js';
import {
  genreKeys,
  getGenreVisualSystem
} from './genres.js';

const DEFAULT_STAGE_PRESET = ['opening', 'awakening', 'conflict', 'breakthrough', 'climax', 'ending'];
const DEFAULT_ROLE_PRESET = ['protagonist', 'heroine', 'mentor', 'rival', 'villain', 'companion'];
const DEFAULT_WORLD_PRESET = ['faction', 'location', 'artifact', 'ability', 'secret', 'destiny'];

export const genreDisplayPresets = genreKeys.reduce((result, genreKey) => {
  const genre = getGenreVisualSystem(genreKey);

  result[genreKey] = {
    genreKey,
    defaultTitle: `${genre.label}类型包`,
    defaultSubtitle: genre.description,
    defaultButtonLabels: {
      primary: `进入${genre.label}面板`,
      secondary: `查看${genre.label}设定`,
      accent: `切换${genre.label}样式`
    },
    defaultStageShowcase: DEFAULT_STAGE_PRESET.filter((key) => chapterStageKeys.includes(key)),
    defaultCharacterRoleShowcase: DEFAULT_ROLE_PRESET.filter((key) => characterRoleKeys.includes(key)),
    defaultWorldElementShowcase: DEFAULT_WORLD_PRESET.filter((key) => worldElementKeys.includes(key)),
    defaultMotifShowcase: genre.motifs.slice(0, 3),
    defaultToneHeadline: genre.tone
  };

  return result;
}, {});

export function getGenreDisplayPreset(genreKey) {
  return genreDisplayPresets[genreKey] || genreDisplayPresets.lightnovel;
}
