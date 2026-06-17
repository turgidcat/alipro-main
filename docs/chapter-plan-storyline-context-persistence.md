# 章节计划中的剧情线上下文持久化说明

## 1. 原来剧情线命中结果保存在哪里

原来章节细纲阶段命中的剧情线结果主要只存在两个地方：

1. 细纲生成当次内存中的 `storylineContextMeta`
2. 章节细纲接口返回值里的：
   - `usedStorylineIds`
   - `usedBeatIds`
   - `usedVolumeTimeline`
   - `isFallback`

也就是说，原来它只是“返回给调用方”，并没有稳定落到正文后续能统一读取的位置。

## 2. 现在保存到了哪里

现在会保存到：

- `chapter_plans.structured_content.storyline_context`

保存发生在：

- [`backend/routes/ai.js`](C:/Users/turgidcat/Desktop/alipro-main/backend/routes/ai.js)
- `handleOutlineGeneration()`

当细纲生成接口收到：

- `bookId`
- `chapterNumber`

并且能定位到对应 `chapter_plans` 记录时，会自动把当前章节命中的剧情线结果 merge 进去。

## 3. `chapter_plans.structured_content.storyline_context` 的结构

当前保存结构大致如下：

```json
{
  "storyline_context": {
    "usedStorylineIds": [],
    "usedBeatIds": [],
    "usedVolumeTimeline": false,
    "isFallback": false,
    "relatedStorylines": [],
    "currentBeats": [],
    "mustAdvance": [],
    "mustNotHappen": [],
    "foreshadowingToPlant": [],
    "foreshadowingToPayoff": [],
    "characterChangeBoundaries": [],
    "conflictEscalation": [],
    "timelineSlot": null,
    "source": "structured_storyline|fallback"
  }
}
```

### 字段含义

- `usedStorylineIds`：本章实际命中的剧情线 ID
- `usedBeatIds`：本章实际命中的剧情线节点 ID
- `usedVolumeTimeline`：是否命中了卷级时间线
- `isFallback`：是否走了兜底逻辑
- `relatedStorylines`：本章相关剧情线的简要摘要
- `currentBeats`：本章命中的剧情节点摘要
- `mustAdvance`：本章必须推进的内容
- `mustNotHappen`：本章禁止提前发生的内容
- `foreshadowingToPlant`：本章应埋下的伏笔
- `foreshadowingToPayoff`：本章应回收的伏笔
- `characterChangeBoundaries`：本章角色变化边界
- `conflictEscalation`：本章冲突升级方向
- `timelineSlot`：本章命中的卷级时间线槽位
- `source`：来源是结构化剧情线，还是 fallback

## 4. 如何避免覆盖已有 `structured_content`

当前实现不是整包覆盖，而是：

1. 先读取已有 `chapter_plans.structured_content`
2. 解析成对象
3. 只更新其中的 `storyline_context`
4. 再写回数据库

所以会保留已有字段，例如：

- `chapter_outline_structure`
- `role_execution`
- `chapter_feedback`
- 其他已有 snapshot 字段

也就是说，这一步是 merge，不是重写。

## 5. fallback 如何记录

如果当前章节没有足够的结构化剧情线数据，也会照样保存 `storyline_context`，但会明确标记：

- `isFallback: true`
- `source: "fallback"`

这样后续正文生成就能知道：

- 这是结构化剧情线结果
- 还是只能依赖章节目标的兜底上下文

不会把 fallback 假装成高质量剧情线命中结果。

## 6. 后续正文生成应该如何读取

后续正文生成推荐优先读取：

- `chapter_plans.structured_content.storyline_context`

而不是重新去查 `storylines` 再做一套新的命中逻辑。

推荐读取顺序：

1. 先读 `chapter_plans.structured_content.storyline_context`
2. 再读 `chapter_outline_structure`
3. 再读 `outline_text`
4. 再读 `main_storyline_id / target_storylines` 作为补充标签

这样可以保证：

- 章节细纲和正文共用同一套剧情线命中结果
- 不会出现两套并行逻辑

## 7. 这一步和接口返回的关系

现在不是“只返回不入库”。

当前行为是：

1. 章节细纲接口继续返回 `storylineContext`
2. 但同一份核心结果也会写入 `chapter_plans.structured_content.storyline_context`

所以它既能给调用方即时使用，也能给后续正文生成稳定读取。

## 8. 如何手动测试

### A. 先生成剧情线

调用：

- `POST /api/storylines/:bookId/storylines/:storylineId/generate`

确认：

- `storylines.structured_content` 中已有剧情线结构

### B. 再生成卷级时间线

调用：

- `POST /api/storylines/:bookId/volume/:volNum/timeline/generate`

确认：

- `volume_timelines.timeline_data` 中已有 `chapterSlots`

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

### D. 检查接口返回

确认返回中有：

- `storylineContext.usedStorylineIds`
- `storylineContext.usedBeatIds`
- `storylineContext.usedVolumeTimeline`
- `storylineContext.isFallback`

并且有：

- `persistedStorylineContext: true`

### E. 检查数据库

查看对应章节的 `chapter_plans.structured_content`，确认其中有：

```json
{
  "storyline_context": {
    "...": "..."
  }
}
```

并确认没有覆盖这些旧字段：

- `chapter_outline_structure`
- `role_execution`
- `chapter_feedback`

### F. 再测 fallback 章节

找一个没有生成剧情线或没有命中时间线的章节，再调用一次细纲接口，确认：

- `storylineContext.isFallback === true`
- 数据库里的 `storyline_context.isFallback === true`
- `source === "fallback"`

## 9. 当前结论

这一步已经做到：

1. 章节细纲命中的剧情线结果不再只停留在接口返回里
2. 而是稳定沉淀到了 `chapter_plans.structured_content.storyline_context`
3. 并且保留了已有结构化内容

因此，下一步正文生成就可以优先从 `chapter_plans` 读取 `storyline_context`，不用再重做一套剧情线命中逻辑。
