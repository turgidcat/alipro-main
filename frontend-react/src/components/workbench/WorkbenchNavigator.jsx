import ChapterConfigPanel from './ChapterConfigPanel.jsx';
import MetaCode from './MetaCode.jsx';
import WorkbenchSection from './WorkbenchSection.jsx';

export default function WorkbenchNavigator({ planningState, chapterConfigProps }) {
  const bookTitle = planningState?.currentBook?.title || '未选择书籍';
  const chapterNumber = chapterConfigProps?.chapterNumber || 1;
  const chapterName = String(chapterConfigProps?.draftChapterPlan?.chapter_name || '').trim() || '未命名章节';
  const volumeLabel = chapterConfigProps?.chapterView?.volumeLabel || '未设置分卷';
  const mainStoryline = chapterConfigProps?.chapterView?.mainStoryline || '暂未指定剧情线';
  const totalChapterCount = chapterConfigProps?.chapterContext?.totalChapterCount || '?';

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid gap-1 px-1">
        <MetaCode>NAVIGATOR</MetaCode>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-5 text-[color:var(--muted)]">
          <span className="font-serif text-[15px] font-semibold text-[color:var(--text)]">{bookTitle}</span>
          <span>/</span>
          <span>第 {chapterNumber} 章</span>
        </div>
      </div>

      <WorkbenchSection
        code="PROJECT"
        title={chapterName}
        description={volumeLabel}
      >
        <div className="grid gap-2 text-[13px] leading-6 text-[color:var(--muted)]">
          <div className="flex items-center justify-between gap-3">
            <span>当前章节</span>
            <span className="text-[color:var(--text)]">{chapterNumber} / {totalChapterCount}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>主推剧情线</span>
            <span className="text-[color:var(--brand-deep)]">{mainStoryline}</span>
          </div>
        </div>
      </WorkbenchSection>

      <WorkbenchSection
        code="CHAPTER CONFIG"
        title="章节配置"
        description="本轮只迁移外层壳，内部表单与保存逻辑保持原样。"
      >
        <div className="min-w-0 max-w-full overflow-x-hidden">
          <ChapterConfigPanel {...chapterConfigProps} />
        </div>
      </WorkbenchSection>
    </div>
  );
}
