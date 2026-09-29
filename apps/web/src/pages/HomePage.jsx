import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { brand } from '../config/brand.js';
import { fetchBookList, getStoredCurrentBookId, persistCurrentBookId } from '../workbenchApi.js';
import { formatExactWordCount } from '../lib/textMetrics.js';
import '../home-paper.css';

function HomeLogo() {
  return (
    <span className="home-product-logo" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.5 8.7c3.8-.8 6.8-.1 10.5 2.6v12.9c-3.7-2.7-6.7-3.4-10.5-2.6Z" />
        <path d="M26.5 8.7c-3.8-.8-6.8-.1-10.5 2.6v12.9c3.7-2.7 6.7-3.4 10.5-2.6Z" />
        <path d="M16 11.3v12.9" />
        <path d="m22.1 4.3.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9Z" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

function StoryOrbit() {
  return (
    <div className="home-story-orbit" aria-hidden="true">
      <svg viewBox="0 0 360 360" fill="none">
        <circle cx="180" cy="180" r="116" />
        <path d="M72 138c53-50 148-63 220 8M64 222c60 48 159 55 232-2" />
        <path d="M129 74c-26 66-18 161 44 219M236 72c33 65 28 160-26 222" />
      </svg>
      <span className="home-orbit-node is-world">世界</span>
      <span className="home-orbit-node is-role">人物</span>
      <span className="home-orbit-node is-story">脉络</span>
      <span className="home-orbit-node is-chapter">章节</span>
      <div className="home-orbit-core"><HomeLogo /><strong>长篇创作</strong><small>持续连线</small></div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchBookList()
      .then((items) => { if (alive) setBooks(Array.isArray(items) ? items : []); })
      .catch(() => { if (alive) setBooks([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const currentBook = useMemo(() => {
    const storedId = getStoredCurrentBookId();
    return books.find((book) => String(book.id) === String(storedId)) || books[0] || null;
  }, [books]);

  function continueWriting() {
    if (!currentBook) {
      navigate('/books');
      return;
    }
    persistCurrentBookId(currentBook.id);
    window.sessionStorage.setItem('alipro-open-current-workbench', '1');
    navigate('/workbench');
  }

  return (
    <div className="home-app-surface">
      <header className="home-app-topbar">
        <button type="button" className="home-app-brand" onClick={() => navigate('/me')} aria-label={`${brand.fullName} 我的空间`}>
          <HomeLogo />
          <span><strong>{brand.chineseName}</strong><small>{brand.shortName} · LONGFORM STUDIO</small></span>
        </button>
        <button type="button" className="home-app-skip" onClick={() => navigate('/me')}>进入工作区 <span>→</span></button>
      </header>

      <main className="home-app-main">
        <section className="home-app-hero">
          <div className="home-app-copy">
            <span className="home-app-eyebrow">AI LONGFORM CREATIVE STUDIO</span>
            <h1>让故事不断线，<br /><em>让创作继续发生。</em></h1>
            <p>{brand.description}。把人物、情节与章节放进同一个持续生长的创作空间。</p>
            <div className="home-app-actions">
              <button type="button" className="home-app-primary" onClick={continueWriting}>{currentBook ? '继续创作' : '开始第一部作品'} <span>→</span></button>
              <button type="button" className="home-app-secondary" onClick={() => navigate('/books')}>打开资料库</button>
            </div>
            <div className="home-app-proof"><span><i />阿里云创作数据</span><span><i />长篇上下文承接</span><span><i />作品结构化管理</span></div>
          </div>
          <StoryOrbit />
        </section>

        <section className="home-app-dock">
          <div className="home-app-current">
            <span className="home-app-section-kicker">{loading ? 'LOADING' : currentBook ? 'CONTINUE' : 'NEW STORY'}</span>
            {loading ? <p className="home-app-loading">正在寻找上次的创作现场…</p> : currentBook ? <>
              <div className="home-app-current-head"><div><small>当前作品</small><h2>{currentBook.title}</h2></div><span className="home-app-book-mark">{String(currentBook.title || '书').slice(0, 1)}</span></div>
              <p>{currentBook.description || '故事已经在这里展开，下一章等你继续。'}</p>
              <div className="home-app-book-meta"><span><b>{currentBook.chapter_count || 0}</b> 章</span><span><b>{formatExactWordCount(currentBook.word_count || 0)}</b> 字</span><span>{currentBook.genre || '未设置题材'}</span></div>
              <button type="button" onClick={continueWriting}>回到创作现场 <span>→</span></button>
            </> : <>
              <div className="home-app-current-head"><div><small>还没有作品</small><h2>写下故事的第一笔</h2></div><span className="home-app-book-mark">新</span></div>
              <p>建立作品后，人物、大纲、剧情线与章节会一起归入资料库。</p>
              <button type="button" onClick={() => navigate('/books')}>创建作品 <span>→</span></button>
            </>}
          </div>

          <div className="home-app-quick-grid">
            <button type="button" onClick={() => navigate('/me')}><span>01</span><strong>我的空间</strong><small>账号、数据仓与设置</small><b>↗</b></button>
            <button type="button" onClick={() => navigate('/books')}><span>02</span><strong>资料库</strong><small>整理人物、脉络与章节</small><b>↗</b></button>
            <button type="button" onClick={() => navigate('/inspiration/brainstorm')}><span>03</span><strong>灵感探索</strong><small>把模糊想法变成素材</small><b>↗</b></button>
          </div>
        </section>
      </main>

      <footer className="home-app-footer"><span>{brand.shortName} / PRIVATE CREATIVE SPACE</span><p>{brand.slogan}</p></footer>
    </div>
  );
}
