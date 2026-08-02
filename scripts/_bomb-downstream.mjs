// L8 re-test with the modal actually cleared (tap, as the harness does), plus the
// downstream-combo hypothesis: does a BOMB lane-clear TRIGGER a colour bomb, which
// would then clear that colour board-wide and read as "lane AND column"?
import { chromium } from 'playwright';
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle','--enable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
await p.goto('http://localhost:5173/', { waitUntil:'networkidle' });
await p.waitForFunction(()=>!!window._nav,null,{timeout:60000});
await p.evaluate(()=>window._nav.startLevel(8));
await p.waitForTimeout(2500);
const r = await p.evaluate(async () => {
  const nav=window._nav, gs=nav.getGs(), gl=nav.getGameLoop(), dd=nav.getDragDrop();
  const canvas = document.querySelector('canvas:not(#three-canvas)');
  const tapCanvas = () => { const rc=canvas.getBoundingClientRect();
    const o={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,
      clientX:rc.left+0.5*rc.width, clientY:rc.top+(420/844)*rc.height};
    canvas.dispatchEvent(new PointerEvent('pointerdown',o)); canvas.dispatchEvent(new PointerEvent('pointerup',o)); };
  for (let i=0;i<40 && (gl.paused||dd.inputBlocked); i++){ nav.dismissTutorial(); tapCanvas(); await new Promise(r=>setTimeout(r,200)); }
  const cleared = !dd.inputBlocked && !gl.paused;

  const M  = await import('/src/models/Car.js');
  const LR = await import('/src/renderer/LaneRenderer.js');
  const PR = await import('/src/renderer/PositionRegistry.js');

  let colorBombFired = 0;
  const origCB = gl._fireColorBomb?.bind(gl);
  if (origCB) gl._fireColorBomb = (c) => { colorBombFired++; return origCB(c); };
  const calls=[]; const origPlace = gl.placeBombOnLane.bind(gl);
  gl.placeBombOnLane = (l,t)=>{ calls.push({l,t}); return origPlace(l,t); };

  const rows = gs.gridRows, TARGET=1;
  const out=[];
  const yOf=(r)=>LR.posToScreenY((r/rows)*100);
  const positions=[['on car row3',yOf(3)],['EXACTLY between',(yOf(3)+yOf(4))/2],['on car row4',yOf(4)]];
  for (const [label,y] of positions) {
    for (let l=0;l<gs.activeLaneCount;l++){ gs.lanes[l].cars.length=0;
      for (const rr of [3,4]) { const car=new M.Car({color:gs.colors[(l+rr)%gs.colors.length],hp:3,speed:5});
        car.hp=3; car.row=rr; car.position=(rr/rows)*100; car.__tag=`L${l}R${rr}`; gs.lanes[l].cars.push(car); } }
    const bs=gl._boosterState; bs.bombs=Math.max(1,bs.bombs);
    if (typeof bs.activateBomb==='function') bs.activateBomb(); else bs.bombMode=true;
    calls.length=0; const cb0=colorBombFired;
    dd.onPointerDown(PR.getLaneScreenX(TARGET), y);
    await new Promise(r=>setTimeout(r,400));
    const alive=new Set();
    for(let l=0;l<gs.activeLaneCount;l++) for(const c of gs.lanes[l].cars) if(c.__tag) alive.add(c.__tag);
    const dead=[]; for(let l=0;l<gs.activeLaneCount;l++) for(const rr of [3,4]) if(!alive.has(`L${l}R${rr}`)) dead.push(`L${l}R${rr}`);
    out.push({label, y:+y.toFixed(1), blocked:dd.inputBlocked, calls:calls.slice(),
              colourBombs: colorBombFired-cb0, dead, strays:dead.filter(t=>!t.startsWith(`L${TARGET}`))});
  }
  return { cleared, lanes: gs.activeLaneCount, out };
});
console.log(`\nL8 (3-lane) — modal cleared: ${r.cleared}   lanes=${r.lanes}   target lane 1`);
console.log('tap position     │     y │ blocked │ handler got   │ colourBombs │ killed        │ strays');
console.log('─────────────────┼───────┼─────────┼───────────────┼─────────────┼───────────────┼────────');
for (const o of r.out) {
  const got = o.calls.length ? o.calls.map(c=>`lane=${c.l} row=${c.t}`).join(' ') : '(never called)';
  console.log(`${o.label.padEnd(16)} │ ${String(o.y).padStart(5)} │ ${String(o.blocked).padEnd(7)} │ ${got.padEnd(13)} │ ${String(o.colourBombs).padStart(11)} │ ${(o.dead.join(',')||'-').padEnd(13)} │ ${o.strays.length?o.strays.join(',')+' <<<':'-'}`);
}
await b.close();
