import { buildCharacterSubtitle } from '../../../lib/assets.js';

export default function CharacterDrawer({ characters, appearingRoles }) {
  if (!characters || characters.length === 0) {
    return <p className="context-drawer-empty">本书还没有角色档案。</p>;
  }

  const appearingSet = new Set(
    (appearingRoles || [])
      .map((r) => (typeof r === 'string' ? r : r?.name || r?.role || ''))
      .filter(Boolean)
  );

  return (
    <div className="drawer-character">
      <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px' }}>
        写作速查 · 本章出场角色高亮,其他灰显。完整编辑请前往资料库。
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {characters.map((char, index) => {
          const name = char.name || char.roleName || `角色${index + 1}`;
          const isAppearing = appearingSet.has(name);
          return (
            <div
              key={index}
              style={{
                borderLeft: `3px solid ${isAppearing ? 'var(--brand)' : 'var(--line)'}`,
                padding: '6px 10px',
                background: isAppearing ? 'var(--brand-soft)' : 'var(--panel)',
                borderRadius: '0 6px 6px 0',
                opacity: isAppearing ? 1 : 0.6,
                fontSize: '12px'
              }}
            >
              <strong>{name}</strong>
              {isAppearing ? <span style={{ fontSize: '10px', marginLeft: '6px', color: 'var(--brand)' }}>本章出场</span> : null}
              <div style={{ color: 'var(--muted)', marginTop: '3px' }}>{buildCharacterSubtitle(char)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
