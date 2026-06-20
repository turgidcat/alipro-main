import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../../lib/utils.js';

const VARIANT_CLASSES = {
  default:
    'border border-transparent bg-primary text-primary-foreground hover:bg-[color:color-mix(in_srgb,var(--primary)_88%,black)]',
  secondary:
    'border border-border bg-muted text-foreground hover:bg-[color:color-mix(in_srgb,var(--muted-bg)_92%,var(--surface))]',
  outline:
    'border border-border bg-surface text-foreground hover:bg-muted hover:text-foreground',
  ghost:
    'border border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
  destructive:
    'border border-transparent bg-[color:#b91c1c] text-white hover:bg-[color:#991b1b]'
};

const SIZE_CLASSES = {
  default: 'h-10 px-4 py-2 text-[14px]',
  sm: 'h-9 rounded-[10px] px-3 text-[13px]',
  lg: 'h-11 rounded-[12px] px-5 text-[15px]',
  icon: 'h-10 w-10 px-0'
};

const Button = React.forwardRef(function Button(
  { className, variant = 'default', size = 'default', asChild = false, type = 'button', ...props },
  ref
) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[11px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-soft-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANT_CLASSES[variant] || VARIANT_CLASSES.default,
        SIZE_CLASSES[size] || SIZE_CLASSES.default,
        className
      )}
      {...props}
    />
  );
});

Button.displayName = 'Button';

export { Button };
