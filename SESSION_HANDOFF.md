# Traffic Bomb — Session Handoff

## Current State
- Git tip: 1651000 feat: polish Power Up screen (gold header, tiered rows, BEST VALUE jackpot); fix Tier 1 icon centering
- Branch: master
- Last deploy: today, green
- Tests: 709 passing, 1 skip, 5 todo
- Live URL: https://nadavw9.github.io/lane-defense/

## What Was Shipped This Session (most recent first)
- 1651000 — Power Up (pre-level) screen visual polish: big gold "POWER UP?" header over a warm radial glow, dark gradient panel, three escalating tier rows (purple → cyan → gold), a "BEST VALUE" gold pill + gentle shimmer on the Tier 3 jackpot, large booster emoji (🎨 ❄️ 💣) each with a Recolor/Freeze/Bomb label, and a muted secondary SKIP. Tier 1's lone icon is centred in the right portion (not edge-pinned). Animation via the screen's existing `update(dt)`; trigger/dismiss flow unchanged.
- d182d6e — Level-select popup booster SWAP → 🎨 BRUSH (`colorchange` key, purple identity, ad-count parity via `AD_COSTS`). Also: the pre-level "Power Up?" screen now appears on level-to-level progression — the win screen's NEXT LEVEL routes through `_showPreLevel` (was jumping straight to `_startLevel`), mirroring the map-tap flow.
- cee6f15 — CANCEL label centred in the booster bar: when a booster is active, its badge text ("×N" → "CANCEL") is now centred on the card with the corner badge hidden, instead of overflowing the top-right corner.
- c5fdee9 — Added 62 headless tests across 7 new files (suite now 709): `car-advance` (grid advance, breach, spawn vs spawnBudget, 3-car opening density), `damage-chain` (carry-over, multi-kills, exact-HP edge, color-bomb clear-through), `booster-earn` (COLOR CHANGE consecutive combo, FREEZE 3-kill, rainbow color bomb), `bench` (4 slots, store/retrieve vs queue, reset, unlock-gate contract), `rescue` (breach→over, rescue restore, second-breach final, RETRY), `win-condition` (budget-clear + legacy kill-goal + boss config), `color-change-booster` (activation lifecycle + recolor + new-colour combat). Real GameLoop/GameState/CombatResolver/models — no Pixi/Three/DOM. No existing tests modified.
- 0e61c7b — Empty-lane bomb drop now bounces back instead of being silently consumed. Fix in `DragDrop._checkColorMatch`: a lane with no front car now returns false (was true), so the drop routes through the existing wrong-colour bounce-back (`onColorMismatch` + `_snapBack`, no `col.consume()`) — the queue no longer advances on a wasted drop. The empty-lane check now runs before the color-bomb short-circuit, so a color bomb on an empty lane is fixed the same way (a rainbow on a lane WITH a car is unchanged). +4 tests (`tests/dragdrop-empty-lane.test.js`). No change to GameLoop resolution or the bounce animation.
- be61ddd — COLOR CHANGE booster tooltip reworded to "Tap a car, pick a color — ALL cars of that color transform!" (the `colorchange_use` feature banner fired when the button is tapped). Style/positioning/timing unchanged.
- a220495 — ShopScreen now sells COLOR CHANGE instead of the removed SWAP: replaced the booster def (key/label/icon/desc + purple identity, same 20-coin price), the owned-count badge (reads live `boosterState.colorChange`), and the purchase branch. Also cleaned the dead `swap` token out of the FREEZE purchase (`setBoosters(0, …)`). ProgressManager's `swap` field left as a separate cleanup.
- 4a707ce — COLOR CHANGE earn condition reworked: removed the per-level coin threshold entirely (`colorChangeThreshold`/`colorChangeEarned`, `colorChangeThresholdForLevel` deleted). Now earns on TWO strictly-consecutive multi-kills (2+ kills, then another 2+ on the very next shot) via `GameLoop._updateColorChangeCombo` — resets on any shot killing <2 (including a wrong-colour miss), can earn multiple times per level, resets at level start. Notification: "2× COMBO! Color Change ready!". Tests updated (replaced 2 threshold tests with 3 combo tests → 643).
- 50f205d — COLOR CHANGE visual desync fixed: `Car3D` now resyncs a car's sprite when its colour is mutated in place. The booster recoloured cars in GameState (e.g. blue→red) but the sprite kept its old colour while combat already treated it as the new colour; the renderer now detects `car.color` changes per-frame and swaps the powerball/sprite texture.
- 457113a — Retired the stash mechanic — the bench (`BenchRenderer`) is now the sole bomb-storage UI. Hid the empty stash rings (the "ghost slots" that rendered above the bench tray) in both `Shooter3D` (3D `ringMesh`) and `ShooterRenderer` (2D fallback), and disabled the stash drop path (`DragDrop._hitTestStashArea` returns false). `_handleStashDrop` left defined but unreachable for reference.
- 2a95fa6 — Bench slots now render the powerball bomb sprite (same art as the live bomb queue) instead of the old shooter-idle robot; added `POWERBALL_URLS` to the Pixi preload manifest. Also removed the combo music speed-up: `AudioManager.updateMusicPhase` now plays one steady `gameplay_calm` track all level (no calm→pressure→climax escalation).
- 45b2b8e — Multi-kill popup celebration: warm radial-gradient burst behind a large, tier-coloured kill count (2× gold `#FFD700`, 3× orange `#FF8C00`, 4×+ red/pink `#FF1744`) with a spring scale-pop entry (0.7→1.0, ~120ms). Fired from the existing multi-kill trigger through `PopupQueue`; `_fx.multiKill(n)` dev hook added for capture.
- f47a988 — Bench Fix A+B. A: unified the bench gate so the input hit-test respects the renderer's visibility (`DragDrop._hitTestBenchArea` returns false when the bench is hidden — no more consuming bombs into an invisible bench). B: gave the empty bench tray a visible dark panel and raised empty-slot opacity (14%→35%) so it reads as a storage area.
- 00486f8 — Impact explosion X now uses `PositionRegistry.getLaneScreenX` (active lane count) instead of the hardcoded 4-lane `laneCenterX`, fixing the 2D impact VFX landing left of the car on 1/2/3-lane levels (it was ~106px off at lane 0 on 2-lane levels).
- 2baf790 — Bench now unlocks at L4 (was L6): moved the visibility gate (`benchUnlocked`), the "Bench unlocked" FTUE banner, and the bench tutorial (`UNLOCK_LEVELS`) all to L4.
- 67716ea — Booster redesign: removed SWAP entirely and replaced it with a COLOR CHANGE booster (tap a car → pick a color → all on-screen cars of that color recolor; `ColorPicker.js`). Added a free RETRY to the rescue overlay (`RescueOverlay.js`). Fixed the rescue bug where the board resumed depleted — the breach skipped the lane/column refill — via `GameLoop.prepareForRescue()`. Car-type intro cards now only show when a car of that type is visible on the road, with a minimum of 3 grid advances between cards. Added a pre-level "Power Up?" ad screen (`PreLevelScreen.js`). Booster counts now reset to 0 each level. COLOR CHANGE is earned at a per-level coin threshold; FREEZE on a 3+ car chain kill. +9 regression tests (`tests/booster-colorchange.test.js`).
- 4b21d69 — Bomb now travels from the player's release point to the target car (ease-in lerp across the road plane + sine throw-arc) instead of dropping from above.
- e8a4470 — Updated CLAUDE.md test count (478 → 633) and test command (`npm test` → `npx vitest run`).
- c73b384 — Added 173-test regression suite covering level start contracts, shot resolution rules, and level goal reachability across all 40 levels.
- c8319c3 — Compressed all 73 sprites from 46MB to 1.84MB, reducing mobile cold load from roughly 15s to 1-2s.
- 3e48f52 — Made sprite loading resilient with `Assets.load` allSettled behavior, so one missing cosmetic sprite no longer blanks the whole game scene.
- ef67720 — Fixed UI audit issues: LEVEL COMPLETE clipping, rainbow bomb size, color bomb single advance, em-dash banners, and lose screen polish.
- c44d8b0 — Wired win screen stats so coins earned and best combo now show real level values.
- 75aa10a — Added live privacy policy page at `/lane-defense/privacy.html`.
- 6b3b734 — Fixed production placeholder bug by deploying tree, grass, and panel sprites that were previously gitignored and 404ing on the live site.
- dd972d1 — Renamed Android package ID to `com.nadavw.trafficbomb`.
- e769f66 — Changed app display name from Lane Defense to Traffic Bomb.
- 3b37318 — Removed obsolete bike-processing scripts that did not generate any live game sprites.
- b4617f5 — Ignored one-off screenshot and inspection scripts so throwaway tooling stays out of commits.
- 87afc96 — Preserved reusable sprite-processing scripts for live vehicle assets.
- 786469f — Ignored Codex/agent local artifacts and review folders so assistant workspace files stay out of git.
- a9670ee — Removed stale tracked level screenshots from the repository.
- d41899f — Upgraded Tutorial City visuals with warm building sprites, cleaner building detail, and park-style grass beside the bomb zone.
- 5953ac1 — Centered the road line correctly and made L1 trees fit better between tutorial buildings.
- 76c3ba1 — Replaced the segmented breach marker with one bold hazard stripe.
- c3242f5 — Added clearer onboarding modal cards and fixed input/z-order behavior.
- d4748d3 — Fixed L1 car centering, made FREEZE turn-based (1 shot), fixed color-bomb explosion targeting, changed color bomb to 5-correct-shot streak reward.
- 49e9799 — Ignored raw sprite sources and dev-server logs.
- 62038ac — Rebalanced all 40 levels around discrete turn-based play (ltcc 1/boss-3/else-2, gridRows=11).
- d64ec71 — Removed simulator free-kill shortcut that caused stalls.
- 2fcec17 — Made balance simulator turn-based and speed-agnostic.
- d0a2ac6 — Fixed simulator to respect each level's actual lane counts.
- 1ca6d60 — Added full 40-level balance sweep tool.
- 34a7de3 — Corrected simulation movement to advance per correct shot.
- e059155 — Renamed player-facing "shooter" language to "bomb."
- 53c28fd — Improved level select: title spacing, city buildings, map paths.
- e478ec6 — Added real booster bar icons and readable labels.
- 59b3df2 — Fixed win/lose screens: button overlap, background dimming, toast layering.
- 923b811 — Added world-specific building sets for tutorial, industrial, and night themes.
- 80049ce — Added per-color tank sprites for visual color matching.
- e101c08 — Unified grid to 11 rows, 1-car opening, updated discrete sim model.
- 4d26d8b — Fixed shared stash so any bomb can go in any stash slot, usable on any lane.
- 168c5ca — First major visual/balance batch: city edges, bomb zone panel, car centering, color bomb visuals.

