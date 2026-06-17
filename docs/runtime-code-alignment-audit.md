# 运行后端与仓库代码一致性排查报告

更新时间：2026-06-16

## 1. 结论先说

这次排查结果不是单一原因，而是两类问题叠在一起：

1. **当前运行中的后端进程大概率没有加载今天后续修改过的最新代码。**
2. **仓库当前源码里也确实还残留至少一个真实 bug：`storylines.js` 仍在查询数据库中不存在的 `character_arc` 字段。**

所以，刚才测试里看到的异常，不能简单归因为“全是旧服务”，也不能简单归因为“源码全有问题”。

更准确地说：

- `character_arc` 报错：**源码当前就有问题**
- `buildVolumeTimelinePrompt is not a function`：**更像运行中的旧代码没重启**
- `storylineContext / metadata` 缺失：**也更像运行中的旧代码没重启**

---

## 2. 当前后端启动入口

### 2.1 package scripts

项目根目录没有单独的 `package.json`，后端脚本在：

- `backend/package.json`

当前 scripts：

```json
{
  "start": "node server.js",
  "dev": "nodemon server.js",
  "verify:batch": "node verify-batch-generation.js"
}
```

### 2.2 后端入口文件

后端入口是：

- `backend/server.js`

在源码中可见：

- `main: "server.js"`
- `backend/server.js` 内使用 `process.env.PORT || 3000`
- `app.listen(PORT, ...)`

### 2.3 当前监听端口

实测监听端口：

- 后端：`3000`
- 前端 Vite：`5173`

本次测试接口实际打到的是：

- `http://127.0.0.1:3000`

所以测试地址本身是对的，不是打错端口。

---

## 3. 当前运行进程排查

### 3.1 监听 3000 的进程

实测 `3000` 端口监听进程：

- PID：`47996`
- 进程名：`node`
- 启动时间：`2026/6/16 19:01:20`
- 命令行：`node.exe server.js`

这说明：

- 当前后端不是 `nodemon` 自动热更新模式
- 而是直接用 `node server.js` 跑起来的

这很关键，因为：

- **`node server.js` 启动后不会自动加载后续文件改动**
- 如果服务启动后又改了 `ai.js / storylines.js / deepseek.js / database.js`，运行进程仍然会保留旧内存版本

### 3.2 当前其他 Node 进程

另外还发现两个 Node 相关进程：

- PID：`39916`
  - 命令行：`npm run dev -- --host 127.0.0.1`
- PID：`37548`
  - 命令行：`vite --host 127.0.0.1`
  - 监听端口：`5173`

因此目前可确认：

- `39916/37548` 是前端开发链路
- `47996` 是后端服务

没有发现另一个同时监听 `3000` 的旧后端。

### 3.3 是否可能存在旧进程

从“端口占用”角度：

- 没有发现多个后端同时监听 `3000`

但从“代码版本”角度：

- **正在运行的 3000 后端，就是一个旧启动的进程**
- 它在 `19:01` 启动
- 而多个关键源码文件是在 `21:28` 到 `22:45` 之间才被修改

所以这里的“旧进程”不是“另一个陌生服务”，而是：

- **同一个项目、同一个端口、但没重启过的老进程**

---

## 4. 仓库源码当前状态

本次重点核对文件：

- `backend/routes/ai.js`
- `backend/routes/storylines.js`
- `backend/services/deepseek.js`
- `backend/services/storyline-generation-service.js`
- `backend/services/database.js`

### 4.1 `backend/routes/ai.js`

仓库当前代码明确显示：

#### `handleOutlineGeneration()`

当前源码会返回：

- `data.storylineContext`
- `data.persistedStorylineContext`

并且会尝试调用：

- `saveChapterStorylineContext(...)`

把 `storyline_context` 写入：

- `chapter_plans.structured_content.storyline_context`

#### `handleChapterContentGeneration()`

当前源码会返回 metadata：

- `storylineConstraintApplied`
- `usedStorylineIds`
- `usedBeatIds`
- `usedVolumeTimeline`
- `isFallback`

#### `handleChapterFeedbackGeneration()`

当前源码会返回 metadata：

- `storylineProgressUpdated`
- `requiresStorylineReview`

### 4.2 `backend/routes/storylines.js`

仓库当前代码中：

- 已经 `require('../services/storyline-generation-service')`
- 单条剧情线生成走 `storylineGenerationService.generateStorylineOutline(...)`
- 卷级时间线生成走 `storylineGenerationService.generateVolumeTimeline(...)`

也就是说：

- **仓库当前 `storylines.js` 表面上已经不是旧 deepseekService 调法了**

但是同一个文件里仍然存在一个真实问题：

```sql
SELECT id, name, personality, background, character_arc, notes, character_type
FROM novel_characters
WHERE book_id = ?
```

