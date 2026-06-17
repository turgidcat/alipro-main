# 卷级时间线质量诊断报告

更新时间：2026-06-17

## 诊断范围

本次只做诊断，不修改业务代码，不修改 Prompt，不修改数据库，不修改前端。

重点检查文件：

- [backend/services/storyline-generation-service.js](C:/Users/turgidcat/Desktop/alipro-main/backend/services/storyline-generation-service.js)
- [backend/services/outline-prompts.js](C:/Users/turgidcat/Desktop/alipro-main/backend/services/outline-prompts.js)
- [backend/routes/storylines.js](C:/Users/turgidcat/Desktop/alipro-main/backend/routes/storylines.js)

重点检查函数与路径：

- `generateVolumeTimeline(...)`
- `parseVolumeTimelineResponse(...)`
- `buildVolumeTimelinePrompt(...)`
- 卷级时间线 route：`POST /api/storyline-workbench/:bookId/volume/:volNum/timeline/generate`

测试样本：

- `bookId`: `b8bd76b6-170f-4666-9233-36e86b1f8b1d`
- `volumeNumber`: `1`
- `volumeId`: `258ec518-4647-441b-a2a7-7dbf61c2e0d9`
- 当前卷主题：`逃离与初探`

---

## 检查结果总表

| 检查项 | 结果 | 证据 | 判断 | 风险等级 |
| --- | -- | -- | -- | ---- |
| Prompt 是否明确要求只返回 JSON | 是 | `VOLUME_TIMELINE_SYSTEM` 和 `buildVolumeTimelinePrompt(...)` 都明确要求“只返回 JSON / 不要 Markdown / 不要解释” | 不是完全没约束 | 低 |
| Prompt 是否要求 `stages` / `chapterSlots` 非空 | 间接要求，但不够硬 | Prompt 给了完整 schema 和示例，但没有明确写“必须非空，至少按总章数生成所有 chapterSlots” | 约束还不够收紧 | 中 |
| Prompt 是否明确使用剧情线 `keyBeats` | 文案上要求，实传上下文不足 | `buildVolumeTimelinePrompt(...)` 写了“结合真实节点”，但实际 `formatExistingStorylines(...)` 只给了节点数，不给具体 `keyBeats` 列表 | 关键输入缺失 | 高 |
| 当前输入上下文是否足够生成 `chapterSlots` | 部分足够，但不理想 | 有卷主题、总章数、章节计划、反馈、剧情线基础信息；但缺少逐 beat 明细输入 | 对“排章节槽位”不够友好 | 高 |
| 模型原始返回是否完全不是 JSON | 不是 | `rawPreview` 明确以 `{ "volumeId": ..., "volumeTheme": ..., "stages": [...]` 开头 | 不是完全跑偏 | 中 |
| 模型返回是否更像“未写完的 JSON” | 是 | 多次复测 `completion_tokens = 3600`，正好顶满 `maxTokens`；`rawPreview` 显示 JSON 中途截断 | 截断概率很高 | 高 |
| 解析器是否支持代码块/前后缀/旧字段 | 是，基础支持已具备 | `tryExtractJson(...)` 支持纯 JSON、代码块、首尾大括号、平衡对象、数组；`ensureVolumeTimelineShape(...)` 兼容 `timeline` → `chapterSlots` | 解析器不是主要短板 | 低 |
| 当前 fallback 是否正确入库 | 是 | `buildVolumeTimelineFallback(...)` 明确写 `isFallback: true`、`requiresReview: true`、`parseError`；route 会正常入库 | fallback 行为正确 | 低 |
| fallback 是否污染下游 | 否 | 章节细纲与正文链路当前表现为 `usedVolumeTimeline: false` | 主链未被污染 | 低 |

---

## 1. 卷级时间线 Prompt 诊断

### 当前 Prompt 已经明确的部分

当前卷级时间线 Prompt 已经明确要求：

1. 只返回一个 JSON 对象
2. 不要 Markdown 代码块
3. 不要解释或前后缀文字
4. 顶层必须包含：
   - `volumeId`
   - `volumeTheme`
   - `startState`
   - `endState`
   - `stages`
   - `chapterSlots`
   - `totalChapters`
   - `isFallback`
5. `chapterSlots` 至少要有：
   - `chapterNumber`
   - `stage`
   - `focus`
   - `relatedBeatIds`
   - `mustAdvance`
   - `mustNotHappen`

### 当前 Prompt 不够理想的部分

虽然规则已经写了，但仍有三个问题：

1. **输出结构过重且重复**
   - 同时要求：
     - `stages`
     - `timeline`
     - `chapterSlots`
     - `rhythmCheck`
   - 其中 `timeline` 和 `chapterSlots` 高度重复
   - 容易把输出拉得很长

