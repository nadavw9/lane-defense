// GameLoop's turn-based guard, isolated from DragDrop's colour matching.
// Signal = which lanes hold a firing slot. (totalDeploys is NOT incremented by
// this entry point, so it cannot be used as the accept signal here.)
import { chromium } from 'playwright';
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle','--enable-gpu'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 60000 });
await p.evaluate(() => window._nav.startLevel(8));
await p.waitForTimeout(2500);
for (let i=0;i<6;i++){ await p.mouse.click(195,500); await p.waitForTimeout(350);}
await p.waitForTimeout(800);
const r = await p.evaluate(() => {
  const gs = window._nav.getGs();
  const slots = () => Object.entries(gs.firingSlots).filter(([,v]) => v).map(([k]) => k);
  const depth = () => gs.columns.map(c => c.shooters.length).join(',');
  const log = [];
  log.push(`start                       slots=[${slots()}] depths=${depth()}`);
  window._nav.deploy(0, 0);
  log.push(`deploy(col0, lane0)         slots=[${slots()}] depths=${depth()}`);
  window._nav.deploy(1, 1);
  log.push(`deploy(col1, lane1) IN FLIGHT slots=[${slots()}] depths=${depth()}`);
  window._nav.deploy(2, 2);
  log.push(`deploy(col2, lane2) IN FLIGHT slots=[${slots()}] depths=${depth()}`);
  return log;
});
r.forEach(l => console.log(l));
await b.close();
