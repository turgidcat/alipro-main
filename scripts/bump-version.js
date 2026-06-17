const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const BACKEND_PACKAGE = path.join(ROOT, 'backend', 'package.json');
const VERSION_JSON = path.join(ROOT, 'version.json');
const INDEX_HTML = path.join(FRONTEND, 'index.html');
const CHANGELOG_HTML = path.join(FRONTEND, 'changelog.html');
const HTML_FILES = [
  'index.html',
  'database-view.html',
  'changelog.html',
  'start-guide.html'
].map((name) => path.join(FRONTEND, name));

const bumpType = process.argv[2] || 'patch';
const changelogTitle = process.argv.slice(3).join(' ') || '常规更新';

if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('错误: 版本类型必须是 patch / minor / major');
  process.exit(1);
}

function bumpSemver(version, type) {
  const parts = version.split('.').map(Number);
  switch (type) {
    case 'major':
      return [parts[0] + 1, 0, 0].join('.');
    case 'minor':
      return [parts[0], parts[1] + 1, 0].join('.');
    default:
      return [parts[0], parts[1], parts[2] + 1].join('.');
  }
}

function writeText(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

const backendPkg = JSON.parse(readText(BACKEND_PACKAGE));
const oldVersion = backendPkg.version;
const newVersion = bumpSemver(oldVersion, bumpType);

backendPkg.version = newVersion;
writeText(BACKEND_PACKAGE, `${JSON.stringify(backendPkg, null, 2)}\n`);
console.log(`✓ backend/package.json: ${oldVersion} -> ${newVersion}`);

const now = new Date();
const date8 = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
const dateCN = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

if (fs.existsSync(VERSION_JSON)) {
  const versionInfo = JSON.parse(readText(VERSION_JSON));
  versionInfo.version = newVersion;
  versionInfo.lastUpdated = dateCN;
  versionInfo.history = versionInfo.history || [];
  versionInfo.history.unshift({
    version: newVersion,
    date: dateCN,
    type: bumpType,
    title: changelogTitle
  });
  writeText(VERSION_JSON, `${JSON.stringify(versionInfo, null, 2)}\n`);
  console.log(`✓ version.json: ${oldVersion} -> ${newVersion}`);
}

const sampleHtml = readText(INDEX_HTML);
const currentMatch = sampleHtml.match(/\?v=(\d{8})(\d{2,})/);
let newCacheVersion = `${date8}01`;

if (currentMatch) {
  const [, oldDate, oldSeqRaw] = currentMatch;
  const oldSeq = Number(oldSeqRaw);
  newCacheVersion = oldDate === date8
    ? `${date8}${String(oldSeq + 1).padStart(oldSeqRaw.length, '0')}`
    : `${date8}${'01'}`;
}

for (const filePath of HTML_FILES) {
  if (!fs.existsSync(filePath)) continue;
  const original = readText(filePath);
  const updated = original.replace(/\?v=\d+/g, `?v=${newCacheVersion}`);
  if (updated !== original) {
    writeText(filePath, updated);
  }
}
console.log(`✓ HTML resource cache version: ?v=${newCacheVersion}`);

if (fs.existsSync(INDEX_HTML)) {
  const original = readText(INDEX_HTML);
  const comment = `<!-- Version: ${dateCN}-v${newVersion} -->`;
  const updated = original.replace(/<!-- Version: .*? -->/, comment);
  writeText(INDEX_HTML, updated);
  console.log(`✓ frontend/index.html version comment updated`);
}

if (fs.existsSync(CHANGELOG_HTML)) {
  const original = readText(CHANGELOG_HTML);
  const tagMap = {
    major: 'tag-important',
    minor: 'tag-feature',
    patch: 'tag-fix'
  };
  const tagClass = tagMap[bumpType];
  const entry = `<div class="version-item">
            <div style="display: flex; align-items: center; flex-wrap: wrap;">
                <span class="version-tag ${tagClass}">v${newVersion}</span>
                <span class="version-date">${dateCN}</span>
            </div>
            <h3>${changelogTitle}</h3>
            <ul class="feature-list">
                <li>版本更新</li>
            </ul>
        </div>`;

  const pattern = /(<h2>最新版本<\/h2>)(\s*)(<div class="version-item">)/;
  const updated = pattern.test(original)
    ? original.replace(pattern, `$1$2${entry}$2$3`)
    : original;

  if (updated !== original) {
    writeText(CHANGELOG_HTML, updated);
    console.log(`✓ frontend/changelog.html appended v${newVersion}`);
  } else {
    console.log('! frontend/changelog.html did not match expected insert position');
  }
}

console.log(`\nDone: ${oldVersion} -> ${newVersion} (${bumpType})`);
console.log(`Title: ${changelogTitle}`);
console.log(`Cache: ?v=${newCacheVersion}`);
