# Windows 桌面客户端

这是三种产品形态中的 Windows 客户端，使用 Electron 加载 `../web` 的共用界面。

## 普通用户

从 `release/` 打开 Portable EXE，或使用 Setup EXE 安装。运行环境内置，无需安装 Node、Python 或数据库。作品、AI 和有声书连接现有阿里云后台；联网并使用与安卓版相同的账号。

完整说明见 [Windows 云端整合版](WINDOWS-CLOUD.md)。旧本地桌面数据库没有自动迁移到云端。

## 模型调用观察台

新版客户端侧栏“系统 → 模型观察台”，或菜单“视图 → 模型调用观察台”（Ctrl+Shift+M），打开内置观察窗口，不需要另开浏览器。窗口明确标注当前客户端连接地址；云端采集尚未部署，云端生成不会出现在本机记录中。

本开发机要做真实生成实验，双击仓库根目录 `start-model-experiment.cmd`：自动创建《血裔迷途》快照副本、启动本地后端并打开桌面客户端，生成仍使用本地配置的模型密钥并消耗额度。实验账号缓存与普通客户端分开；每次启动新副本，记录保留在 `%LOCALAPPDATA%/ALIPRO/model-experiments/`。详细步骤见 [观察台说明](../model-monitor/README.md)。

## 开发与打包

在仓库根目录执行 `npm run build:windows`，产物位于 `apps/windows/release/`。

开发机首次需在 `apps/web` 和 `apps/windows` 安装 npm 依赖。此开发要求不适用于安装包用户。

## 目录

- `src/`：窗口、菜单、预加载桥和桌面主题。
- `scripts/`：从共用网页源码构建桌面界面的脚本。
- `dist/`：自动生成的界面产物。
- `release/`：生成的 Windows EXE。
- `backend-runtime/`、旧截图和日志：保留的历史本机材料，当前云端整合包不使用、不携带。

macOS 打包配置作为历史兼容项保留，不表示已有第四种正式产品。
