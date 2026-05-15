// LevelManager — 40-level progression aligned with VISION.md.
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
//   L10       Red + Blue (bench-test puzzle — intentionally stripped)
//   L11-L20   Red + Blue + Green
//   L21-L24   Red + Blue + Green + Yellow  (Yellow intro at L21 relief)
//   L25-L30   + Purple (Color Overload boss at L25)
//   L31-L40   + Orange (all 6 colors; World 3 opens at L31)
//
// Feature unlock thresholds (GameApp reads these from progress):
//   bench   L6+
//   swap    L9+
//   peek    L12+
//   freeze  L14+

import { WORLD_CONFIG } from '../director/DirectorConfig.js';

// ── Shared difficulty presets ─────────────────────────────────────────────────

// Block 1: Tutorial City — morning theme (L1–8)
const B1_FTUE = { hpMultiplier: 0.50, speed: { base: 3.0, variance: 0.0 } };
const B1_MED  = { hpMultiplier: 0.55, speed: { base: 3.5, variance: 0.2 } };
const B1_HARD = { hpMultiplier: 0.75, speed: { base: 4.2, variance: 0.3 } };
const B1_REL  = { hpMultiplier: 0.55, speed: { base: 3.5, variance: 0.2 } };
const B1_MED2 = { hpMultiplier: 0.68, speed: { base: 4.0, variance: 0.3 } };
const B1_HARD2= { hpMultiplier: 0.82, speed: { base: 4.5, variance: 0.4 } };
const B1_BH   = { hpMultiplier: 0.92, speed: { base: 4.8, variance: 0.4 } };

// Block 2: Tutorial City — afternoon/sunset themes (L9–16)
const B2_EASY = { hpMultiplier: 0.75, speed: { base: 4.0, variance: 0.4 } };
const B2_MED  = { hpMultiplier: 0.88, speed: { base: 4.6, variance: 0.5 } };
const B2_HARD = { hpMultiplier: 1.05, speed: { base: 5.0, variance: 0.5 } };
const B2_REL  = { hpMultiplier: 0.72, speed: { base: 4.2, variance: 0.4 } };
const B2_MED2 = { hpMultiplier: 0.95, speed: { base: 5.0, variance: 0.5 } };
const B2_BH   = { hpMultiplier: 1.15, speed: { base: 5.5, variance: 0.5 } };

// Block 3: Misty → Industrial transition (L17–24)
const B3_DISC = { hpMultiplier: 1.00, speed: { base: 5.0, variance: 0.3 } }; // L17 streak discovery
const B3_EASY = { hpMultiplier: 0.80, speed: { base: 4.5, variance: 0.4 } };
const B3_MED  = { hpMultiplier: 1.00, speed: { base: 5.0, variance: 0.5 } };
const B3_MED2 = { hpMultiplier: 1.05, speed: { base: 5.2, variance: 0.5 } };
const B3_REL  = { hpMultiplier: 0.78, speed: { base: 4.5, variance: 0.4 } };
const B3_MED3 = { hpMultiplier: 1.02, speed: { base: 5.2, variance: 0.5 } };
const B3_HARD = { hpMultiplier: 1.18, speed: { base: 5.6, variance: 0.5 } };
const B3_BH   = { hpMultiplier: 1.28, speed: { base: 5.8, variance: 0.6 } };

// Block 4: Industrial Zone (L25–32)
const B4_MED  = { hpMultiplier: 1.12, speed: { base: 5.4, variance: 0.5 } };
const B4_MED2 = { hpMultiplier: 1.18, speed: { base: 5.6, variance: 0.5 } };
const B4_HARD = { hpMultiplier: 1.28, speed: { base: 6.0, variance: 0.6 } };
const B4_REL  = { hpMultiplier: 0.88, speed: { base: 5.2, variance: 0.5 } };
const B4_HARD2= { hpMultiplier: 1.38, speed: { base: 6.2, variance: 0.6 } };
const B4_BH   = { hpMultiplier: 1.42, speed: { base: 6.5, variance: 0.7 } };

