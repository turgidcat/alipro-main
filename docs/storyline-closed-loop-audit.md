# 剧情线最小闭环审计报告

## 1. 当前完整链路流程图

### 1.1 单条剧情线生成

```text
POST /api/storyline-workbench/:bookId/storylines/:storylineId/generate
↓
backend/routes/storylines.js
↓
loadStorylineGenerationContext()
  - 读取 book_plans
  - 读取 volume_plans
  - 读取 novel_outlines（兼容 fallback）
  - 读取 novel_characters
  - 读取 storylines
  - 读取 chapter_plans
  - 读取 foreshadowing
↓
backend/services/storyline-generation-service.js
  - generateStorylineOutline(context)
  - buildStorylinePrompt(...)
↓
backend/services/deepseek.js
  - generate(...)
  - model = deepseek-chat
↓
storyline-generation-service.js
  - parseStorylineOutlineResponse(...)
  - 结构化成剧情线 JSON
↓
写入 storylines.structured_content
↓
后续被章节细纲阶段读取
```

### 1.2 批量剧情线生成

```text
POST /api/storyline-workbench/:bookId/volume/:volNum/storylines/generate-all
↓
backend/routes/storylines.js
↓
循环每条 storyline
↓
storyline-generation-service.generateStorylineOutline(...)
↓
deepseek-chat
↓
写入每条 storylines.structured_content
↓
后续被章节细纲阶段读取
```

### 1.3 卷级时间线生成

```text
POST /api/storyline-workbench/:bookId/volume/:volNum/timeline/generate
↓
backend/routes/storylines.js
↓
loadStorylineGenerationContext()
  - 读取 book_plans / volume_plans / novel_outlines / storylines / chapter_plans
↓
storyline-generation-service.generateVolumeTimeline(...)
↓
deepseek-chat
↓
parseVolumeTimelineResponse(...)
↓
写入 volume_timelines.timeline_data
↓
后续在章节细纲阶段匹配 chapter slot
```

### 1.4 章节细纲读取剧情线

```text
POST /api/generate
body.promptType = "outline"
↓
backend/routes/ai.js
  - handleOutlineGeneration()
↓
loadBookGenerationContext(bookId, chapterNumber)
  - 读取 chapter_plans
  - 读取 storylines.structured_content
  - 读取 volume_timelines.timeline_data
↓
buildChapterStorylineContext(...)
  - 命中 usedStorylineIds
  - 命中 usedBeatIds
  - 匹配 volume timeline slot
  - 生成 promptText
↓
buildOutlinePrompt(...)
↓
deepseek-chat
↓
返回章节细纲文本 + storylineContext 元信息
↓
saveChapterStorylineContext(...)
↓
写入 chapter_plans.structured_content.storyline_context
```

### 1.5 正文生成读取 `storyline_context`

```text
POST /api/generate
默认正文生成
↓
backend/routes/ai.js
  - handleChapterContentGeneration()
↓
loadBookGenerationContext(bookId, chapterNumber)
  - 读取 chapter_plans / book_plans / novel_outlines / novel_characters
↓
读取 chapter_plans.structured_content.storyline_context
↓
buildDraftStorylineConstraintText(...)
↓
将剧情线约束拼进 contextNotes
↓
backend/services/deepseek.js
  - buildCreativePrompt(...)
↓
deepseek-chat
↓
返回正文 + metadata
```

### 1.6 章节反馈回写剧情线进度

```text
POST /api/generate
body.promptType = "chapter_feedback"
↓
backend/routes/ai.js
  - handleChapterFeedbackGeneration()
↓
buildChapterFeedbackPrompt(...)
↓
deepseek-chat
↓
saveChapterFeedback(...)
  - 写入 chapter_plans.structured_content.chapter_feedback
  - try 调 syncStorylineProgressFromChapterPlan(...)
↓
backend/services/database.js
  - 读取 chapter_plans.structured_content.storyline_context
  - 读取 usedStorylineIds / usedBeatIds / isFallback
  - merge 写入 storylines.structured_content
    - last_chapter_feedback
    - chapter_progress
    - currentProgress
```

