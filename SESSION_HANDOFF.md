# Lane Defense — Session Handoff

## Current State
- Git tip: 3b37318 chore: remove dead bike pipeline scripts
- Branch: master
- Last deploy: today, green
- Tests: 461 passing, 5 todo
- Live URL: https://nadavw9.github.io/lane-defense/

## What Was Shipped This Session (most recent first)
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

## Active Backlog
- Real-device playtest checklist: Tier 1 floor levels L8/L12/L16/L33/L37 and bosses L10/L20/L30/L40
- Win/lose screen stats showing zeros (coins +0, combo x0) — scoring not hooked up
- Rainbow bomb slightly larger than regular bombs — normalize size
- AdMob integration — verify on real device
- Signed APK / AAB release build
- Play Store assets (5 screenshots, feature graphic, short + long descriptions)
- Higgsfield gameplay trailer
- feature/sprites remote branch can be deleted (same SHA as master, kept as safety bookmark)
- Level select scaffolding buildings too visually busy at small size — simplify in-progress state

## Known Design Decisions (locked — do not change without Claude Chat)
- No HP bars on cars (VISION.md)
- Color bomb earned via 5 consecutive correct shots
- laneTargetCarCount: 1 (L1) / 3 (bosses L10/20/30/40) / 2 (all others)
- gridRows=11 unified across all 40 levels
- Sim = competent tool-less floor; boosters lift real play above numbers
- speed.base is vestigial (turn-based game, no clock)
- Wrong shots are free (no penalty) — skill = planning, not accuracy

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
