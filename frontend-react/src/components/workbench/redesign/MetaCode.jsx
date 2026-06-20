import { cn } from '../../../lib/utils.js';

export default function MetaCode({ children, className }) {
  return (
    <span
      className={cn(
        'block font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--brand-deep)]',
        className
      )}
    >
      {children}
    </span>
  );
}
