export default function StorylineDrawer({ storylines, mainStorylineId, targetStorylineIds, currentChapter }) {
  if (!storylines || storylines.length === 0) {
    return <p className="context-drawer-empty">本书还没有剧情线。</p>;
  }

  return (
    <div className="drawer-storyline">
      <p className="drawer-muted-copy">
        写作速查 · 本章命中的剧情线高亮。完整编辑请在创作台左侧“剧情线挂载”操作。
      </p>
      <div className="drawer-detail-stack">
        {storylines.map((sl, index) => {
          const isMain = sl.id === mainStorylineId;
          const isTarget = (targetStorylineIds || []).includes(sl.id);
          const inRange = currentChapter >= (sl.start_chapter || 1) && currentChapter <= (sl.end_chapter || 9999);
          const highlight = isMain || (isTarget && inRange);
          return (
            <div
              key={sl.id || index}
              className={`drawer-list-item${highlight ? ' is-highlight' : ''}`}
            >
              <strong>{sl.storyline_name || sl.name || '未命名剧情线'}</strong>
              {isMain ? <span className="drawer-kicker">主推进</span> : null}
              {isTarget && !isMain ? <span className="drawer-kicker">关联</span> : null}
              <div className="drawer-muted-copy">
                {sl.description || sl.core_conflict || ''}
              </div>
              <div className="drawer-muted-copy">
                第 {sl.start_chapter || '?'} - {sl.end_chapter || '?'} 章
              </div>
              <div className="drawer-muted-copy">
                状态：{sl.status || sl.currentProgress?.lifecycleStatus || 'draft'}
                {sl.lastUpdatedChapterNumber ? ` · 最近推进第 ${sl.lastUpdatedChapterNumber} 章` : ''}
                {sl.requiresReview ? ' · 需复核' : ''}
              </div>
              {sl.lastProgressSummary ? (
                <div className="drawer-muted-copy">
                  {sl.lastProgressSummary}
                </div>
              ) : null}
              {Array.isArray(sl.lastUsedBeatIds) && sl.lastUsedBeatIds.length > 0 ? (
                <div className="drawer-muted-copy">
                  used beat：{sl.lastUsedBeatIds.join(' / ')}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
