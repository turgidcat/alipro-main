import Modal from './Modal.jsx';

export default function StorylineEditorModal({
  open,
  draftStoryline,
  savingState,
  onClose,
  onSave,
  onChangeField
}) {
  if (!open) return null;

  return (
    <Modal
      title={draftStoryline.id ? '编辑剧情线' : '新建剧情线'}
      description={draftStoryline.id
        ? '调整这条剧情线的预计节奏和核心冲突。章节范围只作参考，不会强制限制使用。'
        : '先创建这本书的一条主线或支线，然后自动挂到当前章节。章节范围只作节奏参考，不会强制限制剧情线使用。'}
      onClose={onClose}
      closeOnBackdrop={false}
      actions={
        <>
          {savingState.error ? <div className="modal-error">{savingState.error}</div> : null}
          <button type="button" className="ghost-btn" onClick={onClose}>取消</button>
          <button type="button" className="solid-btn" onClick={onSave} disabled={savingState.loading}>
            {savingState.loading
              ? '正在保存...'
              : draftStoryline.id ? '保存剧情线' : '创建并挂到当前章节'}
          </button>
        </>
      }
    >
      <div className="storyline-editor-grid">
        <label className="editor-field editor-field-full">
          <span>剧情线名称</span>
          <input
            className="chapter-number-input text-input"
            value={draftStoryline.storyline_name}
            onChange={(event) => onChangeField('storyline_name', event.target.value)}
            placeholder="例如：血月之力暴露线"
          />
        </label>
        <label className="editor-field">
          <span>剧情线类型</span>
          <select
            className="book-select storyline-select"
            value={draftStoryline.storyline_type}
            onChange={(event) => onChangeField('storyline_type', event.target.value)}
          >
            <option value="main">主线</option>
            <option value="branch">支线</option>
          </select>
        </label>
        <label className="editor-field">
          <span>所属卷号</span>
          <input
            className="chapter-number-input text-input"
            type="number"
            min="1"
            value={draftStoryline.volume_number}
            onChange={(event) => onChangeField('volume_number', Math.max(1, Number(event.target.value) || 1))}
          />
        </label>
        <label className="editor-field">
          <span>预计起始章</span>
          <input
            className="chapter-number-input text-input"
            type="number"
            min="1"
            value={draftStoryline.start_chapter}
            onChange={(event) => onChangeField('start_chapter', Math.max(1, Number(event.target.value) || 1))}
          />
        </label>
        <label className="editor-field">
          <span>预计结束章</span>
          <input
            className="chapter-number-input text-input"
            type="number"
            min="1"
            value={draftStoryline.end_chapter}
            onChange={(event) => onChangeField('end_chapter', Math.max(1, Number(event.target.value) || 1))}
          />
        </label>
        <label className="editor-field editor-field-full">
          <span>节奏说明</span>
          <p className="form-helper-text">
            这里填的是预计活跃范围。后续如果剧情提前爆发、延后回收或需要拆分，可以再调整，不会卡住正文生成。
          </p>
        </label>
        <label className="editor-field editor-field-full">
          <span>核心冲突</span>
          <textarea
            className="modal-textarea modal-textarea-compact"
            value={draftStoryline.core_conflict}
            onChange={(event) => onChangeField('core_conflict', event.target.value)}
            placeholder="例如：主角越想隐藏力量，越会被逼在救人时暴露。"
          />
        </label>
        <label className="editor-field editor-field-full">
          <span>简要说明</span>
          <textarea
            className="modal-textarea modal-textarea-compact"
            value={draftStoryline.description}
            onChange={(event) => onChangeField('description', event.target.value)}
            placeholder="这条线主要推进什么、牵涉哪些人物、最后落到什么结果。"
          />
        </label>
      </div>
    </Modal>
  );
}
