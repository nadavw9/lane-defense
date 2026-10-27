// LevelManager — the 40-level progression (V2 redesign, 2026-09-27; see the
// table comment below and docs/VISION.md) plus the opening-depth helpers the
// live game and the simulator share.
//
// Feature unlocks keyed by level elsewhere: bench BENCH_FROM_LEVEL (L13), Hot Streak
// STREAK_FROM_LEVEL (L11), boosters in boosterUnlocks.js. The pacing rule is in the L1-40 header.

// ── Level progression (all 40) — V2 redesign, 2026-09-27 ──────────────────────
//
// Every level has ONE idea, named in its comment, and new ideas arrive one at a time with a
// practice level between (schedule in the World 1 header below). A level never shows more than
// FOUR colours: with three bomb columns, five and six colours turned play into waiting for the
// right bomb. Colours arrive on schedule — Blue L2, Green L16, Yellow L31, Orange L48, Purple L53 —
// and the late game rotates four-colour palettes so every colour stays in play.
//
// Levels are longer (goals of 20-36 cars, ~25-45 turns) so a level is a run with
// a middle, not a coin flip. Difficulty comes from the spawn mix (worldConfig.heft: heavier types more often), density
// (laneTargetCarCount), and the special-car mix (traits: probability per spawn).
//
// Bosses (L10/20/30/40) are real vehicles with a colour sequence on the roof —
// see TrafficRules.makeBoss. Goal: defeatBoss. Each has its own twist:
//   L10 The Hauler        — learn the sequence; short, and it steps forward every turn
//   L20 Iron Hauler       — re-plates after every light: any bomb, then the colour
//   L30 Chameleon King    — a long sequence while speeders flank it
//   L40 Twin Titans       — two bosses at once, one of them armoured
//
// heft values are sim-tuned into the bands in tools/balance-sim.js
// (see the tuning note on each block). speed.base has no gameplay effect in the
// turn-based game; it is kept only because the config shape requires it.

import { LATE_TUNING } from './lateTuning.js';
import { W, total, scaleGoal, identityFor } from './levelDsl.js';
import { LATE_LEVELS } from './LateLevels.js';
import { TOUR_LEVELS } from './TourLevels.js';
import { STEPS_PER_ROW, BOARD_ROWS } from '../director/TrafficRules.js';

