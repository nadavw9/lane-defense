# Lane Defense — Session Handoff

_Last updated: 2026-05-19 — play store standard, proportions pass required before Figma._

## Current State

- **Last commit:** top-down structural baseline — flat billboards, 4-lane layout, aligned bomb columns
- **478 tests passing** (`npm test`), 5 todo, 2 skipped — 17 test files
- **Top-down orthographic camera:** working correctly. Camera at (0, 8, −7.8), lookAt (0, 0, −7.8), up = (0, 0, −1). Frustum sized to road width.
- **Car rendering:** flat `PlaneGeometry` billboards with `CanvasTexture` + `MeshBasicMaterial`. Per-type dimensions in `Car3D.js → TYPE_DIMS`. GLB models fully removed.
- **Road:** dark `0x1c1c1e` asphalt, white dashed dividers at 0.25 opacity. `MeshBasicMaterial` throughout. Water mesh removed.
- **Bombs:** 4 columns × 4 slots, aligned to lanes via `laneToX(_activeLaneCount)`. Front bomb + damage badge sprites in place.
- **Screenshot:** `docs/level-screenshots/current/L05_structural_review.png`

---

## The Standard From Now On

**EVERY change — visual or otherwise — must meet Play Store quality before being approved.**

The question before every commit:
> "Would a player downloading this from the Play Store think this looks and feels like a professional game?"

If no → not approved. Keep fixing.

---

## What Needs Fixing Before Figma/Sprites

Proportions and readability issues. Fix ALL of these before any art direction work:

1. **Cars too small** — must fill 75% of lane width, not 50%
2. **All cars identical shape** — bike must look clearly different from truck. Shape differentiation is the only car type signal right now.
3. **Front bomb too small** — must be dramatically larger than queue bombs. The front bomb is the primary interactive element.
4. **Damage number on bombs not visible** — must be readable at a glance
5. **Breach line too subtle** — the red strip must feel like a real danger threshold, not a decorative line
6. **Danger aura not visible** — red pulse on near-breach cars must be clearly visible
7. **Road grid lines too subtle** — lanes must feel like distinct channels
8. **Terminus bar too thick** — looks like a loading bar, should be a clean road cap

---

## After Proportions Pass

Move to Figma for art direction:
- Design all 6 car sprites (top-down, per type)
- Design bomb visual (top-down sphere or flat disc?)
- Design road surface and lane styling
- Design background (city from above? abstract? dark neutral?)

**User approves Figma designs before any implementation.**

---

## Session Rules (non-negotiable)

- Every visual change: screenshot from L5 minimum
- Standard: Play Store quality — not "it compiles", not "it looks ok"
- Show screenshot to someone unfamiliar — can they understand the game in 5 seconds? If no → not ready
- Never combine multiple system changes in one prompt
- User approves before every commit
- `npm test` must be green after every commit

---

## Key Files

- `docs/VISION.md` — locked design contract
- `docs/GAME_DESIGN.md` — level master table
- `docs/balance-report-realistic.md` — difficulty ground truth
- Structural fixes: `Car3D.js`, `Shooter3D.js`, `Road3D.js`, `Scene3D.js`

---

## Architecture

- **Director / Renderer separation** — `src/director/` is the headless brain; never imports pixi/three; never touched by renderers. Renderers read GameState, never mutate it.
- **Dual canvas:** PixiJS canvas (z=1, screens/HUD/2D) overlays the Three.js canvas (z=0, gameplay viewport). Transparent PixiJS bg, no shared WebGL context.
- **Two Three.js cameras:** top-down orthographic camera (road/cars, pos (0,8,−7.8)) and a second orthographic camera on layer 1 (shooter/bomb columns via `Shooter3D.js`).
- **Car rendering:** `src/renderer3d/Car3D.js` — flat `PlaneGeometry` + `CanvasTexture` + `MeshBasicMaterial`. Type → shape: small=bike, big=sedan, jeep=van, truck=truck, bigrig=bigrig, tank=tank+turret. No GLB models.
- **Shooter rendering:** `src/renderer3d/Shooter3D.js` (orthographic, layer 1). Road: `src/renderer3d/Road3D.js`.
- `src/renderer/PositionRegistry.js` — single source of truth for lane/column screen positions. Must be called via `setActiveCounts()` before any hit-testing/overlay math.
- `src/renderer/PopupQueue.js` — ALL popups/banners/toasts route here (priority: CRITICAL > TUTORIAL > CAR_TYPE > ACHIEVEMENT > COMBO > AMBIENT).

## Gameplay Mechanics (all working, do NOT touch)

- Turn-based grid: one row advances per correct (color-matched) shot; new cars spawn at row 0. Loss when a car passes MAX_ROW (breach).
- Wrong color: no damage AND no advance (shipped — never revert).
- Bomb booster: damages all cars within radius 22 position-units, triggers 2s concussion freeze. Earned every 10 kills, max 3 held.
- Streak Shot: 3 consecutive correct hits → double-damage power shot.
- Danger Aura: red pulse on cars within ~2 rows of the breach gate.
- FREEZE booster: skips grid advance for the next 3 shots.
- Win stars: 3★ no-rescue & maxCarPos<60; 2★ no-rescue & <80; else 1★.
- Car type intro cards (once per type, localStorage-tracked):
  **L1 small(bike) · L2 big(sedan) · L5 jeep(van) · L9 truck · L13 bigrig · L15 tank.**

## What Is NOT Done (production gates)

- Proportions pass (8 items listed above — required before Figma)
- Figma art direction (after proportions pass, user approves before implementation)
- AdMob real IDs — Google TEST IDs are live in `src/ads/AdManager.js`. Replace with production unit IDs before release.
- Signed release APK. **Keystore exists and MUST NOT be lost:**
  `C:\Users\dalit\lane-defense\android\lane-defense-release.keystore`
  (gitignored; password `lanedefense2024`). Losing it = cannot ever update the app on Play Store.
- Play Store listing (screenshots, feature graphic, privacy policy, Data Safety form, closed test ≥12 testers × 14 days).

## Useful Commands

```bash
npm run dev            # Vite dev server (--host for LAN/phone)
npm test               # full Vitest suite (must be green)
npm run build          # production build → dist/
npm run browser:kill   # clear stuck Playwright Chrome (BEFORE a session only)
node tools/balance-sim.js   # regenerate difficulty report
window._nav.startLevel(5)   # dev API — jump directly to L5 in browser
```

## Context Files

- `CLAUDE.md` — full project context (auto-loaded each session).
- This file — current-state handoff + what to fix next.
- Repo: https://github.com/nadavw9/lane-defense · Live: https://nadavw9.github.io/lane-defense/
