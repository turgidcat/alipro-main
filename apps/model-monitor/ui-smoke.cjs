// Isolated UI verification: synthetic provider data only, no model/network charges.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { app, BrowserWindow, clipboard } = require('electron');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'alipro-monitor-ui-'));
process.env.ALIPRO_AI_MONITOR = '1';
process.env.ALIPRO_AI_MONITOR_DIR = scratch;
const monitor = require('../../backend/services/model-monitor');
const { createServer } = require('./server.cjs');
let server, win;
let originalClipboard;
async function until(expression) {
  for (let i = 0; i < 80; i++) {
    if (await win.webContents.executeJavaScript(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('UI condition timed out: ' + expression);
}
async function run() {
  originalClipboard = clipboard.readText();
  const failures = [];
  await monitor.withContext({ bookTitle: '界面验收演示 · 非真实生成', bookId: 'demo-only', chapter: '11', route: 'DEMO /generate' }, async () => {
    const input = '【本章任务】\n从上章已经掌握的线索继续行动，不要重新发现同一条信息。\n【角色状态】\n主角左腿受伤，行动受到限制。\n';
    for (const extra of ['', '\n【补充约束】\n角色状态不得无故恢复。\n角色状态不得无故恢复。']) {
      const call = monitor.startCall({ pointId: 'chapter.generate', provider: 'demo', request: { model: '模拟模型 · 不联网', messages: [{ role: 'system', content: '你是小说创作助手。保持既有事实连续。' }, { role: 'user', content: input + extra }], max_tokens: 4000, temperature: 0.7 } });
      call.finish({ choices: [{ message: { content: '【界面验收样例，不是真实模型输出】\n他没有停下脚步。上一章确认的线索给了他方向，伤腿却使每一步都更加艰难。\n<script>window.untrustedExecuted=true</script>' }, finish_reason: 'stop' }], usage: { prompt_tokens: 220, completion_tokens: 70 } });
      await new Promise(resolve => setTimeout(resolve, 12));
    }
  });
  await monitor.flush();
  const launched = createServer({ dir: scratch }); server = launched.server;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  win = new BrowserWindow({ width: 1460, height: 1100, show: false, webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false } });
  win.webContents.on('console-message', (event, level, message) => { if (level >= 3) failures.push(message); });
  const downloads = [];
  win.webContents.session.on('will-download', (event, item) => {
    const target = path.join(scratch, item.getFilename()); item.setSavePath(target);
    item.once('done', (_, state) => downloads.push({ target, state }));
  });
  await win.loadURL(`http://127.0.0.1:${server.address().port}/#${launched.token}`);
  await until("document.querySelectorAll('.call').length === 2 && !document.getElementById('detail').hidden");
  await win.webContents.executeJavaScript("document.getElementById('pause').click(); document.querySelector('#tabs [data-tab=\"compare\"]').click(); document.getElementById('compareButton').click();");
  await until("document.getElementById('diff').textContent.includes('变化')");
  assert.ok(await win.webContents.executeJavaScript("document.getElementById('diff').textContent.includes('角色状态不得无故恢复')"));
  await win.webContents.executeJavaScript("document.getElementById('memo').value='验收备注：请检查重复输入'; document.getElementById('copy').click();", true);
  await until("document.getElementById('notice').textContent.includes('已复制')");
  assert.ok(clipboard.readText().includes('验收备注：请检查重复输入'));
  assert.ok(clipboard.readText().includes('实际输入'));
  await win.webContents.executeJavaScript("document.getElementById('export').click();", true);
  for (let i = 0; i < 30 && !downloads.length; i++) await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(downloads[0]?.state, 'completed');
  assert.ok(JSON.parse(fs.readFileSync(downloads[0].target)).request.messages.length === 2);
  await win.webContents.executeJavaScript("document.getElementById('matrixToggle').click()");
  assert.equal(await win.webContents.executeJavaScript("document.querySelectorAll('#matrixRows [data-point-id]').length"), 38);
  assert.equal(await win.webContents.executeJavaScript("document.querySelectorAll('.matrix-group').length"), 8);
  assert.equal(await win.webContents.executeJavaScript("new Set(Array.from(document.querySelectorAll('[data-point-id]'), e=>e.dataset.pointId)).size"), 38);
  await win.webContents.executeJavaScript("document.querySelector('#matrixCategories [data-category=\"outline\"]').click()");
  assert.equal(await win.webContents.executeJavaScript("document.querySelectorAll('#matrixRows [data-point-id]').length"), 6);
  assert.equal(await win.webContents.executeJavaScript("document.querySelector('.matrix-group').open"), true);
  await win.webContents.executeJavaScript("document.getElementById('matrixSearch').value='事件密度'; document.getElementById('matrixSearch').dispatchEvent(new Event('input'))");
  assert.equal(await win.webContents.executeJavaScript("document.querySelectorAll('#matrixRows [data-point-id]').length"), 1);
  await win.webContents.executeJavaScript("document.getElementById('copyMatrix').click()", true);
  await until("document.getElementById('notice').textContent.includes('已复制')");
  assert.ok(clipboard.readText().includes('## 章节细纲'));
  assert.ok(clipboard.readText().includes('outline.density'));
  assert.equal(clipboard.readText().includes('chapter.generate'), false);
  await win.webContents.executeJavaScript("document.getElementById('matrixSearch').value=''; document.getElementById('matrixSearch').dispatchEvent(new Event('input')); document.querySelector('#matrixCategories [data-category=\"all\"]').click(); document.getElementById('matrixCollapse').click()");
  assert.equal(await win.webContents.executeJavaScript("document.querySelectorAll('.matrix-group[open]').length"), 0);
  await win.webContents.executeJavaScript('drawMatrix()');
  assert.equal(await win.webContents.executeJavaScript("document.querySelectorAll('.matrix-group[open]').length"), 0);
  await win.webContents.executeJavaScript("document.getElementById('matrixExpand').click()");
  assert.equal(await win.webContents.executeJavaScript("document.querySelectorAll('.matrix-group[open]').length"), 8);
  await win.webContents.executeJavaScript("document.getElementById('matrixCollapse').click(); document.querySelector('#matrixCategories [data-category=\"chapter\"]').click()");
  await new Promise(resolve => setTimeout(resolve, 200));
  const matrixScreenshotDir = path.resolve(__dirname, '../../artifacts/model-monitor'); fs.mkdirSync(matrixScreenshotDir, { recursive: true });
  fs.writeFileSync(path.join(matrixScreenshotDir, 'monitor-matrix.png'), (await win.capturePage()).toPNG());
  await win.webContents.executeJavaScript("document.querySelector('#matrixCategories [data-category=\"all\"]').click()");
  await win.webContents.executeJavaScript("document.getElementById('matrixToggle').click(); document.querySelector('#tabs [data-tab=\"output\"]').click()");
  assert.equal(await win.webContents.executeJavaScript('window.untrustedExecuted'), undefined);
  await win.webContents.executeJavaScript("document.querySelector('#tabs [data-tab=\"input\"]').click()");
  await new Promise(resolve => setTimeout(resolve, 200));
  const screenshotDir = path.resolve(__dirname, '../../artifacts/model-monitor'); fs.mkdirSync(screenshotDir, { recursive: true });
  fs.writeFileSync(path.join(screenshotDir, 'monitor-detail.png'), (await win.capturePage()).toPNG());
  await win.webContents.executeJavaScript("document.querySelector('#tabs [data-tab=\"compare\"]').click(); document.getElementById('screenshot').click()");
  assert.equal(await win.webContents.executeJavaScript("getComputedStyle(document.querySelector('aside')).display"), 'none');
  await new Promise(resolve => setTimeout(resolve, 200));
  fs.writeFileSync(path.join(screenshotDir, 'monitor-compare.png'), (await win.capturePage()).toPNG());
  assert.deepEqual(failures, []);
  console.log('UI PASS: list, input/output, comparison, clipboard, JSON download, 8 matrix categories / 38 unique points, category search/copy, persistent collapse, screenshot mode, output escaping; screenshots: ' + screenshotDir);
}
app.whenReady().then(run).catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (win) win.destroy(); if (server) await new Promise(resolve => server.close(resolve));
  if (originalClipboard !== undefined) clipboard.writeText(originalClipboard);
  await monitor.flush(); fs.rmSync(scratch, { recursive: true, force: true }); app.exit(process.exitCode || 0);
});
