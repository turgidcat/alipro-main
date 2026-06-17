## 工具脚本与零散资产审计

| 文件/目录 | 分类 | 建议动作 | 风险等级 | 备注 |
| ----- | -- | ---- | ---- | -- |
| `backend/README.md` | A. 建议纳入版本控制 | 后续单独暂存 | 低 | 正式后端说明文档；命中的 `API_KEY` / `Token` / `JWT_SECRET` 是说明文字和占位示例 |
| `backend/verify-batch-generation.js` | A. 建议纳入版本控制 | 后续单独暂存 | 低 | 正式验证脚本；通过环境变量读取参数，适合保留 |
| `backend/database/init.js` | A. 建议纳入版本控制 | 后续单独暂存 | 中 | 正式数据库初始化脚本；当前和 `novel.db` 同目录，建议分文件纳入而不是整目录纳入 |
| `backend/database/migrate.js` | A. 建议纳入版本控制 | 后续单独暂存 | 中 | 正式数据库迁移脚本；应和数据库文件分开处理 |
| `backend/data/templates.json` | A. 建议纳入版本控制 | 后续单独暂存 | 低 | 正式模板数据文件；当前与快照文件同目录，建议分文件纳入 |
| `scripts/auto-bump-version.js` | A. 建议纳入版本控制 | 后续单独暂存 | 低 | 正式版本管理脚本 |
| `scripts/bump-version.js` | A. 建议纳入版本控制 | 后续单独暂存 | 低 | 正式版本号更新脚本 |
| `scripts/ensure-daily-changelog.js` | A. 建议纳入版本控制 | 后续单独暂存 | 低 | 正式日志维护脚本 |
| `scripts/restart-alipro-dev.ps1` | A. 建议纳入版本控制 | 后续单独暂存 | 低 | 本地开发重启脚本，未见敏感值 |
| `scripts/restart-backend.ps1` | A. 建议纳入版本控制 | 后续单独暂存 | 低 | 本地后端重启脚本，未见敏感值 |
| `scripts/seed-demo-storylines.js` | A. 建议纳入版本控制 | 后续单独暂存 | 低 | 演示数据初始化脚本，适合保留 |
| `scripts/reseed-demo-book.js` | A. 建议纳入版本控制 | 后续单独暂存 | 低 | 演示书重建脚本，未见真实凭据 |
| `scripts/reseed-demo-book-characters.js` | A. 建议纳入版本控制 | 后续单独暂存 | 低 | 演示角色重置脚本，`uid` 命中只是普通字段名 |
| `scripts/verify-style-manager-contracts.mjs` | A. 建议纳入版本控制 | 后续单独暂存 | 低 | 前端约束校验脚本，明显是正式验证工具 |
| `scripts/nginx-https.conf` | C. 需要人工确认 | 先确认是否是正式部署样板 | 中 | 配置文件本身可入库，但是否仍适用于当前项目需要你拍板 |
| `restart-alipro-dev.cmd` | A. 建议纳入版本控制 | 后续单独暂存 | 低 | 只是 PowerShell 重启脚本的包装入口，适合保留 |
| `docs/changelog.json` | A. 建议纳入版本控制 | 后续单独暂存 | 低 | 版本日志数据文件；命中 `sk-` / `uid` 来自展示文本，不是凭据 |
| `tools/guaihub-export-config.sample.json` | A. 已纳入版本控制 | 无需处理 | 低 | 已脱敏 sample，可继续保留 |
| `tools/export-guaihub-data.ps1` | C. 需要人工确认 | 先确认是否要长期维护 | 中 | 可复用导出脚本，但用途偏本地运维工具，不一定适合首批正式源码 |
| `tools/export-guaihub-latest.ps1` | C. 需要人工确认 | 先确认是否要长期维护 | 中 | 依赖本地配置文件，偏本地导出工具 |
| `tools/register-guaihub-export-task.ps1` | C. 需要人工确认 | 先确认是否要长期维护 | 中 | 计划任务注册器，偏本机自动化工具 |
| `tools/update-codex-turn-snapshot.ps1` | B. 建议不纳入版本控制 | 继续忽略或后置 | 中 | 明显服务于本地快照文件 `backend/data/codex-turn-snapshots.json` |
| `tools/fix-powu-chapter5-plan.js` | B. 建议不纳入版本控制 | 不建议入库 | 中 | 一次性修复脚本，强绑定特定书和章节 |
| `tools/repair-chapter7-plan.js` | B. 建议不纳入版本控制 | 不建议入库 | 中 | 一次性修复脚本 |
| `tools/repair-chapter7-record.js` | B. 建议不纳入版本控制 | 不建议入库 | 中 | 一次性修复脚本 |
| `tools/restore-powu-chapter6.js` | B. 建议不纳入版本控制 | 不建议入库 | 中 | 一次性恢复脚本，强绑定具体章节内容 |
| `tools/sync-powu-mainline-and-chapter5.js` | B. 建议不纳入版本控制 | 不建议入库 | 中 | 一次性同步脚本，强绑定具体书与章节 |
| `tools/run-guaihub-export-hidden.vbs` | C. 需要人工确认 | 先确认是否保留 | 中 | 本地运行包装脚本，属于辅助自动化，不一定值得入库 |
| `backend/create-admin-final.js` | D. 阻塞风险 | 不要直接入库 | 高 | 发现默认管理员创建逻辑，并含硬编码默认密码语义 |
| `scripts/deploy-frontend.bat` | D. 阻塞风险 | 不要入库，必要时先改造成无密版 | 高 | 含硬编码部署密码、主机和本机绝对路径 |
| `tools/guaihub-export-config.json` | D. 阻塞风险 | 继续忽略，绝不入库 | 高 | 本地真实导出配置；包含 `token` / `uid` |
| `scripts/win-sshpass.exe` | D. 阻塞风险 | 建议排除 | 高 | 二进制可执行文件；不建议直接入库，优先改为“用户自行安装”说明 |
| `tools/guaihub-export-config.json` | D. 阻塞风险 | 继续忽略，绝不入库 | 高 | 本地真实配置，已在 `.gitignore` 中 |
| `CODEX_CREATE_PROJECT_REVIEW_PACK.md` | C. 需要人工确认 | 先确认是否保留为正式流程文档 | 中 | 内容是“如何生成审查快照包”的任务说明，可能是流程文档，也可能是一次性说明 |
| `guaihub-chunk-6076.js` | B. 建议不纳入版本控制 | 不建议入库 | 高 | 大型打包产物/抓取资产，不像项目源码 |
| `guaihub-index.js` | B. 建议不纳入版本控制 | 不建议入库 | 高 | 大型打包产物/抓取资产，不像项目源码 |
| `frontend/` | C. 需要人工确认 | 先单独确认用途 | 中 | 旧版静态前端或原型目录的可能性高，不适合现在直接入库 |
| `backend/start.bat` | C. 需要人工确认 | 先确认是否仍是正式启动入口 | 低 | 本地启动器，可保留，也可能被 `scripts/restart-*.ps1` 取代 |
| `backend/reseed-demo-book-characters.js` | C. 需要人工确认 | 看是否与 `scripts/` 下同类脚本重复 | 低 | 作用像演示数据脚本，但和 `scripts/` 下版本存在重复感 |
| `backend/data/codex-turn-snapshots.json` | B. 建议不纳入版本控制 | 继续忽略 | 中 | 本地快照产物 |
| `backend/data/` | C. 需要人工确认 | 分文件处理 | 中 | 目录本身不应整体入库；其中 `templates.json` 值得保留，`codex-turn-snapshots.json` 应继续忽略 |
| `backend/database/novel.db` | B. 建议不纳入版本控制 | 继续忽略 | 高 | 真实数据库文件 |
| `backend/database/` | C. 需要人工确认 | 分文件处理 | 中 | 目录里既有正式脚本，也有真实数据库文件；不能整目录纳入 |

