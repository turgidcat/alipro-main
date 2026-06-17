# 卷级时间线 Prompt 减重修复报告

更新时间：2026-06-17

## 1. 修改了哪些文件

本次只修改了卷级时间线相关文件：

- [backend/services/outline-prompts.js](C:/Users/turgidcat/Desktop/alipro-main/backend/services/outline-prompts.js)
- [backend/services/storyline-generation-service.js](C:/Users/turgidcat/Desktop/alipro-main/backend/services/storyline-generation-service.js)

本次新增文档：

- [docs/volume-timeline-prompt-slimming-bugfix-report.md](C:/Users/turgidcat/Desktop/alipro-main/docs/volume-timeline-prompt-slimming-bugfix-report.md)

本次没有修改：

- `storylines.js` route
- 章节细纲逻辑
- 正文生成逻辑
- 反馈回写逻辑
- 前端

---

## 2. 是否修改数据库

没有。

本次：

- 没改 schema
- 没加字段
- 没写迁移

---

## 3. Prompt 如何减重

本次卷级时间线 Prompt 的核心目标，从：

> 生成一整套时间线分析与调度报告

收窄为：

> **优先生成短而完整的 `chapterSlots` JSON**

具体减重方式：

1. 把任务目标改成“优先保证 `chapterSlots` 可用”
2. 强调：
   - 只返回一个 JSON 对象
   - 不要 Markdown
   - 不要解释
   - 不要前言后记
   - 不要输出 schema 之外字段
3. 明确要求：
   - `focus` 不超过 30 字
   - `mustAdvance` 每章最多 2 条
   - `mustNotHappen` 每章最多 2 条
   - 每条都要短

这次的目标很明确：

- **优先让 JSON 完整闭合**
- 而不是追求结构花哨或分析丰富

---

## 4. 删除或弱化了哪些重复输出结构

本次主要弱化或移除了这些会拉长输出的结构：

- `timeline`
- `rhythmCheck`
- 过长的节奏解释
- 每章重复的长文本说明

同时把 `stages` 从“必须详细输出”改成：

- 可选保留
- 最多 3-5 个
- 文字必须短

这样可以显著减少模型输出长度。

---

## 5. keyBeats 如何展开进 Prompt

这是本次最关键的修复点之一。

之前时间线 Prompt 只会告诉模型：

- 这条剧情线叫什么
- 类型是什么
- 冲突是什么
- “已存节点数”有多少

但不会真正展开 `keyBeats`。

本次新增了专门的时间线剧情线格式化逻辑，把每条剧情线至少展开为：

- `storylineId`
- `title`
- `summary`
- `chapterRange`
- `keyBeats`

每个 `keyBeat` 至少给模型：

- `beatId`
- `title`
- `summary`
- `chapterApprox`

并在 Prompt 里明确写出：

- `relatedBeatIds` 只能从这些 `keyBeats` 的 `beatId` 里选
- 不允许编造新的 beatId
- 没有对应 beat 的章节可以给空数组

这一步直接解决了之前“模型只知道有多少节点，不知道节点具体内容”的问题。

---

## 6. maxTokens 是否调整

有，小幅调整了。

本次将卷级时间线调用的 `maxTokens` 从：

- `3600`

调整为：

- `4500`

原因不是“靠堆 token 掩盖问题”，而是：

1. 先通过 Prompt 减重减少输出
2. 再给模型一个稍微更安全的闭合空间

这样做比直接无限放大 token 更稳，也更符合本次“先减重、再小幅放宽”的原则。

---

## 7. 卷级时间线是否仍 fallback

本次复测结果：

- **不再 fallback**

真实接口结果：

- `status = 200`
- `success = true`
- `structured.isFallback = false`
- `parseError = null`

同时 `completion_tokens` 从此前经常顶满的：

- `3600`

降到了：

- `1198`

这说明：

- 之前的主要问题“输出被截断”已经明显缓解

---

## 8. `chapterSlots` 是否非空

是，已经非空。

本次复测结果：

- `stages.length = 3`
- `chapterSlots.length = 12`

并且每个 `chapterSlot` 都有：

- `chapterNumber`
- `stage`
- `focus`
- `relatedBeatIds`
- `mustAdvance`
- `mustNotHappen`

例如第 1 章：

- `chapterNumber = 1`
- `relatedBeatIds = ["opening"]`

第 8 章：

- `chapterNumber = 8`
- `relatedBeatIds = ["dev-7"]`

---

## 9. `relatedBeatIds` 是否来自真实 keyBeats

是。

本次查库核对：

- 时间线中所有 `relatedBeatIds`
- 都能在对应剧情线的真实 `keyBeats.beatId` 中找到

校验结果：

- `invalidBeatIds = []`

也就是说，当前没有发现模型编造不存在的 beatId。

---

## 10. 下游 `usedVolumeTimeline` 是否正确变化

是。

本次轻量复测章节细纲后：

- `storylineContext.usedVolumeTimeline = true`
- `persistedStorylineContext = true`

说明：

- 当前生成出的时间线已经能被细纲命中并使用
- 不再只是“生成完躺库里”

补充说明：

- 目前 `timelineSlot` 仍是较瘦的结构
- 但已经足够让下游识别“当前章确实命中了有效时间线槽位”

---

## 11. 复测结果与剩余观察

### 已确认成功的部分

1. 卷级时间线接口不再 fallback
2. `chapterSlots` 已非空
3. `relatedBeatIds` 来自真实 `keyBeats`
4. `volume_timelines.timeline_data` 已成功写入
5. 下游 `usedVolumeTimeline` 已从 `false` 变成 `true`

### 仍需记录的观察

当前卷设定里：

- `estimated_chapters = 20`

但这次模型实际生成的：

- `chapterSlots.length = 12`

这说明本次修复已经解决了：

- JSON 截断
- fallback
- 无槽位

但还没完全解决：

- 是否覆盖了“预计总章节数”的全部章节

所以当前状态更准确地说是：

- **卷级时间线已经从 fallback 阶段进入“可用但还可继续优化”的阶段**

---

## 12. 下一步建议

建议下一步做一轮**时间线下游复测**，重点看：

1. 不同章节是否都能命中合理的 `timelineSlot`
2. `usedVolumeTimeline: true` 是否稳定出现
3. 正文阶段是否能真正消费时间线槽位信息
4. 如果需要，再单独优化“chapterSlots 是否应覆盖全部预计章节”

---

## 一句话结论

这次修复的结果可以概括为：

> **卷级时间线 Prompt 已成功减重，keyBeats 已明确展开进上下文，模型不再因输出过长而 fallback，`chapterSlots` 已开始真实生成并被下游识别。**
