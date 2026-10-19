// Kill tokens fly from the explosion to the goal counter, and the counter ticks down when they
// LAND (src/renderer/goalTokens.js), so every explosion visibly feeds the number (owner,
// 2026-10-19: "really visible ... how many cars are left ... when the game is finished").
import { describe, it, expect } from 'vitest';
import { tokenPoint, TOKEN, shownAfterLanding, needsCatchUp } from '../src/renderer/goalTokens.js';

describe('tokenPoint', () => {
  const from = { x: 100, y: 500 }, to = { x: 195, y: 60 };
  it('starts at the explosion and ends exactly on the counter', () => {
    expect(tokenPoint(from, to, 0)).toEqual({ x: 100, y: 500 });
    const end = tokenPoint(from, to, 1);
    expect(end.x).toBeCloseTo(195, 6); expect(end.y).toBeCloseTo(60, 6);
  });
  it('rises the whole way (never dips below where it started)', () => {
    let prev = from.y;
    for (let p = 0.05; p <= 1.0001; p += 0.05) {
      const { y } = tokenPoint(from, to, p);
      expect(y).toBeLessThanOrEqual(prev + 1e-6);
      prev = y;
    }
  });
});

describe('shownAfterLanding / needsCatchUp', () => {
  it('each landing token takes one off the shown count, never below the real count', () => {
    expect(shownAfterLanding(8, 6)).toBe(7);
    expect(shownAfterLanding(7, 6)).toBe(6);
    expect(shownAfterLanding(6, 6)).toBe(6);
  });
  it('a kill with no token in flight (e.g. a booster) catches up after the grace time', () => {
    expect(needsCatchUp(8, 7, 0, TOKEN.grace - 0.01)).toBe(false);
    expect(needsCatchUp(8, 7, 0, TOKEN.grace + 0.01)).toBe(true);
    expect(needsCatchUp(8, 7, 2, 5)).toBe(false);   // tokens still flying: they will bring it down
    expect(needsCatchUp(7, 7, 0, 5)).toBe(false);
  });
});
