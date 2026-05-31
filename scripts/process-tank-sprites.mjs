// process-tank-sprites.mjs
// Processes the 6 colored tank raws into the designed/ sprite folder.
// Raws already have clean alpha (transparent background), so we only:
//   1. trim the transparent margin (so the body fills the frame consistently)
//   2. downscale so the longest side is <= MAX_DIM (crisp, sane texture memory)
//
// Output: public/sprites/designed/tank-<color>.png
// These replace the single colorless tank.png for the colour-match mechanic.

import sharp from 'sharp';
import path from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '..', 'public', 'sprites', 'raw', 'split');
const OUT = path.join(__dirname, '..', 'public', 'sprites', 'designed');
mkdirSync(OUT, { recursive: true });

const COLORS  = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'];
const MAX_DIM = 512;

// Flood-fill near-white background from the edges → alpha 0.
// Most tank raws already ship transparent (no-op); tank-green was exported on a
// solid white background, which trim() can't remove because the pixels are opaque.
function floodFillWhite(data, width, height, threshold = 210, satThreshold = 0.25) {
  const visited = new Uint8Array(width * height);
  const isBg = (idx) => {
    const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
    if (a === 0) return true;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    return r > threshold && g > threshold && b > threshold && sat < satThreshold;
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

for (const c of COLORS) {
  const src = path.join(RAW, `tank-${c}.png`);
  const out = path.join(OUT, `tank-${c}.png`);

  // 1. Strip any solid background to transparency (flood-fill from edges).
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8Array(data.buffer);
  floodFillWhite(pixels, info.width, info.height);

  // 2. Trim the now-transparent margin, then clamp longest side to MAX_DIM.
  const trimmed = await sharp(Buffer.from(pixels), { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .trim({ threshold: 1 })
    .toBuffer();

  const meta  = await sharp(trimmed).metadata();
  const scale = Math.min(1, MAX_DIM / Math.max(meta.width, meta.height));
  const w     = Math.round(meta.width  * scale);
  const h     = Math.round(meta.height * scale);

  await sharp(trimmed).resize(w, h).png().toFile(out);
  const m = await sharp(out).metadata();
  console.log(`  tank-${c}.png  ${m.width}x${m.height}  alpha:${m.hasAlpha}`);
}

console.log('Done -> ' + OUT);
