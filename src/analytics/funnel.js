// Funnel report (2026-10-20): the numbers that decide whether paying for installs can work.
// Input rows from any first-party sink: { event, playerId, ts, installDay?, levelId?, kind? }.
// The player id is whatever random install id the game keeps; nothing here cares where it came from.
//   retention.dN   share of installs active N local days after install (null if no cohort is old enough)
//   levels[]       per level: players started / won / won on the first try, attempts
//   stopAt         players by the highest level they have won (0 = none): where the game loses people
//   adsPerPlayerDay  ad_shown events per active player-day (a revenue-per-player input)
import { localDateKey } from '../game/dateKeys.js';
import { dayIndex } from './retention.js';

export function funnelReport(rows, { now = Date.now() } = {}) {
  const players = new Map();   // id -> { installDay, days:Set, levels:Map<id, {starts, won, first}> , best }
  const sorted = rows.filter(r => r && r.playerId && Number.isFinite(r.ts)).sort((a, b) => a.ts - b.ts);
  let ads = 0;
  for (const r of sorted) {
    let p = players.get(r.playerId);
    if (!p) players.set(r.playerId, p = { installDay: r.installDay ?? localDateKey(new Date(r.ts)), days: new Set(), levels: new Map(), best: 0 });
    p.days.add(dayIndex(p.installDay, new Date(r.ts)));
    if (r.event === 'ad_shown') ads++;
    const id = Number(r.levelId);
    if (!Number.isInteger(id)) continue;
    let l = p.levels.get(id);
    if (!l) p.levels.set(id, l = { starts: 0, won: false, first: null });
    if (r.event === 'level_started') l.starts++;
    if (r.event === 'level_completed' || r.event === 'level_failed') {
      const win = r.event === 'level_completed';
      if (l.first === null) l.first = win;
      if (win) { l.won = true; p.best = Math.max(p.best, id); }
    }
  }

  const age = (p) => dayIndex(p.installDay, new Date(now));
  const ret = (n) => {
    const cohort = [...players.values()].filter(p => age(p) > n);
    return cohort.length ? cohort.filter(p => p.days.has(n)).length / cohort.length : null;
  };

  const levelMap = new Map();
  const stopAt = {};
  let playerDays = 0;
  for (const p of players.values()) {
    playerDays += p.days.size;
    stopAt[p.best] = (stopAt[p.best] ?? 0) + 1;
    for (const [id, l] of p.levels) {
      let s = levelMap.get(id);
      if (!s) levelMap.set(id, s = { levelId: id, started: 0, won: 0, firstTryWins: 0, attempts: 0 });
      if (l.starts > 0 || l.first !== null) s.started++;
      if (l.won) s.won++;
      if (l.first === true) s.firstTryWins++;
      s.attempts += l.starts;
    }
  }

  return {
    installs: players.size,
    retention: { d1: ret(1), d7: ret(7), d30: ret(30) },
    levels: [...levelMap.values()].sort((a, b) => a.levelId - b.levelId),
    stopAt,
    playerDays,
    adsPerPlayerDay: playerDays ? ads / playerDays : 0,
  };
}
