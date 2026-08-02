import { chromium } from 'playwright';
import fs from 'fs';
const TAG = process.argv.find(a=>a.startsWith('--tag='))?.split('=')[1] ?? 'now';
fs.mkdirSync('docs/review',{recursive:true});
const b = await chromium.launch({ headless:false, args:['--use-gl=angle','--enable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:3 });
await p.goto('http://localhost:5173/', { waitUntil:'networkidle' });
await p.waitForFunction(()=>!!window._nav,null,{timeout:60000});
for (const lv of [5,8]) {
  await p.evaluate((l)=>window._nav.startLevel(l), lv);
  await p.waitForTimeout(2400);
  const canvas = await p.evaluate(()=>{ const n=window._nav,gs=n.getGs(),gl=n.getGameLoop(),dd=n.getDragDrop();
    for(let i=0;i<10;i++) n.dismissTutorial();
    return { blocked: gl.paused||dd.inputBlocked }; });
  // fill the queue so all three rows are occupied
  await p.evaluate(async ()=>{ const gs=window._nav.getGs(); const M=await import('/src/models/Shooter.js');
    for(let c=0;c<gs.activeColCount;c++){ const col=gs.columns[c];
      while(col.shooters.length<3) col.shooters.push(new M.Shooter({color:gs.colors[col.shooters.length%gs.colors.length],damage:3,column:c})); } });
  await p.waitForTimeout(600);
  const f = `docs/review/bottom-${TAG}-L${lv}.png`;
  await p.screenshot({ path:f, clip:{ x:0, y:560, width:390, height:284 } });
  console.log(`L${lv} blocked=${canvas.blocked} -> ${f}`);
}
await b.close();
