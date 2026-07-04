# tests-visual — Playwright visual/integration harness

Boots the real game in Chromium and asserts against the game's OWN sources of
truth (`window._nav.getPositions/getGs/getHudBounds/getFrustum` + pixel sampling
via sharp). Catches the bug classes the 1000+ headless vitest tests cannot see:

| Bug class | Spec |
|-----------|------|
| A — hardcoded lane-count assumptions | `smoke/layout.spec.js` (L1/L2/L3/L5) |
| B — asset 404s / console errors | tripwire in `fixtures/game.js` (every test) |
| C — 2D/3D coordinate divergence | `smoke/layout.spec.js` + `getFrustum` hook |
| D — tap/drag hit-test boundaries | `smoke/boundaries.spec.js` (real pointer drags) |
| F — stale state across level transitions | `smoke/transitions.spec.js` |
| G — HUD overlap / off-stage rects | `smoke/hud.spec.js` |
| world theming / panels | `smoke/worlds.spec.js` |

Class E (unwinnable configs) lives in vitest: `tests/audit-*.test.js`.

## Running

    npm run test:visual        # smoke set (~3-4 min) — run before pushing UI/geometry changes
    npm run test:visual:full   # + all-40-level sweep (nightly / manual)

The dev server auto-starts (or is reused if already running on :5173).
Failure screenshots/traces land in `tests-visual/failures/`.

## Rules

- Assert against `_nav` hooks / `src/renderer3d/projection.js` — NEVER copy a
  coordinate constant into a test (copied constants going stale is bug class C,
  the thing this suite exists to catch; it found the real 9.650 vs 11.237
  FRUSTUM_HALF_X drift on its first run).
- Every test fails automatically on console.error or non-ignored HTTP >= 400.
- Structural/invariant checks only — no golden-image diffs (brittle across
  GPU/font differences between Windows dev and Linux CI).
