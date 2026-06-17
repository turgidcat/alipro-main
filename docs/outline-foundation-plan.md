# 大纲与角色底层结构规划

> 最后更新：2026-06-07
> 目标：为“全书大纲 -> 分卷大纲 -> 剧情线 -> 章节规划 -> 正文生成”建立稳定的数据底座

---

## 一、这次规划要解决什么

当前项目不是完全没有存数据，而是：

- 全书大纲、分卷大纲、章节大纲存在多套存储方式
- 角色资料和本章新增角色也在混合存放
- 正文生成时会从多个位置拼上下文
- 页面上有“本章规划”，数据库里却没有真正稳定的“章节规划对象”

这会直接影响后续能力：

- 难以稳定生成下一章
- 难以做批量生成
- 难以让剧情线、角色、章节规划形成联动
- 首页和资料库容易各读各的，越改越乱

这份规划的核心目标是：

1. 把“书籍、全书规划、分卷规划、剧情线、章节规划、正文”拆成清晰层级
2. 让角色和大纲分开存，但在章节规划层会合
3. 让正文生成始终有明确的数据读取顺序
4. 采用兼容式演进，不一次性推翻现有项目

---

## 二、设计原则

### 2.1 角色和大纲不混存

- 大纲回答“这一层要发生什么”
- 角色回答“谁在推动、以什么方式推动”

它们必须联动，但不应该长期混成一段文本。

### 2.2 摘要文本和结构化内容并存

每一层都尽量区分：

- `summary_text`
  - 方便首页展示
  - 方便快速注入 prompt
- `structured_content`
  - 方便系统联动
  - 方便批量生成和自动拆解

### 2.3 首页维护“当前创作引用层”

首页不是全库管理界面。

首页负责：

- 当前书籍
- 当前会直接参与 prompt 的摘要
- 当前章规划
- 当前正文

资料库负责：

- 全量角色档案
- 全量大纲树
- 分卷与剧情线管理
- 历史资料回查

### 2.4 先新增独立层，再迁移旧数据

不能一开始就强删旧字段。

最稳妥的方式是：

1. 先建立新对象
2. 新页面优先读写新对象
3. 旧数据作为兼容回退
4. 最后再做迁移和清理

---

## 三、最终推荐的底层分层

建议最终采用 6 层结构：

### 3.1 书籍层 `books`

负责书的基础定位，不承担创作细节。

建议字段重点：

- `title`
- `genre`
- `subgenre`
- `target_platform`
- `writing_style`
- `status`

### 3.2 全书规划层 `book_plans`

负责全书级创作信息。

建议承担：

- 全书主线摘要
- 核心卖点
- 世界观约束
- 全书角色摘要
- 分卷总览
- 全书结构化大纲 JSON

当前项目里，这一层部分信息散落在：

- `novel_outlines` 的 `type='book'`
- 老字段 `main_outline / volume_outline / detailed_outline`
- 首页第二步摘要

最终应逐步收口到独立 `book_plans`。

### 3.3 分卷规划层 `volume_plans`

负责卷级推进。

建议承担：

- `volume_number`
- `volume_name`
- `volume_theme`
- `core_conflict`
- `estimated_chapters`
- `storyline_count`
- `key_events`
- `chapter_plan_summary`
- `structured_content`

当前项目里，这一层由两部分共同承担：

- `volume_settings`
- `novel_outlines type='volume'`

建议后续逐步整合成统一卷规划模型。

### 3.4 剧情线层 `storylines`

负责“线”的维度，不直接承担章节正文。

建议承担：

- `storyline_name`
- `storyline_type`
- `description`
- `core_conflict`
- `start_chapter`
- `end_chapter`
- `key_nodes`
- `involved_characters`
- `structured_content`

这一层当前已经相对清楚，可以继续保留。

### 3.5 章节规划层 `chapter_plans`

这是接下来最关键的一层。

负责“正文生成前的章节对象”，建议承接：

