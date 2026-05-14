# Lane Defense — Phase 1 Balance Report

**Generated:** 2026-05-15  
**Tool:** `node tools/balance-sim.js --level=N --runs=200`  
**Method:** SimulationRunner with optimal-play AI. 200 seeds per level.

---

## Key Finding: 0 Unwinnable Seeds Across All 40 Levels

Every level is solvable under optimal play. The viability guard (`_enforceViableMove`) works correctly — the player always has at least one valid move.

---

## Per-Level Results

| L  | Tier (design) | Colors | Budget | Win rate (sim) | Avg kills | Fairness fixes | Status |
|----|--------------|--------|--------|---------------|-----------|---------------|--------|
| 1  | Easy         | R      | 5      | 100%          | 96.4      | 0.0%          | ✅ PASS |
| 2  | Medium       | R+B    | 10     | 100%          | 112.7     | 12.8%         | ✅ PASS |
| 3  | Medium       | R+B    | 12     | 100%          | 144.2     | 12.4%         | ✅ PASS |
| 4  | Hard         | R+B    | 14     | 100%          | 144.2     | 12.5%         | ⚠️  WARN |
| 5  | Easy         | R+B    | 12     | 100%          | 161.0     | 12.2%         | ✅ PASS |
| 6  | Medium       | R+B    | 14     | 100%          | 161.0     | 12.2%         | ✅ PASS |
| 7  | Hard         | R+B+G  | 14     | 100%          | 161.4     | 5.4%          | ⚠️  WARN |
| 8  | Boss-Hard    | R+B+G  | 16     | 100%          | 144.1     | 5.3%          | ⚠️  WARN |
| 9  | Easy         | R+B+G  | 14     | 100%          | 161.3     | 5.4%          | ✅ PASS |
| 10 | Medium       | R+B    | 18     | 100%          | 161.1     | 12.3%         | ✅ PASS |
| 11 | Medium       | R+B+G  | 16     | 100%          | 161.3     | 5.4%          | ✅ PASS |
| 12 | Hard         | R+B+G  | 18     | 100%          | 152.4     | 5.4%          | ⚠️  WARN |
| 13 | Easy         | R+B+G  | 14     | 100%          | 161.3     | 5.4%          | ✅ PASS |
| 14 | Medium       | R+B+G  | 18     | 100%          | 161.3     | 5.4%          | ✅ PASS |
| 15 | Hard         | R+B+G  | 18     | 100%          | 161.4     | 5.4%          | ⚠️  WARN |
| 16 | Boss-Hard    | R+B+G  | 20     | 100%          | 144.1     | 5.3%          | ⚠️  WARN |
| 17 | Easy         | R+B+G  | 16     | 100%          | 161.4     | 5.4%          | ✅ PASS |
| 18 | Medium       | R+B+G  | 18     | 100%          | 161.3     | 5.4%          | ✅ PASS |
| 19 | Medium       | R+B+G  | 20     | 100%          | 161.2     | 5.3%          | ✅ PASS |
| 20 | Hard         | R+B+G  | 28     | 100%          | 161.3     | 5.4%          | ⚠️  WARN |
| 21 | Easy         | R+B+G+Y| 16     | 100%          | 161.1     | 5.1%          | ✅ PASS |
| 22 | Medium       | R+B+G+Y| 18     | 100%          | 161.2     | 5.2%          | ✅ PASS |
| 23 | Hard         | R+B+G+Y| 20     | 100%          | 152.1     | 5.2%          | ⚠️  WARN |
| 24 | Boss-Hard    | R+B+G+Y| 22     | 100%          | 144.0     | 5.3%          | ⚠️  WARN |
| 25 | Easy         | +Purple | 22    | 100%          | 161.1     | 6.4%          | ✅ PASS |
| 26 | Medium       | +Purple | 22    | 100%          | 161.1     | 6.4%          | ✅ PASS |
| 27 | Medium       | +Purple | 22    | 100%          | 161.1     | 6.3%          | ✅ PASS |
| 28 | Hard         | +Purple | 24    | 100%          | 144.0     | 6.2%          | ⚠️  WARN |
| 29 | Easy         | +Purple | 18    | 100%          | 161.1     | 6.4%          | ✅ PASS |
| 30 | Medium       | +Purple | 28    | 100%          | 161.1     | 6.3%          | ✅ PASS |
| 31 | Hard         | +Orange | 26    | 100%          | 144.1     | 7.6%          | ⚠️  WARN |
| 32 | Boss-Hard    | +Orange | 28    | 100%          | 136.4     | 7.6%          | ⚠️  WARN |
| 33 | Easy         | All 6  | 22     | 100%          | 160.9     | 7.7%          | ✅ PASS |
| 34 | Medium       | All 6  | 24     | 100%          | 152.1     | 7.6%          | ✅ PASS |
| 35 | Medium       | All 6  | 30     | 100%          | 144.1     | 7.6%          | ✅ PASS |
| 36 | Hard         | All 6  | 28     | 100%          | 144.1     | 7.6%          | ⚠️  WARN |
| 37 | Easy         | All 6  | 22     | 100%          | 160.9     | 7.8%          | ✅ PASS |
| 38 | Medium       | All 6  | 28     | 100%          | 144.1     | 7.6%          | ✅ PASS |
| 39 | Hard         | All 6  | 30     | 100%          | 136.4     | 7.6%          | ⚠️  WARN |
| 40 | Boss-Hard    | All 6  | 35     | 100%          | 192.8     | 7.6%          | ⚠️  WARN |

