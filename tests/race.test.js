// Traffic Race rules (src/game/race.js) — docs/superpowers/specs/2026-10-19-race-design.md
import { describe, it, expect } from 'vitest';
import {
  RACE_UNLOCK_AFTER, RACE_GOAL, RACE_HEARTS, RACE_MS, RACE_PRIZES,
  raceUnlocked, canStartRace, countsForRace, startRace, syncRace, recordRaceAttempt,
  raceStandings, racePrize, sanitizeRace,
} from '../src/game/race.js';
import { bandFor } from '../tools/bands.mjs';
import { SeededRandom } from '../src/utils/SeededRandom.js';

const T0 = Date.UTC(2026, 9, 19, 12);
const MIN = 60_000, HOUR = 3_600_000;
const fresh = (o = {}) => startRace({ now: T0, seed: 7, first: false, ...o });
// A race whose rivals never move: isolates the player's own rules.
const frozen = () => { const r = fresh(); r.rivals.forEach(v => { v.pace = 0; v.drift = 0; }); return r; };

describe('race: constants and gates', () => {
  it('uses the designed numbers', () => {
    expect([RACE_UNLOCK_AFTER, RACE_GOAL, RACE_HEARTS, RACE_MS]).toEqual([30, 6, 3, 86_400_000]);
    expect(RACE_PRIZES[0]).toEqual({ coins: 500, boosters: { colorChange: 2, freeze: 2, bombs: 2 } });
    expect(RACE_PRIZES[1]).toEqual({ coins: 150, boosters: { freeze: 1 } });
    expect(RACE_PRIZES.slice(2).map(p => p.coins)).toEqual([50, 20, 20]);
  });
  it('unlocks once L30 is beaten, not before', () => {
    expect(raceUnlocked(30)).toBe(false);   // unlockedLevel 30 = L30 not beaten yet
    expect(raceUnlocked(31)).toBe(true);
  });
  it('a race can start only when six unbeaten levels remain', () => {
    expect(canStartRace(31, 200, false)).toBe(true);
    expect(canStartRace(195, 200, false)).toBe(true);    // 195..200 = 6 left
    expect(canStartRace(196, 200, false)).toBe(false);
    expect(canStartRace(200, 200, true)).toBe(false);
    expect(canStartRace(20, 200, false)).toBe(false);
  });
  it('only a first win on the frontier level counts', () => {
    expect(countsForRace(40, 40, 0)).toBe(true);
    expect(countsForRace(12, 40, 3)).toBe(false);          // replay
    expect(countsForRace(100, 100, 2)).toBe(false);        // final level already beaten
    expect(countsForRace('daily', 40, 0)).toBe(false);
  });
});

