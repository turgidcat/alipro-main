# 角色锚点与剧情线约束兼容性审计

## 1. 当前是否存在“角色在剧情线上的锚点”机制

结论先说：

**项目里目前存在“角色执行层”，也存在“剧情线里的角色关联/变化边界”，但还不存在一套完整、独立、正式落地的“角色在剧情线上的锚点机制”。**

更准确地说，当前有三层相关结构：

1. **全书角色底层**
   - 来源：`book_plans.role_summary`、`novel_characters`
   - 作用：给全书角色底色、背景、性格、弧光做长期主档

2. **章节角色执行层**
   - 来源：`chapter_plans.structured_content.role_execution`
   - 作用：告诉正文“这章这个角色具体承担什么作用、允许变化到哪、禁止提前发生什么”

3. **剧情线角色边界层**
   - 来源：
     - `storylines.structured_content.relatedCharacters`
     - `chapter_plans.structured_content.storyline_context.characterChangeBoundaries`
   - 作用：告诉章节和正文“这条剧情线在本章涉及哪些角色、角色该往哪边动、不能乱跳哪一步”

但其中第 3 层还不是一个单独的、完整的“角色锚点系统”，更像：

- 剧情线生成阶段顺带产出的角色信息
- 章节阶段从剧情线里抽出来的角色变化边界

## 2. 相关字段和函数审计

### 2.1 `chapter_plans.structured_content.role_execution`

这是当前最稳定的角色执行层。

它的结构里已有这些字段：

- `role`
- `baseline`
- `chapter_function`
- `allowed_change`
- `forbidden_change`
- `dimension`
- `direction`
- `scope`
- `confidence`

生成方式：

- 前端 [`frontend-react/src/workbenchApi.js`](C:/Users/turgidcat/Desktop/alipro-main/frontend-react/src/workbenchApi.js) 的 `buildChapterStructuredContent(...)`
- 如果没有手填，会走 `buildRoleExecutionFallback(...)` 自动兜底

结论：

- 它是真实存在的
- 但主要是**规则拼装 / 兜底生成**
- 不是模型单独设计出来的角色锚点

### 2.2 `chapter_plans.appearing_roles`

这是本章出场角色名单。

它的作用是：

- 标记哪些角色本章会出现
- 给细纲和正文提供角色名单约束

结论：

- 它不是角色锚点
- 它只是角色名单层

### 2.3 `novel_characters`

这是全书角色主档。

可提供：

- `name`
- `appearance`
- `personality`
- `background`
- `notes`
- `character_arc`

结论：

- 这是角色底色层
- 不是章节执行层
- 也不是剧情线角色锚点层

### 2.4 `storylines.structured_content.relatedCharacters`

这个字段来自剧情线生成服务。

在 [`backend/services/storyline-generation-service.js`](C:/Users/turgidcat/Desktop/alipro-main/backend/services/storyline-generation-service.js) 中，剧情线 JSON 会产出：

- `relatedCharacters`

内容偏向：

- 哪些角色与这条线相关
- 角色在这条线中的作用/动机

结论：

- 这是“剧情线角色关联信息”
- 不是正文直接可执行的角色锚点
- 更像剧情线层的参考资料

### 2.5 `storyline_context.characterChangeBoundaries`

这个字段来自章节细纲阶段。

在 [`backend/routes/ai.js`](C:/Users/turgidcat/Desktop/alipro-main/backend/routes/ai.js) 中：

- `buildChapterStorylineContext(...)` 会从剧情线 beat 里提取：
  - `expectedChange`
  - `relatedCharacters`
- `buildPersistedStorylineContext(...)` 会把它整理进：
  - `characterChangeBoundaries`

结论：

- 这是当前最接近“剧情线角色锚点”的章节级结构
- 但它不是独立生成的角色锚点系统
- 它是从剧情线结构里**派生出来的章节级角色变化边界**

### 2.6 正文生成 Prompt 中角色相关段落

正文 Prompt 来自 [`backend/services/deepseek.js`](C:/Users/turgidcat/Desktop/alipro-main/backend/services/deepseek.js) 的 `buildCreativePrompt(...)`。

当前角色相关段落主要包括：

1. `角色设定参考`
2. `本章出场角色`
3. `本章角色执行参数`
4. `创作上下文`
   - 这里现在也会混入 `storyline_context` 里的角色变化边界

结论：

- 正文生成当前会同时读取“角色执行参数”和“剧情线角色变化边界”
- 但两者进入 Prompt 的位置不同

