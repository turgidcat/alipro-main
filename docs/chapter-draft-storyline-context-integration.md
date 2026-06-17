# 正文生成读取章节剧情线约束说明

## 1. 正文生成入口在哪里

正文生成入口在：

- [`backend/routes/ai.js`](C:/Users/turgidcat/Desktop/alipro-main/backend/routes/ai.js)

具体链路是：

```text
POST /api/generate
↓
默认进入 handleChapterContentGeneration()
↓
loadBookGenerationContext(bookId, chapterNumber)
↓
读取 chapter_plans
↓
读取 chapter_plans.structured_content.storyline_context
↓
整理成本章剧情线约束文本
↓
buildCreativePrompt()
↓
DeepSeek 生成正文
```

## 2. 原来正文是否读取剧情线

原来会读取一点，但偏浅。

原来的情况是：

1. 读取 `chapter_plans.main_storyline_id`
2. 读取 `chapter_plans.target_storylines`
3. 主要把它们映射成剧情线名称，混进上下文

原来不会真正读取：

- `chapter_plans.structured_content.storyline_context`
- 结构化 beat 命中结果
- 卷级时间线槽位

所以原来的正文生成，更像“知道这章挂了哪些线”，还不是“受剧情线节点约束写正文”。

## 3. 现在从哪里读取剧情线

现在正文生成读取的是：

- `chapter_plans.structured_content.storyline_context`

读取内容包括：

- `usedStorylineIds`
- `usedBeatIds`
- `usedVolumeTimeline`
- `isFallback`
- `relatedStorylines`
- `currentBeats`
- `mustAdvance`
- `mustNotHappen`
- `foreshadowingToPlant`
- `foreshadowingToPayoff`
- `characterChangeBoundaries`
- `conflictEscalation`
- `timelineSlot`
- `source`

## 4. 为什么不重新查询 `storylines`

因为上一步已经把章节细纲阶段命中的剧情线结果沉到：

- `chapter_plans.structured_content.storyline_context`

如果正文生成再重新查：

- `storylines`
- `volume_timelines`

并重新做一遍命中逻辑，就会出现两套并行规则：

1. 章节细纲阶段一套
2. 正文生成阶段一套

这样很容易导致：

- 细纲命中 A 节点
- 正文又按 B 节点写

所以当前实现坚持：

**正文只读 `chapter_plans` 已沉淀好的结果，不重算。**

## 5. Prompt 增加了哪些剧情线约束

正文生成现在会在上下文里新增一个结构段：

```text
【本章剧情线约束】
- 关联剧情线：
- 当前剧情节点：
- 本章必须推进：
- 本章禁止提前发生：
- 需要埋下的伏笔：
- 需要回收的伏笔：
- 角色变化边界：
- 冲突升级方向：
- 卷级时间线槽位：
- 执行要求：
```

其中会明确约束：

1. 不要提前写后续剧情节点
2. 不要跳过本章必须推进项
3. 不要随意回收未到时机的伏笔
4. 角色变化不能超过本章边界
5. 冲突升级要符合本章剧情线节奏

## 6. fallback 逻辑是什么

### A. 没有 `storyline_context`

如果 `chapter_plans.structured_content.storyline_context` 不存在，正文仍然正常生成。

此时会明确加入：

```text
【本章剧情线约束】
当前没有结构化 storyline_context，仅使用章节计划和已有上下文兜底。
```

### B. `isFallback === true`

如果有 `storyline_context`，但其中标记：

- `isFallback: true`

则会明确告诉模型：

```text
当前没有完整结构化剧情线命中，仅使用章节计划和已有上下文兜底。
```

不会伪装成已经有完整剧情线节点。

## 7. 返回里补了什么调试信息

正文生成返回的 `metadata` 里现在会尽量带：

- `storylineConstraintApplied`
- `usedStorylineIds`
- `usedBeatIds`
- `usedVolumeTimeline`
- `isFallback`

这样可以快速确认正文这次到底有没有吃到剧情线约束。

## 8. 如何测试

### A. 先生成剧情线

调用：

- `POST /api/storylines/:bookId/storylines/:storylineId/generate`

### B. 再生成卷级时间线

调用：

- `POST /api/storylines/:bookId/volume/:volNum/timeline/generate`

### C. 再生成章节细纲

调用：

- `POST /api/generate`

请求体至少带：

```json
{
  "promptType": "outline",
  "bookId": "你的书ID",
  "chapterNumber": 8,
  "genre": "urban",
  "bookTitle": "书名",
  "chapterTitle": "章节名"
}
```

确认：

- `chapter_plans.structured_content.storyline_context` 已入库

### D. 再生成正文

调用：

- `POST /api/generate`

请求体至少带：

```json
{
  "bookId": "你的书ID",
  "chapterNumber": 8,
  "genre": "urban",
  "bookTitle": "书名",
  "chapterTitle": "章节名"
}
```

### E. 检查点

1. 返回是否成功
2. `metadata.storylineConstraintApplied` 是否为 `true`
3. `metadata.usedStorylineIds` 是否有值
4. `metadata.usedBeatIds` 是否有值
5. `metadata.usedVolumeTimeline` 是否符合实际
6. `metadata.isFallback` 是否符合实际

### F. 无 `storyline_context` 场景

再找一个没有 `storyline_context` 的章节生成正文，确认：

1. 仍然能成功生成
2. `metadata.isFallback === true`
3. 不会因为缺少剧情线约束而报错

## 9. 当前结论

这一步已经做到：

1. 正文生成从 `chapter_plans.structured_content.storyline_context` 读取剧情线约束
2. 不再重查 `storylines`
3. 不再重查 `volume_timelines`
4. 不再重做剧情线命中逻辑

所以现在正文和章节细纲终于开始共用同一份章节剧情线承接结果。
