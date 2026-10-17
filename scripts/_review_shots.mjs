import { chromium } from 'playwright';
const OUT = '/tmp/claude-0/review/';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:1 });
await p.addInitScript(() => {
  const keys = ['tour','lane_2','lane_3','multi_color','combo','supercharge','goal_colour','freeze_booster','colour_change_booster','freeze_earned','colour_change_earned','rainbow_bomb','first_kill','first_miss','hp_miss','streak_charged','plate_break','armor_break','volatile_surge','mender_heal'];
  for (let i = 1; i <= 100; i++) keys.push(`hint_L${i}`);
  localStorage.setItem('ftue_banners', JSON.stringify(keys));
  const d = { unlockedLevel: 100, coins: 340 };
  localStorage.setItem('lane-defense-v1', JSON.stringify(d));
});
await p.goto('http://localhost:5176/');
await p.waitForFunction(()=>window._nav, null, {timeout:90000});
await p.waitForTimeout(4000);
const shot = async (n) => { await p.screenshot({ path: OUT + n + '.png' }); console.log('shot', n); };
const clean = async () => { for (let i=0;i<8;i++){ await p.evaluate(()=>{ window._nav.dismissGuides?.(); }); const s = await p.evaluate(()=>window._nav.getScreens()); if(!s.blockers?.length) break; if (s.introCard) await p.mouse.click(195,640); await p.waitForTimeout(600);} };
await shot('01-title');
const screens = [['02-map', 'showLevelSelect'], ['03-shop','showShop'], ['04-settings','showSettings'], ['05-achievements','showAchievements'], ['06-daily','showDaily'], ['07-stats','showStats'], ['08-howto','showHowToPlay']];
for (const [n, fn] of screens) { try { await p.evaluate((f)=>{ window._nav.cleanAll(); window._nav[f](); }, fn); await p.waitForTimeout(2500); await shot(n); } catch(e) { console.log('fail', n, e.message); } }
try { await p.evaluate(()=>{ window._nav.cleanAll(); window._nav.showPreLevel(12); }); await p.waitForTimeout(2500); await shot('09-prelevel'); } catch(e){ console.log('fail pre', e.message); }
for (const L of [5, 9, 17, 35, 55, 70, 85, 95]) {
  try { await p.evaluate((l)=>{ window._nav.cleanAll(); window._nav.startLevel(l); }, L); await p.waitForTimeout(6000); await clean(); await p.waitForTimeout(2500); await shot(`L${String(L).padStart(3,'0')}`); } catch(e){ console.log('fail L', L, e.message); }
}
try { await p.evaluate(()=>window._nav.showWin()); await p.waitForTimeout(4000); await shot('20-win'); } catch(e){ console.log('fail win', e.message); }
try { await p.evaluate(()=>{ window._nav.cleanAll(); window._nav.startLevel(6); }); await p.waitForTimeout(5000); await clean(); await p.evaluate(()=>window._nav.showRescue()); await p.waitForTimeout(3000); await shot('21-rescue'); } catch(e){ console.log('fail rescue', e.message); }
try { await p.evaluate(()=>window._nav.showLose()); await p.waitForTimeout(3000); await shot('22-lose'); } catch(e){ console.log('fail lose', e.message); }
await b.close(); console.log('DONE');
