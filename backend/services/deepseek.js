const axios = require('axios');

const GENRE_LABELS = {
  urban: '都市异能',
  fantasy: '玄幻修真',
  xianxia: '仙侠修真',
  scifi: '科幻末世',
  history: '历史穿越',
  game: '游戏竞技',
  mystery: '悬疑惊悚',
  sports: '体育竞技',
  lightnovel: '轻小说',
  fanfic: '同人',
  military: '军事',
  workplace: '职场',
  reality: '现实题材'
};

const SUBGENRE_LABELS = {
  urban_superpower: '超能力',
  urban_rebirth: '重生流',
  urban_system: '系统流',
  urban_medical: '医道流',
  urban_business: '商业流',
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
  mystery_horror: '灵异恐怖',
  mystery_detective: '侦探推理',
  mystery_survival: '无限求生',
  sports_basketball: '篮球',
  sports_football: '足球',
  sports_comprehensive: '综合体育',
  light_acg: '二次元',
  light_isekai: '异世界',
  light_school: '校园恋爱'
};

const PLATFORM_LABELS = {
  qidian: {
    name: '起点中文网',
    style: ['剧情推进明确', '角色成长清晰', '章节钩子要稳']
  },
  fanqie: {
    name: '番茄小说',
    style: ['开篇抓人', '节奏偏快', '爽点要密']
  },
  jinjiang: {
    name: '晋江文学城',
    style: ['人物关系细腻', '情绪递进自然', '互动要有张力']
  }
};

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(String(item))).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[,，、/\n]/)
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }
  return [];
}

function extractRoleNames(appearingRoles = []) {
  if (!Array.isArray(appearingRoles)) return [];
  return appearingRoles
    .map((item) => {
      if (typeof item === 'string') return normalizeText(item);
      if (item && typeof item === 'object') {
        return normalizeText(item.name || item.characterName || item.title || '');
      }
      return '';
    })
    .filter(Boolean);
}

function summarizeRoleExecution(roleExecution = []) {
  if (!Array.isArray(roleExecution)) return [];
  return roleExecution
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const role = normalizeText(item.role || item.name || '');
      if (!role) return '';
      const parts = [
        `角色：${role}`,
        normalizeText(item.baseline) ? `当前底色：${normalizeText(item.baseline)}` : '',
        normalizeText(item.chapter_function || item.chapterFunction) ? `本章职责：${normalizeText(item.chapter_function || item.chapterFunction)}` : '',
        normalizeText(item.dimension) ? `观察维度：${normalizeText(item.dimension)}` : '',
        normalizeText(item.direction) ? `变化方向：${normalizeText(item.direction)}` : '',
        normalizeText(item.scope) ? `变化层级：${normalizeText(item.scope)}` : '',
        normalizeText(item.confidence) ? `把握度：${normalizeText(item.confidence)}` : '',
        normalizeText(item.allowed_change || item.allowedChange) ? `允许变化：${normalizeText(item.allowed_change || item.allowedChange)}` : '',
        normalizeText(item.forbidden_change || item.forbiddenChange) ? `禁止变化：${normalizeText(item.forbidden_change || item.forbiddenChange)}` : ''
      ].filter(Boolean);
      return parts.join('；');
    })
    .filter(Boolean);
}

class DeepSeekService {
  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY;
    this.baseURL = 'https://api.deepseek.com/v1';

