// Shop + settings captures for design review (dev server :5173).
//   node scripts/shop-shots.mjs <outDir> [prefix]
// Shop with coins and a ready daily gift, shop after a purchase with the gift
// claimed (countdown), shop broke (deny toast), settings, settings → car guide.
import { chromium } from 'playwright';
const [out, prefix = 'shop'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.addInitScript(() => {
  if (!localStorage.getItem('lane-defense-v1')) localStorage.setItem('lane-defense-v1', JSON.stringify({
    unlockedLevel: 12, coins: 265, inventory: { colorChange: 1, freeze: 0, bombs: 2 },
    stars: { 1: 3, 2: 3, 3: 2, 4: 3, 5: 1, 6: 2, 7: 3, 8: 2, 9: 3, 10: 1, 11: 2 } }));
});
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
await p.waitForTimeout(2500);
const shot = async (name) => { await p.waitForTimeout(1400); await p.screenshot({ path: `${out}/${prefix}-${name}.png` }); console.log(name); };
const tap = async (x, y) => {
  const r = await p.evaluate(() => { const c = document.querySelector('canvas:not(#three-canvas)').getBoundingClientRect(); return { x: c.x, y: c.y, w: c.width, h: c.height }; });
  await p.mouse.click(r.x + x * r.w / 390, r.y + y * r.h / 844);
};
await p.evaluate(() => { window._nav.cleanAll(); window._nav.showShop(); });
await shot('ready');
await tap(287, 388);                      // buy FREEZE (top-right tile price)
await p.waitForTimeout(250);
await p.screenshot({ path: `${out}/${prefix}-buying.png` });
await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('lane-defense-v1')); s.dailyReward = { day: 3, lastClaim: Date.now() - 5 * 3600e3 }; s.coins = 12; localStorage.setItem('lane-defense-v1', JSON.stringify(s)); });
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
await p.waitForTimeout(2500);
await p.evaluate(() => { window._nav.cleanAll(); window._nav.showShop(); });
await p.waitForTimeout(1200);
await tap(102, 388);                       // can't afford → shake + toast
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/${prefix}-broke.png` }); console.log('broke');
await p.evaluate(() => { window._nav.cleanAll(); window._nav.showSettings(); });
await shot('settings');
await tap(288, 584);                      // CAR GUIDE
await shot('settings-carguide');
await b.close();
