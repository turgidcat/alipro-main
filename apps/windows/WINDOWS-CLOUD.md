# Windows 云端整合版 1.9.0

日期：2026-09-12。此文档取代 README 中旧的本地后端打包说明。

- 推荐文件：release/ALIPRO-1.9.0-Portable-x64.exe，双击运行，无需安装 Node、Python、浏览器或数据库。
- 安装版：release/ALIPRO-1.9.0-Setup-x64.exe，安装到当前用户目录。
- 适用 Windows 10/11 x64。Electron 运行环境内置。
- 界面从安装包本地加载；作品、账号、AI、有声书请求连接 https://turgidcat.space/projects/alipro/api，使用时需要联网。
- 使用与安卓版相同账号访问云端作品；旧桌面版的本地数据库不会自动上传或迁移。
- 包内不含后台程序、开发数据库、环境配置、服务器密码、模型密钥或已有音频。
- 当前侧栏：数据仓、资料库、创作台、有声书、视频工坊（规划中）、灵感探索、我的、更新日志。
- 构建入口：npm run package:win。仅打包本地界面和 Electron，无需重新部署网页或云端后台。

## 验证记录

前端契约检查、Vite 构建、Electron Windows NSIS/portable 打包通过。asar 清单检查未发现 .env、novel.db 或 .bak；内置云端地址已核对，线上健康检查正常。

启动验收命令被自动审批策略拦截，未完成打包后交互验收。未使用 Windows 代码签名证书，系统可能显示未知发布者；这不等于已经完成微软信誉认证。