2. **没有足够硬地要求 `chapterSlots` 必须完整覆盖章节**
   - 现在更像“给 schema”
   - 不是“必须生成 1..N 每章一个 slot”

3. **虽然说要结合剧情线真实节点，但 Prompt 本身没拿到节点明细**
   - 这会让模型知道“应该用 beat”
   - 却看不到 beat 到底是什么

结论：

- **Prompt 方向是对的，但仍然偏重、偏宽、偏重复。**

---

## 2. 卷级时间线输入上下文诊断

当前传给模型的上下文，已经包含：

- `bookId`
- `volumeId` / `volumeNumber`
- 卷名 / 卷主题
- 章节数量（当前卷 `estimated_chapters = 20`）
- 剧情线列表
- 已有章节计划
- 已有章节反馈
- 角色信息
- 伏笔信息

这说明：

- **不是完全没有上下文**

但对“生成可执行的 `chapterSlots`”来说，最关键的缺口是：

### 缺口 1：没有把每条剧情线的 `keyBeats` 明细展开给模型

当前 `buildVolumeTimelinePrompt(...)` 里用的是：

- `formatExistingStorylines(context.storylines || [], '')`

而 `formatExistingStorylines(...)` 实际输出的是：

- 剧情线名
- 类型
- 冲突
- `已存节点数`
- `currentProgress`

它**没有把 `structured_content.keyBeats` 逐条展开进去**。

这意味着：

- 模型知道这条线“有 13 个节点”
- 但不知道这 13 个节点分别是什么、应该大概落在哪些章

对于要生成：

- `relatedBeatIds`
- `mustAdvance`
- `mustNotHappen`
- `chapterSlots`

这种按章分配的结果来说，这个缺口非常关键。

### 缺口 2：上下文冗长，但针对时间线排章不够“结构化”

当前 Prompt 里带了很多：

- 全书目标
- 分卷目标
- 已有章节计划摘要
- 章节反馈

这些并非无用，但它们会挤占 token 和注意力。

相比之下，更应该被突出的是：

- 当前卷共有多少章
- 每条剧情线有哪些 keyBeats
- 每个 beat 预估在哪章附近
- 哪些 beat 已经被章节计划消耗掉
- 还剩哪些 beat 需要安排进后续章节

结论：

- **当前上下文“有很多信息”，但对生成 `chapterSlots` 最关键的结构化信息还不够。**

---

## 3. 模型原始返回诊断

本次复测卷级时间线接口后，返回结果为：

- `status = 200`
- `isFallback = true`
- `requiresReview = true`
- `parseError = "未能从模型返回中提取有效 JSON"`

本次 `usage` 关键值：

- `prompt_tokens = 3420`
- `completion_tokens = 3600`
- `total_tokens = 7020`

这里最重要的信号是：

- **`completion_tokens` 正好等于当前 `maxTokens = 3600`**

这非常像：

- 模型还没写完
- 输出在 token 上限处被截断

本次 `rawPreview` 前 500 字片段显示：

```text
{
  "volumeId": "258ec518-4647-441b-a2a7-7dbf61c2e0d9",
  "volumeNumber": 1,
  "volumeTheme": "逃离与初探",
  "totalChapters": 20,
  "pacingDesign": "...",
  "stages": [
    {
      "stage": "逃离与觉醒",
      "focus": "...",
      "chapterRange": [1, 4],
      "primaryStoryline": "血月旧案主线"
    },
    {
      "stage": "调查与试探",
      "focus": "...",
      "chapterRange": [5, 10],
      "primaryStoryline": "血月旧案主线"
    },
    {
      "stage":
```

这说明模型返回属于：

- **不是完全不是 JSON**
- **不是只有说明文字**
- **也不像只是字段名不匹配**
- **更像“正在返回有效 JSON，但中途被截断”**

结论：

- **当前失败类型最像：JSON 开头正确，但结构不完整，原因大概率是输出过长被截断。**

---

## 4. 解析失败位置诊断

解析失败发生在：

- [backend/services/storyline-generation-service.js](C:/Users/turgidcat/Desktop/alipro-main/backend/services/storyline-generation-service.js)
- `parseVolumeTimelineResponse(raw, context)`
- 内部调用 `tryExtractJson(raw)`

当前流程是：

1. DeepSeek 返回文本
2. `tryExtractJson(raw)` 尝试提取 JSON
3. 如果失败：
   - `parseVolumeTimelineResponse(...)` 返回 `ok: false`
   - 同时构造 fallback 数据
4. `generateVolumeTimeline(...)` 不再报错，而是返回 fallback

