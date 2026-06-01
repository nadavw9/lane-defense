// process-booster-sprites.mjs
// Processes the 3 booster icon raws (swap, freeze, bomb) into designed/.
// Raws ship with clean alpha, so this is: defensive edge flood-fill (white OR
// black, in case of residual matte) + transparent-margin trim + downscale.
//
// Output: public/sprites/designed/booster-<name>.png (square-ish, <=128px)

import sharp from 'sharp';
import path from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '..', 'public', 'sprites', 'raw', 'split');
const OUT = path.join(__dirname, '..', 'public', 'sprites', 'designed');
mkdirSync(OUT, { recursive: true });

const NAMES   = ['booster-swap', 'booster-freeze', 'booster-bomb'];
const MAX_DIM = 128;

function floodFillBg(data, width, height, { whiteThresh = 205, blackThresh = 24, satThresh = 0.28 } = {}) {
  const visited = new Uint8Array(width * height);
  const isBg = (idx) => {
    const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
    if (a === 0) return true;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const nearWhite = r > whiteThresh && g > whiteThresh && b > whiteThresh && sat < satThresh;
    const nearBlack = max < blackThresh;
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

for (const name of NAMES) {
  const src = path.join(RAW, `${name}.png`);
  const out = path.join(OUT, `${name}.png`);

  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const pixels = new Uint8Array(data.buffer);
  floodFillBg(pixels, W, H);

  const corner = [pixels[3], pixels[(W - 1) * 4 + 3], pixels[((H - 1) * W) * 4 + 3], pixels[(((H - 1) * W) + (W - 1)) * 4 + 3]];

  const trimmed = await sharp(Buffer.from(pixels), { raw: { width: W, height: H, channels: 4 } })
    .png().trim({ threshold: 1 }).toBuffer();
  const meta  = await sharp(trimmed).metadata();
  const scale = Math.min(1, MAX_DIM / Math.max(meta.width, meta.height));
  await sharp(trimmed).resize(Math.round(meta.width * scale), Math.round(meta.height * scale)).png().toFile(out);

  const m = await sharp(out).metadata();
  console.log(`  ${name}.png  ${m.width}x${m.height}  corners=[${corner.join(',')}]  ${corner.every(a => a === 0) ? 'OK' : 'WARN'}`);
}
console.log('Done -> ' + OUT);