- `chapter_number`
- `chapter_name`
- `summary`
- `outline_text`
- `character_notes`
- `previous_hook`
- `target_storylines`
- `structured_content`
- `status`
- `source`

这一层现在已经开始落地。

### 3.6 正文层 `chapters`

只负责最终正文内容和章节基础状态。

建议承担：

- `chapter_number`
- `chapter_name`
- `title`
- `content`
- `word_count`
- `status`

后续应逐步弱化 `chapters.outline` 的职责，让它不再承担章节规划主来源。

---

## 四、角色和大纲应该怎么配合

### 4.1 不要长期混成一份文本

不建议把：

- 角色设定
- 章节大纲

直接长期写进同一个字段里。

原因：

- 角色会跨章节复用
- 大纲会频繁修改
- 后面做剧情线联动时容易打结

### 4.2 在“章节规划层”会合

建议通过 `chapter_plans` 实现会合：

- `outline_text` 负责本章要发生什么
- `character_notes` 负责本章需要额外补充哪些人
- `target_storylines` 负责本章推进哪几条线
- `previous_hook` 负责承接上章

正文生成时，系统自动组装：

1. 全书摘要
2. 当前卷摘要
3. 当前章大纲
4. 全书相关角色摘要
5. 本章新增角色
6. 当前章关联剧情线

这才是“角色和大纲一起工作”的正确方式。

---

## 五、当前项目现状映射

### 5.1 现在已经存在的对象

| 层级 | 当前对象 | 问题 |
|---|---|---|
| 书籍 | `books` | 基本可用 |
| 全书大纲 | `novel_outlines` + 老 outline 字段 | 新旧混合 |
| 分卷设定 | `volume_settings` | 与卷大纲分离 |
| 剧情线 | `storylines` | 基本清楚 |
| 章节规划 | `chapters.outline` / `novel_outlines type='chapter'` / 前端状态 | 最混乱 |
| 正文 | `chapters` | 基本可用 |

### 5.2 现在最需要先收口的层

最该先收口的是：

- `chapter_plans`

因为它直接决定：

- 生成下一章怎么做
- 批量生成怎么做
- 本章角色与本章大纲怎么联动
- 剧情线如何落到章节

---

## 六、当前实施状态

### 6.1 已完成

项目中已经新增：

- 数据表：`chapter_plans`
- 服务：`ChapterPlanService`
- 接口：
  - `GET /api/books/:bookId/chapter-plans`
  - `GET /api/books/:bookId/chapter-plans/:chapterNumber`
  - `POST /api/books/:bookId/chapter-plans/:chapterNumber`

首页第三步也已经开始：

- 打开章节规划编辑时尝试加载 `chapter_plans`
- 关闭编辑或生成正文前尝试保存 `chapter_plans`

### 6.2 目前仍是兼容式状态

还没有彻底替换旧来源：

- `chapters.outline`
- `novel_outlines type='chapter'`
- 角色表里用特殊名字保存的“本章新增角色”

这是刻意保留的兼容状态，避免一次性硬切。

### 6.3 当前主来源与兼容回退

目前建议按下面这条原则执行：

- `chapter_plans`
  - 作为首页第三步的**主来源**
  - 存本章大纲、本章新增角色、承接上一章、关联剧情线
- `novel_outlines type='chapter'`
  - 降级为**旧数据回退来源**
  - 仅在 `chapter_plans` 缺失时兜底读取
- `chapters.outline`
  - 降级为**历史兼容字段**
  - 不再作为章节规划主入口继续扩写
- 角色表中的 `name='本章新增角色'`
  - 视为**旧结构遗留**
  - 新主流程不再继续写入

也就是说，从现在开始：

- 全书角色摘要仍可继续作为特殊摘要记录兼容使用
- 本章新增角色应以 `chapter_plans.character_notes` 为准
- 后续如需章节角色关系，应往 `chapter_plans` 或专门的章节角色关联表发展，而不是继续往角色表里塞“伪角色记录”

---

