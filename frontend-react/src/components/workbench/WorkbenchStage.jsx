import ChapterConfigPanel from './ChapterConfigPanel.jsx';
import ContentWorkspace from './ContentWorkspace.jsx';

export default function WorkbenchStage({ planningState, chapterConfigProps, contentWorkspaceProps }) {
  return (
    <section className="mx-auto mb-[var(--page-shell-pad-bottom)] mt-8 w-[min(var(--layout-max-width),calc(100%-2.5rem))]">
      <div className="grid gap-12 xl:grid-cols-[minmax(360px,0.82fr)_minmax(0,1.18fr)] xl:gap-16">
        <div className="min-w-0 xl:sticky xl:top-[7.25rem] xl:self-start">
          <ChapterConfigPanel {...chapterConfigProps} />
        </div>

        <div className="min-w-0">
          <ContentWorkspace {...contentWorkspaceProps} />
        </div>
      </div>
    </section>
  );
}
