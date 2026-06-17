## 第一批低风险基础文件暂存报告

### 1. 本次允许暂存的文件

- `.gitignore`
- `README.md`
- `version.json`
- `backend/package.json`
- `backend/package-lock.json`
- `frontend-react/package.json`
- `frontend-react/package-lock.json`
- `backend/.env.example`
- `config/deploy.config.example.json`
- `tools/guaihub-export-config.sample.json`

### 2. 实际成功暂存的文件

本次实际已暂存：

- `.gitignore`
- `README.md`
- `version.json`
- `backend/package.json`
- `backend/package-lock.json`
- `frontend-react/package.json`
- `frontend-react/package-lock.json`
- `backend/.env.example`
- `config/deploy.config.example.json`
- `tools/guaihub-export-config.sample.json`

### 3. 哪些文件不存在

本次目标文件均存在，没有缺失文件。

### 4. `backend/.env` 是否存在

存在。

### 5. `backend/.env` 是否被忽略

是。

已确认 `backend/.env` 命中 `.gitignore`，本步骤没有修改它，也没有将它加入 staged。

### 6. `backend/.env.example` 是否已脱敏

是。

已将示例文件中的 API Key 值统一替换为占位符形式，未记录、未复制任何真实密钥内容。

### 7. `tools/guaihub-export-config.sample.json` 是否已脱敏

是。

已将 `token`、`uid` 等示例值统一替换为占位符形式，未记录、未复制任何真实凭证内容。

### 8. 是否暂存这两个示例文件

是。

在确认示例文件已脱敏后，已执行精确暂存：

- `backend/.env.example`
- `tools/guaihub-export-config.sample.json`

### 9. 是否发现需要用户手动迁移真实 key 的情况

没有。

因为 `backend/.env` 已存在，且被 Git 忽略，所以不存在“真实 key 可能只留在 `.env.example` 里”的阻塞情况。

### 10. staged 区域是否只包含允许文件

是。

经 `git diff --cached --name-only` 校验，当前 staged 区域只包含本次允许列表中的文件，没有混入其他文件。

### 11. 是否执行了 commit

没有。

本步骤只执行了精确 `git add`，没有执行 `git add .`，也没有执行 `git commit`。

### 12. 下一步建议暂存哪一组

建议下一步进入“后端源码组”，也就是：

- `backend/routes/`
- `backend/services/`
- `backend/middleware/`
- `backend/utils/`
- `backend/config/`
- `backend/server.js`
- 以及与本轮剧情线主链、卷级时间线、未来章节承接链路直接相关的后端正式源码

---

## 后端源码组暂存追加记录

### 13. 本次后端源码组候选范围

本轮检查的候选范围是：

- `backend/server.js`
- `backend/app.js`
- `backend/routes/`
- `backend/services/`
- `backend/middleware/`
- `backend/models/`
- `backend/utils/`
- `backend/lib/`
- `backend/config/`

同时明确排除：

- `backend/.env`
- `backend/database/`
- `backend/logs/`
- `backend/node_modules/`
- `backend/data/codex-turn-snapshots.json`
- 各类 `.log` / `.db` / `.sqlite*` 文件

### 14. 实际暂存的后端源码文件

本轮实际新增暂存的后端正式源码文件：

- `backend/config/novel-config.js`
- `backend/config/templates.js`
- `backend/middleware/validation.js`
- `backend/routes/config.js`
- `backend/routes/storylines.js`
- `backend/services/database.js`
- `backend/services/novel-config-service.js`
- `backend/services/outline-prompts.js`
- `backend/utils/logger.js`

### 15. 被排除的后端文件

以下后端文件本轮没有暂存：

- 所有数据库、日志、运行产物、真实配置文件
- `backend/server.js`
- `backend/routes/ai.js`
- `backend/routes/analysis.js`
- `backend/routes/auth.js`
- `backend/routes/data.js`
- `backend/routes/outlines.js`
- `backend/routes/plans.js`
- `backend/services/ai.js`
- `backend/services/deepseek.js`
- `backend/services/storyline-generation-service.js`
- `backend/middleware/auth.js`

其中前半部分是按规则必须排除；后半部分是因为命中了敏感模式扫描，先暂停暂存，等待后续单独确认。

### 16. 是否发现疑似敏感内容

发现了。

命中风险模式的后端源码路径如下：

- `backend/server.js`
- `backend/routes/ai.js`
- `backend/routes/analysis.js`
- `backend/routes/auth.js`
- `backend/routes/data.js`
- `backend/routes/outlines.js`
- `backend/routes/plans.js`
- `backend/services/ai.js`
- `backend/services/deepseek.js`
- `backend/services/storyline-generation-service.js`
- `backend/middleware/auth.js`

说明：

- 这里只记录“路径 + 风险模式命中”这一层，不展示任何具体值。
- 命中的模式包括：`token`、`api_key`、`Authorization`、`Bearer`、`password`、`secret` 等。

