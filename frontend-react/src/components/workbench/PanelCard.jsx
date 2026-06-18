export default function PanelCard({ eyebrow, title, description, children, actions, headerActions, className = '' }) {
  return (
    <section className={`panel-card${className ? ` ${className}` : ''}`}>
      {eyebrow || title || description || headerActions ? (
        <div className="panel-card-head">
          <div className="panel-card-head-main">
            {eyebrow ? <span className="panel-card-eyebrow">{eyebrow}</span> : null}
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {headerActions ? <div className="panel-card-head-actions">{headerActions}</div> : null}
        </div>
      ) : null}
      <div className="panel-card-body">{children}</div>
      {actions ? <div className="panel-card-actions">{actions}</div> : null}
    </section>
  );
}
