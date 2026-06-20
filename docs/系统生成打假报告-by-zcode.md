# 系统生成打假报告

> 命名后缀：`by-zcode`
> 审查范围：`docs/` 下整理后的 8 份核心文档 vs `backend/` + `frontend-react/` 实际代码
> 审查时间：2026-06-20
> 审查方式：逐条比对文档描述的生成链路层与代码实现，全程不动代码
> 配套阅读：[小说生成操作指南-大白话版.md](./小说生成操作指南-大白话版.md)、[生成链路原理注释文档.md](./生成链路原理注释文档.md)

---

## 〇、报告怎么读

本报告把"文档说的"和"代码实际做的"对不上号的地方，按严重程度分成三档：

- 🔴 **严重不符**：文档描述的能力在代码里**根本不存在**或**完全相反**，会直接误导使用者。
- 🟡 **部分不符**：能力存在，但实现方式、覆盖范围或触发条件与文档描述有出入。
- 🟢 **口径偏差**：能力大体一致，但文档表述含糊或过度概括，容易让人误判系统状态。

每一条都给出：
- **文档原话**（引用自具体文档）
- **代码证据**（引用具体文件 + 行号 + 代码片段）
- **真相**（代码实际在做什么）
- **影响**（这条不符会带来什么后果）

---

## 一、🔴 严重不符（共 7 条）

---

### 🔴 不符 1：正文生成"写回章节记录"——文档说会写，代码不写

**文档原话**（`最新任务状态.md` 第 58 行、`施工看板.md` 第 64-69 行）：

> - 生成后的正文可以写回章节记录。
> - 已真实验通：章节任务表、正文生成、`chapter_feedback` 回写、校改保存、**章节结果落库**

**代码证据**（`backend/routes/ai.js` 第 2677-2858 行，`handleChapterContentGeneration`）：

整个函数体内**没有任何** `db.run` / `UPDATE` / `INSERT` 操作。它只做：
1. `loadBookGenerationContext` 读数据（L2703）
2. `deepseekService.buildCreativePrompt` 拼 prompt（L2761）
3. `runTextGeneration` 调 AI（L2797）
4. `auditGeneratedContent` 审计（L2809）
5. `res.json` 把结果**返回前端**（L2825-2849）

```js
// L2825-2828：只返回，不落库
return res.json({
  success: true,
  data: {
    content: generatedContent,
    usage: result.usage,
```

落库必须由前端**单独**调用 `upsertGeneratedChapter` → `POST /api/books/:bookId/chapters/upsert`（`frontend-react/src/workbenchApi.js` 第 861-871 行）才会发生。

**真相**：`POST /api/generate`（正文生成接口）本身是**无副作用**的纯生成接口。它绝不写 `chapters` 表，也绝不触发剧情线回写。

**影响**：
- 文档"章节结果落库"是被前端二次调用间接实现的，不是接口本身的能力。
- 如果有第三方直接调 `/api/generate`，生成的正文会丢失。
- "生成后的正文可以写回章节记录"在表述上让读者误以为生成接口自带落库，实际不是。

---

### 🔴 不符 2：`chapter_feedback` 独立表——文档说有，代码里没有这张表

**文档原话**（`数据库结构设计.md` 第 105 行、第 539 行）：

> | 推进反馈 | `chapter_feedback` |
>
> | `chapter_feedback` | 推进反馈主表 |

文档还反复强调要"新增 `chapter_feedback` 独立表"（第 484-516 行整节描述该表字段）。

**代码证据**（`backend/database/init.js` 全文）：

`init.js` 用 `CREATE TABLE IF NOT EXISTS` 共建了 12 张表：`books / chapters / chapter_plans / book_plans / volume_plans / templates / foreshadowing / novel_characters / novel_outlines / volume_settings / storylines / volume_timelines / chapter_characters / users`。

**全文件 grep `CREATE TABLE.*chapter_feedback` 零匹配。**

反馈实际存在哪里？挂在 `chapter_plans.structured_content` 这个 JSON 字段里的一个子节点 `chapter_feedback`（`backend/routes/ai.js` 第 1735-1744 行）：

