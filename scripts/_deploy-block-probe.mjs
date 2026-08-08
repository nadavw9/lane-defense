// TASK 4 — READ-ONLY. Confirm the turn-based deploy restriction and describe the
// feedback the player gets. Nothing here changes behaviour.
//
// Two guards exist and they do NOT agree:
//   DragDrop.js:394   if (this._firingSlots[laneIdx]) snapBack()   <- SAME lane only
//   GameLoop.js:108   if (any firingSlot is non-null) return       <- ANY lane
// So dropping into a DIFFERENT lane during a shot passes DragDrop's guard, plays
// the whole fly-into-lane animation, and is then silently refused by GameLoop.
//
// Earlier runs of this probe reported "rejected" when the drag had merely snapped
// back on a COLOUR MISMATCH (DragDrop.js:389) — deploys require the bomb colour to
// match the lane's front car. Every drop here is colour-matched on purpose.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
await page.evaluate(() => window._nav.startLevel(8));
await page.waitForTimeout(2500);
for (let i = 0; i < 6; i++) { await page.mouse.click(195, 500); await page.waitForTimeout(350); }
await page.waitForTimeout(800);

const pos = await page.evaluate(() => window._nav.getPositions());
const GRAB_Y = 600;
const snap = () => page.evaluate(() => ({
  queues:   window._nav.getGs().columns.map(c => c.shooters.length),
  inFlight: Object.values(window._nav.getGs().firingSlots).filter(Boolean).length,
  // Refills change queue DEPTHS independently of deploys — an earlier run read a
  // refill as an accepted deploy. totalDeploys only moves on an accepted deploy.
  deploys:  window._nav.getGs().totalDeploys,
}));

// Colour-matched (column, lane) pairs: bomb colour == lane front-car colour.
const pairs = () => page.evaluate(() => {
  const gs = window._nav.getGs();
  const out = [];
  gs.columns.forEach((col, ci) => {
    const bomb = col.top(); if (!bomb) return;
    gs.lanes.forEach((lane, li) => {
      if (li >= gs.activeLaneCount) return;
      const front = lane.cars[0];
      if (front && front.color === bomb.color) out.push({ col: ci, lane: li, color: bomb.color });
    });
  });
  return out;
});

async function drag(colIdx, laneIdx) {
  await page.evaluate(() => { window._nav.getDragDrop()._state = 'idle'; });
  await page.mouse.move(pos.colX[colIdx], GRAB_Y);
  await page.mouse.down();
  await page.mouse.move(pos.laneX[laneIdx], 300, { steps: 5 });
  const mid = await page.evaluate(() => window._nav.getDragDrop()._state);
  await page.mouse.up();
  return mid;
}

// Burn the hint card that intercepts the first pickup (DragDrop.js:290).
const p0 = await pairs();
if (p0.length) await drag(p0[0].col, p0[0].lane);
await page.waitForTimeout(300);
for (let i = 0; i < 4; i++) { await page.mouse.click(195, 500); await page.waitForTimeout(300); }
await page.waitForTimeout(1800);

let ok = false;
for (let attempt = 0; attempt < 12 && !ok; attempt++) {
  const ps = await pairs();
  // Need two matched pairs in DIFFERENT lanes to test the cross-lane case.
  const first = ps[0];
  // Only the LANE must differ — that is the case DragDrop's per-lane guard misses.
  const second = ps.find(q => first && q.lane !== first.lane);
  if (!first || !second) { await page.waitForTimeout(700); continue; }

  const q0 = await snap();
  const m1 = await drag(first.col, first.lane);
  await page.waitForTimeout(20);
  const s1 = await snap();
  if (s1.deploys === q0.deploys) { await page.waitForTimeout(600); continue; }

  console.log(`\ndeploy 1 ACCEPTED: col ${first.col} -> lane ${first.lane} (${first.color}), midState=${m1}`);
  console.log(`   deploys ${q0.deploys} -> ${s1.deploys}, inFlight=${s1.inFlight}`);
  if (!s1.inFlight) { console.log('   (flight window already closed — retrying)'); await page.waitForTimeout(700); continue; }

  const m2 = await drag(second.col, second.lane);
  const s2 = await snap();
  const dd = await page.evaluate(() => {
    const d = window._nav.getDragDrop();
    return { state: d._state, hasGhost: !!d._ghost };
  });
  const consumed = s2.deploys !== s1.deploys;
  console.log(`\ndeploy 2 into a DIFFERENT lane while lane ${first.lane} is still firing:`);
  console.log(`   col ${second.col} -> lane ${second.lane} (${second.color}), midState=${m2}`);
  console.log(`   deploys ${s1.deploys} -> ${s2.deploys}`);
  console.log(`   ${consumed ? 'ACCEPTED' : 'REJECTED — bomb NOT consumed, it stays in the queue'}`);
  console.log(`   DragDrop immediately after release: ${JSON.stringify(dd)}`);
  if (!consumed) {
    console.log(dd.state === 'flying'
      ? '   >>> FALSE SUCCESS: the bomb is flying into the lane even though the deploy was refused.'
      : `   >>> rejected with DragDrop state=${dd.state} (snap-back would be visible feedback)`);
  }
  ok = true;
}
if (!ok) console.log('\n!! never got two colour-matched pairs in different lanes — INCONCLUSIVE, not a pass');
await browser.close();
