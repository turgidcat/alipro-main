## 安全暂存清单

当前仓库仍然没有首个提交，`git ls-files = 0`，所以现在依然不适合直接执行 `git add .`。原因很简单：未跟踪文件范围过大，里面同时混有正式源码、阶段文档、示例配置、临时脚本，以及必须排除的敏感配置和运行产物。

| 分类 | 文件/目录 | 建议动作 | 风险 | 备注 |
| -- | -- | -- | -- | -- |
| 建议纳入版本控制 | `.gitignore` | 第一批优先暂存 | 低 | 先固定忽略边界，后续分组更安全 |
| 建议纳入版本控制 | `README.md` | 第一批优先暂存 | 低 | 仓库基础说明文件 |
| 建议纳入版本控制 | `version.json` | 第一批优先暂存 | 低 | 项目基础元数据 |
| 建议纳入版本控制 | `backend/package.json` | 第一批优先暂存 | 低 | 后端依赖声明 |
| 建议纳入版本控制 | `backend/package-lock.json` | 第一批优先暂存 | 低 | 后端锁文件 |
| 建议纳入版本控制 | `frontend-react/package.json` | 第一批优先暂存 | 低 | React 前端依赖声明 |
| 建议纳入版本控制 | `frontend-react/package-lock.json` | 第一批优先暂存 | 低 | React 前端锁文件 |
| 建议纳入版本控制 | `backend/.env.example` | 第一批优先暂存 | 低 | 示例环境变量，已确认未被误忽略 |
| 建议纳入版本控制 | `config/deploy.config.example.json` | 第一批优先暂存 | 低 | 示例部署配置，可提交 |
| 建议纳入版本控制 | `tools/guaihub-export-config.sample.json` | 第一批优先暂存 | 低 | 示例工具配置，可提交 |
| 建议纳入版本控制 | `backend/routes/` | 第二批按模块暂存 | 中 | 正式后端路由源码，含剧情线与未来章节链路改动 |
| 建议纳入版本控制 | `backend/services/` | 第二批按模块暂存 | 中 | 正式后端服务源码，含时间线与剧情线主链改动 |
| 建议纳入版本控制 | `backend/middleware/`、`backend/utils/`、`backend/config/` | 第二批按模块暂存 | 中 | 正式后端支撑代码 |
| 建议纳入版本控制 | `backend/server.js`、`backend/README.md`、`backend/database/init.js`、`backend/database/migrate.js`、`backend/data/templates.json` | 第二批按模块暂存 | 中 | 归属后端正式工程文件 |
| 建议纳入版本控制 | `frontend-react/src/`、`frontend-react/index.html`、`frontend-react/vite.config.js`、`frontend-react/README.md` | 后续单独成组暂存 | 中 | 正式 React 前端源码 |
| 建议纳入版本控制 | `docs/` | 后续单独成组暂存 | 低 | 阶段验收、审计、修复报告 |
| 建议纳入版本控制 | `scripts/` 中正式脚本 | 人工确认后分组暂存 | 中 | 需先区分正式脚本和临时工具 |
| 建议纳入版本控制 | `tools/` 中非敏感正式工具 | 人工确认后分组暂存 | 中 | 需排除临时修复脚本和真实配置 |
| 必须排除 | `backend/.env` | 保持忽略，绝不暂存 | 高 | 真实环境配置 |
| 必须排除 | `config/deploy.config.json` | 保持忽略，绝不暂存 | 高 | 真实部署配置 |
| 必须排除 | `tools/guaihub-export-config.json` | 保持忽略，绝不暂存 | 高 | 真实工具配置 |
| 必须排除 | `backend/database/novel.db` | 保持忽略，绝不暂存 | 高 | 真实数据库文件 |
| 必须排除 | `*.db`、`*.sqlite`、`*.sqlite3` | 保持忽略，绝不暂存 | 高 | 数据文件不应入库 |
| 必须排除 | `backend/logs/`、`*.log` | 保持忽略，绝不暂存 | 中 | 运行日志 |
| 必须排除 | `backend/node_modules/`、`frontend-react/node_modules/` | 保持忽略，绝不暂存 | 中 | 依赖目录 |
| 必须排除 | `dist/`、`build/`、`.vite/`、`.cache/`、`frontend-react/dist/` | 保持忽略，绝不暂存 | 中 | 构建产物与缓存 |
| 必须排除 | `_project_review_for_chatgpt/`、`guaihub-export-test/`、`backups/` | 保持忽略，绝不暂存 | 中 | 审查包、测试导出、备份目录 |
| 必须排除 | `backend/data/codex-turn-snapshots.json` | 保持忽略，绝不暂存 | 中 | 本地快照产物 |
| 需要人工确认 | `frontend/` | 先确认是否仍为正式前端，再决定是否暂存 | 中 | 当前同时存在 `frontend/` 与 `frontend-react/`，需判断是否双轨保留 |
| 需要人工确认 | `guaihub-chunk-6076.js`、`guaihub-index.js` | 先确认用途，再决定是否暂存 | 中 | 看起来像独立打包脚本或导出产物，不宜直接收进首提 |
| 需要人工确认 | `restart-alipro-dev.cmd` | 先确认是否为正式开发脚本 | 低 | 如果是团队常用启动脚本可纳入，否则可后置 |
| 需要人工确认 | `CODEX_CREATE_PROJECT_REVIEW_PACK.md` | 先确认是否属于正式仓库文档 | 低 | 可能是流程说明，也可能是一次性产物 |
| 需要人工确认 | `scripts/win-sshpass.exe` | 默认先不暂存，需人工确认 | 高 | 可执行文件，需确认来源、许可、是否确有必要 |
| 需要人工确认 | `backend/create-admin-final.js`、`backend/reseed-demo-book-characters.js`、`backend/verify-batch-generation.js` | 先确认是否长期维护脚本 | 中 | 可能是正式运维/验证脚本，也可能是阶段性工具 |
| 需要人工确认 | `tools/fix-powu-chapter5-plan.js`、`tools/repair-chapter7-plan.js`、`tools/repair-chapter7-record.js`、`tools/restore-powu-chapter6.js`、`tools/sync-powu-mainline-and-chapter5.js` | 默认后置，先确认是否保留 | 中 | 名称更像一次性修复工具 |
| 需要人工确认 | `docs/` 中旧规划类文档 | 可提交，但可考虑晚于核心验收文档 | 低 | 如果想让首提更干净，可以先收核心文档，再收历史规划文档 |