```js
// saveChapterFeedback，L1741-1744
db.run('UPDATE chapter_plans SET structured_content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
  [JSON.stringify(structuredContent), existingPlan.id]);
```

**真相**：`chapter_feedback` 不是表，是 `chapter_plans.structured_content` JSON 里的一个键。

**影响**：
- 文档把"反馈主表"写得像独立结构，实际它寄生在章节规划表里。
- `最新任务状态.md` 自己也承认"`chapter_feedback` 还没有独立表结构"（第 188 行），但 `数据库结构设计.md` 仍把它列为"正式主数据源"。两份文档自相矛盾。

---

### 🔴 不符 3：剧情线"自动生成本卷剧情线集合"——文档说有，代码只能为已存在的剧情线生成大纲

**文档原话**（`生成链路原理注释文档.md` 第 192-203 行，剧情线层实现解释）：

> 3. 模型根据这些材料，产出本卷剧情线草稿：
>    - 剧情线名称
>    - 剧情线类型
>    - 服务目标
>    - 起始章节
>    - 预计终止章节

`剧情线分层与分卷闭环设计.md` 第 179-226 行同样描述"模型产出本卷的若干条剧情线草稿"。

**代码证据**（`backend/routes/storylines.js`）：

剧情线相关的 AI 接口只有两个：

1. `POST /:bookId/storylines/:storylineId/generate`（L444-505）——**前提是 storylineId 已存在**：
   ```js
   // L458-461
   const storylines = execQuery(db, 'SELECT * FROM storylines WHERE id = ?', [storylineId]);
   if (storylines.length === 0) {
     return res.status(404).json({ success: false, error: '剧情线不存在' });
   }
   ```
   它做的是：读一条**已经存在**的剧情线 → 调 `storylineGenerationService.generateStorylineOutline` → 产出这条线的 `structured_content`（keyBeats / foreshadowingToPlant 等详细节点）→ `UPDATE storylines SET structured_content`（L489-492）。

2. `POST /:bookId/volume/:volNum/storylines/generate-all`（L508-577）——注释写"批量生成某卷所有剧情线大纲"，但代码逻辑是**遍历该卷已存在的 storylines 行**，对每条调 `generateStorylineOutline`：
   ```js
   // L522-525
   const storylines = execQuery(db,
     'SELECT * FROM storylines WHERE book_id = ? AND volume_number = ? ORDER BY storyline_number ASC',
     [bookId, volNum]);
   if (storylines.length === 0) {
     return res.status(400).json({ success: false, error: '该卷没有剧情线，请先创建' });
   ```

**新建剧情线的唯一入口**是 `POST /:bookId/storylines`（L331-386），它**不调任何 AI**，只是把前端传来的字段 `INSERT` 进表。

**真相**：系统**根本没有**"从分卷目标自动产出本卷剧情线草稿集合"的能力。文档说的"模型产出剧情线草稿"，在代码里实际是"模型为某条已建好的剧情线补充详细节点"。

**影响**：
- 这是最严重的认知误导。按文档操作的人会以为"填好分卷，系统就能帮我生成这一卷该有几条线、分别叫什么"——**做不到**。
- 用户必须**手动一条一条建剧情线**，然后才能让 AI 给每条线补细节。
- `剧情线进度表与章数动态校正规则.md` 第 87 行说的"函数再把这些字段组合成剧情线生成请求 → 模型产出若干条剧情线草稿"，对应代码完全不存在。

---

### 🔴 不符 4：分卷规划"自动拆出剧情线数量"——分卷拆解只产卷，不产线

**文档原话**（`生成链路原理注释文档.md` 第 131-140 行，分卷规划输出）：

> 模型根据 Prompt 判断：
> - 整本书应该拆成几卷
> - 每卷阶段目标是什么
> - 每卷最核心的冲突是什么
> - 每卷开始和结束时角色状态在哪
> - 每卷大概需要多少章

虽然这里没明说"自动生成剧情线"，但 `剧情线分层与分卷闭环设计.md` 第 179 行起的"剧情线生成逻辑"让人误以为分卷后会自动接剧情线生成。

