const insetTitleClass = 'font-serif text-[13px] font-semibold tracking-[0.04em] text-[color:var(--brand-deep)]';

export default function BlockedConstraints({ generationConstraints }) {
  const blocked = Array.isArray(generationConstraints?.blocked) ? generationConstraints.blocked : [];
  if (blocked.length === 0) return null;

  return (
    <section className="space-y-4 border-b border-[color:color-mix(in_srgb,var(--line)_68%,transparent)] pb-5">
      <div className="grid gap-3 border-l-2 border-[color:color-mix(in_srgb,var(--status-warning-border)_78%,transparent)] pl-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-5">
        <p className={insetTitleClass}>系统约束预览</p>
        <p className="text-[12px] leading-5 text-[color:var(--muted)]">
          这些限制会默认参与本章生成，用来避免空降设定或偏离当前主线。这里只做预览，不提供手动开关。
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {blocked.map((group, groupIndex) => (
          <div
            key={`${group.label}-${groupIndex}`}
            className="min-w-0 rounded-[16px] border border-[color:color-mix(in_srgb,var(--line)_68%,transparent)] bg-[color:rgba(255,252,246,0.42)] px-3 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 truncate whitespace-nowrap text-[13px] font-semibold leading-6 text-[color:var(--text)]">{group.label}</p>
              <span className="inline-flex min-h-7 items-center rounded-full border border-[color:var(--line)] bg-[color:rgba(255,252,246,0.82)] px-3 text-[11px] font-bold text-[color:var(--brand-deep)]">
                系统默认避免
              </span>
            </div>
            {group.rule ? (
              <p className="mt-2 text-[13px] leading-6 text-[color:var(--muted)]">{group.rule}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
