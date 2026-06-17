# 生成逻辑完整文档

> 最后更新：2026-05-31
> 涵盖：正文生成、大纲生成、上下文注入系统、Prompt 构建、API 调用链

---

## 一、架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 (frontend/js/)                      │
│  generateNovel() → callBackendAPI('/generate', params)       │
│  收集 ~20 个参数：genre, chapterNumber, outline, characters, │
│  bookId, wordCount, 爽点标签, 创作开关……                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ POST /api/generate
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   路由层 (routes/ai.js)                       │
│  promptType 路由分发 → 7 种生成类型                          │
│  content / outline / book_title / chapter_name /             │
│  character_names / character_profiles / full_outline         │
└───────────┬─────────────────────────────────────────────────┘
            │ promptType='content' (默认)
            ▼
┌─────────────────────────────────────────────────────────────┐
│              上下文注入 (routes/ai.js)                        │
│  loadChapterContext(bookId, chapterNumber)                   │
│  → 查询 novel_outlines 表（book/volume/chapter 三级大纲）   │
│  → 查询 chapters 表（上一章正文最后500字）                   │
│  → 组装 contextParams 注入 prompt                            │
└───────────┬─────────────────────────────────────────────────┘
            │ ...contextParams + 创作参数
            ▼
┌─────────────────────────────────────────────────────────────┐
│              Prompt 构建 (services/deepseek.js)               │
│  buildCreativePrompt() → 5 层结构 prompt                     │
│  全书概要 → 分卷上下文 → 承接上文 → 本章细纲 → 创作要求      │
└───────────┬─────────────────────────────────────────────────┘
            │ prompt 字符串
            ▼
┌─────────────────────────────────────────────────────────────┐
│           DeepSeek API (services/deepseek.js)                 │
│  POST https://api.deepseek.com/v1/chat/completions           │
│  model: deepseek-chat, temperature: 0.7, timeout: 180s       │
└───────────┬─────────────────────────────────────────────────┘
            │ response.data.choices[0].message.content
            ▼
┌─────────────────────────────────────────────────────────────┐
│                      前端展示                                  │
│  displayOutput() → 右侧面板渲染                               │
│  saveChapterToDatabase() → 后端存储                           │
│  addToChapterHistory() → 章节导航                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、API 入口 — 统一路由分发

所有生成请求统一走 **`POST /api/generate`**，通过 `promptType` 字段分发，无需传 `promptType` 时默认走正文生成。

| promptType | 生成目标 | 调用的 Prompt 构建 | 温度 | maxTokens |
|---|---|---|---|---|
| (默认) | 章节正文 | `buildCreativePrompt()` | 0.7 | `wordCount × 2.5` |
| `outline` | 章节简易大纲 | 路由内联构建 | 0.85 | 800 |
| `book_title` | 书名 | 路由内联构建 | 0.95 | 50 |
| `chapter_name` | 章节名 | 路由内联构建 | 0.95 | 30 |
| `character_names` | 角色名字 | 路由内联构建 | 0.9 | 800 |
| `character_profiles` | 角色设定卡 | 路由内联构建 | 0.8 | 动态(按角色数) |
| `full_outline` | 全书大纲 | 路由内联构建 | 0.75 | 2500 |

**关键代码路径**：`routes/ai.js` 第 150–340 行

```js
// 路由分发逻辑
if (promptType === 'book_title') return handleBookTitleGeneration(...);
if (promptType === 'chapter_name') return handleChapterNameGeneration(...);
if (promptType === 'outline') return handleOutlineGeneration(...);
if (promptType === 'character_names') return handleCharacterNamesGeneration(...);
if (promptType === 'character_profiles') return handleCharacterProfilesGeneration(...);
if (promptType === 'full_outline') return handleFullOutlineGeneration(...);
// 否则走正文生成（默认路径）
```

---

## 三、核心流程：章节正文生成

这是最常用也最复杂的路径，涉及上下文注入和 5 层 prompt 结构。

### 3.1 请求参数（完整）

