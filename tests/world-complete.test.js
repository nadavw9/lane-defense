// The end-of-world ceremony: when it plays and what it gives (src/game/worldComplete.js).
import { describe, it, expect } from 'vitest';
import { worldCompleteFor, worldReward, worldTeaser, WORLD_TEASER } from '../src/game/worldComplete.js';
import { MAP_WORLDS } from '../src/screens/levelMapLayout.js';

describe('world complete', () => {
  it('plays on the first clear of a world\'s last level', () => {
    const wd = worldCompleteFor(15, { firstClear: true });
    expect(wd.world.page).toBe(1);
    expect(wd.next.first).toBe(16);
  });

  it('never on a replay, a mid-world level, the final level, or a world already celebrated', () => {
    expect(worldCompleteFor(15, { firstClear: false })).toBe(null);
    expect(worldCompleteFor(14, { firstClear: true })).toBe(null);
    const last = MAP_WORLDS[MAP_WORLDS.length - 1].last;
    expect(worldCompleteFor(last, { firstClear: true })).toBe(null);
    expect(worldCompleteFor(15, { firstClear: true, seen: (p) => p === 1 })).toBe(null);
    expect(worldCompleteFor('daily', { firstClear: true })).toBe(null);
  });

  it('every world but the last ends in a ceremony', () => {
    for (const w of MAP_WORLDS.slice(0, -1)) expect(worldCompleteFor(w.last, { firstClear: true })?.world.page).toBe(w.page);
  });

  it('the gift holds coins and only boosters the player has by the next world', () => {
    const w2 = worldReward(worldCompleteFor(15, { firstClear: true }).next);
    expect(w2.coins).toBeGreaterThan(0);
    expect(w2.boosters).toEqual({ bombs: 1, freeze: 1 });            // COLOR SWAP arrives at L21
    const w3 = worldReward(worldCompleteFor(30, { firstClear: true }).next);
    expect(w3.boosters).toEqual({ bombs: 1, freeze: 1, colorChange: 1 });
  });

  it('every next world has a teaser line', () => {
    for (const w of MAP_WORLDS.slice(1)) expect(worldTeaser(w.page).length).toBeGreaterThan(10);
    expect(Object.keys(WORLD_TEASER).map(Number)).toEqual([2, 3, 4, 5, 6, 7]);
  });
});
