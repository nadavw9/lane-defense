// Score and stars (src/game/score.js). Stars used to come from how far the cars got
// (maxCarPosition < 60 for 3 stars), which the big board made all but impossible (owner,
// 2026-10-19: "3 stars for some levels isn't possible ... it should be a factor of points").
import { describe, it, expect } from 'vitest';
import { POINTS, shotPoints, nextChain, starsFor, starTargetsFor, starBarFill, starsLit, cleanGamePoints } from '../src/game/score.js';

describe('shot points', () => {
  it('a single kill with no chain is the base car value', () => {
    expect(shotPoints(1, 0)).toBe(POINTS.car);
  });
  it('a multi-kill pays every car plus a bonus per extra car', () => {
    expect(shotPoints(3, 0)).toBe(3 * POINTS.car + 2 * POINTS.multiExtra);
  });
  it('every car a shot destroys earns the combo bonus, so a bridge pair never pays less than two shots', () => {
    expect(shotPoints(2, 4)).toBe(2 * (POINTS.car + 4 * POINTS.chainStep) + POINTS.multiExtra);
    expect(shotPoints(2, 6)).toBeGreaterThan(shotPoints(1, 6) + shotPoints(1, 7));
  });
  it('kill shots in a row add a growing combo bonus, capped', () => {
    expect(shotPoints(1, 1)).toBe(POINTS.car + POINTS.chainStep);
    expect(shotPoints(1, 2)).toBe(POINTS.car + 2 * POINTS.chainStep);
    expect(shotPoints(1, 999)).toBe(POINTS.car + POINTS.chainCap);
  });
  // 2026-11-26 (owner): the combo bonus is paid on KILLS only. It used to be paid on every hit, so
  // a player who chipped at big cars out-scored one who picked off cars in fewer shots: playing
  // well gave one star. A shrink hit still keeps the combo going.
  it('a hit that only shrinks a car pays nothing but extends the chain', () => {
    expect(shotPoints(0, 2, true)).toBe(0);
    expect(shotPoints(0, 0, true)).toBe(0);
    expect(nextChain(2, true)).toBe(3);
  });
  it('with the combo at its cap, extra shrink hits are worth nothing: same kills, same points', () => {
    const play = (shots, chain = 10) => { let score = 0; for (const k of shots) { score += shotPoints(k, chain, true); chain = nextChain(chain, true); } return score; };
    expect(play([0, 0, 0, 1, 1, 1])).toBe(play([1, 1, 1]));
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
  // 2026-11-26 (owner: "make sure stars can reach 3 if you play it well"): the targets come from the
  // goal, not from simulated percentiles. A CLEAN game destroys the goal's cars without ever breaking
  // the combo (cleanGamePoints); three stars is 90% of it, two is 70%, one is the goal's own points.
  it('a clean game is every goal car destroyed with the combo never broken', () => {
    let chain = 0, pts = 0;
    for (let i = 0; i < 20; i++) { pts += shotPoints(1, chain); chain = nextChain(chain, true); }
    expect(cleanGamePoints(20)).toBe(pts);
  });
  it('targets are one = the goal, two = 70% and three = 90% of a clean game, rising, on 25s', () => {
    for (const goal of [6, 10, 20, 35]) {
      const [a, b, c] = starTargetsFor(goal);
      expect(a).toBe(goal * POINTS.car);
      expect(b).toBeGreaterThan(a); expect(c).toBeGreaterThan(b);
      expect(c).toBeLessThanOrEqual(cleanGamePoints(goal) * 0.9 + 12.5);
      expect(b % 25 + c % 25).toBe(0);
    }
  });
  it('a clean game is always three stars; a game that only scores the cars is one', () => {
    for (const goal of [6, 12, 22, 40]) {
      expect(starsFor(cleanGamePoints(goal), starTargetsFor(goal))).toBe(3);
      expect(starsFor(goal * POINTS.car, starTargetsFor(goal))).toBe(1);
    }
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
  }, 30_000);   // cold import of the whole win screen (Pixi + world ceremony) under full-suite load
});
