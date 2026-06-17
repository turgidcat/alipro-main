const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CHANGELOG_FILE = path.join(ROOT, 'docs', 'changelog.json');
const VERSION_FILE = path.join(ROOT, 'version.json');

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readArg(name) {
  const prefix = `--${name}=`;
  const matched = process.argv.find((arg) => arg.startsWith(prefix));
  return matched ? matched.slice(prefix.length).trim() : '';
}

function normalizeItem(item = {}) {
  return {
    date: String(item.date || '').trim(),
    title: String(item.title || '').trim(),
    summary: String(item.summary || '').trim(),
    details: Array.isArray(item.details)
      ? item.details.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [],
    status: String(item.status || 'draft').trim(),
    source: String(item.source || 'daily').trim()
  };
}

function normalizeGroup(group = {}) {
  return {
    category: String(group.category || 'improve').trim(),
    title: String(group.title || '').trim(),
    items: Array.isArray(group.items) ? group.items.map(normalizeItem) : []
  };
}

function normalizeRelease(release = {}) {
  return {
    version: String(release.version || '').trim(),
    date: String(release.date || '').trim(),
    title: String(release.title || '').trim(),
    summary: String(release.summary || '').trim(),
    groups: Array.isArray(release.groups) ? release.groups.map(normalizeGroup) : []
  };
}

const categoryTitleMap = {
  feature: '新功能',
  fix: '修复',
  improve: '完善',
  important: '重要',
  docs: '文档'
};

const date = readArg('date') || getTodayString();
const title = readArg('title') || '今日施工记录待补充';
const summary = readArg('summary') || '已自动创建今日日志草稿，待补充实际施工内容。';
const detailArgs = process.argv
  .filter((arg) => arg.startsWith('--detail='))
  .map((arg) => arg.slice('--detail='.length).trim())
  .filter(Boolean);
const category = readArg('type') || 'improve';
const status = readArg('status') || 'draft';

const versionInfo = readJson(VERSION_FILE, {});
const changelog = readJson(CHANGELOG_FILE, { releases: [] });
const version = String(readArg('version') || versionInfo.version || '').trim();
const releases = Array.isArray(changelog.releases) ? changelog.releases.map(normalizeRelease) : [];

let release = releases.find((item) => item.version === version);
if (!release) {
  release = normalizeRelease({
    version,
    date,
    title: version ? `v${version} 更新记录` : '未命名版本更新记录',
    summary: '待补充本版本更新概述。',
    groups: []
  });
  releases.unshift(release);
}

if (!release.date || date > release.date) {
  release.date = date;
}

let group = release.groups.find((item) => item.category === category);
if (!group) {
  group = normalizeGroup({
    category,
    title: categoryTitleMap[category] || category,
    items: []
  });
  release.groups.push(group);
}

const existingItem = group.items.find((item) => item.date === date && item.title === title);
if (existingItem) {
  existingItem.summary = existingItem.summary || summary;
  existingItem.status = existingItem.status === 'done' ? 'done' : status;
  existingItem.details = Array.from(new Set([
    ...existingItem.details,
    ...detailArgs
  ]));
  console.log(`更新已有日志：${version || '未命名版本'} ${date}`);
} else {
  group.items.unshift(normalizeItem({
    date,
    title,
    summary,
    details: detailArgs.length > 0 ? detailArgs : ['待补充今日实际施工内容'],
    status,
    source: 'daily'
  }));
  console.log(`创建今日日志草稿：${version || '未命名版本'} ${date}`);
}

release.groups.forEach((entryGroup) => {
  entryGroup.items.sort((a, b) => {
    if (a.date !== b.date) return String(b.date).localeCompare(String(a.date));
    return String(a.title).localeCompare(String(b.title));
  });
});

releases.sort((a, b) => {
  const versionCompare = String(b.version).localeCompare(String(a.version), undefined, { numeric: true });
  if (versionCompare !== 0) return versionCompare;
  return String(b.date).localeCompare(String(a.date));
});

changelog.releases = releases;
changelog.updatedAt = new Date().toISOString();
writeJson(CHANGELOG_FILE, changelog);
