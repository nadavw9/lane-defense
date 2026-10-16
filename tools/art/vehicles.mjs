// Vector art for Traffic Bomb — vehicles, bombs, and UI glyphs as SVG strings.
//
// One source for both the design mockups AND the shipped sprites: the mockup
// pages inline these SVGs, and tools/art/render-sprites.mjs rasterises the same
// functions to PNG. What the owner approves in a mockup is exactly what ships.
//
// Coordinates: every vehicle is drawn in its own viewBox with the FRONT AT THE
// BOTTOM (cars drive down the screen toward the breach line).
//
// Three styles, one geometry:
//   toy  — thick dark outline, glossy highlight (Neighborhood Defense / Bloons)
//   pop  — white sticker outline + soft drop shadow, flat saturated fills
//   neon — dark body with a glowing coloured rim (arcade / night highway)

// Six colours re-picked for separation. The shipped palette had Red #E24B4A,
// Orange #D85A30 and Yellow #EF9F27 within ~25° of hue of each other, and Green
// #639922 as a dull olive — at six colours (World 3) orange/red/yellow bombs
// were hard to tell apart. These sit ~40°+ apart with matched brightness steps.
export const PALETTE = {
  Red:    { base: '#FF3D3D', dark: '#C41620', light: '#FF9A94', glyph: 'heart'   },
  Orange: { base: '#FF8A1C', dark: '#C85600', light: '#FFC585', glyph: 'star'    },
  Yellow: { base: '#FFD42A', dark: '#C99700', light: '#FFF096', glyph: 'bolt'    },
  Green:  { base: '#2FCC55', dark: '#118A32', light: '#95F2AA', glyph: 'leaf'    },
  Blue:   { base: '#2F8CFF', dark: '#1255C2', light: '#96C9FF', glyph: 'drop'    },
  Purple: { base: '#A35CFF', dark: '#6723C7', light: '#D6B4FF', glyph: 'diamond' },
};

const STYLE = {
  toy:  { ink: '#1F1A33', ink2: '#1F1A33', w: 4.2, glass: '#2A3656', gloss: 0.55, shadow: false, glow: false },
  pop:  { ink: '#FFFFFF', ink2: '#2A2440', w: 5.0, glass: '#2E3B5E', gloss: 0.35, shadow: true,  glow: false },
  neon: { ink: null,      ink2: '#0A0F1F', w: 3.0, glass: '#070B18', gloss: 0.25, shadow: false, glow: true  },
};

let _uid = 0;
const uid = (p) => `${p}${++_uid}`;

// Shared <defs> per SVG: gloss gradient, drop shadow, neon glow.
function defs(id, c, s) {
  return `<defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c.light}"/><stop offset=".45" stop-color="${c.base}"/>
      <stop offset="1" stop-color="${c.dark}"/></linearGradient>
    <filter id="${id}s" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="2.2" flood-color="#000" flood-opacity=".32"/></filter>
    <filter id="${id}n" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`;
}

// Body paint for a style: gradient fill + outline (or neon rim).
function paint(id, c, s) {
  if (s.glow) return `fill="${c.dark}" fill-opacity=".92" stroke="${c.light}" stroke-width="${s.w}"`;
  return `fill="url(#${id}g)" stroke="${s.ink}" stroke-width="${s.w}" stroke-linejoin="round"`;
}
const wrapFilter = (id, s) => s.shadow ? `filter="url(#${id}s)"` : s.glow ? `filter="url(#${id}n)"` : '';

function svg(W, H, inner, id, c, s, pad = 6) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}" width="${W + pad * 2}" height="${H + pad * 2}">${defs(id, c, s)}<g ${wrapFilter(id, s)}>${inner}</g></svg>`;
}

const headlights = (xs, y, r = 3.4) =>
  xs.map(x => `<ellipse cx="${x}" cy="${y}" rx="${r + 1}" ry="${r}" fill="#FFF6C8" stroke="#1F1A33" stroke-opacity=".35" stroke-width="1"/>`).join('');
const taillights = (xs, y) =>
  xs.map(x => `<rect x="${x - 4}" y="${y - 1.6}" width="8" height="3.2" rx="1.6" fill="#FF5A5A"/>`).join('');
const gloss = (x, y, w, h, s) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) / 2}" fill="#fff" opacity="${s.gloss}"/>`;

