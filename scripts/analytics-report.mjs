// Per-level difficulty report from the anonymous analytics rows (Firebase RTDB REST).
//   node scripts/analytics-report.mjs [--model onehit-1] [--min 5] [--file events.json]
// Compares observed first-attempt win rate against the sim band in tools/bands.mjs.
// Needs the RTDB read rule open (or pass --file with an exported events.json).
import { readFileSync } from 'node:fs';
import { bandFor } from '../tools/bands.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const MODEL = arg('model', 'onehit-1');
const MIN = Number(arg('min', 5));
const FILE = arg('file', null);
const DB = 'https://lanedefense-analytics-default-rtdb.firebaseio.com';

const raw = FILE ? JSON.parse(readFileSync(FILE, 'utf8'))
  : await fetch(`${DB}/events.json`).then(r => { if (!r.ok) throw new Error(`RTDB ${r.status} (read rule closed? export events.json and use --file)`); return r.json(); });
const rows = Object.values(raw ?? {}).filter(e => e.model === MODEL && typeof e.levelId === 'number');
rows.sort((a, b) => a.ts - b.ts);

// Per player+level, the FIRST outcome decides first-attempt result.
const first = new Map();   // "player|level" -> 'win' | 'fail' | 'quit'
const lv = new Map();
const L = id => lv.get(id) ?? (lv.set(id, { starts: 0, win: 0, fail: 0, quit: 0, f1w: 0, f1n: 0, turns: [] }), lv.get(id));
for (const e of rows) {
  const l = L(e.levelId), k = `${e.playerId}|${e.levelId}`;
  if (e.event === 'level_started') l.starts++;
  const kind = { level_completed: 'win', level_failed: 'fail', level_quit: 'quit' }[e.event];
  if (!kind) continue;
  l[kind]++;
  if (kind === 'win') l.turns.push(e.turns);
  if (!first.has(k) && kind !== 'quit') { first.set(k, kind); l.f1n++; if (kind === 'win') l.f1w++; }
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '-');
console.log(`model=${MODEL}  rows=${rows.length}  (levels with < ${MIN} first attempts are noise)`);
console.log('lvl  starts  1st-win  band     quit   verdict');
for (const id of [...lv.keys()].sort((a, b) => a - b)) {
  const l = lv.get(id), b = bandFor(id), w = l.f1n ? (100 * l.f1w) / l.f1n : null;
  let v = 'few data';
  if (l.f1n >= MIN) v = w < b.lo - 10 ? 'TOO HARD' : w > b.hi + 10 ? 'TOO EASY' : 'ok';
  console.log(`${String(id).padStart(3)}  ${String(l.starts).padStart(6)}  ${pct(l.f1w, l.f1n).padStart(7)}  ${b.lo}-${b.hi}`.padEnd(34) + `${pct(l.quit, l.starts).padStart(5)}   ${v}`);
}
