import './app-shell.css';
import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { applyThemePopoverSettings, getStoredThemePopoverSettings } from './styleTheme.js';

const NAV_ITEMS = [
  { path: '/books', label: '资料库' },
  { path: '/workbench', label: '创作台' },
  { path: '/generation-logic', label: '生成链路' },
  { path: '/changelog', label: '更新日志' }
];

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  useEffect(() => {
    applyThemePopoverSettings(getStoredThemePopoverSettings());
  }, []);

  function isActive(path) {
    return currentPath === path || currentPath.startsWith(`${path}/`);
  }

  function navigateTo(path) {
    navigate(path);
  }

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-[color:var(--line)] bg-[color:color-mix(in_srgb,var(--nav-surface)_92%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-[min(var(--layout-max-width),calc(100%-2.5rem))] items-center justify-between gap-6">
          <button
            type="button"
            className="flex items-center gap-2 font-serif text-[1.55rem] font-semibold tracking-[-0.03em] text-[var(--text)] transition hover:text-[var(--brand-deep)]"
            onClick={() => navigateTo('/workbench')}
          >
            <span className="text-[var(--brand)]">~</span>
            <span>Alipro</span>
          </button>
          <div className="flex flex-wrap items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigateTo(item.path)}
                className={joinClasses(
                  'min-h-10 rounded-[var(--radius-button)] px-3.5 text-[14px] font-medium transition',
                  'border border-[color:transparent] text-[color:var(--muted)] hover:bg-[color:rgba(243,237,225,0.75)] hover:text-[color:var(--text)]',
                  isActive(item.path)
                    ? 'border-[color:rgba(61,53,48,0.08)] bg-[color:rgba(243,237,225,0.95)] text-[color:var(--brand-deep)]'
                    : ''
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>
      <Outlet />
    </>
  );
}
