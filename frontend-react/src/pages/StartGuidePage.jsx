import { useEffect, useMemo, useState } from 'react';
import '../styles.css';
import '../app-shell.css';

const AUTO_REFRESH_INTERVAL_MS = 60 * 1000;
const TURN_SNAPSHOT_LEDGER_KEY = 'start-guide-turn-snapshot-ledger';
const TURN_SNAPSHOT_SYNC_KEY = 'start-guide-turn-snapshot-sync';
const TURN_SNAPSHOT_SYNC_INTERVAL_MS = 5 * 60 * 1000;

function formatNumber(value, digits = 0) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(number);
}

function formatCurrency(value) {
  return `¥${formatNumber(value, 2)}`;
}

function formatPercent(value) {
  return `${formatNumber((Number(value) || 0) * 100, 1)}%`;
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function formatShortDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function readLocalSnapshotLedger() {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(TURN_SNAPSHOT_LEDGER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalSnapshotLedger(entries) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TURN_SNAPSHOT_LEDGER_KEY, JSON.stringify(entries));
}

function readSnapshotSyncState() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(TURN_SNAPSHOT_SYNC_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSnapshotSyncState(state) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TURN_SNAPSHOT_SYNC_KEY, JSON.stringify(state));
}

function mergeSnapshots(serverSnapshots, localSnapshots) {
  const merged = [...serverSnapshots, ...localSnapshots];
  const deduped = new Map();

  merged.forEach((item) => {
    if (!item?.recordedAt) return;
    const totalTurns = Number(item.totalTurns) || 0;
    const source = item.source || '';
    const key = `${item.recordedAt}-${totalTurns}-${source}`;
    deduped.set(key, {
      recordedAt: item.recordedAt,
      totalTurns,
      source,
      note: item.note || '',
    });
  });

  return [...deduped.values()].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
}

function requestJson(path) {
  return fetch(path, {
    headers: {
      'Content-Type': 'application/json',
    },
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      throw new Error(payload.error || payload.message || `请求失败：${response.status}`);
    }
    return payload;
  });
}

async function syncTurnSnapshot(entry) {
  const syncState = readSnapshotSyncState();
  const now = Date.now();

  if (
    syncState
    && syncState.signature === `${entry.totalTurns}-${entry.note}`
    && now - (Number(syncState.syncedAt) || 0) < TURN_SNAPSHOT_SYNC_INTERVAL_MS
  ) {
    return;
  }

  const response = await fetch('/api/analysis/codex-cost/snapshots', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(entry),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || payload.message || '同步轮次快照失败');
  }

  writeSnapshotSyncState({
    signature: `${entry.totalTurns}-${entry.note}`,
    syncedAt: now,
  });
}

function OverviewCard({ label, value, helper }) {
  return (
    <article className="analysis-card">
      <span className="analysis-card-label">{label}</span>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  );
}

