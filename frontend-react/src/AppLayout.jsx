import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { brand } from './config/brand.js';
import './app-shell.css';
import './cinematic-theme.css';
import './paper-tokens.css';
import './ide-shell.css';
import './mobile-app.css';
import './mobile-paper-overrides.css';
import './library-paper-polish.css';
import './brand-product.css';

/**
 * IDE 侧边栏导航配置。
 * 后续新增页面（视频整合、头脑风暴等）只需：
 *  1. 在对应 section 的 items 中加一项；
 *  2. 在 router.jsx 注册路由；
 *  3. 需要时把 badge 从「规划中」改为实际状态或移除。
 */
const NAV_SECTIONS = [
  {
    title: '总览',
    items: [
      { path: '/dashboard', label: '数据仓', icon: 'dashboard' }
    ]
  },
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
      { path: '/me', label: '我的', icon: 'profile' },
      { path: '/changelog', label: '更新日志', icon: 'changelog' }
    ]
  }
];

const ICON_PATHS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
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
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
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

function ProductLogoMark({ className = '' }) {
  return (
    <span className={joinClasses('product-logo-mark', className)} aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.5 8.7c3.8-.8 6.8-.1 10.5 2.6v12.9c-3.7-2.7-6.7-3.4-10.5-2.6Z" />
        <path d="M26.5 8.7c-3.8-.8-6.8-.1-10.5 2.6v12.9c3.7-2.7 6.7-3.4 10.5-2.6Z" />
        <path d="M16 11.3v12.9" />
        <path d="m22.1 4.3.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9Z" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
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

function getMobilePageMeta(pathname) {
  if (pathname === '/dashboard') return { title: '数据仓', subtitle: '作品进度与下一步' };
  if (pathname === '/books') return { title: '资料库', subtitle: '作品、章节与设定' };
  if (pathname === '/books/outlines') return { title: '大纲链', subtitle: '把故事拆成可执行的路径' };
  if (pathname === '/books/storylines') return { title: '叙事脉络', subtitle: '让剧情线持续向前推进' };
  if (pathname === '/books/characters') return { title: '角色资料', subtitle: '人物关系与成长状态' };
  if (pathname.startsWith('/books/chapters/')) return { title: '章节阅读', subtitle: '沉浸式正文预览' };
  if (pathname === '/books/chapters') return { title: '章节与正文', subtitle: '从细纲进入写作现场' };
  if (pathname === '/workbench') return { title: '创作台', subtitle: '从细纲到正文' };
  if (pathname === '/audiobook') return { title: '有声书', subtitle: '让已经写好的章节被听见' };
  if (pathname === '/inspiration/brainstorm') return { title: '灵感探索', subtitle: '把模糊想法变成素材' };
  if (pathname === '/me') return { title: '我的', subtitle: '账号、数据与设置' };
  if (pathname === '/auth/callback') return { title: '账号登录', subtitle: '正在完成安全验证' };
  if (pathname === '/changelog') return { title: '更新日志', subtitle: '了解最近发生了什么' };
  if (pathname === '/media/video') return { title: '视频工坊', subtitle: '作品的可视化第二形态' };
  return { title: brand.chineseName, subtitle: '长篇创作工作台' };
}

function MobileAppHeader({ currentPath }) {
  const navigate = useNavigate();
  const pageMeta = getMobilePageMeta(currentPath);
  const isRoot = currentPath === '/';
  const isChapterReader = currentPath.startsWith('/books/chapters/');
  const isChapterDirectory = currentPath === '/books/chapters';
  const primaryPaths = new Set(['/books', '/workbench', '/inspiration/brainstorm', '/me']);
  const canGoBack = !isRoot && !primaryPaths.has(currentPath);

  if (isRoot || currentPath === '/me' || currentPath.startsWith('/auth/')) return null;

  return (
    <header className="mobile-app-header" aria-label="移动端页面标题栏">
      <button
        type="button"
        className="mobile-app-header-back"
        onClick={() => {
          if (isChapterReader) {
            navigate('/books/chapters', { replace: true });
          } else if (isChapterDirectory) {
            navigate('/books', { replace: true });
          } else if (canGoBack) {
            navigate(-1);
          } else {
            navigate('/me');
          }
        }}
        aria-label={isChapterReader ? '返回章节目录' : isChapterDirectory ? '返回资料库' : canGoBack ? '返回上一页' : '回到我的'}
      >
        {canGoBack ? '‹' : <ProductLogoMark className="mobile-app-header-mark" />}
      </button>
      <div className="mobile-app-header-copy">
        <strong>{pageMeta.title}</strong>
        <span>{pageMeta.subtitle}</span>
      </div>
      <span className="mobile-app-header-status" aria-label="云端服务已连接"><i />云端</span>
    </header>
  );
}

const MOBILE_PRIMARY_ITEMS = [
  NAV_SECTIONS[1].items[0],
  NAV_SECTIONS[1].items[1],
  NAV_SECTIONS[3].items[0],
  NAV_SECTIONS[4].items[0]
];

const MOBILE_MORE_ITEMS = [
  NAV_SECTIONS[2].items[0],
  NAV_SECTIONS[2].items[1],
  NAV_SECTIONS[4].items[1]
];

function MobileNavigation({ currentPath }) {
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [currentPath]);

  if (currentPath === '/' || currentPath.startsWith('/books/chapters/') || currentPath.startsWith('/auth/')) return null;

  function isActive(path) {
    return currentPath === path || currentPath.startsWith(`${path}/`);
  }

  function renderItem(item, className = 'ide-mobile-nav-item') {
    return (
      <button
        key={item.path}
        type="button"
        className={joinClasses(className, isActive(item.path) && 'is-active')}
        onClick={() => navigate(item.path)}
        aria-current={isActive(item.path) ? 'page' : undefined}
      >
        <NavIcon name={item.icon} />
        <span>{item.label}</span>
        {item.badge ? <small>{item.badge}</small> : null}
      </button>
    );
  }

  return (
    <>
      <nav className="ide-mobile-nav" aria-label="移动端主导航">
        {MOBILE_PRIMARY_ITEMS.map((item) => renderItem(item))}
        <button
          type="button"
          className={joinClasses('ide-mobile-nav-item', moreOpen && 'is-active')}
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
        >
          <span className="ide-mobile-more-glyph" aria-hidden="true">•••</span>
          <span>更多</span>
        </button>
      </nav>

      {moreOpen ? (
        <div className="ide-mobile-sheet-backdrop" role="presentation" onClick={() => setMoreOpen(false)}>
          <section className="ide-mobile-sheet" aria-label="更多功能" onClick={(event) => event.stopPropagation()}>
            <div className="ide-mobile-sheet-handle" aria-hidden="true" />
            <div className="ide-mobile-sheet-head">
              <div>
                <span className="ide-mobile-sheet-kicker">LONGFORM STUDIO</span>
                <strong>更多功能</strong>
              </div>
              <button type="button" className="ide-mobile-sheet-close" onClick={() => setMoreOpen(false)} aria-label="关闭更多功能">×</button>
            </div>
            <div className="ide-mobile-sheet-grid">
              {MOBILE_MORE_ITEMS.map((item) => renderItem(item, 'ide-mobile-sheet-item'))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  useEffect(() => {
    function requireLogin() {
      if (currentPath !== '/me' && !currentPath.startsWith('/auth/')) {
        navigate('/me', { replace: true });
      }
    }
    window.addEventListener('alipro:auth-required', requireLogin);
    return () => window.removeEventListener('alipro:auth-required', requireLogin);
  }, [currentPath, navigate]);

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
          <span className="ide-sidebar-monogram"><ProductLogoMark /></span>
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
        <MobileAppHeader currentPath={currentPath} />
        <div className={joinClasses('ide-page-frame', currentPath.startsWith('/books/chapters/') && 'is-mobile-reader-frame')}>
          <Outlet />
        </div>
      </main>
      <MobileNavigation currentPath={currentPath} />
    </div>
  );
}