## 2. 每一环是否真实生效

| 环节 | 是否已实现 | 是否调用模型 | 是否只是字段拼接 | 写入位置 | 下游是否消费 | 风险 |
| --- | --- | --- | --- | --- | --- | --- |
| 单条剧情线生成 | 是 | 是，`deepseek-chat` | 否 | `storylines.structured_content` | 是，章节细纲会读 | Prompt 质量依赖上游数据完整度 |
| 批量剧情线生成 | 是 | 是，逐条调用 `deepseek-chat` | 否 | 多条 `storylines.structured_content` | 是，章节细纲会读 | 批量失败时部分成功、部分失败 |
| 卷级时间线生成 | 是 | 是，`deepseek-chat` | 否 | `volume_timelines.timeline_data` | 是，章节细纲会读 | 时间线和剧情线 beat 可能不一致 |
| 章节细纲读取剧情线 | 是 | 是，细纲生成本身调模型；剧情线命中由系统函数完成 | 不只是字段拼接 | 接口返回 + `chapter_plans.structured_content.storyline_context` | 是，正文会读 | beat 命中是规则匹配，不是模型判断 |
| `storyline_context` 入库 | 是 | 否 | 否 | `chapter_plans.structured_content.storyline_context` | 是，正文与反馈会读 | 若未触发细纲生成则不会有该字段 |
| 正文生成读取 `storyline_context` | 是 | 是，正文生成调模型 | 否，已整理成约束文本 | 不新增写入，仅读 `chapter_plans` | 是，直接进入 Prompt | `storyline_context` 可能过长 |
| 章节反馈回写剧情线进度 | 是 | 是，反馈摘要由模型生成；回写由系统函数完成 | 否 | `storylines.structured_content.currentProgress/chapter_progress/last_chapter_feedback` | 是，后续剧情线生成上下文可读 | beat 只标记 `touched`，不判定完成 |

## 3. 是否还存在“假闭环”

### 3.1 是否还有函数名像生成，但实际只是字段拼接

当前主链里，剧情线生成与卷级时间线生成已经不再是假生成。

但仍有两个“半真半假”区段：

1. `buildChapterStorylineContext(...)`
   - 它不是模型生成
   - 它是规则提取器
   - 这本身合理，但不能把它描述成“模型判断 beat 命中”

2. 正文侧的剧情线约束
   - 现在是真实读取了 `storyline_context`
   - 但约束文本仍然是系统函数拼装，不是模型重新理解的二次结构化

### 3.2 是否还有只挂 ID、不读结构化内容的地方

有，但已经不是主链核心问题。

正文和细纲主链已不只是挂 ID。

仍存在只挂 ID 或弱标签的地方：

- `chapter_plans.main_storyline_id`
- `chapter_plans.target_storylines`

这些字段仍然存在，而且仍被使用，但现在已经从“唯一剧情线输入”降级为“定位与兼容挂接字段”。

### 3.3 是否还有生成结果入库但下游不用的地方

有一定残留，主要是：

- `volume_timelines.timeline_data`

它现在已经被章节细纲读取，但还没有被正文直接读取，也没有单独成为反馈回写判定输入。

所以它不算完全“入库不用”，但仍然是“消费深度不足”。

### 3.4 是否还有正文生成重新查剧情线的并行逻辑

当前正文生成主链已经移除了为约束而重查 `storylines` 的逻辑。

但反馈生成里仍会为展示主线标签查询剧情线名称：

- `handleChapterFeedbackGeneration()` 会按 `main_storyline_id / target_storylines` 查询名称

这不属于重新命中 beat 的并行逻辑，更像标签展示层。

### 3.5 是否还有反馈回写会覆盖原剧情线结构的风险

当前回写采用 merge，不是整包覆盖。

所以风险已经明显下降。

但仍有两个注意点：

