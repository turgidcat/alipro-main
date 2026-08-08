import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App.jsx';
import BooksPage from './pages/BooksPage.jsx';
import ChangelogPage from './pages/ChangelogPage.jsx';
import AppLayout from './AppLayout.jsx';
import StorylineManagementPage from './pages/StorylineManagementPage.jsx';
import HomePage from './pages/HomePage.jsx';
import AudiobookPage from './pages/AudiobookPage.jsx';
import ComingSoonPage from './pages/ComingSoonPage.jsx';
import InspirationPage from './pages/InspirationPage.jsx';

const appBaseName = (() => {
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  return base && base !== '' ? base : undefined;
})();

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'books', element: <BooksPage /> },
      { path: 'books/outlines', element: <BooksPage /> },
      { path: 'books/storylines', element: <StorylineManagementPage /> },
      { path: 'books/characters', element: <BooksPage /> },
      { path: 'books/chapters', element: <BooksPage /> },
      { path: 'books/chapters/:chapterNumber', element: <BooksPage /> },
      { path: 'books/:bookId', element: <BooksPage /> },
      { path: 'audiobook', element: <AudiobookPage /> },
      {
        path: 'media/video',
        element: (
          <ComingSoonPage
            title="视频工坊"
            description="把章节正文、角色设定与叙事脉络转化为分镜、配音与成片，让作品拥有可视化的第二形态。"
            features={['分镜脚本', '角色配音', '画面生成', '成片导出']}
          />
        )
      },
      {
        path: 'inspiration/brainstorm',
        element: <InspirationPage />
      },
      { path: 'changelog', element: <ChangelogPage /> },
      { path: 'generation-logic', element: <Navigate to="/workbench" replace /> },
      { path: 'style-manager', element: <Navigate to="/workbench" replace /> },
      { path: 'genre-ui-demo', element: <Navigate to="/workbench" replace /> },
      { path: 'genre-book-showcase', element: <Navigate to="/workbench" replace /> },
      { path: 'genre-light-novel-showcase', element: <Navigate to="/workbench" replace /> },
      { path: 'workbench-redesign-lab', element: <Navigate to="/workbench" replace /> },
      { path: 'workbench', element: <App /> },
      { path: 'prompts', element: <App /> },
      { path: 'visual-sample', element: <Navigate to="/workbench" replace /> }
    ]
  }
], {
  basename: appBaseName
});
