const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const SNAPSHOT_FILE = path.join(__dirname, '..', 'data', 'codex-turn-snapshots.json');
const VERSION_FILE = path.join(PROJECT_ROOT, 'version.json');
const CHANGELOG_FILE = path.join(PROJECT_ROOT, 'docs', 'changelog.json');
const QUOTA_PER_CNY = 500000;
const GPT_PLUS_MONTHLY_USD = 20;
const USD_TO_CNY = 7.3;
const WORK_HOURS_PER_WEEK = 40;
const PLUS_EMPIRICAL_REMAINING_RATIO = 0.45;
const PLUS_EMPIRICAL_REMAINING_LASTED_HOURS = 20;
const CODEX_SESSIONS_ROOT = path.join(process.env.USERPROFILE || '', '.codex', 'sessions');

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function readJsonFileSafe(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return readJsonFile(filePath);
  } catch (error) {
    return fallback;
  }
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function readSnapshots() {
  if (!fs.existsSync(SNAPSHOT_FILE)) {
    return [];
  }

  return ensureArray(readJsonFile(SNAPSHOT_FILE)).sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
}

function writeSnapshots(snapshots) {
  fs.writeFileSync(SNAPSHOT_FILE, `${JSON.stringify(snapshots, null, 2)}\n`, 'utf8');
}

function appendSnapshotEntry(entry) {
  const snapshots = readSnapshots();
  const normalizedEntry = {
    recordedAt: entry.recordedAt || new Date().toISOString(),
    totalTurns: Number(entry.totalTurns) || 0,
    source: entry.source || 'api',
    note: entry.note || '',
  };
  const latest = snapshots[snapshots.length - 1] || null;

  if (latest && (Number(latest.totalTurns) || 0) === normalizedEntry.totalTurns) {
    return latest;
  }

  if (latest && normalizedEntry.totalTurns < (Number(latest.totalTurns) || 0)) {
    return latest;
  }

  snapshots.push(normalizedEntry);
  writeSnapshots(snapshots);
  return normalizedEntry;
}

function ensureList(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === 'object') {
    return [value];
  }

  return [];
}

function findLatestExportPair() {
  const exportDirs = fs
    .readdirSync(PROJECT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('guaihub-export'))
    .map((entry) => path.join(PROJECT_ROOT, entry.name));

  let latestLogFile = null;
  let latestMtime = 0;

  for (const dir of exportDirs) {
    const files = fs.readdirSync(dir).filter((name) => /^log-self-\d+_\d+\.json$/.test(name));
    for (const fileName of files) {
      const filePath = path.join(dir, fileName);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs > latestMtime) {
        latestMtime = stat.mtimeMs;
        latestLogFile = filePath;
      }
    }
  }

  if (!latestLogFile) {
    return null;
  }

  const rangeSlug = path.basename(latestLogFile).replace(/^log-self-/, '').replace(/\.json$/, '');
  const dataFile = path.join(path.dirname(latestLogFile), `data-self-${rangeSlug}.json`);

  if (!fs.existsSync(dataFile)) {
    return null;
  }

  return {
    logFile: latestLogFile,
    dataFile,
    rangeSlug,
  };
}

function parseRangeSlug(rangeSlug) {
  const [start, end] = rangeSlug.split('_').map((value) => Number(value));
  return {
    startTimestamp: start,
    endTimestamp: end,
  };
}

function toIsoTime(unixSeconds) {
  return new Date(unixSeconds * 1000).toISOString();
}

function safeParseJson(value) {
  if (!value || typeof value !== 'string') {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function sumBy(items, getValue) {
  return items.reduce((total, item) => total + (Number(getValue(item)) || 0), 0);
}

function walkJsonlFiles(dirPath, results = []) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return results;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkJsonlFiles(fullPath, results);
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      results.push(fullPath);
    }
  }

  return results;
}

