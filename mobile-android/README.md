# Longform Studio Android 客户端

这个目录是 React 工作台的 Android 客户端壳，使用 Capacitor 生成 APK。它复用 `frontend-react` 的页面和业务逻辑，不影响 `desktop-ide` 的 Electron 构建。Android 端启用了 Capacitor 原生 HTTP 适配，避免 WebView 跨域策略阻断 API 请求。

## 重要边界

当前后端是独立 Node 服务，Electron 桌面端会在本机启动内置后端；Android APK 不能直接运行这个 Node 服务。因此 APK 需要连接一个手机可访问的后端地址：

```powershell
$env:ALIPRO_MOBILE_API_BASE = 'https://your-domain.example/api'
npm run sync
```

当前项目正式环境默认使用阿里云服务器上的 `https://turgidcat.space/projects/alipro/api`。只有在连接本地或局域网后端时，才需要覆盖 `ALIPRO_MOBILE_API_BASE`。

如果后端运行在开发电脑上，真机不能使用 `127.0.0.1`，应改成电脑局域网 IP，例如：

```powershell
$env:ALIPRO_MOBILE_API_BASE = 'http://192.168.1.20:3000/api'
npm run sync
```

局域网 HTTP 仅适合开发联调；正式使用建议部署 HTTPS，并在后端 CORS 中加入 APK WebView 的请求来源策略。

## 构建

先安装 Node.js 22+、JDK 21、Android Studio/Android SDK，并确认 `ANDROID_HOME` 或 `ANDROID_SDK_ROOT` 已配置。

```powershell
cd mobile-android
npm install
$env:ALIPRO_MOBILE_API_BASE = 'https://your-domain.example/api'
npm run build:debug
```

Debug APK 产物：

```text
mobile-android/android/app/build/outputs/apk/debug/app-debug.apk
```

首次生成原生目录时，也可以手动执行：

```powershell
npx cap add android
```

之后每次修改 React 页面都重新执行 `npm run sync`，再运行 Gradle 构建。
