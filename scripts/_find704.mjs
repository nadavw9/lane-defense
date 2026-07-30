import { chromium } from 'playwright';
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle','--enable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
await p.goto('http://localhost:5173/', { waitUntil:'networkidle' });
await p.waitForFunction(()=>!!window._nav,null,{timeout:60000});
await p.evaluate(()=>window._nav.startLevel(5)); await p.waitForTimeout(2200);
console.log(await p.evaluate(async () => {
  const P = await import('/src/renderer3d/projection.js');
  const out = {};
  const three = document.querySelector('#three-canvas');
  const main  = document.querySelector('canvas:not(#three-canvas)');
  if (three) { const r = three.getBoundingClientRect(); out['three-canvas rect'] = `top=${r.top.toFixed(1)} bottom=${r.bottom.toFixed(1)} h=${r.height.toFixed(1)}`; }
  if (main)  { const r = main.getBoundingClientRect();  out['main-canvas rect']  = `top=${r.top.toFixed(1)} bottom=${r.bottom.toFixed(1)} h=${r.height.toFixed(1)}`; }
  out['BREACH_LINE_Y']   = P.BREACH_LINE_Y;
  out['bombSlotScreenY(2)'] = P.bombSlotScreenY(2);
  out['bombSlotScreenY(2.5)'] = P.bombSlotScreenY(2.5);
  out['bombSlotScreenY(3)'] = P.bombSlotScreenY(3);
  out['bombSlotScreenY(3.5)'] = P.bombSlotScreenY(3.5);
  out['ballR'] = P.bombBallScreenRadius();
  out['slot2 ball bottom']   = P.bombSlotScreenY(2) + P.bombBallScreenRadius();
  out['slot2 rim bottom']    = P.bombSlotScreenY(2) + P.bombBallScreenRadius()*P.SOCKET_RIM_RATIO;
  out['slot2 shadow bottom'] = P.bombSlotScreenY(2) + P.bombBallScreenRadius()*P.SOCKET_SHADOW_RATIO;
  return out;
}));
await b.close();