const PROGRESSION = [

  // ═══ WORLD 1 — Tutorial City (L1-15) ═══════════════════════════════════════
  //
  // Pacing (2026-10-22, owner: "the first levels are boring, we remain with 2 colours and 3 lanes,
  // too easy and doesn't change"): at most ONE new thing per level, nothing new on a HARD level
  // (L10/15/20/...), but no longer a practice level between them in the first twenty. The schedule:
  //   L1 bomb + BOMB booster · L2 colors · L3 third lane · L4 car · L5 third color · L7 van
  //   L8 FREEZE · L9 speeders · L11 supercharge · L12 color goal · L13 bench · L14 armor
  //   L16 fourth color · L21 COLOR SWAP · L23 gift cars · L26 traffic light · L33 rainbow bomb
  // (2026-10-22, second pass: the owner still found L1-L6 "no thinking, 2 options, you always pass").
  // Chameleons, convoys, purple and orange come after L40. Practice levels only mix what the
  // player has already met. heft / goal scale are sim-tuned in lateTuning.js.

  // L1 "First shot": one lane, one colour. Cannot really be lost.
  // One lane, BOTH bombs on offer from the first move (colCount 2). The road opens with a run
  // of reds (firstColors), so the first shots are pure "pick the red bomb"; the first blue car
  // reaches the front after five reds and the second_colour card (introSchedule) explains the
  // match rule at that moment, hand on the blue bomb. Owner, 2026-10-27: teach the colour on L1
  // so L2 adds only the lane.
  { id: 1, name: 'First shot', laneCount: 1, colCount: 2, colors: ['Red', 'Blue'], worldConfig: W(1),
    duration: 60, spawnBudget: 5, laneTargetCarCount: 3, gridRows: BOARD_ROWS, showArrow: true,   // 3 queued: the BOMB booster's lane clear must be visible
    firstColors: ['Red', 'Red', 'Red', 'Red', 'Red', 'Blue'],
    hintText: 'Drag the matching bomb to the lane', goals: total(10) },

  // L2 "Second lane": NEW: a second lane (the colours were taught on L1).
  { id: 2, name: 'Second lane', laneCount: 2, colCount: 2, colors: ['Red', 'Blue'], worldConfig: W(1),
    duration: 70, spawnBudget: 8, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    hintText: 'Two lanes now. Each bomb goes to a car of its own color', goals: total(14) },

  // L3 "Three lanes": NEW: a third lane (2026-10-22, owner: until L7 "you need to do no thinking,
  // just drag the bombs with 2 available options"). Three columns, so choosing a bomb is a choice.
  { id: 3, name: 'Three lanes', laneCount: 3, colCount: 3, colors: ['Red', 'Blue'], worldConfig: W(1),
    duration: 90, spawnBudget: 10, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    hintText: 'Every hit moves ALL traffic one step. Stop the closest car first!', showAreaLabels: true,
    goals: total(14) },

  // L4 "Bigger cars": NEW: the car (2 hits). Its animated card opens the level.
  { id: 4, name: 'Bigger cars', laneCount: 3, colCount: 3, colors: ['Red', 'Blue'], worldConfig: W(1),
    duration: 90, spawnBudget: 10, laneTargetCarCount: 2, gridRows: BOARD_ROWS, goals: total(18) },

  // L5 "Green light": NEW: a third colour.
  { id: 5, name: 'Green light', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(1),
    duration: 100, spawnBudget: 11, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    hintText: 'NEW! Green bombs join the fight: three colors to match', goals: total(20) },

  // L6 "Chain reaction": NEW: an exploding car takes same-colour front cars in the neighbouring
  // lanes with it (spread.js, SPREAD_FROM). The first level where the ORDER of shots matters.
  { id: 6, name: 'Chain reaction', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(1),
    duration: 100, spawnBudget: 11, laneTargetCarCount: 2, gridRows: BOARD_ROWS, goals: total(10) },

  // L7 "Big rigs": NEW: the van (3 hits, CarTypes.rawBandWeights). Its animated card opens the level.
  { id: 7, name: 'Big rigs', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(1),
    duration: 100, spawnBudget: 12, laneTargetCarCount: 2, gridRows: BOARD_ROWS, goals: total(20) },

  // L8 "Cold snap": NEW: the FREEZE booster (3 free on arrival, boosterUnlocks.js).
  { id: 8, name: 'Cold snap', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(1),
    duration: 100, spawnBudget: 12, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    hintText: 'NEW! FREEZE booster — your next shot is free, traffic holds', goals: total(20) },

  // L9 "Speed trap": NEW: SPEEDERS move two steps a turn.
  { id: 9, name: 'Speed trap', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(1),
    duration: 100, spawnBudget: 12, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    traits: { speeder: 0.12 },
    hintText: 'NEW! Speeders move 2 steps a turn — take them out first', goals: total(20) },

  // L10 BIG WAVE "Rush hour": the first HARD level. Three cars deep in every lane, nothing new:
  // the lesson is keeping all three lanes moving at once.
  { id: 10, name: 'Rush hour', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(1),
    duration: 110, spawnBudget: 12, laneTargetCarCount: 3, gridRows: BOARD_ROWS, milestone: true,
    hintText: 'BIG WAVE! Traffic is three deep. Keep every lane moving',
    goals: total(22) },

  // L11 "Hot streak" (relief): NEW: supercharge — 3 kills in a row charge a bomb.
  { id: 11, name: 'Hot streak', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(1),
    duration: 100, spawnBudget: 12, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    hintText: 'Destroy 3 cars in a row to SUPERCHARGE a bomb: it hits twice', goals: total(22) },

  // L12 "Paint job": NEW: a colour goal — only two colours count.
  { id: 12, name: 'Paint job', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(0.8),
    duration: 100, spawnBudget: 13, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    hintText: 'Only blue and green cars count toward this goal',
    goals: [{ type: 'destroyColor', color: 'Blue', count: 7 }, { type: 'destroyColor', color: 'Green', count: 7 }] },

  // L13 "Park it": NEW: the bench (BENCH_FROM, spotlight tutorial).
  { id: 13, name: 'Park it', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(0.8),
    duration: 100, spawnBudget: 13, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    traits: { speeder: 0.06 }, goals: total(22) },

  // L14 "Steel plates": NEW: ARMORED cars — any bomb knocks the plates off.
  { id: 14, name: 'Steel plates', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(0.7),
    duration: 100, spawnBudget: 13, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    traits: { armored: 0.14 },
    hintText: 'NEW! Armored cars — ANY color knocks the plates off', goals: total(22) },

  // L15 HARD "Gridlock": a dense road, nothing new.
  { id: 15, name: 'Gridlock', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(0.6),
    duration: 110, spawnBudget: 14, laneTargetCarCount: 3, gridRows: BOARD_ROWS,
    traits: { speeder: 0.06, armored: 0.06 }, goals: total(30) },

  // ═══ WORLD 2 — Industrial Zone (L16-30) ════════════════════════════════════

  // L16 "Yellow shift" (relief): NEW: a fourth colour.
  { id: 16, name: 'Yellow shift', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(1),
    duration: 100, spawnBudget: 14, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    hintText: 'NEW! Yellow bombs: four colors to match', goals: total(22) },

  // L17 "Plates and pace": practice, armour and speeders together, four colours.
  { id: 17, name: 'Plates and pace', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.7),
    duration: 100, spawnBudget: 14, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    traits: { armored: 0.08, speeder: 0.08 }, goals: total(24) },

  // L18 "Four of a kind": practice four colours.
  { id: 18, name: 'Four of a kind', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.6),
    duration: 100, spawnBudget: 15, laneTargetCarCount: 2, gridRows: BOARD_ROWS, goals: total(22) },

  // L19 "Heavy load": practice four colours with vans.
  { id: 19, name: 'Heavy load', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.4),
    duration: 100, spawnBudget: 15, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    traits: { speeder: 0.08 }, goals: total(22) },

  // L20 BIG WAVE "Iron lane": HARD, three deep, nothing new.
  { id: 20, name: 'Iron lane', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.3),
    duration: 110, spawnBudget: 16, laneTargetCarCount: 3, gridRows: BOARD_ROWS, milestone: true,
    hintText: 'BIG WAVE! Three deep, four colors', goals: total(22) },

  // L21 "Night shift" (relief): NEW: the COLOR SWAP booster (3 free on arrival).
  { id: 21, name: 'Night shift', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.7),
    duration: 100, spawnBudget: 16, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    hintText: 'NEW! COLOR SWAP booster — recolor a whole color of cars', goals: total(22) },

  // L22 "Shift change": practice.
  { id: 22, name: 'Shift change', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.4),
    duration: 100, spawnBudget: 16, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    traits: { armored: 0.10 }, goals: total(24) },

  // L23 "Gift run": NEW: gift cars (levelDsl GIFT_FROM), on a calm road.
  { id: 23, name: 'Gift run', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.5),
    duration: 100, spawnBudget: 17, laneTargetCarCount: 2, gridRows: BOARD_ROWS, goals: total(24) },

  // L24 "Fast lane": practice with speeders.
  { id: 24, name: 'Fast lane', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.3),
    duration: 100, spawnBudget: 17, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    traits: { speeder: 0.14 }, goals: total(28) },

  // L25 HARD "Rush hour II": speeders in dense traffic.
  { id: 25, name: 'Rush hour II', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.3),
    duration: 110, spawnBudget: 17, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    traits: { speeder: 0.12 }, goals: total(24) },

  // L26 "Red light" (relief): NEW: the traffic light (levelDsl LIGHT_FROM), on a calm road.
  { id: 26, name: 'Red light', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.7),
    duration: 100, spawnBudget: 18, laneTargetCarCount: 2, gridRows: BOARD_ROWS, goals: total(24) },

  // L27 "Mixed traffic": practice.
  { id: 27, name: 'Mixed traffic', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.3),
    duration: 100, spawnBudget: 18, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    traits: { speeder: 0.10 }, goals: total(26) },

  // L28 "Steel column": a colour goal under armour.
  { id: 28, name: 'Steel column', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.4),
    duration: 100, spawnBudget: 18, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    traits: { armored: 0.16 },
    goals: [{ type: 'destroyColor', color: 'Red', count: 8 }, { type: 'destroyColor', color: 'Yellow', count: 8 }] },

  // L29 "Plates and pace": armour and speeders together.
  { id: 29, name: 'Plates and pace II', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.3),
    duration: 100, spawnBudget: 19, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    traits: { armored: 0.10, speeder: 0.10 }, goals: total(26) },

  // L30 BIG WAVE "Long haul": HARD (not super hard: none before L50), a long dense wave.
  { id: 30, name: 'Long Haul', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.3),
    duration: 120, spawnBudget: 20, laneTargetCarCount: 3, gridRows: BOARD_ROWS, milestone: true,
    traits: { speeder: 0.06 },
    hintText: 'BIG WAVE! A long run, speeders in the mix',
    goals: total(20) },

  // ═══ WORLD 3 — The Highway (L31-40) ════════════════════════════════════════

  // L31 "Neon shift" (relief): the highway opens, nothing new.
  { id: 31, name: 'Neon shift', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.8),
    duration: 100, spawnBudget: 20, laneTargetCarCount: 2, gridRows: BOARD_ROWS, goals: total(24) },

  // L32 "Neon rush": practice four colours.
  { id: 32, name: 'Neon rush', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.4),
    duration: 100, spawnBudget: 20, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    traits: { speeder: 0.10 }, goals: total(26) },

  // L33 "Rainbow road": NEW: the RAINBOW bomb (3 multi-kill shots in a row earn one).
  { id: 33, name: 'Rainbow road', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.5),
    duration: 100, spawnBudget: 21, laneTargetCarCount: 2, gridRows: BOARD_ROWS, goals: total(26) },

  // L34 "Armored column": practice.
  { id: 34, name: 'Armored column', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.3),
    duration: 100, spawnBudget: 21, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    traits: { armored: 0.14 }, goals: total(27) },

  // L35 HARD "Night convoy": heavy traffic at speed.
  { id: 35, name: 'Night convoy', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.3),
    duration: 110, spawnBudget: 21, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    traits: { speeder: 0.10, armored: 0.08 }, goals: total(32) },

  // L36 "Cruise control" (relief): a calm road with gift cars.
  { id: 36, name: 'Cruise control', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.7),
    duration: 100, spawnBudget: 22, laneTargetCarCount: 2, gridRows: BOARD_ROWS, goals: total(26) },

  // L37 "Last exit": practice.
  { id: 37, name: 'Last exit', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.3),
    duration: 100, spawnBudget: 22, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    traits: { speeder: 0.08, armored: 0.08 }, goals: total(28) },

  // L38 "Red signal": a traffic light on a calm two-deep road.
  { id: 38, name: 'Red signal', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.5),
    duration: 110, spawnBudget: 23, laneTargetCarCount: 2, gridRows: BOARD_ROWS, goals: total(26) },

  // L39 "Final approach": heavy and mixed.
  { id: 39, name: 'Final approach', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Yellow', 'Green'], worldConfig: W(0.2),
    duration: 110, spawnBudget: 23, laneTargetCarCount: 2, gridRows: BOARD_ROWS,
    traits: { speeder: 0.10, armored: 0.10 }, goals: total(24) },

  // L40 BIG WAVE "Grand finale": HARD, everything so far, three deep.
  { id: 40, name: 'Grand finale', laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Yellow', 'Green'], worldConfig: W(0.2),
    duration: 120, spawnBudget: 24, laneTargetCarCount: 3, gridRows: BOARD_ROWS, milestone: true,
    traits: { armored: 0.05 },
    hintText: 'BIG WAVE! Everything you have learned, three deep',
    goals: total(20) },

  // ═══ WORLDS 3-7 continue in LateLevels.js (L41-L100) ═══════════════════════
  ...LATE_LEVELS,

  // ═══ WORLDS 8-14, the second tour, in TourLevels.js (L101-L200) ═════════════
  ...TOUR_LEVELS,
];

