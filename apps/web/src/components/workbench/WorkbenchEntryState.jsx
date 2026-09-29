export default function WorkbenchEntryState({
  books = [],
  loading = false,
  error = '',
  onSelectBook,
  onOpenLibrary
}) {
  if (loading) {
    return (
      <main className="workbench-entry-state is-loading" aria-live="polite">
        <div className="workbench-entry-spinner" aria-hidden="true" />
        <strong>正在打开创作台</strong>
        <span>正在恢复当前作品和章节进度…</span>
      </main>
    );
  }

  const hasBooks = Array.isArray(books) && books.length > 0;

  return (
    <main className="workbench-entry-state">
      <section className="workbench-entry-panel">
        <span className="workbench-entry-kicker">创作台</span>
        <h1>{hasBooks ? '继续哪一本？' : '先准备一本作品'}</h1>
        <p>
          {hasBooks
            ? '选择作品后直接恢复最近章节，不再经过启动首页。'
            : '创作台需要关联作品。先去资料库创建作品，再回来写作。'}
        </p>

        {error ? <div className="workbench-entry-error">{error}</div> : null}

        {hasBooks ? (
          <div className="workbench-entry-book-list">
            {books.map((book) => (
              <button type="button" key={book.id} onClick={() => onSelectBook?.(book.id)}>
                <span>{book.status === 'completed' ? '已完结' : '创作中'}</span>
                <strong>{book.title || '未命名作品'}</strong>
                <em>进入创作 <b aria-hidden="true">→</b></em>
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="workbench-entry-primary" onClick={onOpenLibrary}>
            前往资料库
            <b aria-hidden="true">→</b>
          </button>
        )}
      </section>
    </main>
  );
}
