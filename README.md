# Alipro

Alipro 是一个面向网文写作的 AI 小说创作工具。当前主线已经收敛为：

- 作品入口：创建或选择作品后进入资料库 / 创作台
- 资料库：管理书籍信息、全书汇总、大纲链、剧情线、角色资料、章节与正文
- 创作台：围绕当前章节进行细纲准备、剧情线挂载、正文生成、正文校改和生成后检查
- 后端：提供书籍、章节、剧情线、角色、AI 生成与校改接口

本仓库当前以 React + Vite 前端和 Express + SQLite 后端为主，不再维护旧静态前端入口。

## 项目结构

```text
alipro-main/
├── frontend-react/          # React/Vite 前端主入口
├── backend/                 # Express 后端与 SQLite 数据库访问
├── scripts/                 # 启动、版本、部署辅助脚本
├── docs/                    # 设计、生成链路与项目文档
├── config/                  # 部署配置示例
├── restart-alipro-dev.cmd   # Windows 兼容启动包装器
└── version.json             # 项目版本信息
```

说明：

- 前端开发入口是 `frontend-react/`
- 后端服务入口是 `backend/server.js`
- 本地数据库默认位于 `backend/database/novel.db`
- `frontend-react/dist` 是构建产物，不应作为源码修改入口

## 本地安装

首次运行或依赖缺失时，分别安装前后端依赖：

```powershell
cd backend
npm install

cd ..\frontend-react
npm install
```

## 本地开发启动

推荐使用 PowerShell 7：

```powershell
pwsh -ExecutionPolicy Bypass -File .\scripts\restart-alipro-dev.ps1
```

该脚本会尝试：

- 关闭占用 `3000` / `5173` 的旧进程
- 启动后端开发服务
- 启动前端 Vite 服务

启动后访问：

```text
前端页面：http://127.0.0.1:5173/
后端健康检查：http://127.0.0.1:3000/health
```

也可以手动启动：

```powershell
cd backend
npm run dev
```

```powershell
cd frontend-react
npm run dev -- --host 127.0.0.1
```

## 常用页面

```text
/                  作品入口
/books             资料库列表
/books/:id         书籍详情 / 全书汇总
/books/outlines    大纲链
/books/storylines  剧情线
/books/characters  角色资料
/books/chapters    章节与正文
/workbench         创作台
/changelog         更新日志
```

## 常用命令

前端构建：

```powershell
cd frontend-react
npm run build
```

后端启动：

```powershell
cd backend
npm start
```

后端开发启动：

```powershell
cd backend
npm run dev
```

连续章节 inspect 验证：

```powershell
cd backend
node verify-batch-generation.js --mode inspect
```

指定书籍和章节：

```powershell
node verify-batch-generation.js --mode inspect --book-id <book-id> --chapters 1,2,3
```

## 当前产品主链路

1. 在入口页创建或选择作品。
2. 进入资料库完善基础资料、角色、剧情线和大纲链。
3. 进入创作台选择书籍、卷、章节。
4. 补齐章节细纲：本章目标、关键场景、冲突升级、结尾钩子。
5. 挂载本章剧情线和必要角色。
6. 生成正文，观察流式输出、目标字数偏差和生成状态。
7. 生成后检查摘要、质量检查、剧情线推进结果。
8. 如有需要，在校改区域进行逐段校改。

## 数据与配置

- 环境变量示例：`backend/.env.example`
- 部署配置示例：`config/deploy.config.example.json`
- 前端依赖配置：`frontend-react/package.json`
- 后端依赖配置：`backend/package.json`

不要提交真实 `.env`、数据库运行产物、临时日志或导出数据。

## 版本更新

可使用版本脚本：

```powershell
node scripts/bump-version.js patch "修复说明"
node scripts/bump-version.js minor "功能说明"
node scripts/bump-version.js major "重大变更"
```

相关版本自动化脚本会更新：

- `backend/package.json`
- `version.json`
- `docs/changelog.json`

commit 后 changelog 自检：

```powershell
node scripts/check-post-commit-changelog.js
```

如果最新 commit 距离上一次 changelog 覆盖的 commit 超过 24 小时，脚本会提示需要更新，并覆盖上一次已记录 commit 之后的所有 commit：

```powershell
node scripts/check-post-commit-changelog.js --apply
```

该机制只自动推进 `1.x` 版本，不会自动升到 `2.0`。

## 清理说明

仓库已经移除一批过时文件：

- MVP 验收报告、临时验收包和一次性章节修复脚本
- 旧外部用量导出脚本、本地导出配置和隐藏运行器
- demo 种子脚本和旧演示数据重置脚本
- 早期视觉实验页、`genre-ui` 实验组件和工作台样板页
- 顶部导航中的旧“生成链路”入口

仍需谨慎处理的历史区域包括：

- `docs/` 中早期阶段方案文档
- 旧主题兼容 token 与历史工作台壳组件
- 后端旧 routes / services 是否仍被挂载或调用

这些内容需要引用检查和浏览器回归后再清理，不能只凭文件名删除。

## 排障

- 页面没有更新：确认打开的是 `http://127.0.0.1:5173/`，不是后端静态托管页。
- 接口失败：先检查 `http://127.0.0.1:3000/health`。
- 生成失败：先确认后端环境变量和 DeepSeek 配置。
- 前端 build 失败：先看报错文件，不要全项目格式化或扩大修改范围。
- 数据不见：优先查接口返回和 `backend/database/novel.db`，不要直接改数据库。
