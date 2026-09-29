const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const packages = ['backend', 'apps/web', 'apps/android', 'apps/windows'];
const gradlePath = 'apps/android/android/app/build.gradle';
function read(root, file) { return fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''); }
function json(root, file) { return JSON.parse(read(root, file)); }
function normalized(file, content) {
  if (file.endsWith('package.json') || file.endsWith('package-lock.json')) {
    const data = JSON.parse(content);
    delete data.version;
    if (data.packages?.['']) delete data.packages[''].version;
    return JSON.stringify(data);
  }
  if (file === gradlePath) return content.replace(/versionCode\s+\d+/, 'versionCode AUTO').replace(/versionName\s+"[^"]+"/, 'versionName "AUTO"');
  return content;
}
function fingerprint(root) {
  // Git also lists new, uncommitted files; ignored build outputs and secrets stay out.
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, maxBuffer: 32 * 1024 * 1024 }).toString().split('\0');
  const hash = crypto.createHash('sha256');
  for (const file of [...new Set(files)].sort()) {
    if (!/^(apps\/|backend\/|shared\/|scripts\/|package.json$)/.test(file)) continue;
    if (/(^|\/)(node_modules|dist|www|release|build|\.gradle|\.git|data|logs|backups)(\/|$)/.test(file)) continue;
    if (/\.(md|bak|db|sqlite|log)$/i.test(file) || /(^|\/)\.env/.test(file)) continue;
    if (/^apps\/windows\/(preview-|shots)/.test(file)) continue;
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    const content = fs.readFileSync(absolute);
    hash.update(file).update('\0').update(/package(-lock)?\.json$/.test(file) || file === gradlePath ? normalized(file, content.toString('utf8')) : content).update('\0');
  }
  return hash.digest('hex');
}
function prepare(root, apply = false) {
  const lock = path.join(root, '.release-version.lock');
  let fd;
  try { fd = fs.openSync(lock, 'wx'); } catch { throw new Error('版本更新正在进行，或上次异常中断留下 .release-version.lock；请确认没有构建在运行后重试。'); }
  try {
    const info = json(root, 'version.json');
    if (!/^\d+\.\d+\.\d+$/.test(info.version)) throw new Error('version.json 必须使用 major.minor.patch');
    const digest = fingerprint(root);
    const changed = digest !== info.sourceFingerprint;
    const parts = info.version.split('.').map(Number);
    if (changed) parts[2]++;
    const next = parts.join('.');
    const writes = new Map();
    const putJson = (file, data) => writes.set(file, JSON.stringify(data, null, 2) + '\n');
    for (const dir of packages) {
      for (const name of ['package.json', 'package-lock.json']) {
        const file = `${dir}/${name}`;
        if (!fs.existsSync(path.join(root, file))) continue;
        const data = json(root, file);
        // Never silently lower an independently increased product version.
        const current = String(data.version || '').split('.').map(Number);
        if (current.length === 3 && current.every(Number.isFinite)) {
          const comparison = current.reduce((result, value, i) => result || Math.sign(value - parts[i]), 0);
          if (comparison > 0) throw new Error(`${file} 版本高于总版本，请先校准 version.json`);
        }
        data.version = next;
        if (data.packages?.['']) data.packages[''].version = next;
        putJson(file, data);
      }
    }
    const gradle = read(root, gradlePath);
    const code = Number(gradle.match(/versionCode\s+(\d+)/)?.[1]);
    if (!code || !/versionName\s+"[^"]+"/.test(gradle)) throw new Error('无法读取 Android 版本');
    writes.set(gradlePath, gradle.replace(/versionCode\s+\d+/, `versionCode ${code + (changed ? 1 : 0)}`).replace(/versionName\s+"[^"]+"/, `versionName "${next}"`));
    if (changed) {
      const date = new Date().toISOString().slice(0, 10);
      info.version = next;
      info.lastUpdated = date;
      info.sourceFingerprint = digest;
      info.history = [{ version: next, date, type: 'patch', title: '源码变化自动生成构建版本（未代表部署）' }, ...(info.history || [])];
      putJson('version.json', info);
      const log = json(root, 'docs/changelog.json');
      log.updatedAt = new Date().toISOString();
      log.releases = [{ version: next, date, title: `v${next} 构建版本`, summary: '检测到源码变化，自动预留构建版本；构建成功和上线状态需另行验证。', groups: [] }, ...(log.releases || [])];
      putJson('docs/changelog.json', log);
    }
    if (apply) for (const [file, content] of writes) {
      if (read(root, file) !== content) fs.writeFileSync(path.join(root, file), content);
    }
    console.log(`[version] ${apply ? '已同步' : '检查'} ${next}；${changed ? '源码变化，递增一次' : '源码未变，不重复升级'}`);
    return { version: next, changed };
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
if (require.main === module) prepare(path.resolve(__dirname, '..'), process.argv.includes('--apply'));
module.exports = { prepare, fingerprint };