const SHAPES = {
  // Motorbike — narrow, rider on top, handlebar across the front.
  small(id, c, s) {
    const W = 38, H = 86;
    return svg(W, H, `
      <rect x="15" y="0" width="8" height="15" rx="4" fill="${s.ink2}"/>
      <rect x="15" y="71" width="8" height="15" rx="4" fill="${s.ink2}"/>
      <ellipse cx="19" cy="44" rx="11.5" ry="28" ${paint(id, c, s)}/>
      <line x1="3" y1="64" x2="35" y2="64" stroke="${s.ink2}" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="19" cy="40" r="10.5" fill="${c.dark}" stroke="${s.glow ? c.light : s.ink2}" stroke-width="2.5"/>
      <path d="M12 44 Q19 51 26 44" fill="none" stroke="${s.glass}" stroke-width="3.2" stroke-linecap="round"/>
      ${gloss(14, 22, 5, 12, s)}
      ${headlights([19], 75, 2.8)}`, id, c, s);
  },
  // Sedan — rounded body, windscreen near the front, rear window, roof.
  big(id, c, s) {
    const W = 60, H = 98;
    return svg(W, H, `
      <ellipse cx="2" cy="64" rx="3.5" ry="2.6" fill="${c.dark}"/><ellipse cx="58" cy="64" rx="3.5" ry="2.6" fill="${c.dark}"/>
      <rect x="4" y="2" width="52" height="94" rx="16" ${paint(id, c, s)}/>
      <path d="M13 58 L47 58 L50 71 Q30 75 10 71 Z" fill="${s.glass}"/>
      <path d="M15 16 Q30 12 45 16 L43 27 L17 27 Z" fill="${s.glass}"/>
      <rect x="14" y="29" width="32" height="27" rx="6" fill="${c.base}" stroke="${s.glow ? c.light : 'none'}" stroke-width="1.2" opacity=".95"/>
      ${gloss(18, 32, 7, 20, s)}${gloss(16, 60, 14, 3.5, s)}
      ${headlights([15, 45], 90)}${taillights([15, 45], 6)}`, id, c, s);
  },
  // Van — boxy, huge flat roof with rails, short windscreen.
  jeep(id, c, s) {
    const W = 64, H = 104;
    return svg(W, H, `
      <ellipse cx="2" cy="76" rx="3.5" ry="2.6" fill="${c.dark}"/><ellipse cx="62" cy="76" rx="3.5" ry="2.6" fill="${c.dark}"/>
      <rect x="4" y="2" width="56" height="100" rx="11" ${paint(id, c, s)}/>
      <path d="M11 74 L53 74 L55 86 Q32 90 9 86 Z" fill="${s.glass}"/>
      <rect x="11" y="9" width="42" height="60" rx="5" fill="${c.base}" stroke="${s.glow ? c.light : c.dark}" stroke-width="1.6"/>
      <line x1="19" y1="13" x2="19" y2="65" stroke="${c.dark}" stroke-width="2" opacity=".55"/>
      <line x1="45" y1="13" x2="45" y2="65" stroke="${c.dark}" stroke-width="2" opacity=".55"/>
      ${gloss(23, 14, 7, 44, s)}
      ${headlights([14, 50], 96)}${taillights([14, 50], 6)}`, id, c, s);
  },
  // Tender — tanker: short cab up front, fat round tank with hatches behind.
  // Every vehicle renders at ~one row length (body = FIT x row pitch), so long
  // types are drawn compact: a 3:1 rig would come out a hair-thin sliver.
  truck(id, c, s) {
    const W = 66, H = 112;
    return svg(W, H, `
      <rect x="3" y="2" width="60" height="70" rx="26" ${paint(id, c, s)}/>
      ${[20, 38, 54].map(y => `<line x1="8" y1="${y}" x2="58" y2="${y}" stroke="${c.dark}" stroke-width="2.4" opacity=".55"/>`).join('')}
      <circle cx="33" cy="22" r="6" fill="${c.light}" stroke="${s.glow ? c.light : c.dark}" stroke-width="2"/>
      <circle cx="33" cy="50" r="6" fill="${c.light}" stroke="${s.glow ? c.light : c.dark}" stroke-width="2"/>
      ${gloss(14, 10, 7, 50, s)}
      <rect x="28" y="70" width="10" height="7" fill="${s.ink2}"/>
      <rect x="8" y="74" width="50" height="37" rx="10" ${paint(id, c, s)}/>
      <path d="M14 88 L52 88 L54 99 Q33 103 12 99 Z" fill="${s.glass}"/>
      ${headlights([16, 50], 106)}`, id, c, s);
  },
  // Big rig — box trailer with a racing stripe, flat-nosed cab up front.
  bigrig(id, c, s) {
    const W = 62, H = 124;
    return svg(W, H, `
      <rect x="3" y="2" width="56" height="80" rx="7" ${paint(id, c, s)}/>
      <rect x="9" y="8" width="44" height="68" rx="4" fill="none" stroke="${c.dark}" stroke-width="2" opacity=".5"/>
      <rect x="25" y="8" width="12" height="68" fill="${c.light}" opacity="${s.glow ? .35 : .65}"/>
      ${[30, 54].map(y => `<line x1="9" y1="${y}" x2="53" y2="${y}" stroke="${c.dark}" stroke-width="1.8" opacity=".5"/>`).join('')}
      <rect x="26" y="80" width="10" height="7" fill="${s.ink2}"/>
      <rect x="6" y="84" width="50" height="39" rx="8" ${paint(id, c, s)}/>
      <rect x="10" y="88" width="42" height="7" rx="3" fill="${c.dark}" opacity=".5"/>
      <path d="M12 100 L50 100 L52 111 Q31 114 10 111 Z" fill="${s.glass}"/>
      ${headlights([15, 47], 119)}`, id, c, s);
  },
  // Tank — tracks, hull, turret, barrel pointing at the player.
  tank(id, c, s) {
    const W = 80, H = 118;
    const treads = (x) => [14, 28, 42, 56, 70, 84, 98].map(y =>
      `<line x1="${x + 2}" y1="${y}" x2="${x + 12}" y2="${y}" stroke="#555" stroke-width="2"/>`).join('');
    return svg(W, H, `
      <rect x="1" y="6" width="16" height="100" rx="6" fill="${s.ink2}"/>${treads(3)}
      <rect x="63" y="6" width="16" height="100" rx="6" fill="${s.ink2}"/>${treads(65)}
      <rect x="11" y="12" width="58" height="90" rx="12" ${paint(id, c, s)}/>
      <rect x="35" y="56" width="10" height="60" rx="4" fill="${c.dark}" stroke="${s.glow ? c.light : s.ink2}" stroke-width="2.2"/>
      <circle cx="40" cy="54" r="19" fill="${c.base}" stroke="${s.glow ? c.light : s.ink2}" stroke-width="${s.w * 0.8}"/>
      <circle cx="40" cy="54" r="7" fill="${c.dark}"/>
      ${gloss(22, 18, 10, 26, s)}`, id, c, s);
  },
};

