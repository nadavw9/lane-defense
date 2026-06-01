// make-bomb-icon.mjs
// Builds a NON-rainbow charcoal BOMB booster icon (row-clear booster) and writes
// it to public/sprites/designed/booster-bomb.png, overwriting the rainbow one.
//
// Why generated, not recolored: the source booster-bomb.png is a rainbow
// gradient; desaturating it yields uneven grey BANDS (rainbow hues differ in
// luminance), not a clean charcoal body. So we render a fresh charcoal bomb
// (dark metallic body + lit fuse/spark + orange blast burst) — zero rainbow,
// reserving rainbow exclusively for the COLOR BOMB mechanic.
//
// Pipeline: SVG -> raster (sharp) -> trim transparent margin -> downscale to 128.

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'sprites', 'designed', 'booster-bomb.png');

const CX = 236, CY = 318, R = 150;   // bomb body center + radius
const MAX_DIM = 128;

// Orange comic blast burst behind the bomb (spikes peeking out around the body).
function blastSpikes() {
  const spikes = [];
  const N = 12;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.12;
    const halfW = 0.13;            // angular half-width of each spike base
    const inner = R - 6, outer = R + 64;
    const bx1 = CX + Math.cos(a - halfW) * inner, by1 = CY + Math.sin(a - halfW) * inner;
    const bx2 = CX + Math.cos(a + halfW) * inner, by2 = CY + Math.sin(a + halfW) * inner;
    const tx  = CX + Math.cos(a) * outer,         ty  = CY + Math.sin(a) * outer;
    spikes.push(`<polygon points="${bx1.toFixed(1)},${by1.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)} ${bx2.toFixed(1)},${by2.toFixed(1)}"/>`);
  }
  return spikes.join('');
}

const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="body" cx="38%" cy="30%" r="78%">
      <stop offset="0%"  stop-color="#5b616e"/>
      <stop offset="45%" stop-color="#34373f"/>
      <stop offset="100%" stop-color="#14161c"/>
    </radialGradient>
    <radialGradient id="spark" cx="50%" cy="50%" r="50%">
      <stop offset="0%"  stop-color="#fff7c8"/>
      <stop offset="45%" stop-color="#ffd23d"/>
      <stop offset="100%" stop-color="#ff8a00"/>
    </radialGradient>
  </defs>

  <!-- Orange blast burst behind the bomb (row-clear cue) -->
  <g fill="#ff8a1e" opacity="0.50">${blastSpikes()}</g>
  <g fill="#ffc24d" opacity="0.40" transform="rotate(15 ${CX} ${CY})">${blastSpikes()}</g>

  <!-- Fuse cord -->
  <path d="M236 188 Q302 56 374 96" fill="none" stroke="#26282f" stroke-width="17" stroke-linecap="round"/>
  <path d="M236 188 Q302 56 374 96" fill="none" stroke="#4c505b" stroke-width="6"  stroke-linecap="round" opacity="0.6"/>

  <!-- Fuse cap -->
  <rect x="212" y="150" width="48" height="46" rx="9" fill="#23252b" stroke="#0c0d11" stroke-width="7"/>

  <!-- Bomb body -->
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#body)" stroke="#0b0c10" stroke-width="11"/>
  <!-- sheen + occlusion -->
  <ellipse cx="186" cy="262" rx="48" ry="31" fill="#b6bdca" opacity="0.42"/>
  <ellipse cx="300" cy="392" rx="64" ry="42" fill="#000000" opacity="0.20"/>

  <!-- Lit spark at the fuse tip -->
  <g transform="translate(374,96)">
    <g stroke="#ffb02e" stroke-width="10" stroke-linecap="round">
      <line x1="0" y1="-50" x2="0" y2="-24"/><line x1="0" y1="50" x2="0" y2="24"/>
      <line x1="-50" y1="0" x2="-24" y2="0"/><line x1="50" y1="0" x2="24" y2="0"/>
      <line x1="-35" y1="-35" x2="-17" y2="-17"/><line x1="35" y1="35" x2="17" y2="17"/>
      <line x1="-35" y1="35" x2="-17" y2="17"/><line x1="35" y1="-35" x2="17" y2="-17"/>
    </g>
    <circle cx="0" cy="0" r="22" fill="url(#spark)"/>
  </g>
</svg>`;

const raster  = await sharp(Buffer.from(svg)).png().toBuffer();
const trimmed = await sharp(raster).trim({ threshold: 1 }).toBuffer();
const meta    = await sharp(trimmed).metadata();
const scale   = Math.min(1, MAX_DIM / Math.max(meta.width, meta.height));
await sharp(trimmed).resize(Math.round(meta.width * scale), Math.round(meta.height * scale)).png().toFile(OUT);

// Verify corners are transparent.
const { data, info } = await sharp(OUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const corners = [data[3], data[(W - 1) * 4 + 3], data[((H - 1) * W) * 4 + 3], data[(((H - 1) * W) + (W - 1)) * 4 + 3]];
console.log(`booster-bomb.png  ${W}x${H}  corners=[${corners.join(',')}]  ${corners.every(a => a === 0) ? 'OK' : 'WARN'}`);
