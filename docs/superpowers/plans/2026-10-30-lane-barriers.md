# Lane Barriers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Long, honest levels: one barrier per lane, waves, a rarer supercharge, no hidden crisis
assist, a simulator that plays the player's move set, and a drop that always lands.

**Architecture:** Rules live in `src/director/TrafficRules.js` (shared by GameLoop and
SimulationRunner by import, never copied). State in `GameState`, writer `GameLoop`. The 3D
renderer draws barriers and their smash; GameApp wires events. Tuning tools read the `human`
profile and the new bands.

**Tech Stack:** plain ES modules, Vitest, Three.js/PixiJS renderers, node tools.

**Spec:** `docs/superpowers/specs/2026-10-30-lane-barriers-design.md`

## Global Constraints

- Every correct shot still advances all traffic (owner rule). Mismatched drops bounce back.
- GameLoop / DragDrop / CombatResolver are on the CI-sensitive path: branch, CI, merge on green.
- `src/director/` never imports pixi/three. Renderers never mutate GameState.
- Popups only through PopupQueue; positions only through PositionRegistry / projection.js.
- No HP bars, no camera zoom, no row-clear bomb.
- All numbers are provisional; the owner refines after device play.

## Review Focus

1. A breach during a FREEZE / a bench shot / a BOMB booster clear: the barrier rule must run on
   every path that can move a car past the last row (only `_advanceGrid` moves cars; surge too).
2. Two cars breaching the same lane on one advance (a speeder behind a car): one barrier, so the
   second car is a loss on that same advance.
3. Continue after a barrier loss: `GameState.rescue` pushes traffic back; barriers stay broken
   and the lane still reads as open.
4. Waves at p exactly on a boundary and p > 1 (goal overshoot by a chain kill): clamped, no NaN.
5. Pending drop while a modal pauses the loop: it must expire, never fire into a paused game.

---

### Task 1: Rules numbers, human profile as reference, bands

**Files:** `src/director/TrafficRules.js` (STREAK_TO_CHARGE), `src/director/DirectorConfig.js`
(KILLS_PER_BOMB), `src/screens/guideContent.js` + `src/screens/BoosterSpotlight.js` (copy "5"),
`src/simulation/SimulationRunner.js` (profile, done), `tools/balance-sim.js`, `tools/tune-levels.mjs`,
`tools/tune-stars.mjs` (skill human, GS range 0.5-2.5 anchor 1.0), `tools/bands.mjs`, tests
`tests/booster-earn.test.js` and any test pinning 3 / 6.

- [ ] Write/adjust tests: streak charges on the 5th kill not the 3rd; bomb charge at 10 kills.
- [ ] Run, see them fail; change the constants and copy; run green.
- [ ] Bands per spec 3.6; `tools/bands.mjs` header says profile human.
- [ ] Commit.

### Task 2: Crisis assist removed

**Files:** `src/game/GameLoop.js` (step 6.5, `_onCrisis`), `src/director/ShooterDirector.js`
(`triggerCrisis`, `_mostDangerousLane`, deploy log if only crisis used it),
`src/director/IntensityPhase.js` (`crisisEnabled`), `src/director/DirectorConfig.js` (`CRISIS`,
`crisisPerLevel`), `src/renderer/GameApp.js` (onCrisis flash), `src/renderer3d/GameRenderer3D.js`,
`src/renderer3d/queueMotion.js`, `src/renderer/ShooterRenderer.js`, `src/audio/AudioManager.js`,
`src/renderer/PopupQueue.js`, `src/models/Column.js`, `src/game/AchievementManager.js` +
`ProgressManager.js` + `AchievementsScreen.js` (an achievement that can no longer fire is removed),
`src/simulation/SimulationRunner.js` (comments), tests `game-loop-crisis` (delete),
`director-config`, `director`, `intensity-phase`, `queue-motion`, `shooter-director`,
`simulation`, `stash-removed`, `column-capacity` (assertions that mention crisis).

- [ ] Grep test: `tests/no-crisis.test.js` asserts no `crisis` identifier remains in `src/`
  (case-insensitive, excluding this test).
- [ ] Remove, run the suite green, commit.

### Task 3: Barriers in the rules, state, loop and simulator

