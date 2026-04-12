# Lane Defense — Project Context

## What This Is
A hybrid-casual mobile puzzle game. Split-screen: top half has 4 lanes of advancing color-coded cars, bottom half has 4 columns of color-coded shooters. Player drags shooters to lanes to destroy cars before they breach. Color must match for damage. Survive the timer to win.

## Core Documents
- docs/GDD_v1.0.docx — Full game design document (32 sections)
- docs/DirectorSpec_v1.0.docx — Director algorithm specification (15 sections)
- docs/Phase2_Architecture_v1.0.docx — PixiJS renderer and interaction architecture
- docs/Levels_1-20_v1.0.docx — Level configs with JSON-ready data
- All are the source of truth. If this file conflicts with the docs, the docs win.

## Current Phase
**Phase 2: PixiJS Renderer** — Building the visual game client on top of the validated Director module.

Phase 1 (Director) is COMPLETE. All metrics validated:
- Win rate: 79.4% (target 70-80%)
- Carry-over rate: 15.9% (target 15-20%)
- CRISIS triggers: 1.71/level (target 1-3)
- 391 tests passing

## Number Scale (v1.1 — FINAL)
- Shooter damage: **2-8**
- Car HP: **4-20** (carry-over bait cars: HP 1-2)
- BASE_HP: **11.5** (before world/phase multipliers)
- Carry-over pair interval: **every 3-7 normal cars**
- Fire duration: **1.5-2.5 seconds**
- Colors: 6 total (Red, Blue, Green, Yellow, Purple, Orange). Levels use subsets.
- Lane distance: 100 units. Car speeds: 5-9 units/sec by world.

## Color Palette
- Red: #E24B4A
- Blue: #378ADD
- Green: #639922
- Yellow/Gold: #EF9F27
- Purple: #7F77DD
- Orange: #D85A30

## 5 Fairness Rules (NEVER VIOLATE)
1. **FR-1**: At least 1 top shooter must color-match at least 1 front car at all times.
2. **FR-2**: At most 3 of 4 front cars can share the same color.
3. **FR-3**: Average shooter damage >= 50% of average front car HP.
4. **FR-4**: No car HP exceeds 2.5x the highest available shooter damage.
5. **FR-5**: At least 2 distinct colors in the top shooter row.

## Director State Machine
CALM -> BUILD -> PRESSURE -> CLIMAX -> RELIEF
- Phase transitions interpolate over 3 seconds (no sudden spikes).
- CRISIS assist: 70% probability, 15s cooldown, requires player activity (2+ deploys in 10s).
- Silent Difficulty Reduction: -10% at 3 fails, -20% at 5 fails, -30% at 8 fails.

## Renderer Rules (Phase 2)
- Renderer NEVER modifies game state. It reads GameState, never writes.
- Director NEVER creates display objects. It writes commands.
- Commands flow: Input -> Logic -> Director -> Combat -> State -> Render.
- All animations use ease-out. No linear transitions.
- Prototype uses programmatic graphics (colored shapes). No sprite assets yet.
- Target: 390x844 portrait, scale to fill.
- Fixed timestep: logic at 60fps, render at display refresh rate.
- Deploy time dilation: all cars slow to 60% for 0.3s on every shooter deploy.

## Screen Layout
- HUD bar: 0-44px (timer, coins, combo)
- Lane area: 44-504px (4 lanes, 115px each)
- Divider: 504-520px
- Shooter area: 520-760px (4 columns)
- Booster bar: 760-800px
- Safe area: 800-844px

## Layer Hierarchy (PixiJS Containers, draw order)
0. backgroundLayer — sky, city silhouette
1. laneLayer — road surfaces, lane dividers, endpoints
2. carLayer — car sprites, HP bars
3. shooterColumnLayer — shooter columns (bottom screen)
4. activeShooterLayer — shooters currently firing
5. particleLayer — particles, damage numbers
6. hudLayer — timer, combo, score
7. dragLayer — shooter being dragged (always on top)

## Touch Input
- Primary: drag shooter from column to lane
- Max 50ms input-to-visual latency
- Valid lane drop: shooter flies to position (100ms tween)
- Invalid drop: shooter snaps back (150ms bounce)
- Quick-tap shortcut: tap shooter then tap lane (post-FTUE only)

