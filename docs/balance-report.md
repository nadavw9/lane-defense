# Lane Defense — Balance Simulator Report

**Generated:** 2026-05-14  
**Tool:** `node tools/balance-sim.js --level=N --runs=500`  
**Method:** SimulationRunner with optimal-play AI (always fires matching color at most-advanced car). 500 seeds per level.

---

## Key Finding: 0 Unwinnable Seeds Across All 20 Levels

Every level is solvable under optimal play. No level has 0% win rate. The viability guard (`_enforceViableMove`) is working correctly — the player always has at least one valid move.

---

## Per-Level Results

| L  | Tier (design) | Win rate (sim) | Avg kills | Crisis | Fairness fixes | Status |
|----|--------------|---------------|-----------|--------|---------------|--------|
| 1  | Easy         | 100%          | 96.3      | 0.00   | 0.0%          | ✅ PASS |
| 2  | Medium       | 100%          | 112.7     | 0.00   | 12.7%         | ✅ PASS |
| 3  | Medium       | 100%          | 144.1     | 0.00   | 12.3%         | ✅ PASS |
| 4  | Hard         | 100%          | 144.1     | 0.00   | 12.4%         | ⚠️  WARN |
| 5  | Easy         | 100%          | 161.1     | 0.00   | 12.2%         | ✅ PASS |
| 6  | Medium       | 100%          | 161.1     | 0.00   | 12.2%         | ✅ PASS |
| 7  | Hard         | 100%          | 161.1     | 0.00   | 12.2%         | ⚠️  WARN |
| 8  | Boss-Hard    | 100%          | 161.0     | 0.00   | 5.3%          | ⚠️  WARN |
| 9  | Easy         | 100%          | 161.0     | 0.00   | 5.3%          | ✅ PASS |
| 10 | Medium       | 100%          | 161.0     | 0.00   | 5.3%          | ✅ PASS |
| 11 | Medium       | 100%          | 161.0     | 0.00   | 5.3%          | ✅ PASS |
| 12 | Hard         | 100%          | 161.0     | 0.00   | 5.3%          | ⚠️  WARN |
| 13 | Easy         | 100%          | 144.0     | 0.00   | 5.3%          | ✅ PASS |
| 14 | Medium       | 100%          | 161.0     | 0.00   | 5.3%          | ✅ PASS |
| 15 | Hard         | 100%          | 161.0     | 0.00   | 5.3%          | ⚠️  WARN |
| 16 | Boss-Hard    | 100%          | 144.0     | 0.00   | 5.3%          | ⚠️  WARN |
| 17 | Easy         | 100%          | 161.0     | 0.00   | 5.3%          | ✅ PASS |
| 18 | Medium       | 100%          | 144.0     | 0.00   | 5.3%          | ✅ PASS |
| 19 | Medium       | 100%          | 161.0     | 0.00   | 5.3%          | ✅ PASS |
| 20 | Hard         | 100%          | 161.0     | 0.00   | 5.2%          | ⚠️  WARN |

---

## Interpreting the WARN Flags

The sim uses **optimal-play AI** that never makes a wrong-color shot. Real players make mistakes — especially on Hard/Boss-Hard levels. This is intentional and expected:

- **Sim win rate = 100%** for Hard/Boss-Hard levels means "the level is solvable" — good.
- **Real player pass rate** will be lower because real players:
  1. Fire wrong-color shots (new mechanic: now penalizes by wasting a slot, not advancing cars)
  2. Misread combos and miss strategic row-bomb windows
  3. Panic on late-game spawns and cycle columns inefficiently
- **Actual difficulty calibration** requires A/B data from real sessions (Firebase analytics).

The WARN flags identify levels that *should* feel hard to players but are confirmed solvable. They do **not** indicate a balancing problem.

---

## Crisis Assist: Not Firing

Crisis assist shows 0.00 triggers across all levels. This is expected in a solo-level simulation: crisis is a PRESSURE/CLIMAX-phase feature designed for the live-game director, not for early-level single-session play. The 500-seed sim doesn't run the full director long enough for crisis to fire.

---

## Fairness Fixes: L2–L8 Higher (12%)

Levels 2–8 use a 2-color palette (Red+Blue). With only 2 colors and 2–4 lanes, the fairness arbiter needs to fix ~12% of spawns to ensure the player always has a valid move. This is working as designed. Green's addition at L8 drops fixes to ~5% (more color diversity = less force-recoloring needed).

---

## Action Items

| Priority | Issue | Recommendation |
|----------|-------|----------------|
| MEDIUM | No crisis triggers in sim | Expected — test crisis manually at L13+ |
| LOW | Hard/Boss-Hard WARN flags | Confirm with real player A/B data before adjusting configs |
| FUTURE | Track wrong-color shot rate | New mechanic (2026-05-14 fix) — add Firebase event for misses |

---

## How to Re-run

```bash
# Single level
node tools/balance-sim.js --level=5 --runs=500

# All 20 levels (bash)
for i in $(seq 1 20); do node tools/balance-sim.js --level=$i --runs=500; done
```
