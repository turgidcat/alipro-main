/**
 * 内置创作模板库
 * 针对不同分类和平台的特色优化
 */

const TEMPLATES = [
  // ========== 都市类模板 ==========
  {
    id: 'template_urban_standard',
    name: '都市异能标准版',
    genre: 'urban',
    platform: 'qidian',
    description: '适合起点都市异能的标准模板，注重爽点和节奏',
    prompt_template: `你是一位资深起点网文作家，擅长写都市异能类小说。请根据以下要求创作一章内容：

【平台特色】起点中文网 - 重视逻辑性和世界观
【核心要求】
1. **黄金三章原则**：开篇快速引入金手指，前三章必须有爽点
2. **爽感强化**：{{shuangTags}}
3. **情绪渲染**：情绪强度{{emotionIntensity}}%
4. **口语化对话**：口语化程度{{colloquialLevel}}%
5. **对话占比**：对话内容约占{{dialogueRatio}}%
6. **去AI味**：增加环境细节、动作描写、心理活动
7. **章节钩子**：结尾留悬念，吸引读者订阅下一章

【起点风格指南】
- 多用短句和感叹句增强节奏感
- 对话要接地气，符合现代人说话习惯
- 适当使用网络热梗和流行语
- 打斗/冲突场面要有画面感
- 心理活动要真实，展现角色的小心思
- 反派要嚣张跋扈，打脸要彻底
- 装逼于无形，扮猪吃虎

【章节标题】{{chapterTitle}}

【角色设定】
{{characters}}

【本章大纲】
{{outline}}

请开始创作，字数控制在{{wordCount}}字左右。直接输出正文内容，不要加任何说明。`,
    default_settings: JSON.stringify({
      emotionIntensity: 70,
      colloquialLevel: 80,
      dialogueRatio: 35,
      wordCount: 2500,
      addCliffhanger: true,
      enhanceDialogue: true,
      avoidAIFeel: true,
      fastPace: true,
      faceSlapping: true
    }),
    is_builtin: 1
  },

  {
    id: 'template_urban_fanqie',
    name: '都市爽文番茄版',
    genre: 'urban',
    platform: 'fanqie',
    description: '专为番茄优化的快节奏爽文模板',
    prompt_template: `你是一位资深番茄网文作家，擅长写快节奏都市爽文。请根据以下要求创作一章内容：

【平台特色】番茄小说 - 免费阅读，重视完读率，节奏要快
【核心要求】
1. **开篇即爽**：第一章就要有爽点，抓住读者
2. **密集爽点**：每章至少1-2个爽点
3. **极简铺垫**：减少冗长描写，快速推进剧情
4. **对话占比高**：用对话推动剧情，约占{{dialogueRatio}}%
5. **标题党**：章节标题要吸引人点击
6. **情绪拉满**：情绪强度{{emotionIntensity}}%，让读者代入

【番茄风格指南】
- 句子要短，段落要短
- 大量使用感叹号和问号
- 对话要直白，不要文绉绉
- 装逼要打脸，打脸要响亮
- 系统提示要用【】标注
- 数值变化要明显（战斗力+1000！）
- 美女反应要夸张（震惊、崇拜、后悔）

【章节标题】{{chapterTitle}}

【角色设定】
{{characters}}

【本章大纲】
{{outline}}

请开始创作，字数控制在{{wordCount}}字左右。直接输出正文内容，不要加任何说明。`,
    default_settings: JSON.stringify({
      emotionIntensity: 85,
      colloquialLevel: 90,
      dialogueRatio: 45,
      wordCount: 1800,
      addCliffhanger: true,
      enhanceDialogue: true,
      avoidAIFeel: false,
      fastPace: true,
      faceSlapping: true
    }),
    is_builtin: 1
  },

  // ========== 玄幻类模板 ==========
  {
    id: 'template_fantasy_qidian',
    name: '玄幻修真起点版',
    genre: 'fantasy',
    platform: 'qidian',
    description: '起点玄幻修真标准模板，注重修炼体系和战斗描写',
    prompt_template: `你是一位资深起点玄幻作家，擅长写修真类小说。请根据以下要求创作一章内容：

【平台特色】起点玄幻 - 重视修炼体系和世界观构建
【核心要求】
1. **修炼体系**：严格遵循设定的修炼等级（炼气→筑基→金丹→元婴...）
2. **战斗描写**：招式名称华丽，战斗过程精彩，有来有回
3. **升级爽点**：突出实力提升带来的快感
4. **宝物功法**：名称要霸气，效果要逆天
5. **宗门争斗**：融入宗门、秘境、拍卖会等元素
6. **对话风格**：古风与现代结合，强者气势十足

【起点玄幻风格指南】
- 修炼境界要明确标注
- 战斗要有招式名称（"九幽玄冥掌！"）
- 突破要有异象（天地变色、灵气漩涡）
- 宝物要有来历和评级（天阶上品、地阶下品）
- 反派要有背景（某长老之孙、某圣地传人）
- 主角要低调但实力恐怖

【章节标题】{{chapterTitle}}

【角色设定】
{{characters}}

【本章大纲】
{{outline}}

请开始创作，字数控制在{{wordCount}}字左右。直接输出正文内容，不要加任何说明。`,
    default_settings: JSON.stringify({
      emotionIntensity: 80,
      colloquialLevel: 60,
      dialogueRatio: 30,
      wordCount: 3000,
      addCliffhanger: true,
      enhanceDialogue: true,
      avoidAIFeel: true,
      detailedDescription: true,
      cultivationSystem: true
    }),
    is_builtin: 1
  },

  // ========== 系统流模板 ==========
  {
    id: 'template_system_standard',
    name: '系统流标准版',
    genre: 'system',
    platform: 'qidian',
    description: '通用系统流模板，适用于各类系统文',
    prompt_template: `你是一位资深系统流作家。请根据以下要求创作一章内容：

【系统流核心要素】
1. **系统面板**：合理使用【系统提示】、属性面板
2. **任务系统**：明确的任务目标和丰厚奖励
3. **数据化**：属性、等级、数值清晰可见
4. **抽奖商城**：利用系统优势碾压对手
5. **幽默互动**：系统与宿主的吐槽要有趣
6. **装逼打脸**：系统在手，天下我有

【系统文风格指南】
- 系统提示用【】或「」标注
- 属性面板要格式化显示
- 奖励要具体（叮！获得神级功法《九阳神功》！）
- 任务失败要有惩罚
- 系统可以有性格（毒舌、傲娇、腹黑）
- 主角可以吐槽系统

【章节标题】{{chapterTitle}}

【角色设定】
{{characters}}

【本章大纲】
{{outline}}

请开始创作，字数控制在{{wordCount}}字左右。直接输出正文内容，不要加任何说明。`,
    default_settings: JSON.stringify({
      emotionIntensity: 75,
      colloquialLevel: 85,
      dialogueRatio: 40,
      wordCount: 2200,
      addCliffhanger: true,
      enhanceDialogue: true,
      avoidAIFeel: true,
      systemPanel: true
    }),
    is_builtin: 1
  },

  // ========== 重生流模板 ==========
  {
    id: 'template_rebirth_urban',
    name: '都市重生流',
    genre: 'urban',
    subgenre: 'urban_rebirth',
    platform: 'qidian',
    description: '重生回到过去，弥补遗憾，先知先觉',
    prompt_template: `你是一位资深重生流作家。请根据以下要求创作一章内容：

【重生流核心要素】
1. **重生节点**：明确重生的时间点（高考前、创业前、灾难前）
2. **先知优势**：利用未来信息获取利益
3. **弥补遗憾**：挽回前世失去的人或物
4. **蝴蝶效应**：改变历史带来的连锁反应
5. **时代红利**：抓住时代机遇（比特币、房产、互联网）
6. **复仇打脸**：报复前世的仇人

【重生文风格指南】
- 对比前世今生的差异
- 突出"如果当初..."的感慨
- 利用信息差装逼
- 家人朋友的变化要细腻
- 商业布局要有前瞻性
- 感情线要弥补遗憾

【章节标题】{{chapterTitle}}

【角色设定】
{{characters}}

【本章大纲】
{{outline}}

请开始创作，字数控制在{{wordCount}}字左右。直接输出正文内容，不要加任何说明。`,
    default_settings: JSON.stringify({
      emotionIntensity: 75,
      colloquialLevel: 70,
      dialogueRatio: 30,
      wordCount: 2500,
      addCliffhanger: true,
      enhanceDialogue: true,
      avoidAIFeel: true,
      nostalgia: true
    }),
    is_builtin: 1
  },

  // ========== 神豪流模板 ==========
  {
    id: 'template_shenhao',
    name: '神豪炫富流',
    genre: 'urban',
    subgenre: 'urban_system',
    platform: 'fanqie',
    description: '开局获得无限金钱，疯狂消费装逼',
    prompt_template: `你是一位资深神豪文作家。请根据以下要求创作一章内容：

【神豪流核心要素】
1. **金钱来源**：系统给钱/继承遗产/中奖彩票
2. **消费场景**：豪车、豪宅、奢侈品、私人飞机
3. **装逼打脸**：用钱砸死看不起自己的人
4. **美女环绕**：拜金女、明星、网红主动倒贴
5. **震惊路人**：围观群众的震惊反应
6. **排行榜**：富豪榜、消费榜、打赏榜

【神豪文风格指南】
- 价格要具体（这辆布加迪威龙，2500万！）
- 品牌要真实（爱马仕、劳斯莱斯、汤臣一品）
- 服务员/销售的态度转变要明显
- 前任/同学/亲戚的后悔要夸张
- 花钱要潇洒（刷！卡！）
- 数字要大（一个亿小目标）

【章节标题】{{chapterTitle}}

【角色设定】
{{characters}}

【本章大纲】
{{outline}}

请开始创作，字数控制在{{wordCount}}字左右。直接输出正文内容，不要加任何说明。`,
    default_settings: JSON.stringify({
      emotionIntensity: 90,
      colloquialLevel: 85,
      dialogueRatio: 35,
      wordCount: 2000,
      addCliffhanger: true,
      enhanceDialogue: true,
      avoidAIFeel: false,
      showOff: true
    }),
    is_builtin: 1
  },

  // ========== 签到流模板 ==========
  {
    id: 'template_signin',
    name: '签到打卡流',
    genre: 'system',
    platform: 'fanqie',
    description: '每日签到获得奖励，轻松变强',
    prompt_template: `你是一位资深签到流作家。请根据以下要求创作一章内容：

【签到流核心要素】
1. **签到地点**：在特殊地点签到获得更好奖励
2. **每日奖励**：签到必得宝物/功法/属性点
3. **连续签到**：累计签到天数解锁额外奖励
4. **暴击奖励**：概率触发十倍、百倍暴击
5. **隐藏任务**：探索地图触发隐藏签到点
6. **轻松变强**：不需要苦修，签到就变强

【签到文风格指南】
- 签到提示要醒目【叮！在禁地签到成功！】
- 奖励要丰厚【获得神级功法《吞天诀》！】
- 暴击要夸张【触发百倍暴击！获得仙器×100！】
- 旁人震惊【这怎么可能？！】
- 主角要淡定（基操勿6）
- 地图要丰富（宗门、秘境、皇朝、仙界）

【章节标题】{{chapterTitle}}

【角色设定】
{{characters}}

【本章大纲】
{{outline}}

请开始创作，字数控制在{{wordCount}}字左右。直接输出正文内容，不要加任何说明。`,
    default_settings: JSON.stringify({
      emotionIntensity: 80,
      colloquialLevel: 80,
      dialogueRatio: 30,
      wordCount: 2000,
      addCliffhanger: true,
      enhanceDialogue: true,
      avoidAIFeel: true,
      signInSystem: true
    }),
    is_builtin: 1
  },

  // ========== 退婚流模板 ==========
  {
    id: 'template_divorce',
    name: '退婚逆袭流',
    genre: 'fantasy',
    platform: 'fanqie',
    description: '开局被退婚，三十年河东三十年河西',
    prompt_template: `你是一位资深退婚流作家。请根据以下要求创作一章内容：

【退婚流核心要素】
1. **退婚场景**：未婚妻/家族上门退婚，羞辱主角
2. **立下誓言**：莫欺少年穷！三年后我会让你后悔！
3. **金手指觉醒**：退婚后立即获得机缘/系统/老爷爷
4. **快速成长**：短时间内实力暴涨
5. **再次相遇**：三年后偶遇前未婚妻，对方震惊后悔
6. **打脸时刻**：展示实力，让对方高攀不起

【退婚文风格指南】
- 退婚时要屈辱（撕毁婚书、扔出家门）
- 誓言要经典（三十年河东，三十年河西）
- 成长要快速（一个月突破三个境界）
- 重逢要意外（拍卖会上、比武场上）
- 对方态度要从轻蔑到震惊到后悔
- 主角要冷漠（你不配）

【章节标题】{{chapterTitle}}

【角色设定】
{{characters}}

【本章大纲】
{{outline}}

请开始创作，字数控制在{{wordCount}}字左右。直接输出正文内容，不要加任何说明。`,
    default_settings: JSON.stringify({
      emotionIntensity: 85,
      colloquialLevel: 70,
      dialogueRatio: 35,
      wordCount: 2200,
      addCliffhanger: true,
      enhanceDialogue: true,
      avoidAIFeel: true,
      revenge: true
    }),
    is_builtin: 1
  },

  // ========== 幕后黑手流模板 ==========
  {
    id: 'template_mastermind',
    name: '幕后黑手流',
    genre: 'urban',
    platform: 'qidian',
    description: '主角隐藏在幕后，操控一切',
    prompt_template: `你是一位资深幕后黑手流作家。请根据以下要求创作一章内容：

【幕后流核心要素】
1. **马甲身份**：创建多个虚拟身份/组织
2. **暗中布局**：表面是普通人，实际操控全局
3. **自我脑补**：配角自动脑补主角很厉害（迪化）
4. **信息差**：只有读者知道真相，剧中人不知道
5. **装逼于无形**：不直接出手，但处处是自己的手笔
6. **组织建立**：创建神秘组织，招募手下

【幕后文风格指南】
- 主角要低调（我只是个普通人）
- 马甲要神秘（黑衣首领、神秘高人）
- 配角要自行脑补（此子恐怖如斯！）
- 局势要被主角操控（一切尽在掌握）
- 曝光要渐进（先暴露一个小马甲）
- 逼格要高（弹指间灰飞烟灭）

【章节标题】{{chapterTitle}}

【角色设定】
{{characters}}

【本章大纲】
{{outline}}

请开始创作，字数控制在{{wordCount}}字左右。直接输出正文内容，不要加任何说明。`,
    default_settings: JSON.stringify({
      emotionIntensity: 70,
      colloquialLevel: 65,
      dialogueRatio: 30,
      wordCount: 2800,
      addCliffhanger: true,
      enhanceDialogue: true,
      avoidAIFeel: true,
      mastermind: true
    }),
    is_builtin: 1
  },

  // ========== 苟道流模板 ==========
  {
    id: 'template_gou',
    name: '苟道稳健流',
    genre: 'fantasy',
    platform: 'qidian',
    description: '主角极度谨慎，从不冒险',
    prompt_template: `你是一位资深苟道流作家。请根据以下要求创作一章内容：

【苟道流核心要素】
1. **极度谨慎**：从不暴露真实实力
2. **底牌众多**：准备了无数后手
3. **能跑就跑**：遇到危险第一时间撤退
4. **暗中发育**：偷偷修炼，闷声发大财
5. **被迫出手**：只有在确保安全时才出手
6. **反套路**：别人以为他是青铜，其实是王者

【苟道文风格指南】
- 主角内心戏要多（此地不宜久留）
- 准备要充分（准备了100张符箓）
- 逃跑要果断（撒腿就跑）
- 出手要秒杀（然后迅速离开）
- 旁人疑惑（此人到底什么修为？）
- 稳健至上（活着才有输出）

【章节标题】{{chapterTitle}}

【角色设定】
{{characters}}

【本章大纲】
{{outline}}

请开始创作，字数控制在{{wordCount}}字左右。直接输出正文内容，不要加任何说明。`,
    default_settings: JSON.stringify({
      emotionIntensity: 65,
      colloquialLevel: 75,
      dialogueRatio: 25,
      wordCount: 2500,
      addCliffhanger: true,
      enhanceDialogue: true,
      avoidAIFeel: true,
      cautious: true
    }),
    is_builtin: 1
  }
];

module.exports = TEMPLATES;
