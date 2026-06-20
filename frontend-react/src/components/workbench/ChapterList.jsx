import { useEffect, useRef, useState } from 'react';

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

const STATUS_DOT_CLASS = {
  'has-content': 'bg-[color:var(--brand)]',
  'plan-only': 'border border-[color:var(--brand)] bg-transparent',
  empty: 'bg-[color:var(--line-strong)]'
};

export default function ChapterList({ currentChapter, items, onSelect, triggerClassName = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    setOpen(false);
  }, [currentChapter]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
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
    <div ref={ref} className="relative">
      <button
        type="button"
        className={joinClasses(
          'min-h-11 rounded-2xl border px-4 font-mono text-[12px] font-bold transition',
          triggerClassName ||
            'border-[color:var(--btn-ghost-border)] bg-[var(--btn-ghost-bg)] text-[var(--btn-ghost-text)] hover:border-[color:var(--brand-soft-strong)] hover:bg-[var(--brand-soft)]',
          open ? 'border-[color:var(--brand-soft-strong)] bg-[var(--brand-soft)]' : ''
        )}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        章节列表 ▾
      </button>
      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 flex max-h-[26rem] w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 overflow-y-auto rounded-[24px] border border-[color:var(--line)] bg-[color:color-mix(in_srgb,var(--panel-strong)_96%,white)] p-3 shadow-[0_24px_54px_rgba(15,23,42,0.14)]"
          role="listbox"
          aria-label="章节列表"
        >
          {chapterItems.map((item) => {
            const isCurrent = item.chapterNumber === currentChapter;
            return (
              <button
                type="button"
                key={item.chapterNumber}
                className={joinClasses(
                  'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[13px] transition',
                  'hover:bg-[var(--brand-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-soft-strong)]',
                  isCurrent ? 'bg-[var(--brand-soft)] font-semibold text-[color:var(--brand-deep)]' : 'text-[color:var(--text)]'
                )}
                aria-selected={isCurrent}
                onClick={() => {
                  onSelect(item.chapterNumber);
                  setOpen(false);
                }}
              >
                <span
                  className={joinClasses(
                    'h-2.5 w-2.5 shrink-0 rounded-full',
                    STATUS_DOT_CLASS[item.status || 'empty'] || STATUS_DOT_CLASS.empty
                  )}
                />
                <span>第 {item.chapterNumber} 章{item.chapterName ? ` · ${item.chapterName}` : ''}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
