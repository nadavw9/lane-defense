# Traffic Bomb — Project Context

> **For Claude Code: auto-loaded on every session. Read in full before any task.**

## 0. ACTIVE WORK — continue from here (any model)

An approved 3-workstream master plan is in progress (WS1 testing DONE → WS2 UI → WS3 difficulty):
1. **Status/tracker:** `docs/superpowers/plans/2026-07-02-master-plan-testing-ui-difficulty.md`
2. **Per-task HOW + work guidelines + model routing + art prompts:** `docs/superpowers/plans/IMPLEMENTATION_PLAYBOOK.md`

Route mechanical spec-execution to cheaper models; reserve Fable/Opus for design judgment
(playbook §2). Every task: vitest green (1062+) + `npm run test:visual` green (17+) before commit.

---

## 1. THE STANDARD

Every visual change must meet **Play Store quality** before being approved. This is a hard gate, not an aspiration.

**Approval process:**
1. Screenshot from **L5 or higher** (never L1 — single lane, not representative)
2. Ask: *"Would a player downloading this from the Play Store think this looks and feels like a professional game?"*
3. If no → keep fixing. Do not commit.
4. Reference bar: **Royal Match, Color Block Jam, Toon Blast.**

---

## 2. NO COMPROMISE ON TOOLS

When the best tool for a task is not available, STOP.
Do not find a workaround. Do not use an inferior alternative silently.

The correct behavior:
1. Stop immediately
2. State clearly: "I need [tool] to do this properly.
   Please install it with: [exact install command]"
3. Wait for the user to install it
4. Only then continue

Examples of what is NOT acceptable:
- sharp not installed → using Playwright to convert SVGs (worse output, fragile)
- canvas not installed → drawing with ASCII art or inline HTML
- Figma tokens exceeded → switching to Canva without asking
- A package missing → rewriting logic to avoid needing it

The user would rather wait 2 minutes to install the right tool
than get a worse result immediately.

This applies to: npm packages, system tools, MCP connections,
API access, or any capability gap.

Exception: if two tools are genuinely equivalent in output quality,
Claude may choose either. But "it works" is not equivalent to
"it produces the best result."

---

## 3. What This Is

Hybrid-casual mobile puzzle-defense game. Cars in colored lanes advance toward the player one row per correct shot. Player drags color-coded bombs onto lanes — color must match the front car to deal damage. Turn-based grid, not real-time. 40 levels across 3 worlds. Live on GitHub Pages; native Android via Capacitor.

- **Live URL:** https://nadavw9.github.io/lane-defense/
- **Repo:** https://github.com/nadavw9/lane-defense
- **App ID:** `com.nadavw.trafficbomb`

---

## 4. Mandatory Reads

Before any design, level, or gameplay change, read these in full:

- `docs/VISION.md` — **locked design contract. Do not modify without explicit user approval.**
- `docs/GAME_DESIGN.md` — level master table, difficulty rules, known bugs
- `docs/balance-report-realistic.md` — difficulty ground truth per level

Files this applies to: `LevelManager.js`, `GameLoop.js`, `ThemeRegistry.js`, `LevelSelectScreen.js`, `CarTypes.js`.

---

## 5. Architecture

### Directory layout

- `src/director/` — headless game brain. **Never imports pixi.js or three.js.**
- `src/renderer/` — PixiJS 2D: screens, HUD, bench, drag-drop, all 2D UI.
- `src/renderer3d/` — Three.js 3D: road, cars, bombs, sky, environment.
- `src/game/` — glue: GameLoop, GameState, CombatResolver, LevelManager.
- `src/screens/` — menu/dialog/overlay screens (PixiJS).
- `src/input/` — DragDrop and pointer handling.
- `src/ads/` — AdMob wrapper (`AdManager.js`).
- `src/analytics/` — Firebase analytics.

**Director never modifies render objects. Renderers never mutate GameState.**

### Dual-renderer canvas stack

