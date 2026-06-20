import { getGenreCssVars } from '../utils/resolveGenreTheme.js';
import { resolveGenreGrammar } from '../utils/resolveGenreGrammar.js';

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

const variantClassMap = {
  soft: 'border-[var(--genre-line)] bg-[color:color-mix(in_srgb,var(--genre-panel)_82%,white)] text-[var(--genre-primary)]',
  outline: 'border-[var(--genre-primary)] bg-transparent text-[var(--genre-primary)]',
  solid: 'border-[var(--genre-primary)] bg-[var(--genre-primary)] text-white'
};

export default function GenreBadge({
  genre = 'lightnovel',
  variant = 'soft',
  children,
  className = ''
}) {
  const grammar = resolveGenreGrammar(genre);
  const edgeClassMap = {
    hud: 'uppercase tracking-[0.08em]',
    dossier: 'tracking-[0.05em]',
    soft: 'tracking-[0.01em]',
    airy: 'tracking-[0.03em]',
    glass: 'tracking-[0.04em]',
    heavy: 'tracking-[0.04em]'
  };

  return (
    <span
      style={{
        ...getGenreCssVars(genre),
        borderRadius: grammar.shape.badgeRadius,
        borderWidth: grammar.shape.borderWidth,
        backgroundImage: variant === 'soft' ? grammar.surface.overlay : 'none',
        boxShadow: variant === 'solid' ? grammar.surface.glow : 'none'
      }}
      className={joinClasses(
        'inline-flex min-h-7 items-center border px-3 py-1 text-[12px] font-semibold leading-none',
        variantClassMap[variant] || variantClassMap.soft,
        edgeClassMap[grammar.shape.edgeStyle] || edgeClassMap.soft,
        className
      )}
    >
      {children}
    </span>
  );
}
