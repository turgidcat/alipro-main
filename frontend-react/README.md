# frontend-react

这是 `alipro-main` 的 React 创作工作台，当前已经作为主前端入口使用。

## 现在负责什么

- 首页创作主链
- 章节规划与生成
- 校改与局部修改
- 书籍、日志、启动引导等辅助页面

## 目录说明

- `src/App.jsx`：工作台主入口
- `src/AppLayout.jsx`：顶部导航布局
- `src/pages/`：辅助页面
- `src/workbenchApi.js`：前端 API 封装
- `src/app-shell.css`：工作台样式

## 本地开发

```powershell
cd frontend-react
npm install
npm run dev
```

打开：

```text
http://127.0.0.1:5173/
```

## 生产部署

先构建：

```powershell
npm run build
```

后端会优先托管 `frontend-react/dist`，所以生产环境直接访问：

```text
http://localhost:3000/
```

旧版静态页仍保留在：

```text
http://localhost:3000/projects/alipro/frontend/index.html
```

## 样式管理页自检

如果改了 `/style-manager`，先执行：

```powershell
npm run verify:style-manager
```

这会先构建，再检查样式管理页的关键布局契约，避免把紧凑工具区、角标样式和分组结构改回去。

## 当前边界

- React 已经接管主工作台
- 旧静态前端保留为兼容入口
- 后续如果要继续收口，优先下线旧入口页面
