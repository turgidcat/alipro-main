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
      <p className="drawer-muted-copy">
        写作速查 · 本章出场角色高亮,其他灰显。完整编辑请前往资料库。
      </p>
      <div className="drawer-detail-stack">
        {characters.map((char, index) => {
          const name = char.name || char.roleName || `角色${index + 1}`;
          const isAppearing = appearingSet.has(name);
          return (
            <div
              key={index}
              className={`drawer-list-item${isAppearing ? ' is-highlight' : ' is-muted'}`}
            >
              <strong>{name}</strong>
              {isAppearing ? <span className="drawer-kicker">本章出场</span> : null}
              <div className="drawer-muted-copy">{buildCharacterSubtitle(char)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
