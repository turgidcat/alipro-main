const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CHANGELOG_FILE = path.join(ROOT, 'docs', 'changelog.json');
const VERSION_FILE = path.join(ROOT, 'version.json');
const THRESHOLD_HOURS = 24;

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function runGit(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8'
  }).trim();
}

function parseCommitLine(line) {
  const [hash, isoDate, subject] = line.split('\t');
  return {
    hash: String(hash || '').trim(),
    isoDate: String(isoDate || '').trim(),
    subject: String(subject || '').trim()
  };
}

function getHeadCommit() {
  return parseCommitLine(runGit(['log', '-1', '--date=iso-strict', '--pretty=format:%H%x09%ad%x09%s']));
}

function getCommitsAfter(hash) {
  if (!hash) return [];
  const output = runGit(['log', '--reverse', '--date=iso-strict', '--pretty=format:%H%x09%ad%x09%s', `${hash}..HEAD`]);
  return output ? output.split(/\r?\n/).filter(Boolean).map(parseCommitLine) : [];
}

function hoursBetween(leftIso, rightIso) {
  const left = new Date(leftIso).getTime();
  const right = new Date(rightIso).getTime();
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 0;
  return Math.abs(right - left) / 36e5;
}

function classifyCommit(subject) {
  if (/^feat/i.test(subject)) return 'feature';
  if (/^fix/i.test(subject)) return 'fix';
  if (/^docs/i.test(subject)) return 'docs';
  return 'improve';
}

function categoryTitle(category) {
  return {
    feature: '新功能',
    fix: '修复',
    docs: '说明更新',
    improve: '完善'
  }[category] || '完善';
}

function userFacingTitle(subject) {
  return String(subject || '')
    .replace(/^(feat|fix|docs|chore|refactor|merge)(\([^)]+\))?:\s*/i, '')
    .replace(/^Update\s+/i, '更新')
    .trim() || '项目更新';
}

function userFacingSummary(commit) {
  const title = userFacingTitle(commit.subject);
  if (/^feat/i.test(commit.subject)) return `${title}，让用户可用的产品能力更完整。`;
  if (/^fix/i.test(commit.subject)) return `${title}，减少使用过程中的阻断和误判。`;
  if (/^docs/i.test(commit.subject)) return `${title}，让项目说明更容易理解和追溯。`;
  return `${title}，整理项目状态并改善后续维护体验。`;
}

function nextVersion(currentVersion, commits) {
  const parts = String(currentVersion || '1.0.0').split('.').map((item) => Number(item) || 0);
  const [major = 1, minor = 0, patch = 0] = parts;
  const hasFeature = commits.some((commit) => classifyCommit(commit.subject) === 'feature');
  if (hasFeature) return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function buildRelease(version, commits) {
  const head = commits[commits.length - 1];
  const groupsByCategory = new Map();

  for (const commit of commits) {
    const category = classifyCommit(commit.subject);
    if (!groupsByCategory.has(category)) {
      groupsByCategory.set(category, {
        category,
        title: categoryTitle(category),
        items: []
      });
    }

    groupsByCategory.get(category).items.unshift({
      date: commit.isoDate.replace('T', ' ').replace(/(\+\d\d):(\d\d)$/, ' $1$2'),
      title: userFacingTitle(commit.subject),
      summary: userFacingSummary(commit),
      details: [
        `来源提交：${commit.hash.slice(0, 7)}`
      ],
      status: 'done',
      source: 'commit'
    });
  }

  return {
    version,
    date: head.isoDate.replace('T', ' ').replace(/(\+\d\d):(\d\d)$/, ' $1$2'),
    title: `v${version} 更新记录`,
    summary: `根据上次更新后 ${commits.length} 次提交整理本次更新，覆盖实际已经合入的产品和维护改动。`,
    groups: Array.from(groupsByCategory.values())
  };
}

function main() {
  const apply = process.argv.includes('--apply');
  const changelog = readJson(CHANGELOG_FILE, { releases: [] });
  const versionInfo = readJson(VERSION_FILE, {});
  const head = getHeadCommit();
  const check = changelog.commitCheck || {};
  const lastCommit = String(check.lastRecordedCommit || '').trim();
  const lastCommitDate = String(check.lastRecordedCommitDate || '').trim();

  if (!lastCommit) {
    const nextCheck = {
      thresholdHours: THRESHOLD_HOURS,
      lastRecordedCommit: head.hash,
      lastRecordedCommitDate: head.isoDate,
      note: 'commit 后 changelog 自检基线；后续超过 24 小时会从该 commit 之后补齐。'
    };
    console.log('尚未找到 changelog commit 自检基线。');
    console.log(`当前 HEAD：${head.hash.slice(0, 7)} ${head.isoDate}`);
    if (apply) {
      changelog.commitCheck = nextCheck;
      changelog.updatedAt = new Date().toISOString();
      writeJson(CHANGELOG_FILE, changelog);
      console.log('已初始化 commit 自检基线。');
    } else {
      console.log('如需写入基线，请追加 --apply。');
    }
    return;
  }

  const elapsedHours = hoursBetween(lastCommitDate, head.isoDate);
  const commits = getCommitsAfter(lastCommit);

  console.log(`上次记录 commit：${lastCommit.slice(0, 7)} ${lastCommitDate}`);
  console.log(`当前 HEAD：${head.hash.slice(0, 7)} ${head.isoDate}`);
  console.log(`间隔：${elapsedHours.toFixed(2)} 小时；待覆盖提交：${commits.length} 个。`);

  if (commits.length === 0) {
    console.log('无需更新：没有新的 commit。');
    return;
  }

  if (elapsedHours < THRESHOLD_HOURS) {
    console.log(`无需更新：未超过 ${THRESHOLD_HOURS} 小时。`);
    return;
  }

  const newVersion = nextVersion(versionInfo.version, commits);
  console.log(`建议更新 changelog：${versionInfo.version || '未记录'} -> ${newVersion}`);
  commits.forEach((commit) => {
    console.log(`- ${commit.hash.slice(0, 7)} ${commit.isoDate} ${commit.subject}`);
  });

  if (!apply) {
    console.log('当前为检查模式。如需写入 changelog，请追加 --apply。');
    return;
  }

  const release = buildRelease(newVersion, commits);
  changelog.releases = [release, ...(Array.isArray(changelog.releases) ? changelog.releases : [])];
  changelog.commitCheck = {
    thresholdHours: THRESHOLD_HOURS,
    lastRecordedCommit: head.hash,
    lastRecordedCommitDate: head.isoDate,
    coveredFromCommit: lastCommit,
    coveredCommitCount: commits.length
  };
  changelog.updatedAt = new Date().toISOString();

  versionInfo.version = newVersion;
  versionInfo.lastUpdated = head.isoDate.slice(0, 10);
  versionInfo.history = [
    {
      version: newVersion,
      date: head.isoDate.slice(0, 10),
      type: commits.some((commit) => classifyCommit(commit.subject) === 'feature') ? 'minor' : 'patch',
      title: release.groups.map((group) => group.title).join(' / ') || '常规更新'
    },
    ...(Array.isArray(versionInfo.history) ? versionInfo.history : [])
  ];

  writeJson(CHANGELOG_FILE, changelog);
  writeJson(VERSION_FILE, versionInfo);
  console.log(`已更新 changelog，覆盖 ${commits.length} 个 commit。`);
}

main();
