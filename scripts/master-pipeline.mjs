// master-pipeline.mjs
// Splits grid sprite sheets, removes backgrounds, saves to public/sprites/designed/
// All source sprites have front (hood/cab) already facing DOWN — no rotation applied.

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, '..', 'public', 'sprites', 'raw', 'split');
const OUT_DIR = path.join(__dirname, '..', 'public', 'sprites', 'designed');
mkdirSync(OUT_DIR, { recursive: true });

// Flood-fill from edges: removes connected near-white AND near-black background pixels.
function removeBackground(data, width, height) {
  const visited = new Uint8Array(width * height);

  function isBackground(idx) {
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    if (data[idx + 3] === 0) return true;
    // Near-white (low saturation, very bright)
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (r > 230 && g > 230 && b > 230 && sat < 0.25) return true;
    // Near-black
    if (r < 25 && g < 25 && b < 25) return true;
    return false;
  }

  const stack = [];
  function seed(px, py) {
    const i = py * width + px;
    if (!visited[i] && isBackground(i * 4)) { visited[i] = 1; stack.push(i); }
  }

  for (let x = 0; x < width; x++)  { seed(x, 0); seed(x, height - 1); }
  for (let y = 0; y < height; y++) { seed(0, y); seed(width - 1, y); }

  while (stack.length > 0) {
    const i = stack.pop();
    const x = i % width, y = Math.floor(i / width);
    data[i * 4 + 3] = 0;
    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = ny * width + nx;
      if (!visited[ni] && isBackground(ni * 4)) { visited[ni] = 1; stack.push(ni); }
    }
  }
}

async function processBuffer(buf, outPath) {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const pixels = new Uint8Array(data.buffer);
  removeBackground(pixels, width, height);

  await sharp(Buffer.from(pixels), { raw: { width, height, channels: 4 } })
    .png()
    .toFile(outPath);

  const meta = await sharp(outPath).metadata();
  console.log(`  ✓ ${path.basename(outPath)}  ${meta.width}×${meta.height}  alpha:${meta.hasAlpha}`);
}

async function processFile(srcName, outName) {
  const buf = await sharp(path.join(RAW_DIR, srcName)).png().toBuffer();
  await processBuffer(buf, path.join(OUT_DIR, outName));
}

// Column bounds for grids with non-integer cell widths
function colBounds(totalW, numCols, col) {
  const left  = Math.round(col       * totalW / numCols);
  const right = Math.round((col + 1) * totalW / numCols);
  return { left, width: right - left };
}

async function extractCell(srcName, left, top, width, height, outName) {
  const buf = await sharp(path.join(RAW_DIR, srcName))
    .extract({ left, top, width, height })
    .png()
    .toBuffer();
  await processBuffer(buf, path.join(OUT_DIR, outName));
}

// ── Individual files ───────────────────────────────────────────────────────
console.log('Individual files:');
await processFile('cargo_blue.webp',    'van-blue.png');
await processFile('cargo_red.png',      'van-red.png');
await processFile('pickup_purple.webp', 'truck-purple.png');
await processFile('tank.webp',          'tank.png');

// ── cargo_other.webp: 4 cols × 1 row → green / yellow / orange / purple vans
console.log('\nVan grid (cargo_other.webp — 4×1):');
const CARGO_W = 1568, CARGO_H = 784;
const vanColors = ['green', 'yellow', 'orange', 'purple'];
for (let col = 0; col < 4; col++) {
  const { left, width } = colBounds(CARGO_W, 4, col);
  await extractCell('cargo_other.webp', left, 0, width, CARGO_H, `van-${vanColors[col]}.png`);
}

// ── pickup.webp: 3 cols × 2 rows → 5 trucks (col 0 row 1 is empty)
console.log('\nTruck grid (pickup.webp — 3×2, 5 vehicles):');
const PICKUP_CELL = 448;
const truckCells = [
  { col: 0, row: 0, color: 'red'    },
  { col: 1, row: 0, color: 'blue'   },
  { col: 2, row: 0, color: 'green'  },
  { col: 0, row: 1, color: 'yellow' },
  { col: 1, row: 1, color: 'orange' },
];
for (const { col, row, color } of truckCells) {
  await extractCell('pickup.webp',
    col * PICKUP_CELL, row * PICKUP_CELL, PICKUP_CELL, PICKUP_CELL,
    `truck-${color}.png`);
}

// ── truck.webp: 3 cols × 2 rows → 6 big rigs (896×1344, non-integer col width)
console.log('\nBig rig grid (truck.webp — 3×2):');
const BIGRIG_W = 896, BIGRIG_H = 1344;
const bigrigColors = [['red','blue','green'], ['yellow','orange','purple']];
for (let row = 0; row < 2; row++) {
  const top    = Math.round(row       * BIGRIG_H / 2);
  const cellH  = Math.round((row + 1) * BIGRIG_H / 2) - top;
  for (let col = 0; col < 3; col++) {
    const { left, width } = colBounds(BIGRIG_W, 3, col);
    await extractCell('truck.webp', left, top, width, cellH, `bigrig-${bigrigColors[row][col]}.png`);
  }
}

console.log('\n=== Pipeline complete ===');
console.log('Output:', OUT_DIR);
