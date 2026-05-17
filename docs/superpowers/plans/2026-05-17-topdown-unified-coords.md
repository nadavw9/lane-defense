# Top-Down Unified Coordinate System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the perspective gameplay camera with one orthographic top-down camera over the existing `laneToX`/`posToZ` coordinate system, render bombs through that same camera, and give the road a real far terminus — fixing bomb misalignment, car size variance, and the missing road end with zero hand-tuned constants.

**Architecture:** Single `THREE.OrthographicCamera` whose frustum is *computed* from `roadHalfW(n)`, `posToZ`, a new `queueZ(slot)`, and the canvas aspect (symmetric letterbox). Bombs become first-class scene objects at `(laneToX(c,n), Y, queueZ(s))` on the same 4.0 grid. CameraFX becomes projection-agnostic (zoom + position offsets). Road3D gains a far terminus.

**Tech Stack:** Three.js ^0.167, Vite, Vitest (headless only — no render tests), Playwright MCP for screenshots.

**Execution model:** Sequential sub-agents — Task A → Task B → Task C. A standing **Visual Integration Lead** sub-agent reviews every screenshot with **veto power**: if it flags a problem, the responsible task's agent fixes it and the Lead re-reviews before the user-approval gate. No commit until Lead signs off AND user approves. `npm test` green after every task.

**Verification note:** No automated render tests exist (CLAUDE.md). Per-task verification = (1) `npm test` green, (2) dev screenshot of the specified level(s), (3) Integration Lead review, (4) user approval. This replaces the usual failing-test-first TDD loop for visual code.

**Spec:** `docs/superpowers/specs/2026-05-17-topdown-unified-coords-design.md`

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/renderer3d/Scene3D.js` | Owns the ortho camera + derived frustum (`_computeFrustum`), `queueZ`, single render pass | A (camera), B (queueZ export) |
| `src/renderer3d/CameraFX.js` | Projection-agnostic juice: zoom + position offset only | A |
| `src/renderer3d/GameRenderer3D.js` | `render()` single pass; lane-count wiring | A |
| `src/renderer3d/Shooter3D.js` | Bombs as first-class objects, equal size, `queueZ` placement, layer 0 | B |
| `src/renderer3d/Road3D.js` | Far terminus geometry; fix stale comment | C |

---

## Task A: Orthographic camera + CameraFX/render cleanup

**Files:**
- Modify: `src/renderer3d/Scene3D.js`
- Modify: `src/renderer3d/CameraFX.js`
- Modify: `src/renderer3d/GameRenderer3D.js`

**Scope guard:** Camera/render only. Do NOT touch Shooter3D or Road3D. Bombs (layer 1) will not render after this task — that is expected and returns aligned in Task B. Task A screenshot is judged on cars + road only.

- [ ] **Step 1: Add coordinate + frustum helpers to Scene3D.js**

In `Scene3D.js`, add near the existing layout constants (after `ROAD_Z_VANISHING`):

```js
// ── Unified grid constants (single source of truth) ───────────────────────────
export const CELL       = 4.0;            // == lane width (laneToX pitch)
export const SLOT_COUNT = 4;              // bomb queue depth (== Shooter3D SLOT_Z length)

/** World Z of bomb-queue slot s (0 = front/active, nearest the breach line). */
export function queueZ(s) { return (s + 1) * CELL; }   // 4, 8, 12, 16
```

- [ ] **Step 2: Replace the perspective camera with a derived orthographic camera**

In the `Scene3D` constructor, replace the `// ── Road camera ──`, `// ── HP sprite camera ──`, and `// ── Shooter viewport ──` blocks (the three camera definitions) with:

```js
// ── Single top-down orthographic camera ──────────────────────────────────
// Looks straight down -Y. World +X → screen right; world -Z (far/spawn) →
// screen up. Frustum is computed from the coordinate system, never typed.
this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 10, 200);
this.camera.position.set(0, 60, 0);   // ortho: Y only affects clipping
this.camera.up.set(0, 0, -1);
this.camera.layers.enableAll();        // one camera renders all layers
this._activeLaneCount = 4;
this._computeFrustum(4);
```

Delete the `hpCamera` and `shooterCamera` properties entirely (and the divider build that targeted layer 1 stays — see Step 5).

- [ ] **Step 3: Implement `_computeFrustum`**

