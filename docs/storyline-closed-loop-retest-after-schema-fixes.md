# 剧情线闭环复测报告（schema 修复后）

更新时间：2026-06-16

## 测试说明

本次复测基于前两步 schema 修复之后进行：

- 已修复 `character_arc` 查询不存在
- 已修复 `trigger_chapter / resolve_chapter` 查询不存在

本次遵循要求：

- 未修改业务代码
- 未改数据库
- 未改 Prompt
- 未新增功能

测试样本：

- `bookId`: `b8bd76b6-170f-4666-9233-36e86b1f8b1d`
- `bookTitle`: `破雾修真录`
- `storylineId`: `e8fbc32c-1744-4369-83b5-07bf6a9a16a9`
- `volume`: `1`
- `chapterNumber`: `8`
- `chapterTitle`: `炼房藏锋`

---

## 测试结果总表

| 测试环节 | 是否通过 | 实际结果 | 发现的问题 | 风险等级 | 建议 |
| ---- | ---- | ---- | ----- | ---- | -- |
| 单条剧情线生成 | 通过 | 接口返回 `200`，并返回完整 `structured`；数据库 `storylines.structured_content` 已更新 | 无新的硬错误 | 低 | 保持现状，可继续作为上游输入 |
| 卷级时间线生成 | 未稳定通过 | 本次完整重跑中接口返回 `500`，错误为“解析卷级时间线结果失败：未能从模型返回中提取有效 JSON” | 时间线链路已从 schema 错误进入模型输出解析问题；旧 fallback 数据仍残留在库中 | 高 | 先修复卷级时间线解析/Prompt 稳定性，再谈严格依赖时间线 |
| 章节细纲生成 | 通过 | 返回 `storylineContext` 且 `persistedStorylineContext: true` | `usedVolumeTimeline: false`，说明未吃到卷级时间线槽位 | 中 | 在时间线恢复前，细纲仍可依赖剧情线 beat 工作 |
| `storyline_context` 入库 | 通过 | `chapter_plans.structured_content.storyline_context` 已入库，且未覆盖既有结构 | `role_execution` 本章本来就不存在，无法证明“保留但未覆盖”；仅能确认未报错、`chapter_outline_structure`/`chapter_feedback` 保留 | 中 | 后续可选找一章本来有 `role_execution` 的样本再补测 |
| 正文生成读取 `storyline_context` | 通过 | metadata 出现 `storylineConstraintApplied / usedStorylineIds / usedBeatIds / usedVolumeTimeline / isFallback` | `usedVolumeTimeline: false`，说明正文这次未消费卷级时间线，只消费了剧情线 beat | 中 | 时间线修复前，正文仍可依赖剧情线约束继续工作 |
| 章节反馈生成 | 通过 | metadata 出现 `storylineProgressUpdated / requiresStorylineReview` | 无新的硬错误 | 低 | 可继续作为闭环最后一环 |
| 剧情线进度回写 `currentProgress` | 通过 | `storylines.structured_content.currentProgress` 已更新到本次章节，`usedBeatIds` 为 `dev-8`，状态为 `touched` | `completedBeats` 仍为空，这是当前 MVP 设计，不是 bug | 低 | 后续如需更强闭环，可再补“完成度判断” |
| 时间线 fallback 对下游影响 | 有影响但未打断主链 | 细纲/正文/反馈仍可跑，但 `usedVolumeTimeline` 为 `false`，时间线未参与命中 | 存在“剧情线主链可用、时间线支链失效”的部分闭环状态 | 中 | 先修时间线质量问题，再做“严格完整闭环”复测 |

---

## 分环节实测结果

### 1. 单条剧情线生成

调用：

- `POST /api/storyline-workbench/:bookId/storylines/:storylineId/generate`

结果：

- 返回 `200`
- `success: true`

返回的 `structured` 已包含：

- `title`
- `summary`
- `dramaticQuestion`
- `keyBeats`
- `relatedCharacters`
- `foreshadowingToPlant`
- `payoffs`
- `currentProgress`
- `isFallback`

本次实测：

- `isFallback: false`
- `keyBeats.length = 14`

数据库观察：

- `storylines.structured_content` 已写入上述结构化结果
- 顶层同时保留：
  - `currentProgress`
  - `last_chapter_feedback`
  - `chapter_progress`

结论：

- **单条剧情线已真实生成并入库**

---

### 2. 卷级时间线生成

调用：

- `POST /api/storyline-workbench/:bookId/volume/:volNum/timeline/generate`

本次完整重跑结果：

- 返回 `500`
- 错误为：

```text
解析卷级时间线结果失败：未能从模型返回中提取有效 JSON
```

日志观察：

- 日志中先记录：
  - `AI生成卷级时间线`
- 之后没有成功落库日志

补充观察：

- 数据库里仍存在一条旧的 `volume_timelines.timeline_data`
- 这条旧数据内容是：
  - `isFallback: true`
  - `stages: []`
  - `chapterSlots: []`

说明：

- 当前库里的时间线数据不是本次成功生成的新结果
- 而是之前留下的 fallback 数据

结论：

- **卷级时间线这次没有稳定通过**
- **它目前是当前闭环里最主要的不稳定点**

---

### 3. 章节细纲生成

调用：

- `POST /api/generate`
- `promptType: "outline"`

返回结果：

- `storylineContext` 存在
- `persistedStorylineContext: true`

其中：

- `usedStorylineIds = ["e8fbc32c-1744-4369-83b5-07bf6a9a16a9"]`
- `usedBeatIds = ["dev-8"]`
- `usedVolumeTimeline = false`
- `isFallback = false`

数据库观察：

- `chapter_plans.structured_content.storyline_context` 已入库

且保留了已有结构：

