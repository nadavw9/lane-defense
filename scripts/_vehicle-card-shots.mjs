// Vehicle-card captures: node scripts/_vehicle-card-shots.mjs <outDir> <level> [frames]
// Opens <level> on a save that has reached it, waits for the NEW VEHICLE card, shoots frames.
import { chromium } from 'playwright';
const [out, lvArg, framesArg] = process.argv.slice(2);
const lv = Number(lvArg), frames = Number(framesArg ?? 4);
const URL = process.env.QA_URL ?? 'http://localhost:5176/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.addInitScript((u) => {
  const stars = {}; for (let i = 1; i < u; i++) stars[i] = 2;
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: u, stars }));
}, lv);
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 });
await p.waitForTimeout(2000);
await p.evaluate((n) => { window._nav.cleanAll?.(); window._nav.startLevel(n); }, lv);
// dismiss guide cards (not the vehicle card) until the vehicle card is up
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  await p.waitForTimeout(1000);
  up = await p.evaluate(() => window._nav.getScreens().blockers.includes('introCard'));
  if (!up) await p.evaluate(() => { const t = window._nav.guideTitle?.(); if (t && !/VEHICLE/.test(t)) window._nav.guideNext?.(); });
}
console.log('card up:', up);
for (let f = 0; f < frames; f++) {
  await p.screenshot({ path: `${out}/L${lv}-card-${f}.png` });
  await p.waitForTimeout(700);
}
await b.close();
