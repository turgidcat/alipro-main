import './app-shell.css';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { brand } from './config/brand.js';

const NAV_ITEMS = [
  { path: '/books', label: '资料库', code: '01' },
  { path: '/workbench', label: '创作台', code: '02' },
  { path: '/changelog', label: '更新日志', code: '03' }
];

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  function isActive(path) {
    return currentPath === path || currentPath.startsWith(`${path}/`);
  }

  function navigateTo(path) {
    navigate(path);
  }

  return (
    <>
      <nav className="al-nav">
        <div className="al-nav-inner">
          <button
            type="button"
            className="al-nav-brand"
            onClick={() => navigateTo('/')}
            aria-label={`${brand.fullName} 首页`}
          >
            <span className="al-nav-monogram" aria-hidden="true">叙</span>
            <span className="al-nav-brand-lockup">
              <span className="al-nav-brand-name">{brand.chineseName}</span>
              <span className="al-nav-brand-code">LONGFORM STUDIO · {brand.shortName}</span>
            </span>
          </button>

          <div className="al-nav-links">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigateTo(item.path)}
                className={joinClasses(
                  'al-nav-link',
                  isActive(item.path) && 'al-nav-link--active'
                )}
              >
                <span className="al-nav-link-index">{item.code}</span>
                <span>{item.label}</span>
                {isActive(item.path) && <span className="al-nav-link-indicator" />}
              </button>
            ))}
          </div>
        </div>
      </nav>
      <Outlet />
    </>
  );
}
