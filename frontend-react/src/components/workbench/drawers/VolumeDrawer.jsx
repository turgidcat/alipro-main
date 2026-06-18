export default function VolumeDrawer({ volumePlans, currentVolumeNumber }) {
  if (!volumePlans || volumePlans.length === 0) {
    return <p className="context-drawer-empty">本书还没有分卷规划。</p>;
  }

  return (
    <div className="drawer-volume">
      <p style={{ fontSize: '13px', color: 'var(--muted, #9ca3af)', marginBottom: '10px' }}>
        写作速查 · 当前卷高亮。完整编辑请前往资料库。
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {volumePlans.map((vol, index) => {
          const volNum = vol.volume_number || (index + 1);
          const isCurrent = volNum === currentVolumeNumber;
          return (
            <div
              key={index}
              style={{
                borderLeft: `3px solid ${isCurrent ? 'var(--brand, #bf6a2a)' : 'var(--line, #e5e7eb)'}`,
                padding: '6px 10px',
                background: isCurrent ? 'var(--brand-soft, #fdf3ec)' : 'var(--panel, #f9fafb)',
                borderRadius: '0 6px 6px 0',
                fontSize: '12px'
              }}
            >
              <strong>第 {volNum} 卷{vol.volume_name ? ` · ${vol.volume_name}` : ''}</strong>
              {isCurrent ? <span style={{ fontSize: '10px', marginLeft: '6px', color: 'var(--brand, #bf6a2a)' }}>当前</span> : null}
              <div style={{ color: 'var(--muted, #9ca3af)', marginTop: '3px' }}>
                {vol.summary || vol.description || '暂无卷级说明'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
