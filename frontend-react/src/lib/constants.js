export const emptyChapterStructure = {
  chapter_goal: '',
  key_scenes: '',
  ending_hook: ''
};

export const emptyChapterPlan = {
  volume_number: 1,
  chapter_name: '',
  summary: '',
  chapter_mission: '',
  emotion_target: '',
  previous_hook: '',
  outline_text: '',
  character_notes: '',
  ending_hook: '',
  scene_outline: [],
  appearing_roles: [],
  role_execution: [],
  structured_content: {},
  chapter_structure: emptyChapterStructure,
  generation_settings: {
    word_count: 3000,
    temperature: 0.7,
    emotionIntensity: 70,
    colloquialLevel: 80,
    dialogueRatio: 30,
    addCliffhanger: true,
    enhanceDialogue: true,
    avoidAIFeel: true,
    fastPace: false,
    detailedDesc: false,
    custom_instruction: ''
  },
  main_storyline_id: '',
  target_storylines: []
};

export const initialGenerationState = {
  hasContent: false,
  content: '',
  statusKind: 'info',
  statusTitle: '等待生成',
  statusText: '先补齐章节细纲，再开始章节创作。',
  metaText: '还没有生成正文',
  wordCountLabel: '暂无正文',
  previewText: '生成后这里会显示正文摘要。',
  feedbackSummary: '生成完成后，这里会整理本章推进结果。',
  feedbackFocus: '下一章重点会在这里收口。'
};

export const emptyStorylineDraft = {
  id: '',
  volume_number: 1,
  storyline_name: '',
  storyline_type: 'branch',
  description: '',
  core_conflict: '',
  start_chapter: 1,
  end_chapter: 10
};

export const ROLE_EXECUTION_DIMENSIONS = new Set([
  'story_function',
  'risk_attitude',
  'trust_pattern',
  'responsibility',
  'emotion_control',
  'power_desire',
  'social_style',
  'moral_boundary'
]);

export const ROLE_EXECUTION_DIRECTIONS = new Set([
  'hold',
  'more_open',
  'more_closed',
  'more_active',
  'more_passive',
  'more_stable',
  'more_extreme',
  'stronger',
  'weaker'
]);

export const ROLE_EXECUTION_SCOPES = new Set([
  'temporary',
  'stage',
  'core_candidate'
]);

export const ROLE_EXECUTION_CONFIDENCE = new Set([
  'low',
  'medium',
  'high'
]);

export const ROLE_DIMENSION_LABELS = {
  story_function: '剧情职责',
  risk_attitude: '风险态度',
  trust_pattern: '信任方式',
  responsibility: '责任承担',
  emotion_control: '情绪控制',
  power_desire: '权力欲望',
  social_style: '社交姿态',
  moral_boundary: '道德边界'
};

export const ROLE_DIRECTION_LABELS = {
  hold: '保持当前底色',
  more_open: '更开放',
  more_closed: '更收敛',
  more_active: '更主动',
  more_passive: '更被动',
  more_stable: '更稳定',
  more_extreme: '更极端',
  stronger: '更强化',
  weaker: '更减弱'
};

export const ROLE_SCOPE_LABELS = {
  temporary: '本章表现',
  stage: '阶段变化',
  core_candidate: '底色候选'
};

export const ROLE_CONFIDENCE_LABELS = {
  low: '低',
  medium: '中',
  high: '高'
};

export const PLATFORM_LABELS = {
  qidian: '起点中文网',
  fanqie: '番茄小说',
  custom: '自定义渠道',
  '未设置': '未设置'
};

export const GENRE_LABELS = {
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

export const SUBGENRE_LABELS = {
  urban_superpower: '超能力',
  urban_rebirth: '重生流',
  urban_system: '系统流',
  urban_medical: '医圣流',
  urban_business: '商战流',
  fantasy_cultivation: '传统修真',
  fantasy_martial: '高武世界',
  fantasy_magic: '魔法大陆',
  fantasy_bloodline: '血脉流',
  xianxia_classic: '凡人流',
  xianxia_genius: '天才流',
  xianxia_sect: '宗门流',
  scifi_apocalypse: '末世流',
  scifi_interstellar: '星际文明',
  scifi_cyberpunk: '赛博朋克',
  scifi_time: '时空穿梭',
  history_threekingdoms: '三国流',
  history_tang: '大唐流',
  history_ming: '大明流',
  history_alternate: '架空历史',
  game_vrmmo: '虚拟网游',
  game_esports: '电子竞技',
  game_streamer: '主播流',
  mystery_horror: '恐怖灵异',
  mystery_detective: '侦探推理',
  mystery_survival: '求生无限',
  sports_basketball: '篮球',
  sports_football: '足球',
  sports_comprehensive: '综合体育',
  light_acg: '二次元',
  light_isekai: '异世界',
  light_school: '校园恋爱',
  fanfic_anime: '动漫同人',
  fanfic_novel: '小说同人',
  fanfic_movie: '影视同人',
  military_modern: '现代军旅',
  military_ancient: '古代战争',
  military_mercenary: '雇佣兵',
  western_dnd: 'DND风格',
  western_lord: '领主建设',
  western_god: '封神流',
  wuxia_classic: '金庸风格',
  wuxia_gulong: '古龙风格',
  wuxia_unconventional: '新派武侠',
  supernatural_fengshui: '风水相术',
  supernatural_exorcism: '道士捉鬼',
  supernatural_folklore: '民间传说',
  system_signin: '签到流',
  system_growth: '成长流',
  system_shop: '商城流'
};

export const TEMPLATE_LABELS = {
  fast_pace: '快节奏',
  detailed: '细腻描写',
  balanced: '均衡推进'
};
