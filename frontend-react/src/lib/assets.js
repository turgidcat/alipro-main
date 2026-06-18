export function buildSvgDataUrl(markup) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markup)}`;
}

export function createBookCoverDataUrl(title = '未命名书籍') {
  const safeTitle = String(title || '未命名书籍').trim().slice(0, 18) || '未命名书籍';
  return buildSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 960">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#122033"/>
          <stop offset="45%" stop-color="#1e3250"/>
          <stop offset="100%" stop-color="#d0a76c"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="25%" r="60%">
          <stop offset="0%" stop-color="#f8e2a4" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#f8e2a4" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="720" height="960" rx="44" fill="url(#bg)"/>
      <rect width="720" height="960" rx="44" fill="url(#glow)"/>
      <circle cx="555" cy="170" r="92" fill="#f7e7b5" fill-opacity="0.18"/>
      <path d="M110 720C220 620 302 590 372 596C458 604 522 674 620 652V884H110Z" fill="#101927" fill-opacity="0.86"/>
      <path d="M120 762C212 692 296 666 378 674C470 682 546 742 620 724V884H120Z" fill="#e7bc71" fill-opacity="0.32"/>
      <text x="360" y="240" text-anchor="middle" font-size="40" fill="#f4ddb1" font-family="'Microsoft YaHei', sans-serif" letter-spacing="6">ALIPRO</text>
      <text x="360" y="392" text-anchor="middle" font-size="92" font-weight="700" fill="#fff1c4" font-family="'Microsoft YaHei', sans-serif">${safeTitle}</text>
      <text x="360" y="458" text-anchor="middle" font-size="26" fill="#f4ddb1" font-family="'Microsoft YaHei', sans-serif">全书规划主视觉</text>
      <rect x="184" y="554" width="352" height="2" fill="#f4ddb1" fill-opacity="0.6"/>
      <text x="360" y="820" text-anchor="middle" font-size="28" fill="#fff7df" font-family="'Microsoft YaHei', sans-serif">书籍封面示意图</text>
    </svg>
  `);
}

export function createVolumePosterDataUrl(volumeLabel = '第1卷') {
  const safeLabel = String(volumeLabel || '第1卷').trim().slice(0, 12) || '第1卷';
  return buildSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 520">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#18263c"/>
          <stop offset="55%" stop-color="#314d73"/>
          <stop offset="100%" stop-color="#d7b071"/>
        </linearGradient>
      </defs>
      <rect width="360" height="520" rx="28" fill="url(#bg)"/>
      <rect x="14" y="14" width="332" height="492" rx="20" fill="none" stroke="#f1d79d" stroke-opacity="0.7" stroke-width="3"/>
      <circle cx="284" cy="126" r="74" fill="#fff1c9" fill-opacity="0.18"/>
      <path d="M0 402C72 350 124 332 184 336C256 340 306 382 360 364V520H0Z" fill="#0f1624" fill-opacity="0.88"/>
      <path d="M0 434C64 394 126 384 182 390C258 398 304 430 360 420V520H0Z" fill="#efc27a" fill-opacity="0.3"/>
      <text x="180" y="104" text-anchor="middle" font-size="44" font-weight="700" fill="#fff5dc" font-family="'Microsoft YaHei', sans-serif">${safeLabel}</text>
      <text x="180" y="458" text-anchor="middle" font-size="24" fill="#fff1cf" font-family="'Microsoft YaHei', sans-serif">分卷展示示意图</text>
    </svg>
  `);
}

export function createCharacterBadgeDataUrl(name = '角色') {
  const safeName = String(name || '角色').trim().slice(0, 4) || '角色';
  return buildSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">
      <defs>
        <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1b2e47"/>
          <stop offset="100%" stop-color="#d7b071"/>
        </linearGradient>
        <radialGradient id="face" cx="50%" cy="38%" r="56%">
          <stop offset="0%" stop-color="#fff4d6"/>
          <stop offset="100%" stop-color="#dbc18e"/>
        </radialGradient>
      </defs>
      <circle cx="110" cy="110" r="104" fill="url(#ring)"/>
      <circle cx="110" cy="110" r="92" fill="#f7f2e8"/>
      <circle cx="110" cy="110" r="84" fill="#24374f"/>
      <circle cx="110" cy="100" r="46" fill="url(#face)"/>
      <path d="M54 176C68 144 88 128 110 128C132 128 152 144 166 176Z" fill="#ead6a8"/>
      <text x="110" y="196" text-anchor="middle" font-size="28" font-weight="700" fill="#f8e8bb" font-family="'Microsoft YaHei', sans-serif">${safeName}</text>
    </svg>
  `);
}

export function buildCharacterSubtitle(character) {
  const pieces = [
    String(character?.personality || '').trim(),
    String(character?.background || '').trim(),
    String(character?.appearance || '').trim(),
    String(character?.notes || '').trim()
  ].filter(Boolean);
  return pieces[0] || '角色档案待补充';
}