export default function StartGuidePage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastFetchedAt, setLastFetchedAt] = useState('');
  const [localSnapshots, setLocalSnapshots] = useState(() => readLocalSnapshotLedger());

  async function loadReport(options = {}) {
    const { silent = false } = options;

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const payload = await requestJson('/api/analysis/codex-cost');
      const nextReport = payload.data || null;
      const nextCoverage = nextReport?.coverage || null;
      const nextCurrentThread = nextReport?.currentThread || null;

      setReport(nextReport);
      setLastFetchedAt(new Date().toISOString());

      if (nextCurrentThread && nextCoverage) {
        const nextEntry = {
          recordedAt: new Date().toISOString(),
          totalTurns: Number(nextCurrentThread.turnCount) || 0,
          source: nextCurrentThread.source || 'page-auto-ledger',
          note: `${formatShortDateTime(nextCoverage.startTimeIso)} - ${formatShortDateTime(nextCoverage.endTimeIso)}`,
        };

        setLocalSnapshots((current) => {
          const latest = current[current.length - 1] || null;
          if (
            latest
            && Number(latest.totalTurns) >= nextEntry.totalTurns
          ) {
            return current;
          }

          const updated = [...current, nextEntry].slice(-200);
          writeLocalSnapshotLedger(updated);
          return updated;
        });

        syncTurnSnapshot({
          recordedAt: nextEntry.recordedAt,
          totalTurns: nextEntry.totalTurns,
          source: 'start-guide-auto-sync',
          note: nextEntry.note,
        }).catch(() => {});
      }
    } catch (loadError) {
      setError(loadError.message || '读取统计失败');
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadReport();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadReport({ silent: true });
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const summary = report?.summary || null;
  const coverage = report?.coverage || null;
  const constants = report?.constants || null;
  const periods = report?.periods || [];
  const peakUsageHour = report?.peakUsageHour || null;
  const modelSummary = report?.modelSummary || [];
  const recentLogs = report?.recentLogs || [];
  const snapshots = useMemo(
    () => mergeSnapshots(report?.snapshots || [], localSnapshots),
    [report?.snapshots, localSnapshots],
  );

  const displayPeriods = useMemo(
    () => periods.filter((period) => period.turnDelta > 0 && period.requestCount > 0),
    [periods],
  );
  const latestPeriod = useMemo(
    () => displayPeriods[displayPeriods.length - 1] || null,
    [displayPeriods],
  );
  const recentPeriods = useMemo(() => [...displayPeriods].slice(-3).reverse(), [displayPeriods]);
  const recentSnapshots = useMemo(() => [...snapshots].slice(-3).reverse(), [snapshots]);
  const visibleModelSummary = useMemo(
    () => modelSummary.filter((item) => item.requestCount > 0 || item.tokenUsed > 0 || item.costCny > 0),
    [modelSummary],
  );
  const syncHealth = useMemo(() => {
    if (!lastFetchedAt) return '待初始化';
    if (refreshing) return '刷新中';
    return '正常';
  }, [lastFetchedAt, refreshing]);

  return (
    <div className="page-shell">
      <header className="hero-section">
        <div>
          <span className="hero-eyebrow">Runtime Monitor</span>
          <h1>运行观察</h1>
          <p>这里只看成本、使用强度和自动化是否正常，不承载项目说明和启动教程。</p>
        </div>
        <div className="hero-note-card">
          <strong>当前定位</strong>
          <p>个人辅助观察页，用来快速判断系统使用节奏、花费和同步状态。</p>
        </div>
      </header>

      <section className="runtime-stage">
        <div className="analysis-card-grid runtime-monitor-grid">
          <OverviewCard
            label="页面同步"
            value={syncHealth}
            helper={lastFetchedAt ? `上次取数：${formatDateTime(lastFetchedAt)}` : '还没有成功取数。'}
          />
          <OverviewCard
            label="GuaiHub 覆盖区间"
            value={coverage ? `${formatNumber(coverage.coverageHours, 1)} 小时` : '-'}
            helper={coverage
              ? `${formatShortDateTime(coverage.startTimeIso)} - ${formatShortDateTime(coverage.endTimeIso)}`
              : '暂无导出窗口信息。'}
          />
          <OverviewCard
            label="轮次快照"
            value={recentSnapshots.length > 0 ? `${formatNumber(recentSnapshots[0].totalTurns)} 轮` : '-'}
            helper={recentSnapshots.length > 0 ? `最近记录：${formatDateTime(recentSnapshots[0].recordedAt)}` : '暂无轮次快照。'}
          />
          <OverviewCard
            label="自动化节奏"
            value="每日 00:01"
            helper="先补日志，再自动判断是否升 patch / minor。"
          />
        </div>
      </section>

      <section className="analysis-section">
        <div className="analysis-section-head">
          <div>
            <span className="guide-eyebrow">Cost & Usage</span>
            <h2>成本与使用强度</h2>
            <p>集中看近 24 小时的轮次、成本、token、缓存与模型分布。</p>
          </div>
          <div className="analysis-side-actions">
            {coverage ? (
              <div className="analysis-badge">
                <strong>GuaiHub 导出覆盖范围</strong>
                <span>{formatDateTime(coverage.startTimeIso)} - {formatDateTime(coverage.endTimeIso)}</span>
                <span>数据目录：{coverage.sourceDirectory}</span>
              </div>
            ) : null}
            <button type="button" className="analysis-refresh-button" onClick={() => loadReport()}>
              立即刷新
            </button>
          </div>
        </div>

        <div className="analysis-auto-refresh-note">
          <span>页面每 60 秒自动刷新一次。</span>
          <span>上次取数：{lastFetchedAt ? formatDateTime(lastFetchedAt) : '-'}</span>
          <span>{refreshing ? '后台刷新中…' : '当前空闲'}</span>
        </div>

        {loading ? <div className="analysis-empty">正在读取统计…</div> : null}
        {!loading && error ? <div className="analysis-empty is-error">{error}</div> : null}
        {!loading && !error && report && !report.available ? (
          <div className="analysis-empty">{report.message || '暂无可展示的数据。'}</div>
        ) : null}

        {!loading && !error && report?.available && summary && constants && coverage ? (
          <>
            <div className="analysis-card-grid">
              <OverviewCard
                label="导出窗口轮次"
                value={formatNumber(summary.turnsInCoverage || summary.totalTurns)}
                helper={coverage
                  ? `统计范围：${formatDateTime(coverage.startTimeIso)} 到 ${formatDateTime(coverage.endTimeIso)}。`
                  : '当前导出窗口内的对话轮次。'}
              />
              <OverviewCard
                label="24 小时总成本"
                value={formatCurrency(summary.totalCostCny)}
                helper="近 24 小时累计花费。"
              />
              <OverviewCard
                label="单轮成本"
                value={formatCurrency(summary.avgCostPerTurnCny)}
                helper="平均每轮大约花多少钱。"
              />
              <OverviewCard
                label="每小时成本"
                value={formatCurrency(summary.avgCostPerHourCny)}
                helper="平均每小时大约花多少钱。"
              />
              <OverviewCard
                label="24 小时总 token"
                value={formatNumber(summary.totalTokens)}
                helper="近 24 小时累计 token。"
              />
              <OverviewCard
                label="每小时轮次"
                value={formatNumber((summary.turnsInCoverage || summary.totalTurns) / (coverage.coverageHours || 1), 1)}
                helper="平均每小时推进多少轮。"
              />
              <OverviewCard
                label="缓存命中请求占比"
                value={formatPercent(summary.cacheHitRate)}
                helper="有多少请求命中了缓存。"
              />
              <OverviewCard
                label="缓存 token 占比"
                value={formatPercent(summary.cacheTokenRatio)}
                helper="总 token 里有多少来自缓存。"
              />
            </div>

            <div className="analysis-empty">
              {constants.guaihubPriceNote || 'GuaiHub 成本在这里统一按人民币解读。'}
            </div>

            <div className="analysis-highlight-row">
              <div className="analysis-highlight">
                <span>40 小时工作周预估花费</span>
                <strong>{formatCurrency(summary.projectedWeeklyWorkCostCny)}</strong>
                <p>{`按每周 ${formatNumber(constants.workHoursPerWeek)} 小时估算。`}</p>
              </div>
              <div className="analysis-highlight">
                <span>Plus 实测满额约可撑多久</span>
                <strong>{formatNumber(summary.plusEmpiricalFullHours, 1)} 小时</strong>
                <p>按你提供的实测使用记录反推。</p>
              </div>
              <div className="analysis-highlight">
                <span>最近一个统计周期</span>
                <strong>{latestPeriod ? `${formatCurrency(latestPeriod.avgCostPerTurnCny)} / 轮` : '-'}</strong>
                <p>
                  {latestPeriod
                    ? `最近区间平均 ${formatNumber(latestPeriod.avgTokensPerTurn)} token / 轮。`
                    : '当前还没有足够的快照区间。'}
                </p>
              </div>
            </div>

            <div className="analysis-two-column">
              <article className="analysis-panel wide">
                <div className="analysis-panel-head">
                  <strong>按统计周期看每轮成本</strong>
                  <span>一个周期 = 两次轮次快照之间的区间</span>
                </div>
                <div className="table-scroll">
                  <table className="analysis-table">
                    <thead>
                      <tr>
                        <th>区间</th>
                        <th>轮次增量</th>
                        <th>请求数</th>
                        <th>总 token</th>
                        <th>缓存命中率</th>
                        <th>缓存 token 占比</th>
                        <th>总成本</th>
                        <th>每轮 token</th>
                        <th>每轮成本</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentPeriods.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="table-empty">还没有足够的轮次快照。</td>
                        </tr>
                      ) : recentPeriods.map((period) => (
                        <tr key={`${period.startRecordedAt}-${period.endRecordedAt}`}>
                          <td className="analysis-period-cell">
                            {formatShortDateTime(period.startRecordedAt)} - {formatShortDateTime(period.endRecordedAt)}
                          </td>
                          <td>{formatNumber(period.turnDelta)}</td>
                          <td>{formatNumber(period.requestCount)}</td>
                          <td>{formatNumber(period.totalTokens)}</td>
                          <td>{formatPercent(period.cacheHitRate)}</td>
                          <td>{formatPercent(period.cacheTokenRatio)}</td>
                          <td>{formatCurrency(period.costCny)}</td>
                          <td>{formatNumber(period.avgTokensPerTurn)}</td>
                          <td>{formatCurrency(period.avgCostPerTurnCny)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="analysis-panel">
                <div className="analysis-panel-head">
                  <strong>轮次快照台账</strong>
                  <span>用于观察轮次变化</span>
                </div>
                <div className="table-scroll">
                  <table className="analysis-table compact">
                    <thead>
                      <tr>
                        <th>记录时间</th>
                        <th>累计轮次</th>
                        <th>来源</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSnapshots.map((snapshot) => (
                        <tr key={`${snapshot.recordedAt}-${snapshot.totalTurns}`}>
                          <td>{formatDateTime(snapshot.recordedAt)}</td>
                          <td>{formatNumber(snapshot.totalTurns)}</td>
                          <td>{snapshot.source || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>

            <div className="analysis-two-column analysis-asymmetric">
              <div className="analysis-stack">
                <article className="analysis-panel">
                  <div className="analysis-panel-head">
                    <strong>用量高峰期</strong>
                    <span>按小时统计</span>
                  </div>
                  {peakUsageHour ? (
                    <div className="analysis-spotlight">
                      <strong>{formatShortDateTime(peakUsageHour.hourStartIso)} - {formatShortDateTime(peakUsageHour.hourEndIso)}</strong>
                      <p>{`这一小时请求 ${formatNumber(peakUsageHour.requestCount)} 次。`}</p>
                      <p>{`消耗 ${formatNumber(peakUsageHour.tokenUsed)} token，成本约 ${formatCurrency(peakUsageHour.costCny)}。`}</p>
                    </div>
                  ) : (
                    <div className="analysis-empty">暂无可用的按小时统计。</div>
                  )}
                </article>

                <article className="analysis-panel">
                  <div className="analysis-panel-head">
                    <strong>按模型汇总</strong>
                    <span>看各模型的用量和成本</span>
                  </div>
                  <div className="table-scroll">
                    <table className="analysis-table compact analysis-model-summary-table">
                      <thead>
                        <tr>
                          <th>模型</th>
                          <th>请求数</th>
                          <th>总 token</th>
                          <th>缓存命中率</th>
                          <th>缓存 token 占比</th>
                          <th>成本</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleModelSummary.map((item) => (
                          <tr key={`${item.modelName}-${item.createdAt}`}>
                            <td>{item.modelName}</td>
                            <td>{formatNumber(item.requestCount)}</td>
                            <td>{formatNumber(item.tokenUsed)}</td>
                            <td>{formatPercent(item.cacheHitRate)}</td>
                            <td>{formatPercent(item.cacheTokenRatio)}</td>
                            <td>{formatCurrency(item.costCny)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              </div>

              <article className="analysis-panel wide">
                <div className="analysis-panel-head">
                  <strong>最近调用明细</strong>
                  <span>看最近一批请求的模型、token 和成本</span>
                </div>
                <div className="table-scroll">
                  <table className="analysis-table">
                    <thead>
                      <tr>
                        <th>时间</th>
                        <th>模型</th>
                        <th>路径</th>
                        <th>缓存状态</th>
                        <th>总 token</th>
                        <th>成本</th>
                        <th>耗时</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLogs.map((item) => (
                        <tr key={item.requestId}>
                          <td>{formatDateTime(item.createdAt)}</td>
                          <td>{item.modelName || '-'}</td>
                          <td>{item.requestPath || '-'}</td>
                          <td>{item.cacheHit ? `命中 ${formatNumber(item.cacheTokens)}` : '未命中'}</td>
                          <td>{formatNumber(item.totalTokens)}</td>
                          <td>{formatCurrency(item.costCny)}</td>
                          <td>{formatNumber(item.useTimeSeconds)}s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          </>
        ) : null}
      </section>

      <div className="guide-footnote">
        <span>这页只保留运行观察，不再承担项目进度说明。</span>
        <span>项目施工状态请看 `/generation-logic`，版本演进请看 `/changelog`。</span>
        <span>如需手动补数据：轮次快照用 `tools/update-codex-turn-snapshot.ps1`，GuaiHub 导出用 `tools/export-guaihub-latest.ps1`。</span>
      </div>

      <style>{`
        .guide-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--brand); }
        .runtime-stage {
          padding: 0;
          margin-bottom: 20px;
          border: none;
          background: transparent;
          box-shadow: none;
          backdrop-filter: none;
          min-height: auto;
        }
        .runtime-monitor-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .guide-footnote { margin-top: 24px; padding: 16px 20px; border: 1px solid var(--line); border-radius: 16px; background: rgba(255, 250, 243, 0.82); display: grid; gap: 6px; }
        .guide-footnote span { color: var(--muted); font-size: 14px; }
        .analysis-section { margin-top: 26px; display: grid; gap: 18px; }
        .analysis-section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .analysis-section-head h2 { margin: 6px 0 8px; font-size: 28px; color: var(--text); }
        .analysis-section-head p { margin: 0; color: var(--muted); line-height: 1.7; }
        .analysis-side-actions { display: flex; align-items: stretch; gap: 12px; }
        .analysis-badge { min-width: 240px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 16px; background: var(--panel); display: grid; gap: 4px; }
        .analysis-badge strong { color: var(--text); }
        .analysis-badge span { color: var(--muted); font-size: 13px; line-height: 1.6; }
        .analysis-refresh-button { min-width: 108px; padding: 0 16px; border: 1px solid var(--line); border-radius: 16px; background: var(--panel); color: var(--text); font-weight: 700; cursor: pointer; }
        .analysis-refresh-button:hover { background: rgba(255, 250, 243, 0.88); }
        .analysis-auto-refresh-note { display: flex; flex-wrap: wrap; gap: 10px 18px; padding: 14px 16px; border: 1px dashed var(--line); border-radius: 16px; background: rgba(255, 250, 243, 0.62); color: var(--muted); font-size: 13px; }
        .analysis-card-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
        .analysis-card { padding: 20px; border: 1px solid var(--line); border-radius: 18px; background: var(--panel); display: grid; gap: 8px; }
        .analysis-card-label { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--brand); }
        .analysis-card strong { font-size: 28px; color: var(--text); line-height: 1.15; }
        .analysis-card p { margin: 0; color: var(--muted); line-height: 1.7; font-size: 14px; }
        .analysis-highlight-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        .analysis-highlight { padding: 20px; border: 1px solid var(--line); border-radius: 18px; background: rgba(255, 250, 243, 0.88); display: grid; gap: 6px; }
        .analysis-highlight span { color: var(--muted); font-size: 13px; }
        .analysis-highlight strong { font-size: 24px; color: var(--text); }
        .analysis-highlight p { margin: 0; color: var(--muted); line-height: 1.7; font-size: 14px; }
        .analysis-spotlight { display: grid; gap: 8px; }
        .analysis-spotlight strong { color: var(--text); font-size: 20px; }
        .analysis-spotlight p { margin: 0; color: var(--muted); line-height: 1.7; font-size: 14px; }
        .analysis-two-column { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 16px; }
        .analysis-asymmetric { grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.45fr); align-items: stretch; }
        .analysis-stack { display: grid; gap: 16px; grid-template-rows: auto minmax(0, 1fr); height: 100%; min-height: 0; }
        .analysis-panel { padding: 18px; border: 1px solid var(--line); border-radius: 18px; background: var(--panel); display: grid; gap: 14px; min-width: 0; }
        .analysis-panel.wide { min-width: 0; }
        .analysis-panel-head { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
        .analysis-panel-head strong { color: var(--text); font-size: 18px; }
        .analysis-panel-head span { color: var(--muted); font-size: 13px; }
        .table-scroll { overflow-x: auto; }
        .analysis-table { width: 100%; border-collapse: collapse; min-width: 720px; }
        .analysis-table.compact { min-width: 0; }
        .analysis-table th, .analysis-table td { padding: 12px 10px; border-bottom: 1px solid var(--line); text-align: left; font-size: 14px; vertical-align: top; }
        .analysis-table th { color: var(--muted); font-weight: 700; white-space: nowrap; }
        .analysis-table td { color: var(--text); }
        .analysis-model-summary-table td { white-space: nowrap; }
        .analysis-period-cell { white-space: nowrap; }
        .table-empty { color: var(--muted); text-align: center; }
        .analysis-empty { padding: 18px 20px; border: 1px dashed var(--line); border-radius: 16px; color: var(--muted); background: rgba(255, 250, 243, 0.6); }
        .analysis-empty.is-error { color: #991b1b; border-color: rgba(153, 27, 27, 0.2); background: rgba(254, 242, 242, 0.8); }
        @media (max-width: 1200px) {
          .analysis-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 1100px) {
          .analysis-highlight-row,
          .analysis-two-column,
          .analysis-asymmetric { grid-template-columns: 1fr; }
        }
        @media (max-width: 900px) {
          .analysis-section-head { flex-direction: column; align-items: flex-start; }
          .analysis-badge { width: 100%; min-width: 0; }
          .analysis-side-actions { width: 100%; flex-direction: column; }
          .analysis-refresh-button { width: 100%; min-height: 44px; }
          .analysis-card-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
