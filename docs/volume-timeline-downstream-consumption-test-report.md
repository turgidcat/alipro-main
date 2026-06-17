# 卷级时间线下游消费复测报告

更新时间：2026-06-17

## 测试范围

本次只做下游复测，不修改业务代码，不修改 Prompt，不修改数据库，不修改前端。

测试样本：

- `bookId`: `b8bd76b6-170f-4666-9233-36e86b1f8b1d`
- `bookTitle`: `破雾修真录`
- `storylineId`: `e8fbc32c-1744-4369-83b5-07bf6a9a16a9`
- `volumeNumber`: `1`
- 有 slot 章节：`8`
- 无 slot 章节：`18`

本次实际调用链路：

1. `POST /api/storyline-workbench/:bookId/volume/:volNum/timeline/generate`
2. `POST /api/generate`（第 8 章，`promptType: "outline"`）
3. `POST /api/generate`（第 8 章，正文生成）
4. `POST /api/generate`（第 8 章，`promptType: "chapter_feedback"`）
5. `POST /api/generate`（第 18 章，`promptType: "outline"`）

并在调用后复查：

- `volume_timelines.timeline_data`
- `chapter_plans.structured_content.storyline_context`
- `storylines.structured_content.currentProgress`

---

## 测试结果总表

| 测试项 | 是否通过 | 实际结果 | 风险等级 | 建议 |
| --- | ---- | ---- | ---- | -- |
| 卷级时间线真实入库 | 通过 | `isFallback = false`，`parseError = null`，`stages = 3`，`chapterSlots = 12`，已入库 | 低 | 可继续作为下游输入 |
| `relatedBeatIds` 来源校验 | 通过 | 当前所有 `relatedBeatIds` 都能在真实 `keyBeats.beatId` 中找到，`invalidBeatIds = []` | 低 | 当前无需修正 beatId 映射 |
| 章节细纲读取有效时间线（第 8 章） | 通过 | `usedVolumeTimeline = true`，`persistedStorylineContext = true` | 低 | 说明时间线已进入细纲下游 |
| 章节细纲中的 `timelineSlot` 完整性 | 部分通过 | `timelineSlot` 已命中，但当前只保留了精简字段，未带完整 `focus/mustAdvance/relatedBeatIds` | 中 | 后续可再评估是否需要保留更多 slot 字段 |
| 正文读取时间线标记（第 8 章） | 通过 | metadata 出现 `usedVolumeTimeline = true`，正文内容与第 8 章 slot 节奏一致 | 低 | 说明正文已继承时间线命中标记 |
| 反馈回写（第 8 章） | 通过 | `storylineProgressUpdated = true`，本次 `usedBeatIds = ["dev-7"]` 已写入，`activeBeats = ["dev-7"]` | 低 | 说明时间线接入未打坏反馈回写 |
| 无 slot 章节 fallback（第 18 章） | 部分通过 | 未伪装命中，`usedVolumeTimeline = false`，但当前也没有继续命中剧情线 beat，而是返回空 fallback | 中 | 需作为下一步质量问题记录 |
| `chapterSlots.length` 与 `estimated_chapters` 覆盖一致性 | 未完全通过 | 当前 `estimated_chapters = 20`，但 `chapterSlots.length = 12` | 中 | 下一步应优化 slot 覆盖率 |

---

## 1. 卷级时间线是否真实入库

结论：**是。**

当前 `volume_timelines.timeline_data` 复查结果：

- `isFallback = false`
- `parseError = null`
- `requiresReview = false`
- `stages.length = 3`
- `chapterSlots.length = 12`

并且：

- 每个 `chapterSlot` 都有 `chapterNumber`
- 当前未发现伪造 `beatId`

本次卷设定中：

- `estimated_chapters = 20`

实际生成：

- `chapterSlots.length = 12`

说明：

- 时间线已从 fallback 进入“真实可用”
- 但还没有覆盖全部预计章节

---

## 2. `relatedBeatIds` 是否来自真实 keyBeats

结论：**是。**

本次对时间线中所有 `chapterSlots.relatedBeatIds` 做了查库校验：

- 汇总所有 `relatedBeatIds`
- 再与对应 storyline 的 `structured_content.keyBeats[].beatId` 做比对

结果：

- `invalidBeatIds = []`

也就是说，当前没有发现模型编造不存在的 beatId。

---

## 3. 章节细纲是否真实使用时间线

### 测试章节：第 8 章（有 slot）

章节细纲接口返回：

- `storylineContext` 存在
- `persistedStorylineContext = true`
- `usedVolumeTimeline = true`
- `usedStorylineIds = ["e8fbc32c-1744-4369-83b5-07bf6a9a16a9"]`
- `usedBeatIds = ["dev-7"]`
- `isFallback = false`

数据库复查：

- `chapter_plans.structured_content.storyline_context` 已更新
- 同样记录了：
  - `usedVolumeTimeline = true`
  - `usedBeatIds = ["dev-7"]`

结论：

- **章节细纲已经真实消费卷级时间线。**

---

## 4. `usedVolumeTimeline` 是否能正确变成 true

结论：**能。**

第 8 章实测：

- 章节细纲：`usedVolumeTimeline = true`
- 正文 metadata：`usedVolumeTimeline = true`

