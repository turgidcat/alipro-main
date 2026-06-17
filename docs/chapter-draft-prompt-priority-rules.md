# 正文 Prompt 三类约束优先级规则

## 1. 为什么需要正文 Prompt 优先级规则

当前正文生成已经同时读取三类角色/剧情约束：

1. `chapter_plans.structured_content.role_execution`
2. `chapter_plans.structured_content.storyline_context`
3. `storyline_context.characterChangeBoundaries`

如果不把优先级明确写进 Prompt，模型就会自己猜：

- 是先听本章角色执行要求
- 还是先听剧情线角色边界
- 还是回退到长期角色资料

这会带来一个典型风险：

- `role_execution` 想把角色演得更激进
- 但 `characterChangeBoundaries` 其实不允许角色在这章越级变化

所以这一步的目标不是改数据结构，而是先把优先级写死，减少模型自由裁量。

## 2. 三类约束分别是什么

### A. 角色执行要求

来源：

- `chapter_plans.structured_content.role_execution`

负责：

- 本章角色怎么演
- 本章角色承担什么功能
- 本章允许怎么表现
- 本章禁止什么显性跳变

### B. 剧情线推进要求

来源：

- `chapter_plans.structured_content.storyline_context`

负责：

- 本章剧情必须推进什么
- 当前剧情节点是什么
- 本章不得跳过哪些推进任务
- 本章伏笔该如何埋下或回收

### C. 角色变化边界

来源：

- `chapter_plans.structured_content.storyline_context.characterChangeBoundaries`

负责：

- 角色不能在剧情线上越级变化
- 角色这章最多能变化到哪一步
- 哪些变化必须留到后续章节

## 3. 冲突时谁优先

本次明确写入的优先级是：

### 第一优先级：剧情线角色变化边界

作用：

- 防止角色变化越级
- 防止本章角色提前跨阶段跳变

### 第二优先级：章节角色执行要求

作用：

- 决定本章角色具体表现方式
- 但必须在剧情线角色边界内执行

### 第三优先级：角色底层资料

来源：

- `novel_characters`
- `book_plans.role_summary`

作用：

- 保持长期性格、背景和动机一致
- 但不能覆盖本章明确约束

## 4. 本次修改了哪里

本次只改了：

- [`backend/services/deepseek.js`](C:/Users/turgidcat/Desktop/alipro-main/backend/services/deepseek.js)

具体是在：

- `buildCreativePrompt(...)`

的“硬约束”部分新增了几条明确规则，内容包括：

1. 三类约束分别负责什么
2. 三类约束的固定优先级
3. `role_execution` 不能突破 `characterChangeBoundaries`
4. 角色底层资料不能覆盖本章剧情线和章节执行约束

## 5. 后续不要做哪些高风险改动

当前不建议做这些高风险动作：

1. 不要让正文重新查询 `storylines`
2. 不要让正文重新做一套 beat 命中逻辑
3. 不要新建独立 `role_change_anchors` 表
4. 不要新建独立角色锚点服务
5. 不要让章节反馈自动重写剧情线或角色长期弧光
6. 不要把三类约束重新混回一个模糊段落里

## 6. 如何手动检查 Prompt 是否包含优先级规则

### A. 代码侧检查

直接查看：

- [`backend/services/deepseek.js`](C:/Users/turgidcat/Desktop/alipro-main/backend/services/deepseek.js)

确认 `buildCreativePrompt(...)` 的硬约束区包含以下意思：

1. 角色相关约束分三层
2. 第一优先级是剧情线角色变化边界
3. 第二优先级是章节角色执行要求
4. 第三优先级是角色底层资料
5. `role_execution` 不能突破 `characterChangeBoundaries`

### B. 运行侧检查

正常走一遍正文生成链路：

1. 生成剧情线
2. 生成卷级时间线
3. 生成章节细纲
4. 确认 `chapter_plans.structured_content.storyline_context` 已入库
5. 再生成正文

此时如果后端日志或调试工具能查看最终 Prompt，应检查其中是否出现了这些规则。

### C. 行为侧检查

可以选一个“角色执行要求”和“剧情线边界”可能发生拉扯的章节样本，观察正文是否：

1. 仍然按本章任务推进
2. 但没有让角色越级突变
3. 没有让长期角色资料反向压过本章明确约束

## 7. 当前结论

这一步的价值不在于增加新数据，而在于：

**把正文 Prompt 里原本隐含的约束关系，改成显式优先级规则。**

这样后续再继续做角色层与剧情线层整合时，就不会每次都让模型自己猜谁优先。
