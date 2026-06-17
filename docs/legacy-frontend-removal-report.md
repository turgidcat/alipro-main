## 旧静态前端退场报告

| 项目 | 处理结果 | 风险 | 后续建议 |
| -- | ---- | -- | ---- |
| 用户决策 | 已确认不再保留 `frontend/` | 低 | 后续提交时按“旧静态前端退场”单独提交 |
| `frontend-react` 可用性 | 已确认 `package.json`、`src/`、`index.html`、`vite.config.js` 存在，且构建成功 | 低 | 后续如需提交前再复核，可补跑一次构建 |
| 后端静态托管 | 已移除 `backend/server.js` 中对 `/projects/alipro/frontend` 的静态托管 | 中 | 后续部署时确认生产环境只提供 `frontend-react/dist` |
| 历史数据库查看器入口 | `/database-view` 已改为回到 `/` | 低 | 如果后续需要数据库页，应在 React 内重新建设正式页面 |
| 启动脚本 | `backend/start.bat` 已不再打开旧静态页，改为提示并打开 React 开发地址 | 低 | 若后续需要一键启动前后端，可再单独整理联动脚本 |
| 版本脚本 | `scripts/bump-version.js` 已去除对 `frontend/*.html` 的依赖 | 中 | 后续如要继续自动维护版本说明，可围绕 `docs/changelog.json` 单独增强 |
| 主说明文档 | `README.md`、`frontend-react/README.md`、`backend/README.md` 已改为以 `frontend-react` 为唯一前端入口 | 低 | 提交前再通读一遍，确认措辞与现状一致 |
| 旧目录本体 | `frontend/` 已删除 | 中 | 提交前再确认无误删其他运行文件 |
| 未纳入版本控制的部署文件 | `scripts/nginx-https.conf` 仍保留旧路径引用，未在本轮修改 | 中 | 后续单独审计该文件时同步改成 React 单入口 |

## 总结

1. 已确认用户不再保留旧静态前端。
2. `frontend-react` 已在删除前构建成功，可作为唯一前端入口继续使用。
3. 本轮已删除目录：`frontend/`。
4. 本轮已清理的旧引用包括：
   - `backend/server.js` 中的旧静态托管与启动提示
   - `README.md` 中的旧静态入口说明
   - `frontend-react/README.md` 中的兼容保留说明
   - `backend/README.md` 中的旧托管路径说明
   - `backend/start.bat` 中的旧首页打开地址
   - `scripts/bump-version.js` 中对旧静态页面的版本维护逻辑
5. 本轮修改文件：
   - `backend/server.js`
   - `README.md`
   - `frontend-react/README.md`
   - `backend/README.md`
   - `backend/start.bat`
   - `scripts/bump-version.js`
   - `docs/legacy-frontend-audit.md`
   - `docs/legacy-frontend-removal-report.md`
6. 留待后续人工确认的引用：
   - `scripts/nginx-https.conf` 中仍有 `/projects/alipro/frontend/index.html`
7. 允许保留的旧路径残留应只出现在历史审计文档、本报告以及明确说明“旧 frontend 已删除”的文字里。
8. 建议下一步把本轮修改与目录删除作为单独 commit 提交，保持历史边界清楚。
