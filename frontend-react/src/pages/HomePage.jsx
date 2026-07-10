import { useNavigate } from 'react-router-dom';
import { brand } from '../config/brand.js';

const FEATURE_COLORS = [
  '#FE2C55', '#E61E45', '#FF6485',
  '#25F4EE', '#14D6D0', '#7CF8F4', '#FFA0B5',
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <>
      <style>{`
        /* ── Hero Section ─────────────────────────────────────────────── */

        .hp-hero {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 80px 24px 64px;
          max-width: 720px;
          margin: 0 auto;
          overflow: hidden;
        }

        /* Decorative red circle — top-right */
        .hp-hero::before {
          content: '';
          position: absolute;
          top: -60px;
          right: -40px;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          background: var(--tk-red-100);
          opacity: 0.6;
          pointer-events: none;
        }

        /* Decorative cyan circle — bottom-left */
        .hp-hero::after {
          content: '';
          position: absolute;
          bottom: -40px;
          left: -30px;
          width: 160px;
          height: 160px;
          border-radius: 50%;
          background: var(--tk-cyan-100);
          opacity: 0.6;
          pointer-events: none;
        }

        .hp-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-sans);
          font-size: 13px;
          font-weight: 600;
          color: var(--badge-text);
          background: var(--badge-bg);
          border: 1px solid var(--badge-border);
          border-radius: 999px;
          padding: 5px 16px;
          margin-bottom: 28px;
          letter-spacing: 0.02em;
          position: relative;
          z-index: 1;
        }

        .hp-hero-badge-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
        }

        .hp-hero-title {
          font-family: var(--font-serif);
          font-size: clamp(36px, 5.5vw, 56px);
          font-weight: 700;
          line-height: 1.15;
          color: var(--text);
          margin: 0 0 14px;
          letter-spacing: -0.01em;
          position: relative;
          z-index: 1;
        }

        .hp-hero-slogan {
          font-family: var(--font-sans);
          font-size: clamp(17px, 2.4vw, 22px);
          font-weight: 500;
          color: var(--brand);
          margin: 0 0 24px;
          position: relative;
          z-index: 1;
        }

        .hp-hero-desc {
          font-family: var(--font-sans);
          font-size: 15px;
          line-height: 1.75;
          color: var(--muted);
          margin: 0 0 40px;
          max-width: 520px;
          position: relative;
          z-index: 1;
        }

        .hp-hero-actions {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          justify-content: center;
          position: relative;
          z-index: 1;
        }

        /* ── Buttons ──────────────────────────────────────────────────── */

        .hp-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 13px 32px;
          font-size: 15px;
          font-weight: 600;
          font-family: var(--font-sans);
          color: var(--btn-solid-text);
          background: var(--btn-solid-bg);
          border: 1px solid var(--btn-solid-border);
          border-radius: var(--radius-button);
          box-shadow: var(--btn-solid-shadow);
          cursor: pointer;
          text-decoration: none;
          transition: transform 140ms ease, box-shadow 140ms ease, background-color 140ms ease;
        }

        .hp-btn-primary:hover {
          transform: translateY(-1px);
          background-color: var(--brand-deep);
          box-shadow: 0 6px 20px rgba(254, 44, 85, 0.28);
        }

        .hp-btn-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 13px 32px;
          font-size: 15px;
          font-weight: 500;
          font-family: var(--font-sans);
          color: var(--text);
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: var(--radius-button);
          cursor: pointer;
          text-decoration: none;
          transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
        }

        .hp-btn-secondary:hover {
          transform: translateY(-1px);
          border-color: var(--line-strong);
          box-shadow: var(--shadow);
        }

        /* ── Decorative divider ──────────────────────────────────────── */

        .hp-divider {
          max-width: 960px;
          margin: 0 auto;
          padding: 0 24px;
        }

        .hp-divider-line {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .hp-divider-line::before,
        .hp-divider-line::after {
          content: '';
          flex: 1;
          height: 1px;
        }

        .hp-divider-line::before {
          background: var(--line);
        }

        .hp-divider-line::after {
          background: var(--line);
        }

        .hp-divider-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .hp-divider-icon-red {
          background: var(--brand-soft);
          color: var(--brand);
        }

        .hp-divider-icon-cyan {
          background: var(--accent-soft);
          color: var(--accent-deep);
        }

        /* ── Features Section ─────────────────────────────────────────── */

        .hp-features {
          max-width: 1080px;
          margin: 0 auto;
          padding: 56px 24px 72px;
        }

        .hp-section-header {
          text-align: center;
          margin-bottom: 44px;
        }

        .hp-section-title {
          font-family: var(--font-serif);
          font-size: var(--font-size-section-title);
          font-weight: 700;
          color: var(--text);
          margin: 0 0 10px;
        }

        .hp-section-subtitle {
          font-family: var(--font-sans);
          font-size: 15px;
          color: var(--muted);
          margin: 0;
          max-width: 460px;
          margin-left: auto;
          margin-right: auto;
          line-height: 1.65;
        }

        .hp-feature-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        .hp-feature-card {
          padding: 24px;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 12px;
          transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
        }

        .hp-feature-card:hover {
          border-color: var(--line-strong);
          box-shadow: var(--shadow);
          transform: translateY(-2px);
        }

        .hp-feature-icon-wrap {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 10px;
          font-family: var(--font-serif);
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 18px;
        }

        .hp-feature-title {
          font-family: var(--font-sans);
          font-size: var(--font-size-panel-title);
          font-weight: 600;
          color: var(--text);
          margin: 0 0 8px;
        }

        .hp-feature-desc {
          font-family: var(--font-sans);
          font-size: 14px;
          line-height: 1.65;
          color: var(--muted);
          margin: 0;
        }

        /* ── Upcoming Section ──────────────────────────────────────────── */

        .hp-upcoming {
          max-width: 1080px;
          margin: 0 auto;
          padding: 0 24px 96px;
          text-align: center;
        }

        .hp-upcoming-inner {
          background: var(--bg-subtle);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 40px 32px;
        }

        .hp-upcoming-label {
          display: inline-block;
          font-family: var(--font-sans);
          font-size: 13px;
          font-weight: 600;
          color: var(--badge-text);
          background: var(--badge-bg);
          border: 1px solid var(--badge-border);
          border-radius: 999px;
          padding: 4px 14px;
          margin-bottom: 18px;
        }

        .hp-upcoming-tags {
          font-family: var(--font-sans);
          font-size: clamp(17px, 2.2vw, 22px);
          font-weight: 600;
          color: var(--text);
          margin: 0 0 10px;
          letter-spacing: 0.02em;
        }

        .hp-upcoming-tags-accent {
          color: var(--brand);
        }

        .hp-upcoming-note {
          font-family: var(--font-sans);
          font-size: 14px;
          color: var(--muted);
          margin: 0;
        }

        /* ── Responsive ────────────────────────────────────────────────── */

        @media (max-width: 900px) {
          .hp-hero {
            padding-top: 56px;
          }

          .hp-feature-grid {
            grid-template-columns: 1fr;
            max-width: 480px;
            margin-left: auto;
            margin-right: auto;
          }

          .hp-hero-actions {
            flex-direction: column;
            width: 100%;
            max-width: 320px;
          }

          .hp-hero-actions > * {
            width: 100%;
          }
        }

        @media (min-width: 901px) and (max-width: 1080px) {
          .hp-feature-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 600px) {
          .hp-hero {
            padding-left: 16px;
            padding-right: 16px;
          }

          .hp-hero::before {
            width: 120px;
            height: 120px;
            top: -40px;
            right: -20px;
          }

          .hp-hero::after {
            width: 100px;
            height: 100px;
            bottom: -30px;
            left: -20px;
          }

          .hp-features {
            padding-left: 16px;
            padding-right: 16px;
          }

          .hp-upcoming {
            padding-left: 16px;
            padding-right: 16px;
            padding-bottom: 64px;
          }

          .hp-upcoming-inner {
            padding: 28px 20px;
          }
        }
      `}</style>

      <section className="hp-hero">
        <span className="hp-hero-badge">
          <span className="hp-hero-badge-dot" />
          {brand.englishName}
        </span>
        <h1 className="hp-hero-title">{brand.chineseName}</h1>
        <p className="hp-hero-slogan">{brand.slogan}</p>
        <p className="hp-hero-desc">{brand.longDescription}</p>
        <div className="hp-hero-actions">
          <button
            className="hp-btn-primary"
            onClick={() => navigate('/workbench')}
          >
            开始创作
          </button>
          <button
            className="hp-btn-secondary"
            onClick={() => navigate('/books')}
          >
            浏览资料库
          </button>
        </div>
      </section>

      <div className="hp-divider">
        <div className="hp-divider-line">
          <span className="hp-divider-icon hp-divider-icon-red">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L13 7L7 13L1 7Z" fill="currentColor"/></svg>
          </span>
          <span className="hp-divider-icon hp-divider-icon-cyan">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" fill="currentColor"/></svg>
          </span>
        </div>
      </div>

      <section className="hp-features">
        <div className="hp-section-header">
          <h2 className="hp-section-title">核心能力</h2>
          <p className="hp-section-subtitle">
            覆盖长篇创作全链路，从设定到审校一站式完成
          </p>
        </div>
        <div className="hp-feature-grid">
          {brand.featurePoints.map((fp, i) => (
            <div className="hp-feature-card" key={fp.title}>
              <div
                className="hp-feature-icon-wrap"
                style={{ background: FEATURE_COLORS[i % FEATURE_COLORS.length] }}
              >
                {fp.title.charAt(0)}
              </div>
              <h3 className="hp-feature-title">{fp.title}</h3>
              <p className="hp-feature-desc">{fp.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="hp-upcoming">
        <div className="hp-upcoming-inner">
          <span className="hp-upcoming-label">即将上线</span>
          <p className="hp-upcoming-tags">
            {brand.futureCapabilities.map((cap, i) => (
              <span key={cap}>
                {i > 0 && (
                  <span style={{ margin: '0 6px', color: 'var(--line-strong)' }}>&middot;</span>
                )}
                <span className="hp-upcoming-tags-accent">{cap}</span>
              </span>
            ))}
          </p>
          <p className="hp-upcoming-note">规划中，敬请期待</p>
        </div>
      </section>
    </>
  );
}
