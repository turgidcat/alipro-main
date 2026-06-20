import { cn } from '../../../lib/utils.js';
import MetaCode from './MetaCode.jsx';

export default function WorkbenchSection({
  code,
  title,
  description,
  actions,
  children,
  className,
  contentClassName
}) {
  return (
    <section
      className={cn(
        'grid gap-3 border-l border-[color:color-mix(in_srgb,var(--brand-soft-strong)_56%,var(--line))] border-t border-[color:color-mix(in_srgb,var(--line)_54%,transparent)] pl-3 pt-3',
        className
      )}
    >
      <header className="grid gap-1.5">
        {code ? <MetaCode>{code}</MetaCode> : null}
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <h2 className="text-[14px] font-semibold leading-5 text-[color:var(--text)]">{title}</h2>
            {description ? (
              <p className="max-w-[40ch] text-[12px] leading-5 text-[color:var(--muted)]">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </header>
      <div className={cn('grid gap-3', contentClassName)}>{children}</div>
    </section>
  );
}
