// Queue refill motion (src/renderer3d/queueMotion.js): how each bomb in a column reached its
// slot since the last frame, so Shooter3D can slide it there instead of snapping (owner request
// 2026-10-19: "bomb filling moving to the next slot / from outside the screen to its slot").
import { describe, it, expect } from 'vitest';
import { queueMoves, slotOffset, MOTION } from '../src/renderer3d/queueMotion.js';

const b = (name) => ({ name, color: 'Red' });

describe('queueMoves: where each bomb came from', () => {
  it('an unchanged column moves nothing', () => {
    const q = [b('a'), b('b'), b('c')];
    expect(queueMoves(q, q)).toEqual([null, null, null]);
  });

  it('firing the top slides the rest up one slot and brings the new bomb in from below', () => {
    const [a, x, y, z] = [b('a'), b('x'), b('y'), b('z')];
    expect(queueMoves([a, x, y], [x, y, z])).toEqual([
      { kind: 'up', from: 1 },
      { kind: 'up', from: 2 },
      { kind: 'enter', from: 3 + MOTION.enterGap, delay: 0 },
    ]);
  });

  it('a bomb pushed in at the top drops in from the road and the rest move down', () => {
    const [a, x, y, c] = [b('a'), b('x'), b('y'), b('crisis')];
    expect(queueMoves([a, x, y], [c, a, x])).toEqual([
      { kind: 'drop', from: -MOTION.dropGap },
      { kind: 'down', from: 0 },
      { kind: 'down', from: 1 },
    ]);
  });

  it('two new bombs enter from below one after the other', () => {
    const [a, y, z] = [b('a'), b('y'), b('z')];
    const m = queueMoves([a], [a, y, z]);
    expect(m[0]).toBeNull();
    expect(m[1].kind).toBe('enter');
    expect(m[2].kind).toBe('enter');
    expect(m[2].delay).toBeGreaterThan(m[1].delay);
  });

  it('a column filled from empty (level start) snaps, it does not animate', () => {
    expect(queueMoves([], [b('a'), b('b'), b('c')])).toEqual([null, null, null]);
  });
});

describe('slotOffset: the slide over time', () => {
  it('starts at the old slot and ends exactly in the new one', () => {
    const mv = { kind: 'up', from: 1 };
    expect(slotOffset(mv, 0, 0)).toBeCloseTo(1, 5);         // one slot below its new home
    expect(slotOffset(mv, 0, MOTION.slide)).toBe(0);
    expect(slotOffset(mv, 0, 10)).toBe(0);
  });
  it('is monotonic for an entering bomb, and waits out its delay', () => {
    const mv = { kind: 'enter', from: 3 + MOTION.enterGap, delay: 0.1 };
    expect(slotOffset(mv, 2, 0.05)).toBeCloseTo(1 + MOTION.enterGap, 5);   // still below, waiting
    const samples = [0.1, 0.15, 0.2, 0.3, 0.4].map(t => slotOffset(mv, 2, t));
    for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeLessThanOrEqual(samples[i - 1] + 1e-9);
  });
});
