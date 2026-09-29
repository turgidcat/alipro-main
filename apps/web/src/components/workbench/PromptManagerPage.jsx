import { useState } from 'react';

function formatPromptTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export default function PromptManagerPage({
  bookTitle,
  chapterNumber,
  loading,
  error,
  entries,
  updatedAt,
  onRefresh
}) {
  const [copiedKey, setCopiedKey] = useState('');

  async function handleCopy(key, prompt) {
    try {
      await navigator.clipboard.writeText(String(prompt || ''));
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? '' : current));
      }, 1200);
    } catch (_) {}
  }

  return (
    <section className="prompt-manager-page">
      <header className="prompt-manager-header">
        <div className="prompt-manager-header-copy">
          <span className="chapter-reader-kicker">PROMPT MANAGER</span>
          <h2>{bookTitle ? `${bookTitle} · 第 ${chapterNumber} 章` : 'Prompt 管理'}</h2>
          <p>这里展示当前章节最常用生成链路的实际模型输入文本。</p>
        </div>
        <div className="prompt-manager-header-actions">
          {updatedAt ? <span className="prompt-manager-updated">最近刷新：{formatPromptTime(updatedAt)}</span> : null}
          <button type="button" className="solid-btn" onClick={onRefresh} disabled={loading}>
            {loading ? '刷新中...' : '刷新 Prompt'}
          </button>
        </div>
      </header>

      {error ? <div className="global-banner is-error">{error}</div> : null}

      <div className="prompt-manager-list">
        {Array.isArray(entries) && entries.length > 0 ? entries.map((entry) => (
          <article key={entry.key} className={`prompt-manager-card is-${entry.status || 'ready'}`}>
            <div className="prompt-manager-card-head">
              <div>
                <strong>{entry.title || '未命名 Prompt'}</strong>
                {entry.description ? <p>{entry.description}</p> : null}
              </div>
              <div className="prompt-manager-card-actions">
                {Array.isArray(entry.meta) && entry.meta.length > 0 ? (
                  <div className="prompt-manager-meta">
                    {entry.meta.map((item) => (
                      <span key={`${entry.key}-${item}`}>{item}</span>
                    ))}
                  </div>
                ) : null}
                {entry.prompt ? (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => handleCopy(entry.key, entry.prompt)}
                  >
                    {copiedKey === entry.key ? '已复制' : '复制'}
                  </button>
                ) : null}
              </div>
            </div>

            {entry.prompt ? (
              <pre className="prompt-manager-pre">{entry.prompt}</pre>
            ) : (
              <div className="prompt-manager-empty">
                <strong>{entry.status === 'error' ? '当前无法生成预览' : '当前没有可展示的 Prompt'}</strong>
                <p>{entry.reason || '请先补足当前章节所需内容。'}</p>
              </div>
            )}
          </article>
        )) : (
          <div className="prompt-manager-empty">
            <strong>还没有可展示的 Prompt</strong>
            <p>选择作品和章节后，这里会展示当前章节相关的模型输入内容。</p>
          </div>
        )}
      </div>
    </section>
  );
}
