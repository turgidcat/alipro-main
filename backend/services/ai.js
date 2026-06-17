const axios = require('axios');

class AIService {
  constructor() {
    // DeepSeek配置
    this.deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    this.deepseekBaseURL = 'https://api.deepseek.com/v1';

    // 阿里云百炼配置
    this.aliyunApiKey = process.env.ALIYUN_BAILIAN_API_KEY;
    this.aliyunBaseURL = 'https://dashscope.aliyuncs.com/api/v1';

    // 默认使用DeepSeek
    this.defaultProvider = 'deepseek';
  }

  /**
   * 生成内容 - 自动选择最佳模型
   * @param {Object} options - 生成选项
   * @param {string} options.prompt - 提示词
   * @param {string} options.task - 任务类型（creative/naming/outline等）
   * @param {number} options.temperature - 温度参数
   * @param {number} options.maxTokens - 最大token数
   * @returns {Promise<Object>} API响应
   */
  async generate(options) {
    const { prompt, task = 'creative', temperature = 0.7, maxTokens = 4000 } = options;

    // 根据任务类型选择模型
    let provider = this.defaultProvider;
    let model = 'deepseek-chat';

    // 对于创意命名任务，优先使用阿里云百炼的Qwen-Max模型（如果可用）
    if (task === 'naming' && this.aliyunApiKey) {
      provider = 'aliyun';
      model = 'qwen-max'; // 使用qwen-max模型，创意能力更强
    }

    console.log(`🤖 [AI服务] 使用 ${provider} (${model}) 处理 ${task} 任务`);

    try {
      if (provider === 'aliyun') {
        return await this.callAliyun(model, prompt, temperature, maxTokens);
      } else {
        return await this.callDeepSeek(model, prompt, temperature, maxTokens);
      }
    } catch (error) {
      console.error(`❌ [AI服务] ${provider} 调用失败:`, error.message);

      // 如果阿里云失败，降级到DeepSeek
      if (provider === 'aliyun' && this.deepseekApiKey) {
        console.log('⚠️ [AI服务] 降级到 DeepSeek');
        return await this.callDeepSeek('deepseek-chat', prompt, temperature, maxTokens);
      }

      throw error;
    }
  }

  /**
   * 调用DeepSeek API
   */
  async callDeepSeek(model, prompt, temperature, maxTokens) {
    if (!this.deepseekApiKey) {
      throw new Error('DEEPSEEK_API_KEY 未配置');
    }

    const client = axios.create({
      baseURL: this.deepseekBaseURL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.deepseekApiKey}`
      },
      timeout: 60000
    });

    const response = await client.post('/chat/completions', {
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: temperature,
      max_tokens: maxTokens,
      stream: false
    });

    return {
      success: true,
      data: response.data,
      content: response.data.choices[0]?.message?.content || '',
      usage: response.data.usage || null,
      provider: 'deepseek'
    };
  }

  /**
   * 调用阿里云百炼API
   */
  async callAliyun(model, prompt, temperature, maxTokens) {
    if (!this.aliyunApiKey) {
      throw new Error('ALIYUN_BAILIAN_API_KEY 未配置');
    }

    const client = axios.create({
      baseURL: this.aliyunBaseURL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.aliyunApiKey}`
      },
      timeout: 60000
    });

    const response = await client.post('/services/aigc/text-generation/generation', {
      model: model,
      input: {
        messages: [{ role: 'user', content: prompt }]
      },
      parameters: {
        temperature: temperature,
        max_tokens: maxTokens
      }
    });

    return {
      success: true,
      data: response.data,
      content: response.data.output?.text || '',
      usage: response.data.usage || null,
      provider: 'aliyun'
    };
  }
}

module.exports = new AIService();
