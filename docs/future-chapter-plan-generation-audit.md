# 未来章节计划生成链路审计

## 结论先行

当前项目里，`chapters` 和 `chapter_plans` 都是**按章创建 / 按章更新**为主，不会因为 `volume_plans.estimated_chapters = 20` 就自动补齐到第 20 章。

所以这次第 18 / 20 章虽然已经有真实 `chapterSlot`，但还吃不到完整下游，不是卷级时间线失效，而是**未来章节本身缺少承接层数据**：

1. `chapter_plans` 没有补到第 18 / 20 章；
2. `chapters` 也只存在到第 8 章；
3. 章节细纲阶段的 `storyline_context` 只会写回**已存在的** `chapter_plans`；
4. 当前项目里没有发现“按卷补齐缺失 chapter_plans”的现成能力。

---

## 审计表

| 检查项 | 结果 | 证据 | 判断 | 风险等级 |
| --- | -- | -- | -- | ---- |
| `chapters` 如何创建 | 单章创建 / 单章 upsert | `backend/routes/data.js` 暴露 `POST /api/books/:bookId/chapters`、`POST /api/books/:bookId/chapters/upsert`；底层对应 `backend/services/database.js` 的 `ChapterService.create()` / `upsertByChapterNumber()` | 当前不是按卷自动建章，而是由前端或单章保存动作触发 | 中 |
| 正文生成是否自动写 `chapters` | 会，但仍是按当前章单章写入 | 前端 `frontend-react/src/App.jsx` 的 `persistChapterResultCycle()` 会调用 `upsertGeneratedChapter()`；`frontend-react/src/workbenchApi.js` 对应请求 `POST /books/:bookId/chapters/upsert` | 正文生成能补当前章正文记录，但不会顺带把未来章节 9-20 预建出来 | 中 |
| `chapter_plans` 如何创建 | 单章 upsert | `backend/routes/data.js` 暴露 `POST /api/books/:bookId/chapter-plans/:chapterNumber`；底层对应 `backend/services/database.js` 的 `ChapterPlanService.upsert()` | 当前章节计划主入口是单章保存，不是整卷批量生成 | 中 |
| 旧章节大纲保存是否会顺带写 `chapter_plans` | 会，但前提是该章已有 `chapters` 记录 | `backend/routes/outlines.js` 的 `POST /:bookId/chapter/:chapterId` 会先校验 `chapters.id`，再调用 `chapterPlanService.upsert()` | 旧大纲入口也依赖真实章节，不能替代未来章节补齐链路 | 中 |
| 章节细纲生成是否能自动新建 `chapter_plans` | 不能 | `backend/routes/ai.js` 的 `saveChapterStorylineContext()` 先查 `chapter_plans`，查不到直接 `return null` | 细纲能生成文本，但没有现成章节计划时，`storyline_context` 无法持久化入库 | 高 |
| 章节反馈是否能自动新建 `chapter_plans` | 不能 | `backend/routes/ai.js` 的 `saveChapterFeedback()` 先查 `chapter_plans`，不存在就直接返回 `null` | 反馈回写也依赖已存在的章节计划 | 高 |
| 当前是否存在“整卷补齐 chapter_plans”能力 | 未发现 | 全项目搜索仅发现单章 `chapter-plans/:chapterNumber`，未发现 `generate all chapter plans`、`batch chapter plans`、`fill missing chapter plans` 等真实接口 | 目前缺少未来章节承接层的批量补齐能力 | 高 |
| 当前为什么只有到第 8 章 | 数据和链路都表现为“按需生成 + 测试只跑到第 8 章” | 数据库实查：`chapters.count = 8`、`chapter_plans.count = 8`、两者 `maxChapter = 8`；当前卷 `estimated_chapters = 20` 但未自动联动建档 | 不是流程异常中断，更像设计上没有自动铺未来章节 | 中 |
| 第 18 / 20 章是否已有时间线槽位 | 有 | `volume_timelines.timeline_data` 中 `expectedSlotCount = 20`、`actualSlotCount = 20`，且能查到 `chapterNumber = 18 / 20` 的 slot | 时间线层已经覆盖未来章节，不是时间线缺位 | 低 |
| 第 18 / 20 章吃到时间线还缺什么 | 至少缺 `chapter_plans`；`chapters` 对完整主链也仍有帮助 | `buildChapterStorylineContext()` 依赖 `chapterPlan.main_storyline_id`、`target_storylines` 选剧情线；`loadBookGenerationContext()` 依赖当前章 `chapter_plans` 决定 `currentVolumeNumber` 再匹配 `volume_timelines` | 没有对应 `chapter_plan`，就很难稳定命中时间线并把结果沉淀到后续链路 | 高 |

---

## 1. 当前 `chapters` 是怎么创建的

当前有两条真实创建路径：

### 路径 A：手工 / 前端保存单章

- 接口：`POST /api/books/:bookId/chapters`
- 接口：`POST /api/books/:bookId/chapters/upsert`
- 底层：`backend/services/database.js`
  - `ChapterService.create()`
  - `ChapterService.upsertByChapterNumber()`

