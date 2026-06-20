import WorkbenchShell from './WorkbenchShell.jsx';
import WorkbenchNavigator from './WorkbenchNavigator.jsx';
import WorkbenchInspector from './WorkbenchInspector.jsx';
import ContentWorkspace from './ContentWorkspace.jsx';

export default function WorkbenchStage({ planningState, chapterConfigProps, contentWorkspaceProps }) {
  return (
    <section className="mx-auto mb-[var(--page-shell-pad-bottom)] mt-6 w-[min(var(--layout-max-width),calc(100%-2.5rem))] min-w-0 overflow-hidden">
      <WorkbenchShell
        navigator={
          <WorkbenchNavigator
            planningState={planningState}
            chapterConfigProps={chapterConfigProps}
          />
        }
        main={
          <div className="h-full min-h-0 min-w-0 max-w-full overflow-y-auto overflow-x-hidden">
            <ContentWorkspace {...contentWorkspaceProps} />
          </div>
        }
        inspector={
          <WorkbenchInspector
            planningState={planningState}
            chapterConfigProps={chapterConfigProps}
            contentWorkspaceProps={contentWorkspaceProps}
          />
        }
      />
    </section>
  );
}
