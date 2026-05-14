# Lane Defense — Balance Baseline

**Generated:** 2026-05-14  
**Runs:** 200 per level  
**Command:** `node tools/balance-sim.js --level=N --runs=200`  
**Purpose:** Pre-Phase 1 baseline. Compare against this after every level redesign.

All levels solvable under optimal-play AI. Zero unwinnable seeds.
WARN flags on Hard/Boss-Hard tiers are expected (sim uses optimal play; real difficulty comes from player mistakes).

| L  | Design Tier | Win rate | Avg kills | Fairness fixes | Status |
|----|------------|---------|-----------|---------------|--------|
| 1  | Easy       | 100%    | 96.4      | 0.0%          | PASS   |
| 2  | Medium     | 100%    | 112.7     | 12.8%         | PASS   |
| 3  | Medium     | 100%    | 144.1     | 12.4%         | PASS   |
| 4  | Hard       | 100%    | 144.2     | 12.4%         | WARN   |
| 5  | Easy       | 100%    | 161.0     | 12.2%         | PASS   |
| 6  | Medium     | 100%    | 161.0     | 12.2%         | PASS   |
| 7  | Hard       | 100%    | 161.1     | 12.2%         | WARN   |
| 8  | Boss-Hard  | 100%    | 161.4     | 5.4%          | WARN   |
| 9  | Easy       | 100%    | 161.3     | 5.4%          | PASS   |
| 10 | Medium     | 100%    | 161.3     | 5.4%          | PASS   |
| 11 | Medium     | 100%    | 161.3     | 5.4%          | PASS   |
| 12 | Hard       | 100%    | 161.3     | 5.4%          | WARN   |
| 13 | Easy       | 100%    | 144.1     | 5.4%          | PASS   |
| 14 | Medium     | 100%    | 161.3     | 5.4%          | PASS   |
| 15 | Hard       | 100%    | 161.3     | 5.4%          | WARN   |
| 16 | Boss-Hard  | 100%    | 144.1     | 5.4%          | WARN   |
| 17 | Easy       | 100%    | 161.3     | 5.4%          | PASS   |
| 18 | Medium     | 100%    | 144.1     | 5.4%          | PASS   |
| 19 | Medium     | 100%    | 161.3     | 5.4%          | PASS   |
| 20 | Hard       | 100%    | 161.2     | 5.2%          | WARN   |

## Notes

- **Fairness fixes at L2–L8 (~12%)**: 2-color palette means the arbiter must force-recolor more often. Working as designed.
- **Fairness fixes at L8+: ~5%**: 3-color palette reduces force-recolor rate.
- **Crisis triggers: 0**: Expected — crisis fires in PRESSURE/CLIMAX phases after sustained play; 200-run single-level sim doesn't reach that threshold.
- **Avg kills plateau at ~161**: SimulationRunner uses continuous-time spawning; the plateau reflects the sim's spawn-rate ceiling, not a level design problem.
