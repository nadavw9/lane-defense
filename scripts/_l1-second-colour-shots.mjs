// L1 second-colour moment (2026-10-27): play L1 with the matching bomb until the first blue car
// reaches the front, and capture the card (ring on the blue bomb, hand drag). Logs the colour of
// every front car shot, so the run of reds is visible in the output.
//   QA_URL=http://localhost:5180/ node scripts/_l1-second-colour-shots.mjs <outDir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'qa-l1'; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.addInitScript(() => {
  // Every card seen except the one under test (and the L1 tour, so the board is clear).
  const k = ['tour','lane_2','lane_3','chain_reaction','combo','supercharge','goal_colour','freeze_booster','first_kill','first_miss','hp_miss','streak_charged','bomb_earned'];
  for (let i = 1; i <= 200; i++) k.push(`hint_L${i}`);
  localStorage.setItem('ftue_banners', JSON.stringify(k));
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 1 }));
});
await p.goto(process.env.QA_URL ?? 'http://localhost:5180/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 }); await p.waitForTimeout(2000);
await p.evaluate(() => window._nav.startLevel(1)); await p.waitForTimeout(3500);
for (let i = 0; i < 6; i++) { await p.evaluate(() => window._nav.dismissGuides?.()); await p.waitForTimeout(200); }
await p.waitForTimeout(600);
await p.screenshot({ path: `${out}/0-open.png` });
const log = [];
for (let shot = 0; shot < 12; shot++) {
  const r = await p.evaluate(async () => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const gs = window._nav.getGs(), gl = window._nav.getGameLoop();
    for (let t = 0; t < 100 && (Object.values(gs.firingSlots).some(Boolean) || gl.paused); t++) await sleep(80);
    const title = window._nav.guideTitle?.() ?? null;
    if (title) return { title, front: gs.lanes[0].frontCar()?.color };
    const front = gs.lanes[0].frontCar(); if (!front) return { done: 'no front car' };
    const col = gs.columns.slice(0, gs.activeColCount).findIndex(c => c.top()?.color === front.color);
    const tops = gs.columns.slice(0, gs.activeColCount).map(c => c.top()?.color);
    gl.deploy(col, 0);
    return { shot: true, front: front.color, col, tops, kills: gs.totalKills };
  });
  log.push(r); console.log(JSON.stringify(r));
  if (r.title) { await p.waitForTimeout(400); await p.screenshot({ path: `${out}/1-card.png` }); break; }
  if (r.done) break;
  await p.waitForTimeout(1200);
}
await b.close();
