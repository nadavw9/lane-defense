// generate-sprites.js — generates 6 top-down car-type sprites as 256x256 PNGs.
//
// Sprites are drawn in NEUTRAL WHITE (#FFFFFF body, #CCCCCC outline). Colour
// tinting happens at runtime via the PIXI sprite `tint` property in Car2D.js —
// never baked into the file. Cars face UPWARD (toward the top of the canvas);
// in the top-down game view cars drive toward the top of the screen.
//
// Run: node tools/generate-sprites.js
// Output: public/sprites/cars/types/sprite-<type>.png  (x6)
//
// Uses @napi-rs/canvas (prebuilt, no native build step — reliable on Windows
// with Node 24). The original spec called for the `canvas` package; @napi-rs
// is a drop-in Canvas2D-API replacement and the deliverable (the 6 PNGs) is
// identical.

import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = join(__dirname, '..', 'public', 'sprites', 'cars', 'types');

const SIZE   = 256;
const BODY   = '#FFFFFF';
const LINE   = '#CCCCCC';
const GLASS  = 'rgba(51,51,51,0.7)';   // #333333 @ 0.7
const WHEEL  = '#444444';
const DETAIL = '#CCCCCC';

// ── Canvas helpers ─────────────────────────────────────────────────────────────

function newCtx() {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx    = canvas.getContext('2d');
  ctx.clearRect(0, 0, SIZE, SIZE);   // fully transparent background
  ctx.lineJoin = 'round';
  ctx.lineCap  = 'round';
  return { canvas, ctx };
}

// Rounded rectangle path (cx,cy = CENTRE of the rect).
function roundRectCentered(ctx, cx, cy, w, h, r) {
  const x = cx - w / 2, y = cy - h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y,     x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x,     y + h, rr);
  ctx.arcTo(x,     y + h, x,     y,     rr);
  ctx.arcTo(x,     y,     x + w, y,     rr);
  ctx.closePath();
}

