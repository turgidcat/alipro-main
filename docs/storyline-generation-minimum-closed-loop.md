# 剧情线真实生成最小闭环设计

## 1. 背景与目标

这份文档基于 [`docs/storylines-real-flow-audit.md`](C:/Users/turgidcat/Desktop/alipro-main/docs/storylines-real-flow-audit.md) 的审计结果，只回答一件事：

当前项目里，怎样才算真正做出了“剧情线生成服务”的最小闭环。

这里的“最小闭环”，可以通俗理解为一条真的跑通的生产链，不是名字像 AI，也不是接口能返回一段 JSON，而是：

1. 上游语义信息真的被读取；
2. 模型真的基于这些语义信息生成剧情线结构；
3. 结果真的被保存；
4. 章节细纲真的读取这些结果；
5. 正文生成真的读取这些结果；
6. 章节完成后，反馈还能回写剧情线进度。

如果只做到字段复制、ID 挂接、模板拼接，这不算真实生成。

## 2. 当前剧情线为什么还不能算真实生成

根据现有审计，当前问题不是只有“接口报错”，而是“链路没有闭环”。

### 2.1 当前存在的核心问题

1. `backend/routes/storylines.js` 中用于剧情线生成、卷级时间线生成的 4 个关键方法不存在：
   - `buildStorylineOutlinePrompt`
   - `parseStorylineOutlineResponse`
   - `buildVolumeTimelinePrompt`
   - `parseVolumeTimelineResponse`

2. 即使先假设这 4 个方法补齐，当前主生产链也没有明确做到：
   - 章节细纲稳定读取 `storylines.structured_content` 的剧情线节点；
   - 正文生成稳定读取“本章应该推进哪条剧情线、推进到什么节点、限制什么不能乱写”；
   - 卷级时间线稳定进入后续章节生产。

3. 当前已确认的真实使用方式，更接近：
   - 存 `main_storyline_id`
   - 存 `target_storylines`
   - 在正文或反馈阶段把剧情线名称当标签用

这类用法更像“给章节挂标签”，不是“让剧情线结构驱动小说生产”。

### 2.2 为什么这不算真实生成

因为它没有满足“模型做语义判断并被下游真实消费”这两个关键条件。

不算真实生成的典型情况：

- 只是把全书大纲字段复制到剧情线字段；
- 只是把分卷大纲字符串拼到 Prompt 里；
- 只是给章节计划挂 `main_storyline_id`；
- 只是把模型输出存起来，但后续章节细纲和正文根本不用；
- 只是把模型当格式整理器，不是剧情设计器。

一句话说：当前更像“有剧情线表”，还不像“剧情线成为小说生产中枢”。

## 3. 什么情况才算“真实剧情线生成”

满足大部分下面条件，才可以算真实剧情线生成：

1. 明确调用模型，不是本地拼字段。
2. Prompt 输入的不是零散字段，而是完整语义上下文。
3. 模型要产出新的剧情线结构，不是改写现有字段。
4. 输出必须是稳定 JSON，不是自由散文。
5. JSON 要保存到现有剧情线字段里。
6. 章节细纲生成要真正读取这些剧情线节点。
7. 正文生成要真正读取这些剧情线节点和章节约束。
8. 章节完成后，反馈要能回写剧情线推进状态。

### 真实生成 vs 机械传递

| 情况 | 是否算真实生成 | 原因 |
| --- | --- | --- |
| 复制 `book_plans` 文本到 `storylines.structured_content` | 否 | 只是换了存储位置 |
| 把剧情线 ID 保存到 `chapter_plans.main_storyline_id` | 否 | 只是挂接关系 |
| 用固定模板把角色名、卷目标拼起来 | 否 | 还是字段拼接 |
| 模型基于上游语义设计剧情线节点、冲突升级、转折与回收点 | 是 | 模型做了真正的剧情设计 |
| 章节细纲按“本章对应剧情线节点”生成 | 是 | 下游真的消费了剧情线结果 |
| 正文按“本章剧情线目标/限制”写作 | 是 | 剧情线进入正文主链 |

## 4. 剧情线生成服务应该读取哪些上游信息

这里建议不要再依赖旧 `novel_outlines` 作为主来源，而是优先走现在已经较稳定的 `book_plans`、`volume_plans`、`chapter_plans`。

## 4.1 必须读取的上游信息

### A. 全书大纲

建议来源：`book_plans`

至少读取：

