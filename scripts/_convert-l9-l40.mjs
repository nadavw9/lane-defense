// Structural conversion of L9-L40 to the L4-L8 pilot shape:
//   3 lanes / 3 cols, gridRows 8, laneTargetCarCount 2, hpMultiplier >= 0.70.
//
// Band 600 follows automatically from laneCount 3 (bandFor); FIT is per-type and
// already global. Nothing here touches L1-L8.
//
// hpMultiplier floor is 0.70 deliberately: below ~0.63 small/big/jeep collapse to
// the same integer HP and the car types stop reading as different vehicles. Where a
// level needs to be easier than 0.70 allows, density (laneTargetCarCount) is the
// lever, not hp.
import fs from 'fs';

const FILE = 'src/game/LevelManager.js';
let src = fs.readFileSync(FILE, 'utf8');

// Split into level blocks by the `{ id: N,` opener at two-space indent.
const opener = /^ {2}\{ id: (\d+),/gm;
const marks = [];
let m;
while ((m = opener.exec(src)) !== null) marks.push({ id: Number(m[1]), start: m.index });

let out = src;
const edits = [];
for (let i = marks.length - 1; i >= 0; i--) {
  const { id, start } = marks[i];
  if (id < 9) continue;
  const end = i + 1 < marks.length ? marks[i + 1].start : out.indexOf('];', start);
  let block = out.slice(start, end);
  const before = block;

  block = block.replace(/laneCount: 4/g, 'laneCount: 3');
  block = block.replace(/colCount: 4/g, 'colCount: 3');
  block = block.replace(/gridRows: 16/g, 'gridRows: 8');
  block = block.replace(/laneTargetCarCount: \d+/g, 'laneTargetCarCount: 2');

  // L9 is the last level still pointing at a shared preset; inline it so tuning
  // here cannot leak anywhere else.
  block = block.replace(/worldConfig: B2_EASY,/,
    'worldConfig: { hpMultiplier: 0.70, speed: { base: 4.6, variance: 0.4 } },');

  // Floor every inline hpMultiplier at 0.70.
  block = block.replace(/hpMultiplier: (0?\.\d+)/g, (s, v) =>
    (Number(v) < 0.70 ? 'hpMultiplier: 0.70' : s));

  // Opening depth must fit the 8-row board, and lane 3 no longer exists.
  block = block.replace(/\{ lane: 3, row: \d+, color: '\w+'\s*\},?\s*/g, '');
  block = block.replace(/row: (\d+)/g, (s, r) => (Number(r) > 7 ? 'row: 7' : s));

  if (block !== before) { out = out.slice(0, start) + block + out.slice(end); edits.push(id); }
}

fs.writeFileSync(FILE, out);
console.log(`converted ${edits.length} levels: ${edits.reverse().join(', ')}`);

// Verify no 4-lane / 16-row remnants above L8.
const after = fs.readFileSync(FILE, 'utf8');
const bad = [];
const op2 = /^ {2}\{ id: (\d+),/gm;
const mk = [];
while ((m = op2.exec(after)) !== null) mk.push({ id: Number(m[1]), start: m.index });
for (let i = 0; i < mk.length; i++) {
  if (mk[i].id < 9) continue;
  const end = i + 1 < mk.length ? mk[i + 1].start : after.indexOf('];', mk[i].start);
  const b = after.slice(mk[i].start, end);
  if (/laneCount: [^3]/.test(b)) bad.push(`L${mk[i].id} laneCount`);
  if (/colCount: [^3]/.test(b))  bad.push(`L${mk[i].id} colCount`);
  if (/gridRows: (?!8\b)/.test(b)) bad.push(`L${mk[i].id} gridRows`);
  if (/lane: 3\b/.test(b)) bad.push(`L${mk[i].id} lane 3 still present`);
  const hp = b.match(/hpMultiplier: (0?\.\d+)/g) ?? [];
  for (const h of hp) if (Number(h.split(': ')[1]) < 0.70) bad.push(`L${mk[i].id} ${h}`);
}
console.log(bad.length ? 'REMNANTS: ' + bad.join(', ') : 'verified: no 4-lane/16-row/hp<0.70 remnants above L8');
