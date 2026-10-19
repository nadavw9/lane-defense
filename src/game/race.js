// Traffic Race — the rules, with no Pixi and no storage (docs/superpowers/specs/2026-10-19-race-design.md).
//
// The player races four cartoon rivals to win RACE_GOAL new levels inside RACE_MS, with
// RACE_HEARTS race-only hearts: a final loss (or a quit) on the frontier level costs one, and
// the continue offer saves it. There is no server, so the rivals are simulated: each has a
// progress value 0..RACE_GOAL that moves on two clocks, the player's own attempts (pace) and
// real time (drift). Every function takes a race object and returns it updated; GameApp
// persists it through ProgressManager. Everything random comes from the race's seed.
import { SeededRandom } from '../utils/SeededRandom.js';

export const RACE_UNLOCK_AFTER = 30;     // beat L30 (the first SUPER HARD big wave) to unlock
export const RACE_GOAL = 6;              // new-level wins to finish
export const RACE_HEARTS = 3;
export const RACE_MS = 24 * 60 * 60 * 1000;
const RACE_VERSION = 1;
const HOUR = 60 * 60 * 1000;
const FIRST_RACE_SLOWDOWN = 1.35;

// Index = place - 1. Boosters use the inventory keys (ProgressManager.addInventory).
export const RACE_PRIZES = [
  { coins: 500, boosters: { colorChange: 2, freeze: 2, bombs: 2 } },
  { coins: 150, boosters: { freeze: 1 } },
  { coins: 50 },
  { coins: 20 },
  { coins: 20 },
];

const RIVAL_NAMES = ['Turbo Tia', 'Captain Skid', 'Lucky Lou', 'Rocket Ray', 'Zippy Zoe', 'Max Nitro', 'Dash Dana', 'Bumper Ben'];
const RIVAL_COLORS = ['Blue', 'Green', 'Purple', 'Orange'];
export const PLAYER_COLOR = 'Red';
// The leader needs A player attempts to finish on pace alone; the rest need A x these.
const PACE_SPREAD = [1, 1.15, 1.35, 1.6];

/** unlockedLevel is the next unbeaten level, so L30 is beaten once it passes 30. */
export function raceUnlocked(unlockedLevel) {
  return unlockedLevel > RACE_UNLOCK_AFTER;
}

/** A race must be finishable: at least RACE_GOAL unbeaten levels left. */
export function canStartRace(unlockedLevel, levelCount, finalBeaten) {
  if (!raceUnlocked(unlockedLevel)) return false;
  const left = finalBeaten ? 0 : levelCount - unlockedLevel + 1;
  return left >= RACE_GOAL;
}

/** Only the first win of the frontier level counts (and only its losses cost a heart). */
export function countsForRace(levelId, unlockedLevel, starsOnLevel) {
  return typeof levelId === 'number' && levelId === unlockedLevel && !(starsOnLevel > 0);
}

export function startRace({ now, seed, first }) {
  const rng = new SeededRandom(seed);
  const slow = first ? FIRST_RACE_SLOWDOWN : 1;
  const names = [...RIVAL_NAMES];
  for (let i = names.length - 1; i > 0; i--) {             // seeded shuffle
    const j = Math.floor(rng.next() * (i + 1)); [names[i], names[j]] = [names[j], names[i]];
  }
  const spread = [...PACE_SPREAD];
  for (let i = spread.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1)); [spread[i], spread[j]] = [spread[j], spread[i]];
  }
  const leaderAttempts = 5.3 + 2 * rng.next();   // calibrated: a finisher places 1st ~49% (tests/race.test.js)
  const rivals = spread.map((m, i) => {
    const hours = m === 1 ? 12 + 6 * rng.next() : 18 + 18 * rng.next();
    return {
      name: names[i], color: RIVAL_COLORS[i], progress: 0, finishOrder: null,
      pace: RACE_GOAL / (leaderAttempts * m * slow),
      drift: RACE_GOAL / (hours * slow),
    };
  });
  return {
    v: RACE_VERSION, id: `race-${now}`, seed, first: !!first,
    startedAt: now, endsAt: now + RACE_MS, lastSync: now,
    wins: 0, hearts: RACE_HEARTS, attempts: 0, seq: 0, finishOrder: null,
    rivals, result: null, claimed: false,
  };
}

function finishRival(race, rv) {
  rv.progress = RACE_GOAL;
  rv.finishOrder = ++race.seq;
}

/** Apply real-time drift up to `now` (never past the deadline); a passed deadline is a timeout. */
export function syncRace(race, now) {
  if (race.result) return race;
  const t = Math.min(now, race.endsAt);
  const hours = Math.max(0, t - race.lastSync) / HOUR;
  for (const rv of race.rivals) {
    if (rv.finishOrder != null) continue;
    rv.progress += rv.drift * hours;
    if (rv.progress >= RACE_GOAL) finishRival(race, rv);
  }
  race.lastSync = Math.max(race.lastSync, t);
  if (now >= race.endsAt) race.result = { outcome: 'timeout', place: null };
  return race;
}

