// process-sprites-sharp.mjs
// Processes all raw sprites for the Lane Defense sprite feature.
//
// Buildings: splits 2×2 sheet into 4 individual tiles.
// Powerball / breach-warning: flood-fill white background removal.
// Explosion: already has alpha — normalize to output dir.
// Road-tile: center-crop to remove vignette edges for clean tiling.

import sharp from 'sharp';
import path from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '..', 'public', 'sprites', 'raw', 'split');
const OUT = path.join(__dirname, '..', 'public', 'sprites', 'designed');
mkdirSync(OUT, { recursive: true });

// ── Background removal (flood-fill from edges) ─────────────────────────────

function floodFillBackground(data, width, height, threshold = 210, satThreshold = 0.25) {
  const visited = new Uint8Array(width * height);

  function isBackground(idx) {
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    return r > threshold && g > threshold && b > threshold && sat < satThreshold;
  }

  const stack = [];
  function seed(px, py) {
    const i = py * width + px;
    if (!visited[i] && isBackground(i * 4)) { visited[i] = 1; stack.push(i); }
  }

  for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
  for (let y = 0; y < height; y++) { seed(0, y); seed(width - 1, y); }

  while (stack.length > 0) {
    const i = stack.pop();
    data[i * 4 + 3] = 0;
    const x = i % width, y = Math.floor(i / width);
    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = ny * width + nx;
      if (!visited[ni] && isBackground(ni * 4)) { visited[ni] = 1; stack.push(ni); }
    }
  }
}

async function removeBg(src, outName, threshold, satThreshold) {
  const outPath = path.join(OUT, outName);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8Array(data.buffer);
  floodFillBackground(pixels, info.width, info.height, threshold ?? 210, satThreshold ?? 0.25);
  await sharp(Buffer.from(pixels), { raw: { width: info.width, height: info.height, channels: 4 } })
    .png().toFile(outPath);
  const m = await sharp(outPath).metadata();
  console.log(`  ✓ ${outName}  ${m.width}×${m.height}  alpha:${m.hasAlpha}`);
}

// ── 1. Split building-top.png 2×2 → 4 individual buildings ────────────────

async function splitBuildings() {
  console.log('\n[1] Splitting building-top.png → 4 tiles...');
  const src = path.join(RAW, 'building-top.png');
  const meta = await sharp(src).metadata();
  const hw = Math.floor(meta.width / 2);
  const hh = Math.floor(meta.height / 2);

  const positions = [
    { left: 0,  top: 0,  name: 'building-1.png' },
    { left: hw, top: 0,  name: 'building-2.png' },
    { left: 0,  top: hh, name: 'building-3.png' },
    { left: hw, top: hh, name: 'building-4.png' },
  ];

  for (const { left, top, name } of positions) {
    const outPath = path.join(OUT, name);
    await sharp(src)
      .extract({ left, top, width: hw, height: hh })
      .png()
      .toFile(outPath);
    const m = await sharp(outPath).metadata();
    console.log(`  ✓ ${name}  ${m.width}×${m.height}  alpha:${m.hasAlpha}`);
  }
}

// ── 2. Powerball sprites — remove white bg ─────────────────────────────────

async function processPowerballs() {
  console.log('\n[2] Processing powerball sprites...');
  const colors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'];
  for (const c of colors) {
    await removeBg(path.join(RAW, `powerball-${c}.png`), `powerball-${c}.png`);
  }
}

// ── 3. Breach warning — remove white bg ───────────────────────────────────

async function processBreachWarning() {
  console.log('\n[3] Processing breach-warning.png...');
  // Slightly tighter threshold — the hazard stripe has white in it
  await removeBg(path.join(RAW, 'breach-warning.png'), 'breach-warning.png', 200, 0.15);
}

// ── 4. Explosion — already has alpha, just normalize ──────────────────────

async function processExplosion() {
  console.log('\n[4] Processing explosion.png...');
  const outPath = path.join(OUT, 'explosion.png');
  await sharp(path.join(RAW, 'explosion.png')).ensureAlpha().png().toFile(outPath);
  const m = await sharp(outPath).metadata();
  console.log(`  ✓ explosion.png  ${m.width}×${m.height}  alpha:${m.hasAlpha}`);
}

// ── 5. Road tile — center-crop to remove dark vignette, flatten alpha ─────
// Source 1024×1024 has a dark vignette border that won't tile cleanly.
// Crop 800×800 center → resize to 512×512 → JPEG (no alpha, clean tiling).

async function processRoadTile() {
  console.log('\n[5] Processing road-tile.png...');
  const cropSize = 800;
  const offset = Math.floor((1024 - cropSize) / 2);
  const outPath = path.join(OUT, 'road-tile.jpg');
  await sharp(path.join(RAW, 'road-tile.png'))
    .extract({ left: offset, top: offset, width: cropSize, height: cropSize })
    .resize(512, 512)
    .flatten({ background: { r: 80, g: 80, b: 80 } })
    .jpeg({ quality: 92 })
    .toFile(outPath);
  const m = await sharp(outPath).metadata();
  console.log(`  ✓ road-tile.jpg  ${m.width}×${m.height}  alpha:${m.hasAlpha}`);
}

// ── Run all ────────────────────────────────────────────────────────────────

console.log('=== Processing Lane Defense sprites ===');
await splitBuildings();
await processPowerballs();
await processBreachWarning();
await processExplosion();
await processRoadTile();
console.log('\n=== Done → ' + OUT + ' ===');
