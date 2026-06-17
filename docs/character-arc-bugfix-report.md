# `character_arc` 字段不存在 bug 修复报告

更新时间：2026-06-16

## 1. bug 原因

单条剧情线生成接口原先在：

- `backend/routes/storylines.js`

的 `loadStorylineGenerationContext(...)` 中执行了这条查询：

```sql
SELECT id, name, personality, background, character_arc, notes, character_type
FROM novel_characters
WHERE book_id = ?
ORDER BY id ASC
```

但当前数据库 `novel_characters` 表并没有 `character_arc` 字段，所以接口会直接报：

```text
no such column: character_arc
```

这会导致：

- `POST /api/storyline-workbench/:bookId/storylines/:storylineId/generate`

在进入模型调用前就 500。

---

## 2. 修改了哪个文件

本次只修改了一个业务文件：

- `backend/routes/storylines.js`

本次新增文档：

- `docs/character-arc-bugfix-report.md`

---

## 3. 是否修改数据库

没有。

本次：

- 没有新增字段
- 没有写迁移
- 没有改 schema

---

## 4. `novel_characters` 实际字段情况

实查 `PRAGMA table_info(novel_characters)` 后，当前表字段为：

- `id`
- `book_id`
- `user_id`
- `name`
- `appearance`
- `personality`
- `background`
- `notes`
- `character_type`
- `created_at`
- `role_tier`
- `avatar_image`

当前表中**没有**：

- `character_arc`
- `structured_content`
- `profile`
- `motivation`
- `tags`

所以本次不能从这些不存在字段里兜底读取。

---

## 5. `characterArc` 现在如何安全取值

本次修复策略是：

1. SQL 只查询真实存在的字段：
   - `id`
   - `name`
   - `appearance`
   - `personality`
   - `background`
   - `notes`
   - `character_type`
   - `role_tier`
   - `avatar_image`
2. 在 JS 层增加安全读取：
   - 如果 `notes` 是可解析 JSON，则尝试读取：
     - `character_arc`
     - `characterArc`
     - `arc`
   - 如果没有，则返回 `null`
3. 不伪造角色弧光
4. 不从角色名、时间戳、类型等字段强行猜测弧光

因此现在传给后续剧情线生成上下文的角色对象里：

- `character_arc` 可能是字符串
- 也可能是 `null`
- 但不会再因为数据库列不存在而直接 SQL 失败

---

## 6. 是否还有其他 `character_arc` SQL 查询

全项目搜索结果显示：

- 只有 `backend/routes/storylines.js` 存在直接 SQL 查询 `character_arc`

其余出现位置：

- `backend/services/storyline-generation-service.js`
  - 只是读取 `item.character_arc`
  - 不直接查数据库
- `backend/services/outline-prompts.js`
  - 只是文案/schema 字段名

结论：

- **本次已清除当前项目里唯一一个直接 SQL 查询 `character_arc` 的位置**

---

## 7. 语法检查结果

已通过：

- `node --check backend/routes/storylines.js`
- `node --check backend/services/storyline-generation-service.js`

---

## 8. 重启与复测结果

### 8.1 后端已重启

本次重启后端后，新进程信息：

- PID：`31108`
- 启动时间：`2026/6/16 23:13:43`

`/health` 正常返回成功。

### 8.2 单条剧情线生成接口复测

复测接口：

- `POST /api/storyline-workbench/b8bd76b6-170f-4666-9233-36e86b1f8b1d/storylines/e8fbc32c-1744-4369-83b5-07bf6a9a16a9/generate`

结果：

- 仍然 `500`

但是新的真实报错已经变化为：

```text
no such column: trigger_chapter
```

这说明：

- **`character_arc` 不再是当前第一阻塞项**
- 本次修复已经把原始 bug 往前推进了一步

### 8.3 是否通过

当前还不能算“接口通过”。

因为它仍然 500，只是：

- **失败原因已经从 `character_arc` 切换成了新的 `trigger_chapter`**

---

## 9. 卷级时间线接口复测

复测接口：

- `POST /api/storyline-workbench/b8bd76b6-170f-4666-9233-36e86b1f8b1d/volume/1/timeline/generate`

结果：

- 仍然 `500`

但这次不再是旧错误：

```text
deepseekService.buildVolumeTimelinePrompt is not a function
```

而是新的真实报错：

```text
no such column: trigger_chapter
```

这说明：

1. 之前“旧服务未重启”导致的旧方法错误，当前已经不再是表层错误；
2. 现在更前面的数据库字段问题先炸了，所以还没走到更后面的逻辑。

---

## 10. 新报错来源

新报错来源也在：

- `backend/routes/storylines.js`

当前代码中还存在查询：

```sql
SELECT title, description, status, trigger_chapter, resolve_chapter
FROM foreshadowing
WHERE book_id = ? AND status != 'resolved'
ORDER BY created_at ASC
```

以及：

```sql
SELECT id, title, status, chapter_id, trigger_chapter, resolve_chapter
FROM foreshadowing
WHERE book_id = ?
```

但当前数据库 `foreshadowing` 表字段只有：

- `id`
- `book_id`
- `user_id`
- `title`
- `description`
- `status`
- `chapter_id`
- `created_at`
- `resolved_at`

没有：

- `trigger_chapter`
- `resolve_chapter`

所以当前新的阻塞点已经转移到 `foreshadowing` 相关 SQL。

---

## 11. 当前结论

### 11.1 `character_arc` bug 是否修复

可以认为：

- **已修复到“不再是当前首个报错源”**

更准确地说：

- 这次已经移除了直接查询不存在 `character_arc` 列的 SQL
- 接口不再首先报 `character_arc`

### 11.2 单条剧情线生成是否通过

- **未通过**

新的真实阻塞错误是：

- `no such column: trigger_chapter`

### 11.3 卷级时间线生成是否通过

- **未通过**

新的真实阻塞错误同样是：

- `no such column: trigger_chapter`

### 11.4 是否发现新的报错

发现了，而且是新的主阻塞项：

- `no such column: trigger_chapter`

---

## 12. 下一步建议

当前最合理的下一步不是回头再动 `character_arc`，而是：

- **进入下一步修复 `foreshadowing` 查询里的 `trigger_chapter / resolve_chapter` 字段不存在问题**

原因：

1. `character_arc` 这个炸点已经被移走；
2. 现在新的第一阻塞项已经暴露出来；
3. 只有继续把 `foreshadowing` 查询适配到现有 schema，单条剧情线生成和卷级时间线生成才可能继续往后跑；
4. 旧的 `deepseekService.buildVolumeTimelinePrompt is not a function` 目前没有再次出现，但还不能宣告彻底消失，因为数据库错误更早触发了。

---

## 13. 摘要

1. bug 原因：
   - `storylines.js` 查询了不存在的 `novel_characters.character_arc`
2. 修改文件：
   - `backend/routes/storylines.js`
3. 是否修改数据库：
   - 否
4. `characterArc` 现在如何取值：
   - 从 `notes` 可解析 JSON 中安全读取；没有就 `null`
5. 是否还有其他 `character_arc` SQL 查询：
   - 没有
6. 单条剧情线生成是否通过：
   - 否，新的错误是 `no such column: trigger_chapter`
7. 卷级时间线生成是否通过：
   - 否，新的错误也是 `no such column: trigger_chapter`
8. 是否建议进入下一步闭环复测：
   - 还不建议
   - 建议先修 `foreshadowing` 字段查询问题，再做下一轮接口复测
