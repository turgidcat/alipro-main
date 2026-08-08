const { app, BrowserWindow, Menu, protocol, session, net, shell, ipcMain, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');

const APP_SCHEME = 'app';
const DIST_DIR = app.isPackaged
  ? path.resolve(__dirname, '..', 'dist')
  : path.resolve(__dirname, '..', '..', 'frontend-react', 'dist');
const API_ORIGIN = process.env.ALIPRO_API_ORIGIN || 'http://127.0.0.1:3000';
const APP_TITLE = 'Longform Studio IDE';
const SCREENSHOT_PATH = process.env.ALIPRO_IDE_SCREENSHOT || '';
const SCREENSHOT_PAGE = process.env.ALIPRO_IDE_PAGE || '';
const SHOT_DIR = process.env.ALIPRO_IDE_SHOT_DIR || '';
const SHOT_PAGES = (process.env.ALIPRO_IDE_SHOT_PAGES || '')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);
const LOAD_URL = process.env.ALIPRO_IDE_LOAD_URL || '';
const PRESET_BOOK_ID = process.env.ALIPRO_IDE_BOOK_ID || '';

/* ==================== 显示比例自适应设置 ==================== */

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
let uiSettings = { zoomFactor: 1, autoFit: true };

function settingsFile() {
  return path.join(app.getPath('userData'), 'ide-settings.json');
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(settingsFile(), 'utf8');
    const parsed = JSON.parse(raw);
    const zoom = Number(parsed.zoomFactor);
    uiSettings = {
      zoomFactor: Number.isFinite(zoom) ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) : 1,
      autoFit: parsed.autoFit !== false
    };
  } catch (_) {
    // 首次启动或设置文件损坏时使用默认值
  }
}

function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(uiSettings, null, 2), 'utf8');
  } catch (error) {
    console.error('[ide] save settings failed:', error);
  }
}

function applyZoom(factor) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  uiSettings.zoomFactor = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(factor) || 1));
  mainWindow.webContents.setZoomFactor(uiSettings.zoomFactor);
  saveSettings();
}

/**
 * 把窗口尺寸和最小尺寸约束到所在显示器的可用工作区，
 * 避免高显示缩放（125% / 150% 等）或小屏上窗口超出屏幕。
 */
function adaptWindowToDisplay(win) {
  if (!win || win.isDestroyed()) return;
  const display = screen.getDisplayMatching(win.getBounds());
  const { workArea } = display;
  win.setMinimumSize(
    Math.min(1080, Math.max(720, Math.floor(workArea.width))),
    Math.min(720, Math.max(560, Math.floor(workArea.height)))
  );

  const bounds = win.getBounds();
  const next = { ...bounds };
  next.width = Math.min(bounds.width, workArea.width);
  next.height = Math.min(bounds.height, workArea.height);
  next.x = Math.max(workArea.x, Math.min(bounds.x, workArea.x + workArea.width - next.width));
  next.y = Math.max(workArea.y, Math.min(bounds.y, workArea.y + workArea.height - next.height));
  if (
    next.x !== bounds.x ||
    next.y !== bounds.y ||
    next.width !== bounds.width ||
    next.height !== bounds.height
  ) {
    win.setBounds(next);
  }
}

const DARK_SCAN_SCRIPT = `(() => {
  const out = [];
  const els = document.querySelectorAll('body *');
  for (let i = 0; i < els.length && out.length < 40; i++) {
    const el = els[i];
    const cs = getComputedStyle(el);
    let r = -1, g = -1, b = -1;
    let source = '';
    const m = cs.backgroundColor.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    if (m) {
      const a = m[4] === undefined ? 1 : +m[4];
      if (a >= 0.2) {
        r = +m[1]; g = +m[2]; b = +m[3];
        source = cs.backgroundColor;
      }
    }
    if (r < 0) {
      const gm = cs.backgroundImage.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
      if (gm) {
        const a = gm[4] === undefined ? 1 : +gm[4];
        if (a >= 0.2) {
          r = +gm[1]; g = +gm[2]; b = +gm[3];
          source = 'gradient:' + cs.backgroundImage.slice(0, 80);
        }
      }
    }
    if (r < 0 || r + g + b >= 420) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) continue;
    const cls = el.className && el.className.baseVal !== undefined ? el.className.baseVal : (el.className || el.tagName);
    out.push(String(cls).slice(0, 70) + ' => ' + source + ' ' + Math.round(rect.width) + 'x' + Math.round(rect.height));
  }
  return JSON.stringify(out);
})()`;

