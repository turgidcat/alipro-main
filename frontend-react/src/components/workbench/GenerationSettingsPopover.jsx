import { useEffect, useRef, useState } from 'react';
import { getPlanWordCount } from '../../lib/chapterPlan.js';

export default function GenerationSettingsPopover(props) {
  const {
    draftChapterPlan,
    loadingChapter,
    isGenerating,
    onUpdateGenerationSetting
  } = props;

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  return (
    <div ref={ref} className="generation-settings-popover">
      <button
        type="button"
        className={'ghost-btn generation-settings-trigger' + (open ? ' is-open' : '')}
        onClick={() => setOpen((current) => !current)}
        disabled={loadingChapter || isGenerating}
      >
        参数
      </button>
      {open ? (
        <div className="generation-settings-panel">
          <div className="generation-settings-panel-head">
            <strong>生成参数</strong>
            <span>低频项收在这里，不占主路径。</span>
          </div>
          <div className="space-y-4">
            <label className="editor-field generation-word-count-field">
              <span className="mb-2 block font-mono text-[11px] font-bold tracking-[0.12em] text-[color:var(--muted)]">目标字数</span>
              <input
                className="chapter-number-input"
                type="number"
                min="500"
                max="10000"
                step="500"
                value={getPlanWordCount(draftChapterPlan)}
                onChange={(event) => onUpdateGenerationSetting('word_count', Math.min(10000, Math.max(500, Number(event.target.value) || 3000)))}
                disabled={loadingChapter || isGenerating}
              />
            </label>
            <p className="generation-settings-hint text-[14px] leading-7 text-[color:var(--muted)]">
              先只保留字数，后续低频项也统一放这里。
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
