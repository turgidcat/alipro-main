# 剧情线闭环完整手动测试报告

更新时间：2026-06-16

## 测试说明

本次测试遵循“只审计、不修复”的要求，未修改业务代码、Prompt、数据库结构或前端。

本次实际使用了本地正在运行的服务进行真实调用：

- 后端健康检查：`http://127.0.0.1:3000/health`
- 前端开发服务：`http://127.0.0.1:5173/`

本次主要测试样本：

- 主闭环样本书：`破雾修真录`
  - `bookId`: `b8bd76b6-170f-4666-9233-36e86b1f8b1d`
  - `storylineId`: `e8fbc32c-1744-4369-83b5-07bf6a9a16a9`
  - `chapterNumber`: `8`
  - `chapterTitle`: `炼房藏锋`
- fallback 样本书：`血月残卷`
  - `bookId`: `84f598e7-59bc-494d-80ba-dfe6cfda7967`
  - `chapterNumber`: `2`
  - `chapterTitle`: `祭坛回响`

## 测试结果总表

| 测试环节 | 是否通过 | 实际结果 | 发现的问题 | 风险等级 | 建议 |
| ---- | ---- | ---- | ----- | ---- | -- |
| 单条剧情线生成 | 未通过 | 实际调用 `POST /api/storyline-workbench/:bookId/storylines/:storylineId/generate`，返回 `500` | 日志显示错误为 `no such column: character_arc`，说明运行链路读取了数据库里不存在的角色字段 | 高 | 先修复角色查询字段兼容问题，再重测剧情线生成 |
| 卷级时间线生成 | 未通过 | 实际调用 `POST /api/storyline-workbench/:bookId/volume/:volNum/timeline/generate`，返回 `500` | 日志显示错误为 `deepseekService.buildVolumeTimelinePrompt is not a function`，说明运行实例仍在走旧调用链 | 高 | 先确认后端运行版本是否已加载最新代码；若未加载，重启服务后再测；若已加载，则需修复旧引用残留 |
| 章节细纲生成 | 部分通过 | `POST /api/generate` 可正常返回细纲文本 | 返回中没有 `data.storylineContext`；数据库中也没有写入 `chapter_plans.structured_content.storyline_context` | 高 | 重点排查当前运行实例是否未加载“剧情线接入章节细纲”的最新实现 |
| `storyline_context` 入库 | 未通过 | 实测前后查询 `chapter_plans.structured_content`，主样本和 fallback 样本都未出现 `storyline_context` | 链路未入库，后续正文自然无法稳定读取 | 高 | 先恢复章节细纲阶段的入库逻辑，再做下游验证 |
| 正文生成读取 `storyline_context` | 未通过 | 正文接口能正常生成正文 | 返回 metadata 中没有 `storylineConstraintApplied`、`usedStorylineIds`、`usedBeatIds`、`usedVolumeTimeline`、`isFallback`；同时数据库中也没有可读的 `storyline_context` | 高 | 先修复上游 `storyline_context` 入库，再确认当前运行实例是否加载了正文 Prompt 新规则 |
| 章节反馈生成 | 部分通过 | `POST /api/generate` 的 `promptType=chapter_feedback` 可正常返回反馈 JSON，并写回 `chapter_plans.structured_content.chapter_feedback` | 返回中没有 `metadata.storylineProgressUpdated`、`metadata.requiresStorylineReview` | 中 | 先确认当前运行实例是否为最新反馈实现，再补测回写状态字段 |
| 剧情线进度回写 | 未通过 | 主样本 `storylines.structured_content` 仍只有 `last_chapter_feedback` 和 `chapter_progress`，没有 `currentProgress`；fallback 样本各条剧情线仍为空 | 没有形成预期中的 `currentProgress` 闭环；fallback 也没有可观测的受控回写标记 | 高 | 先修复上游剧情线/时间线/章节细纲链路，再重测反馈回写 |
| fallback 章节细纲 | 部分通过 | fallback 样本可以生成细纲文本 | 返回中没有 `isFallback`；数据库没有保存 fallback 状态 | 中 | 需要把 fallback 状态显式返回并入库，否则无法区分“真命中”与“兜底生成” |
| fallback 正文生成 | 部分通过 | fallback 样本可以正常生成正文 | 返回中没有 `isFallback`，也没有剧情线约束应用标记 | 中 | 至少补齐 metadata，确保调用方知道当前是兜底模式 |
| fallback 反馈生成 | 部分通过 | fallback 样本可以正常生成反馈 | 未返回 `requiresStorylineReview`，也未观察到“禁止误判 beat 完成”的结构化写回 | 中 | 需要把 fallback 反馈状态显式暴露出来，再验证是否误写剧情线进度 |

## 分步骤实测记录

### 1. 单条剧情线生成

实际调用：

