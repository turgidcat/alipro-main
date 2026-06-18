export default function Modal({ title, description, children, onClose, actions }) {
  const modalClassName = title.includes('正文校改') ? 'modal-panel modal-panel-revision' : 'modal-panel';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={modalClassName} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <button type="button" className="ghost-btn modal-close-btn" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  );
}