// Every numbered level runs on half-row steps: each correct shot moves traffic half a
// car length, so cars needing several hits still leave the player enough shots
// without lengthening the road or shrinking the cars (see docs/ONE_HIT_MODEL.md).
for (const cfg of PROGRESSION) cfg.stepsPerRow ??= STEPS_PER_ROW;

// Level identity (2026-10-17): traffic lights, gift cars and motorbike convoys, from ONE rule
// (levelDsl.identityFor) so the map reads as a sequence of distinct levels. Applied before the
// tuning overlay so the sim tunes every level with its lights / convoy / gifts in place.
for (const cfg of PROGRESSION) {
  const idn = identityFor(cfg.id, !!cfg.milestone);
  if (idn.lights) cfg.lights = idn.lights;
  if (idn.convoy) cfg.convoy = idn.convoy;
  if (idn.gift > 0) {
    cfg.traits = { ...(cfg.traits ?? {}), gift: idn.gift };
    if (cfg.baseTraits) cfg.baseTraits = { ...cfg.baseTraits, gift: idn.gift };
  }
}

// Sim-tuned numbers (lateTuning.js, written by tools/tune-levels.mjs) for the hand-authored
// L1-40: goal scale and spawn-mix heft. L41+ apply theirs in levelDsl.lv(). The authored goals
// stay on cfg.baseGoals so the tuner always starts from the design, never from its own output.
for (const cfg of PROGRESSION) {
  const t = cfg.id <= 40 ? LATE_TUNING[cfg.id] : null;
  if (!t) continue;
  cfg.baseGoals = cfg.goals;
  cfg.tuneHeft = cfg.worldConfig?.heft;
  cfg.goals = cfg.goals.map(g => scaleGoal(g, t.gs ?? 1));
  if (t.ts && t.ts !== 1 && cfg.traits) { cfg.baseTraits = cfg.traits; cfg.traits = Object.fromEntries(Object.entries(cfg.traits).map(([n, p]) => [n, +(p * t.ts).toFixed(4)])); }
  if (t.heft != null) cfg.worldConfig = { ...cfg.worldConfig, heft: t.heft };
}