前端 `generateNovel()` (`api.js:142`) 收集并发送的完整参数：

| 参数 | 必填 | 默认值 | 来源 |
|---|---|---|---|
| `genre` | ✅ | — | `#genre` 下拉框 |
| `subgenre` | | — | `#subgenre` 下拉框 |
| `platform` | | `qidian` | `#targetPlatform` 下拉框 |
| `template` | | — | `#template` 下拉框 |
| `chapterNumber` | | `1` | `#chapterNumber` 输入框 |
| `chapterTitle` | | `第N章 章节名` | 拼接自 chapterNumber + `#chapterName` |
| `outline` | | — | `#outline` 文本框（兼容旧版） |
| `characters` | | — | `mergeCharacters()` 合并全书+本章角色 |
| `bookId` | | — | `currentBookId` 全局变量（v1.3 上下文注入） |
| `wordCount` | | `2000` | `#wordCount` 输入框 |
| `shuangTags` | | `[]` | 爽点标签多选框组 |
| `emotionIntensity` | | `70` | `#emotionIntensity` 滑块 |
| `colloquialLevel` | | `80` | `#colloquialLevel` 滑块 |
| `dialogueRatio` | | `30` | `#dialogueRatio` 滑块 |
| `addCliffhanger` | | `true` | `#addCliffhanger` 复选框 |
| `enhanceDialogue` | | `true` | `#enhanceDialogue` 复选框 |
| `avoidAIFeel` | | `true` | `#avoidAIFeel` 复选框 |
| `fastPace` | | `false` | `#fastPace` 复选框 |
| `detailedDesc` | | `false` | `#detailedDesc` 复选框 |
| `model` | | `deepseek-chat` | 模型选择 |

### 3.2 两种运行模式

后端根据是否有 `bookId + chapterNumber` 自动选择模式：

```
有 bookId + chapterNumber？
  ├── 是 → 【注入模式】loadChapterContext() 从数据库加载上下文链
  └── 否 → 【兼容模式】仅使用前端传来的 outline 文本
```

两种模式下 `chapterGoal`（本章细纲核心目标）至少有一个必须有值，否则返回 400 错误。

### 3.3 API 调用参数

```js
deepseekService.generate({
  prompt,                                      // buildCreativePrompt 的输出
  model: model || 'deepseek-chat',
  temperature: 0.7,
  maxTokens: Math.ceil((wordCount || 2000) * 2.5)  // 2000字 → 5000 tokens
})
```

---

## 四、上下文注入系统（v1.3）

### 4.1 `loadChapterContext()` 数据查询

**文件**：`routes/ai.js` 第 30–139 行

按顺序查询 5 个数据源，组装成一个上下文对象：

```
1. novel_outlines (type=chapter) → 本章细纲 + 上一章细纲
   ↓
2. chapters 表 → 上一章正文最后 500 字（风格衔接）
   ↓
3. novel_outlines (type=volume) → 分卷大纲摘要
   ↓
4. novel_outlines (type=book) → 全书大纲摘要
   ↓
5. books 表 → 书名
```

### 4.2 组装后的上下文结构

```js
{
  // 书籍级
  bookTitle: "《斗破苍穹》",
  bookOutlineSummary: "少年萧炎……200字摘要",

  // 分卷级
  volumeContext: "第一卷核心矛盾：……",

  // 承上（上一章衔接）
  previousChapterEnd: "……上一章正文最后500字",
  previousChapterGoal: "上一章核心目标",
  previousChapterHook: "上一章钩子：神秘人出现……",

  // 本章细纲（从 novel_outlines 解析）
  chapterGoal: "本章核心目标",
  sceneSequence: [
    { sceneNumber: 1, location: "萧家大厅", time: "清晨",
      atmosphere: "紧张", action: "家族会议", output: "萧炎被嘲讽" },
    // ...
  ],
  emotionCurve: "低→中→高→悬念",
  dialoguePoints: ["萧炎反击：三十年河东……"],
  nextHook: "戒指发光……",
  characterStates: "萧炎：愤怒/压抑；纳兰嫣然：高傲",
}
```