1. `currentProgress` 是新维护区块，若后续别处也开始写这个字段，可能出现字段风格漂移
2. `chapter_progress` 和 `currentProgress.chapterProgress` 现在存在语义近似的双轨结构，后续需要保持一致

## 4. 数据字段审计

| 表/字段 | 写入环节 | 读取环节 | 用途 | 是否稳定 |
| --- | --- | --- | --- | --- |
| `storylines.structured_content` | 剧情线生成、反馈回写 | 章节细纲、后续剧情线生成上下文 | 剧情线主结构存储 | 基本稳定 |
| `storylines.structured_content.currentProgress` | 章节反馈回写 | 后续剧情线生成上下文（已可读，但未深用） | 章节触达进度聚合 | MVP，待稳定 |
| `storylines.structured_content.chapter_progress` | 章节反馈回写 | 兼容读取、审计 | 章节级反馈日志 | 稳定但偏旧 |
| `storylines.structured_content.last_chapter_feedback` | 章节反馈回写 | 兼容读取、审计 | 最近一次章节反馈摘要 | 稳定 |
| `volume_timelines.timeline_data` | 卷级时间线生成 | 章节细纲命中 slot | 卷级调度矩阵 | MVP，有效但消费偏浅 |
| `chapter_plans.structured_content.storyline_context` | 章节细纲生成后持久化 | 正文生成、反馈回写 | 章节级剧情线约束承接层 | 关键新结构，MVP |
| `chapter_plans.structured_content.chapter_feedback` | 章节反馈生成 | 反馈承接、剧情线回写、前端展示 | 本章反馈摘要 | 稳定 |
| `chapter_plans.main_storyline_id` | 章节计划保存 | 细纲、正文、反馈 | 主剧情线挂接 | 稳定，但只是挂接层 |
| `chapter_plans.target_storylines` | 章节计划保存 | 细纲、正文、反馈 | 关联剧情线挂接 | 稳定，但只是挂接层 |

## 5. 模型职责和系统函数职责

| 任务 | 当前由谁处理 | 是否合理 | 建议 |
| --- | --- | --- | --- |
| 剧情线生成 | 模型 + 系统函数 | 合理 | 保持 |
| beat 命中 | 系统函数 | 合理但偏保守 | 后续可补模型复核 |
| 章节细纲构建 | 模型 | 合理 | 保持 |
| 正文约束拼接 | 系统函数 | 合理 | 保持 |
| 章节反馈摘要 | 模型 | 合理 | 保持 |
| beat 是否完成 | 当前无人真正判定，只记 touched | 合理的 MVP | 后续补模型审稿 |
| 剧情线进度回写 | 系统函数 | 合理 | 保持，但后续补更细粒度判定 |

### 额外判断

#### 剧情线生成

- 当前由模型负责语义设计，系统函数负责上下文收集与 JSON 校验
- 这是合理分工

#### beat 命中

- 当前由系统函数完成
- 适合 MVP，因为它是确定性路由问题
- 但“命中了哪个 beat”不一定等于“这个 beat 本章完成了多少”

#### 章节反馈摘要

- 现在由模型生成
- 这是合理的，因为摘要本身需要语义压缩

#### beat 完成判断

- 当前没有真正做
- 这是现在闭环最大的保守缺口之一

## 6. 当前闭环还缺什么

### 6.1 已完成的

1. 真实剧情线生成服务已落地
2. 卷级时间线生成已落地
3. 章节细纲会读取剧情线与时间线
4. `storyline_context` 已写入 `chapter_plans.structured_content`
5. 正文生成会读取 `storyline_context`
6. 章节反馈会回写剧情线进度

### 6.2 仍然没有完成的

1. beat 完成状态还没有可靠判定
2. 卷级时间线还没有深度进入正文或反馈判定
3. 多剧情线同时命中时，优先级冲突还没有专门治理
4. 没有完整的链路自动化测试脚本

### 6.3 只是 MVP 的

1. `currentProgress` 目前只做 touched 级别记录
2. `storyline_context` 是章节级摘要，不是完整推理痕迹
3. `isFallback` 只做状态标记，不会阻止进度日志写入

