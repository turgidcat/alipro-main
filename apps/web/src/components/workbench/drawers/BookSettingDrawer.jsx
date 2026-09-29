import { PLATFORM_LABELS, GENRE_LABELS, SUBGENRE_LABELS, TEMPLATE_LABELS } from '../../../lib/constants.js';

export default function BookSettingDrawer({ book }) {
  if (!book) return <p className="context-drawer-empty">未选择书籍。</p>;

  return (
    <div className="drawer-book-setting">
      <p className="drawer-muted-copy">
        写作速查 · 只读摘要,完整编辑请前往资料库。
      </p>
      <div className="drawer-detail-stack">
        <div className="drawer-list-item"><strong>书名：</strong>{book.title || '未命名'}</div>
        <div className="drawer-list-item"><strong>平台：</strong>{PLATFORM_LABELS[book.platform] || book.platform || '未设置'}</div>
        <div className="drawer-list-item"><strong>题材：</strong>{GENRE_LABELS[book.genre] || book.genre || '未设置'}</div>
        {book.subgenre ? <div className="drawer-list-item"><strong>子分类：</strong>{SUBGENRE_LABELS[book.subgenre] || book.subgenre}</div> : null}
        {book.template ? <div className="drawer-list-item"><strong>写法模板：</strong>{TEMPLATE_LABELS[book.template] || book.template}</div> : null}
        {book.synopsis ? (
          <div className="drawer-list-item">
            <strong>核心矛盾：</strong>
            <p className="drawer-muted-copy">{book.synopsis}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