而当前数据库 `novel_characters` 表结构里没有 `character_arc` 字段。

这就是 `no such column: character_arc` 的直接来源。

### 4.3 `backend/services/storyline-generation-service.js`

仓库当前新服务已经存在，而且包含：

- `generateStorylineOutline(...)`
- `generateVolumeTimeline(...)`
- `parseStorylineOutlineResponse(...)`
- `parseVolumeTimelineResponse(...)`

也有内部的：

- `buildVolumeTimelinePrompt(context)`

所以按当前源码逻辑：

- 卷级时间线不应该再依赖 `deepseekService.buildVolumeTimelinePrompt`

### 4.4 `backend/services/deepseek.js`

当前 `deepseek.js` 主要提供：

- `generate(...)`
- `buildCreativePrompt(...)`

没有发现：

- `buildVolumeTimelinePrompt`
- `buildStorylineOutlinePrompt`
- `parseVolumeTimelineResponse`
- `parseStorylineOutlineResponse`

这意味着：

- 如果运行时报 `deepseekService.buildVolumeTimelinePrompt is not a function`
- 那必然是某条**实际运行的代码路径**还在走旧 deepseek 调法

---

## 5. `character_arc` 报错来源排查

### 5.1 来源文件

来源文件：

- `backend/routes/storylines.js`

### 5.2 具体 SQL

当前源码中 `loadStorylineGenerationContext(...)` 使用：

```sql
SELECT id, name, personality, background, character_arc, notes, character_type
FROM novel_characters
WHERE book_id = ?
ORDER BY id ASC
```

### 5.3 当前数据库 schema 是否有该字段

实查 `PRAGMA table_info(novel_characters)` 后，当前库字段包括：

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

**没有 `character_arc`。**

### 5.4 判断

这不是测试打错地址，也不是日志幻觉。

这是：

- **当前仓库源码就写死查询了不存在的列**

### 5.5 建议

本步骤不修，但建议后续修复优先级很高。

候选方向只有三类：

1. 删除这条 SQL 对 `character_arc` 的依赖，改用现有字段；
2. 从其他现有结构里取角色弧光信息；
3. 增加数据库迁移补这个字段。

从当前项目最小改动原则看，更合理的方向大概率是：

- **改代码适配现有字段，而不是为了旧假设强补数据库列**

---

## 6. `buildVolumeTimelinePrompt` 报错来源排查

### 6.1 仓库当前代码里是否还在调用旧方法

本次搜索结果显示：

- `backend/routes/storylines.js` 当前源码里**没有**直接调用 `deepseekService.buildVolumeTimelinePrompt`
- 当前源码里使用的是：
  - `storylineGenerationService.generateVolumeTimeline(...)`

### 6.2 新替代服务是否存在

存在：

- `backend/services/storyline-generation-service.js`

该文件中确实有：

- `buildVolumeTimelinePrompt(context)`（服务内部函数）
- `generateVolumeTimeline(context)`
- `parseVolumeTimelineResponse(raw, context)`

### 6.3 为什么运行时仍然报旧方法缺失

最可能原因不是“当前磁盘代码里还有这个调用”，而是：

- **运行中的后端进程仍然在使用旧内存代码**

证据链：

1. 当前后端进程启动于 `19:01`
2. `storylines.js` 修改时间是 `21:28`
3. `storyline-generation-service.js` 修改时间是 `21:29`
4. 运行时报错却仍指向旧 deepseek 方法缺失

这与“服务未重启”高度吻合。

### 6.4 另一种次级可能

次级可能是：

- 某个未被排查到的旧 route / 旧 helper 仍然保留旧调用

但本次对目标文件搜索后，至少在当前主路径源码里没看到这条旧调用。

因此第一判断仍然是：

- **运行服务没重启，实际跑的是旧版本逻辑**

---

## 7. 为什么 metadata 没有出现在运行结果里

这部分最能体现“源码”和“运行行为”不一致。

### 7.1 细纲接口缺 `storylineContext`

仓库当前 `ai.js` 明确会返回：

- `data.storylineContext`

但真实调用返回里没有。

### 7.2 正文接口缺剧情线 metadata

仓库当前 `ai.js` 明确会返回：

- `storylineConstraintApplied`
- `usedStorylineIds`
- `usedBeatIds`
- `usedVolumeTimeline`
- `isFallback`

但真实调用返回里没有。

### 7.3 反馈接口缺闭环 metadata

仓库当前 `ai.js` 明确会返回：

- `storylineProgressUpdated`
- `requiresStorylineReview`

但真实调用返回里没有。

### 7.4 最可能原因

最可能原因不是“测试打错接口”，因为：

- 本次确实打到了 `3000`
- `3000` 确实是这个项目的后端
- 日志里也确实记录了这些请求

