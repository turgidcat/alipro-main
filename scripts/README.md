# scripts

脚本目录。

## 当前定位

这里保留仍有实际用途的项目维护脚本，例如版本号更新、每日变更记录和本地服务重启。

## 结构说明

- `auto-bump-version.js`：自动版本号更新脚本。
- `bump-version.js`：手动版本号更新脚本。
- `ensure-daily-changelog.js`：确保每日变更记录存在。
- `check-post-commit-changelog.js`：commit 后自检 changelog 是否需要补齐。
- `restart-alipro-dev.ps1`：重启本地前后端开发环境。
- `restart-backend.ps1`：重启后端服务。
- `nginx-https.conf`：部署或反向代理参考配置。

## 清理规则

一次性 seed、demo 重置、旧导出、旧部署测试脚本不应长期保留。

## commit 后 changelog 自检

每次 commit 后运行：

```powershell
node scripts/check-post-commit-changelog.js
```

规则：

- 如果当前最新 commit 距离上一次 changelog 覆盖的 commit 未超过 24 小时，只提示无需更新。
- 如果超过 24 小时，脚本会列出“上一次已记录 commit 之后”的所有 commit。
- 需要写入 changelog 时再执行：

```powershell
node scripts/check-post-commit-changelog.js --apply
```

自动更新只在 `1.x` 内推进，不会自动升到 `2.0`。
