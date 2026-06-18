import './app-shell.css';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  function isActive(path) {
    return currentPath === path ? ' is-active' : '';
  }

  function handleNav(to) {
    return (event) => {
      event.preventDefault();
      navigate(to);
    };
  }

  return (
    <>
      <nav className="app-navbar">
        <div className="app-navbar-inner">
          <a href="/start-guide" className="nav-brand" onClick={handleNav('/start-guide')}>Alipro</a>
          <div className="nav-links">
            <a href="/start-guide" className={`nav-link${isActive('/start-guide')}`} onClick={handleNav('/start-guide')}>启动引导</a>
            <a href="/books" className={`nav-link${isActive('/books')}`} onClick={handleNav('/books')}>资料库</a>
            <a href="/workbench" className={`nav-link${isActive('/workbench')}`} onClick={handleNav('/workbench')}>创作台</a>
            <a href="/generation-logic" className={`nav-link${isActive('/generation-logic')}`} onClick={handleNav('/generation-logic')}>生成链路</a>
            <a href="/changelog" className={`nav-link${isActive('/changelog')}`} onClick={handleNav('/changelog')}>更新日志</a>
            <a href="/style-manager" className={`nav-link${isActive('/style-manager')}`} onClick={handleNav('/style-manager')}>样式管理</a>
          </div>
        </div>
      </nav>
      <Outlet />
    </>
  );
}
