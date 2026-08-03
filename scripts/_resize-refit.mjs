import { chromium } from 'playwright';
const b = await chromium.launch({ headless:false, args:['--use-gl=angle','--enable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:3 });
await p.goto('http://localhost:5173/', { waitUntil:'networkidle' });
await p.waitForFunction(()=>!!window._nav,null,{timeout:60000});
await p.evaluate(()=>window._nav.startLevel(8)); await p.waitForTimeout(2000);
const probe = async (label) => {
  const m = await p.evaluate(()=>{ const c=document.querySelector('canvas:not(#three-canvas)');
    const t=document.querySelector('#three-canvas');
    const r=e=>{const b=e.getBoundingClientRect();return {y:+b.y.toFixed(1),h:+b.height.toFixed(1)};};
    return {pixi:r(c), three:r(t), vh:innerHeight}; });
  const bottom = m.pixi.y + m.pixi.h;
  const cut = bottom > m.vh + 0.5;
  console.log(`${label.padEnd(34)} vh=${String(m.vh).padStart(4)}  pixi ${m.pixi.h}@${m.pixi.y} bottom=${bottom.toFixed(1)}  three ${m.three.h}@${m.three.y}  ${cut?'<<< BOTTOM CUT '+(bottom-m.vh).toFixed(0)+'px':'ok'}`);
};
await probe('start 390x844');
// Simulate a mobile URL bar appearing: viewport gets SHORTER after load.
await p.setViewportSize({width:390,height:740}); await p.waitForTimeout(900);
await probe('shrunk to 390x740 (URL bar in)');
await p.setViewportSize({width:390,height:844}); await p.waitForTimeout(900);
await probe('back to 390x844');
// And a desktop window resize
await p.setViewportSize({width:1440,height:900}); await p.waitForTimeout(900);
await probe('desktop 1440x900');
await p.setViewportSize({width:1440,height:500}); await p.waitForTimeout(900);
await probe('short desktop 1440x500');
await b.close();
