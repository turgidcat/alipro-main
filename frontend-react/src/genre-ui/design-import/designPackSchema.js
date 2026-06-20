export const DESIGN_PACK_SCHEMA = {
  description: 'genre-ui 设计导入包的轻量结构说明对象。',
  meta: {
    name: '设计包名称',
    version: '设计包版本',
    source: '来源，例如 gpt / figma / manual',
    createdAt: '创建时间，建议 ISO 字符串'
  },
  themes: {
    lightnovel: {
      tokens: {
        colors: {},
        shape: {},
        shadow: {},
        surface: {},
        ornament: {},
        interaction: {}
      },
      icons: {
        main: 'svg-string',
        chapterStages: {},
        characterRoles: {},
        worldElements: {},
        dividers: {},
        corners: {}
      },
      components: {
        button: {},
        badge: {},
        card: {},
        panel: {},
        sectionHeader: {}
      },
      pageTemplates: {
        showcase: {},
        bookDetail: {},
        chapterList: {}
      }
    }
  }
};

export const DESIGN_PACK_REQUIRED_TOP_LEVEL_KEYS = ['meta', 'themes'];

export const DESIGN_PACK_THEME_BUCKETS = [
  'tokens',
  'icons',
  'components',
  'pageTemplates'
];
