# Lane Defense — Project Context

> **For Claude Code: this file is auto-loaded. Read fully before any task.**
> If you're a fresh Claude reading this, this is the canonical state of the project.

## What This Is
A hybrid-casual mobile puzzle-defense game. Cars in colored lanes advance toward the player. Player drags color-coded "bombs" onto lanes — color must match the front car for damage. Survive the level's car queue.

- **Live URL:** https://nadavw9.github.io/lane-defense/
- **Repo:** https://github.com/nadavw9/lane-defense (public)
- **Capacitor APK:** built locally for testing
- **Firebase analytics DB:** https://lanedefense-analytics-default-rtdb.firebaseio.com/

## Current Phase: Phase 3 — Polish & Production

Phase 1 (Director) and Phase 2 (PixiJS renderer) are done. Phase 3 introduced a full Three.js 3D rewrite for gameplay (the road, cars, bombs, environment). PixiJS still owns screens, HUD, and 2D overlays. Both renderers run in the same canvas pipeline.

## CRITICAL: Design Philosophy (READ THIS BEFORE TOUCHING UI)

This game must look and feel like a **top-tier mobile hit** — Royal Match, Color Block Jam, Block Blast, Toon Blast, Subway Surfers tier. NOT a hobbyist project.

**Mandate for every visual change:**
- Be a designer, not just an implementer. If a feature requires a structural rewrite to look right, REWRITE it. Do not patch.
- No "good enough." If something looks amateur, it IS amateur. Fix it properly.
- Don't preserve existing implementations out of inertia. Replace them when needed.
- Reference real top-100 games for visual standards. If unsure, ask: "would Royal Match ship this?"
- Bold colors, clear hierarchy, satisfying micro-animations, instant-readable iconography, no clutter.
- Cards/buttons/badges must have proper rounded corners (10-14px), drop shadows, gradient fills, NOT flat hex colors with thin borders.
- Typography: bold, high-contrast, large enough to read in daylight on a phone outdoors. Default to 18pt+ for any UI text.
- Animations: every interaction has feedback (scale, glow, particle, sound). No silent transitions.

**You are FULLY AUTHORIZED to make major rewrites without asking permission.** When given a polish task, the question to ask is "what would a senior mobile game UI designer at King/Playrix/Voodoo do?", not "what's the smallest patch to existing code?"

## Architecture

### Director / Renderer separation
- `src/director/` — headless game brain. Never imports pixi.js or three.js.
- `src/renderer/` — PixiJS 2D — owns screens, HUD, bench, drag-drop, all 2D UI.
- `src/renderer3d/` — Three.js 3D — owns gameplay viewport.
- `src/game/` — glue: GameLoop, GameState, CombatResolver, LevelManager.
- `src/screens/` — all menu/dialog screens.
- `src/input/` — DragDrop and pointer handling.
- `src/audio/` — procedural Web Audio music & SFX.
- `src/ads/` — AdMob stubs.
- `src/analytics/` — Firebase analytics + auto-tuning.
- **Director never modifies render objects. Renderer never mutates GameState.**

### Two renderers, one canvas stack
- The PIXI canvas and the Three canvas overlay each other. Three.js is z-stacked behind PIXI.
- 3D Scene3D uses TWO cameras:
  - Perspective camera for road/cars
  - Orthographic top-down camera on layer 1 for bomb columns
- The 2D LaneRenderer and ShooterRenderer (PIXI) are HIDDEN during gameplay (legacy from Phase 2). Their constants are still exported for hit-testing math.

### Position Registry (CRITICAL — do not bypass)
- **`src/renderer/PositionRegistry.js`** is the single source of truth for lane/column screen positions.
- API: `setActiveCounts({laneCount, colCount})`, `getLaneScreenX/Y`, `getColumnScreenX/Y`, `getLaneScreenBounds`, `getColumnScreenBounds`.
- Called from `GameApp._startLevel()` BEFORE renderers initialize.
- ALL lane/column hit-testing and overlay positioning MUST use the registry. Hardcoded `COL_W * 0.5` is forbidden.

### Sprite paths
Always use `${import.meta.env.BASE_URL}sprites/...`. Hardcoded `/sprites/...` causes GH Pages 404 — silent crash.

### 3D Scene Layout
- Road runs from Z = ROAD_Z_VANISHING (-65, distant horizon) to Z = ROAD_Z_NEAR (0, breach line).
- Gameplay zone: Z = ROAD_Z_SPAWN (-22) to Z = ROAD_Z_NEAR (0). Cars only exist in this range.
- Lane width = 4.0 world units. Road extends `n*2.0 + 0.4` from center.
- For 4 lanes: lanes at X = -6, -2, +2, +6.
- Camera: position (0, 5.5, 12), lookAt (0, 0, -6).
- Start-gate (boom-barrier style) opens at level start; cars enter from beyond it with stagger.