**Files:** `src/director/TrafficRules.js` (`breachLane(cars, maxRow, barrierIntact)` ->
`{ crashed: car|null, breached: car[] }`), `src/game/GameState.js` (`barriers: boolean[]` per
lane, reset per level; `rescue()` keeps them), `src/game/GameLoop.js` (`_advanceGrid` step 2),
`src/simulation/SimulationRunner.js` (same helper), `src/game/ProgressManager.js` (nothing),
test `tests/barriers.test.js`.

**Interfaces:**
- Produces: `TrafficRules.breachLane(cars, maxRow, hasBarrier)`; GameState `barriers[]`;
  GameLoop hook `_onBarrierSmash(laneIdx, car)`; sim result `barriersLost`.

- [ ] Tests per spec 5 (first smash continues, second loses, other lane own barrier, no credit,
  continue keeps, sim parity: a seed that breaches once wins/loses identically in both).
- [ ] Fail, implement, green, commit.

### Task 4: Waves

**Files:** `src/director/TrafficRules.js` (`waveHeft`, `waveLaneTarget`, `waveIndexAt`,
`WAVES_FROM = FINALE_FROM`), `src/director/CarDirector.js` (use them, `waves` from level cfg,
default 2, milestone 3), `src/game/LevelManager.js` (`waves` on milestones), `src/renderer/GameApp.js`
(wave tag at crest start replacing the FINAL RUSH banner), `src/simulation/SimulationRunner.js`
(carDir already keyed on progress), tests `tests/waves.test.js` (replaces `final-rush.test.js`
finale cases; keep pushTrafficBack cases).

- [ ] Tests per spec: table anchors, smooth joins, clamps, flat before L10, 3 crests on milestones.
- [ ] Fail, implement, green, commit.

### Task 5: Drop zone and pending drop

**Files:** `src/input/DragDrop.js` (`_hitTestLane` band, pending drop in `onPointerUp` +
`update`), `src/renderer/GameApp.js` (if the isShotInFlight wiring needs a "lane free" signal),
tests `tests/dragdrop-pending.test.js`, `tests/dragdrop-empty-lane.test.js` (band).

- [ ] Tests: release at `BREACH_LINE_Y + 8` on lane 1 deploys; release at `ROAD_TOP_Y - 1`
  (goal band) does not; pending drop fires on the next update after `isShotInFlight` returns
  false; bounces when the front car colour changed meanwhile; expires after 0.8 s.
- [ ] Fail, implement, green, commit.

### Task 6: Barriers and waves on screen, barrier card

**Files:** `src/renderer3d/Road3D.js` (barrier meshes per lane, `setBarrier(lane, intact)`),
`src/renderer3d/Particles3D.js` (splinter burst), `src/renderer3d/GameRenderer3D.js`
(`onBarrierSmash`), `src/renderer/GameApp.js` (wire `_onBarrierSmash`: FX, shake, tag, card),
`src/screens/guideContent.js` + `src/screens/introSchedule.js` (`barrier_down` [1,200]),
`tests-visual/fixtures/game.js` (seed key), `tests/intro-schedule.test.js`.

- [ ] intro-schedule test for the new key; implement; screenshots of a smash (L5+) and a wave
  tag into `docs/review/` with `00-labels.txt`.
- [ ] Commit.

### Task 7: Retune all 200 levels and stars

- [ ] `node tools/tune-levels.mjs 1-200 300 --write`, `node tools/tune-stars.mjs 1-200 300 --write`.
- [ ] `node tools/balance-sim.js --level=all --runs=300 --skill=human` -> update
  `docs/balance-report-realistic.md` (profile, bands, average turns column).
- [ ] `npx vitest run` green (level-config audit), commit.

### Task 8: QA, docs, ship

- [ ] QA bots on a worktree server: `autoplay.mjs` 1-41, `ftue-play.mjs`, `booster-qa.mjs`.
- [ ] CLAUDE.md §0 entry, GAME_DESIGN.md note, VISION.md amendment proposal (owner approval).
- [ ] Push, CI, PR, merge on green; dispatch android-release (test, internal, completed) and
  ios-release (test, testflight); release notes EN+HE in chat; memory update.
