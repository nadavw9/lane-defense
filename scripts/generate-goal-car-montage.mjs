// generate-goal-car-montage.mjs — Bug D source art: 6 stylized single-color car
// counter icons (side view, friendly proportions) on a plain white background,
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
  red:    '#E24B4A',
  blue:   '#378ADD',
  green:  '#639922',
  yellow: '#EF9F27',
  purple: '#7F77DD',
  orange: '#D85A30',
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
  const hilite  = lighten(body, 0.35);
  const glass   = '#cfe8f8';
  const glassHi = '#ffffff';
  return `
  <g stroke="${darken(body, 0.5)}" stroke-width="4" stroke-linejoin="round">
    <!-- body: lower slab + cabin -->
    <path d="M14,100 Q14,74 42,70 L64,67 Q76,38 102,36 L128,36 Q154,38 164,66 L184,71
             Q202,75 202,92 L202,100 Q202,110 190,110 L26,110 Q14,110 14,100 Z"
          fill="${body}"/>
    <!-- roof highlight -->
    <path d="M70,64 Q80,42 102,40 L126,40 Q148,42 158,63 L152,64 Q142,46 126,45 L104,45 Q84,46 76,64 Z"
          fill="${hilite}" stroke="none" opacity="0.7"/>
    <!-- windows -->
    <path d="M80,64 Q88,47 104,46 L110,46 L110,64 Z" fill="${glass}" stroke-width="3"/>
    <path d="M118,46 L126,46 Q143,47 150,64 L118,64 Z" fill="${glass}" stroke-width="3"/>
    <path d="M83,61 Q90,50 102,49 L106,49 L106,52 Q92,53 87,61 Z" fill="${glassHi}" stroke="none" opacity="0.8"/>
    <!-- skirt shade -->
    <path d="M18,98 L200,98 L200,100 Q200,108 190,108 L26,108 Q18,108 18,98 Z" fill="${shade}" stroke="none"/>
    <!-- bumpers -->
    <rect x="10" y="88" width="12" height="14" rx="5" fill="${shade}"/>
    <rect x="198" y="88" width="12" height="14" rx="5" fill="${shade}"/>
    <!-- headlight / taillight -->
    <circle cx="196" cy="82" r="5" fill="#ffe9a8" stroke-width="3"/>
    <circle cx="22" cy="82" r="4.5" fill="${darken(body, 0.15)}" stroke-width="3"/>
  </g>
  <!-- wheels -->
  <g>
    <circle cx="62" cy="110" r="20" fill="#23232c" stroke="#111118" stroke-width="4"/>
    <circle cx="62" cy="110" r="9" fill="#a8aeb8" stroke="#5c626c" stroke-width="3"/>
    <circle cx="158" cy="110" r="20" fill="#23232c" stroke="#111118" stroke-width="4"/>
    <circle cx="158" cy="110" r="9" fill="#a8aeb8" stroke="#5c626c" stroke-width="3"/>
  </g>`;
}

const SIZE = 1024, COLS = 3, ROWS = 2;
const CELL_W = Math.floor(SIZE / COLS), CELL_H = Math.floor(SIZE / ROWS);   // 341×512
const ORDER = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

const composites = [];
for (const [i, name] of ORDER.entries()) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 150" width="300" height="205">${carSvg(PALETTE[name])}</svg>`;
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
