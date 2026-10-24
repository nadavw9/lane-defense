import { chromium } from 'playwright';
// Raw DPR-3 captures for store art. Needs a dev server: QA_URL (default http://localhost:5176/).
//   node scripts/store-capture.mjs <outDir>   then   node scripts/store-art.mjs <outDir> docs/store/art
const OUT = (process.argv[2] || '/tmp/store-raw') + '/';
const URL = process.env.QA_URL || 'http://localhost:5176/';
import { mkdirSync } from 'node:fs'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, args:['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:3 });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.addInitScript(() => {
  const keys = ['tour','lane_2','lane_3','multi_color','combo','supercharge','goal_colour','freeze_booster','colour_change_booster','freeze_earned','colour_change_earned','rainbow_bomb','first_kill','first_miss','hp_miss','streak_charged','plate_break','armor_break','volatile_surge','mender_heal','gift_car','traffic_light','convoy'];
  for (let i = 1; i <= 100; i++) keys.push(`hint_L${i}`);
  localStorage.setItem('ftue_banners', JSON.stringify(keys));
  const stars = {}; for (let i = 1; i <= 33; i++) stars[i] = i % 4 === 0 ? 2 : 3;   // L23 (gift cars) needs unlockedLevel > 23
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 34, coins: 1240, winStreak: 4, stars }));
});
await p.goto(URL);
await p.waitForFunction(()=>window._nav, null, {timeout:120000});
await p.waitForTimeout(4000);
const clear = async () => { for (let i=0;i<10;i++){ await p.evaluate(()=>window._nav.dismissGuides?.()); const s = await p.evaluate(()=>window._nav.getScreens()); if (s.introCard) await p.mouse.click(195,640); if(!s.blockers?.length) break; await p.waitForTimeout(500);} };
const play = (n) => p.evaluate(async (n) => {
  const nav = window._nav, gs = nav.getGs(), gl = nav.getGameLoop(), dd = nav.getDragDrop();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  let f = 0;
  for (let g = 0; g < 500 && f < n && !gs.isOver; g++) {
    if (gl.paused || dd.inputBlocked) { nav.dismissGuides?.(); nav.dismissTutorial?.(); await sleep(200); continue; }
    if (gs.firingSlots.some(Boolean) || dd._state !== 'idle') { await sleep(80); continue; }
    let mv = null;
    gs.columns.slice(0, gs.activeColCount).forEach((col, ci) => { const s = col.top(); if (!s || mv) return;
      for (let li = 0; li < gs.activeLaneCount; li++) { const car = gs.lanes[li].frontCar?.(); if (car && (car.color === s.color || s.isColorBomb)) { mv = { ci, li }; break; } } });
    if (!mv) { await sleep(200); continue; }
    const sh = dd._shooterRenderer.getQueueSlotCenter(mv.ci, 0), tx = dd._shooterRenderer.getQueueSlotCenter(mv.li, 0).x;
    const t = gs.turnCount; dd.onPointerDown(sh.x, sh.y); dd.onPointerMove(tx, 400); dd.onPointerUp(tx, 400);
    for (let w = 0; w < 100 && gs.turnCount === t && !gs.isOver; w++) await sleep(100);
    if (gs.turnCount !== t) f++;
  }
  return f;
}, n);
const shot = async (n) => { await p.screenshot({ path: OUT + n + '.png' }); console.log('shot', n); };
for (const [name, L, n, wait] of [['s1-l12', 12, 4, 350], ['s2-l35', 35, 2, 1500], ['s3-l23', 23, 2, 1500], ['s4-l55', 55, 3, 1500], ['s5-l65', 65, 3, 1500], ['s8-l88', 88, 3, 1500]]) {
  await p.evaluate((l)=>{ window._nav.cleanAll(); window._nav.startLevel(l); }, L); await p.waitForTimeout(6000); await clear();
  const f = await play(n); console.log(name, 'fired', f);
  await p.waitForTimeout(wait); await shot(name);
}
await p.evaluate(()=>{ window._nav.cleanAll(); window._nav.startLevel(20); }); await p.waitForTimeout(5000); await clear();
await p.evaluate(()=>{ const gs = window._nav.getGs(); gs.coins += 40; gs.totalKills = 27; gs.score = (gs.starTargets?.[2] ?? 3000) + 85; window._nav.showWin(); }); await p.waitForTimeout(4000);
for (let i=0;i<5;i++){ await p.evaluate(()=>window._nav.dismissGuides?.()); await p.waitForTimeout(600); }
await p.waitForTimeout(2000); await shot('s7-win');
await p.evaluate(()=>{ window._nav.cleanAll(); window._nav.showTitle(); }); await p.waitForTimeout(9000); await shot('s0-title');
// Map: a Toy Town save at level 9, so rebuilt houses sit below rubble (the repair story).
const m = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:3 });
await m.addInitScript(() => {
  localStorage.setItem('ftue_banners', localStorage.getItem('ftue_banners') || '[]');
  const stars = {}; for (let i = 1; i < 9; i++) stars[i] = i % 4 === 0 ? 2 : 3;
  localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 9, coins: 1240, winStreak: 4, stars }));
});
await m.goto(URL); await m.waitForFunction(()=>window._nav, null, {timeout:120000}); await m.waitForTimeout(4000);
await m.evaluate(()=>{ window._nav.cleanAll(); window._nav.showLevelSelect(); }); await m.waitForTimeout(6000);
await m.screenshot({ path: OUT + 's6-map.png' }); console.log('shot s6-map');
console.log('errors', JSON.stringify(errs.slice(0,3))); await b.close(); console.log('DONE');
