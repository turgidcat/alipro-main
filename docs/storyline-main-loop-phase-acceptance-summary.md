# 剧情线主链闭环阶段收口总结

更新时间：2026-06-17

## 1. 当前阶段结论

**剧情线主链闭环完成，卷级时间线支链进入质量优化阶段。**

这句话是当前阶段最准确的状态描述。

它的含义是：

- 剧情线主链已经真实跑通；
- 卷级时间线不再是阻塞主链的硬错误；
- 但卷级时间线本身还没有达到“稳定生成有效结构”的质量标准。

---

## 2. 已经真实跑通的主链

当前已经通过最终验收的主链如下：

```text
单条剧情线生成
↓
章节细纲命中剧情线
↓
storyline_context 入库
↓
正文读取剧情线约束
↓
章节反馈回写 currentProgress
↓
activeBeats 保持干净
```

更具体地说，当前已确认：

1. 单条剧情线生成会真实写入 `storylines.structured_content`
2. 章节细纲会命中剧情线 beat，并生成 `storylineContext`
3. `chapter_plans.structured_content.storyline_context` 会真实入库
4. 正文生成会读取 `storyline_context`，而不是重新查剧情线
5. 章节反馈会回写 `storylines.structured_content.currentProgress`
6. `currentProgress.activeBeats` 已不再残留同章旧 beat

---

## 3. 当前仍未完成的支链

当前仍未完成的是：**卷级时间线质量链路**。

当前已知状态：

- 卷级时间线接口不再 `500`
- 解析失败时会返回明确 fallback
- fallback 包含：
  - `isFallback: true`
  - `requiresReview: true`
  - `parseError`
- 当前 `stages` / `chapterSlots` 仍为空

这意味着：

- 卷级时间线现在已经“可观测”
- 但还没有达到“可稳定被下游有效消费”的质量标准

后续需要单独进入卷级时间线质量优化阶段。

---

## 4. 本阶段修复过的问题

本阶段关键修复包括：

1. 后端旧进程导致运行代码与仓库代码不一致
2. `character_arc` 字段不存在
3. `trigger_chapter` / `resolve_chapter` 字段不存在
4. 卷级时间线 JSON 解析失败直接 `500`
5. `currentProgress.activeBeats` 残留同章旧 beat
6. 正文 Prompt 中角色执行、剧情线推进、角色变化边界的优先级不清

这些问题里，前四项解决了“接口能不能跑”，后两项解决了“链路结果是否一致、Prompt 约束是否清楚”。

---

## 5. 当前可接受风险

当前仍存在但可接受的风险包括：

1. 卷级时间线 fallback 仍存在
2. `storylineProgressUpdated: true` 仍更像“更新分支成功执行”，不是强事务级证明
3. beat 状态目前只标记 `touched`，不会自动判断 `completed`
4. 时间线质量还没有进入正式优化完成态

这些风险当前不会阻断剧情线主链闭环，但会影响下一阶段的精度和可解释性。

---

## 6. 当前不要做的事

当前阶段明确不建议做这些事：

1. 不要回头重构剧情线主链
2. 不要新建角色锚点系统
3. 不要新增 `role_change_anchors` 表
4. 不要让正文重新查询剧情线
5. 不要让 fallback 时间线伪装成正常时间线
6. 不要把 beat 自动标记为 `completed`

原因很简单：

- 主链现在已经跑通；
- 当前最重要的是稳住闭环结果，而不是重新开一轮结构扩张。

---

## 7. 下一阶段建议

下一阶段建议单独进入：

**卷级时间线质量优化阶段**

重点方向：

1. 提升卷级时间线 Prompt
2. 提高模型返回 JSON 的稳定性
3. 让 `stages` / `chapterSlots` 非空
4. 让章节细纲在有效时间线存在时能正确使用 `usedVolumeTimeline: true`
5. 保持 fallback 可观测，不污染主链

换句话说，下一阶段不是“重做主链”，而是“把时间线支链从可观测 fallback 提升成可稳定命中”。

---

## 8. 相关文档索引

本阶段相关文档如下：

- [`docs/storyline-closed-loop-final-acceptance-report.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/storyline-closed-loop-final-acceptance-report.md)
- [`docs/storyline-closed-loop-final-retest-with-timeline-fallback.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/storyline-closed-loop-final-retest-with-timeline-fallback.md)
- [`docs/current-progress-active-beats-bugfix-report.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/current-progress-active-beats-bugfix-report.md)
- [`docs/volume-timeline-json-parse-bugfix-report.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/volume-timeline-json-parse-bugfix-report.md)
- [`docs/novel-generation-architecture-index.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/novel-generation-architecture-index.md)
- [`docs/character-layer-three-part-architecture.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/character-layer-three-part-architecture.md)
- [`docs/chapter-draft-prompt-priority-rules.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/chapter-draft-prompt-priority-rules.md)

---

## 一句话收口

当前阶段可以正式固定为：

> **剧情线主链闭环完成，卷级时间线支链进入质量优化阶段。**