- `POST /api/storyline-workbench/b8bd76b6-170f-4666-9233-36e86b1f8b1d/storylines/e8fbc32c-1744-4369-83b5-07bf6a9a16a9/generate`

实际结果：

- HTTP `500`
- 返回：`{"success":false,"error":"服务器内部错误"}`

日志证据：

- `backend/logs/error.log`
- 错误：`no such column: character_arc`

数据库观察：

- `storylines.structured_content` 未被新的模型生成结果覆盖
- 当前该剧情线仍保留旧结构，只看到：
  - `last_chapter_feedback`
  - `chapter_progress`
- 未观察到本次新生成的 `title / dramaticQuestion / keyBeats / currentProgress`

结论：

- 该环节当前未跑通。
- 不是“模型没返回”，而是更前面的数据库字段读取就已经报错。

### 2. 卷级时间线生成

实际调用：

- `POST /api/storyline-workbench/b8bd76b6-170f-4666-9233-36e86b1f8b1d/volume/1/timeline/generate`

实际结果：

- HTTP `500`
- 返回：`{"success":false,"error":"服务器内部错误"}`

日志证据：

- `backend/logs/error.log`
- 错误：`deepseekService.buildVolumeTimelinePrompt is not a function`

数据库观察：

- `volume_timelines` 中没有生成后的 `timeline_data`

结论：

- 该环节当前未跑通。
- 从错误看，当前运行中的后端实例仍在调用旧的 `deepseekService.buildVolumeTimelinePrompt(...)`。
- 这和磁盘上已经存在的新服务设计不一致，说明“运行中的后端行为”和“仓库当前代码状态”至少有一处没有对齐。

### 3. 章节细纲生成

实际调用：

- `POST /api/generate`
- 请求体包含：
  - `promptType: "outline"`
  - `bookId`
  - `chapterNumber`
  - `genre`
  - `bookTitle`
  - `chapterTitle`

实际结果：

- 主样本与 fallback 样本都返回 `200`
- 都成功生成了细纲文本

但关键观察：

- 返回体中只有：
  - `content`
  - `usage`
- 未出现预期中的：
  - `data.storylineContext.usedStorylineIds`
  - `data.storylineContext.usedBeatIds`
  - `data.storylineContext.usedVolumeTimeline`
  - `data.storylineContext.isFallback`

数据库观察：

- 主样本 `chapter_plans.structured_content`：
  - 仍有 `chapter_outline_structure`
  - 仍有 `chapter_feedback`
  - 没有 `storyline_context`
- fallback 样本 `chapter_plans.structured_content`：
  - 只有 `generation_settings` 与后续反馈写回
  - 没有 `storyline_context`

结论：

- “细纲能生成”这件事通过了。
- “细纲已读取剧情线并把命中结果写入 `storyline_context`”这件事没有通过。

### 4. 正文生成

实际调用：

- `POST /api/generate`
- 使用相同 `bookId + chapterNumber`

实际结果：

- 主样本与 fallback 样本都返回 `200`
- 正文文本能成功生成

主样本内容层面观察：

- 生成内容基本贴合现有章节计划
- 没有明显提前跳到更后续大事件
- 但这只能证明它吃到了“章节计划 / 已有上下文”
- 不能证明它吃到了 `storyline_context`

返回 metadata 观察：

- 有：
  - `model`
  - `timestamp`
  - `targetWordCount`
  - `actualLength`
  - `continuityAudit`
  - `context`
- 没有：
  - `storylineConstraintApplied`
  - `usedStorylineIds`
  - `usedBeatIds`
  - `usedVolumeTimeline`
  - `isFallback`

结论：

- “正文能生成”通过。
- “正文已从 `chapter_plans.structured_content.storyline_context` 读取剧情线约束”未能证明，且从返回结构看，大概率当前运行实例没有生效。

### 5. 章节反馈生成

实际调用：

- `POST /api/generate`
- `promptType: "chapter_feedback"`
- 传入同章生成出的正文内容

实际结果：

- 主样本与 fallback 样本都返回 `200`
- 都能返回结构化反馈

数据库观察：

- `chapter_plans.structured_content.chapter_feedback` 会被更新
- 说明“反馈入章节计划”是实际生效的

但返回缺失：

- 没有：
  - `metadata.storylineProgressUpdated`
  - `metadata.requiresStorylineReview`

结论：

- “反馈能生成并写回章节计划”通过。
- “反馈是否感知剧情线闭环状态”无法从当前运行实例证明。

### 6. 剧情线进度回写

主样本数据库观察：

- `storylines.structured_content` 中可见：
  - `last_chapter_feedback`
  - `chapter_progress`
- 未见：
  - `currentProgress`

fallback 样本数据库观察：

- 四条剧情线仍为空字符串
- 没有看到误写入，也没有看到明确的 fallback 回写标记

结论：

