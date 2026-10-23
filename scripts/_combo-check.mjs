// Combo check (2026-10-22): the on-screen "xN COMBO" is gs.scoreChain and grows on every correct shot.
import { chromium } from 'playwright';
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.addInitScript(() => { const k = ['tour','lane_2','lane_3','multi_color','combo','supercharge','goal_colour','freeze_booster','first_kill','first_miss','hp_miss','streak_charged']; for (let i = 1; i <= 200; i++) k.push(`hint_L${i}`); localStorage.setItem('ftue_banners', JSON.stringify(k)); localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 10, introducedCarTypes: ['small','big','jeep'] })); });
await p.goto(process.env.QA_URL ?? 'http://localhost:5180/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 }); await p.waitForTimeout(2000);
await p.evaluate(() => window._nav.startLevel(6)); await p.waitForTimeout(4000);
for (let i = 0; i < 6; i++) { await p.evaluate(() => window._nav.dismissGuides?.()); await p.waitForTimeout(200); }
const log = await p.evaluate(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const out = [];
  for (let n = 0; n < 5; n++) {
    const gs = window._nav.getGs(), gl = window._nav.getGameLoop();
    while (Object.values(gs.firingSlots).some(Boolean) || gl.paused) await sleep(80);
    let done = false;
    for (let ci = 0; ci < gs.activeColCount && !done; ci++) { const top = gs.columns[ci].top(); if (!top) continue;
      for (let li = 0; li < gs.activeLaneCount && !done; li++) { const fc = gs.lanes[li].frontCar(); if (fc && fc.color === top.color && gl.deploy(ci, li)) done = true; } }
    await sleep(3500);   // slow on purpose: the old 2-second window would have reset the combo
    out.push({ chain: gs.scoreChain, score: gs.score, kills: gs.totalKills });
  }
  return out;
});
console.log(JSON.stringify(log));
await p.screenshot({ path: process.argv[2] });
await b.close();