// COLOR CHANGE is now earned by chaining two strictly-consecutive multi-kills
// (see GameLoop._updateColorChangeCombo) — there is no per-level coin threshold.

// Opening cars per lane at level start, as rows (low row = top/back = far from
// breach; breach at row gridRows-1=10). UNIFORM OPENING: every level starts the
// same — 3 cars per lane clustered at the very top, at rows 0, 1, 2, so the board
// reads as "cars entering from the top" and every level is the same distance from
// the breach. Difficulty is NOT carried by the opening geometry; it scales through
// bomb power and total car count (spawnBudget / laneTargetCarCount) instead.
//   all levels    → 3 cars  rows [0, 1, 2]   steps-to-breach 11 / 10 / 9
// Cars fill the top of the road in adjacent rows; the visual gap between them comes
// from the car render size (SPRITE_SCALE in Car3D), not from skipping rows. 3/lane is
// boosterless-unwinnable in the headless sim (clearing 3×lanes opening cars at 1
// kill/shot exceeds the runway), so the sim is the floor — real play relies on
// boosters + color bombs, by design.
const OPENING_ROWS = [0, 1, 2];

// 2026-07-25 (rows-8 pilot): opening depth is now gridRows-AWARE. It used to be
// a flat [0,1,2] for every level regardless of board depth — harmless at
// gridRows 16 (3 of 16 rows = 19% of the board), structurally fatal at
// gridRows 8, where the same 3 rows are 37% of the board and the opening deal
// alone floods the runway. Sim-proven: at 3 lanes / gridRows 8 the 3-row
// opening is unwinnable at ANY tuning, while a 2-row opening puts all four
// reference levels in-band with non-degenerate tuning (L5 88.7 / L13 72.3 /
// L20 47.3 / L30 49.7).
//
// SHALLOW_ROWS_THRESHOLD is the board depth at or below which the opening
// drops a row. NO-OP at gridRows 16 (returns [0,1,2] exactly as before), so
// L1-L3 and L9-L40 are byte-identical until they're converted.
const SHALLOW_ROWS_THRESHOLD = 10;
const OPENING_ROWS_SHALLOW   = [0, 1, 2];   // 2026-10-17: one more visible car per lane, so a level opens on traffic, not empty road
// L1 opens with three cars ALL on screen (rows 1-3; row 0 is the hidden staging row), so the
// first-timer sees a queue and the BOMB booster's lane clear has something to clear.
const L1_OPENING_ROWS        = [1, 2, 3];

