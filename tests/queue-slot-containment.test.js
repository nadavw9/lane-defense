// NOTHING MAY OVERLAP A RENDERED QUEUE SLOT — AT ANY LANE COUNT.
//
// 2026-07-31 device play: "bombs out of the grid" turned out to be TWO defects.
// The first (crisis inject exceeding COLUMN_CAPACITY) was fixed separately and
// could never have produced the visible symptom — that bomb renders nowhere.
// This is the one the player actually saw: the bench tray slid OVER the third
// row's socket ring, so the bottom row read as clipped.
//
// Cause: a slot is not its ball. The socket's outer shadow ring is drawn at
// SOCKET_SHADOW_RATIO (1.4375x) around the ball, so the slot extends 1.4375x the
// ball radius below its centre. benchY() cleared only the BALL, leaving the tray
// 0.95px (3-lane/band-600) and 3.01px (4-lane) inside the socket.
//
// The clip was WORSE at 4 lanes than 3, which is what rules out the band-600
// vertical squeeze: the ball->socket gap scales with radius, so the overlap is
// largest where balls are biggest, not where room is tightest.
//
// These assertions run at EVERY lane count because that is the axis the geometry
// is keyed on and the axis every previous stale-constant bug hid along.
import { describe, it, expect } from 'vitest';
import * as P from '../src/renderer3d/projection.js';

const LANE_COUNTS = [2, 3, 4];

// Mirrors BenchRenderer's constants. Imported values would drag in pixi.js and
// BoosterBar's import.meta.env, which is not available under vitest's node env.
const BENCH_QUEUE_GAP  = 4;
const BENCH_TRAY_PAD   = 4;
const BENCH_BAR_GAP    = 2;
const BENCH_SLOT_H_MAX = 50;
const BENCH_SLOT_H_MIN = 28;
const BAR_Y            = 752;

const benchY     = () => P.bombSlotRenderedBottom(2) + BENCH_QUEUE_GAP + BENCH_TRAY_PAD;
const benchSlotH = () => Math.max(BENCH_SLOT_H_MIN,
  Math.min(BENCH_SLOT_H_MAX, BAR_Y - BENCH_BAR_GAP - BENCH_TRAY_PAD - benchY()));

describe('rendered queue slots are never overlapped by the chrome below them', () => {
  it('bombSlotRenderedBottom includes the socket ring, not just the ball', () => {
    for (const n of LANE_COUNTS) {
      P.setActiveLaneCount(n);
      const ball   = P.bombSlotScreenY(2) + P.bombBallScreenRadius();
      const actual = P.bombSlotRenderedBottom(2);
      expect(actual, `lanes=${n}: rendered bottom must sit below the bare ball`)
        .toBeGreaterThan(ball);
      expect(actual - P.bombSlotScreenY(2)).toBeCloseTo(
        P.bombBallScreenRadius() * P.SOCKET_SHADOW_RATIO, 6);
    }
  });

  it('the bench tray clears the last slot at every lane count', () => {
    for (const n of LANE_COUNTS) {
      P.setActiveLaneCount(n);
      const trayTop  = benchY() - BENCH_TRAY_PAD;
      const slotEdge = P.bombSlotRenderedBottom(2);
      expect(trayTop, `lanes=${n}: tray top ${trayTop.toFixed(2)} overlaps slot 2 (ends ${slotEdge.toFixed(2)})`)
        .toBeGreaterThanOrEqual(slotEdge);
    }
  });

  it('EVERY rendered slot sits above the tray, not just the last one', () => {
    // Cheap to assert and it catches a pitch/clearance regression that moves an
    // interior slot without moving slot 2.
    for (const n of LANE_COUNTS) {
      P.setActiveLaneCount(n);
      const trayTop = benchY() - BENCH_TRAY_PAD;
      for (let row = 0; row < 3; row++) {
        expect(P.bombSlotRenderedBottom(row), `lanes=${n}, slot ${row} overlaps the tray`)
          .toBeLessThanOrEqual(trayTop);
      }
    }
  });

  it('the fix does not push the bench through the booster bar', () => {
    // The clip could also have been "fixed" by shoving the tray down into the
    // booster bar, trading a visible defect for an invisible one. It must not.
    for (const n of LANE_COUNTS) {
      P.setActiveLaneCount(n);
      const trayBottom = benchY() + benchSlotH() + BENCH_TRAY_PAD;
      expect(trayBottom, `lanes=${n}: tray bottom ${trayBottom.toFixed(2)} runs into the booster bar at ${BAR_Y}`)
        .toBeLessThanOrEqual(BAR_Y);
    }
  });

  it('the bench keeps a usable touch target at every lane count', () => {
    // Clearing the socket costs vertical room. If that ever pushes a slot under
    // the 28px touch floor, the trade has gone too far and this must say so.
    for (const n of LANE_COUNTS) {
      P.setActiveLaneCount(n);
      expect(benchSlotH(), `lanes=${n}: bench slot height fell below the touch floor`)
        .toBeGreaterThanOrEqual(BENCH_SLOT_H_MIN);
    }
  });

  it('BenchRenderer derives the tray from the canonical extent, not the ball', () => {
    // Structural guard: the exact regression was a hand-rolled `+ BOMB_R * PX_PER_WU`.
    const src = require('fs').readFileSync('src/renderer/BenchRenderer.js', 'utf8');
    const fn  = src.slice(src.indexOf('export function benchY'), src.indexOf('export function benchSlotH'));
    expect(fn, 'benchY must use bombSlotRenderedBottom()').toMatch(/bombSlotRenderedBottom\s*\(\s*2\s*\)/);
    expect(fn, 'benchY must not re-derive the slot edge from the bare ball radius')
      .not.toMatch(/BOMB_R\s*\*\s*PX_PER_WU/);
  });
});
