import { getGenreCssVars } from '../utils/resolveGenreTheme.js';
import { resolveGenreGrammar } from '../utils/resolveGenreGrammar.js';

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function getStrokeWidth(edgeStyle) {
  const strokeMap = {
    heavy: 2.1,
    airy: 1.55,
    glass: 1.7,
    dossier: 1.85,
    hud: 1.95,
    soft: 1.7
  };

  return strokeMap[edgeStyle] || strokeMap.soft;
}

function getStageShape(stage) {
  const shapeMap = {
    opening: (
      <>
        <path d="M8 9.5L12 6L16 9.5V18H8V9.5Z" />
        <path d="M12 6V18" />
      </>
    ),
    awakening: (
      <>
        <circle cx="12" cy="12" r="2.75" />
        <path d="M12 4.5V7" />
        <path d="M12 17V19.5" />
        <path d="M4.5 12H7" />
        <path d="M17 12H19.5" />
        <path d="M6.8 6.8L8.4 8.4" />
        <path d="M15.6 15.6L17.2 17.2" />
        <path d="M17.2 6.8L15.6 8.4" />
        <path d="M8.4 15.6L6.8 17.2" />
      </>
    ),
    trial: (
      <>
        <path d="M6 18L10 14L12.5 16.5L18 11" />
        <path d="M8 18H18" />
        <path d="M7 10.5L10 7.5L13 10.5L16 7.5" />
      </>
    ),
    encounter: (
      <>
        <circle cx="9.25" cy="12" r="4.25" />
        <circle cx="14.75" cy="12" r="4.25" />
        <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      </>
    ),
    conflict: (
      <>
        <path d="M7 7L17 17" />
        <path d="M17 7L7 17" />
        <path d="M12 5L13.4 9.6L18 11L13.4 12.4L12 17L10.6 12.4L6 11L10.6 9.6L12 5Z" />
      </>
    ),
    crisis: (
      <>
        <path d="M12 5L18.5 17H5.5L12 5Z" />
        <path d="M12 9V13" />
        <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    breakthrough: (
      <>
        <path d="M12 18V6" />
        <path d="M8 10L12 6L16 10" />
        <path d="M7 18L10.5 14.5" />
        <path d="M17 18L13.5 14.5" />
      </>
    ),
    reversal: (
      <>
        <path d="M8 8H16L13.5 5.5" />
        <path d="M16 16H8L10.5 18.5" />
        <path d="M16 8C17.7 9.2 18.5 10.6 18.5 12" />
        <path d="M8 16C6.3 14.8 5.5 13.4 5.5 12" />
      </>
    ),
    climax: (
      <>
        <path d="M12 4.5L13.9 9.2L19 9.8L15 13.2L16.2 18.3L12 15.4L7.8 18.3L9 13.2L5 9.8L10.1 9.2L12 4.5Z" />
      </>
    ),
    ending: (
      <>
        <path d="M7 16C8.5 18 10.2 19 12 19C15.3 19 18 15.9 18 12C18 8.1 15.3 5 12 5C8.7 5 6 8.1 6 12" />
        <path d="M5.5 15.5L7 16L6.5 17.5" />
      </>
    )
  };

  return shapeMap[stage] || shapeMap.opening;
}

export default function ChapterStageIcon({
  genre = 'lightnovel',
  stage,
  className = ''
}) {
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
      className={joinClasses('h-5 w-5 shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap={lineCap}
      strokeLinejoin={lineJoin}
    >
      {getStageShape(stage)}
    </svg>
  );
}