- `title`
- `premise`
- `main_goal`
- `core_conflict`
- `world_rules`
- `role_summary`
- `main_outline`
- `detailed_outline`

作用：

- 决定整条剧情线在全书里的功能；
- 决定它属于主线、支线、角色线还是世界事件线；
- 决定冲突升级上限和最终回收方向。

### B. 分卷大纲

建议来源：`volume_plans`

至少读取：

- 当前卷 `volume_number`
- `title`
- `summary`
- `goal`
- `core_conflict`
- `start_state`
- `end_state`
- `keywords`

作用：

- 决定这条剧情线在本卷要推进到哪一阶段；
- 决定本卷该放哪些节点，哪些节点不能提前透支。

### C. 主角弧光

建议来源：

- `book_plans.role_summary`
- `volume_plans.start_state / end_state`
- 角色表中的主角设定

作用：

- 决定剧情线不是只会“发生事件”，而是会推动人物变化。

### D. 角色信息

建议来源：`novel_characters`

至少读取：

- 角色名
- 身份
- 核心欲望
- 当前关系
- 立场
- 能力/限制

作用：

- 决定这条剧情线由谁推动；
- 决定冲突双方是谁；
- 决定节点里谁必须出现、谁不能乱入。

### E. 势力关系

建议来源：

- 角色表中的阵营/组织信息
- 已有势力描述字段
- 如暂无独立表，可先从角色和大纲中整理成上下文片段

作用：

- 决定冲突来源不是单人小打小闹，而是结构性博弈。

### F. 已有章节进度

建议来源：`chapter_plans`

至少读取：

- 已完成章节号
- 章节任务摘要
- 已有反馈
- 已落地的主剧情线 / 目标剧情线

作用：

- 避免模型重复生成已经发生过的节点；
- 避免同一条剧情线反复卡在同一阶段。

### G. 已有剧情线状态

建议来源：`storylines`

至少读取：

- 基础字段：`storyline_name`、`storyline_type`、`core_conflict`
- `structured_content` 里的已有节点
- `chapter_progress`
- `last_chapter_feedback`

作用：

- 支持增量生成和二次修订；
- 让模型知道这条线当前推进到哪里，而不是每次从零胡写。

## 5. 模型应该输出什么 JSON 结构

MVP 不建议追求太大而全，重点是保证：

1. 能表达剧情线阶段推进；
2. 能被章节细纲直接消费；
3. 能被正文生成直接消费；
4. 能被章节反馈稳定回写。

建议统一写入 `storylines.structured_content`，结构如下：

```json
{
  "version": "storyline-mvp-v1",
  "storyline_summary": {
    "name": "主线A",
    "type": "main",
    "theme_function": "承载主角争夺权力的核心冲突",
    "volume_goal": "在第3卷把对抗从试探升级到公开撕裂",
    "current_stage": "对抗升级期",
    "end_condition": "本卷结束前形成不可逆决裂"
  },
  "participants": [
    {
      "character_id": 1,
      "name": "角色A",
      "role_in_line": "推动者",
      "motivation": "夺回控制权"
    }
  ],
  "dependency_context": {
    "related_storyline_ids": [2, 5],
    "required_volume_number": 3,
    "blocking_conditions": [
      "支线B未曝光前不能进入公开决战"
    ]
  },
  "beats": [
    {
      "beat_id": "v3-s1",
      "stage": "setup",
      "title": "第一次正面碰撞",
      "purpose": "把暗线冲突抬到台面",
      "conflict": "双方都要争夺同一资源",
      "expected_change": "主角意识到对手目标比预估更大",
      "suggested_chapter_range": [21, 23],
      "must_include": [
        "关键角色A",
        "资源争夺结果不明"
      ],
      "must_avoid": [
        "提前揭示终局底牌"
      ],
      "status": "pending"
    }
  ],
  "chapter_binding_rules": {
    "selection_rule": "每章至少推进主线或副线中的一条有效 beat",
    "outline_usage_rule": "章节细纲必须引用当前章对应 beat 的 conflict 和 expected_change",
    "draft_usage_rule": "正文必须体现该 beat 的冲突推进结果"
  },
  "progress_tracking": {
    "last_completed_beat_id": null,
    "chapter_progress": [],
    "last_chapter_feedback": null
  }
}
```

## 6. 结果应该保存到哪些现有表/字段

本次设计建议坚持“最小闭环”，先不改数据库结构。

### 6.1 剧情线主存储

表：`storylines`

字段使用建议：