- 当前只能确认“旧式 `chapter_progress` 写回”存在。
- 不能确认新闭环要求里的 `currentProgress` 已真实形成。
- 也不能确认 fallback 场景下是否按预期显式标记 `requiresReview`。

## 关键异常与风险

### 1. 运行实例与磁盘代码疑似未完全对齐

证据：

- 磁盘代码审计里，卷级时间线已经不该再调用 `deepseekService.buildVolumeTimelinePrompt(...)`
- 但实测日志仍报这个方法不存在
- 磁盘代码里，细纲返回应包含 `storylineContext`
- 但实测返回中没有
- 磁盘代码里，正文 metadata 应包含剧情线约束信息
- 但实测返回中没有

这类现象通常意味着两种可能：

1. 当前运行中的 Node 进程没有加载最新代码；
2. 仓库中仍有未清掉的旧逻辑路径，运行时命中了旧分支。

### 2. 单条剧情线生成被数据库字段不兼容卡死

错误：

- `no such column: character_arc`

影响：

- 最上游的剧情线真实生成直接中断
- 下游所有“依赖结构化剧情线”的验证都无法完成真闭环

### 3. 当前闭环存在明显“假闭环”风险

虽然：

- 细纲能生成
- 正文能生成
- 反馈能生成

但实测没有看到：

- `storyline_context` 入库
- 正文读取 `storyline_context` 的证据
- `currentProgress` 回写
- fallback 明确标记

所以当前更像是：

- 章节计划本身支撑了生成
- 但新增的剧情线闭环字段没有在运行实例里稳定生效

## 对 fallback 的单独结论

fallback 场景下：

- 细纲能生成
- 正文能生成
- 反馈能生成
- 没有报错

但没有看到：

- `isFallback: true`
- `requiresStorylineReview`
- `storyline_context` 入库
- 受控的剧情线进度状态

因此目前只能说：

- fallback 的“可用性”基本存在
- fallback 的“可观测性”和“闭环状态标记”没有验证通过

## 关于角色层冲突风险

当前实测没有证明 `storyline_context.characterChangeBoundaries` 已实际进入正文 Prompt，因为：

- `storyline_context` 本身未入库
- 正文返回 metadata 也未显示剧情线约束已应用

因此当前风险是：

- `role_execution` 和 `characterChangeBoundaries` 的优先级规则，至少在正在运行的实例里没有可验证证据
- 这意味着角色层三分法在文档层面已经定义，但运行层面暂时还不能算真实落地闭环

## 总结判断

### 1. 当前闭环是否真实跑通

不能认定为真实跑通。

当前更准确的状态是：

- 章节细纲、正文、反馈三个通用生成能力可用；
- 但“剧情线生成 → 时间线生成 → storyline_context 入库 → 正文消费 → 反馈回写 currentProgress”这条新增闭环，没有通过本次实测。

### 2. 哪一环最脆弱

最脆弱的是最上游两环：

1. 单条剧情线生成
2. 卷级时间线生成

因为它们都已经在真实调用时直接报错。

### 3. 是否存在假闭环

存在。

主要表现为：

- 文档和磁盘代码描述了闭环；
- 但当前运行实例没有把关键字段真实跑起来。

### 4. 是否存在字段写入但下游没消费

本次实测最明显的反而是“关键字段没有写进去”，所以还谈不上稳定下游消费。

旧字段层面：

- `chapter_feedback` 会入库并被旧逻辑消费；
- `chapter_progress` 会保留；
- 但新闭环字段没有完成真实贯通。

### 5. 是否存在 fallback 伪装成正常命中

有这个风险。

原因不是看见了伪装字段，而是：

- 当前运行实例没有把 `isFallback` 暴露出来
- 外部调用方无法区分“真命中剧情线”还是“只靠章节计划生成”

### 6. 是否存在 `role_execution` 和 `characterChangeBoundaries` 冲突风险

存在风险，但本次无法在运行实例里完成正向验证。

原因：

- 没有看到 `storyline_context` 实际进入正文上下文
- 因而也没有看到“三类约束优先级规则”被真实执行的证据

## 建议

### 是否建议现在继续开发

不建议直接继续叠加新功能。

### 是否建议先修 bug

建议先修，而且优先级很高。

### 下一步建议

建议按这个顺序处理：

1. 先确认当前运行中的后端实例是否已经加载最新代码；
2. 修复 `character_arc` 字段兼容问题；
3. 修复卷级时间线仍调用旧 `deepseekService.buildVolumeTimelinePrompt(...)` 的问题；
4. 重跑单条剧情线生成与卷级时间线生成；
5. 再重测 `storyline_context` 入库、正文 metadata、反馈 metadata、`currentProgress` 回写；
6. 在全部通过后，再谈继续新增开发。

如果只选一个最优先动作，我建议先做：

- **先对齐运行环境并修复两处硬错误，再重跑整条闭环。**
