import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function VolumeDeleteDialog({ state, onClose, onRetry, onConfirm, onManageChapters }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, []);
  const { preview, loading, deleting, error } = state;
  return createPortal(
    <dialog ref={dialogRef} className="modal-panel volume-delete-dialog" aria-labelledby="volume-delete-title"
      onCancel={(event) => { event.preventDefault(); if (!deleting) onClose(); }}>
      <div className="modal-head"><h2 id="volume-delete-title">删除第 {state.volumeNumber} 卷 · {preview?.volumeName || state.volumeName}</h2></div>
      <div className="modal-body" aria-busy={loading || deleting}>
        {loading ? <p role="status">正在核对关联内容…</p> : null}
        {preview ? <>
          <p>将删除本卷规划、分卷设定，以及 {preview.storylineCount} 条剧情线、{preview.timelineCount} 条时间线。</p>
          <p>{preview.laterVolumeCount > 0 ? '后续 ' + preview.laterVolumeCount + ' 卷的卷号将前移，关联章节随所属卷一起调整，章节编号和正文保留。' : '这是最后一卷，不需要调整其他卷号。'}</p>
          {preview.blockedReason ? <p className="global-banner is-error" role="alert">{preview.blockedReason}</p> : <p>删除后无法在页面撤销，请确认以上范围。</p>}
        </> : null}
        {error ? <p className="global-banner is-error" role="alert">{error}</p> : null}
      </div>
      <div className="modal-actions">
        <button type="button" className="ghost-btn" autoFocus onClick={onClose} disabled={deleting}>取消</button>
        {!loading && !deleting && (error || preview?.blockedReason) ? <button type="button" className="ghost-btn" onClick={onRetry}>重新检查</button> : null}
        {preview?.blockedReason && onManageChapters ? <button type="button" className="solid-btn" onClick={onManageChapters} disabled={loading || deleting}>去处理章节</button> : null}
        <button type="button" className="solid-btn volume-delete-danger" onClick={onConfirm} disabled={loading || deleting || !preview?.canDelete || Boolean(error)}>{deleting ? '删除中…' : '确认删除本卷'}</button>
      </div>
    </dialog>, document.body
  );
}
