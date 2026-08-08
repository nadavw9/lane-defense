// BOMB booster: does it clear ONE LANE, or a ROW across lanes?
//
// Driven entirely through the REAL input path — a real click on the real BOMB
// button rect, then a real click on a real car's screen point. This project has
// seen the programmatic and drag paths diverge, so nothing here calls
// placeBombOnLane() directly.
//
// The discriminator only works if, at the moment of the blast, some OTHER lane has
// a car on the SAME ROW as the tapped car. Otherwise lane-clear and row-clear are
// observationally identical and the probe would "confirm" whichever one it assumed.
// So the probe SEARCHES for that board state and refuses to report without it.
//
// Cars are tagged before firing: _settleAfterClear() can refill, and a fresh car
// standing where a dead one was would otherwise read as a survivor.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
await page.evaluate(() => window._nav.startLevel(8));
await page.waitForTimeout(2500);
for (let i = 0; i < 6; i++) { await page.mouse.click(195, 500); await page.waitForTimeout(350); }
await page.waitForTimeout(600);

const pre = await page.evaluate(() => ({
  paused: window._nav.getGameLoop().paused,
  blocked: window._nav.getDragDrop().inputBlocked,
}));
console.log('preflight:', JSON.stringify(pre));
if (pre.paused) { console.log('!! paused — VOID'); await browser.close(); process.exit(1); }

await page.evaluate(() => window._nav.setBoosters(0, 0, 3));

// Wait for a board where two different lanes share a row.
let board = null;
for (let t = 0; t < 40; t++) {
  board = await page.evaluate(() => window._nav.getCarScreenPositions());
  const byRow = {};
  for (const c of board) (byRow[c.row] ??= new Set()).add(c.lane);
  const shared = Object.entries(byRow).filter(([, s]) => s.size >= 2);
  if (shared.length) { board._shared = shared.map(([r, s]) => [Number(r), [...s]]); break; }
  await page.waitForTimeout(700);
}
const byRow = {};
for (const c of board) (byRow[c.row] ??= new Set()).add(c.lane);
const shared = Object.entries(byRow).filter(([, s]) => s.size >= 2)
  .map(([r, s]) => ({ row: Number(r), lanes: [...s] }));
if (!shared.length) {
  console.log('!! never reached a board with two lanes sharing a row — CANNOT DISCRIMINATE');
  await browser.close(); process.exit(1);
}

const pick = shared[0];
const targetLane = pick.lanes[0];
const witnessLane = pick.lanes[1];
const target = board.find(c => c.lane === targetLane && c.row === pick.row);

console.log('\nBOARD BEFORE (lane/row → colour hp @ screen):');
for (const c of board.slice().sort((a, b) => a.lane - b.lane || a.row - b.row))
  console.log(`   lane ${c.lane} row ${String(c.row).padStart(2)}  ${String(c.color).padEnd(6)} hp=${String(c.hp).padStart(3)}`
    + `  @(${c.x.toFixed(0)},${c.y.toFixed(0)})${c === target ? '   <== TAP TARGET' : ''}`);
console.log(`\nshared row ${pick.row} occupied by lanes [${pick.lanes.join(', ')}]`);
console.log(`tapping lane ${targetLane} row ${pick.row}; WITNESS = lane ${witnessLane} row ${pick.row}`);
console.log('  lane-clear  => every car in lane ' + targetLane + ' dies, witness SURVIVES');
console.log('  row-clear   => cars on row ' + pick.row + ' across lanes die, witness DIES\n');

await page.evaluate(() => { let n = 0;
  window.__tags = new Map();
  for (const [li, lane] of window._nav.getGs().lanes.entries())
    for (const c of lane.cars) { c.__tag = `T${n++}`; window.__tags.set(c.__tag, { lane: li, row: c.row }); }
});
await page.screenshot({ path: 'docs/review/_bomb-before.png' });

// REAL activation: click the actual BOMB button rect.
const bombBtn = await page.evaluate(() => window._nav.getHudBounds().boosterBomb);
console.log('BOMB button rect:', JSON.stringify(bombBtn));
await page.mouse.click(bombBtn.x + bombBtn.w / 2, bombBtn.y + bombBtn.h / 2);
await page.waitForTimeout(400);
const armed = await page.evaluate(() => window._nav.freezeState && window._nav.getGs()
  ? window.__armed ?? null : null);
const modeOn = await page.evaluate(() => {
  const d = window._nav.getDragDrop();
  return { bombMode: d._boosterState?.bombMode ?? null, bombs: d._boosterState?.bombs ?? null };
});
console.log('after clicking BOMB button:', JSON.stringify(modeOn));
if (!modeOn.bombMode) { console.log('!! bomb mode never armed — the tap did not land. VOID.'); await browser.close(); process.exit(1); }

// REAL placement: click the target car.
await page.mouse.click(target.x, target.y);
await page.waitForTimeout(900);
await page.screenshot({ path: 'docs/review/_bomb-after.png' });

const result = await page.evaluate(() => {
  const alive = new Set();
  for (const lane of window._nav.getGs().lanes) for (const c of lane.cars) if (c.__tag) alive.add(c.__tag);
  const out = [];
  for (const [tag, info] of window.__tags) out.push({ ...info, tag, alive: alive.has(tag) });
  return { out, bombs: window._nav.getDragDrop()._boosterState?.bombs,
           bombMode: window._nav.getDragDrop()._boosterState?.bombMode };
});
console.log(`\nbombs left=${result.bombs}  bombMode=${result.bombMode}`);
console.log('\nOUTCOME (tagged cars only — refills excluded):');
for (const r of result.out.sort((a, b) => a.lane - b.lane || a.row - b.row))
  console.log(`   lane ${r.lane} row ${String(r.row).padStart(2)}  ${r.alive ? 'SURVIVED' : 'DIED    '}`
    + `${r.lane === targetLane ? '  [target lane]' : ''}${r.lane === witnessLane && r.row === pick.row ? '  <== WITNESS' : ''}`);

const targetLaneCars = result.out.filter(r => r.lane === targetLane);
const witness = result.out.find(r => r.lane === witnessLane && r.row === pick.row);
const otherLaneDeaths = result.out.filter(r => r.lane !== targetLane && !r.alive);
console.log(`\ntarget lane ${targetLane}: ${targetLaneCars.filter(r => !r.alive).length}/${targetLaneCars.length} died`);
console.log(`witness (lane ${witnessLane} row ${pick.row}): ${witness ? (witness.alive ? 'SURVIVED' : 'DIED') : 'n/a'}`);
console.log(`deaths outside the target lane: ${otherLaneDeaths.length}`
  + (otherLaneDeaths.length ? '  <-- ' + otherLaneDeaths.map(r => `L${r.lane}r${r.row}`).join(' ') : ''));
console.log('\nVERDICT: ' + (otherLaneDeaths.length === 0
  ? 'LANE-ONLY (correct)' : '*** BLAST CROSSED LANES — bug reproduced ***'));
await browser.close();