## 总结

### 1. 哪些工具脚本建议纳入版本控制

优先建议纳入的正式工具/辅助资产：

- `backend/README.md`
- `backend/verify-batch-generation.js`
- `backend/database/init.js`
- `backend/database/migrate.js`
- `backend/data/templates.json`
- `docs/changelog.json`
- `restart-alipro-dev.cmd`
- `scripts/auto-bump-version.js`
- `scripts/bump-version.js`
- `scripts/ensure-daily-changelog.js`
- `scripts/restart-alipro-dev.ps1`
- `scripts/restart-backend.ps1`
- `scripts/seed-demo-storylines.js`
- `scripts/reseed-demo-book.js`
- `scripts/reseed-demo-book-characters.js`
- `scripts/verify-style-manager-contracts.mjs`

### 2. 哪些工具脚本建议排除

建议排除或继续忽略的内容：

- `tools/update-codex-turn-snapshot.ps1`
- `tools/fix-powu-chapter5-plan.js`
- `tools/repair-chapter7-plan.js`
- `tools/repair-chapter7-record.js`
- `tools/restore-powu-chapter6.js`
- `tools/sync-powu-mainline-and-chapter5.js`
- `guaihub-chunk-6076.js`
- `guaihub-index.js`
- `backend/data/codex-turn-snapshots.json`
- `backend/database/novel.db`

这些要么是一次性修复脚本，要么是本地产物，要么是明显的大型导出/打包资产。

### 3. 哪些文件需要用户人工确认

