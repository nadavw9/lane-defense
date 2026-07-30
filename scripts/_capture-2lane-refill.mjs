import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { tapStage } from './pixi-coords.mjs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'docs', 'review');
const URL = `http://localhost:${process.env.PORT || 5173}/lane-defense/`;
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await page.evaluate(() => window._nav?.startLevel(2));
await page.waitForTimeout(3000);
const board = () => page.evaluate(() => {
  const gs = window._nav.getGs(); const lanes=[];
  for (let i=0;i<gs.activeLaneCount;i++){const cars=gs.lanes[i].cars; lanes.push({lane:i,count:cars.length,rows:cars.map(c=>c.row)});}
  const cols=[]; for (let i=0;i<(gs.activeColCount??gs.columns.length);i++){const b=gs.columns[i].shooters[0]; cols.push(b?{col:i,color:b.color,dmg:b.damage}:{col:i,empty:true});}
  const fronts=[]; for(let i=0;i<gs.activeLaneCount;i++){const c=gs.lanes[i].cars[0]; fronts.push(c?c.color:null);}
  return {lanes,cols,fronts};
});
function pick(b){for(const ln of b.lanes){const fc=b.fronts[ln.lane];if(!fc)continue;for(const co of b.cols){if(!co.empty&&co.color===fc)return{col:co.col,lane:ln.lane};}}return null;}
const dismiss=async()=>{for(let i=0;i<3;i++){await tapStage(page,195,407);await page.waitForTimeout(200);}};
let advances=0;
for(let turn=0; turn<12 && advances<4; turn++){
  await dismiss();
  const b=await board(); const c=pick(b);
  if(!c){await page.waitForTimeout(400);continue;}
  await page.evaluate(({c,l})=>window._nav.deploy(c,l),{c:c.col,l:c.lane});
  advances++; await page.waitForTimeout(650);
}
await dismiss();
await page.waitForTimeout(5200); // full settle: COMBO + achievement toasts fade
const fin=await board();
console.log('ADVANCES',advances,'FINAL',JSON.stringify(fin.lanes));
await page.screenshot({ path: path.join(OUT,'01.png'), fullPage:false });
await page.screenshot({ path: path.join(OUT,'02-road-zoom.png'), clip:{x:70,y:60,width:250,height:430} });
console.log('saved');
await browser.close();
