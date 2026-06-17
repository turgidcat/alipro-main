# 剧情线生成服务 MVP 说明

## 1. 这次新增了什么服务

本次新增服务：

- [`backend/services/storyline-generation-service.js`](C:/Users/turgidcat/Desktop/alipro-main/backend/services/storyline-generation-service.js)

它的职责不是简单补 4 个缺失函数，而是把下面这条链路最小打通：

```text
读取上游上下文
↓
构建剧情线 / 卷级时间线 Prompt
↓
调用 DeepSeek
↓
解析结构化 JSON
↓
最小兜底并标记是否 fallback
↓
返回给 route 保存到数据库
```

## 2. 哪些方法替代了原本缺失的方法

原来 `backend/routes/storylines.js` 调用但不存在的方法有：

- `deepseekService.buildStorylineOutlinePrompt()`
- `deepseekService.parseStorylineOutlineResponse()`
- `deepseekService.buildVolumeTimelinePrompt()`
- `deepseekService.parseVolumeTimelineResponse()`

现在改为由新服务提供等价能力：

- `generateStorylineOutline(context)`
- `generateVolumeTimeline(context)`
- `parseStorylineOutlineResponse(raw, context)`
- `parseVolumeTimelineResponse(raw, context)`

也就是说：

- Prompt 构建不再挂在 `deepseek.js`
- JSON 解析不再挂在 `deepseek.js`
- `deepseek.js` 只负责通用模型调用
- 剧情线/时间线的业务语义收口到新服务

## 3. 是否真的调用模型

是。

当前实现仍然使用现有 DeepSeek 能力：

- 服务内部调用 `deepseekService.generate(...)`
- 模型仍是 `deepseek-chat`
- 并显式要求 `responseFormat: { type: 'json_object' }`

所以这次不是本地字段拼接产出结果，而是：

1. 先构建剧情语义上下文；
2. 再把上下文发送给 DeepSeek；
3. 最后解析模型返回 JSON。

## 4. Prompt 输入了哪些上下文

### 剧情线生成至少输入

- `bookId`
- `volumeId`
- 当前剧情线基础信息
- `book_plans` 的全书规划
- `volume_plans` 的分卷规划
- `novel_outlines` 的旧全书/分卷大纲作为 fallback
- `novel_characters` 的角色资料
- 当前卷 `storylines` 里已有剧情线
- 当前卷 `chapter_plans`
- 当前卷 `chapter_plans.structured_content.chapter_feedback`
- 待处理 `foreshadowing`
- 当前用户目标 `controlParams.userGoal / goal`

### 卷级时间线生成至少输入

- `bookId`
- `volumeId`
- 全书规划
- 分卷规划
- 当前卷所有剧情线
- 当前卷章节计划
- 当前卷章节反馈
- 分卷中的 `foreshadowPlan` 或旧分卷大纲里的伏笔计划

### fallback 规则

如果某些数据拿不到，Prompt 中会明确写：

- `[缺失]`
- 或 `[缺失，fallback：xxx]`

不会伪装成已经拿到了完整语义上下文。

## 5. 输出 JSON 保存到哪里

### 剧情线

仍然保存到：

- `storylines.structured_content`

route 保持原有保存位置不变，只是现在保存的是模型解析后的结构化 JSON。

当前结构至少包含：

- `title`
- `type`
- `summary`
- `dramaticQuestion`
- `startState`
- `targetEndState`
- `keyBeats`
- `relatedCharacters`
- `foreshadowingToPlant`
- `payoffs`
- `currentProgress`
- `sourceContext`
- `isFallback`

### 卷级时间线

仍然保存到：

- `volume_timelines.timeline_data`

当前结构至少包含：

- `volumeId`
- `volumeTheme`
- `startState`
- `endState`
- `stages`
- `chapterSlots`
- `rhythmCheck`
- `totalChapters`
- `isFallback`

## 6. 这次是不是只是字段拼接

不是。

这次虽然仍然要先组装 Prompt，但最终结果不是：

- 把全书大纲复制进剧情线字段；
- 把分卷大纲复制进时间线字段；
- 或只挂一个剧情线 ID。

当前实现做的是：

