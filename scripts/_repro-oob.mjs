// Reproduce "bombs out of the grid": play into later phases and capture any
// bomb whose rendered position falls outside the socket grid, plus the state
// that produced it. Observation only — no hypothesis baked in.
import { chromium } from 'playwright';
const LEVEL = Number(process.argv[2] ?? 8);
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle','--enable-gpu'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
await p.evaluate((lv) => window._nav.startLevel(lv), LEVEL);
await p.waitForTimeout(2500);

const findings = await p.evaluate(async () => {
  const nav = window._nav, gs = nav.getGs(), gl = nav.getGameLoop(), ms = nav.getMergeSequencer();
  const dd = nav.getDragDrop();
  const inFlight = () => Object.values(gs.firingSlots).some(s=>s!==null) || (gs.hitStopRemaining??0)>0;
  const clear = async () => { for(let a=0;a<20;a++){ if(!gl.paused && !dd.inputBlocked) return true;
      nav.dismissTutorial();
      if (dd.inputBlocked){ const c=document.querySelector('canvas:not(#three-canvas)'), r=c.getBoundingClientRect();
        const o={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,
          clientX:r.left+0.5*r.width, clientY:r.top+(420/844)*r.height};
        c.dispatchEvent(new PointerEvent('pointerdown',o)); c.dispatchEvent(new PointerEvent('pointerup',o)); }
      await new Promise(r=>setTimeout(r,200)); } return !gl.paused && !dd.inputBlocked; };

  const obs = [];
  for (let k = 0; k < 60; k++) {
    if (!(await clear())) break;
    let w=0; while(w<8000 && (inFlight()||ms.active||ms._pending)){ await new Promise(r=>setTimeout(r,40)); w+=40; }
    if (gs.isOver) break;
    // RECORD anything structurally out of the visible grid.
    for (let c = 0; c < gs.activeColCount; c++) {
      const col = gs.columns[c];
      if (col.shooters.length > 3) obs.push({ k, phase: gs.phase, kind: 'column>3', col, n: col.shooters.length });
      if (col.stash) obs.push({ k, phase: gs.phase, kind: 'stash occupied', col: c });
    }
    const lane=[0,1,2,3].find(l=>l<gs.activeLaneCount && gs.lanes[l].cars.length);
    if (lane==null) break;
    nav.deploy(0, lane);
    await new Promise(r=>setTimeout(r,450));
  }
  return { obs, phase: gs.phase, elapsed: +gs.elapsed.toFixed(1),
           cols: gs.columns.slice(0,gs.activeColCount).map(c=>({n:c.shooters.length, stash:!!c.stash})) };
});
console.log('final phase:', findings.phase, ' elapsed:', findings.elapsed);
console.log('columns:', JSON.stringify(findings.cols));
console.log('out-of-grid observations:', findings.obs.length);
for (const o of findings.obs.slice(0,8)) console.log('  ', JSON.stringify(o));
await p.screenshot({ path: 'docs/review/oob-repro.png' });
await b.close();
