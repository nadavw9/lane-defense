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

import { WORLD_CONFIG } from '../director/DirectorConfig.js';

// â”€â”€ Shared difficulty presets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Block 1: Tutorial City â€” morning theme (L1â€“8)
const B1_FTUE = { hpMultiplier: 0.30, speed: { base: 3.0, variance: 0.0 } };
const B1_MED  = { hpMultiplier: 0.33, speed: { base: 3.5, variance: 0.2 } };
const B1_HARD = { hpMultiplier: 0.45, speed: { base: 4.2, variance: 0.3 } };
const B1_REL  = { hpMultiplier: 0.33, speed: { base: 3.5, variance: 0.2 } };
const B1_MED2 = { hpMultiplier: 0.41, speed: { base: 4.0, variance: 0.3 } };
const B1_HARD2= { hpMultiplier: 0.49, speed: { base: 4.5, variance: 0.4 } };
const B1_BH   = { hpMultiplier: 0.55, speed: { base: 4.8, variance: 0.4 } };

// Block 2: Tutorial City â€” afternoon/sunset themes (L9â€“16)
const B2_EASY = { hpMultiplier: 0.45, speed: { base: 4.6, variance: 0.4 } }; // rebalanced for post-Batch-A road length
const B2_MED  = { hpMultiplier: 0.53, speed: { base: 4.6, variance: 0.5 } };
const B2_HARD = { hpMultiplier: 0.63, speed: { base: 5.0, variance: 0.5 } };
const B2_REL  = { hpMultiplier: 0.43, speed: { base: 4.2, variance: 0.4 } };
const B2_MED2 = { hpMultiplier: 0.57, speed: { base: 5.0, variance: 0.5 } };
const B2_BH   = { hpMultiplier: 0.69, speed: { base: 5.5, variance: 0.5 } };

// Block 3: Misty â†’ Industrial transition (L17â€“24)
const B3_DISC = { hpMultiplier: 0.60, speed: { base: 5.0, variance: 0.3 } }; // L17 color-bomb discovery
const B3_EASY = { hpMultiplier: 0.48, speed: { base: 4.5, variance: 0.4 } };
const B3_MED  = { hpMultiplier: 0.60, speed: { base: 5.0, variance: 0.5 } };
const B3_MED2 = { hpMultiplier: 0.63, speed: { base: 5.2, variance: 0.5 } };
const B3_REL  = { hpMultiplier: 0.47, speed: { base: 4.5, variance: 0.4 } };
const B3_MED3 = { hpMultiplier: 0.61, speed: { base: 5.2, variance: 0.5 } };
const B3_HARD = { hpMultiplier: 0.71, speed: { base: 5.6, variance: 0.5 } };
const B3_BH   = { hpMultiplier: 0.77, speed: { base: 5.8, variance: 0.6 } };
const B3_BH_L24 = { hpMultiplier: 0.69, speed: { base: 5.8, variance: 0.6 } }; // L24 only: Ã—0.9 balance

// Block 4: Industrial Zone (L25â€“32)
const B4_MED  = { hpMultiplier: 0.67, speed: { base: 5.4, variance: 0.5 } };
const B4_MED2 = { hpMultiplier: 0.71, speed: { base: 5.6, variance: 0.5 } };
const B4_HARD = { hpMultiplier: 0.77, speed: { base: 6.0, variance: 0.6 } };
const B4_REL  = { hpMultiplier: 0.53, speed: { base: 5.2, variance: 0.5 } };
const B4_HARD2= { hpMultiplier: 0.83, speed: { base: 6.2, variance: 0.6 } };
const B4_BH   = { hpMultiplier: 0.85, speed: { base: 6.5, variance: 0.7 } };

// Block 5: Night Highway (L33â€“40)
const B5_EASY = { hpMultiplier: 0.54, speed: { base: 5.8, variance: 0.5 } };
const B5_MED  = { hpMultiplier: 0.73, speed: { base: 6.2, variance: 0.6 } };
const B5_HARD = { hpMultiplier: 0.85, speed: { base: 6.8, variance: 0.7 } };
const B5_REL  = { hpMultiplier: 0.57, speed: { base: 6.2, variance: 0.6 } };
const B5_MED2 = { hpMultiplier: 0.81, speed: { base: 6.8, variance: 0.7 } };
const B5_HARD2= { hpMultiplier: 0.87, speed: { base: 7.2, variance: 0.7 } };

