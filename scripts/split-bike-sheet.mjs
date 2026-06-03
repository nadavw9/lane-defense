// split-bike-sheet.mjs
// Slices a 3×2 bike sprite sheet into 6 individual PNGs.
// Usage: node scripts/split-bike-sheet.mjs [path-to-sheet]
//   Defaults to the first PNG found in public/sprites/raw/
//
// Grid layout (columns left→right, rows top→bottom):
//   [0,0] bike-blue    [1,0] bike-green   [2,0] bike-yellow
//   [0,1] bike-orange  [1,1] bike-red     [2,1] bike-purple

import sharp from 'sharp';
import { readdirSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR   = path.join(__dirname, '..', 'public', 'sprites', 'raw');
const SPLIT_DIR = path.join(RAW_DIR, 'split');
mkdirSync(SPLIT_DIR, { recursive: true });

// ── Locate sprite sheet ───────────────────────────────────────────────────────
let sheetPath = process.argv[2];
if (!sheetPath) {
  const files = readdirSync(RAW_DIR).filter(f => f.endsWith('.png') && !f.startsWith('.'));
  if (files.length === 0) {
    console.error('No PNG found in', RAW_DIR);
    console.error('Drop the sprite sheet there, then re-run.');
    process.exit(1);
  }
  sheetPath = path.join(RAW_DIR, files[0]);
}

console.log('Sheet:', sheetPath);
const { width, height } = await sharp(sheetPath).metadata();
console.log(`Dimensions: ${width} × ${height}`);

if (width % 3 !== 0 || height % 2 !== 0) {
  console.warn(`Warning: ${width}×${height} is not evenly divisible by 3×2. Cells may be off by 1px.`);
}

const cellW = Math.floor(width  / 3);
const cellH = Math.floor(height / 2);
console.log(`Cell size: ${cellW} × ${cellH}`);

// ── Cell map ─────────────────────────────────────────────────────────────────
const CELLS = [
  { col: 0, row: 0, name: 'bike-blue'   },
  { col: 1, row: 0, name: 'bike-green'  },
  { col: 2, row: 0, name: 'bike-yellow' },
  { col: 0, row: 1, name: 'bike-orange' },
  { col: 1, row: 1, name: 'bike-red'    },
  { col: 2, row: 1, name: 'bike-purple' },
];

for (const { col, row, name } of CELLS) {
  const left = col * cellW;
  const top  = row * cellH;
  const out  = path.join(SPLIT_DIR, `${name}.png`);

  await sharp(sheetPath)
    .extract({ left, top, width: cellW, height: cellH })
    .png()
    .toFile(out);

  console.log(`  ✓ ${name}.png  (left=${left}, top=${top}, ${cellW}×${cellH})`);
}

console.log('\nSplit complete →', SPLIT_DIR);
