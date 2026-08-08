import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { brand } from './config/brand.js';
import './app-shell.css';
import './cinematic-theme.css';
import './paper-tokens.css';
import './ide-shell.css';

/**
 * IDE 侧边栏导航配置。
 * 后续新增页面（视频整合、头脑风暴等）只需：
 *  1. 在对应 section 的 items 中加一项；
 *  2. 在 router.jsx 注册路由；
 *  3. 需要时把 badge 从「规划中」改为实际状态或移除。
 */
const NAV_SECTIONS = [
  {
    title: '创作',
    items: [
      { path: '/books', label: '资料库', icon: 'library' },
      { path: '/workbench', label: '创作台', icon: 'workbench' }
    ]
  },
  {
    title: '多媒体',
    items: [
      { path: '/audiobook', label: '有声书', icon: 'audiobook' },
      { path: '/media/video', label: '视频工坊', icon: 'video', badge: '规划中' }
    ]
  },
  {
    title: '探索',
    items: [
      { path: '/inspiration/brainstorm', label: '灵感探索', icon: 'brainstorm' }
    ]
  },
  {
    title: '系统',
    items: [
      { path: '/changelog', label: '更新日志', icon: 'changelog' }
    ]
  }
];

const ICON_PATHS = {
  library: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  workbench: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  audiobook: (
    <>
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </>
  ),
  video: (
    <>
      <path d="m22 8-6 4 6 4V8Z" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </>
  ),
  brainstorm: (
    <>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2z" />
    </>
  ),
  changelog: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  )
};

function NavIcon({ name }) {
  return (
    <svg
      className="ide-nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function IdeFooter() {
  const [zoom, setZoom] = useState(1);
  const [autoFit, setAutoFit] = useState(true);
  const [hasIde, setHasIde] = useState(false);

  useEffect(() => {
    const bridge = window.ide;
    if (!bridge || typeof bridge.getZoom !== 'function') return;
    setHasIde(true);
    bridge.getZoom().then((settings) => {
      if (!settings) return;
      setZoom(Number(settings.zoomFactor) || 1);
      setAutoFit(settings.autoFit !== false);
    }).catch(() => {});
  }, []);

  if (!hasIde) return null;

  function changeZoom(next) {
    const clamped = Math.min(2, Math.max(0.5, Number(next)));
    setZoom(clamped);
    window.ide.setZoom(clamped);
  }

  function toggleAutoFit() {
    const next = !autoFit;
    setAutoFit(next);
    window.ide.setAutoFit(next);
  }

  return (
    <div className="ide-sidebar-footer">
      <div className="ide-footer-title">显示比例</div>
      <div className="ide-zoom-row">
        <button type="button" className="ide-zoom-btn" onClick={() => changeZoom(zoom - 0.1)} aria-label="缩小">−</button>
        <span className="ide-zoom-label">{Math.round(zoom * 100)}%</span>
        <button type="button" className="ide-zoom-btn" onClick={() => changeZoom(zoom + 0.1)} aria-label="放大">＋</button>
      </div>
      <label className="ide-autofit-row">
        <input type="checkbox" checked={autoFit} onChange={toggleAutoFit} />
        <span>适配窗口显示比例</span>
      </label>
    </div>
  );
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  function isActive(path) {
    return currentPath === path || currentPath.startsWith(`${path}/`);
  }

  return (
    <div className="ide-shell">
      <aside className="ide-sidebar">
        <button
          type="button"
          className="ide-sidebar-brand"
          onClick={() => navigate('/')}
          aria-label={`${brand.fullName} 首页`}
        >
          <span className="ide-sidebar-monogram" aria-hidden="true">叙</span>
          <span className="ide-sidebar-brand-lockup">
            <span className="ide-sidebar-brand-name">{brand.chineseName}</span>
            <span className="ide-sidebar-brand-code">LONGFORM STUDIO · {brand.shortName}</span>
          </span>
        </button>

        <nav className="ide-sidebar-nav" aria-label="主导航">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="ide-nav-section-title">{section.title}</div>
              {section.items.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  className={joinClasses('ide-nav-item', isActive(item.path) && 'is-active')}
                  onClick={() => navigate(item.path)}
                  aria-current={isActive(item.path) ? 'page' : undefined}
                  title={item.label}
                >
                  <NavIcon name={item.icon} />
                  <span className="ide-nav-label">{item.label}</span>
                  {item.badge ? <span className="ide-nav-badge">{item.badge}</span> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <IdeFooter />
      </aside>

      <main className="ide-main">
        <div className="ide-page-frame">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
