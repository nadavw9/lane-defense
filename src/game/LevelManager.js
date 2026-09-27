// LevelManager â€” 40-level progression aligned with VISION.md.
//
// Difficulty wave per 8-level block (N = block start):
//   N+0  Easy       relief / onboarding
//   N+1  Medium
//   N+2  Medium
//   N+3  Hard
//   N+4  Easy       relief (sometimes new mechanic unlock)
//   N+5  Medium
//   N+6  Hard
//   N+7  Boss-Hard  rescue-ad moment
//
// Boss levels (designed challenges, not just hp bumps): L10, L15, L20, L25, L30, L35, L40
//
// Color introduction schedule:
//   L1        Red only
//   L2-L9     Red + Blue
//   L7-L9     Red + Blue + Green  (Green at L7 per block-1 medium-hard slot)
//   L10       Red + Blue (bench-test puzzle â€” intentionally stripped)
//   L11-L20   Red + Blue + Green
//   L21-L24   Red + Blue + Green + Yellow  (Yellow intro at L21 relief)
//   L25-L30   + Purple (Color Overload boss at L25)
//   L31-L40   + Orange (all 6 colors; World 3 opens at L31)
//
// Feature unlock thresholds (GameApp reads these from progress):
//   bench   L6+
//   swap    L9+
//   freeze  L14+

// â”€â”€ Shared difficulty presets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 2026-07-10 booster-aware retune: most levels now carry per-level inline worldConfig;
// presets that became unreferenced were deleted. Target bands live in tools/balance-sim.js.

// Block 1: Tutorial City â€” morning theme (L1â€“8)
const B1_FTUE = { hpMultiplier: 0.30, speed: { base: 3.0, variance: 0.0 } };

// Block 2: Tutorial City â€” afternoon/sunset themes (L9â€“16)
const B2_EASY = { hpMultiplier: 0.45, speed: { base: 4.6, variance: 0.4 } }; // rebalanced for post-Batch-A road length

// â”€â”€ Realistic player balance presets (Phase 3) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// L2 is 2-lane/2-col in-game but the sim always uses 4 lanes/4 cols, giving 2Ã— extra
// firepower vs real. Compensate with higher speed/HP so the sim is harder.
const R_L2          = { hpMultiplier: 0.90, speed: { base: 7.5, variance: 0.3 } }; // L2 2-col sim bias

// ── Level progression (all 40) — V2 redesign, 2026-09-27 ──────────────────────
//
// Every level has ONE idea, named in its comment. The V2 pieces arrive one at a
// time and are then mixed: Hot Streak (L4), Speeder (L7), boss (L10), Armoured
// (L11), Tank (L15), Chameleon (L17). A level never shows more than FOUR colours:
// with three bomb columns, five and six colours turned play into waiting for the
// right bomb (the V1 late game was won or lost on the opening deal in ~10 turns).
// Colours still arrive on schedule — Yellow L16, Purple L25, Orange L31 — and the
// late game rotates four-colour palettes so every colour stays in play.
//
// Levels are longer (goals of 20-36 cars, ~25-45 turns) so a level is a run with
// a middle, not a coin flip. Difficulty comes from car HP (hpMultiplier), density
// (laneTargetCarCount), and the special-car mix (traits: probability per spawn).
//
// Bosses (L10/20/30/40) are real vehicles with a colour sequence on the roof —
// see TrafficRules.makeBoss. Goal: defeatBoss. Each has its own twist:
//   L10 The Hauler        — learn the sequence; slow (a row every 2 turns)
//   L20 Iron Hauler       — re-plates after every light: any bomb, then the colour
//   L30 Chameleon King    — a long sequence while speeders flank it
//   L40 Twin Titans       — two bosses at once, one of them armoured
//
// hpMultiplier values are sim-tuned into the bands in tools/balance-sim.js
// (see the tuning note on each block). speed.base has no gameplay effect in the
// turn-based game; it is kept only because the config shape requires it.

const SPD = { base: 5.0, variance: 0.3 };
const W = (hp) => ({ hpMultiplier: hp, speed: SPD });
const total = (n) => [{ type: 'destroyTotal', count: n }];
const boss = [{ type: 'defeatBoss', count: 1 }];
// Opening rows for the non-boss lanes of a boss level (the boss owns its lane).
const open = (...lanes) => lanes.flatMap(lane => [{ lane, row: 0 }, { lane, row: 1 }]);

