import { useNavigate } from 'react-router-dom';
import ChapterList from './ChapterList.jsx';

export default function GlobalBar({
  bookTitle,
  chapterNumber,
  chapterName,
  mainStorylineLabel,
  totalChapters,
  chapterNames,
  onPrevChapter,
  onNextChapter,
  onSelectChapter
}) {
  const navigate = useNavigate();

  return (
    <div className="workbench-global-bar">
      <span
        className="workbench-global-bar-book"
        onClick={() => navigate('/books')}
        title="点击查看资料库"
      >
        📖 {bookTitle || '未选择书籍'}
      </span>
      <span className="workbench-global-bar-sep">|</span>
      <span className="workbench-global-bar-chapter">
        第 {chapterNumber} 章{chapterName ? ` ${chapterName}` : ''}
      </span>
      {mainStorylineLabel && mainStorylineLabel !== '暂未指定剧情线' ? (
        <>
          <span className="workbench-global-bar-sep">|</span>
          <span className="workbench-global-bar-storyline">{mainStorylineLabel}</span>
        </>
      ) : null}
      <div className="workbench-global-bar-nav">
        <button
          type="button"
          className="workbench-global-bar-nav-btn"
          onClick={onPrevChapter}
          disabled={chapterNumber <= 1}
        >
          ◂ 上一章
        </button>
        <span className="workbench-global-bar-chapter-pos">
          {chapterNumber} / {totalChapters || '?'}
        </span>
        <button
          type="button"
          className="workbench-global-bar-nav-btn"
          onClick={onNextChapter}
        >
          下一章 ▸
        </button>
        <ChapterList
          currentChapter={chapterNumber}
          totalChapters={totalChapters}
          chapterNames={chapterNames}
          onSelect={onSelectChapter}
        />
      </div>
    </div>
  );
}
