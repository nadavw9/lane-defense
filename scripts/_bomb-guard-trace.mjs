import { chromium } from 'playwright';
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle','--enable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
await p.goto('http://localhost:5173/', { waitUntil:'networkidle' });
await p.waitForFunction(()=>!!window._nav,null,{timeout:60000});
for (const lv of [8,13]) {
  await p.evaluate((l)=>window._nav.startLevel(l), lv);
  await p.waitForTimeout(2500);
  const r = await p.evaluate(async () => {
    const nav=window._nav, gs=nav.getGs(), gl=nav.getGameLoop(), dd=nav.getDragDrop();
    for(let i=0;i<60&&(gl.paused||dd.inputBlocked);i++){nav.dismissTutorial();await new Promise(r=>setTimeout(r,100));}
    const LR = await import('/src/renderer/LaneRenderer.js');
    const PR = await import('/src/renderer/PositionRegistry.js');
    const bs = gl._boosterState;
    bs.bombs = Math.max(1,bs.bombs);
    if (typeof bs.activateBomb==='function') bs.activateBomb(); else bs.bombMode=true;
    const y = LR.posToScreenY((3/gs.gridRows)*100);
    const x = PR.getLaneScreenX(1);
    return {
      lanes: gs.activeLaneCount, gridRows: gs.gridRows,
      tapX:+x.toFixed(1), tapY:+y.toFixed(1),
      ROAD_TOP_Y:+LR.ROAD_TOP_Y.toFixed(1), ROAD_BOTTOM_Y:+LR.ROAD_BOTTOM_Y.toFixed(1),
      margin:+LR.frontRowTapMargin(gs.gridRows).toFixed(1),
      inputBlocked: dd.inputBlocked, state: dd._state,
      ddBombMode: dd._boosterState?.bombMode ?? null,
      glBombMode: bs.bombMode,
      sameBoosterObject: dd._boosterState === bs,
      ddGridRows: dd._gridRows,
      yInBand: y >= LR.ROAD_TOP_Y && y <= LR.ROAD_BOTTOM_Y + LR.frontRowTapMargin(gs.gridRows),
      hitLane: dd._hitTestLane(x,y),
    };
  });
  console.log(`\nL${lv}: lanes=${r.lanes} gridRows=${r.gridRows} ddGridRows=${r.ddGridRows}`);
  console.log(`  tap (${r.tapX}, ${r.tapY})  road ${r.ROAD_TOP_Y}..${r.ROAD_BOTTOM_Y} margin ${r.margin}  yInBand=${r.yInBand}  hitLane=${r.hitLane}`);
  console.log(`  inputBlocked=${r.inputBlocked}  state='${r.state}'  ddBombMode=${r.ddBombMode}  glBombMode=${r.glBombMode}  sameBoosterObj=${r.sameBoosterObject}`);
}
await b.close();
