import { useEffect } from 'react';

const NAV_ITEMS = [
  { key: 'list', short: '列', label: '书籍列表' },
  { key: 'summary', short: '总', label: '全书汇总' },
  { key: 'outline', short: '纲', label: '大纲链' },
  { key: 'storyline', short: '脉', label: '叙事脉络' },
  { key: 'characters', short: '角', label: '角色资料' },
  { key: 'chapters', short: '章', label: '章节与正文' }
];

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

/**
 * 资料库子页面顶部导航。
 * 以水平分段式导航替代旧版左侧栏，切换子页面时页面高度保持稳定，
 * 并与全局左侧导航形成视觉区分。
 */
export default function LibraryTopNav({
  active = 'list',
  bookId = '',
  bookTitle = '请先选择书籍',
  books = [],
  currentBookId = '',
  onSwitchBook,
  onNavigate
}) {
  useEffect(() => {
    const current = NAV_ITEMS.find((item) => item.key === active);
    if (current) {
      document.title = `${current.label} · 资料库`;
    }
  }, [active]);

  return (
    <>
      <style>{`
        .library-topbar {
          position: sticky;
          top: 14px;
          z-index: 30;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 10px 12px;
          border: 1px solid var(--paper-border);
          border-radius: var(--paper-radius-lg);
          background: var(--paper-glass-strong);
          box-shadow: var(--paper-shadow-card);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .library-topbar-nav {
          display: flex;
          align-items: center;
          gap: 4px;
          min-width: 0;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .library-topbar-nav::-webkit-scrollbar {
          display: none;
        }

        .library-topbar-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 36px;
          padding: 5px 12px 5px 6px;
          border: 1px solid transparent;
          border-radius: var(--paper-radius-sm);
          background: transparent;
          color: var(--paper-text-soft);
          font-family: var(--font-sans);
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          cursor: pointer;
          transition: background 150ms ease, color 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
        }

        .library-topbar-item:hover:not(:disabled) {
          background: var(--paper-accent-hover);
          color: var(--paper-text);
        }

        .library-topbar-item.is-active {
          background: var(--paper-primary);
          border-color: var(--paper-primary);
          color: var(--paper-surface-raised);
          box-shadow: 0 8px 20px rgba(90, 75, 60, 0.2);
        }

        .library-topbar-item:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .library-topbar-chip {
          display: grid;
          flex: 0 0 24px;
          width: 24px;
          height: 24px;
          place-items: center;
          border: 1px solid var(--paper-accent-border);
          border-radius: 7px;
          background: var(--paper-tint-warm);
          color: var(--paper-accent-deep);
          font-size: 11px;
          font-weight: 700;
        }

        .library-topbar-item.is-active .library-topbar-chip {
          background: rgba(255, 255, 255, 0.18);
          border-color: rgba(255, 255, 255, 0.34);
          color: var(--paper-surface-raised);
        }

        .library-topbar-context {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          min-width: 0;
        }

        .library-topbar-context-label {
          color: var(--paper-text-tertiary);
          font-size: 11px;
          font-weight: 650;
          white-space: nowrap;
        }

        .library-topbar-book-title {
          color: var(--paper-text);
          font-size: 13px;
          font-weight: 750;
          max-width: 170px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .library-topbar-select {
          height: 32px;
          max-width: 190px;
          padding: 0 8px;
          border: 1px solid var(--paper-border-strong);
          border-radius: var(--paper-radius-sm);
          background: var(--paper-surface-raised);
          color: var(--paper-text);
          font-family: var(--font-sans);
          font-size: 12px;
          outline: none;
          cursor: pointer;
        }

        .library-topbar-select:focus {
          border-color: var(--paper-accent-border);
          box-shadow: 0 0 0 3px var(--paper-accent-soft);
        }

        @media (max-width: 980px) {
          .library-topbar {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }

          .library-topbar-context {
            justify-content: flex-end;
          }
        }
      `}</style>

      <header className="library-topbar" aria-label="资料库子页面导航">
        <nav className="library-topbar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={joinClasses('library-topbar-item', active === item.key && 'is-active')}
              onClick={() => onNavigate?.(item.key)}
              disabled={item.key !== 'list' && !bookId}
              title={item.label}
              aria-current={active === item.key ? 'page' : undefined}
            >
              <span className="library-topbar-chip" aria-hidden="true">{item.short}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="library-topbar-context">
          <span className="library-topbar-context-label">当前书籍</span>
          {books.length > 1 ? (
            <select
              className="library-topbar-select"
              value={currentBookId}
              onChange={(event) => onSwitchBook?.(event.target.value)}
              aria-label="切换书籍"
            >
              {books.map((book) => (
                <option key={book.id} value={book.id}>{book.title || '未命名书籍'}</option>
              ))}
            </select>
          ) : (
            <strong className="library-topbar-book-title">{bookTitle}</strong>
          )}
        </div>
      </header>
    </>
  );
}
