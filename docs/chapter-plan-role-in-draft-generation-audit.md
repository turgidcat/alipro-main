# 章节计划在正文生成中的角色审计

## 1. 正文生成真实调用链

当前正文生成入口在：

- [`backend/routes/ai.js`](C:/Users/turgidcat/Desktop/alipro-main/backend/routes/ai.js)

真实调用链如下：

```text
前端 generateChapterContent(payload)
↓
POST /api/generate
↓
未指定特殊 promptType，进入 handleChapterContentGeneration()
↓
loadBookGenerationContext(bookId, chapterNumber)
↓
读取 book_plans / novel_outlines / novel_characters / chapter_plans / chapters / storylines
↓
从 chapter_plans 组装章节任务、细纲、反馈、角色执行信息
↓
buildCreativePrompt(...)
↓
deepseekService.generate(...)
↓
返回正文
```

所以正文生成不是直接吃全书大纲或分卷大纲，而是先经过 `loadBookGenerationContext()` 做一次“章节前汇总”，其中 `chapter_plans` 是核心输入之一。

## 2. `chapter_plans` 在正文生成中的作用

结论先说：

**`chapter_plans` 现在仍然是正文生成前的核心交汇层。**

原因不是它单独包打天下，而是正文生成时最接近“这一章到底该怎么写”的信息，主要都从它这里取。

它当前承担的作用包括：

1. 提供本章任务
2. 提供本章细纲
3. 提供本章角色说明
4. 提供本章出场角色
5. 提供主剧情线 / 关联剧情线挂接
6. 提供上一章反馈承接
7. 提供角色执行参数

换句话说：

- `book_plans` 更像全书层
- `volume_plans` 更像分卷层
- `storylines` 更像剧情线层
- **`chapter_plans` 才是正文生成前真正收口到“本章执行蓝图”的层**

## 3. 正文生成实际读取的字段列表

正文生成核心代码在 [`backend/routes/ai.js`](C:/Users/turgidcat/Desktop/alipro-main/backend/routes/ai.js) 的 `handleChapterContentGeneration()`。

### 3.1 直接读取的 `chapter_plans` 字段

| 字段 | 是否读取 | 用途 |
| --- | --- | --- |
| `chapter_name` | 是 | 章节标题上下文 |
| `summary` | 是 | 作为 `chapterSummary` 传入正文 Prompt |
| `chapter_mission` | 是 | 经 `contextNotes` 进入正文 Prompt |
| `emotion_target` | 是 | 经 `contextNotes` 进入正文 Prompt |
| `outline_text` | 是 | 作为正文生成的优先大纲输入 |
| `scene_outline` | 间接是 | 通过 `buildOutlineFromChapterPlan()` 参与细纲文本拼装 |
| `character_notes` | 是 | 经 `contextNotes` 进入正文 Prompt |
| `appearing_roles` | 是 | 直接作为 `appearingRoles` 进入正文 Prompt |
| `previous_hook` | 是 | 经 `contextNotes` 进入正文 Prompt |
| `ending_hook` | 是 | 经 `contextNotes` 进入正文 Prompt |
| `main_storyline_id` | 是 | 先映射成剧情线名，再进入上下文 |
| `target_storylines` | 是 | 先映射成剧情线名，再进入上下文 |
| `structured_content` | 是 | 读取 `chapter_outline_structure`、`chapter_feedback`、`role_execution` |

### 3.2 从 `structured_content` 读取的内容

当前正文生成实际会读：

- `chapter_outline_structure`
- `chapter_feedback`
- `role_execution`

当前正文生成没有直接读取：

- 上一步新增的 `storylineContext`
- `usedStorylineIds`
- `usedBeatIds`
- `usedVolumeTimeline`
- `isFallback`

因为这些内容目前没有被保存进 `chapter_plans.structured_content`。

## 4. 大纲信息如何进入正文生成

大纲信息进入正文生成，走的是“双层进入”：

### A. 全书 / 分卷层进入 `contextNotes`

在 `loadBookGenerationContext()` 中，会读取：

- `book_plans.premise`
- `book_plans.main_goal`
- `book_plans.core_conflict`
- `book_plans.world_rules`
- `book_plans.role_summary`
- `book_plans.main_outline`
- `book_plans.volume_outline`
- `book_plans.detailed_outline`
- 旧 `novel_outlines` 作为兼容补充

这些内容会被拼进 `storedContext.contextNotes`。

### B. 章节层进入 `outline`

正文生成时，真正直接喂给 `buildCreativePrompt()` 的章节大纲优先级是：

```text
请求体 outline
↓
chapter_plans.structured_content.chapter_outline_structure 生成的 structuredOutline
↓
chapter_plans.outline_text / buildOutlineFromChapterPlan(chapterPlan)
```

所以大纲不是只停留在全书层，而是被压到章节层后再进入正文。

## 5. 角色信息如何进入正文生成

角色信息分两路进入：

### A. 全书角色主档

`loadBookGenerationContext()` 会读取 `novel_characters`，然后生成：

- `storedCharacters`
- `characterSummary`

正文生成时：

- `storedContext.storedCharacters` 会进入 `characters`

### B. 本章角色执行层

正文生成时还会读取：

- `chapter_plans.appearing_roles`
- `chapter_plans.structured_content.role_execution`

并传给：

- `appearingRoles`
- `roleExecution`

这一层是正文真正会用的“本章角色怎么演”的参数层。

## 6. 剧情线信息目前是否进入正文生成

结论：

**进入了，但还只是浅层进入。**

当前正文生成确实会读：

- `chapter_plans.main_storyline_id`
- `chapter_plans.target_storylines`

然后把它们映射成剧情线名称，再通过 `contextNotes` 进入正文 Prompt。

但当前正文生成还没有真正读取：