Add this method to the `Scene3D` class:

```js
/** Derive ortho frustum from world rect + canvas aspect (symmetric letterbox). */
_computeFrustum(n) {
  const halfX  = roadHalfW(n);                       // lane mapping
  const zFar   = ROAD_Z_FAR;                         // -22 (spawn)
  const zNear  = queueZ(SLOT_COUNT - 1);             // 16  (queue bottom)
  const zSpan  = zNear - zFar;                        // 38
  const zCtr   = (zFar + zNear) / 2;                  // -3
  const worldAspect  = (2 * halfX) / zSpan;
  const canvasAspect = this.width / this.height;

  let fHalfX, fHalfZ;
  if (worldAspect > canvasAspect) {                   // X limiting → expand Z
    fHalfX = halfX;
    fHalfZ = halfX / canvasAspect;
  } else {                                            // Z limiting → expand X
    fHalfZ = zSpan / 2;
    fHalfX = (zSpan / 2) * canvasAspect;
  }
  const cam = this.camera;
  cam.left   = -fHalfX; cam.right = fHalfX;
  cam.top    =  fHalfZ; cam.bottom = -fHalfZ;
  cam.position.set(0, 60, zCtr);
  cam.lookAt(0, 0, zCtr);
  cam.up.set(0, 0, -1);
  cam.updateProjectionMatrix();
}
```

- [ ] **Step 4: Recompute frustum on lane-count change and resize**

In `Scene3D.setLaneCount(n)`, replace the orthographic shooter-camera resize block (the `this.shooterCamera.left = ...` lines) with:

```js
this._activeLaneCount = n;
this._computeFrustum(n);
```

In `Scene3D.resize(width, height)`, after `this.width/this.height` are set and the composer resized, replace the `this.camera.aspect / hpCamera.aspect` lines with:

```js
this._computeFrustum(this._activeLaneCount);
```

- [ ] **Step 5: Collapse `renderDual` to a single pass**

Replace the entire `renderDual()` method body with:

```js
renderDual() {
  // Single ortho camera, single pass. (Name kept for call-site compat.)
  this.composer.render();
}
```

Leave `render()` and the `RenderPass(this.scene, this.camera)` as-is (the composer already uses `this.camera`). The layer-1 dividers built in `_buildDividers` still render (camera has all layers enabled).

- [ ] **Step 6: Rewrite CameraFX.js as projection-agnostic**

Replace the entire contents of `src/renderer3d/CameraFX.js` with:

```js
// CameraFX — projection-agnostic camera juice.
// Works on whatever camera Scene3D owns (orthographic). It never sets an
// absolute pose; it captures the resting position/zoom at construction and
// applies transient offsets (shake) and zoom pulses on top, restoring them.
//
//   shake(magnitude, duration)  — decaying X/Z position jitter
//   startBreachZoom(duration)   — brief zoom-in pulse
//   setCombo(combo)             — subtle sustained zoom-out at high combo
//   startLevelIntro()           — zoom ease from slightly out to resting
//   setLaneCount(n)             — no-op (frustum adapts in Scene3D)
//   reset()                     — restore resting pose + zoom

const SHAKE_DECAY    = 0.35;
const BREACH_ZOOM_IN = 0.10;   // peak zoom delta during breach pulse
const INTRO_ZOOM_OUT = 0.12;   // start the intro this much zoomed out
const INTRO_DURATION = 0.60;

const COMBO_ZOOM_OUT = [
  { threshold: 12, dz: 0.06 },
  { threshold:  7, dz: 0.035 },
  { threshold:  3, dz: 0.015 },
];

function _easeOutCubic(t) { return 1 - Math.pow(1 - Math.min(t, 1), 3); }

export class CameraFX {
  constructor(camera) {
    this._camera   = camera;
    this._baseP    = camera.position.clone();
    this._baseZoom = camera.zoom || 1;

    this._shakeMag = 0; this._shakeTime = 0;
    this._breachT = -1; this._breachDuration = 0; this._breachDone = false;
    this._targetComboZoom = 0; this._currentComboZoom = 0;
    this._introActive = false; this._introT = 0;
  }

  shake(magnitude = 0.15, duration = SHAKE_DECAY) {
    if (magnitude >= this._shakeMag || this._shakeTime <= 0) {
      this._shakeMag = magnitude; this._shakeTime = duration;
    }
  }

  startBreachZoom(duration = 0.50) {
    this._breachT = 0; this._breachDuration = duration; this._breachDone = false;
  }

  setCombo(combo) {
    let dz = 0;
    for (const tier of COMBO_ZOOM_OUT) {
      if (combo >= tier.threshold) { dz = tier.dz; break; }
    }
    this._targetComboZoom = dz;
  }

  setLaneCount(_n) { /* frustum adapts in Scene3D; nothing to do */ }

  startLevelIntro() { this._introActive = true; this._introT = 0; }

  /** Call every frame. Returns true while any animation runs. */
  update(dt) {
    const cam = this._camera;
    let sx = 0, sz = 0;

    if (this._shakeTime > 0) {
      this._shakeTime -= dt;
      const t = Math.max(0, Math.min(1, this._shakeTime / SHAKE_DECAY));
      const m = this._shakeMag * t;
      sx = (Math.random() - 0.5) * 2 * m;
      sz = (Math.random() - 0.5) * 2 * m;
    } else { this._shakeTime = 0; }

    cam.position.set(this._baseP.x + sx, this._baseP.y, this._baseP.z + sz);

    this._currentComboZoom +=
      (this._targetComboZoom - this._currentComboZoom) * Math.min(1, dt * 3);

    let zoom = this._baseZoom * (1 - this._currentComboZoom);

    if (this._introActive) {
      this._introT += dt;
      const e = _easeOutCubic(this._introT / INTRO_DURATION);
      zoom *= (1 - INTRO_ZOOM_OUT) + INTRO_ZOOM_OUT * e;
      if (this._introT >= INTRO_DURATION) this._introActive = false;
    }

    if (this._breachT >= 0 && !this._breachDone) {
      this._breachT += dt;
      const prog = Math.min(1, this._breachT / this._breachDuration);
      zoom *= 1 + BREACH_ZOOM_IN * Math.sin(Math.PI * prog);
      if (this._breachT >= this._breachDuration) {
        this._breachDone = true; this._breachT = -1;
      }
    }

    cam.zoom = zoom;
    cam.updateProjectionMatrix();

    return this._shakeTime > 0 ||
           (this._breachT >= 0 && !this._breachDone) ||
           this._introActive;
  }

  reset() {
    this._shakeTime = 0; this._breachT = -1;
    this._targetComboZoom = 0; this._currentComboZoom = 0;
    this._introActive = false;
    const cam = this._camera;
    cam.position.copy(this._baseP);
    cam.zoom = this._baseZoom;
    cam.updateProjectionMatrix();
  }
}
```

Note: `CameraFX` no longer exports `CAM_POS`/`CAM_TARGET`/`CAM_FOV`. Step 7 removes the only other importer.

- [ ] **Step 7: Fix CameraFX importers**

Run: `grep -rn "CAM_POS\|CAM_TARGET\|CAM_FOV\|from './CameraFX" src/`
For every hit other than `GameRenderer3D.js` (which imports only the `CameraFX` class — fine), remove the now-deleted symbol usage. Expected: only `GameRenderer3D.js` imports `CameraFX`; if any file imports `CAM_POS`/`CAM_TARGET`/`CAM_FOV`, delete that usage (these were the perspective resting pose; nothing in the ortho design needs them). If grep shows no other importers, no change needed.

- [ ] **Step 8: Confirm GameRenderer3D render path**

Open `src/renderer3d/GameRenderer3D.js`. `render()` already calls `this._scene3d.renderDual()` — now a single pass. `setActiveLaneCount(n)` already calls `this._scene3d?.setLaneCount(n)` and `this._cameraFX?.setLaneCount(n)` (now a no-op) — no change needed. Verify no other code references `_scene3d.hpCamera` or `_scene3d.shooterCamera`:

Run: `grep -rn "hpCamera\|shooterCamera" src/`
Expected: no hits (or only the deleted Scene3D lines). If any consumer exists, remove the reference (these cameras no longer exist).

- [ ] **Step 9: Run the test suite (regression guard)**

Run: `npm test`
Expected: `478 passed` (or current count), 0 failed. Headless tests don't cover the camera; this confirms nothing else broke.