const PROGRESSION = [

  // ═══ WORLD 1 — Tutorial City (L1-15) ═══════════════════════════════════════

  // L1 "First shot": one lane, one colour. Cannot really be lost.
  { id: 1, laneCount: 1, colCount: 1, colors: ['Red'], worldConfig: W(0.30),
    duration: 60, spawnBudget: 5, laneTargetCarCount: 1, gridRows: 8, showArrow: true,
    hintText: 'Drag the matching bomb to the lane', goals: total(10) },

  // L2 "Two colours": colour must match.
  { id: 2, laneCount: 2, colCount: 2, colors: ['Red', 'Blue'], worldConfig: W(0.60),
    duration: 70, spawnBudget: 8, laneTargetCarCount: 2, gridRows: 8,
    hintText: 'Colours must match — a red bomb only hits red cars', goals: total(16) },

  // L3 "Three lanes": watch the whole road.
  { id: 3, laneCount: 3, colCount: 3, colors: ['Red', 'Blue'], worldConfig: W(0.70),
    duration: 90, spawnBudget: 9, laneTargetCarCount: 2, gridRows: 8,
    hintText: 'Every hit moves ALL traffic one step. Stop the closest car first!', showAreaLabels: true,
    goals: total(20) },

  // L4 "Hot Streak": destroy a car 3 shots in a row → supercharged bomb.
  { id: 4, laneCount: 3, colCount: 3, colors: ['Red', 'Blue'], worldConfig: W(1.37),
    duration: 90, spawnBudget: 9, laneTargetCarCount: 2, gridRows: 8,
    hintText: 'Destroy a car 3 shots in a row for a SUPERCHARGED bomb', goals: total(22) },

  // L5 "Green light" (relief): a third colour, gentle traffic.
  { id: 5, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(1.10),
    duration: 100, spawnBudget: 10, laneTargetCarCount: 2, gridRows: 8,
    hintText: 'Green bombs join the fight', goals: total(20) },

  // L6 "Park it": the bench — hold a bomb for later.
  { id: 6, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(0.90),
    duration: 100, spawnBudget: 10, laneTargetCarCount: 2, gridRows: 8,
    hintText: 'NEW! Bench — park a bomb and use it later',
    goals: [{ type: 'destroyColor', color: 'Red', count: 10 }] },

  // L7 "Rush hour": SPEEDERS move two rows a turn.
  { id: 7, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(0.63),
    duration: 100, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 8,
    traits: { speeder: 0.10 },
    hintText: 'NEW! Speeders move 2 steps a turn — take them out first', goals: total(24) },

  // L8 "Heavy load": trucks take more than one bomb.
  { id: 8, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(0.70),
    duration: 100, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 8,
    traits: { speeder: 0.08 },
    goals: total(20) },

  // L9 "Sunday drive" (relief).
  { id: 9, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(0.50),
    duration: 100, spawnBudget: 12, laneTargetCarCount: 2, gridRows: 8,
    traits: { speeder: 0.10 },
    goals: [{ type: 'destroyColor', color: 'Blue', count: 8 }, { type: 'destroyColor', color: 'Green', count: 8 }] },

  // L10 BOSS "The Hauler": a giant truck with a 6-colour sequence in the middle
  // lane, moving a row every 2 turns. Hit it in order while the side lanes keep
  // coming — the lesson is splitting bombs between the boss and the traffic.
  { id: 10, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(1.37),
    duration: 110, spawnBudget: 12, laneTargetCarCount: 2, gridRows: 8,
    hintText: 'BOSS! Hit the boss with the colours on its roof, in order',
    initialCars: [...open(0, 2),
      { lane: 1, row: 1, sequence: ['Red', 'Blue', 'Green', 'Red', 'Green', 'Blue', 'Red'], moveEvery: 2 }],
    goals: boss },

  // L11 "Steel plates": ARMOURED cars — any bomb knocks the plates off.
  { id: 11, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(0.79),
    duration: 100, spawnBudget: 12, laneTargetCarCount: 2, gridRows: 8,
    traits: { armored: 0.18 },
    hintText: 'NEW! Armoured cars — ANY colour knocks the plates off', goals: total(24) },

  // L12 "Plates and pace": armour and speeders together.
  { id: 12, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(0.50),
    duration: 100, spawnBudget: 13, laneTargetCarCount: 2, gridRows: 8,
    traits: { armored: 0.12, speeder: 0.12 }, goals: total(26) },

  // L13 "Breather" (relief).
  { id: 13, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(0.63),
    duration: 100, spawnBudget: 13, laneTargetCarCount: 2, gridRows: 8,
    traits: { armored: 0.08, speeder: 0.08 },
    goals: [{ type: 'destroyColor', color: 'Red', count: 10 }, { type: 'destroyColor', color: 'Blue', count: 10 }] },

  // L14 "Cold snap": FREEZE booster; denser traffic that wants it.
  { id: 14, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(0.64),
    duration: 100, spawnBudget: 13, laneTargetCarCount: 3, gridRows: 8,
    traits: { speeder: 0.10 },
    hintText: 'NEW! FREEZE booster — your next shot is free, traffic holds', goals: total(26) },

  // L15 "Meet the tank": the heaviest car arrives.
  { id: 15, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green'], worldConfig: W(0.52),
    duration: 110, spawnBudget: 14, laneTargetCarCount: 2, gridRows: 8,
    traits: { armored: 0.10 },
    goals: total(22) },

  // ═══ WORLD 2 — Industrial Zone (L16-30) ════════════════════════════════════

  // L16 "Yellow shift" (relief): four colours.
  { id: 16, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.73),
    duration: 100, spawnBudget: 14, laneTargetCarCount: 2, gridRows: 8,
    hintText: 'Yellow bombs — four colours now', goals: total(24) },

  // L17 "Shape shifters": CHAMELEONS flip colour every turn.
  { id: 17, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Yellow'], worldConfig: W(0.68),
    duration: 100, spawnBudget: 14, laneTargetCarCount: 2, gridRows: 8,
    traits: { chameleon: 0.18 },
    hintText: 'NEW! Chameleons switch colour every turn — the small light shows the next one',
    goals: total(26) },

  // L18 "Big rigs": long, heavy, armoured escorts.
  { id: 18, laneCount: 3, colCount: 3, colors: ['Red', 'Green', 'Yellow'], worldConfig: W(0.50),
    duration: 100, spawnBudget: 15, laneTargetCarCount: 2, gridRows: 8,
    traits: { armored: 0.10 },
    goals: total(24) },

  // L19 "Mixed traffic": every special car at once.
  { id: 19, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.50),
    duration: 100, spawnBudget: 15, laneTargetCarCount: 2, gridRows: 8,
    traits: { speeder: 0.08, armored: 0.08, chameleon: 0.08 }, goals: total(28) },

  // L20 BOSS "Iron Hauler": re-plates after every light, so each light is two
  // bombs — any colour, then the right one. Armoured escorts in the side lanes.
  { id: 20, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.50),
    duration: 110, spawnBudget: 16, laneTargetCarCount: 2, gridRows: 8,
    traits: { armored: 0.12 },
    hintText: 'BOSS! Its armour grows back after every light',
    initialCars: [...open(0, 2),
      { lane: 1, row: 1, sequence: ['Yellow', 'Red', 'Blue', 'Green'], moveEvery: 2, reArmor: true }],
    goals: boss },

  // L21 "Night shift" (relief).
  { id: 21, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Yellow'], worldConfig: W(0.70),
    duration: 100, spawnBudget: 16, laneTargetCarCount: 2, gridRows: 8,
    traits: { chameleon: 0.08, speeder: 0.08 }, goals: total(24) },

  // L22 "Speed trap": a quarter of the traffic is speeders.
  { id: 22, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.50),
    duration: 100, spawnBudget: 16, laneTargetCarCount: 2, gridRows: 8,
    traits: { speeder: 0.16 }, goals: total(28) },

  // L23 "Colour flood": dense four-colour traffic with chameleons.
  { id: 23, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.57),
    duration: 100, spawnBudget: 17, laneTargetCarCount: 3, gridRows: 8,
    traits: { chameleon: 0.14 }, goals: total(30) },

  // L24 "Convoy": trucks in armour, three to a lane.
  { id: 24, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Green', 'Yellow'], worldConfig: W(0.41),
    duration: 100, spawnBudget: 17, laneTargetCarCount: 2, gridRows: 8,
    traits: { armored: 0.15 },
    goals: total(28) },

  // L25 "Purple haze" (relief): Purple arrives.
  { id: 25, laneCount: 3, colCount: 3, colors: ['Blue', 'Green', 'Yellow', 'Purple'], worldConfig: W(0.68),
    duration: 100, spawnBudget: 17, laneTargetCarCount: 2, gridRows: 8,
    hintText: 'Purple bombs join the fight', goals: total(26) },

  // L26 "Heavy metal": armoured big rigs.
  { id: 26, laneCount: 3, colCount: 3, colors: ['Red', 'Green', 'Yellow', 'Purple'], worldConfig: W(0.50),
    duration: 100, spawnBudget: 18, laneTargetCarCount: 2, gridRows: 8,
    traits: { armored: 0.14 },
    goals: total(26) },

  // L27 "Rush hour II": speeders and chameleons.
  { id: 27, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Yellow', 'Purple'], worldConfig: W(0.57),
    duration: 100, spawnBudget: 18, laneTargetCarCount: 2, gridRows: 8,
    traits: { speeder: 0.12, chameleon: 0.10 }, goals: total(30) },

  // L28 "The grinder": tanks.
  { id: 28, laneCount: 3, colCount: 3, colors: ['Red', 'Green', 'Yellow', 'Purple'], worldConfig: W(0.68),
    duration: 110, spawnBudget: 18, laneTargetCarCount: 2, gridRows: 8,
    traits: { armored: 0.08 },
    goals: total(24) },

  // L29 "Shift change" (relief).
  { id: 29, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Yellow', 'Purple'], worldConfig: W(0.70),
    duration: 100, spawnBudget: 19, laneTargetCarCount: 2, gridRows: 8,
    traits: { speeder: 0.08, chameleon: 0.08 }, goals: total(26) },

  // L30 BOSS "Chameleon King": a long 8-light sequence; speeders flank it.
  { id: 30, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Yellow', 'Purple'], worldConfig: W(0.79),
    duration: 120, spawnBudget: 20, laneTargetCarCount: 2, gridRows: 8,
    traits: { speeder: 0.18 },
    hintText: 'BOSS! A long sequence — and speeders on both sides',
    initialCars: [...open(0, 2),
      { lane: 1, row: 1, sequence: ['Purple', 'Yellow', 'Red', 'Blue', 'Purple', 'Red', 'Yellow', 'Blue'], moveEvery: 2 }],
    goals: boss },

  // ═══ WORLD 3 — The Highway (L31-40) ════════════════════════════════════════

  // L31 "Night highway": Orange arrives.
  { id: 31, laneCount: 3, colCount: 3, colors: ['Orange', 'Red', 'Blue', 'Green'], worldConfig: W(0.57),
    duration: 100, spawnBudget: 20, laneTargetCarCount: 2, gridRows: 8,
    traits: { speeder: 0.08, armored: 0.08 },
    hintText: 'Orange bombs — the Night Highway', goals: total(28) },

  // L32 "Neon rush": speeders everywhere.
  { id: 32, laneCount: 3, colCount: 3, colors: ['Orange', 'Purple', 'Yellow', 'Blue'], worldConfig: W(0.57),
    duration: 100, spawnBudget: 20, laneTargetCarCount: 2, gridRows: 8,
    traits: { speeder: 0.15 }, goals: total(30) },

  // L33 "Cruise control" (relief).
  { id: 33, laneCount: 3, colCount: 3, colors: ['Orange', 'Green', 'Purple', 'Red'], worldConfig: W(0.77),
    duration: 100, spawnBudget: 21, laneTargetCarCount: 2, gridRows: 8,
    traits: { chameleon: 0.08 }, goals: total(26) },

  // L34 "Armoured column": a quarter of the traffic is plated.
  { id: 34, laneCount: 3, colCount: 3, colors: ['Orange', 'Red', 'Yellow', 'Blue'], worldConfig: W(0.48),
    duration: 100, spawnBudget: 21, laneTargetCarCount: 2, gridRows: 8,
    traits: { armored: 0.18 }, goals: total(30) },

  // L35 "Shifting lights": chameleons everywhere.
  { id: 35, laneCount: 3, colCount: 3, colors: ['Orange', 'Purple', 'Green', 'Yellow'], worldConfig: W(0.63),
    duration: 100, spawnBudget: 21, laneTargetCarCount: 2, gridRows: 8,
    traits: { chameleon: 0.22 }, goals: total(30) },

  // L36 "Titans": big rigs and tanks.
  { id: 36, laneCount: 3, colCount: 3, colors: ['Orange', 'Red', 'Purple', 'Blue'], worldConfig: W(0.63),
    duration: 110, spawnBudget: 22, laneTargetCarCount: 2, gridRows: 8,
    traits: { armored: 0.10 },
    goals: total(26) },

  // L37 "Last exit" (relief).
  { id: 37, laneCount: 3, colCount: 3, colors: ['Orange', 'Yellow', 'Blue', 'Green'], worldConfig: W(0.57),
    duration: 100, spawnBudget: 22, laneTargetCarCount: 2, gridRows: 8,
    traits: { speeder: 0.08, armored: 0.08 }, goals: total(28) },

  // L38 "Everything": every special car, three to a lane.
  { id: 38, laneCount: 3, colCount: 3, colors: ['Orange', 'Red', 'Green', 'Purple'], worldConfig: W(0.50),
    duration: 110, spawnBudget: 23, laneTargetCarCount: 2, gridRows: 8,
    traits: { speeder: 0.10, armored: 0.10, chameleon: 0.10 }, goals: total(32) },

  // L39 "Final approach": heavy and mixed.
  { id: 39, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Yellow', 'Orange'], worldConfig: W(0.48),
    duration: 110, spawnBudget: 23, laneTargetCarCount: 2, gridRows: 8,
    traits: { speeder: 0.12, armored: 0.12, chameleon: 0.12 }, goals: total(34) },

  // L40 BOSS "Twin Titans": two bosses, one armoured, with only the middle lane
  // of ordinary traffic between them. They move a row every 3 turns.
  { id: 40, laneCount: 3, colCount: 3, colors: ['Red', 'Blue', 'Yellow', 'Orange'], worldConfig: W(0.50),
    duration: 120, spawnBudget: 24, laneTargetCarCount: 2, gridRows: 8,
    traits: { speeder: 0.12, chameleon: 0.12 },
    hintText: 'FINAL BOSS! Two titans — keep both in check',
    initialCars: [...open(1),
      { lane: 0, row: 1, sequence: ['Orange', 'Red', 'Blue', 'Yellow', 'Orange', 'Red'], moveEvery: 3 },
      { lane: 2, row: 1, sequence: ['Blue', 'Yellow', 'Orange', 'Red', 'Blue'], moveEvery: 3, reArmor: true }],
    goals: [{ type: 'defeatBoss', count: 2 }] },
];

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
const OPENING_ROWS_SHALLOW   = [0, 1];

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
// V2 Hot Streak is live from this level on (L1-L3 teach the basics first).
// A level may override with `streak: true|false`. Daily/generic configs: on.
// THE single source — GameApp and SimulationRunner both call this.
export const STREAK_FROM_LEVEL = 4;
export function streakEnabledFor(cfg) {
  if (typeof cfg?.streak === 'boolean') return cfg.streak;
  return typeof cfg?.id === 'number' ? cfg.id >= STREAK_FROM_LEVEL : true;
}

export function openingRowsForLevel(id, gridRows = 16) {
  // Generic/world-based configs (no numeric level id) and the daily challenge use a
  // light single-car opening — they probe the director engine, not a level's opening
  // density. Every real numbered level uses the uniform opening.
  if (typeof id !== 'number') return [2];
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
    if (mod.speedFactor === 1.0 && mod.hpFactor === 1.0) return cfg;

    return {
      ...cfg,
      worldConfig: {
        hpMultiplier: cfg.worldConfig.hpMultiplier * mod.hpFactor,
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

  get world() { return this.current.id <= 20 ? 1 : 2; }

  get totalLevels() { return PROGRESSION.length; }

  getLevelsForWorld(worldNum) {
    const start = (worldNum - 1) * 20 + 1;
    const end   = worldNum * 20;
    return PROGRESSION.filter(cfg => cfg.id >= start && cfg.id <= end);
  }

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