PixiJS canvas (z-front) overlays the Three.js canvas (z-behind). They share no WebGL context.

### Camera — single top-down orthographic

One `OrthographicCamera` in `Scene3D.js` renders everything. No perspective camera, no dual-camera setup. `CameraFX.js` wraps the camera for transient juice only (shake, breach zoom pulse, combo zoom-out, level-intro zoom) — steady-state zoom is 1.

### 3D Scene Coordinate System — SINGLE SOURCE: `src/renderer3d/projection.js`

```
Z = -26  ROAD_Z_FAR   — car spawn line (far/top of screen)
Z = -2.6 POS_NEAR_Z   — position-100 car stop line (front car anchor)
Z =   0  ROAD_Z_NEAR  — breach line (3D stripe anchor)
Z = +1.4 to +7.0      — bomb queue slots (Shooter3D slotZ = (s+0.5)·CELL·0.70)
Z = -65  ROAD_Z_VANISHING — visual road extension (no gameplay)
```

Lane width = `CELL = 4.0` world units. For 4 lanes: X = −6, −2, +2, +6.

**All world↔screen math lives in `src/renderer3d/projection.js`** (pure, no Three/Pixi — safe for tests and input code). The camera, PositionRegistry, roadGeometry, CityEdges, and ShooterRenderer all derive from it. **NEVER hardcode a projected value** (a stale `FRUSTUM_HALF_X = 9.650` mirror once shifted every 2D overlay/tap anchor ~17px; the visual harness caught it). `laneToX(idx, n)` / `posToZ(position)` (Scene3D) and `worldXToScreenX` / `zToScreenY` / `posToScreenYProjected` (projection.js) are the only correct ways to compute positions.

### Position Registry (CRITICAL — never bypass)

`src/renderer/PositionRegistry.js` is the single source of truth for lane/column screen positions. Called from `GameApp._startLevel()` before renderers initialize. All hit-testing and overlay positioning must use the registry.

### Popup Queue

`src/renderer/PopupQueue.js` — all popups/banners/toasts route here.  
Priorities (highest first): CRITICAL, TUTORIAL, CAR_TYPE, ACHIEVEMENT, COMBO, AMBIENT.  
**No ad-hoc popup spawning.** Ever.

### Sprite paths

Always `${import.meta.env.BASE_URL}sprites/...`. Hardcoded `/sprites/...` causes GitHub Pages 404.

### Themes (ThemeRegistry.js)

| Levels | Theme | Notes |
|--------|-------|-------|
| L1–4   | morning | warm cream-gold |
| L5–8   | afternoon | deep blue sky |
| L9–12  | sunset | indigo-orange |
| L13–15 | misty | cool grey; fog near=20 minimum — do not lower |
| L16–30 | industrial | steel grey + orange hazard (World 2) |
| L31+   | nightHighway | near-black sky, neon fog (World 3) |

---

## 6. Current State

### Tests
**633 passing**, 5 todo — 18 test files. Run: `npx vitest run`. All headless (no render tests).

### What is done
- **40 levels** configured in `LevelManager.js` (L1–L40, three worlds)
- **Car type intro cards** (`src/screens/CarTypeIntroCard.js`) — fires at: L1 small, L2 big, L5 jeep, L9 truck, L13 bigrig, L15 tank
- **Streak Shot** — `streakCount` + `streakActive` in `GameState.js`; 3 consecutive correct hits → double-damage power shot
- **AdMob** — `src/ads/AdManager.js` with Google **test** IDs for rewarded video and interstitial
- **Signed release keystore** — `android/lane-defense-release.keystore` (gitignored). **Never delete.**
- **Balance simulator** — `tools/balance-sim.js`
- **Car rendering** — flat `PlaneGeometry` + `CanvasTexture` + `MeshBasicMaterial`. No GLB models.
- **Danger Aura** — red pulse on cars within 2 rows of breach gate
- **Fairness rules** (FR-1 through FR-5) enforced in `GameLoop._enforceViableMove()`
- **Wrong-color shot = no advance** (shipped — never revert)
- **Bomb hits color-matching cars only** (shipped — never revert)

