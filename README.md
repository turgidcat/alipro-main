# 网文 AI 智能生成器

基于 DeepSeek API 的小说创作工具，提供章节生成、续写、润色、书籍管理和 React 工作台能力。

当前仓库已经收敛到：

- 单一前端入口：`frontend-react/`
- 单一后端服务：`backend/`
- 当前 MVP 主链路关注点：书籍创建、章节生成、章节反馈、摘要承接、连续 3 章闭环验收

## 当前结构

项目已经统一为单一前端入口结构：
当前唯一前端入口为 `frontend-react/`，旧静态前端 `frontend/` 已退场删除。

```text
alipro-main/
├── frontend-react/
│   ├── src/
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── backend/
│   ├── server.js
│   ├── start.bat
│   ├── verify-batch-generation.js
│   ├── package.json
│   └── ...
├── scripts/
│   ├── bump-version.js
│   ├── deploy-frontend.bat
│   └── nginx-https.conf
├── tools/
│   ├── check-mvp-rescue.ps1
│   └── ...
├── docs/
├── config/
├── Alipro-MVP验收卡.md
└── version.json
```

说明：

- 唯一前端源码目录：`frontend-react/`
- 开发入口：`frontend-react` 的 Vite 开发服务，地址是 `http://127.0.0.1:5173/`，支持热更新
- 托管入口：后端托管 `frontend-react/dist`，地址是 `http://localhost:3000/`，不支持热更新
- MVP 验收说明文档：`Alipro-MVP验收卡.md`
- MVP 救援检查脚本：`tools/check-mvp-rescue.ps1`
- 连续章节验收脚本：`backend/verify-batch-generation.js`

## 本地运行

首次拉取项目或依赖目录丢失时，请先分别安装前后端依赖：

```powershell
cd backend
npm install

cd ..\frontend-react
npm install
```

### 方式一：推荐开发启动方式

优先直接运行 PowerShell 脚本：

```powershell
pwsh -ExecutionPolicy Bypass -File .\scripts\restart-alipro-dev.ps1
```

这会按当前项目实际开发方式：

- 关闭占用 `3000` / `5173` 端口的旧进程
- 启动后端：`backend` 下的 `npm run dev`
- 启动前端：`frontend-react` 下的 `npm run dev -- --host 127.0.0.1`

说明：

- `scripts\restart-alipro-dev.ps1` 是当前实际启动入口，但不会替你执行首次 `npm install`
- 根目录下的 `.\restart-alipro-dev.cmd` 只是兼容包装器，内部会转发到这个 PowerShell 脚本
- 如果你是第一次运行这个仓库，先完成上面的依赖安装再执行这个脚本

启动后可使用：

```text
前端开发入口：http://127.0.0.1:5173/
后端健康检查：http://127.0.0.1:3000/health
```

### 方式二：手动启动开发环境

先启动后端：

```powershell
cd backend
npm install
npm run dev
```

再启动前端：

```powershell
cd frontend-react
npm install
npm run dev -- --host 127.0.0.1
```

然后在浏览器打开：

```text
http://127.0.0.1:5173/
```

### 方式三：仅启动后端

如果你只是想单独拉起后端，可以运行：

```powershell
backend\start.bat
```

注意：

- 这个脚本当前只负责启动后端
- 它不会自动启动 `frontend-react` 的 Vite 开发服务
- 因此它不是完整的本地开发环境启动方式

## 常用页面

- 开发首页：`http://127.0.0.1:5173/`，这是本地改 React 时应使用的入口，支持热更新
- 托管首页：`http://localhost:3000/`，这是后端返回的静态构建页，不支持热更新
- 启动引导：`http://localhost:3000/start-guide`
- 更新日志：`http://localhost:3000/changelog`
- 健康检查：`http://localhost:3000/health`

## MVP 验收与检查

### 1. 连续 3 章闭环验收

后端提供批量验收脚本：

```powershell
cd backend
node verify-batch-generation.js --mode inspect
```

说明：

- `inspect`：只检查已有数据，不调用正文生成
- `generate`：实际调用生成接口，生成连续 3 章再验收
- 默认验收对象是连续 `1,2,3` 三章

如需显式指定模式：

```powershell
node verify-batch-generation.js --mode inspect
node verify-batch-generation.js --mode generate
```

### 2. MVP 救援分支检查

如果你在做 `mvp-rescue` 分支修复，可以运行：

```powershell
pwsh -ExecutionPolicy Bypass -File tools/check-mvp-rescue.ps1
```

该脚本会输出并覆盖生成：

```text
MVP救援检查报告.md
```

检查内容包括：

- 当前分支
- 工作区状态
- diff 统计
- 文档存在性
- 改动范围是否越界
- `node --check`
- 前端 build
- `inspect` 验收结果

## 部署约定

部署后的唯一前端主入口为：

```text
/
```

Nginx 回退入口也应统一到这个地址，不再使用历史副本路径。

## 版本更新

可使用：

```powershell
node scripts/bump-version.js patch "修复说明"
node scripts/bump-version.js minor "功能说明"
node scripts/bump-version.js major "重大变更"
```

该脚本会更新：

- `backend/package.json`
- `version.json`
- `docs/changelog.json` 的当前版本条目

## 排障建议

- 如果改了前端代码却没自动刷新，先确认你打开的是 `http://127.0.0.1:5173/`，并且 `frontend-react` 已执行 `npm run dev`
- 如果页面打不开，再确认 `frontend-react` 是否已执行 `npm run dev` 或是否已有最新构建产物
- 如果接口请求失败，先检查 `http://localhost:3000/health`
- 如果部署后页面不一致，优先检查是否已重新构建 `frontend-react/dist`