### 解析器当前支持的输入形式

`tryExtractJson(...)` 当前已支持：

- 纯 JSON
- ```json 代码块
- 普通 ``` 代码块
- 首尾大括号提取
- 平衡花括号对象提取
- JSON 数组提取

### 当前为什么还是失败

不是因为它不支持代码块，也不是因为它不支持前后缀。

当前更像是：

- 模型返回本身就没闭合
- 对象没完整结束
- `JSON.parse(...)` 无法成立

所以这次解析器不是“误杀了完整 JSON”，而是**面对不完整 JSON 无法救回**。

结论：

- **当前 parseError 是真实的，不是主要由解析器误判导致。**

---

## 5. 入库行为诊断

当前 fallback 入库行为是正确的。

接口 route 会把 `parsed` 直接写入：

- `volume_timelines.timeline_data`

而 fallback 内容明确包含：

- `isFallback: true`
- `requiresReview: true`
- `parseError`
- `stages: []`
- `chapterSlots: []`
- `rawPreview`

所以当前没有出现：

- 把 fallback 伪装成正常时间线
- 把空结果装成成功时间线

结论：

- **入库行为当前是对的。**

---

## 6. 对下游影响诊断

当前 fallback 对下游的影响是可控的。

已验证现象：

- 章节细纲当前会识别：
  - `usedVolumeTimeline: false`
- 正文仍能基于剧情线 beat 正常生成
- fallback 没有污染主链

所以当前卷级时间线的问题是：

- **质量问题**
- 不是**主链阻塞问题**

---

## 最终判断

### 1. 卷级时间线 fallback 的最可能原因

最可能原因是：

**Prompt 过重且输出结构重复，导致模型输出超长，在 `maxTokens = 3600` 处被截断；同时关键 beat 上下文又没有被结构化喂给模型，进一步增加了模型自由发挥和冗长解释式组织的概率。**

### 2. 是 Prompt 问题、上下文问题、解析问题，还是混合问题

结论：**混合问题，但主因不是解析器。**

优先级判断：

1. **主因：Prompt/输出结构问题**
2. **次因：关键上下文不足（尤其是 `keyBeats` 没有展开）**
3. **再次因：token 上限导致的截断**
4. **不是主因：解析器误杀**

### 3. 模型原始返回是否包含可用 JSON

结论：**包含了“看起来可用的 JSON 开头”，但当前很大概率没有返回完整闭合 JSON。**

也就是说：

- 不是完全废输出
- 但也不能算当前已经有可直接解析的完整 JSON

### 4. 当前输入上下文是否足够生成 `chapterSlots`

结论：**部分足够，但对高质量 `chapterSlots` 还不够。**

最关键缺口是：

- 没有把剧情线 `keyBeats` 逐条明确给模型

### 5. 解析器是否还需要增强

结论：**可以继续增强，但不是当前第一修复点。**

因为这次的主要问题更像：

- 原始输出就没写完整

解析器再强，也不能稳定修复一个被 token 截断的对象。

### 6. Prompt 是否需要进一步收紧

结论：**需要。**

尤其需要解决：

- 输出结构重复
- 对 `chapterSlots` 完整覆盖要求不够硬
- 没有明确把“先按 beat 排章，再生成阶段/槽位”作为主任务

### 7. 是否需要补充卷级章节范围 / 章节数量

结论：**当前章节数量已有，但还需要更明确的“beat → chapter range”结构。**

不是简单补数量，而是要补：

- `keyBeats`
- `chapterApprox`
- 已完成/未完成节点

### 8. 是否需要让时间线生成优先基于 `keyBeats`

结论：**需要，而且应当是下一步修复重点之一。**

### 9. 下一步建议是改 Prompt、改上下文、改解析器，还是三者都小幅调整

结论：**建议三者都小幅调整，但优先级明确：**

1. **先改 Prompt**
   - 减少重复输出结构
   - 缩短任务目标
   - 强制按章节生成 `chapterSlots`

2. **再改上下文**
   - 把每条剧情线的 `keyBeats` 明确展开给模型
   - 尤其是 `beatId + title + chapterApprox`

3. **最后再小幅补解析器**
   - 解析器可继续兜底更多半结构化情况
   - 但不应把它当成主解法

---

## 一句话诊断结论

当前卷级时间线 fallback 的真实原因，最像是：

> **模型并不是完全没有返回 JSON，而是在一个过重、重复、缺少关键 beat 明细的任务里，生成了开头正确但长度失控的 JSON，并在 `maxTokens` 上限处被截断；因此当前问题主要是 Prompt 与上下文组织问题，解析器只是在如实报告“不完整 JSON 无法解析”。**
