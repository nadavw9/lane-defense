import { describe, it, expect } from 'vitest';
import { BenchStorage } from '../src/game/BenchStorage.js';

describe('BenchStorage.store with a preferred slot', () => {
  it('uses the slot the player released over when it is empty', () => {
    const b = new BenchStorage();
    expect(b.store({ color: 'Red' }, 3)).toBe(3);
    expect(b.getSlot(3).color).toBe('Red');
    expect(b.getSlot(0)).toBeNull();
  });
  it('falls back to the first empty slot when the preferred one is taken or invalid', () => {
    const b = new BenchStorage();
    b.store({ color: 'Red' }, 0);
    expect(b.store({ color: 'Blue' }, 0)).toBe(1);
    expect(b.store({ color: 'Green' }, 9)).toBe(2);
    expect(b.store({ color: 'Green' })).toBe(3);
  });
  it('returns -1 when full', () => {
    const b = new BenchStorage();
    for (let i = 0; i < 4; i++) b.store({ color: 'Red' }, i);
    expect(b.store({ color: 'Blue' }, 2)).toBe(-1);
  });
});
