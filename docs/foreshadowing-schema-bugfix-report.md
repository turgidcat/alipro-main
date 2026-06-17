# `foreshadowing` 字段不存在 bug 修复报告

更新时间：2026-06-16

## 1. bug 原因

上一轮修完 `character_arc` 后，单条剧情线生成和卷级时间线生成的新报错变成：

```text
no such column: trigger_chapter
```

排查后确认，问题仍然在：

- `backend/routes/storylines.js`

当前代码在查询 `foreshadowing` 表时直接使用了不存在的字段：

- `trigger_chapter`
- `resolve_chapter`

但当前数据库 `foreshadowing` 表并没有这两个列，因此相关接口在模型调用前就会 500。

---

## 2. 修改了哪个文件

本次只修改了一个业务文件：

- `backend/routes/storylines.js`

本次新增文档：

- `docs/foreshadowing-schema-bugfix-report.md`

---

## 3. 是否修改数据库

没有。

本次：

- 没有新增字段
- 没有写迁移
- 没有改 schema

---

## 4. `foreshadowing` 实际字段情况

实查 `PRAGMA table_info(foreshadowing)` 后，当前表字段为：

- `id`
- `book_id`
- `user_id`
- `title`
- `description`
- `status`
- `chapter_id`
- `created_at`
- `resolved_at`

当前表中**没有**：

- `trigger_chapter`
- `resolve_chapter`
- `chapter_number`
- `notes`
- `structured_content`
- `type`
- `payoff`

所以本次不能从这些不存在字段中读取触发章节或回收章节。

---

## 5. `triggerChapter` 和 `resolveChapter` 现在如何安全取值

本次修复策略：

1. SQL 只查询真实存在的字段：
   - 在剧情线生成上下文中查询：
     - `id`
     - `title`
     - `description`
     - `status`
     - `chapter_id`
   - 在伏笔回收率检查中查询：
     - `id`
     - `title`
     - `description`
     - `status`
     - `chapter_id`
2. 在 JS 层增加安全提取函数：
   - 如果对象中存在可解析的：
     - `notes`
     - `structured_content`
   - 则尝试读取：
     - `trigger_chapter`
     - `triggerChapter`
     - `trigger`
     - `resolve_chapter`
     - `resolveChapter`
     - `payoffChapter`
3. 当前库里这些 JSON 字段并不存在，所以实际结果会稳定落为：
   - `triggerChapter: null`
   - `resolveChapter: null`
4. 不根据 `chapter_id`、创建时间、文本内容去强行推断章节号

结论：

- 现在不会因为不存在字段而 SQL 失败；
- 如果库里没有明确记录触发/回收章节，就安全返回 `null`。

---

## 6. `storylines.js` 里是否还有其他不存在字段查询

本次针对 `storylines.js` 里会阻塞剧情线生成的 SQL 做了局部检查。

当前确认：

- `novel_characters.character_arc` 已在上一步移除直接 SQL 查询
- `foreshadowing.trigger_chapter / resolve_chapter` 已在本步移除直接 SQL 查询

当前 `storylines.js` 中剩余出现的 `trigger_chapter / resolve_chapter` 只是：

- JS 层兼容字段名
- 不是 SQL 查询列

因此就本次检查范围看：

- **当前 `storylines.js` 里已没有会直接查询这两个不存在列的 SQL**

---

## 7. 语法检查结果

已通过：

- `node --check backend/routes/storylines.js`

---

## 8. 重启与复测结果

### 8.1 后端已重启

本次重启后端后，新进程信息：

- PID：`39540`
- 启动时间：`2026/6/16 23:23:18`

`/health` 正常返回成功。

### 8.2 单条剧情线生成接口复测

复测接口：

- `POST /api/storyline-workbench/b8bd76b6-170f-4666-9233-36e86b1f8b1d/storylines/e8fbc32c-1744-4369-83b5-07bf6a9a16a9/generate`

结果：

- 返回 `200`
- `success: true`

返回中的 `structured` 已包含：

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

结论：

- **单条剧情线生成接口已通过**

### 8.3 卷级时间线生成接口复测

复测接口：

- `POST /api/storyline-workbench/b8bd76b6-170f-4666-9233-36e86b1f8b1d/volume/1/timeline/generate`

结果：

- 返回 `200`
- `success: true`

返回中的 `structured` 已包含：

- `volumeId`
- `volumeTheme`
- `startState`
- `endState`
- `stages`
- `chapterSlots`
- `rhythmCheck`
- `totalChapters`
- `isFallback`

本次返回中：

- `isFallback: true`
- `stages: []`
- `chapterSlots: []`

这说明：

- **接口已经通过**
- 但当前卷级时间线内容质量仍是 fallback 级，不是本步要处理的 schema 错误

结论：

- **卷级时间线生成接口已通过**

---

## 9. 是否发现新的报错

本次复测中：

- 没有再出现：
  - `no such column: trigger_chapter`
  - `no such column: resolve_chapter`
- 也没有再出现：
  - `deepseekService.buildVolumeTimelinePrompt is not a function`

因此本次没有发现新的硬错误。

但有一个非报错层面的现象需要记录：

- 卷级时间线接口虽然返回成功，但结果是 `isFallback: true`
- 并且 `stages` / `chapterSlots` 为空

这更像是生成质量或上下文不足问题，不是 schema 崩溃问题。

---

## 10. 当前结论

### 10.1 `trigger_chapter` / `resolve_chapter` bug 是否修复

是。

更准确地说：

- 已移除直接查询不存在列的 SQL
- 接口不再因为这两个字段缺失而 500

### 10.2 单条剧情线生成是否通过

- **通过**

### 10.3 卷级时间线生成是否通过

- **通过**

### 10.4 是否还有新的硬报错

- **没有发现新的硬报错**

---

## 11. 下一步建议

现在从“接口不再被 schema 错误拦住”的角度看，已经具备继续做链路验证的条件了。

因此下一步建议：

- **可以进入下一步完整闭环复测**

不过要带着一个明确预期：

- 单条剧情线生成已经返回结构化结果
- 卷级时间线生成虽然通过，但当前是 fallback 结果

所以如果下一轮闭环复测里发现“卷级时间线约束偏弱”，那更可能是生成质量问题，而不是数据库字段崩溃问题。

---

## 12. 摘要

1. bug 原因：
   - `storylines.js` 查询了不存在的 `foreshadowing.trigger_chapter / resolve_chapter`
2. 修改文件：
   - `backend/routes/storylines.js`
3. 是否修改数据库：
   - 否
4. `triggerChapter / resolveChapter` 现在如何取值：
   - 只从可能存在的 JSON 字段安全读取；当前无则为 `null`
5. `storylines.js` 里是否还有其他同类 SQL：
   - 在本次检查范围内，没有发现会继续阻塞这条链路的同类 SQL
6. 单条剧情线生成接口是否通过：
   - 是
7. 卷级时间线生成接口是否通过：
   - 是
8. 是否发现新的报错：
   - 没有新的硬报错
9. 是否建议进入下一步完整闭环复测：
   - 是
