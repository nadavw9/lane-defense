import { chromium } from 'playwright';
const b = await chromium.launch({ headless:false, args:['--use-gl=angle','--enable-gpu'] });
for (const [w,h,dpr,label] of [[1920,1080,1,'desktop 16:9'],[1440,900,1,'laptop'],[1366,768,1,'1366x768'],[390,844,3,'design']]) {
  const p = await b.newPage({ viewport:{width:w,height:h}, deviceScaleFactor:dpr });
  await p.goto('https://nadavw9.github.io/lane-defense/', { waitUntil:'networkidle' });
  await p.waitForTimeout(6000);
  const m = await p.evaluate(() => {
    const pixi = document.querySelector('canvas:not(#three-canvas)');
    const three = document.querySelector('#three-canvas');
    const r = e => { if(!e) return null; const b=e.getBoundingClientRect();
      return {x:+b.x.toFixed(1),y:+b.y.toFixed(1),w:+b.width.toFixed(1),h:+b.height.toFixed(1)}; };
    const err = document.getElementById('err-overlay');
    return { pixi:r(pixi), three:r(three), vw:innerWidth, vh:innerHeight,
             errVisible: err && err.style.display !== 'none', errText: err ? err.textContent.slice(0,200) : '' };
  });
  const p2 = m.pixi;
  const clip = p2 ? (p2.y < -0.5 || p2.y+p2.h > m.vh+0.5 || p2.x < -0.5 || p2.x+p2.w > m.vw+0.5) : null;
  console.log(`${label.padEnd(12)} ${w}x${h}  canvas ${p2?`${p2.w}x${p2.h} @ ${p2.x},${p2.y}`:'NONE'}  clipped=${clip}  err=${m.errVisible?'YES: '+m.errText.slice(0,80):'no'}`);
  await p.close();
}
await b.close();
