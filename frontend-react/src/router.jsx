import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App.jsx';
import BooksPage from './pages/BooksPage.jsx';
import ChangelogPage from './pages/ChangelogPage.jsx';
import AppLayout from './AppLayout.jsx';
import StorylineManagementPage from './pages/StorylineManagementPage.jsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <App /> },
      { path: 'books', element: <BooksPage /> },
      { path: 'books/outlines', element: <BooksPage /> },
      { path: 'books/storylines', element: <StorylineManagementPage /> },
      { path: 'books/characters', element: <BooksPage /> },
      { path: 'books/chapters', element: <BooksPage /> },
      { path: 'books/chapters/:chapterNumber', element: <BooksPage /> },
      { path: 'books/:bookId', element: <BooksPage /> },
      { path: 'changelog', element: <ChangelogPage /> },
      { path: 'generation-logic', element: <Navigate to="/workbench" replace /> },
      { path: 'style-manager', element: <Navigate to="/workbench" replace /> },
      { path: 'genre-ui-demo', element: <Navigate to="/workbench" replace /> },
      { path: 'genre-book-showcase', element: <Navigate to="/workbench" replace /> },
      { path: 'genre-light-novel-showcase', element: <Navigate to="/workbench" replace /> },
      { path: 'workbench-redesign-lab', element: <Navigate to="/workbench" replace /> },
      { path: 'workbench', element: <App /> },
      { path: 'visual-sample', element: <Navigate to="/workbench" replace /> }
    ]
  }
]);
