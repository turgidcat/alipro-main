import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router.jsx';
import './index.css';
import './styles.css';
import './styles/theme.css';
import './product-ui.css';
import './mobile.css';
import './contrast.css';

async function installNativeAuthCallback() {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  const [{ App }, { Browser }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/browser')
  ]);
  await App.addListener('appUrlOpen', async ({ url }) => {
    if (!String(url || '').startsWith('alipro://auth/callback')) return;
    const parsed = new URL(url);
    const query = parsed.search || '';
    await Browser.close().catch(() => {});
    window.location.assign(`${import.meta.env.BASE_URL || '/'}auth/callback${query}`);
  });
}

installNativeAuthCallback().catch(() => {});

ReactDOM.createRoot(document.getElementById('root')).render(
  <RouterProvider router={router} />
);
