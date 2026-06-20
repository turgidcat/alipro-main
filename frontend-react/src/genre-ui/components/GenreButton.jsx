import { getGenreCssVars } from '../utils/resolveGenreTheme.js';
import { resolveGenreGrammar } from '../utils/resolveGenreGrammar.js';

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

const sizeClassMap = {
  sm: 'min-h-9 px-3.5 text-sm',
  md: 'min-h-11 px-4.5 text-sm',
  lg: 'min-h-12 px-5 text-base'
};

const variantClassMap = {
  primary: joinClasses(
    'border-[var(--genre-primary)] bg-[var(--genre-primary)] text-white',
    'shadow-[0_10px_24px_color-mix(in_srgb,var(--genre-primary)_24%,transparent)]',
    'hover:brightness-105'
  ),
  secondary: joinClasses(
    'border-[var(--genre-secondary)] bg-[var(--genre-panel)] text-[var(--genre-secondary)]',
    'hover:bg-[color:color-mix(in_srgb,var(--genre-panel)_82%,white)]'
  ),
  ghost: joinClasses(
    'border-[var(--genre-line)] bg-transparent text-[var(--genre-primary)]',
    'hover:border-[var(--genre-primary)] hover:bg-[color:color-mix(in_srgb,var(--genre-primary)_8%,transparent)]'
  )
};

export default function GenreButton({
  genre = 'lightnovel',
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  type = 'button',
  ...buttonProps
}) {
  const grammar = resolveGenreGrammar(genre);

  return (
    <button
      type={type}
      style={{
        ...getGenreCssVars(genre),
        borderRadius: grammar.shape.buttonRadius,
        borderWidth: grammar.shape.borderWidth,
        boxShadow: variant === 'primary' ? grammar.surface.glow : 'none',
        '--genre-hover-lift': grammar.interaction.hoverLift,
        '--genre-hover-glow': grammar.interaction.hoverGlow,
        '--genre-hover-border': grammar.interaction.hoverBorder,
        '--genre-active-ring': grammar.interaction.activeRing
      }}
      className={joinClasses(
        'inline-flex items-center justify-center border font-semibold tracking-[0.01em] transition duration-150',
        'hover:translate-y-[var(--genre-hover-lift)] hover:shadow-[var(--genre-hover-glow)] hover:border-[color:var(--genre-hover-border)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--genre-active-ring)] focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        sizeClassMap[size] || sizeClassMap.md,
        variantClassMap[variant] || variantClassMap.primary,
        className
      )}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
