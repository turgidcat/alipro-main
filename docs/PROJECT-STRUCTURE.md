# 项目目录导航

三个产品形态，共用一套界面和一个后台。不要复制三份 React 源码分别维护。

```text
alipro-main/
  apps/
    android/          安卓外壳、原生工程和构建脚本
    windows/          Windows Electron 外壳和 EXE 构建脚本
    web/              网页入口、React 页面、三端共用界面
  backend/            共用后台；线上运行于阿里云
  shared/             前后端共用规则
  artifacts/          已交付安装包及验收材料
  design-previews/    设计预览
  docs/               项目文档、历史记录和验收说明
  scripts/            仓库级启动、版本和维护脚本
  config/             部署配置（真实配置不入 Git）
  package.json        三种产品的统一命令入口
```

## 去哪里改代码

- 改页面、角色资料、大纲、创作台：apps/web/src。
- 改安卓权限、键盘、原生配置：apps/android/android。
- 改 Windows 窗口、菜单、打包：apps/windows/src 和 package.json。
- 改保存数据、AI 调用和角色联动：backend。
- 网页版独立开发暂停，不代表停止修改三端共用页面。

## 构建与交付

| 根目录命令 | 产物 |
| --- | --- |
| npm run build:web | apps/web/dist |
| npm run build:android | apps/android/android/app/build/outputs/apk/debug/app-debug.apk |
| npm run build:windows | apps/windows/release（portable 和 setup EXE） |

apps 下的 node_modules、dist、www、Android build、Windows release 和 backend-runtime 都是本机依赖或生成内容，不应作为可维护源码提交。历史安装包和截图保留，不删除用户数据。

## 原目录对应

| 旧目录 | 新目录 |
| --- | --- |
| frontend-react | apps/web |
| mobile-android | apps/android |
| desktop-ide | apps/windows |

旧文档、历史日志、对话中的文件链接可能仍指向迁移前的位置，按上表查找。已经交付的 EXE 随 Windows 目录一起移动到 apps/windows/release。

本次仅整理本地仓库。阿里云部署目录和线上 API 地址不变；backend/server.js 同时兼容新本地目录与旧服务器静态页面目录。以后部署客户端时使用新产物路径，不要把整套本地目录覆盖到服务器。