- 基础字段继续保留：
  - `storyline_name`
  - `storyline_type`
  - `core_conflict`
  - `status`
  - `priority`
- 结构化结果主存储：
  - `structured_content`

也就是说：

- 基础字段负责检索、列表展示、人工浏览；
- 真正的剧情线设计结果放在 `structured_content`。

### 6.2 卷级时间线

表：`volume_timelines`

字段使用建议：

- `timeline_data`：保存“本卷多条剧情线在章节区间上的调度视图”
- `status`
- `total_chapters`

但注意：

卷级时间线不是第一个必须打通的点。

MVP 可以先让 `storylines.structured_content.beats` 具备章节范围信息，先支撑章节细纲和正文生成。`volume_timelines` 可以作为第二阶段汇总视图，而不是第一阶段阻塞项。

### 6.3 章节计划挂接

表：`chapter_plans`

现有字段继续用：

- `main_storyline_id`
- `target_storylines`

但它们的作用应该被重新定义为：

- 不是“剧情线本体”；
- 而是“本章要从哪些剧情线结果里取约束”。

## 7. 后续章节细纲应该怎么使用剧情线结果

章节细纲是最应该先接入剧情线的地方，因为这是风险最低、收益最高的一步。

### 7.1 章节细纲最小接入方式

当系统准备生成某章细纲时：

1. 读取当前章的 `main_storyline_id` 与 `target_storylines`
2. 去 `storylines.structured_content` 里取对应剧情线
3. 根据章节号匹配可用 `beats`
4. 把以下内容注入章节细纲 Prompt：
   - 当前主剧情线 beat 的 `purpose`
   - `conflict`
   - `expected_change`
   - `must_include`
   - `must_avoid`
   - 关联副线 beat 的推进要求

### 7.2 章节细纲生成必须做到的事

章节细纲生成不能只写“本章发生什么”，还必须明确：

- 本章推进了哪一个剧情线 beat；
- 推进幅度是什么；
- 有没有满足 `must_include`；
- 有没有违反 `must_avoid`；
- 本章结束后剧情线状态是否应该变更。

如果章节细纲不消费这些结构化剧情线结果，那么剧情线仍然只是“挂在表里的漂亮 JSON”。

## 8. 后续正文生成应该怎么使用剧情线结果

正文生成不是用来设计剧情线的，而是执行剧情线。

### 8.1 正文生成最小接入方式

正文生成时，除了现有章节任务、人物说明、上文摘要，还应增加：

- 当前章节主剧情线 beat 摘要
- 当前章节副剧情线 beat 摘要
- 当前章节必须兑现的冲突变化
- 当前章节不能提前写出的内容

### 8.2 正文 Prompt 中剧情线应承担的角色

剧情线结果进入正文 Prompt 时，应该像“施工图纸”，不是“参考标签”。

至少要约束：

1. 本章主要冲突是什么；
2. 本章推进后人物认知或关系要发生什么变化；
3. 本章是否允许回收某个伏笔；
4. 本章是否禁止提前摊牌；
5. 本章结尾应该把剧情线推进到什么状态。

如果正文仍然只读 `main_storyline_id` 或剧情线名称，那么本质上还是没真正接入剧情线。

## 9. 章节反馈应该如何回写剧情线进度

这部分是现有系统最接近闭环的一环，可以保留并升级。

### 9.1 回写目标

章节完成后，应根据章节细纲和正文结果，对对应剧情线做进度更新：

- 哪个 beat 已完成；
- 哪个 beat 部分完成；
- 是否出现偏离；
- 是否需要新增修正节点。

### 9.2 回写方式

继续使用 `storylines.structured_content` 内的进度区域：

```json
{
  "progress_tracking": {
    "last_completed_beat_id": "v3-s1",
    "chapter_progress": [
      {
        "chapter_number": 22,
        "beat_id": "v3-s1",
        "result": "completed",
        "deviation_note": null
      }
    ],
    "last_chapter_feedback": {
      "chapter_number": 22,
      "summary": "主角已完成第一次正面碰撞，但提前暴露了部分底牌",
      "risk": "后续决战悬念被削弱"
    }
  }
}
```

### 9.3 回写判断标准

系统函数可以负责写回，但“这一章到底算不算完成该 beat”，最好优先由模型或结构化反馈判断，不建议只靠简单字符串判断。

## 10. 哪些任务应该由系统函数负责

系统函数，通俗说就是程序按规则做的部分，适合负责确定性工作。

