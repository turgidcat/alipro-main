import { useNavigate } from 'react-router-dom';
import { brand } from '../config/brand.js';

const FEATURE_COLORS = [
  '#13B8A6', '#0E8F86', '#D7A84B',
  '#176C78', '#21C7B7', '#8EDBD2', '#B78132',
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

        /* ── Story graph visual ──────────────────────────────────────── */

        .hp-hero-visual {
          position: absolute !important;
          top: 82px !important;
          right: max(6vw, calc((100vw - 1440px) / 2 + 20px)) !important;
          width: min(42vw, 560px);
          aspect-ratio: 1.08;
          overflow: hidden;
          border: 1px solid rgba(39, 199, 183, 0.28);
          border-radius: 18px;
          background:
            linear-gradient(135deg, rgba(39, 199, 183, 0.07), transparent 42%),
            linear-gradient(315deg, rgba(213, 169, 79, 0.08), transparent 38%),
            rgba(4, 15, 18, 0.68);
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,.025),
            inset 0 0 90px rgba(39,199,183,.07),
            0 24px 80px rgba(0,0,0,.24);
          pointer-events: none;
          z-index: 0;
        }

        .hp-hero-visual::before {
          content: '';
          position: absolute;
          inset: 0;
          opacity: .42;
          background-image:
            linear-gradient(rgba(126,194,194,.13) 1px, transparent 1px),
            linear-gradient(90deg, rgba(126,194,194,.13) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(circle at 52% 48%, #000 0 45%, transparent 84%);
        }

        .hp-hero-visual-topline,
        .hp-hero-visual-footer {
          position: absolute;
          right: 22px;
          left: 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: rgba(184, 219, 215, .72);
          font: 700 9px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .hp-hero-visual-topline { top: 18px; }
        .hp-hero-visual-footer { bottom: 18px; color: rgba(142,165,166,.7); }

        .hp-hero-visual-live {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--cinema-signal);
        }

        .hp-hero-visual-live::before {
          content: '';
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--cinema-signal);
          box-shadow: 0 0 0 4px rgba(39,199,183,.12), 0 0 12px rgba(39,199,183,.8);
        }

        .hp-hero-visual-lines {
          position: absolute;
          inset: 44px 28px 42px;
          width: calc(100% - 56px);
          height: calc(100% - 86px);
          overflow: visible;
        }

        .hp-hero-visual-lines path {
          fill: none;
          stroke: rgba(39,199,183,.42);
          stroke-width: 1.2;
          stroke-dasharray: 5 8;
          animation: hp-story-line-flow 9s linear infinite;
        }

        .hp-hero-visual-lines path:nth-child(3n) {
          stroke: rgba(213,169,79,.5);
          animation-duration: 12s;
        }

        .hp-hero-visual-lines circle {
          fill: #071014;
          stroke: var(--cinema-signal);
          stroke-width: 1.5;
        }

        .hp-hero-visual-lines circle:nth-of-type(2n) {
          stroke: var(--cinema-gold);
        }

        .hp-hero-visual-core {
          position: absolute;
          top: 50%;
          left: 50%;
          display: grid;
          width: 164px;
          height: 122px;
          place-content: center;
          gap: 8px;
          transform: translate(-50%, -50%);
          border: 1px solid rgba(39,199,183,.58);
          border-radius: 16px;
          background: linear-gradient(145deg, rgba(17,51,55,.96), rgba(5,19,23,.96));
          box-shadow: 0 0 0 8px rgba(39,199,183,.035), 0 0 46px rgba(39,199,183,.18);
          text-align: center;
        }

        .hp-hero-visual-core::before,
        .hp-hero-visual-core::after {
          content: '';
          position: absolute;
          width: 8px;
          height: 8px;
          border-color: var(--cinema-gold);
          border-style: solid;
        }

        .hp-hero-visual-core::before {
          top: -5px;
          left: -5px;
          border-width: 1px 0 0 1px;
        }

        .hp-hero-visual-core::after {
          right: -5px;
          bottom: -5px;
          border-width: 0 1px 1px 0;
        }

        .hp-hero-visual-core-label {
          color: var(--cinema-signal);
          font: 700 9px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace;
          letter-spacing: .14em;
        }

        .hp-hero-visual-core strong {
          color: var(--cinema-text);
          font: 700 22px/1 var(--font-display);
          letter-spacing: .04em;
        }

        .hp-hero-visual-core small {
          color: var(--cinema-muted);
          font: 600 10px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace;
          letter-spacing: .08em;
        }

        .hp-story-node {
          position: absolute;
          display: grid;
          gap: 4px;
          min-width: 64px;
          padding: 8px 10px;
          border: 1px solid rgba(126,194,194,.25);
          border-radius: 9px;
          background: rgba(5,20,24,.84);
          box-shadow: 0 10px 28px rgba(0,0,0,.16);
          color: var(--cinema-text);
          font: 700 13px/1.1 var(--font-display);
          text-align: center;
        }

        .hp-story-node small {
          color: var(--cinema-muted);
          font: 700 8px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace;
          letter-spacing: .09em;
        }

        .hp-story-node::before {
          content: '';
          position: absolute;
          width: 7px;
          height: 7px;
          border: 1px solid var(--cinema-signal);
          border-radius: 50%;
          background: #071014;
          box-shadow: 0 0 0 4px rgba(39,199,183,.1), 0 0 16px rgba(39,199,183,.5);
        }

        .hp-story-node-setting { top: 25%; left: 12%; }
        .hp-story-node-character { top: 23%; right: 12%; }
        .hp-story-node-plot { bottom: 22%; left: 13%; }
        .hp-story-node-chapter { right: 12%; bottom: 19%; }
        .hp-story-node-setting::before,
        .hp-story-node-plot::before { right: -5px; top: 50%; transform: translateY(-50%); }
        .hp-story-node-character::before,
        .hp-story-node-chapter::before { left: -5px; top: 50%; transform: translateY(-50%); }

        .hp-story-node-character::before,
        .hp-story-node-chapter::before { border-color: var(--cinema-gold); box-shadow: 0 0 0 4px rgba(213,169,79,.1), 0 0 16px rgba(213,169,79,.46); }

        @keyframes hp-story-line-flow {
          to { stroke-dashoffset: -120; }
        }

        @media (prefers-reduced-motion: reduce) {
          .hp-hero-visual-lines path { animation: none; }
        }

        @media (max-width: 900px) {
          .hp-hero-visual {
            position: relative !important;
            top: auto !important;
            right: auto !important;
            align-self: center;
            width: min(100%, 560px);
            margin-top: 56px;
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

        <div className="hp-hero-visual" aria-hidden="true">
          <div className="hp-hero-visual-topline">
            <span>STORY GRAPH / 001</span>
            <span className="hp-hero-visual-live">LIVE ENGINE</span>
          </div>
          <svg className="hp-hero-visual-lines" viewBox="0 0 560 430" preserveAspectRatio="none">
            <path d="M118 112 C175 108 198 150 256 184" />
            <path d="M442 106 C390 111 362 151 304 184" />
            <path d="M124 328 C178 321 202 285 258 246" />
            <path d="M438 324 C386 319 360 284 302 246" />
            <path d="M280 62 C280 114 280 138 280 176" />
            <path d="M280 254 C280 288 280 313 280 368" />
            <circle cx="118" cy="112" r="4" />
            <circle cx="442" cy="106" r="4" />
            <circle cx="124" cy="328" r="4" />
            <circle cx="438" cy="324" r="4" />
            <circle cx="280" cy="62" r="3" />
            <circle cx="280" cy="368" r="3" />
          </svg>
          <div className="hp-hero-visual-core">
            <span className="hp-hero-visual-core-label">LONGFORM ENGINE</span>
            <strong>叙境灵创</strong>
            <small>从设定到成稿</small>
          </div>
          <div className="hp-story-node hp-story-node-setting">设定<small>FOUNDATION</small></div>
          <div className="hp-story-node hp-story-node-character">人物<small>CHARACTERS</small></div>
          <div className="hp-story-node hp-story-node-plot">剧情<small>STORYLINES</small></div>
          <div className="hp-story-node hp-story-node-chapter">章节<small>CHAPTERS</small></div>
          <div className="hp-hero-visual-footer">
            <span>BUILD / STORY SYSTEM</span>
            <span>4 NODES · 1 THREAD</span>
          </div>
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
