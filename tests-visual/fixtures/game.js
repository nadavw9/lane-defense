// Shared fixture for the visual harness.
//
// Every test gets a `game` object that:
//   - boots the app and waits for the dev hooks (window._nav) to exist
//   - records TRIPWIRES: console.error, uncaught page errors, and any HTTP >= 400
//     response — asserted empty automatically after every test. This alone catches
//     the two historical production-404 bug classes (case-mismatch, gitignored asset).
//   - exposes game-state / geometry helpers that read the game's OWN source of
//     truth (window._nav.getPositions / getGs / getHudBounds), so assertions never
//     re-derive frustum math that could drift from the real renderer.
//   - samples real rendered pixels via screenshot + sharp (colored-car vs grey-road
//     saturation checks), because the WebGL canvas can't be read directly.

import { test as base, expect } from '@playwright/test';
import sharp from 'sharp';
import { posToScreenYProjected, setActiveLaneCount } from '../../src/renderer3d/projection.js';

// Requests that are allowed to fail without failing the test:
//  - favicon (browser noise)
//  - third-party analytics/ads endpoints (Firebase RTDB returns 401 with locked
//    rules, AdMob is absent in web builds) — external services, not our assets.
const IGNORED_URLS = [
  /favicon\.ico$/,
  /firebaseio\.com/,
  /googleads|admob|googlesyndication|doubleclick/,
];

// GitHub-hosted CI runners have no GPU — Chromium's WebGL falls back to
// software rendering (SwiftShader, forced explicitly via playwright.config.js
// launchOptions), and booting the full app (WebGL context + Pixi + Three.js
// scene init) costs much more wall-clock there than on a real GPU. Same
// budget-not-steps fix as the per-test timeout in playwright.config.js —
// see that file's comment for the CI investigation this is based on.
const BOOT_TIMEOUT_MS = process.env.CI ? 90_000 : 45_000;

