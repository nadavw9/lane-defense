import { chromium } from 'playwright';
const out = process.argv[2];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.addInitScript(() => {
  const stars = {}; for (let i = 1; i < 6; i++) stars[i] = 2;
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 6, stars, introducedCarTypes: ['big','jeep'] }));
});
await p.goto('http://localhost:5176/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 });
await p.waitForTimeout(2000);
await p.evaluate(() => { window._nav.cleanAll?.(); window._nav.startLevel(6); });
for (let i = 0; i < 12; i++) { await p.waitForTimeout(1000); await p.evaluate(() => window._nav.dismissGuides?.()); }
await p.screenshot({ path: `${out}/after-L6.png` });
await b.close();
