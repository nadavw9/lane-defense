// Three stars must be reachable by playing well (2026-11-26, owner: "it feels like the 3 stars is
// unreachable, I always get 1; make sure stars collected in each level can reach 3 if you play it
// well"). The targets used to sit at the 35th/75th percentile of the careful simulated player's
// WINNING scores, so even a perfect game earned three stars in only a quarter of its wins. Now a
// careful win (the `human` profile: every bomb matched, boosters used) is three stars in most wins.
import { describe, it, expect } from 'vitest';
import { LevelManager } from '../src/game/LevelManager.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';
import { starsFor, starTargetsFor } from '../src/game/score.js';

const SAMPLE = [5, 9, 14, 22, 33, 47, 64, 88, 121, 160, 197];
const RUNS = 80;

describe('three stars are reachable by playing well', () => {
  it('a careful player earns three stars in at least half of their wins, on every sampled level', () => {
    const short = [];
    for (const id of SAMPLE) {
      const lm = new LevelManager(); lm.goToLevel(id);
      const goal = (lm.current.goals ?? []).reduce((a, g) => a + g.count, 0);
      const targets = starTargetsFor(goal);
      const runner = SimulationRunner.fromLevel(lm.current, { skill: 'human' });
      let wins = 0, three = 0;
      for (let s = 1001; s < 1001 + RUNS; s++) {
        const r = runner.runLevel(s);
        if (!r.won) continue;
        wins++;
        if (starsFor(r.score, targets) === 3) three++;
      }
      if (wins >= 10 && three / wins < 0.5) short.push(`L${id}: ${three}/${wins}`);
    }
    expect(short).toEqual([]);
  }, 60_000);
});