因此 metadata 缺失最可能说明：

- **运行中的 `backend/routes/ai.js` 不是当前磁盘上这份最新版本**
- 更直白一点：**服务没重启，接口还是旧行为**

---

## 8. 仓库代码与运行结果对照

| 项目 | 仓库当前代码是否支持 | 运行结果是否体现 | 是否一致 | 判断 |
| ---- | ---------- | -------- | ---- | -- |
| 细纲返回 `storylineContext` | 是 | 否 | 否 | 当前运行实例大概率未加载最新 `ai.js` |
| 正文 metadata 返回 `storylineConstraintApplied` | 是 | 否 | 否 | 当前运行实例大概率未加载最新 `ai.js` |
| 反馈 metadata 返回 `storylineProgressUpdated` | 是 | 否 | 否 | 当前运行实例大概率未加载最新 `ai.js` |
| `storylines.js` 是否还调用旧方法 | 源码主路径看是否 | 运行报错体现是 | 否 | 运行实例大概率仍在执行旧逻辑 |
| 单条剧情线生成是否会查询 `character_arc` | 是 | 是 | 是 | 这是当前源码真实 bug，不是仅运行旧代码 |

---

## 9. 当前测试接口目标端口是否正确

这次测试目标端口是：

- `http://127.0.0.1:3000`

核对结果：

- `3000` 确实是本项目后端在监听
- `5173` 是前端 Vite

所以：

- **测试地址没有打错**

---

## 10. 下一步建议

### 情况 A：后端没重启

当前排查结果非常符合这个情况。

建议：

1. 先不要改业务逻辑；
2. 先安全重启当前后端；
3. 重启后只复测下面三件事：
   - 细纲接口是否出现 `storylineContext`
   - 正文接口是否出现剧情线 metadata
   - 反馈接口是否出现闭环 metadata

可用的安全重启建议：

```powershell
cd backend
npm run dev
```

如果你仍想用非热更新方式，也可以：

```powershell
cd backend
npm start
```

但如果继续用 `npm start`，后续再次改代码后仍需要手动重启。

> 注意：本步骤我没有自动重启，也没有杀进程。

### 情况 B：测试打错服务/端口

本次排查结果不支持这个判断。

因为：

- `3000` 上确实是本项目后端
- 日志里也记录到了本次请求

### 情况 C：源码仍有 bug

这个情况也成立。

当前已确认的源码真实 bug：

#### 优先级 1

- `backend/routes/storylines.js`
  - 查询了数据库中不存在的 `character_arc`

#### 优先级 2

- 重启后若卷级时间线仍报旧 deepseek 方法缺失
  - 需要进一步修真实 route 仍残留旧调用的问题

### 情况 D：数据库 schema 不一致

目前更准确的判断是：

- **代码查询了不存在字段**

而不是已经确认“数据库缺迁移必须补列”。

原因：

- 当前 `novel_characters` 表本来就有一套现成字段
- 看起来是代码沿用了旧假设

所以在没有更多架构证据前，不建议先默认“必须加 migration 补 `character_arc`”

### 情况 E：旧方法仍未替换

当前主路径源码里没有看到 `deepseekService.buildVolumeTimelinePrompt(...)`

因此如果重启后仍报这个错，下一步就要查：

- 是否有未覆盖到的旧 helper
- 是否有其他 route 入口加载了不同版本文件
- 是否有旧打包/旧副本文件被实际运行

---

## 11. 最建议的执行顺序

如果只按最小风险顺序走，我建议：

1. **先重启当前后端服务**
2. **先复测 metadata 是否恢复**
3. **再看卷级时间线旧方法报错是否消失**
4. **如果以上问题消失，再单独修 `character_arc`**

原因：

- 重启可以先排除“旧服务内存代码”这个干扰项
- `character_arc` 是当前源码真实 bug，重启后大概率仍会复现
- 但 metadata 缺失和旧方法报错，很可能重启后就能立刻缩小范围

---

## 12. 最终判断

### 是否确认运行的是旧服务

**基本可以确认：运行的是“未重启的旧进程版本”。**

不是说它来自别的项目，而是：

- 它是这个项目的后端
- 但不是今天最新修改后的内存版本

### 是否确认测试打到了正确端口

**确认打到了正确端口：`3000`。**

### `character_arc` 报错来源

来自：

- `backend/routes/storylines.js`
- `loadStorylineGenerationContext(...)`
- 查询 `novel_characters` 时访问了不存在的 `character_arc`

### `buildVolumeTimelinePrompt` 报错来源

最可能来自：

- **运行中的旧后端代码仍在调用旧 deepseekService 方法**

不是当前主路径源码直接这样写的。

### metadata 缺失最可能原因

最可能原因是：

- **后端服务没有重启，运行中的 `ai.js` 不是当前磁盘最新版本**