### Theme System
- `src/renderer3d/ThemeRegistry.js` defines per-level visual themes.
- Levels 1-20 = "woods" theme family with sub-variants (morning/afternoon/sunset/misty/autumn).
- `getThemeForLevel(levelNum)` — variant.
- `GameRenderer3D.applyTheme(...)` wires colors to Skybox3D, Scene3D fog, Lighting3D, Environment3D.

### Popup Queue (CRITICAL)
- `src/renderer/PopupQueue.js` is the centralized priority queue for ALL popups/banners/toasts.
- Priorities (highest first): CRITICAL, TUTORIAL, CAR_TYPE, ACHIEVEMENT, COMBO, AMBIENT.
- Concurrent limits: AMBIENT can stack 3, others 1.
- 0.4s debounce between non-AMBIENT popups.
- Migrate any new popup through this queue. No ad-hoc spawning.

## Test Suite
- **448 tests passing**, 5 todo, 2 skipped — total 455
- Run: `npm test`
- All tests are headless (Director/GameLoop/GameState level). No render tests.
- CI runs tests on every push via `.github/workflows/deploy.yml`. Failed tests block deploy.

## Build & Deploy
- `npm run dev` — local Vite dev server with `--host` for phone access
- `npm run build` — production build into `dist/`
- Push to master — GitHub Action runs tests — deploys to GH Pages — live in ~60s
- Workflow: https://github.com/nadavw9/lane-defense/actions

## Number Scale (FINAL)
- Shooter (bomb) damage: 2-8
- Car HP: typed (small=2, big=4, jeep=5, truck=6, tank=20)
- Lane distance: 100 units (logical), mapped to world Z by posToZ
- Grid rows: 10 (cars advance 1 row per shot, regardless of damage outcome — `_advanceGrid()` always runs)
- Per-level type distribution in `src/director/CarTypes.js` `pickCarType()`

## Color Palette
- Red: #E24B4A
- Blue: #378ADD
- Green: #639922
- Yellow: #EF9F27
- Purple: #7F77DD
- Orange: #D85A30

Duplicated in `src/renderer3d/Shooter3D.js`, `Projectile3D.js`, `Car3D.js`, `src/input/DragDrop.js`. Update all four if changing.

## Fairness Rules (Director enforces — never violate)
1. FR-1: At least 1 top shooter must color-match at least 1 front car.
2. FR-2: At most 3 of 4 front cars can share the same color.
3. FR-3: Average shooter damage >= 50% of average front car HP.
4. FR-4: No car HP exceeds 2.5x the highest available shooter damage. Tank (HP=20) only spawns when shooter pool includes damage 8+.
5. FR-5: At least 2 distinct colors in the top shooter row.

## Director State Machine
CALM → BUILD → PRESSURE → CLIMAX → RELIEF
- 3s phase transition interpolation
- CRISIS assist: 70% probability, 15s cooldown, requires 2+ player deploys in 10s
- Silent Difficulty Reduction: -10% at 3 fails, -20% at 5 fails, -30% at 8 fails

## L1 Tutorial (FTUE)
- Pre-placed cars: rows 0/2/4/6 (so player sees progression)
- Animated hand demo (`TutorialHand.js`) shows pickup → drag → drop, repeating until first user touch
- Bottom banner: "Drag bombs to matching cars!"
- L2: color-match hint banner (auto-fade)
- L3: area labels for "↑ INCOMING CARS" / "↓ YOUR SHOOTERS" (auto-fade 6s)
- Boosters: `BoosterSpotlight.js` — first time each booster appears, darken background, spotlight icon, animated demo

## Conversation Continuity Note
Before this fresh session, we shipped a long sequence of polish work. Key recent context:
- Lane width was widened from 3 → 4 world units (issueN)
- Road was extended to vanishing point with start-gate animation (issueM)
- Car-type callouts (3D Sprites above cars) have been REMOVED — they were too small at distance. A proper boss-style intro reveal is planned as a future 2D PixiJS overlay instead.
- HUD got a major overhaul (issueQ): progress bar, combo gauge, multiplier badge, lane dots, dimmed bench, white-pill bomb badges, gold target-reach flash.
- Per-type 3D car geometry shipped (bugK): each of 5 types has distinctive shape (small=compact, big=sedan, jeep=SUV with roof rack, truck=cabin+bed, tank=treads+turret).

