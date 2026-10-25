// generate-goal-car-montage.mjs — Bug D source art: 6 stylized single-color car
// counter icons (side view, Toy Town / Play Store CONCEPT polish) on a plain white background,
// 1024×1024 montage (3 cols × 2 rows), saved to sprite-sources/raw/goal-cars.png.
// Colors match the game palette (GoalCounterUI COLOR_PALETTE / CLAUDE.md §10).
// Run: node scripts/generate-goal-car-montage.mjs

import sharp from 'sharp';
import path from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'sprite-sources', 'raw', 'goal-cars.png');
mkdirSync(path.dirname(OUT), { recursive: true });

// Game palette — keep in sync with GoalCounterUI.COLOR_PALETTE.
const PALETTE = {
  // Toy Town palette (tools/art/vehicles.mjs) — Play Store CONCEPT 2026-10-25
  red:    '#FF3D3D',
  blue:   '#2F8CFF',
  green:  '#2FCC55',
  yellow: '#FFD42A',
  purple: '#A35CFF',
  orange: '#FF8A1C',
};

// Darken a #rrggbb by factor (0..1).
const darken = (hex, f) => '#' + [1, 3, 5]
  .map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - f)).toString(16).padStart(2, '0'))
  .join('');
const lighten = (hex, f) => '#' + [1, 3, 5]
  .map((i) => { const v = parseInt(hex.slice(i, i + 2), 16); return Math.round(v + (255 - v) * f).toString(16).padStart(2, '0'); })
  .join('');

// One stylized side-view car (faces right), viewBox 0 0 220 150.
function carSvg(body) {
  const shade   = darken(body, 0.28);
  const hilite  = lighten(body, 0.38);
  const ink     = '#1F1A33';
  // Play Store CONCEPT: chunky side-view toy sedan — gradient body, glass, chrome
  // bumpers, alloy rims, soft drop shadow. Faces right. viewBox 0 0 280 180.
  return `
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${hilite}"/>
      <stop offset=".42" stop-color="${body}"/>
      <stop offset="1" stop-color="${shade}"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#E8F4FF"/><stop offset=".4" stop-color="#7FA8D4"/>
      <stop offset="1" stop-color="#1A2740"/>
    </linearGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F2F5F8"/><stop offset="1" stop-color="#8A929C"/>
    </linearGradient>
    <filter id="s" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="5" stdDeviation="3.5" flood-color="#000" flood-opacity=".32"/>
    </filter>
  </defs>
  <g filter="url(#s)" stroke="${ink}" stroke-width="5" stroke-linejoin="round">
    <path d="M28,118 Q28,88 58,84 L82,80 Q96,46 128,42 L168,42 Q198,46 210,78 L236,84
             Q258,88 258,108 L258,120 Q258,132 242,132 L42,132 Q28,132 28,118 Z"
          fill="url(#body)"/>
    <path d="M96,78 Q108,50 130,48 L164,48 Q184,50 196,76 L188,78 Q178,56 164,54 L132,54 Q112,56 104,78 Z"
          fill="${hilite}" stroke="none" opacity="0.55"/>
    <path d="M104,78 Q112,56 130,54 L140,54 L140,78 Z" fill="url(#glass)" stroke-width="4"/>
    <path d="M148,54 L164,54 Q182,56 192,78 L148,78 Z" fill="url(#glass)" stroke-width="4"/>
    <path d="M108,74 Q116,60 128,58 L134,58 L134,62 Q118,64 112,74 Z" fill="#fff" stroke="none" opacity="0.55"/>
    <path d="M34,116 L252,116 L252,120 Q252,128 242,128 L42,128 Q34,128 34,116 Z" fill="${shade}" stroke="none" opacity="0.55"/>
    <rect x="18" y="102" width="16" height="18" rx="6" fill="#D8DEE6"/>
    <rect x="248" y="102" width="16" height="18" rx="6" fill="#D8DEE6"/>
    <ellipse cx="250" cy="94" rx="7" ry="6" fill="#FFF6C8"/>
    <ellipse cx="36" cy="94" rx="6" ry="5.5" fill="#FF5A5A"/>
    <path d="M142,80 L142,118" fill="none" stroke="${shade}" stroke-width="3" opacity="0.35"/>
  </g>
  <g stroke="#111118" stroke-width="4">
    <circle cx="84" cy="130" r="24" fill="#1D1B22"/>
    <circle cx="84" cy="130" r="12" fill="url(#rim)"/>
    <circle cx="84" cy="130" r="4.5" fill="#C9D0DA"/>
    <circle cx="200" cy="130" r="24" fill="#1D1B22"/>
    <circle cx="200" cy="130" r="12" fill="url(#rim)"/>
    <circle cx="200" cy="130" r="4.5" fill="#C9D0DA"/>
  </g>`;
}

const SIZE = 1024, COLS = 3, ROWS = 2;
const CELL_W = Math.floor(SIZE / COLS), CELL_H = Math.floor(SIZE / ROWS);   // 341×512
const ORDER = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

const composites = [];
for (const [i, name] of ORDER.entries()) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 180" width="360" height="232">${carSvg(PALETTE[name])}</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const col = i % COLS, row = (i / COLS) | 0;
  composites.push({
    input: png,
    left: col * CELL_W + Math.round((CELL_W - 300) / 2),
    top:  row * CELL_H + Math.round((CELL_H - 205) / 2),
  });
}

await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: '#ffffff' } })
  .composite(composites)
  .png()
  .toFile(OUT);

console.log(`Saved: ${OUT} (${SIZE}×${SIZE}, ${ORDER.join('/')})`);