describe('race: the player', () => {
  it('starts with five racers, three hearts and a 24 h clock', () => {
    const r = fresh();
    expect(r.rivals).toHaveLength(4);
    expect(new Set(r.rivals.map(v => v.name)).size).toBe(4);
    expect(r.hearts).toBe(3);
    expect(r.wins).toBe(0);
    expect(r.endsAt - r.startedAt).toBe(RACE_MS);
    expect(r.result).toBeNull();
  });
  it('a win moves the player one step', () => {
    const { race, events } = recordRaceAttempt(frozen(), { won: true, now: T0 + MIN });
    expect(race.wins).toBe(1);
    expect(events).toContain('win');
  });
  it('a loss costs a heart; the third loss knocks the player out', () => {
    let r = frozen(), ev;
    ({ race: r, events: ev } = recordRaceAttempt(r, { won: false, now: T0 + MIN }));
    expect(r.hearts).toBe(2); expect(ev).toContain('heart');
    ({ race: r } = recordRaceAttempt(r, { won: false, now: T0 + 2 * MIN }));
    ({ race: r, events: ev } = recordRaceAttempt(r, { won: false, now: T0 + 3 * MIN }));
    expect(r.hearts).toBe(0);
    expect(r.result).toEqual({ outcome: 'out', place: null });
    expect(ev).toContain('out');
  });
  it('six wins finish the race; with nobody ahead that is first place', () => {
    let r = frozen(), ev;
    for (let i = 1; i <= RACE_GOAL; i++) ({ race: r, events: ev } = recordRaceAttempt(r, { won: true, now: T0 + i * MIN }));
    expect(r.result).toEqual({ outcome: 'finished', place: 1 });
    expect(ev).toContain('finished');
    expect(racePrize(r)).toEqual(RACE_PRIZES[0]);
  });
  it('place counts the rivals who finished first', () => {
    let r = frozen();
    r.rivals[0].progress = RACE_GOAL; r.rivals[0].finishOrder = 1; r.seq = 1;
    r.rivals[1].progress = RACE_GOAL; r.rivals[1].finishOrder = 2; r.seq = 2;
    for (let i = 1; i <= RACE_GOAL; i++) ({ race: r } = recordRaceAttempt(r, { won: true, now: T0 + i * MIN }));
    expect(r.result.place).toBe(3);
    expect(racePrize(r)).toEqual(RACE_PRIZES[2]);
  });
  it('a tie on the same attempt goes to the player', () => {
    let r = frozen();
    for (let i = 1; i < RACE_GOAL; i++) ({ race: r } = recordRaceAttempt(r, { won: true, now: T0 + i * MIN }));
    r.rivals[0].progress = RACE_GOAL - 0.01; r.rivals[0].pace = 5;   // crosses on the next attempt
    ({ race: r } = recordRaceAttempt(r, { won: true, now: T0 + 10 * MIN }));
    expect(r.result.place).toBe(1);
  });
  it('after the race is decided, further attempts change nothing', () => {
    let r = frozen();
    for (let i = 0; i < 3; i++) ({ race: r } = recordRaceAttempt(r, { won: false, now: T0 + i * MIN }));
    const { race, events } = recordRaceAttempt(r, { won: true, now: T0 + 9 * MIN });
    expect(race.wins).toBe(0);
    expect(events).toEqual([]);
  });
});

describe('race: rivals and time', () => {
  it('rivals move on player attempts', () => {
    const r = fresh();
    const before = r.rivals.map(v => v.progress);
    const { race } = recordRaceAttempt(r, { won: true, now: T0 });
    race.rivals.forEach((v, i) => expect(v.progress).toBeGreaterThan(before[i]));
  });
  it('rivals move with real time while the player is away, capped at the deadline', () => {
    const r = fresh();
    const a = syncRace(structuredClone(r), T0 + 6 * HOUR);
    a.rivals.forEach((v, i) => expect(v.progress).toBeGreaterThan(r.rivals[i].progress));
    const b = syncRace(structuredClone(r), T0 + 30 * HOUR);
    const c = syncRace(structuredClone(r), T0 + 300 * HOUR);
    expect(c.rivals.map(v => v.progress)).toEqual(b.rivals.map(v => v.progress));
  });
  it('the deadline ends an unfinished race as a timeout and later results do not count', () => {
    const r = syncRace(fresh(), T0 + RACE_MS + 1);
    expect(r.result).toEqual({ outcome: 'timeout', place: null });
    expect(racePrize(r)).toBeNull();
    const { race } = recordRaceAttempt(r, { won: true, now: T0 + RACE_MS + 2 * MIN });
    expect(race.wins).toBe(0);
  });
  it('a level finished after the deadline resolves as a timeout first', () => {
    const { race, events } = recordRaceAttempt(fresh(), { won: true, now: T0 + RACE_MS + MIN });
    expect(race.wins).toBe(0);
    expect(events).toEqual(['timeout']);
  });
  it('is deterministic for a seed', () => {
    const run = () => { let r = fresh(); for (let i = 0; i < 5; i++) ({ race: r } = recordRaceAttempt(r, { won: i % 2 === 0, now: T0 + i * 5 * MIN })); return r; };
    expect(run()).toEqual(run());
  });
  it('standings list all five racers, the player marked, best first', () => {
    const r = fresh();
    r.rivals[2].progress = 4.6;
    const s = raceStandings(r);
    expect(s).toHaveLength(5);
    expect(s.filter(x => x.you)).toHaveLength(1);
    expect(s[0].name).toBe(r.rivals[2].name);
    expect(s[0].wins).toBe(4);
  });
});

