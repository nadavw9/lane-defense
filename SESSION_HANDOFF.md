# Lane Defense — Session Handoff

_Last updated after the top-down-migration revert._

## Current State
- **Last good commit: `4278d9f`** — "revert top-down migration — restart
  visual approach carefully" (HEAD on `master`, pushed). _(This is the
  finalized hash of the revert; an earlier intermediate hash `cafa98b`
  was superseded — always trust `git log --oneline -1`.)_
- **478 tests passing** (`npm test`), 5 todo, 2 skipped — 16 test files.
- **Perspective 3D camera — restored and confirmed working** (verified
  via Playwright screenshot: receding road + horizon/sky, shaded GLB
  cars, green scenery, 3D bombs with prominent front bomb + queue).
- All gameplay mechanics intact: streak shot, wrong-color no-advance,
  row-bomb color-matching, 40 levels, balance sim. These pre-date the
  revert boundary (`2feb82a`) and were never touched.
- Kept dev tooling: `scripts/kill-browser.{bat,sh}` + `npm run
  browser:kill` (clears stuck Playwright Chrome / SingletonLock).
  ⚠️ Only run it BEFORE a Playwright session — running it mid-session
  kills the MCP's own browser.

## What Was Just Tried and Failed
Top-down camera migration (commits `d87a2ff`→`2cbb4e5`) — **REVERTED**
back to `2feb82a` (last good perspective-renderer state).

Root cause: too many systems changed simultaneously with no visual
checkpoint between steps. Generated sprites were thin/tiny within a
256² canvas of mostly transparent padding; the 1-lane level rendered a
full-width 390px road so a single car looked lost in a void; PixiJS
Road2D/Car2D occluded Three.js particles; bombs (still Three.js
Shooter3D) became unaligned specks. Net: layout collapsed.

**DO NOT attempt the top-down migration again in a single large prompt.**
If revisiting: one system at a time, screenshot after each step, user
approval before proceeding.

Tooling note: the Playwright MCP browser in this environment is
unstable — it closes after ~4–5 calls and deadlocks on relaunch
(`SingletonLock`). Plan verification around that: minimal calls,
combine PLAY→L1→START into one short (<1s) evaluate, screenshot
immediately, recover with `browser:kill` only between sessions.

## Top Priority for Next Session
The game still needs a proper top-down view, BUT approached carefully:

- **Step 1 — Camera angle ONLY.** Change the perspective camera to a
  top-down orthographic camera in `Scene3D.js`. No sprite changes, no
  road changes, no particle changes. Screenshot. If the existing GLB
  cars read acceptably from above → proceed. If not → only adjust the
  camera angle/height until they do.
- **Step 2 — Sprites** (only after Step 1 is user-approved). Prefer
  real artist-drawn 256×256 top-down PNGs over procedurally generated
  shapes (the generator route failed once).
- **Step 3 — Road** (only after Step 2 is user-approved).
- **Never combine steps.** Commit + screenshot + approval between each.

## Key Design Documents (read before ANY design work)
- `docs/VISION.md` — LOCKED design contract. Cannot be changed to fit
  code; code changes to fit it.
- `docs/GAME_DESIGN.md` — level master table, difficulty rules,
  known bugs.
- `docs/balance-report-realistic.md` — difficulty ground truth
  (3 skill profiles: beginner/average/skilled). Regenerate via
  `node tools/balance-sim.js`.

## Architecture
- **Director / Renderer separation** — `src/director/` is the headless
  brain; never imports pixi/three; never touched by renderers.
  Renderers read GameState, never mutate it. Enforced by convention +
  the 455-test director suite.
- **Dual canvas:** PixiJS canvas (z=1, screens/HUD/2D) overlays the
  Three.js canvas (z=0, gameplay viewport). Transparent PixiJS bg, no
  shared WebGL context.
- **Two Three.js cameras:** perspective camera (road/cars/env,
  pos ~(0,4,7.5) lookAt (0,0.6,-3)) and an orthographic camera on
  layer 1 (shooter/bomb columns). `CameraFX.js` may override the
  perspective resting pose.
- Car rendering: `src/renderer3d/Car3D.js` (GLB models via
  `AssetLoader.js` → `CAR_ASSET_MAP`: small→bike, big→sedan,
  jeep→van, truck→truck, bigrig→bigrig; tank is procedural geometry).
- Shooter rendering: `src/renderer3d/Shooter3D.js` (orthographic,
  layer 1). Road: `src/renderer3d/Road3D.js`. Plus Skybox3D,
  Environment3D, Ambient3D, ScorchMarks3D, LaneFlash3D, PostFX3D.
- Particles: `src/renderer3d/Particles3D.js` (Three.js) +
  `src/renderer/ParticleSystem.js` (PixiJS, particleLayer).
