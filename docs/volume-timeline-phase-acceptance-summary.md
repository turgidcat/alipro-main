# 卷级时间线质量优化阶段收口总结

更新时间：2026-06-17

## 1. 当前阶段结论

**卷级时间线生成质量已从 fallback 可观测阶段进入稳定可用阶段。**

同时，当前卷已经满足：

- `expectedSlotCount = 20`
- `chapterSlots.length = 20`

也就是说：

- **覆盖率已满足当前卷预计章节数**

这一步的意义不是“时间线已经完美”，而是：

- 时间线已经从“只能 fallback”提升到了“能稳定生成可消费结果”
- `chapterSlots` 覆盖率已经达到当前卷配置的预计章节数

---

## 2. 已完成的修复

第 3 阶段已经完成的关键事项包括：

1. 诊断出原始 fallback 主因是：
   - Prompt 过重
   - 输出截断
   - `keyBeats` 展开不足
2. 减重卷级时间线 Prompt
3. 明确展开 `keyBeats`
4. 将 `maxTokens` 从 `3600` 小幅提升到 `4500`
5. 修复 JSON 截断导致 fallback 的问题
6. 优化 `chapterSlots` 覆盖率
7. 计算 `expectedSlotCount`，不硬编码 `20`
8. 让 `chapterSlots` 覆盖到第 `18 / 20` 章
9. 保持 fallback 可观测，不伪装成功

换句话说，第 3 阶段已经把卷级时间线从：

> “接口不稳定 / 输出被截断 / 只覆盖部分章节”

推进到了：

> “接口稳定 / 可正常入库 / 下游已能消费 / 覆盖率达到当前卷预计章节数”

---

## 3. 当前已验证链路

当前已经验证通过的卷级时间线链路如下：

```text
卷级时间线生成
↓
volume_timelines.timeline_data 入库
↓
章节细纲读取 timelineSlot
↓
storyline_context.usedVolumeTimeline = true
↓
正文 metadata 继承 usedVolumeTimeline = true
↓
反馈回写不受影响
```

当前已完成的下游实测重点：

- 第 8 章已完成下游验证
- 第 8 章 `usedVolumeTimeline: true`
- 正文 metadata 已出现 `usedVolumeTimeline: true`
- 反馈回写正常

这说明：

- 卷级时间线已经不再只是“生成后躺库里”
- 它已经进入了章节细纲与正文的真实消费链路

---

## 4. 当前未完全验证的部分

当前尚未完全验证的是：

- 第 18 / 第 20 章的下游消费

但这里要非常明确：

- 第 18 / 第 20 章的 `chapterSlot` 已经存在
- 当前测试书数据库里却只有到第 8 章的 `chapters` / `chapter_plans`

所以不能把：

- 第 18 / 20 章当前没有完成完整下游命中

直接归因成：

- 卷级时间线失败

更准确的判断是：

> **时间线已覆盖未来章节，但未来章节下游消费需要等真实章节计划存在后再验证。**

---

## 5. 当前可接受风险

当前仍然存在、但可接受的风险包括：

1. 第 18 / 第 20 章下游消费尚未在真实章节数据下验证
2. `relatedBeatIds = []` 的普通推进 slot 质量还可以继续优化
3. 当前只是覆盖率达标，不代表所有 slot 的文学质量已经最佳
4. 后续仍需要在真实完整卷数据中做长链路测试

这些风险不会推翻当前阶段结论，但会影响下一阶段的精细化优化方向。

---

## 6. 当前不要做的事

当前阶段明确不建议做这些事：

1. 不要为了测试硬造章节
2. 不要把缺少 `chapter_plans` 的章节误判成时间线失败
3. 不要回头重构剧情线主链
4. 不要让正文重新查询剧情线
5. 不要伪造 beatId
6. 不要为了凑数复制同一个 slot
7. 不要把普通推进 slot 伪装成关键 beat 命中

原因很简单：

- 当前时间线生成问题已经不再是“有没有 slot”
- 接下来更重要的是“在真实章节承接条件下验证消费质量”

---

## 7. 下一阶段建议

下一阶段建议从以下方向中选择：

### A. 补完整章节计划生成链路

让未来章节在有真实 `chapter_plans` 后，再验证第 18 / 20 章的下游消费。

### B. 优化普通推进 slot 的质量

让 `relatedBeatIds: []` 的章节，也能拥有更清晰的阶段功能和更稳定的推进语义。

### C. 开始做全书 / 分卷 / 剧情线 / 时间线 / 章节计划之间的一致性总审计

把现在已经分别跑通的几条链路放到同一张一致性表里整体检查。

### D. 暂时收口，先回到产品功能层面

如果当前研发重点需要切回别处，也可以先把第 3 阶段正式收口。

---

## 8. 相关文档索引

本阶段相关文档如下：

- [`docs/volume-timeline-quality-diagnosis-report.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/volume-timeline-quality-diagnosis-report.md)
- [`docs/volume-timeline-prompt-slimming-bugfix-report.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/volume-timeline-prompt-slimming-bugfix-report.md)
- [`docs/volume-timeline-downstream-consumption-test-report.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/volume-timeline-downstream-consumption-test-report.md)
- [`docs/volume-timeline-slot-coverage-bugfix-report.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/volume-timeline-slot-coverage-bugfix-report.md)
- [`docs/storyline-main-loop-phase-acceptance-summary.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/storyline-main-loop-phase-acceptance-summary.md)
- [`docs/novel-generation-architecture-index.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/novel-generation-architecture-index.md)

---

## 一句话收口

当前阶段可以正式固定为：

> **卷级时间线生成质量已从 fallback 可观测阶段进入稳定可用阶段；chapterSlots 覆盖率已达当前预计章节数；未来章节的下游消费验证依赖真实 chapters / chapter_plans 数据。**
