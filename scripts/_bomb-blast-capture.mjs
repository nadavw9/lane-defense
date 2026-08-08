// Capture the BOMB blast mid-cascade. argv[2] = 'BEFORE' | 'AFTER'.
//
// spawnBombExplosion fires each lane 80ms apart, so a single screenshot taken at a
// guessed moment can miss the sweep entirely and "prove" whatever you expected.
// This grabs a strip of frames across the whole cascade window instead.
import { chromium } from 'playwright';

const TAG = process.argv[2] ?? 'BEFORE';
const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
await page.evaluate(() => window._nav.startLevel(8));
await page.waitForTimeout(2500);
for (let i = 0; i < 6; i++) { await page.mouse.click(195, 500); await page.waitForTimeout(350); }
await page.waitForTimeout(600);
await page.evaluate(() => window._nav.setBoosters(0, 0, 3));

// Need at least two lanes occupied, or the blast shape is not observable.
let board = [];
for (let t = 0; t < 40; t++) {
  board = await page.evaluate(() => window._nav.getCarScreenPositions());
  if (new Set(board.map(c => c.lane)).size >= 2) break;
  await page.waitForTimeout(700);
}
const lanes = [...new Set(board.map(c => c.lane))].sort();
const targetLane = lanes[0];
const target = board.filter(c => c.lane === targetLane).sort((a, b) => a.row - b.row)[0];
console.log(`lanes occupied: [${lanes.join(',')}]  tapping lane ${targetLane} row ${target.row} @(${target.x.toFixed(0)},${target.y.toFixed(0)})`);
console.log('other lanes must show NO blast effect:', lanes.filter(l => l !== targetLane).join(','));

const btn = await page.evaluate(() => window._nav.getHudBounds().boosterBomb);
await page.mouse.click(btn.x + btn.w / 2, btn.y + btn.h / 2);
await page.waitForTimeout(350);
const armed = await page.evaluate(() => window._nav.getDragDrop()._boosterState?.bombMode);
if (!armed) { console.log('!! bomb mode not armed — VOID'); await browser.close(); process.exit(1); }

await page.mouse.click(target.x, target.y);
// The cascade is nLanes * 80ms; sample across and past it.
const marks = [70, 150, 230, 310];
let prev = 0;
for (const ms of marks) {
  await page.waitForTimeout(ms - prev); prev = ms;
  await page.screenshot({ path: `docs/review/_blast-${TAG}-${String(ms).padStart(3, '0')}ms.png`,
    clip: { x: 0, y: 0, width: 390, height: 560 } });
}
console.log(`${TAG}: captured ${marks.length} frames across the cascade`);
await browser.close();
