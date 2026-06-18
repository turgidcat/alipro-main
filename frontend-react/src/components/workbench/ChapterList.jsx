import { useState, useRef, useEffect } from 'react';

export default function ChapterList({ currentChapter, items, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const chapterItems = Array.isArray(items) && items.length > 0
    ? items
    : [{ chapterNumber: currentChapter || 1, chapterName: '', status: 'empty' }];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="workbench-global-bar-nav-btn"
        onClick={() => setOpen((v) => !v)}
      >
        章节列表 ▾
      </button>
      {open && (
        <div className="chapter-list-dropdown">
          {chapterItems.map((item) => (
            <div
              key={item.chapterNumber}
              className={`chapter-list-item${item.chapterNumber === currentChapter ? ' is-current' : ''}`}
              onClick={() => { onSelect(item.chapterNumber); setOpen(false); }}
            >
              <span className={`chapter-list-dot ${item.status || 'empty'}`} />
              <span>第 {item.chapterNumber} 章{item.chapterName ? ` · ${item.chapterName}` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
