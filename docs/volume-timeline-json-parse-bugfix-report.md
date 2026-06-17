# 卷级时间线 JSON 解析稳定性修复报告

更新时间：2026-06-16

## 1. bug 原因

在前一轮完整闭环复测中，卷级时间线生成接口：

- `POST /api/storyline-workbench/:bookId/volume/:volNum/timeline/generate`

出现真实报错：

```text
解析卷级时间线结果失败：未能从模型返回中提取有效 JSON
```

问题本质不是模型 API 调用失败，而是：

1. 模型有时返回旧版 `timeline` 结构、或带说明文字、或截断不完整 JSON；
2. 当前时间线解析逻辑虽然已有基础 JSON 提取，但对“不完整对象 / 混合结构 / 旧版结构兼容”不够稳；
3. 一旦解析失败，服务会直接返回 `500`，没有显式 fallback。

---

## 2. 修改了哪些文件

本次只修改了卷级时间线相关文件：

- `backend/services/storyline-generation-service.js`
- `backend/services/outline-prompts.js`

本次新增文档：

- `docs/volume-timeline-json-parse-bugfix-report.md`

---

## 3. 是否修改数据库

没有。

本次：

- 没有改 schema
- 没有加字段
- 没有写迁移

---

## 4. 是否修改 Prompt

有，但只改了**卷级时间线相关 Prompt**。

本次没有改：

- 单条剧情线生成 Prompt
- 章节细纲 Prompt
- 正文 Prompt
- 反馈 Prompt

改动重点：

1. 明确要求模型只返回一个 JSON 对象；
2. 明确禁止 Markdown 代码块、解释性前后缀；
3. 明确要求顶层必须包含：
   - `volumeId`
   - `volumeTheme`
   - `startState`
   - `endState`
   - `stages`
   - `chapterSlots`
   - `totalChapters`
   - `isFallback`
4. 明确要求 `chapterSlots` 中至少包含：
   - `chapterNumber`
   - `stage`
   - `focus`
   - `relatedBeatIds`
   - `mustAdvance`
   - `mustNotHappen`

---

## 5. JSON 提取逻辑如何增强

本次在 `backend/services/storyline-generation-service.js` 中增强了卷级时间线解析相关逻辑。

### 5.1 兼容的输入形式

当前 JSON 提取至少兼容：

- 纯 JSON
- ```json 代码块
- 普通 ``` 代码块
- JSON 前后带少量说明文字
- 从首个 `{` 开始提取平衡完整对象

### 5.2 新增平衡对象提取

新增了一个“平衡花括号对象提取”逻辑：

- 如果模型输出前后混了文本
- 但中间确实有完整 JSON 对象
- 就尝试从首个 `{` 开始按括号层级提取完整对象

这能比原先只用“首尾大括号裁剪”更稳一些。

### 5.3 兼容旧版 `timeline` 结构

卷级时间线的 shape 现在能兼容两类输入：

1. 新版：
   - `stages`
   - `chapterSlots`
2. 旧版：
   - `timeline`
   - `pacingDesign`

如果模型返回旧版 `timeline`：

- 会自动尝试转成：
  - `stages`
  - `chapterSlots`

其中：

- `chapterSlots` 会从旧 `timeline` 映射出来
- `stages` 在模型没提供时，会根据时间线槽位自动做最小阶段归并

这不是新增业务功能，而是时间线解析层的兼容整理。

---

## 6. 解析失败时 fallback 如何处理

本次最关键的行为变化是：

- **解析失败不再直接 500**

只要模型 API 调用本身成功，哪怕 JSON 解析失败，也会返回一个明确 fallback：

- `isFallback: true`
- `requiresReview: true`
- `parseError`
- `stages: []`
- `chapterSlots: []`

并且会附带一个短的：

- `rawPreview`

只保留短截断调试信息，不长期保存完整原文。

---

## 7. 是否避免把 fallback 伪装成正常时间线

是。

本次 fallback 明确带有：

- `isFallback: true`
- `requiresReview: true`
- `parseError`

所以不会再把“解析失败后的空时间线”伪装成正常生成结果。

---

## 8. 卷级时间线接口是否还会 500

