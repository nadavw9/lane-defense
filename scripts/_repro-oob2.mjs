import { chromium } from 'playwright';
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle','--enable-gpu'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
await p.evaluate(() => window._nav.startLevel(8));
await p.waitForTimeout(2500);
const r = await p.evaluate(async () => {
  const nav=window._nav, gs=nav.getGs(), gl=nav.getGameLoop(), dd=nav.getDragDrop(), ms=nav.getMergeSequencer();
  const clear=async()=>{for(let a=0;a<20;a++){if(!gl.paused&&!dd.inputBlocked)return true;nav.dismissTutorial();
    if(dd.inputBlocked){const c=document.querySelector('canvas:not(#three-canvas)'),rc=c.getBoundingClientRect();
      const o={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,
        clientX:rc.left+0.5*rc.width,clientY:rc.top+(420/844)*rc.height};
      c.dispatchEvent(new PointerEvent('pointerdown',o));c.dispatchEvent(new PointerEvent('pointerup',o));}
    await new Promise(r=>setTimeout(r,200));}return !gl.paused&&!dd.inputBlocked;};
  await clear();
  const seen=[]; const phases=new Set();
  const inFlight=()=>Object.values(gs.firingSlots).some(s=>s!==null)||(gs.hitStopRemaining??0)>0;
  for(let k=0;k<70;k++){
    await clear();
    // Push game time forward so crisis-enabled phases are reached.
    gs.elapsed = Math.min((gs.duration ?? 90) * 0.85, gs.elapsed + 3.0);
    phases.add(gs.phase);
    let w=0; while(w<6000&&(inFlight()||ms.active||ms._pending)){await new Promise(r=>setTimeout(r,40));w+=40;}
    if(gs.isOver) break;
    for(let c=0;c<gs.activeColCount;c++){
      const col=gs.columns[c];
      if(col.shooters.length>3) seen.push({k,phase:gs.phase,kind:'column>3',col:c,n:col.shooters.length});
      if(col.stash) seen.push({k,phase:gs.phase,kind:'stash',col:c});
    }
    const lane=[0,1,2,3].find(l=>l<gs.activeLaneCount&&gs.lanes[l].cars.length);
    if(lane==null) break;
    nav.deploy(0,lane);
    await new Promise(r=>setTimeout(r,380));
  }
  return { seen, phases:[...phases], cols:gs.columns.slice(0,gs.activeColCount).map(c=>({n:c.shooters.length,stash:!!c.stash})), over:gs.isOver };
});
console.log('phases reached:', r.phases.join(', '), ' over:', r.over);
console.log('columns now:', JSON.stringify(r.cols));
console.log('OUT-OF-GRID observations:', r.seen.length);
for(const o of r.seen.slice(0,10)) console.log('   ', JSON.stringify(o));
await p.screenshot({ path: 'docs/review/oob-repro.png' });
await b.close();
