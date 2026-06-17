# 章节反馈回写剧情线进度说明

## 1. 章节反馈入口在哪里

章节反馈入口在：

- [`backend/routes/ai.js`](C:/Users/turgidcat/Desktop/alipro-main/backend/routes/ai.js)

真实链路是：

```text
POST /api/generate
↓
promptType === 'chapter_feedback'
↓
handleChapterFeedbackGeneration()
↓
saveChapterFeedback()
↓
回写 chapter_plans.structured_content.chapter_feedback
↓
同步回写 storylines.structured_content
```

## 2. 原来是否回写剧情线

原来是有回写的，但比较偏“章节日志式”。

项目里原本已经有：

- `syncStorylineProgressFromChapterPlan(...)`

它会把章节反馈同步到：

- `storylines.structured_content.chapter_progress`
- `storylines.structured_content.last_chapter_feedback`

但原来的回写还没有充分利用：

- `chapter_plans.structured_content.storyline_context.usedStorylineIds`
- `chapter_plans.structured_content.storyline_context.usedBeatIds`

也没有把这些信息整理进 `currentProgress`。

## 3. 现在回写到哪里

现在章节反馈生成完成后，会继续回写到：

- `storylines.structured_content.chapter_progress`
- `storylines.structured_content.last_chapter_feedback`
- `storylines.structured_content.currentProgress`

也就是说，现有结构保留，同时补了一层更适合后续闭环读取的 `currentProgress`。

## 4. 回写了哪些字段

当前 `currentProgress` 会尽量维护这些字段：

```json
{
  "lastUpdatedChapterId": "",
  "lastUpdatedChapterNumber": 0,
  "completedBeats": [],
  "activeBeats": [],
  "openQuestions": [],
  "chapterProgress": [
    {
      "chapterId": "",
      "chapterNumber": 0,
      "usedBeatIds": [],
      "summary": "",
      "progressNote": "",
      "deviationRisk": "none|low|medium|high",
      "status": "touched",
      "requiresReview": true,
      "updatedAt": ""
    }
  ]
}
```

### 当前策略

- 如果当前章有 `usedBeatIds`，会记录到 `activeBeats`
- 这一步不会直接把 beat 标记成 `completed`
- 如果信息不足，会标记：
  - `status: "touched"`
  - `requiresReview: true`

## 5. 如何避免覆盖原有 `structured_content`

这一步不是整包重写剧情线结构。

当前做法是：

1. 读取已有 `storylines.structured_content`
2. 保留已有字段
3. 只增量更新：
   - `last_chapter_feedback`
   - `chapter_progress`
   - `currentProgress`

所以不会覆盖原有：

- 剧情线概要
- keyBeats
- payoffs
- 角色关系
- 其他既有规划内容

## 6. fallback 逻辑是什么

### A. 没有 `storyline_context`

如果当前章节没有：

- `chapter_plans.structured_content.storyline_context`

则：

- 不报错
- 不回写剧情线进度
- 反馈接口仍然成功
- 返回：
  - `storylineProgressUpdated: false`

### B. `storyline_context.isFallback === true`

如果存在 `storyline_context`，但：

- `isFallback === true`

则：

- 允许记录章节反馈
- 允许回写章节触达记录
- 但不会把 beat 视为完成
- 会标记：
  - `requiresStorylineReview: true`
  - `status: "touched"`
  - `requiresReview: true`

## 7. 什么情况下不会回写

以下情况不会回写剧情线：

1. 当前反馈内容本身为空，无法形成有效 `chapter_feedback`
2. `storyline_context` 不存在，且也没有有效剧情线挂接
3. 当前章节没有可用 `usedStorylineIds`

这些情况都不会让接口报错，只会让：

- `storylineProgressUpdated: false`

## 8. 什么情况下只标记 touched / requiresReview

当前这一步有意保守。

只要出现下面任意一种情况，就只做“触达记录”，不标记完成：

1. `storyline_context.isFallback === true`
2. 没有足够证据证明 beat 已完成
3. 当前只有章节反馈摘要，没有可靠的完成判定

所以当前实现不会伪装成：

- `completed`

而是优先记录：

- `touched`
- `requiresReview: true`

## 9. 接口返回补充了什么

章节反馈接口现在会尽量返回：

```json
{
  "metadata": {
    "storylineProgressUpdated": true,
    "requiresStorylineReview": false
  }
}
```

这样可以快速确认：

- 这次有没有真正触发剧情线进度回写
- 是否只是 fallback 触达，需要后续人工复核

## 10. 如何手动测试

### A. 先生成剧情线

调用：

- `POST /api/storylines/:bookId/storylines/:storylineId/generate`

### B. 再生成卷级时间线

调用：

- `POST /api/storylines/:bookId/volume/:volNum/timeline/generate`

### C. 再生成章节细纲

调用：

- `POST /api/generate`

确认：

- `chapter_plans.structured_content.storyline_context` 已入库

### D. 再生成正文

调用：

- `POST /api/generate`

正常正文生成请求即可

### E. 再生成章节反馈

调用：

- `POST /api/generate`

并带：

```json
{
  "promptType": "chapter_feedback",
  "bookId": "你的书ID",
  "chapterNumber": 8,
  "chapterTitle": "章节名",
  "content": "正文内容"
}
```

### F. 检查点

1. 返回里是否有：
   - `metadata.storylineProgressUpdated`
   - `metadata.requiresStorylineReview`
2. 对应 `storylines.structured_content.currentProgress` 是否更新
3. `chapter_progress` 是否记录了本章
4. `activeBeats` 是否包含当前章 `usedBeatIds`
5. 是否没有把 beat 直接写成 completed

### G. 无 `storyline_context` 场景

找一个没有 `storyline_context` 的章节再生成反馈，确认：

1. 接口仍然成功
2. `storylineProgressUpdated === false`
3. 不会因为回写失败拖垮反馈主流程

## 11. 当前结论

这一步已经形成了最小闭环：

```text
剧情线
↓
章节细纲
↓
chapter_plans.storyline_context
↓
正文生成
↓
章节反馈
↓
回写 storylines.structured_content.currentProgress
```

但这一步仍然保持保守：

- 不自动重写剧情线
- 不自动判定 beat 完成
- 不覆盖剧情线原有核心规划结构
