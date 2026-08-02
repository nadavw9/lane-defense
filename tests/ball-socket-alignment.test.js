// BALL AND SOCKET MUST SHARE ONE SOURCE OF TRUTH — POSITION, NOT JUST SIZE.
//
// 2026-08-02 device report: "there are moments after shooting where the bombs look
// stuck out of their slots, and then a couple of seconds later they return".
//
// MECHANISM (reproduced, not guessed). Shooter3D.update() held a lazy one-time
// latch:
//     if (g._baseZ == null) g._baseZ = g.position.z;
//     g.position.z = g._baseZ;
// Nothing ever cleared it — INCLUDING setLaneCount(), which correctly assigns
// position.z = slotZ(si) for the new band and was then silently undone by the very
// next update() tick. So the Three bomb balls used the pitch of the FIRST level
// loaded in the session for the entire session, while the Pixi sockets recomputed
// per frame from the live projection. Measured across a band transition:
//     L13 (band 540, pitch 2.296) -> L5 (band 600, pitch 1.835)
//     balls stayed at 2.296  =>  error grew with row index, row 2 worst
// which is exactly the screenshot: bottom row sitting out of its socket.
//
// This is the FIFTH instance of the create-before-configure class in this project
// (Car3D._breachRow, goalCounterUI.setGoals ordering, setActiveColCount on rebuild,
// benchY-from-ball-radius, and this).
//
// WHY THE EXISTING GUARD MISSED IT: tests/bomb-socket-radius.test.js pins socket
// SIZE to the ball radius. Nothing pinned socket POSITION to the ball position.
// These tests close that gap.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import * as P from '../src/renderer3d/projection.js';
import { getColumnSlotScreenY, setActiveLaneCount as prSetLanes } from '../src/renderer/PositionRegistry.js';

const LANE_COUNTS = [2, 3, 4];
const ROWS = [0, 1, 2];

describe('bomb ball and its socket occupy the same place', () => {
  it('socket Y equals the projected ball Z at every row and lane count', () => {
    for (const n of LANE_COUNTS) {
      P.setActiveLaneCount(n);
      prSetLanes?.(n);
      for (const row of ROWS) {
        // Ball: Three mesh sits at bombSlotZ(row) in world space.
        const ballScreenY = P.zToScreenY(P.bombSlotZ(row));
        // Socket: Pixi circle is drawn at getColumnSlotScreenY(row).
        const socketY = getColumnSlotScreenY(row);
        expect(socketY, `lanes=${n} row=${row}: socket and ball centres diverge`)
          .toBeCloseTo(ballScreenY, 6);
      }
    }
  });

  it('slot pitch follows the band — a stale pitch is the exact reported bug', () => {
    // pitch = CELL * 0.70 * BOMB_ZONE_SCALE. If a cached position survives a band
    // change, the pitch stops matching and every row below row 0 drifts.
    const seen = {};
    for (const n of LANE_COUNTS) {
      P.setActiveLaneCount(n);
      const pitch = P.bombSlotZ(1) - P.bombSlotZ(0);
      const expected = P.CELL * 0.70 * P.BOMB_ZONE_SCALE;
      expect(pitch, `lanes=${n}: slot pitch does not match the live queue scale`)
        .toBeCloseTo(expected, 6);
      seen[n] = pitch;
    }
    // 3-lane runs a different band from 2/4-lane, so its pitch MUST differ —
    // if these ever match, a band change stopped propagating.
    expect(seen[3], '3-lane pitch equals 4-lane pitch — band change is not propagating')
      .not.toBeCloseTo(seen[4], 4);
  });

  it('re-entering a lane count reproduces the identical pitch (no drift across transitions)', () => {
    // The bug survived transitions because the latch was never cleared. Walk a
    // realistic level path and assert the geometry is a pure function of the band.
    const path = [4, 3, 4, 3, 2, 3];
    const byLanes = {};
    for (const n of path) {
      P.setActiveLaneCount(n);
      const key = [P.bombSlotZ(0), P.bombSlotZ(1), P.bombSlotZ(2)].map((v) => v.toFixed(6)).join(',');
      if (byLanes[n] === undefined) byLanes[n] = key;
      expect(key, `lanes=${n}: slot positions differ on re-entry — something is cached across transitions`)
        .toBe(byLanes[n]);
    }
  });

  it('Shooter3D holds NO cached slot Z — it reads the canonical value live', () => {
    // Structural guard. The behavioural tests above are pure projection math and
    // would still pass if Shooter3D reintroduced a cache, because they never touch
    // Shooter3D. THIS is the test that actually catches the regression.
    const src = fs.readFileSync('src/renderer3d/Shooter3D.js', 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(code, '_baseZ is back — a latched slot Z goes stale on the next band change')
      .not.toMatch(/_baseZ/);
    expect(code, 'update() must set slot Z from the canonical slotZ(), not a stored copy')
      .toMatch(/position\.z\s*=\s*slotZ\(/);
  });

  it('setLaneCount positions slots from the canonical slotZ too', () => {
    const src = fs.readFileSync('src/renderer3d/Shooter3D.js', 'utf8');
    const fn = src.slice(src.indexOf('setLaneCount(n) {'), src.indexOf('_refreshSlotSizes()'));
    expect(fn, 'setLaneCount must place slots at slotZ(si)').toMatch(/position\.z\s*=\s*slotZ\(si\)/);
  });
});
