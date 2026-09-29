export default function ContextDrawer({ open, title, onClose, children }) {
  if (!open) return null;

  return (
    <>
      <div className="context-drawer-overlay" onClick={onClose} />
      <div className="context-drawer-panel">
        <div className="context-drawer-head">
          <span className="context-drawer-head-title">{title}</span>
          <button type="button" className="context-drawer-close" onClick={onClose}>✕ 关闭</button>
        </div>
        <div className="context-drawer-body">{children}</div>
      </div>
    </>
  );
}
