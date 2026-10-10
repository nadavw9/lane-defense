// Play Store listing captures (phone portrait). Windows + real GPU, headed.
//   node scripts/store-shots.mjs <outDir> [baseUrl]
//
// Store rules this encodes:
//   • L5+ ONLY — never L1 (CLAUDE.md: L1 is one lane, not representative).
//   • 390x844 @ DPR 3 = 1170x2532, above Play's 1080x1920 phone minimum.
//   • Headed + real GPU: headless falls back to SwiftShader here (~6fps) and is
//     not a quality-representative rasteriser. See CLAUDE.md.
//
// Every capture ASSERTS ITS PRECONDITIONS via _nav.getScreens() before the
// shutter fires. The first version of this script did not, and happily reported
// "4 turns played, running=true" for two frames that were actually the BREACH
// rescue dialog — a plausible quantitative result hiding a failed capture,
// exactly the failure mode CLAUDE.md warns about. A frame with any overlay up
// is discarded and the level is replayed with fewer turns.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const [out, base = 'http://localhost:5173/', only] = process.argv.slice(2);
if (!out) { console.error('usage: node scripts/store-shots.mjs <outDir> [baseUrl] [only]'); process.exit(1); }
// Optional 3rd arg: comma list of frame numbers to re-shoot (e.g. 07,08).
const ONLY = only ? only.split(',').map(s => s.trim()) : null;
mkdirSync(out, { recursive: true });

const starsUpTo = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 3]));

const saveFor = (unlocked) => ({
  saveVersion: 2,
  unlockedLevel: unlocked,
  coins: 850,
  inventory: { colorChange: 4, freeze: 4, bombs: 4 },
  stars: starsUpTo(Math.max(1, unlocked - 1)),
  seenComboTip: true,
  streakShields: 1,
});

const BANNERS = ['multi_lane', 'first_shot', 'bench', 'merge', 'first_car',
  'first_kill', 'first_combo', 'streak_charged', 'armor_break'];

const browser = await chromium.launch({
  headless: false,
  args: ['--use-gl=angle', '--enable-gpu', '--hide-scrollbars'],
});

async function newPage(save) {
  const p = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });
  await p.addInitScript(([s, banners]) => {
    localStorage.setItem('lane-defense-v1', JSON.stringify(s));
    localStorage.setItem('ftue_banners', JSON.stringify(banners));
    localStorage.setItem('lane_defense_seen_car_types',
      JSON.stringify(['small', 'big', 'jeep', 'truck', 'bigrig', 'tank']));
  }, [save, BANNERS]);
  await p.goto(base, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window._nav, null, { timeout: 90000 });
  return p;
}

const screens = (p) => p.evaluate(() => window._nav.getScreens());

// Is this frame safe to publish? No overlay, no dialog, loop alive.
async function frameIsClean(p) {
  const s = await screens(p);
  const bad = [];
  if (s.rescue) bad.push('rescue');
  if (s.win) bad.push('win');
  if (s.pause) bad.push('pause');
  if (s.paused) bad.push('paused');
  if (s.carManual) bad.push('carManual');
  if (s.howToPlay) bad.push('howToPlay');
  if (Array.isArray(s.blockers) && s.blockers.length) bad.push(...s.blockers);
  return { ok: bad.length === 0, bad };
}

// Wait until the trophy/achievement banner has fully left the HUD. A banner
// caught MID-FADE double-exposes with the goal card and is not publishable —
// L80 came back exactly like that. Fully opaque or fully gone; never between.
async function waitHudQuiet(p, ms = 9000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const a = await p.evaluate(() => {
      const hit = (o) => {
        if (!o) return null;
        if (typeof o.text === 'string' && /TROPHY UNLOCKED/i.test(o.text)) return o;
        for (const c of (o.children ?? [])) { const r = hit(c); if (r) return r; }
        return null;
      };
      const t = hit(window._nav.getStage());
      if (!t) return null;
      let al = t.alpha ?? 1, n = t.parent;
      while (n) { al *= (n.alpha ?? 1); n = n.parent; }
      return al;
    });
    if (a === null || a < 0.02) return true;
    await p.waitForTimeout(300);
  }
  return false;
}

async function unpause(p) {
  for (let i = 0; i < 14; i++) {
    if (!(await p.evaluate(() => window._nav.getGameLoop()?.paused))) return true;
    await p.evaluate(() => window._nav.dismissTutorial?.());
    await p.mouse.click(195, 470);
    await p.waitForTimeout(400);
  }
  return !(await p.evaluate(() => window._nav.getGameLoop()?.paused));
}

// Play up to n turns, stopping the moment the level is decided or any overlay
// appears. Waits on turnCount advancing — the only signal a turn completed.
async function play(p, n) {
  let done = 0;
  for (let i = 0; i < n; i++) {
    const s = await screens(p);
    if (s.rescue || s.win) break;
    const before = await p.evaluate(() => window._nav.getGs().turnCount ?? 0);
    const fired = await p.evaluate(() => {
      const loop = window._nav.getGameLoop(); const gs = loop._gs;
      if (gs.isOver || loop.paused) return 'stop';
      if (Object.values(gs.firingSlots).some(s => s)) return 'busy';
      for (let c = 0; c < gs.activeColCount; c++) {
        const top = gs.columns[c].top(); if (!top) continue;
        for (let l = 0; l < gs.activeLaneCount; l++) {
          const f = gs.lanes[l].frontCar();
          if (f && ((f.armor ?? 0) > 0 || f.color === top.color)) { loop.deploy(c, l); return 'ok'; }
        }
      }
      return 'none';
    });
    if (fired === 'stop') break;
    if (fired === 'ok') {
      await p.waitForFunction(
        (b) => (window._nav.getGs().turnCount ?? 0) > b || window._nav.getGs().isOver,
        before, { timeout: 15000 },
      ).catch(() => {});
      done++;
    } else {
      await p.waitForTimeout(500);
    }
  }
  await p.waitForTimeout(900);  // let VFX settle before the frame
  return done;
}

