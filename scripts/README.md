# scripts

脚本目录。

## 当前定位

这里保留仍有实际用途的项目维护脚本，例如版本号更新、每日变更记录和本地服务重启。

## 结构说明

- `auto-bump-version.js`：自动版本号更新脚本。
- `bump-version.js`：手动版本号更新脚本。
- `ensure-daily-changelog.js`：确保每日变更记录存在。
- `restart-alipro-dev.ps1`：重启本地前后端开发环境。
- `restart-backend.ps1`：重启后端服务。
- `nginx-https.conf`：部署或反向代理参考配置。

## 清理规则

一次性 seed、demo 重置、旧导出、旧部署测试脚本不应长期保留。
