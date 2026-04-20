// Tests for DailyChallengeManager — getChallenge() and getWeeklyPlaylist()

import { describe, it, expect } from 'vitest';
import { DailyChallengeManager } from '../src/game/DailyChallengeManager.js';

describe('DailyChallengeManager.getChallenge()', () => {
  const mgr = new DailyChallengeManager();

  it('returns a full level config object', () => {
    const c = mgr.getChallenge();
    expect(c).toHaveProperty('id', 'daily');
    expect(c).toHaveProperty('isDaily', true);
    expect(c).toHaveProperty('laneCount', 4);
    expect(c).toHaveProperty('colCount', 4);
    expect(c).toHaveProperty('colors');
    expect(c).toHaveProperty('worldConfig');
    expect(c).toHaveProperty('duration');
  });

  it('colors is a non-empty array of strings', () => {
    const { colors } = mgr.getChallenge();
    expect(Array.isArray(colors)).toBe(true);
    expect(colors.length).toBeGreaterThan(0);
    colors.forEach(c => expect(typeof c).toBe('string'));
  });

  it('worldConfig has hpMultiplier and speed fields', () => {
    const { worldConfig } = mgr.getChallenge();
    expect(worldConfig).toHaveProperty('hpMultiplier');
    expect(worldConfig).toHaveProperty('speed');
    expect(worldConfig.speed).toHaveProperty('base');
  });

  it('duration is a positive number', () => {
    expect(mgr.getChallenge().duration).toBeGreaterThan(0);
  });

  it('is deterministic — same result on repeated calls today', () => {
    expect(mgr.getChallenge()).toEqual(mgr.getChallenge());
  });

  it('getTodayKey returns a YYYY-MM-DD string', () => {
    const key = mgr.getTodayKey();
    expect(/^\d{4}-\d{2}-\d{2}$/.test(key)).toBe(true);
  });
});

// ── getWeeklyPlaylist ─────────────────────────────────────────────────────────

describe('DailyChallengeManager.getWeeklyPlaylist()', () => {
  const mgr = new DailyChallengeManager();

  it('returns { levels, weekKey }', () => {
    const r = mgr.getWeeklyPlaylist();
    expect(r).toHaveProperty('levels');
    expect(r).toHaveProperty('weekKey');
  });

  it('levels is an array of exactly 3 numbers', () => {
    const { levels } = mgr.getWeeklyPlaylist();
    expect(Array.isArray(levels)).toBe(true);
    expect(levels).toHaveLength(3);
    levels.forEach(l => expect(typeof l).toBe('number'));
  });

  it('all level ids are valid (1-40)', () => {
    const { levels } = mgr.getWeeklyPlaylist();
    levels.forEach(l => {
      expect(l).toBeGreaterThanOrEqual(1);
      expect(l).toBeLessThanOrEqual(40);
    });
  });

  it('weekKey is a non-empty string', () => {
    const { weekKey } = mgr.getWeeklyPlaylist();
    expect(typeof weekKey).toBe('string');
    expect(weekKey.length).toBeGreaterThan(0);
  });

  it('is deterministic — same result on repeated calls', () => {
    expect(mgr.getWeeklyPlaylist()).toEqual(mgr.getWeeklyPlaylist());
  });

  it('getWeekKey() matches the weekKey returned by getWeeklyPlaylist()', () => {
    expect(mgr.getWeeklyPlaylist().weekKey).toBe(mgr.getWeekKey());
  });

  it('levels are distinct (no duplicates within the week)', () => {
    const { levels } = mgr.getWeeklyPlaylist();
    expect(new Set(levels).size).toBe(levels.length);
  });
});