### What is NOT done (production gates)
- Replace AdMob test IDs with production unit IDs
- Signed release APK for Play Store
- Play Store listing (screenshots, feature graphic, privacy policy, Data Safety form)
- Closed test track ≥ 12 testers × 14 days
- World 2 / World 3 themes exist in ThemeRegistry; their visuals have not been art-directed
- City repair meta loop (city visible on level select, state saved to ProgressManager — see VISION.md)

---

## 7. Mandatory Self-Audit Before Every Commit

Take screenshots from: **L5** (4-lane afternoon), **L9** (sunset), **L13** (misty), **L17** (industrial / World 2).  
**Never use L1** as a visual benchmark (single lane, no representative load).

Check each frame:
- Are car colors vivid and instantly readable by color? (no washed-out tints)
- Do car shapes differ visibly by type? (bike narrow, tank wide with turret, bigrig long)
- Are cars visible throughout the road in misty theme?
- Are bomb columns aligned under their lanes?
- Is the breach line visible as a real danger threshold?
- Does the Play Store standard question (section 1 — THE STANDARD) get a YES?

Fix any NO before committing.

Before committing any change to `LevelManager.js` or `CarTypes.js`:
1. Run `node tools/balance-sim.js --level=N --runs=500` for affected levels
2. Win rate must be within target band for that level's difficulty tier
3. If not — adjust level config, not the simulator

---

## 8. What NOT to Touch

- `src/director/` — 633 tests cover it; changes need matching test updates
- `src/models/` — data classes; shape changes cascade everywhere
- Vite config base-path logic
- `BASE_URL` sprite path patterns
- `docs/VISION.md` — locked contract; do not modify without user approval
- The Play Store standard in section 1 — never downgrade this requirement
- Test files (unless adding tests or updating assertions for intentional behavior changes)

---

## 9. Anti-Patterns (Forbidden)

- Spawning popups outside `PopupQueue`
- Computing lane/column positions without `PositionRegistry`
- Hardcoded X/Z world coords instead of `laneToX()` / `posToZ()`
- Adding new top-level `src/` folders without discussion
- Band-aid patches when a structural fix is correct
- Preserving "for compatibility" code that no longer serves a purpose
- **Do not re-add HP bars to cars** — intentionally removed; damage shown via emissive glow only
- **Do not re-add a start gate above the road** — intentionally removed from Road3D.js
- **Do not re-add survival/endless mode** — incompatible with turn-based grid; was removed
- **Do not commit visual changes without a screenshot from L5+**
- **Do not reference L1 as a visual quality benchmark**

---

## 10. Color Palette

```
Red:    #E24B4A   (0xE24B4A)
Blue:   #378ADD   (0x378ADD)
Green:  #639922   (0x639922)
Yellow: #EF9F27   (0xEF9F27)
Purple: #7F77DD   (0x7F77DD)
Orange: #D85A30   (0xD85A30)
Boss:   #CC44CC   (0xCC44CC)
```

Duplicated in: `Car3D.js`, `Shooter3D.js`, `Projectile3D.js`, `src/input/DragDrop.js`. Update all four if changing any color.

---

## 11. Fairness Rules (Director enforces — never violate)

1. **FR-1** At least 1 column top must color-match at least 1 front car.
2. **FR-2** At most 3 of 4 front cars share the same color.
3. **FR-3** Average shooter damage ≥ 50% of average front car HP.
4. **FR-4** No car HP exceeds 2.5× the highest available shooter damage.
5. **FR-5** At least 2 distinct colors in the top shooter row.

Viability guard also checks bench slots (L6+).

---

## 12. Coding Preferences

