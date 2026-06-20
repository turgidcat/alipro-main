import { getGenreCssVars } from '../utils/resolveGenreTheme.js';
import { resolveGenreGrammar } from '../utils/resolveGenreGrammar.js';

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

export default function GenreCard({
  genre = 'lightnovel',
  title,
  description,
  children,
  className = '',
  headerRight
}) {
  const genreVars = getGenreCssVars(genre);
  const grammar = resolveGenreGrammar(genre);
  const edgeClassMap = {
    heavy: 'before:absolute before:inset-y-0 before:left-0 before:w-[6px]',
    airy: 'before:absolute before:inset-x-10 before:top-0 before:h-[2px]',
    glass: 'before:absolute before:inset-x-0 before:top-0 before:h-[1px]',
    dossier: 'before:absolute before:inset-y-4 before:left-0 before:w-[3px]',
    hud: 'before:absolute before:inset-x-0 before:top-0 before:h-[2px]',
    soft: 'before:absolute before:inset-x-8 before:top-0 before:h-[3px]'
  };

  return (
    <article
      style={{
        ...genreVars,
        background: [grammar.ornament.pattern, grammar.surface.cardGradient].join(', '),
        boxShadow: grammar.surface.shadow,
        borderRadius: grammar.shape.cardRadius,
        borderWidth: grammar.shape.borderWidth,
        '--genre-hover-lift': grammar.interaction.hoverLift,
        '--genre-hover-glow': grammar.interaction.hoverGlow,
        '--genre-hover-border': grammar.interaction.hoverBorder,
        '--genre-accent-bar': grammar.ornament.accentBar,
        '--genre-divider': grammar.ornament.divider
      }}
      className={joinClasses(
        'relative overflow-hidden border border-[var(--genre-line)] p-5 text-[var(--genre-text)] transition duration-150',
        'hover:translate-y-[var(--genre-hover-lift)] hover:shadow-[var(--genre-hover-glow)] hover:border-[color:var(--genre-hover-border)]',
        'before:content-[\'\'] before:pointer-events-none before:bg-[image:var(--genre-accent-bar)]',
        edgeClassMap[grammar.shape.edgeStyle] || edgeClassMap.soft,
        className
      )}
    >
      {(title || description || headerRight) ? (
        <header className="relative mb-4 flex items-start justify-between gap-4 border-b pb-4" style={{ borderImage: 'var(--genre-divider) 1' }}>
          <div className="min-w-0 space-y-2">
            {title ? (
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-[var(--genre-text)]">
                {title}
              </h3>
            ) : null}
            {description ? (
              <p className="text-sm leading-6 text-[var(--genre-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
        </header>
      ) : null}
      <div className="space-y-3">{children}</div>
    </article>
  );
}
