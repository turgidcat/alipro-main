import { useNavigate } from 'react-router-dom';

export default function ComingSoonPage({ title, description, features = [] }) {
  const navigate = useNavigate();

  return (
    <>
      <style>{`
        .coming-soon {
          display: grid;
          place-items: center;
          min-height: 100%;
          padding: 48px 24px;
        }

        .coming-soon-card {
          width: min(560px, 100%);
          padding: 42px 38px;
          border: 1px solid var(--paper-border);
          border-radius: var(--paper-radius-lg);
          background: var(--paper-surface-raised);
          box-shadow: var(--paper-shadow-panel);
          text-align: center;
        }

        .coming-soon-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 22px;
          padding: 5px 14px;
          border: 1px solid rgba(169, 136, 116, 0.28);
          border-radius: 999px;
          background: var(--paper-tint-warm);
          color: var(--paper-accent-deep);
          font-size: 12px;
          font-weight: 650;
          letter-spacing: 0.04em;
        }

        .coming-soon-badge::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--paper-accent);
        }

        .coming-soon-title {
          margin: 0 0 12px;
          color: var(--paper-text);
          font-family: var(--font-serif);
          font-size: 27px;
          font-weight: 700;
        }

        .coming-soon-desc {
          margin: 0 auto 24px;
          max-width: 420px;
          color: var(--paper-text-muted);
          font-size: 13.5px;
          line-height: 1.8;
        }

        .coming-soon-features {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          margin-bottom: 30px;
        }

        .coming-soon-chip {
          padding: 6px 13px;
          border: 1px solid var(--paper-border);
          border-radius: 999px;
          background: var(--paper-surface-sunken);
          color: var(--paper-text-soft);
          font-size: 12px;
        }

        .coming-soon-note {
          margin: 0 0 26px;
          color: var(--paper-text-tertiary);
          font-size: 12px;
          line-height: 1.7;
        }
      `}</style>

      <section className="ide-page coming-soon">
        <div className="coming-soon-card">
          <div className="coming-soon-badge">规划中 · 即将上线</div>
          <h1 className="coming-soon-title">{title}</h1>
          <p className="coming-soon-desc">{description}</p>
          {features.length ? (
            <div className="coming-soon-features">
              {features.map((feature) => (
                <span key={feature} className="coming-soon-chip">{feature}</span>
              ))}
            </div>
          ) : null}
          <p className="coming-soon-note">
            该入口已就位，功能将在后续版本开放。你可以先回到创作台继续写作。
          </p>
          <button type="button" className="ide-btn ide-btn--primary" onClick={() => navigate('/workbench')}>
            回到创作台
          </button>
        </div>
      </section>
    </>
  );
}