**代码证据**（`backend/routes/plans.js` 第 174-252 行，`POST /books/:bookId/volume-plans/generate`）：

```js
// L201-208：只调一次 AI，只产出 volumes 数组
const prompt = buildVolumePlanGenerationPrompt(bookPlan, bookId, targetVolumeCount);
const result = await deepseekService.generate({
  prompt, model: 'deepseek-chat', temperature: 0.35, maxTokens: 2200,
  responseFormat: { type: 'json_object' }
});
// L215-217：只解析 volumes
const volumeDrafts = Array.isArray(parsed?.volumes)
  ? parsed.volumes.map((item, index) => normalizeVolumePlanDraft(item, index)).filter(Boolean)
  : [];
```

拆完之后只 `volumePlanService.upsert`（L227-237），**不创建任何 storyline**。`storyline_quota` 字段（建议剧情线数量）只是个数字存在 `volume_plans` 表里，没有任何后续代码读它去自动生成对应数量的剧情线。

**真相**：分卷拆解与剧情线创建之间**没有任何自动衔接**。`storyline_quota` 是个死字段。

**影响**：
- 用户拆完分卷会看到"建议 3 条剧情线"，但点了不会有任何"生成 3 条剧情线"的按钮可用。
- 必须手动去剧情线工作台一条条建。

---

### 🔴 不符 5：剧情线"自动推进、自动回写状态、自动影响下一章目标"——三自动里只做到一半个

**文档原话**（`最新任务状态.md` 第 144-152 行）：

> 但剧情线还没有真正形成：
> - 自动推进
> - 自动回写状态
> - 自动影响下一章目标

`生成链路原理注释文档.md` 第 498-528 行（剧情线进度更新层）描述：把推进结果写回每条相关剧情线，让剧情线变成"有当前进度的长期状态"。

**代码证据**（`backend/services/database.js` 第 335-477 行，`syncStorylineProgressFromChapterPlan`）：

实际行为：
- ✅ **会**更新 `storylines.structured_content`（写入 `last_chapter_feedback` / `chapter_progress` / `currentProgress`）
- ✅ **会**把 `status` 从 `draft` → `active`（L468）
- ❌ **不会**修改 `storylines.start_chapter` / `end_chapter`（完全不读写这两列）
- ❌ **不会**把状态推进到 `completed` / `resolved`（只做一次性 `draft→active` 跃迁）
- ❌ **不会**做章数校正（文档第 8 节"分卷预计章数怎么校正"对应的代码完全不存在）
- ❌ **不会**"自动影响下一章目标"（下一章目标仍由用户在章节任务表里手填）

且只有在 `saveChapterFeedback`（L1725-1773）被调用、且 feedback 的 4 个关键字段非空时（database.js L343-345），回写才真的发生。

**真相**：所谓"剧情线回写"目前只是**把本章反馈摘要贴到剧情线的 JSON 里 + 把 draft 升成 active**。文档反复强调的"动态缩短/延长/拆分/章数校正"全是设计愿景，**代码里一行都没有**。

**影响**：
- 用户以为"写完一章，剧情线的起止章会自动调整"——不会。
- `剧情线进度表与章数动态校正规则.md` 整份文档描述的"缩短/延长/拆分/校正卷总章数"机制，**在代码层面是 0 实现**。

---

### 🔴 不符 6："下一章准备材料"作为独立层——文档列为一层，代码没有独立实现

**文档原话**（`生成链路原理注释文档.md` 第 532-560 行，第 11 层"下一章准备材料"）：

> ### 实现解释
> 1. 系统先从本章反馈里挑出"下一章必须接"的信息。
> 2. 再从剧情线当前进度里挑出"下一章还得继续推"的内容。
> 3. 把两边合并后，变成下一章的开工材料包。
> ### 输出
> - 下一章承接说明 / 下一章重点 / 下一章准备材料

**代码证据**：

全代码库 grep `下一章准备` / `nextChapterPrep` / `prepareNextChapter` 零匹配。

下一章承接材料实际怎么来的？在 `frontend-react/src/workbenchApi.js` 第 657-711 行，**由前端在加载下一章 setup 时临时拼凑**：