### 4.3 上下文对象传递

`contextParams` 通过展开运算符全部传入 `buildCreativePrompt()`：

```js
deepseekService.buildCreativePrompt({
  genre, subgenre, platform, chapterTitle,
  outline, characters,
  ...contextParams,    // ← 全部上下文字段展开混入
  shuangTags, emotionIntensity, wordCount, ...
})
```

**重要**：最近修复了 `chapterNumber` 丢失问题——它必须显式加入 `contextParams`，否则 prompt 中不知道当前是第几章。

---

## 五、Prompt 构建逻辑

### 5.1 `buildCreativePrompt()` — 5 层结构

**文件**：`services/deepseek.js` 第 115–257 行

生成的 prompt 是**单一 `user` 消息**（无 system prompt），按以下层次组织：

```
【身份设定】你是一位资深起点中文网作家，正在创作都市异能（超能力）小说《书名》

【第一层：全书概要】(可选，有 bookOutlineSummary 时输出)
  全书故事主线和核心矛盾，100-200 字

【第二层：当前分卷】(可选，有 volumeContext 时输出)
  本卷核心矛盾 + 本章在本卷中的位置

【第三层：承接上文】(可选，有上章信息时输出)
  上一章核心剧情 / 结尾钩子 / 最后500字片段

【第四层：本章细纲】(核心，有两种形态)
  ┌─ 注入模式（有 sceneSequence）：
  │    核心目标 + 场景序列（地点/时间/氛围/动作/输出）
  │    + 情绪曲线 + 对话要点 + 结尾钩子
  └─ 兼容模式（只有 outline 文本）：
      直接贴文本大纲

【角色设定】(有 characterStates 或 characters 时输出)

【创作要求】
  平台特色 + 爽点要求 + 情绪强度 + 口语化程度
  + 对话占比 + 可选开关（去AI味/对话差异化/快节奏/细节描写/钩子）

【风格指南】
  - 多用短句和感叹句增强节奏感
  - 对话要接地气，符合角色身份
  - 打斗/冲突场面有画面感
  - 心理活动要真实
  - 避免过于工整的排比句和华丽辞藻

【输出指令】
  请开始创作，字数控制在2000字左右。
  开头请加上"第15章"作为章节标题，然后另起一行开始正文。
```

### 5.2 Prompt 中的创作开关

以下参数来自前端复选框，**有条件地**出现在 prompt 中：

| 开关 | 默认值 | 出现在 Prompt 中的效果 |
|---|---|---|
| `avoidAIFeel` | `true` | 添加"去AI味：增加环境细节、动作描写、心理活动、微表情" |
| `enhanceDialogue` | `true` | 添加"对话差异化：不同角色说话方式要明显区分" |
| `addCliffhanger` | `true` | 添加"章节钩子：结尾留悬念" |
| `fastPace` | `false` | 添加"快节奏：情节推进快，多用行动和对话推动剧情" |
| `detailedDesc` | `false` | 添加"细节描写：增加场景、服饰、神态等细节增强画面感" |

### 5.3 其他 Prompt 构建函数

| 函数 | 生成目标 | 说明 |
|---|---|---|
| `buildBookOutlinePrompt()` | 全书大纲 | 输出 JSON 结构（主线/分卷/矛盾线/世界观） |
| `buildVolumeOutlinePrompt()` | 分卷大纲 | 输出 JSON（主题/核心事件/情感曲线/章节序列） |
| `buildChapterDetailedOutlinePrompt()` | 章节细纲 | 输出结构化场景序列+角色状态 |

这些大纲类 prompt 使用独立的 system prompt（来自 `outline-prompts.js`）。

---

## 六、DeepSeek API 调用

### 6.1 `generate()` 方法

**文件**：`services/deepseek.js` 第 32–82 行

