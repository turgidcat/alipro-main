import { getGenreCssVars } from '../utils/resolveGenreTheme.js';
import { resolveGenreGrammar } from '../utils/resolveGenreGrammar.js';
import { resolveGenreTheme } from '../utils/resolveGenreTheme.js';

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function getStrokeWidth(edgeStyle) {
  const strokeMap = {
    heavy: 2.15,
    airy: 1.45,
    glass: 1.7,
    dossier: 1.8,
    hud: 1.95,
    soft: 1.7
  };

  return strokeMap[edgeStyle] || strokeMap.soft;
}

function getMainShape(genre) {
  const shapeMap = {
    fantasy: (
      <>
        <path d="M12 4.5L18 8.2V15.8L12 19.5L6 15.8V8.2L12 4.5Z" />
        <path d="M12 7V17" />
        <path d="M9 10H15" />
        <path d="M9 13.5H15" />
      </>
    ),
    urban: (
      <>
        <path d="M5 18H19" />
        <path d="M7 18V9H11V18" />
        <path d="M13 18V6H17V18" />
        <path d="M8.5 11H9.5" />
        <path d="M8.5 13.5H9.5" />
        <path d="M14.5 8.5H15.5" />
        <path d="M14.5 11H15.5" />
      </>
    ),
    mystery: (
      <>
        <path d="M7 6H17V18H7V6Z" />
        <path d="M9.5 9.5H14.5" />
        <path d="M9.5 12.5H14.5" />
        <path d="M17 8L20 6.5" />
        <path d="M17 12L20 12" />
      </>
    ),
    scifi: (
      <>
        <path d="M6 8H18V16H6V8Z" />
        <path d="M8 12H16" />
        <path d="M12 8V16" />
        <path d="M5 5L8 8" />
        <path d="M19 5L16 8" />
        <path d="M5 19L8 16" />
        <path d="M19 19L16 16" />
      </>
    ),
    game: (
      <>
        <path d="M6 7H18V17H6V7Z" />
        <path d="M9 10H15" />
        <path d="M12 7V17" />
        <path d="M7.5 8.5L9 7" />
        <path d="M16.5 8.5L15 7" />
        <path d="M7.5 15.5L9 17" />
        <path d="M16.5 15.5L15 17" />
      </>
    ),
    lightnovel: (
      <>
        <path d="M8 7.5C9.7 7 10.9 7.1 12 8C13.1 7.1 14.3 7 16 7.5V17C14.4 16.4 13.1 16.4 12 17C10.9 16.4 9.6 16.4 8 17V7.5Z" />
        <path d="M12 8.2V16.8" />
        <path d="M17.5 6.5L18.1 8L19.5 8.5L18.1 9L17.5 10.5L16.9 9L15.5 8.5L16.9 8L17.5 6.5Z" />
      </>
    )
  };

  return shapeMap[genre] || shapeMap.lightnovel;
}

export default function GenreMainIcon({
  genre = 'lightnovel',
  className = ''
}) {
  const resolvedTheme = resolveGenreTheme(genre);
  const grammar = resolveGenreGrammar(genre);
  const strokeWidth = getStrokeWidth(grammar.shape.edgeStyle);
  const lineCap = grammar.shape.edgeStyle === 'soft' ? 'round' : 'square';
  const lineJoin = grammar.shape.edgeStyle === 'airy' ? 'round' : 'miter';

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{
        ...getGenreCssVars(genre),
        color: 'var(--genre-primary)'
      }}
      className={joinClasses('h-8 w-8 shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap={lineCap}
      strokeLinejoin={lineJoin}
    >
      {getMainShape(resolvedTheme.key)}
    </svg>
  );
}
