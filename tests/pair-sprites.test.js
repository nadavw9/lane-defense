// The bridged pair is ONE baked sprite (owner, 2026-10-31): every combination the game can show
// must exist on disk, and the generated geometry must describe each of them. Bridgeable rungs are
// the three ladder sizes (small < big < jeep); the game mirrors the texture for the other order.
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { PAIR_SPRITE_GEOMETRY, PAIR_RUNGS, PAIR_ROW } from '../src/renderer3d/pairSpriteGeometry.js';

const COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'];

describe('pair sprites', () => {
  it('covers every unordered rung pair, colour and speeder side', () => {
    expect(PAIR_RUNGS).toEqual(['small', 'big', 'jeep']);
    const missing = [];
    for (let i = 0; i < PAIR_RUNGS.length; i++) for (let j = i; j < PAIR_RUNGS.length; j++) {
      const key = `${PAIR_RUNGS[i]}-${PAIR_RUNGS[j]}`;
      expect(PAIR_SPRITE_GEOMETRY[key]).toBeTruthy();
      for (const c of COLORS) for (const v of ['', '-sl', '-sr']) {
        const f = `public/sprites/designed/pair-${key}-${c}${v}.png`;
        if (!existsSync(f)) missing.push(f);
      }
    }
    expect(missing).toEqual([]);
  });

  it('geometry is sane: the two cars sit inside one lane pitch of each other, pulled toward the middle', () => {
    expect(PAIR_ROW).toBeCloseTo(5.85, 2);
    for (const g of Object.values(PAIR_SPRITE_GEOMETRY)) {
      expect(g.half).toBeGreaterThan(1.2);          // never touching
      expect(g.half).toBeLessThan(2);               // pulled in from the lane centres (2 = lane pitch / 2)
      expect(g.W / g.ppu).toBeGreaterThan(2 * g.half);
      expect(g.aspect).toBeCloseTo(g.W / g.H, 2);
    }
  });
});
