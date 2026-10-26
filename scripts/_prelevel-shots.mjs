// Captures for the level-start card chrome pass: a NEW level with a live win streak (L46 mender)
// and a BIG WAVE level (L50), plus a level still building its streak (L33).
//   QA_URL=http://localhost:5178/ node scripts/_prelevel-shots.mjs <outDir> <prefix>
import { chromium } from 'playwright';
const [out, prefix] = process.argv.slice(2);
const URL = process.env.QA_URL ?? 'http://localhost:5178/';
const b = await chromium.launch({ executablePath: process.env.PW_EXE ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
for (const [lv, streak] of [[46, 4], [50, 4], [33, 1]]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(([lv, streak]) => {
    localStorage.setItem('ftue_banners', JSON.stringify(['tour']));
    const stars = {}; for (let i = 1; i < lv; i++) stars[i] = 3;
    localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: lv, coins: 640, winStreak: streak, stars }));
  }, [lv, streak]);
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 });
  await p.waitForTimeout(2500);
  await p.evaluate((n) => window._nav.showPreLevel(n), lv);
  await p.waitForTimeout(3500);
  await p.screenshot({ path: `${out}/${prefix}-L${lv}.png` });
  await p.close();
}
console.log(errs.join('\n') || 'no page errors');
await b.close();
