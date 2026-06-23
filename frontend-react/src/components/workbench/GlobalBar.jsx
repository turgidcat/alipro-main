import ChapterList from './ChapterList.jsx';
import ThemePopover from '../theme/ThemePopover.jsx';

export default function GlobalBar({
  bookTitle,
  volumeLabel,
  chapterNumber,
  chapterName,
  mainStorylineLabel,
  totalChapterCount,
  chapterListItems,
  onPrevChapter,
  onNextChapter,
  onSelectChapter,
  onSwitchBook,
  showNavigation = true
}) {
  return (
    <div className="workbench-global-bar">
      <div className="workbench-global-bar-meta">
        <span className="workbench-global-bar-label">
          // book
        </span>
        <span className="workbench-global-bar-bookline">
          {bookTitle || '未选择书籍'}
        </span>
        {volumeLabel ? (
          <>
            <span className="workbench-global-bar-label">
              // volume
            </span>
            <span className="workbench-global-bar-bookline">
              {volumeLabel}
            </span>
          </>
        ) : null}
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

      {showNavigation ? (
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
          {onSwitchBook ? (
            <button
              type="button"
              className="ghost-btn workbench-switch-book-btn"
              onClick={onSwitchBook}
            >
              切换作品
            </button>
          ) : null}
        </div>
      </div>
      ) : null}
    </div>
  );
}