## 七、建议的分阶段实施顺序

### 第一阶段：确立章节规划主对象

目标：

- 让 `chapter_plans` 成为首页第三步的主读写对象
- 旧数据只作为兼容回退

要做：

1. 首页第三步所有编辑入口统一保存到 `chapter_plans`
2. 第三步卡片摘要优先读取 `chapter_plans`
3. 正文生成优先使用 `chapter_plans.outline_text`

### 第二阶段：把剧情线接入章节规划

目标：

- 让一章知道自己推进哪些线

要做：

1. 在 `chapter_plans.target_storylines` 中正式写入关联线
2. 章节编辑器里增加“关联剧情线”
3. 生成正文时把关联剧情线一并注入 prompt

### 第三阶段：补齐承接信息

目标：

- 让章节之间真正连起来

要做：

1. 启用 `previous_hook`
2. 自动从上一章规划/上一章正文中生成承接信息
3. 让“生成下一章”真正变成依据上一章结果推进

### 第四阶段：统一卷级与全书级规划

目标：

- 为后续批量生成打通上层结构

要做：

1. 收口 `book_plans`
2. 收口 `volume_plans`
3. 明确全书/分卷/剧情线/章节之间的数据读取顺序

### 第五阶段：再做批量生成

只有在前四阶段稳定后，批量生成才值得做。

批量生成依赖：

- 稳定的全书规划
- 稳定的分卷规划
- 稳定的剧情线
- 稳定的章节规划对象

否则只是把单章混乱复制成多章混乱。

---

## 八、后续接口方向建议

### 8.1 章节规划接口应逐步扩展

建议后续为 `chapter_plans` 增加：

- `PUT /api/books/:bookId/chapter-plans/:chapterNumber/storylines`
- `PUT /api/books/:bookId/chapter-plans/:chapterNumber/hook`
- `POST /api/books/:bookId/chapter-plans/:chapterNumber/generate-detail`

### 8.2 正文生成读取顺序建议

后续 `/api/generate` 对正文生成的优先读取顺序建议固定为：

1. `chapter_plans` 当前章规划

---

## 兼容桥接补充（2026-06-07）

- 首页第三步切换章号时，现已按 `chapter_plans` 整体覆盖当前章数据；如果该章还没有规划，会主动清空上一章残留，避免串章。
- 正文生成在读取数据库角色资料时，已排除旧的伪角色记录：
  - `全书角色设定`
  - `本章新增角色`
- 旧接口 `POST /api/outlines/:bookId/chapter/:chapterId` 现在会同步写入 `chapter_plans`。
  - 这意味着资料库或旧入口如果还在保存“章节大纲”，首页主链也能继续读到同一份章节规划。
  - `novel_outlines type='chapter'` 仍保留，当前定位是兼容层，不再视为首页主链唯一来源。
- `database-view.html` 当前仍会把 `全书角色设定` / `本章新增角色` 这类旧摘要记录解析成“可展示角色”。
  - 这只是为了兼容旧数据回看。
  - 首页主链不应再把它们当成真正的角色档案来源。
  - 后续如果继续整理资料库，应把“摘要文本”和“角色档案”明确拆开展示。
2. `storylines` 当前章关联剧情线
3. `volume_plans` 当前卷摘要
4. `book_plans` 全书摘要
5. `novel_characters` 中的全书角色摘要
6. 上一章正文末尾

不要再让前端文本框成为唯一可信来源。

---

## 九、一个最重要的判断

这次底层规划的关键，不是“有没有把数据存数据库”。

而是：

**有没有给“章节规划”建立独立、稳定、可复用、可联动的对象。**

以前有存，但存的是碎片。

现在要做的是：

- 让本章规划有自己的归口
- 让角色和大纲在这一层会合
- 让后续全书、分卷、剧情线都能自然往这一层汇总

这一步做稳了，后面的：

- 生成下一章
- 章节联动
- 剧情线驱动
- 批量生成

才会真正顺起来。
