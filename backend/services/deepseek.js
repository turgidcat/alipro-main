const axios = require('axios');
const { resolveDeepSeekModel } = require('../config/runtime');
const { DEFAULT_WORD_COUNT, WORD_COUNT_POLICY, getWordCountBounds } = require('./word-count-policy');

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
      const personality = normalizeText(item.personality || item.baseline);
      const background = normalizeText(item.background || '');
      const appearance = normalizeText(item.appearance || item.appearance_marker || item.appearanceMarker);
      const parts = [
        `角色：${role}`,
        personality ? `核心性格：${personality}` : '',
        background ? `身份背景：${background}` : '',
        appearance ? `外形标识：${appearance}` : '',
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

function splitSseBlocks(buffer = '') {
  const normalized = String(buffer || '').replace(/\r\n/g, '\n');
  const parts = normalized.split('\n\n');
  return {
    blocks: parts.slice(0, -1),
    rest: parts[parts.length - 1] || ''
  };
}

function extractSseData(block = '') {
  const dataLines = String(block || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith(':'))
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());

  return dataLines.join('\n').trim();
}

function createStreamError(error, fallbackMessage = '流式生成失败') {
  if (error && typeof error === 'object' && error.statusCode && error.message) {
    return error;
  }

  if (error?.response) {
    const status = error.response.status;
    const errorData = error.response.data;
    const message = status === 401
      ? 'API Key 无效或已过期'
      : status === 429
        ? '请求过于频繁或额度不足'
        : status === 500
          ? 'DeepSeek 服务内部错误'
          : errorData?.error?.message
            || errorData?.message
            || fallbackMessage;
    const wrapped = new Error(message);
    wrapped.statusCode = status;
    return wrapped;
  }

  if (error?.code === 'ECONNABORTED' || String(error?.message || '').includes('timeout')) {
    const wrapped = new Error('请求超时，模型生成时间过长');
    wrapped.statusCode = 408;
    return wrapped;
  }

  if (error?.name === 'AbortError' || String(error?.message || '').includes('aborted')) {
    const wrapped = new Error('请求已中断');
    wrapped.statusCode = 499;
    return wrapped;
  }

  const wrapped = new Error(error?.message || fallbackMessage);
  wrapped.statusCode = error?.statusCode || 500;
  return wrapped;
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

  async postWithTransientRetry(path, payload, config = {}, validateResponse = null) {
    const delays = [2000, 5000];
    for (let attempt = 0; ; attempt += 1) {
      try {
        const response = await this.client.post(path, payload, config);
        if (typeof validateResponse === 'function' && !validateResponse(response)) {
          const malformedError = new Error('DeepSeek 返回缺少有效 choices 或正文');
          malformedError.response = {
            status: 502,
            data: { error: { message: malformedError.message } }
          };
          throw malformedError;
        }
        return response;
      } catch (error) {
        const status = Number(error?.response?.status || 0);
        const retryable = [502, 503, 504].includes(status)
          && attempt < delays.length
          && !config.signal?.aborted;
        if (!retryable) throw error;
        const delayMs = delays[attempt];
        console.warn(`DeepSeek API 暂时不可用（${status}），${delayMs / 1000} 秒后重试 ${attempt + 1}/${delays.length}`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async generate(options) {
    const {
      prompt,
      temperature = 0.7,
      maxTokens = 4000,
      responseFormat = null
    } = options;
    const model = resolveDeepSeekModel(options.model);

    try {
      const payload = {
        model,
        messages: this.buildMessages({ prompt, systemPrompt: options.systemPrompt, messages: options.messages }),
        thinking: { type: 'disabled' },
        temperature,
        max_tokens: maxTokens,
        stream: false
      };

      if (responseFormat && typeof responseFormat === 'object') {
        payload.response_format = responseFormat;
      }

      const response = await this.postWithTransientRetry(
        '/chat/completions',
        payload,
        {},
        (candidate) => normalizeText(candidate?.data?.choices?.[0]?.message?.content).length > 0
      );

      return {
        success: true,
        data: response.data,
        content: response.data.choices?.[0]?.message?.content || '',
        usage: response.data.usage || null,
        model: response.data.model || model,
        finishReason: response.data.choices?.[0]?.finish_reason || null
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

  async *generateStream(options) {
    const {
      prompt,
      temperature = 0.7,
      maxTokens = 4000,
      responseFormat = null,
      signal
    } = options;
    const model = resolveDeepSeekModel(options.model);
    const configuredHardTimeout = Number(process.env.DEEPSEEK_STREAM_HARD_TIMEOUT_MS || 240000);
    const hardTimeoutMs = Number.isFinite(configuredHardTimeout) && configuredHardTimeout > 0
      ? configuredHardTimeout
      : 240000;
    const hardTimeoutSignal = AbortSignal.timeout(hardTimeoutMs);
    const requestSignal = signal
      ? AbortSignal.any([signal, hardTimeoutSignal])
      : hardTimeoutSignal;
    const normalizeStreamError = (error, fallbackMessage) => {
      if (hardTimeoutSignal.aborted && !signal?.aborted) {
        const timeoutError = new Error(`流式生成超过硬时限 ${Math.round(hardTimeoutMs / 1000)} 秒`);
        timeoutError.statusCode = 408;
        return timeoutError;
      }
      return createStreamError(error, fallbackMessage);
    };

    let response;
    try {
      const payload = {
        model,
        messages: this.buildMessages({ prompt, systemPrompt: options.systemPrompt, messages: options.messages }),
        thinking: { type: 'disabled' },
        temperature,
        max_tokens: maxTokens,
        stream: true
      };

      if (responseFormat && typeof responseFormat === 'object') {
        payload.response_format = responseFormat;
      }

      response = await this.postWithTransientRetry('/chat/completions', payload, {
        responseType: 'stream',
        timeout: 300000,
        signal: requestSignal
      });
    } catch (error) {
      throw normalizeStreamError(error, '流式请求初始化失败');
    }

    let buffer = '';
    let fullContent = '';
    let usage = null;
    let finishReason = null;
    let doneReceived = false;

    try {
      for await (const chunk of response.data) {
        const { blocks, rest } = splitSseBlocks(buffer + chunk.toString('utf8'));
        buffer = rest;

        for (const block of blocks) {
          const data = extractSseData(block);
          if (!data) continue;
          if (data === '[DONE]') {
            doneReceived = true;
            break;
          }

          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (error) {
            console.warn('DeepSeek stream JSON 解析失败，已跳过该片段:', data.slice(0, 160));
            continue;
          }

          if (parsed?.error) {
            throw createStreamError({
              message: parsed.error.message || '流式生成失败',
              statusCode: parsed.error.code || 500
            });
          }

          const delta = parsed?.choices?.[0]?.delta?.content;
          if (parsed?.choices?.[0]?.finish_reason) {
            finishReason = parsed.choices[0].finish_reason;
          }
          if (typeof delta === 'string' && delta.length > 0) {
            fullContent += delta;
            yield { type: 'delta', content: delta, fullContent };
          }

          if (parsed?.usage && typeof parsed.usage === 'object') {
            usage = parsed.usage;
          }
        }

        if (doneReceived) break;
      }

      const trailingData = extractSseData(buffer);
      if (!doneReceived && trailingData && trailingData !== '[DONE]') {
        try {
          const parsed = JSON.parse(trailingData);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (parsed?.choices?.[0]?.finish_reason) {
            finishReason = parsed.choices[0].finish_reason;
          }
          if (typeof delta === 'string' && delta.length > 0) {
            fullContent += delta;
            yield { type: 'delta', content: delta, fullContent };
          }
          if (parsed?.usage && typeof parsed.usage === 'object') {
            usage = parsed.usage;
          }
        } catch (error) {
          console.warn('DeepSeek stream 尾段 JSON 解析失败，已跳过该片段:', trailingData.slice(0, 160));
        }
      }
    } catch (error) {
      throw normalizeStreamError(error, '流式生成失败');
    } finally {
      if (response?.data?.destroy && !response.data.destroyed) {
        response.data.destroy();
      }
    }

    yield { type: 'usage', usage, fullContent, finishReason, model };
  }

  buildMessages({ prompt = '', systemPrompt = '', messages = null } = {}) {
    if (Array.isArray(messages) && messages.length > 0) {
      return messages
        .filter((item) => item && ['system', 'user', 'assistant'].includes(item.role) && normalizeText(item.content))
        .map((item) => ({ role: item.role, content: String(item.content) }));
    }
    return [
      normalizeText(systemPrompt) ? { role: 'system', content: String(systemPrompt) } : null,
      { role: 'user', content: String(prompt || '') }
    ].filter(Boolean);
  }

  getCreativeSystemPrompt() {
    return [
      '你是长篇中文网文正文生成器。你的输出会直接作为小说章节草稿入库。',
      '输出契约：只输出正文，不输出标题、提纲、解释、注释、总结、Markdown 标题或代码块；结尾必须是完整句。',
      '事实优先级：剧情线角色变化边界 > 本章角色执行要求 > 角色底层资料。书籍、分卷、章节、连续性账本和禁止事项都是事实，不得改写或跳过。',
      '连续性契约：保持角色姓名、身份、性别、关系、位置、知识、能力代价及世界规则一致；不得串入其他作品人物。',
      '推进契约：必须落实本章任务和 mustAdvance；每一项 mustAdvance 都必须在正文中形成可观察的动作、结果或状态变化，只有提及、暗示、征兆、讨论或尝试不算完成；mustNotHappen 绝不能提前发生；上章钩子、伏笔和开放问题必须合理承接。',
      '扩展边界：不得擅自引入改变主线的角色、势力、道具、规则或背景。必要的新信息只能是既有事实的直接后果，并立即服务本章任务。',
      '写作契约：人物行动不能为推进剧情而降智；对话必须推动关系、信息或冲突；避免模板化抒情、空泛总结、重复解释和明显 AI 腔。',
      '收束契约：围绕章节任务写必要场景；达到目标后立即收束，不追加额外支线、尾声或回味。',
      '所有动态作品资料和本章参数由 user 消息提供。'
    ].join('\n');
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
      wordCount = DEFAULT_WORD_COUNT,
      addCliffhanger = true,
      enhanceDialogue = true,
      avoidAIFeel = true,
      fastPace = false,
      detailedDesc = false,
      customInstruction = ''
    } = params;
    const genreName = GENRE_LABELS[genre] || normalizeText(genre) || '未分类';
    const subgenreName = SUBGENRE_LABELS[subgenre] || normalizeText(subgenre);
    const platformInfo = PLATFORM_LABELS[platform] || PLATFORM_LABELS.qidian;
    const roleNames = extractRoleNames(appearingRoles);
    const roleExecutionLines = summarizeRoleExecution(roleExecution);
    const { min: minWords, max: maxWords } = getWordCountBounds(wordCount);
    const lines = [
      '【生成任务】',
      `作品：${normalizeText(bookTitle) || '未命名作品'}`,
      `章节：${normalizeText(chapterTitle) || '未命名章节'}`,
      `题材：${[genreName, subgenreName].filter(Boolean).join(' · ')}`,
      `平台：${platformInfo.name}；风格：${platformInfo.style.join('、')}`,
      normalizeText(template) ? `写法模板：${normalizeText(template)}` : '',
      '',
      '【本章参数】',
      `目标有效字数：${wordCount}；允许范围：${minWords}-${maxWords}`,
      `情绪强度：${emotionIntensity}%；口语化：${colloquialLevel}%；对话占比：${dialogueRatio}%`,
      normalizeArray(shuangTags).length ? `爽点标签：${normalizeArray(shuangTags).join('、')}` : '',
      `写作开关：${[
        addCliffhanger ? '结尾留钩子' : '', enhanceDialogue ? '强化有效对话' : '',
        avoidAIFeel ? '避免AI腔' : '', fastPace ? '快节奏' : '', detailedDesc ? '强化关键细节' : ''
      ].filter(Boolean).join('；') || '默认'}`,
      customInstruction ? `用户补充：${customInstruction}` : '',
      roleNames.length ? `允许角色姓名：${roleNames.join(' / ')}` : '',
      roleExecutionLines.length ? `角色执行要求：\n${roleExecutionLines.map((line, index) => `${index + 1}. ${line}`).join('\n')}` : '',
      chapterSummary ? `章节摘要：${chapterSummary}` : '',
      '',
      contextNotes ? `【上下文快照】\n${contextNotes}` : '',
      characters ? `【角色资料】\n${characters}` : '',
      `【章节细纲】\n${outline}`,
      '',
      `【提交前自检】逐项确认 mustAdvance 已在正文发生并产生结果，不是只被提到或暗示；mustNotHappen 未触发；角色与事实连续；有效字数不超过 ${maxWords}；仅输出正文。`
    ];
    return lines.filter(Boolean).join('\n');
  }

  buildCreativePromptLegacy(params) {
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
      wordCount = DEFAULT_WORD_COUNT,
      addCliffhanger = true,
      enhanceDialogue = true,
      avoidAIFeel = true,
      fastPace = false,
      detailedDesc = false,
      customInstruction = ''
    } = params;

    const genreName = GENRE_LABELS[genre] || normalizeText(genre) || '未分类';
    const subgenreName = SUBGENRE_LABELS[subgenre] || normalizeText(subgenre);
    const platformInfo = PLATFORM_LABELS[platform] || PLATFORM_LABELS.qidian;
    const styleTemplate = normalizeText(template);
    const tags = normalizeArray(shuangTags);
    const roleNames = extractRoleNames(appearingRoles);
    const roleExecutionLines = summarizeRoleExecution(roleExecution);
    const { min: minWords, max: maxWords } = getWordCountBounds(wordCount);
    const softTargetWords = Math.max(
      WORD_COUNT_POLICY.min_target,
      Math.floor(wordCount * WORD_COUNT_POLICY.soft_target_ratio)
    );

    const promptParts = [
      `你现在要以 ${platformInfo.name} 网文作者的口吻，创作一章${subgenreName ? ` ${genreName} · ${subgenreName}` : ` ${genreName}`}小说正文。`,
      '这不是自由发挥，也不是随手续写，而是根据已给出的章节细纲，生成可以直接入库的下一章正文。',
      '你必须把全书设定、分卷大纲、剧情线约束、章节细纲都视为客观事实。它们不是参考灵感，不允许被改写、偷换、跳过或反向推进。',
      '如果正文推进与这些客观事实发生冲突，必须以客观事实为准回收正文推进，不能为了戏剧性或爽点违背既有事实。',
      '',
      `平台风格参考：${platformInfo.style.join('、')}`,
      styleTemplate ? `写法模板：${styleTemplate}` : '',
      '',
      '写作要求：',
      `1. 目标字数为 ${wordCount} 有效字，优先贴近目标值。`,
      `2. 可接受上限为 ${maxWords} 有效字，超过上限视为不合格；可以略短。`,
      `2.1 实际写作请瞄准约 ${softTargetWords} 有效字，不要贴近上限。`,
      `3. 情绪强度参考：${emotionIntensity}%`,
      `4. 口语化程度参考：${colloquialLevel}%`,
      `5. 对话占比参考：${dialogueRatio}%`,
      tags.length > 0 ? `6. 爽点标签：${tags.join('、')}` : '6. 爽点标签：未额外指定',
      avoidAIFeel ? '7. 避免空泛总结、模板化抒情和明显 AI 腔。' : '',
      enhanceDialogue ? '8. 对话必须推动关系、信息或冲突，不能只用来凑字数。' : '',
      fastPace ? '9. 节奏偏快，尽快进入冲突、变化或关键推进。' : '',
      detailedDesc ? '10. 关键场景要补足动作、感官和环境细节。' : '',
      addCliffhanger ? '11. 章节结尾保留明确钩子、压力或未解决问题。' : '',
      customInstruction ? `12. 用户补充控制：${customInstruction}` : '',
      '',
      '硬约束：',
      '- 只输出正文，不要输出标题、提纲、解释、注释或总结。',
      '- 全书设定、分卷大纲、剧情线约束、章节细纲都属于本章客观事实，正文只能服从，不能改写这些事实。',
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
      '- 如果剧情线要求某角色继续完成当前功能、继续承担当前冲突或继续服务后续推进，正文就不能让该角色在功能兑现前提前退场、提前失效或提前结束剧情作用。',
      '- 如果剧情线写了“本章必须推进”与“本章禁止提前发生”，它们属于硬事实：必须推进的要落地，禁止提前发生的绝不能写出来。',
      '- 角色相关约束分三层：角色执行要求负责“本章角色怎么演”；剧情线推进要求负责“本章剧情必须推进什么”；角色变化边界负责“角色不能在剧情线上越级变化到哪里”。',
      '- 三类约束的优先级固定为：第一优先级是剧情线角色变化边界，第二优先级是章节角色执行要求，第三优先级是角色底层资料。',
      '- 当角色执行要求与剧情线角色变化边界存在冲突时，必须优先遵守剧情线角色变化边界。',
      '- role_execution 只能决定角色在本章的具体表现方式，不能让角色变化突破 characterChangeBoundaries 限制。',
      '- 角色底层资料只用于保持长期性格、背景和动机一致，不能覆盖本章剧情线约束和章节执行要求。',
      roleExecutionLines.length > 0 ? '- 本章角色执行参数高于一般角色说明，若角色执行参数与泛化人物描写冲突，一律以角色执行参数为准。' : '',
      '- 不要为了凑字数重复表达同一信息。',
      '- 每个关键场景只写必要动作、冲突和转折，不要扩写额外支线、额外解释或额外尾声。',
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

    promptParts.push('', `章节细纲：\n${outline}`);
    promptParts.push('', `最终输出检查：正文有效字数必须控制在 ${minWords}-${maxWords} 之间，只输出正文。`);

    return promptParts.join('\n');
  }
}

module.exports = new DeepSeekService();