/**
 * One finished attempt on the frontier level. Events, in order: 'timeout' (the deadline passed
 * first), 'win' | 'heart', then 'finished' | 'out'. The player's result lands before the
 * rivals move, so a tie on the same attempt goes to the player.
 */
export function recordRaceAttempt(race, { won, now }) {
  if (race.result) return { race, events: [] };
  syncRace(race, now);
  if (race.result) return { race, events: ['timeout'] };
  const events = [];
  race.attempts++;
  if (won) {
    race.wins++;
    events.push('win');
    if (race.wins >= RACE_GOAL) {
      race.finishOrder = ++race.seq;
      const ahead = race.rivals.filter(rv => rv.finishOrder != null).length;
      race.result = { outcome: 'finished', place: ahead + 1 };
      events.push('finished');
    }
  } else {
    race.hearts = Math.max(0, race.hearts - 1);
    events.push('heart');
    if (race.hearts === 0) { race.result = { outcome: 'out', place: null }; events.push('out'); }
  }
  if (!race.result) {
    const rng = new SeededRandom((race.seed * 2654435761 + race.attempts * 40503) >>> 0);
    for (const rv of race.rivals) {
      if (rv.finishOrder != null) continue;
      rv.progress += rv.pace * (0.6 + 0.8 * rng.next());
      if (rv.progress >= RACE_GOAL) finishRival(race, rv);
    }
  }
  return { race, events };
}

/** Five rows, best first: finishers by finish order, then by progress; the player wins ties. */
export function raceStandings(race) {
  const rows = [
    { name: 'YOU', color: PLAYER_COLOR, you: true, progress: race.wins, finishOrder: race.finishOrder },
    ...race.rivals.map(rv => ({ name: rv.name, color: rv.color, you: false, progress: Math.min(RACE_GOAL, rv.progress), finishOrder: rv.finishOrder })),
  ].map(r => ({ ...r, wins: Math.floor(r.progress), finished: r.finishOrder != null }));
  return rows.sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished) return a.finishOrder - b.finishOrder;
    if (b.progress !== a.progress) return b.progress - a.progress;
    return a.you ? -1 : b.you ? 1 : 0;
  });
}

/** The prize for a finished race, or null (out of hearts, timeout, still running). */
export function racePrize(race) {
  if (race?.result?.outcome !== 'finished') return null;
  return RACE_PRIZES[race.result.place - 1] ?? null;
}

const num = (x) => typeof x === 'number' && Number.isFinite(x);
const orderOk = (x) => x === null || num(x);

/** A stored race is rebuilt only if every field has the right shape; anything else is null. */
export function sanitizeRace(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o) || o.v !== RACE_VERSION) return null;
  const scalars = ['seed', 'startedAt', 'endsAt', 'lastSync', 'wins', 'hearts', 'attempts', 'seq'];
  if (!scalars.every(k => num(o[k])) || typeof o.id !== 'string' || !orderOk(o.finishOrder)) return null;
  if (!Array.isArray(o.rivals) || o.rivals.length !== RIVAL_COLORS.length) return null;
  if (!o.rivals.every(r => r && typeof r.name === 'string' && typeof r.color === 'string'
    && num(r.progress) && num(r.pace) && num(r.drift) && orderOk(r.finishOrder))) return null;
  const res = o.result;
  if (res !== null && !(res && ['finished', 'out', 'timeout'].includes(res.outcome) && (res.place === null || num(res.place)))) return null;
  if (o.hearts < 0 || o.hearts > RACE_HEARTS || o.wins < 0 || o.wins > RACE_GOAL) return null;
  return {
    v: o.v, id: o.id, seed: o.seed, first: !!o.first,
    startedAt: o.startedAt, endsAt: o.endsAt, lastSync: o.lastSync,
    wins: o.wins, hearts: o.hearts, attempts: o.attempts, seq: o.seq, finishOrder: o.finishOrder,
    rivals: o.rivals.map(r => ({ name: r.name, color: r.color, progress: r.progress, finishOrder: r.finishOrder, pace: r.pace, drift: r.drift })),
    result: res ? { outcome: res.outcome, place: res.place } : null, claimed: !!o.claimed,
  };
}

/**
 * The map's RACE button: null = hidden (not unlocked, or nothing to show). `badge` is the red
 * dot: a decided race to claim, or races exist and the player has not seen the intro yet.
 */
export function raceButtonState({ race, unlockedLevel, levelCount, finalBeaten, introSeen }) {
  if (!raceUnlocked(unlockedLevel)) return null;
  if (race?.result) return { mode: 'claim', wins: race.wins, hearts: race.hearts, badge: true };
  if (race) return { mode: 'racing', wins: race.wins, hearts: race.hearts, badge: false };
  if (!canStartRace(unlockedLevel, levelCount, finalBeaten)) return null;
  return { mode: 'start', wins: 0, hearts: RACE_HEARTS, badge: !introSeen };
}

/** Which race card opens on its own when the map appears: 'intro' | 'result' | null. */
export function raceAutoOpen({ race, introSeen, justUnlocked }) {
  if (race?.result) return 'result';
  if (justUnlocked && !introSeen) return 'intro';
  return null;
}
