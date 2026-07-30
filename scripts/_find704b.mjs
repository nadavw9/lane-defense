import { chromium } from 'playwright';
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle','--enable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
await p.goto('http://localhost:5173/', { waitUntil:'networkidle' });
await p.waitForFunction(()=>!!window._nav,null,{timeout:60000});
await p.evaluate(()=>window._nav.startLevel(5)); await p.waitForTimeout(2200);
console.log(await p.evaluate(async () => {
  const P = await import('/src/renderer3d/projection.js');
  const out = {};
  out['screenYToZ(704.7) = z at the visible panel edge'] = P.screenYToZ(704.7);
  out['screenYToZ(715.2) = z needed to contain slot2 socket'] = P.screenYToZ(715.2);
  // Walk the three scene graph looking for large ground planes and where they end.
  const g = window._nav.getRenderer3D?.() ?? null;
  out['has renderer3d accessor'] = !!g;
  const scene = window.__scene3d ?? null;
  out['window.__scene3d'] = !!scene;
  return out;
}));
await b.close();
