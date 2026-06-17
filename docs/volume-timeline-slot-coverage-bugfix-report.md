# 卷级时间线 chapterSlots 覆盖率修复报告

更新时间：2026-06-17

## 1. 修改了哪些文件

本次只修改了卷级时间线相关文件：

- [backend/services/storyline-generation-service.js](C:/Users/turgidcat/Desktop/alipro-main/backend/services/storyline-generation-service.js)

本次没有修改：

- 数据库结构
- 前端
- 章节细纲主逻辑
- 正文生成逻辑
- 反馈回写逻辑

本次新增文档：

- [docs/volume-timeline-slot-coverage-bugfix-report.md](C:/Users/turgidcat/Desktop/alipro-main/docs/volume-timeline-slot-coverage-bugfix-report.md)

---

## 2. 是否修改数据库

没有。

本次：

- 没改 schema
- 没新增字段
- 没写迁移

---

## 3. 如何计算 `expectedSlotCount`

本次在时间线生成服务里新增了明确的 `expectedSlotCount` 计算逻辑。

优先级为：

1. 当前卷的 `estimated_chapters`
2. 当前上下文中的 `totalChapters`
3. `volume_plans.structured_content.totalChapters`
4. `volumeOutline.totalChapters`
5. 当前卷剧情线的最大 `end_chapter`
6. 当前卷已有 `chapterPlans.length`
7. 兜底默认值

也就是说，这次不再简单按：

- 关键 beat 数量
- 已有 slot 数量

去隐式推断章节覆盖范围。

本次测试样本中：

- `expectedSlotCount = 20`

这个值来自当前卷的：

- `estimated_chapters = 20`

---

## 4. Prompt 如何要求覆盖全部预计章节

本次在卷级时间线 Prompt 中明确新增了这些要求：

1. `chapterSlots` 必须生成 `expectedSlotCount` 个
2. 必须覆盖 `1..expectedSlotCount` 的每一章
3. 每个 `chapterNumber` 必须唯一
4. `chapterNumber` 必须按章节顺序连续生成
5. 不要只为关键 beat 生成 slot
6. 没有 keyBeat 的章节也必须生成普通推进 slot
7. `relatedBeatIds` 必须从真实 `keyBeats` 中选择
8. 没有对应 beat 的章节可以使用 `relatedBeatIds: []`
9. 不允许编造 beatId

这一步的核心，就是把模型从：

> “挑重点章节写时间线”

明确改成：

> “先把全卷每章都占上一个 slot，再决定哪些章挂 beat、哪些章只做普通推进”

---

## 5. 是否仍控制了输出长度

是。

虽然这次要求覆盖更多章节，但仍然保持了输出长度控制：

- `focus` 继续限制为短句
- 每章 `mustAdvance` 最多 1-2 条
- 每章 `mustNotHappen` 最多 1-2 条
- `stages` 仍保持短结构
- 不恢复长篇 `timeline` / `rhythmCheck` / 解释文本

所以这次是：

- **覆盖率增强**
- 不是重新放大输出负担

---

## 6. `chapterSlots.length` 修复前后对比

修复前：

- `expected_chapters = 20`
- `chapterSlots.length = 12`

修复后：

- `expectedSlotCount = 20`
- `actualSlotCount = 20`
- `chapterSlots.length = 20`

并且：

- `chapterNumber` 为连续 1~20
- 没有发现重复章节号

这说明：

- 当前问题已经不再是“只覆盖部分关键章节”
- 而是已经尽量覆盖了整卷预计章节

---

## 7. 是否覆盖第 18 / 第 20 章

### 在时间线生成结果中

结论：**已覆盖。**

当前查库可见：

- 第 18 章 slot 存在
- 第 20 章 slot 存在

例如：

- 第 18 章：
  - `chapterNumber = 18`
  - `relatedBeatIds = []`
  - 有普通推进型 `focus/mustAdvance/mustNotHappen`

