# 未来章节反馈回写测试报告

## 结论先行

本轮测试结论是：

**未来章节承接链路已经真实跑通到反馈回写层。**

也就是说，下面这条链现在已经能成立：

```text
未来章节细纲
↓
自动创建 chapter_plan
↓
future storyline_context 入库
↓
未来章节正文
↓
未来章节反馈
↓
storylines.structured_content.currentProgress 回写
```

但要同步说明一个接口现实：

- 当前 `chapter_feedback` 接口**必须显式传入 `content`**
- 如果只传 `bookId + chapterNumber`，会直接返回 400

所以本次验证的是：

**在未来章节没有 `chapters` 正文记录、但调用方能提供本章正文内容时，反馈链路仍然可以正常回写剧情线进度。**

---

## 测试表

| 测试项 | 是否通过 | 实际结果 | 风险等级 | 建议 |
| --- | ---- | ---- | ---- | -- |
| 第 18 / 20 章是否已有自动创建的 `chapter_plan` | 是 | 两章都存在 `chapter_plans` 记录，且 `autoCreatedChapterPlan = true` | 低 | 可视作未来章节承接层已建立 |
| 第 18 / 20 章是否已有 `storyline_context` | 是 | 两章都存在 `structured_content.storyline_context`，`usedVolumeTimeline = true`，`isFallback = false` | 低 | 说明细纲层入库稳定 |
| 第 18 章反馈是否生成成功 | 是 | `POST /api/generate` 返回 200，`storylineProgressUpdated = true`，`requiresStorylineReview = false` | 低 | 可继续收口 |
| 第 18 章是否回写 `currentProgress` | 是 | `currentProgress.chapterProgress` 中存在第 18 章记录，`usedBeatIds = ["climax"]` | 低 | 已证明未来章节可写剧情线进度 |
| 第 20 章反馈是否生成成功 | 是 | `POST /api/generate` 返回 200，`storylineProgressUpdated = true`，`requiresStorylineReview = false` | 低 | 可继续收口 |
| 第 20 章是否回写 `currentProgress` | 是 | `currentProgress.chapterProgress` 中存在第 20 章记录，且 `lastUpdatedChapterNumber = 20` | 低 | 已证明未来章节最新反馈能推进剧情线状态 |
| `activeBeats` 是否干净 | 基本通过 | 当前为 `["dev-7", "climax"]`，对应第 8 章与第 18/20 章；没有出现同章旧 beat 残留 | 低 | 当前更像多章有效聚合，不是脏数据 |
| beat 是否仍为 `touched` | 是 | 第 18 / 20 / 8 章回写的 `status` 均为 `touched`，无 `completed` 伪装 | 低 | 当前语义保持正确 |
| 没有 `chapters` 记录是否阻塞反馈 | 不阻塞，但有条件 | 第 18 / 20 章没有 `chapters` 记录，接口仍能成功；前提是请求体里提供 `content` | 中 | 若后续要让前端少传一份正文，可单独优化接口读取策略 |
| 第 8 章回归是否正常 | 是 | 第 8 章反馈仍成功，`storylineProgressUpdated = true`，已有章节未被破坏 | 低 | 老链路稳定 |
| `timelineSlot.relatedBeatIds` 与 `usedBeatIds` 是否一致 | 否 | 第 18 / 20 章 slot 的 `relatedBeatIds` 为空，但回写的 `usedBeatIds = ["climax"]` | 中 | 记录为后续质量优化点，不影响本轮闭环成立 |

---

## 1. 第 18 / 20 章反馈是否生成成功

本轮测试用的是第 4C 生成出的真实未来章节正文内容。

### 第 18 章

反馈接口返回：

- HTTP 200
- `storylineProgressUpdated = true`
- `requiresStorylineReview = false`

反馈摘要核心内容：

- 炼药房搜查压力升级
- 主角与陆听澜转移到雾门边缘
- 白照夜出现
- 父亲与雾门关系被抛出

### 第 20 章

反馈接口返回：

- HTTP 200
- `storylineProgressUpdated = true`
- `requiresStorylineReview = false`

反馈摘要核心内容：

- 白照夜揭露血月旧案核心线索
- 主角探查雾门后景象
- 旧约侵蚀加重
- 最终暂不入门并撤离

### 第 8 章回归

第 8 章反馈接口也仍返回：

- HTTP 200
- `storylineProgressUpdated = true`
- `requiresStorylineReview = false`

这说明未来章节测试没有把既有反馈链路冲坏。

---

## 2. 第 18 / 20 章是否回写 `currentProgress`

是，而且是**真实写入到剧情线表**。

查 `storylines.structured_content` 后，当前可见：

### `currentProgress.chapterProgress`

已经包含三条记录：

- 第 8 章
- 第 18 章
- 第 20 章

其中未来章节部分为：

### 第 18 章

- `chapterNumber = 18`
- `usedBeatIds = ["climax"]`
- `status = "touched"`
- `requiresReview = false`

### 第 20 章

- `chapterNumber = 20`
- `usedBeatIds = ["climax"]`
- `status = "touched"`
- `requiresReview = false`

同时：

- `currentProgress.lastUpdatedChapterNumber = 20`

这说明第 20 章回写已成为当前最新进度点。

---

## 3. `storylineProgressUpdated` 是否可信

结合接口结果和查库结果，本轮可以认为：

**本次的 `storylineProgressUpdated = true` 是可信的。**

理由：

1. 接口返回成功：
   - 第 18 章 `storylineProgressUpdated = true`
   - 第 20 章 `storylineProgressUpdated = true`

2. 数据库里能看到对应变化：
   - `chapter_plans.structured_content.chapter_feedback` 已写入
   - `storylines.structured_content.chapter_progress` 已新增第 18 / 20 章记录
   - `storylines.structured_content.currentProgress.chapterProgress` 已新增第 18 / 20 章记录
   - `storylines.structured_content.last_chapter_feedback.chapter_number = 20`