// â”€â”€ Realistic player balance presets (Phase 3) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Calibrated so an average player (82% accuracy, 3 s cycle delay) achieves:
//   Easy: 75â€“92%, Medium: 50â€“72%, Hard: 28â€“50%, Boss-Hard: 15â€“32%
// 5- and 6-color configs have lower speed/HP because the sim cannot model
// SWAP/BENCH â€” actual in-game speeds should be higher after playtest.
const R_2C_EASY = { hpMultiplier: 0.60, speed: { base: 5.5, variance: 0.2 } }; // ~90% Easy
const R_2C_MED  = { hpMultiplier: 0.72, speed: { base: 6.5, variance: 0.3 } }; // ~57% Medium
const R_2C_HARD = { hpMultiplier: 0.54, speed: { base: 8.0, variance: 0.3 } }; // L4 only: lowered 1.80→0.90 (outlier, same as L16 fix)
const R_3C_EASY = { hpMultiplier: 0.51, speed: { base: 4.5, variance: 0.4 } }; // ~85% Easy
const R_3C_MED  = { hpMultiplier: 0.66, speed: { base: 5.5, variance: 0.4 } }; // ~61% Medium
const R_3C_HARD = { hpMultiplier: 0.78, speed: { base: 6.5, variance: 0.5 } }; // ~33% Hard
const R_3C_BH   = { hpMultiplier: 1.08, speed: { base: 7.5, variance: 0.5 } }; // ~25% Boss-Hard
const R_3C_BH_L16 = { hpMultiplier: 0.72, speed: { base: 7.5, variance: 0.5 } }; // L16 only: lowered 1.62→1.20 (overcorrected with higher base HP)
const R_L17     = { hpMultiplier: 0.36, speed: { base: 3.8, variance: 0.3 } }; // ~85% Easy (BigRig-heavy)
const R_4C_EASY = { hpMultiplier: 0.46, speed: { base: 3.8, variance: 0.4 } }; // ~89% Easy
const R_4C_MED  = { hpMultiplier: 0.55, speed: { base: 4.5, variance: 0.5 } }; // ~63% Medium
// R_4C_HARD and R_4C_BH: use B3_HARD and B3_BH â€” already in target band.
const R_5C_EASY = { hpMultiplier: 0.45, speed: { base: 3.5, variance: 0.5 } }; // ~85% Easy
const R_5C_MED  = { hpMultiplier: 0.53, speed: { base: 4.0, variance: 0.5 } }; // ~67% Medium
const R_5C_HARD = { hpMultiplier: 0.60, speed: { base: 4.5, variance: 0.5 } }; // ~47% Hard
const R_6C_EASY = { hpMultiplier: 0.42, speed: { base: 3.0, variance: 0.4 } }; // ~87% Easy
const R_6C_MED  = { hpMultiplier: 0.47, speed: { base: 3.5, variance: 0.5 } }; // ~67% Medium
const R_6C_HARD = { hpMultiplier: 0.54, speed: { base: 4.0, variance: 0.5 } }; // ~44% Hard
const R_6C_BH   = { hpMultiplier: 0.57, speed: { base: 4.5, variance: 0.6 } }; // ~26% Boss-Hard
// Duration-specific variants (100 s levels have more pressure than 90 s calibration).
const R_2C_EASY_100 = { hpMultiplier: 0.54, speed: { base: 5.8, variance: 0.2 } }; // ~72% Easy, 100s (rebalanced for post-Batch-A road length)
const R_2C_MED_100  = { hpMultiplier: 0.60, speed: { base: 5.5, variance: 0.3 } }; // ~63% Medium, 100s
const R_L17_V2      = { hpMultiplier: 0.45, speed: { base: 4.0, variance: 0.3 } }; // ~90% Easy, L17 BigRig
const R_6C_BH_LONG  = { hpMultiplier: 0.51, speed: { base: 4.0, variance: 0.6 } }; // ~24% BH, 120s finale
// L2 is 2-lane/2-col in-game but the sim always uses 4 lanes/4 cols, giving 2Ã— extra
// firepower vs real. Compensate with higher speed/HP so the sim is harder.
const R_L2          = { hpMultiplier: 0.90, speed: { base: 7.5, variance: 0.3 } }; // ~67% Medium, L2 2-col sim bias

