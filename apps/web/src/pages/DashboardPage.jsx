import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchBookList,
  fetchBooksStats,
  getStoredCurrentBookId,
  persistCurrentBookId
} from '../workbenchApi.js';
import { brand } from '../config/brand.js';
import '../app-shell.css';

function formatCount(value) {
  const number = Number(value || 0);
  return number >= 10000 ? `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)}万` : number.toLocaleString('zh-CN');
}

function statusLabel(status) {
  return ({ draft: '草稿', writing: '创作中', completed: '已完成', archived: '已归档' })[status] || '进行中';
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currentBookId = getStoredCurrentBookId();

  useEffect(() => {
    let active = true;
    Promise.all([fetchBookList(), fetchBooksStats()])
      .then(([bookList, bookStats]) => {
        if (!active) return;
        setBooks(bookList);
        setStats(bookStats);
        setError('');
      })
      .catch((reason) => {
        if (!active) return;
        const message = String(reason?.message || '');
        setError(message === 'HTTP 500' ? '数据服务暂时不可用，请确认服务已启动后重试。' : (message || '数据仓暂时无法读取，请稍后再试。'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const currentBook = useMemo(
    () => books.find((book) => book.id === currentBookId) || books[0] || null,
    [books, currentBookId]
  );
  const recentBooks = useMemo(() => books.slice(0, 5), [books]);

  function openWorkbench(book = currentBook) {
    if (book?.id) persistCurrentBookId(book.id);
    navigate('/workbench');
  }

  return (
    <main className="dashboard-page">
      <style>{`
        .dashboard-page { min-height: 100%; padding: 34px clamp(18px, 4vw, 52px) 72px; color: var(--text); }
        .dashboard-wrap { width: min(1180px, 100%); margin: 0 auto; }
        .dashboard-eyebrow { color: var(--brand); font: 800 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .14em; text-transform: uppercase; }
        .dashboard-head { display:flex; align-items:flex-end; justify-content:space-between; gap:20px; margin-bottom:26px; }
        .dashboard-head h1 { margin:8px 0 8px; font:900 clamp(30px, 5vw, 48px)/1.05 ui-serif, Georgia, serif; letter-spacing:-.05em; }
        .dashboard-head p { max-width:560px; margin:0; color:var(--muted); line-height:1.7; }
        .dashboard-head-actions { display:flex; gap:10px; flex-wrap:wrap; }
        .dashboard-button { min-height:44px; padding:0 16px; border-radius:14px; border:1px solid var(--line); background:var(--panel-strong); color:var(--text); font-weight:800; cursor:pointer; }
        .dashboard-button.primary { border-color:var(--brand); background:var(--brand); color:#fff; }
        .dashboard-continue { display:grid; grid-template-columns:1fr auto; gap:20px; align-items:center; margin-bottom:18px; padding:22px; border:1px solid color-mix(in srgb, var(--brand) 30%, var(--line)); border-radius:22px; background:linear-gradient(135deg, color-mix(in srgb, var(--brand-soft) 68%, var(--panel-strong)), var(--panel-strong)); box-shadow:0 16px 34px rgba(38,54,47,.08); }
        .dashboard-continue-kicker { color:var(--brand-deep); font-size:11px; font-weight:850; letter-spacing:.08em; }
        .dashboard-continue h2 { margin:7px 0 7px; font:900 clamp(23px, 4vw, 32px)/1.2 ui-serif, Georgia, serif; }
        .dashboard-continue p { margin:0; color:var(--muted); line-height:1.65; }
        .dashboard-stats { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; margin-bottom:28px; }
        .dashboard-stat { padding:16px; border:1px solid var(--line); border-radius:18px; background:var(--panel-strong); }
        .dashboard-stat span { display:block; color:var(--muted); font-size:12px; font-weight:750; }
        .dashboard-stat strong { display:block; margin-top:9px; font-size:24px; letter-spacing:-.04em; }
        .dashboard-section { margin-top:26px; }
        .dashboard-section-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
        .dashboard-section-head h2 { margin:0; font-size:18px; }
        .dashboard-section-head button { border:0; background:transparent; color:var(--brand-deep); font-weight:800; cursor:pointer; }
        .dashboard-book-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
        .dashboard-book { display:flex; align-items:center; justify-content:space-between; gap:14px; min-width:0; padding:16px; border:1px solid var(--line); border-radius:18px; background:var(--panel-strong); cursor:pointer; text-align:left; }
        .dashboard-book:hover { border-color:color-mix(in srgb,var(--brand) 46%,var(--line)); transform:translateY(-1px); }
        .dashboard-book-copy { min-width:0; }
        .dashboard-book strong,.dashboard-book small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .dashboard-book strong { font-size:16px; }
        .dashboard-book small { margin-top:6px; color:var(--muted); }
        .dashboard-book-arrow { color:var(--brand); font-size:22px; }
        .dashboard-quick { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
        .dashboard-quick button { min-height:92px; padding:16px; border:1px solid var(--line); border-radius:18px; background:var(--panel); color:var(--text); text-align:left; cursor:pointer; }
        .dashboard-quick strong,.dashboard-quick span { display:block; }
        .dashboard-quick span { margin-top:8px; color:var(--muted); font-size:12px; line-height:1.5; }
        .dashboard-empty,.dashboard-error { padding:22px; border:1px dashed var(--line-strong); border-radius:18px; color:var(--muted); background:var(--panel); }
        .dashboard-error { border-color:#d78b83; color:#8f3931; background:#fff5f2; }
        @media (max-width:900px) { .dashboard-stats { grid-template-columns:repeat(3,minmax(0,1fr)); } .dashboard-quick { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media (max-width:620px) { .dashboard-page { padding:22px 16px calc(88px + env(safe-area-inset-bottom)); } .dashboard-head { display:block; } .dashboard-head-actions { margin-top:16px; } .dashboard-head-actions .dashboard-button { flex:1; } .dashboard-continue { grid-template-columns:1fr; } .dashboard-stats { grid-template-columns:repeat(2,minmax(0,1fr)); } .dashboard-book-list { grid-template-columns:1fr; } }
      `}</style>
      <section className="mobile-dashboard-screen" aria-label="移动端数据仓首页">
        <div className="mobile-dashboard-greeting">
          <div className="mobile-dashboard-avatar">叙</div>
          <div>
            <span>LONGFORM STUDIO</span>
            <strong>今天也写一点。</strong>
          </div>
          <button type="button" onClick={() => navigate('/books')} aria-label="打开资料库">⌕</button>
        </div>

        {error ? <div className="dashboard-error" role="alert">{error}</div> : null}
        {currentBook ? (
          <section className="mobile-dashboard-continue">
            <div className="mobile-dashboard-continue-cover">{String(currentBook.title || '未').slice(0, 1)}</div>
            <div className="mobile-dashboard-continue-copy">
              <span>继续上次创作</span>
              <strong>{currentBook.title}</strong>
              <small>{currentBook.chapterCount ? `已完成 ${currentBook.chapterCount} 章 · ${formatCount(currentBook.wordCount)} 字` : '作品还没有章节，从第一章开始。'}</small>
            </div>
            <button type="button" onClick={() => openWorkbench(currentBook)} aria-label="继续创作">→</button>
          </section>
        ) : null}

        <div className="mobile-dashboard-stats" aria-label="创作数据">
          {[['作品', stats?.totalBooks], ['章节', stats?.totalChapters], ['字数', formatCount(stats?.totalWords)], ['角色', stats?.totalCharacters]].map(([label, value]) => (
            <div key={label}><strong>{loading ? '—' : (value ?? 0)}</strong><span>{label}</span></div>
          ))}
        </div>

        <section className="mobile-dashboard-actions">
          <div className="mobile-dashboard-section-head"><h2>现在做什么</h2></div>
          <div className="mobile-dashboard-action-list">
            <button type="button" onClick={() => openWorkbench()}><i className="is-green">✎</i><span><strong>继续创作</strong><small>从当前章节进入创作台</small></span><b>›</b></button>
            <button type="button" onClick={() => navigate('/books')}><i className="is-blue">▤</i><span><strong>整理资料库</strong><small>查看作品、角色和章节</small></span><b>›</b></button>
            <button type="button" onClick={() => navigate('/inspiration/brainstorm')}><i className="is-gold">✦</i><span><strong>记录新灵感</strong><small>把一个念头变成可用素材</small></span><b>›</b></button>
          </div>
        </section>

        <section className="mobile-dashboard-recent">
          <div className="mobile-dashboard-section-head"><h2>最近作品</h2><button type="button" onClick={() => navigate('/books')}>全部</button></div>
          <div className="mobile-dashboard-recent-list">
            {recentBooks.map((book) => (
              <button type="button" key={book.id} onClick={() => openWorkbench(book)}>
                <span className="mobile-dashboard-book-dot">{String(book.title || '未').slice(0, 1)}</span>
                <span><strong>{book.title}</strong><small>{statusLabel(book.status)} · {formatCount(book.wordCount)} 字</small></span>
                <b>›</b>
              </button>
            ))}
          </div>
        </section>
      </section>

      <div className="dashboard-desktop-screen">
      <div className="dashboard-wrap">
        <header className="dashboard-head">
          <div>
            <span className="dashboard-eyebrow">{brand.englishName} · COMMAND CENTER</span>
            <h1>今天，先把故事往前推一步。</h1>
            <p>这里汇总作品进度、章节产出与下一步入口。把资料库留给整理，把创作台留给动笔。</p>
          </div>
          <div className="dashboard-head-actions">
            <button type="button" className="dashboard-button" onClick={() => navigate('/books')}>进入资料库</button>
            <button type="button" className="dashboard-button primary" onClick={() => openWorkbench()}>开始创作</button>
          </div>
        </header>

        {error ? <div className="dashboard-error" role="alert">{error}</div> : null}
        {!error && currentBook ? (
          <section className="dashboard-continue">
            <div>
              <span className="dashboard-continue-kicker">继续上次创作</span>
              <h2>{currentBook.title}</h2>
              <p>{currentBook.chapterCount ? `已完成 ${currentBook.chapterCount} 章 · ${formatCount(currentBook.wordCount)} 字` : '作品还没有章节，先从第一章开始。'}</p>
            </div>
            <button type="button" className="dashboard-button primary" onClick={() => openWorkbench(currentBook)}>继续创作 <span aria-hidden="true">→</span></button>
          </section>
        ) : null}

        <section className="dashboard-stats" aria-label="创作数据">
          {[['作品', stats?.totalBooks], ['章节', stats?.totalChapters], ['累计字数', formatCount(stats?.totalWords)], ['角色', stats?.totalCharacters], ['近 7 天更新', stats?.recent7Days]].map(([label, value]) => (
            <div className="dashboard-stat" key={label}><span>{label}</span><strong>{loading ? '—' : (value ?? 0)}</strong></div>
          ))}
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-head"><h2>最近作品</h2><button type="button" onClick={() => navigate('/books')}>查看全部 →</button></div>
          {recentBooks.length > 0 ? (
            <div className="dashboard-book-list">
              {recentBooks.map((book) => (
                <button type="button" className="dashboard-book" key={book.id} onClick={() => openWorkbench(book)}>
                  <span className="dashboard-book-copy"><strong>{book.title}</strong><small>{statusLabel(book.status)} · {formatCount(book.wordCount)} 字</small></span>
                  <span className="dashboard-book-arrow" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          ) : <div className="dashboard-empty">还没有作品。先建立一部作品，数据仓会自动记录你的创作进度。</div>}
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-head"><h2>快速入口</h2></div>
          <div className="dashboard-quick">
            <button type="button" onClick={() => navigate('/books')}><strong>资料库</strong><span>管理作品、章节与设定</span></button>
            <button type="button" onClick={() => openWorkbench()}><strong>创作台</strong><span>从本章细纲开始生成正文</span></button>
            <button type="button" onClick={() => navigate('/inspiration/brainstorm')}><strong>灵感探索</strong><span>把模糊想法变成可用素材</span></button>
            <button type="button" onClick={() => navigate('/audiobook')}><strong>有声书</strong><span>让已经写好的章节被听见</span></button>
          </div>
        </section>
      </div>
      </div>
    </main>
  );
}