```js
// L659-671：从前一章 feedback 里捞 must_carry_forward
const previousContinuityCarry = (() => {
  const raw = previousChapterFeedback?.continuity_report?.must_carry_forward;
  ...
})();
// L708-711：拼个 label
const normalizedPreviousFeedbackFocus = continuityCarryFocus
  || previousChapterFeedback?.next_chapter_focus
  || previousChapterFeedback?.open_hooks
  || '';
```

后端 `loadBookGenerationContext`（ai.js L1775-2003）也只是把上一章 `chapter_plans.structured_content.chapter_feedback` 读出来塞进 `notes[]`（L1986-1988 还截断到 600 字）。

**真相**：根本没有独立的"下一章准备材料"函数层。它是前端加载时从上一章 feedback 里现拼的字符串。

**影响**：文档把它列为 12 层之一，让人以为有个专门的"备料层"，实际是散落在前端拼接逻辑里。

---

### 🔴 不符 7：演示书"已进入新主链样板区间"——样板正文是硬编码种子，不是 AI 生成

**文档原话**（`最新任务状态.md` 第 96-97 行、`施工看板.md` 第 84-86 行）：

> - 《破雾修真录》当前 1-8 章任务表已连续挂回血月旧案主线。
> - 但这不等于 1-8 章都已经是完整长正文样板：前段章节仍保留短正文种子，后段章节才更接近真实生成样本。

文档承认了"短正文种子"存在，但仍给人"后段是真实生成"的印象。

**代码证据**（`frontend-react/src/workbenchApi.js` 第 875-1141 行，`seedDemoWorkspace`）：

演示书的**全部 6 章正文**都是硬编码字符串，通过 `upsertGeneratedChapter` 灌库：

```js
// L1065-1076：第 1 章正文是写死的字符串数组 join
await upsertGeneratedChapter(bookId, {
  title: '第 1 章 雾起离镇',
  chapterName: '雾起离镇',
  chapterNumber: 1,
  content: [
    '边境小镇的雾一夜之间变得异常浓……',
    '当追赶者的脚步声从街尾压过来时……',
    ...
  ].join('\n\n')
});
```

第 1-6 章的 `chapter_plan`（任务表）也都是 `saveChapterPlan` 写死的字段（L928-1063）。

**真相**：演示书的任务表和正文**都是人手写在 `seedDemoWorkspace` 里的种子数据**，不是任何 AI 接口生成的。所谓"主链样板区间"指的是"数据结构对得上新主链"，不是"内容是 AI 生成的"。

**影响**：
- 把硬编码种子说成"主链样板"容易让人误判系统真实生成能力。
- 真正的 AI 生成结果质量如何，演示书完全无法体现。

---

## 二、🟡 部分不符（共 8 条）

---

### 🟡 不符 8：章节任务表"函数实现"——文档说函数自动生成任务，代码只在生成细纲时补空壳

**文档原话**（`生成链路原理注释文档.md` 第 243-252 行，章节任务表实现解释）：

> 1. 系统先根据当前章号，在当前卷剧情线集合里找出"本章落在哪些剧情线区间内"。
> 2. 再从这些可挂载剧情线里选出：本章主推进剧情线 / 本章关联剧情线
> 3. 然后把上一章必须承接的内容并入本章任务。
> 4. 最后补出这一章的情绪目标、结尾钩子和出场角色。

**代码证据**（`backend/routes/ai.js` 第 249-329 行，`ensureChapterPlanForOutlineGeneration`）：

这个"自动建任务表"的逻辑**只在生成细纲时**（`handleOutlineGeneration` 调用它）触发，而且：

- ✅ **会**推断 volume_number（`inferVolumeNumberForChapter`，L284-290）
- ✅ **会**自动挂剧情线（`resolveAutoChapterPlanStorylines`，L297-302）——但只在用户**没在 request 里指定**时才走自动推断
- ❌ **不会**补情绪目标、结尾钩子、出场角色（`chapter_mission / emotion_target / ending_hook / appearing_roles` 全部留空）
- ❌ **不会**并入上一章承接（`previous_hook` 留空）

