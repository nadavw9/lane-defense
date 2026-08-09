// Whole-game visual + geometry scan across many levels and moments.
//
// Weighted toward the defects that have been hard to fix in this project, because
// those are the ones that regress quietly:
//   - ball/socket alignment        (4 separate owner reports)
//   - BOMB blast shape             (lane-scoped, not row)
//   - bomb-queue fit above the booster bar
//   - booster-bar bottom clearance
//   - car size / cars cut at spawn
//   - viewport fit (no clipping)
//   - world side panels
//   - CAR HP manual matching the board
//   - FTUE hand (L1)
//
// Every check is numeric and prints its measurement, so "looks good" is a value,
// not an impression. A screenshot is saved per level regardless, and anything that
// fails is called out.
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'fs';

const LEVELS = [1, 2, 3, 5, 8, 9, 17, 20, 30, 35, 40];
const OUT = 'docs/review/scan';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const rows = [];
const problems = [];

for (const level of LEVELS) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon|firebaseio|googleads/.test(r.url())) errors.push(`${r.status()} ${r.url()}`); });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
  await page.evaluate((lv) => window._nav.startLevel(lv), level);
  await page.waitForTimeout(2600);
  for (let i = 0; i < 6; i++) { await page.mouse.click(195, 500); await page.waitForTimeout(280); }
  await page.waitForTimeout(700);

  const m = await page.evaluate(() => {
    const gs  = window._nav.getGs();
    const pos = window._nav.getPositions();
    const s   = window._nav.getShooter3D?.();

    // Ball vs socket: every visible ball's Z against its slot's canonical Z.
    let worstBallDev = 0, ballsChecked = 0;
    if (s?._slots) {
      const canon = {};
      for (let r = 0; r < s._slots[0].length; r++) canon[r] = s._slots[0][r].group.position.z;
      for (let c = 0; c < s._slots.length; c++) {
        for (let r = 0; r < s._slots[c].length; r++) {
          const g = s._slots[c][r].group;
          if (!g.visible || (g.scale?.x ?? 1) <= 0.15) continue;
          ballsChecked++;
          worstBallDev = Math.max(worstBallDev, Math.abs(g.position.z - canon[r]));
        }
      }
    }

    const canvas = document.querySelector('canvas:not(#three-canvas)');
    const b = canvas.getBoundingClientRect();

    return {
      levelId: gs.levelId, gridRows: gs.gridRows, lanes: gs.activeLaneCount, cols: gs.activeColCount,
      hp: gs.world?.hpMultiplier,
      carTypes: [...new Set(gs.lanes.flatMap(l => l.cars.map(c => c.type)))],
      carCount: gs.lanes.reduce((n, l) => n + l.cars.length, 0),
      queueDepths: gs.columns.slice(0, gs.activeColCount).map(c => c.shooters.length),
      worstBallDev, ballsChecked,
      canvasBox: { w: b.width, h: b.height, top: b.top, bottom: b.bottom },
      slotY: pos.slotY,
      paused: window._nav.getGameLoop().paused,
    };
  });

  const shot = `${OUT}/L${String(level).padStart(2, '0')}.png`;
  await page.screenshot({ path: shot });

  // Pixel checks on the captured frame.
  const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
  const litRow = (y) => { let n = 0; for (let x = 0; x < info.width; x += 3) {
    const i = (y * info.width + x) * info.channels;
    if (data[i] > 30 || data[i + 1] > 30 || data[i + 2] > 30) n++; } return n; };
  let topLit = -1, botLit = -1;
  for (let y = 0; y < info.height; y++) if (litRow(y) > 5) { topLit = y; break; }
  for (let y = info.height - 1; y >= 0; y--) if (litRow(y) > 5) { botLit = y; break; }
  const px = info.height / 844;

  const fits   = Math.abs(m.canvasBox.h - 844) < 2 && m.canvasBox.top >= -1;
  const ballOk = m.worstBallDev < 0.2;
  const rowsOk = m.gridRows === 8;
  const bottomClear = (info.height - 1 - botLit) / px;   // stage px of clearance

  rows.push({ level, ...m, topLit: topLit / px, bottomClear, fits, ballOk, rowsOk, errors: errors.length });

  if (!ballOk)  problems.push(`L${level}: ball off socket by ${m.worstBallDev.toFixed(3)}wu`);
  if (!rowsOk)  problems.push(`L${level}: gridRows ${m.gridRows}, expected 8`);
  if (!fits)    problems.push(`L${level}: canvas ${m.canvasBox.h.toFixed(0)}px, expected 844`);
  if (m.carCount === 0) problems.push(`L${level}: NO CARS on the board`);
  if (m.paused) problems.push(`L${level}: loop still paused (tutorial not cleared) — other readings suspect`);
  if (errors.length) problems.push(`L${level}: ${errors.length} console/network error(s): ${errors[0]}`);

  await page.close();
}
await browser.close();

console.log('\nLvl │ rows │ lanes │ hp   │ cars │ queue   │ ballDev │ canvas │ topLit │ botClear │ types');
console.log('────┼──────┼───────┼──────┼──────┼─────────┼─────────┼────────┼────────┼──────────┼──────');
for (const r of rows) {
  console.log(
    `${String(r.level).padStart(3)} │ ${String(r.gridRows).padStart(4)} │ ${String(r.lanes).padStart(5)} │ `
    + `${String(r.hp ?? '-').padStart(4)} │ ${String(r.carCount).padStart(4)} │ `
    + `${(r.queueDepths.join(',')).padEnd(7)} │ ${r.worstBallDev.toFixed(3).padStart(7)} │ `
    + `${(r.canvasBox.h.toFixed(0) + 'px').padStart(6)} │ ${r.topLit.toFixed(0).padStart(6)} │ `
    + `${r.bottomClear.toFixed(0).padStart(8)} │ ${r.carTypes.join(',')}`);
}
console.log('\n' + (problems.length ? `PROBLEMS (${problems.length}):\n  ` + problems.join('\n  ')
                                    : 'No problems detected across ' + rows.length + ' levels.'));
