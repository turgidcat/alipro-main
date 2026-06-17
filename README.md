# 网文 AI 智能生成器

基于 DeepSeek API 的小说创作工具，提供章节生成、续写、润色、书籍管理和数据库查看能力。

## 当前结构

项目已经统一为单一前端入口结构：
当前主入口已切换到 React 工作台，旧静态前端仅作为兼容入口保留。

```text
alipro-main/
├── frontend/
│   ├── index.html
│   ├── database-view.html
│   ├── changelog.html
│   ├── start-guide.html
│   ├── favicon.svg
│   ├── database-view-modern.css
│   ├── css/
│   └── js/
├── backend/
│   ├── server.js
│   ├── start.bat
│   ├── package.json
│   └── ...
├── scripts/
│   ├── bump-version.js
│   ├── deploy-frontend.bat
│   └── nginx-https.conf
├── docs/
├── config/
└── version.json
```

说明：

- 正式首页入口：`frontend/index.html`
- 数据库查看器：`frontend/database-view.html`
- 更新日志：`frontend/changelog.html`
- 启动引导页：`frontend/start-guide.html`
- 不再使用 `frontend/html/` 目录

## 本地运行

### 方式一：Windows 一键启动

直接运行：

```powershell
backend\start.bat
```

默认会启动后端并打开：

```text
http://localhost:3000/
```

### 方式二：手动启动

```powershell
cd backend
npm install
npm start
```

然后在浏览器打开：

```text
http://localhost:3000/
```

## 常用页面

- 首页：`http://localhost:3000/`
- 数据库查看器：`http://localhost:3000/projects/alipro/frontend/database-view.html`
- 更新日志：`http://localhost:3000/changelog`
- 健康检查：`http://localhost:3000/health`

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
- `frontend/*.html` 中的资源版本号
- `frontend/index.html` 顶部版本注释
- `frontend/changelog.html` 中的最新版本条目

## 排障建议

- 如果页面样式异常，先确认访问的是 `frontend/index.html`，而不是历史副本路径
- 如果接口请求失败，先检查 `http://localhost:3000/health`
- 如果部署后页面不一致，优先检查 Nginx 回退入口和前端上传路径是否仍在使用旧目录结构