## 3. 角色锚点由哪里生成

如果严格按“角色在剧情线上的锚点”来定义：

> 某角色在某条剧情线里，当前阶段允许怎样变化、禁止怎样跳变、与主线关系如何推进

那么当前项目里没有一个单独的模型服务专门生成这套结构。

当前相关内容分散来自两边：

### A. 章节角色执行参数

来源：

- 前端 `buildRoleExecutionFallback(...)`
- 或人工编辑 `role_execution`

特点：

- 偏系统函数/人工结构
- 更像章节执行层

### B. 剧情线角色变化边界

来源：

- 剧情线生成模型结果里的 `relatedCharacters`
- 章节阶段从 beat 中抽取的 `expectedChange`

特点：

- 更接近剧情线语义层
- 但不是独立角色锚点 schema

所以当前不存在：

- 单独的 `role_change_anchors` 正式存储
- 单独的角色锚点生成服务

## 4. 保存到哪里

当前角色相关信息主要保存到这些地方：

| 字段 | 保存位置 | 性质 |
| --- | --- | --- |
| `role_summary` | `book_plans.role_summary` | 全书角色底层 |
| 角色主档 | `novel_characters` | 角色资料层 |
| 出场角色 | `chapter_plans.appearing_roles` | 角色名单层 |
| 角色执行参数 | `chapter_plans.structured_content.role_execution` | 章节执行层 |
| 剧情线相关角色 | `storylines.structured_content.relatedCharacters` | 剧情线语义层 |
| 角色变化边界 | `chapter_plans.structured_content.storyline_context.characterChangeBoundaries` | 剧情线派生的章节边界层 |

## 5. 正文生成是否读取

结论：

**会读取，而且是两条线都读取。**

### 5.1 读取角色执行层

正文生成会读：

- `chapter_plans.appearing_roles`
- `chapter_plans.structured_content.role_execution`

这些会直接进入：

- `appearingRoles`
- `roleExecution`

而 `buildCreativePrompt(...)` 对 `roleExecution` 给了很高优先级：

> 若角色执行参数与泛化人物描写冲突，一律以角色执行参数为准。

### 5.2 读取剧情线角色边界层

正文生成现在也会读：

- `chapter_plans.structured_content.storyline_context.characterChangeBoundaries`

它会被整理进：

- `【本章剧情线约束】`
- 其中包含“角色变化边界”

所以：

- 角色执行层会进正文
- 剧情线角色变化边界也会进正文

## 6. 是否和 `storyline_context` 里的角色变化边界重复

结论：

**有部分重复，但不是完全重复。**

### `role_execution` 更偏：

- 本章角色具体做什么
- 本章允许变化到哪
- 本章禁止提前发生什么

它面向的是：

- **章节执行**

### `characterChangeBoundaries` 更偏：

- 这条剧情线下，本章角色变化应该往哪走
- 相关角色是谁
- 变化方向与剧情节点之间的关系

它面向的是：

- **剧情线推进边界**

所以两者关系更像：

- `role_execution` = 执行级
- `characterChangeBoundaries` = 剧情线约束级

它们有交集，但层次不同。

## 7. 如果两者冲突，当前代码优先听谁

这是本次审计里最关键的结论之一。

### 明面上的代码优先级

在 [`backend/services/deepseek.js`](C:/Users/turgidcat/Desktop/alipro-main/backend/services/deepseek.js) 中，正文 Prompt 明确写了：

- `roleExecutionLines.length > 0` 时：
  - “本章角色执行参数高于一般角色说明，若角色执行参数与泛化人物描写冲突，一律以角色执行参数为准。”

也就是说，当前**明确写死的优先级**是：

1. `role_execution`
2. 一般角色说明 / 泛化人物描写

### 对 `storyline_context.characterChangeBoundaries` 的位置判断

它目前是被拼进：

- `contextNotes`
- `【本章剧情线约束】`

它很重要，但当前代码里**没有显式写出**：

- 当 `role_execution` 和 `characterChangeBoundaries` 冲突时谁更高

所以实际效果是：

1. `role_execution` 有显式优先级
2. `characterChangeBoundaries` 有较强语义约束
3. 但两者冲突时，当前更可能由模型自己权衡

换句话说：

**从代码明示优先级看，当前更偏向 `role_execution` 优先。**

## 8. 当前是否存在真正的“剧情线角色锚点”机制

如果标准是：