describe('race: saved data is never trusted', () => {
  it('a started race survives a JSON round trip', () => {
    const r = fresh();
    expect(sanitizeRace(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });
  it('junk becomes null instead of throwing', () => {
    for (const junk of [null, 5, 'x', [], {}, { v: 1 }, { ...fresh(), rivals: 'no' }, { ...fresh(), hearts: NaN }, { ...fresh(), v: 99 }])
      expect(sanitizeRace(junk)).toBeNull();
  });
});

// Calibration (spec: a finisher places 1st 40-60%; a first race 60%+). The player wins a level
// with its band-centre chance from L31 on, continues on half of the losses and saves half of
// those, and plays a level every 6 minutes until the race is decided.
function simulate(first, races = 2000) {
  let finished = 0, firsts = 0;
  for (let s = 1; s <= races; s++) {
    const rng = new SeededRandom(s * 7919);
    let r = startRace({ now: T0, seed: s, first }), lv = 31, now = T0;
    while (!r.result) {
      now += 6 * MIN;
      const b = bandFor(lv);
      let won = rng.next() < (b.lo + b.hi) / 200;
      if (!won && rng.next() < 0.5) won = rng.next() < 0.5;
      ({ race: r } = recordRaceAttempt(r, { won, now }));
      if (won) lv++;
    }
    if (r.result.outcome === 'finished') { finished++; if (r.result.place === 1) firsts++; }
  }
  return firsts / finished;
}

describe('race: calibration against the game\'s win rates', () => {
  it('a finisher wins first place about half the time', () => {
    const share = simulate(false);
    expect(share).toBeGreaterThanOrEqual(0.40);
    expect(share).toBeLessThanOrEqual(0.60);
  }, 30_000);
  it('the first race is friendlier', () => {
    expect(simulate(true)).toBeGreaterThanOrEqual(0.60);
  }, 30_000);
});

import { raceButtonState, raceAutoOpen } from '../src/game/race.js';

describe('race: what the map shows', () => {
  const base = { race: null, unlockedLevel: 40, levelCount: 200, finalBeaten: false, introSeen: true };
  it('no button before the unlock', () => {
    expect(raceButtonState({ ...base, unlockedLevel: 30 })).toBeNull();
  });
  it('a race can start: START, with a dot until the intro has been seen', () => {
    expect(raceButtonState(base)).toEqual({ mode: 'start', wins: 0, hearts: 3, badge: false });
    expect(raceButtonState({ ...base, introSeen: false }).badge).toBe(true);
  });
  it('no button when no race can start and none is running (end of the campaign)', () => {
    expect(raceButtonState({ ...base, unlockedLevel: 198 })).toBeNull();
  });
  it('a running race shows wins and hearts; a decided one asks to be claimed', () => {
    let r = frozen();
    ({ race: r } = recordRaceAttempt(r, { won: true, now: T0 + MIN }));
    ({ race: r } = recordRaceAttempt(r, { won: false, now: T0 + 2 * MIN }));
    expect(raceButtonState({ ...base, race: r })).toEqual({ mode: 'racing', wins: 1, hearts: 2, badge: false });
    ({ race: r } = recordRaceAttempt(r, { won: false, now: T0 + 3 * MIN }));
    ({ race: r } = recordRaceAttempt(r, { won: false, now: T0 + 4 * MIN }));
    expect(raceButtonState({ ...base, race: r })).toEqual({ mode: 'claim', wins: 1, hearts: 0, badge: true });
  });
  it('the card opens by itself for the unlock moment and for a decided race, never otherwise', () => {
    expect(raceAutoOpen({ race: null, introSeen: false, justUnlocked: true })).toBe('intro');
    expect(raceAutoOpen({ race: null, introSeen: false, justUnlocked: false })).toBeNull();   // veterans get the dot
    expect(raceAutoOpen({ race: null, introSeen: true, justUnlocked: true })).toBeNull();
    expect(raceAutoOpen({ race: fresh(), introSeen: true, justUnlocked: false })).toBeNull();
    expect(raceAutoOpen({ race: syncRace(fresh(), T0 + RACE_MS), introSeen: true, justUnlocked: false })).toBe('result');
  });
});
