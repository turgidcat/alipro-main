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

function getElementShape(element) {
  const shapeMap = {
    faction: (
      <>
        <path d="M8 18V6" />
        <path d="M8 7H17L15 10L17 13H8" />
      </>
    ),
    location: (
      <>
        <path d="M12 19C15.3 15.2 17 12.6 17 10C17 7.2 14.8 5 12 5C9.2 5 7 7.2 7 10C7 12.6 8.7 15.2 12 19Z" />
        <circle cx="12" cy="10" r="1.8" />
      </>
    ),
    artifact: (
      <>
        <path d="M12 5L17 9.2V14.8L12 19L7 14.8V9.2L12 5Z" />
        <path d="M12 8.5V15.5" />
        <path d="M9.5 10.5L14.5 13.5" />
        <path d="M14.5 10.5L9.5 13.5" />
      </>
    ),
    ability: (
      <>
        <path d="M6 14C8.8 14 8.8 10 11.5 10C14.2 10 14.2 14 17 14" />
        <path d="M7 18C9.6 18 10 6 12 6C14 6 14.4 18 17 18" />
      </>
    ),
    bloodline: (
      <>
        <path d="M12 5C9.8 8 8.5 10.1 8.5 12.2C8.5 14.8 10 17 12 17C14 17 15.5 14.8 15.5 12.2C15.5 10.1 14.2 8 12 5Z" />
        <path d="M12 8.5V14.5" />
      </>
    ),
    curse: (
      <>
        <path d="M9 8.5A4 4 0 0 1 15 8.5" />
        <path d="M8 12H16" />
        <path d="M8.5 15.5L15.5 8.5" />
        <path d="M7 17.5L17 6.5" />
      </>
    ),
    secret: (
      <>
        <path d="M8.5 10V8.8C8.5 6.9 10 5.5 12 5.5C14 5.5 15.5 6.9 15.5 8.8V10" />
        <path d="M8 10H16V18H8V10Z" />
        <circle cx="12" cy="14" r="1.2" />
      </>
    ),
    destiny: (
      <>
        <circle cx="12" cy="12" r="6.5" />
        <path d="M12 5.5C14.5 8 14.5 16 12 18.5" />
        <path d="M12 5.5C9.5 8 9.5 16 12 18.5" />
        <path d="M5.5 12H18.5" />
      </>
    )
  };

  return shapeMap[element] || shapeMap.faction;
}

export default function WorldElementIcon({
  genre = 'lightnovel',
  element,
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
        color: 'var(--genre-accent)'
      }}
      className={joinClasses('h-5 w-5 shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap={lineCap}
      strokeLinejoin={lineJoin}
    >
      {getElementShape(element)}
    </svg>
  );
}
