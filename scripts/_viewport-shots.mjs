import { chromium } from 'playwright';
import fs from 'fs';
fs.mkdirSync('docs/review',{recursive:true});
const TAG = process.argv.find(a=>a.startsWith('--tag='))?.split('=')[1] ?? 'now';
const V = [[390,844,3,'design'],[1920,1080,1,'desktop16x9'],[1440,900,1,'laptop16x10'],[360,640,3,'short-android']];
const b = await chromium.launch({ headless:false, args:['--use-gl=angle','--enable-gpu'] });
for (const [w,h,dpr,name] of V) {
  const p = await b.newPage({ viewport:{width:w,height:h}, deviceScaleFactor:dpr });
  await p.goto('http://localhost:5173/', { waitUntil:'networkidle' });
  await p.waitForFunction(()=>!!window._nav,null,{timeout:60000});
  await p.evaluate(()=>window._nav.startLevel(8)); await p.waitForTimeout(2200);
  for (let i=0;i<12;i++) await p.evaluate(()=>window._nav.dismissTutorial());
  await p.evaluate(async ()=>{ const gs=window._nav.getGs(); const M=await import('/src/models/Shooter.js');
    for(let c=0;c<gs.activeColCount;c++){ const col=gs.columns[c];
      while(col.shooters.length<3) col.shooters.push(new M.Shooter({color:gs.colors[col.shooters.length%gs.colors.length],damage:3,column:c})); } });
  await p.waitForTimeout(700);
  const f = `docs/review/vp-${TAG}-${name}-${w}x${h}.png`;
  await p.screenshot({ path:f });   // FULL viewport, not a clip — shows letterboxing and any cut
  console.log(`${name.padEnd(14)} ${w}x${h} dpr${dpr} -> ${f}`);
  await p.close();
}
await b.close();