建议你拍板后再决定的内容：

- `frontend/`
- `CODEX_CREATE_PROJECT_REVIEW_PACK.md`
- `scripts/nginx-https.conf`
- `backend/start.bat`
- `backend/reseed-demo-book-characters.js`
- `tools/export-guaihub-data.ps1`
- `tools/export-guaihub-latest.ps1`
- `tools/register-guaihub-export-task.ps1`
- `tools/run-guaihub-export-hidden.vbs`
- `backend/data/`（按文件拆分）
- `backend/database/`（按文件拆分）

### 4. 是否发现真实敏感值风险

发现了阻塞风险：

- `tools/guaihub-export-config.json`：真实导出配置风险
- `scripts/deploy-frontend.bat`：硬编码部署密码和主机风险
- `backend/create-admin-final.js`：默认管理员创建 + 默认密码语义风险

说明：

- 本次没有打印任何真实值；
- 这里只记录路径和风险性质。

### 5. 是否发现二进制文件

发现了两个二进制/可执行类文件：

- `scripts/win-sshpass.exe`
- `tools/run-guaihub-export-hidden.vbs`（脚本型可执行包装）

其中 `scripts/win-sshpass.exe` 风险最高，不建议直接入库。

### 6. 是否需要补充 `.gitignore`

需要，而且本轮已经完成补强。

本轮新增或确认了这些规则：

- `backend/create-admin-final.js`
- `scripts/deploy-frontend.bat`
- `scripts/win-sshpass.exe`
- `guaihub-chunk-*.js`
- `guaihub-index.js`
- `tools/guaihub-export-config.json`
- `tools/run-guaihub-export-hidden.vbs`
- `backend/data/codex-turn-snapshots.json`
- `_project_review_for_chatgpt/`
- `backend/database/novel.db`
- `*.db`
- `*.sqlite`
- `*.sqlite3`

验证结果：

- 已确认被 `.gitignore` 覆盖：
  - `backend/create-admin-final.js`
  - `scripts/deploy-frontend.bat`
  - `scripts/win-sshpass.exe`
  - `guaihub-chunk-6076.js`
  - `guaihub-index.js`
  - `tools/guaihub-export-config.json`
  - `tools/run-guaihub-export-hidden.vbs`
  - `backend/data/codex-turn-snapshots.json`
  - `backend/database/novel.db`
- 已确认未被误伤、仍可候选入库：
  - `backend/database/init.js`
  - `backend/database/migrate.js`
  - `backend/data/templates.json`

### 7. 是否建议下一步暂存一小组“确认安全的工具脚本”

建议。

可以先拆一小组“低风险正式工具”：

- `backend/README.md`
- `backend/verify-batch-generation.js`
- `backend/database/init.js`
- `backend/database/migrate.js`
- `backend/data/templates.json`
- `docs/changelog.json`
- `restart-alipro-dev.cmd`
- `scripts/auto-bump-version.js`
- `scripts/bump-version.js`
- `scripts/ensure-daily-changelog.js`
- `scripts/restart-alipro-dev.ps1`
- `scripts/restart-backend.ps1`
- `scripts/seed-demo-storylines.js`
- `scripts/reseed-demo-book.js`
- `scripts/reseed-demo-book-characters.js`
- `scripts/verify-style-manager-contracts.mjs`

### 8. 哪些内容应继续留到后续处理

后续继续单独处理的内容：

- `frontend/`
- GuaiHub 相关本地导出工具是否要长期维护
- 一次性修复脚本全集
- 阻塞风险项：
  - `backend/create-admin-final.js`
  - `scripts/deploy-frontend.bat`
  - `tools/guaihub-export-config.json`
  - `scripts/win-sshpass.exe`

---

## 本轮 `.gitignore` 加固追加记录

### 9. 本轮补充了哪些 `.gitignore` 规则

本轮为 loose assets 风险边界补充了以下忽略规则：

- `backend/create-admin-final.js`
- `scripts/deploy-frontend.bat`
- `scripts/win-sshpass.exe`
- `guaihub-chunk-*.js`
- `guaihub-index.js`
- `tools/run-guaihub-export-hidden.vbs`
- `backend/database/novel.db`

同时复核了这些已存在规则仍然有效：

- `tools/guaihub-export-config.json`
- `backend/data/codex-turn-snapshots.json`
- `_project_review_for_chatgpt/`
- `*.db`
- `*.sqlite`
- `*.sqlite3`

### 10. 哪些阻塞风险文件已确认被忽略

已确认被忽略：

- `backend/create-admin-final.js`
- `scripts/deploy-frontend.bat`
- `tools/guaihub-export-config.json`

### 11. 哪些二进制 / 本地包装文件已确认被忽略

已确认被忽略：