```js
// L315-323：upsert 时只带了这几个字段
const createdPlan = await chapterPlanService.upsert(bookId, chapterNumber, {
  volume_number: volumeResolution.volumeNumber,
  chapter_name: chapterName,
  main_storyline_id: storylineResolution.mainStorylineId,
  target_storylines: storylineResolution.targetStorylineIds,
  structured_content: structuredContent,
  source: 'ai',
  status: 'draft'
}, '');
```

**真相**：自动建的"任务表"是个**只有卷号和剧情线挂接的空壳**，文档说的"补情绪目标/钩子/角色"完全不发生。真正完整的任务表必须由前端 `saveChapterPlan`（workbenchApi.js L791-821）手填。

**影响**：文档第 4 层"章节任务表"被描述成能自动产出完整任务，实际只能产空壳。

---

### 🟡 不符 9：章节细纲"把结构化结果拼成可读大纲文本"——单一最新稿方案已推翻这条

**文档原话**（`生成链路原理注释文档.md` 第 285-290 行，章节细纲实现解释）：

> 3. 函数再把模型输出拆回结构化字段并保存。
> 4. 同时函数还会把结构化结果拼成一版可读的大纲文本，方便前端展示和正文生成继续读取。

**代码证据**：

`章节细纲单一最新稿方案.md` 自己已经**否决**了这种"双轨"做法（第 22-30 行）：

> - 不再把旧的结构化六字段作为主展示内容。
> - 如果当前只有旧结构字段，没有正式细纲文本，前端显示"尚未生成正式细纲"。

实际代码（`handleOutlineGeneration`，ai.js L2409-2495）：生成的细纲文本**只返回前端，不落库**（落库的只有 `storyline_context` 元数据，L2474）。`chapter_plans.outline_text` 的写入发生在前端 `saveChapterPlan`（workbenchApi.js L808）。

**真相**：文档第 5 层描述的"拆回结构化字段 + 拼可读文本"的双轨机制，已被新方案废止。现在只有一份 `outline_text`。

**影响**：`生成链路原理注释文档.md` 在这点上已过时，但没标注。两份文档对同一层的描述互相打架。

---

### 🟡 不符 10：章节角色执行层"函数实现"——代码只做兜底拼接，不真正"分配职责"

**文档原话**（`生成链路原理注释文档.md` 第 330-338 行，章节角色执行层实现解释）：

> 1. 系统先取出这一章出场角色名单。
> 2. 再给每个角色补上长期底色。
> 3. 然后根据本章任务，给每个角色分配：这章负责什么 / 这章能变化到哪 / 这章不能提前发生什么
> 4. 如果没有完整填写，系统会自动给出一版保守兜底。

**代码证据**：

"角色执行层"的数据存在 `chapter_plans.structured_content.role_execution`。它的生成有两路：

1. **前端兜底拼接**（`workbenchApi.js` 第 133-151 行，`buildRoleExecutionFallback`）——只在 role_execution 为空时，用 appearing_roles + character_notes + chapter_mission 拼一版模板化文字：
   ```js
   return roles.map((role) => ({
     role,
     baseline: baseline || '延续当前人物底色。',
     chapter_function: mission ? `围绕本章任务"${mission}"承担推进作用。` : '承担本章推进作用。',
     allowed_change: '只允许推进一步，不允许跨阶段突变。',
     forbidden_change: '不能直接完成长期关系翻转、立场逆转或真相彻底揭示。',
     ...
   }));
   ```
2. **后端 normalizeRoleExecutionList**（ai.js 第 527-530 行）——只做字段归一化，不生成内容。

**没有任何 AI 调用**会"根据本章任务给每个角色分配职责"。所谓"角色执行层"目前就是**前端用模板字符串拼出来的占位说明**。

**真相**：文档说"系统自动给角色分配本章职责"，实际是写死模板套话。

**影响**：让用户以为系统会智能分配角色任务，实际拿到的都是"承担本章推进作用""只允许推进一步"这种万能废话。

---

### 🟡 不符 11：正文生成输入包"函数实现"——确实存在，但和文档列的输入对不上

**文档原话**（`生成链路原理注释文档.md` 第 354-372 行，正文生成输入包的输入清单）：

