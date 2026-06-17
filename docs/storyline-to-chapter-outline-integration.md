# 剧情线接入章节细纲说明

## 1. 当前章节细纲生成入口在哪里

当前章节细纲生成入口在：

- [`backend/routes/ai.js`](C:/Users/turgidcat/Desktop/alipro-main/backend/routes/ai.js)

具体链路是：

```text
POST /api/generate
↓
promptType === 'outline'
↓
handleOutlineGeneration()
↓
buildOutlinePrompt()
↓
DeepSeek 生成章节细纲文本
```

## 2. 原来是否使用剧情线

原来只算“弱使用”，不算真正使用结构化剧情线。

原来的实际情况：

1. `loadBookGenerationContext()` 会读取：
   - `chapter_plans.main_storyline_id`
   - `chapter_plans.target_storylines`
2. 但主要只是把剧情线名称放进 `contextNotes`
3. `handleOutlineGeneration()` 本身没有主动读取：
   - `storylines.structured_content`
   - `volume_timelines.timeline_data`
4. `buildOutlinePrompt()` 也没有“本章剧情线约束”结构段

所以原来的章节细纲生成，不是按剧情线节点来生成，更像“带一点剧情线标签的普通章节大纲”。

## 3. 现在如何读取剧情线

本次在 [`backend/routes/ai.js`](C:/Users/turgidcat/Desktop/alipro-main/backend/routes/ai.js) 里新增了辅助逻辑：

- `buildChapterStorylineContext(...)`

它会做这些事：

1. 读取 `chapter_plans.main_storyline_id`
2. 读取 `chapter_plans.target_storylines`
3. 从 `storylines.structured_content` 中查找本章相关剧情线
4. 尝试匹配本章对应的 `beat`
5. 提取可用于 Prompt 的结构化约束

当前提取的信息包括：

- 关联剧情线标题
- 当前剧情节点 / beat
- 本章必须推进的事件
- 本章禁止提前发生的事件
- 需要埋下的伏笔
- 需要回收的伏笔
- 相关角色
- 冲突升级方向

## 4. 现在如何读取卷级时间线

现在会读取：

- `volume_timelines.timeline_data`

读取方式：

1. 先根据 `chapter_plans.volume_number` 找当前卷
2. 再找 `volume_timelines` 对应卷的数据
3. 从 `chapterSlots / timeline` 中找当前章的 slot

如果命中，会提取：

- 当前章在卷级时间线里的主推进线
- active storylines
- 节奏 / 氛围说明
- 伏笔操作

## 5. Prompt 增加了哪些剧情线约束

`buildOutlinePrompt()` 现在会新增一个结构段：

```text
剧情线约束：
【本章剧情线约束】
- 关联剧情线：
- 当前剧情节点：
- 本章必须推进：
- 本章禁止提前发生：
- 需要埋下的伏笔：
- 需要回收的伏笔：
- 角色 / 局势变化：
- 冲突升级方向：
- 卷级时间线槽位：
```

同时新增硬约束：

1. 优先遵守章节任务与剧情线约束
2. 不要自由偏航
3. 每个要点都要服务当前章必须推进的剧情节点
4. 不能提前写出被禁止发生的事件

## 6. fallback 逻辑是什么

如果拿不到完整结构化剧情线或卷级时间线，会明确 fallback，不伪装成真节点。

### fallback 情况

1. 当前章没有挂 `main_storyline_id / target_storylines`
2. `storylines.structured_content` 里没有可匹配的 beat
3. `volume_timelines.timeline_data` 里没有当前章 slot

### fallback 表现

- Prompt 中会明确写：
  - “未定位到结构化 beat，fallback 到剧情线摘要”
  - “当前章未命中结构化 slot，fallback 到章节任务与剧情线摘要”
  - “暂无结构化剧情线，仅使用章节目标兜底”

### 返回元信息

章节细纲接口返回里会尽量带：

- `usedStorylineIds`
- `usedBeatIds`
- `usedVolumeTimeline`
- `isFallback`

## 7. 哪些地方仍未闭环

这一步打通的是“剧情线 -> 章节细纲”。

还没有闭环的地方：

1. 章节细纲结果还没有自动写回 `chapter_plans.structured_content` 的专门剧情线使用痕迹
2. 正文生成还没有正式读取这些剧情线约束
3. 卷级时间线只是被读取，还没有成为强约束调度器
4. beat 匹配目前是规则匹配，不是模型判断

所以这一步是“接入使用”，不是“全链路完成”。

## 8. 下一步如何接入正文生成

建议下一步再做正文接入，顺序不要反。

最小做法：

1. 读取章节细纲生成阶段已经命中的 `storyline / beat`
2. 把这些约束传给正文 Prompt
3. 明确正文只能执行这些推进，不负责重做剧情设计

但这一部分本次没有实施。

## 9. 如何手动测试

### A. 先生成剧情线

调用：

- `POST /api/storylines/:bookId/storylines/:storylineId/generate`

确认：

- `storylines.structured_content` 里已有 `keyBeats`

### B. 如有需要，再生成卷级时间线

调用：

- `POST /api/storylines/:bookId/volume/:volNum/timeline/generate`

确认：

- `volume_timelines.timeline_data` 里已有 `chapterSlots`

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

### D. 检查点

1. 返回是否成功
2. `data.storylineContext.usedStorylineIds` 是否有值
3. `data.storylineContext.usedBeatIds` 是否有值
4. `data.storylineContext.usedVolumeTimeline` 是否正确
5. `data.storylineContext.isFallback` 是否符合实际
6. 若当前章有结构化剧情线，细纲结果是否明显体现：
   - 当前该推进的事件
   - 不该提前发生的事件
   - 相关伏笔或冲突方向

### E. 无剧情线数据时

再测一个没有生成剧情线的章节：

1. 调同样的 `promptType: outline`
2. 看返回里的 `isFallback` 是否为 `true`
3. 确认系统没有假装自己命中了剧情线节点

## 10. 当前结论

这一步已经把剧情线从“生成后躺库里”推进到“章节细纲会主动读取并使用”。

但也要明确：

**现在还没有接入正文生成，所以目前完成的是“剧情线 -> 章节细纲”这一段，不是“剧情线 -> 正文”整条闭环。**
