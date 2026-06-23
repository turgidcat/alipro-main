import { Fragment } from 'react';
import Modal from './Modal.jsx';
import StatusNotice from './StatusNotice.jsx';

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
          {revisionError ? <div className="modal-error">{revisionError}</div> : null}
          {revisionNotice ? <div className="modal-success">{revisionNotice}</div> : null}
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
        {revisionError ? (
          <StatusNotice kind="error" title="校改保存失败" text={revisionError} className="mb-0" />
        ) : null}
        {revisionNotice ? (
          <StatusNotice kind="success" title="校改区提示" text={revisionNotice} className="mb-0" />
        ) : null}

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
          <div className="revision-editor-meta">
            <span>原文 {revisionOriginal.length} 字</span>
            <span>校改稿 {revisionDraft.length} 字</span>
            <span>建议 {revisionChangeItems.length} 条</span>
            <span>{generationState.metaText}</span>
          </div>
        </div>

        <div className="revision-review-layout">
          <section className="revision-original-panel">
            <div className="revision-original-head">
              <span>原文标注</span>
              <em>{revisionOriginal.length} 字</em>
            </div>
            <div className="revision-original-list">
              {revisionOriginalParagraphs.length > 0 ? revisionOriginalParagraphs.map((paragraph, index) => {
                const paragraphNumber = index + 1;
                const replaceSuggestion = revisionSuggestionMarks.replaceByParagraph.get(paragraphNumber);
                const deleteSuggestion = revisionSuggestionMarks.deleteByParagraph.get(paragraphNumber);
                const insertSuggestions = revisionSuggestionMarks.insertAfterParagraph.get(paragraphNumber) || [];
                const hasReplace = !!replaceSuggestion;
                const hasDelete = !!deleteSuggestion;
                const hasInsert = insertSuggestions.length > 0;
                const changeKey = hasDelete
                  ? 'delete-' + paragraphNumber
                  : hasReplace
                    ? 'replace-' + paragraphNumber
                    : null;
                const insertChangeKeys = insertSuggestions.map((_, insertIndex) => 'insert-' + paragraphNumber + '-' + insertIndex);
                const isCurrentChange = changeKey && revisionCurrentChange?.key === changeKey;
                const originalText = paragraph || '（空段）';
                return (
                  <Fragment key={index + '-' + paragraph.slice(0, 16)}>
                    <article
                      className={'revision-original-paragraph' + (hasReplace ? ' is-replace' : '') + (hasDelete ? ' is-delete' : '') + (isCurrentChange ? ' is-revision-focus' : '')}
                      ref={(element) => {
                        registerRevisionChangeRef(changeKey, element);
                        registerRevisionParagraphRef(paragraphNumber, element);
                      }}
                    >
                      <div className="revision-original-paragraph-head">
                        <span className="revision-paragraph-tag">第 {paragraphNumber} 段</span>
                        <div className="revision-paragraph-badges">
                          {hasReplace ? <strong className="revision-paragraph-badge is-replace">修改</strong> : null}
                          {hasDelete ? <strong className="revision-paragraph-badge is-delete">删除</strong> : null}
                          {!hasReplace && !hasDelete && hasInsert ? <strong className="revision-paragraph-badge is-insert">新增</strong> : null}
                        </div>
                        <div className="revision-paragraph-actions">
                          {replaceSuggestion ? (
                            <button
                              type="button"
                              className="ghost-btn"
                              disabled={revisionAppliedChangeKeys.includes(changeKey)}
                              onClick={() => onApplyRevisionSuggestion(replaceSuggestion, changeKey)}
                            >
                              {revisionAppliedChangeKeys.includes(changeKey) ? '已应用' : '应用'}
                            </button>
                          ) : null}
                          {deleteSuggestion ? (
                            <button
                              type="button"
                              className="ghost-btn"
                              disabled={revisionAppliedChangeKeys.includes(changeKey)}
                              onClick={() => onApplyRevisionSuggestion(deleteSuggestion, changeKey)}
                            >
                              {revisionAppliedChangeKeys.includes(changeKey) ? '已应用' : '应用'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {hasDelete ? (
                        <div className="revision-original-change is-delete">
                          <p className="revision-original-change-original"><s>{originalText}</s></p>
                          <p className="revision-original-change-new">删除</p>
                        </div>
                      ) : hasReplace ? (
                        <div className="revision-original-change is-replace">
                          <p className="revision-original-change-original"><s>{originalText}</s></p>
                          <p className="revision-original-change-new">{replaceSuggestion.suggested_text}</p>
                        </div>
                      ) : (
                        <p className="revision-paragraph-text">{originalText}</p>
                      )}
                    </article>
                    {hasInsert ? insertSuggestions.map((suggestion, insertIndex) => {
                      const insertChangeKey = insertChangeKeys[insertIndex];
                      const isCurrentInsertChange = revisionCurrentChange?.key === insertChangeKey;
                      return (
                        <article
                          className={'revision-original-paragraph is-insert' + (isCurrentInsertChange ? ' is-revision-focus' : '')}
                          key={paragraphNumber + '-insert-' + insertIndex}
                          ref={(element) => registerRevisionChangeRef(insertChangeKey, element)}
                        >
                          <div className="revision-original-paragraph-head">
                            <span className="revision-paragraph-tag">第 {paragraphNumber} 段后新增</span>
                            <div className="revision-paragraph-badges">
                              <strong className="revision-paragraph-badge is-insert">新增</strong>
                            </div>
                            <div className="revision-paragraph-actions">
                              <button
                                type="button"
                                className="ghost-btn"
                                disabled={revisionAppliedChangeKeys.includes(insertChangeKey)}
                                onClick={() => onApplyRevisionSuggestion(suggestion, insertChangeKey)}
                              >
                                {revisionAppliedChangeKeys.includes(insertChangeKey) ? '已应用' : '应用'}
                              </button>
                            </div>
                          </div>
                          <div className="revision-original-change is-insert">
                            <p className="revision-original-change-new">{suggestion.suggested_text}</p>
                          </div>
                        </article>
                      );
                    }) : null}
                  </Fragment>
                );
              }) : (
                <p className="revision-original-empty">当前还没有正文结果。</p>
              )}
            </div>
          </section>

          <aside className="revision-review-side">
            {revisionChangeItems.length > 0 ? (
              <div className="revision-change-nav">
                <div className="revision-change-nav-info">
                  <strong>修改导航</strong>
                  <span>{revisionCurrentChange ? revisionCurrentChange.label : '已找到修改点'}</span>
                  <em>{revisionCurrentFocusIndex + 1} / {revisionChangeItems.length}</em>
                </div>
                <div className="revision-change-nav-actions">
                  <button type="button" className="ghost-btn" onClick={() => onFocusRevisionChange(-1)}>
                    上一处
                  </button>
                  <button type="button" className="ghost-btn" onClick={() => onFocusRevisionChange(1)}>
                    下一处
                  </button>
                </div>
              </div>
            ) : null}

            {revisionSuggestions ? (
              <section className="revision-suggestion-panel">
                <div className="revision-suggestion-head">
                  <span>校改建议</span>
                  <strong>{Array.isArray(revisionSuggestions.suggestions) ? revisionSuggestions.suggestions.length : 0} 条</strong>
                </div>
                {Array.isArray(revisionSuggestions.suggestions) && revisionSuggestions.suggestions.length > 0 ? (
                  <div className="revision-suggestion-list">
                    {revisionSuggestions.suggestions.map((suggestion, index) => {
                      const locationNumber = Number(suggestion?.paragraph || suggestion?.afterParagraph || index + 1);
                      const insertBeforeCount = revisionSuggestions.suggestions
                        .slice(0, index)
                        .filter((item) => (
                          item?.action === 'insert_after' &&
                          Number(item?.afterParagraph || item?.paragraph || 0) === locationNumber
                        )).length;
                      const suggestionChangeKey = suggestion?.action === 'insert_after'
                        ? `insert-${locationNumber}-${insertBeforeCount}`
                        : suggestion?.action === 'delete'
                          ? `delete-${locationNumber}`
                          : `replace-${locationNumber}`;
                      const actionLabel = suggestion?.action === 'insert_after'
                        ? `第 ${locationNumber} 段后新增`
                        : suggestion?.action === 'delete'
                          ? `第 ${locationNumber} 段删除`
                          : `第 ${locationNumber} 段修改`;
                      const suggestionText = String(suggestion?.suggested_text || '').trim();
                      const originalText = String(suggestion?.original_text || '').trim();
                      return (
                        <article key={`${suggestion?.action || 'change'}-${locationNumber}-${index}`} className="revision-suggestion-item">
                          <div className="revision-suggestion-location">
                            <span>{index + 1}</span>
                            <strong>{actionLabel}</strong>
                            <button
                              type="button"
                              className="ghost-btn"
                              disabled={revisionAppliedChangeKeys.includes(suggestionChangeKey)}
                              onClick={() => onApplyRevisionSuggestion(suggestion, suggestionChangeKey)}
                            >
                              {revisionAppliedChangeKeys.includes(suggestionChangeKey) ? '已应用' : '应用'}
                            </button>
                          </div>
                          <div className="revision-suggestion-tags">
                            <span>{suggestion?.category || '文风'}</span>
                            <span>{suggestion?.severity === 'important' ? '重点' : '建议'}</span>
                          </div>
                          {originalText ? (
                            <p className="revision-suggestion-original">{originalText}</p>
                          ) : null}
                          {suggestionText ? (
                            <div className={'revision-suggestion-text' + (suggestion?.action === 'insert_after' ? ' is-new' : '')}>
                              <p>{suggestionText}</p>
                            </div>
                          ) : null}
                          {suggestion?.reason ? <p className="revision-suggestion-reason">{suggestion.reason}</p> : null}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="revision-suggestion-empty">没有可直接应用的逐段建议。</p>
                )}
                {revisionSuggestions.raw_content ? (
                  <div className="revision-suggestion-text">
                    <span>原始输出</span>
                    <pre className="revision-suggestion-raw">{revisionSuggestions.raw_content}</pre>
                  </div>
                ) : null}
              </section>
            ) : (
              <section className="revision-suggestion-panel is-empty">
                <div className="revision-suggestion-head">
                  <span>校改建议</span>
                  <strong>待生成</strong>
                </div>
              </section>
            )}

            <section className="revision-edit-box revision-compare-pane-edit">
              <span>校改稿</span>
              <textarea
                className="modal-textarea modal-textarea-longform modal-textarea-revision"
                value={revisionDraft}
                onChange={(event) => setRevisionDraft(event.target.value)}
                placeholder="最终保存稿。"
              />
            </section>
          </aside>
        </div>
      </div>
    </Modal>
  );
}
