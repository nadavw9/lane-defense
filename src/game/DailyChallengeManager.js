// DailyChallengeManager — generates today's daily challenge level config.
// The day index is seeded from the date so every player sees the same challenge.
// Challenge configs are full level config objects compatible with applyLevelConfig().

// V2 rules (2026-09-28). The old table was written for the real-time V1 game:
// "cars move twice as fast" and "150 seconds" meant nothing in a turn-based game,
// it ran on 4 lanes with no goals, and one day used six colours on four bomb
// columns. Every challenge is now a real V2 board — 3 lanes, 8 rows, a car goal,
// at most four colours — with ONE twist, and copy that says what actually happens.
import { localDateKey } from './dateKeys.js';

const CHALLENGES = [
  { name: 'Speeder Rush',   desc: 'Speeders everywhere — they move 2 steps a turn',
    colors: ['Red', 'Blue', 'Green'], heft: 0, traits: { speeder: 0.30 }, goal: 30 },
  { name: 'Iron Wall',      desc: 'Armoured cars — any bomb knocks the plates off',
    colors: ['Red', 'Blue', 'Green'], heft: 0, traits: { armored: 0.25 }, goal: 28 },
  { name: 'Monochrome',     desc: 'Only red cars — tougher, and they never stop coming',
    colors: ['Red'], heft: 0.37, traits: {}, goal: 36 },
  { name: 'Chameleon Chaos', desc: 'Chameleons flip colour every turn — watch the light',
    colors: ['Red', 'Blue', 'Yellow'], heft: 0.61, traits: { chameleon: 0.30 }, goal: 28 },
  { name: 'Endurance',      desc: 'The long haul — destroy 45 cars',
    colors: ['Red', 'Blue', 'Green'], heft: 0.11, traits: { speeder: 0.06 }, goal: 45 },
  { name: 'Four Colours',   desc: 'Red, blue, green and yellow all at once',
    colors: ['Red', 'Blue', 'Green', 'Yellow'], heft: 0.5, traits: {}, goal: 30 },
  { name: 'Sudden Death',   desc: 'Tough traffic — and no continue if you breach',
    colors: ['Red', 'Blue', 'Green'], heft: 0.21, traits: { speeder: 0.08, armored: 0.08 }, goal: 26, noRescue: true },
  { name: 'Ghost Road',     desc: 'Phantoms hide their colour until they roll closer',
    colors: ['Red', 'Blue', 'Green'], heft: 0.6, traits: { phantom: 0.3 }, goal: 28 },
  { name: 'Pit Crew',       desc: 'Menders heal a point every turn you do not hit them',
    colors: ['Red', 'Blue', 'Green'], heft: 0.6, traits: { mender: 0.3 }, goal: 28 },
  { name: 'Chain Reaction', desc: 'When a fuel truck blows, every other lane lurches forward',
    colors: ['Red', 'Blue', 'Green'], heft: 0.35, traits: { volatile: 0.3 }, goal: 28 },
  { name: 'Double Plate',   desc: 'Plated cars soak two hits of any colour',
    colors: ['Red', 'Blue', 'Green'], heft: 0.05, traits: { plated: 0.08 }, goal: 26 },
];

// Returns 'YYYY-MM-DD' for today's local date.
function todayDateKey() {
  return localDateKey();
}

// Deterministic day index seeded from days since 2026-01-01.
function dayIndex() {
  // Calendar days between local dates — an elapsed-ms division drifts by an hour
  // across DST and would roll the challenge at a different moment than the date key.
  const d = new Date();
  return Math.max(0, Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 0, 1)) / 86400000));
}

// Deterministic week index from weeks since 2026-01-05 (first Monday). Weeks roll on
// MONDAY at local midnight, and so does everything keyed off this index.
function rawWeekIndex() {
  const d = new Date();
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 0, 5)) / (7 * 86400000));
}
function weekIndex() { return Math.max(0, rawWeekIndex()); }

// Week key for the "+15 weekly bonus once per level per week" claim. It MUST roll on
// the same day as the playlist (weekIndex). It used to be a Sunday-start calendar week
// while the playlist rolled Monday, so Sunday paid the same playlist's bonus twice (and
// 31 Dec / 1 Jan did too). Same index => same playlist => same key.
function weekKey() {
  return `W${rawWeekIndex()}`;
}

export { CHALLENGES as DAILY_CHALLENGES };

export class DailyChallengeManager {
  getTodayKey() {
    return todayDateKey();
  }

  getWeekKey() {
    return weekKey();
  }

  // Returns today's challenge config.
  getChallenge() {
    const def = CHALLENGES[dayIndex() % CHALLENGES.length];
    return DailyChallengeManager.configFor(def);
  }

  /** A V2 level config for a challenge definition (also used by tests/sims). */
  static configFor(def) {
    return {
      id:         'daily',
      isDaily:    true,
      laneCount:  3,
      colCount:   3,
      gridRows:   8,
      spawnBudget: 12,
      laneTargetCarCount: 2,
      showArrow:  false,
      noRescue:   def.noRescue ?? false,
      hintText:   `DAILY: ${def.name} — ${def.desc}`,
      name:       def.name,
      desc:       def.desc,
      colors:     def.colors,
      worldConfig: { heft: def.heft, hpMultiplier: 1, speed: { base: 5.0, variance: 0.3 } },
      traits:     def.traits,
      goals:      [{ type: 'destroyTotal', count: def.goal }],
      duration:   100,
    };
  }

  // Returns 3 featured level ids for this week and the current week key.
  // All players see the same 3 levels. Winning a featured level awards +15 bonus coins.
  // Rotates through curated triples deterministically by week index.
  getWeeklyPlaylist() {
    const PLAYLISTS = [
      [3, 8, 16],
      [5, 13, 20],
      [7, 11, 18],
      [4,  9, 15],
      [6, 12, 19],
      [2, 10, 17],
    ];
    const levels = PLAYLISTS[weekIndex() % PLAYLISTS.length];
    return { levels, weekKey: weekKey() };
  }
}
