import { PLATFORM_LABELS, GENRE_LABELS, SUBGENRE_LABELS, TEMPLATE_LABELS } from '../../../lib/constants.js';

export default function BookSettingDrawer({ book }) {
  if (!book) return <p className="context-drawer-empty">未选择书籍。</p>;

  return (
    <div className="drawer-book-setting">
      <p style={{ fontSize: '13px', color: 'var(--muted, #9ca3af)', marginBottom: '10px' }}>
        写作速查 · 只读摘要,完整编辑请前往资料库。
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
        <div><strong>书名:</strong> {book.title || '未命名'}</div>
        <div><strong>平台:</strong> {PLATFORM_LABELS[book.platform] || book.platform || '未设置'}</div>
        <div><strong>题材:</strong> {GENRE_LABELS[book.genre] || book.genre || '未设置'}</div>
        {book.subgenre ? <div><strong>子分类:</strong> {SUBGENRE_LABELS[book.subgenre] || book.subgenre}</div> : null}
        {book.template ? <div><strong>写法模板:</strong> {TEMPLATE_LABELS[book.template] || book.template}</div> : null}
        {book.synopsis ? (
          <div>
            <strong>核心矛盾:</strong>
            <p style={{ marginTop: '4px', color: 'var(--muted, #9ca3af)', lineHeight: 1.6 }}>{book.synopsis}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
