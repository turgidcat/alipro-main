import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router.jsx';
import './styles/fonts.css';
import './index.css';
import './styles.css';
import './product-ui.css';
import './mobile.css';
import './contrast.css';
import './mobile-dialogs.css';
// 墨朱纸皮肤层：六套 token 别名的唯一定义点，必须保持在最后导入
import './styles/ink-zhu-paper.css';

async function installNativeAuthCallback() {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  const [{ App }, { Browser }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/browser')
  ]);
  await App.addListener('backButton', ({ canGoBack }) => {
    const dialogs = [...document.querySelectorAll('[role="dialog"], .modal-panel')]
      .filter((element) => element.getClientRects().length > 0);
    const dialog = dialogs.at(-1);
    if (dialog) {
      const closeButton = dialog.querySelector('[aria-label="关闭"], .modal-close-btn, .mobile-library-sheet-head button, .prompt-manager-modal-close')
        || [...dialog.querySelectorAll('button')].find((button) => button.textContent.trim() === '关闭');
      closeButton?.click();
      return;
    }
    if (canGoBack) window.history.back();
    else App.minimizeApp();
  });
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
