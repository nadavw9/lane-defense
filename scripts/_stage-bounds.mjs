import { chromium } from 'playwright';
const b = await chromium.launch({ headless:false, args:['--use-gl=angle','--enable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
await p.goto('http://localhost:5173/', { waitUntil:'networkidle' });
await p.waitForFunction(()=>!!window._nav,null,{timeout:60000});
await p.evaluate(()=>window._nav.startLevel(8)); await p.waitForTimeout(2200);
for(let i=0;i<12;i++) await p.evaluate(()=>window._nav.dismissTutorial());
await p.waitForTimeout(600);
const r = await p.evaluate(() => {
  // Walk the Pixi stage and report anything whose bounds exceed the 844 stage.
  const app = window.__PIXI_APP__ || window._pixiApp || null;
  const stage = app?.stage ?? window._nav?.getStage?.() ?? null;
  if (!stage) return { err:'no stage handle' };
  const over = [];
  let maxBottom = -Infinity, maxName = '';
  const walk = (node, path) => {
    if (!node.visible) return;
    let bb = null;
    try { bb = node.getBounds?.(); } catch {}
    if (bb && isFinite(bb.y) && isFinite(bb.height) && bb.height > 0 && bb.width > 0) {
      const bottom = bb.y + bb.height;
      if (bottom > maxBottom) { maxBottom = bottom; maxName = path; }
      if (bottom > 844.5) over.push({ path, top:+bb.y.toFixed(1), bottom:+bottom.toFixed(1), h:+bb.height.toFixed(1) });
    }
    for (let i=0;i<(node.children?.length??0);i++) walk(node.children[i], path+'/'+(node.children[i].label||node.children[i].constructor?.name||i));
  };
  walk(stage, 'stage');
  over.sort((a,b)=>b.bottom-a.bottom);
  return { maxBottom:+maxBottom.toFixed(1), maxName, over: over.slice(0,12), count: over.length };
});
console.log(JSON.stringify(r,null,1).slice(0,2200));
await b.close();
