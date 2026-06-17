# 剧情线与卷级时间线真实链路审计

## 1. 当前剧情线生成真实链路

```text
前端
↓
React 详情页 / 工作台通过 /api/storyline-workbench/:bookId/storylines 读取和保存剧情线
↓
backend/routes/storylines.js
  - GET /:bookId/storylines：只读 storylines 表
  - POST /:bookId/storylines：只写 storylines 表基础字段
  - POST /:bookId/storylines/:storylineId/generate：看起来要走 AI 生成
↓
读取数据
  - storylines 表：当前剧情线基础字段
  - novel_outlines(type='book')：旧全书大纲
  - novel_outlines(type='volume')：旧分卷大纲
  - novel_characters：主角色设定
  - foreshadowing(status='pending')：待回收伏笔
↓
构建内容
  - storylines.js 尝试调用 deepseekService.buildStorylineOutlinePrompt(...)
↓
是否调用模型
  - 代码意图：是，调用 deepseekService.generate(...)
  - 实际情况：在 backend/services/deepseek.js 中没有找到 buildStorylineOutlinePrompt 和 parseStorylineOutlineResponse 定义
  - 结论：当前链路在关键 Prompt/解析阶段缺方法，接口大概率直接报错，无法形成稳定“真生成”
↓
返回结果
  - 设计上应解析模型返回 JSON
  - 实际上因缺少 parseStorylineOutlineResponse，无法完成稳定解析
↓
保存位置
  - 设计上保存到 storylines.structured_content，并把 status 改成 generated
  - 实际上只有接口代码写了 UPDATE，前提是上面的缺失方法存在且返回成功
↓
后续使用位置
  - 章节规划保存时只挂 chapter_plans.main_storyline_id / target_storylines
  - 正文生成与章节反馈阶段主要读取剧情线名称标签，不读取 storylines.structured_content 的详细结构
```

### 审计结论

- 剧情线基础 CRUD 是真的，但只是人工录入/数据库存取。
- “剧情线 AI 生成”路由看起来想做真生成，但当前不是可运行、可验证的真实生成链路。
- 即使未来把缺失方法补齐，现有正文主链也没有明显消费 `storylines.structured_content` 的细粒度剧情节点。

## 2. 当前卷级时间线生成真实链路

```text
前端
↓
当前前端没有看到稳定、明确的卷级时间线消费入口
↓
backend/routes/storylines.js
  - POST /:bookId/volume/:volNum/timeline/generate
  - GET /:bookId/volume/:volNum/timeline
↓
读取数据
  - novel_outlines(type='book')：旧全书大纲
  - novel_outlines(type='volume')：旧分卷大纲
  - 从旧分卷 structured_content 中尝试取 chapterPlan / foreshadowPlan
  - storylines 表：本卷所有剧情线基础字段 + structured_content
↓
构建内容
  - storylines.js 尝试调用 deepseekService.buildVolumeTimelinePrompt(...)
↓
是否调用模型
  - 代码意图：是，调用 deepseekService.generate(...)
  - 实际情况：在 backend/services/deepseek.js 中没有找到 buildVolumeTimelinePrompt 和 parseVolumeTimelineResponse 定义
  - 结论：当前卷级时间线生成同样缺关键方法，属于未落地完成的设计链路
↓
返回结果
  - 设计上应把模型返回解析成时间线 JSON
  - 实际上缺少解析器，无法形成稳定输出
↓
保存位置
  - 设计上写入 volume_timelines.timeline_data / total_chapters / status
  - 数据表 volume_timelines 确实存在
↓
后续使用位置
  - 当前审计范围内没有看到章节细纲或正文生成直接读取 volume_timelines.timeline_data
```

### 审计结论

- 卷级时间线是“表结构和 route 先建了，但真实生成链路没闭环”。
- 它目前更像计划中的能力，不像已经真正接入生产链的能力。

## 3. 是否真的调用模型

| 功能 | 是否调用模型 | 调用位置 | 使用模型 | Prompt 来源 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 分卷自动拆分 | 是 | `backend/routes/plans.js` `POST /books/:bookId/volume-plans/generate` | `deepseek-chat` | `plans.js` 内部 `buildVolumePlanGenerationPrompt()` | 这是当前最完整、最接近真实模型生成的卷级链路 |
| 剧情线大纲生成 | 设计上是，实际未闭环 | `backend/routes/storylines.js` `POST /:bookId/storylines/:storylineId/generate` | `deepseek-chat` | 计划调用 `deepseekService.buildStorylineOutlinePrompt()` | 关键 Prompt 构造器和解析器缺失，当前不能算真实可用生成 |
| 批量剧情线大纲生成 | 设计上是，实际未闭环 | `backend/routes/storylines.js` `POST /:bookId/volume/:volNum/storylines/generate-all` | `deepseek-chat` | 同上 | 同样卡在缺失方法 |
| 卷级时间线生成 | 设计上是，实际未闭环 | `backend/routes/storylines.js` `POST /:bookId/volume/:volNum/timeline/generate` | `deepseek-chat` | 计划调用 `deepseekService.buildVolumeTimelinePrompt()` | 关键 Prompt 构造器和解析器缺失，当前不能算真实可用生成 |
| 章节反馈生成 | 是 | `backend/routes/ai.js` `promptType=chapter_feedback` | 默认 `deepseek-chat` | `ai.js` 内部 `buildChapterFeedbackPrompt()` | 真调模型，但作用是反馈/审计，不是剧情线生成 |
| 正文生成 | 是 | `backend/routes/ai.js` `POST /generate` | 默认 `deepseek-chat` | `deepseekService.buildCreativePrompt()` | 真调模型，但对剧情线的使用主要停留在标签/约束层 |

