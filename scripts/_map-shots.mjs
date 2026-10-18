// Level-map captures for the more-levels review.
//   node map-shots.mjs <outDir> <prefix> <unlockedLevel> [page...] [--level=N...]
// Must be run with cwd = the worktree (so `playwright` resolves).
import { chromium } from 'playwright';
const args = process.argv.slice(2);
const [out, prefix, unlocked] = args;
const pages = args.slice(3).filter(a => !a.startsWith('--')).map(Number);
const levels = args.filter(a => a.startsWith('--level=')).map(a => Number(a.slice(8)));
const URL = process.env.QA_URL ?? 'http://localhost:5174/';

const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.addInitScript((u) => {
  localStorage.setItem('ftue_banners', JSON.stringify(['tour', 'multi_lane', 'first_shot', 'bench', 'merge', 'first_car']));
  const stars = {}; for (let i = 1; i < u; i++) stars[i] = 1 + (i % 3);
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: u, stars }));
}, Number(unlocked));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 });
await p.waitForTimeout(3000);
const shot = async (name) => { await p.waitForTimeout(2500); await p.screenshot({ path: `${out}/${prefix}-${name}.png` }); console.log(`${prefix}-${name}`); };

await p.evaluate(() => { window._nav.cleanAll?.(); window._nav.showLevelSelect(); });
await shot('map-focus');
for (const pg of pages) {
  // The page arrows are the only page API; tap them through the screen object when exposed.
  const ok = await p.evaluate((n) => {
    const ls = window._nav.getLevelSelect?.() ?? window._nav.levelSelect;
    if (ls?._switch) { ls._switch(n); return true; }
    return false;
  }, pg);
  if (ok) await shot(`map-page${pg}`); else console.log(`no page API for page ${pg}`);
}
for (const lv of levels) {
  await p.evaluate((n) => window._nav.startLevel(n), lv);
  await p.waitForTimeout(6000);
  await p.evaluate(() => window._nav.dismissGuides?.());
  await shot(`L${lv}`);
}
await b.close();