- [ ] **Step 10: Screenshot L1 and L13 (1-lane and 4-lane)**

Start dev server if not running (`npm run dev`), then via Playwright MCP: navigate to the dev URL, wait ~2.5s, `window._nav.startLevel(1)`, wait 3s, screenshot `step-A-L1.png`; then `window._nav.startLevel(13)`, wait 3s, screenshot `step-A-L13.png`. (Playwright MCP is unstable — minimal calls; `npm run browser:kill` only BEFORE a session.)

Expected in both: cars are **uniform size regardless of distance**, road shows **no perspective taper** (parallel edges), L1 framed without stretch (letterboxed). Bombs absent (expected — Task B). Road far edge still raw (expected — Task C).

- [ ] **Step 11: Visual Integration Lead review (gate)**

Dispatch the Integration Lead with both screenshots. It judges only Task A's success criteria: uniform car size, no taper, no stretch, level readable. If it vetoes, the Task A agent fixes and the Lead re-reviews. Do NOT commit on veto.

- [ ] **Step 12: User approval gate**

Present both screenshots + Lead verdict to the user. Wait for explicit approval. Do not proceed to Task B or commit without it.

- [ ] **Step 13: Commit (only after Lead sign-off AND user approval)**

```bash
git add src/renderer3d/Scene3D.js src/renderer3d/CameraFX.js src/renderer3d/GameRenderer3D.js
git commit -m "$(printf 'top-down A: single orthographic camera over derived frustum\n\nReplace perspective road camera + HP/shooter cameras with one\northographic camera whose frustum is computed from roadHalfW/posToZ/\nqueueZ + canvas aspect. CameraFX is now projection-agnostic\n(zoom + offset). renderDual collapses to a single pass.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task B: Bombs unified into the same camera

**Files:**
- Modify: `src/renderer3d/Shooter3D.js`

**Scope guard:** Shooter3D only. Do NOT touch Scene3D camera or Road3D.

- [ ] **Step 1: Import the grid mapping**

In `Shooter3D.js`, change the Scene3D import to include the grid helpers:

```js
import { laneToX, queueZ, CELL } from './Scene3D.js';
```

- [ ] **Step 2: Replace the per-slot magic arrays with grid-derived constants**

Delete these lines:

```js
const SLOT_Z     = [-1.5, -0.5, 0.5, 1.4];
const SLOT_SCALE    = [1.18, 0.78, 0.62, 0.48];
const SLOT_ALPHA    = [1.00, 0.82, 0.68, 0.55];
const SLOT_EMISSIVE = [0.50, 0.30, 0.18, 0.10];
```

Replace with:

```js
const SLOT_COUNT  = 4;                 // queue depth (matches Scene3D.SLOT_COUNT)
const BOMB_R      = 0.4 * CELL;        // 1.6 — ~80% cell fill (was magic 0.36)
const SLOT_ALPHA_ALL    = 1.0;         // all bombs equal — no fake depth fade
const SLOT_EMISSIVE_ALL = 0.45;        // single emissive level for every slot
```

Delete the old `const BOMB_R = 0.36;` line. Keep `BOMB_CX`, `BOMB_CY = BOMB_R`, `BOMB_CZ`.

- [ ] **Step 3: Slot Z from `queueZ`, equal scale, layer 0**

In `_createSlot(laneIdx, worldZ, slotIdx)`, the caller passes `worldZ`. Change the slot-creation loop in the constructor from:

```js
this._slots.push(SLOT_Z.map((z, si) => this._createSlot(li, z, si)));
```

to:

```js
this._slots.push(
  Array.from({ length: SLOT_COUNT }, (_, si) => this._createSlot(li, queueZ(si), si)),
);
```

In `_createSlot`, replace per-slot lookups:
- `const alpha = SLOT_ALPHA[slotIdx];` → `const alpha = SLOT_ALPHA_ALL;`
- `const emissive = SLOT_EMISSIVE[slotIdx];` → `const emissive = SLOT_EMISSIVE_ALL;`
- `const scale = SLOT_SCALE[slotIdx];` → `const scale = 1.0;`
- `group.scale.setScalar(scale);` stays (now always 1.0).
- `group.position.set(laneToX(laneIdx), 0, worldZ);` stays (worldZ now `queueZ(si)`).
- Badge: `const siFactor = slotIdx === 0 ? 1.0 : 0.7;` → `const siFactor = 1.0;` (equal badges).
- Change `group.traverse(obj => { if (obj.isMesh || obj.isSprite) obj.layers.set(1); });` to `obj.layers.set(0);` (render through the single main camera).

- [ ] **Step 4: Fix spark-bead Z + layer**

In the constructor spark-bead loop, replace `SLOT_Z[0]` with `queueZ(0)`:

```js
bead.position.set(laneToX(li) + BOMB_CX + 0.15, BOMB_CY + 0.38, queueZ(0) - 0.30);
```

and change `bead.layers.set(1);` → `bead.layers.set(0);`.

- [ ] **Step 5: Remove remaining `SLOT_Z` / `SLOT_SCALE` references**

Run: `grep -n "SLOT_Z\|SLOT_SCALE\|SLOT_ALPHA\[\|SLOT_EMISSIVE\[" src/renderer3d/Shooter3D.js`
Expected after edits: no hits. Any survivor (e.g. `SLOT_Z.length`) → replace with `SLOT_COUNT`. The punch/heat-glow code uses `slot._baseScale` (now 1.0) — leave as-is, it still works.

- [ ] **Step 6: Run the test suite**

Run: `npm test`
Expected: `478 passed`, 0 failed.

- [ ] **Step 7: Screenshot L1 and L13**

Same procedure as Task A Step 10: `step-B-L1.png`, `step-B-L13.png`.

Expected: bombs render **through the main camera**, each column's bomb stack **vertically aligned under its lane** (same X as the cars above), **all bombs equal size**, queue extends below the breach line on the 4.0 grid. Note the derived consequence: 4×4.0 = 16 units of bomb staging vs 22 road (~42% of vertical). Flag this explicitly to the Lead/user for a decision (acceptable, or reduce queue depth / define a smaller queue-cell — an explicit choice, never an eyeballed shrink).

- [ ] **Step 8: Visual Integration Lead review (gate)**

Dispatch the Lead with `step-B-L1.png`, `step-B-L13.png`, AND the Task A screenshots — it must judge **combined cohesion** (camera + bombs together), not just B in isolation. Veto → Task B agent fixes → re-review.

- [ ] **Step 9: User approval gate**

Present screenshots + Lead verdict + the 42%-staging flag to the user. Wait for explicit approval (including a decision on the staging proportion).

- [ ] **Step 10: Commit (only after Lead sign-off AND user approval)**

```bash
git add src/renderer3d/Shooter3D.js
git commit -m "$(printf 'top-down B: bombs unified into the single ortho camera\n\nBombs are first-class scene objects at (laneToX, queueZ(slot)) on the\nshared 4.0 grid, equal size, layer 0. Delete SLOT_Z/SLOT_SCALE/\nSLOT_ALPHA/SLOT_EMISSIVE arrays and the separate strip dependency.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Task C: Road far terminus

