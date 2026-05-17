# Top-Down Unified Coordinate System — Design

_Date: 2026-05-17 · Status: APPROVED (design) · Author: Claude (brainstorming session)_

## Problem

Three confirmed pre-existing visual defects, one shared architectural root cause:

1. **Bombs drift diagonally + shrink.** Intentional per-slot downscale
   (`Shooter3D.SLOT_SCALE = [1.18,0.78,0.62,0.48]`) plus bombs rendered by a
   *separate* orthographic camera into a *fixed scissor strip*
   (`Scene3D.renderDual`, `SHOOTER_GL_Y=h-700`, `SHOOTER_GL_H=180`, full canvas
   width). That strip's aspect cannot register with the perspective road →
   unalignable.
2. **Road has no far terminus.** `Road3D` builds flat planes that simply end
   (main Z −22→0, vanish ext −65→−22). Low camera angle + fog used to hide the
   raw plane edge; top-down exposes it. No horizon/cap geometry.
3. **Cars vary in size / look unaligned.** They are NOT misaligned in world
   space (all at `laneToX`, uniform `TYPE_SCALES`). It is the **perspective
   camera** foreshortening a top-down scene.

Root cause: the renderer was built for a low-angle chase **perspective** camera
with a bolted-on orthographic strip for bombs, relying on fog/angle to hide raw
geometry. The fix is **one orthographic projection over one coordinate system**,
with bombs rendered through the same camera, plus a real road terminus.

Guiding principle (user, saved to memory `no-magic-numbers-unified-coords`):
**No hand-tuned magic numbers. Every component's X and Z is derived from one
shared coordinate system. Make everything orthogonal and aligned once.**

## Decisions (from brainstorming)

- Bomb queue lives **in-world, below the breach line**, rendered by the **same**
  ortho camera (not a 2D HUD, not a separate strip).
- **One uniform grid**, cell = lane width = `CELL = 4.0` world units.
- **Keep `posToZ` for car depth** (Director untouched — 478 tests + balance sim
  must stay green; CLAUDE.md forbids touching Director). Lanes and the bomb
  queue are a true 4.0 grid; car *row* spacing keeps the existing posToZ
  compression, which reads as uniform under an orthographic camera (no taper).
- Execution: **sequential** sub-agents A→B→C (steps share `Scene3D` state; the
  `SESSION_HANDOFF.md` never-combine rule applies), plus a standing **Visual
  Integration Lead** sub-agent with **veto power**. Screenshot + Lead review +
  user approval between every step. Nothing commits until Lead signs off and
  the user approves.

## The coordinate system (single source of truth)

Already exists in `src/renderer3d/Scene3D.js`; do not duplicate:

- **X (lanes):** `laneToX(i, n) = -(n*CELL)/2 + CELL/2 + i*CELL`, `CELL = 4.0`.
  Playfield X = `[-roadHalfW(n), +roadHalfW(n)]`, `roadHalfW(n) = 2n + 0.4`.
- **Z (car depth):** `posToZ(p) = -22 + (p/100)*22` → Z ∈ [−22, 0]
  (−22 = spawn/far, 0 = breach/near). **Unchanged.**
- **Z (bomb queue) — NEW:** `queueZ(s) = (s + 1) * CELL`, `s` = slot index
  `0..SLOT_COUNT-1`, `SLOT_COUNT = SLOT_Z.length = 4` (existing count, not new).
  Front/active slot s=0 is one cell below the breach; queue extends toward the
  screen bottom on the same 4.0 grid.

No new tunable constants. `CELL`, `roadHalfW`, slot count all already exist.

## The camera

Single **`THREE.OrthographicCamera`**, looking straight down (−Y), `up` set so
far end (Z=−22) is screen-top and +X is screen-right. Frustum is **computed,
never typed**:

```
worldRect.x   = ± roadHalfW(n)                      // from lane mapping
worldRect.z   = [ -22 , queueZ(SLOT_COUNT-1) ]      // road far → queue bottom
aspectCanvas  = APP_W / APP_H
frustum       = fit(worldRect) into aspectCanvas by expanding the SHORTER
                axis symmetrically about centre (letterbox; content centred,
                never stretched, always square)
near / far    = bracket scene Y extents (cars ≈1.5, bombs ≈0.8) + small margin
position.y    = above far plane (ortho: Y does not affect size, only clipping)
```

