// Captures for the PremiumUI pill/tag pass: title (LEVEL pill, captions, NEW tags) and the map header.
//   QA_URL=http://localhost:5178/ node scripts/_pill-shots.mjs <outDir> <prefix>
import { chromium } from 'playwright';
const [out, prefix] = process.argv.slice(2);
const URL = process.env.QA_URL ?? 'http://localhost:5178/';
const b = await chromium.launch({ executablePath: process.env.PW_EXE ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => {
  if (localStorage.getItem('lane-defense-v1')) return;
  localStorage.setItem('ftue_banners', JSON.stringify(['tour']));
  const stars = {}; for (let i = 1; i <= 21; i++) stars[i] = i % 3 ? 3 : 2;
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 22, coins: 1240, stars }));
});
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 });
await p.evaluate(() => { window._nav.cleanAll?.(); window._nav.showTitle(); });
await p.waitForTimeout(10000);
await p.screenshot({ path: `${out}/${prefix}-title.png` });
await p.evaluate(() => { window._nav.cleanAll?.(); window._nav.showLevelSelect(); });
await p.waitForTimeout(5000);
await p.screenshot({ path: `${out}/${prefix}-map.png` });
console.log(errs.join('\n') || 'no page errors');
await b.close();
