// Menu / back-navigation QA: every title icon, the map, the shop, the pause menu
// and armed boosters, driven by REAL taps and the REAL Escape key (the desktop
// twin of Android back). Asserts screen state after every step, never time.
//   QA_URL=http://localhost:5174/ node scripts/menu-qa.mjs <outDir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'menu-qa';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|404/.test(m.text())) errs.push(m.text()); });
p.on('response', r => { if (r.status() === 404) errs.push(`404 ${r.url()}`); });
await p.addInitScript(() => { if (!localStorage.getItem('lane-defense-v1')) localStorage.setItem('lane-defense-v1', JSON.stringify({ unlockedLevel: 12, coins: 500, tutorialsSeen: {} })); });
await p.goto(process.env.QA_URL ?? 'http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });

const res = [];
let n = 0;
const shot = async (name) => p.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` });
const ok = (name, cond, extra = '') => { res.push(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
const S = () => p.evaluate(() => window._nav.getScreens());
const tap = async (sx, sy) => {
  const r = await p.evaluate(() => document.querySelector('canvas:not(#three-canvas)').getBoundingClientRect().toJSON());
  await p.mouse.click(r.x + sx / 390 * r.width, r.y + sy / 844 * r.height);
};
// Wait until pred(screens) is true (state, not time). Returns the last state.
const until = async (pred, ms = 20000) => {
  const t0 = Date.now(); let s;
  while (Date.now() - t0 < ms) { s = await S(); if (pred(s)) return s; await p.waitForTimeout(150); }
  return s;
};
const esc = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(250); };
const anyMenu = (s) => s.daily || s.achievements || s.stats || s.settings || s.shop || s.carManual || s.howToPlay;

// ── Title ────────────────────────────────────────────────────────────────
let s = await until(s => s.title, 60000);
ok('title shows', s.title);
await p.waitForTimeout(5000);   // intro bomb-drop reveals the buttons
await shot('title');
const rowY = 844 * 0.51 + 88 + 70;
const icons = [['daily', 69], ['achievements', 237], ['stats', 321]];
for (const [key, x] of icons) {
  await tap(x, rowY);
  s = await until(s => s[key], 8000);
  ok(`title → ${key} opens`, s[key]);
  await shot(`${key}`);
  await esc();
  s = await until(s => !anyMenu(s), 5000);
  ok(`Escape closes ${key}, back on title`, !s[key] && s.title, JSON.stringify({ title: s.title }));
}
// Settings (gear) → How to play → Escape → Escape
await tap(358, 34);
s = await until(s => s.settings, 8000);
ok('gear opens settings', s.settings);
await shot('settings');
await esc();
s = await until(s => !s.settings, 5000);
ok('Escape closes settings', !s.settings && s.title);

// Challenge icon → whatever it opens must be backable to a sane screen
await tap(153, rowY);
s = await until(s => s.preLevel || !s.title || s.daily, 8000);
ok('challenge icon does something', s.preLevel || !s.title, JSON.stringify({ preLevel: s.preLevel, title: s.title, levelSelect: s.levelSelect }));
await shot('challenge');
await esc();
s = await until(s => !s.preLevel, 6000);
ok('Escape leaves the challenge card', !s.preLevel, JSON.stringify({ levelSelect: s.levelSelect, title: s.title }));
if (!s.levelSelect && !s.title) { await p.evaluate(() => { window._nav.cleanAll(); window._nav.showLevelSelect(); }); }

// ── Map → shop → back ────────────────────────────────────────────────────
if (!(await S()).levelSelect) { await p.evaluate(() => { window._nav.cleanAll(); window._nav.showLevelSelect(); }); }
s = await until(s => s.levelSelect, 8000);
ok('map shows', s.levelSelect);
await tap(362, 34);
s = await until(s => s.shop, 8000);
ok('map shop button opens shop', s.shop);
await shot('shop');
await esc();
s = await until(s => !s.shop, 5000);
ok('Escape closes shop, map still there', !s.shop && s.levelSelect);
await esc();
s = await until(s => !s.levelSelect, 5000);
ok('Escape on map returns to title', s.title && !s.levelSelect, JSON.stringify({ title: s.title }));

// ── Level: Escape pauses, Escape resumes ─────────────────────────────────
await p.evaluate(() => window._nav.startLevel(7));
s = await until(s => s.pauseBtn && !s.introCard, 30000);
for (let i = 0; i < 25; i++) {
  s = await S();
  if (!s.paused && !s.modal && !s.introCard && s.blockers.length === 0) break;
  await p.evaluate(() => window._nav.dismissTutorial()); await tap(195, 560); await p.waitForTimeout(400);
}
ok('level running before pause test', !s.paused, JSON.stringify(s.blockers));
// Nothing left over from the menus may sit on top of the board (an orphaned
// title once covered every level after TROPHIES → back).
for (const [x, y] of [[195, 420], [271, 802]]) {
  const hit = await p.evaluate(([x, y]) => window._nav.stageTop(x, y).chain.join(' | '), [x, y]);
  ok(`no menu art on top of the board at ${x},${y}`, !/designed\/title|level-?select|map-/i.test(hit), /designed\/title|level-?select|map-/i.test(hit) ? hit.slice(0, 300) : '');
}
await esc();
s = await until(s => s.pause, 5000);
ok('Escape mid-level opens pause', s.pause && s.paused);
await shot('pause');
await esc();
s = await until(s => !s.pause, 5000);
ok('Escape on pause resumes', !s.pause && !s.paused, JSON.stringify({ paused: s.paused }));

// ── Armed boosters: Escape cancels, does not pause ───────────────────────
await p.evaluate(() => window._nav.setBoosters(2, 2, 2));
const hud = await p.evaluate(() => window._nav.getHudBounds());
const c = (r) => [r.x + r.w / 2, r.y + r.h / 2];
await tap(...c(hud.boosterBomb));
await p.waitForTimeout(300);
let bs = await p.evaluate(() => ({ bomb: window._nav.getBoosterState().bombMode }));
ok('bomb booster arms', bs.bomb, bs.bomb ? '' : JSON.stringify({ hit: await p.evaluate(() => window._nav.stageTop(271, 802)) }));
await esc();
bs = await p.evaluate(() => ({ bomb: window._nav.getBoosterState().bombMode }));
s = await S();
ok('Escape disarms bomb without pausing', !bs.bomb && !s.pause, JSON.stringify({ pause: s.pause }));
ok('disarming refunds nothing lost', s.boosters.bombs === 2, `bombs=${s.boosters.bombs}`);

await tap(...c(hud.boosterColor));
bs = await p.evaluate(() => ({ cc: window._nav.getBoosterState().colorChangeMode }));
ok('colour change arms', bs.cc);
const car = await p.evaluate(() => window._nav.getCarScreenPositions().filter(c => c.row >= 1)[0]);
if (car) { await tap(car.x, car.y); }
s = await until(s => s.picker, 4000);
ok('picker opens on a car', s.picker);
await shot('picker');
await esc();
s = await S();
bs = await p.evaluate(() => ({ cc: window._nav.getBoosterState().colorChangeMode }));
ok('Escape closes picker, clears mode, no pause', !s.picker && !bs.cc && !s.pause && !s.paused, JSON.stringify({ picker: s.picker, cc: bs.cc, pause: s.pause, paused: s.paused }));
ok('cancelled colour change spends nothing', s.boosters.colorChange === 2, `left=${s.boosters.colorChange}`);
await shot('after-cancel');

// ── Pause → quit → map, then everything is torn down ────────────────────
await esc();
s = await until(s => s.pause, 5000);
ok('pause again', s.pause);
// Pause → SETTINGS → HOW TO PLAY: Escape unwinds one layer at a time.
await tap(195, 510);
s = await until(s => s.settings, 5000);
ok('pause → settings opens', s.settings);
await esc();
s = await until(s => !s.settings, 5000);
ok('Escape closes settings back to pause (still paused)', !s.settings && s.pause && s.paused, JSON.stringify({ pause: s.pause, paused: s.paused }));
await tap(195, 382);
s = await until(s => s.howToPlay, 5000);
ok('pause → how to play opens', s.howToPlay);
await esc();
s = await until(s => !s.howToPlay, 5000);
ok('Escape closes how-to-play back to pause', !s.howToPlay && s.pause && s.paused, JSON.stringify({ pause: s.pause, paused: s.paused }));
await tap(195, 446);
s = await until(s => s.carManual, 5000);
ok('pause → car guide opens', s.carManual);
await esc();
s = await until(s => !s.carManual, 5000);
ok('Escape closes car guide back to pause', !s.carManual && s.pause && s.paused, JSON.stringify({ pause: s.pause, paused: s.paused }));
// QUIT LEVEL (may ask to confirm: tap twice) → map, board torn down.
await tap(195, 575);
await p.waitForTimeout(400);
s = await S();
if (s.pause) { await shot('quit-confirm'); await tap(195, 575); }
s = await until(s => s.levelSelect, 8000);
ok('QUIT LEVEL returns to the map', s.levelSelect && !s.pause && !s.pauseBtn, JSON.stringify({ pause: s.pause, pauseBtn: s.pauseBtn }));
await shot('after-quit');
// Map TROPHIES and back keeps exactly one map.
const kids0 = await p.evaluate(() => window._nav.stageTop(195, 400).stage.n);
await esc();
s = await until(s => s.title, 5000);
await tap(195, 474);
s = await until(s => s.levelSelect, 8000);
const kids1 = await p.evaluate(() => window._nav.stageTop(195, 400).stage.n);
ok('map → title → map does not grow the stage', kids1 <= kids0, `stage children ${kids0} → ${kids1}`);

console.log(res.join('\n'));
console.log('errors:', errs.length, errs.slice(0, 5));
await b.close();
