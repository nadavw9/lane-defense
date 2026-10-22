// Score and stars (src/game/score.js). Stars used to come from how far the cars got
// (maxCarPosition < 60 for 3 stars), which the big board made all but impossible (owner,
// 2026-10-19: "3 stars for some levels isn't possible ... it should be a factor of points").
import { describe, it, expect } from 'vitest';
import { POINTS, shotPoints, nextChain, starsFor, starTargetsFor, starBarFill, starsLit } from '../src/game/score.js';

describe('shot points', () => {
  it('a single kill with no chain is the base car value', () => {
    expect(shotPoints(1, 0)).toBe(POINTS.car);
  });
  it('a multi-kill pays every car plus a bonus per extra car', () => {
    expect(shotPoints(3, 0)).toBe(3 * POINTS.car + 2 * POINTS.multiExtra);
  });
  it('kill shots in a row add a growing combo bonus, capped', () => {
    expect(shotPoints(1, 1)).toBe(POINTS.car + POINTS.chainStep);
    expect(shotPoints(1, 2)).toBe(POINTS.car + 2 * POINTS.chainStep);
    expect(shotPoints(1, 999)).toBe(POINTS.car + POINTS.chainCap);
  });
  it('a hit that only shrinks a car pays the combo bonus and extends the chain', () => {
    expect(shotPoints(0, 2, true)).toBe(2 * POINTS.chainStep);
    expect(shotPoints(0, 0, true)).toBe(0);
    expect(nextChain(2, true)).toBe(3);
  });
  it('a wasted shot scores nothing and breaks the chain', () => {
    expect(shotPoints(0, 5)).toBe(0);
    expect(nextChain(5, 0)).toBe(0);
    expect(nextChain(2, 1)).toBe(3);
    expect(nextChain(2, 3)).toBe(3);   // a multi-kill is one step, like the Hot Streak
  });
});

describe('stars from score', () => {
  const t = [1000, 1400, 1800];
  it('a win is at least one star; the targets give two and three', () => {
    expect(starsFor(0, t)).toBe(1);
    expect(starsFor(1399, t)).toBe(1);
    expect(starsFor(1400, t)).toBe(2);
    expect(starsFor(1800, t)).toBe(3);
  });
  it('every level has three rising targets (generated table or a fallback from its goal)', () => {
    for (const id of [1, 3, 25, 60, 150, 200]) {
      const [a, b, c] = starTargetsFor(id, 20);
      expect(a).toBeGreaterThan(0);
      expect(b).toBeGreaterThan(a);
      expect(c).toBeGreaterThan(b);
    }
    const [a, b, c] = starTargetsFor('daily', 20);   // no table entry: derived from the goal
    expect(a).toBe(20 * POINTS.car);
    expect(b).toBeGreaterThan(a); expect(c).toBeGreaterThan(b);
  });
});

describe('the in-play star bar', () => {
  const t = [1000, 1400, 1800];
  it('places the three stars evenly, whatever the targets', () => {
    expect(starBarFill(0, t)).toBe(0);
    expect(starBarFill(1000, t)).toBeCloseTo(1 / 3);
    expect(starBarFill(1400, t)).toBeCloseTo(2 / 3);
    expect(starBarFill(1800, t)).toBe(1);
    expect(starBarFill(5000, t)).toBe(1);
  });
  it('fills every point of the way between stars', () => {
    expect(starBarFill(500, t)).toBeCloseTo(1 / 6);
    expect(starBarFill(1200, t)).toBeCloseTo(0.5);
    expect(starBarFill(1210, t)).toBeGreaterThan(starBarFill(1200, t));
  });
  it('counts the stars lit so far (none before the first target)', () => {
    expect(starsLit(999, t)).toBe(0);
    expect(starsLit(1000, t)).toBe(1);
    expect(starsLit(1800, t)).toBe(3);
  });
});

describe('win screen stars come from the score', () => {
  it('uses the level targets, not how far the cars got, and a continue no longer caps it', async () => {
    const { calcStars } = await import('../src/screens/WinScreen.js');
    const starTargets = [1000, 1400, 1800];
    expect(calcStars({ score: 1900, starTargets, maxCarPosition: 99, rescueUsed: true })).toBe(3);
    expect(calcStars({ score: 1500, starTargets, maxCarPosition: 10 })).toBe(2);
    expect(calcStars({ score: 200,  starTargets, maxCarPosition: 10 })).toBe(1);
  });
});

describe('generated star targets', () => {
  it('the first star is the goal itself: every win has at least those points, so it is always lit', async () => {
    const { LevelManager, LEVEL_COUNT } = await import('../src/game/LevelManager.js');
    const { STAR_TARGETS } = await import('../src/game/starTargets.js');
    for (let id = 1; id <= LEVEL_COUNT; id++) {
      const lm = new LevelManager(); lm.goToLevel(id);
      const goal = (lm.current.goals ?? []).reduce((a, g) => a + g.count, 0);
      const [one, two, three] = STAR_TARGETS[id];
      expect(one, `L${id}`).toBe(Math.max(POINTS.car, goal * POINTS.car));
      expect(two, `L${id}`).toBeGreaterThan(one);
      expect(three, `L${id}`).toBeGreaterThan(two);
    }
  });
});
