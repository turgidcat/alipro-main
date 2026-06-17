# 按需创建未来章节 `chapter_plan` 壳子报告

## 1. 为什么需要按需创建最小 `chapter_plan`

第 4A 审计已经确认，当前项目的章节链路是“按章访问、按章落库”：

- `chapters` 不会因为 `estimated_chapters = 20` 自动铺满；
- `chapter_plans` 也不会因为卷级时间线生成成功就自动补齐未来章节；
- 章节细纲阶段的 `storyline_context` 只会写回**已存在**的 `chapter_plans`。

这就导致一个实际问题：

- 卷级时间线已经有第 18 / 20 章的 `chapterSlot`；
- 但没有对应 `chapter_plan` 时，未来章节无法把 `timelineSlot`、`usedVolumeTimeline` 和 `storyline_context` 沉淀到现有单章链路里。

所以这次修复的目标很克制：

**只在用户真的访问未来章节细纲时，如果该章还没有 `chapter_plan`，才自动创建一个最小壳子。**

---

## 2. 修改了哪些文件

- `backend/routes/ai.js`
- `docs/on-demand-chapter-plan-autocreate-report.md`

---

## 3. 是否修改数据库

没有。

- 没有新增表
- 没有新增字段
- 没有迁移
- 只复用现有 `chapter_plans` 表和现有 `structured_content` JSON

---

## 4. 自动创建触发条件

触发位置：

- `POST /api/generate`
- `promptType === "outline"`

触发条件：

1. 请求里带了有效的 `bookId`
2. 请求里带了有效的 `chapterNumber`
3. 当前 `chapter_plans` 里查不到这一章对应记录

只有同时满足以上条件，后端才会自动创建最小壳子。

如果该章已经存在 `chapter_plan`，则：

- 不重复创建
- 不覆盖已有 `chapter_outline_structure`
- 不覆盖已有 `role_execution`
- 不覆盖已有 `chapter_feedback`
- 仍然走原有细纲生成链路

---

## 5. 最小壳子包含哪些字段

本次没有新造一套数据结构，而是直接走现有 `ChapterPlanService.upsert()`。

最小壳子实际包含：

- `book_id`
- `chapter_number`
- `volume_number`
- `chapter_name`
- `main_storyline_id`
- `target_storylines`
- `source = "ai"`
- `status = "draft"`
- `structured_content`

其中 `structured_content` 会带这组可观测标记：

```json
{
  "autoCreatedChapterPlan": true,
  "autoCreateReason": "missing_chapter_plan_for_outline_generation",
  "autoCreateFallback": false,
  "autoCreateMeta": {
    "volumeNumberSource": "...",
    "storylineSource": "..."
  }
}
```

说明：

- `summary` 可以为空
- `outline_text` 可以为空
- 不伪造细纲内容
- 不伪造章节反馈

---

## 6. `volume_number` 如何确定

本次实现按下面优先级推断：

1. 请求体里的 `volumeNumber / volume_number`
2. 已有 `storylines` 的章节范围 `start_chapter ~ end_chapter`
3. 已有 `volume_timelines` 中是否存在该章 `chapterSlot`
4. `volume_plans.estimated_chapters` 的累计推断
5. 最后 fallback 到 `1`

也就是说，这次不是硬编码“第 18 章一定是第 1 卷”，而是优先复用现有数据来推断。

本次测试书里：

- 卷 1 `estimated_chapters = 20`
- 第 18 / 20 章都被推断为 `volume_number = 1`

---

## 7. `main_storyline_id / target_storylines` 如何确定

优先级如下：

1. 请求体已有 `main_storyline_id / target_storylines` 时，优先使用
2. 如果当前 `timelineSlot.relatedBeatIds` 能反查到剧情线，就优先使用这些剧情线
3. 否则使用当前卷已有剧情线
4. 主线优先选择 `storyline_type = "main"`，否则退到当前卷第一条剧情线
5. 如果仍然没有真实剧情线，则允许留空，不伪造 ID

