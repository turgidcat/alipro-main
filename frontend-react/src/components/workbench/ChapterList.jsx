import { useState, useRef, useEffect } from 'react';

export default function ChapterList({ currentChapter, totalChapters, chapterNames, onSelect }) {
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

  const count = totalChapters || currentChapter || 1;
  const items = Array.from({ length: count }, (_, i) => {
    const num = i + 1;
    const name = (chapterNames && chapterNames[num]) || '';
    // P1 简化三态:当前章及之前默认 has-content,之后默认 empty
    // P2 会接 chapter-plans 列表接口做精确三态
    const hasContent = num <= currentChapter;
    const planOnly = false;
    return { num, name, hasContent, planOnly };
  });

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
          {items.map((item) => (
            <div
              key={item.num}
              className={`chapter-list-item${item.num === currentChapter ? ' is-current' : ''}`}
              onClick={() => { onSelect(item.num); setOpen(false); }}
            >
              <span className={`chapter-list-dot ${item.hasContent ? 'has-content' : item.planOnly ? 'plan-only' : 'empty'}`} />
              <span>第 {item.num} 章{item.name ? ` · ${item.name}` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
