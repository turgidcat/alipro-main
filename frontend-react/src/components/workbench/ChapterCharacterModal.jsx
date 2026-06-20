import Modal from './Modal.jsx';

export default function ChapterCharacterModal({
  open,
  chapterNumber,
  savingState,
  draftChapterPlan,
  describeRoleExecutionMeta,
  onClose,
  onSave,
  onChangePlanField
}) {
  if (!open) return null;

  return (
    <Modal
      title={'编辑第 ' + chapterNumber + ' 章角色'}
      description="只写这一章真正会出场、会影响推进的人物。"
      onClose={onClose}
      closeOnBackdrop={false}
      actions={
        <>
          {savingState.error ? <div className="modal-error">{savingState.error}</div> : null}
          <button type="button" className="ghost-btn" onClick={onClose}>取消</button>
          <button type="button" className="solid-btn" onClick={onSave} disabled={savingState.loading}>
            {savingState.loading ? '正在保存...' : '保存本章角色'}
          </button>
        </>
      }
    >
      <div className="outline-preview-stack">
        <textarea
          className="modal-textarea"
          value={draftChapterPlan.character_notes}
          onChange={(event) => onChangePlanField('character_notes', event.target.value)}
          placeholder="例如：主角当前状态、关键配角立场、新增人物的作用。"
        />
        <section className="outline-preview-block editor-field-full">
          <span>章节角色执行层（v2）</span>
          <pre className="modal-pre">
            {Array.isArray(draftChapterPlan.role_execution) && draftChapterPlan.role_execution.length > 0
              ? draftChapterPlan.role_execution.map((item) => [
                `角色：${item.role || '未命名角色'}`,
                `当前底色：${item.baseline || '未填写'}`,
                `本章功能：${item.chapter_function || '未填写'}`,
                `参数层：${describeRoleExecutionMeta(item)}`,
                `允许变化：${item.allowed_change || '未填写'}`,
                `禁止变化：${item.forbidden_change || '未填写'}`
              ].join('\n')).join('\n\n')
              : '当前还没有角色执行拆解。系统会先按出场角色生成兜底版本，后续再接模型生成草稿。'}
          </pre>
        </section>
      </div>
    </Modal>
  );
}
