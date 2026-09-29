const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { prepare } = require('./release-version.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'alipro-version-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  function write(file, data) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), typeof data === 'string' ? data : JSON.stringify(data));
  }
  const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  write('version.json', { version: '1.9.0', history: [] });
  write('docs/changelog.json', { releases: [] });
  for (const dir of ['backend', 'apps/web', 'apps/android', 'apps/windows']) {
    write(`${dir}/package.json`, { version: '1.4.0' });
    write(`${dir}/package-lock.json`, { version: '1.4.0', packages: { '': { version: '1.4.0' } } });
  }
  write('apps/android/android/app/build.gradle', 'versionCode 10\nversionName "1.9-old"');
  write('apps/web/src/main.js', 'initial');
  execFileSync('git', ['init', '-q'], { cwd: root });
  return { root, write, read };
}
test('dry check does not write; first build syncs all versions; repeated builds and retry reuse version', t => {
  const { root, read } = fixture(t);
  assert.equal(prepare(root).version, '1.9.1');
  assert.equal(read('version.json').version, '1.9.0');
  assert.equal(prepare(root, true).version, '1.9.1');
  for (const dir of ['backend', 'apps/web', 'apps/android', 'apps/windows']) {
    assert.equal(read(`${dir}/package.json`).version, '1.9.1');
    assert.equal(read(`${dir}/package-lock.json`).packages[''].version, '1.9.1');
  }
  assert.equal(prepare(root, true).changed, false);
  assert.equal(read('version.json').history.length, 1);
  assert.match(fs.readFileSync(path.join(root, 'apps/android/android/app/build.gradle'), 'utf8'), /versionCode 11/);
});
test('uncommitted source edit increments; generated outputs do not', t => {
  const { root, write } = fixture(t);
  prepare(root, true);
  write('apps/web/dist/output.js', 'generated');
  assert.equal(prepare(root, true).changed, false);
  write('apps/web/src/main.js', 'changed');
  assert.equal(prepare(root, true).version, '1.9.2');
  fs.unlinkSync(path.join(root, 'apps/web/src/main.js'));
  assert.equal(prepare(root, true).version, '1.9.3');
});
test('higher product version is rejected without partial writes', t => {
  const { root, write, read } = fixture(t);
  write('apps/windows/package.json', { version: '2.0.0' });
  assert.throws(() => prepare(root, true), /高于总版本/);
  assert.equal(read('backend/package.json').version, '1.4.0');
  assert.equal(read('version.json').version, '1.9.0');
});
test('concurrent update fails closed', t => {
  const { root, write } = fixture(t);
  write('.release-version.lock', '');
  assert.throws(() => prepare(root, true), /版本更新正在进行/);
});
