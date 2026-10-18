// Title screen capture: node scripts/_title-shot.mjs <out.png> [unlockedLevel]
import { chromium } from 'playwright';
const [out, lvArg] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const lv = Number(lvArg ?? 6);
await p.addInitScript((u) => { const stars = {}; for (let i = 1; i < u; i++) stars[i] = 2; localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: u, stars })); }, lv);
await p.goto(process.env.QA_URL ?? 'http://localhost:5176/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 120000 });
await p.waitForFunction(() => window._nav.getTitlePlayY?.() != null, null, { timeout: 60000 }).catch(() => {});
await p.waitForTimeout(2500);
await p.screenshot({ path: out });
await b.close();
