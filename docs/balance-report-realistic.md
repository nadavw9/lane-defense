# Lane Defense — Realistic Balance Report

**Generated:** 2026-08-31
**Command:** `node tools/balance-sim.js --level=all --runs=500 --skill=average`
**Model:** discrete, turn-based, goal-based simulation with the booster-aware average profile
(`boosterIQ = 0.70`).

## Current Rules

The simulator models the current production shape: 40 levels, 1/2/3 lanes, 8 rows, goal
completion as the win condition, and the current BOMB lane-clear behavior. It receives each
level's `goals`, `initialCars`, `spawnScript`, and `shooterColorWeights` from `LevelManager.js`.
The simulator is evidence for balance, not a substitute for real-device boss play.

Reference bands at the average profile:

| Levels | Target |
|--------|--------|
| L1–L3 tutorial | 85–100%; tutorial results are expected to be near 100% |
| L4–L9 FTUE | 85–95% |
| L10/L20/L30/L40 bosses | 40–55%; boss outliers are flagged `BOSS §3c` |
| L11–L26 non-boss | 70–82% |
| L27–L39 non-boss | 60–75% |

## Full Run

| Level | Lanes | Grid rows | Average win | Status |
|------:|------:|----------:|------------:|--------|
| 1 | 1 | 8 | 100.0% | OK |
| 2 | 2 | 8 | 97.2% | OK |
| 3 | 3 | 8 | 93.0% | OK |
| 4 | 3 | 8 | 95.0% | OK |
| 5 | 3 | 8 | 92.2% | OK |
| 6 | 3 | 8 | 91.0% | OK |
| 7 | 3 | 8 | 90.4% | OK |
| 8 | 3 | 8 | 88.6% | OK |
| 9 | 3 | 8 | 90.0% | OK |
| 10 | 3 | 8 | 45.6% | OK; boss band |
| 11 | 3 | 8 | 74.8% | OK |
| 12 | 3 | 8 | 79.6% | OK |
| 13 | 3 | 8 | 76.6% | OK |
| 14 | 3 | 8 | 76.6% | OK |
| 15 | 3 | 8 | 81.2% | OK |
| 16 | 3 | 8 | 75.2% | OK |
| 17 | 3 | 8 | 75.6% | OK |
| 18 | 3 | 8 | 77.8% | OK |
| 19 | 3 | 8 | 74.8% | OK |
| 20 | 3 | 8 | 52.4% | OK; boss band |
| 21 | 3 | 8 | 73.0% | OK |
| 22 | 3 | 8 | 73.4% | OK |
| 23 | 3 | 8 | 80.2% | OK |
| 24 | 3 | 8 | 72.2% | OK |
| 25 | 3 | 8 | 79.6% | OK |
| 26 | 3 | 8 | 81.0% | OK |
| 27 | 3 | 8 | 71.4% | OK |
| 28 | 3 | 8 | 69.8% | OK |
| 29 | 3 | 8 | 65.6% | OK |
| 30 | 3 | 8 | 36.6% | BOSS §3c; below 40–55% |
| 31 | 3 | 8 | 66.4% | OK |
| 32 | 3 | 8 | 62.8% | OK |
| 33 | 3 | 8 | 65.2% | OK |
| 34 | 3 | 8 | 72.2% | OK |
| 35 | 3 | 8 | 66.0% | OK |
| 36 | 3 | 8 | 64.2% | OK |
| 37 | 3 | 8 | 65.6% | OK |
| 38 | 3 | 8 | 73.4% | OK |
| 39 | 3 | 8 | 57.8% | TOO HARD; below 60–75% |
| 40 | 3 | 8 | 49.4% | OK; boss band |

**Mean win rate:** 74.3% across all 40 levels.
**Flagged:** L30 is a boss-band exception at 36.6%; L39 is below its late-game band at 57.8%.
These are balance follow-ups, not reasons to falsify the report or widen the bands.

## What This Does Not Prove

- It does not prove the player-facing Streak Shot exists. The current simulator has a partial
  streak model; the live `GameLoop` still needs the locked double-damage plus one-shot slow
  mechanic.
- It does not replace real-device play of L10, L20, L30, and L40. Boss identity and intended
  solutions must be played, not only measured.
- It does not measure emotional response, learning across attempts, quit behavior, or final art
  quality.

## Follow-Up

Investigate L30 and L39 against the named design intent before changing numbers. Any level-data
change must be re-run with `node tools/balance-sim.js --level=all --runs=500` and reviewed against
the locked rules in `docs/VISION.md`.

The 2026-05-15 `balance-report-gen.js` report is historical and superseded. It used stale
continuous-model assumptions and must not be used as current difficulty ground truth.
