// TASK 2 — what band does the bottom-chrome reclaim permit, and what car growth
// follows? REPORT ONLY.
//
// projection.js has no band setter (DESIGN_ROAD_BOTTOM_Y is module-private and set
// by setActiveLaneCount via bandForLaneCount), so this REPLICATES computeFrustum's
// documented formula with the band as a parameter, using the module's own exported
// constants. Labelled as a replica deliberately: it is a model for answering "what
// if", not a second source of truth for shipped geometry.
import {
  ROAD_Z_FAR, ROAD_Z_NEAR, SPAWN_VIEWPORT_EXTRA, DESIGN_ROAD_TOP_Y,
  APP_H, CELL, MERGE_SCALE, SOCKET_SHADOW_RATIO, MAX_CAR_FIT,
} from '../src/renderer3d/projection.js';

const BOOSTER_H = 68;          // BoosterBar BAR_H — three 64px cards + padding
const QUEUE_BOTTOM_MARGIN = 12;
const CEIL = 0.82, MIN_LEGIBLE = 0.45;
const STRIPE = 8, MARGIN = 6;
const BENCH_GAP = 4, BENCH_PAD = 4, BENCH_BAR_GAP = 2, BENCH_MIN = 28;

function frustum(band) {
  const roadZSpan = ROAD_Z_NEAR - ROAD_Z_FAR;
  const pixiRoadH = band - DESIGN_ROAD_TOP_Y;
  const fHalfZ    = roadZSpan * APP_H / (2 * pixiRoadH);
  const topFrac   = DESIGN_ROAD_TOP_Y / APP_H;
  const baseCenter = ROAD_Z_FAR + fHalfZ * (1 - 2 * topFrac);
  const bottomZ = baseCenter + fHalfZ;
  const topZ    = ROAD_Z_FAR - SPAWN_VIEWPORT_EXTRA;
  const halfZe  = (bottomZ - topZ) / 2;
  const zToY = (z) => ((z - topZ) / (2 * halfZe)) * APP_H;
  const yToZ = (y) => topZ + (y / APP_H) * 2 * halfZe;
  return { zToY, yToZ, pxPerWu: zToY(1) - zToY(0), breach: zToY(ROAD_Z_NEAR) };
}

// Largest queue scale whose LAST REAL slot (index 2, incl. socket ring) leaves room
// for bench + booster bar. NOTE: shipped solves for slot 3 (the retired stash) and
// against the ball edge, not the socket — see the H4 note in THREE_LANE_REDESIGN.
function solveScale(band, barY, { lastSlot = 2, useSocket = true, benchMin = BENCH_MIN } = {}) {
  const F = frustum(band);
  const need = BENCH_GAP + BENCH_PAD + benchMin + BENCH_PAD + BENCH_BAR_GAP;
  const limit = barY - need;
  const edge = (scale) => {
    const bombR = CELL * 0.266 * scale, pitch = CELL * 0.70 * scale;
    const worstR = bombR * MERGE_SCALE * F.pxPerWu;
    const slot0ZMin = F.yToZ(F.breach + STRIPE + MARGIN + worstR);
    const clearanceZ = Math.max(0, slot0ZMin - 0.5 * pitch);
    return F.zToY((lastSlot + 0.5) * pitch + clearanceZ) + bombR * F.pxPerWu * (useSocket ? SOCKET_SHADOW_RATIO : 1);
  };
  let lo = 0.02, hi = CEIL;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (edge(m) <= limit) lo = m; else hi = m; }
  return { scale: lo, F, edge: edge(lo), limit, need };
}

// Reference-car methodology: body_px = FIT * rowPitchWu * pxPerWu ; gap/car = (1-FIT)/FIT
const rowPitchWu = (gridRows) => (ROAD_Z_NEAR - ROAD_Z_FAR) / gridRows;
const carPx = (band, gridRows, fit) => fit * rowPitchWu(gridRows) * frustum(band).pxPerWu;

const BASE_BAND = 600, GRID = 8, FIT = 0.671;   // shipped pilot: 2.00x at ~0.49-car gap
const basePx = carPx(BASE_BAND, GRID, FIT);

