// Win screen capture (three stars, real score, live streak) for chrome passes.
//   QA_URL=http://localhost:5178/ node scripts/_win-shots.mjs <outDir> <prefix>
import { chromium } from 'playwright';
const [out, prefix] = process.argv.slice(2);
const URL = process.env.QA_URL ?? 'http://localhost:5178/';
const b = await chromium.launch({ executablePath: process.env.PW_EXE ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => {
  localStorage.setItem('ftue_banners', JSON.stringify(['tour']));
  const stars = {}; for (let i = 1; i < 34; i++) stars[i] = 3;
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 34, coins: 640, winStreak: 4, stars }));
});
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 });
await p.waitForTimeout(2500);
await p.evaluate(() => { window._nav.cleanAll?.(); window._nav.startLevel(20); });
await p.waitForTimeout(5000);
await p.evaluate(() => { window._nav.dismissGuides?.(); const gs = window._nav.getGs(); gs.coins += 40; gs.totalKills = 27; gs.score = (gs.starTargets?.[2] ?? 3000) + 85; window._nav.showWin(); });
await p.waitForTimeout(4500);
for (let i = 0; i < 6; i++) { await p.evaluate(() => window._nav.dismissGuides?.()); await p.waitForTimeout(500); }
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/${prefix}-win.png` });
console.log(errs.join('\n') || 'no page errors');
await b.close();
