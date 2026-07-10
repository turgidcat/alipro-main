import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router.jsx';
import './index.css';
import './styles.css';
import './styles/theme.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <RouterProvider router={router} />
);