    if (!this.apiKey) {
      console.error('缺少 DEEPSEEK_API_KEY 配置');
      console.error('请在 backend/.env 中补充有效的 API Key');
      throw new Error('DEEPSEEK_API_KEY is not configured');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      timeout: 180000
    });
  }

  async generate(options) {
    const {
      prompt,
      model = 'deepseek-chat',
      temperature = 0.7,
      maxTokens = 4000,
      responseFormat = null
    } = options;

    try {
      const payload = {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
        stream: false
      };

      if (responseFormat && typeof responseFormat === 'object') {
        payload.response_format = responseFormat;
      }

      const response = await this.client.post('/chat/completions', payload);

      return {
        success: true,
        data: response.data,
        content: response.data.choices[0]?.message?.content || '',
        usage: response.data.usage || null
      };
    } catch (error) {
      console.error('DeepSeek API 调用失败:', error.message);

      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;

        let errorMessage = 'API 调用失败';
        if (status === 401) {
          errorMessage = 'API Key 无效或已过期';
        } else if (status === 429) {
          errorMessage = '请求过于频繁或额度不足';
        } else if (status === 500) {
          errorMessage = 'DeepSeek 服务内部错误';
        } else if (errorData?.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        }

        return {
          success: false,
          error: errorMessage,
          statusCode: status
        };
      }

      if (error.code === 'ECONNABORTED' || String(error.message || '').includes('timeout')) {
        return {
          success: false,
          error: '请求超时，模型生成时间过长',
          statusCode: 408
        };
      }

      if (String(error.message || '').includes('aborted')) {
        return {
          success: false,
          error: '请求被中断，请稍后重试',
          statusCode: 503
        };
      }

      return {
        success: false,
        error: `请求失败: ${error.message}`,
        statusCode: 500
      };
    }
  }

  buildCreativePrompt(params) {
    const {
      bookTitle,
      genre,
      subgenre,
      platform = 'qidian',
      template,
      chapterTitle,
      chapterSummary = '',
      outline,
      characters,
      appearingRoles = [],
      roleExecution = [],
      contextNotes = '',
      shuangTags = [],
      emotionIntensity = 70,
      colloquialLevel = 80,
      dialogueRatio = 30,
      wordCount = 2000,
      addCliffhanger = true,
      enhanceDialogue = true,
      avoidAIFeel = true,
      fastPace = false,
      detailedDesc = false
    } = params;

    const genreName = GENRE_LABELS[genre] || normalizeText(genre) || '未分类';
    const subgenreName = SUBGENRE_LABELS[subgenre] || normalizeText(subgenre);
    const platformInfo = PLATFORM_LABELS[platform] || PLATFORM_LABELS.qidian;
    const styleTemplate = normalizeText(template);
    const tags = normalizeArray(shuangTags);
    const roleNames = extractRoleNames(appearingRoles);
    const roleExecutionLines = summarizeRoleExecution(roleExecution);
    const minWords = Math.max(200, Math.floor(wordCount * 0.92));
    const maxWords = Math.max(minWords, Math.ceil(wordCount * 1.05));

    const promptParts = [
      `你现在要以 ${platformInfo.name} 网文作者的口吻，创作一章${subgenreName ? ` ${genreName} · ${subgenreName}` : ` ${genreName}`}小说正文。`,
      '这不是自由发挥，也不是随手续写，而是根据已给出的章节任务表，生成可以直接入库的下一章正文。',
      '',
      `平台风格参考：${platformInfo.style.join('、')}`,
      styleTemplate ? `写法模板：${styleTemplate}` : '',
      '',
      '写作要求：',
      `1. 目标字数为 ${wordCount} 字，优先贴近目标值。`,
      `2. 可接受范围控制在 ${minWords}-${maxWords} 字之间，宁可略短，不要明显超长。`,
      `3. 情绪强度参考：${emotionIntensity}%`,
      `4. 口语化程度参考：${colloquialLevel}%`,
      `5. 对话占比参考：${dialogueRatio}%`,
      tags.length > 0 ? `6. 爽点标签：${tags.join('、')}` : '6. 爽点标签：未额外指定',
      avoidAIFeel ? '7. 避免空泛总结、模板化抒情和明显 AI 腔。' : '',
      enhanceDialogue ? '8. 对话必须推动关系、信息或冲突，不能只用来凑字数。' : '',
      fastPace ? '9. 节奏偏快，尽快进入冲突、变化或关键推进。' : '',
      detailedDesc ? '10. 关键场景要补足动作、感官和环境细节。' : '',
      addCliffhanger ? '11. 章节结尾保留明确钩子、压力或未解决问题。' : '',
      '',
      '硬约束：',
      '- 只输出正文，不要输出标题、提纲、解释、注释或总结。',
      '- 情节必须围绕章节任务推进，不要偏题开支线。',
      '- 人物行为必须贴合既有设定，不能为了推进剧情强行降智。',
      roleNames.length > 0
        ? `- 本章角色姓名硬约束：只能使用已提供的人物体系 ${roleNames.join(' / ')}，严禁把主角或主要角色替换成其他名字。`
        : '- 严禁擅自改写主角或主要角色姓名，不能串入其他作品人物名。',
      '- 角色关系硬约束：如果上下文已明确角色身份、立场、性别或彼此关系，正文必须保持一致，不能擅自改写。',
      '- 世界观硬约束：只能使用当前作品已经给出的设定体系、势力结构、能力代价和冲突来源，不能套用外部模板。',
      '- 未经当前计划、上下文或上一章反馈明确挂接，不要突然引入会直接改写主线走向的高影响背景、角色、规则或目标。',
      '- 如必须补充新信息，也只能补充已有角色或已有设定的直接后果，而且要立刻服务本章任务，不能借机另开一条大支线。',
      '- 已有设定一旦在上下文中被赋予明确含义，正文必须沿用该含义，不能中途改写。',
      '- 如果规划里写了上章承接、情绪目标、伏笔和结尾钩子，正文里必须落地。',
      '- 角色相关约束分三层：角色执行要求负责“本章角色怎么演”；剧情线推进要求负责“本章剧情必须推进什么”；角色变化边界负责“角色不能在剧情线上越级变化到哪里”。',
      '- 三类约束的优先级固定为：第一优先级是剧情线角色变化边界，第二优先级是章节角色执行要求，第三优先级是角色底层资料。',
      '- 当角色执行要求与剧情线角色变化边界存在冲突时，必须优先遵守剧情线角色变化边界。',
      '- role_execution 只能决定角色在本章的具体表现方式，不能让角色变化突破 characterChangeBoundaries 限制。',
      '- 角色底层资料只用于保持长期性格、背景和动机一致，不能覆盖本章剧情线约束和章节执行要求。',
      roleExecutionLines.length > 0 ? '- 本章角色执行参数高于一般角色说明，若角色执行参数与泛化人物描写冲突，一律以角色执行参数为准。' : '',
      '- 不要为了凑字数重复表达同一信息。',
      '- 当本章任务已经完成、字数接近目标上限时，立即收束，不要继续追加尾声、回味或补充说明。',
      ''
    ].filter(Boolean);

    if (bookTitle) {
      promptParts.push(`书名：${bookTitle}`);
    }

    if (chapterTitle) {
      promptParts.push(`章节名：${chapterTitle}`);
    }

    if (chapterSummary) {
      promptParts.push(`章节摘要：${chapterSummary}`);
    }

    if (contextNotes) {
      promptParts.push('', `创作上下文：\n${contextNotes}`);
    }

    if (Array.isArray(appearingRoles) && appearingRoles.length > 0) {
      const roleText = appearingRoles
        .map((item, index) => {
          if (typeof item === 'string') {
            return `${index + 1}. ${normalizeText(item)}`;
          }
          if (item && typeof item === 'object') {
            const name = normalizeText(item.name || item.characterName || item.title || '');
            const role = normalizeText(item.role || item.summary || item.description || '');
            return [name, role].filter(Boolean).join('：');
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');

      if (roleText) {
        promptParts.push('', `本章出场角色：\n${roleText}`);
      }
    }

    if (roleExecutionLines.length > 0) {
      promptParts.push('', `本章角色执行参数：\n${roleExecutionLines.map((line, index) => `${index + 1}. ${line}`).join('\n')}`);
    }

    if (characters) {
      promptParts.push('', `角色设定参考：\n${characters}`);
    }

    promptParts.push('', `章节任务表：\n${outline}`);
    promptParts.push('', `再次强调：正文总字数尽量控制在 ${minWords}-${maxWords} 字之间，超过 ${maxWords} 字视为不合格。`);

    return promptParts.join('\n');
  }
}

module.exports = new DeepSeekService();
