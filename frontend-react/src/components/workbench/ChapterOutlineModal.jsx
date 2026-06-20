import Modal from './Modal.jsx';
import {
  getLatestChapterOutline,
  getOutlineSourceLabel
} from '../../lib/chapterPlan.js';

function countOutlineParagraphs(text) {
  return String(text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

export default function ChapterOutlineModal({
  open,
  chapterNumber,
  savingState,
  draftChapterPlan,
  onClose,
  onSave,
  onGenerate,
  onChangePlanField
}) {
  if (!open) return null;

  const latestOutline = getLatestChapterOutline(draftChapterPlan);
  const sourceLabel = getOutlineSourceLabel(draftChapterPlan.source);
  const paragraphCount = countOutlineParagraphs(latestOutline);

  return (
    <Modal
      title={'编辑第 ' + chapterNumber + ' 章章节细纲'}
      description="这里只保留最新一份章节细纲。系统生成和手动保存都会覆盖当前版本。"
      onClose={onClose}
      closeOnBackdrop={false}
      actions={
        <>
          {savingState.error ? <div className="modal-error">{savingState.error}</div> : null}
          <button type="button" className="ghost-btn" onClick={onGenerate} disabled={savingState.loading}>
            {savingState.loading ? '处理中...' : '系统生成'}
          </button>
          <button type="button" className="ghost-btn" onClick={onClose} disabled={savingState.loading}>取消</button>
          <button type="button" className="solid-btn" onClick={onSave} disabled={savingState.loading}>
            {savingState.loading ? '处理中...' : '保存细纲'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-[color:color-mix(in_srgb,var(--line)_72%,transparent)] bg-[color:rgba(255,252,246,0.58)] px-3 py-1 text-[12px] font-semibold text-[color:var(--brand-deep)]">
            当前来源：{sourceLabel}
          </span>
          <span className="inline-flex rounded-full border border-[color:color-mix(in_srgb,var(--line)_72%,transparent)] bg-[color:rgba(255,252,246,0.58)] px-3 py-1 text-[12px] font-semibold text-[color:var(--brand-deep)]">
            {latestOutline ? `${latestOutline.length} 字 / ${Math.max(paragraphCount, 1)} 段` : '尚未填写'}
          </span>
        </div>

        <label className="editor-field editor-field-full">
          <span>章节细纲</span>
          <textarea
            className="modal-textarea min-h-[320px]"
            value={draftChapterPlan.outline_text || latestOutline}
            onChange={(event) => onChangePlanField('outline_text', event.target.value)}
            placeholder="直接写成连贯叙事：这一章从哪里起，如何推进，冲突怎么抬高，结尾把读者钩在哪。这里保存的就是当前正式细纲。"
          />
        </label>
      </div>
    </Modal>
  );
}
