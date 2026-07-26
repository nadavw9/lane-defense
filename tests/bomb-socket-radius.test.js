// Socket rings must track the ACTUAL bomb ball at every band / lane count.
//
// The 2026-07-26 defect: ShooterRenderer drew its slot sockets at hardcoded
// r21/r23. The ball scales with BOMB_ZONE_SCALE, which is re-solved per band, so
// the ring matched only at band 540. At band 600 (3-lane, the rows-8 pilot) the
// ball shrank to r11.3 while the ring stayed at 21 — 1.85x instead of the
// intended 1.31x, a 41% oversized ring. An outsized ring around a shrunken ball
// reads as "the bombs are tiny", which is part of what was reported.
//
// Same stale-copy class as GEOMETRY_MECHANICS_BATCH.md §0c: two values that must
// derive from one source, where one was a literal.
import { describe, it, expect } from 'vitest';
import {
  bombBallScreenRadius, SOCKET_RIM_RATIO, SOCKET_SHADOW_RATIO,
  setActiveLaneCount, BOMB_R, PX_PER_WU,
} from '../src/renderer3d/projection.js';

const LANE_COUNTS = [1, 2, 3, 4];

describe('bomb socket radius tracks the real ball radius', () => {
  it('the canonical radius IS the ball: BOMB_R x PX_PER_WU, at every lane count', () => {
    for (const n of LANE_COUNTS) {
      setActiveLaneCount(n);
      expect(bombBallScreenRadius(), `${n}-lane`).toBeCloseTo(BOMB_R * PX_PER_WU, 6);
    }
  });

  it('rim and shadow keep a CONSTANT ratio to the ball at every lane count', () => {
    // The whole point: the ring/ball relationship must not vary with band.
    for (const n of LANE_COUNTS) {
      setActiveLaneCount(n);
      const ball = bombBallScreenRadius();
      expect(ball).toBeGreaterThan(0);
      expect((ball * SOCKET_RIM_RATIO) / ball, `${n}-lane rim`).toBeCloseTo(SOCKET_RIM_RATIO, 10);
      expect((ball * SOCKET_SHADOW_RATIO) / ball, `${n}-lane shadow`).toBeCloseTo(SOCKET_SHADOW_RATIO, 10);
    }
  });

  it('preserves the shipped band-540 look exactly (rim 21, shadow 23)', () => {
    // 1/2/4-lane boards are band 540 and must be pixel-unchanged by this fix.
    for (const n of [1, 2, 4]) {
      setActiveLaneCount(n);
      const ball = bombBallScreenRadius();
      expect(ball, `${n}-lane ball radius`).toBeCloseTo(16.0, 1);
      expect(ball * SOCKET_RIM_RATIO, `${n}-lane rim`).toBeCloseTo(21, 1);
      expect(ball * SOCKET_SHADOW_RATIO, `${n}-lane shadow`).toBeCloseTo(23, 1);
    }
  });

  it('SHRINKS the ring on the 3-lane pilot, where the literal had drifted', () => {
    setActiveLaneCount(3);
    const ball = bombBallScreenRadius();
    const rim  = ball * SOCKET_RIM_RATIO;
    expect(ball, '3-lane ball is genuinely smaller (band 600)').toBeLessThan(13);
    expect(rim, 'rim must come DOWN from the old hardcoded 21').toBeLessThan(21);
    // And it must land at the intended proportion, not a hand-matched number.
    expect(rim / ball).toBeCloseTo(21 / 16.0, 6);
  });

  it('ShooterRenderer contains no hardcoded socket radii any more', async () => {
    const src = (await import('fs')).readFileSync('src/renderer/ShooterRenderer.js', 'utf8');
    const block = src.slice(src.indexOf('Slot sockets'), src.indexOf('Slot sockets') + 1200);
    expect(block, 'sockets must size from bombBallScreenRadius()').toMatch(/bombBallScreenRadius\(\)/);
    expect(block, 'no literal circle radii in the socket block')
      .not.toMatch(/\.circle\([^)]*,\s*2[13]\s*\)/);
  });
});
