# 章节反馈回写 currentProgress 一致性排查报告

更新时间：2026-06-16

## 排查范围

本次只做排查，不修改业务代码，不修改数据库，不修改 Prompt。

重点检查文件：

- [backend/routes/ai.js](C:/Users/turgidcat/Desktop/alipro-main/backend/routes/ai.js)
- [backend/services/database.js](C:/Users/turgidcat/Desktop/alipro-main/backend/services/database.js)
- [backend/database/init.js](C:/Users/turgidcat/Desktop/alipro-main/backend/database/init.js)

重点追踪链路：

```text
chapter_plans.structured_content.storyline_context.usedStorylineIds
↓
chapter_plans.structured_content.storyline_context.usedBeatIds
↓
handleChapterFeedbackGeneration()
↓
saveChapterFeedback()
↓
syncStorylineProgressFromChapterPlan(...)
↓
storylines.structured_content.currentProgress
↓
storylines.structured_content.chapter_progress
↓
storylines.structured_content.last_chapter_feedback
```

本次核对仍使用上一轮完整复测的同一组数据：

- `bookId`: `b8bd76b6-170f-4666-9233-36e86b1f8b1d`
- `storylineId`: `e8fbc32c-1744-4369-83b5-07bf6a9a16a9`
- `chapterNumber`: `8`
- 本次章节计划命中 `usedBeatIds`: `["dev-7"]`

---

## 检查结果总表

| 检查项 | 结果 | 证据 | 判断 | 风险等级 |
| --- | -- | -- | -- | ---- |
| 章节计划里的 storyline ID 是否明确 | 是 | `chapter_plans.main_storyline_id`、`target_storylines`、`storyline_context.usedStorylineIds` 都是 `e8fbc32c-1744-4369-83b5-07bf6a9a16a9` | 本次没有写错剧情线 ID | 低 |
| 章节计划里的 usedBeatIds 是什么 | `["dev-7"]` | 最新 `chapter_plans.structured_content.storyline_context.usedBeatIds` 为 `["dev-7"]` | 本次反馈阶段拿到的剧情线命中 beat 是 `dev-7` | 低 |
| 回写函数实际更新的是哪个 storyline | 同一个 storyline | `syncStorylineProgressFromChapterPlan(...)` 用 `main_storyline_id + target_storylines + storyline_context.usedStorylineIds` 去重后查询；本样本最终只命中同一条 storyline | 本次没有更新到别的 storyline | 低 |
| 章节号是否写错 | 否 | `chapter_plans.chapter_number = 8`；`lastUpdatedChapterNumber = 8`；`chapter_progress.chapter_number = 8` | 本次没有写错 chapter | 低 |
| 本次 usedBeatIds 是否真正入库 | 是 | `storylines.structured_content.currentProgress.chapterProgress[0].usedBeatIds = ["dev-7"]`；`chapter_progress[0].used_beat_ids = ["dev-7"]`；`last_chapter_feedback.used_beat_ids = ["dev-7"]` | 本次 beat 已真实写入数据库 | 低 |
| `storylineProgressUpdated: true` 是否等价于“数据库持久化成功” | 否 | `saveChapterFeedback()` 里 `storylineProgressUpdated = updatedCount > 0`；`updatedCount` 来自 `syncStorylineProgressFromChapterPlan(...)` 返回的 `rows.length` | 它表示“命中了可更新的 storyline 行”，不是严格的持久化成功证明 | 中 |
| currentProgress 看起来像旧数据的原因 | 部分属实 | `currentProgress.activeBeats` 目前是 `["dev-8","dev-7"]`，但 `chapterProgress`、`last_chapter_feedback` 已是 `dev-7` | 最可能不是“没写入”，而是 `activeBeats` 仍保留旧 beat，容易误判 | 高 |
| 写入字段位置是否不一致 | 否 | 代码明确写入 `storylines.structured_content.currentProgress`、`chapter_progress`、`last_chapter_feedback`；当前查库位置与代码写入位置一致 | 不是看错 JSON 路径 | 低 |
| 是否存在多数据库 / 持久化文件不一致 | 当前证据不支持 | 运行时初始化和保存都固定使用 `backend/database/novel.db`；当前库内时间戳与最新测试时间一致 | 当前更像字段语义问题，不像多库问题 | 低 |
| 是否存在旧 chapter_plan / 旧 feedback 覆盖新数据 | 当前未见证据 | 最新 `chapter_plans.updated_at` 与 `storylines.updated_at` 都对齐到 `2026-06-16 15:46:57`，且对应内容已是 `dev-7` | 当前没有发现“被旧 structured_content 覆盖回去” | 低 |

---

## 逐项排查结论

### 1. 是否写错剧情线 ID

结论：**没有写错。**

