# currentProgress.activeBeats 残留旧 beat 修复报告

更新时间：2026-06-17

## 1. bug 原因

此前章节反馈回写链路本身并没有完全失效：

- 本次 `usedBeatIds` 会正常写入
  - `storylines.structured_content.currentProgress.chapterProgress`
  - `storylines.structured_content.chapter_progress`
  - `storylines.structured_content.last_chapter_feedback`

但 `currentProgress.activeBeats` 的维护逻辑有一个一致性问题：

- 同一章节重跑后，即使 `chapterProgress` 已经替换成最新 beat；
- `activeBeats` 仍然会从旧数组继续做 union；
- 结果会残留同一章节上一次命中的旧 beat，例如：
  - 旧值：`["dev-8"]`
  - 新值：`["dev-7"]`
  - 实际会变成：`["dev-8", "dev-7"]`

这样会让测试和验收误以为 `currentProgress` 还是旧数据。

---

## 2. 修改了哪个文件

本次只修改了一个业务文件：

- [backend/services/database.js](C:/Users/turgidcat/Desktop/alipro-main/backend/services/database.js)

本次新增文档：

- [docs/current-progress-active-beats-bugfix-report.md](C:/Users/turgidcat/Desktop/alipro-main/docs/current-progress-active-beats-bugfix-report.md)

---

## 3. 是否修改数据库

没有。

本次：

- 没有改数据库结构
- 没有新增字段
- 没有写迁移

---

## 4. 修复前 activeBeats 为什么会残留旧 beat

修复前 `syncStorylineProgressFromChapterPlan(...)` 的核心逻辑是：

1. `chapter_progress` 会按 `chapter_number` 替换旧记录；
2. 但 `activeBeats` 不是从“最新有效 chapterProgress”重算；
3. 它是从旧 `activeBeats` 继续过滤再追加本次 `usedBeatIds`。

也就是说，之前更接近这种思路：

```js
activeBeats = oldActiveBeats - 本次相同 beat + 本次 usedBeatIds
```

问题在于：

- 它只会去掉“本次传入的同名 beat”
- 不会去掉“同一章节上一次留下的别的旧 beat”

所以同一章节从 `dev-8` 重跑成 `dev-7` 时：

- `chapter_progress` 会更新成 `dev-7`
- 但 `activeBeats` 还会把 `dev-8` 留下来

---

## 5. 修复后 activeBeats 如何计算

本次采用的是最小修复方案：

### 5.1 先替换同一章节旧记录

先根据：

- `chapterId`（如果有）
- 否则退回 `chapterNumber`

识别“是不是同一章节的旧进度记录”，然后先替换掉它。

### 5.2 再从有效 chapterProgress 重算 activeBeats

不再从旧 `activeBeats` 盲目累加，而是：

1. 先得到最新的 `nextProgress`
2. 再映射成 `currentProgress.chapterProgress`
3. 最后从这些有效的 `chapterProgress.usedBeatIds` 重新聚合 `activeBeats`

这样至少能保证：

- 同一章节旧记录里的 beat 不会继续残留
- `activeBeats` 与最新 `chapterProgress` 保持一致来源

---

## 6. 同一章节重跑时 chapterProgress 如何处理

现在同一章节重跑时：

- `structured_content.chapter_progress` 只保留该章节最新一条记录
- `currentProgress.chapterProgress` 也只保留该章节最新一条记录

匹配规则为：

1. 如果本次和旧记录都有 `chapterId`，优先按 `chapterId` 判断同章；
2. 否则按 `chapterNumber` 判断同章。

因此：

- 不会再因为同章节重跑而堆出多条旧记录
- `activeBeats` 也会随之基于最新记录重算

---

## 7. 是否影响 chapter_progress / last_chapter_feedback

没有破坏已有写入逻辑。

本次仍然保持：

- `structured_content.chapter_progress` 正常写入
- `structured_content.last_chapter_feedback` 正常写入

同时保持：

- `status: "touched"`
- `requiresReview` 沿用原逻辑
- 不自动标记 `completed`

---

## 8. 是否影响 storylineProgressUpdated

本次没有改 `storylineProgressUpdated` 的外部语义。

它当前仍然代表：

- 至少命中了一条可更新 storyline；
- 并走到了回写分支。

它**仍然不等于**“严格的持久化成功证明”，这一点本次没有扩大修改范围去调整。

---

## 9. 测试结果

本次做了三层验证。

### 9.1 语法检查

执行结果：

- `node -c backend/services/database.js`

结果：

- 通过

### 9.2 隔离回归测试：复现“同章 dev-8 → dev-7”

为了精确复现旧问题，使用 `sql.js` 临时内存数据库构造了一个最小样本：

- 初始状态：
  - `currentProgress.activeBeats = ["dev-8"]`
  - 当前章节旧记录命中 `dev-8`
- 再对同一章节写入新反馈：
  - `usedBeatIds = ["dev-7"]`

修复后结果：

- `activeBeats = ["dev-7"]`
- `currentProgress.chapterProgress` 只保留同章节最新一条记录
- `chapter_progress` 只保留同章节最新一条记录
- `last_chapter_feedback` 更新为最新记录
- `status` 仍为 `touched`
- 没有被伪装成 `completed`

这一步是本次最核心的回归验证，因为它直接命中了此前的 bug 场景。

### 9.3 真实后端烟雾验证

本次还做了真实后端验证：

- 安全重启了 3000 端口后端
- 新 PID：`57752`
- 新启动时间：`2026-06-17T00:09:50.931387+08:00`
- 3000 端口正常监听

并对 `chapter_feedback` 接口做了真实调用烟雾测试：

- 返回 `200`
- metadata 仍有：
  - `storylineProgressUpdated: true`
  - `requiresStorylineReview: false`

说明：

- 本次修改没有把反馈接口打坏
- 真实服务已加载最新代码

补充说明：

- 为了精确验证“同一章节换 beat 后不残留旧 beat”，主验证仍以隔离回归测试为准；
- 真实样本接口这次主要用于确认运行服务可正常加载并继续返回反馈 metadata。

---

## 10. 下一步是否建议再做完整闭环复测

建议。

原因很简单：

- 这次修的是闭环最后一环里的一个一致性问题；
- 现在最适合做的下一步，就是重新跑一遍完整主链，确认：
  - 剧情线生成
  - 卷级时间线 fallback 识别
  - 章节细纲命中
  - `storyline_context` 入库
  - 正文读取约束
  - 章节反馈回写
  - `currentProgress.activeBeats` 不再残留同章旧 beat

如果这轮完整复测通过，就可以比较有把握地把这条链路当成当前稳定基线。

---

## 一句话结论

这次修复的本质不是重做章节反馈回写，而是把：

> `activeBeats` 从“旧数组累加”改成“基于最新有效 chapterProgress 重算”

这样在同一章节重跑、命中 beat 变化时，旧 beat 不会继续挂在 `currentProgress.activeBeats` 里误导验收。
