// make-traffic-light-sprites.mjs
// Bake Toy Town traffic-light housing PNGs (red-on / green-on) for TrafficLights.
// Pipeline: SVG → sharp PNG → trim → designed/. Replaces procedural Pixi Graphics housing.
// Visuals only — no gameplay. Play Store / Royal Match chrome bar.

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'sprites', 'designed');
mkdirSync(OUT_DIR, { recursive: true });

// Design canvas — horizontal capsule matching in-game HOUSE_W:HOUSE_H ≈ 62:30 (~2.07:1).
const W = 496, H = 240;
const MAX_DIM = 248; // ~4× display (62×30) for crisp retina

const INK = '#1F1A33';
const HOUSE_TOP = '#3A3550';
const HOUSE_MID = '#2C2742';
const HOUSE_BOT = '#1A1630';
const WELL = '#0E0C18';
const WELL_RIM = '#5A5478';
const RED_ON = '#FF3D3D';
const RED_HOT = '#FF8A8A';
const RED_CORE = '#FFE0E0';
const GREEN_ON = '#2FCC55';
const GREEN_HOT = '#7CFF9A';
const GREEN_CORE = '#E8FFE8';
const OFF = '#3A3552';
const OFF_RIM = '#2A2640';

function housingSvg({ redOn }) {
  // Housing face occupies most of the canvas; leave margin for soft glow + shadow.
  const hx = 48, hy = 58, hw = 400, hh = 124, hr = 62;
  const lip = 10;
  const lx = hx + 110, rx = hx + hw - 110, cy = hy + hh / 2;
  const lampR = 42;
  const leftCol = redOn ? RED_ON : OFF;
  const rightCol = redOn ? OFF : GREEN_ON;
  const leftHot = redOn ? RED_HOT : OFF_RIM;
  const rightHot = redOn ? OFF_RIM : GREEN_HOT;
  const leftCore = redOn ? RED_CORE : 'transparent';
  const rightCore = redOn ? 'transparent' : GREEN_CORE;
  const leftGlow = redOn ? RED_ON : 'transparent';
  const rightGlow = redOn ? 'transparent' : GREEN_ON;
  const leftGlowOp = redOn ? 0.38 : 0;
  const rightGlowOp = redOn ? 0 : 0.38;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="face" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5A5478"/>
      <stop offset="18%" stop-color="${HOUSE_TOP}"/>
      <stop offset="55%" stop-color="${HOUSE_MID}"/>
      <stop offset="100%" stop-color="${HOUSE_BOT}"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="leftLamp" cx="38%" cy="32%" r="72%">
      <stop offset="0%" stop-color="${leftHot}"/>
      <stop offset="55%" stop-color="${leftCol}"/>
      <stop offset="100%" stop-color="${redOn ? '#B01020' : OFF_RIM}"/>
    </radialGradient>
    <radialGradient id="rightLamp" cx="38%" cy="32%" r="72%">
      <stop offset="0%" stop-color="${rightHot}"/>
      <stop offset="55%" stop-color="${rightCol}"/>
      <stop offset="100%" stop-color="${redOn ? OFF_RIM : '#0E8030'}"/>
    </radialGradient>
    <filter id="softGlow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="10" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="drop" x="-20%" y="-10%" width="140%" height="160%">
      <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>

  <!-- Soft ambient plate shadow -->
  <rect x="${hx + 6}" y="${hy + lip + 14}" width="${hw}" height="${hh}" rx="${hr}"
        fill="#000000" opacity="0.28"/>

  <!-- Lip (pressable chunk underface) -->
  <rect x="${hx}" y="${hy + lip}" width="${hw}" height="${hh}" rx="${hr}" fill="#12101C"/>

  <!-- Housing face -->
  <g filter="url(#drop)">
    <rect x="${hx}" y="${hy}" width="${hw}" height="${hh}" rx="${hr}"
          fill="url(#face)" stroke="${INK}" stroke-width="10"/>
  </g>

  <!-- Inner rim light -->
  <rect x="${hx + 10}" y="${hy + 10}" width="${hw - 20}" height="${hh - 20}" rx="${hr - 8}"
        fill="none" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="3"/>

  <!-- Top gloss strip -->
  <rect x="${hx + 28}" y="${hy + 14}" width="${hw - 56}" height="${Math.round(hh * 0.34)}"
        rx="${Math.round(hr * 0.45)}" fill="url(#gloss)"/>

  <!-- Divider rivet between lamps -->
  <circle cx="${hx + hw / 2}" cy="${cy}" r="7" fill="#16122A" stroke="${INK}" stroke-width="3"/>
  <circle cx="${hx + hw / 2 - 2}" cy="${cy - 2}" r="2.2" fill="#FFFFFF" opacity="0.25"/>

  <!-- LEFT lamp well + lamp -->
  <circle cx="${lx}" cy="${cy}" r="${lampR + 10}" fill="${leftGlow}" opacity="${leftGlowOp}" filter="url(#softGlow)"/>
  <circle cx="${lx}" cy="${cy}" r="${lampR + 6}" fill="${WELL}" stroke="${INK}" stroke-width="6"/>
  <circle cx="${lx}" cy="${cy}" r="${lampR + 2}" fill="none" stroke="${WELL_RIM}" stroke-width="3" opacity="0.55"/>
  <circle cx="${lx}" cy="${cy}" r="${lampR}" fill="url(#leftLamp)" stroke="${INK}" stroke-width="5"/>
  ${redOn ? `<circle cx="${lx - 12}" cy="${cy - 12}" r="11" fill="${leftCore}" opacity="0.85"/>
  <circle cx="${lx - 6}" cy="${cy - 6}" r="4" fill="#FFFFFF" opacity="0.55"/>` : `<circle cx="${lx - 10}" cy="${cy - 10}" r="8" fill="#FFFFFF" opacity="0.08"/>`}

  <!-- RIGHT lamp well + lamp -->
  <circle cx="${rx}" cy="${cy}" r="${lampR + 10}" fill="${rightGlow}" opacity="${rightGlowOp}" filter="url(#softGlow)"/>
  <circle cx="${rx}" cy="${cy}" r="${lampR + 6}" fill="${WELL}" stroke="${INK}" stroke-width="6"/>
  <circle cx="${rx}" cy="${cy}" r="${lampR + 2}" fill="none" stroke="${WELL_RIM}" stroke-width="3" opacity="0.55"/>
  <circle cx="${rx}" cy="${cy}" r="${lampR}" fill="url(#rightLamp)" stroke="${INK}" stroke-width="5"/>
  ${!redOn ? `<circle cx="${rx - 12}" cy="${cy - 12}" r="11" fill="${rightCore}" opacity="0.85"/>
  <circle cx="${rx - 6}" cy="${cy - 6}" r="4" fill="#FFFFFF" opacity="0.55"/>` : `<circle cx="${rx - 10}" cy="${cy - 10}" r="8" fill="#FFFFFF" opacity="0.08"/>`}

  <!-- Tiny bracket stub under housing (reads as mounted signal) -->
  <rect x="${hx + hw / 2 - 18}" y="${hy + hh + lip - 2}" width="36" height="22" rx="6"
        fill="#16122A" stroke="${INK}" stroke-width="5"/>
  <rect x="${hx + hw / 2 - 8}" y="${hy + hh + lip + 16}" width="16" height="18" rx="3"
        fill="#0E0C18" stroke="${INK}" stroke-width="4"/>
</svg>`;
}

async function bake(name, redOn) {
  const svg = housingSvg({ redOn });
  const raster = await sharp(Buffer.from(svg)).png().toBuffer();
  const trimmed = await sharp(raster).trim({ threshold: 1 }).toBuffer();
  const meta = await sharp(trimmed).metadata();
  const scale = Math.min(1, MAX_DIM / Math.max(meta.width, meta.height));
  const out = path.join(OUT_DIR, name);
  await sharp(trimmed)
    .resize(Math.round(meta.width * scale), Math.round(meta.height * scale), { fit: 'inside' })
    .png()
    .toFile(out);
  const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const Ww = info.width, Hh = info.height;
  const corners = [data[3], data[(Ww - 1) * 4 + 3], data[((Hh - 1) * Ww) * 4 + 3], data[(((Hh - 1) * Ww) + (Ww - 1)) * 4 + 3]];
  console.log(`${name}  ${Ww}x${Hh}  corners=[${corners.join(',')}]  ${corners.every(a => a === 0) ? 'OK' : 'WARN'}`);
  return out;
}

await bake('traffic-light-red.png', true);
await bake('traffic-light-green.png', false);
console.log('Done ->', OUT_DIR);
