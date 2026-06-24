import Modal from './Modal.jsx';
export default function RevisionEditor(props) {
  const {
    chapterNumber,
    revisionError,
    revisionNotice,
    revisionRequirement,
    setRevisionRequirement,
    revisionOriginal,
    revisionDraft,
    setRevisionDraft,
    revisionSuggestions,
    revisionDiffRows = [],
    revisionSummaryText = '',
    generationState,
    revisionPolishing,
    revisionSaving,
    revisionChangeItems,
    revisionCurrentChange,
    revisionCurrentFocusIndex,
    revisionOriginalParagraphs,
    revisionSuggestionMarks,
    revisionAppliedChangeKeys,
    onClose,
    onPolish,
    onSave,
    onFocusRevisionChange,
    onApplyRevisionSuggestion,
    registerRevisionChangeRef,
    registerRevisionParagraphRef
  } = props;

  return (
    <Modal
      title={'第 ' + chapterNumber + ' 章正文校改'}
      description=""
      onClose={onClose}
      closeOnBackdrop={false}
      actions={
        <>
          <button type="button" className="ghost-btn" onClick={onClose}>取消</button>
          <button type="button" className="ghost-btn" onClick={onPolish} disabled={revisionPolishing || revisionSaving}>
            {revisionPolishing ? '正在分析...' : '生成校改建议'}
          </button>
          <button type="button" className="solid-btn" onClick={onSave} disabled={revisionSaving}>
            {revisionSaving ? '正在保存...' : '保存校改'}
          </button>
        </>
      }
    >
      <div className="revision-editor">
        <div className="revision-review-topbar">
          <label className="editor-field">
            <span>校改目标</span>
            <textarea
              className="modal-textarea modal-textarea-compact"
              value={revisionRequirement}
              onChange={(event) => setRevisionRequirement(event.target.value)}
              placeholder="增强画面、收紧节奏、修正重复。"
            />
          </label>
          <section className={'revision-summary-line' + (revisionError ? ' is-error' : '')}>
            <span>校改建议</span>
            <strong>{revisionError || revisionSummaryText || revisionNotice || '待生成校改稿。'}</strong>
          </section>
          <div className="revision-editor-meta">
            <span>原文 {revisionOriginal.length} 字</span>
            <span>校改稿 {revisionDraft.length} 字</span>
            <span>建议 {revisionChangeItems.length} 条</span>
            <span>{generationState.metaText}</span>
          </div>
        </div>

        <div className="revision-review-layout">
          <section className="revision-diff-panel-main">
            <div className="revision-diff-head-row">
              <span>原文</span>
              <span>校改稿</span>
            </div>
            <div className="revision-diff-list-main">
              {revisionDiffRows.length > 0 ? revisionDiffRows.map((row) => {
                return (
                  <article
                    key={row.key}
                    className={'revision-diff-row-main is-' + row.type}
                    ref={(element) => {
                      registerRevisionChangeRef(row.key, element);
                      if (row.beforeNumber) registerRevisionParagraphRef(row.beforeNumber, element);
                    }}
                  >
                    <div className="revision-diff-cell-main">
                      <span className="revision-inline-paragraph-no">{row.beforeNumber || ''}</span>
                      <p>{row.before || (row.type === 'insert' ? ' ' : '（空）')}</p>
                    </div>
                    <div className="revision-diff-cell-main">
                      <span className="revision-inline-paragraph-no">{row.afterNumber || ''}</span>
                      <p>{row.after || (row.type === 'delete' ? '删除' : '（空）')}</p>
                    </div>
                  </article>
                );
              }) : (
                <p className="revision-original-empty">当前还没有正文结果。</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </Modal>
  );
}
