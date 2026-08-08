// Write the tuner's chosen values into LevelManager.js for L9-L40.
// goalScale/speedScale are applied to the CURRENT config values; hp is absolute.
import fs from 'fs';

const T = {
  9:  { g: 0.21,  hp: 0.70,  s: 0.822, ltc: 2 },
  10: { g: 1.259, hp: 0.811, s: 1.052, ltc: 3 },
  11: { g: 0.72,  hp: 0.89,  s: 0.937, ltc: 2 },
  12: { g: 0.72,  hp: 0.81,  s: 0.937, ltc: 2 },
  13: { g: 0.486, hp: 0.70,  s: 0.884, ltc: 2 },
  14: { g: 0.72,  hp: 0.70,  s: 0.937, ltc: 2 },
  15: { g: 0.55,  hp: 0.70,  s: 0.899, ltc: 2 },
  16: { g: 0.465, hp: 0.70,  s: 0.880, ltc: 2 },
  17: { g: 0.125, hp: 0.70,  s: 0.803, ltc: 2 },
  18: { g: 0.38,  hp: 0.70,  s: 0.861, ltc: 2 },
  19: { g: 0.38,  hp: 0.70,  s: 0.861, ltc: 2 },
  20: { g: 0.38,  hp: 0.90,  s: 0.861, ltc: 3 },
  21: { g: 0.199, hp: 0.70,  s: 0.820, ltc: 2 },
  22: { g: 0.167, hp: 0.70,  s: 0.813, ltc: 2 },
  23: { g: 0.38,  hp: 0.70,  s: 0.861, ltc: 2 },
  24: { g: 0.55,  hp: 0.70,  s: 0.899, ltc: 2 },
  25: { g: 0.125, hp: 0.70,  s: 0.803, ltc: 2 },
  26: { g: 0.21,  hp: 0.70,  s: 0.822, ltc: 2 },
  27: { g: 0.21,  hp: 0.70,  s: 0.822, ltc: 2 },
  28: { g: 0.38,  hp: 0.70,  s: 0.861, ltc: 2 },
  29: { g: 0.295, hp: 0.70,  s: 0.841, ltc: 2 },
  30: { g: 0.21,  hp: 0.70,  s: 0.822, ltc: 3 },   // OUT OF BAND — rare-type gated
  31: { g: 0.38,  hp: 0.70,  s: 0.861, ltc: 2 },
  32: { g: 0.38,  hp: 0.70,  s: 0.861, ltc: 2 },
  33: { g: 0.295, hp: 0.70,  s: 0.841, ltc: 2 },
  34: { g: 0.295, hp: 0.70,  s: 0.841, ltc: 2 },
  35: { g: 0.38,  hp: 0.70,  s: 0.861, ltc: 2 },
  36: { g: 0.38,  hp: 0.70,  s: 0.861, ltc: 2 },
  37: { g: 0.295, hp: 0.70,  s: 0.841, ltc: 2 },
  38: { g: 0.295, hp: 0.70,  s: 0.841, ltc: 2 },
  39: { g: 0.38,  hp: 0.70,  s: 0.861, ltc: 2 },   // OUT OF BAND — rare-type gated
  40: { g: 1.259, hp: 0.811, s: 1.052, ltc: 3 },
};

const FILE = 'src/game/LevelManager.js';
let src = fs.readFileSync(FILE, 'utf8');
const op = /^ {2}\{ id: (\d+),/gm;
const marks = [];
let m; while ((m = op.exec(src)) !== null) marks.push({ id: Number(m[1]), start: m.index });

for (let i = marks.length - 1; i >= 0; i--) {
  const { id, start } = marks[i];
  const t = T[id]; if (!t) continue;
  const end = i + 1 < marks.length ? marks[i + 1].start : src.indexOf('];', start);
  let b = src.slice(start, end);

  b = b.replace(/hpMultiplier: [0-9.]+/, `hpMultiplier: ${t.hp}`);
  b = b.replace(/base: ([0-9.]+)/, (s, v) => `base: ${+(Number(v) * t.s).toFixed(2)}`);
  b = b.replace(/laneTargetCarCount: \d+/, `laneTargetCarCount: ${t.ltc}`);
  b = b.replace(/"count":(\d+)/g, (s, c) => `"count":${Math.max(1, Math.round(Number(c) * t.g))}`);

  src = src.slice(0, start) + b + src.slice(end);
}
fs.writeFileSync(FILE, src);
console.log(`applied tuning to ${Object.keys(T).length} levels`);
