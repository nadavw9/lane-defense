# Lane Defense — Realistic Balance Report

**Generated:** 2026-05-15
**Tool:** `node tools/balance-report-gen.js --runs=200`
**Method:** SimulationRunner with 3 skill profiles. 200 seeds per level.
**Baseline:** Phase 2 report (`docs/balance-report-phase2.md`) — optimal AI, 100% all levels.

---

## Key Findings

Switching from an optimal AI (100% accuracy, perfect cycling) to an average human
player model (82% accuracy, streak-aware, cycling enabled) reveals the actual
difficulty experienced by a typical player. Levels that were "balanced" under
optimal play may need adjustment.

**Target bands (AVERAGE player):**
- Easy: 75–92% win rate
- Medium: 50–72%
- Hard: 28–50%
- Boss-Hard: 15–32%

---

## Per-Level Results

| L | Tier | Colors | Budget | Beginner | Average | Skilled | Status |
|---|------|--------|--------|----------|---------|---------|--------|
| 1 | Easy | Red | 5 | 100.0% | 100.0% | 100.0% | ⚠️  WARN: too easy |
| 2 | Medium | Red+Blue | 10 | 7.0% | 68.0% | 100.0% | ✅ PASS |
| 3 | Medium | Red+Blue | 12 | 3.0% | 56.5% | 100.0% | ✅ PASS |
| 4 | Hard | Red+Blue | 14 | 0.5% | 36.0% | 100.0% | ✅ PASS |
| 5 | Easy | Red+Blue | 12 | 1.5% | 89.5% | 100.0% | ✅ PASS |
| 6 | Medium | Red+Blue | 14 | 2.5% | 62.5% | 100.0% | ✅ PASS |
| 7 | Hard | R+B+G | 14 | 0.0% | 32.0% | 100.0% | ✅ PASS |
| 8 | Boss-Hard | R+B+G | 16 | 0.0% | 20.5% | 100.0% | ✅ PASS |
| 9 | Easy | R+B+G | 14 | 2.0% | 92.5% | 100.0% | ⚠️  WARN: too easy |
| 10 | Medium | Red+Blue | 18 | 2.5% | 62.5% | 100.0% | ✅ PASS |
| 11 | Medium | R+B+G | 16 | 0.0% | 60.5% | 100.0% | ✅ PASS |
| 12 | Hard | R+B+G | 18 | 0.0% | 32.5% | 100.0% | ✅ PASS |
| 13 | Easy | R+B+G | 14 | 0.5% | 87.5% | 100.0% | ✅ PASS |
| 14 | Medium | R+B+G | 18 | 0.0% | 60.5% | 100.0% | ✅ PASS |
| 15 | Hard | R+B+G | 18 | 0.0% | 32.0% | 100.0% | ✅ PASS |
| 16 | Boss-Hard | R+B+G | 20 | 0.0% | 20.5% | 100.0% | ✅ PASS |
| 17 | Easy | R+B+G | 22 | 1.0% | 92.0% | 100.0% | ✅ PASS |
| 18 | Medium | R+B+G | 18 | 0.0% | 60.5% | 100.0% | ✅ PASS |
| 19 | Medium | R+B+G | 20 | 0.5% | 66.0% | 100.0% | ✅ PASS |
| 20 | Hard | R+B+G | 28 | 0.0% | 32.0% | 100.0% | ✅ PASS |
| 21 | Easy | R+B+G+Y | 16 | 0.0% | 89.0% | 100.0% | ✅ PASS |
| 22 | Medium | R+B+G+Y | 18 | 0.0% | 63.5% | 100.0% | ✅ PASS |
| 23 | Hard | R+B+G+Y | 20 | 0.0% | 32.0% | 100.0% | ✅ PASS |
| 24 | Boss-Hard | R+B+G+Y | 22 | 0.0% | 31.5% | 100.0% | ✅ PASS |
| 25 | Easy | +Purple | 22 | 0.0% | 85.0% | 100.0% | ✅ PASS |
| 26 | Medium | +Purple | 22 | 0.0% | 63.0% | 100.0% | ✅ PASS |
| 27 | Medium | +Purple | 22 | 0.0% | 63.0% | 100.0% | ✅ PASS |
| 28 | Hard | +Purple | 24 | 0.0% | 46.0% | 100.0% | ✅ PASS |
| 29 | Easy | +Purple | 18 | 0.0% | 85.0% | 100.0% | ✅ PASS |
| 30 | Medium | +Purple | 28 | 0.0% | 63.0% | 100.0% | ✅ PASS |
| 31 | Hard | All 6 | 26 | 0.0% | 45.5% | 100.0% | ✅ PASS |
| 32 | Boss-Hard | All 6 | 28 | 0.0% | 29.5% | 100.0% | ✅ PASS |
| 33 | Easy | All 6 | 22 | 0.0% | 88.5% | 100.0% | ✅ PASS |
| 34 | Medium | All 6 | 24 | 0.0% | 74.0% | 100.0% | ⚠️  WARN: too easy |
| 35 | Medium | All 6 | 30 | 0.0% | 70.0% | 100.0% | ✅ PASS |
| 36 | Hard | All 6 | 28 | 0.0% | 45.5% | 100.0% | ✅ PASS |
| 37 | Easy | All 6 | 22 | 0.0% | 88.5% | 100.0% | ✅ PASS |
| 38 | Medium | All 6 | 28 | 0.0% | 70.0% | 100.0% | ✅ PASS |
| 39 | Hard | All 6 | 30 | 0.0% | 48.5% | 100.0% | ✅ PASS |
| 40 | Boss-Hard | All 6 | 35 | 0.0% | 27.0% | 100.0% | ✅ PASS |