列了 14 项输入（自动合成大纲、结构化章节细纲、章节任务、情绪目标、角色资料、章节角色执行层、上一章反馈、上章承接说明、主推进剧情线、关联剧情线、书名、题材、平台风格、目标字数）。

**代码证据**（`handleChapterContentGeneration` + `loadBookGenerationContext`）：

实际传给 `buildCreativePrompt` 的参数（ai.js L2761-2784）确实覆盖了大部分，但：

- "自动合成大纲"这一项在新方案下已合并进 `outline_text`，不再独立存在（见不符 9）
- "结构化章节细纲"和"自动合成大纲"现在其实是同一个 `finalOutline`（L2729-2731），文档却列为两个独立输入
- `loadBookGenerationContext` 里上一章正文只截断 600 字塞进去（L1986-1988），不是完整的"上一章反馈"

**真相**：输入包是有的，但文档列的 14 项里有冗余和重叠，且"上一章反馈"实际是截断版。

**影响**：偏口径，不影响功能。

---

### 🟡 不符 12："本章反馈"输出包含 7 项——代码输出的字段名和文档对不上

**文档原话**（`生成链路原理注释文档.md` 第 479-486 行，本章反馈输出）：

> - 章节摘要 / 剧情推进结果 / 角色推进结果 / 未收内容 / 下一章焦点 / 连续承接项 / 连续性风险

**代码证据**（`handleChapterFeedbackGeneration`，ai.js L2626-2649 组装 feedback 对象）：

实际字段名是：

```js
chapter_summary       // 对应"章节摘要" ✅
story_progress        // 对应"剧情推进结果" ✅
character_progress    // 对应"角色推进结果" ✅
open_hooks            // 对应"未收内容" ✅
next_chapter_focus    // 对应"下一章焦点" ✅
continuity_report     // 对应"连续性风险"（含 must_carry_forward / new_characters / new_elements）
```

文档说的"连续承接项"在代码里是 `continuity_report.must_carry_forward`（嵌套在连续性报告里，不是顶级字段）。

**真相**：6 个顶级字段 + 1 个嵌套字段，和文档列的 7 个顶级项对不齐。

**影响**：开发者照文档字段名去取值会取不到"连续承接项"。

---

### 🟡 不符 13：剧情线进度更新"输出包含是否需要复核"——代码有，但触发逻辑和文档描述不同

**文档原话**（`生成链路原理注释文档.md` 第 521-524 行，剧情线进度更新输出）：

> - 剧情线当前进度 / 最新推进记录 / 最近一次反馈摘要 / 是否需要复核

**代码证据**（`syncStorylineProgressFromChapterPlan`，database.js L335-477）：

`requires_review` 实际的触发条件（L355、L440-450）：

```js
const requiresStorylineReview = isFallbackContext || contextBeatIds.length === 0;
```

即：**当 storyline_context 是 fallback 的、或者没有任何 beat id 时**才标记需要复核。

这和文档暗示的"根据推进结果智能判断是否复核"不同——它只看"上下文是不是兜底的"，不看"推进结果有没有问题"。

**真相**：复核标志是"上下文质量"的代理指标，不是"推进质量"的判断。

**影响**：偏口径。

---

### 🟡 不符 14：校改定稿"保存成校改稿或最终稿"——代码只返回润色结果，不区分稿次

**文档原话**（`生成链路原理注释文档.md` 第 582-586 行，校改定稿输出）：

> - 校改稿 / 最终稿

**代码证据**（`POST /api/polish`，ai.js L2872-2891）：

```js
// L2886：只返回 content，不存库，不分稿次
return res.json({ success: true, data: { content: normalizeText(result.content), usage: result.usage } });
```

`/api/polish` 是**纯生成接口**，不写任何表。"保存成最终稿"仍由前端决定（通常是把 polish 结果回填到正文编辑区，再由用户点保存走 `upsertGeneratedChapter`）。

**真相**：校改接口不分"校改稿/最终稿"，也不落库。

**影响**：文档让人以为系统有版本管理，实际没有。

---