export const VEHICLE_TYPES = Object.keys(SHAPES);

export function vehicleSVG(type, color, style = 'toy') {
  const c = PALETTE[color], s = STYLE[style];
  if (!c || !s || !SHAPES[type]) throw new Error(`vehicleSVG: bad args ${type}/${color}/${style}`);
  return SHAPES[type](uid('v'), c, s);
}

// Colour glyphs — shape redundancy for colour-blind players, drawn in white.
const GLYPHS = {
  heart:   'M0 6 C-10 -2 -8 -12 0 -6 C8 -12 10 -2 0 6 Z',
  star:    'M0 -9 L2.6 -3 L9 -2.8 L4 1.4 L5.6 8 L0 4.4 L-5.6 8 L-4 1.4 L-9 -2.8 L-2.6 -3 Z',
  bolt:    'M2 -10 L-6 1 L-1 1 L-3 10 L6 -2 L1 -2 Z',
  leaf:    'M-7 7 C-9 -4 -2 -10 8 -9 C9 1 3 8 -7 7 Z',
  drop:    'M0 -10 C5 -3 8 1 8 4 A8 8 0 0 1 -8 4 C-8 1 -5 -3 0 -10 Z',
  diamond: 'M0 -10 L8 0 L0 10 L-8 0 Z',
};

// Bomb sphere with its damage number. `glyph` adds the colour-blind shape.
// `damage` null = no number (the game draws its own live badge on top).
// `frame` = viewBox side: 116 is tight; the shipped sprite uses a wider frame so
// the ball fills the same fraction of the canvas as the art it replaces.
export function bombSVG(color, damage, style = 'toy', { glyph = false, size = 100, frame = 116 } = {}) {
  const c = PALETTE[color], s = STYLE[style], id = uid('b');
  const ring = s.glow ? `stroke="${c.light}" stroke-width="4"` : `stroke="${s.ink}" stroke-width="${s.w + 0.8}"`;
  const num = damage == null ? '' : String(damage);
  const fs = num.length > 1 ? 44 : 52;
  const o = 50 - frame / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${o} ${o} ${frame} ${frame}" width="${size}" height="${size}">
    <defs>
      <radialGradient id="${id}r" cx=".35" cy=".3" r=".8">
        <stop offset="0" stop-color="${c.light}"/><stop offset=".5" stop-color="${c.base}"/><stop offset="1" stop-color="${c.dark}"/></radialGradient>
      <filter id="${id}s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity=".35"/></filter>
      <filter id="${id}n" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <g ${s.shadow ? `filter="url(#${id}s)"` : s.glow ? `filter="url(#${id}n)"` : ''}>
      <circle cx="50" cy="50" r="44" fill="url(#${id}r)" ${ring}/>
      <ellipse cx="36" cy="28" rx="16" ry="10" fill="#fff" opacity=".55" transform="rotate(-25 36 28)"/>
      ${glyph ? `<path d="${GLYPHS[c.glyph]}" transform="translate(74 74) scale(.95)" fill="#fff" stroke="${c.dark}" stroke-width="1.6"/>` : ''}
      ${num === '' ? '' : `<text x="50" y="${glyph ? 66 : 68}" text-anchor="middle" font-family="'Fredoka','Baloo 2','Arial Rounded MT Bold',Arial,sans-serif"
        font-weight="700" font-size="${fs}" fill="#fff" stroke="#1F1A33" stroke-width="6" paint-order="stroke">${num}</text>`}
    </g></svg>`;
}
