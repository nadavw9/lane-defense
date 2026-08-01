// TASK 1 — the user reports a BOMB detonation kills cars in the target LANE *and*
// across the row. Measure the actual kill SHAPE in the live game.
//
// Tags every car with (lane,row) before firing, fires BOMB at a known lane/row,
// then reports exactly which tagged cars survived. A lane-only clear must leave
// every car outside the target lane alive.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
await page.evaluate(() => window._nav.startLevel(8));
await page.waitForTimeout(2500);

const out = await page.evaluate(async () => {
  const nav = window._nav, gs = nav.getGs(), gl = nav.getGameLoop(), dd = nav.getDragDrop();
  for (let i = 0; i < 60 && (gl.paused || dd.inputBlocked); i++) { nav.dismissTutorial(); await new Promise((r) => setTimeout(r, 100)); }

  const M = await import('/src/models/Car.js');
  const TARGET_LANE = 1, TARGET_ROW = 3;

  // Deterministic grid: every active lane gets a car at rows 1..4, distinct colours
  // so a colour-based clear would also be distinguishable from a lane/row clear.
  const before = [];
  for (let l = 0; l < gs.activeLaneCount; l++) {
    gs.lanes[l].cars.length = 0;
    for (let r = 1; r <= 4; r++) {
      const car = new M.Car({ color: gs.colors[(l + r) % gs.colors.length], hp: 3, speed: 5 });
      car.hp = 3; car.row = r; car.position = r * 12;
      car.__tag = `L${l}R${r}`;
      gs.lanes[l].cars.push(car);
      before.push({ tag: car.__tag, lane: l, row: r, color: car.color });
    }
  }

  // Give the player a bomb charge and fire it at (TARGET_LANE, TARGET_ROW).
  const bs = nav.getGameLoop()._boosterState ?? null;
  const hadBooster = !!bs;
  if (bs) bs.bombs = Math.max(1, bs.bombs);
  gl.placeBombOnLane(TARGET_LANE, TARGET_ROW);
  await new Promise((r) => setTimeout(r, 600));

  const aliveTags = new Set();
  for (let l = 0; l < gs.activeLaneCount; l++) for (const c of gs.lanes[l].cars) if (c.__tag) aliveTags.add(c.__tag);

  return {
    hadBooster, targetLane: TARGET_LANE, targetRow: TARGET_ROW,
    activeLanes: gs.activeLaneCount,
    killed: before.filter((b) => !aliveTags.has(b.tag)),
    survived: before.filter((b) => aliveTags.has(b.tag)),
  };
});

console.log(`\nBOMB KILL SHAPE — fired at lane ${out.targetLane}, row ${out.targetRow} (L8, ${out.activeLanes} lanes)`);
console.log(`boosterState present: ${out.hadBooster}\n`);
const grid = {};
for (const k of out.killed)   grid[`${k.lane},${k.row}`] = 'X';
for (const s of out.survived) grid[`${s.lane},${s.row}`] = '.';
console.log('    ' + Array.from({ length: out.activeLanes }, (_, l) => `lane${l}`).join(' '));
for (let r = 1; r <= 4; r++) {
  console.log(`row${r}  ` + Array.from({ length: out.activeLanes }, (_, l) => `  ${grid[`${l},${r}`] ?? '?'}  `).join(' '));
}
console.log('\nX = destroyed   . = survived');
const strays = out.killed.filter((k) => k.lane !== out.targetLane);
console.log(`\nkilled in target lane : ${out.killed.filter((k) => k.lane === out.targetLane).length} / 4`);
console.log(`killed OUTSIDE lane   : ${strays.length}  ${strays.length ? '<<< BUG: ' + strays.map((s) => s.tag).join(',') : '(none — lane-only, correct)'}`);
await browser.close();