function getProjectSessionFiles() {
  const sessionFiles = walkJsonlFiles(CODEX_SESSIONS_ROOT, []);
  const projectFiles = [];

  for (const filePath of sessionFiles) {
    try {
      const firstLine = fs.readFileSync(filePath, 'utf8').split(/\r?\n/, 1)[0];
      if (!firstLine) {
        continue;
      }

      const record = JSON.parse(firstLine);
      if (record?.payload?.cwd === PROJECT_ROOT) {
        projectFiles.push(filePath);
      }
    } catch (error) {
      // Ignore malformed session files and keep scanning.
    }
  }

  return projectFiles;
}

function findLatestProjectSessionFile() {
  const sessionFiles = getProjectSessionFiles();
  let latestMatch = null;

  for (const filePath of sessionFiles) {
    try {
      const stat = fs.statSync(filePath);
      if (!latestMatch || stat.mtimeMs > latestMatch.mtimeMs) {
        latestMatch = {
          filePath,
          mtimeMs: stat.mtimeMs,
        };
      }
    } catch (error) {
      // Ignore malformed session files and keep scanning.
    }
  }

  return latestMatch;
}

function getProjectTurnsInRange(startTimestamp, endTimestamp) {
  const sessionFiles = getProjectSessionFiles();
  let turnCount = 0;
  let latestMatchedAt = 0;

  for (const filePath of sessionFiles) {
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);

    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        if (record?.type !== 'response_item' || record?.payload?.role !== 'user') {
          continue;
        }

        const recordTimestamp = Date.parse(record.timestamp || record?.payload?.timestamp || '');
        if (Number.isNaN(recordTimestamp)) {
          continue;
        }

        const unixSeconds = Math.floor(recordTimestamp / 1000);
        if (unixSeconds < startTimestamp || unixSeconds > endTimestamp) {
          continue;
        }

        turnCount += 1;
        latestMatchedAt = Math.max(latestMatchedAt, recordTimestamp);
      } catch (error) {
        // Ignore malformed lines and continue.
      }
    }
  }

  return {
    turnCount,
    source: 'codex-session-log-window',
    updatedAt: latestMatchedAt ? new Date(latestMatchedAt).toISOString() : '',
  };
}

