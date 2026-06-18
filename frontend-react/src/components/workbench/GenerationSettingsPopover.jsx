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
        ⚙ 参数
      </button>
      {open ? (
        <div className="generation-settings-panel">
          <div className="generation-settings-panel-head">
            <strong>生成参数</strong>
            <span>这些是低频调节项，不占主路径位置。</span>
          </div>
          <div className="generation-settings-row">
            <label className="editor-field generation-word-count-field">
              <span>目标字数</span>
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
            <p className="generation-settings-hint">
              先只保留字数，后续如果要加更多低频项，也统一收在这里。
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
