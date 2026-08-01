import { chromium } from 'playwright';
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle','--enable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
await p.goto('http://localhost:5173/', { waitUntil:'networkidle' });
await p.waitForFunction(()=>!!window._nav,null,{timeout:60000});
for (const lv of [5,13]) {
  await p.evaluate((l)=>window._nav.startLevel(l), lv);
  await p.waitForTimeout(3000);
  const m = await p.evaluate(async () => {
    const P = await import('/src/renderer3d/projection.js');
    const BR= await import('/src/renderer/BenchRenderer.js');
    const gs= window._nav.getGs();
    return { lanes: gs.activeLaneCount, band: P.bandForLaneCount(gs.activeLaneCount),
      scale:+P.BOMB_ZONE_SCALE.toFixed(4), ballR:+P.bombBallScreenRadius().toFixed(2),
      breach:+P.BREACH_LINE_Y.toFixed(1),
      s0:+P.bombSlotScreenY(0).toFixed(1), s1:+P.bombSlotScreenY(1).toFixed(1), s2:+P.bombSlotScreenY(2).toFixed(1),
      benchY:+BR.benchY().toFixed(1), slotH:+BR.benchSlotH().toFixed(1) };
  });
  const ok = m.s0 > m.breach;
  console.log(`L${lv} lanes=${m.lanes} band=${m.band} scale=${m.scale} ballR=${m.ballR}`);
  console.log(`   breach ${m.breach}  slots ${m.s0}/${m.s1}/${m.s2}  benchY ${m.benchY} slotH ${m.slotH}   consistency(slot0>breach): ${ok?'OK':'INCONSISTENT'}`);
}
await b.close();
