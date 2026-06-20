import { getGenreCssVars } from '../utils/resolveGenreTheme.js';
import { resolveGenreGrammar } from '../utils/resolveGenreGrammar.js';

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

export default function GenrePanel({
  genre = 'lightnovel',
  title,
  subtitle,
  children,
  className = ''
}) {
  const genreVars = getGenreCssVars(genre);
  const grammar = resolveGenreGrammar(genre);
  const headerMarkClassMap = {
    'stone-rune': 'h-10 w-10 rounded-[14px] border border-[var(--genre-line)]',
    'cloud-seal': 'h-8 w-16 rounded-full border border-[var(--genre-line)]',
    'glass-slit': 'h-8 w-14 rounded-[10px] border border-[var(--genre-line)]',
    'seal-strip': 'h-9 w-4 rounded-sm border border-[var(--genre-line)]',
    'hud-notch': 'h-8 w-12 rounded-none border border-[var(--genre-line)]',
    stardust: 'h-9 w-9 rounded-full border border-[var(--genre-line)]'
  };

  return (
    <section
      style={{
        ...genreVars,
        background: [grammar.ornament.pattern, grammar.surface.panelGradient].join(', '),
        boxShadow: grammar.surface.glow,
        borderRadius: grammar.shape.radius,
        borderWidth: grammar.shape.borderWidth
      }}
      className={joinClasses(
        'relative overflow-hidden border border-[var(--genre-line)] p-6 text-[var(--genre-text)] md:p-7',
        className
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[4px]"
        style={{ background: grammar.ornament.accentBar }}
      />
      {(title || subtitle) ? (
        <header className="relative mb-6 border-b pb-5" style={{ borderImage: `${grammar.ornament.divider} 1` }}>
          <div className="mb-4 flex items-center gap-3">
            <span
              aria-hidden="true"
              className={joinClasses(
                'shrink-0 bg-[image:var(--genre-header-pattern)]',
                headerMarkClassMap[grammar.ornament.headerMark] || headerMarkClassMap.stardust
              )}
              style={{
                backgroundImage: grammar.ornament.pattern,
                boxShadow: grammar.surface.shadow
              }}
            />
            {title ? (
              <h2 className="text-[clamp(1.5rem,2.2vw,2.2rem)] font-semibold tracking-[-0.03em] text-[var(--genre-text)]">
                {title}
              </h2>
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-3 max-w-[64ch] text-sm leading-7 text-[var(--genre-muted)] md:text-[15px]">
              {subtitle}
            </p>
          ) : null}
        </header>
      ) : null}
      <div className="space-y-4">{children}</div>
    </section>
  );
}
