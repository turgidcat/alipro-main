# 未来章节正文生成测试报告

## 结论先行

本轮测试结论是：

**未来章节承接链路已经跑通到正文生成层。**

具体表现为：

```text
未来章节细纲生成
↓
自动创建 chapter_plan
↓
命中 timelineSlot
↓
storyline_context 入库
↓
正文生成读取 storyline_context
↓
正文 metadata 出现 usedVolumeTimeline = true
```

但也要明确一个边界：

**本次验证的是“未来章节能读到并消费这层约束”，不是“正文接口会自动写回 chapters”。**

当前 `POST /api/generate` 的正文生成接口仍然是**返回文本 + metadata**，并不会自动把第 18 / 20 章正文入库到 `chapters`。正文真正落库仍依赖前端后续的 `chapters/upsert` 流程。

---

## 测试表

| 测试项 | 是否通过 | 实际结果 | 风险等级 | 建议 |
| --- | ---- | ---- | ---- | -- |
| 第 18 / 20 章是否已有自动创建的 `chapter_plan` | 是 | 查库确认两章都存在 `chapter_plans` 记录，且 `structured_content.autoCreatedChapterPlan = true` | 低 | 可继续测未来章节反馈回写 |
| 第 18 / 20 章是否已有入库的 `storyline_context` | 是 | 两章 `structured_content.storyline_context` 已存在，`usedVolumeTimeline = true`，`timelineSlot` 不为空 | 低 | 说明自动壳子已成功承接时间线 |
| 第 18 章正文是否生成成功 | 是 | `POST /api/generate` 返回 200，正文长度约 1381 字 | 低 | 可继续做反馈回写测试 |
| 第 18 章正文 metadata 是否读取剧情线约束 | 是 | `storylineConstraintApplied = true`，`usedVolumeTimeline = true`，`isFallback = false` | 低 | 已证明正文入口能读到自动创建的 `storyline_context` |
| 第 20 章正文是否生成成功 | 是 | `POST /api/generate` 返回 200，正文长度约 1457 字 | 低 | 可继续测卷末章节反馈链路 |
| 第 20 章正文 metadata 是否读取剧情线约束 | 是 | `storylineConstraintApplied = true`，`usedVolumeTimeline = true`，`isFallback = false` | 低 | 说明未来卷末章节也能接住这层约束 |
| `relatedBeatIds: []` 的普通推进 slot 是否仍能指导正文 | 部分通过 | 第 18 / 20 章的 `timelineSlot.relatedBeatIds` 为空，但正文仍拿到 `usedBeatIds = ["climax"]`，内容也与卷末推进方向一致 | 中 | 当前更像“剧情线 beat + 当次细纲”共同生效，尚不能证明正文直接消费了 slot 的 `focus/mustAdvance` 原字段 |
| 正文接口是否自动写入 `chapters` | 否 | 查库后仍只有第 8 章存在于 `chapters`，第 18 / 20 章未自动新增 | 低 | 这是当前接口既有行为，不应误判为故障 |
| 第 8 章回归是否正常 | 是 | 第 8 章正文生成仍为 200，`usedVolumeTimeline = true`，`usedBeatIds = ["dev-7"]` | 低 | 已验收章节未被自动壳子逻辑破坏 |
| 是否发现新硬错误 | 否 | 本轮未出现接口 500 或字段缺失错误 | 低 | 可进入未来章节反馈回写测试 |

---

## 1. 第 18 / 20 章是否已有自动创建的 `chapter_plan`

查库结果：

- 第 18 章存在 `chapter_plans` 记录
- 第 20 章存在 `chapter_plans` 记录
- 两章均满足：
  - `structured_content.autoCreatedChapterPlan = true`
  - `structured_content.storyline_context` 已存在
  - `storyline_context.usedVolumeTimeline = true`
  - `storyline_context.timelineSlot` 不为空

同时：

- 第 8 章仍是原有记录
- `autoCreatedChapterPlan = false`

这说明第 4B 的按需补壳逻辑仍然稳定存在，没有把老章节误标记成自动创建。

---

## 2. 第 18 章正文是否读取 `storyline_context`

测试方式：

1. 先调用第 18 章细纲生成，拿到当次细纲文本
2. 再按前端真实模式，把该细纲文本作为 `outline` 传给正文生成接口

正文接口返回：

- HTTP 200
- `storylineConstraintApplied = true`
- `usedStorylineIds = ["e8fbc32c-1744-4369-83b5-07bf6a9a16a9"]`
- `usedBeatIds = ["climax"]`
- `usedVolumeTimeline = true`
- `isFallback = false`

正文内容表现：

- 开场是炼药房搜查压力逼近
- 主角与陆听澜立刻转移
- 外事堂调查逐步逼近
- 最后落到“继续靠近雾门 / 继续推进下一步”

这和第 18 章当前时间线槽位的方向是对得上的：

- `focus`: 血月再次临近，主角准备应对
- `mustAdvance`: 血月临近 / 主角准备应对
- `mustNotHappen`: 不要失去所有盟友 / 不要主角独自行动

所以本轮可以确认：

**第 18 章正文已经真实读取到自动创建章节计划上的剧情线约束层。**

---

## 3. 第 20 章正文是否读取 `storyline_context`