## 4. Prompt 质量判断

| Prompt / 函数 | 输入了哪些上下文 | 是否足够生成真实剧情线 | 问题 |
| --- | --- | --- | --- |
| `plans.js` `buildVolumePlanGenerationPrompt()` | `book_plans` 的 premise、main_goal、core_conflict、world_rules、role_summary、main_outline、volume_outline、detailed_outline | 对“分卷拆分”基本够用，但不是剧情线级别 | 更偏卷级拆分，不负责真正剧情线语义设计 |
| `storylines.js` 计划中的 `buildStorylineOutlinePrompt()` | 路由准备喂入：旧全书大纲、旧分卷大纲、单条剧情线基础字段、主角角色文本、待回收伏笔、controlParams | 无法确认最终质量，因为方法不存在 | 当前没有真实 Prompt 实现，无法证明它不是空壳 |
| `storylines.js` 计划中的 `buildVolumeTimelinePrompt()` | 路由准备喂入：旧全书大纲、旧分卷大纲、storylines 基础数据、旧分卷中的 chapterPlan / foreshadowPlan | 无法确认最终质量，因为方法不存在 | 当前没有真实 Prompt 实现，无法证明它能做多线调度 |
| `ai.js` `buildOutlineFromChapterPlan()` | `chapter_mission`、`emotion_target`、`outline_text`、`scene_outline`、`character_notes`、`previous_hook`、`ending_hook`、`main_storyline_id`、`target_storylines` | 不足以“生成剧情线”，只够生成章节正文上下文 | 这里对剧情线的使用主要是挂接标签，不是读取剧情线结构化设计结果 |
| `deepseekService.buildCreativePrompt()` | 书名、题材、章节任务表、角色说明、上下文说明、部分主线约束 | 不足以单独承担“剧情线设计” | 它是正文创作 Prompt，不是剧情线规划 Prompt；剧情线更多被压缩成章节任务和少量约束 |

## 5. 数据库存储判断

| 数据表/字段 | 来源 | 是模型生成还是字段拼接 | 后续是否被使用 |
| --- | --- | --- | --- |
| `book_plans.*` | `plans.js` / 手工保存 | `book_plans` 可来自人工，也可由分卷拆分前的全书规划提供 | 被分卷拆分、章节上下文读取使用 |
| `volume_plans.*` | `plans.js` 自动拆分 + 手工编辑 | 分卷自动拆分是真模型生成后落库 | 前端详情页会读；章节准备区会优先读 `volume_plans` |
| `storylines` 基础字段（`storyline_name`、`core_conflict` 等） | 前端 `saveStoryline()` 手工提交到 `storylines.js` | 目前主要是人工录入/字段存取 | 会被章节规划挂接、正文/反馈阶段读名称标签 |
| `storylines.structured_content` | 设计上来自剧情线 AI 生成；实际也会被 `syncStorylineProgressFromChapterPlan()` 回写 `chapter_progress` 和 `last_chapter_feedback` | 当前主要可确认的真实写入是“章节反馈回写”，不是剧情线生成结果 | 目前明确使用的是进度回写，不是正文生成主输入 |
| `volume_timelines.timeline_data` | 设计上来自卷级时间线生成 | 路由意图是模型生成，但当前缺方法，无法确认真实落库 | 在当前审计范围内未看到章节细纲/正文主链消费 |
| `chapter_plans.main_storyline_id` / `target_storylines` | 前端手工选择后保存 | 字段挂接，不是模型生成 | 会被章节反馈和正文生成读取为剧情线标签 |
| `chapter_plans.outline_text` / `scene_outline` / `structured_content.chapter_outline_structure` | 目前大量来自人工编辑或示例数据 | 主要是手工内容或结构化存档，不是从剧情线自动推导 | 正文生成真正会吃这些内容 |

## 6. 是否存在“机械传递”

### 是否存在机械传递

存在，而且不止一处。

### 具体发生位置

- `backend/routes/storylines.js`
  - `volume-settings/batch-init`：把旧全书大纲里的 `volumes` 机械搬运到 `volume_plans`
- `backend/services/database.js`
  - `ChapterPlanService.upsert()`：把 `main_storyline_id / target_storylines` 存到 `chapter_plans`
  - `syncStorylineProgressFromChapterPlan()`：把章节反馈摘要回写进 `storylines.structured_content.chapter_progress`
