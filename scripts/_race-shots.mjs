// Traffic Race review captures (dev server). Walks the race through the real screens via _nav.
//   QA_URL=http://localhost:5175/ node scripts/_race-shots.mjs <outDir> [--before]
// --before: the same screens on a build without the race (map header, win, continue, loss).
import { chromium } from 'playwright';
const [out] = process.argv.slice(2);
const before = process.argv.includes('--before');
const URL = process.env.QA_URL ?? 'http://localhost:5175/';

const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|AudioContext/.test(m.text())) errs.push(m.text().slice(0, 200)); });
await p.addInitScript(() => {
  if (localStorage.getItem('lane-defense-v1')) return;
  localStorage.setItem('ftue_banners', JSON.stringify(['tour', 'multi_lane', 'first_shot', 'bench', 'merge', 'first_car']));
  const stars = {}; for (let i = 1; i <= 30; i++) stars[i] = 2;
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 31, stars, coins: 120, winStreak: 3 }));
});
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 });
await p.waitForTimeout(3000);
const shot = async (name, wait = 2200) => { await p.waitForTimeout(wait); await p.screenshot({ path: `${out}/${name}.png` }); console.log(name); };
const race = (fn, arg) => p.evaluate(async ([src, a]) => { const m = await import('/src/game/race.js'); return new Function('m', 'a', src)(m, a); }, [fn, arg]);

await p.evaluate(() => { window._nav.cleanAll?.(); window._nav.showLevelSelect(); });
await shot('map');
if (!before) {
  await p.evaluate(() => window._nav.showRace());
  await shot('card-intro');
  // A race in progress: 3 wins, 2 hearts, rivals spread out.
  await race(`const r = m.startRace({ now: Date.now() - 5 * 3600e3, seed: 11, first: false });
    r.wins = 3; r.hearts = 2; r.attempts = 4; [4.4, 2.2, 1.3, 3.1].forEach((v, i) => r.rivals[i].progress = v);
    r.lastSync = Date.now(); window._nav.setRace(r);`);
  await p.evaluate(() => { window._nav.cleanAll?.(); window._nav.showLevelSelect(); });
  await shot('map-racing');
  await p.evaluate(() => window._nav.showRace());
  await shot('card-running', 2600);
}
// Win on the frontier level L31.
await p.evaluate(() => { window._nav.cleanAll?.(); window._nav.startLevel(31); });
await p.waitForTimeout(5000);
await p.evaluate(() => { window._nav.dismissGuides?.(); window._nav.showWin(); });
await p.waitForTimeout(2600);
await p.evaluate(() => window._nav.dismissGuides?.());
await shot('win', 1500);
// The continue offer on L32 (now the frontier).
await p.evaluate(() => { window._nav.cleanAll?.(); window._nav.startLevel(32); });
await p.waitForTimeout(5000);
await p.evaluate(() => { window._nav.dismissGuides?.(); window._nav.showRescue(); });
await shot('continue', 2500);
// A final loss on L32.
await p.evaluate(() => { window._nav.cleanAll?.(); window._nav.startLevel(32); });
await p.waitForTimeout(5000);
await p.evaluate(() => { window._nav.dismissGuides?.(); window._nav.showLose(); });
await shot('lose', 2500);
if (!before) {
  // A won race: the card opens by itself on the map.
  await race(`const r = window._nav.race(); r.wins = 6; r.finishOrder = ++r.seq; r.result = { outcome: 'finished', place: 1 }; window._nav.setRace(r);`);
  await p.evaluate(() => { window._nav.cleanAll?.(); window._nav.showLevelSelect(); });
  await shot('card-won', 3500);
  const screens = await p.evaluate(() => window._nav.getScreens());
  console.log('auto-opened over the map:', JSON.stringify(screens).includes('"race":true') ? 'yes (getScreens)' : 'see card-won.png');
  // Out of hearts.
  await race(`const r = m.startRace({ now: Date.now(), seed: 5, first: false }); r.hearts = 0; r.wins = 2; r.result = { outcome: 'out', place: null }; window._nav.setRace(r);`);
  await p.evaluate(() => { window._nav.cleanAll?.(); window._nav.showLevelSelect(); });
  await shot('card-out', 3500);
}
console.log('errors:', errs.length ? errs.join('\n') : 'none');
await b.close();
