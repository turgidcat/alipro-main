import { getGenreCssVars } from '../utils/resolveGenreTheme.js';
import { resolveGenreGrammar } from '../utils/resolveGenreGrammar.js';

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function getRotation(position) {
  const rotationMap = {
    'top-left': 'rotate(0deg)',
    'top-right': 'rotate(90deg)',
    'bottom-right': 'rotate(180deg)',
    'bottom-left': 'rotate(270deg)'
  };

  return rotationMap[position] || rotationMap['top-left'];
}

function getCornerShape(edgeStyle) {
  const shapeMap = {
    heavy: (
      <>
        <path d="M5 22V5H22" />
        <path d="M5 14H14V5" />
      </>
    ),
    airy: (
      <>
        <path d="M6 20C6 12 12 6 20 6" />
        <circle cx="17.5" cy="8.5" r="1.25" fill="currentColor" stroke="none" />
      </>
    ),
    glass: (
      <>
        <path d="M5 20V5H20" />
        <path d="M10 20L20 10" />
      </>
    ),
    dossier: (
      <>
        <path d="M5 22V5H18" />
        <path d="M5 8H20" />
      </>
    ),
    hud: (
      <>
        <path d="M5 22V9L9 5H22" />
        <path d="M12 5H22" />
      </>
    ),
    soft: (
      <>
        <path d="M6 20C6 11 11 6 20 6" />
        <path d="M10 20C10 13.5 13.5 10 20 10" />
      </>
    )
  };

  return shapeMap[edgeStyle] || shapeMap.soft;
}

export default function GenreCorner({
  genre = 'lightnovel',
  position = 'top-left',
  className = ''
}) {
  const grammar = resolveGenreGrammar(genre);
  const strokeWidth = grammar.shape.edgeStyle === 'airy' ? 1.4 : 1.8;
  const lineCap = grammar.shape.edgeStyle === 'soft' ? 'round' : 'square';
  const lineJoin = grammar.shape.edgeStyle === 'airy' ? 'round' : 'miter';

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{
        ...getGenreCssVars(genre),
        color: 'var(--genre-accent)',
        transform: getRotation(position)
      }}
      className={joinClasses('h-6 w-6 shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap={lineCap}
      strokeLinejoin={lineJoin}
    >
      {getCornerShape(grammar.shape.edgeStyle)}
    </svg>
  );
}