本次同一章节计划中可见：

- `main_storyline_id = e8fbc32c-1744-4369-83b5-07bf6a9a16a9`
- `target_storylines = ["e8fbc32c-1744-4369-83b5-07bf6a9a16a9"]`
- `storyline_context.usedStorylineIds = ["e8fbc32c-1744-4369-83b5-07bf6a9a16a9"]`

`syncStorylineProgressFromChapterPlan(...)` 会把这三处合并去重，再按：

```sql
SELECT id, structured_content, status
FROM storylines
WHERE book_id = ? AND id IN (...)
```

去找目标剧情线。

本样本最终只命中同一条 storyline，所以：

- 章节计划里的 storyline ID
- 回写函数更新的 storyline ID
- 查库查看的 storyline ID

三者一致。

---

### 2. 是否写错章节号

结论：**没有写错。**

当前库内一致表现为：

- `chapter_plans.chapter_number = 8`
- `currentProgress.lastUpdatedChapterNumber = 8`
- `chapter_progress[0].chapter_number = 8`
- `last_chapter_feedback.chapter_number = 8`

所以这次不是“写到别的 chapter”导致的错位。

---

### 3. 是否字段位置不一致

结论：**不是。**

代码在 [backend/services/database.js](C:/Users/turgidcat/Desktop/alipro-main/backend/services/database.js) 的 `syncStorylineProgressFromChapterPlan(...)` 里，明确把结果写回：

- `storylines.structured_content.currentProgress`
- `storylines.structured_content.chapter_progress`
- `storylines.structured_content.last_chapter_feedback`

当前查库时查看的也是这三个位置，和代码写入位置一致。

所以这次不属于“查库看错字段层级”。

---

### 4. `storylineProgressUpdated: true` 到底代表什么

结论：**它不是严格的“真实持久化成功”标志。**

在 [backend/routes/ai.js](C:/Users/turgidcat/Desktop/alipro-main/backend/routes/ai.js) 的 `saveChapterFeedback(...)` 里：

- 先调用 `syncStorylineProgressFromChapterPlan(...)`
- 再用：

```js
storylineProgressUpdated = updatedCount > 0;
```

而 `updatedCount` 来自 [backend/services/database.js](C:/Users/turgidcat/Desktop/alipro-main/backend/services/database.js) 中：

```js
return rows.length;
```

也就是说，`storylineProgressUpdated: true` 的真实含义更接近：

> 找到了至少一条符合条件的 storyline 行，并执行了更新分支。

它**不等价于**以下更强语义：

- 数据内容确实发生变化；
- 持久化文件一定已经刷盘成功；
- 本次写入的 beat 一定和你预期完全一致。

所以这个 metadata 目前是“有更新动作”，不是“强一致成功证明”。

---

### 5. 本次 usedBeatIds 到底有没有真正写进数据库

结论：**有，而且已经写进去。**

本次库内真实状态：

- `chapter_plans.structured_content.storyline_context.usedBeatIds = ["dev-7"]`
- `storylines.structured_content.currentProgress.chapterProgress[0].usedBeatIds = ["dev-7"]`
- `storylines.structured_content.chapter_progress[0].used_beat_ids = ["dev-7"]`
- `storylines.structured_content.last_chapter_feedback.used_beat_ids = ["dev-7"]`

这说明：

- 本次 `dev-7` 已经穿过了完整链路；
- 不是“接口说成功但 beat 完全没落库”。

---

### 6. 为什么 currentProgress 看起来仍像旧数据

结论：**最可能的原因是看到了 `activeBeats`，而它当前会保留旧 beat。**

当前库里的 `currentProgress` 是：

- `lastUpdatedChapterNumber = 8`
- `chapterProgress[0].usedBeatIds = ["dev-7"]`
- 但 `activeBeats = ["dev-8", "dev-7"]`

这会造成一种很容易误判的现象：

- 如果你看 `chapterProgress`、`chapter_progress`、`last_chapter_feedback`，本次写入已经是 `dev-7`
- 如果你看 `activeBeats`，会觉得还混着旧的 `dev-8`

根因在当前逻辑：

```js
const nextActiveBeats = [...new Set([
  ...existingActiveBeats.filter((beatId) => beatId && !contextBeatIds.includes(beatId)),
  ...contextBeatIds
])];
```

这段逻辑只会去掉“本次 contextBeatIds 本身”，不会按“同一章节旧记录”去清理之前留下的旧 beat。

所以如果：

1. 第一次这章命中了 `dev-8`
2. 后来重跑，这章改成命中 `dev-7`

那么：

- `chapter_progress` 会按章节号替换成最新条目
- 但 `activeBeats` 可能会同时残留 `dev-8` 和 `dev-7`

这就是当前最像“旧数据没清掉”的地方。

---