/**
 * Opening cars per lane at level start, as rows.
 * THE single source of truth — called by BOTH the live game
 * (GameApp -> gs.openingRows -> GameLoop._primeInitialCars) and the headless
 * sim (SimulationRunner). Never re-derive opening depth anywhere else; the
 * live/sim parity test in tests/opening-depth-parity.test.js pins them together.
 *
 * @param {number|*} id        level id (non-numeric = generic/daily probe config)
 * @param {number}   gridRows  board depth; defaults to the 16-row standard
 */
// V2 Hot Streak is live from this level on (introduced with its card at L11).
// A level may override with `streak: true|false`. Daily/generic configs: on.
// THE single source — GameApp and SimulationRunner both call this.
export const STREAK_FROM_LEVEL = 11;
// The bench (park a bomb for later) arrives on this level with its spotlight tutorial.
export const BENCH_FROM_LEVEL = 13;
export function streakEnabledFor(cfg) {
  if (typeof cfg?.streak === 'boolean') return cfg.streak;
  return typeof cfg?.id === 'number' ? cfg.id >= STREAK_FROM_LEVEL : true;
}

export function openingRowsForLevel(id, gridRows = 16) {
  // Generic/world-based configs (no numeric level id) and the daily challenge use a
  // light single-car opening — they probe the director engine, not a level's opening
  // density. Every real numbered level uses the uniform opening.
  if (typeof id !== 'number') return [2];
  if (id === 1 && gridRows <= SHALLOW_ROWS_THRESHOLD) return L1_OPENING_ROWS;
  return gridRows <= SHALLOW_ROWS_THRESHOLD ? OPENING_ROWS_SHALLOW : OPENING_ROWS;
}