// Block 5: Night Highway (L33–40)
const B5_EASY = { hpMultiplier: 0.90, speed: { base: 5.8, variance: 0.5 } };
const B5_MED  = { hpMultiplier: 1.22, speed: { base: 6.2, variance: 0.6 } };
const B5_HARD = { hpMultiplier: 1.42, speed: { base: 6.8, variance: 0.7 } };
const B5_REL  = { hpMultiplier: 0.95, speed: { base: 6.2, variance: 0.6 } };
const B5_MED2 = { hpMultiplier: 1.35, speed: { base: 6.8, variance: 0.7 } };
const B5_HARD2= { hpMultiplier: 1.45, speed: { base: 7.2, variance: 0.7 } };

// ── Realistic player balance presets (Phase 3) ───────────────────────────────
// Calibrated so an average player (82% accuracy, 3 s cycle delay) achieves:
//   Easy: 75–92%, Medium: 50–72%, Hard: 28–50%, Boss-Hard: 15–32%
// 5- and 6-color configs have lower speed/HP because the sim cannot model
// SWAP/BENCH/PEEK — actual in-game speeds should be higher after playtest.
const R_2C_EASY = { hpMultiplier: 1.00, speed: { base: 5.5, variance: 0.2 } }; // ~90% Easy
const R_2C_MED  = { hpMultiplier: 1.20, speed: { base: 6.5, variance: 0.3 } }; // ~57% Medium
const R_2C_HARD = { hpMultiplier: 1.80, speed: { base: 8.0, variance: 0.3 } }; // ~41% Hard
const R_3C_EASY = { hpMultiplier: 0.85, speed: { base: 4.5, variance: 0.4 } }; // ~85% Easy
const R_3C_MED  = { hpMultiplier: 1.10, speed: { base: 5.5, variance: 0.4 } }; // ~61% Medium
const R_3C_HARD = { hpMultiplier: 1.30, speed: { base: 6.5, variance: 0.5 } }; // ~33% Hard
const R_3C_BH   = { hpMultiplier: 1.80, speed: { base: 7.5, variance: 0.5 } }; // ~25% Boss-Hard
const R_L17     = { hpMultiplier: 0.60, speed: { base: 3.8, variance: 0.3 } }; // ~85% Easy (BigRig-heavy)
const R_4C_EASY = { hpMultiplier: 0.76, speed: { base: 3.8, variance: 0.4 } }; // ~89% Easy
const R_4C_MED  = { hpMultiplier: 0.92, speed: { base: 4.5, variance: 0.5 } }; // ~63% Medium
// R_4C_HARD and R_4C_BH: use B3_HARD and B3_BH — already in target band.
const R_5C_EASY = { hpMultiplier: 0.75, speed: { base: 3.5, variance: 0.5 } }; // ~85% Easy
const R_5C_MED  = { hpMultiplier: 0.88, speed: { base: 4.0, variance: 0.5 } }; // ~67% Medium
const R_5C_HARD = { hpMultiplier: 1.00, speed: { base: 4.5, variance: 0.5 } }; // ~47% Hard
const R_6C_EASY = { hpMultiplier: 0.70, speed: { base: 3.0, variance: 0.4 } }; // ~87% Easy
const R_6C_MED  = { hpMultiplier: 0.78, speed: { base: 3.5, variance: 0.5 } }; // ~67% Medium
const R_6C_HARD = { hpMultiplier: 0.90, speed: { base: 4.0, variance: 0.5 } }; // ~44% Hard
const R_6C_BH   = { hpMultiplier: 0.95, speed: { base: 4.5, variance: 0.6 } }; // ~26% Boss-Hard
// Duration-specific variants (100 s levels have more pressure than 90 s calibration).
const R_2C_EASY_100 = { hpMultiplier: 0.90, speed: { base: 4.5, variance: 0.2 } }; // ~90% Easy, 100s
const R_2C_MED_100  = { hpMultiplier: 1.00, speed: { base: 5.5, variance: 0.3 } }; // ~63% Medium, 100s
const R_L17_V2      = { hpMultiplier: 0.75, speed: { base: 4.0, variance: 0.3 } }; // ~90% Easy, L17 BigRig
const R_6C_BH_LONG  = { hpMultiplier: 0.85, speed: { base: 4.0, variance: 0.6 } }; // ~24% BH, 120s finale
// L2 is 2-lane/2-col in-game but the sim always uses 4 lanes/4 cols, giving 2× extra
// firepower vs real. Compensate with higher speed/HP so the sim is harder.
const R_L2          = { hpMultiplier: 1.50, speed: { base: 7.5, variance: 0.3 } }; // ~67% Medium, L2 2-col sim bias