- 独立生成
- 独立存储
- 独立进入正文
- 有清楚优先级

那么答案是：

**还没有。**

当前更准确的状态是：

1. 有角色底层
2. 有章节角色执行层
3. 有剧情线派生的角色变化边界
4. 但还没有一个正式独立的“角色锚点层”

## 9. 它是真实模型生成，还是字段拼接

分两部分看：

### A. `role_execution`

主要不是模型生成。

当前来源主要是：

- 人工编辑
- 前端 fallback 规则生成

所以它更接近：

- 结构化规则产物
- 不是独立模型设计

### B. `storyline_context.characterChangeBoundaries`

它是从：

- 剧情线模型输出
- beat 的 `expectedChange`
- `relatedCharacters`

再经系统函数提取得到的

所以它属于：

- **模型生成结果的派生结构**

不是纯字段拼接，也不是独立二次模型判断。

## 10. 它是否进入正文生成

结论：

**进入了。**

但进入方式不同：

- `role_execution` 直接作为“本章角色执行参数”进入正文 Prompt
- `characterChangeBoundaries` 作为“本章剧情线约束”的一部分进入正文 Prompt

## 11. 它和 `storyline_context` 是互补还是冲突

结论：

**当前更偏互补，但存在潜在冲突。**

### 互补部分

- `role_execution` 回答：这章这个角色具体干什么
- `storyline_context` 回答：这章在剧情线上角色应该往哪变、不能越过什么边界

所以理想关系是：

- `storyline_context` 定边界
- `role_execution` 定执行

### 潜在冲突部分

如果出现这种情况：

- `role_execution.allowed_change` 写得很宽
- 但 `characterChangeBoundaries.expectedChange` 很保守

或者反过来：

- 剧情线要求角色往前走一步
- `role_execution.forbidden_change` 又把它卡住

那模型会同时收到两套约束，当前代码没有统一仲裁器。

## 12. 下一步应该如何合并两者

不建议现在立刻大改。

更稳的做法是：

### 第一步：先定义职责边界

建议明确分成三层：

1. **角色执行要求**
   - 来源：`role_execution`
   - 回答：本章这个角色具体承担什么功能

2. **剧情线推进要求**
   - 来源：`storyline_context.mustAdvance / currentBeats / conflictEscalation`
   - 回答：本章剧情线必须推进什么

3. **角色变化边界**
   - 来源：`storyline_context.characterChangeBoundaries`
   - 回答：角色可以怎么变、不能怎么跳

### 第二步：在正文 Prompt 里显式区分三段

当前已经有：

- 本章角色执行参数
- 本章剧情线约束

后续建议进一步显式分段，而不是继续混在一起。

### 第三步：补一条明确优先级规则

建议未来明确：

1. 剧情线角色变化边界负责“上限和方向”
2. `role_execution` 负责“本章动作和落地方式”
3. 如果 `role_execution` 超出剧情线边界，以剧情线边界为准

但这只是建议，本次没有改代码。

## 13. 是否需要在正文 Prompt 里区分三类要求

结论：

**需要。**

至少应该明确区分：

### A. 角色执行要求

例如：

- 本章职责
- 允许变化
- 禁止变化

### B. 剧情线推进要求

例如：

- 当前剧情节点
- 本章必须推进
- 冲突升级方向
- 伏笔处理

### C. 角色变化边界

例如：

- 哪些角色受本条剧情线约束
- 本章只允许变化到哪一步
- 不允许越过哪些阶段

当前代码已经部分具备这个方向，但表达还不够硬区分。

## 14. 本次审计结论

### 1. 当前是否存在“角色在剧情线上的锚点”机制

严格来说，还没有独立正式机制。

当前是：

- 章节角色执行层
- 剧情线派生角色边界层

并存。

### 2. 它是真实模型生成，还是字段拼接

- `role_execution`：主要是规则/人工结构，不是独立模型生成
- `characterChangeBoundaries`：来自模型生成剧情线结果的派生提取，不是纯字段拼接

### 3. 它是否进入正文生成

进入了。

### 4. 它和 `storyline_context` 是互补还是冲突

当前更偏互补，但已存在潜在冲突风险。

### 5. 下一步应该如何合并两者

建议不是立刻重构，而是先在认知和 Prompt 分层上明确：

1. 角色执行要求
2. 剧情线推进要求
3. 角色变化边界

### 6. 是否需要在正文 Prompt 里区分这三类要求

**需要。**

这是后续减少角色链与剧情线链互相打架的关键。