// Count of opening cars per lane (= openingRowsForLevel(id, gridRows).length). For tests.
export function openingCarsForLevel(id, gridRows = 16) {
  return openingRowsForLevel(id, gridRows).length;
}

/**
 * Clamp a scripted `initialCars` opening (L10/L40's hand-authored boards) to the
 * same depth rule the uniform opening follows. Without this, a scripted level
 * converted to a shallow board keeps its 3-row deal and floods — measured: L10
 * 0.3% and L40 2.7% win rate at gridRows 8 with their scripted openings intact,
 * vs 47.7% / 44.3% (both in-band) once clamped.
 * Returns the array unchanged when the board is deep enough (no-op at 16).
 */
export function clampInitialCarsToDepth(initialCars, gridRows = 16) {
  if (!initialCars?.length || gridRows > SHALLOW_ROWS_THRESHOLD) return initialCars;
  const maxRow = OPENING_ROWS_SHALLOW[OPENING_ROWS_SHALLOW.length - 1];
  return initialCars.filter(def => (def.row ?? 0) <= maxRow);
}

// The campaign length and boss test are derived from the table, never hard-coded:
// the map, progress, tools and tests all read these, so adding levels is one edit.
export const LEVEL_COUNT = PROGRESSION.length;
export function levelConfigFor(id) { return PROGRESSION.find(cfg => cfg.id === id) ?? null; }
// A BIG WAVE is the milestone level that closes each block of ten: a dense board, no
// new rule. (These were boss fights before docs/ONE_HIT_MODEL.md.)
export function isMilestoneLevel(id) {
  return !!levelConfigFor(id)?.milestone;
}