1. 系统函数读取多源上下文；
2. 交给 DeepSeek 生成新的剧情线 / 时间线 JSON；
3. 再做结构化解析和最小兜底；
4. 最后落库。

但也要诚实说明：

这还只是“真实模型生成服务 MVP”，不是完整闭环终点。

## 7. 哪些地方仍未闭环

目前已经打通的是：

- route 不再调用不存在的方法；
- 后端能真正调 DeepSeek；
- 能把模型 JSON 存进 `storylines.structured_content` 和 `volume_timelines.timeline_data`。

目前还没闭环的地方：

1. 章节细纲生成还没有正式读取 `storylines.structured_content.keyBeats`
2. 正文生成还没有正式读取“本章剧情线约束”
3. 卷级时间线还没有正式进入章节细纲/正文主链
4. `isFallback` 只是最小质量标记，不是完整质量评分

所以这一步解决的是“真生成服务落地”和“4 个缺失方法的业务替代”，还没有解决“剧情线进入整条小说生产主链”。

## 8. 后续如何接入章节细纲

建议下一步优先接章节细纲。

最小接法：

1. 读取 `chapter_plans.main_storyline_id`
2. 读取 `chapter_plans.target_storylines`
3. 去 `storylines.structured_content.keyBeats` 找当前章对应节点
4. 把这些字段注入章节细纲 Prompt：
   - `summary`
   - `dramaticQuestion`
   - 当前 beat 的 `title`
   - 当前 beat 的 `summary`
   - 当前 beat 的 `expectedChange`
   - 当前 beat 的冲突/限制

这样章节细纲才会真正受剧情线驱动。

## 9. 后续如何接入正文生成

正文生成应在章节细纲之后接入。

最小接法：

1. 从章节细纲拿到本章主推进 beat
2. 再补充剧情线里的：
   - `dramaticQuestion`
   - `targetEndState`
   - 当前 beat 的推进目标
   - 当前 beat 不允许提前泄露的限制
3. 把这些内容注入正文 Prompt

这样正文写的是“执行剧情线”，不是继续自由发散。

## 10. 如何手动测试

建议按下面顺序手测。

### A. 单条剧情线生成

调用：

- `POST /api/storylines/:bookId/storylines/:storylineId/generate`

检查点：

1. 接口是否返回 `success: true`
2. `data.structured` 是否有：
   - `title`
   - `summary`
   - `dramaticQuestion`
   - `keyBeats`
3. `storylines.structured_content` 是否已更新
4. 如果字段明显不完整，是否有 `isFallback: true`

### B. 批量剧情线生成

调用：

- `POST /api/storylines/:bookId/volume/:volNum/storylines/generate-all`

检查点：

1. 是否返回 `successCount / failCount`
2. 成功项是否真的更新了对应剧情线的 `structured_content`
3. 失败项是否返回了清晰错误

### C. 卷级时间线生成

调用：

- `POST /api/storylines/:bookId/volume/:volNum/timeline/generate`

检查点：

1. 返回的 `data.structured` 是否包含：
   - `volumeId`
   - `volumeTheme`
   - `stages`
   - `chapterSlots`
2. `volume_timelines.timeline_data` 是否已更新
3. 如果模型返回不完整，是否出现 `isFallback: true`

### D. 解析鲁棒性

重点观察：

1. 直接 JSON 能否解析
2. Markdown 代码块 JSON 能否解析
3. 前后带少量说明文字时能否解析
4. 解析失败时是否返回清晰错误和 `rawPreview`

## 11. 本次修改涉及的 route

本次仅改动：

- [`backend/routes/storylines.js`](C:/Users/turgidcat/Desktop/alipro-main/backend/routes/storylines.js)

改动原则：

- 不改前端
- 不改数据库结构
- 保持原接口路径不变
- 保持原落库位置不变
- 尽量保持原返回结构不变

## 12. 当前结论

这一步已经做到：

1. 4 个缺失方法对应的业务能力已经补上
2. 不是空壳函数
3. 确实调用了 DeepSeek
4. 确实把模型 JSON 保存进现有表字段

但也要明确：

**这还不是剧情线全链路闭环，只是“真实生成服务 MVP”已经落地，可以继续进入“剧情线接入章节细纲”这一步。**
