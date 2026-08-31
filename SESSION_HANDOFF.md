# Traffic Bomb — Current Session Handoff

**Snapshot date:** 2026-08-31
**Branch:** `master`
**Code baseline before this documentation audit:** `52636da`
**Locked contract:** [`docs/VISION.md`](docs/VISION.md) is unchanged and remains authoritative.

## Current Runtime

- 40 goal-based, turn-based levels. A correct color-matched shot damages the front car and
  advances the board; a wrong shot does not advance it. Breach loses the level, with the
  existing rescue flow available.
- World boundaries are W1 L1–15, W2 L16–30, and W3 L31–40.
- Shipped board geometry is L1 = 1 lane/column, L2 = 2 lanes/columns, and L3–L40 = 3
  lanes/columns. Every production level uses `gridRows: 8`.
- Theme mapping is morning L1–4, afternoon L5–8, sunset L9–12, misty L13–15, industrial
  L16–30, and night highway L31–40.
- The steady-state gameplay camera is one top-down orthographic camera. `CameraFX` wraps that
  camera for transient shake/zoom effects; it does not create a perspective or second camera.
- World geometry is derived from `src/renderer3d/projection.js`: `CELL = 4`, `laneToX`,
  `posToZ`, `bombSlotZ`, and the band/frustum helpers. Do not introduce copied screen/world
  constants.
- Normal cars render as pre-colored PNG sprite billboards on flat planes with
  `MeshBasicMaterial`; the boss uses a procedural `CanvasTexture`. Car position, damage,
  freeze tint, danger aura, hit flash, and destroy animation remain live.
- Danger aura is row-based: it applies only within the two rows nearest the breach gate.
- The visible bomb queue has three slots. The bench is a separate fixed four-slot storage area.
  The BOMB booster clears every car in the targeted lane, regardless of color or row.
- City repair is implemented: `ProgressManager` persists `cityState`, and level select renders
  repair states and the repair animation. World 2 and World 3 theme wiring exists, but their
  final art direction is still a production gate.

## Verification Baseline

The fresh checks run before this documentation edit were:

- `npx vitest run`: 1232 passed, 2 skipped, 5 todo across 56 files.
- `npm run build`: passed; Vite emitted the existing large main-bundle warning.
- `node tools/balance-sim.js --level=all --runs=500 --skill=average`: completed all 40 levels;
  mean win rate 74.3%. L30 measured 36.6% and was flagged as a boss-band exception; L39
  measured 57.8% and was flagged too hard.

The current audit must rerun these checks after documentation/tool edits. Local visual smoke is
not the gate; `npm run test:visual` belongs to CI per `CLAUDE.md`.

## Confirmed Open Issues

These are implementation findings, not documentation disagreements:

1. **P0 contract gap:** the live `GameLoop` does not implement the VISION Streak Shot behavior
   (three consecutive correct hits, then double damage and one-shot slow). The simulator has a
   partial model, but that does not make the player mechanic live.
2. **P1 level-select mismatch:** `LevelSelectScreen` exposes two pages of 20 levels, while the
   locked world structure is 15 / 15 / 10. The city-page mapping follows the two-page model.
3. **P1 scene-panel mismatch:** `worldPanelForLevel()` uses 13/26 thresholds while the live
   world and theme boundaries are 15/30. This can show the wrong side-panel art at boundaries.
4. **P1 BOMB settle risk:** `_settleAfterClear()` checks victory but does not refill a board
   after a non-winning lane clear. A BOMB can therefore leave an empty board without invoking
   the normal advance/refill path.
5. **P1 rainbow empty-lane risk:** the rainbow shot is consumed before `_resolveShot()` finds a
   front car and has no refund path when the target lane is empty.
6. **P2 fairness drift:** `SPECIAL_LEVEL_MODES.threeLane.maxSameColorFrontCars` is defined, but
   `FairnessArbiter._fixFR2()` still uses the global four-lane cap.
7. **P2 coordinate drift:** the `GameApp.onCrisis` floating-text callback still computes X with
   `APP_W / 4` instead of the active-column registry.
8. **P2 popup contract drift:** several `GameApp` callbacks call `spawnFloatingText` directly,
   bypassing `PopupQueue`, despite the project rule that all popups, banners, and toasts route
   through that queue.
9. **P3 legacy surface:** `getSurvivalConfig()`, survival achievements, old DirectorConfig
   unlock tables, and car GLB preloads remain in the repository even though survival is not a
   live mode and Car3D no longer uses car GLBs. They should be retired in a scoped cleanup.

## Documentation Source Of Truth

- `docs/VISION.md`: locked product contract; do not edit without explicit owner approval.
- `src/game/LevelManager.js`: executable level data and current geometry/palette schedule.
- `src/renderer3d/ThemeRegistry.js`: executable theme schedule.
- `src/renderer3d/projection.js`: executable world/screen geometry.
- `src/game/GameLoop.js`: live turn, damage, breach, booster, and win/loss behavior.
- `tools/balance-sim.js`: current balance measurement command and target bands.
- `docs/GAME_DESIGN.md`: implementation-reconciled design context; historical tables are labeled.
- `docs/balance-report-realistic.md`: latest full-run balance evidence.
- `docs/superpowers/`: plans and incident records; entries describing retired designs are
  historical provenance, not executable instructions.

## Next Work

1. Close the P0 Streak Shot gap with a dedicated design and implementation task, then play L10,
   L20, L30, and L40 on a real device after any lane/row change.
2. Resolve the level-select world pagination and `worldPanelForLevel` boundary mismatch.
3. Fix BOMB post-clear refill and rainbow empty-lane refund with focused regression tests.
4. Correct the fairness and crisis-coordinate drift, then route ad-hoc floating text through the
   popup queue.
5. Only after the proportions pass is approved should Figma art direction begin: six car
   sprites, bomb visual, road/lanes, and world backgrounds.

## Production Gates Still Open

- Replace AdMob test unit IDs with production IDs.
- Produce and validate a signed release APK.
- Prepare Play Store listing assets, privacy policy, Data Safety form, and closed testing.
- Finish W2/W3 visual art direction and real-device boss playtests.
- Do not delete `android/lane-defense-release.keystore`.
