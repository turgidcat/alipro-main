function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

const VARIANT_CLASSES = {
  flat: 'mb-8 border-0 bg-transparent shadow-none last:mb-0',
  card: 'rounded-[26px] border border-[color:color-mix(in_srgb,var(--line)_82%,white)] bg-[color:rgba(255,252,246,0.92)] shadow-[0_18px_36px_rgba(77,60,39,0.06)]'
};

export default function PanelCard({
  eyebrow,
  title,
  description,
  children,
  actions,
  headerActions,
  className = '',
  bodyClassName = '',
  actionsClassName = '',
  variant = 'card'
}) {
  const isFlat = variant === 'flat';
  const showFlatEyebrowAsTitle = isFlat && eyebrow;

  return (
    <section
      className={joinClasses(
        'overflow-hidden text-[color:var(--text)]',
        VARIANT_CLASSES[variant] || VARIANT_CLASSES.card,
        className
      )}
    >
      {eyebrow || title || description || headerActions ? (
        <div
          className={joinClasses(
            'flex flex-col gap-4',
            isFlat
              ? 'border-b border-[color:color-mix(in_srgb,var(--line)_70%,transparent)] pb-4'
              : 'border-b border-[color:color-mix(in_srgb,var(--line)_72%,transparent)] px-6 pb-4 pt-5 sm:px-7'
          )}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              {eyebrow ? (
                showFlatEyebrowAsTitle ? (
                  <h3 className="font-serif text-[1.9rem] font-semibold leading-[1.08] tracking-[-0.03em] text-[color:var(--text)]">
                    {eyebrow}
                  </h3>
                ) : (
                  <span
                    className={joinClasses(
                      'inline-flex w-fit font-mono text-[11px] font-bold tracking-[0.12em]',
                      isFlat
                        ? 'text-[color:var(--muted)]'
                        : 'rounded-full border border-[color:var(--line)] bg-[color:rgba(243,237,225,0.72)] px-3 py-1 text-[color:var(--brand-deep)]'
                    )}
                  >
                    {eyebrow}
                  </span>
                )
              ) : null}
              {title && !showFlatEyebrowAsTitle ? (
                <h3 className={joinClasses(
                  'font-serif font-semibold leading-[1.08] tracking-[-0.03em] text-[color:var(--text)]',
                  isFlat ? 'text-[1.9rem]' : 'text-[1.75rem]'
                )}>
                  {title}
                </h3>
              ) : null}
              {description ? (
                <p className={joinClasses(
                  'max-w-[56ch] text-[color:var(--muted)]',
                  isFlat ? 'text-[14px] leading-7' : 'text-[15px] leading-7'
                )}>
                  {description}
                </p>
              ) : null}
            </div>
            {headerActions ? <div className="flex flex-wrap items-center gap-3">{headerActions}</div> : null}
          </div>
        </div>
      ) : null}
      <div className={joinClasses(isFlat ? 'space-y-5 py-5' : 'space-y-5 px-6 py-5 sm:px-7', bodyClassName)}>{children}</div>
      {actions ? (
        <div
          className={joinClasses(
            isFlat
              ? 'mt-1 flex flex-wrap items-center gap-3 border-b border-[color:color-mix(in_srgb,var(--line)_70%,transparent)] pb-4'
              : 'flex flex-wrap items-center gap-3 border-t border-[color:color-mix(in_srgb,var(--line)_72%,transparent)] px-6 py-4 sm:px-7',
            actionsClassName
          )}
        >
          {actions}
        </div>
      ) : null}
    </section>
  );
}
