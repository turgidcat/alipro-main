## 旧静态前端目录审计

| 文件/目录 | 分类 | 建议动作 | 风险等级 | 备注 |
| ----- | -- | ---- | ---- | -- |
| `frontend/` | 旧版兼容前端 | 建议纳入版本控制 | 中 | 当前不是主入口，但仍被后端显式托管为兼容入口 |
| `frontend/index.html` | 正式静态前端源码 | 建议纳入 | 低 | 兼容首页入口，仍被 `backend/server.js`、`README.md`、`backend/start.bat`、`scripts/nginx-https.conf` 等引用 |
| `frontend/database-view.html` | 正式静态前端源码 | 建议纳入 | 低 | 数据库查看器兼容页面，后端有显式跳转 |
| `frontend/changelog.html` | 正式静态前端源码 | 建议纳入 | 低 | 版本日志静态页面，`scripts/bump-version.js` 会直接维护 |
| `frontend/start-guide.html` | 正式静态前端源码 | 建议纳入 | 低 | 启动引导兼容页面 |
| `frontend/favicon.svg` | 正式静态前端资源 | 建议纳入 | 低 | 静态资源文件 |
| `frontend/database-view-modern.css` | 正式静态前端源码 | 建议纳入 | 低 | 静态页面样式文件 |
| `frontend/css/` | 正式静态前端源码 | 建议纳入 | 低 | 样式源文件目录，无构建产物迹象 |
| `frontend/js/` | 正式静态前端源码 | 建议纳入 | 中 | 旧静态前端的主要逻辑目录，仍承担兼容前端功能 |
| `frontend/html/` | 用途不明 / 空目录 | 建议人工确认或后置 | 低 | 目录存在，但当前为空；`README.md` 还明确写了“不再使用 `frontend/html/` 目录” |

## 目录结构

当前 `frontend/` 一级与二级结构大致为：

```text
frontend/
  index.html
  database-view.html
  changelog.html
  start-guide.html
  database-view-modern.css
  favicon.svg
  css/
    components.css
    dark-mode.css
    main-arco.css
    main.css
    mobile.css
    page-common.css
  js/
    api.js
    app.js
    book-gate-overrides.js
    character-manager.js
    config-manager.js
    enhanced-outline.js
    mobile-wizard.js
    outline-editor-bridge.js
    outline-manager.js
    storage.js
    ui.js
    utils.js
  html/
    （当前为空）
```

## 性质判断

### 1. `frontend/` 是什么

它更像：

- **旧版静态前端**
- 同时也是 **当前仍保留的兼容入口**

而不是：

- 构建产物目录
- 一次性导出包
- 单纯历史废弃目录

原因很直接：它不但有完整的 HTML/CSS/JS 源文件结构，而且还在被当前项目多处明确引用。

### 2. 是否仍被项目引用

是，仍被明确引用。

已确认引用来源包括：

- `backend/server.js`
  - 定义了 `legacyFrontendDir`
  - `app.use('/projects/alipro/frontend', express.static(legacyFrontendDir, ...))`
  - 数据库查看器还会跳转到 `database-view.html`
- 根目录 `README.md`
  - 明确把 `frontend/index.html`、`database-view.html`、`changelog.html`、`start-guide.html` 列为入口
- `frontend-react/README.md`
  - 明确说明旧静态前端兼容保留
- `backend/start.bat`
  - 启动后直接打开旧静态前端兼容地址
- `scripts/bump-version.js`
  - 明确维护 `frontend/index.html` 和 `frontend/changelog.html`
- `scripts/nginx-https.conf`
  - 仍把 `/projects/alipro/frontend/index.html` 作为路由目标

所以这里的判断可以说得很明确：

**`frontend/` 目前仍是兼容入口，不是纯废弃目录。**

## 安全扫描

### 是否发现真实敏感值风险

本轮没有发现需要阻塞的真实敏感值。

命中的关键词主要来自：

- `localStorage` 里的登录 token 字段名
- `Authorization: Bearer ${token}` 这类正常鉴权逻辑
- 登录 / 注册密码输入框
- “Token 使用统计”文案
- `main-arco.css` 里的 design token 术语