Lane-count changes adapt automatically because the frustum derives from
`roadHalfW(n)`. Therefore **delete** the entire magic-number block in
`CameraFX.js`: `CAM_POS`, `CAM_TARGET`, `CAM_FOV`, `LANE_Y_MIN`,
`LANE_FOV_MIN`, `INTRO_FROM_*`. CameraFX effects convert `fov` → `camera.zoom`:

- `shake` → small camera position X/Z offset (unchanged in spirit).
- `startBreachZoom` → transient `camera.zoom` pulse.
- `setCombo` pull-back → small `camera.zoom` decrease.
- lane-count scaling → **removed** (frustum already adapts).
- intro sweep → `camera.zoom` ease from slightly out to 1 (or removed).

`Scene3D.renderDual()` collapses to a single pass: one ortho camera renders all
layers (cars layer 0, HP layer 2, bombs — see Step B). Delete the layer-1
`shooterCamera`, the scissor strip, and `SHOOTER_GL_Y/H`.

## The bomb queue

Bombs become first-class scene objects rendered by the one ortho camera:

- Placement: column `c`, slot `s` → `(laneToX(c, n), Y_bomb, queueZ(s))`. Same
  `laneToX` as cars ⇒ bomb column aligns with its lane by construction.
- **Delete `SLOT_SCALE`.** All bombs identical world size. Queue order is shown
  by real grid position, not fake shrink.
- **Delete `SLOT_ALPHA` and `SLOT_EMISSIVE` arrays.** Front bomb keeps its
  existing emphasis (heat glow + spark bead). Queue bombs equal and plain.
- Bomb size derived: `BOMB_R = 0.4 * CELL` (replaces magic `0.36`) → ~80% cell
  fill with margin.
- Damage badge retained; its world size derives from `CELL`.

**Known consequence:** `SLOT_COUNT(4) × CELL(4.0) = 16` world units of bomb
staging below the breach vs 22 for the road (~42% of vertical playfield). This
is the honest result of "same grid." If too much screen, the only acceptable
levers are *explicit* decisions (fewer visible queue slots, or a deliberately
smaller queue-cell) — never an eyeballed shrink. Flag at Step B screenshot
review for an explicit user call.

## The road terminus

`Road3D` gets a defined far edge so the top-down view shows a finished road end
instead of a raw plane abutting grass:

- Add a terminus at the far edge of the play road (around Z = −22 / the visible
  far extent), sized from `roadHalfW(n)` — a horizon cap / end treatment
  consistent with the theme (exact treatment proposed by the Road-Terminus
  agent and judged by the Integration Lead; must not reintroduce a "start gate"
  — forbidden by CLAUDE.md).
- Fix the stale Road3D.js:5 comment (says −40; actual −22).
- Vanish extension / scenery: keep only what reads correctly from straight
  above; the Integration Lead judges cohesion.

## Implementation sequence (sequential sub-agents)

| Order | Sub-agent | Scope | Gate before next |
|---|---|---|---|
| 1 | **Ortho-Camera** | Camera (Section: The camera) + CameraFX/renderDual cleanup. No bomb/road changes. | Screenshot → Integration Lead → user approval |
| 2 | **Bombs-Unified** | Bomb queue (Section: The bomb queue). No camera/road changes. | Screenshot → Integration Lead → user approval |
| 3 | **Road-Terminus** | Road far edge (Section: The road terminus). No camera/bomb changes. | Screenshot → Integration Lead → user approval |
| ⟂ | **Visual Integration Lead** | Reviews every screenshot; **veto power**; flag → responsible agent fixes → re-review. Ensures combined result is cohesive before any commit. | — |

Rules: each agent runs only after the prior step is user-approved. `npm test`
green after every step. No commit until the Integration Lead signs off **and**
the user approves. Commit messages: no emojis; Co-Authored-By trailer.

## Out of scope

- Director / `GameLoop` / `GameState` / row→position math (forbidden; tested).
- Artist-drawn sprites (separate later effort; not required for this design).
- Survival mode, HP bars, start gate (all forbidden by CLAUDE.md).

## Success criteria

1. Cars uniform size, no perspective taper (defect #3 gone).
2. Bombs aligned to their lane columns, equal size, no diagonal drift
   (defect #1 gone).
3. Road has a finished far terminus from top-down (defect #2 gone).
4. Zero new hand-tuned constants; camera + all placements derive from
   `laneToX` / `posToZ` / `queueZ` / `roadHalfW`.
5. `npm test` green (478+). Combined result approved by Integration Lead +
   user.