- `chapter_outline_structure`
- `chapter_feedback`

本章当前未观测到 `role_execution`，所以只能确认：

- 没有因本次入库造成结构覆盖
- 不能证明“已有 role_execution 的章节也被保留”，因为这个测试样本本来就没有该字段

结论：

- **`storyline_context` 已真实入库**
- **细纲链路在没有时间线槽位的情况下，仍然能命中剧情线 beat**

---

### 4. 正文生成

调用：

- `POST /api/generate`

返回 metadata：

- `storylineConstraintApplied: true`
- `usedStorylineIds: ["e8fbc32c-1744-4369-83b5-07bf6a9a16a9"]`
- `usedBeatIds: ["dev-8"]`
- `usedVolumeTimeline: false`
- `isFallback: false`

这说明：

- 正文生成本次确实读取了 `chapter_plans.structured_content.storyline_context`
- 且主要约束来自剧情线 beat，而不是卷级时间线

内容层面观察：

- 正文围绕炼药房藏身、核对残页、陆听澜坦白动机、外部压力逼近展开
- 与本章 `storyline_context.mustAdvance` 和 `usedBeatIds = dev-8` 一致
- 未看到明显提前跳写更后续大事件

但需要说明：

- 这是人工抽查，不是形式化文学质量验证
- 只能说明“看起来没有明显偏航”，不能替代更细的内容审稿

结论：

- **正文已真实读取剧情线约束**
- **即便 `usedVolumeTimeline: false`，正文仍能靠剧情线 beat 正常生成**

---

### 5. 章节反馈生成

调用：

- `POST /api/generate`
- `promptType: "chapter_feedback"`

返回 metadata：

- `storylineProgressUpdated: true`
- `requiresStorylineReview: false`

数据库观察：

`storylines.structured_content` 顶层已存在：

- `last_chapter_feedback`
- `chapter_progress`
- `currentProgress`

本次章节对应的 `currentProgress.chapterProgress` 最新项为：

- `chapterNumber: 8`
- `usedBeatIds: ["dev-8"]`
- `status: "touched"`
- `requiresReview: false`
- `updatedAt: 2026-06-16T15:31:12.436Z`

同时：

- `completedBeats = []`
- `activeBeats = []`

这符合当前 MVP 设计：

- **不会伪装成 `completed`**
- **只保守标记为 `touched`**

结论：

- **反馈已真实回写剧情线进度**
- **`currentProgress` 已更新到本次结果**

---

## fallback 影响检查

### 当前卷级时间线 fallback / 失败状态

当前情况不是“本次调用成功返回 fallback”，而是：

1. 之前数据库里已有一条 fallback 时间线：
   - `isFallback: true`
   - `stages: []`
   - `chapterSlots: []`
2. 本次完整重跑时，时间线接口直接返回 `500`
   - 原因是解析失败

### 它对下游的实际影响

尽管时间线支链失败，本次仍观察到：

- 章节细纲可以生成 `storylineContext`
- `storylineContext.usedVolumeTimeline = false`
- 正文生成可以读取剧情线 beat
- 反馈可以回写剧情线进度

所以当前真实状态是：

- **剧情线主链可用**
- **卷级时间线支链失效**

这不是“全闭环失效”，而是：

- **部分闭环成立**

---

## 总结判断

### 1. 当前剧情线闭环是否真实跑通

**部分跑通，但还不能算“完整闭环完全稳定”。**

成立的链路是：

剧情线生成
↓
章节细纲读取剧情线
↓
`storyline_context` 入库
↓
正文读取 `storyline_context`
↓
章节反馈回写 `currentProgress`

当前不稳定的环节是：

- 卷级时间线生成

### 2. 单条剧情线是否真实生成并入库

**是。**

### 3. 卷级时间线 fallback 是否影响后续链路

**会影响，但不会完全打断主链。**

当前影响表现为：

- `usedVolumeTimeline = false`
- 章节细纲与正文本次都未使用时间线槽位

### 4. `storyline_context` 是否真实入库

**是。**

### 5. 正文是否真实读取 `storyline_context`

**是。**

证据：

- metadata 中 `storylineConstraintApplied = true`
- `usedStorylineIds / usedBeatIds` 与细纲阶段一致

### 6. 反馈是否真实回写 `currentProgress`

**是。**

### 7. 是否存在假闭环

**存在“部分假闭环风险”，但不是全假。**

具体说：

- 剧情线主链不是假的，已经真实消费
- 但卷级时间线这条支链当前没有真正参与下游

### 8. 是否存在字段写入但下游没消费

当前最明显的是：

- `volume_timelines.timeline_data` 旧 fallback 数据存在
- 但本次下游没有消费它

### 9. 是否存在 fallback 伪装成正常命中

当前主剧情线链路没有伪装：

- 细纲 `isFallback = false`
- 正文 `isFallback = false`

但卷级时间线存在另一种风险：

- 库里保留着旧 fallback 时间线
- 如果不分辨时间线生成是否最新成功，容易误以为“时间线已经正常参与链路”

### 10. 是否建议继续开发

**不建议直接继续叠加依赖时间线的新功能。**

### 11. 是否需要先修卷级时间线 fallback / 解析质量问题

**是，建议优先处理。**

因为现在最明显的剩余短板就是：

- 时间线接口不稳定
- 即使旧数据存在，也没有进入当前下游消费

---

## 下一步建议

建议下一步先做：

- **修复卷级时间线生成的解析稳定性问题**

优先级理由：

1. 剧情线主链已经基本可用；
2. 时间线现在是完整闭环里唯一明显不稳的一环；
3. 如果不先修时间线，再继续开发更依赖时间线的功能，容易把“部分闭环”误当成“完整闭环”。
