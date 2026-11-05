// Local proof of the App Review demo autopilot (src/input/demoAutopilot.js) before the simulator
// run: a brand-new save against a dev server started with VITE_DEMO_AUTOPILOT=true, recorded as a
// video, with a state log every 5 s. Headed GPU Chromium, so the game runs at real speed.
//   QA_URL=http://localhost:5175/ node scripts/_demo-autopilot-check.mjs <outDir> [seconds=160]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const [out = 'docs/review/demo-autopilot', secArg = '160'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--enable-gpu'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: out, size: { width: 390, height: 844 } } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(process.env.QA_URL ?? 'http://localhost:5175/');
const log = [];
for (let t = 0; t < Number(secArg); t += 5) {
  await p.waitForTimeout(5000);
  const s = await p.evaluate(() => {
    const n = window._nav; if (!n) return { nav: false };
    const gs = n.getGs(), sc = n.getScreens();
    return { lvl: gs?.levelId, turn: gs?.turnCount, over: gs?.isOver, won: gs?.won, title: sc.title, pre: sc.preLevel, map: sc.levelSelect, win: sc.win };
  }).catch(e => ({ err: e.message }));
  log.push(`${t + 5}s ${JSON.stringify(s)}`);
  console.log(log[log.length - 1]);
}
await ctx.close(); await b.close();
writeFileSync(`${out}/log.txt`, log.join('\n') + '\nerrors: ' + JSON.stringify(errs));
console.log('errors', errs);
