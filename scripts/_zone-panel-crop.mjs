// Crop the bomb-zone / bench boundary so the numeric measurement can be checked
// against what is actually on screen. Fills all three queue slots first, so slot 2
// really holds a bomb (an empty slot proves nothing about clipping).
import { chromium } from 'playwright';
import fs from 'fs';

const LEVELS = process.argv.slice(2).filter((a) => !a.startsWith('--')).map(Number);
const TAG    = process.argv.find((a) => a.startsWith('--tag='))?.split('=')[1] ?? 'now';
const levels = LEVELS.length ? LEVELS : [4, 5, 8];
const OUT = 'docs/review';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });

for (const lv of levels) {
  await page.evaluate((l) => window._nav.startLevel(l), lv);
  await page.waitForTimeout(2200);
  // Dismiss anything modal so the zone is unobstructed.
  for (let i = 0; i < 12; i++) {
    const blocked = await page.evaluate(() => {
      const n = window._nav; n.dismissTutorial?.();
      return n.getGameLoop().paused || n.getDragDrop().inputBlocked;
    });
    if (!blocked) break;
    await page.waitForTimeout(200);
  }
  // Guarantee every column holds a full queue, so slot 2 is occupied.
  const filled = await page.evaluate(async () => {
    const gs = window._nav.getGs();
    const M  = await import('/src/models/Shooter.js');
    for (let c = 0; c < gs.activeColCount; c++) {
      const col = gs.columns[c];
      while (col.shooters.length < 3) {
        col.shooters.push(new M.Shooter({
          color: gs.colors[col.shooters.length % gs.colors.length], damage: 3, column: c,
        }));
      }
    }
    return gs.columns.slice(0, gs.activeColCount).map((c) => c.shooters.length);
  });
  await page.waitForTimeout(700);

  const box = await page.evaluate(async () => {
    const P  = await import('/src/renderer3d/projection.js');
    const SR = await import('/src/renderer/ShooterRenderer.js');
    return { top: SR.SHOOTER_AREA_Y - 10, bottom: SR.SHOOTER_AREA_Y + SR.SHOOTER_AREA_H + 30,
             slot2: P.bombSlotScreenY(2), r: P.bombBallScreenRadius() };
  });
  const file = `${OUT}/zone-${TAG}-L${lv}.png`;
  await page.screenshot({
    path: file,
    clip: { x: 0, y: box.top, width: 390, height: Math.min(box.bottom - box.top, 844 - box.top) },
  });
  console.log(`L${lv} queues=${filled.join(',')}  slot2=${box.slot2.toFixed(1)} r=${box.r.toFixed(2)} -> ${file}`);
}
await browser.close();
