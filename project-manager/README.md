# ALIPRO 项目管理台

独立的 Windows Electron 管理工具，用于集中查看多个本地项目的 Git 状态，并维护个人开发任务看板。

当前版本已实现：

- 启动时扫描桌面、文档、下载目录，发现候选项目后确认加入
- 项目卡片总览：路径、分支、未提交修改、最近提交、远程状态
- 项目收藏、置顶、打开目录、打开终端
- 内置任务看板：待办、进行中、阻塞、已完成；支持拖拽和状态切换
- Gitee 仓库、PR、Issues、Milestones 基础同步与详情打开
- Git Fetch、Pull、Commit、Push、Merge，带顺序队列和高风险确认
- 操作日志、队列暂停/继续/清空、历史趋势、CSV/ZIP/JSON 备份
- 本机 SQLite 数据保存、深色/浅色主题、Windows 通知、免打扰时段、开机启动和日志保留设置
- 离线可用的本地优先结构

后续扩展点：更完整的 Gitee PR 创建/合并流程、代码 Diff 阅读、项目文档摘要和安装包自动更新。

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
