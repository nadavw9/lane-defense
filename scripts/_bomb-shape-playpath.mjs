// TASK 1, attempt 2 — the API is lane-only, so drive the REAL PLAY PATH instead:
// arm bombMode the way the booster button does, then dispatch a genuine pointer
// tap on the road, and report the kill shape. This is what the player does.
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

  const M  = await import('/src/models/Car.js');
  const PR = await import('/src/renderer/PositionRegistry.js');
  const RG = await import('/src/renderer/roadGeometry.js');

  const TARGET_LANE = 1, TARGET_ROW = 3;
  const before = [];
  for (let l = 0; l < gs.activeLaneCount; l++) {
    gs.lanes[l].cars.length = 0;
    for (let r = 1; r <= 4; r++) {
      const car = new M.Car({ color: gs.colors[(l + r) % gs.colors.length], hp: 3, speed: 5 });
      car.hp = 3; car.row = r; car.position = r * 12;
      car.__tag = `L${l}R${r}`;
      gs.lanes[l].cars.push(car);
      before.push({ tag: car.__tag, lane: l, row: r });
    }
  }

  // Arm bomb mode exactly as the booster button does.
  const bs = gl._boosterState;
  bs.bombs = Math.max(1, bs.bombs);
  if (typeof bs.activateBomb === 'function') bs.activateBomb();
  else bs.bombMode = true;
  const armed = !!bs.bombMode;

  // Tap the road at the target lane/row, through the REAL canvas + pointer events.
  const x = PR.getLaneScreenX(TARGET_LANE);
  const y = RG.posToScreenY ? RG.posToScreenY(TARGET_ROW * 12) : 400;
  const c = document.querySelector('canvas:not(#three-canvas)');
  const rect = c.getBoundingClientRect();
  const opts = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true,
                 clientX: rect.left + (x / 390) * rect.width, clientY: rect.top + (y / 844) * rect.height };
  c.dispatchEvent(new PointerEvent('pointerdown', opts));
  c.dispatchEvent(new PointerEvent('pointerup', opts));
  await new Promise((r) => setTimeout(r, 800));

  const alive = new Set();
  for (let l = 0; l < gs.activeLaneCount; l++) for (const cc of gs.lanes[l].cars) if (cc.__tag) alive.add(cc.__tag);
  return {
    armed, tapX: x, tapY: y, activeLanes: gs.activeLaneCount,
    targetLane: TARGET_LANE, targetRow: TARGET_ROW,
    killed: before.filter((b) => !alive.has(b.tag)),
    survived: before.filter((b) => alive.has(b.tag)),
  };
});

console.log(`\nBOMB KILL SHAPE via REAL PLAY PATH — tap at lane ${out.targetLane}, row ${out.targetRow}`);
console.log(`bombMode armed: ${out.armed}   tap=(${out.tapX?.toFixed(0)}, ${out.tapY?.toFixed(0)})\n`);
const grid = {};
for (const k of out.killed)   grid[`${k.lane},${k.row}`] = 'X';
for (const s of out.survived) grid[`${s.lane},${s.row}`] = '.';
console.log('    ' + Array.from({ length: out.activeLanes }, (_, l) => `lane${l}`).join(' '));
for (let r = 1; r <= 4; r++) {
  console.log(`row${r}  ` + Array.from({ length: out.activeLanes }, (_, l) => `  ${grid[`${l},${r}`] ?? '?'}  `).join(' '));
}
const strays = out.killed.filter((k) => k.lane !== out.targetLane);
console.log(`\nkilled total ${out.killed.length}   in target lane ${out.killed.filter((k) => k.lane === out.targetLane).length}`);
console.log(strays.length ? `KILLED OUTSIDE TARGET LANE: ${strays.map((s) => s.tag).join(', ')}  <<< BUG REPRODUCED`
                          : 'nothing killed outside the target lane — lane-only');
await browser.close();