const LIGHT_TEXT_SCAN_SCRIPT = `(() => {
  const out = [];
  const els = document.querySelectorAll('body *');
  for (let i = 0; i < els.length && out.length < 20; i++) {
    const el = els[i];
    if (!el.textContent || el.textContent.trim().length < 2) continue;
    const m = getComputedStyle(el).color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    if (!m) continue;
    const r = +m[1], g = +m[2], b = +m[3];
    if (r + g + b < 660) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 8) continue;
    const cls = el.className && el.className.baseVal !== undefined ? el.className.baseVal : (el.className || el.tagName);
    out.push(
      String(cls).slice(0, 60) +
        ' [' + el.textContent.trim().slice(0, 16) + '] ' +
        Math.round(rect.width) + 'x' + Math.round(rect.height) +
        ' bg=' + getComputedStyle(el).backgroundColor
    );
  }
  return JSON.stringify(out);
})()`;

const STYLE_SCAN_SCRIPT = `(() => {
  const out = [];
  const els = document.querySelectorAll('body *');
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    const rect = el.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 36) continue;
    const cs = getComputedStyle(el);
    const bw = cs.borderTopWidth;
    if (bw === '0px' && cs.backgroundColor === 'rgba(0, 0, 0, 0)') continue;
    const cls = el.className && el.className.baseVal !== undefined ? el.className.baseVal : (el.className || el.tagName);
    if (!String(cls)) continue;
    out.push(
      String(cls).slice(0, 80) +
        ' | bg=' + cs.backgroundColor +
        ' | bd=' + bw + '/' + cs.borderTopColor +
        ' | r=' + cs.borderTopLeftRadius +
        ' | pd=' + cs.paddingTop + '/' + cs.paddingLeft +
        ' | sh=' + cs.boxShadow.slice(0, 42) +
        ' | ' + Math.round(rect.width) + 'x' + Math.round(rect.height)
    );
  }
  return JSON.stringify(out);
})()`;

const PROSE_SCAN_SCRIPT = `(() => {
  const out = [];
  const els = document.querySelectorAll('[class*="prose"], [class*="Prose"], [class*="reader"]');
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const cls = el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className;
    if (!String(cls)) continue;
    out.push(
      String(cls).slice(0, 90) +
        ' | bg=' + cs.backgroundColor +
        ' | disp=' + cs.display +
        ' | ' + Math.round(rect.width) + 'x' + Math.round(rect.height)
    );
  }
  return JSON.stringify(out);
})()`;

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

let mainWindow = null;
let backendProcess = null;