### 🟡 不符 15：`chapter_feedback.updated_at` 文档强调会刷新——实际刷新的是宿主 chapter_plans 的 updated_at

**文档原话**（`施工看板.md` 第 68 行）：

> - 已确认：`chapter_feedback.updated_at` 会真实刷新

**代码证据**（`saveChapterFeedback`，ai.js L1741-1744）：

```js
db.run('UPDATE chapter_plans SET structured_content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
  [JSON.stringify(structuredContent), existingPlan.id]);
```

刷新的是 `chapter_plans.updated_at`。`chapter_feedback` 作为 JSON 子节点，它内部如果带 `updated_at` 字段，那是 feedback 对象自己写的（在组装时），但**表层面板"反馈的更新时间"实际取的是 chapter_plans.updated_at**。

**真相**：表述基本成立（时间确实会变），但机制是"宿主表的 updated_at 变了"，不是"反馈表自己的 updated_at 变了"——因为根本没有反馈表。

**影响**：偏口径，但容易让人误以为 feedback 有独立的更新时间戳。

---

## 三、🟢 口径偏差（共 6 条）

---

### 🟢 偏差 16："12 层主链"过度结构化

**文档**：`生成链路原理注释文档.md` 把生成过程列为 12 层，每层都有"输入/实现/输出"。

**代码**：实际可独立调用的 AI 接口只有 5 个核心：分卷拆解、（单条）剧情线大纲、章节细纲、正文、本章反馈。其余"全书规划/章节任务表/角色执行层/输入包/剧情线进度更新/下一章准备材料"都是**函数内部步骤或前端拼接**，不是独立可调用的层。

**影响**：12 层是逻辑切片，不是工程切片。读者会误以为有 12 个独立模块。

---

### 🟢 偏差 17："函数实现 / 混合实现"标签含义模糊

**文档**：每层标 `函数实现` 或 `混合实现`。

**代码**：所谓"函数实现"的层（全书规划、章节任务表、角色执行层、输入包、剧情线进度更新、下一章准备材料），要么是"读字段拼字符串"，要么是"前端兜底拼接"，**没有任何一层真正做到了文档描述的完整逻辑**（见不符 5、6、8、10）。

**影响**："函数实现"让人以为逻辑很扎实，实际多数是占位级实现。

---

### 🟢 偏差 18：`volume_settings` 和 `volume_plans` 的关系

**文档**：`数据库结构设计.md` 第 549 行把 `volume_settings` 列为"分卷轻配置层"兼容层。

**代码**：前端 `fetchChapterSetupBundle`（workbenchApi.js L643-644、L693-698）在 `volume_plans` 为空时会**回退读 `volume_settings`**：

```js
const volumeRecords = normalizedVolumePlans.length > 0
  ? normalizedVolumePlans
  : normalizedVolumeSettings;
```

**影响**：兼容回退是好的，但文档没说清"前端实际会自动降级读旧表"，容易让人以为 volume_settings 已经退场。

---

### 🟢 偏差 19：`novel_outlines` "降级为兼容层"

**文档**：`数据库结构设计.md` 反复说 `novel_outlines` 要降级。

**代码**：`loadBookGenerationContext`（ai.js L1793-1797）**每次正文生成都还在读 `novel_outlines`**，和 `book_plans` 并列读取：

```js
// L1793-1802：novel_outlines 和 book_plans 都在读
const outlines = execQuery(db, "SELECT * FROM novel_outlines WHERE ...");
const bookPlans = execQuery(db, "SELECT ... FROM book_plans WHERE ...");
```

前端 `fetchBookPlanningBundle`（workbenchApi.js L317-382）也是 book_plan 和 legacy outline 双读。

**影响**：兼容层不仅没退场，还是生成链路的活跃读取源。

---

### 🟢 偏差 20：剧情线类型分类（贯穿/阶段/主题/钩子）

**文档**：`剧情线分层与分卷闭环设计.md` 第 79-145 行定义了 4 种剧情线类型 + 对应模板。

**代码**：`storylines.storyline_type` 字段没有 CHECK 约束，前端 `normalizeStoryline`（workbenchApi.js L53-67）只区分 `main` 和 `branch` 两类：

