# Lane Defense — Project Context

> **For Claude Code: auto-loaded on every session. Read in full before any task.**

## What This Is

Hybrid-casual mobile puzzle-defense game. Cars in colored lanes advance toward the player one row per shot. Player drags color-coded "bombs" (shooters) onto lanes — color must match the front car to deal damage. Survive the level's car queue without a breach.

- **Live URL:** https://nadavw9.github.io/lane-defense/
- **Repo:** https://github.com/nadavw9/lane-defense (public)
- **App ID:** `com.nadavw.lanedefense` (Capacitor, Android)
- **Firebase analytics DB:** https://lanedefense-analytics-default-rtdb.firebaseio.com/

---

## Tech Stack

| Layer | Library | Version |
|---|---|---|
| 3D gameplay | Three.js | ^0.167.0 |
| 2D UI / screens | PixiJS | ^8.17.1 (devDep) |
| Audio | Howler.js | ^2.2.4 (devDep) |
| Ads | @capacitor-community/admob | ^8.0.0 |
| Native wrapper | @capacitor/android | ^8.3.0 |
| Build | Vite | ^8.0.3 |
| Tests | Vitest | ^4.1.2 |
| E2E | Playwright | ^1.59.1 |
| Language | Pure JavaScript, ES modules, Node 18+ (CI: Node 24) |

---

## Architecture

### Directory layout

- `src/director/` — headless game brain. Never imports pixi.js or three.js.
- `src/renderer/` — PixiJS 2D — screens, HUD, bench, drag-drop, all 2D UI.
- `src/renderer3d/` — Three.js 3D — road, cars, bombs, sky, environment.
- `src/game/` — glue: GameLoop, GameState, CombatResolver, LevelManager.
- `src/screens/` — all menu/dialog/overlay screens.
- `src/input/` — DragDrop and pointer handling.
- `src/audio/` — procedural Web Audio music & SFX.
- `src/ads/` — AdMob wrapper (`AdManager.js`).
- `src/analytics/` — Firebase analytics + auto-tuning.

**Director never modifies render objects. Renderer never mutates GameState.**

### Dual-renderer canvas stack

PixiJS canvas (z-front) overlays the Three.js canvas (z-behind). They share no WebGL context.

Three.js scene uses **two cameras**:
- **Perspective camera** — road, cars, environment. Position `(0, 9, 16)`, lookAt `(0, 0, -8)`, FOV 60°. Set by `CameraFX.js` constructor (overrides Scene3D.js defaults).
- **Orthographic top-down camera** on layer 1 — bomb/shooter columns (Shooter3D.js).

The legacy PixiJS LaneRenderer and ShooterRenderer are **hidden during gameplay**. Their exported constants are still used for hit-testing math.

### 3D Scene Layout

```
Z = -65  ROAD_Z_VANISHING  — visual horizon (no gameplay here)
Z = -40  ROAD_Z_FAR        — road geometry start
Z = -22  posToZ(0)         — car spawn line  (posToZ(p) = -22 + p/100 * 22)
Z =   0  ROAD_Z_NEAR       — breach line (red pulse)
```

- Lane width = 4.0 world units.
- For 4 lanes: X = −6, −2, +2, +6.

### Position Registry (CRITICAL — never bypass)

`src/renderer/PositionRegistry.js` is the single source of truth for lane/column screen positions.

API: `setActiveCounts({laneCount, colCount})`, `getLaneScreenX/Y`, `getColumnScreenX/Y`, `getLaneScreenBounds`, `getColumnScreenBounds`.

Called from `GameApp._startLevel()` BEFORE renderers initialize. All hit-testing and overlay positioning MUST use the registry. Hardcoded `COL_W * 0.5` is forbidden.

### Sprite paths

Always `${import.meta.env.BASE_URL}sprites/...`. Hardcoded `/sprites/...` causes GitHub Pages 404 — silent crash.

### Theme System

`src/renderer3d/ThemeRegistry.js` defines 5 sub-variants of the "woods" theme:

| Levels | Theme | Fog near/far |
|---|---|---|
| L1–4 | morning (cream/gold sky) | 30 / 92 |
| L5–8 | afternoon (deep blue sky) | 38 / 128 |
| L9–12 | sunset (indigo/orange) | 24 / 90 |
| L13–16 | misty (cool grey overcast) | **20 / 70** |
| L17+ | autumn (amber/gold) | 20 / 75 |

Misty fog was fixed to near=20 so cars remain visible throughout the road.

