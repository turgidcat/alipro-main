import { useEffect, useMemo, useState } from 'react';
import { brand } from '../config/brand.js';
import '../styles.css';
import '../app-shell.css';

const tagMeta = {
  important: { label: '重要', bg: 'rgba(214,141,33,0.14)', color: '#9a5a12', border: '#f3b338' },
  fix: { label: '修复', bg: 'rgba(185,52,52,0.12)', color: '#9a3030', border: '#df7a7a' },
  improve: { label: '完善', bg: 'rgba(59,130,246,0.12)', color: '#1d4ed8', border: '#7caeff' },
  feature: { label: '新功能', bg: 'rgba(77,143,88,0.14)', color: '#397245', border: '#8fd28c' },
  docs: { label: '文档', bg: 'rgba(120,93,62,0.12)', color: '#7a5d3e', border: '#d7b38b' }
};

function normalizeDetails(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split('|').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeItem(item = {}) {
  return {
    date: item.date || '',
    title: item.title || '未命名更新',
    summary: item.summary || '',
    details: normalizeDetails(item.details),
    status: item.status || ''
  };
}

function normalizeGroup(group = {}) {
  return {
    category: group.category || 'improve',
    title: group.title || tagMeta[group.category]?.label || '未分类',
    items: Array.isArray(group.items) ? group.items.map(normalizeItem) : []
  };
}

function normalizeRelease(release = {}) {
  return {
    version: release.version || '',
    date: release.date || '',
    groups: Array.isArray(release.groups) ? release.groups.map(normalizeGroup) : []
  };
}

export default function ChangelogPage() {
  const [data, setData] = useState({
    currentVersion: '',
    lastUpdated: '',
    updatedAt: '',
    releases: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError('');
        const appBasePath = String(import.meta.env.BASE_URL || '/');
        const apiBase = import.meta.env.VITE_API_BASE || `${appBasePath.replace(/\/+$/, '')}/api`;
        const response = await fetch(`${apiBase}/analysis/changelog`, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok || payload.success === false) {
          throw new Error(payload.error || `HTTP ${response.status}`);
        }
        if (alive) {
          setData(payload.data || {});
        }
      } catch (loadError) {
        if (alive) {
          setError(loadError.message || '加载失败');
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    load();
    return () => { alive = false; };
  }, []);

  const releases = useMemo(() => (
    Array.isArray(data.releases) ? data.releases.map(normalizeRelease) : []
  ), [data.releases]);

  return (
    <div className="page-shell">
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <header className="changelog-page-header">
        <h1 className="changelog-page-title">更新日志</h1>
        <p className="changelog-page-subtitle">ALIPRO 内测版迭代记录</p>
        <div className="changelog-page-meta">
          <span>{data.currentVersion ? `当前版本 v${data.currentVersion}` : '当前版本待同步'}</span>
          <span className="changelog-page-meta-sep" />
          <span>{data.lastUpdated ? `版本日期：${data.lastUpdated}` : '版本日期暂未记录'}</span>
          <span className="changelog-page-meta-sep" />
          <span>{data.updatedAt ? `同步于 ${data.updatedAt.slice(0, 16).replace('T', ' ')}` : '日志尚未同步'}</span>
        </div>
      </header>

      {/* ── Timeline Releases ───────────────────────────────────────── */}
      <section className="changelog-page-timeline">
        {loading ? (
          <div className="changelog-page-empty">正在读取更新日志...</div>
        ) : null}
        {!loading && error ? (
          <div className="changelog-page-empty">更新日志加载失败：{error}</div>
        ) : null}
        {!loading && !error ? (
          <div className="changelog-page-list">
            {releases.map((release, idx) => (
              <article key={release.version || release.date} className="changelog-page-card">
                {/* Timeline connector line */}
                <div className="changelog-page-card-line" aria-hidden="true" />

                <div className="changelog-page-card-inner">
                  {/* Card top: version badge + date */}
                  <div className="changelog-page-card-top">
                    <div className="changelog-page-card-top-left">
                      <span className="changelog-page-version-badge">
                        {release.version ? `v${release.version}` : '未命名版本'}
                      </span>
                      <span className="changelog-page-date">{release.date}</span>
                    </div>
                  </div>

                  {/* Change groups */}
                  <div className="changelog-page-groups">
                    {release.groups.map((group) => {
                      const meta = tagMeta[group.category] || tagMeta.improve;
                      return (
                        <section key={`${release.version}-${group.category}`} className="changelog-page-group">
                          <span
                            className="changelog-page-group-tag"
                            style={{
                              background: meta.bg,
                              color: meta.color,
                              borderColor: meta.border
                            }}
                          >
                            {group.title}
                          </span>

                          <ul className="changelog-page-group-items">
                            {group.items.map((item, index) => (
                              <li key={`${release.version}-${group.category}-${index}`} className="changelog-page-group-item">
                                <span className="changelog-page-item-title">{item.title}</span>
                                {item.summary ? (
                                  <span className="changelog-page-item-summary">{item.summary}</span>
                                ) : null}
                                {item.details.length > 0 ? (
                                  <ul className="changelog-page-item-details">
                                    {item.details.map((detail, detailIndex) => (
                                      <li key={`${release.version}-${group.category}-${index}-${detailIndex}`}>{detail}</li>
                                    ))}
                                  </ul>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </section>
                      );
                    })}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────────── */}
      <section className="changelog-page-cta">
        <a
          href="#join-beta"
          className="changelog-page-cta-btn"
        >
          加入内测
        </a>
        <p className="changelog-page-cta-note">申请即可体验全部功能</p>
      </section>

      {/* ── Scoped Styles ───────────────────────────────────────────── */}
      <style>{`
        /* ── Header ──────────────────────────────────────────────────── */
        .changelog-page-header {
          text-align: center;
          padding-bottom: 40px;
          border-bottom: 1px solid var(--line);
          margin-bottom: 40px;
        }
        .changelog-page-title {
          font-family: var(--font-serif);
          font-size: clamp(28px, 3vw, 36px);
          font-weight: 700;
          color: var(--text);
          margin: 0 0 8px 0;
          line-height: 1.25;
        }
        .changelog-page-subtitle {
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--muted);
          letter-spacing: 0.06em;
          margin: 0 0 20px 0;
        }
        .changelog-page-meta {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: var(--muted);
          font-family: var(--font-mono);
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 6px 18px;
        }
        .changelog-page-meta-sep {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--line);
          flex-shrink: 0;
        }

        /* ── Timeline list ─────────────────────────────────────────── */
        .changelog-page-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* ── Card ────────────────────────────────────────────────────── */
        .changelog-page-card {
          position: relative;
          border: 1px solid var(--line);
          border-radius: var(--radius-panel-lg);
          background: var(--panel);
          overflow: hidden;
        }
        .changelog-page-card-line {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: var(--brand);
          border-radius: 0 3px 3px 0;
        }
        /* Dot on the timeline connector aligned with the version badge */
        .changelog-page-card-line::after {
          content: '';
          position: absolute;
          top: 32px;
          left: 50%;
          transform: translateX(-50%);
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--brand);
          border: 2px solid var(--panel-strong);
          box-shadow: 0 0 0 2px var(--brand);
        }
        .changelog-page-card-inner {
          padding: 24px;
          padding-left: 28px;
        }

        /* ── Card top ─────────────────────────────────────────────────── */
        .changelog-page-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .changelog-page-card-top-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .changelog-page-version-badge {
          display: inline-flex;
          align-items: center;
          background: var(--brand-soft);
          color: var(--brand-deep);
          border-radius: 999px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          padding: 3px 10px;
          line-height: 1.5;
        }
        .changelog-page-date {
          font-size: 13px;
          color: var(--muted);
          font-family: var(--font-mono);
          white-space: nowrap;
        }

        /* ── Groups ───────────────────────────────────────────────────── */
        .changelog-page-groups {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .changelog-page-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .changelog-page-group-tag {
          display: inline-flex;
          align-items: center;
          align-self: flex-start;
          min-height: 28px;
          padding: 0 10px;
          border-radius: var(--radius-panel-sm);
          border: 1.5px solid transparent;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .changelog-page-group-items {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .changelog-page-group-item {
          padding-left: 16px;
          border-left: 2px solid var(--brand-soft);
        }
        .changelog-page-item-title {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: var(--text);
          line-height: 1.5;
        }
        .changelog-page-item-summary {
          display: block;
          font-size: 13px;
          color: var(--muted);
          line-height: 1.5;
          margin-top: 2px;
        }
        .changelog-page-item-details {
          list-style: disc;
          margin: 4px 0 0 0;
          padding-left: 18px;
          font-size: 13px;
          color: var(--muted);
          line-height: 1.65;
        }

        /* ── Empty / Error state ─────────────────────────────────────── */
        .changelog-page-empty {
          padding: 28px 24px;
          border: 1px dashed var(--line);
          border-radius: var(--radius-panel-lg);
          color: var(--muted);
          background: var(--panel);
          text-align: center;
          font-size: 14px;
        }

        /* ── Bottom CTA ──────────────────────────────────────────────── */
        .changelog-page-cta {
          text-align: center;
          padding: 48px 0 16px 0;
          margin-top: 40px;
          border-top: 1px solid var(--line);
        }
        .changelog-page-cta-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: var(--button-height);
          padding: 0 var(--button-padding-x);
          background: var(--btn-solid-bg);
          color: var(--btn-solid-text);
          border: 1px solid var(--btn-solid-border);
          border-radius: var(--radius-button);
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          box-shadow: var(--btn-solid-shadow);
          transition: opacity 0.18s ease, transform 0.18s ease;
          cursor: pointer;
        }
        .changelog-page-cta-btn:hover {
          opacity: 0.92;
          transform: translateY(-1px);
        }
        .changelog-page-cta-note {
          margin: 12px 0 0 0;
          font-size: 13px;
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}
