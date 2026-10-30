// Animated intro cards review (2026-10-30): the LANE BARRIER card at the first smash (L5) and the
// WAVES card at the first WAVE 1 crest (L10), three frames each so the loop is visible.
//   QA_URL=http://localhost:5181/ node scripts/_intro-cards-shots.mjs <outDir>
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'qa-cards'; mkdirSync(out, { recursive: true });
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

await p.evaluate(() => window._nav.startLevel(5)); await p.waitForTimeout(3500); await dismiss(); await p.waitForTimeout(600);
await p.evaluate(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const gs = window._nav.getGs(), gl = window._nav.getGameLoop();
  for (let i = 0; i < 50 && (Object.values(gs.firingSlots).some(Boolean) || gl.paused); i++) await sleep(80);
  const fc = gs.lanes[1].frontCar(); fc.row = gs.gridRows - 1; fc.position = 100; fc.hp = 99;
  const top = gs.columns[0].top(); const f0 = gs.lanes[0].frontCar(); if (f0) { f0.color = top.color; f0.hp = 1; }
  await sleep(300); gl.deploy(0, 0);
});
for (const [ms, name] of [[1600, '01-barrier-card-drive'], [1000, '02-barrier-card-boom'], [1500, '03-barrier-card-second-car']]) {
  await p.waitForTimeout(ms); await p.screenshot({ path: `${out}/${name}.png` });
}
console.log('barrier card', await p.evaluate(() => ({ intro: !!window._nav.getScreens?.().introCard, paused: window._nav.getGameLoop().paused })));
await dismiss(); await p.waitForTimeout(400);

await p.evaluate(() => window._nav.startLevel(10)); await p.waitForTimeout(3500); await dismiss(); await p.waitForTimeout(600);
await p.evaluate(() => { const gs = window._nav.getGs(); for (let i = 0; i < gs.goals.length; i++) gs.goalProgress[i] = Math.round(gs.goals[i].count * 0.75); });
for (const [ms, name] of [[900, '04-wave-card-a'], [1400, '05-wave-card-b'], [1400, '06-wave-card-c']]) {
  await p.waitForTimeout(ms); await p.screenshot({ path: `${out}/${name}.png` });
}
console.log('wave card', await p.evaluate(() => ({ intro: !!window._nav.getScreens?.().introCard, paused: window._nav.getGameLoop().paused })));
writeFileSync(`${out}/00-labels.txt`, [
  '01=LANE BARRIER card, phase 1: a car drives down the lane toward the striped block (look: lane, posts, red/white beam, hazard stripe)',
  '02=phase 2: BOOM, the beam splits and BARRIER DOWN! (look: beam halves rotate away, only posts remain)',
  '03=phase 3: a second car drives through the gap, the lane flashes red, LEVEL LOST (look: the consequence is on screen)',
  '04=WAVES card: the traffic curve of a level (CALM, WAVE 1, LULL, WAVE 2, FINAL), cars packed on the crests, marker riding it',
  '05=WAVES card: the marker on a crest shows the crest name (WAVE 2 / FINAL WAVE)',
  '06=WAVES card: a later frame of the loop',
].join('\n') + '\n');
await b.close();