### Popup Queue (CRITICAL)

`src/renderer/PopupQueue.js` — centralized priority queue for ALL popups/banners/toasts.

Priorities (highest first): CRITICAL, TUTORIAL, CAR_TYPE, ACHIEVEMENT, COMBO, AMBIENT.  
0.4s debounce between non-AMBIENT popups. AMBIENT can stack 3; others: 1 concurrent.

All new popups must go through this queue. No ad-hoc spawning.

---

## Current Phase: Phase 3 — Polish & Production

Phase 1 (Director) and Phase 2 (PixiJS renderer) are done. Phase 3 introduced the full Three.js 3D rewrite for the gameplay viewport. PixiJS still owns all screens, HUD, and 2D overlays.

---

## Design Philosophy

This game targets **top-tier mobile hit** quality — Royal Match, Color Block Jam, Block Blast tier.

- Be a designer, not just an implementer. If something looks amateur, fix it structurally.
- Bold colors, clear hierarchy, satisfying micro-animations, instant-readable iconography, no clutter.
- Cards/buttons/badges: proper rounded corners (10–14px), drop shadows, gradient fills.
- Typography: bold, high-contrast, ≥18pt for any UI text.
- Every interaction has feedback (scale, glow, particle, sound).
- Ask "would Royal Match ship this?" before any visual decision.

---

## Visual Design Contract

- Car colors are vivid at ALL damage levels. No HP darkening. Damage is shown by emissive orange/red glow + slight rotation tilt only.
- Shooter (bomb) colors: candy-bright MeshStandardMaterial with emissive boost.
- Damage number badge: colored pill background + bold white number. No HP bars.
- One dominant background tone per theme (sky, ground, fog all shift toward it at reduced saturation). Hero elements (cars, bombs) always win visual hierarchy.

---

## Gameplay Mechanics

**Turn-based grid**, not real-time movement:

1. Player drags a shooter from a column onto a lane.
2. One projectile fires (0.12s travel time, reduced by combo multiplier).
3. `_advanceGrid()` runs — all cars advance one row toward the breach, regardless of hit/miss/damage.
4. New cars spawn at row 0 (far end). Level ends when budget exhausted AND all lanes empty, or a car reaches row > MAX_ROW (breach = loss).

**Win stars** (`WinScreen.calcStars`):
- 3 stars: no rescue used AND `maxCarPosition < 60`
- 2 stars: no rescue used AND `maxCarPosition < 80`
- 1 star: otherwise (rescue used, or car got too close)

**Bomb mechanic**: earned at every 10 kills (max 3 held). Tap road to place; damages all cars within radius 22 position-units. Triggers 2s concussion freeze.

**FREEZE booster**: skips grid advance for next 3 shots.

**Rescue**: rewarded ad → add time + `shuffleForRescue()` (force ≥2 column tops to match front car colors).

---

## Car Type System

Six types + boss. HP values and spawn schedule:

| Type | HP | First intro level |
|---|---|---|
| small | 2 | L1 |
| big | 4 | L2 |
| jeep | 5 | L5 |
| truck | 6 | L9 |
| bigrig | 7 | L13 |
| tank | 20 | L15 |
| boss | — | special |

`LEVEL_INTRO_TYPE` in `GameApp.js`: `{ 1: 'small', 2: 'big', 5: 'jeep', 9: 'truck', 13: 'bigrig', 15: 'tank' }` — verified against actual code.

**3D geometry source:**
- small, big, jeep, truck, bigrig → Kenney Car Kit GLB models (CC0 licensed, `public/models/`)
- tank → procedural Three.js geometry (box body + cylinder turret + torus treads)
- boss → sphere body + orbiting torus ring

---

## Color Palette

```
Red:    #E24B4A   (0xE24B4A)
Blue:   #378ADD   (0x378ADD)
Green:  #639922   (0x639922)
Yellow: #EF9F27   (0xEF9F27)
Purple: #7F77DD   (0x7F77DD)
Orange: #D85A30   (0xD85A30)
Boss:   #CC44CC   (0xCC44CC)
```

Duplicated in: `src/renderer3d/Shooter3D.js`, `Projectile3D.js`, `Car3D.js`, `src/input/DragDrop.js`. Update all four if changing any color.

---

## Fairness Rules (Director enforces — never violate)

