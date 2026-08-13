import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  bindPhone,
  changePassword,
  claimLegacyData,
  getAuthConfiguration,
  getAuthToken,
  getProfile,
  getStoredUser,
  loginWithPassword,
  loginWithPhone,
  launchOAuth,
  logoutCurrentSession,
  registerWithPhone,
  saveAuthSession,
  saveStoredUser,
  sendSmsCode,
  updateProfile,
  updateUserSettings
} from '../authApi.js';
import {
  fetchBookList,
  fetchBooksStats,
  getStoredCurrentBookId,
  persistCurrentBookId
} from '../workbenchApi.js';
import '../me-page.css';

function formatCount(value) {
  const number = Number(value || 0);
  if (number >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)}万`;
  return number.toLocaleString('zh-CN');
}

function providerLabel(provider) {
  return provider === 'wechat' ? '微信' : provider === 'qq' ? 'QQ' : provider;
}

function Switch({ checked, onChange, label }) {
  return (
    <button type="button" className={`me-switch${checked ? ' is-on' : ''}`} onClick={() => onChange(!checked)} role="switch" aria-checked={checked} aria-label={label}>
      <span />
    </button>
  );
}

export default function MePage() {
  const navigate = useNavigate();
  const [configuration, setConfiguration] = useState(null);
  const [user, setUser] = useState(() => getStoredUser());
  const [books, setBooks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [authMethod, setAuthMethod] = useState('sms');
  const [phoneMode, setPhoneMode] = useState('login');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [account, setAccount] = useState('');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [countdown, setCountdown] = useState(0);
  const [accountEditor, setAccountEditor] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [bindPhoneValue, setBindPhoneValue] = useState('');
  const [bindPhoneCode, setBindPhoneCode] = useState('');

  const currentBook = useMemo(() => {
    const currentId = getStoredCurrentBookId();
    return books.find((book) => book.id === currentId) || books[0] || null;
  }, [books]);
  const boundProviders = useMemo(() => new Set((user?.providers || []).map((item) => item.provider)), [user]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      let configResult = null;
      try {
        configResult = await getAuthConfiguration();
      } catch (reason) {
        if (active) setError(reason.message || '无法连接云端账号服务');
      }
      if (!active) return;
      setConfiguration(configResult);
      if (!getAuthToken()) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const [profile, bookList, bookStats] = await Promise.all([
          getProfile(),
          fetchBookList(),
          fetchBooksStats()
        ]);
        if (!active) return;
        setUser(profile);
        saveStoredUser(profile);
        setDisplayName(profile.displayName || '');
        setBooks(bookList);
        setStats(bookStats);
      } catch (reason) {
        if (!active) return;
        if (reason.status === 401) setUser(null);
        setError(reason.message || '账号信息读取失败');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  async function refreshData(profile = user) {
    const [bookList, bookStats] = await Promise.all([fetchBookList(), fetchBooksStats()]);
    setBooks(bookList);
    setStats(bookStats);
    if (profile) {
      setUser(profile);
      saveStoredUser(profile);
      setDisplayName(profile.displayName || '');
    }
  }

  async function completeLogin(action) {
    setBusy('login');
    setError('');
    setNotice('');
    let session;
    try {
      session = await action();
      saveAuthSession(session);
      setUser(session.user);
      saveStoredUser(session.user);
      setDisplayName(session.user?.displayName || '');
    } catch (reason) {
      setError(reason.message || '登录失败');
      setBusy('');
      return;
    }

    try {
      await refreshData(session.user);
      setNotice('已登录，作品数据已连接当前账号。');
    } catch (reason) {
      setNotice('账号已登录。');
      setError(`作品数据暂时未加载：${reason.message || '请稍后刷新'}`);
    } finally {
      setBusy('');
    }
  }

  async function handleSendCode() {
    if (countdown > 0) return;
    const normalizedPhone = phone.replace(/\D/g, '');
    if (!/^1[3-9]\d{9}$/.test(normalizedPhone)) {
      setError('请输入正确的 11 位中国大陆手机号');
      setNotice('');
      return;
    }
    if (normalizedPhone !== phone) setPhone(normalizedPhone);
    setBusy('sms');
    setError('');
    setNotice('正在连接阿里云短信服务…');
    try {
      const result = await sendSmsCode(normalizedPhone, phoneMode);
      if (!result?.sent && !result?.developmentCode) {
        throw new Error('云端没有受理本次短信，请稍后重试');
      }
      setCountdown(60);
      setNotice(result.developmentCode
        ? `本地预览验证码：${result.developmentCode}`
        : '阿里云已受理，验证码通常会在 1 分钟内送达。');
    } catch (reason) {
      setError(reason.message || '验证码发送失败');
    } finally {
      setBusy('');
    }
  }

  function handlePhoneSubmit(event) {
    event.preventDefault();
    if (phoneMode === 'register') {
      completeLogin(() => registerWithPhone({ phone, code, password, displayName }));
      return;
    }
    completeLogin(() => loginWithPhone({ phone, code }));
  }

  function handlePasswordSubmit(event) {
    event.preventDefault();
    completeLogin(() => loginWithPassword({ account, password }));
  }

  async function handleOAuth(provider) {
    setBusy(provider);
    setError('');
    try {
      await launchOAuth(provider);
    } catch (reason) {
      setError(reason.message || `${providerLabel(provider)}登录暂时不可用`);
      setBusy('');
    }
  }

  async function handleProfileSave() {
    setBusy('profile');
    setError('');
    try {
      const profile = await updateProfile({ displayName, avatar: user?.avatar || '' });
      setUser(profile);
      saveStoredUser(profile);
      setNotice('昵称已保存。');
    } catch (reason) {
      setError(reason.message || '昵称保存失败');
    } finally {
      setBusy('');
    }
  }

  async function handleSetting(key, value) {
    setBusy(key);
    setError('');
    try {
      const profile = await updateUserSettings({ [key]: value });
      setUser(profile);
      saveStoredUser(profile);
    } catch (reason) {
      setError(reason.message || '设置保存失败');
    } finally {
      setBusy('');
    }
  }

  async function handleClaimLegacy() {
    setBusy('claim');
    setError('');
    try {
      const result = await claimLegacyData();
      await refreshData();
      setNotice(result.claimedBooks > 0 ? `已认领 ${result.claimedBooks} 部旧作品。` : '没有待认领的旧作品。');
    } catch (reason) {
      setError(reason.message || '旧数据认领失败');
    } finally {
      setBusy('');
    }
  }

  async function handleLogout() {
    setBusy('logout');
    await logoutCurrentSession().catch(() => {});
    setUser(null);
    setBooks([]);
    setStats(null);
    setBusy('');
    setNotice('已安全退出当前账号。');
  }

  async function handlePasswordChange(event) {
    event.preventDefault();
    setBusy('password');
    setError('');
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setAccountEditor('');
      setNotice('登录密码已更新。');
    } catch (reason) {
      setError(reason.message || '密码更新失败');
    } finally {
      setBusy('');
    }
  }

  async function handleBindPhoneCode() {
    setBusy('bind-sms');
    setError('');
    try {
      const result = await sendSmsCode(bindPhoneValue, 'bind_phone');
      setNotice(result.developmentCode ? `本地预览验证码：${result.developmentCode}` : '验证码已发送。');
    } catch (reason) {
      setError(reason.message || '验证码发送失败');
    } finally {
      setBusy('');
    }
  }

  async function handleBindPhone(event) {
    event.preventDefault();
    setBusy('bind-phone');
    setError('');
    try {
      const profile = await bindPhone({ phone: bindPhoneValue, code: bindPhoneCode });
      setUser(profile);
      saveStoredUser(profile);
      setAccountEditor('');
      setNotice('手机号已绑定。');
    } catch (reason) {
      setError(reason.message || '手机号绑定失败');
    } finally {
      setBusy('');
    }
  }

  function openWorkbench() {
    if (currentBook?.id) persistCurrentBookId(currentBook.id);
    navigate('/workbench');
  }

  if (loading) {
    return <main className="me-page"><div className="me-loading"><span />正在连接你的创作空间…</div></main>;
  }

  if (!user) {
    return (
      <main className="me-page is-guest">
        <section className="me-auth-hero">
          <span className="me-auth-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5.5 8.7c3.8-.8 6.8-.1 10.5 2.6v12.9c-3.7-2.7-6.7-3.4-10.5-2.6Z" />
              <path d="M26.5 8.7c-3.8-.8-6.8-.1-10.5 2.6v12.9c3.7-2.7 6.7-3.4 10.5-2.6Z" />
              <path d="M16 11.3v12.9" />
              <path d="m22.1 4.3.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9Z" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <div><span>ALIPRO ACCOUNT</span><h1>把故事带在身边</h1><p>登录后，作品、章节和角色资料将归入你的个人空间。</p></div>
        </section>

        <section className="me-auth-card">
          <div className="me-auth-tabs" role="tablist">
            <button type="button" className={authMethod === 'sms' ? 'is-active' : ''} onClick={() => setAuthMethod('sms')}>手机号</button>
            <button type="button" className={authMethod === 'password' ? 'is-active' : ''} onClick={() => setAuthMethod('password')}>账号密码</button>
          </div>

          {authMethod === 'sms' ? (
            <form className="me-auth-form" onSubmit={handlePhoneSubmit}>
              <div className="me-mode-row">
                <button type="button" className={phoneMode === 'login' ? 'is-active' : ''} onClick={() => setPhoneMode('login')}>验证码登录</button>
                <button type="button" className={phoneMode === 'register' ? 'is-active' : ''} onClick={() => setPhoneMode('register')}>注册新账号</button>
              </div>
              {phoneMode === 'register' ? (
                <label><span>昵称</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="之后也可以修改" maxLength={40} /></label>
              ) : null}
              <label><span>手机号</span><input value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="tel" autoComplete="tel" placeholder="请输入中国大陆手机号" /></label>
              <label><span>验证码</span><span className="me-code-field"><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6 位验证码" /><button type="button" onClick={handleSendCode} disabled={busy === 'sms' || countdown > 0}>{busy === 'sms' ? '发送中…' : countdown > 0 ? `${countdown}s` : '获取验证码'}</button></span></label>
              {phoneMode === 'register' ? (
                <label><span>登录密码</span><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" placeholder="至少 8 位" minLength={8} required /></label>
              ) : null}
              <button className="me-primary-button" type="submit" disabled={busy === 'login'}>{busy === 'login' ? '请稍候…' : phoneMode === 'register' ? '注册并进入' : '登录'}</button>
            </form>
          ) : (
            <form className="me-auth-form" onSubmit={handlePasswordSubmit}>
              <label><span>账号</span><input value={account} onChange={(event) => setAccount(event.target.value)} autoComplete="username" placeholder="手机号或管理员账号" required /></label>
              <label><span>密码</span><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="请输入密码" required /></label>
              <button className="me-primary-button" type="submit" disabled={busy === 'login'}>{busy === 'login' ? '请稍候…' : '登录'}</button>
            </form>
          )}

          {error ? <div className="me-banner is-error" role="alert">{error}</div> : null}
          {notice ? <div className="me-banner is-notice" role="status">{notice}</div> : null}

          <div className="me-auth-divider"><span>其他登录方式</span></div>
          <div className="me-social-row">
            <button type="button" className="is-wechat" onClick={() => handleOAuth('wechat')} disabled={!configuration?.wechat || busy === 'wechat'}><i>微</i><span>微信{configuration?.wechat ? '' : ' · 待配置'}</span></button>
            <button type="button" className="is-qq" onClick={() => handleOAuth('qq')} disabled={!configuration?.qq || busy === 'qq'}><i>Q</i><span>QQ{configuration?.qq ? '' : ' · 待配置'}</span></button>
          </div>
        </section>

        <p className="me-auth-foot">登录即表示你同意账号仅用于管理自己的创作数据。</p>
      </main>
    );
  }

  const avatarText = String(user.displayName || user.username || '我').slice(0, 1);
  const serverLabel = configuration?.dataRegion === 'aliyun-ecs' ? '阿里云已连接' : '开发环境';

  return (
    <main className="me-page is-signed-in">
      <section className="me-profile-hero">
        <div className="me-profile-avatar">{user.avatar ? <img src={user.avatar} alt="" /> : avatarText}</div>
        <div className="me-profile-copy"><span>{user.role === 'admin' ? '管理员' : '创作者'}</span><h1>{user.displayName || user.username}</h1><p>{user.phone ? `${user.phone.slice(0, 3)}****${user.phone.slice(-4)}` : '使用第三方账号登录'}</p></div>
        <span className="me-cloud-state"><i />{serverLabel}</span>
      </section>

      {currentBook ? (
        <button type="button" className="me-continue-card" onClick={openWorkbench}>
          <span className="me-book-cover">{String(currentBook.title || '书').slice(0, 1)}</span>
          <span><small>继续创作</small><strong>{currentBook.title}</strong><em>{currentBook.chapterCount || 0} 章 · {formatCount(currentBook.wordCount)} 字</em></span>
          <b>→</b>
        </button>
      ) : (
        <button type="button" className="me-empty-work" onClick={() => navigate('/books')}>建立第一部作品 <span>→</span></button>
      )}

      <section className="me-data-section">
        <div className="me-section-head"><div><span>MY STUDIO</span><h2>我的数据仓</h2></div><button type="button" onClick={() => navigate('/books')}>查看作品</button></div>
        <div className="me-stats-grid">
          {[['作品', stats?.totalBooks], ['章节', stats?.totalChapters], ['字数', formatCount(stats?.totalWords)], ['角色', stats?.totalCharacters]].map(([label, value]) => (
            <div key={label}><strong>{value ?? 0}</strong><span>{label}</span></div>
          ))}
        </div>
      </section>

      <section className="me-settings-card">
        <div className="me-section-title">账号与绑定</div>
        <div className="me-profile-edit"><label><span>昵称</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} /></label><button type="button" onClick={handleProfileSave} disabled={busy === 'profile' || displayName === user.displayName}>保存</button></div>
        {user.phone ? (
          <button type="button" className="me-setting-row" onClick={() => setAccountEditor(accountEditor === 'password' ? '' : 'password')}>
            <i>密</i><span><strong>{user.passwordEnabled ? '登录密码' : '设置登录密码'}</strong><small>{user.passwordEnabled ? '修改当前账号密码' : '设置后可用手机号和密码登录'}</small></span><b>›</b>
          </button>
        ) : (
          <button type="button" className="me-setting-row" onClick={() => setAccountEditor(accountEditor === 'phone' ? '' : 'phone')}>
            <i>手</i><span><strong>绑定手机号</strong><small>用于登录与找回账号</small></span><b>›</b>
          </button>
        )}
        {accountEditor === 'password' ? (
          <form className="me-inline-account-form" onSubmit={handlePasswordChange}>
            {user.passwordEnabled ? <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="当前密码" required /> : null}
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="新密码，至少 8 位" minLength={8} required />
            <button type="submit" disabled={busy === 'password'}>更新密码</button>
          </form>
        ) : null}
        {accountEditor === 'phone' ? (
          <form className="me-inline-account-form" onSubmit={handleBindPhone}>
            <input value={bindPhoneValue} onChange={(event) => setBindPhoneValue(event.target.value)} inputMode="tel" placeholder="手机号" required />
            <span><input value={bindPhoneCode} onChange={(event) => setBindPhoneCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="验证码" required /><button type="button" onClick={handleBindPhoneCode} disabled={busy === 'bind-sms'}>获取验证码</button></span>
            <button type="submit" disabled={busy === 'bind-phone'}>完成绑定</button>
          </form>
        ) : null}
        {['wechat', 'qq'].map((provider) => {
          const isBound = boundProviders.has(provider);
          const available = Boolean(configuration?.[provider]);
          return (
            <button type="button" className="me-setting-row" key={provider} onClick={() => !isBound && available && handleOAuth(provider)} disabled={isBound || !available}>
              <i className={`is-${provider}`}>{provider === 'wechat' ? '微' : 'Q'}</i>
              <span><strong>{providerLabel(provider)}</strong><small>{isBound ? '已绑定' : available ? '绑定账号' : '服务待配置'}</small></span><b>{isBound ? '✓' : '›'}</b>
            </button>
          );
        })}
      </section>

      <section className="me-settings-card">
        <div className="me-section-title">创作设置</div>
        <div className="me-setting-row"><i>声</i><span><strong>生成完成提示音</strong><small>正文生成后播放轻提示</small></span><Switch label="生成完成提示音" checked={user.settings?.generationSound !== false} onChange={(value) => handleSetting('generationSound', value)} /></div>
        <div className="me-setting-row"><i>字</i><span><strong>大字阅读</strong><small>章节正文使用更舒适的字号</small></span><Switch label="大字阅读" checked={Number(user.settings?.readerFontSize || 18) >= 20} onChange={(value) => handleSetting('readerFontSize', value ? 20 : 18)} /></div>
      </section>

      {user.role === 'admin' ? (
        <section className="me-admin-card"><div><strong>旧数据归档</strong><span>将服务器中尚未归属账号的作品认领到当前管理员。</span></div><button type="button" onClick={handleClaimLegacy} disabled={busy === 'claim'}>{busy === 'claim' ? '处理中…' : '检查并认领'}</button></section>
      ) : null}

      {error ? <div className="me-banner is-error" role="alert">{error}</div> : null}
      {notice ? <div className="me-banner is-notice" role="status">{notice}</div> : null}
      <button type="button" className="me-logout-button" onClick={handleLogout} disabled={busy === 'logout'}>退出登录</button>
      <p className="me-account-id">账号 ID · {user.userId}</p>
    </main>
  );
}
