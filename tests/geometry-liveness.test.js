// Geometry-liveness guard — makes the recurring stale-geometry bug class
// STRUCTURALLY detectable (~10 instances to date; see
// THREE_LANE_REDESIGN_BATCH.md §7a and the 2026-07-24 sweep findings).
//
// Three checks, each run at EVERY lane count the game ships (1-4), because the
// band — and therefore every derived screen coordinate — is lane-count-keyed
// since commit 63092fd:
//
//   A. NO-OVERLAP CHAIN — the bottom chrome must stack without collisions:
//      breach stripe → queue rows → bench tray → booster bar → stage bottom.
//      This exact chain, asserted numerically, would have caught the band=730
//      off-screen-queue production bug AND the bench-overlap bug (BENCH_Y=703
//      hardcoded for band-540 geometry while the queue moved with band).
//
//   B. IMPORT-FREEZE CANARY — every derived geometry value must CHANGE when
//      the lane count flips 4→3 (different band ⇒ different projection). A
//      value that stays identical across the flip is frozen at import time —
//      the exact `const X = f(projection)` pattern that produced
//      QUEUE_BENCH_BOUNDARY_Y (drop-misrouting) and BENCH_SPRITE_SIZE
//      (bench/queue sprite size mismatch).
//
//   C. LITERAL LINT — canonical-value literals may appear only in their
//      defining file. Catches new hardcoded mirrors at review time.
//
// NOTE on the read pattern: geometry accessors are read via
// `fn?.() ?? legacyConst` so this test runs meaningfully against BOTH the
// pre-fix code (const exports — where it fails on the NUMBERS, demonstrating
// the catch) and the fixed code (live function exports — where it passes).
import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  setActiveLaneCount, BREACH_LINE_Y, PX_PER_WU, BOMB_R, bombSlotScreenY,
} from '../src/renderer3d/projection.js';
import * as Bench from '../src/renderer/BenchRenderer.js';
import * as DragDropMod from '../src/input/DragDrop.js';
import { BAR_Y, BAR_H } from '../src/renderer/BoosterBar.js';

const APP_H = 844;
const STRIPE_HALF = 8;

// Live-or-legacy readers (see NOTE above).
const benchY       = () => Bench.benchY?.() ?? Bench.BENCH_Y;
const benchSlotH   = () => Bench.benchSlotH?.() ?? Bench.BENCH_SLOT_H;
const benchSprite  = () => Bench.benchSpriteSize?.() ?? Bench.BENCH_SPRITE_SIZE;
const queueBenchBoundary = () =>
  DragDropMod.queueBenchBoundaryY?.() ?? DragDropMod.QUEUE_BENCH_BOUNDARY_Y ?? NaN;

afterAll(() => setActiveLaneCount(4));

describe('geometry liveness (stale-constant guard)', () => {
  // ── A. No-overlap chain, every lane count ────────────────────────────────
  for (const lc of [1, 2, 3, 4]) {
    describe(`lane count ${lc}: bottom chrome stacks without collision`, () => {
      it('stripe → queue → bench → booster bar → stage bottom', () => {
        setActiveLaneCount(lc);
        const stripeBottom = BREACH_LINE_Y + STRIPE_HALF;
        const ballR        = BOMB_R * PX_PER_WU;
        const slot0Top     = bombSlotScreenY(0) - ballR;
        const row2Bottom   = bombSlotScreenY(2) + ballR;
        const trayTop      = benchY() - 4;
        const trayBottom   = benchY() + benchSlotH() + 4;

        expect(slot0Top, 'queue row 0 overlaps the breach stripe')
          .toBeGreaterThan(stripeBottom);
        expect(row2Bottom, `queue row 2 ball bottom (${row2Bottom.toFixed(1)}) overlaps the bench tray top (${trayTop.toFixed(1)})`)
          .toBeLessThanOrEqual(trayTop + 0.5);
        expect(trayBottom, `bench tray bottom (${trayBottom.toFixed(1)}) overlaps the booster bar (BAR_Y=${BAR_Y})`)
          .toBeLessThanOrEqual(BAR_Y);
        expect(BAR_Y + BAR_H, 'booster bar extends past the 844px stage')
          .toBeLessThanOrEqual(APP_H);
      });
    });
  }

  // ── B. Import-freeze canary ──────────────────────────────────────────────
  describe('derived geometry is live, not frozen at import', () => {
    it('bench + drag-boundary values change when the lane count (band) flips 4→3', () => {
      setActiveLaneCount(4);
      const at4 = {
        benchY: benchY(), sprite: benchSprite(), boundary: queueBenchBoundary(),
        slot2: bombSlotScreenY(2), breach: BREACH_LINE_Y,
      };
      setActiveLaneCount(3);
      const at3 = {
        benchY: benchY(), sprite: benchSprite(), boundary: queueBenchBoundary(),
        slot2: bombSlotScreenY(2), breach: BREACH_LINE_Y,
      };
      // Projection itself is known-live (sanity anchors):
      expect(at3.breach).not.toBeCloseTo(at4.breach, 1);
      expect(at3.slot2).not.toBeCloseTo(at4.slot2, 1);
      // The consumers must track it:
      expect(at3.benchY, 'benchY frozen — does not track the band')
        .not.toBeCloseTo(at4.benchY, 1);
      expect(at3.sprite, 'bench sprite size frozen — bench/queue ball sizes diverge')
        .not.toBeCloseTo(at4.sprite, 1);
      expect(at3.boundary, 'queue/bench drop boundary frozen — drops misroute on 3-lane levels')
        .not.toBeCloseTo(at4.boundary, 1);
    });
  });

  // ── C. Literal lint — canonical values only in their defining file ───────
  describe('no hardcoded mirrors of canonical geometry values', () => {
    const SRC = join(process.cwd(), 'src');
    const files = [];
    (function walk(dir) {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (name.endsWith('.js')) files.push(p);
      }
    })(SRC);

    // pattern → the only file allowed to contain it
    const RULES = [
      { re: /\bBENCH_Y\s*=\s*\d/,  allow: [], desc: 'a numeric BENCH_Y (bench Y must be derived, never assigned a literal)' },
      { re: /=\s*703\b/,           allow: [], desc: 'the retired bench literal 703' },
      { re: /\.y\s*=\s*710\b/,     allow: [], desc: 'the FTUE banner literal 710 (derive from BAR_Y)' },
      { re: /BAR_Y\s*=\s*\d/,      allow: ['BoosterBar.js'], desc: 'a numeric BAR_Y outside its defining file' },
      { re: /BOOSTER_BAR_TOP_Y\s*=\s*\d/, allow: ['projection.js'], desc: 'a numeric booster-bar mirror outside projection.js (which is test-guarded)' },
    ];

    // Strip comments before matching — the lint checks CODE, not prose. A
    // literal named in an explanatory comment ("// mirrors BAR_Y=752") is not
    // a mirror bug, and flagging it would punish the comments this codebase
    // relies on. Removes /* block */ and // line comments (good enough — no
    // regex-literal or string edge case in this codebase trips it).
    const stripComments = (src) =>
      src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

    for (const { re, allow, desc } of RULES) {
      it(`no file contains ${desc}`, () => {
        const offenders = files
          .filter(f => !allow.some(a => f.endsWith(a)))
          .filter(f => re.test(stripComments(readFileSync(f, 'utf8'))))
          .map(f => f.slice(SRC.length + 1));
        expect(offenders, `found ${desc} in: ${offenders.join(', ')}`).toEqual([]);
      });
    }
  });
});