// â”€â”€ Level progression (all 40) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PROGRESSION = [

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // BLOCK 1 â€” L1-L8 | Tutorial City | Morning theme
  // Pattern: Easy / Medium / Medium / Hard / Relief / Medium / Hard / Boss-Hard
  // gridRows: 11 (max car hF=0.81 jeep/van, row_spacing=3.67, gap=0.43)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // L1 Easy â€” "Learn to shoot": 1 lane, 1 col, Red only. Near-impossible to lose.
  { id: 1, laneCount: 1, colCount: 1, colors: ['Red'],
    worldConfig: B1_FTUE, duration: 60, targetKills: 5, spawnBudget: 5,
    laneTargetCarCount: 1, gridRows: 16, showArrow: true,
    hintText: 'Drag the matching bomb to the lane' ,
    goals: [{"type":"destroyTotal","count":13}]},

  // L2 Medium â€” "Color matching": 2 lanes, Red+Blue. Learn color mismatch cost.
  { id: 2, laneCount: 2, colCount: 2, colors: ['Red', 'Blue'],
    worldConfig: R_L2, duration: 70, spawnBudget: 10, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: 'Color must match! Wrong color = no damage' ,
    goals: [{"type":"destroyTotal","count":25}]},

  // L3 Medium â€” "Third lane": 3 lanes, same 2 colors. Multi-lane management.
  { id: 3, laneCount: 3, colCount: 3, colors: ['Red', 'Blue'],
    worldConfig: R_2C_MED, duration: 90, spawnBudget: 12, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null, showAreaLabels: true,
    goals: [{"type":"destroyTotal","count":30}] },

  // L4 Hard â€” "Full board": 4 lanes, Red+Blue. First real pressure.
  { id: 4, laneCount: 4, colCount: 4, colors: ['Red', 'Blue'],
    worldConfig: R_2C_HARD, duration: 90, spawnBudget: 8, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyTotal","count":30}]},

  // L5 Easy (Relief) â€” "Breathe": 4 lanes, R+B, lower pressure. Sets up bench need.
  { id: 5, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_2C_EASY_100, duration: 100, spawnBudget: 13, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyTotal","count":33}]},

  // L6 Medium â€” "Bench unlocks": first time bench is available. R+B still.
  { id: 6, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_2C_MED_100, duration: 100, spawnBudget: 16, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: 'NEW! Bench — store a bomb to use later' ,
    goals: [{"type":"destroyColor","color":"Red","count":40}]},

  // L7 Hard â€” "Green arrives": 3 colors for the first time. Pattern reset.
  { id: 7, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_3C_HARD, duration: 100, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: 'NEW! Green bombs — 3 colors to manage now' ,
    goals: [{"type":"destroyColor","color":"Red","count":14},{"type":"destroyColor","color":"Blue","count":14}]},

  // L8 Boss-Hard â€” "Green boss": all 4 lanes, 3 colors, full density. Rescue moment.
  { id: 8, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_3C_BH, duration: 90, spawnBudget: 8, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Green","count":12},{"type":"destroyColor","color":"Red","count":12}]},

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // BLOCK 2 â€” L9-L16 | Tutorial City | Afternoon / Sunset themes
  // Pattern: Easy / Medium(Boss) / Medium / Hard / Relief / Medium / Hard(Boss) / Boss-Hard
  // L9-L10 gridRows: 11 (truck hF=0.98, row_spacing=4.4, gap=0.48)
  // L11-L16 gridRows: 11 (bigrig hF=1.26, row_spacing=5.5, gap=0.46)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // L9 Easy (Relief) â€” "Recovery": R+B+G, gentle re-entry. SWAP booster unlocks.
  { id: 9, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: B2_EASY, duration: 100, spawnBudget: 14, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: 'NEW! SWAP booster — exchange two column colors' ,
    goals: [{"type":"destroyColor","color":"Blue","count":18},{"type":"destroyColor","color":"Green","count":17}]},

  // L10 Medium â€” BOSS "The Bench Test": R+B only (puzzle). Dense 3 cars/lane.
  // Design: column queue drifts heavily toward one color. Bench is the only escape.
  // High HP multiplier makes shooting through mismatches impossible.
  { id: 10, laneCount: 4, colCount: 4, colors: ['Red', 'Blue'],
    worldConfig: R_2C_MED_100,
    duration: 100, spawnBudget: 17, laneTargetCarCount: 3, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Red","count":35},{"type":"destroyType","carType":"truck","count":11}]},

  // L11 Medium â€” "Back to three": R+B+G returns. BigRig introduced.
  { id: 11, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_3C_MED, duration: 100, spawnBudget: 10, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Red","count":13},{"type":"destroyColor","color":"Green","count":12}]},

  // L12 Hard â€” "BigRig pressure": heavy cars, tight timing.
  { id: 12, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_3C_HARD, duration: 95, spawnBudget: 9, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Blue","count":12},{"type":"destroyColor","color":"Green","count":11}]},

  // L13 Easy (Relief) â€” "Breather": R+B+G, light pressure after L12 spike.
  { id: 13, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: B2_REL, duration: 100, spawnBudget: 14, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Red","count":18},{"type":"destroyColor","color":"Blue","count":17}]},

  // L14 Medium â€” "FREEZE intro": FREEZE booster unlocks. Level designed around it.
  { id: 14, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_3C_MED, duration: 100, spawnBudget: 9, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: 'NEW! FREEZE booster — your next shot is free, no cars advance! (2 free)',
    goals: [{"type":"destroyColor","color":"Red","count":12},{"type":"destroyColor","color":"Blue","count":11}] },

  // L15 Hard â€” BOSS "Meet the Tank": first tank spawn. hp is softer to let player
  // experience the tank without insta-losing. Speed slow = time to plan shots.
  // Inline config: R_3C_HARD (speed=6.5) is too hard once real tank weights apply;
  // speed=5.0 gives ~46% skilled which is in the 35â€“55% target band.
  { id: 15, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: { hpMultiplier: 0.78, speed: { base: 5.0, variance: 0.5 } },
    duration: 100, spawnBudget: 7, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Green","count":8},{"type":"destroyColor","color":"Red","count":8}]},

  // L16 Boss-Hard â€” "Intensity spike": full R+B+G, fast, dense. World 1 climax.
  { id: 16, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_3C_BH_L16, duration: 90, spawnBudget: 6, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Red","count":10},{"type":"destroyColor","color":"Green","count":9}]},

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // BLOCK 3 â€” L17-L24 | Misty â†’ Industrial themes
  // Pattern: Easy / Medium / Medium / Hard(Boss) / Relief / Medium / Hard / Boss-Hard
  // Color-bomb discovered naturally at L17 (level designed to reward it).
  // gridRows: 11 (bigrig hF=1.26, row_spacing=5.5, gap=0.46)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // L17 Easy (Relief) â€” "Color-bomb discovery": R+B+G only (3 colors, simple palette).
  // BigRig-heavy spawn ensures the player needs multiple hits per car â†’ builds
  // combo naturally. hpMultiplier=1.0, speed=5.0 so BigRigs feel weighty but
  // not panicky. No tanks â€” discovery should feel rewarding, not punishing.
  { id: 17, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_L17_V2, duration: 100, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Blue","count":14},{"type":"destroyColor","color":"Green","count":14}]},

  // L18 Medium â€” "Combo mastery": R+B+G, moderate. Designed for combo building.
  { id: 18, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_3C_MED, duration: 100, spawnBudget: 8, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Red","count":12},{"type":"destroyColor","color":"Blue","count":12}]},

  // L19 Medium â€” "Pre-surge": R+B+G, budget tightens. Freeze becomes essential.
  { id: 19, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: B3_MED2, duration: 100, spawnBudget: 9, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Green","count":12},{"type":"destroyColor","color":"Blue","count":11}]},

  // L20 Hard â€” BOSS "The Surge": R+B+G, massive spawn budget, max lane density.
  // Design: wave after wave â€” player must survive constant pressure without pause.
  // Freeze booster is the key tool.
  { id: 20, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_3C_HARD,
    duration: 100, spawnBudget: 18, laneTargetCarCount: 3, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Red","count":8},{"type":"destroyType","carType":"truck","count":3}]},

  // L21 Easy (Relief) â€” "Yellow arrives": 4 colors. Light pressure after L20.
  { id: 21, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow'],
    worldConfig: R_4C_EASY, duration: 100, spawnBudget: 10, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: 'NEW! Yellow bombs — 4 colors now' ,
    goals: [{"type":"destroyColor","color":"Red","count":13},{"type":"destroyColor","color":"Yellow","count":12}]},

  // L22 Medium â€” "Four-color flow": Yellow integrated, building confidence.
  { id: 22, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow'],
    worldConfig: R_4C_MED, duration: 100, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Blue","count":15},{"type":"destroyColor","color":"Green","count":14}]},

  // L23 Hard â€” "Four-color pressure": tight budget, tank appearances.
  { id: 23, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow'],
    worldConfig: B3_HARD, duration: 95, spawnBudget: 8, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Yellow","count":5},{"type":"destroyColor","color":"Red","count":5}]},

  // L24 Boss-Hard â€” "Industrial gate": R+B+G+Y at full intensity. Industrial theme unlocks.
  { id: 24, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow'],
    worldConfig: B3_BH_L24, duration: 90, spawnBudget: 8, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Green","count":6},{"type":"destroyColor","color":"Blue","count":6}]},

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // BLOCK 4 â€” L25-L32 | Industrial Zone (steel grey, orange hazard lights)
  // Pattern: Easy(Boss) / Medium / Medium / Hard / Relief / Medium(Boss) / Hard / Boss-Hard
  // gridRows: 11 (bigrig hF=1.26, row_spacing=5.5, gap=0.46)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // L25 Easy â€” BOSS "Color Overload": 5 colors on 4 columns. Purple arrives.
  // Design: player always has â‰¥1 unmatched column. SWAP and bench become vital.
  // hp is soft (1.0) but the 5th color creates constant mismatch pressure.
  { id: 25, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'],
    worldConfig: R_5C_EASY,
    duration: 100, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: 'NEW! Purple — 5 colors, 4 columns. Master SWAP.',
    goals: [{"type":"destroyColor","color":"Red","count":9},{"type":"destroyColor","color":"Blue","count":9},{"type":"destroyColor","color":"Green","count":9}] },

  // L26 Medium â€” "Purple integrated": 5 colors, building muscle memory.
  { id: 26, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'],
    worldConfig: R_5C_MED, duration: 100, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Red","count":7},{"type":"destroyColor","color":"Purple","count":7},{"type":"destroyColor","color":"Yellow","count":6}]},

  // L27 Medium â€” "Five-color rhythm": medium ramp, combo play rewarded here.
  { id: 27, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'],
    worldConfig: R_5C_MED, duration: 100, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Purple","count":9},{"type":"destroyColor","color":"Green","count":9}]},

  // L28 Hard â€” "Industrial grind": fast + tanky. Trucks and BigRigs dominate.
  { id: 28, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'],
    worldConfig: R_5C_HARD, duration: 90, spawnBudget: 9, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Yellow","count":6},{"type":"destroyType","carType":"truck","count":5}]},

  // L29 Easy (Relief) â€” "Midpoint reset": soft pressure before L30 boss.
  { id: 29, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'],
    worldConfig: R_5C_EASY, duration: 100, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Red","count":11},{"type":"destroyColor","color":"Blue","count":11}]},

  // L30 Medium â€” BOSS "Industrial Finale": 5 colors, tank-heavy spawn mix.
  // Design: tanks make up ~40% of spawns. Player must plan multi-shot sequences.
  { id: 30, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'],
    worldConfig: R_5C_MED,
    duration: 100, spawnBudget: 20, laneTargetCarCount: 3, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Purple","count":6},{"type":"destroyType","carType":"bigrig","count":1}]},

  // L31 Hard â€” "Night Highway opens": all 6 colors. Orange arrives with W3 theme.
  // Hardest level with Orange introduction (never intro on an easy level).
  { id: 31, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_HARD, duration: 90, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: 'NEW! Orange — all 6 colors, Night Highway begins',
    goals: [{"type":"destroyColor","color":"Red","count":3},{"type":"destroyColor","color":"Green","count":3},{"type":"destroyType","carType":"bigrig","count":3}] },

  // L32 Boss-Hard â€” "Highway storm": 6 colors, brutal. World 2 rescue moment.
  { id: 32, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_BH, duration: 85, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Red","count":3},{"type":"destroyColor","color":"Orange","count":3},{"type":"destroyType","carType":"bigrig","count":3}]},

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // BLOCK 5 â€” L33-L40 | Night Highway (dark sky, neon lights)
  // Pattern: Easy / Medium / Medium(Boss) / Hard / Relief / Medium / Hard / Boss-Hard(Boss)
  // gridRows: 11 (bigrig hF=1.26, row_spacing=5.5, gap=0.46)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // L33 Easy (Relief) â€” "Nightfall": 6 colors, much lower pressure. Eyes adjust to theme.
  { id: 33, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_EASY, duration: 100, spawnBudget: 14, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Green","count":7},{"type":"destroyColor","color":"Purple","count":7}]},

  // L34 Medium â€” "Highway patrol": 6 colors, steady ramp. Combos are optimal here.
  { id: 34, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_MED, duration: 95, spawnBudget: 10, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Red","count":6},{"type":"destroyColor","color":"Orange","count":5}]},

  // L35 Medium â€” BOSS "Night Rush": all 6 colors, INSANE speed, LOW hp.
  // Design: cars die in 1-2 shots but advance every second. React instantly or breach.
  // Speed boss â€” the designed challenge is reflex, not planning.
  { id: 35, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_MED,
    duration: 90, spawnBudget: 10, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Blue","count":6},{"type":"destroyType","carType":"truck","count":5}]},

  // L36 Hard â€” "Neon siege": 6 colors, high hp, sustained pressure.
  { id: 36, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_HARD, duration: 90, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Yellow","count":3},{"type":"destroyColor","color":"Green","count":3},{"type":"destroyType","carType":"bigrig","count":3}]},

  // L37 Easy (Relief) â€” "Last breath": gentler wave before the final gauntlet.
  { id: 37, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_EASY, duration: 100, spawnBudget: 14, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Purple","count":8},{"type":"destroyColor","color":"Red","count":7}]},

  // L38 Medium â€” "Storm warning": all types, all colors, fast ramp.
  { id: 38, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_MED, duration: 90, spawnBudget: 10, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Orange","count":6},{"type":"destroyType","carType":"truck","count":4}]},

  // L39 Hard â€” "Pre-finale": everything the player has learned. No mercy.
  { id: 39, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_HARD, duration: 85, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Blue","count":3},{"type":"destroyColor","color":"Green","count":3},{"type":"destroyType","carType":"tank","count":3}]},

  // L40 Boss-Hard â€” BOSS "Grandmaster Finale": all 6 colors, all car types.
  // Design: budget 35 across 4 lanes, max density. Every mechanic must be used.
  // The intended solution: color-bomb combos to kill tanks, freeze during surge waves,
  // SWAP when columns lock, bomb on tank clusters.
  { id: 40, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: R_6C_BH_LONG,
    duration: 120, spawnBudget: 24, laneTargetCarCount: 3, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Red","count":5},{"type":"destroyType","carType":"bigrig","count":1},{"type":"destroyType","carType":"truck","count":2}]},
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
export function openingRowsForLevel(id) {
  // Generic/world-based configs (no numeric level id) and the daily challenge use a
  // light single-car opening — they probe the director engine, not a level's opening
  // density. Every real numbered level uses the uniform 3-car opening.
  if (typeof id !== 'number') return [2];
  return OPENING_ROWS;
}

// Count of opening cars per lane (= openingRowsForLevel(id).length). For tests.
export function openingCarsForLevel(id) {
  return openingRowsForLevel(id).length;
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


