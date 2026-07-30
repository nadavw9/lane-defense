import { chromium } from 'playwright';
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle','--enable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
await p.goto('http://localhost:5173/', { waitUntil:'networkidle' });
await p.waitForFunction(()=>!!window._nav,null,{timeout:60000});
for (const [lv,label] of [[5,'3-lane band600'],[13,'4-lane']]) {
  await p.evaluate((l)=>window._nav.startLevel(l), lv); await p.waitForTimeout(2200);
  const m = await p.evaluate(async () => {
    const P  = await import('/src/renderer3d/projection.js');
    const BR = await import('/src/renderer/BenchRenderer.js');
    const BB = await import('/src/renderer/BoosterBar.js');
    const gs = window._nav.getGs();
    const r = P.bombBallScreenRadius();
    const s2 = P.bombSlotScreenY(2);
    return {
      lanes: gs.activeLaneCount, scale: P.BOMB_ZONE_SCALE, ceiling: P.BOMB_ZONE_SCALE_AT_540,
      ballR: r, s2, ballBottom: s2 + r,
      rimBottom: s2 + r*P.SOCKET_RIM_RATIO, shadowBottom: s2 + r*P.SOCKET_SHADOW_RATIO,
      benchY: BR.benchY(), trayTop: BR.benchY()-4, slotH: BR.benchSlotH(),
      trayBottom: BR.benchY() + BR.benchSlotH() + 4,
      BAR_Y: BB.BAR_Y, BOOSTER_BAR_TOP_Y: P.BOOSTER_BAR_TOP_Y,
      slot35Bottom: P.bombSlotScreenY(3.5) + r,
      slot2ShadowVsSolverTarget: (P.bombSlotScreenY(3.5)+r) - (P.BOOSTER_BAR_TOP_Y - 12),
    };
  });
  console.log(`\n=== L${lv} (${label})  lanes=${m.lanes} ===`);
  console.log(`  BOMB_ZONE_SCALE      : ${m.scale.toFixed(4)}  (ceiling ${m.ceiling})  ${Math.abs(m.scale-m.ceiling)<1e-6?'<< AT CEILING - solver not binding':'<< solver-limited'}`);
  console.log(`  ball radius          : ${m.ballR.toFixed(2)}`);
  console.log(`  slot2 centre         : ${m.s2.toFixed(2)}`);
  console.log(`  slot2 ball bottom    : ${m.ballBottom.toFixed(2)}`);
  console.log(`  slot2 rim bottom     : ${m.rimBottom.toFixed(2)}`);
  console.log(`  slot2 SHADOW bottom  : ${m.shadowBottom.toFixed(2)}   <- true rendered extent`);
  console.log(`  bench tray top       : ${m.trayTop.toFixed(2)}   (benchY ${m.benchY.toFixed(2)}, slotH ${m.slotH.toFixed(1)})`);
  console.log(`  CLIP = shadowBottom - trayTop = ${(m.shadowBottom - m.trayTop).toFixed(2)}px  ${m.shadowBottom>m.trayTop?'<< tray covers the socket by this much':'(clear)'}`);
  console.log(`  bench tray bottom    : ${m.trayBottom.toFixed(2)}  vs booster bar ${m.BAR_Y}  -> ${(m.BAR_Y-m.trayBottom).toFixed(2)}px clearance`);
  console.log(`  solver target: slot3.5 bottom ${m.slot35Bottom.toFixed(2)} vs limit ${m.BOOSTER_BAR_TOP_Y-12} -> overshoot ${m.slot2ShadowVsSolverTarget.toFixed(2)}`);
}
await b.close();
