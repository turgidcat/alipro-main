# 剧情线闭环最终验收报告

更新时间：2026-06-17

## 测试范围

本次为最终完整闭环复测。

遵循约束：

- 未新增功能
- 未修改业务代码
- 未改数据库
- 未改 Prompt
- 未改前端

运行环境确认：

- 后端端口：`3000`
- 当前后端 PID：`57752`
- 当前启动命令：`node server.js`
- 监听正常

测试样本：

- `bookId`: `b8bd76b6-170f-4666-9233-36e86b1f8b1d`
- `bookTitle`: `破雾修真录`
- `storylineId`: `e8fbc32c-1744-4369-83b5-07bf6a9a16a9`
- `volNum`: `1`
- `chapterNumber`: `8`
- `chapterTitle`: `炼房藏锋`
- `genre`: `urban`

本次实际调用链路：

1. `POST /api/storyline-workbench/:bookId/storylines/:storylineId/generate`
2. `POST /api/storyline-workbench/:bookId/volume/:volNum/timeline/generate`
3. `POST /api/generate`（`promptType: "outline"`）
4. `POST /api/generate`（正文生成）
5. `POST /api/generate`（`promptType: "chapter_feedback"`）

并在接口调用后用新的数据库读取进程复查：

- `storylines.structured_content`
- `volume_timelines.timeline_data`
- `chapter_plans.structured_content`

---

## 验收总表

| 环节 | 是否通过 | 实际结果 | 风险等级 | 是否可接受 | 建议 |
| -- | ---- | ---- | ---- | ----- | -- |
| 单条剧情线生成 | 通过 | 接口 `200`，`structured.isFallback = false`，`keyBeats` 非空，且 `storylines.structured_content` 已真实更新 | 低 | 可接受 | 作为主链上游已可用 |
| 卷级时间线生成 | 部分通过 | 接口 `200`，当前仍返回显式 fallback，`stages/chapterSlots` 为空，但 fallback 信息完整且已入库 | 中 | 可接受 | 进入质量优化，不阻塞主链收口 |
| 章节细纲生成 | 通过 | 返回 `storylineContext` 与 `persistedStorylineContext: true`，`usedStorylineIds/usedBeatIds` 非空，`usedVolumeTimeline = false` | 低 | 可接受 | 继续保持通过 `chapter_plans` 承接 |
| `storyline_context` 入库 | 通过 | `chapter_plans.structured_content.storyline_context` 已真实入库，且样本中保留 `chapter_outline_structure` 与 `chapter_feedback` | 低 | 可接受 | 可作为正文读取入口 |
| 正文生成读取剧情线约束 | 通过 | metadata 明确返回 `storylineConstraintApplied = true`、`usedStorylineIds`、`usedBeatIds`、`usedVolumeTimeline = false`、`isFallback = false` | 低 | 可接受 | 主链消费逻辑成立 |
| 章节反馈生成 | 通过 | 接口 `200`，metadata 返回 `storylineProgressUpdated = true`、`requiresStorylineReview = false` | 低 | 可接受 | 可继续作为闭环末端入口 |
| 反馈回写 `currentProgress` | 通过 | `currentProgress`、`chapter_progress`、`last_chapter_feedback` 均更新为本次 `dev-7` | 低 | 可接受 | 说明回写已真实生效 |
| `activeBeats` 一致性 | 通过 | `currentProgress.activeBeats = ["dev-7"]`，同章旧 beat 未残留；`chapterProgress` 仅保留该章最新记录 | 低 | 可接受 | 当前闭环一致性问题已收口 |

---

## 分环节结果

### 1. 单条剧情线生成

接口结果：

- `200`
- `success: true`

返回的 `structured` 已包含：

- `title`
- `summary`
- `dramaticQuestion`
- `keyBeats`
- `relatedCharacters`
- `currentProgress`

本次关键结果：

- `structured.isFallback = false`
- `keyBeats.length = 13`
- `relatedCharacters.length = 3`

数据库复查：

- `storylines.structured_content` 已真实更新
- 顶层包含：
  - `title`
  - `summary`
  - `dramaticQuestion`
  - `keyBeats`
  - `relatedCharacters`
  - `currentProgress`
  - `last_chapter_feedback`
  - `chapter_progress`

结论：

- **剧情线生成已真实跑通，不是字段拼接假闭环。**

---

### 2. 卷级时间线生成

接口结果：

- `200`
- `success: true`

当前返回为显式 fallback：

- `isFallback: true`
- `requiresReview: true`
- `parseError: "未能从模型返回中提取有效 JSON"`
- `stages.length = 0`
- `chapterSlots.length = 0`

数据库复查：

- `volume_timelines.timeline_data` 已写入本次 fallback 结果

说明：

- 当前时间线质量仍未恢复；
- 但 fallback 已透明暴露；
- 没有伪装成正常时间线。

