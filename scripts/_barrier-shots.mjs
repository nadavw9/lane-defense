// LANE BARRIERS + WAVES review captures (2026-10-30): L5 with every barrier standing, a car
// pushed onto the breach line and shot (the smash: explosion, BARRIER DOWN!, the card), the
// stump afterwards, and the WAVE 1 tag on L12 as the goal passes 20%.
//   QA_URL=http://localhost:5181/ node scripts/_barrier-shots.mjs <outDir>
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'qa-barriers'; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.addInitScript(() => {
  const k = ['tour', 'lane_2', 'lane_3', 'second_colour', 'chain_reaction', 'combo', 'supercharge', 'goal_colour', 'freeze_booster',
    'colour_change_booster', 'freeze_earned', 'colour_change_earned', 'rainbow_bomb', 'first_kill', 'first_miss', 'hp_miss', 'streak_charged',
    'plate_break', 'armor_break', 'volatile_surge', 'mender_heal', 'gift_car', 'traffic_light', 'convoy'];
  for (let i = 1; i <= 200; i++) k.push(`hint_L${i}`);
  localStorage.setItem('ftue_banners', JSON.stringify(k));
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 20, introducedCarTypes: ['small', 'big', 'jeep'] }));
});
await p.goto(process.env.QA_URL ?? 'http://localhost:5181/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 }); await p.waitForTimeout(2000);
const dismiss = async () => { for (let i = 0; i < 6; i++) { await p.evaluate(() => window._nav.dismissGuides?.()); await p.waitForTimeout(150); } };
const settle = () => p.evaluate(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const gs = window._nav.getGs(), gl = window._nav.getGameLoop();
  for (let i = 0; i < 100 && (Object.values(gs.firingSlots).some(Boolean) || gl.paused); i++) await sleep(80);
  return { paused: gl.paused, barriers: gs.barriers.slice(0, gs.activeLaneCount), lost: gs.barriersLost, over: gs.isOver };
});

// ── L5: barriers standing, then the smash ──────────────────────────────────────────
await p.evaluate(() => window._nav.startLevel(5)); await p.waitForTimeout(3500); await dismiss(); await p.waitForTimeout(600);
console.log('L5 start', JSON.stringify(await settle()));
await p.screenshot({ path: `${out}/01-l5-barriers.png` });
const before = await p.evaluate(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const gs = window._nav.getGs(), gl = window._nav.getGameLoop();
  // Lane 1's front car goes to the last row; a correct shot at lane 0 moves it over the line.
  const rows = gs.gridRows; const fc = gs.lanes[1].frontCar(); fc.row = rows - 1; fc.position = 100; fc.hp = 99;
  const top = gs.columns[0].top(); const f0 = gs.lanes[0].frontCar(); if (f0) { f0.color = top.color; f0.hp = 1; }
  await sleep(400);
  const out = { barriers: gs.barriers.slice(0, 3), lane1Row: fc.row, kills: gs.totalKills, goal: gs.goalProgress[0] };
  gl.deploy(0, 0);
  return out;
});
console.log('before smash', JSON.stringify(before));
await p.waitForTimeout(260); await p.screenshot({ path: `${out}/02-l5-smash.png` });
await p.waitForTimeout(900); await p.screenshot({ path: `${out}/03-l5-card.png` });
const mid = await p.evaluate(() => { const gs = window._nav.getGs(); return { barriers: gs.barriers.slice(0, 3), lost: gs.barriersLost, over: gs.isOver, kills: gs.totalKills, goal: gs.goalProgress[0], guide: window._nav.guideTitle?.() }; });
console.log('after smash', JSON.stringify(mid));
await dismiss(); await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/04-l5-stump.png` });

// ── L12: the WAVE 1 tag ────────────────────────────────────────────────────────────
await p.evaluate(() => window._nav.startLevel(12)); await p.waitForTimeout(3500); await dismiss(); await p.waitForTimeout(600);
await p.evaluate(() => { const gs = window._nav.getGs(); for (let i = 0; i < gs.goals.length; i++) gs.goalProgress[i] = Math.round(gs.goals[i].count * 0.72); });
await p.waitForTimeout(350); await p.screenshot({ path: `${out}/05-l12-wave1.png` });
const wave = await p.evaluate(() => { const gs = window._nav.getGs(); return { goals: gs.goals.map(g => g.count), progress: gs.goalProgress }; });
console.log('wave', JSON.stringify(wave));
writeFileSync(`${out}/00-labels.txt`, [
  '01=L5 at start: a striped road block on every lane at the hazard stripe (look: one per lane, sits on the stripe, Toy Town outline)',
  '02=the smash: lane 1 car crossed the line into its barrier (look: explosion + ring + BARRIER DOWN! tag at the lane end, screen shake)',
  '03=the once-ever BARRIER DOWN card (look: centre card, text names the rule)',
  '04=after: lane 1 shows only the posts (stump), lanes 0 and 2 still have their beam; level still running',
  '05=L12 at 28% goal progress: WAVE 1! tag (look: orange tag above the road, same style as FINAL RUSH was)',
].join('\n') + '\n');
await b.close();
