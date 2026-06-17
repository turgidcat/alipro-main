const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CHANGELOG_FILE = path.join(ROOT, 'docs', 'changelog.json');
const VERSION_FILE = path.join(ROOT, 'version.json');
const BUMP_SCRIPT = path.join(__dirname, 'bump-version.js');

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function compareDate(a, b) {
  return String(a || '').localeCompare(String(b || ''));
}

function normalizeRelease(release = {}) {
  return {
    version: String(release.version || '').trim(),
    date: String(release.date || '').trim(),
    title: String(release.title || '').trim(),
    summary: String(release.summary || '').trim(),
    groups: Array.isArray(release.groups) ? release.groups : []
  };
}

function collectChangedGroups(release, lastUpdated) {
  const changedGroups = [];

  for (const group of Array.isArray(release.groups) ? release.groups : []) {
    const items = Array.isArray(group.items) ? group.items : [];
    const changedItems = items.filter((item) => {
      const itemDate = String(item?.date || '').trim();
      const itemStatus = String(item?.status || '').trim();
      return itemStatus === 'done' && compareDate(itemDate, lastUpdated) > 0;
    });

    if (changedItems.length > 0) {
      changedGroups.push({
        category: String(group.category || '').trim(),
        title: String(group.title || '').trim(),
        items: changedItems
      });
    }
  }

  return changedGroups;
}

function decideBumpType(groups) {
  if (groups.some((group) => group.category === 'feature')) {
    return 'minor';
  }
  return 'patch';
}

function buildBumpTitle(groups) {
  const parts = groups.map((group) => group.title).filter(Boolean);
  const unique = Array.from(new Set(parts));
  return unique.length > 0 ? `${unique.join(' / ')} 自动升级` : '常规更新';
}

function updateReleaseVersion(oldVersion, newVersion) {
  const changelog = readJson(CHANGELOG_FILE, { releases: [] });
  const releases = Array.isArray(changelog.releases) ? changelog.releases.map(normalizeRelease) : [];
  const target = releases.find((release) => release.version === oldVersion);
  if (!target) {
    return;
  }

  target.version = newVersion;
  target.title = `v${newVersion} 更新记录`;
  changelog.releases = releases;
  changelog.updatedAt = new Date().toISOString();
  writeJson(CHANGELOG_FILE, changelog);
}

function main() {
  const apply = process.argv.includes('--apply');
  const versionInfo = readJson(VERSION_FILE, {});
  const changelog = readJson(CHANGELOG_FILE, { releases: [] });
  const currentVersion = String(versionInfo.version || '').trim();
  const lastUpdated = String(versionInfo.lastUpdated || '').trim();
  const releases = Array.isArray(changelog.releases) ? changelog.releases.map(normalizeRelease) : [];
  const targetRelease = releases.find((release) => release.version === currentVersion) || releases[0] || null;

  if (!targetRelease) {
    console.log('无需升级：未找到可判定的版本日志。');
    return;
  }

  const changedGroups = collectChangedGroups(targetRelease, lastUpdated);
  if (changedGroups.length === 0) {
    console.log('无需升级：自上次版本日期以来没有新的已完成更新。');
    return;
  }

  const bumpType = decideBumpType(changedGroups);
  const bumpTitle = buildBumpTitle(changedGroups);

  if (!apply) {
    console.log(`建议升级：${bumpType}`);
    console.log(`当前版本：${currentVersion}`);
    console.log(`建议标题：${bumpTitle}`);
    console.log(`说明：检测到 ${changedGroups.map((group) => group.title).join('、')} 分类的已完成更新。`);
    console.log('major 版本不会自动升级，需要手动决定。');
    return;
  }

  execFileSync(process.execPath, [BUMP_SCRIPT, bumpType, bumpTitle], {
    cwd: ROOT,
    stdio: 'inherit'
  });

  const newVersionInfo = readJson(VERSION_FILE, {});
  const newVersion = String(newVersionInfo.version || '').trim();
  if (newVersion && newVersion !== currentVersion) {
    updateReleaseVersion(currentVersion, newVersion);
  }

  console.log(`自动升级完成：${currentVersion} -> ${newVersionInfo.version}`);
  console.log('major 版本仍需手动决定，不会自动触发。');
}

main();