console.log('SHIPPED BASELINE (3-lane pilot)');
console.log(`  band ${BASE_BAND}  gridRows ${GRID}  FIT ${FIT}  pxPerWu ${frustum(BASE_BAND).pxPerWu.toFixed(2)}`);
console.log(`  breach ${frustum(BASE_BAND).breach.toFixed(1)}   car body ${basePx.toFixed(1)}px   gap/car ${((1 - FIT) / FIT).toFixed(2)}`);

console.log('\nRECLAIM LEDGER (3-lane, band 600)');
console.log('  move mute/level/coin/pause to top bar ...  +0px  (they share the BOOSTER row gutters,');
console.log('                                                   not a row of their own — HUDRenderer ROW_MID 786)');
console.log('  merge bench into the queue panel ........  +8px  (BENCH_QUEUE_GAP 4 + BENCH_TRAY_PAD 4)');
console.log('  booster row flush to bottom edge ........ +24px  (dead strip 820-844)');
console.log('  remove the "two dots" gap ...............  +0px  (those are bench EMPTY-SLOT markers;');
console.log('                                                   the gap IS the bench tray)');
console.log('  ------------------------------------------------');
console.log('  TOTAL VERTICAL RECLAIM ................. +32px   -> booster bar top 752 -> 776');

console.log('\nWHAT BAND THAT PERMITS  (bench held at its 28px touch floor)');
console.log('band │ barY │ scale  │ ballR │ breach │ car px │ vs shipped │ gap/car │ verdict');
console.log('─────┼──────┼────────┼───────┼────────┼────────┼────────────┼─────────┼─────────');
for (const band of [600, 640, 680, 700, 730, 760]) {
  for (const barY of [776]) {
    const s = solveScale(band, barY);
    const ballR = CELL * 0.266 * s.scale * s.F.pxPerWu;
    const px = carPx(band, GRID, FIT);
    const ok = s.scale >= MIN_LEGIBLE;
    console.log(`${String(band).padStart(4)} │ ${barY} │ ${s.scale.toFixed(4)} │ ${ballR.toFixed(1).padStart(5)} │ `
      + `${s.F.breach.toFixed(1).padStart(6)} │ ${px.toFixed(1).padStart(6)} │ ${(px / basePx).toFixed(3).padStart(10)}x │ `
      + `${((1 - FIT) / FIT).toFixed(2).padStart(7)} │ ${ok ? 'ok' : 'BELOW 0.45 LEGIBILITY FLOOR'}`);
  }
}

console.log('\nFIT NEEDED FOR A FULL CAR-LENGTH GAP (gap/car = 1.00 -> FIT 0.500)');
for (const band of [600, 730]) {
  const px = carPx(band, GRID, 0.500);
  console.log(`  band ${band}: car body ${px.toFixed(1)}px  (${(px / basePx).toFixed(2)}x shipped)  gap/car 1.00`);
}

console.log('\nDOES THE RECLAIM FIX THE 5.15px QUEUE/BENCH OVERFLOW?');
for (const [band, barY, tag] of [[600, 752, 'shipped'], [600, 776, 'with +24px reclaim']]) {
  const s = solveScale(band, barY);
  console.log(`  band ${band} barY ${barY} (${tag}): solved scale ${s.scale.toFixed(4)}, `
    + `last-slot socket edge ${s.edge.toFixed(2)} vs limit ${s.limit.toFixed(2)} -> ${s.edge <= s.limit + 0.01 ? 'FITS' : 'OVERFLOW'}`);
}
console.log('\nCAN THE BENCH RISE ABOVE ITS 28px FLOOR (band 600, barY 776)?');
for (const benchMin of [28, 34, 40, 50]) {
  const s = solveScale(600, 776, { benchMin });
  const ballR = CELL * 0.266 * s.scale * s.F.pxPerWu;
  console.log(`  bench ${String(benchMin).padStart(2)}px -> queue scale ${s.scale.toFixed(4)} (ball r ${ballR.toFixed(1)}px) ${s.scale >= MIN_LEGIBLE ? '' : ' << below legibility floor'}`);
}
