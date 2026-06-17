# 剧情线闭环最终复测报告（卷级时间线 fallback 可观测）

更新时间：2026-06-16

## 测试范围

本次复测基于当前运行中的最新后端代码进行，且遵循以下约束：

- 未修改业务代码
- 未修改数据库
- 未修改 Prompt
- 未新增功能
- 仅验证当前主链在“卷级时间线 fallback 已可观测”的前提下是否稳定

测试样本：

- `bookId`: `b8bd76b6-170f-4666-9233-36e86b1f8b1d`
- `bookTitle`: `破雾修真录`
- `storylineId`: `e8fbc32c-1744-4369-83b5-07bf6a9a16a9`
- `volNum`: `1`
- `chapterNumber`: `8`
- `chapterTitle`: `炼房藏锋`
- 服务地址：`http://127.0.0.1:3000`

本次按顺序实际调用：

1. `POST /api/storyline-workbench/:bookId/storylines/:storylineId/generate`
2. `POST /api/storyline-workbench/:bookId/volume/:volNum/timeline/generate`
3. `POST /api/generate`（`promptType: "outline"`）
4. `POST /api/generate`（正文生成）
5. `POST /api/generate`（`promptType: "chapter_feedback"`）

并额外用新的数据库读取进程复查：

- `storylines.structured_content`
- `volume_timelines.timeline_data`
- `chapter_plans.structured_content`

注意：数据库复查必须使用新进程重新打开文件，才能看到 API 进程刚刚写入的真实落库结果。

---

## 结果总表

| 环节 | 是否通过 | 实际结果 | fallback 状态 | 风险等级 | 建议 |
| -- | ---- | ---- | ----------- | ---- | -- |
| 单条剧情线生成 | 通过 | 接口 `200`，返回完整 `structured`，且 `storylines.structured_content` 已真实写入 | `isFallback: false` | 低 | 可继续作为主链上游输入 |
| 卷级时间线生成 | 部分通过 | 接口 `200`，但返回的是显式 fallback；未生成有效 `stages/chapterSlots` | `isFallback: true`，`requiresReview: true`，`parseError` 存在 | 中 | 当前先保持可观测，后续优先优化时间线质量 |
| 章节细纲生成 | 通过 | 返回 `storylineContext`，且 `persistedStorylineContext: true` | `usedVolumeTimeline: false`，`isFallback: false` | 低 | 说明时间线 fallback 没有污染细纲命中 |
| `storyline_context` 入库 | 通过 | `chapter_plans.structured_content.storyline_context` 已入库，且未覆盖既有结构字段 | 继承上游真实状态；当前为非 fallback 命中 | 低 | 可作为正文生成稳定读取入口 |
| 正文生成读取剧情线约束 | 通过 | metadata 明确出现 `storylineConstraintApplied / usedStorylineIds / usedBeatIds / usedVolumeTimeline / isFallback` | `usedVolumeTimeline: false`，`isFallback: false` | 低 | 证明正文读取的是章节计划中的剧情线上下文，而不是假消费 |
| 章节反馈生成 | 接口通过 | 接口 `200`，metadata 返回 `storylineProgressUpdated: true` | `requiresStorylineReview: false` | 中 | 需要结合落库结果一起判断，不能只看接口成功 |
| 剧情线进度回写 `currentProgress` | 未完全稳定 | 库中确实存在 `currentProgress / chapter_progress / last_chapter_feedback`，但本次回写结果与最新命中 beat 存在疑似不一致 | 当前不是 fallback 误写，而是疑似“接口说已更新、库里仍是旧进度” | 高 | 建议优先排查反馈回写一致性，再宣称闭环完全稳定 |

---

## 分环节实测结果

### 1. 单条剧情线生成

接口结果：

- `200`
- `success: true`

返回的 `structured` 包含：

- `title`
- `summary`
- `dramaticQuestion`
- `keyBeats`
- `relatedCharacters`
- `foreshadowingToPlant`
- `payoffs`
- `currentProgress`
- `isFallback`

本次实测关键值：

- `structured.isFallback = false`
- `keyBeats.length = 12`
- `relatedCharacters.length = 4`
- `foreshadowingToPlant.length = 3`
- `payoffs.length = 2`

