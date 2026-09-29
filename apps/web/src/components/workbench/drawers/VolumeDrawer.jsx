export default function VolumeDrawer({ volumePlans, currentVolumeNumber }) {
  if (!volumePlans || volumePlans.length === 0) {
    return <p className="context-drawer-empty">本书还没有分卷规划。</p>;
  }

  return (
    <div className="drawer-volume">
      <p className="drawer-muted-copy">
        写作速查 · 当前卷高亮。完整编辑请前往资料库。
      </p>
      <div className="drawer-detail-stack">
        {volumePlans.map((vol, index) => {
          const volNum = vol.volume_number || (index + 1);
          const isCurrent = volNum === currentVolumeNumber;
          return (
            <div
              key={index}
              className={`drawer-list-item${isCurrent ? ' is-highlight' : ''}`}
            >
              <strong>第 {volNum} 卷{vol.volume_name ? ` · ${vol.volume_name}` : ''}</strong>
              {isCurrent ? <span className="drawer-kicker">当前</span> : null}
              <div className="drawer-muted-copy">
                {vol.summary || vol.description || '暂无卷级说明'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
