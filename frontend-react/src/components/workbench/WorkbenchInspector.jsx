import MetaCode from './MetaCode.jsx';
import WorkbenchSection from './WorkbenchSection.jsx';

function normalizeText(value, fallback = '当前暂无内容') {
  const text = String(value || '').trim();
  return text || fallback;
}

function toParagraphs(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export default function WorkbenchInspector({ planningState, chapterConfigProps, contentWorkspaceProps }) {
  const bookTitle = planningState?.currentBook?.title || '未选择书籍';
  const chapterNumber = chapterConfigProps?.chapterNumber || 1;
  const chapterName = normalizeText(chapterConfigProps?.draftChapterPlan?.chapter_name, '未命名章节');
  const mainStoryline = normalizeText(chapterConfigProps?.chapterView?.mainStoryline, '暂未指定剧情线');
  const characterNotes = normalizeText(chapterConfigProps?.draftChapterPlan?.character_notes, '当前还没有角色说明。');
  const roleExecution = Array.isArray(chapterConfigProps?.draftChapterPlan?.role_execution)
    ? chapterConfigProps.draftChapterPlan.role_execution.slice(0, 3)
    : [];
  const feedbackSummary = normalizeText(
    contentWorkspaceProps?.generationState?.feedbackSummary,
    '当前还没有生成后的章节反馈，Inspector 先保留结构壳。'
  );
  const feedbackFocus = normalizeText(
    contentWorkspaceProps?.generationState?.feedbackFocus,
    '下一章准备材料将在生成与反馈链路稳定后继续细化。'
  );
  const readinessText = normalizeText(
    contentWorkspaceProps?.generationReadiness?.text,
    '当前未提供额外上下文提示。'
  );
  const roleExecutionSummary = roleExecution.length
    ? roleExecution.map((item) => ({
        title: normalizeText(item?.role, '未命名角色'),
        note: normalizeText(item?.goal || item?.forbidden_change || item?.note, '当前没有额外执行说明。')
      }))
    : [];

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid gap-1 px-1">
        <MetaCode>INSPECTOR</MetaCode>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-5 text-[color:var(--muted)]">
          <span className="font-serif text-[15px] font-semibold text-[color:var(--text)]">{bookTitle}</span>
          <span>/</span>
          <span>{chapterName}</span>
        </div>
      </div>

      <WorkbenchSection code="CHAPTER" title="章节基础信息">
        <div className="grid gap-2 text-[13px] leading-6 text-[color:var(--muted)]">
          <div className="flex items-center justify-between gap-3">
            <span>当前章节</span>
            <span className="text-[color:var(--text)]">第 {chapterNumber} 章</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>主推剧情线</span>
            <span className="text-[color:var(--brand-deep)]">{mainStoryline}</span>
          </div>
        </div>
      </WorkbenchSection>

      <WorkbenchSection code="FEEDBACK" title="章节反馈" description="只读展示现有反馈摘要，不改变保存逻辑。">
        <div className="grid gap-2">
          {toParagraphs(feedbackSummary).map((item, index) => (
            <p key={index} className="text-[13px] leading-6 text-[color:var(--text)]">{item}</p>
          ))}
        </div>
      </WorkbenchSection>

      <WorkbenchSection code="ROLE EXECUTION" title="角色执行" description="本轮只读展示已有角色执行摘要。">
        {roleExecutionSummary.length > 0 ? (
          <div className="grid gap-3">
            {roleExecutionSummary.map((item) => (
              <div key={item.title} className="grid gap-1 border-b border-[color:color-mix(in_srgb,var(--line)_54%,transparent)] pb-2.5 last:border-b-0 last:pb-0">
                <strong className="text-[13px] leading-5 text-[color:var(--text)]">{item.title}</strong>
                <p className="text-[12px] leading-5 text-[color:var(--muted)]">{item.note}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] leading-5 text-[color:var(--muted)]">当前暂无角色执行摘要，保留 Inspector 壳位。</p>
        )}
      </WorkbenchSection>

      <WorkbenchSection code="CONTEXT" title="上下文" description="从现有生成准备状态中只读提取。">
        <p className="text-[12px] leading-5 text-[color:var(--muted)]">{readinessText}</p>
      </WorkbenchSection>

      <WorkbenchSection code="NEXT CHAPTER" title="下一章准备材料">
        <div className="grid gap-2">
          {toParagraphs(feedbackFocus).map((item, index) => (
            <p key={index} className="text-[13px] leading-6 text-[color:var(--text)]">{item}</p>
          ))}
          <p className="text-[12px] leading-5 text-[color:var(--muted)]">{characterNotes}</p>
        </div>
      </WorkbenchSection>
    </div>
  );
}