抽样复核后，未发现：

- 真实 API key
- 真实 Bearer 长串
- 真实 cookie
- 真实 password
- 真实 secret
- 真实账号凭据

### 抽样结论

- `frontend/js/api.js`、`character-manager.js`：是正常的 token header 组装逻辑
- `frontend/database-view.html`：是 `Bearer ${userData.token}` 类型的正常前端鉴权逻辑
- `frontend/index.html`：命中的是密码输入框和 token 统计显示
- `frontend/css/mobile.css`：命中的是 `input[type="password"]`
- `frontend/css/main-arco.css`：命中的是 design token 注释

## 构建 / 运行产物检查

本轮没有在 `frontend/` 内发现这些内容：

- `node_modules/`
- `dist/`
- `build/`
- `.cache/`
- `.vite/`
- `*.log`
- `*.map`
- 明显的压缩包 / 导出包

这说明 `frontend/` 当前更像手写静态源码目录，而不是打包产物堆。

## 纳入建议

### 结论

**建议 B：只纳入 `frontend/` 的静态源码安全子集。**

原因：

1. 它仍被项目明确引用，不能简单视为废弃目录。
2. 它是兼容入口，不是主前端，所以不一定需要和 `frontend-react` 同等优先级整体收编。
3. 当前目录里大部分文件看起来都属于正式静态源码，可分组纳入。
4. `frontend/html/` 目录当前为空，而且 README 已写“不再使用”，可以后置或人工确认。

### 如果纳入，建议纳入哪些文件

建议优先纳入：

- `frontend/index.html`
- `frontend/database-view.html`
- `frontend/changelog.html`
- `frontend/start-guide.html`
- `frontend/database-view-modern.css`
- `frontend/favicon.svg`
- `frontend/css/**`
- `frontend/js/**`

### 如果暂不整体纳入

可以先保留 `frontend/html/` 为人工确认项，不必因为它的存在阻塞整个 `frontend/` 安全子集。

## 是否需要补 `.gitignore`

当前从 `frontend/` 本身看，**不急着补新的 `.gitignore` 规则**，因为暂时没看到构建产物或日志残留。

如果后续发现：

- `frontend/html/` 只是历史复制目录
- 或者以后出现打包产物 / 本地缓存 / 日志

再有针对性补规则会更稳。

## 结论更新

用户已明确决定不再保留 legacy frontend。

- `frontend/` 不纳入版本控制
- `frontend/` 改为退场删除
- `frontend-react/` 作为唯一前端入口保留
- `scripts/nginx-https.conf` 等未纳入版本控制的部署文件，后续按单独审计结果同步更新

以下内容保留为删除前的历史审计结论，供追溯原先兼容链路使用。

## 总结

1. `frontend/` 的性质判断：
   它是 **旧版静态前端 + 当前兼容入口**，不是单纯废弃目录。

2. 是否仍被项目引用：
   **是**，而且被后端、README、启动脚本、版本脚本、Nginx 配置多处引用。

3. 是否建议纳入版本控制：
   **建议纳入**，但更建议按“安全子集”分组纳入，而不是不加区分地整目录一把收。

4. 是否发现真实敏感值风险：
   **没有发现阻塞级真实敏感值**。

5. 是否发现构建产物 / 日志 / 临时文件：
   **没有明显发现**。

6. 如果纳入，建议纳入哪些文件：
   `frontend/*.html`、`frontend/css/**`、`frontend/js/**`、`frontend/favicon.svg`、`frontend/database-view-modern.css`

7. 如果排除，建议补哪些 `.gitignore` 规则：
   当前 **暂不需要新增规则**；先把空目录 `frontend/html/` 作为人工确认项更合适。

8. 下一步是否可以暂存 `frontend/` 的安全子集：
   **可以**。建议下一步只暂存：
   - `frontend/index.html`
   - `frontend/database-view.html`
   - `frontend/changelog.html`
   - `frontend/start-guide.html`
   - `frontend/database-view-modern.css`
   - `frontend/favicon.svg`
   - `frontend/css/**`
   - `frontend/js/**`
