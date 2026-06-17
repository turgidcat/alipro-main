# 未来章节承接链路阶段收口

## 1. 当前阶段结论

**未来章节承接链路已完成阶段验收。**

当前已经确认跑通的链路是：

```text
未来章节访问
↓
自动创建最小 chapter_plan
↓
命中卷级时间线 timelineSlot
↓
写入 storyline_context
↓
正文生成读取 storyline_context
↓
章节反馈回写 currentProgress
```

这意味着未来章节现在已经不再卡在“没有现成 `chapter_plan` / 没有真实章节承接层”这一层，而是可以进入现有单章链路。

---

## 2. 已验证内容

本阶段已经完成并确认的结果如下：

- 第 18 / 20 章可以自动创建 `chapter_plan`
- `structured_content.autoCreatedChapterPlan = true`
- 第 18 / 20 章能命中 `timelineSlot`
- 第 18 / 20 章 `usedVolumeTimeline = true`
- 第 18 / 20 章 `storyline_context` 已入库
- 第 18 / 20 章正文生成成功
- 第 18 / 20 章正文 metadata 包含：
  - `storylineConstraintApplied = true`
  - `usedVolumeTimeline = true`
  - `isFallback = false`
- 第 18 / 20 章反馈生成成功
- 第 18 / 20 章能回写 `currentProgress`
- `activeBeats` 没有同章旧 beat 残留
- 第 8 章回归正常，没有被未来章节自动创建逻辑破坏

更具体地说：

### 第 18 / 20 章自动壳子层

- 访问未来章节细纲时，如果没有对应 `chapter_plan`
- 后端会按需补出一个最小可用壳子
- 不会整卷批量预生成

### 第 18 / 20 章细纲层

- `storyline_context` 已写入 `chapter_plans.structured_content`
- `usedVolumeTimeline = true`
- `timelineSlot` 不为空

### 第 18 / 20 章正文层

- 正文生成成功
- metadata 已证明正文读取了约束层

### 第 18 / 20 章反馈层

- 反馈生成成功
- `storylineProgressUpdated = true`
- `requiresStorylineReview = false`
- `currentProgress.chapterProgress` 已出现第 18 / 20 章
- `lastUpdatedChapterNumber` 已推进到最新未来章节

---

## 3. 当前接口契约

这一阶段还同步确认了两个当前接口行为，它们属于**当前契约**，不是本阶段 bug。

### 3.1 正文生成接口

第 18 / 20 章正文生成接口目前：

- 返回正文文本
- 返回 metadata
- **不自动写入 `chapters` 表**

也就是说，正文生成成功并不等于自动在 `chapters` 里创建该章正文记录。

这属于当前产品行为，不应误判为本阶段故障。

### 3.2 章节反馈接口

如果第 18 / 20 章没有 `chapters` 正文记录，反馈接口要正常工作，需要请求体显式提供：

- `content`

如果只传：

```text
bookId + chapterNumber
```

当前接口会返回：

```text
400
bookId, chapterNumber and content are required
```

这说明当前反馈接口的设计是“吃调用方传入的正文内容”，而不是自动从 `chapters` 表兜底取正文。

---

## 4. 当前可接受质量问题

这些问题目前**不阻塞闭环成立**，但属于下一阶段可继续优化的质量项：

### 4.1 `relatedBeatIds` 与 `usedBeatIds` 不完全直连

当前观察到：

- 第 18 / 20 章 `timelineSlot.relatedBeatIds` 为空
- 但 `storyline_context.usedBeatIds`、正文 metadata、反馈回写里仍可能出现：

```json
["climax"]
```

这说明当前 `usedBeatIds` 更像来自**剧情线命中结果**，而不是直接来自 `timelineSlot.relatedBeatIds`。

这不影响本阶段承接链路成立，但属于后续质量优化项。

### 4.2 普通推进 slot 质量仍可优化

当 `relatedBeatIds: []` 时，当前普通推进 slot 仍然能被链路消费，但其表达质量、章节功能感、约束透明度还可以继续加强。

### 4.3 正文是否自动入库 `chapters`

当前正文接口不自动写 `chapters`，这不是本阶段 bug，但确实是后续产品行为设计问题：

- 是继续保持“返回文本，由前端决定是否入库”
- 还是让正文接口默认自动入库

这是下一阶段可以单独设计的问题。

---

## 5. 当前不要做的事

当前已经完成阶段验收，接下来不建议回头做这些事：

- 不要回头重构剧情线主链
- 不要重构卷级时间线生成
- 不要把未来章节一次性全部硬铺成正文
- 不要为了测试伪造 beatId
- 不要把 `relatedBeatIds: []` 强行伪装成关键 beat 命中
- 不要把 feedback 的 `touched` 状态伪装成 `completed`
- 不要误判“正文不自动入库 chapters”为 bug，除非产品设计明确要求自动入库

---

## 6. 下一阶段建议

下一阶段可以从下面几个方向里挑一条进入：

### A. 正文生成后是否自动写入 `chapters` 的产品行为设计

这是体验层面的设计问题，不是本阶段闭环问题。

### B. `timelineSlot.relatedBeatIds` 与 `storyline_context.usedBeatIds` 的对齐优化

这是当前最明显的“质量一致性”方向。

### C. 普通推进 slot 的质量优化

即使没有关键 beat，也让 slot 更有明确阶段功能和可写性。

### D. 全书 / 分卷 / 剧情线 / 时间线 / 章节计划一致性总审计

适合在阶段收口后做一次更高层的结构性体检。

### E. 版本控制和变更收口

如果当前实现和文档已经满意，就可以进入变更整理、分支管理、提交策略等收尾动作。

---

## 7. 相关文档索引

- [`docs/future-chapter-plan-generation-audit.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/future-chapter-plan-generation-audit.md)
- [`docs/on-demand-chapter-plan-autocreate-report.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/on-demand-chapter-plan-autocreate-report.md)
- [`docs/future-chapter-draft-generation-test-report.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/future-chapter-draft-generation-test-report.md)
- [`docs/future-chapter-feedback-writeback-test-report.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/future-chapter-feedback-writeback-test-report.md)
- [`docs/volume-timeline-phase-acceptance-summary.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/volume-timeline-phase-acceptance-summary.md)
- [`docs/storyline-main-loop-phase-acceptance-summary.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/storyline-main-loop-phase-acceptance-summary.md)
- [`docs/novel-generation-architecture-index.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/novel-generation-architecture-index.md)

---

## 最终结论

本阶段现在可以正式固定为：

**未来章节承接链路已完成阶段验收。**

当前已经真实跑通：

```text
自动 chapter_plan
↓
timelineSlot
↓
storyline_context
↓
正文
↓
反馈回写
```

后续再进入的内容，优先应视为**质量优化或产品行为设计**，而不是“未来章节承接链路仍未成立”。