### 7. currentProgress 当前设计到底该怎么看

结论：**如果要判断“本次章节反馈是否真的写入”，不应优先看 `activeBeats`。**

当前更可靠的判断位置是：

1. `storylines.structured_content.last_chapter_feedback`
2. `storylines.structured_content.chapter_progress`
3. `storylines.structured_content.currentProgress.chapterProgress`

而 `currentProgress.activeBeats` 更像：

- 一个累计中的“当前活跃 beat 列表”
- 不是严格的一章一条、也不是“本次最新 beat 的唯一真相”

所以：

- 若要判断“本次回写是否成功”，优先看 `chapter_progress` / `last_chapter_feedback`
- 不要单独拿 `activeBeats` 当唯一判断标准

---

### 8. 是否是数据库持久化 / 多数据库问题

结论：**当前证据不支持这个判断。**

原因：

1. 运行时初始化数据库使用的是：
   - `backend/database/init.js`
   - 路径固定为 `backend/database/novel.db`
2. 保存数据库使用的是：
   - `backend/services/database.js`
   - 同样写回 `backend/database/novel.db`
3. 当前查库读到的：
   - `chapter_plans.updated_at = 2026-06-16 15:46:57`
   - `storylines.updated_at = 2026-06-16 15:46:57`
   - 且内容已经是 `dev-7`

这更像是：

- 数据确实已经写到同一个文件里；
- 不是写进了别的 DB；
- 也不像“内存库更新了但文件没落盘”。

---

## 最终判断

### 1. `storylineProgressUpdated: true` 是否可信

结论：**半可信。**

它可信的部分：

- 说明确实进入了剧情线回写分支；
- 说明至少命中了一条可更新 storyline。

它不可信的部分：

- 它不是“强一致持久化成功”的严格证明；
- 也不是“本次写入内容完全符合预期”的严格证明。

### 2. 本次 `usedBeatIds` 是否实际写入数据库

结论：**是，已经写入。**

本次 `dev-7` 已写入：

- `currentProgress.chapterProgress`
- `chapter_progress`
- `last_chapter_feedback`

### 3. 写入的是哪个 storyline

结论：**就是测试使用的同一条 storyline：**

- `e8fbc32c-1744-4369-83b5-07bf6a9a16a9`

### 4. 写入的是哪个字段

结论：**写入了三个位置：**

- `storylines.structured_content.currentProgress`
- `storylines.structured_content.chapter_progress`
- `storylines.structured_content.last_chapter_feedback`

### 5. currentProgress 不一致的最可能原因

结论：**最可能是 `currentProgress.activeBeats` 保留了旧 beat，造成“像旧数据”的视觉错觉。**

不是最可能的原因：

- 写错剧情线
- 写错章节号
- 看错 JSON 层级
- 多数据库

### 6. 是否是测试查看位置错误

结论：**部分是。**

如果上次主要盯着 `activeBeats` 看，就很容易误判成“没更新”；
如果看 `chapterProgress`、`chapter_progress`、`last_chapter_feedback`，本次 `dev-7` 实际已经落库。

### 7. 是否是代码回写 bug

结论：**存在轻度一致性设计问题，但不是“完全没写入”的硬失败 bug。**

更准确地说：

- 回写主链是工作的；
- 但 `activeBeats` 的维护策略会保留同章节旧 beat，导致 currentProgress 语义不够干净。

### 8. 是否是数据库持久化问题

结论：**当前看不是。**

### 9. 是否需要修业务代码

结论：**建议修，但属于小范围一致性修复，不是链路重做。**

### 10. 如果要修，建议最小修复点在哪里

建议优先看：

1. [backend/services/database.js](C:/Users/turgidcat/Desktop/alipro-main/backend/services/database.js) 的 `syncStorylineProgressFromChapterPlan(...)`
   - 重点是 `activeBeats` 的更新策略
   - 应考虑按“同章节旧记录”清理旧 beat，而不只是按“本次 beatId 列表”过滤

2. [backend/routes/ai.js](C:/Users/turgidcat/Desktop/alipro-main/backend/routes/ai.js) 的 `saveChapterFeedback(...)`
   - 如需更准确 metadata，可考虑把 `storylineProgressUpdated` 的语义收紧
   - 但这属于第二优先级

---

## 一句话结论

这次排查的真实结论不是“反馈根本没写进去”，而是：

> 本次 `usedBeatIds=dev-7` 实际已经写进了对应 storyline 的 `currentProgress/chapter_progress/last_chapter_feedback`；上次看起来像旧数据，更可能是因为 `currentProgress.activeBeats` 仍保留旧的 `dev-8`，再加上 `storylineProgressUpdated` 这个 metadata 本身语义偏宽，容易让人误以为它代表了更强的一致性保证。