---

## Flagged Levels (1)

- **L1** (Easy): beginner trivial (>95%)

---

## What This Simulator Cannot Measure

The sim models a stateless, single-decision AI. Real players have context and emotion
the sim cannot replicate:

1. **Booster timing.** SWAP, BENCH, FREEZE, PEEK are not modeled. Real players use
   these in crisis moments; the sim AI never does. Hard/Boss-Hard win rates will be
   higher in practice because boosters provide escape valves.

2. **Panic and tunnel vision.** Under pressure, real players fixate on the most
   advanced lane and ignore others. The sim's Pass B (focus-fire) approximates
   this only at position ≥ 75.

3. **Learning across attempts.** Losing L8 five times teaches the player to
   manage three colors under density. The sim has no memory between seeds.

4. **Streak Shot skill.** The sim applies 82% chance of triggering a streak shot
   when at streak=2 via streakBoost=0.70. Real players who haven't discovered
   the mechanic never deliberately build streaks. Players who have discovered it
   actively farm it.

5. **Emotional quit vs. actual lose.** A player frustrated after 3 losses may
   quit before finishing the level. Sim counts only breach, not frustration.

6. **Turn-based vs. continuous time.** The sim advances cars continuously
   (every tick). The real game advances the grid only on correct hits. A wrong
   shot in the real game wastes a slot but does NOT advance enemies — so real
   misfires are less punishing than the sim models.

---

## Required Human Playtest Before Phase 3 Ship

| Test | Method | Pass Criteria |
|------|--------|---------------|
| L4 (Hard) difficulty feel | 5 new players, no coaching | 2–4 of 5 win on ≤3rd attempt |
| L8 (Boss-Hard) rescue rate | Firebase rescueWouldSave event | 30–60% of L8 attempts trigger rescue prompt |
| L17 (Easy★) streak discovery | Session replay sampling | ≥60% of players fire ≥1 streak shot in L17 |
| L24 (Boss-Hard) quit rate | Firebase level_quit event | <25% quit before first attempt completes |
| L33–40 (Night Highway) | 10 players who completed L32 | Median first-clear at L36–38 |