function copySeedIfMissing(source, target, { recursive = false } = {}) {
  if (!fs.existsSync(source) || fs.existsSync(target)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (recursive) {
    fs.cpSync(source, target, { recursive: true });
  } else {
    fs.copyFileSync(source, target);
  }
}

function preparePackagedRuntime() {
  if (!app.isPackaged) return null;

  const userData = app.getPath('userData');
  const runtimeRoot = path.join(userData, 'data');
  const runtimeDatabase = path.join(runtimeRoot, 'novel.db');
  const runtimeAudio = path.join(runtimeRoot, 'audio');
  const runtimeLogs = path.join(userData, 'logs');
  const bundledBackend = path.join(process.resourcesPath, 'backend');

  copySeedIfMissing(
    path.join(bundledBackend, 'database', 'novel.db'),
    runtimeDatabase
  );
  copySeedIfMissing(
    path.join(bundledBackend, 'data', 'audio'),
    runtimeAudio,
    { recursive: true }
  );
  copySeedIfMissing(
    path.join(bundledBackend, 'data', 'templates.json'),
    path.join(runtimeRoot, 'templates.json')
  );
  fs.mkdirSync(runtimeLogs, { recursive: true });

  return { bundledBackend, runtimeRoot, runtimeDatabase, runtimeAudio, runtimeLogs };
}

function startBundledBackend() {
  if (!app.isPackaged || backendProcess) return;
  const runtime = preparePackagedRuntime();
  if (!runtime) return;

  const entry = path.join(runtime.bundledBackend, 'server.js');
  if (!fs.existsSync(entry)) {
    console.error('[ide] bundled backend missing:', entry);
    return;
  }

  const apiPort = new URL(API_ORIGIN).port || '3000';
  backendProcess = spawn(process.execPath, [entry], {
    cwd: runtime.bundledBackend,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: apiPort,
      NOVEL_DB_PATH: runtime.runtimeDatabase,
      ALIPRO_DATA_DIR: runtime.runtimeRoot,
      ALIPRO_TTS_DIR: runtime.runtimeAudio,
      ALIPRO_LOG_DIR: runtime.runtimeLogs
    },
    stdio: 'ignore',
    windowsHide: true
  });
  backendProcess.on('error', (error) => {
    console.error('[ide] bundled backend failed to start:', error);
  });
  backendProcess.on('exit', (code, signal) => {
    console.log(`[ide] bundled backend exited code=${code} signal=${signal || ''}`);
    backendProcess = null;
  });
}

function resolveAppFile(requestUrl) {
  const url = new URL(requestUrl);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }
  const target = path.normalize(path.join(DIST_DIR, pathname));
  if (!target.startsWith(DIST_DIR)) return 'forbidden';
  return fs.existsSync(target) ? target : null;
}

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, (request) => {
    const filePath = resolveAppFile(request.url);
    if (filePath === 'forbidden') {
      return new Response('Forbidden', { status: 403 });
    }
    if (filePath) {
      return net.fetch(pathToFileURL(filePath).toString());
    }
    // SPA fallback：前端路由（如 /books/outlines）整页跳转时返回 index.html
    const indexFile = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexFile)) {
      return net.fetch(pathToFileURL(indexFile).toString());
    }
    return new Response('Not Found', { status: 404 });
  });
}

function injectApiCors() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (details.url.startsWith(API_ORIGIN)) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Access-Control-Allow-Origin': ['*'],
          'Access-Control-Allow-Headers': ['Content-Type, Authorization'],
          'Access-Control-Allow-Methods': ['GET, POST, PUT, PATCH, DELETE, OPTIONS']
        }
      });
      return;
    }
    callback({ responseHeaders: details.responseHeaders });
  });
}

async function backendAlive() {
  try {
    const response = await net.fetch(`${API_ORIGIN}/health`, { method: 'GET' });
    return response.ok;
  } catch (_) {
    return false;
  }
}