// Capture a board, retrying with fewer turns if the bot played itself into a
// dialog. Fewer turns = less traffic cleared = the level never reaches breach.
async function captureBoard(name, level, turns, label) {
  for (let attempt = 0, t = turns; attempt < 3; attempt++, t = Math.max(2, t - 3)) {
    const p = await newPage(saveFor(Math.max(level + 1, 2)));
    await p.evaluate((l) => window._nav.startLevel(l), level);
    await p.waitForFunction(() => {
      const gs = window._nav.getGs?.();
      return !!gs && Array.isArray(gs.lanes) && gs.lanes.length > 0;
    }, null, { timeout: 60000 });
    const running = await unpause(p);
    const played = await play(p, t);
    await waitHudQuiet(p);
    const { ok, bad } = await frameIsClean(p);
    if (ok && running) {
      await p.screenshot({ path: `${out}/${name}.png` });
      console.log(`  ${name}.png  L${level} ${label} — ${played} turns, clean`);
      await p.close();
      return true;
    }
    console.log(`    retry L${level}: discarded (${bad.join(',') || 'paused'}) after ${played} turns @${t}`);
    await p.close();
  }
  console.warn(`  ! ${name}: FAILED to get a clean frame for L${level}`);
  return false;
}

// name, level, turns, label
const BOARDS = [
  ['01', 12, 4, 'Toy Town mid-level traffic'],
  ['02', 30, 6, 'World 2 boss, roof-light sequence'],
  ['03', 38, 4, 'Neon Nights night highway'],
  ['04', 50, 7, 'Sun Valley desert, combo'],
  ['05', 65, 6, 'Frost Pass'],
  ['06', 80, 6, 'Harbor Lights'],
];

for (const [name, level, turns, label] of BOARDS) {
  if (ONLY && !ONLY.includes(name)) continue;
  await captureBoard(name, level, turns, label);
}

// Level map showing a COMPLETED world, where won levels show REPAIRED buildings.
// Two earlier attempts were wrong for opposite reasons: unlockedLevel:100 opened
// Starlight Strip (all rubble, nothing won yet), and unlockedLevel:18 opened the
// middle of Steel Yards (mostly grey padlocks). Unlocking to 31 and paging back
// one world lands on Steel Yards fully three-starred and fully rebuilt.
if (!ONLY || ONLY.includes('07')) {
  const p = await newPage(saveFor(31));
  await p.evaluate(() => window._nav.showLevelSelect());
  await p.waitForFunction(() => window._nav.getScreens().levelSelect, null, { timeout: 30000 });
  await p.waitForTimeout(1800);
  await p.mouse.click(138, 76);           // left world pager: world 3 -> world 2
  await p.waitForTimeout(1600);
  const title = await p.evaluate(() => {
    const hit = (o) => {
      if (!o) return null;
      if (typeof o.text === 'string' && /YARDS|TOWN|NIGHTS|VALLEY|PASS|HARBOR|STARLIGHT/i.test(o.text)) return o.text;
      for (const c of (o.children ?? [])) { const r = hit(c); if (r) return r; }
      return null;
    };
    return hit(window._nav.getStage());
  });
  console.log('  map world showing:', JSON.stringify(title));
  await p.screenshot({ path: `${out}/07.png` });
  console.log('  07.png  Level map, completed world with repaired city');
  await p.close();
}

// Settings > About with the anonymous Data ID. It sits below the fold, so the
// panel must be scrolled AND the row's on-screen position verified — the first
// attempt "found" the text in the stage tree while it was off-screen.
if (!ONLY || ONLY.includes('08')) {
  const p = await newPage(saveFor(18));
  await p.evaluate(() => window._nav.showSettings());
  await p.waitForFunction(() => window._nav.getScreens().settings, null, { timeout: 30000 });
  await p.waitForTimeout(1200);

  const findId = () => p.evaluate(() => {
    const hit = (o) => {
      if (!o) return null;
      if (typeof o.text === 'string' && /Data ID/i.test(o.text)) return o;
      for (const c of (o.children ?? [])) { const r = hit(c); if (r) return r; }
      return null;
    };
    const t = hit(window._nav.getStage());
    if (!t) return null;
    const g = t.getGlobalPosition();
    return { text: t.text, x: Math.round(g.x), y: Math.round(g.y) };
  });

  for (let i = 0; i < 14; i++) {
    const r = await findId();
    if (r && r.y > 40 && r.y < 800) break;      // comfortably inside 844pt stage
    await p.mouse.move(195, 500);
    await p.mouse.wheel(0, 240);
    await p.waitForTimeout(260);
  }
  const final = await findId();
  console.log('  Data ID row on-screen at:', JSON.stringify(final));
  if (!final || final.y <= 40 || final.y >= 800) {
    console.warn('  ! 08: Data ID NOT verified on screen — frame is not evidence');
  }
  await p.screenshot({ path: `${out}/08.png` });
  console.log('  08.png  Settings > About with anonymous Data ID');
  await p.close();
}

await browser.close();
console.log('\ndone ->', out);
