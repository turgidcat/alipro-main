const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');
const root = path.resolve(__dirname, '../..');
app.on('browser-window-created', (_, window) => window.hide());
app.on('before-quit', event => event.preventDefault());
require(path.join(root, 'apps/windows/src/main.cjs'));
async function until(win, code) {
  for (let i = 0; i < 100; i++) {
    try { if (await win.webContents.executeJavaScript(code)) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('timeout: ' + code);
}
app.whenReady().then(async () => {
  const main = BrowserWindow.getAllWindows()[0];
  await until(main, "document.querySelector('.model-monitor-open') && window.ide?.apiOrigin");
  assert.equal(await main.webContents.executeJavaScript('window.ide.apiOrigin'), process.env.ALIPRO_API_ORIGIN);
  assert.equal(await main.webContents.executeJavaScript('window.ide.experiment'), true);
  assert.ok(await main.webContents.executeJavaScript("document.body.textContent.includes('作品副本') && document.body.textContent.includes('本地实验')"));
  // Fetch from the frontend's selected runtime endpoint, then read a real book plan.
  const data = await main.webContents.executeJavaScript("fetch(window.ide.apiOrigin + '/books').then(r=>r.json())");
  assert.ok(JSON.stringify(data).includes('血裔迷途'));
  await main.webContents.executeJavaScript('window.ide.openModelMonitor()');
  assert.equal(BrowserWindow.getAllWindows().length, 2);
  let observer = BrowserWindow.getAllWindows().find(w => w !== main);
  observer.hide();
  await until(observer, "document.getElementById('source').textContent.includes('正在采集')");
  assert.equal(await observer.webContents.executeJavaScript('typeof window.ide'), 'undefined');
  assert.ok(await observer.webContents.executeJavaScript("document.getElementById('clientSource').textContent.includes('客户端连接本地后端')"));
  await main.webContents.executeJavaScript('window.ide.openModelMonitor()');
  assert.equal(BrowserWindow.getAllWindows().length, 2);
  const oldObserver = observer;
  observer.close();
  await main.webContents.executeJavaScript('window.ide.openModelMonitor()');
  observer = BrowserWindow.getAllWindows().find(w => w !== main);
  assert.notEqual(observer.id, oldObserver.id);
  observer.hide();
  await until(observer, "document.getElementById('connection').textContent === '实时读取'");
  // Ensure the real React API layer reads local data, not just an isolated fetch.
  await main.webContents.executeJavaScript("[...document.querySelectorAll('.ide-nav-item')].find(b=>b.textContent.includes('资料库')).click()");
  await until(main, "document.body.textContent.includes('血裔迷途')");
  assert.ok(!await main.webContents.executeJavaScript("document.body.textContent.includes('透视商途')"));
  await main.webContents.executeJavaScript("[...document.querySelectorAll('.ide-nav-item')].find(b=>b.textContent.includes('模型观察台')).click()");
  await until(main, "document.querySelector('.model-monitor-open') && [...document.querySelectorAll('.ide-nav-item.is-active')].some(b=>b.textContent.includes('模型观察台'))");
  fs.writeFileSync(path.join(__dirname, 'desktop-integration.png'), (await main.webContents.capturePage()).toPNG());
  observer.show();
  await new Promise(r => setTimeout(r, 600));
  fs.writeFileSync(path.join(__dirname, 'desktop-observer.png'), (await observer.webContents.capturePage()).toPNG());
  await new Promise(resolve => { main.once('closed', resolve); main.close(); });
  assert.ok(observer.isDestroyed());
  const packagedResources = path.join(root, 'apps/windows/release/win-unpacked/resources');
  Object.defineProperty(process, 'resourcesPath', { value: packagedResources });
  const packedReader = require(path.join(root, 'apps/windows/src/model-monitor-window.cjs')).createModelMonitorWindow({
    app: { isPackaged: true }, BrowserWindow, parent: () => null,
    apiOrigin: process.env.ALIPRO_API_ORIGIN, dir: process.env.ALIPRO_AI_MONITOR_DIR
  });
  await packedReader.open();
  const packedWindow = BrowserWindow.getAllWindows()[0];
  await until(packedWindow, "document.getElementById('connection').textContent === '实时读取'");
  assert.ok(await packedWindow.webContents.executeJavaScript("document.querySelector('.eyebrow').textContent.includes('0.1.2')"));
  packedReader.close();
  assert.ok(packedWindow.isDestroyed());
  console.log('PASS: runtime API, local book copy, real React navigation/data, native singleton/reopen, heartbeat, no observer bridge, main-close cleanup, packaged observer resources');
  app.exit(0);
}).catch(error => { console.error(error.stack); app.exit(1); });