- 第 20 章：
  - `chapterNumber = 20`
  - `relatedBeatIds = []`
  - 同样有普通推进型 slot

这符合本次目标：

- 没有关键 beat 的章节也必须有 slot

### 在下游章节细纲实测中

结论：**当前第 18 / 20 章仍没有转成 `usedVolumeTimeline: true`。**

但原因不是：

- 时间线没生成
- slot 没覆盖

而是当前测试书的数据库现实状态是：

- `chapters` 只到第 8 章
- `chapter_plans` 也只到第 8 章

也就是说：

- 当前并没有第 18 / 20 章的真实章节数据和章节计划承接层
- 所以下游实测里，第 18 / 20 章仍返回空 fallback

这更像是：

- **下游测试数据前置条件不足**
- 不是本次 slot 覆盖率修复失败

---

## 8. 是否存在伪造 beatId

结论：**没有。**

本次校验结果：

- 所有 `relatedBeatIds` 都来自真实剧情线 `keyBeats`
- `invalidBeatIds = []`

对于新增覆盖的第 13~20 章：

- 当前允许 `relatedBeatIds = []`

这比编造不存在的 beatId 更稳，也符合要求。

---

## 9. 是否有 `coverageWarning` 或 `requiresReview`

本次结果：

- `isFallback = false`
- `expectedSlotCount = 20`
- `actualSlotCount = 20`
- `coverageWarning = ""`
- `requiresReview = false`

说明：

- 当前不是“覆盖不足但勉强成功”
- 而是已达到当前卷预计章节覆盖目标

---

## 10. 下游章节细纲是否能使用新增 slot

### 第 8 章

结论：**仍然可以。**

实测结果：

- `usedVolumeTimeline = true`
- `persistedStorylineContext = true`
- `usedBeatIds = ["dev-7"]`

说明本次修复没有把原本能命中的章节打坏。

### 第 18 / 第 20 章

结论：**当前实测仍未变成 `usedVolumeTimeline = true`。**

真实返回仍为：

- `usedVolumeTimeline = false`
- `isFallback = true`

结合查库可知，最可能原因是：

- 当前书里根本没有第 18 / 20 章的 `chapters` / `chapter_plans` 数据
- 不是时间线 slot 不存在

所以这一步要如实区分：

- **slot 覆盖率问题：本次已修好**
- **下游对未来章节的承接问题：当前测试数据不足，暂时无法证明已吃到**

---

## 11. 测试结果

### 语法检查

通过：

- `backend/services/storyline-generation-service.js`
- `backend/services/outline-prompts.js`

### 后端重启

已重启：

- 新 PID：`54940`

### 卷级时间线接口复测

结果：

- `status = 200`
- `isFallback = false`
- `expectedSlotCount = 20`
- `chapterSlots.length = 20`

### 下游轻量复测

结果：

- 第 8 章：`usedVolumeTimeline = true`
- 第 18 章：`usedVolumeTimeline = false`
- 第 20 章：`usedVolumeTimeline = false`

说明：

- 旧的有章样本不受影响
- 新增覆盖章节的下游验证，受当前测试数据仅有 1~8 章限制

---

## 12. 下一步建议

当前这一步已经解决的是：

- **卷级时间线 slot 覆盖率不足**

下一步建议分开看：

1. 如果要继续做卷级时间线阶段收口：
   - 可以先把“时间线生成覆盖率修复完成”记账

2. 如果要继续验证下游：
   - 需要补真实的第 18 / 20 章章节计划 / 章节数据
   - 再测这些新增 slot 是否能被细纲和正文真正消费

---

## 一句话结论

这次修复已经把卷级时间线从：

> **12/20 覆盖不足**

提升到：

> **20/20 章节 slot 覆盖达成，且没有伪造 beatId；当前剩下的不是 slot 生成问题，而是未来章节在测试数据层面尚未建立下游承接。**