**Files:**
- Modify: `src/renderer3d/Road3D.js`

**Scope guard:** Road3D only. Do NOT touch Scene3D or Shooter3D. Must NOT reintroduce a "start gate" (forbidden by CLAUDE.md).

- [ ] **Step 1: Fix the stale header comment**

In `Road3D.js`, change the line that reads `// The road runs from Z = ROAD_Z_FAR (-40) to Z = ROAD_Z_NEAR (0).` to `// The road runs from Z = ROAD_Z_FAR (-22) to Z = ROAD_Z_NEAR (0).`

- [ ] **Step 2: Add a far terminus to `_buildRoadSurface`**

At the end of `_buildRoadSurface()` (after the near-ground extension `nearExtMesh` block), add a terminus band that visually closes the far end of the road instead of letting the asphalt plane abut grass. Derive size from `roadHalfW` — no typed offsets:

```js
// ── Far terminus: closes the road's far edge so the top-down view shows a
// finished end instead of a raw plane meeting grass. NOT a start gate
// (no vertical structure / no spawn portal) — a flush ground band.
const termW   = (hw + 0.55) * 2;          // road + barrier width
const termLen = CELL;                      // one grid cell deep
const termMat = new THREE.MeshStandardMaterial({
  color: COL_ASPHALT_DARK, roughness: 0.9, metalness: 0.04, envMapIntensity: 0.1,
});
const termMesh = new THREE.Mesh(new THREE.PlaneGeometry(termW, termLen), termMat);
termMesh.rotation.x = -Math.PI / 2;
termMesh.position.set(0, -0.005, ROAD_Z_FAR - termLen / 2);
this._group.add(termMesh);

// Bright edge line marking the road's far boundary (derived width).
const edgeMat  = new THREE.MeshBasicMaterial({
  color: COL_DIVIDER, transparent: true, opacity: 0.55,
});
const edgeMesh = new THREE.Mesh(new THREE.PlaneGeometry(termW, 0.12), edgeMat);
edgeMesh.rotation.x = -Math.PI / 2;
edgeMesh.position.set(0, 0.002, ROAD_Z_FAR);
this._group.add(edgeMesh);
```

