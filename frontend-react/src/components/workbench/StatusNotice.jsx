function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

export default function StatusNotice(props) {
  const {
    kind = 'info',
    title,
    text,
    className = '',
    children = null
  } = props;

  if (!title && !text && !children) return null;

  const toneClass = {
    success: 'is-success',
    warning: 'is-warning',
    error: 'is-error'
  }[kind] || '';

  return (
    <section className={joinClasses('inline-status-banner', toneClass, className)}>
      <strong>{title || '状态'}</strong>
      <div className="inline-status-banner-copy">
        {text ? <p>{text}</p> : null}
        {children}
      </div>
    </section>
  );
}