// ── Level progression (all 40) ────────────────────────────────────────────────

const PROGRESSION = [

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCK 1 — L1-L8 | Tutorial City | Morning theme
  // Pattern: Easy / Medium / Medium / Hard / Relief / Medium / Hard / Boss-Hard
  // ═══════════════════════════════════════════════════════════════════════════

  // L1 Easy — "Learn to shoot": 1 lane, 1 col, Red only. Near-impossible to lose.
  { id: 1, laneCount: 1, colCount: 1, colors: ['Red'],
    worldConfig: B1_FTUE, duration: 60, targetKills: 5, spawnBudget: 5,
    laneTargetCarCount: 2, showArrow: true,
    hintText: 'Drag the matching shooter to the lane',
    initialCars: [{ row: 4, type: 'small' }, { row: 2, type: 'small' }, { row: 0, type: 'small' }] },

  // L2 Medium — "Color matching": 2 lanes, Red+Blue. Learn color mismatch cost.
  { id: 2, laneCount: 2, colCount: 2, colors: ['Red', 'Blue'],
    worldConfig: R_L2, duration: 70, spawnBudget: 10, laneTargetCarCount: 2,
    showArrow: false, hintText: 'Color must match! Wrong color = no damage' },

  // L3 Medium — "Third lane": 3 lanes, same 2 colors. Multi-lane management.
  { id: 3, laneCount: 3, colCount: 3, colors: ['Red', 'Blue'],
    worldConfig: R_2C_MED, duration: 90, spawnBudget: 12, laneTargetCarCount: 2,
    showArrow: false, hintText: null, showAreaLabels: true },

  // L4 Hard — "Full board": 4 lanes, Red+Blue. First real pressure.
  { id: 4, laneCount: 4, colCount: 4, colors: ['Red', 'Blue'],
    worldConfig: R_2C_HARD, duration: 90, spawnBudget: 14, laneTargetCarCount: 2,
    showArrow: false, hintText: null },

  // L5 Easy (Relief) — "Breathe": 4 lanes, R+B, lower pressure. Sets up bench need.
  { id: 5, laneCount: 4, colCount: 4, colors: ['Red', 'Blue'],
    worldConfig: R_2C_EASY_100, duration: 100, spawnBudget: 12, laneTargetCarCount: 2,
    showArrow: false, hintText: null },

  // L6 Medium — "Bench unlocks": first time bench is available. R+B still.
  { id: 6, laneCount: 4, colCount: 4, colors: ['Red', 'Blue'],
    worldConfig: R_2C_MED_100, duration: 100, spawnBudget: 14, laneTargetCarCount: 2,
    showArrow: false, hintText: 'NEW! Bench — store a shooter to use later' },

  // L7 Hard — "Green arrives": 3 colors for the first time. Pattern reset.
  { id: 7, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_3C_HARD, duration: 100, spawnBudget: 14, laneTargetCarCount: 2,
    showArrow: false, hintText: 'NEW! Green shooters — 3 colors to manage now' },

  // L8 Boss-Hard — "Green boss": all 4 lanes, 3 colors, full density. Rescue moment.
  { id: 8, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_3C_BH, duration: 90, spawnBudget: 16, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCK 2 — L9-L16 | Tutorial City | Afternoon / Sunset themes
  // Pattern: Easy / Medium(Boss) / Medium / Hard / Relief / Medium / Hard(Boss) / Boss-Hard
  // ═══════════════════════════════════════════════════════════════════════════

  // L9 Easy (Relief) — "Recovery": R+B+G, gentle re-entry. SWAP booster unlocks.
  { id: 9, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: B2_EASY, duration: 100, spawnBudget: 14, laneTargetCarCount: 2,
    showArrow: false, hintText: 'NEW! SWAP booster — exchange two column colors' },

  // L10 Medium — BOSS "The Bench Test": R+B only (puzzle). Dense 3 cars/lane.
  // Design: column queue drifts heavily toward one color. Bench is the only escape.
  // High HP multiplier makes shooting through mismatches impossible.
  { id: 10, laneCount: 4, colCount: 4, colors: ['Red', 'Blue'],
    worldConfig: R_2C_MED_100,
    duration: 100, spawnBudget: 18, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // L11 Medium — "Back to three": R+B+G returns. BigRig introduced.
  { id: 11, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_3C_MED, duration: 100, spawnBudget: 16, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // L12 Hard — "BigRig pressure": heavy cars, tight timing. PEEK booster unlocks.
  { id: 12, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_3C_HARD, duration: 95, spawnBudget: 18, laneTargetCarCount: 3,
    showArrow: false, hintText: 'NEW! PEEK booster — reveal upcoming shooter colors' },

  // L13 Easy (Relief) — "Breather": R+B+G, light pressure after L12 spike.
  { id: 13, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: B2_REL, duration: 100, spawnBudget: 14, laneTargetCarCount: 2,
    showArrow: false, hintText: null },

  // L14 Medium — "FREEZE intro": FREEZE booster unlocks. Level designed around it.
  { id: 14, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_3C_MED, duration: 100, spawnBudget: 18, laneTargetCarCount: 3,
    showArrow: false, hintText: 'NEW! FREEZE booster — next 3 shots don\'t advance cars! (2 free)' },

  // L15 Hard — BOSS "Meet the Tank": first tank spawn. hp is softer to let player
  // experience the tank without insta-losing. Speed slow = time to plan shots.
  { id: 15, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_3C_HARD,
    duration: 100, spawnBudget: 18, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // L16 Boss-Hard — "Intensity spike": full R+B+G, fast, dense. World 1 climax.
  { id: 16, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_3C_BH, duration: 90, spawnBudget: 20, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCK 3 — L17-L24 | Misty → Industrial themes
  // Pattern: Easy / Medium / Medium / Hard(Boss) / Relief / Medium / Hard / Boss-Hard
  // Streak Shot discovered naturally at L17 (level designed to reward it).
  // ═══════════════════════════════════════════════════════════════════════════

  // L17 Easy (Relief) — "Streak discovery": R+B+G only (3 colors, simple palette).
  // BigRig-heavy spawn ensures the player needs multiple hits per car → builds
  // streak naturally. hpMultiplier=1.0, speed=5.0 so BigRigs feel weighty but
  // not panicky. No tanks — discovery should feel rewarding, not punishing.
  { id: 17, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_L17_V2, duration: 100, spawnBudget: 22, laneTargetCarCount: 2,
    showArrow: false, hintText: null },

  // L18 Medium — "Streak mastery": R+B+G, moderate. Designed for combo building.
  { id: 18, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_3C_MED, duration: 100, spawnBudget: 18, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // L19 Medium — "Pre-surge": R+B+G, budget tightens. Freeze becomes essential.
  { id: 19, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: B3_MED2, duration: 100, spawnBudget: 20, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // L20 Hard — BOSS "The Surge": R+B+G, massive spawn budget, max lane density.
  // Design: wave after wave — player must survive constant pressure without pause.
  // Freeze booster is the key tool.
  { id: 20, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_3C_HARD,
    duration: 100, spawnBudget: 28, laneTargetCarCount: 4,
    showArrow: false, hintText: null },

  // L21 Easy (Relief) — "Yellow arrives": 4 colors. Light pressure after L20.
  { id: 21, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow'],
    worldConfig: R_4C_EASY, duration: 100, spawnBudget: 16, laneTargetCarCount: 2,
    showArrow: false, hintText: 'NEW! Yellow shooters — 4 colors now' },

  // L22 Medium — "Four-color flow": Yellow integrated, building confidence.
  { id: 22, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow'],
    worldConfig: R_4C_MED, duration: 100, spawnBudget: 18, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // L23 Hard — "Four-color pressure": tight budget, tank appearances.
  { id: 23, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow'],
    worldConfig: B3_HARD, duration: 95, spawnBudget: 20, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // L24 Boss-Hard — "Industrial gate": R+B+G+Y at full intensity. Industrial theme unlocks.
  { id: 24, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow'],
    worldConfig: B3_BH, duration: 90, spawnBudget: 22, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCK 4 — L25-L32 | Industrial Zone (steel grey, orange hazard lights)
  // Pattern: Easy(Boss) / Medium / Medium / Hard / Relief / Medium(Boss) / Hard / Boss-Hard
  // ═══════════════════════════════════════════════════════════════════════════

  // L25 Easy — BOSS "Color Overload": 5 colors on 4 columns. Purple arrives.
  // Design: player always has ≥1 unmatched column. SWAP and bench become vital.
  // hp is soft (1.0) but the 5th color creates constant mismatch pressure.
  { id: 25, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'],
    worldConfig: R_5C_EASY,
    duration: 100, spawnBudget: 22, laneTargetCarCount: 3,
    showArrow: false, hintText: 'NEW! Purple — 5 colors, 4 columns. Master SWAP.' },

  // L26 Medium — "Purple integrated": 5 colors, building muscle memory.
  { id: 26, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'],
    worldConfig: R_5C_MED, duration: 100, spawnBudget: 22, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // L27 Medium — "Five-color rhythm": medium ramp, streak shot rewards here.
  { id: 27, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'],
    worldConfig: R_5C_MED, duration: 100, spawnBudget: 22, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // L28 Hard — "Industrial grind": fast + tanky. Trucks and BigRigs dominate.
  { id: 28, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'],
    worldConfig: R_5C_HARD, duration: 90, spawnBudget: 24, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // L29 Easy (Relief) — "Midpoint reset": soft pressure before L30 boss.
  { id: 29, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'],
    worldConfig: R_5C_EASY, duration: 100, spawnBudget: 18, laneTargetCarCount: 2,
    showArrow: false, hintText: null },

  // L30 Medium — BOSS "Industrial Finale": 5 colors, tank-heavy spawn mix.
  // Design: tanks make up ~40% of spawns. Player must plan multi-shot sequences.
  { id: 30, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'],
    worldConfig: R_5C_MED,
    duration: 100, spawnBudget: 28, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // L31 Hard — "Night Highway opens": all 6 colors. Orange arrives with W3 theme.
  // Hardest level with Orange introduction (never intro on an easy level).
  { id: 31, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_HARD, duration: 90, spawnBudget: 26, laneTargetCarCount: 3,
    showArrow: false, hintText: 'NEW! Orange — all 6 colors, Night Highway begins' },

  // L32 Boss-Hard — "Highway storm": 6 colors, brutal. World 2 rescue moment.
  { id: 32, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_BH, duration: 85, spawnBudget: 28, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCK 5 — L33-L40 | Night Highway (dark sky, neon lights)
  // Pattern: Easy / Medium / Medium(Boss) / Hard / Relief / Medium / Hard / Boss-Hard(Boss)
  // ═══════════════════════════════════════════════════════════════════════════

  // L33 Easy (Relief) — "Nightfall": 6 colors, much lower pressure. Eyes adjust to theme.
  { id: 33, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_EASY, duration: 100, spawnBudget: 22, laneTargetCarCount: 2,
    showArrow: false, hintText: null },

  // L34 Medium — "Highway patrol": 6 colors, steady ramp. Combos are optimal here.
  { id: 34, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_MED, duration: 95, spawnBudget: 24, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // L35 Medium — BOSS "Night Rush": all 6 colors, INSANE speed, LOW hp.
  // Design: cars die in 1-2 shots but advance every second. React instantly or breach.
  // Speed boss — the designed challenge is reflex, not planning.
  { id: 35, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_MED,
    duration: 90, spawnBudget: 30, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // L36 Hard — "Neon siege": 6 colors, high hp, sustained pressure.
  { id: 36, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_HARD, duration: 90, spawnBudget: 28, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // L37 Easy (Relief) — "Last breath": gentler wave before the final gauntlet.
  { id: 37, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_EASY, duration: 100, spawnBudget: 22, laneTargetCarCount: 2,
    showArrow: false, hintText: null },

  // L38 Medium — "Storm warning": all types, all colors, fast ramp.
  { id: 38, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_MED, duration: 90, spawnBudget: 28, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // L39 Hard — "Pre-finale": everything the player has learned. No mercy.
  { id: 39, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_HARD, duration: 85, spawnBudget: 30, laneTargetCarCount: 3,
    showArrow: false, hintText: null },

  // L40 Boss-Hard — BOSS "Grandmaster Finale": all 6 colors, all car types.
  // Design: budget 35 across 4 lanes, max density. Every mechanic must be used.
  // The intended solution: streak combos to kill tanks, freeze during surge waves,
  // SWAP when columns lock, bomb on tank clusters.
  { id: 40, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_BH_LONG,
    duration: 120, spawnBudget: 35, laneTargetCarCount: 4,
    showArrow: false, hintText: null },
];

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