- `scripts/win-sshpass.exe`
- `tools/run-guaihub-export-hidden.vbs`

### 12. 哪些正式候选文件未被误伤

已确认未被忽略、仍可候选入库：

- `backend/database/init.js`
- `backend/database/migrate.js`
- `backend/data/templates.json`

### 13. 是否仍建议暂存低风险工具脚本小组

是。

在 `.gitignore` 边界补强后，下一步更适合暂存“确认安全的工具脚本小组”，因为高风险 loose assets 已经更不容易误入 staged。

### 14. 是否执行了 commit

没有。

本轮只做 `.gitignore` 收口与验证，没有执行 `git add .`、`git add -A` 或 `git commit`。

---

## 低风险工具脚本小组暂存追加记录

### 15. 本轮实际暂存了哪些低风险工具脚本

本轮已暂存：

- `backend/verify-batch-generation.js`
- `backend/database/init.js`
- `backend/database/migrate.js`
- `backend/data/templates.json`
- `docs/changelog.json`
- `restart-alipro-dev.cmd`
- `scripts/auto-bump-version.js`
- `scripts/bump-version.js`
- `scripts/ensure-daily-changelog.js`
- `scripts/restart-alipro-dev.ps1`
- `scripts/restart-backend.ps1`
- `scripts/seed-demo-storylines.js`
- `scripts/reseed-demo-book.js`
- `scripts/reseed-demo-book-characters.js`
- `scripts/verify-style-manager-contracts.mjs`

### 16. 哪些允许列表文件不存在

本轮允许列表中的文件都存在，没有缺失项。

### 17. 哪些文件因风险被排除

本轮从允许列表中暂时排除了：

- `backend/README.md`

排除原因：

- 安全扫描命中了一个 `sk-` 形式的长串示例；
- 从上下文看它更像 README 示例值，而不一定是正在使用的真实密钥；
- 但按本轮“宁可保守也不误收”的规则，先不把它纳入 staged，留待后续单独清理成更标准的占位符后再入库。

### 18. 是否发现真实敏感值风险

本轮没有在已暂存文件中发现真实敏感值风险。

补充说明：

- `backend/README.md` 发现的是“疑似真实样式的 key 示例”，因此被保守排除；
- 已暂存的其他文件未发现真实长密钥、真实 token、真实 cookie、真实 password 或真实 secret。

### 19. staged 区域是否仍干净

是。

当前 staged 区域只包含：

1. 上一步已暂存的 `.gitignore`
2. 上一步已暂存的 `docs/tooling-and-loose-assets-audit.md`
3. 本轮确认安全的低风险工具脚本与辅助资产

未混入：

- `.env`
- 真实配置
- 数据库文件
- 日志
- `node_modules`
- `dist/build`
- GuaiHub 本地导出链路
- 部署脚本
- 二进制文件
- 一次性修复脚本
- 审查包 / 导出包 / 快照包

### 20. `git diff --cached --check` 是否通过

初次暂存后未通过，原因是：

- `backend/database/init.js` 存在大量 trailing whitespace
- `backend/database/migrate.js` 存在 trailing whitespace

### 21. 是否执行了 commit

没有。

本轮没有执行 `git add .`、`git add -A` 或 `git commit`。

---

## 工具脚本组空白清洁追加记录

### 22. 本轮清理了哪些文件

本轮只清理了两个已 staged 文件：

- `backend/database/init.js`
- `backend/database/migrate.js`

### 23. 清理类型是否仅为 trailing whitespace / EOF 空白

是。

本轮只做了：

- 删除行尾多余空格 / tab
- 保留文件末尾单个换行

没有做全文件格式化，没有改缩进结构，也没有改 SQL / JS 语义。

### 24. 是否修改业务逻辑

没有。

本轮仅做空白层面的清理，没有改任何业务逻辑。

### 25. 是否只处理 staged 文件

是。

本轮先确认当前 staged 列表，再只处理其中报错的两个数据库脚本，没有触碰未 staged 文件。

### 26. `git diff --cached --check` 是否通过

通过。

清理并重新暂存后，`git diff --cached --check` 已无报错。

### 27. staged 区域是否仍干净

是。

当前 staged 区域仍只包含第 5L / 第 5M 已审核内容，没有混入未审核文件，也没有混入：

- `.env`
- 数据库文件
- 日志
- `node_modules`
- `dist/build`
- 真实配置
- GuaiHub 本地导出链路
- 部署脚本
- 二进制文件
- 一次性修复脚本

### 28. 是否建议进入第二个 commit

建议可以进入第二个 commit。

当前工具脚本组已经满足：

- 边界安全
- 高风险 loose assets 已被 `.gitignore` 覆盖
- `backend/README.md` 仍被保守排除
- `git diff --cached --check` 通过
