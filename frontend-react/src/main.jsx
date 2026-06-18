import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import BooksPage from './pages/BooksPage.jsx';
import ChangelogPage from './pages/ChangelogPage.jsx';
import GenerationLogicPage from './pages/GenerationLogicPage.jsx';
import StartGuidePage from './pages/StartGuidePage.jsx';
import AppLayout from './AppLayout.jsx';
import StyleManagerPage from './pages/StyleManagerPage.jsx';
import { applyStyleTheme, getStoredStyleTheme } from './styleTheme.js';
import './index.css';
import './styles.css';

applyStyleTheme(getStoredStyleTheme());

const ROUTES = {
  '/': StartGuidePage,
  '/books': BooksPage,
  '/books/outlines': BooksPage,
  '/books/characters': BooksPage,
  '/books/chapters': BooksPage,
  '/changelog': ChangelogPage,
  '/start-guide': StartGuidePage,
  '/generation-logic': GenerationLogicPage,
  '/style-manager': StyleManagerPage,
  '/workbench': App
};

function AppRouter() {
  const [path, setPath] = useState(window.location.pathname);

  React.useEffect(() => {
    function onPop() { setPath(window.location.pathname); }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  React.useEffect(() => {
    if (path !== '/visual-sample') return;
    window.history.replaceState(null, '', '/style-manager');
    setPath('/style-manager');
  }, [path]);

  function navigate(to) {
    window.history.pushState(null, '', to);
    setPath(to);
  }

  const Page = ROUTES[path] || App;

  return (
    <AppLayout navigate={navigate} currentPath={path}>
      <Page />
    </AppLayout>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AppRouter />);
