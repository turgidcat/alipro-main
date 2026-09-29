import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles.css';
import '../app-shell.css';
import '../changelog-paper.css';
import { getApiBase } from '../lib/apiBase.js';

const CHANGE_TYPES = {
  important: '重要',
  fix: '修复',
  improve: '完善',
  feature: '新功能',
  docs: '文档'
};

function normalizeDetails(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) return value.split('|').map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeItem(item = {}) {
  return { date: item.date || '', title: item.title || '未命名更新', summary: item.summary || '', details: normalizeDetails(item.details), status: item.status || '' };
}

function normalizeGroup(group = {}) {
  return { category: group.category || 'improve', title: group.title || CHANGE_TYPES[group.category] || '未分类', items: Array.isArray(group.items) ? group.items.map(normalizeItem) : [] };
}

function normalizeRelease(release = {}) {
  return { version: release.version || '', date: release.date || '', groups: Array.isArray(release.groups) ? release.groups.map(normalizeGroup) : [] };
}

export default function ChangelogPage() {
  const navigate = useNavigate();
  const [data, setData] = useState({ currentVersion: '', lastUpdated: '', updatedAt: '', releases: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const response = await fetch(`${getApiBase()}/analysis/changelog`, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok || payload.success === false) throw new Error(payload.error || `HTTP ${response.status}`);
        if (alive) setData(payload.data || {});
      } catch (loadError) {
        if (alive) setError(loadError.message || '加载失败');
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const releases = useMemo(() => (Array.isArray(data.releases) ? data.releases.map(normalizeRelease) : []), [data.releases]);
  const updateCount = releases.reduce((total, release) => total + release.groups.reduce((groupTotal, group) => groupTotal + group.items.length, 0), 0);

  return (
    <div className="changelog-app-surface">
      <header className="changelog-app-hero">
        <div className="changelog-app-kicker">PRODUCT JOURNAL</div>
        <div className="changelog-app-hero-row">
          <div><h1>更新日志</h1><p>把每一次产品进化，留在创作现场。</p></div>
          <span className="changelog-app-current-version">{data.currentVersion ? `v${data.currentVersion}` : '同步中'}</span>
        </div>
        <div className="changelog-app-stats"><span><b>{releases.length}</b> 个版本</span><i /><span><b>{updateCount}</b> 项变化</span><i /><span>{data.lastUpdated ? `最近更新 ${data.lastUpdated}` : '等待同步'}</span></div>
      </header>

      <main className="changelog-app-feed">
        {loading ? <div className="changelog-app-state">正在读取产品更新…</div> : null}
        {!loading && error ? <div className="changelog-app-state is-error">更新日志加载失败：{error}</div> : null}
        {!loading && !error ? releases.map((release, releaseIndex) => (
          <article className="changelog-release-card" key={release.version || release.date || releaseIndex}>
            <div className="changelog-release-rail" aria-hidden="true"><span /></div>
            <div className="changelog-release-head"><div><span className="changelog-release-index">0{releaseIndex + 1}</span><strong>{release.version ? `v${release.version}` : '未命名版本'}</strong></div><time>{release.date || '日期待补充'}</time></div>
            <p className="changelog-release-caption">{releaseIndex === 0 ? '当前版本' : '版本迭代'}</p>
            <div className="changelog-release-groups">
              {release.groups.map((group) => (
                <section className={`changelog-change-group is-${group.category}`} key={`${release.version}-${group.category}`}>
                  <div className="changelog-change-group-head"><span>{group.title}</span><small>{group.items.length} 项</small></div>
                  <ul>{group.items.map((item, itemIndex) => <li key={`${release.version}-${group.category}-${itemIndex}`}><strong>{item.title}</strong>{item.summary ? <p>{item.summary}</p> : null}{item.details.map((detail, detailIndex) => <span key={`${item.title}-${detailIndex}`}>· {detail}</span>)}</li>)}</ul>
                </section>
              ))}
            </div>
          </article>
        )) : null}
      </main>

      <footer className="changelog-app-footer"><p>接下来，把更新变成你的下一章。</p><button type="button" onClick={() => navigate('/books')}>进入资料库 <span>→</span></button></footer>
    </div>
  );
}
