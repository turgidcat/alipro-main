import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App.jsx';
import BooksPage from './pages/BooksPage.jsx';
import ChangelogPage from './pages/ChangelogPage.jsx';
import GenerationLogicPage from './pages/GenerationLogicPage.jsx';
import StartGuidePage from './pages/StartGuidePage.jsx';
import AppLayout from './AppLayout.jsx';
import StyleManagerPage from './pages/StyleManagerPage.jsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <StartGuidePage /> },
      { path: 'start-guide', element: <StartGuidePage /> },
      { path: 'books', element: <BooksPage /> },
      { path: 'books/outlines', element: <BooksPage /> },
      { path: 'books/characters', element: <BooksPage /> },
      { path: 'books/chapters', element: <BooksPage /> },
      { path: 'changelog', element: <ChangelogPage /> },
      { path: 'generation-logic', element: <GenerationLogicPage /> },
      { path: 'style-manager', element: <StyleManagerPage /> },
      { path: 'workbench', element: <App /> },
      { path: 'visual-sample', element: <Navigate to="/style-manager" replace /> }
    ]
  }
]);
