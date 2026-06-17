# 小说生成架构总索引

## 1. 文档目标

这份文档不是重新审计，也不是重写已有结论。

它的作用只有一个：

**把“剧情线闭环”和“角色层三分法”挂到同一个总索引里，方便后续开发时不丢上下文。**

建议把它当作当前小说生成架构的导航页。

## 2. 当前架构主文档入口

### 剧情线闭环

- [`docs/storyline-closed-loop-audit.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/storyline-closed-loop-audit.md)

### 角色层三分法

- [`docs/character-layer-three-part-architecture.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/character-layer-three-part-architecture.md)

### 角色层与剧情线兼容性审计

- [`docs/character-anchor-storyline-compatibility-audit.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/character-anchor-storyline-compatibility-audit.md)

### 其他相关剧情线闭环文档

- [`docs/storylines-real-flow-audit.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/storylines-real-flow-audit.md)
- [`docs/storyline-generation-minimum-closed-loop.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/storyline-generation-minimum-closed-loop.md)
- [`docs/storyline-generation-service-mvp.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/storyline-generation-service-mvp.md)
- [`docs/storyline-to-chapter-outline-integration.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/storyline-to-chapter-outline-integration.md)
- [`docs/chapter-plan-role-in-draft-generation-audit.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/chapter-plan-role-in-draft-generation-audit.md)
- [`docs/chapter-plan-storyline-context-persistence.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/chapter-plan-storyline-context-persistence.md)
- [`docs/chapter-draft-storyline-context-integration.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/chapter-draft-storyline-context-integration.md)
- [`docs/chapter-feedback-storyline-progress-writeback.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/chapter-feedback-storyline-progress-writeback.md)

## 3. 当前剧情线闭环主链路

当前项目已经形成的最小剧情线闭环主链路如下：

截至当前阶段，**剧情线主链闭环已通过最终验收；卷级时间线仍为质量优化项。**

截至当前阶段，**卷级时间线已完成生成质量与 chapterSlots 覆盖率优化；未来章节下游消费验证依赖真实 chapters / chapter_plans 数据。**

截至当前阶段，**未来章节承接链路已完成验收：未来章节可按需创建 chapter_plan，并完成 timelineSlot → storyline_context → 正文 → 反馈回写链路。**

```text
剧情线生成
↓
卷级时间线生成
↓
章节细纲读取剧情线
↓
storyline_context 写入 chapter_plans
↓
正文生成读取 storyline_context
↓
章节反馈回写剧情线进度
```

更具体地说：

1. 剧情线生成写入 `storylines.structured_content`
2. 卷级时间线生成写入 `volume_timelines.timeline_data`
3. 章节细纲阶段命中剧情线节点，并生成章节级约束
4. 这些约束写入 `chapter_plans.structured_content.storyline_context`
5. 正文生成不再重查剧情线，而是读取 `storyline_context`
6. 章节反馈再把进度回写到 `storylines.structured_content.currentProgress`

详细审计见：

- [`docs/storyline-closed-loop-audit.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/storyline-closed-loop-audit.md)

## 4. 当前角色层三分法

当前项目里的角色控制，不是单层结构，而是三层结构：

### A. 角色底层

来源：

- `novel_characters`
- `book_plans.role_summary`

作用：

- 提供长期角色底色
- 提供背景、性格、长期关系和长期弧光方向

### B. 章节角色执行层

来源：

- `chapter_plans.structured_content.role_execution`

作用：

- 提供本章角色执行要求
- 规定本章这个角色怎么演

### C. 剧情线角色边界层

来源：

- `chapter_plans.structured_content.storyline_context.characterChangeBoundaries`

作用：

- 提供角色在当前剧情线中的变化边界
- 防止角色在剧情线上越级变化

详细设计见：

- [`docs/character-layer-three-part-architecture.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/character-layer-three-part-architecture.md)

详细兼容性审计见：

- [`docs/character-anchor-storyline-compatibility-audit.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/character-anchor-storyline-compatibility-audit.md)

## 5. 三者职责

当前正文与章节生成相关的三类关键约束，应这样理解：

### 5.1 `role_execution`

负责：

**本章角色怎么演**

它回答的是：

- 这个角色本章承担什么功能
- 本章允许怎样表现
- 本章禁止哪些过激表现

### 5.2 `storyline_context`

负责：

**本章剧情线怎么推进**

它回答的是：

- 当前剧情节点是什么
- 本章必须推进什么
- 本章禁止提前发生什么
- 本章伏笔怎么埋、怎么回收
- 本章冲突往哪个方向升级

### 5.3 `characterChangeBoundaries`

负责：

**角色不能在剧情线上越级变化**

它回答的是：

- 当前剧情线允许角色变化到哪一步
- 哪些变化不能提前发生
- 哪些角色变化必须保持在剧情线边界内

## 6. 当前推荐优先级

如果 `role_execution` 和 `characterChangeBoundaries` 发生冲突，推荐优先级固定为：

1. **第一优先级：`characterChangeBoundaries`**
   - 作用：防止角色变化越级

2. **第二优先级：`role_execution`**
   - 作用：在边界内决定本章具体表现方式

3. **第三优先级：角色底层资料**
   - 作用：提供长期性格、背景与底色参考

换句话说：

- `role_execution` 不能突破 `characterChangeBoundaries`
- `role_execution` 只能在该边界内决定具体表现方式

## 7. 当前不要做的事

在剧情线闭环和角色三层架构还处于稳定收口阶段时，当前不建议做这些事：

### 7.1 暂时不要新建 `role_change_anchors` 表

原因：

- 角色层尚未稳定到需要再加第四层正式结构
- 现在更重要的是先把三层职责固定住

### 7.2 暂时不要新建独立角色锚点服务

原因：

- 当前还没有必要把角色边界系统单独拆成一套服务
- 否则会和剧情线闭环同时进入结构重构期

### 7.3 暂时不要让正文重新查询剧情线

原因：

- 正文现在应只读 `chapter_plans.structured_content.storyline_context`
- 如果重新查 `storylines`，就会重新出现两套并行逻辑

### 7.4 暂时不要让反馈自动重写剧情线或角色弧光

原因：

- 当前反馈回写应以 touched / review 为主
- 不能因为单章反馈就自动改剧情线核心规划或角色长期弧光

## 8. 当前架构的一句话总结

当前项目的小说生成架构，已经可以用下面这张总图理解：

```text
剧情线闭环：
storylines
↓
volume_timelines
↓
chapter_plans.storyline_context
↓
正文生成
↓
chapter_feedback
↓
storylines.currentProgress

角色三分法：
角色底层
↓
章节角色执行层
↓
剧情线角色边界层
```

更精确地说：

- 剧情线闭环负责“这章剧情怎么推进”
- 角色三分法负责“这章角色怎么演、又不能演过头”

## 9. 后续开发使用建议

后续如果继续开发，请优先按下面顺序查文档：

1. 先看本索引：
   - [`docs/novel-generation-architecture-index.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/novel-generation-architecture-index.md)
2. 再看剧情线总审计：
   - [`docs/storyline-closed-loop-audit.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/storyline-closed-loop-audit.md)
3. 再看角色层设计：
   - [`docs/character-layer-three-part-architecture.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/character-layer-three-part-architecture.md)
4. 如果要处理角色与剧情线冲突，再看兼容性审计：
   - [`docs/character-anchor-storyline-compatibility-audit.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/character-anchor-storyline-compatibility-audit.md)