Add `CELL` to the Scene3D import at the top of `Road3D.js`:

```js
import { ROAD_Z_FAR, ROAD_Z_NEAR, ROAD_Z_VANISHING, laneToX, roadHalfW, posToZ, CELL } from './Scene3D.js';
```

- [ ] **Step 3: Run the test suite**

Run: `npm test`
Expected: `478 passed`, 0 failed.

- [ ] **Step 4: Screenshot L1, L5, L9, L13 (all four themes)**

Per the CLAUDE.md mandatory self-audit, screenshot one level per theme: `step-C-L1.png` (morning), `step-C-L5.png` (afternoon), `step-C-L9.png` (sunset), `step-C-L13.png` (misty). Same Playwright procedure.

Expected: the road has a **defined far edge** (terminus band + bright boundary line) in all themes — no raw asphalt-meets-grass; no start gate / vertical structure; cars still visible through the misty theme.

- [ ] **Step 5: Visual Integration Lead review (final cohesion gate)**

Dispatch the Lead with ALL Task C screenshots PLUS the approved Task A and B screenshots. This is the **final combined-cohesion** review: camera + bombs + road terminus must look like one cohesive top-down game across all four themes. Veto → Task C agent fixes → re-review.

- [ ] **Step 6: User approval gate**

Present all four screenshots + Lead final verdict. Wait for explicit approval.

- [ ] **Step 7: Commit (only after Lead sign-off AND user approval)**

```bash
git add src/renderer3d/Road3D.js
git commit -m "$(printf 'top-down C: road far terminus\n\nClose the road far edge with a derived terminus band + boundary line\nso the top-down view shows a finished road end. Fix stale Z comment.\nNo start gate.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

- [ ] **Step 8: Update SESSION_HANDOFF.md**

Update `SESSION_HANDOFF.md` to record: top-down migration completed via the unified ortho coordinate system (A/B/C), commit hashes, and that the perspective camera is gone. Commit:

```bash
git add SESSION_HANDOFF.md
git commit -m "$(printf 'docs: handoff — top-down unified ortho migration complete\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Self-Review

**Spec coverage:**
- Single coordinate system (`CELL`, `queueZ`) → Task A Step 1. ✓
- One ortho camera, derived frustum, letterbox → Task A Steps 2-4. ✓
- Delete CameraFX magic block, fov→zoom → Task A Step 6. ✓
- Collapse renderDual, remove hp/shooter cameras → Task A Steps 2,5,8. ✓
- Bombs through same camera, `queueZ` placement, delete SLOT_SCALE/ALPHA/EMISSIVE, BOMB_R from CELL → Task B Steps 1-5. ✓
- 42%-staging consequence flagged for explicit user decision → Task B Step 7,9. ✓
- Road terminus, fix stale comment, no start gate → Task C Steps 1-2. ✓
- Sequential agents + Integration Lead veto + screenshot/approval/commit gates → every task's review/approval/commit steps. ✓
- `npm test` green each task → Task A Step 9, B Step 6, C Step 3. ✓
- Out-of-scope (Director untouched) → no task modifies `src/game` or `src/director`. ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete; commands have expected output. ✓

**Type consistency:** `CELL` (4.0), `SLOT_COUNT` (4), `queueZ(s)=(s+1)*CELL` defined in Scene3D (Task A) and consumed identically in Shooter3D (Task B) and Road3D (Task C). `BOMB_R = 0.4*CELL` defined once in Task B. `renderDual()` name preserved so GameRenderer3D call site is unchanged. ✓

No gaps found.
