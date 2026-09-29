# 自动构建版本

`version.json` 是唯一总版本基准。正常执行 `npm run build:web`、`npm run build:android`、`npm run build:windows` 时，共用前端的 `prebuild` 自动检查源码指纹并同步版本，不需要另外运行升级命令。在各端目录使用原来的 npm 构建命令也生效。后端单独使用 `npm pack` 时通过 `prepack` 接入。

- 源码有变化：自动增加 patch，更新日期、历史和 changelog；同步三端和后端 package/lock 版本，Android versionName 同步，versionCode 增加 1。
- 同一份源码重复打包、多端依次打包或失败后重试：复用同一版本。
- 首次运行：为当前源码生成新构建版本。未提交的新文件也能检测，不依赖 Git 提交或人工填写日志。
- 构建前预留版本，即使后续构建失败也保留记录；记录明确不代表构建成功、发布或部署。不会自动上传、部署、提交 Git，也不是已安装客户端的在线自动更新。
- major/minor 产品版本仍需明确决策；自动化只递增 patch，不猜测功能的重要程度。
- 直接调用 vite、Gradle、electron-builder 会绕过 npm 入口，请使用上述项目命令。
- 检查：`npm run version:check`（不写版本）；手动提前同步：`npm run version:prepare`；测试：`npm run test:version`。
- 指纹覆盖 Git 未忽略的 apps、backend、shared、scripts 和根 package.json（包含源码图片资源）；排除构建输出、数据目录、日志、说明文档和桌面预览截图。
- 并发版本更新会报错阻止竞态，稍后重试即可。若进程被强杀，确认没有构建在运行后才能移除根目录 `.release-version.lock`。

版本文件、包版本、Android Gradle 版本和日志应一起纳入后续正常代码提交。旧的版本升级入口已转接至同一实现，不再使用后端旧版本推算总版本。
