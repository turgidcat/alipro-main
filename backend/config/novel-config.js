/**
 * 网文分类与模板配置
 * 针对起点/番茄平台的特色优化
 */

// 小说主分类体系（15+分类）
const NOVEL_CATEGORIES = {
  // 都市类
  urban: {
    name: '都市异能',
    icon: '🏙️',
    description: '现代都市背景，主角获得特殊能力',
    subgenres: [
      { id: 'urban_superpower', name: '超能力', tags: ['异能觉醒', '都市修真', '透视眼'] },
      { id: 'urban_rebirth', name: '重生流', tags: ['重生回到过去', '弥补遗憾', '先知先觉'] },
      { id: 'urban_system', name: '系统流', tags: ['神豪系统', '签到系统', '选择系统'] },
      { id: 'urban_medical', name: '医圣流', tags: ['神医', '古武医术', '妙手回春'] },
      { id: 'urban_business', name: '商战流', tags: ['商业帝国', '投资大神', '金融巨鳄'] }
    ],
    features: {
      goldenThreeChapters: true, // 黄金三章
      fastPace: true, // 快节奏
      faceSlapping: true, // 打脸情节
      harem: false, // 后宫元素
      systemPanel: false // 系统面板
    },
    writingTips: [
      '开篇快速引入金手指/系统',
      '前三章必须出现第一个爽点',
      '反派要嚣张，打脸要彻底',
      '多写装逼打脸、扮猪吃虎情节',
      '对话要接地气，符合现代人说话习惯'
    ]
  },

  // 玄幻类
  fantasy: {
    name: '玄幻修真',
    icon: '⚔️',
    description: '异世界修炼体系，强者为尊',
    subgenres: [
      { id: 'fantasy_cultivation', name: '传统修真', tags: ['炼气筑基', '渡劫飞升', '宗门争斗'] },
      { id: 'fantasy_martial', name: '高武世界', tags: ['武道通神', '气血如龙', '拳镇山河'] },
      { id: 'fantasy_magic', name: '魔法大陆', tags: ['元素魔法', '魔兽契约', '法神之路'] },
      { id: 'fantasy_bloodline', name: '血脉流', tags: ['上古血脉', '血脉觉醒', '种族天赋'] }
    ],
    features: {
      goldenThreeChapters: true,
      fastPace: false,
      faceSlapping: true,
      harem: true,
      systemPanel: false,
      cultivationSystem: true // 修炼体系
    },
    writingTips: [
      '明确修炼等级体系',
      '战斗描写要有画面感',
      '宝物、功法名称要霸气',
      '突出实力差距带来的压迫感',
      '升级要有成就感'
    ]
  },

  // 仙侠类
  xianxia: {
    name: '仙侠修真',
    icon: '🗡️',
    description: '古典仙侠风格，问道长生',
    subgenres: [
      { id: 'xianxia_classic', name: '凡人流', tags: ['资质平庸', '步步为营', '资源争夺'] },
      { id: 'xianxia_genius', name: '天才流', tags: ['天生道体', '悟性逆天', '同阶无敌'] },
      { id: 'xianxia_sect', name: '宗门流', tags: ['开宗立派', '收徒传道', '宗门大战'] }
    ],
    features: {
      goldenThreeChapters: false,
      fastPace: false,
      faceSlapping: true,
      harem: false,
      systemPanel: false,
      cultivationSystem: true,
      daoUnderstanding: true // 悟道元素
    },
    writingTips: [
      '注重意境描写',
      '打斗要有招式名称',
      '强调心境变化',
      '融入道家哲学思想',
      '节奏可以稍慢，但要有意境'
    ]
  },

  // 科幻类
  scifi: {
    name: '科幻末世',
    icon: '🚀',
    description: '未来科技或末日背景',
    subgenres: [
      { id: 'scifi_apocalypse', name: '末世流', tags: ['丧尸危机', '天灾降临', '生存进化'] },
      { id: 'scifi_interstellar', name: '星际文明', tags: ['星舰战争', '外星文明', '宇宙探索'] },
      { id: 'scifi_cyberpunk', name: '赛博朋克', tags: ['义体改造', '虚拟现实', '人工智能'] },
      { id: 'scifi_time', name: '时空穿梭', tags: ['时间旅行', '平行世界', '因果律'] }
    ],
    features: {
      goldenThreeChapters: true,
      fastPace: true,
      faceSlapping: false,
      harem: false,
      systemPanel: true,
      techTree: true // 科技树
    },
    writingTips: [
      '设定要自洽，逻辑要严谨',
      '科技名词要专业但不晦涩',
      '末世氛围要压抑但有希望',
      '人性考验是核心看点',
      '适当加入科学原理解释'
    ]
  },

  // 历史类
  history: {
    name: '历史穿越',
    icon: '📜',
    description: '穿越到古代改变历史',
    subgenres: [
      { id: 'history_threekingdoms', name: '三国流', tags: ['谋士争霸', '武将收服', '统一天下'] },
      { id: 'history_tang', name: '大唐流', tags: ['盛世繁华', '诗词装逼', '科举入仕'] },
      { id: 'history_ming', name: '大明流', tags: ['海贸发展', '火器革新', '收复失地'] },
      { id: 'history_alternate', name: '架空历史', tags: ['改变历史走向', '制度革新', '工业革命'] }
    ],
    features: {
      goldenThreeChapters: false,
      fastPace: false,
      faceSlapping: true,
      harem: true,
      systemPanel: false,
      historicalAccuracy: true // 历史考据
    },
    writingTips: [
      '历史细节要考究',
      '古人说话要有古风',
      '利用现代知识装逼',
      '改变历史要有合理性',
      '权谋斗争要精彩'
    ]
  },

  // 游戏类
  game: {
    name: '游戏竞技',
    icon: '🎮',
    description: '虚拟游戏或电竞题材',
    subgenres: [
      { id: 'game_vrmmo', name: '虚拟网游', tags: ['全息游戏', '数据化', '副本攻略'] },
      { id: 'game_esports', name: '电子竞技', tags: ['职业选手', '战队经营', '世界冠军'] },
      { id: 'game_streamer', name: '主播流', tags: ['直播打赏', '水友互动', '人气爆棚'] }
    ],
    features: {
      goldenThreeChapters: true,
      fastPace: true,
      faceSlapping: true,
      harem: false,
      systemPanel: true,
      gameMechanics: true // 游戏机制
    },
    writingTips: [
      '游戏设定要有趣',
      '操作描写要有技术含量',
      '比赛过程要紧张刺激',
      '装备、技能名称要酷炫',
      '可以适当玩梗'
    ]
  },

  // 悬疑类
  mystery: {
    name: '悬疑惊悚',
    icon: '👻',
    description: '恐怖、推理、灵异题材',
    subgenres: [
      { id: 'mystery_horror', name: '恐怖灵异', tags: ['鬼怪传说', '民间禁忌', '驱邪捉鬼'] },
      { id: 'mystery_detective', name: '侦探推理', tags: ['破案解谜', '犯罪心理', '逻辑推理'] },
      { id: 'mystery_survival', name: '求生无限', tags: ['无限流', '副本闯关', '死亡游戏'] }
    ],
    features: {
      goldenThreeChapters: false,
      fastPace: false,
      faceSlapping: false,
      harem: false,
      systemPanel: false,
      suspenseBuilding: true // 悬念营造
    },
    writingTips: [
      '氛围营造至关重要',
      '悬念要层层递进',
      '反转要出人意料但合理',
      '恐怖元素要循序渐进',
      '结尾留白更有韵味'
    ]
  },

  // 体育类
  sports: {
    name: '体育竞技',
    icon: '⚽',
    description: '各类体育运动题材',
    subgenres: [
      { id: 'sports_basketball', name: '篮球', tags: ['NBA', '扣篮大赛', '总冠军'] },
      { id: 'sports_football', name: '足球', tags: ['世界杯', '豪门球队', '金球奖'] },
      { id: 'sports_comprehensive', name: '综合体育', tags: ['奥运冠军', '打破纪录', '全能运动员'] }
    ],
    features: {
      goldenThreeChapters: true,
      fastPace: true,
      faceSlapping: true,
      harem: false,
      systemPanel: true,
      matchDescription: true // 比赛描写
    },
    writingTips: [
      '比赛过程要详细描写',
      '技术动作要专业',
      '对手要强，胜利才爽',
      '团队精神很重要',
      '可以加入训练日常'
    ]
  },

  // 轻小说类
  lightnovel: {
    name: '轻小说动漫',
    icon: '🌸',
    description: '日式轻小说风格',
    subgenres: [
      { id: 'light_acg', name: '二次元', tags: ['萌系角色', '吐槽役', '后宫喜剧'] },
      { id: 'light_isekai', name: '异世界', tags: ['转生异世界', '魔王勇者', '冒险者公会'] },
      { id: 'light_school', name: '校园恋爱', tags: ['青梅竹马', '学生会', '学园祭'] }
    ],
    features: {
      goldenThreeChapters: false,
      fastPace: false,
      faceSlapping: false,
      harem: true,
      systemPanel: false,
      animeStyle: true // 动漫风格
    },
    writingTips: [
      '角色要萌，性格要鲜明',
      '对话要有趣，多吐槽',
      '场景要有画面感',
      '感情线要细腻',
      '可以适当中二'
    ]
  },

  // 同人类
  fanfic: {
    name: '同人衍生',
    icon: '✨',
    description: '基于知名作品的二次创作',
    subgenres: [
      { id: 'fanfic_anime', name: '动漫同人', tags: ['火影', '海贼', '龙珠'] },
      { id: 'fanfic_novel', name: '小说同人', tags: ['斗罗', '斗破', '遮天'] },
      { id: 'fanfic_movie', name: '影视同人', tags: ['漫威', 'DC', '哈利波特'] }
    ],
    features: {
      goldenThreeChapters: true,
      fastPace: true,
      faceSlapping: true,
      harem: true,
      systemPanel: true,
      canonCompliance: true // 原著符合度
    },
    writingTips: [
      '尊重原著设定',
      '主角要有新意',
      '弥补原著遗憾',
      '不要过度魔改',
      '抓住原著粉丝痛点'
    ]
  },

  // 军事类
  military: {
    name: '军事战争',
    icon: '🎖️',
    description: '现代或古代军事题材',
    subgenres: [
      { id: 'military_modern', name: '现代军旅', tags: ['特种部队', '反恐行动', '军事演习'] },
      { id: 'military_ancient', name: '古代战争', tags: ['冷兵器战争', '兵法谋略', '名将养成'] },
      { id: 'military_mercenary', name: '雇佣兵', tags: ['海外征战', '军火交易', '私人武装'] }
    ],
    features: {
      goldenThreeChapters: true,
      fastPace: true,
      faceSlapping: false,
      harem: false,
      systemPanel: false,
      tacticsDescription: true // 战术描写
    },
    writingTips: [
      '军事术语要准确',
      '战斗场面要热血',
      '战友情谊要真挚',
      '武器装备要详细',
      '战略战术要合理'
    ]
  },

  // 奇幻类
  western_fantasy: {
    name: '西幻魔幻',
    icon: '🧙',
    description: '西方奇幻背景',
    subgenres: [
      { id: 'western_dnd', name: 'DND风格', tags: ['龙与地下城', '职业体系', '阵营对抗'] },
      { id: 'western_lord', name: '领主建设', tags: ['领地发展', '种田流', '王国争霸'] },
      { id: 'western_god', name: '封神流', tags: ['信仰成神', '神国建设', '神战'] }
    ],
    features: {
      goldenThreeChapters: false,
      fastPace: false,
      faceSlapping: true,
      harem: false,
      systemPanel: true,
      worldBuilding: true // 世界观构建
    },
    writingTips: [
      '种族设定要丰富',
      '魔法体系要完整',
      '政治斗争要复杂',
      '史诗感要强',
      '英雄主义色彩'
    ]
  },

  // 武侠类
  wuxia: {
    name: '传统武侠',
    icon: '🥋',
    description: '古典武侠江湖',
    subgenres: [
      { id: 'wuxia_classic', name: '金庸风格', tags: ['侠之大者', '家国情怀', '武功秘籍'] },
      { id: 'wuxia_gulong', name: '古龙风格', tags: ['浪子情怀', '快意恩仇', '悬疑推理'] },
      { id: 'wuxia_unconventional', name: '新派武侠', tags: ['反传统', '黑色幽默', '解构经典'] }
    ],
    features: {
      goldenThreeChapters: false,
      fastPace: false,
      faceSlapping: true,
      harem: false,
      systemPanel: false,
      martialArtsDetail: true // 武功细节
    },
    writingTips: [
      '武功招式要有名字',
      '江湖气息要浓厚',
      '侠义精神要体现',
      '恩怨情仇要纠结',
      '文采要好，有意境'
    ]
  },

  // 灵异类
  supernatural: {
    name: '灵异鬼怪',
    icon: '🕯️',
    description: '灵异事件、风水玄学',
    subgenres: [
      { id: 'supernatural_fengshui', name: '风水相术', tags: ['看相算命', '风水布局', '阴阳五行'] },
      { id: 'supernatural_exorcism', name: '道士捉鬼', tags: ['茅山道术', '驱邪降妖', '阴司地府'] },
      { id: 'supernatural_folklore', name: '民间传说', tags: ['乡野奇谈', '古老禁忌', '民俗诡异'] }
    ],
    features: {
      goldenThreeChapters: true,
      fastPace: false,
      faceSlapping: false,
      harem: false,
      systemPanel: false,
      folkloreElement: true // 民俗元素
    },
    writingTips: [
      '民俗知识要准确',
      '恐怖氛围要到位',
      '道教术语要专业',
      '因果报应要明确',
      '结局要有警示意义'
    ]
  }
};