### 6.4 后续要谨慎做的

1. 不要让正文重新查 `storylines`
2. 不要让反馈直接改写剧情线核心 beat 结构
3. 不要让 `storyline_context` 无限膨胀

### 6.5 重点问题检查

#### 1. beat 现在只是 `touched`，还没有模型判断是否完成

是，属实。

这是当前最大但可接受的 MVP 缺口。

#### 2. fallback 章节是否会污染剧情线进度

存在轻度风险。

当前 fallback 章节不会标记 completed，但仍可能写入：

- `chapter_progress`
- `currentProgress.chapterProgress`
- `openQuestions`

这不算严重污染，但会增加“需要复核”的噪声。

#### 3. `storyline_context` 是否可能过长

有可能。

尤其在：

- 多剧情线同时命中
- 多个伏笔同时出现
- timeline slot 很复杂

时，正文 Prompt 的 `contextNotes` 可能变重。

#### 4. 多剧情线同时命中时是否会混乱

有风险。

当前实现是并列收集，不做更高级优先级裁剪。

#### 5. 卷级时间线和剧情线 beat 是否可能不一致

可能。

当前没有专门一致性校验器。

#### 6. 章节细纲、正文、反馈是否存在三套不一致上下文

风险已经比之前低很多，但还没完全消失。

当前状态是：

- 细纲与正文已经共享 `storyline_context`
- 反馈回写也会读 `storyline_context`

所以主链已经基本统一。

剩余不一致风险主要来自：

- 细纲生成当次 Prompt
- 入库后的 `storyline_context`
- 模型生成的反馈摘要

三者仍可能出现轻微偏差。

## 7. 推荐下一步

### A. 必须先修的 bug

1. 暂无必须立刻修的阻断级 bug
2. 但建议尽快补一个小校验：
   - 当 `storyline_context.usedStorylineIds` 非空、`usedBeatIds` 为空且 `isFallback` 为 false 时，输出明确 warning

### B. 低风险增强

1. 增加完整手动测试脚本
2. 增加链路调试接口或调试日志开关
3. 优化 `storyline_context` 长度，控制 Prompt 膨胀

### C. 需要模型判断的增强

1. 给 beat 完成状态增加模型审稿
2. 给“剧情线是否偏航”增加模型复核
3. 给卷级时间线与剧情线 beat 一致性增加模型辅助检查

### D. 暂时不要做的高风险改动

1. 不要把正文生成重新改成直查 `storylines`
2. 不要立即大改数据库 schema
3. 不要自动让反馈去重写剧情线规划结构
4. 不要同时引入新的模型路由和结构重构

## 8. 审计结论

### 1. 现在闭环是否成立

**成立，但属于 MVP 闭环。**

它已经满足最小链路要求：

```text
剧情线生成
↓
卷级时间线生成
↓
章节细纲读取剧情线
↓
storyline_context 写入 chapter_plans.structured_content
↓
正文生成读取 storyline_context
↓
章节反馈回写 storylines.structured_content.currentProgress
```

### 2. 是否仍有假闭环

**仍有少量“弱闭环”成分，但主链不再是假闭环。**

最主要的弱点是：

- beat 只标记 `touched`
- 还没有可靠完成判定

### 3. 最大风险是什么

最大风险不是“链路没通”，而是：

**链路虽然通了，但 `storyline_context` 和 `currentProgress` 仍然是 MVP 级摘要结构，后续如果不加测试和长度治理，容易慢慢漂移。**

### 4. 建议下一步做什么

最推荐的下一步是：

1. 先做测试
2. 再做低风险增强

优先顺序建议：

1. 增加完整手动测试脚本
2. 增加链路调试信息
3. 优化 `storyline_context` 长度
4. 再考虑 beat 完成状态的模型审稿

### 5. 是否建议先做测试，再继续开发

**建议。**

因为现在链路已经够长，继续加功能前，先把这条闭环固定住，收益会非常高。
