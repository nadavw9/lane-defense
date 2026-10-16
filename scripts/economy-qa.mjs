// Economy QA: shop purchase → inventory → carried into a level → spent → debited.
//   QA_URL=http://localhost:5174/ node scripts/economy-qa.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { if (!localStorage.getItem('lane-defense-v1')) localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 40, coins: 300 })); });
await p.goto(process.env.QA_URL ?? 'http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
await p.waitForTimeout(1500);
const lines = [];
const ok = (n, c, x = '') => lines.push(`${c ? 'PASS' : 'FAIL'} ${n} ${x}`);
const S = () => p.evaluate(() => window._nav.getScreens());
// Buy FREEZE (tile top-right price) and BOMB (tile bottom-left) in the shop.
await p.evaluate(() => { window._nav.cleanAll(); window._nav.showShop(); });
await p.waitForTimeout(1500);
let s0 = await S();
await p.mouse.click(287, 390); await p.waitForTimeout(500);
await p.mouse.click(102, 588); await p.waitForTimeout(500);
let s1 = await S();
ok('shop: freeze bought into inventory', s1.inventory.freeze === s0.inventory.freeze + 1, JSON.stringify(s1.inventory));
ok('shop: bomb bought into inventory', s1.inventory.bombs === s0.inventory.bombs + 1);
ok('shop: coins spent (30 + 40)', s1.coins === s0.coins - 70, `${s0.coins} → ${s1.coins}`);
// Start a level: owned boosters come along.
await p.evaluate(() => { window._nav.cleanAll(); window._nav.startLevel(12); });
await p.waitForTimeout(3500);
let s2 = await S();
ok('level: owned freeze carried in', s2.boosters.freeze >= 1, JSON.stringify(s2.boosters));
ok('level: owned bomb carried in', s2.boosters.bombs >= 1);
// Spend the freeze, then quit from pause → inventory debited by exactly one freeze.
await p.evaluate(() => window._nav.getBoosterState().activateFreeze());
await p.evaluate(() => window._nav.showPause());
await p.waitForTimeout(800);
await p.evaluate(() => window._nav.startLevel(12));   // restart settles the previous attempt
await p.waitForTimeout(2500);
let s3 = await S();
ok('settle: one freeze debited, bomb kept', s3.inventory.freeze === s1.inventory.freeze - 1 && s3.inventory.bombs === s1.inventory.bombs, JSON.stringify(s3.inventory));
// Win the level: nothing else debited.
await p.evaluate(() => window._nav.winLevel()); await p.waitForTimeout(3000);
let s4 = await S();
ok('win: inventory unchanged when nothing used', JSON.stringify(s4.inventory) === JSON.stringify(s3.inventory), JSON.stringify(s4.inventory));
ok('win screen shown', s4.win);
console.log(lines.join('\n')); console.log('errors', errs);
await b.close();