测试方式与第 18 章相同。

正文接口返回：

- HTTP 200
- `storylineConstraintApplied = true`
- `usedStorylineIds = ["e8fbc32c-1744-4369-83b5-07bf6a9a16a9"]`
- `usedBeatIds = ["climax"]`
- `usedVolumeTimeline = true`
- `isFallback = false`

正文内容表现：

- 场景直接推进到雾门前
- 白照夜抛出血月旧案真相
- 主角面对“是否进入雾门”的终局选择
- 语义上是卷末收束，而不是继续发散到更后面

这和第 20 章卷末槽位方向也基本一致：

- `focus`: 卷末，主角决定暂不踏入雾门
- `mustAdvance`: 主角决定暂不进入 / 留下悬念
- `mustNotHappen`: 不要所有谜团解开 / 不要主角失去能力

所以本轮也可以确认：

**第 20 章正文已能读取自动创建的 `storyline_context`，并且整体收束方向合理。**

---

## 4. 第 18 / 20 章 metadata 是否出现 `usedVolumeTimeline: true`

是。

三章结果如下：

### 第 18 章

- `storylineConstraintApplied = true`
- `usedVolumeTimeline = true`
- `isFallback = false`

### 第 20 章

- `storylineConstraintApplied = true`
- `usedVolumeTimeline = true`
- `isFallback = false`

### 第 8 章

- `storylineConstraintApplied = true`
- `usedVolumeTimeline = true`
- `isFallback = false`

这说明：

**未来章节自动 `chapter_plan` -> `storyline_context` -> 正文 metadata 这条链已经能真实贯通。**

---

## 5. `relatedBeatIds: []` 的普通推进 slot 是否仍能指导正文

这里要说得更精确一点。

### 现象

第 18 / 20 章当前时间线槽位本身：

- `relatedBeatIds = []`

但正文 metadata 里仍然出现了：

- `usedBeatIds = ["climax"]`

### 这意味着什么

说明当前正文链路并不是“只靠 `timelineSlot.relatedBeatIds` 决定剧情线命中”。

更像是：

1. 自动创建的 `chapter_plan` 把未来章节挂到了当前卷真实主线
2. `buildChapterStorylineContext(...)` 又从该主线里按章号挑到了当前可用的 beat
3. 细纲生成产出的文本与剧情线上下文一起进入正文生成

### 因此本轮能确认的部分

- 即使未来章节 slot 没有显式 `relatedBeatIds`，正文也没有完全空转
- 仍然能产出和卷末方向一致的正文

### 但本轮还不能强证明的部分

- 不能证明正文**直接**消费了 `timelineSlot.focus / mustAdvance` 这几个原字段本身
- 更像是“时间线命中 + 剧情线 beat + 当次细纲文本”共同在起作用

所以这里更准确的结论是：

**普通推进 slot 没有把正文链路卡死；但正文当前对 slot 原字段的直接消费程度，仍可视作后续可优化的质量点。**

---

## 6. 正文是否写入 `chapters`

本轮查库结果：

- `chapters` 里仍只有第 8 章
- 第 18 / 20 章没有新增 `chapters` 记录

这不是 bug，而是当前接口行为如此。

### 当前更准确的描述

`POST /api/generate` 的正文生成接口当前：

- 会返回正文文本
- 会返回 metadata
- **不会自动写入 `chapters`**

正文真正落库，仍然需要前端后续调用：

- `POST /api/books/:bookId/chapters/upsert`

所以本轮不应把“18/20 章没有自动进 chapters”误判为正文生成失败。

---

## 7. 第 8 章是否未被破坏

是。

第 8 章轻量回归结果：

- 正文生成成功
- HTTP 200
- `storylineConstraintApplied = true`
- `usedVolumeTimeline = true`
- `usedBeatIds = ["dev-7"]`

同时根据前一轮查库结果：

- 第 8 章 `chapter_plan` 仍是原有记录
- `autoCreatedChapterPlan = false`
- 旧 `chapter_feedback` 未被误清空

说明本次未来章节测试没有反向污染已验收章节。

---

## 8. 当前是否可以认为“未来章节承接链路”已经跑通

可以，但要带限定语。

### 可以确认已经跑通的部分

```text
未来章节细纲生成
↓
自动创建 chapter_plan
↓
storyline_context 入库
↓
正文生成读取 storyline_context
↓
metadata 出现 usedVolumeTimeline = true
```

### 还没在本轮里验证的部分

```text
正文生成
↓
未来章节反馈生成
↓
剧情线进度回写
```

所以当前更准确的结论是：

**未来章节承接链路已经真实跑通到正文生成层，但还没有完成未来章节反馈回写层的验证。**

---

## 9. 下一步建议

建议下一步进入：

**未来章节反馈回写测试**

原因：

1. 自动 `chapter_plan` 已证明能承接 `storyline_context`
2. 未来章节正文已证明能读取这层约束
3. 当前剩下最关键的一段，就是未来章节反馈是否也能沿用这条自动壳子链路，把进度安全回写到剧情线

如果这一步也通过，就可以更有把握地说：

**未来章节承接链路已经从“细纲 -> 正文”延伸到了“细纲 -> 正文 -> 反馈回写”。**