- `backend/routes/ai.js`
  - 正文生成前主要是把 `chapter_plans` 里的章节任务、挂接剧情线名称、角色说明拼进 Prompt
- `frontend-react/src/workbenchApi.js` / `frontend/js/api.js`
  - 章节规划保存与加载主要是在挂剧情线 ID，不是在消费剧情线结构化设计结果

### 为什么不算真实模型生成

- 只存了剧情线 ID 或名称，不等于使用了剧情线的“起承转合、关键节点、章节分配、情绪波浪”等语义设计结果。
- `storylines.structured_content` 当前可确认的主用途，是承接章节反馈进度，而不是作为章节细纲/正文生成的上游中枢。
- 卷级时间线表虽然存在，但当前没有看到它进入章节细纲或正文生成主链。
- “剧情线生成”“时间线生成”两个 route 虽然名字很像真 AI，但关键方法缺失，当前更像未完成半成品。

### 会导致什么小说生产问题

- 章节与剧情线只做弱绑定，容易变成“看起来挂了主线标签，实际正文还是按局部章节任务写”。
- 卷级节奏、高潮错峰、伏笔回收节拍没有进入正文主链，长篇更容易断线。
- 角色推进、主线推进和章节推进之间缺少真正的结构联动，容易回到“字段传递像很全，语义规划其实很薄”的老问题。

## 7. 是否存在“不存在方法调用”

| 文件 | 不存在的方法 | 当前影响 | 是否需要修复 |
| --- | --- | --- | --- |
| `backend/routes/storylines.js` | `deepseekService.buildStorylineOutlinePrompt` | 剧情线生成接口无法形成 Prompt，实际大概率直接报错 | 需要 |
| `backend/routes/storylines.js` | `deepseekService.parseStorylineOutlineResponse` | 即使模型返回文本，也无法稳定解析结构化剧情线结果 | 需要 |
| `backend/routes/storylines.js` | `deepseekService.buildVolumeTimelinePrompt` | 卷级时间线接口无法形成 Prompt | 需要 |
| `backend/routes/storylines.js` | `deepseekService.parseVolumeTimelineResponse` | 即使模型返回文本，也无法稳定解析卷级时间线结果 | 需要 |

## 8. 修复建议，但不要执行

### A. 必须先修的运行错误

- 先确认并补齐 `backend/routes/storylines.js` 调用的 4 个缺失方法。
- 在修之前先决定这些方法应该放在 `deepseek.js` 还是单独的 storyline/timeline prompt service，不然很容易只是补壳。

### B. 必须补的真实模型生成链路

- 剧情线生成不能只吃旧 `novel_outlines` 文本和一条 storyline 基础字段。
- 至少应显式纳入：
  - `book_plans` 的主目标、核心冲突、世界规则、角色摘要
  - `volume_plans` 的阶段目标、核心冲突、起止角色状态
  - 已有剧情线之间的关系
  - 已有章节规划或卷内目标
  - 伏笔与角色弧光约束
- 模型输出必须结构化，并且进入 `storylines.structured_content` 的稳定 schema。

### C. 应该接入后续生产链的字段

- 章节细纲生成应直接读取：
  - 当前主剧情线的关键节点
  - 关联剧情线的阶段推进
  - 卷级时间线中“本章应推进哪几条线、推进类型是什么”
- 正文生成不应只读 `main_storyline_id / target_storylines`，还应读对应剧情线的结构化摘要和当前章节应落的 beat。

### D. 暂时可以保留的系统函数

- `chapter_plans` 的字段校验与存储
- `book_plans / volume_plans` 的读写服务
- `syncStorylineProgressFromChapterPlan()` 这种反馈回写与状态推进
- 前端对剧情线 ID 的选择器与映射逻辑

## 9. 下一步建议

### 1. 现在是否适合直接修复 `storylines.js` 不存在方法？

不建议直接就修。

### 2. 如果直接修，会不会只是补壳？

大概率会。

原因：

- 现在最大问题不只是“缺 4 个方法”，而是剧情线和时间线即使补成可调用，也还没有稳定接入章节细纲和正文生成主链。
- 如果只把方法补到接口能返回 JSON，很可能只是把一个半成品接口补成“能跑”，但小说生产仍旧主要依赖章节任务文本，而不是剧情线语义结构。

### 3. 建议下一步是什么？

建议顺序：

1. 先定义“真实剧情线生成服务”的输入、输出和存储 schema
2. 再补 `storylines.js` 的运行错误
3. 然后把剧情线结构接入章节细纲生成
4. 最后再考虑卷级时间线如何进入正文主链

为什么：

- 先修运行错误但不定义真实 schema，容易重演“函数名很像 AI，实质只是字段传递”的问题。
- 当前最应该避免的是补壳，而不是单纯追求接口恢复。
- 真正有价值的是：让剧情线成为章节细纲和正文生成都能消费的中枢数据，而不是一个只存在于单独表里的漂亮 JSON。