本次测试书中：

- 当前卷只有一条真实主线：
  - `e8fbc32c-1744-4369-83b5-07bf6a9a16a9`
- 所以第 18 / 20 章自动壳子的：
  - `main_storyline_id`
  - `target_storylines`

都安全落到了这条真实主线上。

---

## 8. 是否标记 `autoCreatedChapterPlan`

是。

本次自动创建的未来章节壳子会在：

- `chapter_plans.structured_content.autoCreatedChapterPlan = true`

并额外记录：

- `autoCreateReason`
- `autoCreateFallback`
- `autoCreateMeta`

这样后续排查时，能一眼看出这条计划是不是系统在“访问未来章节细纲”时补出来的。

---

## 9. 第 18 / 20 章测试结果

测试方式：

- 重启后端
- 对没有现成 `chapter_plan` 的未来章节调用 `POST /api/generate`
- 分别测试第 18 章和第 20 章

### 修复前

- `chapter_plans` 中第 18 / 20 章都不存在

### 修复后

第 18 章：

- 自动创建了 `chapter_plan`
- `structured_content.autoCreatedChapterPlan = true`
- `structured_content.storyline_context` 已入库
- 返回 `persistedStorylineContext = true`
- `storylineContext.usedVolumeTimeline = true`
- `storylineContext.timelineSlot.chapter = 18`
- `storylineContext.usedStorylineIds = ["e8fbc32c-1744-4369-83b5-07bf6a9a16a9"]`
- `storylineContext.usedBeatIds = ["climax"]`

第 20 章：

- 自动创建了 `chapter_plan`
- `structured_content.autoCreatedChapterPlan = true`
- `structured_content.storyline_context` 已入库
- 返回 `persistedStorylineContext = true`
- `storylineContext.usedVolumeTimeline = true`
- `storylineContext.timelineSlot.chapter = 20`
- `storylineContext.usedStorylineIds = ["e8fbc32c-1744-4369-83b5-07bf6a9a16a9"]`
- `storylineContext.usedBeatIds = ["climax"]`

### 额外说明

当前卷第 18 / 20 章对应的 `chapterSlot.relatedBeatIds` 为空，但因为当前卷已有真实主线，系统仍能把未来章节挂到卷内剧情线，并通过现有 `pickBeatForChapter(...)` 落到同一条剧情线的最新可用 beat。

这说明：

**未来章节现在已经能进入现有单章链路，不再卡在“没有 `chapter_plan` 无法承接时间线”这一层。**

---

## 10. 第 8 章回归测试结果

对照测试了已存在计划的第 8 章。

结果：

- 没有重复创建 `chapter_plan`
- `autoCreatedChapterPlan` 仍为 `false`
- 现有 `chapter_outline_structure` 仍保留
- 现有 `chapter_feedback` 仍保留
- `usedVolumeTimeline` 仍为 `true`
- `usedBeatIds` 仍为 `["dev-7"]`

这说明本次改动没有把已验收章节误判成“缺失计划”，也没有覆盖老数据。

---

## 11. 是否建议继续做未来章节正文生成测试

建议。

原因很直接：

这一步已经证明：

1. 未来章节访问细纲时能自动补 `chapter_plan`
2. 能成功命中 `timelineSlot`
3. 能把 `storyline_context` 持久化入库

下一步最自然的验证就是：

**继续测试未来章节正文生成，看第 18 / 20 章在已有自动壳子前提下，正文链路是否也能顺利承接 `storyline_context`。**

---

## 结论

本次改动只做了一件事：

**让未来章节在“首次访问细纲”时，能按需补出最小 `chapter_plan` 壳子。**

它解决的是未来章节进入现有单章链路前的承接缺口，而不是重做整卷计划系统。

当前结果符合预期：

- 第 18 / 20 章能自动创建 `chapter_plan`
- 能命中卷级时间线 `chapterSlot`
- `usedVolumeTimeline` 能变成 `true`
- 已有第 8 章不受影响
