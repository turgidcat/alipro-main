export default function Modal({ title, description, children, onClose, actions, closeOnBackdrop = true }) {
  const modalClassName = title.includes('正文校改') ? 'modal-panel modal-panel-revision' : 'modal-panel';
  function handleBackdropClick(event) {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
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