这说明：

- 时间线命中标记已经从时间线表传入章节细纲
- 再从章节细纲上下文继续传到正文生成

---

## 5. `timelineSlot` 是否来自 `chapterSlots`

结论：**是，但当前是精简投影，不是完整原始 slot。**

第 8 章在库里的原始 `chapterSlot` 是：

- `chapterNumber = 8`
- `focus = "转移炼药房，核对线索，外部压力逼近"`
- `relatedBeatIds = ["dev-7"]`
- `mustAdvance = ["转移至炼药房", "核对线索"]`

但写入 `storyline_context.timelineSlot` 后，当前可见的是精简版本：

- `chapter = 8`
- `primaryStoryline = ""`
- `pacingNote = ""`
- `activeStorylines = []`
- `foreshadowOps = []`

这说明：

- **系统已经识别到了这个 chapter slot**
- 但当前保存进 `timelineSlot` 的不是完整原始 slot 结构

本次仍可确认：

- `usedBeatIds = ["dev-7"]`
- 与真实 `chapterSlot.relatedBeatIds = ["dev-7"]` 对得上

只是字段承接还偏瘦。

---

## 6. 正文 metadata 是否继承 `usedVolumeTimeline: true`

结论：**是。**

第 8 章正文生成返回 metadata：

- `storylineConstraintApplied = true`
- `usedStorylineIds` 非空
- `usedBeatIds = ["dev-7"]`
- `usedVolumeTimeline = true`
- `isFallback = false`

内容抽查结果：

- 正文继续围绕炼药房藏身、核对线索、外部调查逼近推进
- 与第 8 章 `chapterSlot.focus` 基本一致
- 未见明显提前跳写后续 beat
- 未见明显角色越级突变

结论：

- **正文已经真实继承时间线命中标记。**

---

## 7. 反馈回写是否正常

结论：**正常。**

第 8 章反馈接口返回：

- `storylineProgressUpdated = true`
- `requiresStorylineReview = false`

数据库复查：

- `currentProgress.chapterProgress[0].usedBeatIds = ["dev-7"]`
- `currentProgress.activeBeats = ["dev-7"]`
- `chapter_progress[0].used_beat_ids = ["dev-7"]`
- `last_chapter_feedback.used_beat_ids = ["dev-7"]`
- `status = "touched"`

并且：

- 同一章节只保留最新 `chapterProgress` 记录
- 没有把 beat 伪装成 `completed`

结论：

- **时间线接入没有破坏反馈回写。**

---

## 8. 没有 chapterSlot 的章节是否能正确 fallback

### 测试章节：第 18 章（无 slot）

章节细纲接口返回：

- `usedStorylineIds = []`
- `usedBeatIds = []`
- `usedVolumeTimeline = false`
- `isFallback = true`
- `timelineSlot = null`
- `persistedStorylineContext = false`

这说明：

- 没有 slot 的章节当前**没有伪装成命中了时间线**
- fallback 是可观测的

但也暴露了一个现状：

- 这次第 18 章没有继续靠剧情线 beat 生成出非空 `storylineContext`
- 而是直接返回空 fallback

所以这项结果更准确地说是：

- **没有出现“伪命中”**
- **但无 slot 章节的兜底策略还不够理想**

---

## 9. `chapterSlots.length` 与 `estimated_chapters` 不一致是否需要下一步优化

结论：**需要。**

当前事实很明确：

- `estimated_chapters = 20`
- `chapterSlots.length = 12`

这不会阻断当前已经成功的下游消费链路，但它意味着：

- 只有前 12 章有明确 slot
- 后续章节更容易落回 `usedVolumeTimeline = false` 的路径

所以这项已经可以明确列为：

- **下一步卷级时间线质量优化重点**

---

## 10. 最终总结

### 1. 卷级时间线是否真实入库

结论：**是。**

### 2. `chapterSlots` 是否非空

结论：**是。**

### 3. `relatedBeatIds` 是否来自真实 keyBeats

结论：**是。**

### 4. 章节细纲是否真实使用时间线

结论：**是。**

### 5. `usedVolumeTimeline` 是否能正确变成 true

结论：**是。**

### 6. 正文 metadata 是否继承 `usedVolumeTimeline: true`

结论：**是。**

### 7. 反馈回写是否正常

结论：**是。**

### 8. 没有 chapterSlot 的章节是否能正确 fallback

结论：**没有伪装命中，但当前 fallback 偏空，仍需后续优化。**

### 9. `chapterSlots.length` 与 `estimated_chapters` 不一致是否需要下一步优化

结论：**需要。**

### 10. 下一步建议是优化 slot 覆盖率，还是先做阶段收口

结论：**建议直接进入 slot 覆盖率优化。**

因为当前已经可以明确说：

- 卷级时间线已进入下游链路
- `usedVolumeTimeline: true` 已经真实出现
- 主问题从“能不能用”转成了“覆盖率够不够”

---

## 一句话结论

当前卷级时间线已经不只是“生成成功”，而是：

> **已经真实进入章节细纲与正文下游消费链路；下一步最明确的质量问题，是把 `chapterSlots` 从当前 12/20 提升到更接近完整覆盖。**