function getCurrentThreadTurns() {
  const latestSession = findLatestProjectSessionFile();
  if (!latestSession) {
    return null;
  }

  const lines = fs.readFileSync(latestSession.filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  let turnCount = 0;

  for (const line of lines) {
    try {
      const record = JSON.parse(line);
      if (record?.type === 'response_item' && record?.payload?.role === 'user') {
        turnCount += 1;
      }
    } catch (error) {
      // Ignore malformed lines and continue.
    }
  }

  return {
    turnCount,
    source: 'codex-session-log',
    sessionFile: latestSession.filePath,
    updatedAt: new Date(latestSession.mtimeMs).toISOString(),
  };
}

function buildModelSummary(logItems) {
  const modelMap = new Map();

  for (const item of logItems) {
    const other = safeParseJson(item.other);
    const modelName = item.model_name || '未命名模型';
    const requestCount = 1;
    const promptTokens = Number(item.prompt_tokens) || 0;
    const completionTokens = Number(item.completion_tokens) || 0;
    const cacheTokens = Number(other.cache_tokens) || 0;
    const tokenUsed = promptTokens + completionTokens + cacheTokens;
    const quota = Number(item.quota) || 0;
    const createdAt = Number(item.created_at) || 0;
    const cacheHitRequests = cacheTokens > 0 ? 1 : 0;

    if (!modelMap.has(modelName)) {
      modelMap.set(modelName, {
        modelName,
        requestCount: 0,
        tokenUsed: 0,
        cacheTokens: 0,
        cacheHitRequests: 0,
        quota: 0,
        latestCreatedAt: createdAt,
      });
    }

    const summary = modelMap.get(modelName);
    summary.requestCount += requestCount;
    summary.tokenUsed += tokenUsed;
    summary.cacheTokens += cacheTokens;
    summary.cacheHitRequests += cacheHitRequests;
    summary.quota += quota;
    summary.latestCreatedAt = Math.max(summary.latestCreatedAt, createdAt);
  }

  return Array.from(modelMap.values())
    .map((item) => ({
      modelName: item.modelName,
      requestCount: item.requestCount,
      tokenUsed: item.tokenUsed,
      cacheTokens: item.cacheTokens,
      cacheHitRequests: item.cacheHitRequests,
      cacheHitRate: item.requestCount > 0 ? item.cacheHitRequests / item.requestCount : 0,
      cacheTokenRatio: item.tokenUsed > 0 ? item.cacheTokens / item.tokenUsed : 0,
      quota: item.quota,
      costCny: item.quota / QUOTA_PER_CNY,
      createdAt: toIsoTime(item.latestCreatedAt || 0),
    }))
    .sort((a, b) => b.costCny - a.costCny);
}

function buildRecentLogs(logItems) {
  return logItems
    .slice(0, 12)
    .map((item) => {
      const other = safeParseJson(item.other);
      const cacheTokens = Number(other.cache_tokens) || 0;
      const promptTokens = Number(item.prompt_tokens) || 0;
      const completionTokens = Number(item.completion_tokens) || 0;

      return {
        createdAt: toIsoTime(Number(item.created_at) || 0),
        modelName: item.model_name,
        tokenName: item.token_name,
        group: item.group,
        requestPath: other.request_path || '',
        requestId: item.request_id,
        promptTokens,
        completionTokens,
        cacheTokens,
        cacheHit: cacheTokens > 0,
        totalTokens: promptTokens + completionTokens + cacheTokens,
        quota: Number(item.quota) || 0,
        costCny: (Number(item.quota) || 0) / QUOTA_PER_CNY,
        useTimeSeconds: Number(item.use_time) || 0,
      };
    });
}

function buildPeriods(snapshots, logItems) {
  const periods = [];

  for (let index = 1; index < snapshots.length; index += 1) {
    const previous = snapshots[index - 1];
    const current = snapshots[index];
    const previousTime = Math.floor(new Date(previous.recordedAt).getTime() / 1000);
    const currentTime = Math.floor(new Date(current.recordedAt).getTime() / 1000);
    const turnDelta = (Number(current.totalTurns) || 0) - (Number(previous.totalTurns) || 0);

    if (turnDelta <= 0 || currentTime <= previousTime) {
      continue;
    }

    const logsInPeriod = logItems.filter((item) => {
      const createdAt = Number(item.created_at) || 0;
      return createdAt > previousTime && createdAt <= currentTime;
    });

    const quota = sumBy(logsInPeriod, (item) => item.quota);
    const promptTokens = sumBy(logsInPeriod, (item) => item.prompt_tokens);
    const completionTokens = sumBy(logsInPeriod, (item) => item.completion_tokens);
    const cacheTokens = sumBy(logsInPeriod, (item) => safeParseJson(item.other).cache_tokens);
    const cacheHitRequests = logsInPeriod.filter((item) => (Number(safeParseJson(item.other).cache_tokens) || 0) > 0).length;
    const totalTokens = promptTokens + completionTokens + cacheTokens;
    const costCny = quota / QUOTA_PER_CNY;

    periods.push({
      startRecordedAt: previous.recordedAt,
      endRecordedAt: current.recordedAt,
      startTurns: Number(previous.totalTurns) || 0,
      endTurns: Number(current.totalTurns) || 0,
      turnDelta,
      requestCount: logsInPeriod.length,
      totalTokens,
      promptTokens,
      completionTokens,
      cacheTokens,
      cacheHitRequests,
      cacheHitRate: logsInPeriod.length > 0 ? cacheHitRequests / logsInPeriod.length : 0,
      cacheTokenRatio: totalTokens > 0 ? cacheTokens / totalTokens : 0,
      quota,
      costCny,
      avgTokensPerTurn: turnDelta > 0 ? totalTokens / turnDelta : 0,
      avgCostPerTurnCny: turnDelta > 0 ? costCny / turnDelta : 0,
    });
  }

  return periods;
}

function buildPeakUsageHour(dataItems) {
  const hourMap = new Map();

  for (const item of dataItems) {
    const timestamp = Number(item.created_at) || 0;
    const hourStart = Math.floor(timestamp / 3600) * 3600;
    const requestCount = Number(item.count) || 0;
    const tokenUsed = Number(item.token_used) || 0;
    const quota = Number(item.quota) || 0;

    if (!hourMap.has(hourStart)) {
      hourMap.set(hourStart, {
        hourStart,
        requestCount: 0,
        tokenUsed: 0,
        quota: 0,
      });
    }

    const summary = hourMap.get(hourStart);
    summary.requestCount += requestCount;
    summary.tokenUsed += tokenUsed;
    summary.quota += quota;
  }

  const peak = Array.from(hourMap.values()).sort((a, b) => {
    if (b.requestCount !== a.requestCount) {
      return b.requestCount - a.requestCount;
    }
    return b.quota - a.quota;
  })[0] || null;

  if (!peak) {
    return null;
  }

  return {
    hourStartIso: toIsoTime(peak.hourStart),
    hourEndIso: toIsoTime(peak.hourStart + 3600),
    requestCount: peak.requestCount,
    tokenUsed: peak.tokenUsed,
    costCny: peak.quota / QUOTA_PER_CNY,
  };
}

router.get('/changelog', (req, res) => {
  try {
    const versionInfo = readJsonFileSafe(VERSION_FILE, {});
    const changelog = readJsonFileSafe(CHANGELOG_FILE, { releases: [] });
    const releases = Array.isArray(changelog.releases) ? changelog.releases : [];

    return res.json({
      success: true,
      data: {
        currentVersion: String(versionInfo.version || ''),
        lastUpdated: String(versionInfo.lastUpdated || ''),
        updatedAt: String(changelog.updatedAt || ''),
        releases,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get('/codex-cost', (req, res) => {
  try {
    const exportPair = findLatestExportPair();
    const snapshots = readSnapshots();

    if (!exportPair) {
      return res.json({
        success: true,
        data: {
          available: false,
          message: '未找到 GuaiHub 导出文件，请先运行导出脚本。',
          snapshots,
        },
      });
    }

    const logItems = ensureArray(readJsonFile(exportPair.logFile)).sort((a, b) => (Number(b.created_at) || 0) - (Number(a.created_at) || 0));
    const dataItems = ensureList(readJsonFile(exportPair.dataFile));
    const modelSummary = buildModelSummary(logItems);
    const recentLogs = buildRecentLogs(logItems);
    const currentThreadTurns = getCurrentThreadTurns();
    const periods = buildPeriods(snapshots, logItems);
    const totalTokens = sumBy(dataItems, (item) => item.token_used);
    const totalQuota = sumBy(dataItems, (item) => item.quota);
    const totalRequests = sumBy(dataItems, (item) => item.count);
    const peakUsageHour = buildPeakUsageHour(dataItems);
    const totalLoggedRequests = logItems.length;
    const totalCacheTokens = sumBy(logItems, (item) => safeParseJson(item.other).cache_tokens);
    const cacheHitRequests = logItems.filter((item) => (Number(safeParseJson(item.other).cache_tokens) || 0) > 0).length;
    const totalCostCny = totalQuota / QUOTA_PER_CNY;
    const latestSnapshot = snapshots[snapshots.length - 1] || null;
    const snapshotTurns = latestSnapshot ? Number(latestSnapshot.totalTurns) || 0 : 0;
    const { startTimestamp, endTimestamp } = parseRangeSlug(exportPair.rangeSlug);
    const turnsInCoverage = getProjectTurnsInRange(startTimestamp, endTimestamp);
    const effectiveTurnsInCoverage = Number(turnsInCoverage.turnCount) || 0;
    const coverageDays = Math.max((endTimestamp - startTimestamp + 1) / 86400, 1);
    const coverageHours = Math.max((endTimestamp - startTimestamp + 1) / 3600, 1);
    const projectedMonthlyCostCny = totalCostCny / coverageDays * 30;
    const plusMonthlyCny = GPT_PLUS_MONTHLY_USD * USD_TO_CNY;
    const avgCostPerHourCny = coverageHours > 0 ? totalCostCny / coverageHours : 0;
    const avgRequestsPerHour = coverageHours > 0 ? totalRequests / coverageHours : 0;
    const projectedWeeklyWorkCostCny = avgCostPerHourCny * WORK_HOURS_PER_WEEK;
    const plusEmpiricalFullHours = PLUS_EMPIRICAL_REMAINING_RATIO > 0
      ? PLUS_EMPIRICAL_REMAINING_LASTED_HOURS / PLUS_EMPIRICAL_REMAINING_RATIO
      : 0;
    const latestPeriod = [...periods].reverse().find((period) => period.turnDelta > 0 && period.requestCount > 0) || null;

    return res.json({
      success: true,
      data: {
        available: true,
        constants: {
          quotaPerCny: QUOTA_PER_CNY,
          gptPlusMonthlyUsd: GPT_PLUS_MONTHLY_USD,
          usdToCny: USD_TO_CNY,
          gptPlusMonthlyCny: plusMonthlyCny,
          workHoursPerWeek: WORK_HOURS_PER_WEEK,
          plusEmpiricalRemainingRatio: PLUS_EMPIRICAL_REMAINING_RATIO,
          plusEmpiricalRemainingLastedHours: PLUS_EMPIRICAL_REMAINING_LASTED_HOURS,
          guaihubCostUnit: 'CNY',
          guaihubPriceNote: 'GuaiHub 页面部分价格字段虽然标成 USD，但这里统一按实际人民币成本解读。',
        },
        coverage: {
          startTimestamp,
          endTimestamp,
          startTimeIso: toIsoTime(startTimestamp),
          endTimeIso: toIsoTime(endTimestamp),
          coverageDays,
          coverageHours,
          sourceDirectory: path.basename(path.dirname(exportPair.logFile)),
        },
        summary: {
          totalTurns: effectiveTurnsInCoverage,
          snapshotTurns,
          currentThreadTurns: currentThreadTurns ? currentThreadTurns.turnCount : 0,
          currentThreadTurnsSource: currentThreadTurns ? currentThreadTurns.source : '',
          currentThreadTurnsUpdatedAt: currentThreadTurns ? currentThreadTurns.updatedAt : '',
          turnsInCoverage: effectiveTurnsInCoverage,
          turnsInCoverageSource: turnsInCoverage.source,
          turnsInCoverageUpdatedAt: turnsInCoverage.updatedAt,
          totalRequests,
          totalTokens,
          totalQuota,
          totalLoggedRequests,
          totalCostCny,
          totalCacheTokens,
          cacheHitRequests,
          cacheHitRate: totalLoggedRequests > 0 ? cacheHitRequests / totalLoggedRequests : 0,
          cacheTokenRatio: totalTokens > 0 ? totalCacheTokens / totalTokens : 0,
          avgTokensPerTurn: effectiveTurnsInCoverage > 0 ? totalTokens / effectiveTurnsInCoverage : 0,
          avgCostPerTurnCny: effectiveTurnsInCoverage > 0 ? totalCostCny / effectiveTurnsInCoverage : 0,
          avgRequestsPerHour,
          avgTokensPerHour: coverageHours > 0 ? totalTokens / coverageHours : 0,
          avgCostPerHourCny,
          projectedWeeklyWorkCostCny,
          plusEmpiricalFullHours,
          projectedMonthlyCostCny,
          projectedMonthlyDeltaVsPlusCny: projectedMonthlyCostCny - plusMonthlyCny,
          breakEvenTurnsAtCurrentAvg: effectiveTurnsInCoverage > 0 && totalCostCny > 0
            ? plusMonthlyCny / (totalCostCny / effectiveTurnsInCoverage)
            : 0,
          latestPeriodAvgTokensPerTurn: latestPeriod ? latestPeriod.avgTokensPerTurn : 0,
          latestPeriodAvgCostPerTurnCny: latestPeriod ? latestPeriod.avgCostPerTurnCny : 0,
        },
        snapshots,
        currentThread: currentThreadTurns,
        turnsInCoverage,
        periods,
        peakUsageHour,
        modelSummary,
        recentLogs,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post('/codex-cost/snapshots', (req, res) => {
  try {
    const savedSnapshot = appendSnapshotEntry(req.body || {});
    return res.json({
      success: true,
      data: savedSnapshot,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
