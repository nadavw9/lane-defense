// §3e City Repair — save-schema migration + cityState API.
//
// THE BUNDLING CONSTRAINT: cityState addition AND the vestigial hearts/LivesManager
// removal are ONE migration, not two. These tests prove a veteran save survives
// both cleanly, that the migration is IDEMPOTENT (presence-driven — it must be safe
// to re-run on every load), and — the load-bearing case — that re-running it never
// silently repairs a damaged building back to 2.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProgressManager } from '../src/game/ProgressManager.js';

const KEY = 'lane-defense-v1';

// Minimal in-memory localStorage shim (the node test env has none). Installed per
// test so each starts from a known blob.
function installLocalStorage(initial) {
  const store = new Map(initial ? Object.entries(initial) : []);
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  return {
    raw: () => store.get(KEY),
    parsed: () => JSON.parse(store.get(KEY)),
  };
}
afterEach(() => { delete globalThis.localStorage; });

// An OLD-schema (pre-v1.7) veteran: has the vestigial hearts fields, beat levels
// 1–20 (stars), plus a spread of live fields that MUST survive the migration.
function veteranBlob() {
  return {
    hearts: 2,
    heartsLastDepleted: 1_700_000_000_000,
    unlockedLevel: 21,
    stars: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), (i % 3) + 1])),
    coins: 4200,
    boosters: { swap: 5, freeze: 2 },
    achievements: { sharpshooter: true, combo_master: true },
    failStreak: { 22: 3 },
    bestStats: { 12: { combo: 7, time: 41, stars: 3 } },
    introducedCarTypes: ['small', 'big', 'jeep', 'truck', 'bigrig', 'tank'],
  };
}

describe('§3e migration — veteran save survives BOTH changes cleanly', () => {
  let ls;
  beforeEach(() => { ls = installLocalStorage({ [KEY]: JSON.stringify(veteranBlob()) }); });

  it('strips the vestigial hearts fields (accessors gone, data gone)', () => {
    const p = new ProgressManager();
    expect(p._data.hearts).toBeUndefined();
    expect(p._data.heartsLastDepleted).toBeUndefined();
    expect(p.hearts).toBeUndefined();            // getter removed
    expect(p.setHearts).toBeUndefined();         // setter removed
  });

  it('backfills cityState from stars: every beaten level → repaired (2), later levels absent', () => {
    const p = new ProgressManager();
    const city = p.getCityState();
    for (let lvl = 1; lvl <= 20; lvl++) expect(city[String(lvl)]).toBe(2);   // beaten → repaired
    expect(city['21']).toBeUndefined();          // reached but not beaten → no building yet
    expect(city['40']).toBeUndefined();
  });

  it('leaves every OTHER veteran field untouched', () => {
    const p = new ProgressManager();
    expect(p.coins).toBe(4200);
    expect(p.getBoosters()).toEqual({ swap: 5, freeze: 2 });
    expect(p._data.achievements).toEqual({ sharpshooter: true, combo_master: true });
    expect(p.getFailStreak(22)).toBe(3);
    expect(p._data.bestStats['12']).toEqual({ combo: 7, time: 41, stars: 3 });
    expect(p.getStars(12)).toBe(3);
  });

  it('round-trips clean: after a save, the persisted blob has no hearts keys and keeps cityState', () => {
    const p = new ProgressManager();
    p.repairBuilding(21);                         // any mutation triggers _save()
    const persisted = ls.parsed();
    expect(persisted.hearts).toBeUndefined();
    expect(persisted.heartsLastDepleted).toBeUndefined();
    expect(persisted.cityState['21']).toBe(2);
    expect(persisted.cityState['1']).toBe(2);     // backfill survived the save
  });
});

describe('§3e migration — IDEMPOTENCE (safe to re-run on every load)', () => {
  it('loading twice yields identical state (backfill re-derives the same city)', () => {
    installLocalStorage({ [KEY]: JSON.stringify(veteranBlob()) });
    const a = new ProgressManager().getCityState();
    const b = new ProgressManager().getCityState();   // re-load; migration runs again
    expect(b).toEqual(a);
  });

  it('THE load-bearing case: a persisted, DAMAGED city is NOT re-repaired on reload', () => {
    // Player beat level 5 (building 5 = 2), replayed it and lost → damaged to 1,
    // and that damaged cityState is now persisted. The presence-driven guard must
    // stop the stars-backfill from re-deriving building 5 back to 2.
    const blob = veteranBlob();
    blob.cityState = { 5: 1, 3: 2 };              // 5 damaged, 3 repaired — already migrated
    const ls = installLocalStorage({ [KEY]: JSON.stringify(blob) });

    const p = new ProgressManager();
    expect(p.getCityState()['5']).toBe(1);        // stays scaffolding, NOT re-repaired to 2
    expect(p.getCityState()['3']).toBe(2);
    // Backfill did NOT run: level 1 was beaten (stars) but building 1 is absent,
    // because the save already had a cityState (guard held).
    expect(p.getCityState()['1']).toBeUndefined();

    // And it stays that way across a save + reload.
    p.setCoins(1);                                // force a persist
    expect(ls.parsed().cityState['5']).toBe(1);
    expect(new ProgressManager().getCityState()['5']).toBe(1);
  });

  it('a fresh player (no save) starts with an empty city, no crash', () => {
    installLocalStorage({});                       // no KEY entry
    const p = new ProgressManager();
    expect(p.getCityState()).toEqual({});
  });
});

describe('§3e cityState API', () => {
  beforeEach(() => installLocalStorage({}));

  it('repairBuilding sets a building to repaired (2), idempotently', () => {
    const p = new ProgressManager();
    p.repairBuilding(7);
    expect(p.getCityState()['7']).toBe(2);
    p.repairBuilding(7);
    expect(p.getCityState()['7']).toBe(2);
  });

  it('damageBuilding downgrades ONLY a repaired building (2→1), never below 1 or from 0', () => {
    const p = new ProgressManager();
    p.repairBuilding(8);
    p.damageBuilding(8);
    expect(p.getCityState()['8']).toBe(1);         // 2 → 1
    p.damageBuilding(8);
    expect(p.getCityState()['8']).toBe(1);         // 1 stays 1 (never to 0)
    p.damageBuilding(9);                           // never-repaired (absent/0)
    expect(p.getCityState()['9']).toBeUndefined(); // untouched — losses sting, not erase
  });

  it('buildingForLevel is identity; getCityState returns a copy (no external mutation)', () => {
    const p = new ProgressManager();
    expect(p.buildingForLevel(17)).toBe(17);
    p.repairBuilding(1);
    const snap = p.getCityState();
    snap['1'] = 0;                                 // mutate the returned object
    expect(p.getCityState()['1']).toBe(2);         // internal state unaffected
  });
});