## 结论

### 1. 当前仍不适合 `git add .`

是，仍然不适合。现在的仓库状态更像“刚初始化完，但还没做首个提交”的工作目录，未跟踪内容太多，直接全量暂存很容易把不该进版本库的东西一起带进去。

### 2. 第一批建议先暂存什么

最稳的一批是仓库基础文件和示例配置：

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

这一批像先把“房子的门牌、房规和样板间”放好，风险最低，也最方便后面继续按模块收口。

### 3. 必须排除的内容

以下内容必须继续排除，不建议进入任何暂存批次：

- 真实 `.env`
- 真实部署配置
- 真实工具配置
- 数据库文件
- 日志
- `node_modules`
- 构建产物
- 审查包 / 测试导出目录 / 备份目录
- 本地运行快照文件

### 4. 需要人工确认的内容

当前最需要你人工拍板的几类是：

- `frontend/` 是否仍是正式前端，还是已经被 `frontend-react/` 取代
- 根目录几个零散 JS / CMD / MD 文件是否属于正式仓库资产
- `scripts/` 和 `tools/` 里的修复脚本，到底是长期保留还是阶段性临时工具
- `scripts/win-sshpass.exe` 这种可执行文件是否真的要进仓库

### 5. 是否发现新的敏感风险

这一步没有看到新的敏感配置泄漏迹象；前面确认过的敏感文件和数据库文件仍然在忽略规则内。不过，因为仓库还没有首提，后续每一批暂存前仍建议继续小步核对，不要一次性全收。

### 6. 建议的分组暂存 / 提交顺序

建议后续按下面顺序人工分组：

1. 仓库基础与忽略规则
   包含：`.gitignore`、`README.md`、`version.json`、示例配置文件

2. 后端剧情线主链闭环源码
   包含：`backend/routes/storylines.js`、`backend/services/database.js` 及相关后端正式源码

3. 卷级时间线生成质量源码
   包含：`backend/services/storyline-generation-service.js`、`backend/services/outline-prompts.js`

4. 未来章节承接链路源码
   包含：`backend/routes/ai.js` 及必要配套后端文件

5. 文档与阶段验收报告
   包含：`docs/` 下本轮验收、审计、修复、收口文档，以及 `docs/novel-generation-architecture-index.md`

6. 前端源码
   包含：`frontend-react/**`，以及确认后是否纳入 `frontend/**`

7. 工具脚本与示例配置
   包含：确认保留的 `scripts/**`、`tools/**`、`config/*.example.json`

### 7. 下一步是否可以进入“按清单分组暂存”

可以，但前提是先按这份清单做人眼审核，尤其把“需要人工确认”的几类先定下来。最稳的下一步，不是全量暂存，而是从“仓库基础与忽略规则”这一组开始，小批量分组推进。
