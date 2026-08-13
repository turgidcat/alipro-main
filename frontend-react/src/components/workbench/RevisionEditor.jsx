import { useLayoutEffect, useRef, useState } from 'react';
import Modal from './Modal.jsx';
import { countPlatformEffectiveWords, formatExactWordCount } from '../../lib/textMetrics.js';

export default function RevisionEditor(props) {
  const [mobileView, setMobileView] = useState('original');
  const [mobileEditing, setMobileEditing] = useState(false);
  const [mobileChangeIndex, setMobileChangeIndex] = useState(0);
  const draftTextareaRef = useRef(null);
  const mobileDraftRef = useRef(null);
  const mobileScrollRef = useRef(null);
  const mobileChangeRefs = useRef(new Map());
  const pendingAppliedSuggestionKey = useRef('');
  const touchGestureRef = useRef(null);
  const pointerGestureRef = useRef(null);
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
    onApplyAllRevisionSuggestions,
    onUndoRevisionSuggestion,
    onUndoAllRevisionSuggestions,
    registerRevisionChangeRef,
    registerRevisionParagraphRef
  } = props;
  const originalWordCount = countPlatformEffectiveWords(revisionOriginal);
  const draftWordCount = countPlatformEffectiveWords(revisionDraft);
  const suggestionItems = Array.isArray(revisionSuggestions?.suggestions) ? revisionSuggestions.suggestions : [];
  const pendingSuggestionItems = suggestionItems.filter((suggestion, index) => !revisionAppliedChangeKeys.includes(suggestionKey(suggestion, index)));
  const appliedSuggestionItems = suggestionItems.filter((suggestion, index) => revisionAppliedChangeKeys.includes(suggestionKey(suggestion, index)));
  const mobileChangedRows = revisionDiffRows.filter((row) => row.type !== 'same');
  const activeMobileChange = mobileChangedRows[Math.min(mobileChangeIndex, Math.max(0, mobileChangedRows.length - 1))] || null;

  useLayoutEffect(() => {
    const textarea = draftTextareaRef.current;
    if (!textarea || typeof window === 'undefined' || !window.matchMedia('(max-width: 820px)').matches) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [revisionDraft, mobileView]);

  useLayoutEffect(() => {
    const editor = mobileDraftRef.current;
    if (!editor || document.activeElement === editor) return;
    if (editor.textContent !== revisionDraft) editor.textContent = revisionDraft;
  }, [revisionDraft, mobileView]);

  useLayoutEffect(() => {
    if (!mobileChangedRows.length) {
      setMobileChangeIndex(0);
      return;
    }
    setMobileChangeIndex((current) => Math.min(current, mobileChangedRows.length - 1));
    const pendingKey = pendingAppliedSuggestionKey.current;
    if (!pendingKey) return;
    const targetIndex = mobileChangedRows.findIndex((row) => row.suggestion && findSuggestionKey(row.suggestion) === pendingKey);
    if (targetIndex < 0) return;
    pendingAppliedSuggestionKey.current = '';
    window.setTimeout(() => focusMobileChange(targetIndex), 0);
  }, [revisionDiffRows]);

  function suggestionKey(suggestion, index) {
    return suggestion?.id || `${suggestion?.action || 'change'}-${suggestion?.paragraph || suggestion?.afterParagraph || index + 1}-${index}`;
  }

  function suggestionLabel(suggestion) {
    if (suggestion?.action === 'delete') return '删除';
    if (suggestion?.action === 'insert_after') return '新增';
    return '修改';
  }

  function findSuggestionKey(suggestion) {
    const index = suggestionItems.indexOf(suggestion);
    return suggestionKey(suggestion, index < 0 ? 0 : index);
  }

  function applySuggestion(suggestion, key) {
    pendingAppliedSuggestionKey.current = key;
    onApplyRevisionSuggestion(suggestion, key);
    setMobileView('draft');
    setMobileEditing(false);
  }

  function applyAllSuggestions() {
    if (!pendingSuggestionItems.length) return;
    const firstPending = suggestionItems.find((suggestion, index) => !revisionAppliedChangeKeys.includes(suggestionKey(suggestion, index)));
    if (firstPending) pendingAppliedSuggestionKey.current = findSuggestionKey(firstPending);
    onApplyAllRevisionSuggestions();
    setMobileView('draft');
    setMobileEditing(false);
    setMobileChangeIndex(0);
  }

  function undoAllSuggestions() {
    if (!appliedSuggestionItems.length) return;
    pendingAppliedSuggestionKey.current = '';
    onUndoAllRevisionSuggestions();
    setMobileView('suggestions');
    setMobileEditing(false);
    setMobileChangeIndex(0);
  }

  function mobileChangeLabel(row, index) {
    const paragraph = row.beforeNumber || row.suggestion?.afterParagraph || row.afterNumber;
    if (row.type === 'insert') return `${index + 1}. 第 ${paragraph || '?'} 段后新增`;
    return `${index + 1}. 第 ${paragraph || '?'} 段${row.label}`;
  }

  function focusMobileChange(index) {
    if (!mobileChangedRows.length) return;
    const normalizedIndex = (index + mobileChangedRows.length) % mobileChangedRows.length;
    const row = mobileChangedRows[normalizedIndex];
    setMobileView('draft');
    setMobileEditing(false);
    setMobileChangeIndex(normalizedIndex);
    window.setTimeout(() => {
      const scroller = mobileScrollRef.current;
      const target = mobileChangeRefs.current.get(row.key);
      if (!scroller || !target) return;
      const targetTop = Math.max(0, target.offsetTop - 116);
      if (typeof scroller.scrollTo === 'function') scroller.scrollTo({ top: targetTop, behavior: 'smooth' });
      else scroller.scrollTop = targetTop;
    }, 0);
  }

  function handleMobileTouchStart(event) {
    if (event.target.closest('button, select, input, textarea, [contenteditable="true"]')) return;
    const touch = event.touches?.[0];
    const scroller = mobileScrollRef.current;
    if (!touch || !scroller) return;
    touchGestureRef.current = { y: touch.clientY, scrollTop: scroller.scrollTop };
  }

  function handleMobileTouchMove(event) {
    const touch = event.touches?.[0];
    const scroller = mobileScrollRef.current;
    const gesture = touchGestureRef.current;
    if (!touch || !scroller || !gesture) return;
    const distance = gesture.y - touch.clientY;
    if (Math.abs(distance) < 3) return;
    scroller.scrollTop = gesture.scrollTop + distance;
    if (event.cancelable) event.preventDefault();
  }

  function handleMobilePointerDown(event) {
    if (event.pointerType !== 'touch' || event.target.closest('button, select, input, textarea, [contenteditable="true"]')) return;
    const scroller = mobileScrollRef.current;
    if (!scroller) return;
    pointerGestureRef.current = { id: event.pointerId, y: event.clientY, scrollTop: scroller.scrollTop };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleMobilePointerMove(event) {
    const scroller = mobileScrollRef.current;
    const gesture = pointerGestureRef.current;
    if (!scroller || !gesture || gesture.id !== event.pointerId) return;
    scroller.scrollTop = gesture.scrollTop + gesture.y - event.clientY;
    event.preventDefault();
  }

  function stopMobilePointerDrag(event) {
    if (pointerGestureRef.current?.id === event.pointerId) pointerGestureRef.current = null;
  }

  return (
    <Modal
      title={'第 ' + chapterNumber + ' 章正文校改'}
      description=""
      onClose={onClose}
      closeOnBackdrop={false}
      actions={
        <>
          <button type="button" className="ghost-btn revision-cancel-btn" onClick={onClose}>取消</button>
          <button type="button" className="ghost-btn revision-analyse-btn" onClick={onPolish} disabled={revisionPolishing || revisionSaving}>
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
          {/* Two-column input row — columns align with diff panel below */}
          <div className="revision-input-row">
            <label className="editor-field">
              <span>校改目标</span>
              <textarea
                className="modal-textarea modal-textarea-compact"
                value={revisionRequirement}
                onChange={(event) => setRevisionRequirement(event.target.value)}
                placeholder="增强画面、收紧节奏、修正重复。"
              />
            </label>
            <div className={'revision-input-row-right' + (revisionError ? ' is-error' : '')}>
              <label className="editor-field" style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%' }}>
                <span>校改建议</span>
                <section className={'revision-summary-line'}>
                  <strong>{revisionError || revisionSummaryText || revisionNotice || '待生成校改稿。'}</strong>
                </section>
              </label>
            </div>
          </div>
          <div className="revision-editor-meta">
            <span>原文 {formatExactWordCount(originalWordCount)}</span>
            <span>校改稿 {formatExactWordCount(draftWordCount)}</span>
            <span>建议 {revisionChangeItems.length} 条</span>
            <span>{generationState.metaText}</span>
          </div>
        </div>

        <nav className="revision-mobile-tabs" aria-label="校改视图">
          <button type="button" className={mobileView === 'original' ? 'is-active' : ''} onClick={() => setMobileView('original')}>原文</button>
          <button type="button" className={mobileView === 'suggestions' ? 'is-active' : ''} onClick={() => setMobileView('suggestions')}>建议 <em>{suggestionItems.length}</em></button>
          <button type="button" className={mobileView === 'draft' ? 'is-active' : ''} onClick={() => setMobileView('draft')}>校改稿</button>
        </nav>

        <div
          ref={mobileScrollRef}
          className={'revision-review-layout is-mobile-' + mobileView}
          onTouchStart={handleMobileTouchStart}
          onTouchMove={handleMobileTouchMove}
          onPointerDown={handleMobilePointerDown}
          onPointerMove={handleMobilePointerMove}
          onPointerUp={stopMobilePointerDrag}
          onPointerCancel={stopMobilePointerDrag}
        >
          <section className="revision-draft-panel">
            <div className="revision-mobile-pane-head"><strong>校改稿</strong><span>{formatExactWordCount(draftWordCount)}</span><button type="button" onClick={() => setMobileEditing((current) => !current)}>{mobileEditing ? '完成' : '编辑'}</button></div>
            {!mobileEditing ? <div className={mobileChangedRows.length ? 'revision-mobile-locator' : 'revision-mobile-locator is-empty'}>
              {mobileChangedRows.length ? <>
                <button type="button" onClick={() => focusMobileChange(mobileChangeIndex - 1)} aria-label="上一处修改">‹</button>
                <label><span>修改 {mobileChangeIndex + 1} / {mobileChangedRows.length}</span><select value={activeMobileChange?.key || ''} onChange={(event) => focusMobileChange(mobileChangedRows.findIndex((row) => row.key === event.target.value))} aria-label="快速定位校改段落">{mobileChangedRows.map((row, index) => <option key={row.key} value={row.key}>{mobileChangeLabel(row, index)}</option>)}</select></label>
                <button type="button" onClick={() => focusMobileChange(mobileChangeIndex + 1)} aria-label="下一处修改">›</button>
              </> : <span>尚无修改，应用建议后可快速定位</span>}
            </div> : null}
            <textarea ref={draftTextareaRef} className="modal-textarea modal-textarea-revision" value={revisionDraft} onChange={(event) => setRevisionDraft(event.target.value)} aria-label="校改稿正文" />
            {!mobileEditing ? <div className="revision-mobile-prose-reader" aria-label="手机端校改稿正文预览">{revisionDiffRows.map((row) => {
              const suggestion = row.suggestion;
              const key = suggestion ? findSuggestionKey(suggestion) : '';
              const canUndo = Boolean(suggestion && revisionAppliedChangeKeys.includes(key));
              return <article ref={(element) => { if (element) mobileChangeRefs.current.set(row.key, element); else mobileChangeRefs.current.delete(row.key); }} className={'revision-mobile-draft-row is-' + row.type + (activeMobileChange?.key === row.key && row.type !== 'same' ? ' is-locator-current' : '')} key={row.key}>
                {row.type !== 'same' ? <div className="revision-mobile-change-head"><span>{row.label}</span>{canUndo ? <button type="button" onClick={() => onUndoRevisionSuggestion(suggestion, key)}>撤回</button> : <em>手动修改</em>}</div> : null}
                {row.type === 'delete' ? <p className="is-deleted">{row.before}</p> : <p>{row.after || row.before}</p>}
              </article>;
            })}</div> : <div
              ref={mobileDraftRef}
              className="revision-mobile-prose-editor"
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label="手机端校改稿正文"
              onInput={(event) => setRevisionDraft(event.currentTarget.innerText)}
            />}
          </section>

          <section className={suggestionItems.length ? 'revision-mobile-suggestions' : 'revision-mobile-suggestions is-empty'}>
            <div className="revision-mobile-pane-head revision-mobile-suggestion-head">
              <div className="revision-mobile-suggestion-summary">
                <strong>校改建议</strong>
                <span>{suggestionItems.length ? `${pendingSuggestionItems.length} 待应用 · ${appliedSuggestionItems.length} 已应用` : '尚未生成'}</span>
              </div>
              {suggestionItems.length ? <div className="revision-mobile-bulk-actions">
                {appliedSuggestionItems.length ? <button className="is-undo" type="button" onClick={undoAllSuggestions}>撤回全部</button> : null}
                {pendingSuggestionItems.length ? <button type="button" onClick={applyAllSuggestions}>应用全部</button> : null}
              </div> : null}
            </div>
            <div className="revision-mobile-suggestion-list">
              {suggestionItems.map((suggestion, index) => {
                const key = suggestionKey(suggestion, index);
                const applied = revisionAppliedChangeKeys.includes(key);
                return <article className="revision-mobile-suggestion-card" key={key}>
                  <div><span>{suggestionLabel(suggestion)} · 第 {suggestion.paragraph || suggestion.afterParagraph || '?'} 段</span>{suggestion.category ? <em>{suggestion.category}</em> : null}</div>
                  {suggestion.original_text ? <p className="is-original">{suggestion.original_text}</p> : null}
                  {suggestion.suggested_text ? <p className="is-new">{suggestion.suggested_text}</p> : null}
                  {suggestion.reason ? <small>{suggestion.reason}</small> : null}
                  <button type="button" onClick={() => applied ? onUndoRevisionSuggestion(suggestion, key) : applySuggestion(suggestion, key)}>{applied ? '撤回此建议' : '应用此建议'}</button>
                </article>;
              })}
              {!suggestionItems.length ? <div className="revision-mobile-empty">点击“生成校改建议”开始分析。</div> : null}
            </div>
          </section>

          <section className="revision-diff-panel-main revision-original-compare">
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
