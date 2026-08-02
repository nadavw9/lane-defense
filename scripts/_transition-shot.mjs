// Screenshot the bomb queue AFTER a band transition (L13 4-lane -> L5 3-lane),
// which is the condition that triggers the stale-pitch bug. A fresh L5 load does
// NOT reproduce it, so a rest screenshot of L5 alone proves nothing.
import { chromium } from 'playwright';
import fs from 'fs';
const TAG = process.argv.find(a=>a.startsWith('--tag='))?.split('=')[1] ?? 'now';
fs.mkdirSync('docs/review',{recursive:true});
const b = await chromium.launch({ headless:false, args:['--use-gl=angle','--enable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:3 });
await p.goto('http://localhost:5173/', { waitUntil:'networkidle' });
await p.waitForFunction(()=>!!window._nav,null,{timeout:60000});
await p.evaluate(()=>window._nav.startLevel(13)); await p.waitForTimeout(2600);
await p.evaluate(()=>window._nav.startLevel(5));  await p.waitForTimeout(2600);
await p.evaluate(async ()=>{ const gs=window._nav.getGs(); const M=await import('/src/models/Shooter.js');
  for(let c=0;c<gs.activeColCount;c++){ const col=gs.columns[c];
    while(col.shooters.length<3) col.shooters.push(new M.Shooter({color:gs.colors[col.shooters.length%gs.colors.length],damage:3,column:c})); } });
await p.waitForTimeout(800);
const info = await p.evaluate(()=>{ const s3=window._nav.getShooter3D();
  const zs=[0,1,2].map(r=>+s3._slots[0][r].group.position.z.toFixed(4));
  return { zs, pitch:+(zs[1]-zs[0]).toFixed(4) }; });
const f = `docs/review/transition-${TAG}-L13toL5.png`;
await p.screenshot({ path:f, clip:{ x:0, y:560, width:390, height:284 } });
console.log(`ballZ=[${info.zs.join(', ')}] pitch=${info.pitch} (band-600 correct = 1.835) -> ${f}`);
await b.close();