结论：

- **卷级时间线当前仍是可观测 fallback。**
- **这轮验收里属于可接受风险，不算主链失败。**

---

### 3. 章节细纲生成

接口结果：

- `200`
- 返回 `storylineContext`
- `persistedStorylineContext: true`

关键字段：

- `usedStorylineIds = ["e8fbc32c-1744-4369-83b5-07bf6a9a16a9"]`
- `usedBeatIds = ["dev-7"]`
- `usedVolumeTimeline = false`
- `isFallback = false`

数据库复查：

- `chapter_plans.structured_content.storyline_context` 已真实入库

并且样本中保留了：

- `chapter_outline_structure`
- `chapter_feedback`

补充说明：

- 这次测试样本里没有 `role_execution` 字段，因此只能确认“未发生结构覆盖”，不能证明“已有 `role_execution` 的章节样本也一定保留”。

结论：

- **`storyline_context` 已真实入库。**
- **卷级时间线 fallback 没有污染细纲命中。**

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

内容抽查结论：

- 正文围绕“转移炼药房、核对残页与血钥代价、试探陆听澜立场、外部压力逼近”推进；
- 与本章剧情线命中 beat `dev-7` 基本一致；
- 未见明显提前跳写后续 beat；
- 未见明显角色越级突变。

说明：

- 这里仍是人工抽查，不是全文风格或文学质量审校；
- 但足够证明正文确实在消费章节计划里的剧情线约束。

结论：

- **正文已真实读取剧情线约束。**

---

### 5. 章节反馈生成

接口结果：

- `200`

metadata：

- `storylineProgressUpdated = true`
- `requiresStorylineReview = false`

数据库复查：

- `storylines.structured_content.currentProgress` 已更新
- `storylines.structured_content.chapter_progress` 已更新
- `storylines.structured_content.last_chapter_feedback` 已更新

关键结果：

- 本次 `usedBeatIds = ["dev-7"]` 已真实写入
- `status = "touched"`
- 未出现 `completed`

结论：

- **反馈回写已真实落库。**

---

### 6. activeBeats 一致性

这是本轮验收的重点补测项。

数据库复查结果：

- `currentProgress.activeBeats = ["dev-7"]`
- `currentProgress.chapterProgress` 中本章只有一条最新记录
- `chapter_progress` 中本章只有一条最新记录

这说明：

- 同一章节重跑时，旧 beat 没有继续残留在 `activeBeats`
- 本章进度只保留了最新一次反馈回写结果

结论：

- **`activeBeats` 残留同章旧 beat 的一致性问题已通过本轮真实验收。**

---

## 最终总结

### 1. 当前剧情线主链是否真实跑通

结论：**是，已经真实跑通。**

当前这条主链已经具备真实闭环：

剧情线生成
→ 章节细纲读取剧情线
→ `storyline_context` 入库
→ 正文读取 `storyline_context`
→ 章节反馈回写剧情线进度
→ `activeBeats` 与本章最新 beat 保持一致

### 2. 当前是否还存在假闭环

结论：**主链上已不存在明显假闭环。**

目前仍未完全理想的部分是：

- 卷级时间线质量仍不足，只能 fallback；

但这部分已经：

- 明确标记
- 明确入库
- 未伪装成功
- 未污染主链下游

所以它更像“支链质量问题”，不是主链造假。

### 3. `storyline_context` 是否真实入库

结论：**是。**

### 4. 正文是否真实读取剧情线约束

结论：**是。**

### 5. 反馈是否真实回写 `currentProgress`

结论：**是。**

### 6. `activeBeats` 是否还残留同章旧 beat

结论：**没有。**

当前已收敛为：

- `["dev-7"]`

### 7. 卷级时间线 fallback 是否影响主链

结论：**当前不影响主链。**

证据：

- `usedVolumeTimeline = false`
- `storylineContext.isFallback = false`
- 正文与反馈仍能围绕剧情线 beat 正常推进

### 8. 当前阶段是否可以收口

结论：**可以阶段性收口。**

更准确的表述应是：

> 剧情线主链闭环已完成，卷级时间线暂时以可观测 fallback 方式存在，不阻塞主链收口。

### 9. 下一步是否应该优化卷级时间线质量

结论：**是。**

当前最明确的下一步，就是把卷级时间线从“稳定 fallback”提升到“稳定生成有效结构”。

### 10. 是否建议继续开发其他功能

结论：**可以，但建议优先顺序明确。**

推荐顺序：

1. 先优化卷级时间线质量
2. 再做依赖时间线精度的增强功能
3. 其他剧情线相关扩展可以在主链现有基线上继续开发

---

## 一句话验收结论

当前可以把这个阶段标记为：

> **剧情线主链闭环完成；卷级时间线进入质量优化阶段。**