## IMMEDIATE PRIORITIES (next session, in order)
1. On-device smoke test: COLOR CHANGE consecutive-combo earn, bench storage, multi-kill popup tiers, explosion centering, Power Up screen.
2. Lane drop hit-test investigation — bomb reported landing in the wrong lane (upper portion of lane). Static review found the column→lane path coordinate-correct (InputManager maps client→stage correctly, offset 0, lane via PositionRegistry); needs device data to confirm/repro.
3. Agent-team quality audit (Royal Match standard).
4. Real-device playtest checklist: L8, L12, L16, L33, L37 + bosses L10/20/30/40.
5. Signed AAB build.
6. Play Store assets + submission.

## Active Backlog
- Replace COLOR CHANGE placeholder glyph with a real paintbrush sprite (drop `public/sprites/designed/booster-colorchange.png` — picked up automatically; also add it to BOOSTER_URLS preload in GameApp.js once it exists)
- Real-device playtest: Tier 1 floor levels L8/L12/L16/L33/L37 and bosses L10/L20/L30/L40
- Signed AAB build for Play Store
- Play Store assets (5 screenshots, feature graphic, short + long descriptions)
- Agent team quality audit (next session)
- AdMob integration — verify on real device
- Higgsfield gameplay trailer
- feature/sprites remote branch can be deleted (same SHA as master, kept as safety bookmark)
- Level select scaffolding buildings too visually busy at small size — simplify in-progress state
- Sprite compression script (`scripts/compress-sprites.mjs`) — rerun if new sprites are added to `public/sprites/designed/`
- Regression suite now at 642 tests — run before every APK build

