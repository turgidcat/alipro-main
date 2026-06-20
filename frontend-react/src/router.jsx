import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App.jsx';
import BooksPage from './pages/BooksPage.jsx';
import ChangelogPage from './pages/ChangelogPage.jsx';
import GenerationLogicPage from './pages/GenerationLogicPage.jsx';
import AppLayout from './AppLayout.jsx';
import GenreUiDemoPage from './pages/GenreUiDemoPage.jsx';
import GenreBookShowcasePage from './pages/GenreBookShowcasePage.jsx';
import LightNovelShowcasePage from './pages/LightNovelShowcasePage.jsx';
import StorylineManagementPage from './pages/StorylineManagementPage.jsx';
import WorkbenchRedesignLabPage from './pages/WorkbenchRedesignLabPage.jsx';

export const router = createBrowserRouter([
  {
    path: '/genre-light-novel-showcase',
    element: <LightNovelShowcasePage />
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/workbench" replace /> },
      { path: 'books', element: <BooksPage /> },
      { path: 'books/outlines', element: <BooksPage /> },
      { path: 'books/storylines', element: <StorylineManagementPage /> },
      { path: 'books/characters', element: <BooksPage /> },
      { path: 'books/chapters', element: <BooksPage /> },
      { path: 'changelog', element: <ChangelogPage /> },
      { path: 'generation-logic', element: <GenerationLogicPage /> },
      { path: 'style-manager', element: <Navigate to="/workbench" replace /> },
      { path: 'genre-ui-demo', element: <GenreUiDemoPage /> },
      { path: 'genre-book-showcase', element: <GenreBookShowcasePage /> },
      { path: 'workbench-redesign-lab', element: <WorkbenchRedesignLabPage /> },
      { path: 'workbench', element: <App /> },
      { path: 'visual-sample', element: <Navigate to="/workbench" replace /> }
    ]
  }
]);
