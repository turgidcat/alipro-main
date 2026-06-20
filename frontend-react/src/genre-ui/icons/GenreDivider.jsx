import { getGenreCssVars } from '../utils/resolveGenreTheme.js';
import { resolveGenreGrammar } from '../utils/resolveGenreGrammar.js';
import { resolveGenreTheme } from '../utils/resolveGenreTheme.js';

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function getCenterMotif(genre, variant) {
  const compactMap = {
    fantasy: <rect x="113" y="10" width="14" height="4" />,
    urban: <rect x="114" y="9" width="12" height="6" rx="1" />,
    mystery: <rect x="118" y="7" width="4" height="10" />,
    scifi: <path d="M114 8H126V16H114Z" />,
    game: <path d="M114 8H126V16H114Z" />,
    lightnovel: <circle cx="120" cy="12" r="3" />
  };

  const ornateMap = {
    fantasy: (
      <>
        <path d="M108 12H116" />
        <rect x="116" y="8" width="8" height="8" />
        <path d="M124 12H132" />
      </>
    ),
    urban: (
      <>
        <path d="M110 12H117" />
        <rect x="117" y="8.5" width="6" height="7" rx="1" />
        <path d="M123 12H130" />
      </>
    ),
    mystery: (
      <>
        <path d="M110 12H116" />
        <path d="M116 7H124V17H116Z" />
        <path d="M124 12H130" />
      </>
    ),
    scifi: (
      <>
        <path d="M110 12H115" />
        <path d="M115 8H125V16H115Z" />
        <circle cx="120" cy="12" r="2.5" />
        <path d="M125 12H130" />
      </>
    ),
    game: (
      <>
        <path d="M110 12H115" />
        <path d="M115 8H125V16H115Z" />
        <path d="M125 12H130" />
      </>
    ),
    lightnovel: (
      <>
        <path d="M110 12H116" />
        <circle cx="120" cy="12" r="3" />
        <path d="M124 12H130" />
        <circle cx="128" cy="9" r="1" fill="currentColor" stroke="none" />
      </>
    )
  };

  if (variant === 'compact') return compactMap[genre] || compactMap.lightnovel;
  if (variant === 'ornate') return ornateMap[genre] || ornateMap.lightnovel;

  return (
    <>
      <path d="M112 12H128" />
      <circle cx="120" cy="12" r="2" fill="currentColor" stroke="none" />
    </>
  );
}

function getLineEnds(edgeStyle, variant) {
  if (variant === 'compact') {
    return (
      <>
        <path d="M10 12H102" />
        <path d="M138 12H230" />
      </>
    );
  }

  if (edgeStyle === 'hud') {
    return (
      <>
        <path d="M10 12H46L56 6H102" />
        <path d="M138 12H184L194 18H230" />
      </>
    );
  }

  if (edgeStyle === 'dossier') {
    return (
      <>
        <path d="M10 12H84" />
        <path d="M88 12H102" />
        <path d="M138 12H152" />
        <path d="M156 12H230" />
      </>
    );
  }

  return (
    <>
      <path d="M10 12H102" />
      <path d="M138 12H230" />
    </>
  );
}

export default function GenreDivider({
  genre = 'lightnovel',
  variant = 'simple',
  className = ''
}) {
  const resolvedTheme = resolveGenreTheme(genre);
  const grammar = resolveGenreGrammar(genre);
  const strokeWidth = grammar.shape.edgeStyle === 'airy' ? 1.3 : 1.7;
  const lineCap = grammar.shape.edgeStyle === 'soft' ? 'round' : 'square';
  const lineJoin = grammar.shape.edgeStyle === 'airy' ? 'round' : 'miter';

  return (
    <svg
      viewBox="0 0 240 24"
      aria-hidden="true"
      style={{
        ...getGenreCssVars(genre),
        color: variant === 'compact' ? 'var(--genre-muted)' : 'var(--genre-primary)'
      }}
      className={joinClasses('h-4 w-full', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap={lineCap}
      strokeLinejoin={lineJoin}
      preserveAspectRatio="none"
    >
      {getLineEnds(grammar.shape.edgeStyle, variant)}
      {getCenterMotif(resolvedTheme.key, variant)}
    </svg>
  );
}
