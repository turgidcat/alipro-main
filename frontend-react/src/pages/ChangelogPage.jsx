import { useEffect, useMemo, useState } from 'react';
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
        const response = await fetch('/api/analysis/changelog', { cache: 'no-store' });
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
      <header className="hero-section">
        <div>
          <span className="hero-eyebrow">Release Notes</span>
          <h1>更新日志</h1>
          <p>按版本号归档，再按分类展开具体更新内容。</p>
        </div>
        <div className="hero-note-card">
          <strong>{data.currentVersion ? `当前版本 v${data.currentVersion}` : '当前版本待同步'}</strong>
          <p>{data.lastUpdated ? `版本日期：${data.lastUpdated}` : '版本日期暂未记录'}</p>
          <p>{data.updatedAt ? `日志同步：${data.updatedAt.slice(0, 16).replace('T', ' ')}` : '日志尚未同步'}</p>
        </div>
      </header>

      <section className="workbench-stage">
        {loading ? <div className="version-empty">正在读取更新日志...</div> : null}
        {!loading && error ? <div className="version-empty">更新日志加载失败：{error}</div> : null}
        {!loading && !error ? (
          <div className="release-list">
            {releases.map((release) => (
              <article key={release.version || release.date} className="release-item">
                <div className="release-head">
                  <div>
                    <div className="release-version">{release.version ? `v${release.version}` : '未命名版本'}</div>
                  </div>
                  <div className="release-date">{release.date}</div>
                </div>

                <div className="release-groups">
                  {release.groups.map((group) => {
                    const meta = tagMeta[group.category] || tagMeta.improve;
                    return (
                      <section key={`${release.version}-${group.category}`} className="release-group">
                        <div className="group-head">
                          <span
                            className="group-tag"
                            style={{
                              background: meta.bg,
                              color: meta.color,
                              borderColor: meta.border
                            }}
                          >
                            {group.title}
                          </span>
                        </div>

                        <div className="group-items">
                          {group.items.map((item, index) => (
                            <div key={`${release.version}-${group.category}-${index}`} className="group-item">
                              <div className="group-item-title">{item.title}</div>
                              <ul className="group-item-details">
                                {item.summary ? <li>{item.summary}</li> : null}
                                {item.details.map((detail, detailIndex) => (
                                  <li key={`${release.version}-${group.category}-${index}-${detailIndex}`}>{detail}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <style>{`
        .release-list { display: grid; gap: 20px; }
        .release-item { padding: 22px 24px; border: 1px solid var(--line); border-radius: 22px; background: var(--panel); }
        .release-head { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 16px; }
        .release-version { font-size: 24px; font-weight: 800; color: var(--text); letter-spacing: 0.04em; }
        .release-date { color: var(--muted); font-size: 13px; white-space: nowrap; }
        .release-groups { display: grid; gap: 16px; }
        .release-group { display: grid; gap: 10px; }
        .group-head { display: flex; align-items: center; }
        .group-tag { display: inline-flex; align-items: center; min-height: 34px; padding: 0 12px; border-radius: 10px; border: 2px solid transparent; font-size: 14px; font-weight: 800; }
        .group-items { display: grid; gap: 12px; }
        .group-item { padding-left: 14px; border-left: 3px solid rgba(240, 190, 100, 0.7); }
        .group-item-title { font-size: 15px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
        .group-item-details { margin: 0; padding-left: 18px; color: var(--muted); line-height: 1.65; }
        .version-empty { padding: 28px 24px; border: 1px dashed var(--line); border-radius: 18px; color: var(--muted); background: var(--panel); }
      `}</style>
    </div>
  );
}
