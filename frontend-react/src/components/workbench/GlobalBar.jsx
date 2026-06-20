import { useNavigate } from 'react-router-dom';
import ChapterList from './ChapterList.jsx';
import ThemePopover from '../theme/ThemePopover.jsx';

export default function GlobalBar({
  bookTitle,
  chapterNumber,
  chapterName,
  mainStorylineLabel,
  totalChapterCount,
  chapterListItems,
  onPrevChapter,
  onNextChapter,
  onSelectChapter
}) {
  const navigate = useNavigate();

  return (
    <div className="workbench-global-bar">
      <div className="flex flex-wrap items-center gap-3 text-[13px] text-[color:var(--muted)]">
        <button
          type="button"
          className="workbench-global-bar-book"
          onClick={() => navigate('/books')}
          title="点击查看资料库"
        >
          {bookTitle || '未选择书籍'}
        </button>
        <span className="workbench-global-bar-label">
          // chapter
        </span>
        <span className="workbench-global-bar-chapter">
          第 {chapterNumber} 章{chapterName ? ` ${chapterName}` : ''}
        </span>
        {mainStorylineLabel && mainStorylineLabel !== '暂未指定剧情线' ? (
          <span className="workbench-global-bar-storyline">
            {mainStorylineLabel}
          </span>
        ) : null}
      </div>

      <div className="workbench-global-bar-nav">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="ghost-btn"
            onClick={onPrevChapter}
            disabled={chapterNumber <= 1}
          >
            ◂ 上一章
          </button>
          <span className="workbench-global-bar-chapter-pos">
            {chapterNumber} / {totalChapterCount || '?'}
          </span>
          <button
            type="button"
            className="ghost-btn"
            onClick={onNextChapter}
          >
            下一章 ▸
          </button>
          <ChapterList
            currentChapter={chapterNumber}
            items={chapterListItems}
            onSelect={onSelectChapter}
            triggerClassName="ghost-btn"
          />
          <ThemePopover />
        </div>
      </div>
    </div>
  );
}