本次修复后复测结果：

- 接口返回 `200`
- `success: true`

当前返回不是正常完整时间线，而是明确 fallback：

- `isFallback: true`
- `requiresReview: true`
- `parseError: "未能从模型返回中提取有效 JSON"`

因此可以确认：

- **当前这类“JSON 提取失败”不再直接导致 500**

---

## 9. `volume_timelines.timeline_data` 是否写入

是。

修复后复测结果显示，数据库中的：

- `volume_timelines.timeline_data`

已经写入了 fallback 结构，而且包含：

- `volumeId`
- `volumeTheme`
- `startState`
- `endState`
- `stages`
- `chapterSlots`
- `rhythmCheck`
- `totalChapters`
- `isFallback`
- `parseError`
- `requiresReview`
- `rawPreview`

这说明：

- 当前入库不再把 fallback 伪装成正常时间线
- 也保留了足够的复测诊断信息

---

## 10. 章节细纲是否能正确识别 `usedVolumeTimeline`

修复后做了轻量复测：

- 章节细纲接口仍能返回 `storylineContext`
- `storylineContext.usedVolumeTimeline = false`

数据库中：

- `chapter_plans.structured_content.storyline_context.usedVolumeTimeline = false`

这说明：

- 当前时间线 fallback **没有被伪装成“有效时间线已命中”**
- 章节细纲仍然只使用了剧情线 beat

换句话说：

- **下游识别是正确的**

---

## 11. 当前返回是正常时间线还是 fallback

本次复测返回是：

- **fallback**

具体表现：

- `isFallback: true`
- `requiresReview: true`
- `parseError` 存在
- `stages = []`
- `chapterSlots = []`

所以当前还不能说“时间线质量问题已解决”，只能说：

- **接口稳定性已经修好**
- **解析失败时的降级行为已经明确**

---

## 12. 当前结论

### 已解决的部分

1. 卷级时间线接口不再因 JSON 提取失败直接 `500`
2. 解析失败时会返回明确 fallback
3. fallback 会明确写入 `volume_timelines.timeline_data`
4. 章节细纲不会误把 fallback 时间线当成有效时间线使用

### 仍未解决的部分

1. 模型输出仍然可能不是可完整解析的标准 JSON
2. 当前时间线生成结果仍可能退化为 fallback
3. `stages / chapterSlots` 目前仍可能为空

---

## 13. 下一步建议

建议：

- **再做一次完整闭环复测**

原因：

1. 当前主剧情线链路已经稳定；
2. 时间线接口稳定性问题已经从“直接 500”降低成“可观测 fallback”；
3. 现在重新跑完整闭环，能够更准确判断：
   - fallback 时间线是否仍然会影响下游
   - 主链是否继续稳定
   - 是否还需要进一步优化时间线 Prompt 或时间线结构映射

如果下一轮完整闭环复测里仍然显示：

- `usedVolumeTimeline = false`
- 且时间线总是 fallback

那下一步重点就应该从“接口稳定性修复”转到：

- **卷级时间线生成质量提升**

---

## 14. 摘要

1. bug 原因：
   - 模型返回的卷级时间线 JSON 不稳定，解析失败时原逻辑直接 500
2. 修改文件：
   - `backend/services/storyline-generation-service.js`
   - `backend/services/outline-prompts.js`
3. 是否修改数据库：
   - 否
4. 是否修改 Prompt：
   - 是，但只改卷级时间线相关 Prompt
5. JSON 提取逻辑如何增强：
   - 增加平衡对象提取
   - 兼容更多包裹形式
   - 兼容旧版 `timeline` 结构
6. 解析失败时 fallback 如何处理：
   - 返回 `isFallback: true`、`requiresReview: true`、`parseError`
7. 是否避免把 fallback 伪装成正常时间线：
   - 是
8. 卷级时间线接口是否还会 500：
   - 这类解析失败场景下，不再 500
9. `volume_timelines.timeline_data` 是否写入：
   - 是，已写入 fallback 结构
10. 章节细纲是否能正确识别 `usedVolumeTimeline`：
   - 是，当前正确为 `false`
11. 下一步是否建议重跑完整闭环测试：
   - 是