建议由系统函数负责：

1. 读取上游数据
2. 数据清洗与字段归一
3. 选出当前卷、当前章、目标剧情线
4. 组装模型输入上下文
5. 校验模型输出 JSON 是否合规
6. 保存到 `storylines.structured_content`
7. 将剧情线结果映射到 `chapter_plans.main_storyline_id / target_storylines`
8. 章节完成后回写进度
9. 状态管理、重试、日志、缓存

这些事情不需要模型创造力，交给程序更稳。

## 11. 哪些任务必须由模型负责

模型负责的部分，应该是程序靠规则拼不出来的“剧情判断”。

必须由模型负责：

1. 基于全书与分卷目标设计剧情线阶段
2. 判断剧情线的关键冲突如何升级
3. 判断角色在这条线里的动机与阻力
4. 设计每个 beat 的作用、冲突、变化结果
5. 判断哪些信息应该延后揭示
6. 判断哪些副线应该与主线错峰推进
7. 根据章节反馈判断剧情线是否偏航，是否需要修正

一句话说：

- 系统函数负责“搬运、校验、保存、路由”
- 模型负责“理解、设计、判断、生成”

## 12. MVP 流程图

```text
全书规划（book_plans）
+ 分卷规划（volume_plans）
+ 角色信息（novel_characters）
+ 已有章节进度（chapter_plans）
+ 已有剧情线状态（storylines.structured_content）
↓
构建剧情线上下文
↓
调用模型生成剧情线 JSON
↓
系统校验 JSON 结构
↓
保存到 storylines.structured_content
↓
章节细纲读取当前章对应剧情线 beat
↓
正文生成读取本章剧情线约束
↓
章节反馈回写剧情线进度
```

## 13. 推荐的最小闭环顺序

### 第一步：先定义 `storyline-generation-service`

原因：

- 现在最大问题不是只缺 4 个方法，而是缺一套清晰的输入、输出、存储、下游消费约定。
- 如果直接补 `storylines.js` 里的缺失方法，很容易只是把接口补到能返回 JSON，但下游还是不用。

建议这个服务至少负责：

- 收集上游上下文
- 构建剧情线生成 Prompt
- 调模型
- 解析 JSON
- 校验结构
- 保存到 `storylines.structured_content`

### 第二步：再修那 4 个不存在的方法

这一步应该作为“把 route 接到新服务上”，而不是孤立补函数。

换句话说，不是先补壳，再想逻辑；而是先定闭环，再把缺口接上。

### 第三步：优先把剧情线接入章节细纲

这是风险最低、价值最高的一步。

原因：

- 章节细纲本来就是上承规划、下接正文的枢纽；
- 只要细纲开始真正消费剧情线 beat，剧情线就不再是摆设；
- 比直接接正文更容易控风险，也更容易验证效果。

### 第四步：再把剧情线接入正文生成

原因：

- 正文生成改动面更大；
- 如果没有先在章节细纲层稳定约束，直接接正文容易让 Prompt 变重，但效果仍不稳。

### 第五步：最后再补卷级时间线汇总视图

原因：

- 卷级时间线更像调度层；
- 在剧情线本体还没进入章节主链前，先做它的收益不高。

## 14. 对“下一步做什么”的明确建议

### 1. 是否应该先修那 4 个不存在的方法？

不建议单独先修。

因为单修这 4 个方法，风险是把半成品接口补成“能跑”，但还是没有真实闭环。

### 2. 是否应该先新增 `storyline-generation-service`？

建议先做。

这是后续所有修复的锚点，也是避免再次出现“函数名像 AI、实际只是字段拼接”的关键。

### 3. 是否应该先把剧情线接入章节细纲？

建议在服务设计确定后，优先接入章节细纲。

这是最小闭环里最有价值的消费点。

### 4. 是否应该先把剧情线接入正文生成？

不建议先于章节细纲接入。

正文层更重、更难验证，先接这里容易把问题藏起来。

### 5. 哪一步风险最低、价值最高？

风险最低、价值最高的顺序建议是：

1. 先定义并实现 `storyline-generation-service`
2. 再把 `storylines.js` 缺失方法改为调用该服务
3. 再把剧情线结构接入章节细纲
4. 最后把剧情线结构接入正文生成

如果只选一个最值得先做的动作，那就是：

**先做真实剧情线生成服务的最小闭环设计与服务落点，再动运行修复。**

因为这一步最能避免后面继续补壳。