function fillStrokeRR(ctx, cx, cy, w, h, r, { fill = BODY, stroke = LINE, lw = 3 } = {}) {
  roundRectCentered(ctx, cx, cy, w, h, r);
  if (fill)   { ctx.fillStyle   = fill;   ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function ellipse(ctx, cx, cy, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

// 4 wheel humps peeking out from the body sides (top-down view).
function wheels(ctx, halfBodyW, topY, botY, rx = 12.5, ry = 17.5) {
  const C = SIZE / 2;
  const xs = [C - halfBodyW, C + halfBodyW];
  const ys = [topY, botY];
  for (const x of xs) for (const y of ys) ellipse(ctx, x, y, rx, ry, WHEEL);
}

function save(canvas, name) {
  mkdirSync(OUT_DIR, { recursive: true });
  const file = join(OUT_DIR, name);
  writeFileSync(file, canvas.toBuffer('image/png'));
  console.log('  wrote', file);
}

// ── Per-type drawing ───────────────────────────────────────────────────────────
const C = SIZE / 2;

function drawBike() {
  const { canvas, ctx } = newCtx();
  // Narrow body (40px wide, ~160 tall, centred).
  fillStrokeRR(ctx, C, C, 40, 150, 14);
  // Front wheel (top) + rear wheel (bottom): tall ovals, 30w x 45h.
  ellipse(ctx, C, C - 78, 15, 22.5, WHEEL);
  ellipse(ctx, C, C + 78, 15, 22.5, WHEEL);
  // Rider suggestion: dark oval in centre.
  ellipse(ctx, C, C, 13, 26, GLASS);
  save(canvas, 'sprite-bike.png');
}

function drawSedan() {
  const { canvas, ctx } = newCtx();
  // Body 110x160.
  fillStrokeRR(ctx, C, C, 110, 160, 16);
  wheels(ctx, 55, C - 50, C + 50);
  // Windshield (front/top) 80x40, rear window 70x30.
  fillStrokeRR(ctx, C, C - 44, 80, 40, 10, { fill: GLASS, stroke: null });
  fillStrokeRR(ctx, C, C + 50, 70, 30, 10, { fill: GLASS, stroke: null });
  // Roof ridge line suggestion.
  ctx.strokeStyle = DETAIL; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(C, C - 18); ctx.lineTo(C, C + 28); ctx.stroke();
  save(canvas, 'sprite-sedan.png');
}

function drawVan() {
  const { canvas, ctx } = newCtx();
  // Boxier 130x155.
  fillStrokeRR(ctx, C, C, 130, 155, 14);
  wheels(ctx, 65, C - 48, C + 50, 13, 18);
  // Flat front: windshield nearly full width at very top, 110x50.
  fillStrokeRR(ctx, C, C - 50, 110, 50, 8, { fill: GLASS, stroke: null });
  // Roof rack suggestion: 2 thin grey lines across.
  ctx.strokeStyle = DETAIL; ctx.lineWidth = 3;
  for (const dy of [-6, 26]) {
    ctx.beginPath(); ctx.moveTo(C - 50, C + dy); ctx.lineTo(C + 50, C + dy); ctx.stroke();
  }
  save(canvas, 'sprite-van.png');
}

function drawTruck() {
  const { canvas, ctx } = newCtx();
  const topY = C - 87;             // total 175 tall
  // Cab section (top 100px).
  fillStrokeRR(ctx, C, topY + 50, 120, 100, 14);
  // Flatbed section (bottom 75px): open rectangle with rails.
  fillStrokeRR(ctx, C, topY + 100 + 37, 120, 75, 8, { fill: 'rgba(255,255,255,0.25)', stroke: LINE });
  // Cab windshield.
  fillStrokeRR(ctx, C, topY + 28, 86, 38, 10, { fill: GLASS, stroke: null });
  // Cab/flatbed division line.
  ctx.strokeStyle = LINE; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(C - 60, topY + 100); ctx.lineTo(C + 60, topY + 100); ctx.stroke();
  wheels(ctx, 60, topY + 30, topY + 130);
  save(canvas, 'sprite-truck.png');
}

function drawBigrig() {
  const { canvas, ctx } = newCtx();
  const topY = C - 105;            // tallest, 210
  // Cab (top 80px).
  fillStrokeRR(ctx, C, topY + 40, 120, 80, 14);
  // Grille suggestion at very top: horizontal grey lines.
  ctx.strokeStyle = DETAIL; ctx.lineWidth = 3;
  for (const dy of [10, 18, 26]) {
    ctx.beginPath(); ctx.moveTo(C - 44, topY + dy); ctx.lineTo(C + 44, topY + dy); ctx.stroke();
  }
  // Cab windshield.
  fillStrokeRR(ctx, C, topY + 58, 90, 30, 8, { fill: GLASS, stroke: null });
  // Trailer (bottom 130px), slightly narrower (100 wide), plain panel.
  fillStrokeRR(ctx, C, topY + 80 + 65, 100, 130, 10);
  // Trailer panel seams.
  ctx.strokeStyle = DETAIL; ctx.lineWidth = 2;
  for (const dy of [-30, 0, 30]) {
    ctx.beginPath(); ctx.moveTo(C - 44, topY + 145 + dy); ctx.lineTo(C + 44, topY + 145 + dy); ctx.stroke();
  }
  // 6 wheels: 4 on cab, 2 rear axle on trailer.
  wheels(ctx, 60, topY + 22, topY + 66);
  ellipse(ctx, C - 50, topY + 195, 12, 16, WHEEL);
  ellipse(ctx, C + 50, topY + 195, 12, 16, WHEEL);
  save(canvas, 'sprite-bigrig.png');
}

function drawTank() {
  const { canvas, ctx } = newCtx();
  // Wide tracked body 150x150.
  // Track panels both sides: dark grey, 20 wide, full height.
  const trackH = 150, trackTop = C - 75;
  for (const tx of [C - 65, C + 65]) {
    roundRectCentered(ctx, tx, C, 20, trackH, 6);
    ctx.fillStyle = WHEEL; ctx.fill();
    // Tread ticks.
    ctx.strokeStyle = '#333333'; ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const y = trackTop + 8 + i * (trackH - 16) / 8;
      ctx.beginPath(); ctx.moveTo(tx - 10, y); ctx.lineTo(tx + 10, y); ctx.stroke();
    }
  }
  // Main hull 110x130.
  fillStrokeRR(ctx, C, C, 110, 130, 12);
  // Rotating turret: circle 60 dia.
  ctx.beginPath(); ctx.arc(C, C, 30, 0, Math.PI * 2);
  ctx.fillStyle = BODY; ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = 3; ctx.stroke();
  // Hatch suggestion.
  ellipse(ctx, C + 8, C + 6, 7, 5, GLASS);
  // Gun barrel: 10x70 extending upward (facing direction).
  fillStrokeRR(ctx, C, C - 30 - 35, 10, 70, 3, { fill: BODY, stroke: LINE, lw: 2 });
  save(canvas, 'sprite-tank.png');
}

// ── Run ────────────────────────────────────────────────────────────────────────

console.log('Generating top-down car sprites →', OUT_DIR);
drawBike();
drawSedan();
drawVan();
drawTruck();
drawBigrig();
drawTank();
console.log('Done. 6 sprites generated.');
