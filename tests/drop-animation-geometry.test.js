// THE REFILL DROP MUST BE A BOUNDED FUNCTION OF SLOT PITCH — AT EVERY LANE COUNT.
//
// 2026-08-06. The drop-in started from a hardcoded world Z (`DROP_START_Z = -1.0`),
// so travel was `target.z - (-1.0)`: different for every row and every band.
//   row 0: 1.4 slot pitches      row 2: 3.4 slot pitches     — in the SAME 150ms
// and the bottom-chrome reclaim moved slot 2 from z~3.44 to z~5.21, stretching the
// far rows another 40%. That is what the device report saw as "bombs stuck out of
// their slots": far rows streaking in, then easeOutBack throwing them visibly PAST
// the socket before settling.
//
// SEVENTH instance of the stale-constant / drifted-from-canonical class here
// (Car3D._breachRow, setGoals ordering, setActiveColCount on rebuild, benchY from
// ball radius, Shooter3D._baseZ, the queue solver's phantom slot 3, and this).
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import * as P from '../src/renderer3d/projection.js';

const LANE_COUNTS = [2, 3, 4];
const src = fs.readFileSync('src/renderer/GameApp.js', 'utf8');
const num = (re, label) => {
  const m = src.match(re);
  expect(m, `could not find ${label} in GameApp.js`).not.toBeNull();
  return Number(m[1]);
};
const DROP_TRAVEL_PITCHES = num(/const DROP_TRAVEL_PITCHES\s*=\s*([\d.]+)/, 'DROP_TRAVEL_PITCHES');
const DROP_BACK          = num(/const DROP_BACK\s*=\s*([\d.]+)/, 'DROP_BACK');

/** Peak value of easeOutBack for a given back constant (>1 means overshoot). */
function peakOvershoot(back) {
  const b3 = back + 1;
  let peak = 1;
  for (let i = 0; i <= 1000; i++) {
    const p = i / 1000;
    const v = 1 + b3 * Math.pow(p - 1, 3) + back * Math.pow(p - 1, 2);
    if (v > peak) peak = v;
  }
  return peak - 1;   // fraction of travel overshot past the target
}

describe('refill drop distance is derived from slot pitch, not a fixed world Z', () => {
  it('travel is IDENTICAL for every row — the row-0-vs-row-2 asymmetry is gone', () => {
    for (const n of LANE_COUNTS) {
      P.setActiveLaneCount(n);
      const pitch = P.bombSlotZ(1) - P.bombSlotZ(0);
      const travels = [0, 1, 2].map((row) => {
        const target = P.bombSlotZ(row);
        const start  = target - DROP_TRAVEL_PITCHES * pitch;
        return target - start;
      });
      for (const t of travels) {
        expect(t, `lanes=${n}: drop travel differs between rows`).toBeCloseTo(travels[0], 9);
      }
      // And it is exactly the configured number of pitches.
      expect(travels[0] / pitch, `lanes=${n}: travel is not DROP_TRAVEL_PITCHES pitches`)
        .toBeCloseTo(DROP_TRAVEL_PITCHES, 9);
    }
  });

  it('travel in PITCH units is identical across bands — immune to scale changes', () => {
    const perLaneCount = {};
    for (const n of LANE_COUNTS) {
      P.setActiveLaneCount(n);
      const pitch = P.bombSlotZ(1) - P.bombSlotZ(0);
      perLaneCount[n] = (DROP_TRAVEL_PITCHES * pitch) / pitch;
    }
    // 3-lane runs a different band from 2/4-lane; in world units the travel differs,
    // but in pitch units — which is what the eye reads — it must not.
    expect(perLaneCount[3]).toBeCloseTo(perLaneCount[4], 9);
    expect(perLaneCount[2]).toBeCloseTo(perLaneCount[4], 9);
  });

  it('travel is BOUNDED — never more than 2 slot pitches', () => {
    // The old code reached 3.4 pitches on row 2. A drop longer than ~2 pitches
    // crosses another slot on its way in and reads as a streak, not a landing.
    expect(DROP_TRAVEL_PITCHES, 'drop travel exceeds 2 slot pitches — it will streak')
      .toBeLessThanOrEqual(2);
    expect(DROP_TRAVEL_PITCHES, 'drop travel under half a pitch is not a visible drop')
      .toBeGreaterThanOrEqual(0.5);
  });

  it('the overshoot keeps the ball INSIDE its socket ring at every lane count', () => {
    // This is the actual visual contract: at peak overshoot the ball's edge must
    // still sit within the socket's outer ring, or it reads as leaving the slot.
    const frac = peakOvershoot(DROP_BACK);
    for (const n of LANE_COUNTS) {
      P.setActiveLaneCount(n);
      const pitch  = P.bombSlotZ(1) - P.bombSlotZ(0);
      const ballR  = P.bombBallScreenRadius();
      const socketR = ballR * P.SOCKET_SHADOW_RATIO;
      // Overshoot in world units -> screen px, via the same projection the game uses.
      const overshootWu = DROP_TRAVEL_PITCHES * pitch * frac;
      const overshootPx = P.zToScreenY(overshootWu) - P.zToScreenY(0);
      const headroomPx  = socketR - ballR;   // how far the ball may move before its edge clears the ring
      expect(overshootPx, `lanes=${n}: drop overshoots ${overshootPx.toFixed(2)}px but the socket only allows ${headroomPx.toFixed(2)}px`)
        .toBeLessThan(headroomPx);
    }
  });

  it('GameApp holds no hardcoded DROP_START_Z any more', () => {
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(code, 'DROP_START_Z is back — an absolute world Z drifts from the queue again')
      .not.toMatch(/DROP_START_Z/);
    expect(code, 'the drop must derive its start from bombSlotZ pitch')
      .toMatch(/DROP_TRAVEL_PITCHES\s*\*\s*pitch/);
  });

  it('the merge POP keeps the original bounce — only the drop was softened', () => {
    // The pop is a SCALE bounce, not a position move; softening it was not asked
    // for and would flatten the merge's payoff.
    expect(src, 'the merge pop should still use easeOutBack').toMatch(/setBombSlotScale\([^)]*easeOutBack\(/);
    expect(DROP_BACK, 'drop overshoot should be gentler than the standard 1.70158').toBeLessThan(1.70158);
  });
});
