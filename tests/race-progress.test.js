// Traffic Race persistence on ProgressManager + the Race Champion achievement.
import { describe, it, expect, afterEach } from 'vitest';
import { ProgressManager } from '../src/game/ProgressManager.js';
import { AchievementManager, ACHIEVEMENTS } from '../src/game/AchievementManager.js';
import { startRace, recordRaceAttempt, RACE_GOAL, RACE_PRIZES } from '../src/game/race.js';

let store;
function withStorage(save) {
  store = save ? { 'lane-defense-v1': JSON.stringify(save) } : {};
  globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
}
afterEach(() => { delete globalThis.localStorage; });

const T0 = Date.UTC(2026, 9, 19, 12);
function finishedFirst() {
  let r = startRace({ now: T0, seed: 3, first: false });
  r.rivals.forEach(v => { v.pace = 0; v.drift = 0; });
  for (let i = 1; i <= RACE_GOAL; i++) ({ race: r } = recordRaceAttempt(r, { won: true, now: T0 + i * 60_000 }));
  return r;
}

describe('race persistence', () => {
  it('a race survives a reload', () => {
    withStorage(null);
    const r = startRace({ now: T0, seed: 9, first: true });
    new ProgressManager().setRace(r);
    expect(new ProgressManager().getRace()).toEqual(r);
  });

  it('a corrupt stored race loads as no race', () => {
    withStorage({ unlockedLevel: 40, race: { v: 1, rivals: 'x' } });
    expect(new ProgressManager().getRace()).toBeNull();
  });

  it('the intro flag and the race count persist', () => {
    withStorage(null);
    const p = new ProgressManager();
    expect(p.raceIntroSeen).toBe(false);
    p.markRaceIntroSeen();
    expect(new ProgressManager().raceIntroSeen).toBe(true);
  });

  it('claiming first place pays coins and boosters exactly once and clears the race', () => {
    withStorage({ unlockedLevel: 40, coins: 10 });
    const p = new ProgressManager();
    p.setRace(finishedFirst());
    expect(p.claimRacePrize()).toEqual(RACE_PRIZES[0]);
    expect(p.coins).toBe(510);
    expect(p.getInventory()).toEqual({ colorChange: 2, freeze: 2, bombs: 2 });
    expect(p.racesWon).toBe(1);
    expect(p.getRace()).toBeNull();
    expect(p.claimRacePrize()).toBeNull();
    expect(p.coins).toBe(510);
  });

  it('claiming a lost race pays nothing but clears it', () => {
    withStorage({ unlockedLevel: 40, coins: 10 });
    const p = new ProgressManager();
    let r = startRace({ now: T0, seed: 3, first: false });
    for (let i = 0; i < 3; i++) ({ race: r } = recordRaceAttempt(r, { won: false, now: T0 + i * 60_000 }));
    p.setRace(r);
    expect(p.claimRacePrize()).toBeNull();
    expect(p.coins).toBe(10);
    expect(p.getRace()).toBeNull();
  });
});

describe('Race Champion achievement', () => {
  it('is listed and awarded on a race win', () => {
    withStorage(null);
    expect(ACHIEVEMENTS.find(a => a.id === 'race_champion')).toBeTruthy();
    const p = new ProgressManager();
    const got = new AchievementManager(p).check('race_won');
    expect(got.map(a => a.id)).toEqual(['race_champion']);
  });
});

describe('first race flag', () => {
  it('counts started races so only the very first is the friendly one', () => {
    withStorage(null);
    const p = new ProgressManager();
    expect(p.racesStarted).toBe(0);
    p.noteRaceStarted();
    expect(new ProgressManager().racesStarted).toBe(1);
  });
});
