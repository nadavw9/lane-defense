// process-building-sprites.mjs
// Processes the 10 theme-building raws (industrial-1..5, night-1..5) into the
// designed/ folder for the Phase 3 theme-building swap.
//
// Defensive background removal: flood-fill from the four edges, stripping BOTH
// near-WHITE and near-BLACK opaque backgrounds (night buildings were generated
// on black backgrounds and externally cleaned — some carry residual opaque
// edges that plain transparent-margin trimming cannot catch).
//
// Pipeline per file:
//   1. flood-fill bg (white OR black, edge-connected) -> alpha 0
//   2. VERIFY the four full-frame corners are alpha=0 (report any that aren't)
//   3. trim the transparent margin
//   4. downscale so the longest side <= MAX_DIM
//
// Output: public/sprites/designed/building-<set>-<n>.png

import sharp from 'sharp';
import path from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '..', 'public', 'sprites', 'raw', 'split');
const OUT = path.join(__dirname, '..', 'public', 'sprites', 'designed');
mkdirSync(OUT, { recursive: true });

const MAX_DIM = 512;
const NAMES = [];
for (const set of ['industrial', 'night']) {
  for (let i = 1; i <= 5; i++) NAMES.push(`building-${set}-${i}`);
}

// Edge-seeded flood-fill removing near-white AND near-black backgrounds.
// Interior dark windows / bright signs are safe because only pixels connected
// to an image edge through background are cleared.
function floodFillBg(data, width, height, {
  whiteThresh = 205, blackThresh = 34, satThresh = 0.28,
} = {}) {
  const visited = new Uint8Array(width * height);
  const isBg = (idx) => {
    const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
    if (a === 0) return true;                         // already transparent
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const nearWhite = r > whiteThresh && g > whiteThresh && b > whiteThresh && sat < satThresh;
    const nearBlack = max < blackThresh;              // all channels dark
    return nearWhite || nearBlack;
  };
  const stack = [];
  const seed = (px, py) => { const i = py * width + px; if (!visited[i] && isBg(i * 4)) { visited[i] = 1; stack.push(i); } };
  for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
  for (let y = 0; y < height; y++) { seed(0, y); seed(width - 1, y); }
  while (stack.length) {
    const i = stack.pop();
    data[i * 4 + 3] = 0;
    const x = i % width, y = Math.floor(i / width);
    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = ny * width + nx;
      if (!visited[ni] && isBg(ni * 4)) { visited[ni] = 1; stack.push(ni); }
    }
  }
}

const report = [];

for (const name of NAMES) {
  const src = path.join(RAW, `${name}.png`);
  const out = path.join(OUT, `${name}.png`);

  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const pixels = new Uint8Array(data.buffer);

  floodFillBg(pixels, W, H);

  // Verify the four full-frame corners are transparent after bg removal.
  const cornerAlpha = [
    pixels[(0) * 4 + 3],
    pixels[((W - 1)) * 4 + 3],
    pixels[((H - 1) * W) * 4 + 3],
    pixels[(((H - 1) * W) + (W - 1)) * 4 + 3],
  ];
  const allClear = cornerAlpha.every(a => a === 0);
  report.push({ name, cornerAlpha, allClear });

  const trimmed = await sharp(Buffer.from(pixels), { raw: { width: W, height: H, channels: 4 } })
    .png()
    .trim({ threshold: 1 })
    .toBuffer();

  const meta  = await sharp(trimmed).metadata();
  const scale = Math.min(1, MAX_DIM / Math.max(meta.width, meta.height));
  const w     = Math.round(meta.width  * scale);
  const h     = Math.round(meta.height * scale);
  await sharp(trimmed).resize(w, h).png().toFile(out);

  const m = await sharp(out).metadata();
  console.log(`  ${name}.png  ${m.width}x${m.height}  corners=[${cornerAlpha.join(',')}]  ${allClear ? 'OK' : 'WARN residual opaque corner'}`);
}

console.log('\n--- Corner verification summary ---');
const bad = report.filter(r => !r.allClear);
if (bad.length === 0) {
  console.log('All 10 buildings: four corners transparent (alpha=0). No box defects.');
} else {
  console.log('Buildings with residual opaque corners (would have shown as boxes):');
  for (const b of bad) console.log(`  ${b.name}: corner alpha = [${b.cornerAlpha.join(',')}]`);
}
console.log('Done -> ' + OUT);
