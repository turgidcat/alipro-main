import Modal from './Modal.jsx';
import { getLatestChapterOutline, getOutlineSourceLabel } from '../../lib/chapterPlan.js';
import { normalizeChapterName } from '../../lib/chapterName.js';

export default function PromptPreviewModal({
  chapterNumber,
  open,
  onClose,
  generationReadiness,
  draftChapterPlan,
  chapterStructure,
  selectedMainStorylineLabel,
  selectedTargetStorylineLabel,
  storylineRhythmHints,
  describeRoleExecutionMeta,
  generationRiskReview
}) {
  if (!open) return null;

  const latestOutline = getLatestChapterOutline(draftChapterPlan);
  const outlineSourceLabel = getOutlineSourceLabel(draftChapterPlan.source);

  return (
    <Modal
      title={'第 ' + chapterNumber + ' 章生成摘要'}
      description="这里展示生成前会优先参考的核心上下文。"
      onClose={onClose}
      actions={<button type="button" className="solid-btn" onClick={onClose}>知道了</button>}
    >
      <div className="outline-preview-stack prompt-preview-stack">
        <section className={'inline-status-banner is-' + generationReadiness.kind}>
          <strong>{generationReadiness.title}</strong>
          <span>{generationReadiness.text}</span>
        </section>
        <section className="outline-preview-block">
          <span>当前章节细纲</span>
          <pre className="modal-pre">
            {[
              '章名：' + (normalizeChapterName(draftChapterPlan.chapter_name) || '未命名章节'),
              '来源：' + outlineSourceLabel,
              '',
              latestOutline || '暂无填写章节细纲。'
            ].join('\n')}
          </pre>
        </section>
        <section className="outline-preview-block">
          <span>叙事脉络承接</span>
          <pre className="modal-pre">
            {[
              '当前卷主线：' + selectedMainStorylineLabel,
              '关联脉络：' + selectedTargetStorylineLabel,
              '节奏提示：' + (storylineRhythmHints.length > 0 ? storylineRhythmHints.map((hint) => '- ' + hint.text).join(' | ') : '暂无挂接叙事脉络')
            ].join('\n')}
          </pre>
        </section>
        <section className="outline-preview-block">
          <span>本章角色</span>
          <pre className="modal-pre">
            {[
              draftChapterPlan.character_notes || '暂无补充本章角色说明。',
              '',
              '本章角色速查：',
              Array.isArray(draftChapterPlan.role_execution) && draftChapterPlan.role_execution.length > 0
                ? draftChapterPlan.role_execution.map((item) => `- ${item.role || '未命名角色'}｜${describeRoleExecutionMeta(item)}`).join('\n')
                : '- 暂无角色资料'
            ].join('\n')}
          </pre>
        </section>
        <section className="outline-preview-block">
          <span>高风险提醒</span>
          <pre className="modal-pre">
            {generationRiskReview.items.length > 0
              ? generationRiskReview.items.map((item) => `- [${item.level === 'critical' ? '高风险' : '提醒'}] ${item.title}：${item.text}`).join('\n')
              : '当前没有额外高风险提醒。'}
          </pre>
        </section>
      </div>
    </Modal>
  );
}