这条链路的特点很明确：**一次处理一章**。

### 路径 B：正文生成完成后回写当前章

前端 `frontend-react/src/App.jsx` 中的 `persistChapterResultCycle()` 会先调用：

- `upsertGeneratedChapter(bookId, { chapterNumber, title, chapterName, content })`

而 `frontend-react/src/workbenchApi.js` 会把它发到：

- `POST /api/books/:bookId/chapters/upsert`

也就是说，正文生成成功后，系统会把**当前这章**写进 `chapters`。

### 当前没有的能力

没有发现下面这些自动行为：

- 不会根据 `estimated_chapters` 自动预建第 1-20 章；
- 不会在卷级时间线生成后自动创建未来章节壳子；
- 不会在生成第 8 章时顺带补出第 9-20 章。

---

## 2. 当前 `chapter_plans` 是怎么创建的

### 主路径：单章章节计划 upsert

- 接口：`POST /api/books/:bookId/chapter-plans/:chapterNumber`
- 底层：`backend/services/database.js`
  - `ChapterPlanService.upsert()`

这是现在最核心的章节计划保存口。

前端 `frontend-react/src/workbenchApi.js` 的：

- `saveChapterPlan(bookId, chapterNumber, planData)`

最终也就是调这条接口。

### 旧大纲兼容路径：保存章节大纲时同步写计划

`backend/routes/outlines.js` 的：

- `POST /:bookId/chapter/:chapterId`

会在保存 `novel_outlines` 后，读取该 `chapterId` 对应的 `chapter_number`，然后调用：

- `chapterPlanService.upsert(bookId, chapterNumber, ...)`

但这条路仍然有前提：**先得有 `chapters` 记录**，因为它是按 `chapterId` 驱动的。

### 当前没有的能力

没有发现真实可用的：

- 按卷一次性生成全部 `chapter_plans`
- 补齐缺失 `chapter_plans`
- 根据时间线批量生成未来章节计划

所以现在的 `chapter_plans` 本质上仍是**访问哪一章、保存哪一章**。

---

## 3. 为什么当前只到第 8 章

这次数据库实查结果很直接：

- `chapters.count = 8`
- `chapters.maxChapter = 8`
- `chapter_plans.count = 8`
- `chapter_plans.maxChapter = 8`
- 当前卷 `volume_plans.estimated_chapters = 20`

这说明：

1. 当前测试书真实数据只被建到了第 8 章；
2. `estimated_chapters = 20` 只是卷规划目标，不会自动联动生成章节或章节计划；
3. 当前系统更像**按需生成**，而不是“先把未来章位都铺满”；
4. 本次测试主链也确实主要跑在第 8 章，所以数据库自然只沉淀到第 8 章。

更准确的说法是：

**当前只到第 8 章，不是因为卷级时间线失败，也不像是流程中断，更像是产品链路本来就没有自动补齐未来章节计划。**

---

## 4. 第 18 / 20 章要吃到 timeline slot，至少还缺什么

先说核心结论：

### 最少必须补的是 `chapter_plans`

因为 `backend/routes/ai.js` 里的 `buildChapterStorylineContext()` 当前是这样工作的：

1. 从 `chapterPlan.main_storyline_id` 和 `target_storylines` 选出本章关联剧情线；
2. 再从 `volumeTimeline.chapterSlots` 里按 `chapterNumber` 找 `matchedSlot`；
3. 组合成 `storylineContext`；
4. 再由 `saveChapterStorylineContext()` 写回 `chapter_plans.structured_content.storyline_context`。

如果没有现成的 `chapter_plan`：

- 就缺少 `main_storyline_id`
- 缺少 `target_storylines`
- 缺少 `volume_number`
- 细纲生成后也没法把 `storyline_context` 持久化回去

所以 **`chapter_plan` 是未来章节接住 timeline slot 的最关键承接层**。

### `chapters` 不是细纲命中的绝对前提，但对完整主链仍然重要

从当前实现看：

- `loadBookGenerationContext()` 即便没有当前章 `chapters`，也不一定立刻报错；
- 但没有 `chapters`，当前章正文记录、章节名、内容承接、后续正文回写都会变弱；
- 正文真正落库时仍要写 `chapters`。

所以对于“完整下游消费”来说，未来章节最好同时具备：

1. `chapter_plans` 记录
2. `chapters` 记录（哪怕先是空壳）

### 还需要这些匹配条件

第 18 / 20 章要稳定命中 `usedVolumeTimeline: true`，至少要满足：

- `chapter_plans.chapter_number = 18 / 20`
- `chapter_plans.volume_number = 1`
- `volume_timelines.volume_number = 1`
- `volume_timelines.timeline_data.chapterSlots` 中存在对应 `chapterNumber = 18 / 20`
- `chapter_plans.main_storyline_id / target_storylines` 能把本章挂到真实剧情线上

---

## 5. 当前是否已有“补齐未来章节计划”的入口

本次搜索重点看了这些方向：

- `generate all chapter plans`
- `batch chapter plans`
- `volume chapter plans`
- `fill missing chapter plans`
- `chapters/generate`
- `outlines/generate-all`