const BACKEND_HINT_HTML = `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>本地后端未启动</title></head>
<body style="margin:0;background:#FEFFFA;color:#4A4038;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">
  <div style="max-width:520px;text-align:center;padding:32px">
    <h1 style="font-size:20px;margin:0 0 12px">本地后端未启动</h1>
    <p style="line-height:1.8;color:#7C6D67;margin:0 0 20px">IDE 需要连接本地服务 <code>${API_ORIGIN}</code>。${app.isPackaged ? '内置服务正在启动，请稍候。' : '请先在项目根目录启动后端。'}</p>
    <p id="retry-status" style="line-height:1.8;color:#A09A92;margin:0 0 20px;font-size:13px">正在自动检测后端，就绪后将自动进入应用…</p>
    <button onclick="window.ide && window.ide.quit()" style="padding:10px 22px;border-radius:10px;border:1px solid #C6BFB7;background:#F5F2EB;color:#4A4038;font-size:14px;cursor:pointer">退出</button>
  </div>
  <script>
    async function checkBackend() {
      try {
        const resp = await fetch('${API_ORIGIN}/health');
        if (resp.ok) {
          window.location.href = '${APP_SCHEME}://bundle/';
        }
      } catch (_) {}
    }
    checkBackend();
    setInterval(checkBackend, 3000);
  </script>
</body>
</html>`;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    title: APP_TITLE,
    backgroundColor: '#FEFFFA',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  adaptWindowToDisplay(mainWindow);

  const themeCss = fs.readFileSync(path.join(__dirname, 'paper-theme.css'), 'utf8');
  let loaded = false;
  let batchStarted = false;

  async function injectTheme() {
    try {
      await mainWindow.webContents.executeJavaScript(
        `(() => {
          const existing = document.getElementById('paper-theme');
          if (existing) existing.remove();
          const s = document.createElement('style');
          s.id = 'paper-theme';
          s.textContent = ${JSON.stringify(themeCss)};
          document.head.appendChild(s);
          return true;
        })()`
      );
    } catch (error) {
      console.error('[ide] theme injection failed:', error);
    }
  }

  async function navigateToPage(pagePath) {
    try {
      await mainWindow.webContents.executeJavaScript(
        `(() => {
          window.history.pushState({}, '', ${JSON.stringify(pagePath)});
          window.dispatchEvent(new PopStateEvent('popstate'));
          return window.location.pathname;
        })()`
      );
    } catch (error) {
      console.error('[ide] navigate failed:', error);
    }
  }

  mainWindow.webContents.on('did-finish-load', () => {
    applyZoom(uiSettings.zoomFactor);
    if (!loaded) {
      loaded = true;
      backendAlive().then((alive) => {
        if (!alive) {
          mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(BACKEND_HINT_HTML)}`);
        }
      });
    }
    injectTheme();
    mainWindow.setTitle(APP_TITLE);

    if (SCREENSHOT_PATH) {
      setTimeout(async () => {
        try {
          if (SCREENSHOT_PAGE) {
            await navigateToPage(SCREENSHOT_PAGE);
            await new Promise((resolve) => setTimeout(resolve, 2500));
          }
          const pageInfo = await mainWindow.webContents.executeJavaScript(
            `(() => {
              const styles = [...document.querySelectorAll('style')];
              const wb = document.querySelector('.workbench-app-shell');
              return JSON.stringify({
                bodyBg: getComputedStyle(document.body).backgroundColor,
                hasPaper: styles.some((s) => (s.textContent || '').includes('FEFFFA')),
                wbBg: wb ? getComputedStyle(wb).backgroundColor : 'no-shell'
              });
            })()`
          );
          console.log('[ide] page info:', pageInfo);
          const image = await mainWindow.webContents.capturePage();
          fs.writeFileSync(SCREENSHOT_PATH, image.toPNG());
          console.log(`[ide] screenshot saved: ${SCREENSHOT_PATH}`);
        } catch (error) {
          console.error('[ide] screenshot failed:', error);
        }
        app.exit(0);
      }, 4500);
    }

    if (SHOT_DIR && SHOT_PAGES.length && !batchStarted) {
      batchStarted = true;
      setTimeout(async () => {
        try {
          fs.mkdirSync(SHOT_DIR, { recursive: true });
          for (const page of SHOT_PAGES) {
            if (PRESET_BOOK_ID) {
              await mainWindow.webContents.executeJavaScript(
                `localStorage.setItem('currentBookId', ${JSON.stringify(PRESET_BOOK_ID)}); true`
              );
              await mainWindow.loadURL(`${APP_SCHEME}://bundle/`);
              await new Promise((resolve) => setTimeout(resolve, 3000));
            }
            await navigateToPage(page);
            await new Promise((resolve) => setTimeout(resolve, 2600));
            if (page === '/workbench') {
              const clickResult = await mainWindow.webContents.executeJavaScript(
                `(() => {
                  const tabs = [...document.querySelectorAll('.workbench-surface-tab, .workbench-surface-tabs button')];
                  const target = tabs.find((t) => /PROSE|正文/.test(t.textContent || ''));
                  if (target) {
                    target.click();
                    return 'clicked:' + target.textContent.trim().slice(0, 20);
                  }
                  return 'no-tab:' + tabs.map((t) => t.textContent.trim()).join(',');
                })()`
              );
              console.log(`[ide] page ${page} tabClick:`, clickResult);
              await new Promise((resolve) => setTimeout(resolve, 2200));
              const chapterResult = await mainWindow.webContents.executeJavaScript(
                `(() => {
                  const item = document.querySelector('.workbench-nav-chapter-item, .chapter-list-item');
                  if (item) {
                    item.click();
                    return 'clicked:' + item.textContent.trim().slice(0, 24);
                  }
                  return 'no-chapter';
                })()`
              );
              console.log(`[ide] page ${page} chapterClick:`, chapterResult);
              await new Promise((resolve) => setTimeout(resolve, 2200));
            }
            const scan = await mainWindow.webContents.executeJavaScript(DARK_SCAN_SCRIPT);
            console.log(`[ide] page ${page} dark:`, scan);
            const lightText = await mainWindow.webContents.executeJavaScript(LIGHT_TEXT_SCAN_SCRIPT);
            console.log(`[ide] page ${page} lightText:`, lightText);
            const styleScan = await mainWindow.webContents.executeJavaScript(STYLE_SCAN_SCRIPT);
            console.log(`[ide] page ${page} styleScan:`, styleScan);
            const proseScan = await mainWindow.webContents.executeJavaScript(PROSE_SCAN_SCRIPT);
            console.log(`[ide] page ${page} proseScan:`, proseScan);
            const image = await mainWindow.webContents.capturePage();
            const safe = page.replace(/[^a-zA-Z0-9]/g, '_') || 'home';
            fs.writeFileSync(path.join(SHOT_DIR, `page_${safe}.png`), image.toPNG());
          }
          console.log('[ide] batch screenshots done');
        } catch (error) {
          console.error('[ide] batch screenshots failed:', error);
        }
        app.exit(0);
      }, 4500);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(LOAD_URL || `${APP_SCHEME}://bundle/`);
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [{ role: 'appMenu' }]
      : [{ label: '文件', submenu: [{ role: 'quit', label: '退出' }] }]),
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        {
          label: '放大',
          accelerator: 'CmdOrCtrl+=',
          click: () => applyZoom(Math.round((uiSettings.zoomFactor + 0.1) * 100) / 100)
        },
        {
          label: '缩小',
          accelerator: 'CmdOrCtrl+-',
          click: () => applyZoom(Math.round((uiSettings.zoomFactor - 0.1) * 100) / 100)
        },
        {
          label: '实际大小（100%）',
          accelerator: 'CmdOrCtrl+0',
          click: () => applyZoom(1)
        },
        {
          type: 'checkbox',
          label: '自动适配显示比例',
          checked: uiSettings.autoFit,
          click: (item) => {
            uiSettings.autoFit = item.checked;
            saveSettings();
            if (item.checked && mainWindow && !mainWindow.isDestroyed()) {
              adaptWindowToDisplay(mainWindow);
            }
          }
        },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '窗口',
      submenu: [{ role: 'minimize', label: '最小化' }, { role: 'close', label: '关闭' }]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '打开项目目录',
          click: () => {
            shell.openPath(app.isPackaged ? app.getPath('userData') : path.resolve(__dirname, '..', '..'));
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  loadSettings();
  startBundledBackend();
  registerAppProtocol();
  injectApiCors();
  buildMenu();
  ipcMain.handle('ide:zoom:get', () => ({
    zoomFactor: uiSettings.zoomFactor,
    autoFit: uiSettings.autoFit
  }));
  ipcMain.handle('ide:zoom:set', (_event, factor) => {
    applyZoom(factor);
    return uiSettings.zoomFactor;
  });
  ipcMain.handle('ide:autofit:set', (_event, enabled) => {
    uiSettings.autoFit = enabled !== false;
    saveSettings();
    if (uiSettings.autoFit && mainWindow && !mainWindow.isDestroyed()) {
      adaptWindowToDisplay(mainWindow);
    }
    return uiSettings.autoFit;
  });
  ipcMain.on('ide:quit', () => {
    app.quit();
  });
  createWindow();

  screen.on('display-metrics-changed', (_event, _display, changedMetrics) => {
    if (!uiSettings.autoFit || !mainWindow || mainWindow.isDestroyed()) return;
    if (!changedMetrics || changedMetrics.some((metric) => ['bounds', 'workArea', 'scaleFactor'].includes(metric))) {
      adaptWindowToDisplay(mainWindow);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
    backendProcess = null;
  }
});
