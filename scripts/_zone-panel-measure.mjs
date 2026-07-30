// Measure the bomb-zone panel against the slots it must contain.
//
// Question (2026-07-31): the third bomb row is clipped at the zone panel's bottom
// edge. Two candidates:
//   (a) the panel rect is too short — its height does not derive from real slot
//       extent (slot 2 centre + ball radius + padding)
//   (b) slot 2 genuinely overflows the vertical budget into the bench
// These are distinguished by two signed gaps, measured live:
//   panelBottom - slot2Bottom   negative => (a) the panel clips a correct slot
//   benchTop    - slot2Bottom   negative => (b) the slot really is in the bench
import { chromium } from 'playwright';

const LEVELS = process.argv.slice(2).map(Number);
const levels = LEVELS.length ? LEVELS : [4, 5, 8];

const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });

for (const lv of levels) {
  await page.evaluate((l) => window._nav.startLevel(l), lv);
  await page.waitForTimeout(2000);

  const m = await page.evaluate(async () => {
    const P  = await import('/src/renderer3d/projection.js');
    const SR = await import('/src/renderer/ShooterRenderer.js');
    const BR = await import('/src/renderer/BenchRenderer.js');
    const gs = window._nav.getGs();
    const r  = P.bombBallScreenRadius();
    const slots = [0, 1, 2].map((i) => P.bombSlotScreenY(i));
    const slot2Bottom = slots[2] + r;
    const panelTop    = SR.SHOOTER_AREA_Y;
    const panelBottom = SR.SHOOTER_AREA_Y + SR.SHOOTER_AREA_H;
    return {
      lanes: gs.activeLaneCount, gridRows: gs.gridRows,
      band: P.bandForLaneCount(gs.activeLaneCount), pxPerWu: P.PX_PER_WU,
      ballR: r, slots, slot2Bottom,
      panelTop, panelBottom, panelH: SR.SHOOTER_AREA_H,
      // What the height formula is actually built from today:
      slot35Y: P.bombSlotScreenY(3.5),
      benchTop: BR.benchY(), benchSlotH: BR.benchSlotH(),
      appH: 844,
    };
  });

  console.log(`\n=== L${lv}  lanes=${m.lanes}  band=${m.band}  gridRows=${m.gridRows}  PX_PER_WU=${m.pxPerWu.toFixed(2)} ===`);
  console.log(`  ball radius          : ${m.ballR.toFixed(2)}`);
  console.log(`  slot centres 0/1/2   : ${m.slots.map((v) => v.toFixed(1)).join('   ')}`);
  console.log(`  slot 2 bottom edge   : ${m.slot2Bottom.toFixed(1)}`);
  console.log(`  panel top / bottom   : ${m.panelTop.toFixed(1)} / ${m.panelBottom.toFixed(1)}  (H=${m.panelH})`);
  console.log(`  bench top            : ${m.benchTop.toFixed(1)}  (slotH ${m.benchSlotH.toFixed(1)})`);
  console.log(`  bombSlotScreenY(3.5) : ${m.slot35Y.toFixed(1)}   <- what panel H derives from today`);
  console.log(`  panelBottom - slot2Bottom = ${(m.panelBottom - m.slot2Bottom).toFixed(1)}  ${m.panelBottom - m.slot2Bottom < 0 ? '<< NEGATIVE -> (a) panel clips a correctly-placed slot' : '(panel contains slot 2)'}`);
  console.log(`  benchTop    - slot2Bottom = ${(m.benchTop - m.slot2Bottom).toFixed(1)}  ${m.benchTop - m.slot2Bottom < 0 ? '<< NEGATIVE -> (b) slot really overflows into the bench' : '(slot 2 clears the bench)'}`);
}

await browser.close();