## Known Design Decisions (locked — do not change without Claude Chat)
- No HP bars on cars (VISION.md)
- Color bomb earned via 5 consecutive correct shots
- laneTargetCarCount: 1 (L1) / 3 (bosses L10/20/30/40) / 2 (all others)
- gridRows=11 unified across all 40 levels
- Sim = competent tool-less floor; boosters lift real play above numbers
- speed.base is vestigial (turn-based game, no clock)
- Wrong shots are free (no penalty) — skill = planning, not accuracy
- `Assets.load` uses allSettled — cosmetic sprites degrade gracefully, critical sprites (cars/bombs/boosters) gate `spriteFlags.loaded`
- Regression suite covers all 40 levels — do not change laneTargetCarCount, gridRows, car intro ordering, or color bomb behavior without updating regression tests
- SWAP booster removed — replaced by the COLOR CHANGE booster (tap a car, then pick a color; all on-screen cars of that color recolor)
- Boosters reset to 0 at the start of every level — they do NOT carry over. Starting boosters come only from in-game earns or the pre-level "Power Up?" ad screen
- COLOR CHANGE is earned by chaining TWO strictly-consecutive multi-kills (2+ cars each, on back-to-back shots) via `GameLoop._updateColorChangeCombo`. No coin threshold; can be earned multiple times per level. (Replaced the old per-level coin threshold this session — 4a707ce.)
- FREEZE is earned on a 3-car chain kill (a single shot that destroys 3+ cars via carry-over)
- BOMB booster and rainbow COLOR BOMB are TWO DISTINCT SYSTEMS — do not conflate:
  - **BOMB booster** — earned at **10 total kills** this level (`gs.killsTowardBomb` counter; +1 per kill, charge every 10). Activates to clear a lane (AOE).
  - **Rainbow COLOR BOMB** (a queue item, not a booster) — earned after **3 banked multi-kills** (`gs.multiKillCount`; a multi-kill = 2+ cars destroyed in one shot). When fired it clears every car of one colour (hits any colour car).

