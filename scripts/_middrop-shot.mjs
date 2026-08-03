import { chromium } from 'playwright';
import fs from 'fs';
fs.mkdirSync('docs/review',{recursive:true});
const b = await chromium.launch({ headless:false, args:['--use-gl=angle','--enable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:3 });
await p.goto('http://localhost:5173/', { waitUntil:'networkidle' });
await p.waitForFunction(()=>!!window._nav,null,{timeout:60000});
await p.evaluate(()=>window._nav.startLevel(8)); await p.waitForTimeout(2400);
const canvasTap = async () => p.evaluate(()=>{ const c=document.querySelector('canvas:not(#three-canvas)');
  const r=c.getBoundingClientRect(); const o={bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true,
    clientX:r.left+0.5*r.width, clientY:r.top+(420/844)*r.height};
  c.dispatchEvent(new PointerEvent('pointerdown',o)); c.dispatchEvent(new PointerEvent('pointerup',o)); });
for(let i=0;i<40;i++){ const blocked=await p.evaluate(()=>{const n=window._nav;n.dismissTutorial();return n.getGameLoop().paused||n.getDragDrop().inputBlocked;});
  if(!blocked) break; await canvasTap(); await p.waitForTimeout(200); }
await p.screenshot({ path:'docs/review/07-drop-AT-REST.png', clip:{x:0,y:560,width:390,height:284} });
// Fire, then poll until a slot is off its rest Z, and shoot the frame.
const base = await p.evaluate(()=>{const s=window._nav.getShooter3D(); return [0,1,2].map(r=>s._slots[0][r].group.position.z);});
await p.evaluate(()=>{ const n=window._nav,gs=n.getGs();
  const lane=[0,1,2,3].find(l=>l<gs.activeLaneCount&&gs.lanes[l].cars.length);
  if(lane!=null){ for(const c of gs.lanes[lane].cars) c.color=gs.columns[0].shooters[0].color; n.deploy(0,lane);} });
let shot=false;
for(let i=0;i<200;i++){
  const off = await p.evaluate((b)=>{const s=window._nav.getShooter3D();
    return [0,1,2].some(r=>Math.abs(s._slots[0][r].group.position.z-b[r])>0.35);}, base);
  if(off){ await p.screenshot({ path:'docs/review/08-drop-MID-ANIMATION.png', clip:{x:0,y:560,width:390,height:284} }); shot=true; break; }
  await p.waitForTimeout(12);
}
console.log(shot?'captured mid-drop frame':'never caught an off-slot frame');
await b.close();