// 起点/番茄平台特色功能配置
const PLATFORM_FEATURES = {
  qidian: {
    name: '起点中文网',
    characteristics: [
      '重视世界观构建',
      '喜欢长篇大作',
      '读者付费意愿强',
      '注重逻辑性和合理性',
      '偏好升级流、系统流'
    ],
    optimizationTips: [
      '每章2000-3000字为宜',
      '保持稳定的更新节奏',
      '章节末尾留悬念吸引订阅',
      '适当设置付费节点',
      '重视书评区互动'
    ],
    popularElements: [
      '系统面板',
      '数据化属性',
      '签到打卡',
      '幕后黑手流',
      '迪化流（自我脑补）',
      '苟道流（稳健发育）'
    ]
  },

  fanqie: {
    name: '番茄小说',
    characteristics: [
      '免费阅读模式',
      '算法推荐为主',
      '重视完读率',
      '节奏要快',
      '爽点要密集'
    ],
    optimizationTips: [
      '开篇3章必须有爽点',
      '每章都要有小高潮',
      '标题要吸引人点击',
      '简介要突出卖点',
      '避免长篇大论的设定说明'
    ],
    popularElements: [
      '神豪流',
      '签到流',
      '直播流',
      '反派流',
      '退婚流',
      '开局无敌'
    ]
  }
};