- `src/renderer/PopupQueue.js` — ALL popups/banners/toasts route here
  (priority: CRITICAL > TUTORIAL > CAR_TYPE > ACHIEVEMENT > COMBO >
  AMBIENT; 0.4s debounce; AMBIENT can stack 3, others 1).
- `src/renderer/PositionRegistry.js` — single source of truth for
  lane/column screen positions. `setActiveCounts({laneCount,colCount})`
  called from `GameApp._startLevel()` BEFORE renderers init. All
  hit-testing/overlay math must use it.
- `src/renderer/LayerManager.js` — fixed PixiJS z-order: background,
  lane, car, shooterColumn, activeShooter, particle, glow, hud, drag.
- Legacy `LaneRenderer.js` / `ShooterRenderer.js` are hidden during
  gameplay but their exported constants are still used for hit-testing.

## Gameplay Mechanics (all working, do NOT touch)
- Turn-based grid: one row advances per correct (color-matched) shot;
  new cars spawn at row 0. Loss when a car passes MAX_ROW (breach).
- Wrong color: no damage AND no advance (shipped — never revert).
- Bomb booster: hits the entire row, color-matching cars only
  (shipped — never revert). Earned every 10 kills, max 3 held; 2s
  concussion freeze on detonation.
- Streak Shot: 3 consecutive correct hits → next shot is a
  double-damage power shot + slows the hit car for 1 shot.
  - `streakCount` / `streakActive` in GameState; logic in GameLoop.
  - Bomb heat glow tiers in Shooter3D: yellow → orange → red.
  - Car3D shows squash+stretch + soot overlay on a power hit.
  - Discovered organically at L17 (BigRig-heavy band), never via a
    tutorial card.
- Danger Aura: red pulse on cars within ~2 rows of the breach gate.
- FREEZE booster: skips grid advance for the next 3 shots.
- Rescue: rewarded ad → add time + `shuffleForRescue()` (force ≥2
  column tops to match front-car colors).
- Win stars: 3★ no-rescue & maxCarPos<60; 2★ no-rescue & <80; else 1★.
- Car type intro cards (once per type, localStorage-tracked). Verified
  `LEVEL_INTRO_TYPE` in `GameApp.js`:
  **L1 small(bike) · L2 big(sedan) · L5 jeep(van) · L9 truck ·
  L13 bigrig · L15 tank.** _(Note: bigrig is **L13**, not L11.)_
  HP — small 2, big 4, jeep 5, truck 6, bigrig 10, tank 20.
  Fairness rules FR-1..FR-5 enforced in the Director (viability guard,
  ≤3/4 same color, avg damage ≥50% avg HP, tank HP cap, ≥2 colors).

## What Is NOT Done (production gates)
- Top-down visual overhaul (planned, failed once — careful stepwise
  retry per the plan above).
- Artist-drawn top-down sprites (256×256 PNGs designed for a top-down
  view — needed before any sprite step; generator route failed).
- AdMob real IDs — Google TEST IDs are live in `src/ads/AdManager.js`
  (`REWARDED_AD_ID`/`INTERSTITIAL_AD_ID` =
  `ca-app-pub-3940256099942544/...`; `initializeForTesting: true`).
  Replace both with production unit IDs before release. Web fallback
  `_showPlatformAd()` simulates a 5s ad — replace with real SDK call.
- Signed release APK. **Keystore exists and MUST NOT be lost:**
  `C:\Users\dalit\lane-defense\android\lane-defense-release.keystore`
  (gitignored; password `lanedefense2024`). Losing it = cannot ever
  update the app on Play Store. Back it up off-machine.
- Play Store listing (screenshots, feature graphic, privacy policy,
  Data Safety form, closed test ≥12 testers × 14 days).

## Session Rules
- Read `docs/VISION.md` in full before any design or level work.
- Run `node tools/balance-sim.js` before committing level changes;
  confirm win rate is in the target band for that level's tier.
- One visual change at a time; screenshot after each; user approval
  before proceeding. Never combine camera + sprites + road.
- `npm test` must be green after every commit.
- Commit messages: no emojis; end with the Co-Authored-By trailer.
- Push to `master` → GitHub Action runs tests → deploys to GH Pages.
- Don't re-add HP bars to cars (removed — damage via emissive glow).
  Don't re-add a start gate above the road. Don't add a
  survival/endless mode (incompatible with the turn-based grid).

## Useful Commands
```bash
npm run dev            # Vite dev server (--host for LAN/phone)
npm test               # full Vitest suite (must be green)
npm run build          # production build → dist/
npm run browser:kill   # clear stuck Playwright Chrome (BEFORE a session only)
node tools/balance-sim.js   # regenerate difficulty report
```

## Context Files
- `CLAUDE.md` — full project context (auto-loaded each session).
- This file — current-state handoff + careful retry plan.
- Repo: https://github.com/nadavw9/lane-defense ·
  Live: https://nadavw9.github.io/lane-defense/