数据库复查结果：

- `storylines.structured_content` 已真实写入
- 顶层可见字段包括：
  - `title`
  - `type`
  - `summary`
  - `dramaticQuestion`
  - `keyBeats`
  - `relatedCharacters`
  - `foreshadowingToPlant`
  - `payoffs`
  - `currentProgress`
  - `sourceContext`
  - `isFallback`
  - `last_chapter_feedback`
  - `chapter_progress`

结论：

- **单条剧情线生成已真实生效，不是字段拼接假闭环。**

---

### 2. 卷级时间线生成

接口结果：

- `200`
- `success: true`

返回结构包含：

- `volumeId`
- `volumeTheme`
- `startState`
- `endState`
- `stages`
- `chapterSlots`
- `rhythmCheck`
- `totalChapters`
- `isFallback`
- `parseError`
- `requiresReview`
- `rawPreview`

本次实测关键值：

- `isFallback = true`
- `requiresReview = true`
- `parseError = "未能从模型返回中提取有效 JSON"`
- `stages.length = 0`
- `chapterSlots.length = 0`

数据库复查结果：

- `volume_timelines.timeline_data` 已写入本次 fallback 结果
- 落库字段中明确包含：
  - `isFallback: true`
  - `requiresReview: true`
  - `parseError`
  - `rawPreview`
  - 空的 `stages`
  - 空的 `chapterSlots`

结论：

- **卷级时间线目前仍然没有稳定生成出有效结构。**
- **但 fallback 已经可观测，而且没有再伪装成正常时间线。**

---

### 3. 章节细纲生成

接口结果：

- `200`
- 返回 `storylineContext`
- `persistedStorylineContext: true`

本次实测关键值：

- `usedStorylineIds = ["e8fbc32c-1744-4369-83b5-07bf6a9a16a9"]`
- `usedBeatIds = ["dev-7"]`
- `usedVolumeTimeline = false`
- `isFallback = false`

数据库复查结果：

- `chapter_plans.structured_content.storyline_context` 已真实入库
- 当前可见字段包括：
  - `usedStorylineIds`
  - `usedBeatIds`
  - `usedVolumeTimeline`
  - `isFallback`
  - `relatedStorylines`
  - `currentBeats`
  - `mustAdvance`
  - `mustNotHappen`
  - `foreshadowingToPlant`
  - `foreshadowingToPayoff`
  - `characterChangeBoundaries`
  - `conflictEscalation`
  - `timelineSlot`
  - `source`

同时确认未被覆盖的字段：

- `chapter_outline_structure`
- `chapter_feedback`

补充说明：

- 本次测试样本里没有现成的 `role_execution`，因此只能确认“没有发生结构覆盖”，不能证明“已有 `role_execution` 的样本也一定保留”。

结论：

- **时间线 fallback 没有污染细纲命中。**
- **细纲仍然能基于剧情线 beat 生成可用的 `storyline_context`。**

---

### 4. 正文生成

接口结果：

- `200`

metadata 关键值：

- `storylineConstraintApplied = true`
- `usedStorylineIds` 非空
- `usedBeatIds = ["dev-7"]`
- `usedVolumeTimeline = false`
- `isFallback = false`

结论：

- **正文生成已经真实读取 `chapter_plans.structured_content.storyline_context`。**
- **卷级时间线 fallback 没有被误报成已使用。**

内容抽查结论：

- 文本推进方向与本章命中的剧情线 beat 基本一致；
- 未见明显提前跳写后续大节点；
- 未见明显因时间线 fallback 造成的乱写。

说明：

- 这里是人工抽查，不是形式化文学质量审校；
- 只能证明“约束链路在工作”，不能证明“内容质量已最优”。

---

### 5. 章节反馈生成

接口结果：

- `200`

metadata 关键值：

- `storylineProgressUpdated = true`
- `requiresStorylineReview = false`

数据库复查结果：

- `storylines.structured_content.currentProgress` 存在
- `storylines.structured_content.chapter_progress` 存在
- `storylines.structured_content.last_chapter_feedback` 存在

但这里出现了本次复测最重要的新问题：