// 通用爽点标签库
const SHUANG_POINTS = {
  common: [
    '打脸反转', '扮猪吃虎', '震惊全场', '装逼打脸',
    '逆袭翻盘', '金手指爆发', '美女倒贴', '兄弟情深',
    '碾压对手', '身份曝光', '隐藏大佬', '绝地反击'
  ],

  urban: [
    '土豪炫富被打脸', '鉴宝捡漏', '医术救人',
    '商业狙击', '权势压人', '前女友后悔'
  ],

  fantasy: [
    '越阶挑战', '秘境夺宝', '宗门大比夺冠',
    '突破瓶颈', '获得传承', '神兽认主'
  ],

  system: [
    '系统抽奖', '任务完成奖励', '属性暴涨',
    '解锁新功能', '商城购物', '成就达成'
  ]
};

// 写作风格预设
const WRITING_STYLES = {
  fast_pace: {
    name: '快节奏',
    description: '减少冗长描写，快速推进剧情',
    settings: {
      dialogueRatio: 40,
      emotionIntensity: 70,
      detailedDescription: false,
      sceneTransition: 'fast'
    }
  },

  detailed: {
    name: '细节描写',
    description: '增强画面感，注重环境和心理描写',
    settings: {
      dialogueRatio: 25,
      emotionIntensity: 85,
      detailedDescription: true,
      sceneTransition: 'slow'
    }
  },

  balanced: {
    name: '平衡风格',
    description: '节奏与细节并重',
    settings: {
      dialogueRatio: 35,
      emotionIntensity: 75,
      detailedDescription: true,
      sceneTransition: 'normal'
    }
  }
};

module.exports = {
  NOVEL_CATEGORIES,
  PLATFORM_FEATURES,
  SHUANG_POINTS,
  WRITING_STYLES
};
