# ALIPRO 项目管理台

独立的 Windows Electron 管理工具，用于集中查看多个本地项目的 Git 状态，并维护个人开发任务看板。

当前版本已实现：

- 启动时扫描桌面、文档、下载目录，发现候选项目后确认加入
- 项目卡片总览：路径、分支、未提交修改、最近提交、远程状态
- 项目收藏、置顶、打开目录、打开终端
- 内置任务看板：待办、进行中、阻塞、已完成；支持拖拽和状态切换
- 本机 SQLite 数据保存、深色/浅色主题、JSON 备份导出
- 离线可用的本地优先结构

后续扩展点：Gitee 仓库/PR/Issues 同步、Git 操作队列、Windows 通知、趋势历史、CSV/ZIP 备份和安装包自动更新。

## 运行

```powershell
cd project-manager
npm install
npm start
```

## 打包

```powershell
npm run package:win
```
