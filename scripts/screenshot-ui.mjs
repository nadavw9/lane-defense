// screenshot-ui.mjs — capture UI screens for the icon-swap review (docs/review/).
// Reuses the running dev server (PORT=5173). Drives the game via window._nav.
//
//   node scripts/screenshot-ui.mjs <screen> [outName]
//
// screens: hud | title | levelselect | win | lose | shop | daily | settings
// The <screen> arg selects a scripted flow; the shot lands in docs/review/<outName>.png
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import path from 'path';

const screen = process.argv[2] || 'title';
const outName = process.argv[3] || `ui-${screen}`;
const PORT = process.env.PORT || 5173;
const URL = `http://localhost:${PORT}/`;
const OUT = path.resolve('docs/review');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext()).newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30_000 });
await page.waitForTimeout(2000);
await page.evaluate(() => { try { localStorage.removeItem('ftue_banners'); } catch {} });

const wait = (ms) => page.waitForTimeout(ms);

async function run() {
  switch (screen) {
    case 'hud':
      await page.evaluate(() => window._nav?.startLevel(5));
      await wait(9500);             // let the L5 intro hint clear the popup queue
      await page.evaluate(() => window._nav?.fireTestAchievement());
      await wait(700);              // toast slid in (trophy icon top-right)
      break;
    case 'title':
      // already on title after boot
      await wait(1500);
      break;
    case 'levelselect':
      await page.evaluate(() => window._nav?.showLevelSelect());
      await wait(1800);
      break;
    case 'levelpopup':
      await page.evaluate(() => window._nav?.showLevelSelect());
      await wait(1500);
      await page.mouse.click(45, 795);   // node L1 (bottom-left; map runs bottom-up)
      await wait(900);
      break;
    case 'win':
      await page.evaluate(() => window._nav?.startLevel(5));
      await wait(2500);
      await page.evaluate(() => window._nav?.showWin());
      await wait(2000);
      break;
    case 'win1':
    case 'win2':
      // Force the star count via gs.maxCarPosition (calcStars: <60→3, <80→2, else 1).
      await page.evaluate(() => window._nav?.startLevel(5));
      await wait(2500);
      await page.evaluate((mcp) => {
        const gs = window._nav.getGs();
        gs.maxCarPosition = mcp; gs.rescueUsed = false;
      }, screen === 'win2' ? 70 : 90);
      await page.evaluate(() => window._nav?.showWin());
      await wait(2000);
      break;
    case 'winflyin':
      // Catch a mid-fly-in frame: stars land by ~0.42s (120ms each + 150ms stagger).
      await page.evaluate(() => window._nav?.startLevel(5));
      await wait(2500);
      await page.evaluate(() => window._nav?.showWin());
      await wait(240);
      break;
    case 'lose':
      await page.evaluate(() => window._nav?.startLevel(5));
      await wait(2500);
      await page.evaluate(() => window._nav?.showLose());
      await wait(1500);
      break;
    case 'shop':
      await page.evaluate(() => window._nav?.showShop());
      await wait(1800);
      break;
    case 'prelevel':
      await page.evaluate(() => window._nav?.showPreLevel(6));
      await wait(1500);
      break;
    case 'settings':
      await page.evaluate(() => window._nav?.showSettings());
      await wait(1500);
      break;
    case 'daily':
      await page.evaluate(() => window._nav?.showDaily());
      await wait(1500);
      break;
    case 'stats':
      await page.evaluate(() => window._nav?.showStats());
      await wait(1500);
      break;
    default:
      await wait(1200);
  }
}
await run();

const file = path.join(OUT, `${outName}.png`);
await page.screenshot({ path: file, fullPage: false });
console.log('saved:', file);
if (errors.length) { console.log('CONSOLE ERRORS:'); errors.forEach(e => console.log(' ', e)); }
else console.log('no console errors');
await browser.close();
