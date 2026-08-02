// Measure the BALL pitch straight off the Three meshes across a band transition.
// No projection import — immune to the module-instance problem that contaminated
// the previous instrument. Band 540 pitch = 2.8*0.82 = 2.296 wu;
// band 600 (post-reclaim) pitch = 2.8*0.6553 = 1.835 wu. If the balls keep the
// old pitch after switching bands, setLaneCount's position update is being
// clobbered by the stale _baseZ latch.
import { chromium } from 'playwright';
const b = await chromium.launch({ headless:false, args:['--use-gl=angle','--enable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
await p.goto('http://localhost:5173/', { waitUntil:'networkidle' });
await p.waitForFunction(()=>!!window._nav,null,{timeout:60000});
const read = async (label) => {
  const r = await p.evaluate(() => {
    const s3 = window._nav.getShooter3D?.(); const gs = window._nav.getGs();
    if (!s3) return null;
    const zs=[], bz=[];
    for (let row=0; row<3; row++) { const s=s3._slots?.[0]?.[row]; if(!s) continue;
      zs.push(+s.group.position.z.toFixed(4)); bz.push(s.group._baseZ==null?null:+s.group._baseZ.toFixed(4)); }
    return { lanes: gs.activeLaneCount, zs, bz,
             pitch: zs.length>1 ? +(zs[1]-zs[0]).toFixed(4) : null };
  });
  const expected = r.lanes===3 ? 1.835 : 2.296;
  console.log(`${label.padEnd(26)} lanes=${r.lanes}  ballZ=[${r.zs.join(', ')}]  pitch=${r.pitch}  expected=${expected}  ${Math.abs(r.pitch-expected)<0.02?'OK':'<<< STALE PITCH'}`);
  console.log(`${''.padEnd(26)} _baseZ=[${r.bz.join(', ')}]`);
};
await p.evaluate(()=>window._nav.startLevel(13)); await p.waitForTimeout(2600);
await read('L13 fresh (4-lane, 540)');
await p.evaluate(()=>window._nav.startLevel(5));  await p.waitForTimeout(2600);
await read('-> L5 (3-lane, 600)');
await p.waitForTimeout(4000);
await read('   L5 after +4s');
await p.evaluate(()=>window._nav.startLevel(13)); await p.waitForTimeout(2600);
await read('-> L13 again (4-lane)');
await b.close();