### 17. staged 区域是否仍干净

是。

经校验，当前 staged 区域只包含：

1. 已暂存的基础文件；
2. 已脱敏的示例配置文件；
3. 本轮未命中风险模式的后端正式源码文件。

没有混入：

- `backend/.env`
- 数据库
- 日志
- `node_modules`
- 快照
- 真实配置
- 测试导出文件

### 18. 是否执行了 commit

没有。

本轮没有执行 `git add .`，没有执行 `git add -A`，也没有执行 `git commit`。

---

## 后端风险命中文件复核追加记录

### 19. 本轮复核了哪些风险命中文件

本轮逐个复核了以下文件：

- `backend/server.js`
- `backend/routes/ai.js`
- `backend/routes/analysis.js`
- `backend/routes/auth.js`
- `backend/routes/data.js`
- `backend/routes/outlines.js`
- `backend/routes/plans.js`
- `backend/services/ai.js`
- `backend/services/deepseek.js`
- `backend/services/storyline-generation-service.js`
- `backend/middleware/auth.js`

### 20. 哪些文件确认只是正常代码

以上文件均确认属于正常业务代码命中敏感关键词，不属于硬编码真实凭据。

主要命中原因包括：

- `process.env` 读取环境变量
- `Authorization` 请求头字段名
- `Bearer` 前缀校验或模板字符串
- `token` / `maxTokens` / `promptTokens` 等业务变量名
- JWT 鉴权逻辑
- 调试脱敏函数中的正则表达式

### 21. 哪些文件已安全暂存

本轮确认安全并已精确暂存：

- `backend/server.js`
- `backend/routes/ai.js`
- `backend/routes/analysis.js`
- `backend/routes/auth.js`
- `backend/routes/data.js`
- `backend/routes/outlines.js`
- `backend/routes/plans.js`
- `backend/services/ai.js`
- `backend/services/deepseek.js`
- `backend/services/storyline-generation-service.js`
- `backend/middleware/auth.js`

### 22. 哪些文件仍被排除

本轮复核后，这批“风险命中文件”里没有继续阻塞的文件。

但后端范围内仍然继续排除：

- `backend/.env`
- `backend/database/`
- `backend/logs/`
- `backend/node_modules/`
- `backend/data/codex-turn-snapshots.json`
- 各类数据库、日志、运行产物
- 非本轮正式源码范围内的脚本和一次性工具文件

### 23. 是否发现真实敏感值

没有。

本轮未发现硬编码真实 API key、真实 token、真实 cookie、真实 password、真实 secret、真实 Authorization header 或真实 Bearer 长串。

### 24. 是否打印过敏感值

没有。

本轮只输出了“路径 + 风险类型 + 脱敏后的上下文判断”，没有打印任何真实敏感值。

### 25. staged 区域是否仍干净

是。

当前 staged 区域只包含：

1. 基础文件；
2. 已脱敏示例配置；
3. 已确认安全的后端正式源码。

未混入：

- `.env`
- 数据库
- 日志
- `node_modules`
- 构建产物
- 真实配置
- 测试导出文件

### 26. 是否执行了 commit

没有。

本轮没有执行 `git add .`、`git add -A` 或 `git commit`。

---

## 文档组暂存追加记录

### 27. 本轮文档组候选范围

本轮候选范围是 `docs/` 目录下的正式 Markdown 文档，即：

- `docs/*.md`

重点覆盖：

- 剧情线主链闭环相关文档
- 卷级时间线质量优化相关文档
- 未来章节承接链路相关文档
- 版本控制与暂存审计相关文档
- 架构索引文档
- 现有台账、路线图、设计说明、审计报告

### 28. 实际暂存了哪些文档

本轮已暂存 `docs/` 下全部 Markdown 文档，包括但不限于：

- `docs/storyline-main-loop-phase-acceptance-summary.md`
- `docs/volume-timeline-phase-acceptance-summary.md`
- `docs/future-chapter-plan-generation-audit.md`
- `docs/on-demand-chapter-plan-autocreate-report.md`
- `docs/future-chapter-draft-generation-test-report.md`
- `docs/future-chapter-feedback-writeback-test-report.md`
- `docs/future-chapter-acceptance-summary.md`
- `docs/version-control-change-intake-audit.md`
- `docs/gitignore-hardening-report.md`
- `docs/safe-staging-plan.md`
- `docs/first-stage-staging-report.md`
- `docs/novel-generation-architecture-index.md`

以及同目录下其他正式 `.md` 项目文档。

### 29. 哪些文档被排除

本轮没有在 `docs/*.md` 范围内额外排除的 Markdown 文档。

但以下内容不在本轮暂存范围内，继续排除或后置处理：

- `_project_review_for_chatgpt/`
- 导出包、审查包、快照包
- 数据库转储
- 日志文件
- `docs/changelog.json` 这类非 Markdown 文件

### 30. 哪些文档需要人工确认