- `storylines.structured_content` 的 beat 节点
- `volume_timelines.timeline_data`
- 上一步章节细纲阶段生成出来的 `storylineContext`

所以现在的剧情线进入正文，仍然主要停留在：

- 标签层
- 上下文提示层

而不是：

- 结构化节点约束层

## 7. 上一步剧情线接入章节细纲后，数据是否保存到了正文可读取的位置

结论：

**还没有。**

上一步把剧情线接入章节细纲后，新增的是：

- `buildChapterStorylineContext(...)`
- 章节细纲接口返回里的：
  - `usedStorylineIds`
  - `usedBeatIds`
  - `usedVolumeTimeline`
  - `isFallback`

但这些内容当前只是：

1. 在 `handleOutlineGeneration()` 当次返回给调用方
2. 用于拼接章节细纲 Prompt

它们没有被确认保存到：

- `chapter_plans.structured_content`
- `chapter_plans.outline_text`
- 或其他正文稳定读取的位置

因此：

**上一步的剧情线接入，已经影响了“章节细纲生成过程”，但还没有稳定沉淀到“正文生成可直接读取的存储层”。**

## 8. `chapter_plans` 是否真把“大纲 + 角色 + 剧情线”汇合到一起

结论：

**基本是，但还缺“结构化剧情线命中结果”这最后一块。**

### 现在已经汇合的部分

1. 大纲：
   - `outline_text`
   - `scene_outline`
   - `chapter_outline_structure`
   - `summary`

2. 角色：
   - `appearing_roles`
   - `character_notes`
   - `role_execution`

3. 剧情线：
   - `main_storyline_id`
   - `target_storylines`

4. 承接与反馈：
   - `previous_hook`
   - `chapter_feedback`

### 还缺的部分

缺的是：

- 本章命中的结构化剧情线 beat
- 本章命中的卷级时间线 slot
- 这次细纲生成到底用了哪些 storyline / beat
- 当前是否走了 fallback

也就是说：

`chapter_plans` 现在已经是交汇层，但它还没有完整承接“剧情线结构层”的命中结果。

## 9. 正文生成是否读取上一步新增字段

当前正文生成 **没有读取**：

- `storylineContext`
- `usedStorylineIds`
- `usedBeatIds`
- `usedVolumeTimeline`
- `isFallback`

原因不是正文代码故意跳过，而是这些字段现在没有稳定保存在正文读取路径里。

## 10. 后续最合理的接入点在哪里

这部分是本次审计最重要的结论。

### 不推荐的做法

不推荐直接在正文生成里重新查询剧情线，再独立做一套新的 beat 命中逻辑。

原因：

1. 会和章节细纲阶段的 `buildChapterStorylineContext(...)` 形成两套并行逻辑
2. 细纲命中一个 beat，正文又可能重新命中另一个 beat
3. 会破坏“先定细纲，再执行正文”的层次关系

### 推荐方式

推荐优先通过 `chapter_plans` 接入。

最合理顺序是：

1. 先把章节细纲阶段命中的剧情线结果保存进 `chapter_plans.structured_content`
2. 再让正文生成读取这些已保存结果

推荐保存区可考虑类似：

```json
{
  "chapter_outline_storyline_context": {
    "usedStorylineIds": [],
    "usedBeatIds": [],
    "usedVolumeTimeline": true,
    "isFallback": false,
    "promptText": "..."
  }
}
```

这样正文读取时就不需要再重新做一套剧情线命中判断。

### 如果现在必须二选一

优先级建议：

1. **首选：读取 `chapter_plans.structured_content`**
2. 次选：先把章节细纲返回结果回写后再读取
3. 不建议：正文生成里直接再次调用 `buildChapterStorylineContext(...)`
4. 更不建议：只读 `target_storylines`

## 11. 风险提示

### 风险 1：两套逻辑并行

如果正文生成直接重新查询剧情线，会出现：

- 章节细纲一套命中规则
- 正文生成另一套命中规则

这会导致前后不一致。

### 风险 2：细纲和正文脱钩

如果剧情线只进入细纲，不进入 `chapter_plans` 可读存储层，那么正文仍可能只吃旧细纲文本和旧上下文，导致“细纲看起来受剧情线约束，正文实际没真正执行”。

### 风险 3：继续停留在标签层

如果后续只把 `main_storyline_id / target_storylines` 再多传几次，而不传 beat 命中结果，剧情线仍然只是名字标签，不是结构约束。

## 12. 本次审计结论

### 1. `chapter_plans` 现在是不是正文生成前的核心交汇层？

是。

### 2. 它是否真的把“大纲 + 角色 + 剧情线”汇合到一起？

基本是，但剧情线目前只汇合到“ID / 名称 /弱上下文”层，还没完整汇合到“结构化节点命中”层。

### 3. 如果不是完整交汇，缺了哪一块？

缺的是：

- `usedStorylineIds`
- `usedBeatIds`
- `usedVolumeTimeline`
- `isFallback`
- 本章命中的剧情线节点内容

### 4. 后续剧情线接入正文是否应该优先通过 `chapter_plans`？

应该。

### 5. 如果直接在正文生成里重新查询剧情线，会不会造成两套逻辑并行？

会，而且风险不小。

### 6. 现在是否适合继续“把剧情线接入正文生成”？

适合，但不建议直接跳进去硬接。

### 7. 推荐接入点在哪里？

推荐先把章节细纲阶段产出的剧情线命中结果沉淀到 `chapter_plans.structured_content`，然后让正文生成从这里读取。

一句话总结：

**`chapter_plans` 仍然很有实际意义，而且仍然是正文生成前最应该优先复用的核心交汇层；下一步不是另起一套正文剧情线查询，而是先补齐章节计划里对剧情线命中结果的承接。**