// Difficulty label the player sees (map node, pre-level card) — the same tiers tools/bands.mjs
// tunes to, so the label always tells the truth. Sawtooth: every level ending in 5 (from L15)
// is HARD, every big wave is HARD (L10-L40) then SUPER HARD (L50 on), and the level after
// each is a relief level (an easier band, no label).
export function levelDifficulty(id) {
  if (typeof id !== 'number') return 'normal';
  if (isMilestoneLevel(id)) return id >= 50 ? 'superhard' : 'hard';   // no SUPER HARD before L50 (research: Royal Match L59)
  if (id >= 15 && id % 10 === 5) return 'hard';
  return 'normal';
}
export function isReliefLevel(id) {
  return typeof id === 'number' && id >= 11 && (id % 10 === 1 || (id >= 16 && id % 10 === 6));
}

export class LevelManager {
  constructor() {
    this._idx       = 0;
    this._autoTuner = null;
  }

  setAutoTuner(autoTuner) {
    this._autoTuner = autoTuner;
  }

  get current() {
    const cfg = PROGRESSION[this._idx];
    if (!this._autoTuner) return cfg;

    const mod = this._autoTuner.getModifier(cfg.id);
    // hpFactor is ignored: car HP per type is fixed; only speed is adaptive.
    if (mod.speedFactor === 1.0) return cfg;

    return {
      ...cfg,
      worldConfig: {
        ...cfg.worldConfig,
        speed: {
          base:     cfg.worldConfig.speed.base     * mod.speedFactor,
          variance: cfg.worldConfig.speed.variance,
        },
      },
    };
  }

  get levelNumber() {
    return this.current.id;
  }

  advance() {
    if (this._idx < PROGRESSION.length - 1) this._idx++;
    return this.current;
  }

  goToLevel(id) {
    const idx = PROGRESSION.findIndex(cfg => cfg.id === id);
    if (idx >= 0) this._idx = idx;
  }

  get isFinalLevel() {
    return this._idx === PROGRESSION.length - 1;
  }

  get totalLevels() { return PROGRESSION.length; }

  static getSurvivalConfig(wave) {
    const speed   = Math.min(9.5, 4.0 + wave * 0.28);
    const hp      = Math.min(2.0, 0.65 + wave * 0.04);
    const colors  = wave < 4  ? ['Red', 'Blue']
                  : wave < 8  ? ['Red', 'Blue', 'Green']
                  : wave < 12 ? ['Red', 'Blue', 'Green', 'Yellow']
                  : wave < 16 ? ['Red', 'Blue', 'Green', 'Yellow', 'Purple']
                  :              ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'];
    return {
      id:          `survival_w${wave}`,
      isSurvival:  true,
      wave,
      laneCount:   4,
      colCount:    4,
      colors,
      worldConfig: { hpMultiplier: hp, speed: { base: speed, variance: 0.6 } },
      duration:    30,
      noRescue:    true,
    };
  }
}