```js
const normalizedType = String(storyline.storyline_type || '').trim().toLowerCase() === 'main' ? 'main' : 'branch';
```

**影响**：文档说的 4 种类型模板，代码层面只有 main/branch 二分。

---

### 🟢 偏差 21："批量生成重新验收"的口径

**文档**：`最新任务状态.md` 第 197-203 行说"第 1-4 章通过 outline_text 兼容输入连续生成，第 5 章通过 stored_structured_outline 新主链输入生成"。

**代码**：如不符 9 所述，新方案已统一为单一 `outline_text`。所谓"stored_structured_outline 新主链输入"在当前代码里就是 `chapter_plans.structured_content.chapter_outline_structure`，而它在新方案里**已退为兼容兜底**（`章节细纲单一最新稿方案.md` 第 64-73 行）。

**影响**：文档把"已退为兼容层的旧路径"说成"新主链输入"，口径反了。

---

## 四、汇总表

| 编号 | 严重度 | 一句话结论 |
|---|---|---|
| 1 | 🔴 | 正文生成接口不落库，落库靠前端二次调用 |
| 2 | 🔴 | `chapter_feedback` 不是表，是 JSON 子节点 |
| 3 | 🔴 | 没有"自动生成本卷剧情线集合"的能力 |
| 4 | 🔴 | 分卷拆解不自动产剧情线，`storyline_quota` 是死字段 |
| 5 | 🔴 | 剧情线回写只做摘要+draft→active，不做章数校正/状态推进 |
| 6 | 🔴 | "下一章准备材料"不是独立层，是前端拼接 |
| 7 | 🔴 | 演示书正文是硬编码种子，不是 AI 生成 |
| 8 | 🟡 | 自动建任务表只产空壳，不补情绪/钩子/角色 |
| 9 | 🟡 | 细纲"双轨"已被单一最新稿方案推翻 |
| 10 | 🟡 | 角色执行层是前端模板拼接，不是 AI 分配 |
| 11 | 🟡 | 输入包 14 项有冗余重叠 |
| 12 | 🟡 | 反馈字段名和文档列的不齐 |
| 13 | 🟡 | "需要复核"看的是上下文质量，不是推进质量 |
| 14 | 🟡 | 校改不区分稿次，不落库 |
| 15 | 🟡 | feedback 的 updated_at 实际是宿主表的 |
| 16 | 🟢 | 12 层是逻辑切片，不是工程模块 |
| 17 | 🟢 | "函数实现"标签名过其实 |
| 18 | 🟢 | volume_settings 仍在活跃回退读取 |
| 19 | 🟢 | novel_outlines 没退场，仍是生成链路读取源 |
| 20 | 🟢 | 剧情线类型只有 main/branch，没有 4 种模板 |
| 21 | 🟢 | "stored_structured_outline 新主链"口径反了 |

---

## 五、给文档维护者的三条建议

1. **把"能力描述"和"代码事实"分开标注**：每份描述能力的文档，应在显著位置标注"【已实现】/【部分实现】/【未实现·设计愿景】"。目前最大的问题是把设计愿景写成了已实现。

2. **统一 `chapter_feedback` 的口径**：`数据库结构设计.md` 把它当表，`最新任务状态.md` 承认它不是表。两份文档对同一对象的定位矛盾，必须统一。

3. **明确"剧情线自动生成"的真实边界**：这是用户最容易误解的点。应在 `生成链路原理注释文档.md` 第 3 层显著标注"当前只能为已存在的剧情线生成详细节点，不能从分卷自动产出剧情线集合"。

---

## 六、本报告的局限

- 本报告只比对了 `docs/` 下整理后的 8 份核心文档与后端 + 前端核心代码，**未覆盖** `backend/routes/analysis.js`、`backend/routes/auth.js`、旧静态前端 `backend/public/`。
- 本报告基于代码静态阅读，**未实际运行接口**验证运行时行为。
- 部分函数（如 `syncStorylineProgressFromChapterPlan` 全 477 行）只读了关键段落，可能存在未发现的边角逻辑。
- 本报告**全程未修改任何代码**，仅做事实核对。
