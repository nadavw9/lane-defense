// TASK 1 #4/#5 — does a bomb labelled N actually subtract N, and what does a
// colour mismatch do? Verified in the LIVE game, not by code-read.
//
// Method: force a known (bomb damage, car HP, colour) pairing, deploy, then read
// the real hp delta out of GameState. Separate script — the validated harness is
// not modified.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
await page.evaluate(() => window._nav.startLevel(5));
await page.waitForTimeout(2500);

const out = await page.evaluate(async () => {
  const nav = window._nav, gs = nav.getGs(), gl = nav.getGameLoop();
  const dd  = nav.getDragDrop();
  const inFlight = () => Object.values(gs.firingSlots).some((s) => s !== null) || (gs.hitStopRemaining ?? 0) > 0;
  const settle = async () => {
    for (let i = 0; i < 200 && (inFlight() || gl.paused || dd.inputBlocked); i++) {
      nav.dismissTutorial(); await new Promise((r) => setTimeout(r, 50));
    }
  };
  const results = [];

  // (bombDamage, carHp, colourMatches) — includes the mismatch case and the one
  // survivable matched case on this config (dmg 2 vs hp 3).
  const CASES = [
    { dmg: 2, hp: 3, match: true },
    { dmg: 3, hp: 3, match: true },
    { dmg: 8, hp: 3, match: true },
    { dmg: 5, hp: 2, match: true },
    { dmg: 10, hp: 3, match: false },
    { dmg: 2,  hp: 3, match: false },
  ];

  for (const cs of CASES) {
    await settle();
    if (gs.isOver) break;
    const lane = gs.lanes[0];
    // Rebuild a deterministic board: exactly ONE car, so carry-over cannot
    // confound the reading.
    lane.cars.length = 0;
    for (let l = 1; l < gs.activeLaneCount; l++) gs.lanes[l].cars.length = 0;
    const M = await import('/src/models/Car.js');
    const carColor = gs.colors[0];
    const car = new M.Car({ color: carColor, hp: cs.hp, speed: 5 });
    car.row = 3; car.position = 40; car.hp = cs.hp;
    lane.addCar(car);

    // Force the queue's top bomb to the exact damage/colour under test.
    const top = gs.columns[0].shooters[0];
    if (!top) { results.push({ ...cs, err: 'no bomb in column 0' }); continue; }
    top.damage = cs.dmg;
    top.color  = cs.match ? carColor : (gs.colors.find((c) => c !== carColor) ?? carColor);

    // PRECONDITION: the car under test must BE the front car and the bomb under
    // test must BE the one that fires. A refill can insert a car ahead of ours,
    // in which case the shot lands elsewhere and a 0 delta means nothing.
    const frontIsOurs = lane.frontCar() === car;
    const firingBomb  = gs.columns[0].top?.() ?? gs.columns[0].shooters[0];
    const bombIsOurs  = firingBomb === top;
    const hpBefore = car.hp;
    if (!frontIsOurs || !bombIsOurs) {
      results.push({ ...cs, precondition: `frontIsOurs=${frontIsOurs} bombIsOurs=${bombIsOurs}`,
        frontHp: lane.frontCar()?.hp ?? null, firingDmg: firingBomb?.damage ?? null,
        firingColor: firingBomb?.color ?? null, laneCars: lane.cars.length });
      continue;
    }
    nav.deploy(0, 0);
    for (let i = 0; i < 200 && inFlight(); i++) await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 250));

    const stillThere = lane.cars.includes(car);
    results.push({
      bombDamage: cs.dmg, carHp: hpBefore, colourMatch: cs.match,
      survived: stillThere,
      hpAfter: stillThere ? car.hp : null,
      hpRemoved: stillThere ? hpBefore - car.hp : hpBefore,
    });
  }
  return results;
});

console.log('\n#4/#5 LIVE DAMAGE TRUTH (L5, single car per lane so carry-over cannot confound)\n');
console.log('bomb dmg │ car HP │ colour   │ result    │ HP removed │ expected');
console.log('─────────┼────────┼──────────┼───────────┼────────────┼──────────');
for (const r of out) {
  if (r.err) { console.log('  (' + r.err + ')'); continue; }
  if (r.precondition) { console.log('  SKIPPED dmg=' + r.dmg + ' hp=' + r.hp + ' match=' + r.match + ' -> ' + r.precondition + '  (laneCars=' + r.laneCars + ' frontHp=' + r.frontHp + ' firingDmg=' + r.firingDmg + ')'); continue; }
  const expected = !r.colourMatch ? 0 : Math.min(r.bombDamage, r.carHp);
  const verdict = r.hpRemoved === expected ? '' : '   <<< MISMATCH';
  console.log(
    `${String(r.bombDamage).padStart(8)} │ ${String(r.carHp).padStart(6)} │ `
    + `${(r.colourMatch ? 'match' : 'MISMATCH').padEnd(8)} │ `
    + `${(r.survived ? `survived ${r.hpAfter}hp` : 'destroyed').padEnd(9)} │ `
    + `${String(r.hpRemoved).padStart(10)} │ ${String(expected).padStart(8)}${verdict}`);
}
await browser.close();
