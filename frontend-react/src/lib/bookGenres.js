export const genreCategoryMap = {
  urban: {
    label: '都市异能',
    subgenres: [
      ['urban_superpower', '超能力'],
      ['urban_rebirth', '重生流'],
      ['urban_system', '系统流'],
      ['urban_medical', '医圣流'],
      ['urban_business', '商战流']
    ]
  },
  fantasy: {
    label: '玄幻修真',
    subgenres: [
      ['fantasy_cultivation', '传统修真'],
      ['fantasy_martial', '高武世界'],
      ['fantasy_magic', '魔法大陆'],
      ['fantasy_bloodline', '血脉流']
    ]
  },
  xianxia: {
    label: '仙侠修真',
    subgenres: [
      ['xianxia_classic', '凡人流'],
      ['xianxia_genius', '天才流'],
      ['xianxia_sect', '宗门流']
    ]
  },
  scifi: {
    label: '科幻末世',
    subgenres: [
      ['scifi_apocalypse', '末世流'],
      ['scifi_interstellar', '星际文明'],
      ['scifi_cyberpunk', '赛博朋克'],
      ['scifi_time', '时空穿梭']
    ]
  },
  history: {
    label: '历史穿越',
    subgenres: [
      ['history_threekingdoms', '三国流'],
      ['history_tang', '大唐流'],
      ['history_ming', '大明流'],
      ['history_alternate', '架空历史']
    ]
  },
  game: {
    label: '游戏竞技',
    subgenres: [
      ['game_vrmmo', '虚拟网游'],
      ['game_esports', '电子竞技'],
      ['game_streamer', '主播流']
    ]
  },
  mystery: {
    label: '悬疑惊悚',
    subgenres: [
      ['mystery_horror', '恐怖灵异'],
      ['mystery_detective', '侦探推理'],
      ['mystery_survival', '求生无限']
    ]
  },
  sports: {
    label: '体育竞技',
    subgenres: [
      ['sports_basketball', '篮球'],
      ['sports_football', '足球'],
      ['sports_comprehensive', '综合体育']
    ]
  },
  lightnovel: {
    label: '轻小说动漫',
    subgenres: [
      ['light_acg', '二次元'],
      ['light_isekai', '异世界'],
      ['light_school', '校园恋爱']
    ]
  },
  fanfic: {
    label: '同人衍生',
    subgenres: [
      ['fanfic_anime', '动漫同人'],
      ['fanfic_novel', '小说同人'],
      ['fanfic_movie', '影视同人']
    ]
  },
  military: {
    label: '军事战争',
    subgenres: [
      ['military_modern', '现代军旅'],
      ['military_ancient', '古代战争'],
      ['military_mercenary', '雇佣兵']
    ]
  },
  western_fantasy: {
    label: '西幻魔幻',
    subgenres: [
      ['western_dnd', 'DND风格'],
      ['western_lord', '领主建设'],
      ['western_god', '封神流']
    ]
  },
  wuxia: {
    label: '传统武侠',
    subgenres: [
      ['wuxia_classic', '金庸风格'],
      ['wuxia_gulong', '古龙风格'],
      ['wuxia_unconventional', '新派武侠']
    ]
  },
  supernatural: {
    label: '灵异鬼怪',
    subgenres: [
      ['supernatural_fengshui', '风水相术'],
      ['supernatural_exorcism', '道士捉鬼'],
      ['supernatural_folklore', '民间传说']
    ]
  },
  system: {
    label: '系统流',
    subgenres: [
      ['system_signin', '签到流'],
      ['system_growth', '成长流'],
      ['system_shop', '商城流']
    ]
  }
};

export const genreLabels = Object.fromEntries(
  Object.entries(genreCategoryMap).map(([key, value]) => [key, value.label])
);

export const subgenreLabels = Object.fromEntries(
  Object.values(genreCategoryMap).flatMap((item) => item.subgenres.map(([id, label]) => [id, label]))
);

export const genreOptions = Object.entries(genreLabels);

export function getSubgenreOptions(genre) {
  return genreCategoryMap[genre]?.subgenres || [];
}
