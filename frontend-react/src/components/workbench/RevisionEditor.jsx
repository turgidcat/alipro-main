import { Fragment } from 'react';
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
      description="直接修改当前章节正文，保存后会写回章节记录。"
      onClose={onClose}
      closeOnBackdrop={false}
      actions={
        <>
          {revisionError ? <div className="modal-error">{revisionError}</div> : null}
          {revisionNotice ? <div className="modal-success">{revisionNotice}</div> : null}
          <button type="button" className="ghost-btn" onClick={onClose}>取消</button>
          <button type="button" className="ghost-btn" onClick={onPolish} disabled={revisionPolishing || revisionSaving}>
            {revisionPolishing ? '正在分析...' : '生成局部建议'}
          </button>
          <button type="button" className="solid-btn" onClick={onSave} disabled={revisionSaving}>
            {revisionSaving ? '正在保存...' : '保存校改'}
          </button>
        </>
      }
    >
      <div className="revision-editor">
        <label className="editor-field">
          <span>校改目标</span>
          <textarea
            className="modal-textarea modal-textarea-compact"
            value={revisionRequirement}
            onChange={(event) => setRevisionRequirement(event.target.value)}
            placeholder="例如：增强画面感、删除重复解释、加强结尾钩子。"
          />
        </label>
        <div className="revision-editor-meta">
          <span>原文 {revisionOriginal.length} 字</span>
          <span>校改稿 {revisionDraft.length} 字</span>
          <span>{generationState.metaText}</span>
        </div>
        <section className="revision-edit-box revision-compare-pane-edit">
          <span>校改稿</span>
          <textarea
            className="modal-textarea modal-textarea-longform modal-textarea-revision"
            value={revisionDraft}
            onChange={(event) => setRevisionDraft(event.target.value)}
            placeholder="这里是最终保存稿。可以直接手改，也可以先应用下面的局部建议。"
          />
        </section>
        {revisionChangeItems.length > 0 ? (
          <div className="revision-change-nav">
            <div className="revision-change-nav-info">
              <strong>修改导航</strong>
              <span>{revisionCurrentChange ? revisionCurrentChange.label : '已找到修改点'}</span>
              <em>{revisionCurrentFocusIndex + 1} / {revisionChangeItems.length}</em>
            </div>
            <div className="revision-change-nav-actions">
              <button type="button" className="ghost-btn" onClick={() => onFocusRevisionChange(-1)}>
                上一处修改
              </button>
              <button type="button" className="ghost-btn" onClick={() => onFocusRevisionChange(1)}>
                下一处修改
              </button>
            </div>
          </div>
        ) : null}
        {revisionSuggestions ? (
          <section className="revision-suggestion-panel">
            <div className="revision-suggestion-head">
              <span>建议概览</span>
              <strong>本次返回 {Array.isArray(revisionSuggestions.suggestions) ? revisionSuggestions.suggestions.length : 0} 条局部建议</strong>
            </div>
            {revisionSuggestions.regeneration_notes ? (
              <div className="revision-suggestion-regenerate">
                <span>模型提醒</span>
                <p>{revisionSuggestions.regeneration_notes}</p>
              </div>
            ) : null}
            {Array.isArray(revisionSuggestions.suggestions) && revisionSuggestions.suggestions.length > 0 ? (
              <div className="revision-suggestion-list">
                {revisionSuggestions.suggestions.map((suggestion, index) => {
                  const locationNumber = Number(suggestion?.paragraph || suggestion?.afterParagraph || index + 1);
                  const actionLabel = suggestion?.action === 'insert_after'
                    ? `第 ${locationNumber} 段后新增`
                    : suggestion?.action === 'delete'
                      ? `第 ${locationNumber} 段删除`
                      : `第 ${locationNumber} 段修改`;
                  const suggestionText = String(suggestion?.suggested_text || '').trim();
                  return (
                    <article key={`${suggestion?.action || 'change'}-${locationNumber}-${index}`} className="revision-suggestion-item">
                      <div className="revision-suggestion-location">
                        <span>{index + 1}</span>
                        <strong>{actionLabel}</strong>
                      </div>
                      <p>{String(suggestion?.reason || suggestion?.note || '已在原文标注区同步高亮，可直接应用到校改稿。').trim()}</p>
                      {suggestionText ? (
                        <div className={'revision-suggestion-text' + (suggestion?.action === 'insert_after' ? ' is-new' : '')}>
                          <span>建议文本</span>
                          <p>{suggestionText}</p>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="revision-suggestion-empty">这次没有返回可直接应用的逐段建议，可以结合下方原始结果手动调整。</p>
            )}
            {revisionSuggestions.raw_content ? (
              <div className="revision-suggestion-text">
                <span>原始校改输出</span>
                <pre className="revision-suggestion-raw">{revisionSuggestions.raw_content}</pre>
              </div>
            ) : null}
          </section>
        ) : null}
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
                            {revisionAppliedChangeKeys.includes(changeKey) ? '已应用修改' : '应用修改'}
                          </button>
                        ) : null}
                        {deleteSuggestion ? (
                          <button
                            type="button"
                            className="ghost-btn"
                            disabled={revisionAppliedChangeKeys.includes(changeKey)}
                            onClick={() => onApplyRevisionSuggestion(deleteSuggestion, changeKey)}
                          >
                            {revisionAppliedChangeKeys.includes(changeKey) ? '已应用删除' : '应用删除'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {hasDelete ? (
                      <div className="revision-original-change is-delete">
                        <p className="revision-original-change-original"><s>{originalText}</s></p>
                        <p className="revision-original-change-new">（删除后保留空段）</p>
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
                              {revisionAppliedChangeKeys.includes(insertChangeKey) ? '已应用新增' : '应用新增'}
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
      </div>
    </Modal>
  );
}