1. **FR-1** At least 1 column top must color-match at least 1 front car (viability guard in `GameLoop._enforceViableMove()`).
2. **FR-2** At most 3 of 4 front cars can share the same color.
3. **FR-3** Average shooter damage ≥ 50% of average front car HP.
4. **FR-4** No car HP exceeds 2.5× the highest available shooter damage. Tank (HP=20) only spawns when damage 8+ shooters are in the pool.
5. **FR-5** At least 2 distinct colors in the top shooter row.

Viability guard also checks **bench slots** (L6+): if a bench shooter matches a front car color, no force-recolor needed.

---

## AdMob Status — IMPLEMENTED (test IDs)

`src/ads/AdManager.js` — singleton, initialized at app startup.

| Ad type | Unit ID (Google test) | Trigger |
|---|---|---|
| Rewarded | `ca-app-pub-3940256099942544/5224354917` | Rescue button on LoseScreen |
| Interstitial | `ca-app-pub-3940256099942544/1033173712` | LoseScreen dismiss (throttled ≥30s between shows) |

**Booster ad costs**: swap=1, peek=1, freeze=1, bomb=3.

**Web fallback**: `_showPlatformAd()` shows a 5-second mock overlay (progress bar + countdown). Not a no-op — it simulates ad completion. Replace `_showPlatformAd()` body with the real SDK call when going live.

**Before release**: replace both `*_AD_ID` constants with production Play Store ad unit IDs.

---

## Production Gates (NOT YET DONE)

- [ ] Replace AdMob test IDs with production IDs
- [ ] Signed release keystore + APK
- [ ] Play Store listing — screenshots, feature graphic, privacy policy, Data Safety form
- [ ] Closed test track ≥ 12 testers × 14 days

---

## Test Suite

- **455 tests passing**, 5 todo, 2 skipped — 16 test files
- Run: `npm test`
- All tests are headless (Director / GameLoop / GameState). No render tests.
- CI runs on every push via `.github/workflows/deploy.yml`. Failed tests block deploy.

---

## Build and Deploy

```bash
npm run dev      # Vite dev server with --host (phone access on LAN)
npm run build    # production build → dist/
```

Push to `master` → GitHub Action → tests pass → deploy to GH Pages → live in ~60s.

Workflow: https://github.com/nadavw9/lane-defense/actions

---

## Token Rules (Claude Code)

- `/clear` between unrelated tasks
- `/compact` when context grows long
- Default model: sonnet. Opus only for complex architecture decisions
- Batch multiple file edits into single prompts
- Name exact files; don't explore unnecessarily
- `.claudeignore` excludes: node_modules, dist, android, .git

---

## Coding Preferences

- Pure JavaScript (no TypeScript)
- ES modules, Node 18+ (CI: Node 24)
- No frameworks for game logic — plain classes, plain functions
- Single-concern modules, one class per file
- Explicit over clever
- No emojis in commit messages
- Inline styles for HTML-based UI (no Tailwind)

---

## What NOT to Touch

- `src/director/` — 455 tests cover it; changes need matching test updates
- `src/models/` — data classes; shape changes cascade everywhere
- Vite config base-path logic
- `BASE_URL` sprite path patterns
- Test files (unless adding new tests or updating assertions to match intentional behavior changes)

---

## Anti-Patterns (Forbidden)

- Spawning popups outside `PopupQueue`
- Computing lane/column positions without `PositionRegistry`
- Adding new top-level `src/` folders without discussing first
- Band-aid patches when a structural fix is correct
- Preserving "for compatibility" code that no longer serves a purpose
- **Do not re-add HP bars to cars** — intentionally removed; damage shown via emissive glow only
- **Do not re-add a start gate above the road** — intentionally removed from Road3D.js
- **Do not add a survival/endless mode** — incompatible with the turn-based grid mechanic; was removed

---

## Mandatory Self-Audit

After **any** commit that touches visual or gameplay code:

1. Run `npm run dev` and open the game in a browser.
2. Playwright-screenshot **L1, L5, L9, L13** (one per theme: morning, afternoon, sunset, misty).
3. Check each frame:
   - Car colors vivid and clearly distinct? (not washed-out or foggy)
   - Cars visible throughout the full road in the misty theme?
   - FTUE overlays / tutorial banners positioned below the road (not covering cars)?
   - Shooter bomb columns rendering correctly in all active lanes?
4. Fix any "no" before pushing.

---

*Last updated: 2026-05-14 — full rewrite from codebase. Previous version had stale camera coords, test count, start-gate reference, and TutorialHand.js filename.*