- Pure JavaScript (no TypeScript)
- ES modules, Node 18+ (CI: Node 24)
- No frameworks for game logic — plain classes, plain functions
- Single-concern modules, one class per file
- Explicit over clever
- No emojis in commit messages
- Inline styles for HTML-based UI (no Tailwind)

### Commit Scope Rule
When deciding what to commit:
1. Always commit `src/` changes
2. Always commit new files in `src/` or `scripts/`
3. Skip: `docs/level-screenshots/`, `public/sprites/raw/`, `*.png` in project root
4. When uncertain: commit it. Easier to revert than to lose work.

Never spend more than 30 seconds deciding what to commit.

---

## 13. Tooling

### Screenshot Standard
Always use `scripts/screenshot.mjs` for Playwright screenshots.
Path: `docs/level-screenshots/current/[name].png`
Read back with: `Read docs/level-screenshots/current/[name].png`

```js
import { takeScreenshot } from './screenshot.mjs';
const filepath = await takeScreenshot(page, 'L5-gameplay');
// then: Read tool on filepath
```

### Screenshot Workflow (review captures — ALWAYS follow)
All review/verification screenshots (the ones shown to the user at the end of a task) go to a single, always-fresh folder:

1. **Location:** `C:\Users\dalit\lane-defense\docs\review\` (`docs/review/`).
2. **Always fresh:** DELETE every existing file in `docs/review/` BEFORE saving a new batch, so the folder only ever holds the current review set.
3. **Names:** short numbered files — `01.png`, `02.png`, `03.png`, …
4. **Labels:** add `00-labels.txt` describing each number, one per line — e.g. `01=reorder highlight, 02=yellow merge pop`.
5. Applies to ALL future screenshot captures in this project, every task — not a one-off.

End the response with the full absolute path(s) under `docs/review/`.

### Playwright PixiJS Clicks
Use `scripts/pixi-coords.mjs` for all game canvas interactions.
Stage dimensions: **390 × 844**.
Always target: `canvas:not(#three-canvas)` — the Three.js canvas (`#three-canvas`) has `pointer-events:none` and swallows all events silently.
Never recalculate coordinate math from scratch.

```js
import { tapStage, getPixiRect, stageToClient } from './pixi-coords.mjs';
await tapStage(page, 195, 470);  // PLAY button
```

### Active Skills (exact invocation names)
Run `claude skill list` to see all. Key skills for this project:

| Skill | When to use |
|-------|-------------|
| `requesting-code-review` | Before every commit |
| `lane-defense-audit` | Visual quality audit |
| `systematic-debugging` | Any bug or unexpected behavior |
| `lane-defense-design-system` | UI/screen design work |
| `brainstorming` | Before new feature/component work |
| `verification-before-completion` | Final check before marking done |

---

## 14. Useful Commands

```bash
npm run dev            # Vite dev server (--host for LAN/phone)
npx vitest run         # full Vitest suite (must be green)
npm run build          # production build → dist/
npm run browser:kill   # clear stuck Playwright Chrome (BEFORE a session only)
node tools/balance-sim.js --level=N --runs=500   # regenerate level difficulty
window._nav.startLevel(5)   # dev API — jump directly to L5 in browser
```

---

## 15. Token Rules (Claude Code)

- `/clear` between unrelated tasks
- `/compact` when context grows long
- Batch multiple file edits into single prompts
- Name exact files; don't explore unnecessarily
- `.claudeignore` excludes: node_modules, dist, android, .git

---

## 16. KEYSTORE — NEVER DELETE

`android/lane-defense-release.keystore` is NOT in git (gitignored).  
Path: `C:\Users\dalit\lane-defense\android\lane-defense-release.keystore`

**LOSING THIS FILE = LOSING THE ABILITY TO UPDATE THE APP ON PLAY STORE FOREVER.**  
Password: `lanedefense2024`

---

*Last updated: 2026-05-25 — added Tooling section (screenshot standard, PixiJS coords, active skills), commit scope rule.*
