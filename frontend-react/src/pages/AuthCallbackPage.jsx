import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeOAuthHandoff, saveAuthSession } from '../authApi.js';
import '../me-page.css';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(searchParams.get('error') || '');

  useEffect(() => {
    const handoff = searchParams.get('handoff');
    if (!handoff || error) return;
    exchangeOAuthHandoff(handoff)
      .then((session) => {
        saveAuthSession(session);
        navigate('/me', { replace: true });
      })
      .catch((reason) => setError(reason.message || '登录状态交换失败'));
  }, [error, navigate, searchParams]);

  return (
    <main className="me-page me-callback-page">
      <div className="me-callback-card">
        <span className={error ? 'is-error' : ''}>{error ? '!' : '·'}</span>
        <h1>{error ? '登录没有完成' : '正在完成登录'}</h1>
        <p>{error || '即将回到你的个人空间…'}</p>
        {error ? <button type="button" className="me-primary-button" onClick={() => navigate('/me', { replace: true })}>返回登录</button> : null}
      </div>
    </main>
  );
}