当前没有新增需要人工确认的 Markdown 文档。

本轮扫描后判断，`docs/` 下现有 `.md` 文件都属于正式项目文档、阶段文档、规划文档或审计文档，可以纳入版本控制。

### 31. 是否发现疑似真实敏感值

没有。

本轮命中的敏感关键词主要来自：

- 安全规则说明
- 审计结论
- `maxTokens`、`promptTokens`、`completion_tokens` 等技术字段
- `Authorization` / `Bearer` / `token` / `api_key` 的制度性描述

未发现真实 API key、真实 token、真实 password、真实 cookie、真实 secret 或真实数据库密码。

### 32. staged 区域是否仍干净

是。

当前 staged 区域只包含：

1. 基础文件
2. 已脱敏示例配置
3. 已确认安全的后端源码
4. 本轮确认安全的正式 Markdown 文档

没有混入：

- `.env`
- 数据库
- 日志
- `node_modules`
- 构建产物
- 真实配置
- 临时审查包
- 导出包
- 快照包

### 33. 是否执行了 commit

没有。

本轮没有执行 `git add .`、`git add -A` 或 `git commit`。

---

## 前端源码组暂存追加记录

### 34. 本轮前端源码组候选范围

本轮优先检查并处理的候选范围是：

- `frontend-react/src/`
- `frontend-react/public/`
- `frontend-react/index.html`
- `frontend-react/vite.config.js`
- `frontend-react/tsconfig.json`
- `frontend-react/tsconfig.app.json`
- `frontend-react/tsconfig.node.json`
- `frontend-react/eslint.config.js`
- `frontend-react/postcss.config.js`
- `frontend-react/tailwind.config.js`

### 35. 实际暂存了哪些前端文件

本轮实际暂存：

- `frontend-react/src/App.jsx`
- `frontend-react/src/AppLayout.jsx`
- `frontend-react/src/app-shell.css`
- `frontend-react/src/main.jsx`
- `frontend-react/src/mockData.js`
- `frontend-react/src/styles.css`
- `frontend-react/src/styleTheme.js`
- `frontend-react/src/useWorkbenchData.js`
- `frontend-react/src/workbenchApi.js`
- `frontend-react/src/pages/BooksPage.jsx`
- `frontend-react/src/pages/ChangelogPage.jsx`
- `frontend-react/src/pages/GenerationLogicPage.jsx`
- `frontend-react/src/pages/StartGuidePage.jsx`
- `frontend-react/src/pages/StyleManagerPage.jsx`
- `frontend-react/src/pages/WorkbenchPage.jsx`
- `frontend-react/index.html`
- `frontend-react/vite.config.js`

说明：

- `frontend-react/package.json` 和 `frontend-react/package-lock.json` 之前已在 staged，本轮未重复处理。

### 36. 哪些前端文件或目录被排除

本轮未纳入的前端项：

- `frontend-react/public/`：不存在
- `frontend-react/tsconfig.json`：不存在
- `frontend-react/tsconfig.app.json`：不存在
- `frontend-react/tsconfig.node.json`：不存在
- `frontend-react/eslint.config.js`：不存在
- `frontend-react/postcss.config.js`：不存在
- `frontend-react/tailwind.config.js`：不存在

继续排除：

- `frontend-react/node_modules/`
- `frontend-react/dist/`
- `frontend-react/build/`
- `frontend-react/.vite/`
- `frontend-react/.cache/`
- 各类日志与临时输出

### 37. `frontend/` 是否需要人工确认

是。

已确认 `frontend/` 目录存在，并包含 `html/`、`css/`、`js/` 等静态结构以及多个 HTML 文件。当前更像旧版静态前端或独立原型目录。

因此本轮没有暂存 `frontend/`，建议保留为“需要人工确认”：

- 如果它仍是正式维护的前端源码，再单独成组处理；
- 如果它只是旧版页面或历史原型，可以继续后置，不混入当前首批提交。

### 38. 是否发现疑似真实敏感值

没有。

本轮命中的关键词主要来自：

- CSS / 主题里的 design token
- 前端本地登录 token 字段名
- `Authorization` header 组装逻辑
- 统计页里的 `totalTokens` / `tokenUsed` 文案
- 风险等级类名中包含 `sk-` 的样式命名

未发现真实 API key、真实 token、真实 password、真实 cookie、真实 secret 或真实带凭据地址。

### 39. staged 区域是否仍干净

是。

当前 staged 区域只包含：

1. 基础文件
2. 已脱敏示例配置
3. 已确认安全的后端源码
4. 已确认安全的文档
5. 本轮确认安全的 `frontend-react` 正式源码

没有混入：

- `.env`
- 数据库
- 日志
- `node_modules`
- `dist`
- `build`
- `.vite`
- `.cache`
- 真实配置
- 临时审查包
- 导出包
- 快照包

### 40. 是否执行了 commit

没有。

本轮没有执行 `git add .`、`git add -A` 或 `git commit`。
