# 唯一项目工作目录

从 2026-07-10 起，`C:\Users\turgidcat\Desktop\alipro-main` 是 ALIPRO 唯一的日常开发、构建、部署与 Git 提交目录。

## 工作规则

- 前端源码：`frontend-react/src/`
- 前端构建：在 `frontend-react/` 执行 `npm.cmd run build`
- 后端源码：`backend/`
- 后端启动：在 `backend/` 执行 `npm.cmd run start`
- Git 操作：只在项目根目录执行。

## 基线来源

本目录的前后端代码已在 2026-07-10 同步自预发布整合工程。同步前，预发布工程保存的 `dist` 与线上预发布页面的 HTML、JS、CSS 哈希一致；线上 `dist` 仅作为部署产物对照，不能作为可编辑源码。

服务器没有保留原始 React `src`，因此这里的 `frontend-react/src` 是可维护的恢复基线。重新构建可成功生成可部署产物，但不会逐字复现历史压缩包；任何首次重新部署前都应先在本地做页面和核心流程验收。

## 不提交的本地内容

`.env`、数据库文件、日志、`node_modules` 和 `dist` 已由 `.gitignore` 排除。部署时在服务器或本地配置相应环境变量和数据库，不要把它们提交到仓库。

## 历史恢复

同步前 `alipro-main` 的未提交改动已保存为 Git stash：`pre-online-baseline-sync-20260710-123958`。只有在确认需要恢复其中某项历史功能时，才单独查看和迁移；不要整包直接应用。
