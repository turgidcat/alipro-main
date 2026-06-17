# 后端安全重启与最小复测报告

更新时间：2026-06-16

## 1. 本次操作范围

本次只做了两件事：

1. 安全停止旧后端进程并重启当前项目后端；
2. 对 `ai.js` 相关的三个接口做最小复测。

本次未做：

- 未修改业务代码
- 未修 `character_arc`
- 未修剧情线生成
- 未修卷级时间线
- 未改数据库
- 未改前端
- 未改 Prompt

---

## 2. 旧进程确认结果

已确认旧进程 PID `47996` 符合以下条件：

- 占用 `3000` 端口
- 命令行为：`node server.js`
- 当前工作区中真正的后端入口只有：
  - `backend/server.js`

结合上一步排查结论：

- 该进程启动时间早于多个关键源码文件的修改时间
- 它不是 `nodemon`
- 因此可以确认它是“未重启、未加载后续修改”的旧后端进程

结论：

- **已确认 PID `47996` 是旧后端进程**

---

## 3. 是否已停止旧进程

已执行停止操作。

停止后检查结果：

- `3000` 端口已释放
- 未发现旧进程继续占用 `3000`

结论：

- **已停止旧进程**

---

## 4. 新后端启动信息

### 4.1 启动命令

本次沿用项目当前后端原入口方式启动：

```bash
node server.js
```

启动目录：

- `C:/Users/turgidcat/Desktop/alipro-main/backend`

### 4.2 新 PID

新后端 PID：

- `37476`

### 4.3 新启动时间

新启动时间：

- `2026/6/16 23:07:47`

### 4.4 3000 端口状态

复查结果：

- `3000` 端口已正常监听
- `/health` 返回成功：

```json
{"success":true,"message":"服务运行正常"}
```

结论：

- **后端已成功重启**
- **3000 端口正常**

---

## 5. 最小复测结果

本次只复测以下三项：

1. 章节细纲生成
2. 正文生成
3. 章节反馈生成

测试样本：

- `bookId`: `b8bd76b6-170f-4666-9233-36e86b1f8b1d`
- `bookTitle`: `破雾修真录`
- `chapterNumber`: `8`
- `chapterTitle`: `炼房藏锋`

---

## 6. 章节细纲复测

调用：

- `POST /api/generate`
- `promptType: "outline"`

### 6.1 实际结果

返回 `200`，并且 `data` 中实际出现：

- `content`
- `usage`
- `storylineContext`
- `persistedStorylineContext`

### 6.2 `storylineContext` 是否出现

**已出现。**

### 6.3 `storylineContext` 结构实测包含

- `usedStorylineIds`
- `usedBeatIds`
- `usedVolumeTimeline`
- `isFallback`
- `relatedStorylines`
- `currentBeats`
- `mustAdvance`
- `mustNotHappen`
- `foreshadowingToPlant`
- `foreshadowingToPayoff`
- `characterChangeBoundaries`
- `conflictEscalation`
- `timelineSlot`
- `source`

### 6.4 是否写入成功

返回中：

- `persistedStorylineContext: true`

说明当前运行实例已经执行到了新的持久化路径。

结论：

- **章节细纲接口已表现为最新代码**

---

## 7. 正文生成复测

调用：

- `POST /api/generate`

### 7.1 实际结果

返回 `200`，并且 `data` 中实际出现：

- `content`
- `usage`
- `metadata`

### 7.2 正文 metadata 是否出现剧情线字段

**已出现。**

实测 `metadata` 包含：

- `model`
- `timestamp`
- `targetWordCount`
- `actualLength`
- `storylineConstraintApplied`
- `usedStorylineIds`
- `usedBeatIds`
- `usedVolumeTimeline`
- `isFallback`
- `continuityAudit`
- `context`

### 7.3 重点结论

你要求检查的字段全部出现：

- `storylineConstraintApplied`
- `usedStorylineIds`
- `usedBeatIds`
- `usedVolumeTimeline`
- `isFallback`

结论：

- **正文接口已表现为最新代码**

---

## 8. 章节反馈复测

调用：

- `POST /api/generate`
- `promptType: "chapter_feedback"`

### 8.1 实际结果

返回 `200`，并且 `data` 中实际出现：

- `feedback`
- `metadata`

### 8.2 反馈 metadata 是否出现闭环字段

**已出现。**

实测 `metadata` 包含：

- `storylineProgressUpdated`
- `requiresStorylineReview`

### 8.3 重点结论

你要求检查的字段全部出现：

- `storylineProgressUpdated`
- `requiresStorylineReview`

结论：

- **章节反馈接口已表现为最新代码**

---

## 9. 是否仍然表现得像旧代码

重启前：

- 细纲没有 `storylineContext`
- 正文没有剧情线 metadata
- 反馈没有闭环 metadata

重启后：

- 三者全部出现

因此当前判断非常明确：

- **重启后，`ai.js` 相关接口已经不再表现得像旧代码**
- **刚才 metadata 缺失的核心原因，确实是旧后端进程没有重启**

---

## 10. 当前还未处理的问题

本次没有复测：

- 单条剧情线生成
- 卷级时间线生成

原因是按本步骤要求，先不碰：

- `character_arc` 残留 bug
- 剧情线生成逻辑
- 卷级时间线逻辑

所以当前仍保留的已知问题是：

- `backend/routes/storylines.js` 查询了不存在的 `character_arc`

---

## 11. 下一步建议

当前最小复测已经证明：

- 后端确实成功加载了最新 `ai.js`
- metadata 缺失问题已经解决

因此下一步最合理的是：

- **进入 `character_arc` bug 修复**

原因：

1. 现在“旧进程干扰项”已经排除；
2. `ai.js` 链路已确认是最新代码；
3. 下一步最明显的真实阻塞项，就是 `storylines.js` 对 `character_arc` 的错误查询。

---

## 12. 本次结论摘要

1. 是否确认 PID `47996` 是旧后端进程：
   - 是
2. 是否已停止旧进程：
   - 是
3. 新后端启动命令：
   - `node server.js`
4. 新 PID：
   - `37476`
5. 新启动时间：
   - `2026/6/16 23:07:47`
6. 3000 端口是否正常：
   - 正常
7. 章节细纲是否返回 `storylineContext`：
   - 是
8. 正文是否返回剧情线 metadata：
   - 是
9. 章节反馈是否返回闭环 metadata：
   - 是
10. 是否仍表现得像旧代码：
   - 否
11. 下一步是否应该修 `character_arc`：
   - 是，建议作为下一步优先修复项
