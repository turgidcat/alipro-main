export default function StorylineDrawer({ storylines, mainStorylineId, targetStorylineIds, currentChapter }) {
  if (!storylines || storylines.length === 0) {
    return <p className="context-drawer-empty">本书还没有剧情线。</p>;
  }

  return (
    <div className="drawer-storyline">
      <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px' }}>
        写作速查 · 本章命中的剧情线高亮。完整编辑请在创作台左侧“剧情线挂载”操作。
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {storylines.map((sl, index) => {
          const isMain = sl.id === mainStorylineId;
          const isTarget = (targetStorylineIds || []).includes(sl.id);
          const inRange = currentChapter >= (sl.start_chapter || 1) && currentChapter <= (sl.end_chapter || 9999);
          const highlight = isMain || (isTarget && inRange);
          return (
            <div
              key={sl.id || index}
              style={{
                borderLeft: `3px solid ${highlight ? 'var(--brand)' : 'var(--line)'}`,
                padding: '6px 10px',
                background: highlight ? 'var(--brand-soft)' : 'var(--panel)',
                borderRadius: '0 6px 6px 0',
                fontSize: '12px'
              }}
            >
              <strong>{sl.storyline_name || sl.name || '未命名剧情线'}</strong>
              {isMain ? <span style={{ fontSize: '10px', marginLeft: '6px', color: 'var(--brand)' }}>主推进</span> : null}
              {isTarget && !isMain ? <span style={{ fontSize: '10px', marginLeft: '6px', color: 'var(--brand)' }}>关联</span> : null}
              <div style={{ color: 'var(--muted)', marginTop: '3px' }}>
                {sl.description || sl.core_conflict || ''}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '2px' }}>
                第 {sl.start_chapter || '?'} - {sl.end_chapter || '?'} 章
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