## Tool Workflow
- Claude Chat: design judgment, visual approval, prompts, roadmap
- Claude Code: implementation, screenshots, commits (approval required)
- Codex: read-only audits, verification, SESSION_HANDOFF updates (approval required)
- Rule: nothing commits without Claude Chat approval
- Screenshots before every visual commit

## Key Files
- src/renderer/CityEdges.js — city edges, buildings, trees, park grass
- src/renderer3d/Car3D.js — car sprites, lane centering, laneCount
- src/renderer3d/Road3D.js — road geometry, breach line, center line
- src/renderer3d/Shooter3D.js — bomb zone, stash slots, color bomb visuals
- src/renderer/HUDRenderer.js — HUD elements
- src/renderer/BoosterBar.js — booster icons, labels, counts
- src/screens/WinScreen.js — win/lose modals
- src/screens/LevelSelectScreen.js — level map
- src/game/LevelManager.js — level configs, balance (40 levels)
- src/director/CarTypes.js — car types, HP, weight bands
- tools/balance-sweep.mjs — full 40-level balance sweep (reusable)
- src/simulation/SimulationRunner.js — discrete per-shot sim, speed-agnostic
- scripts/compress-sprites.mjs — rerun after adding new sprites
- tests/regression-level-start.test.js — level config contracts
- tests/regression-shot-contract.test.js — shot rule contracts
- tests/regression-level-goals.test.js — goal reachability