The user has expressed strong feedback that **the visual quality is not yet at top-mobile-game level**. Treat any UI/visual task with maximum design ambition. The user explicitly asked us to "put the designer's hat on" and stop being afraid of major changes.

## Open Visual Issues (priority order)
1. Car-type intro UX: callouts removed. Future design: brief 2D PixiJS overlay (boss-style reveal) when a new car type first appears. Should be large, readable, dramatic — not a tiny 3D sprite.
2. Other small white floating texts during gameplay are confusing — audit each one and decide: remove, redesign, or keep.
3. Visual quality vs Royal Match still has gaps — every UI surface (cards, buttons, badges, banners, score numbers) needs a designer pass.

## Active TODOs (Priority Order)

### Visual / UX iteration (current focus)
- Designer-tier rewrite of car-type intro UX (2D PixiJS overlay, not 3D sprite)
- Audit & cleanup of all in-game floating texts
- Continue raising bar to top-game tier

### Production gates (NOT YET STARTED)
- AdMob (`@capacitor-community/admob`) — rewarded on Rescue, interstitial after Lose
- Signed release keystore + APK
- Play Store listing — screenshots, feature graphic, privacy policy, Data Safety form
- Closed test track ≥12 testers × 14 days

### Architecture nice-to-haves (lower priority)
- Zod schema validation for `levels/*.json` at build time
- `tools/balance-sim.ts` — headless N-run balance simulator
- Typed event channels instead of ad-hoc callbacks

## Coding Preferences
- Pure JavaScript (no TypeScript for v1)
- ES modules. Node 18+ (CI pinned at Node 24)
- No frameworks for game logic. Plain classes, plain functions
- Single-concern modules. One class per file
- Explicit over clever. Comments explain WHY, not WHAT
- No emojis in commit messages
- Inline styles for HTML-based UI; no Tailwind compile step
- Hebrew/RTL support where relevant

## Communication Style
- Direct. No enterprise theater. No sprint ceremonies.
- If a spec seems wrong, say so and propose a fix.
- After completing a batch, post (a) every file touched grouped by issue, (b) judgment calls, (c) any test changes.

### MANDATORY: Self-Audit Before Every Commit

Before pushing ANY commit that touches visual/gameplay code:
1. Run `npm run dev` and open the game in a browser.
2. Navigate to L1, L4, L8, and L13 and observe each visually.
3. Answer these four questions — fix any "no" before pushing:
   - Are car colors vivid and clearly distinct by lane? (not washed-out grey)
   - Are HP indicators legible and visible on every car from the moment it spawns?
   - Do tutorials (FTUE overlays, spotlights) trigger and clear correctly at their intended levels?
   - Do the booster buttons (bench/swap/peek/freeze/bomb) animate and respond correctly?
4. Fix any issues found, then push.

## Visual Audit Required

Every task that changes the 3D scene, HUD, screens, or any visual surface MUST end
with the `lane-defense-audit` skill loop. Do not push without passing it.

The skill automates:
- Spinning up the dev server
- Using Playwright MCP to screenshot L1, L4, L8, L13
- Evaluating each frame against Royal Match / Color Block Jam production standards
- Looping on fixes until all checks pass

Invoke it with `/lane-defense-audit` or ask Claude to run the visual audit.
If Playwright MCP is not available, fall back to manual screenshot review per the
"Self-Audit Before Every Commit" checklist above.

## Token Rules (Claude Code)
- Use `/clear` between unrelated tasks
- Use `/compact` when context gets long
- Default model: sonnet. opus only for complex architecture
- Batch multiple file edits into single prompts
- Name exact files, don't explore unnecessarily
- `.claudeignore` excludes: node_modules, dist, android, .git

## Don't Touch Without Asking
- `src/director/` (448 tests cover it)
- `src/models/` (data classes)
- Vite config base path logic
- BASE_URL sprite path patterns
- Test files (unless adding new or updating assertions)

## Anti-Patterns (Forbidden)
- Spawning popups outside PopupQueue
- Computing column/lane positions without PositionRegistry
- Adding new top-level folders without discussing first
- Band-aid patches when structural fix is right
- Preserving "for compatibility" code that no longer serves a purpose

## Session Management
Reset context hook between sessions (flag lives in OS temp dir):
- Unix/Mac: `rm -f /tmp/lane-defense-handoff-fired.flag`
- Windows:  `del "%TEMP%\lane-defense-handoff-fired.flag"`

---
*Last updated: May 2026 — after callout removal. Update when major architectural changes land.*
