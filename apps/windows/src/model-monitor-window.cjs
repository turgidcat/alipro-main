const path = require('node:path');

// The observer has no preload or Node access. Its reader stays on a random loopback port.
function createModelMonitorWindow({ app, BrowserWindow, parent, apiOrigin, dir }) {
  let window = null, reader = null, opening = null;
  const serverModule = app.isPackaged
    ? path.join(process.resourcesPath, 'model-observer', 'apps', 'model-monitor', 'server.cjs')
    : path.resolve(__dirname, '../../model-monitor/server.cjs');
  async function open() {
    if (window && !window.isDestroyed()) { window.show(); window.focus(); return; }
    if (opening) return opening;
    opening = (async () => {
      if (!reader) {
        reader = require(serverModule).createServer({ dir, client: { apiOrigin } });
        await new Promise((resolve, reject) => {
          reader.server.once('error', reject);
          reader.server.listen(0, '127.0.0.1', resolve);
        }).catch(error => { reader.server.close(); reader = null; throw error; });
      }
      const origin = `http://127.0.0.1:${reader.server.address().port}`;
      window = new BrowserWindow({
        width: 1380, height: 920, minWidth: 850, minHeight: 600,
        title: 'ALIPRO · 模型调用观察台', backgroundColor: '#f6f8f5',
        parent: parent(), show: false, autoHideMenuBar: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, partition: 'model-observer' }
      });
      const opened = window;
      opened.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      opened.webContents.on('will-navigate', (event, url) => {
        if (new URL(url).origin !== origin) event.preventDefault();
      });
      opened.on('closed', () => { if (window === opened) window = null; });
      try {
        await opened.loadURL(`${origin}/#${reader.token}`);
        opened.show();
      } catch (error) { opened.destroy(); throw error; }
    })();
    try { await opening; } finally { opening = null; }
  }
  function close() {
    if (window && !window.isDestroyed()) window.destroy();
    reader?.server.close(); reader = null;
  }
  return { open, close };
}
module.exports = { createModelMonitorWindow };
