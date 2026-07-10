import ChapterList from './ChapterList.jsx';
import { normalizeChapterName } from '../../lib/chapterName.js';

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
  const normalizedChapterName = normalizeChapterName(chapterName);

  return (
    <div className="wgb">
      {/* Breadcrumb — Notion style, very subtle */}
      <div className="wgb-crumb">
        <span>{bookTitle || '未选择书籍'}</span>
        {volumeLabel && <span className="wgb-crumb-arrow">/</span>}
        {volumeLabel && <span>{volumeLabel}</span>}
        <span className="wgb-crumb-arrow">/</span>
        <span>第 {chapterNumber} 章</span>
        {mainStorylineLabel && !['暂未指定剧情线', '暂未指定叙事脉络'].includes(mainStorylineLabel) && (
          <span className="wgb-crumb-arc">{mainStorylineLabel}</span>
        )}
      </div>

      {/* Title — large, clean, no decoration */}
      <div className="wgb-row">
        <h1 className="wgb-title">
          {normalizedChapterName || `第 ${chapterNumber} 章`}
        </h1>
        {showNavigation ? (
          <div className="wgb-actions">
            <button type="button" className="wgb-icon-btn" onClick={onPrevChapter} disabled={chapterNumber <= 1} title="上一章">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span className="wgb-counter">{chapterNumber} / {totalChapterCount || '–'}</span>
            <button type="button" className="wgb-icon-btn" onClick={onNextChapter} disabled={false} title="下一章">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
            <ChapterList
              currentChapter={chapterNumber}
              items={chapterListItems}
              onSelect={onSelectChapter}
            />
            {onSwitchBook && (
              <button type="button" className="wgb-text-btn" onClick={onSwitchBook}>
                切换作品
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
