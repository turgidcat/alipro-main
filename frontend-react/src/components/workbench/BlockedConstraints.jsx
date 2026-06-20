const insetTitleClass = 'font-serif text-[13px] font-semibold tracking-[0.04em] text-[color:var(--brand-deep)]';

export default function BlockedConstraints({ generationConstraints, constraintOverrides, setConstraintOverride }) {
  const blocked = Array.isArray(generationConstraints?.blocked) ? generationConstraints.blocked : [];
  if (blocked.length === 0) return null;

  return (
    <section className="space-y-4 border-b border-[color:color-mix(in_srgb,var(--line)_68%,transparent)] pb-5">
      <div className="grid gap-3 border-l-2 border-[color:color-mix(in_srgb,var(--status-warning-border)_78%,transparent)] pl-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-5">
        <p className={insetTitleClass}>默认锁定项</p>
        <p className="text-[12px] leading-5 text-[color:var(--muted)]">
          这组默认先锁住，避免空降设定或偏离本章核心，需要时再手动放开。
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {blocked.map((group, groupIndex) => {
          const key = `blocked-${group.label}-${groupIndex}`;
          const currentValue = constraintOverrides[key] || 'ban';

          return (
            <div
              key={`${group.label}-${groupIndex}`}
              className="flex min-w-0 items-center justify-between gap-3 rounded-[16px] border border-[color:color-mix(in_srgb,var(--line)_68%,transparent)] bg-[color:rgba(255,252,246,0.42)] px-3 py-3"
            >
              <p className="min-w-0 truncate whitespace-nowrap text-[13px] font-semibold leading-6 text-[color:var(--text)]">{group.label}</p>
              <div className="inline-flex shrink-0 rounded-full border border-[color:var(--line)] bg-[color:rgba(255,252,246,0.82)] p-1">
                {[
                  { value: 'ban', label: '禁止' },
                  { value: 'allow', label: '放开' }
                ].map((option) => {
                  const active = currentValue === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={
                        'inline-flex min-h-7 min-w-14 items-center justify-center rounded-full px-3 text-[11px] font-bold transition ' +
                        (active
                          ? 'bg-[var(--brand)] text-[var(--btn-solid-text)] shadow-[var(--btn-nav-primary-shadow)]'
                          : 'bg-transparent text-[color:var(--muted)] hover:bg-[var(--brand-soft)] hover:text-[color:var(--brand)]')
                      }
                      onClick={() => setConstraintOverride(key, option.value)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
