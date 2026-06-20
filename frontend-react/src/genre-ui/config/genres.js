import {
  GENRE_THEME_KEYS,
  normalizeGenreThemeKey
} from './categoryMapping.js';

const genreVisualSystemMap = {
  urban: {
    key: 'urban',
    label: '都市现代',
    description: '强调现代秩序、速度感、身份切换和现实压力的主视觉主题。',
    tone: '利落、冷静、信息密度高',
    colors: {
      bg: 'linear-gradient(180deg, #eef2f6 0%, #dde4ea 100%)',
      panel: 'rgba(250, 252, 255, 0.9)',
      primary: '#2f6ce5',
      secondary: '#1f427c',
      accent: '#6fb6ff',
      muted: '#6b7788',
      text: '#1f2a37',
      line: 'rgba(48, 72, 104, 0.14)',
      glow: 'rgba(111, 182, 255, 0.22)'
    },
    motifs: ['霓虹倒影', '高楼网格', '玻璃冷光', '信息界面'],
    chapterStages: {
      opening: '现实压力、身份背景、冲突入口',
      awakening: '系统上线、记忆回归、能力激活',
      trial: '职场、校园、商战、圈层试探',
      encounter: '贵人、目标人物、危险人物相遇',
      conflict: '利益、地位、情感或规则冲突升级',
      crisis: '资源断裂、身份曝光、现实反噬',
      breakthrough: '事业起势、能力跃迁、局面反控',
      reversal: '舆论翻盘、证据逆转、身份掉包',
      climax: '公开对线、强势反杀、舞台聚光',
      ending: '阶段胜利、棋局重排、下一轮博弈开启'
    },
    characterRoles: {
      protagonist: '带着现实目标和上升野心的核心行动者',
      heroine: '连接情感线、资源路径或社交关系的重要角色',
      mentor: '提供规则、资源和社会经验的引路人',
      rival: '同赛道竞争者或旧秩序既得利益者',
      villain: '代表资本、权势、圈层排斥力的对立者',
      companion: '团队成员、兄弟搭档、现实支撑者',
      mystery: '身份复杂、背后有局的关键人物'
    },
    worldElements: {
      faction: '公司、家族、组织、圈层联盟',
      location: '都市地标、办公区、夜场、旧城区',
      artifact: '芯片、合同、钥匙、黑卡',
      ability: '系统能力、异能、商业判断、情报处理',
      bloodline: '豪门身份、隐秘出身、天赋来源',
      curse: '债务、病症、协议束缚、舆论枷锁',
      secret: '旧案、家族秘辛、幕后交易',
      destiny: '逆袭轨迹、城市棋局、阶层跃迁'
    },
    uiStyle: {
      button: '按钮像高效工具台操作件，强调执行感和反馈速度。',
      tag: '标签适合信息条、状态角标和场景胶囊。',
      card: '卡片更像信息看板，结构利落，主次清楚。',
      divider: '分割线适合网格线、冷光切边和现代线框。',
      watermark: '水印适合楼宇轮廓、交通线、数字流。'
    }
  },
  fantasy: {
    key: 'fantasy',
    label: '东方幻想',
    description: '统一承接玄幻、仙侠、历史、西幻和武侠等更宏观的幻想叙事视觉。',
    tone: '厚重中带空灵、世界层级感强',
    colors: {
      bg: 'linear-gradient(180deg, #f2efe8 0%, #e3ddd2 100%)',
      panel: 'rgba(252, 249, 243, 0.9)',
      primary: '#8f5a2c',
      secondary: '#3d5564',
      accent: '#d4b174',
      muted: '#6f695f',
      text: '#2a241d',
      line: 'rgba(76, 61, 44, 0.14)',
      glow: 'rgba(169, 132, 76, 0.22)'
    },
    motifs: ['山门云海', '古纹金石', '月轮剑痕', '卷轴阵图'],
    chapterStages: {
      opening: '凡俗起点与大世界边界初现',
      awakening: '天赋、机缘、血脉或道缘显形',
      trial: '宗门、秘境、问心、江湖路试炼',
      encounter: '结识强者、旧缘、命定人物或宿敌',
      conflict: '门派、家国、因果、理念冲撞升级',
      crisis: '境界压制、道心动摇、秩序反噬',
      breakthrough: '悟道、破境、得宝、心境抬升',
      reversal: '前缘翻面、身份揭晓、阵营错位',
      climax: '大战、问剑、登阶、逆天破局',
      ending: '新境界开启或更大舞台铺垫'
    },
    characterRoles: {
      protagonist: '以成长、修行或家国命运为主轴的核心视角人物',
      heroine: '兼具情感牵引与世界层次补充的重要角色',
      mentor: '传授规则、点破迷障、提供世界上限参照的前辈',
      rival: '推动主角成长、制造压迫感的镜像强敌',
      villain: '代表旧秩序、执念、天命压制或更高层敌意的对立者',
      companion: '组队、问道、行走天地中的稳定同行者',
      mystery: '身份未明、携带秘闻与大局信息的关键人物'
    },
    worldElements: {
      faction: '宗门、王朝、世家、道脉、圣地',
      location: '秘境、古城、仙山、边荒、旧战场',
      artifact: '灵器、古碑、残卷、玉符、神兵',
      ability: '功法、术法、御剑、体质、神通',
      bloodline: '古族传承、仙骨道果、王体圣体',
      curse: '封印、天罚、誓约、因果反噬',
      secret: '上古真相、失落传承、家国旧史',
      destiny: '大世来临、天命争锋、飞升宿命'
    },
    uiStyle: {
      button: '按钮可像玉符、宗门令牌或卷轴题签，兼顾厚重与留白。',
      tag: '标签适合境界、势力、身份和道途标记。',
      card: '卡片像卷轴、玉简或阵图载体，边界稳定，信息层级明确。',
      divider: '分割线适合细金痕、剑意、水墨波纹和古纹刻痕。',
      watermark: '水印适合山门纹章、云纹、月轮、阵纹。'
    }
  },
  scifi: {
    key: 'scifi',
    label: '科幻末世',
    description: '承接科幻、末世与军事战争等偏系统秩序、科技压迫和生存演算的视觉主题。',
    tone: '冷峻、压迫、系统感强',
    colors: {
      bg: 'linear-gradient(180deg, #0d1422 0%, #131c2d 100%)',
      panel: 'rgba(18, 28, 45, 0.9)',
      primary: '#4cc8ff',
      secondary: '#7ad0ff',
      accent: '#9ef3b4',
      muted: '#8c9fb7',
      text: '#edf5ff',
      line: 'rgba(157, 191, 225, 0.18)',
      glow: 'rgba(76, 200, 255, 0.2)'
    },
    motifs: ['信标冷光', '废墟雾层', '数据面板', '战术网格'],
    chapterStages: {
      opening: '秩序崩塌、任务下达、生存规则抛出',
      awakening: '科技能力、装备权限、末世认知开启',
      trial: '战区试探、资源争夺、规则验证',
      encounter: '幸存者、军团、AI、异变存在相遇',
      conflict: '阵营、资源、火力与生存逻辑冲突升级',
      crisis: '补给断裂、据点沦陷、信号消失',
      breakthrough: '技术突破、战术升级、关键装置激活',
      reversal: '坐标反转、计划翻盘、隐藏真相上浮',
      climax: '总攻、撤离、终端对抗、文明抉择',
      ending: '阶段性重建、赛博秩序重排、下一片废墟出现'
    },
    characterRoles: {
      protagonist: '在规则系统和高压环境中不断进化的核心行动者',
      heroine: '连接情感、协作和阵营路线的重要角色',
      mentor: '提供战术、科技解释或生存原则的引导者',
      rival: '同样强势、但策略或立场对立的竞争者',
      villain: '控制资源、操纵秩序或推动崩坏的对立方',
      companion: '战术小队、求生同伴、固定协作成员',
      mystery: '携带机密坐标、实验真相或未知指令的人物'
    },
    worldElements: {
      faction: '军团、避难城、科研组织、联盟据点',
      location: '废墟、前哨站、轨道城、战区通道',
      artifact: '芯核、终端、模块、密钥、武装载具',
      ability: '异能、义体、机甲控制、战术推演',
      bloodline: '实验体来源、特种基因、军工世系',
      curse: '污染、辐射、协议锁、精神侵蚀',
      secret: '实验档案、文明遗留、战前黑幕',
      destiny: '人类火种、文明分岔、终局协议'
    },
    uiStyle: {
      button: '按钮像战术终端或控制面板按键，强调状态切换和科技描边。',
      tag: '标签适合稀有度、状态、阵营、危险级别标记。',
      card: '卡片更像战报面板、终端窗口和任务看板。',
      divider: '分割线适合扫描线、能量轨、信号线与断续刻度。',
      watermark: '水印适合雷达网格、卫星轨迹、废墟坐标。'
    }
  },
  mystery: {
    key: 'mystery',
    label: '悬疑灵异',
    description: '统一承接悬疑、惊悚和灵异叙事的压迫感、线索感与未知感。',
    tone: '压抑、克制、危险潜伏',
    colors: {
      bg: 'linear-gradient(180deg, #151a21 0%, #0f1318 100%)',
      panel: 'rgba(24, 29, 36, 0.9)',
      primary: '#6ea3c7',
      secondary: '#365168',
      accent: '#b58c59',
      muted: '#8d99a7',
      text: '#edf2f7',
      line: 'rgba(182, 198, 217, 0.16)',
      glow: 'rgba(110, 163, 199, 0.18)'
    },
    motifs: ['旧案纸页', '手电光斑', '封条红线', '走廊阴影'],
    chapterStages: {
      opening: '异常现象与线索入口抛出',
      awakening: '真相感知、诡异规则、危险认知形成',
      trial: '探查、试探、夜探或规则验证',
      encounter: '受害者、证人、怪异存在相遇',
      conflict: '人与人、人与异象、人与规则的冲突升级',
      crisis: '线索断裂、角色失控、死亡临近',
      breakthrough: '找到关键证据或规则漏洞',
      reversal: '嫌疑人反转、真相层级翻面、身份错位',
      climax: '封印、追凶、对质、正面对抗',
      ending: '阶段谜底揭开，但更深黑幕浮出'
    },
    characterRoles: {
      protagonist: '负责视角推进和真相拼接的核心人物',
      heroine: '可能是情感锚点，也可能是线索中枢或危险源',
      mentor: '提供规则解释、旧案背景、异异常识的人物',
      rival: '和主角抢时间、抢真相或理念相左的对手',
      villain: '制造案件、操控仪式或利用恐惧的反派',
      companion: '并肩调查、分担风险和验证线索的搭档',
      mystery: '身份飘忽、掌握关键碎片的危险人物'
    },
    worldElements: {
      faction: '调查组、民间组织、旧教派、幕后势力',
      location: '凶宅、废楼、旧街、停尸间',
      artifact: '录音带、符纸、旧照片、遗物',
      ability: '通灵、推演、感知、破局技巧',
      bloodline: '被诅咒家系、灵媒体质、遗传天赋',
      curse: '规则污染、鬼契、仪式后遗症',
      secret: '旧案真相、封存记录、禁忌历史',
      destiny: '命案循环、替身宿命、被选中的见证者'
    },
    uiStyle: {
      button: '按钮应克制、像调查终端或旧物开关，不宜太热闹。',
      tag: '标签适合做线索标记、危险等级、规则提示。',
      card: '卡片适合档案盒、线索墙、证据页感。',
      divider: '分割线适合旧纸折痕、暗线、封条痕迹。',
      watermark: '水印适合门牌号、录音波形、符咒残影。'
    }
  },
  game: {
    key: 'game',
    label: '游戏竞技',
    description: '强调系统反馈、数值成长、任务链和面板感的主视觉主题。',
    tone: '高反馈、规则清晰、面板化',
    colors: {
      bg: 'linear-gradient(180deg, #141b2d 0%, #101521 100%)',
      panel: 'rgba(24, 31, 49, 0.9)',
      primary: '#52c7ff',
      secondary: '#2f5f92',
      accent: '#79f3c6',
      muted: '#8ea0b8',
      text: '#eef5ff',
      line: 'rgba(156, 193, 230, 0.18)',
      glow: 'rgba(82, 199, 255, 0.22)'
    },
    motifs: ['HUD 面板', '像素切片', '能量描边', '任务提示框'],
    chapterStages: {
      opening: '新手村、开服、账号开局',
      awakening: '职业解锁、系统激活、天赋开启',
      trial: '副本、竞技、任务链初测',
      encounter: '队友、公会、BOSS、隐藏 NPC 相遇',
      conflict: '资源争夺、阵营对抗、榜单竞争升级',
      crisis: '团灭、掉级、封号危机、版本压制',
      breakthrough: '装备成型、技能突破、机制破解',
      reversal: '隐藏机制、反向利用规则、局势翻盘',
      climax: '首杀、决赛、公会大战、世界事件',
      ending: '版本收束、赛季结算、下一阶段更新预热'
    },
    characterRoles: {
      protagonist: '成长路线清楚、数值与策略都在推进的玩家主角',
      heroine: '既可能是搭档，也可能是关键职业位或攻略目标',
      mentor: '老玩家、教练、系统引导者、隐藏高手',
      rival: '天梯对手、公会敌手、同服竞争者',
      villain: '操盘公会、外挂势力、幕后策划型对立者',
      companion: '固定队、队友、工会骨干',
      mystery: '隐藏 NPC、测试服遗留者、匿名高手'
    },
    worldElements: {
      faction: '公会、战队、阵营、服务器联盟',
      location: '主城、副本、野区、竞技场',
      artifact: '装备、道具、芯片、皮肤、钥匙',
      ability: '职业技能、被动、连招、机制理解',
      bloodline: '隐藏职业、特殊天赋、稀有账号资格',
      curse: '负面状态、封印机制、版本惩罚',
      secret: '隐藏任务、世界彩蛋、策划埋线',
      destiny: '天命账号、冠军线、服务器格局改写'
    },
    uiStyle: {
      button: '按钮更像游戏面板按键，强调反馈、描边和状态切换。',
      tag: '标签适合做稀有度、职业、阵营、难度标记。',
      card: '卡片适合数据面板、任务面板和装备槽风格。',
      divider: '分割线适合能量条、像素线、电子描边。',
      watermark: '水印适合 HUD 网格、准星、任务雷达。'
    }
  },
  lightnovel: {
    key: 'lightnovel',
    label: '轻小说动漫',
    description: '强调角色氛围、轻盈情绪、日常节奏与插画感的主视觉主题。',
    tone: '轻快、清透、角色感强',
    colors: {
      bg: 'linear-gradient(180deg, #fff4fb 0%, #eef4ff 100%)',
      panel: 'rgba(255, 252, 255, 0.9)',
      primary: '#ff79b0',
      secondary: '#9153c6',
      accent: '#79c7ff',
      muted: '#7e7f98',
      text: '#2a2440',
      line: 'rgba(121, 108, 170, 0.14)',
      glow: 'rgba(255, 121, 176, 0.22)'
    },
    motifs: ['糖纸渐层', '学园便签', '星屑碎光', '角色边贴'],
    chapterStages: {
      opening: '日常切入、关系起点、设定抛钩',
      awakening: '情感变化、能力暴露、设定展开',
      trial: '社交试探、日常任务、轻冒险验证',
      encounter: '新角色登场、羁绊建立、修罗场开端',
      conflict: '情绪误会、阵营差异、关系对撞',
      crisis: '关系破裂、重大事件、情绪跌谷',
      breakthrough: '告白、和解、成长或能力升级',
      reversal: '设定翻面、关系认知反转、身份公开',
      climax: '情感高潮、舞台事件、世界观集中爆发',
      ending: '关系阶段落定、日常恢复或新篇章开启'
    },
    characterRoles: {
      protagonist: '情绪感知强、关系变化敏感的视角人物',
      heroine: '高辨识度、强角色魅力的核心人物',
      mentor: '提供认知、指导或轻喜剧平衡的年长角色',
      rival: '感情线、能力线或生活圈中的竞争者',
      villain: '不一定纯黑，常代表关系阻力或价值对立面',
      companion: '提供吐槽、陪伴、组队互动的日常伙伴',
      mystery: '气质特殊、身份反差强、后期设定关键的人物'
    },
    worldElements: {
      faction: '社团、学园、组织、异世界阵营',
      location: '教室、社团室、街区、异空间',
      artifact: '信物、饰品、契约物、变身器',
      ability: '异能、魔法、设定技能、情绪共鸣',
      bloodline: '特殊出身、贵族系谱、隐藏身份',
      curse: '契约代价、情绪诅咒、设定限制',
      secret: '身世秘密、校园旧闻、世界里侧',
      destiny: '命定相遇、世界修复、关系终局选择'
    },
    uiStyle: {
      button: '按钮适合轻巧、柔和、角色感明显的交互样式。',
      tag: '标签适合做关系状态、角色属性、章节氛围标记。',
      card: '卡片适合插画页、角色卡、剧情便签感布局。',
      divider: '分割线适合便签纸切边、星屑、细彩带。',
      watermark: '水印适合校徽、星轨、纸飞机、花瓣。'
    }
  }
};

export const genreKeys = [...GENRE_THEME_KEYS];

export const genreVisualSystems = genreKeys.map((key) => genreVisualSystemMap[key]);

export function getGenreVisualSystem(themeKey) {
  const normalizedThemeKey = normalizeGenreThemeKey(themeKey);
  return genreVisualSystemMap[normalizedThemeKey] || genreVisualSystemMap.lightnovel;
}