- 本次细纲与正文命中的 `usedBeatIds` 是 `["dev-7"]`
- 但数据库中最新可见的 `currentProgress.chapterProgress[-1].usedBeatIds` 仍表现为 `["dev-8"]`
- 同步可见的 `chapter_progress[-1]` 与 `last_chapter_feedback` 时间戳也更像是较早一次写回结果，而不是这次最新运行

这意味着：

- **反馈接口返回了“已更新”**
- **但数据库中看到的剧情线进度可能仍然是旧结果**

当前更合理的判断不是“反馈完全失败”，而是：

- 反馈链路已经具备回写能力；
- 但**回写一致性还不稳定**，存在“接口成功但最新状态未必真的按本次命中刷新”的风险。

结论：

- **反馈回写不能算完全假闭环，但也不能算已经完全稳定。**

---

## 核心判断

### 1. 当前剧情线主链是否稳定跑通

结论：**主链大部分已真实跑通，但还不能算完全稳定。**

已经真实工作的部分：

- 剧情线生成
- 章节细纲读取剧情线
- `storyline_context` 入库
- 正文读取 `storyline_context`
- 章节反馈接口返回闭环 metadata

仍未完全稳定的部分：

- 卷级时间线质量仍停留在 fallback
- 反馈回写与本次最新命中 beat 存在疑似不一致

### 2. 卷级时间线 fallback 是否可观测

结论：**是。**

当前接口与数据库都明确体现：

- `isFallback: true`
- `requiresReview: true`
- `parseError`

### 3. fallback 是否影响章节细纲

结论：**没有污染章节细纲。**

证据：

- `storylineContext.usedVolumeTimeline = false`
- `storylineContext.isFallback = false`
- `usedStorylineIds / usedBeatIds` 仍正常命中

### 4. fallback 是否影响正文生成

结论：**没有打断正文生成。**

证据：

- `storylineConstraintApplied = true`
- `usedVolumeTimeline = false`
- 正文仍能围绕剧情线 beat 推进

### 5. fallback 是否影响反馈回写

结论：**当前看不出时间线 fallback 直接污染了反馈回写。**

真正的问题更像是：

- 反馈写回的“最新状态一致性”不稳；
- 不是“因为时间线 fallback 才写坏”。

### 6. `storyline_context` 是否真实入库

结论：**是。**

### 7. 正文是否真实读取 `storyline_context`

结论：**是。**

### 8. `currentProgress` 是否真实回写

结论：**有回写能力，但本次复测暴露出最新状态可能未同步更新，不能判定为完全稳定。**

### 9. 是否存在假闭环

结论：**不存在完全假闭环，但存在“部分真闭环 + 局部状态不稳”的风险。**

具体说：

- 剧情线生成到正文生成这一段是真实消费链路；
- 反馈回写这一段存在“接口说成功、落库状态却像旧结果”的可疑点。

### 10. 是否建议继续开发

结论：**不建议直接把这条链路当成“完全稳定基线”继续大步扩展。**

更稳妥的顺序应是：

1. 先确认并修复反馈回写一致性问题；
2. 再决定是否继续叠加更多闭环功能；
3. 卷级时间线质量优化可以继续排期，但优先级略低于“回写结果是否真实更新”的正确性问题。

### 11. 是否需要优先修卷级时间线质量问题

结论：**需要修，但不是唯一优先项。**

优先级建议：

1. **先排查反馈回写一致性问题**
   - 因为这会影响我们对“闭环是否真实更新”的判断
2. **再优化卷级时间线质量**
   - 当前它已经能明确 fallback，不会伪装成功
   - 质量问题更多影响“命中精度”和“节奏细化”，暂时未打断主链

---

## 最终结论

可以把当前状态概括为：

- **主剧情线闭环基本跑通**
- **卷级时间线目前仍是可观测 fallback**
- **fallback 没有污染章节细纲和正文生成**
- **但反馈回写与最新命中结果可能存在不一致，闭环最后一环还不够稳**

所以，当前最准确的说法不是“闭环完全稳定”，而是：

> 剧情线主链已经基本形成，时间线 fallback 已经透明化，下游消费逻辑大体正确；但章节反馈到剧情线进度的最终回写，还需要再做一次一致性排查，才能把这条闭环真正当成稳定基线。