## Phase 2 Build Order
1. GameApp + LayerManager + LaneRenderer (DONE)
2. CarRenderer + car advance animation
3. ShooterRenderer + column display
4. InputManager + DragDrop
5. GameState + GameLoop + Director integration
6. CombatResolver + deploy action
7. HUD (timer, combo)
8. Win/Lose/Rescue screens
9. ParticleSystem + damage numbers
10. Audio (5 core sounds)
11. FTUE (4 tutorial levels)
12. Deploy to GitHub Pages

## Phase 2 Dependencies
- PixiJS v8 (installed)
- Howler.js (installed)
- Vite (installed)

## Project Structure
```
lane-defense/
├── CLAUDE.md
├── package.json
├── vite.config.js
├── index.html
├── src/
│   ├── director/          <- Phase 1 COMPLETE, do not modify
│   ├── models/            <- Phase 1 COMPLETE, do not modify
│   ├── simulation/        <- Phase 1 COMPLETE, do not modify
│   ├── utils/             <- Phase 1 COMPLETE, do not modify
│   ├── renderer/          <- Phase 2 NEW
│   │   ├── GameApp.js     (DONE)
│   │   ├── LayerManager.js (DONE)
│   │   ├── LaneRenderer.js (DONE)
│   │   ├── CarRenderer.js
│   │   ├── ShooterRenderer.js
│   │   ├── ParticleSystem.js
│   │   ├── HUDRenderer.js
│   │   └── ComboDisplay.js
│   ├── input/             <- Phase 2 NEW
│   │   ├── InputManager.js
│   │   └── DragDrop.js
│   ├── game/              <- Phase 2 NEW
│   │   ├── GameLoop.js
│   │   ├── GameState.js
│   │   ├── CombatResolver.js
│   │   └── LevelManager.js
│   ├── audio/             <- Phase 2 NEW
│   │   └── AudioManager.js
│   └── screens/           <- Phase 2 NEW
│       ├── TitleScreen.js
│       ├── LevelScreen.js
│       ├── WinScreen.js
│       ├── LoseScreen.js
│       └── RescueOverlay.js
├── tests/
├── docs/
└── public/audio/
```

## Coding Preferences
- **Pure JavaScript** (no TypeScript for v1).
- **ES modules** (import/export). Node 18+.
- **No frameworks** for game logic. Plain classes, plain functions.
- **Test-first** where possible. Use Vitest.
- **Single-concern modules**. One class per file.
- **Explicit over clever**. Readable code beats compact code.
- **Comments explain WHY, not WHAT**.

## What NOT To Build Yet
- Real art assets / sprites (Phase 3)
- Booster UI and shop (Phase 3)
- Meta screens (world map, progression) (Phase 3)
- Firebase / backend / saves (Phase 3)
- Monetization / ads integration (Phase 3)
- Capacitor / mobile packaging (Phase 4)

## GDD Key Rules
- **Combo rewards**: 3 kills = 1.2x speed 4s +3 coins | 5 kills = 1.4x speed 5s +8 coins | 8 kills = 1.6x speed 6s +15 coins | 12+ kills = 2.0x speed 8s +25 coins
- **Rescue**: +10 seconds, push cars past 75% back to 50%, available once per attempt via ad or 50 coins
- **Boss levels**: single boss car, 3-5x HP, 0.6x speed, color cycles every 6s, spawns at 60% timer mark
- **Stars**: 1 star = survived | 2 stars = no car past 80% | 3 stars = no car past 60%
- **Boosters**: Swap (level 8), Peek (level 12), Double Time (level 18), Joker (level 25), Bomb (level 35)
- **Wrong color**: 0 damage in World 1-2; interference slowdown 20% from World 3+
- **Shooter fire duration**: damage 2=1.5s, 3=1.7s, 4=1.9s, 5=2.0s, 6=2.2s, 7=2.3s, 8=2.5s

## Communication Style
- Be direct. No enterprise theater.
- If something in the spec seems wrong, say so and propose a fix.
- When running simulations, show the data first, then interpret.
- Flag any edge case where a fairness rule might be violated.

## Token Rules
- Use /clear between unrelated tasks
- Use /compact when context gets long
- Default model: sonnet. Use opus only for complex architecture
- Batch multiple tasks into single prompts
- Name exact files to modify, don't explore
