// Secondary screens: settings, daily, trophies, stats, how to play, car guide, race, level 1 card.
import { chromium } from 'playwright';
const [out, prefix] = process.argv.slice(2);
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.addInitScript(() => { localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 32, coins: 140, introducedCarTypes: ['small', 'big', 'jeep'] })); });
await p.goto(process.env.QA_URL ?? 'http://localhost:5180/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 }); await p.waitForTimeout(2500);
const shot = (n) => p.screenshot({ path: `${out}/${prefix}-${n}.png` });
for (const [name, fn] of [['settings', 'showSettings'], ['daily', 'showDaily'], ['trophies', 'showAchievements'], ['stats', 'showStats'], ['howto', 'showHowToPlay'], ['carguide', 'showCarManual'], ['race', 'showRace']]) {
  try { await p.evaluate((f) => window._nav[f](), fn); await p.waitForTimeout(1800); await shot(name); } catch (e) { console.log(name, 'failed', e.message.split('\n')[0]); }
  await p.evaluate(() => window._nav.cleanAll?.()); await p.waitForTimeout(300);
}
await p.evaluate(() => window._nav.showPreLevel(1)); await p.waitForTimeout(1500); await shot('card-L1');
await b.close();
