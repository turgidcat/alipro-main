# Longform Studio IDE（本地独立版）

基于 Electron 的独立桌面 IDE，加载 `frontend-react` 的构建产物，使用「星炉纸感」配色（`src/paper-theme.css`）。

## 开发运行前提

1. Node.js 22+（本项目已验证 v22.14.0）。
2. 本地后端已启动：项目根目录运行 `restart-alipro-dev.cmd`，或 `cd backend && npm start`（默认端口 3000）。
3. 有声书功能需要 Python 3.10+，并创建后端 TTS 环境（见 `backend/README.md`）：

   ```bash
   cd backend
   python -m venv tts-venv
   tts-venv\Scripts\python.exe -m pip install --upgrade edge-tts
   ```

## 开发安装与启动

```bash
cd desktop-ide
npm install          # 首次安装 Electron
npm run build        # 以桌面版配置构建 frontend-react（VITE_BASE_PATH=/ VITE_API_BASE=127.0.0.1:3000）
npm start            # 启动 IDE
```

开发快捷方式：`npm run dev`（构建 + 启动）。

## 功能

- 独立窗口（1440x900），顶部应用菜单（文件/编辑/视图/窗口/帮助）。
- IDE 侧边栏导航：资料库 / 创作台 / 有声书 / 视频工坊（规划中）/ 灵感探索（规划中），
  新增页面只需在 `frontend-react/src/AppLayout.jsx` 导航数组加一项并注册路由。
- 有声书：选择书籍与章节 → 挑选中文音色与语速 → 单章或全书生成 Edge TTS 朗读音频，
  支持播放、重新生成与删除；音频持久化在 `backend/data/audio/`（已加入 `.gitignore`）。
- 显示比例自适应：窗口尺寸与最小尺寸自动适配显示器工作区（高分屏 / 高缩放比例下不会超出屏幕），
  侧边栏底部提供缩放控件（− / + / 百分比）与「适配窗口显示比例」开关，缩放设置会持久化；
  也可通过菜单「视图」调整缩放与开关自动适配。
- 快捷键：`Ctrl/Cmd+R` 重载、`Ctrl/Cmd+Shift+I` 开发者工具、`Ctrl/Cmd+0/+/−` 缩放。
- API 直连本地后端，无需浏览器代理；页面通过 `app://` 协议加载本地构建产物。
- 后端未启动时显示提示页，不闪退。

## 给普通用户的安装包

体验版会把前端、Electron 壳、Node 后端、当前数据库、模板和已有有声书一起打包；安装后会自动启动内置后端，普通用户不需要安装 Node 或手动运行服务。

在 macOS 机器上执行：

```bash
cd desktop-ide
npm install
npm run package:mac
```

产物会出现在 `desktop-ide/release/`，包含 `.dmg` 和 `.zip`。当前配置同时生成 Intel（x64）和 Apple 芯片（arm64）目标。若没有 Apple Developer 签名证书，可先使用：

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:mac
```

未签名版本第一次打开时，需要在 Finder 中右键应用选择「打开」，或到「系统设置 → 隐私与安全性」允许打开。正式长期分发时再补 Apple Developer 签名与公证即可。

有声书已有音频会随体验包提供；“重新生成音频”仍依赖 Python/Edge TTS 运行环境，当前 macOS 安装包未捆绑跨平台 Python 环境。

## 跨平台

- Windows：可用 `npm run package:win` 生成 NSIS 安装包和 zip，用于本机验收。
- macOS：可用 `npm run package:mac` 生成 `.dmg` / `.zip`；electron-builder 要求在 Mac 上执行 macOS 目标构建。

## 目录

```text
desktop-ide/
  package.json           Electron 壳依赖与脚本
  scripts/build-desktop.mjs  桌面版前端构建（跨平台）
  backend-runtime/      打包时自动生成的后端运行时暂存目录（不提交）
  src/main.cjs           Electron 主进程（窗口/菜单/协议/API CORS）
  src/preload.cjs        预加载桥（暴露 ide.platform / ide.quit）
  src/paper-theme.css    星炉纸感主题
```
