// Demo autopilot (2026-11-05): plays the game by itself for App Review's screen recording
// (Guideline 2.1 asked for a video of the typical flow; the owner has no iPhone at hand, so the
// recording is made on the iOS Simulator in CI, where nothing can tap the screen from outside).
//
// Only in builds made with VITE_DEMO_AUTOPILOT=true (the ios-review-video workflow). GameApp
// imports this module behind that constant, so store builds do not contain it.
//
// It plays like a first-time player through REAL input: pointer events dispatched on the Pixi
// canvas (the same path a finger takes), with the drag animated so the bomb visibly travels:
// title PLAY -> level 1 (with its tutorial) -> win -> NEXT -> the map drive -> the next level's
// card -> PLAY -> ... It reads the board through window._nav (exposed in this build) only to
// choose a matching bomb, the way the QA bots do (scripts/ftue-play.mjs).

const STAGE_W = 390, STAGE_H = 844;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function canvas() { return document.querySelector('canvas:not(#three-canvas)'); }

function pointer(type, sx, sy) {
  const c = canvas(); if (!c) return;
  const r = c.getBoundingClientRect();
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true,
    clientX: r.left + (sx / STAGE_W) * r.width, clientY: r.top + (sy / STAGE_H) * r.height,
    buttons: type === 'pointerup' ? 0 : 1, button: 0 };
  c.dispatchEvent(new PointerEvent(type, o));
}

async function tap(sx, sy) { pointer('pointerdown', sx, sy); await sleep(90); pointer('pointerup', sx, sy); }

async function drag(x0, y0, x1, y1, ms = 520) {
  pointer('pointerdown', x0, y0);
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    const k = i / steps, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    await sleep(ms / steps);
    pointer('pointermove', x0 + (x1 - x0) * e, y0 + (y1 - y0) * e);
  }
  await sleep(60);
  pointer('pointerup', x1, y1);
}

async function waitFor(fn, ms, every = 200) {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) { const v = fn(); if (v != null && v !== false) return v; await sleep(every); }
  return null;
}

/** The best matching shot right now: the most advanced front car a column top can hit. */
function chooseMove(nav) {
  const gs = nav.getGs(), pos = nav.getPositions();
  let best = null;
  for (let c = 0; c < gs.activeColCount; c++) {
    const s = gs.columns[c].top(); if (!s) continue;
    for (let l = 0; l < gs.activeLaneCount; l++) {
      const f = gs.lanes[l].frontCar?.();
      if (!f || f.row < 1) continue;
      if (!(s.isColorBomb || (f.armor ?? 0) > 0 || f.color === s.color)) continue;
      const sc = f.row * 10 + (s.damage >= f.hp ? 5 : 0);
      if (!best || sc > best.sc) best = { sc, x0: pos.colX[c], y0: pos.slotY[0], x1: pos.laneX[l], y1: 330 };
    }
  }
  return best;
}

export async function runDemoAutopilot({ seconds = 170 } = {}) {
  const nav = await waitFor(() => window._nav, 60000);
  if (!nav) return;
  const t0 = performance.now();
  const left = () => seconds * 1000 - (performance.now() - t0);

  // Title: let the intro play, then PLAY (a new save goes straight into level 1).
  const playY = await waitFor(() => nav.getTitlePlayY?.(), 40000, 300);
  await sleep(1200);
  await tap(STAGE_W / 2, playY ?? 474);
  await sleep(2500);

  while (left() > 0) {
    const gs = nav.getGs(), gl = nav.getGameLoop(), dd = nav.getDragDrop(), sc = nav.getScreens();

    if (sc.preLevel) {                                            // a level card: PLAY
      await sleep(1500);
      const y = nav.getPreLevelPlayY?.();
      await tap(STAGE_W / 2, y ?? 609);
      await sleep(2500);
      continue;
    }
    if (gs?.isOver) {
      await sleep(2500);                                          // let the result screen be seen
      if (gs.won) {
        for (let i = 0; i < 10 && nav.getScreens().modal; i++) { nav.dismissGuides?.(); await sleep(400); }
        const y = await waitFor(() => nav.getWinNextY?.(), 8000, 300);
        await sleep(1200);
        await tap(STAGE_W / 2, y ?? 560);                         // NEXT -> map drive -> next card
        await waitFor(() => nav.getScreens().preLevel, 15000, 300);
      } else {
        nav.startLevel?.(gs.levelId);                             // a loss: replay the level
        await sleep(2500);
      }
      continue;
    }
    if (sc.introCard || sc.modal || dd?.inputBlocked) {          // a card: show it, then GOT IT / tap
      await sleep(1800);
      nav.dismissGuides?.();
      await tap(STAGE_W / 2, 640);
      await sleep(700);
      continue;
    }
    if (gl?.paused) { await sleep(1200); nav.dismissTutorial?.(); await sleep(500); continue; }
    if (gs.firingSlots?.some(Boolean) || (dd && dd._state !== 'idle')) { await sleep(120); continue; }

    const mv = chooseMove(nav);
    if (!mv) { await sleep(400); continue; }
    const turn = gs.turnCount;
    await drag(mv.x0, mv.y0, mv.x1, mv.y1);
    await waitFor(() => nav.getGs().turnCount !== turn || nav.getGs().isOver, 6000, 100);
    await sleep(450);                                             // a human beat between shots
  }
}
