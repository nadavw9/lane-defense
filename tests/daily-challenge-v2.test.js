// Daily challenges are real V2 boards (2026-09-28): the old table promised
// real-time effects ("twice as fast", "150 seconds") the turn-based game can't
// deliver, ran on 4 lanes with no goals, and one day used six colours.
import { describe, it, expect } from 'vitest';
import { DailyChallengeManager, DAILY_CHALLENGES } from '../src/game/DailyChallengeManager.js';
import { TRAITS } from '../src/director/TrafficRules.js';

describe('daily challenges use V2 rules', () => {
  for (const def of DAILY_CHALLENGES) {
    it(def.name, () => {
      const cfg = DailyChallengeManager.configFor(def);
      expect(cfg.laneCount).toBe(3);
      expect(cfg.colCount).toBe(3);
      expect(cfg.gridRows).toBe(8);
      expect(cfg.colors.length).toBeGreaterThan(0);
      expect(cfg.colors.length).toBeLessThanOrEqual(4);
      expect(cfg.goals[0].type).toBe('destroyTotal');
      expect(cfg.goals[0].count).toBeGreaterThan(0);
      for (const t of Object.keys(cfg.traits ?? {})) expect(TRAITS).toContain(t);
      expect(cfg.hintText).not.toMatch(/fast|seconds|timer/i);
    });
  }
  it('today resolves to one of them', () => {
    const c = new DailyChallengeManager().getChallenge();
    expect(DAILY_CHALLENGES.map(d => d.name)).toContain(c.name);
  });
});
