// Funnel report from an exported event log (no network, no credentials).
//   Firebase console -> Realtime Database -> the "events" node -> ... -> Export JSON, then:
//   node tools/funnel.mjs <events.json> [--json]
// Accepts { pushId: row }, { events: { pushId: row } } or an array of rows. Math Wolf rows work too
// when mapped to { event, playerId, ts, installDay?, levelId?, kind? }.
import { readFileSync } from 'node:fs';
import { funnelReport } from '../src/analytics/funnel.js';

const [file] = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!file) { console.error('usage: node tools/funnel.mjs <events.json> [--json]'); process.exit(1); }
const raw = JSON.parse(readFileSync(file, 'utf8'));
const src = Array.isArray(raw) ? raw : Object.values(raw.events ?? raw);
const rows = src.map(r => ({ ...r, ts: r.ts ?? r.timestamp }));
const r = funnelReport(rows);
if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }

// Rough public benchmarks for casual puzzle games: below them, paid installs lose money.
const BENCH = { d1: 0.40, d7: 0.15, d30: 0.06 };
const pct = (v) => v == null ? '  n/a' : `${(v * 100).toFixed(1).padStart(5)}%`;
console.log(`installs ${r.installs}, active player-days ${r.playerDays}, ads per player-day ${r.adsPerPlayerDay.toFixed(2)}`);
for (const k of ['d1', 'd7', 'd30']) {
  const v = r.retention[k];
  console.log(`${k.toUpperCase().padEnd(4)} ${pct(v)}   target ${pct(BENCH[k])}  ${v == null ? '(cohort too young)' : v >= BENCH[k] ? 'OK' : 'BELOW'}`);
}
console.log('\nlevel  started   won  first-try  attempts/win');
for (const l of r.levels.slice(0, 60)) {
  console.log(`${String(l.levelId).padStart(5)} ${String(l.started).padStart(8)} ${String(l.won).padStart(5)} ${pct(l.started ? l.firstTryWins / l.started : 0).padStart(10)} ${(l.won ? l.attempts / l.won : 0).toFixed(1).padStart(12)}`);
}
const stops = Object.entries(r.stopAt).sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log('\nwhere players stop (highest level won: players):', stops.map(([k, v]) => `L${k}:${v}`).join('  '));