因此这次不是“只调用了函数就算成功”，而是**确实有文件层面的真实回写结果**。

---

## 4. `requiresStorylineReview` 是否合理

本轮结果：

- 第 18 章：`requiresStorylineReview = false`
- 第 20 章：`requiresStorylineReview = false`
- 第 8 章：`requiresStorylineReview = false`

这和当前上下文是一致的：

- `storyline_context.isFallback = false`
- `usedBeatIds` 非空
- 没有走“只有 fallback，没有结构化命中”的兜底路径

所以这里的 `false` 是合理的。

---

## 5. `activeBeats` 是否干净

当前 `currentProgress.activeBeats` 为：

```json
["dev-7", "climax"]
```

这个结果本轮判断为：

**基本干净。**

原因：

1. `dev-7` 对应已存在的第 8 章
2. `climax` 对应第 18 / 20 章
3. 没有出现“同一章节重跑后残留旧 beat”的脏状态
4. 没有出现 `completed`

注意这里的“干净”不是说只有一个 beat，而是说：

**当前保留下来的 beat，都能在有效的 `chapterProgress` 记录中找到来源，没有看到同章旧 beat 残留。**

---

## 6. beat 是否仍为 `touched`

是。

查库结果里：

- 第 8 章 `status = "touched"`
- 第 18 章 `status = "touched"`
- 第 20 章 `status = "touched"`

没有任何一条被伪装成：

- `completed`

所以本轮仍保持了此前约定的进度语义。

---

## 7. 没有 `chapters` 正文记录是否影响反馈

### 现象

当前数据库里：

- `chapters` 只有第 8 章
- 第 18 / 20 章没有自动写入 `chapters`

但本轮反馈接口仍然成功。

### 原因

当前 `handleChapterFeedbackGeneration()` 的接口校验是：

- `bookId` 必须有
- `chapterNumber` 必须有
- `content` 必须有

也就是说，它**并不要求数据库中必须先有 `chapters.content`**，而是要求请求体自己带正文内容。

本轮实测：

- 如果只传 `promptType + bookId + chapterNumber`
- 接口会返回：
  - `400`
  - `bookId, chapterNumber and content are required`

但如果请求体中显式提供未来章节正文内容：

- 即便 `chapters` 表里没有第 18 / 20 章记录
- 反馈接口仍可正常生成并回写

### 本轮判断

所以更准确的结论是：

**没有 `chapters` 记录不会阻塞反馈回写，但前提是调用方要显式传入本章正文内容。**

这不是 bug，而是当前接口契约。

---

## 8. 第 8 章是否未被破坏

是。

本轮第 8 章轻量回归：

- 反馈生成成功
- `storylineProgressUpdated = true`
- `requiresStorylineReview = false`
- 进度仍回写到 `dev-7`

同时目前剧情线里的多章进度并存结构也正常：

- 第 8 章保留 `dev-7`
- 第 18 / 20 章保留 `climax`

说明自动未来章节壳子没有破坏已存在章节的反馈逻辑。

---

## 9. `timelineSlot.relatedBeatIds` 与 `usedBeatIds` 是否存在不一致

存在。

### 第 18 / 20 章时间线槽位

当前 `timelineSlot.relatedBeatIds`：

- 为空

### 但反馈回写使用的 `usedBeatIds`

两章都写成了：

- `["climax"]`

### 这说明什么

说明当前未来章节的 `usedBeatIds` 并不是直接从 `timelineSlot.relatedBeatIds` 原样透传下来的。

更像是：

1. 自动创建的 `chapter_plan` 先挂接到卷内真实剧情线
2. `storyline_context` 再从该剧情线里按当前章号命中可用 beat
3. 反馈回写最终使用的是 `storyline_context.usedBeatIds`

这不影响本轮闭环是否成立，但确实是后续质量优化点：

**时间线槽位和剧情线 beat 的显式对齐还可以继续做得更直白。**

---

## 10. 当前是否可以认为“未来章节承接链路”已经跑完整

可以，但要精确表述。

当前已经真实跑通的是：

```text
未来章节细纲
↓
自动创建 chapter_plan
↓
storyline_context 入库
↓
未来章节正文生成
↓
未来章节反馈生成
↓
剧情线进度回写 currentProgress
```

所以从“承接链路”这个角度说：

**未来章节承接链路已经跑完整。**

但仍有两个后续质量点，不影响当前闭环成立：

1. 正文接口不自动写入 `chapters`
2. `timelineSlot.relatedBeatIds` 与 `usedBeatIds` 不是完全直连

---

## 11. 下一步建议

本轮之后，我的建议是：

### 优先建议：进入第 4 阶段收口

因为本阶段真正要验证的东西已经都验证到了：

- 自动未来章节壳子可创建
- 可承接时间线
- 可入库 `storyline_context`
- 正文可读取
- 反馈可回写

### 收口后再考虑的质量点

1. **正文入库体验**
   - 当前正文接口只返回文本，不自动写 `chapters`
   - 如果后面要让未来章节体验更顺滑，可以单独优化正文落库动作

2. **beat 对齐质量**
   - `timelineSlot.relatedBeatIds` 为空，但 `usedBeatIds` 仍来自剧情线命中
   - 这不是当前阻塞，但适合作为后续质量优化项

---

## 最终判断

本轮最关键的结论是：

**未来章节没有现成 `chapters` 记录，并不会阻止反馈回写链路成立；只要调用方提供正文内容，未来章节就已经能沿着自动 `chapter_plan` -> `storyline_context` -> `feedback` -> `currentProgress` 这条链完整跑通。**