```js
async generate({ prompt, model, temperature, maxTokens }) {
  const response = await this.client.post('/chat/completions', {
    model: model,
    messages: [{ role: 'user', content: prompt }],
    temperature: temperature,
    max_tokens: maxTokens,
    stream: false          // 不使用流式，一次性返回完整结果
  })
  return {
    content: response.data.choices[0].message.content,
    usage: response.data.usage
  }
}
```

### 6.2 配置参数

| 参数 | 值 | 说明 |
|---|---|---|
| API 端点 | `https://api.deepseek.com/v1` | |
| 默认模型 | `deepseek-chat` | |
| 超时 | 180 秒 | 适应 2000+ 字长文本 |
| 认证 | `Bearer DEEPSEEK_API_KEY` | 环境变量 |
| Stream | `false` | 非流式，等待完整响应 |

### 6.3 错误处理

| HTTP 状态 | 前端提示 |
|---|---|
| 401 | API Key无效或已过期 |
| 429 | 请求过于频繁，请稍后再试 |
| 500 | 服务器内部错误 |
| 超时/ECONNABORTED | 请求超时 (408) |
| 中断/aborted | 请求被中断 (502) |

**注意**：没有自动重试机制。失败后由用户手动重新生成。

---

## 七、前后端完整数据流

```
┌──────────────────────────────────────────────────────────────┐
│ 用户点击「生成章节」或 Ctrl+Enter                              │
└────────────┬─────────────────────────────────────────────────┘
             ▼
┌──────────────────────────────────────────────────────────────┐
│ generateNovel() — api.js:142                                  │
│ ├─ 从 DOM 收集 ~20 个参数                                     │
│ ├─ mergeCharacters() 合并角色                                 │
│ ├─ 构建 requestData                                           │
│ └─ callBackendAPI('/generate', requestData)                   │
└────────────┬─────────────────────────────────────────────────┘
             │ POST {baseURL}/api/generate
             │ Content-Type: application/json
             ▼
┌──────────────────────────────────────────────────────────────┐
│ routes/ai.js — POST /api/generate handler                     │
│ ├─ 解构 req.body → genre, outline, bookId, chapterNumber...  │
│ ├─ promptType 路由分发                                        │
│ ├─ [正文路径] loadChapterContext(bookId, chapterNumber)       │
│ │   ├─ 查 novel_outlines（三级大纲）                          │
│ │   ├─ 查 chapters（上一章正文）                              │
│ │   └─ 组装 contextParams                                     │
│ ├─ buildCreativePrompt({ ...contextParams, ...创作参数 })     │
│ └─ deepseekService.generate({ prompt, temperature: 0.7 })    │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ DeepSeek API                                                  │
│ model: deepseek-chat, max_tokens: wordCount * 2.5            │
└────────────┬─────────────────────────────────────────────────┘
             │ response.data.choices[0].message.content
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 前端处理结果                                                   │
│ ├─ lastGeneratedContent = content                             │
│ ├─ displayOutput(content) → 右侧面板                          │
│ ├─ addToChapterHistory() → 章节导航                           │
│ ├─ saveToHistory() → localStorage                             │
│ ├─ saveChapterToDatabase() → POST /api/books/:id/chapters    │
│ │   └─ 若无 currentBookId → 自动 POST /api/books 创建新书    │
│ ├─ POST /api/outlines/:bookId/chapter/:num/confirm            │
│ │   └─ 标记本章细纲为"已确认"                                 │
│ └─ showToast("生成成功！用时 XX 秒")                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 八、数据库表结构（生成相关）

### novel_outlines 表（三级大纲）

用于存储全书/分卷/章节三级大纲。`type` 字段区分层级：

| type | 含义 | 典型字段 |
|---|---|---|
| `book` | 全书大纲 | `summary`, `content`（JSON结构） |
| `volume` | 分卷大纲 | `volume_number`, `summary`, `content` |
| `chapter` | 章节细纲 | `volume_number`, `chapter_number`, `chapter_goal`, `scene_sequence`(JSON), `emotion_curve`, `dialogue_points`(JSON), `lead_to_next`(JSON 含钩子), `inherit_from`(JSON 含上章钩子+角色状态) |

### chapters 表（已生成章节）

存储已生成的章节正文：

| 字段 | 说明 |
|---|---|
| `book_id` | 所属书籍 |
| `chapter_number` | 章节序号 |
| `title` | 章节标题 |
| `content` | 正文全文 |
| `chapter_goal_hint` | 本章目标提示 |

### books 表（书籍元信息）

| 字段 | 说明 |
|---|---|
| `title` | 书名 |
| `genre` | 主分类 |
| `created_at` | 创建时间 |

---

## 九、关键配置文件

### `config/novel-config.js`

三大配置模块（全部导出）：

| 模块 | 内容 |
|---|---|
| `NOVEL_CATEGORIES` | 13 个主分类（urban/fantasy/xianxia/scifi/history/game/mystery/sports/lightnovel/fanfic/military/western_fantasy/wuxia/supernatural），每个含子分类、特性标记、写作建议 |
| `PLATFORM_FEATURES` | 2 个平台：`qidian`（起点重视逻辑/世界观）、`fanqie`（番茄重视算法推荐/完读率/快节奏） |
| `SHUANG_POINTS` | 通用爽点标签（打脸/扮猪吃虎/震惊全场）+ 按分类定制 |
| `WRITING_STYLES` | 3 种风格预设：快节奏/细节描写/平衡风格 |

### `services/outline-prompts.js`

导出大纲类生成的 **system prompt** 常量：
- `BOOK_OUTLINE_SYSTEM` / `BOOK_OUTLINE_SCHEMA` — 全书大纲
- `VOLUME_OUTLINE_SYSTEM` / `VOLUME_OUTLINE_SCHEMA` — 分卷大纲
- `CHAPTER_DETAILED_SYSTEM` / `CHAPTER_DETAILED_SCHEMA` — 章节细纲

---

## 十、与其他功能的关联

### 10.1 与续写的衔接

章节生成完成后：
1. `saveChapterToDatabase()` 将正文存入 `chapters` 表
2. 调用 `/api/outlines/:bookId/chapter/:num/confirm` 标记细纲已确认
3. 前端 `goToNextChapter()` 检查 `nextChapterNumber` 的细纲状态：
   - `ready` → 自动填入章节号，可直接生成
   - `no_outline` → 提示先生成细纲
   - `outline_not_confirmed` → 提示先确认细纲

### 10.2 AI 质量检查工具（辅助）

这些端点不参与生成主流程，但提供质量辅助：

| 端点 | 功能 | 温度 |
|---|---|---|
| `/api/polish` | 润色已有正文 | 0.6 |
| `/api/check-next-chapter` | 检查下章细纲状态 | — |
| `/api/check-character` | 角色一致性检查 | 0.3 |
| `/api/check-plot` | 剧情冲突检测 | 0.3 |
| `/api/detect-foreshadowing` | 伏笔检测 | 0.4 |
| `/api/optimize-plot` | 应用优化建议 | 0.6 |
| `/api/translate` | 翻译 | 0.5 |

---

## 十一、修改指南

### 调整生成风格/质量

编辑 `deepseek.js` 的 `buildCreativePrompt()`：
- 第 235–243 行：创作要求参数化开关
- 第 246–251 行：风格指南硬编码文字
- 第 253 行：输出格式指令

### 新增小说分类

编辑 `config/novel-config.js` 的 `NOVEL_CATEGORIES`，添加新的 `key` 对象（含 `name`, `subgenres`, `features`, `writingTips`）。

### 调整上下文注入逻辑

编辑 `routes/ai.js` 的 `loadChapterContext()`：
- 第 30–51 行：数据库查询逻辑
- 第 74–139 行：上下文对象组装和解析

### 添加新的 promptType

在 `routes/ai.js` 的 handler 中新增 `if (promptType === 'xxx')` 分支，并在 `validateRequest` 的 `allowedFields` 列表中注册新参数。
