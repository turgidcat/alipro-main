import { useState } from 'react';
import { brand } from '../../config/brand.js';
import { genreOptions, getSubgenreOptions } from '../../lib/bookGenres.js';
import './project-entry.css';

const ENTRY_VIEW_STORAGE_KEY = 'alipro:entryView';
const allowedEntryViews = new Set(['home', 'create', 'select']);

const statusLabels = {
  writing: '连载中',
  completed: '已完结',
  paused: '暂停中',
  draft: '草稿'
};

function getStatusLabel(status) {
  return statusLabels[status] || status || '未设置状态';
}

function getBookMeta(book) {
  return [book?.genre, book?.subgenre].filter(Boolean).join(' · ') || getStatusLabel(book?.status);
}

function getInitialEntryView() {
  try {
    const storedView = window.sessionStorage.getItem(ENTRY_VIEW_STORAGE_KEY);
    window.sessionStorage.removeItem(ENTRY_VIEW_STORAGE_KEY);
    return allowedEntryViews.has(storedView) ? storedView : 'home';
  } catch {
    return 'home';
  }
}

export default function ProjectEntry({
  books,
  loadingBooks,
  error,
  createDraft,
  createState,
  onCreateDraftChange,
  onCreateBook,
  onSelectBook
}) {
  const hasBooks = Array.isArray(books) && books.length > 0;
  const [entryView, setEntryView] = useState(getInitialEntryView);
  const isHome = entryView === 'home';
  const isCreate = entryView === 'create';
  const isSelect = entryView === 'select';

  return (
    <main className={`project-entry-page${isHome ? ' is-home' : ''}`} data-testid="project-entry-page">
      <span className="project-entry-float project-entry-float-cloud" aria-hidden="true">☁️</span>
      <span className="project-entry-float project-entry-float-star" aria-hidden="true">✦</span>
      <header className="project-entry-topbar" aria-label={`${brand.shortName} 作品入口`}>
        <div>
          <p className="project-entry-brand"><span>~</span> {brand.fullName} <em>内测版</em> <span>==</span></p>
          <p className="project-entry-tagline">{brand.englishName}</p>
        </div>
        {isHome ? null : (
          <button type="button" className="project-entry-toplink" onClick={() => setEntryView('home')}>
            返回入口
          </button>
        )}
      </header>

      {isHome ? (
        <section className="project-entry-hero project-entry-hero-home">
          <div className="project-entry-copy project-entry-reveal">
            <p className="project-entry-kicker">~ {brand.shortName.toLowerCase()}@studio</p>
            <h1>
              {brand.chineseName}<br />
              <span className="project-handdrawn">{brand.slogan}</span>
            </h1>
            <p className="project-entry-subtitle">
              {brand.longDescription}
            </p>
            <div className="project-entry-feature-list" aria-label="产品能力">
              {brand.featurePoints.map((item) => (
                <span key={item.title} title={item.description}>{item.title}</span>
              ))}
            </div>
          </div>

          <div className="project-entry-home-panel project-entry-reveal project-entry-reveal-delay" aria-label="作品入口操作">
            <button type="button" className="project-primary-action" onClick={() => setEntryView('create')}>
              创建新书
            </button>
            <button type="button" className="project-secondary-action" onClick={() => setEntryView('select')}>
              选择作品
            </button>
            <div className="project-entry-future" aria-label="未来扩展">
              <span>未来扩展</span>
              <p>{brand.futureCapabilities.join(' · ')} · 规划中</p>
            </div>
            {loadingBooks ? <p>正在读取作品...</p> : null}
          </div>
        </section>
      ) : null}

      {isCreate ? (
        <section className="project-entry-hero">
        <div className="project-entry-copy project-entry-reveal">
          <p className="project-entry-kicker">~ new@book</p>
          <h1>创建新书</h1>
          <p className="project-entry-subtitle">写下名字，打开新故事。</p>
        </div>

        <form className="project-create-panel project-entry-reveal project-entry-reveal-delay" onSubmit={onCreateBook}>
          <div className="project-create-head">
            <span>新作品</span>
            <strong>创建新书</strong>
          </div>

          {error ? <div className="project-entry-alert is-error">{error}</div> : null}
          {loadingBooks ? <div className="project-entry-alert">正在读取作品列表...</div> : null}

          <label className="project-entry-field">
            <span>书名</span>
            <input
              value={createDraft.title}
              onChange={(event) => onCreateDraftChange('title', event.target.value)}
              placeholder="输入新作品名称"
            />
          </label>
          <div className="project-entry-field-row">
            <label className="project-entry-field">
              <span>题材</span>
              <select
                value={createDraft.genre}
                onChange={(event) => {
                  onCreateDraftChange('genre', event.target.value);
                  onCreateDraftChange('subgenre', '');
                }}
              >
                {genreOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="project-entry-field">
              <span>子分类</span>
              <select
                value={createDraft.subgenre}
                onChange={(event) => onCreateDraftChange('subgenre', event.target.value)}
              >
                <option value="">未细分</option>
                {getSubgenreOptions(createDraft.genre).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="project-entry-field">
            <span>作者</span>
            <input
              value={createDraft.author}
              onChange={(event) => onCreateDraftChange('author', event.target.value)}
              placeholder="可选"
            />
          </label>
          <label className="project-entry-field">
            <span>简介</span>
            <textarea
              value={createDraft.description}
              onChange={(event) => onCreateDraftChange('description', event.target.value)}
              placeholder="一句话写下故事核心"
            />
          </label>

          {createState.error ? <div className="project-entry-alert is-error">{createState.error}</div> : null}
          <button type="submit" className="project-primary-action" disabled={createState.loading}>
            {createState.loading ? '正在创建...' : '创建新书'}
          </button>
        </form>
      </section>
      ) : null}

      {isSelect ? (
      <section className="project-list-section project-entry-reveal" id="project-list" aria-label="作品列表">
        <div className="project-list-head">
          <div>
            <p className="project-entry-kicker">~ books@local</p>
            <h2>{hasBooks ? '选择作品' : '还没有作品'}</h2>
          </div>
          {hasBooks ? <p>{books.length} 部作品</p> : <p>先创建一本新书</p>}
        </div>

        {hasBooks ? (
          <div className="project-card-grid">
            {books.map((book) => (
              <article key={book.id} className="project-card">
                <div>
                  <span>{getStatusLabel(book.status)}</span>
                  <h3>《{book.title || '未命名作品'}》</h3>
                  <p>{getBookMeta(book)}</p>
                </div>
                <div className="project-card-actions">
                  <button type="button" onClick={() => onSelectBook(book.id, 'library')}>
                    整理资料
                  </button>
                  <button type="button" onClick={() => onSelectBook(book.id, 'workbench')}>
                    继续创作
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="project-empty-panel">
            <p>作品会出现在这里。</p>
          </div>
        )}
      </section>
      ) : null}
    </main>
  );
}
