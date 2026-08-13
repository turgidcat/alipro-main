export default function Modal({ title, description, children, onClose, actions, closeOnBackdrop = true, className = '' }) {
  const modalClassName = [
    'modal-panel',
    String(title || '').includes('正文校改') ? 'modal-panel-revision' : '',
    className
  ].filter(Boolean).join(' ');
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
            {description ? <p>{description}</p> : null}
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