### 审计结果

#### 已存在但不是这件事的能力

- `POST /api/books/:bookId/volume-plans/generate`
  - 作用：生成分卷规划
  - 不是生成章节计划

- `POST /api/storyline-workbench/:bookId/volume/:volNum/storylines/generate-all`
  - 作用：批量生成该卷剧情线
  - 不是补齐 `chapter_plans`

- `POST /api/books/:bookId/chapter-plans/:chapterNumber`
  - 作用：单章保存 / 单章更新
  - 不是整卷补齐

- `POST /api/books/:bookId/chapters/upsert`
  - 作用：单章正文记录 upsert
  - 不是批量建未来章节

#### 未发现的能力

没有发现真实代码入口能做到：

- 生成一卷全部 `chapter_plans`
- 只补齐缺失的 `chapter_plans`
- 根据卷级时间线一次性落未来章节计划

所以当前答案很明确：

**项目里还没有现成的“补齐未来章节计划”能力。**

---

## 6. 后续最小实现建议（只给建议，不实现）

用户给的四个方向里，我的排序是：

### 首选：A. 只在用户访问某章时按需创建 `chapter_plan`

这是当前项目里**最小、最稳、最不容易破坏主链**的方案。

#### 为什么我把它排第一

1. 当前系统本来就是单章驱动：
   - 单章保存 `chapter_plan`
   - 单章写 `chapters`
   - 单章生成细纲
   - 单章生成正文
   - 单章反馈回写

2. 它和现有主链最一致：
   - 不需要突然引入“整卷预生成”的新状态机
   - 不需要一次性改很多前后端交互
   - 只需要在“打开某章 / 请求生成某章”时，若 `chapter_plan` 不存在，就创建一个最小壳子

3. 风险最低：
   - 不会一口气制造 20 条半成品计划
   - 不会把未来章节误判为已经真正规划完成
   - 更符合当前项目“按需落库”的风格

#### 这个方案的代价

它不能一次解决“第 18 / 20 章全部预铺满”的产品体验，只能做到：

- 用户点到第 18 章时，系统自动给第 18 章建一个最小 `chapter_plan`
- 然后细纲 / 时间线 / 正文链路就能开始吃这章数据

---

### 第二选择：D. 只创建空壳章节，等用户生成细纲时再填内容

这个方案也比较小，但我认为它不如 A。

原因是：

- 它只补 `chapters`，不一定补 `chapter_plans`
- 而当前时间线命中和 `storyline_context` 持久化更依赖 `chapter_plans`

所以如果要走“壳子策略”，更应该是：

**优先补空壳 `chapter_plans`，`chapters` 可以同步补，也可以后补。**

---

### 第三选择：B. 生成卷级时间线后，批量补齐本卷缺失的 `chapter_plans`

这个方案产品体验更完整，但改动面已经明显大于 A。

原因：

- 卷级时间线生成成功后，要额外决定每个未来章节的默认标题、默认剧情线挂接、默认 `volume_number`
- 还要处理“已有计划不覆盖、缺失才补”的规则
- 容易把“时间线生成成功”扩展成“章节计划也自动落库”，带来新边界

它是可以做的，但不算最小。

---

### 最后：C. 分卷规划时一次性创建全部 `chapter_plans`

这是四个方案里最重的一个。

它会把：

- 分卷规划
- 时间线
- 章节计划

三层强耦合在一起，当前阶段不适合。

---

## 7. 推荐的下一步

### 我的建议

建议进入下一步小范围实现时，优先做：

**“按需补齐当前访问章节的最小 `chapter_plan` 壳子”**

而不是直接做整卷批量补齐。

### 推荐原因

这是目前最符合项目现状的选择：

- 简单
- 稳
- 不破坏已验收主链
- 能直接解开第 18 / 20 章未来验证的阻塞

### 如果后续真要做，建议先看这些文件

- `backend/routes/ai.js`
  - `handleOutlineGeneration()`
  - `saveChapterStorylineContext()`
  - `loadBookGenerationContext()`

- `backend/services/database.js`
  - `ChapterPlanService.upsert()`
  - `ChapterService.upsertByChapterNumber()`

- `frontend-react/src/workbenchApi.js`
  - `fetchChapterSetupBundle()`
  - `saveChapterPlan()`

- `frontend-react/src/App.jsx`
  - 当前章切换与保存章节计划的入口

---

## 最终判断

1. 当前 `chapters` 是按章创建 / 按章 upsert，不会自动铺未来章节。
2. 当前 `chapter_plans` 也是按章保存，不会因为卷规划或时间线自动补满。
3. 当前只到第 8 章，主要是因为系统设计偏按需生成，且测试也只真实跑到了第 8 章。
4. 第 18 / 20 章现在缺的不是时间线，而是未来章节自己的承接层，尤其是 `chapter_plans`。
5. 当前没有现成的“补齐未来章节计划”能力。
6. 下一步如果要实现，最小建议是：**A 方案，按用户访问章节时按需创建最小 `chapter_plan` 壳子。**
