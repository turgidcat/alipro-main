export default function WorkbenchShell({ navigator, main, inspector }) {
  return (
    <div className="h-full min-h-[calc(100vh-10.75rem)] w-full min-w-0 overflow-hidden border border-[color:var(--line)] bg-[color:color-mix(in_srgb,var(--surface)_94%,white)]">
      <div className="grid h-full w-full min-w-0 grid-cols-[300px_minmax(0,1fr)_340px] overflow-hidden">
        <aside className="h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden border-r border-[color:color-mix(in_srgb,var(--line)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--muted-bg)_72%,var(--surface))] px-3 py-4">
          {navigator}
        </aside>

        <main className="h-full min-h-0 min-w-0 w-full max-w-full overflow-y-auto overflow-x-hidden bg-[color:color-mix(in_srgb,var(--surface)_98%,white)] px-4 py-4">
          {main}
        </main>

        <aside className="h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden border-l border-[color:color-mix(in_srgb,var(--line)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--muted-bg)_66%,var(--surface))] px-3 py-4">
          {inspector}
        </aside>
      </div>
    </div>
  );
}