export class GamePage {
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.failedRequests = [];
  }

  async boot() {
    this.page.on('pageerror', (e) => this.consoleErrors.push(`pageerror: ${e.message}`));
    this.page.on('console', (m) => {
      // Generic resource-load failures are duplicated (with the URL) by the
      // response listener below, which filters IGNORED_URLS precisely — the
      // console variant has no URL, so skip it here to avoid false positives.
      if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) {
        this.consoleErrors.push(`console.error: ${m.text()}`);
      }
    });
    this.page.on('response', (r) => {
      if (r.status() >= 400 && !IGNORED_URLS.some((rx) => rx.test(r.url()))) {
        this.failedRequests.push(`${r.status()} ${r.url()}`);
      }
    });
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await this.page.waitForFunction(() => !!window._nav, null, { timeout: BOOT_TIMEOUT_MS });
    // Let the loading screen finish + title settle.
    await this.page.waitForTimeout(1500);
  }

  async startLevel(n) {
    await this.page.evaluate((lv) => window._nav.startLevel(lv), n);
    await this.page.waitForTimeout(2500);          // level boot + prime
    await this.dismissOverlays();
  }

  // Tap screen-center a few times to clear FTUE / intro-card overlays.
  async dismissOverlays(times = 5) {
    for (let i = 0; i < times; i++) {
      await this.tapStage(195, 420);
      await this.page.waitForTimeout(180);
    }
    await this.page.waitForTimeout(300);
  }

  tapStage(x, y) {
    return this.page.evaluate(([sx, sy]) => {
      const c = document.querySelector('canvas:not(#three-canvas)');
      const r = c.getBoundingClientRect();
      const o = {
        bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
        clientX: r.left + (sx / 390) * r.width,
        clientY: r.top + (sy / 844) * r.height,
      };
      c.dispatchEvent(new PointerEvent('pointerdown', o));
      c.dispatchEvent(new PointerEvent('pointerup', o));
    }, [x, y]);
  }

  // Full pointer drag on the pixi canvas (for real DragDrop deploy tests).
  async dragStage(x1, y1, x2, y2, steps = 6) {
    const dispatch = (type, x, y) => this.page.evaluate(([t, sx, sy]) => {
      const c = document.querySelector('canvas:not(#three-canvas)');
      const r = c.getBoundingClientRect();
      const o = {
        bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
        clientX: r.left + (sx / 390) * r.width,
        clientY: r.top + (sy / 844) * r.height,
      };
      c.dispatchEvent(new PointerEvent(t, o));
    }, [type, x, y]);
    await dispatch('pointerdown', x1, y1);
    for (let i = 1; i <= steps; i++) {
      await dispatch('pointermove', x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps);
      await this.page.waitForTimeout(40);
    }
    await dispatch('pointerup', x2, y2);
  }

  // Plain-data snapshot of GameState (gs itself has cycles — never return it raw).
  gs() {
    return this.page.evaluate(() => {
      const gs = window._nav.getGs();
      if (!gs) return null;
      return {
        levelId: gs.levelId,
        isOver: gs.isOver,
        laneCount: gs.activeLaneCount,
        colCount: gs.activeColCount,
        colors: gs.colors,
        gridRows: gs.gridRows,
        goals: gs.goals,
        goalProgress: gs.goalProgress,
        lanes: gs.lanes.slice(0, gs.activeLaneCount).map((l) => ({
          count: l.cars.length,
          rows: l.cars.map((c) => c.row),
          frontColor: l.cars[0]?.color ?? null,
          frontHp: l.cars[0]?.hp ?? null,
          frontRow: l.cars[0]?.row ?? null,
        })),
        cols: gs.columns.slice(0, gs.activeColCount).map((c) => ({
          count: c.shooters.length,
          topColor: c.shooters[0]?.color ?? null,
          topDamage: c.shooters[0]?.damage ?? null,
        })),
      };
    });
  }

  /**
   * Tag EVERY car currently in a lane and record the cohort's total hp.
   *
   * Why a cohort and not one car: these specs used to tag a single "target" car
   * and assert it took damage. A shot hits whatever is at the FRONT when it
   * lands, and with merges gated the board advances further before impact — so
   * the tagged car is legitimately no longer front, legitimately survives, and a
   * different car takes the hit exactly as designed. The assertion then reported
   * correct behaviour as a targeting failure. That was the third raced proxy
   * found in this fixture; all three shared one shape — asserting on
   * PRE-ARRANGED OBJECT IDENTITY, which is always a timing window.
   *
   * A cohort is immune to all three: advancement keeps the tags, merges do not
   * touch cars, and refill adds cars that are NOT in the cohort (so they cannot
   * mask a drop the way a raw lane-total would).
   */
  async snapshotLane(laneIdx) {
    return this.page.evaluate((l) => {
      const cars = window._nav.getGs().lanes[l].cars;
      let totalHp = 0;
      const ids = [];
      cars.forEach((c, i) => {
        c.__cohort = `L${l}#${i}#${Date.now()}`;
        ids.push(c.__cohort);
        totalHp += c.hp ?? 0;
      });
      return { ids, totalHp, count: cars.length };
    }, laneIdx);
  }

  /**
   * Did the tagged cohort take damage? True if any cohort car died OR the
   * surviving cohort's total hp fell. Both facts hold regardless of which car
   * ended up front, and regardless of refill.
   */
  async laneCohortDamaged(snapshot, laneIdx) {
    return this.page.evaluate(([snap, l]) => {
      const cars = window._nav.getGs().lanes[l].cars;
      const alive = cars.filter((c) => snap.ids.includes(c.__cohort));
      const survivingHp = alive.reduce((a, c) => a + (c.hp ?? 0), 0);
      return {
        died: alive.length < snap.ids.length,
        hpDropped: survivingHp < snap.totalHp,
        before: snap.totalHp,
        after: survivingHp,
        lost: snap.ids.length - alive.length,
      };
    }, [snapshot, laneIdx]);
  }

  positions() { return this.page.evaluate(() => window._nav.getPositions()); }
  hudBounds() { return this.page.evaluate(() => window._nav.getHudBounds()); }
  winLevel()  { return this.page.evaluate(() => window._nav.winLevel()); }

  // Wait until NO shot is in flight in any lane. This is a PRECONDITION for a
  // deploy to be accepted at all: GameLoop.deploy() rejects outright if
  // `Object.values(firingSlots).some(s => s !== null)` — a shot anywhere blocks
  // a deploy everywhere (it is turn-based). dismissOverlays() taps the road,
  // which can itself launch a shot, so a test that dismisses and then
  // immediately deploys is racing that shot. Call this before reading any
  // "before" state you intend to act on.
  /**
   * Wait until the game will actually ACCEPT a deploy.
   *
   * This must mirror every precondition GameLoop.deploy() checks, plus every
   * state that blocks input. It has been wrong twice by omission:
   *   - originally it only waited for the shot to clear (firingSlots), because
   *     that was the only blocker at the time;
   *   - it did not know about the MERGE SEQUENCER, which pauses the game loop
   *     and sets dragDrop.inputBlocked for the length of its animation.
   *
   * The merge omission is what broke CI when shot/merge ordering was gated
   * (2026-07-27). Gating did not introduce a bug — it moved merges from "during
   * flight" to "immediately after the shot resolves", which is exactly the
   * instant waitForIdle() used to return. The fixture then deployed into a
   * paused, input-blocked game and reported "deploy didn't land". Diagnosed from
   * the CI failure screenshot: a merged bomb mid-animation in one column and
   * drained sockets in another, at assertion time.
   *
   * If a new blocker is ever added to deploy(), it belongs HERE too.
   */
  async waitForIdle(timeout = 20000) {
    try {
      await this.page.waitForFunction(
        () => {
          const gs = window._nav.getGs();
          if (!Object.values(gs.firingSlots).every((s) => s === null)) return false;
          // Merge sequencer: active OR holding a deferred check. Both pause the
          // loop / block input, and a pending one is about to.
          const ms = window._nav.getMergeSequencer?.();
          if (ms && (ms.active || ms._pending)) return false;
          // MODAL / HINT CARD. Earning a colour bomb — and every intro or hint
          // card — goes through _enqueueModal, and _runNextModal() calls
          // gameLoop.pause() until the card is dismissed by a real tap. A paused
          // loop never resolves a shot, so a test that deploys while one is up
          // sees ZERO damage no matter what the code does. Headless CI has nobody
          // to dismiss it, so it stays up.
          // Observable via dragDrop.inputBlocked (set from _modalActive each
          // frame, GameApp ~2185). This omission is the same class as the merge
          // omission above: a blocker the wait did not know existed.
          const dd = window._nav.getDragDrop?.();
          if (dd && dd.inputBlocked) return false;
          // Hit-stop: firingSlots clears when TRAVEL ends, but damage is applied
          // 30-50ms later when the hit-stop expires. "Slot empty" is not "shot
          // resolved".
          if ((gs.hitStopRemaining ?? 0) > 0) return false;
          return true;
        },
        null,
        { timeout },
      );
      return true;
    } catch { return false; }
  }

  /**
   * Why the game would refuse a deploy right now, or null if it would accept.
   * Mirrors GameLoop.deploy's guards (GameLoop.js ~105-108) plus the input
   * blockers, so a rejected deploy can be reported as a REJECTION rather than
   * silently becoming "the shot missed".
   */
  async deployBlockedReason(colIdx, laneIdx) {
    return this.page.evaluate(([c, l]) => {
      const gs = window._nav.getGs();
      const ms = window._nav.getMergeSequencer?.();
      if (!gs.columns[c]?.top())                                   return `column ${c} is empty`;
      if (Object.values(gs.firingSlots).some((s) => s !== null))   return 'a shot is already in flight (deploy is turn-based)';
      if (gs.firingSlots[l])                                       return `lane ${l} already has a shot`;
      if (ms?.active)                                              return 'a merge animation is running (game loop paused, input blocked)';
      if (ms?._pending)                                            return 'a merge is queued and about to start';
      if (gs.isOver)                                               return 'the level is already over';
      return null;
    }, [colIdx, laneIdx]);
  }

  async deploy(colIdx, laneIdx) {
    // GameLoop.deploy() returns undefined on both success and every rejection
    // path, so the call itself tells us nothing. Confirm the launch with a
    // signal only the success path can produce: the tagged bomb OBJECT leaving
    // the column. (shooters.length is erased by the queue's immediate refill,
    // and firingSlots[lane] !== null is a transient a poll can miss.)
    await this.waitForIdle();
    for (let attempt = 0; attempt < 2; attempt++) {
      // Tag the bomb AND colour-match the target in ONE evaluate, so no window
      // exists between them. The previous shape — caller recolours cars[0] to
      // match shooters[0], then calls deploy(), which waits and may retry — let
      // a merge change the queue top in between, so a different-coloured bomb
      // fired and correctly dealt no damage. The old fixture reported that as
      // "deploy had no effect", identical to five unrelated causes.
      //
      // Atomic here, and it records WHAT ACTUALLY LAUNCHED (colour + damage), so
      // the caller asserts against the bomb that really flew rather than against
      // an arrangement it made earlier and assumed still held.
      const tagged = await this.page.evaluate(([c, l]) => {
        const gs  = window._nav.getGs();
        const top = gs.columns[c].shooters[0];
        if (!top) return null;
        top.__deployTag = 'inflight';
        // Recolour EVERY car in the lane, not just cars[0]. The shot hits
        // whichever car is front AT IMPACT, and the board advances between here
        // and landing — matching only one car leaves a legitimate colour mismatch
        // (and correctly zero damage) whenever a different car ends up front.
        if (l != null) for (const car of gs.lanes[l]?.cars ?? []) car.color = top.color;
        const target = l != null ? gs.lanes[l]?.cars?.[0] : null;
        if (target) { target.__testTag = 'target'; }
        const snap = { color: top.color, damage: top.damage ?? 1, targetHp: target?.hp ?? null };
        // FIRE IN THE SAME EVALUATE. Tag, colour-match and deploy must be one
        // synchronous block: splitting them left an await gap, and with merges
        // gated they fire exactly when waitForIdle() returns — landing in that
        // gap and swapping the top bomb, so a different-coloured bomb launched
        // and correctly dealt no damage. Proven: with the gate off this test
        // passed 3/3; with it on it failed reproducibly until the gap closed.
        window._nav.deploy(c, l);
        return snap;
      }, [colIdx, laneIdx]);
      this.lastDeployedBomb = tagged || null;
      // NOTE: the deploy happens INSIDE the same evaluate as the tag+recolour
      // (above), not here. Splitting them left an await gap, and with merges
      // gated they fire exactly when waitForIdle() returns — landing in that gap
      // and changing which bomb is on top.
      const left = await this.page.evaluate(
        (c) => !window._nav.getGs().columns[c].shooters.some((b) => b.__deployTag === 'inflight'),
        colIdx,
      );
      this.lastDeployAccepted = left;
      if (left) { this.lastDeployBlockedReason = null; break; }   // accepted
      await this.waitForIdle();                 // rejected — wait out whatever blocked it, then retry
    }
    // Wait for the actual event (GameLoop clears firingSlots[laneIdx] once the
    // shot's travel-time timer elapses and combat/advance/refill resolve) rather
    // than a fixed wall-clock sleep. A fixed 650ms was tuned against a normal
    // frame rate; CI's slower software-WebGL rendering (documented in
    // .github/workflows/deploy.yml) plus L4-L8's higher laneTargetCarCount
    // (THREE_LANE_REDESIGN_BATCH.md §2 pilot, 2026-07-23 — more simultaneous
    // per-lane car movement to resolve) made that margin too tight, causing
    // real, reproducible CI failures ("deploy had no effect") on state read
    // before resolution actually finished. Poll instead — correct at any
    // rendering speed — with a generous ceiling as a safety net.
    // Budget measured under SwiftShader, not guessed — see the note in
    // boundaries.spec. The first shot of a level resolves in ~4.6-4.8s there
    // (vs ~0.7-0.9s later), so a 5000ms budget was ~95% consumed and any slower
    // runner blew it. On timeout the caller must be able to tell "never
    // resolved" from "resolved but missed", so record it rather than swallowing.
    this.lastShotResolved = true;
    try {
      await this.page.waitForFunction(
        (l) => window._nav.getGs().firingSlots[l] === null,
        laneIdx,
        { timeout: 20000 },
      );
    } catch { this.lastShotResolved = false; }
    await this.page.waitForTimeout(150);   // let the resolved state settle one more tick
  }

  // Row → stage Y through the game's OWN projection math (renderer3d/projection.js)
  // — the same formula the live camera uses, so this can never drift from the
  // renderer the way a copied constant would.
  //
  // This module is imported directly in the Node test process — a SEPARATE
  // module instance from the one Vite bundles into the browser page. Since
  // 2026-07-23 (THREE_LANE_REDESIGN_BATCH.md §1) the projected band is
  // lane-count-keyed, stateful module state (set via Scene3D.setLaneCount() ->
  // projection.js's setActiveLaneCount() inside the browser). This Node-side
  // copy never sees that call, so it silently stayed on the default (4-lane)
  // band unless synced here explicitly — pass the level's actual laneCount so
  // this copy's state matches what the browser is actually rendering.
  rowToStageY(row, gridRows, laneCount = 4) {
    setActiveLaneCount(laneCount);
    const pos = (row / (gridRows - 1)) * 100;
    return posToScreenYProjected(pos);
  }

  // Mean color + colorfulness of a small region (stage coords == client coords
  // at viewport 390×844). Uses screenshot + sharp — WebGL canvas is unreadable
  // directly. `colorfulness` = mean(maxChannel - minChannel): grey road ≈ 0-10,
  // a colored car / painted panel ≈ 40+.
  async sampleRegion(cx, cy, size = 10) {
    const half = size / 2;
    const buf = await this.page.screenshot({
      clip: {
        x: Math.max(0, cx - half), y: Math.max(0, cy - half),
        width: size, height: size,
      },
    });
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    let r = 0, g = 0, b = 0, colorfulness = 0;
    const px = info.width * info.height;
    for (let i = 0; i < px; i++) {
      const R = data[i * info.channels], G = data[i * info.channels + 1], B = data[i * info.channels + 2];
      r += R; g += G; b += B;
      colorfulness += Math.max(R, G, B) - Math.min(R, G, B);
    }
    return {
      r: r / px, g: g / px, b: b / px,
      brightness: (r + g + b) / (3 * px),
      colorfulness: colorfulness / px,
    };
  }

  // Count pixels in a region whose summed |ΔR|+|ΔG|+|ΔB| from refRgb exceeds
  // thresh. Robust "is a sprite here?" metric for NARROW sprites (bikes): a
  // 12px mean dilutes a thin bike below any workable threshold (L40's all-bike
  // opening read meanDist 22-46 vs road on a real GPU and failed under CI
  // SwiftShader), while its core pixels sit 200+ away — count them instead.
  async strongPixelCount(cx, cy, size, refRgb, thresh = 80) {
    const half = size / 2;
    const buf = await this.page.screenshot({
      clip: { x: Math.max(0, cx - half), y: Math.max(0, cy - half), width: size, height: size },
    });
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    let count = 0;
    const px = info.width * info.height;
    for (let i = 0; i < px; i++) {
      const d = Math.abs(data[i * info.channels] - refRgb.r)
              + Math.abs(data[i * info.channels + 1] - refRgb.g)
              + Math.abs(data[i * info.channels + 2] - refRgb.b);
      if (d > thresh) count++;
    }
    return count;
  }

  assertNoTripwires() {
    expect(this.consoleErrors, `Console errors:\n${this.consoleErrors.join('\n')}`).toEqual([]);
    expect(this.failedRequests, `Failed requests (404s ship as broken art!):\n${this.failedRequests.join('\n')}`).toEqual([]);
  }
}

export const test = base.extend({
  game: async ({ page }, use) => {
    const game = new GamePage(page);
    await game.boot();
    await use(game);
    game.assertNoTripwires();   // every visual test fails on console.error / 404
  },
});

export { expect };