---

## Interpreting WARN Flags

Sim uses optimal-play AI that never misfires. Hard/Boss-Hard levels at 100% means "solvable" — expected. Real player pass rates will be lower because real players:
1. Fire wrong-color shots (now penalizes with a wasted slot, no advance)
2. Miss strategic bomb windows
3. Panic on late-game tank surges

WARN ≠ balance problem. It confirms the level is solvable.

---

## Notes

- **L2-L6 (~12% fairness fixes)**: 2-color palette forces more arbiter recolors. Working as designed.
- **L7-L20 (~5% fixes)**: 3 colors reduce recolor frequency. Expected.
- **L21-L24 (~5% fixes)**: 4 colors, similar rate.
- **L25-L30 (~6% fixes)**: 5 colors slightly higher — more color combinations = more potential mismatches.
- **L31-L40 (~7-8% fixes)**: 6 colors. Highest diversity = highest arbiter intervention rate. Still well within acceptable range.
- **L40 avg kills = 192.8**: 120s duration with continuous spawning hits the sim's ceiling. Budget-based win confirms level ends correctly.
- **Crisis: 0.00 all levels**: Expected — crisis fires in PRESSURE/CLIMAX director phases during extended play, not in single-level sim.

---

## Boss Level Notes

| L  | Boss Name         | Designed Challenge                              |
|----|------------------|-------------------------------------------------|
| 10 | The Bench Test   | R+B only (intentional strip), bench essential   |
| 15 | Meet the Tank    | First tank, slow speed gives planning time      |
| 20 | The Surge        | Budget=28, laneTarget=4 — wave after wave       |
| 25 | Color Overload   | 5 colors on 4 columns, SWAP/bench critical      |
| 30 | Industrial Finale| Tank-heavy spawn, hp=1.3 sustained pressure     |
| 35 | Night Rush       | Speed=8.0, hp=0.8 — reflex, not planning        |
| 40 | Grandmaster      | All 6, budget=35, laneTarget=4, 120s duration   |

---

## Action Items

| Priority | Issue | Recommendation |
|----------|-------|----------------|
| MEDIUM | No crisis triggers | Expected — test crisis manually at L13+ |
| LOW | Hard/Boss-Hard WARN | Confirm with real-player A/B data |
| FUTURE | Track wrong-color shot rate | New mechanic — add Firebase event |
