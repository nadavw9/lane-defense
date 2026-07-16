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
const R_2C_MED_100  = { hpMultiplier: 0.60, speed: { base: 5.5, variance: 0.3 } }; // L6 (goals-only retune) â€” L10 un-shared 2026-07-15 (Â§3c boss)
// L2 is 2-lane/2-col in-game but the sim always uses 4 lanes/4 cols, giving 2Ã— extra
// firepower vs real. Compensate with higher speed/HP so the sim is harder.
const R_L2          = { hpMultiplier: 0.90, speed: { base: 7.5, variance: 0.3 } }; // L2 2-col sim bias

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
    worldConfig: { hpMultiplier: 0.90, speed: { base: 6.5, variance: 0.3 } }, // 2026-07-10 retune: 0.72→0.90, tutorial-exempt like L1/L2 — 3 lanes + 2 colors has no losing mechanism at brisk HP (~100% by design; transition marker is L4)
    duration: 90, spawnBudget: 12, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null, showAreaLabels: true,
    goals: [{"type":"destroyTotal","count":26}] },

  // L4 Hard â€” "Full board": 4 lanes, Red+Blue. First real pressure.
  { id: 4, laneCount: 4, colCount: 4, colors: ['Red', 'Blue'],
    worldConfig: { hpMultiplier: 0.90, speed: { base: 8.0, variance: 0.3 } }, // 2026-07-10 booster-aware retune: 0.54→0.90 + goal 30→26 (~92%; smalls stay 2-hit — tutorial→game transition level)
    duration: 90, spawnBudget: 8, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyTotal","count":26}]},

  // L5 Easy (Relief) â€” "Breathe": 4 lanes, R+B, lower pressure. Sets up bench need.
  { id: 5, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: { hpMultiplier: 0.86, speed: { base: 5.8, variance: 0.2 } }, // 2026-07-10 booster-aware retune: 0.54→0.86 (~92%)
    duration: 100, spawnBudget: 13, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyTotal","count":33}]},

  // L6 Medium â€” "Bench unlocks": first time bench is available. R+B still.
  { id: 6, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: R_2C_MED_100, duration: 100, spawnBudget: 16, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: 'NEW! Bench — store a bomb to use later' ,
    goals: [{"type":"destroyColor","color":"Red","count":22}]}, // 2026-07-10 retune: 40→22 (grind cut, 116→~65 turns; hp untouched)

  // L7 Hard â€” "Green arrives": 3 colors for the first time. Pattern reset.
  { id: 7, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: { hpMultiplier: 0.84, speed: { base: 6.5, variance: 0.5 } }, // 2026-07-10 booster-aware retune: 0.78→0.84 (~92%; un-shared from R_3C_HARD)
    duration: 100, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: 'NEW! Green bombs — 3 colors to manage now' ,
    goals: [{"type":"destroyColor","color":"Red","count":14},{"type":"destroyColor","color":"Blue","count":14}]},

  // L8 Boss-Hard â€” "Green boss": all 4 lanes, 3 colors, full density. Rescue moment.
  { id: 8, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: { hpMultiplier: 0.86, speed: { base: 7.5, variance: 0.5 } }, // 2026-07-10 booster-aware retune: 1.08→0.86 (~93%; was sole too-hard, pre-fix overcomp)
    duration: 90, spawnBudget: 8, laneTargetCarCount: 2, gridRows: 16,
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

  // L10 Medium â€” BOSS "The Bench Test" (Â§3c v2): the goal demands REDS but the
  // bomb SUPPLY is biased 3:1 toward Blue (shooterColorWeights), so red bombs
  // are the scarce resource â€” the player must BENCH blue tops to dig the queue
  // for reds instead of wasting them, and hold reds for truck lanes. v1's
  // board-side cluster (lanes 0/2 Blue, 1/3 Red openings) is kept for opening
  // tension, but playtest proved a 2-color BOARD can't lock (any bomb color
  // almost always has a matching front) â€” the lock must live in the QUEUE.
  // Fairness floors stay on: _overdueColor + FR-1/FR-5 guarantee red bombs
  // keep trickling â€” scarcity, never starvation.
  // What NOT to touch: R+B only (the whole puzzle is the 2-color lock); do
  // not add Green; do not lower density below 3/lane; keep destroyType:truck.
  { id: 10, laneCount: 4, colCount: 4, colors: ['Red', 'Blue'],
    worldConfig: { hpMultiplier: 0.60, speed: { base: 5.5, variance: 0.3 } }, // 2026-07-15 Â§3c boss: un-shared from R_2C_MED_100 for independent boss tuning
    duration: 100, spawnBudget: 17, laneTargetCarCount: 3, gridRows: 16,
    showArrow: false, hintText: null ,
    shooterColorWeights: { Blue: 3, Red: 1 },   // 2026-07-16 Â§3c v2: supply-side lock
    initialCars: [
      { lane: 0, row: 0, color: 'Blue' }, { lane: 0, row: 1, color: 'Blue' }, { lane: 0, row: 2, color: 'Blue' },
      { lane: 1, row: 0, color: 'Red'  }, { lane: 1, row: 1, color: 'Red'  }, { lane: 1, row: 2, color: 'Red'  },
      { lane: 2, row: 0, color: 'Blue' }, { lane: 2, row: 1, color: 'Blue' }, { lane: 2, row: 2, color: 'Blue' },
      { lane: 3, row: 0, color: 'Red'  }, { lane: 3, row: 1, color: 'Red'  }, { lane: 3, row: 2, color: 'Red'  },
    ],
    goals: [{"type":"destroyColor","color":"Red","count":35},{"type":"destroyType","carType":"truck","count":11}]},

  // L11 Medium â€” "Back to three": R+B+G returns. BigRig introduced.
  { id: 11, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: { hpMultiplier: 0.89, speed: { base: 5.5, variance: 0.4 } }, // 2026-07-10 booster-aware retune: 0.66→0.89 (~77%; un-shared from R_3C_MED)
    duration: 100, spawnBudget: 10, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Red","count":13},{"type":"destroyColor","color":"Green","count":12}]},

  // L12 Hard â€” "BigRig pressure": heavy cars, tight timing.
  { id: 12, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: { hpMultiplier: 0.81, speed: { base: 6.5, variance: 0.5 } }, // 2026-07-10 parity-fixed retune: 0.90→0.81 (~75%)
    duration: 95, spawnBudget: 9, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Blue","count":12},{"type":"destroyColor","color":"Green","count":11}]},

  // L13 Easy (Relief) â€” "Breather": R+B+G, light pressure after L12 spike.
  { id: 13, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: { hpMultiplier: 0.58, speed: { base: 4.2, variance: 0.4 } }, // 2026-07-10 parity-fixed retune: 0.72→0.58 (~80%)
    duration: 100, spawnBudget: 14, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Red","count":18},{"type":"destroyColor","color":"Blue","count":17}]},

  // L14 Medium â€” "FREEZE intro": FREEZE booster unlocks. Level designed around it.
  { id: 14, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: { hpMultiplier: 0.65, speed: { base: 5.5, variance: 0.4 } }, // 2026-07-10 parity-fixed retune: 0.86→0.65 (~77%)
    duration: 100, spawnBudget: 9, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: 'NEW! FREEZE booster — your next shot is free, no cars advance! (2 free)',
    goals: [{"type":"destroyColor","color":"Red","count":12},{"type":"destroyColor","color":"Blue","count":11}] },

  // L15 Hard â€” BOSS "Meet the Tank": first tank spawn. hp is softer to let player
  // experience the tank without insta-losing. Speed slow = time to plan shots.
  // Inline config: R_3C_HARD (speed=6.5) is too hard once real tank weights apply;
  // speed=5.0 gives ~46% skilled which is in the 35â€“55% target band.
  { id: 15, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: { hpMultiplier: 0.62, speed: { base: 5.0, variance: 0.5 } }, // 2026-07-10 parity-fixed retune: 0.78→0.62 (~76%)
    duration: 100, spawnBudget: 7, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Green","count":8},{"type":"destroyColor","color":"Red","count":8}]},

  // L16 Boss-Hard â€” "Intensity spike": full R+B+G, fast, dense. World 1 climax.
  { id: 16, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: { hpMultiplier: 0.51, speed: { base: 7.5, variance: 0.5 } }, // 2026-07-10 parity-fixed retune: 0.72→0.51 (~76%; un-shared from R_3C_BH_L16)
    duration: 90, spawnBudget: 6, laneTargetCarCount: 2, gridRows: 16,
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
    worldConfig: { hpMultiplier: 0.46, speed: { base: 4.0, variance: 0.3 } }, // 2026-07-10 parity-fixed retune: 0.66→0.46 (~82%)
    duration: 100, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Blue","count":14},{"type":"destroyColor","color":"Green","count":14}]},

  // L18 Medium â€” "Combo mastery": R+B+G, moderate. Designed for combo building.
  { id: 18, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: { hpMultiplier: 0.48, speed: { base: 5.5, variance: 0.4 } }, // 2026-07-10 parity-fixed retune: 0.69→0.48 (~81%)
    duration: 100, spawnBudget: 8, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Red","count":12},{"type":"destroyColor","color":"Blue","count":12}]},

  // L19 Medium â€” "Pre-surge": R+B+G, budget tightens. Freeze becomes essential.
  { id: 19, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: { hpMultiplier: 0.48, speed: { base: 5.2, variance: 0.5 } }, // 2026-07-10 parity-fixed retune: 0.69→0.48 (~81%)
    duration: 100, spawnBudget: 9, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Green","count":12},{"type":"destroyColor","color":"Blue","count":11}]},

  // L20 Hard â€” BOSS "The Surge" (Â§3c, INFRA-C): spawnScript pulses the lane-fill
  // RATE between crest (3, relentless full density) and lull (1, brief breather) â€”
  // 4 crests / 3 lulls across kill-progress. The player can't clear steadily
  // through a crest; they must FREEZE on one to buy a free turn and reset. Type
  // weights are untouched (no `weights` field per stage â€” stays bandWeights R+B+G);
  // the surge is about rate, not color load. What NOT to touch: keep 3 colors
  // (adding a 4th changes the identity); don't raise base speed into reflex
  // territory â€” L20 is pressure-management, L35 is the reflex level.
  // FREEZE ASYMMETRY (2026-07-15): hpMultiplier 0.90 is higher than neighbours
  // because the naive sim clears the surges WITHOUT using freeze (62.6% at 0.78).
  // Freeze-on-a-crest is L20's designed solution, so real players who use it may
  // find L20 easier than the 44.2% sim figure suggests. If device playtest reads
  // too easy, that's the expected direction â€” retune down rather than assuming
  // the sim is wrong.
  { id: 20, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green'],
    worldConfig: { hpMultiplier: 0.90, speed: { base: 6.5, variance: 0.5 } }, // 2026-07-15 Â§3c boss: 0.78â†’0.90 (sim-verified; un-shared from R_3C_HARD, was L20-only already)
    duration: 100, spawnBudget: 18, laneTargetCarCount: 3, gridRows: 16,
    showArrow: false, hintText: null ,
    spawnScript: [
      { untilPct: 0.20, rate: 3 },   // crest 1 â€” relentless from the start
      { untilPct: 0.30, rate: 1 },   // lull 1 â€” brief breather
      { untilPct: 0.50, rate: 3 },   // crest 2
      { untilPct: 0.60, rate: 1 },   // lull 2
      { untilPct: 0.80, rate: 3 },   // crest 3
      { untilPct: 0.90, rate: 1 },   // lull 3
      { untilPct: 1.00, rate: 3 },   // crest 4 â€” finale push
    ],
    goals: [{"type":"destroyColor","color":"Red","count":8},{"type":"destroyType","carType":"truck","count":3}]},

  // L21 Easy (Relief) â€” "Yellow arrives": 4 colors. Light pressure after L20.
  { id: 21, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow'],
    worldConfig: { hpMultiplier: 0.35, speed: { base: 3.8, variance: 0.4 } }, // 2026-07-10 parity-fixed retune: 0.58→0.35 (~74%)
    duration: 100, spawnBudget: 10, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: 'NEW! Yellow bombs — 4 colors now' ,
    goals: [{"type":"destroyColor","color":"Red","count":13},{"type":"destroyColor","color":"Yellow","count":12}]},

  // L22 Medium â€” "Four-color flow": Yellow integrated, building confidence.
  { id: 22, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow'],
    worldConfig: { hpMultiplier: 0.33, speed: { base: 4.5, variance: 0.5 } }, // 2026-07-10 parity-fixed retune: 0.55→0.33 (~73%; un-shared from R_4C_MED)
    duration: 100, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Blue","count":15},{"type":"destroyColor","color":"Green","count":14}]},

  // L23 Hard â€” "Four-color pressure": tight budget, tank appearances.
  { id: 23, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow'],
    worldConfig: { hpMultiplier: 0.57, speed: { base: 5.6, variance: 0.5 } }, // 2026-07-10 parity-fixed retune: 0.71→0.57 (~75%; un-shared from B3_HARD)
    duration: 95, spawnBudget: 8, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Yellow","count":5},{"type":"destroyColor","color":"Red","count":5}]},

  // L24 Boss-Hard â€” "Industrial gate": R+B+G+Y at full intensity. Industrial theme unlocks.
  { id: 24, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow'],
    worldConfig: { hpMultiplier: 0.52, speed: { base: 5.8, variance: 0.6 } }, // 2026-07-10 parity-fixed retune: 0.69→0.52 (~74%; un-shared from B3_BH_L24)
    duration: 90, spawnBudget: 8, laneTargetCarCount: 2, gridRows: 16,
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
    worldConfig: { hpMultiplier: 0.32, speed: { base: 3.5, variance: 0.5 } }, // 2026-07-10 parity-fixed retune: 0.58→0.32 (~79%)
    duration: 100, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: 'NEW! Purple — 5 colors, 4 columns. Master SWAP.',
    goals: [{"type":"destroyColor","color":"Red","count":9},{"type":"destroyColor","color":"Blue","count":9},{"type":"destroyColor","color":"Green","count":9}] },

  // L26 Medium â€” "Purple integrated": 5 colors, building muscle memory.
  { id: 26, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'],
    worldConfig: { hpMultiplier: 0.37, speed: { base: 4.0, variance: 0.5 } }, // 2026-07-10 parity-fixed retune: 0.63→0.37 (~78%)
    duration: 100, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Red","count":7},{"type":"destroyColor","color":"Purple","count":7},{"type":"destroyColor","color":"Yellow","count":6}]},

  // L27 Medium â€” "Five-color rhythm": medium ramp, combo play rewarded here.
  { id: 27, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'],
    worldConfig: { hpMultiplier: 0.41, speed: { base: 4.0, variance: 0.5 } }, // 2026-07-10 parity-fixed retune: 0.65→0.41 (~67%)
    duration: 100, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Purple","count":9},{"type":"destroyColor","color":"Green","count":9}]},

  // L28 Hard â€” "Industrial grind": fast + tanky. Trucks and BigRigs dominate.
  { id: 28, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'],
    worldConfig: { hpMultiplier: 0.51, speed: { base: 4.5, variance: 0.5 } }, // 2026-07-10 parity-fixed retune: 0.72→0.51 (~64%)
    duration: 90, spawnBudget: 9, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Yellow","count":6},{"type":"destroyType","carType":"truck","count":5}]},

  // L29 Easy (Relief) â€” "Midpoint reset": soft pressure before L30 boss.
  { id: 29, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'],
    worldConfig: { hpMultiplier: 0.35, speed: { base: 3.5, variance: 0.5 } }, // 2026-07-10 parity-fixed retune: 0.59→0.35 (~67%)
    duration: 100, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Red","count":11},{"type":"destroyColor","color":"Blue","count":11}]},

  // L30 Medium â€” BOSS "Industrial Finale": 5 colors, tank-heavy spawn mix.
  // Design: tanks make up ~40% of spawns. Player must plan multi-shot sequences.
  { id: 30, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'],
    worldConfig: { hpMultiplier: 0.32, speed: { base: 4.0, variance: 0.5 } }, // 2026-07-11 §3c boss solve: 0.53→0.32 (~49% w/ WEIGHTS_L30_TANK; un-shared from R_5C_MED — ~40% tanks now realized in config, was comment-only)
    duration: 100, spawnBudget: 20, laneTargetCarCount: 3, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Purple","count":5},{"type":"destroyType","carType":"bigrig","count":1}]},

  // L31 Hard â€” "Night Highway opens": all 6 colors. Orange arrives with W3 theme.
  // Hardest level with Orange introduction (never intro on an easy level).
  { id: 31, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: { hpMultiplier: 0.35, speed: { base: 4.0, variance: 0.5 } }, // 2026-07-10 parity-fixed retune: 0.54→0.35 (~67%; un-shared from R_6C_HARD)
    duration: 90, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: 'NEW! Orange — all 6 colors, Night Highway begins',
    goals: [{"type":"destroyColor","color":"Red","count":3},{"type":"destroyColor","color":"Green","count":3},{"type":"destroyType","carType":"bigrig","count":3}] },

  // L32 Boss-Hard â€” "Highway storm": 6 colors, brutal. World 2 rescue moment.
  { id: 32, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: { hpMultiplier: 0.32, speed: { base: 4.5, variance: 0.6 } }, // 2026-07-10 parity-fixed retune: 0.57→0.32 (~67%; un-shared from R_6C_BH)
    duration: 85, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Red","count":3},{"type":"destroyColor","color":"Orange","count":3},{"type":"destroyType","carType":"bigrig","count":3}]},

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // BLOCK 5 â€” L33-L40 | Night Highway (dark sky, neon lights)
  // Pattern: Easy / Medium / Medium(Boss) / Hard / Relief / Medium / Hard / Boss-Hard(Boss)
  // gridRows: 11 (bigrig hF=1.26, row_spacing=5.5, gap=0.46)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // L33 Easy (Relief) â€” "Nightfall": 6 colors, much lower pressure. Eyes adjust to theme.
  { id: 33, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: { hpMultiplier: 0.33, speed: { base: 3.0, variance: 0.4 } }, // 2026-07-10 parity-fixed retune: 0.61→0.33 (~67%)
    duration: 100, spawnBudget: 14, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Green","count":7},{"type":"destroyColor","color":"Purple","count":7}]},

  // L34 Medium â€” "Highway patrol": 6 colors, steady ramp. Combos are optimal here.
  { id: 34, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: { hpMultiplier: 0.41, speed: { base: 3.5, variance: 0.5 } }, // 2026-07-10 parity-fixed retune: 0.65→0.41 (~67%)
    duration: 95, spawnBudget: 10, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Red","count":6},{"type":"destroyColor","color":"Orange","count":5}]},

  // L35 Medium â€” BOSS "Night Rush": all 6 colors, INSANE speed, LOW hp.
  // Design: cars die in 1-2 shots but advance every second. React instantly or breach.
  // Speed boss â€” the designed challenge is reflex, not planning.
  { id: 35, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: { hpMultiplier: 0.41, speed: { base: 3.5, variance: 0.5 } }, // 2026-07-10 parity-fixed retune: 0.65→0.41 (~69%)
    duration: 90, spawnBudget: 10, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Blue","count":6},{"type":"destroyType","carType":"truck","count":5}]},

  // L36 Hard â€” "Neon siege": 6 colors, high hp, sustained pressure.
  { id: 36, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: { hpMultiplier: 0.35, speed: { base: 4.0, variance: 0.5 } }, // 2026-07-10 parity-fixed retune: 0.54→0.35 (~67%; un-shared from R_6C_HARD)
    duration: 90, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Yellow","count":3},{"type":"destroyColor","color":"Green","count":3},{"type":"destroyType","carType":"bigrig","count":3}]},

  // L37 Easy (Relief) â€” "Last breath": gentler wave before the final gauntlet.
  { id: 37, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: { hpMultiplier: 0.35, speed: { base: 3.0, variance: 0.4 } }, // 2026-07-10 parity-fixed retune: 0.58→0.35 (~65%)
    duration: 100, spawnBudget: 14, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Purple","count":8},{"type":"destroyColor","color":"Red","count":7}]},

  // L38 Medium â€” "Storm warning": all types, all colors, fast ramp.
  { id: 38, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: { hpMultiplier: 0.47, speed: { base: 3.5, variance: 0.5 } }, // 2026-07-10 parity-fixed retune: 0.67→0.47 (~67%)
    duration: 90, spawnBudget: 10, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Orange","count":6},{"type":"destroyType","carType":"truck","count":4}]},

  // L39 Hard â€” "Pre-finale": everything the player has learned. No mercy.
  { id: 39, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: { hpMultiplier: 0.39, speed: { base: 4.0, variance: 0.5 } }, // 2026-07-10 parity-fixed retune: 0.72→0.39 (~67%; un-shared from R_6C_HARD)
    duration: 85, spawnBudget: 11, laneTargetCarCount: 2, gridRows: 16,
    showArrow: false, hintText: null ,
    goals: [{"type":"destroyColor","color":"Blue","count":3},{"type":"destroyColor","color":"Green","count":3},{"type":"destroyType","carType":"tank","count":3}]},

  // L40 Boss-Hard â€” BOSS "Grandmaster Finale" (Â§3c, INFRA-C + INFRA-A): a staged
  // gauntlet forcing every mechanic in sequence. Stage 1 (0-33%) Bike Swarm â€”
  // fast low-HP smalls test reflex + rapid color cycling (opening board seeded
  // all-bikes via initialCars). Stage 2 (33-66%) Truck Wall â€” mid-HP truck/van
  // tests bench + streak double-damage. Stage 3 (66-100%) Tank+BigRig Pincer â€”
  // high-HP heavies test color-bomb (clear a locked color) + freeze (survive the
  // crest). The goal shape drives the player THROUGH the stages: Red:4 clearable
  // early, truck:1 needs stage 2, bigrig:1 needs stage 3 spawns. What NOT to
  // touch: keep duration:120 (the gauntlet needs the runway), all 6 colors, the
  // multi-goal shape; do NOT flatten the stages into a uniform mix â€” the
  // sequence is the design. Sim loss-timing should skew to stage 3.
  { id: 40, laneCount: 4, colCount: 4, colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    worldConfig: { hpMultiplier: 0.64, speed: { base: 4.0, variance: 0.6 } }, // 2026-07-16 Â§3c boss: 0.51â†’0.64 (50.0% @ 500 runs, losses skew stage-3 63%; un-shared from R_6C_BH_LONG, was L40-only already)
    duration: 120, spawnBudget: 24, laneTargetCarCount: 3, gridRows: 16,
    showArrow: false, hintText: null ,
    initialCars: [
      { lane: 0, row: 0, type: 'small' }, { lane: 0, row: 1, type: 'small' }, { lane: 0, row: 2, type: 'small' },
      { lane: 1, row: 0, type: 'small' }, { lane: 1, row: 1, type: 'small' }, { lane: 1, row: 2, type: 'small' },
      { lane: 2, row: 0, type: 'small' }, { lane: 2, row: 1, type: 'small' }, { lane: 2, row: 2, type: 'small' },
      { lane: 3, row: 0, type: 'small' }, { lane: 3, row: 1, type: 'small' }, { lane: 3, row: 2, type: 'small' },
    ],
    spawnScript: [
      { untilPct: 0.33, weights: { small: 6, big: 2 } },                 // Bike Swarm
      { untilPct: 0.66, weights: { truck: 4, jeep: 3, big: 1 } },        // Truck Wall
      { untilPct: 1.00, weights: { tank: 3, bigrig: 3, truck: 1 } },     // Tank+BigRig Pincer
    ],
    goals: [{"type":"destroyColor","color":"Red","count":4},{"type":"destroyType","carType":"bigrig","count":1},{"type":"destroyType","carType":"truck","count":1}]},
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


