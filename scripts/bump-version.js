const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BACKEND_PACKAGE = path.join(ROOT, 'backend', 'package.json');
const VERSION_JSON = path.join(ROOT, 'version.json');
const DOCS_CHANGELOG_JSON = path.join(ROOT, 'docs', 'changelog.json');

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

if (fs.existsSync(DOCS_CHANGELOG_JSON)) {
  const changelog = JSON.parse(readText(DOCS_CHANGELOG_JSON));
  const releases = Array.isArray(changelog.releases) ? changelog.releases : [];

  if (releases.length > 0 && releases[0].version === oldVersion) {
    releases[0].version = newVersion;
    releases[0].date = dateCN;

    if (typeof releases[0].title === 'string') {
      releases[0].title = releases[0].title.replace(`v${oldVersion}`, `v${newVersion}`);
    }

    writeText(DOCS_CHANGELOG_JSON, `${JSON.stringify(changelog, null, 2)}\n`);
    console.log(`✓ docs/changelog.json: ${oldVersion} -> ${newVersion}`);
  } else {
    console.log('! docs/changelog.json latest release did not match current version, skipped');
  }
}

console.log(`\nDone: ${oldVersion} -> ${newVersion} (${bumpType})`);
console.log(`Title: ${changelogTitle}`);
