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

function getRoleShape(role) {
  const shapeMap = {
    protagonist: (
      <>
        <circle cx="12" cy="12" r="4.25" />
        <path d="M12 5V7.5" />
        <path d="M12 16.5V19" />
        <path d="M5 12H7.5" />
        <path d="M16.5 12H19" />
      </>
    ),
    heroine: (
      <>
        <path d="M12 6L13.6 9L17 10L14.6 12.4L15 16L12 14.3L9 16L9.4 12.4L7 10L10.4 9L12 6Z" />
        <circle cx="12" cy="12" r="6.2" />
      </>
    ),
    mentor: (
      <>
        <path d="M8 8.5C8 7.1 9.2 6 10.6 6H13.4C14.8 6 16 7.1 16 8.5V14.5C16 15.9 14.8 17 13.4 17H10.6C9.2 17 8 15.9 8 14.5V8.5Z" />
        <path d="M12 9V14" />
        <path d="M9.5 17.5L8.5 19" />
        <path d="M14.5 17.5L15.5 19" />
      </>
    ),
    rival: (
      <>
        <path d="M8 7L12 12L8 17" />
        <path d="M16 7L12 12L16 17" />
      </>
    ),
    villain: (
      <>
        <path d="M12 5L18 9V15L12 19L6 15V9L12 5Z" />
        <path d="M9 15L15 9" />
        <path d="M9 9L15 15" />
      </>
    ),
    companion: (
      <>
        <circle cx="9" cy="12" r="3.25" />
        <circle cx="15" cy="12" r="3.25" />
        <path d="M11 15.5L13 15.5" />
      </>
    ),
    mystery: (
      <>
        <path d="M8 9.5C8 7.6 9.8 6 12 6C14.2 6 16 7.6 16 9.5C16 11 15.2 11.8 13.7 12.8C12.6 13.5 12 14.1 12 15.2" />
        <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" />
        <path d="M6.5 12C7.2 8.1 9.2 6 12 6C14.8 6 16.8 8.1 17.5 12" />
      </>
    )
  };

  return shapeMap[role] || shapeMap.protagonist;
}

export default function CharacterRoleIcon({
  genre = 'lightnovel',
  role,
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
        color: 'var(--genre-secondary)'
      }}
      className={joinClasses('h-5 w-5 shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap={lineCap}
      strokeLinejoin={lineJoin}
    >
      {getRoleShape(role)}
    </svg>
  );
}
