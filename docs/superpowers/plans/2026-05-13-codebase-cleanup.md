# Codebase Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nuclear cleanup of Car3D.js and Shooter3D.js dead geometry, verify all tutorial systems work, clean GameApp.js dead references, then commit four focused patches.

**Architecture:** Three.js 3D renderer (`src/renderer3d/`) for gameplay viewport; PixiJS 2D (`src/renderer/`, `src/screens/`) for HUD and overlays. Car3D.js manages live 3D car meshes; Shooter3D.js manages 3D bomb slots in the orthographic shooter camera. Tutorial systems (FTUEOverlay, TutorialOrchestrator, BoosterSpotlight, CarTypeIntroCard) are all wired in GameApp.js at different lifecycle points.

**Tech Stack:** Three.js r166, PixiJS v8, Vite 5, plain JavaScript ES modules, Playwright MCP for visual audit.

---

## File Map

| File | Current Lines | Target Lines | Change |
|---|---|---|---|
| `src/renderer3d/Car3D.js` | 555 | ~280 | Delete smoke, crack, shadow disc geometry |
| `src/renderer3d/Shooter3D.js` | 479 | ~310 | Delete halo, vignette, highlight CircleGeometry |
| `src/renderer/GameApp.js` | 1815 | ~1800 | Remove dead imports/refs (minor) |

---

## Task 1: Playwright pre-audit — document visual problems

**Files:**
- Read-only: dev server at http://localhost:5173

- [ ] **Step 1: Start dev server in background**

```bash
cd C:\Users\dalit\lane-defense && npm run dev &
```

Wait ~5s for Vite to finish bundling.

- [ ] **Step 2: Screenshot L1 (FTUE hand demo)**

Use Playwright MCP:
```
browser_navigate: http://localhost:5173
# Click play, navigate to L1 start
browser_take_screenshot: l1_before.png
```

Observe and note:
- Are car colors vivid and distinct?
- FTUE hand animation visible?
- Any stray floating white text?
- Shadow discs visible under cars?
- Ground halo discs under bombs?

- [ ] **Step 3: Screenshot L4, L8, L13**

```
# Navigate to L4 via level select
browser_take_screenshot: l4_before.png
# L8
browser_take_screenshot: l8_before.png
# L13
browser_take_screenshot: l13_before.png
```

- [ ] **Step 4: Document all visual problems found**

Write a bullet list in a comment or note. These are the issues to verify are GONE after cleanup.

---

## Task 2: Car3D.js — nuclear cleanup of smoke/crack/shadow

**Files:**
- Modify: `src/renderer3d/Car3D.js`

**What to DELETE** (exact targets by line range):

| Range | What | Why |
|---|---|---|
| Line 4 (comment) | "smoke trail" from file comment | stale after deletion |
| Line 82 | `let _shadowGeo = null;` | deleting shadow disc |
| Lines 84–88 | `_ensureSharedGeos()` function body — ONLY the `_shadowGeo` line | boss torus must stay |
| Constructor line 98 | `_ensureSharedGeos()` call | replace with inline bossTorusGeo init |
| update() line 148 | `if (entry.shadowMesh) entry.shadowMesh.position.set(...)` | no shadow mesh after cleanup |
| update() lines 195, 209–211, 217–220, 226 | All `entry.smokeMesh` references (6 spots) | no smoke mesh |
| update() lines 242–249 | Entire `entry.crackMesh` if-block | no crack mesh |
| dying loop line 265 | `if (d.shadowMat) d.shadowMat.opacity = ...` | no shadow mat |
| dying struct init lines 116–118 | `smokeTex:`, `crackTex:`, `shadowMesh:`, `shadowMat:` fields in the `_dying.push({...})` call | no longer stored |
| `_createEntry()` lines 359–376 | Entire smoke sprite block (canvas, CanvasTexture, PlaneGeometry, smokeMesh) | deleted |
| `_createEntry()` lines 378–393 | Entire tank crack overlay block | deleted |
| `_createEntry()` lines 395–401 | Contact shadow block (shadowMat, shadowMesh, scene.add) | deleted |
| entry struct lines 414–419 | `smokeMesh`, `smokeTex`, `crackCanvas`, `crackCtx`, `crackTex`, `crackMesh`, `shadowMesh`, `shadowMat` fields | deleted |
| `_drawCracks()` method lines 504–522 | Entire method | deleted |
| `_disposeDying()` lines 527–528 | `d.smokeTex?.dispose()`, `d.crackTex?.dispose()` | deleted |
| `_disposeDying()` line 531 | `if (d.shadowMesh) { d.shadowMat?.dispose(); this._scene.remove(d.shadowMesh); }` | deleted |
| `_disposeEntry()` lines 535–536 | `entry.smokeTex?.dispose()`, `entry.crackTex?.dispose()` | deleted |
| `_disposeEntry()` line 539 | `if (entry.shadowMesh) { entry.shadowMat?.dispose(); this._scene.remove(entry.shadowMesh); }` | deleted |

**What to KEEP** (do not touch):

- GLB model loading via `assetLoader.getModel(car.type)` — all GLB types
- `_buildTank()` method — entire procedural tank geometry
- `_bossTorusGeo` and boss ring creation (lines 348–356)
- `colorMats` / `colorBaseHexes` tinting system
- Freeze tint (ICE_R/G/B 40% blend, lines 174–200)
- Emissive damage states (lines 202–228, minus smokeMesh refs)
- HP darkening `mult = 0.55 + 0.45 * hpRatio` (lines 231–239)
- Death animation scale+fade (lines 256–266, minus shadowMat line)
- Wheel spin, turret rotation, boss ring orbit
- `_disposeGroup()` — keep intact

- [ ] **Step 1: Fix `_ensureSharedGeos` and constructor**

Replace lines 80–99 with:

```javascript
let _bossTorusGeo = null;

// ── Car3D class ────────────────────────────────────────────────────────────────

export class Car3D {
  constructor(scene, lanes) {
    this._scene = scene;
    this._lanes = lanes;
    this._live  = new Map();
    this._dying = [];
    if (!_bossTorusGeo) _bossTorusGeo = new THREE.TorusGeometry(1.4, 0.06, 8, 28);
  }
```

- [ ] **Step 2: Remove dying struct fields in update()**

In `update()`, the `_dying.push({...})` block currently has:
```javascript
this._dying.push({
  group: entry.group,
  smokeTex: entry.smokeTex, crackTex: entry.crackTex,
  bossRing: entry.bossRing, bossRingMat: entry.bossRingMat,
  shadowMesh: entry.shadowMesh, shadowMat: entry.shadowMat, t: 0,
});
```

Replace with:
```javascript
this._dying.push({
  group: entry.group,
  bossRing: entry.bossRing, bossRingMat: entry.bossRingMat,
  t: 0,
});
```

- [ ] **Step 3: Remove shadow position update in update()**

Delete this line from the lane-loop body:
```javascript
if (entry.shadowMesh) entry.shadowMesh.position.set(laneToX(laneIdx), 0.005, entry.renderZ);
```

- [ ] **Step 4: Remove all smokeMesh references in update()**

Delete these 6 lines (they appear in 3 separate if-else branches):
```javascript
if (entry.smokeMesh) entry.smokeMesh.visible = false;     // frozen branch
if (entry.smokeMesh) {                                     // hpRatio < 0.35 branch
  entry.smokeMesh.visible = true;
  entry.smokeMesh.material.opacity = 0.3 + 0.35 * (1 - hpRatio / 0.35);
}
if (entry.smokeMesh) {                                     // hpRatio < 0.65 branch
  entry.smokeMesh.visible = true;
  entry.smokeMesh.material.opacity = 0.08 + 0.22 * (0.65 - hpRatio) / 0.30;
}
if (entry.smokeMesh) entry.smokeMesh.visible = false;     // healthy branch
```

- [ ] **Step 5: Remove crackMesh block in update()**

Delete the entire block:
```javascript
if (entry.crackMesh) {
  const stage = hpRatio > 0.75 ? 0 : hpRatio > 0.50 ? 1 : hpRatio > 0.25 ? 2 : 3;
  if (stage !== entry.lastCrackStage) {
    entry.lastCrackStage = stage;
    this._drawCracks(entry.crackCtx, stage);
    entry.crackTex.needsUpdate = true;
    entry.crackMesh.visible    = stage > 0;
  }
}
```

- [ ] **Step 6: Remove shadowMat fade in dying loop**

Delete:
```javascript
if (d.shadowMat) d.shadowMat.opacity = 0.28 * (1 - prog);
```

- [ ] **Step 7: Remove smoke + crack creation in _createEntry()**

Delete the three consecutive blocks (lines ~359–401):
```javascript
// Smoke sprite
const smokeCanvas = document.createElement('canvas');
smokeCanvas.width = smokeCanvas.height = 32;
// ... entire smoke block to smokeMesh group.add ...

// Tank crack overlay
let crackCanvas = null, crackCtx = null, crackTex = null, crackMesh = null;
if (car.type === 'tank') {
  // ... entire crack block ...
}

// Contact shadow
const shadowMat  = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
const shadowMesh = new THREE.Mesh(_shadowGeo, shadowMat);
shadowMesh.rotation.x = -Math.PI / 2;
shadowMesh.scale.set(1.05, 1, 1.20);
shadowMesh.position.set(laneToX(laneIdx), 0.005, posToZ(car.position));
this._scene.add(shadowMesh);
```

- [ ] **Step 8: Clean entry struct and remove _drawCracks**

Replace entry struct fields:
```javascript
// OLD
const entry = {
  group, bodyMat, colorMats, colorBaseHexes,
  headLights,
  wheels, turretGroup, lastRenderZ: startZ,
  lastHp: -1, lastCrackStage: -1, _prevFrozen: false,
  laneIdx, bossRing, bossRingMat, bossAngle: 0,
  smokeMesh, smokeTex: null, crackCanvas, crackCtx, crackTex, crackMesh,
  shadowMesh, shadowMat, groupY,
  renderZ: startZ, targetZ: startZ, lerpStartZ: startZ, lerpT: 1.0,
};
// Intentionally unused smokeTex ref (smoke canvas is owned by smokeMesh.material.map)
entry.smokeTex = smokeTex;
```

Replace with:
```javascript
const entry = {
  group, bodyMat, colorMats, colorBaseHexes,
  headLights,
  wheels, turretGroup, lastRenderZ: startZ,
  lastHp: -1, _prevFrozen: false,
  laneIdx, bossRing, bossRingMat, bossAngle: 0,
  groupY,
  renderZ: startZ, targetZ: startZ, lerpStartZ: startZ, lerpT: 1.0,
};
```

Delete the entire `_drawCracks()` method.

- [ ] **Step 9: Clean _disposeDying and _disposeEntry**

Replace `_disposeDying`:
```javascript
_disposeDying(d) {
  this._disposeGroup(d.group);
  if (d.bossRing) { d.bossRingMat?.dispose(); this._scene.remove(d.bossRing); }
}
```

Replace `_disposeEntry`:
```javascript
_disposeEntry(entry) {
  this._disposeGroup(entry.group);
  if (entry.bossRing) { entry.bossRingMat?.dispose(); this._scene.remove(entry.bossRing); }
}
```

- [ ] **Step 10: Update file comment at line 1**

Replace:
```javascript
// Car3D — manages all live car meshes in the 3D road scene.
// small/big/jeep/truck/bigrig → Kenney Car Kit GLB models (CC0).
// tank → procedural geometry (no Kenney 3D tank exists; the kit is 2D sprites only).
// HP sprite, damage darkening, smoke trail, death animation all preserved.
```

With:
```javascript
// Car3D — manages all live car meshes in the 3D road scene.
// small/big/jeep/truck/bigrig → Kenney Car Kit GLB models (CC0).
// tank → procedural geometry (no Kenney 3D tank exists; the kit is 2D sprites only).
```

- [ ] **Step 11: Run tests — must all pass**

```bash
cd C:\Users\dalit\lane-defense && npm test
```

Expected: 448+ tests passing, 0 failures.

- [ ] **Step 12: Verify line count under 300**

```bash
wc -l src/renderer3d/Car3D.js
```

Expected: ≤ 300 lines.

---

## Task 3: Shooter3D.js — delete halo/vignette/highlight CircleGeometry

**Files:**
- Modify: `src/renderer3d/Shooter3D.js`

**What to DELETE:**

| Range | What | Why |
|---|---|---|
| Lines 41–42 | `let _hlTex = null;` and `let _vignTex = null;` | textures for deleted meshes |
| Lines 44–59 | `_getHighlightTex()` function | used only by hlMesh |
| Lines 61–76 | `_getVignetteTex()` function | used only by vignMesh |
| `_createSlot()` lines 336–352 | haloMesh/haloMat block (CircleGeometry BOMB_R×1.55) | colored ground disc |
| `_createSlot()` lines 374–393 | vignMesh/vignMat block (CircleGeometry BOMB_R+0.010) | billiard vignette disc |
| `_createSlot()` lines 395–415 | hlMesh/hlMat block (CircleGeometry BOMB_R×0.66) | specular crescent disc |
| Return object lines 466–468 | `vignMesh, vignMat, hlMesh, hlMat, haloMesh, haloMat` | deleted meshes |
| `update()` line 248 | `slot.haloMat.color.setHex(hex);` | no haloMat |
| `dispose()` lines 308–316 | `slot.vignMesh.geometry.dispose()`, `slot.hlMesh.geometry.dispose()`, `slot.haloMesh.geometry.dispose()`, `slot.vignMat.dispose()`, `slot.hlMat.dispose()`, `slot.haloMat.dispose()` | deleted meshes |

**What to KEEP:**
- `SphereGeometry` bomb body (sphereMesh/sphereMat)
- `TubeGeometry` fuse (fuseMesh/fuseMat)
- `PlaneGeometry` damage badge (badgeMesh/badgeMat/badgeCanvas/badgeCtx/badgeTex)
- Spark beads (SphereGeometry SPARK_BEAD_RADIUS)
- `drawDamageBadge()` function
- All update logic (color sync, punch animation, Y-bob, flash decay)
- File comment at top (update to remove "colored ground halo" from description)

- [ ] **Step 1: Delete _hlTex, _vignTex module variables and both texture functions**

Delete lines 41–76:
```javascript
let _hlTex   = null;
let _vignTex = null;

/** Specular crescent: bright center fading to transparent, offset top-left. */
function _getHighlightTex() {
  // ... entire function ...
}

/** Vignette: transparent center → dark edge. Creates billiard-ball rim shading. */
function _getVignetteTex() {
  // ... entire function ...
}
```

- [ ] **Step 2: Delete haloMesh block in _createSlot()**

Delete the entire "Colored ground halo" section (~lines 336–352):
```javascript
// ── Colored ground halo — Royal Match style cast shadow ───────────────────
const haloMat = new THREE.MeshBasicMaterial({
  color:      new THREE.Color(0x888888),
  transparent: true,
  opacity:    0.38 * alpha,
  depthWrite: false,
});
const haloMesh = new THREE.Mesh(
  new THREE.CircleGeometry(BOMB_R * 1.55, 32),
  haloMat,
);
haloMesh.rotation.x = -Math.PI / 2;
haloMesh.position.set(BOMB_CX, 0.003, BOMB_CZ);
group.add(haloMesh);
```

- [ ] **Step 3: Delete vignMesh block in _createSlot()**

Delete the entire "Vignette disc" section (~lines 374–393):
```javascript
// ── Vignette disc — billiard-ball rim darkening ───────────────────────────
const vignMat = new THREE.MeshBasicMaterial({
  map:        _getVignetteTex(),
  transparent: true,
  opacity:    0.52 * alpha,
  depthTest:  false,
});
const vignMesh = new THREE.Mesh(
  new THREE.CircleGeometry(BOMB_R + 0.010, 32),
  vignMat,
);
vignMesh.rotation.x = -Math.PI / 2;
vignMesh.position.set(BOMB_CX, BOMB_CY + BOMB_R + 0.001, BOMB_CZ);
group.add(vignMesh);
```

- [ ] **Step 4: Delete hlMesh block in _createSlot()**

Delete the entire "Specular highlight" section (~lines 395–415):
```javascript
// ── Specular highlight — top-left white crescent ──────────────────────────
const hlMat = new THREE.MeshBasicMaterial({
  map:        _getHighlightTex(),
  transparent: true,
  opacity:    alpha * 0.90,
  depthTest:  false,
});
const hlMesh = new THREE.Mesh(
  new THREE.CircleGeometry(BOMB_R * 0.66, 18),
  hlMat,
);
hlMesh.rotation.x = -Math.PI / 2;
hlMesh.position.set(
  BOMB_CX - BOMB_R * 0.22,
  BOMB_CY + BOMB_R + 0.003,
  BOMB_CZ - BOMB_R * 0.22,
);
group.add(hlMesh);
```

- [ ] **Step 5: Trim the return object in _createSlot()**

Replace:
```javascript
return {
  group,
  sphereMesh, sphereMat,
  vignMesh,   vignMat,
  hlMesh,     hlMat,
  haloMesh,   haloMat,
  fuseMesh,   fuseMat,
  badgeCanvas, badgeCtx, badgeTex, badgeMesh, badgeMat,
  lastColor:  -1,
  lastDamage: -1,
  _punching: false, _punchT: 0,
  _flashing: false, _flashT: 0,
  _baseScale: scale,
};
```

With:
```javascript
return {
  group,
  sphereMesh, sphereMat,
  fuseMesh,   fuseMat,
  badgeCanvas, badgeCtx, badgeTex, badgeMesh, badgeMat,
  lastColor:  -1,
  lastDamage: -1,
  _punching: false, _punchT: 0,
  _flashing: false, _flashT: 0,
  _baseScale: scale,
};
```

- [ ] **Step 6: Remove haloMat.color sync in update()**

In the color-sync block, delete:
```javascript
slot.haloMat.color.setHex(hex);   // colored ground shadow matches bomb
```

- [ ] **Step 7: Trim dispose() method**

Replace the slot disposal loop body with:
```javascript
for (const slot of laneSlots) {
  slot.badgeTex.dispose();
  slot.sphereMesh.geometry.dispose();
  slot.fuseMesh.geometry.dispose();
  slot.badgeMesh.geometry.dispose();
  slot.sphereMat.dispose();
  slot.fuseMat.dispose();
  slot.badgeMat.dispose();
  this._scene.remove(slot.group);
}
```

- [ ] **Step 8: Update file comment at line 1**

Replace "Design: color-dominant sphere + billiard-ball shading + colored ground halo." with "Design: color-dominant sphere + fuse + damage badge."

- [ ] **Step 9: Run tests**

```bash
cd C:\Users\dalit\lane-defense && npm test
```

Expected: 448+ passing.

---

## Task 4: Tutorial systems — Playwright audit and dead-code cleanup

**Files:**
- Read: `src/screens/FTUEOverlay.js` (532 lines)
- Read: `src/screens/TutorialOrchestrator.js` (235 lines)
- Read: `src/screens/BoosterSpotlight.js` (325 lines)
- Read: `src/screens/CarTypeIntroCard.js`
- Modify: whichever contain dead/unreachable code

**Which systems are active (from GameApp.js trace):**

| System | Trigger | Status |
|---|---|---|
| `FTUEOverlay` | Level 1–3 cfg flags (showArrow, hintText, showAreaLabels) | Active |
| `BoosterSpotlight` | After BoosterUnlockScreen, SPOTLIGHT_BOOSTER map | Active |
| `TutorialOrchestrator` | Called from BoosterSpotlight callback and L6 bench | Active |
| `CarTypeIntroCard` | First time each car type appears | Active — KEEP |

All 4 systems are actively wired. The audit goal is:
1. Verify they DISPLAY correctly (not just "exist")
2. Find and delete unreachable code paths inside each file

- [ ] **Step 1: Screenshot L1 to verify FTUEOverlay**

```
browser_navigate: http://localhost:5173
# Start L1
browser_take_screenshot: l1_ftue.png
```

Expected: animated hand visible, "Drag bombs to matching cars!" banner at bottom.
If NOT visible: check `_makeFTUEOverlay()` conditions in GameApp.js line 1642.

- [ ] **Step 2: Screenshot L6 start to verify BoosterSpotlight**

Navigate to L6 (first booster unlock). Expected: spotlight animation appears over the new booster button.
If NOT visible: check `SPOTLIGHT_BOOSTER` map in GameApp.js.

- [ ] **Step 3: Screenshot L3 to verify TutorialOrchestrator area labels**

L3 config has `showAreaLabels: true`. Expected: "↑ INCOMING CARS" / "↓ YOUR SHOOTERS" text overlays.

- [ ] **Step 4: Audit each file for dead exports or unreachable code paths**

For each file, check for:
- Exported classes or functions that GameApp.js never imports
- Internal methods that are defined but never called
- Code guarded by always-false conditions

If any dead code found, delete it and note the change.

- [ ] **Step 5: Run tests**

```bash
cd C:\Users\dalit\lane-defense && npm test
```

---

## Task 5: GameApp.js — dead references cleanup

**Files:**
- Modify: `src/renderer/GameApp.js`

- [ ] **Step 1: Search for commented-out code blocks**

```bash
grep -n "^[[:space:]]*//" src/renderer/GameApp.js | grep -v "^.*\/\/ ──" | head -40
```

Section headers (`// ──`) are intentional. Multi-line commented-out code is not.

- [ ] **Step 2: Verify all tutorial imports are used**

Check each import against actual usage:
```bash
grep -n "ftueOverlay\|tutOrch\|boosterSpotlight\|carTypeIntroCard\|FTUEOverlay\|TutorialOrchestrator\|BoosterSpotlight\|CarTypeIntroCard" src/renderer/GameApp.js | head -30
```

If any import has zero usage beyond the declaration, remove it.

- [ ] **Step 3: Check for stale variable declarations**

Search for `let` declarations that are never assigned after declaration:
```bash
grep -n "let.*= null;" src/renderer/GameApp.js | head -30
```

Review each; remove any that are never used.

- [ ] **Step 4: Run tests**

```bash
cd C:\Users\dalit\lane-defense && npm test
```

Expected: 448+ passing.

---

## Task 6: Verify superpowers plugin

**Files:** None — verification only.

- [ ] **Step 1: Confirm obra/superpowers is installed**

```bash
npx skills list 2>&1 | head -20
```

Expected: `using-superpowers` in the list (confirmed installed in previous session).

---

## Task 7: Full test suite

**Files:** None.

- [ ] **Step 1: Run full test suite**

```bash
cd C:\Users\dalit\lane-defense && npm test 2>&1 | tail -20
```

Expected: `Tests: X passed` where X ≥ 448, zero failures.

- [ ] **Step 2: If failures exist, fix them before continuing**

Car3D and Shooter3D have no director-level test coverage (all tests are headless director tests). Expected: no failures. If any appear, check that the imports the tests depend on haven't been broken.

---

## Task 8: Playwright re-audit

**Files:** None — visual verification.

- [ ] **Step 1: Screenshot L1, L4, L8, L13**

```
browser_navigate: http://localhost:5173
browser_take_screenshot: l1_after.png
# navigate to L4, L8, L13
browser_take_screenshot: l4_after.png
browser_take_screenshot: l8_after.png
browser_take_screenshot: l13_after.png
```

- [ ] **Step 2: Verify all 4 Royal Match checklist items**

For each level screenshot:
1. Car colors vivid and clearly distinct by lane? (not washed-out grey)
2. HP indicators legible and visible?
3. FTUE overlays trigger and clear correctly?
4. Booster buttons animate and respond correctly?

- [ ] **Step 3: Verify ground halos GONE from bomb area**

With haloMesh deleted, bombs should show as clean spheres with no disc underneath.

- [ ] **Step 4: Verify shadow discs GONE from cars**

Cars should sit on the road with no circular shadow underneath.

If any "no" → fix before proceeding to commits.

---

## Task 9: Four commits

**Files:** All modified files.

- [ ] **Step 1: Commit 1 — Car3D cleanup**

```bash
cd C:\Users\dalit\lane-defense
git add src/renderer3d/Car3D.js
git commit -m "$(cat <<'EOF'
refactor(3d): remove smoke/crack/shadow meshes from Car3D

Deletes ~275 lines of canvas texture smoke sprites, crack overlays,
and CircleGeometry shadow discs that were never visible from the
top-down camera. Keeps GLB loading, candy-color system, freeze tint,
hit flash, death animation, boss ring, wheel spin, turret rotation.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: Commit 2 — Shooter3D cleanup**

```bash
git add src/renderer3d/Shooter3D.js
git commit -m "$(cat <<'EOF'
refactor(3d): delete halo/vignette/highlight CircleGeometry from Shooter3D

Removes three CircleGeometry instances (ground halo disc, billiard
vignette disc, specular crescent disc) and their shared textures.
Bomb column now renders as sphere + fuse + damage badge only.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Commit 3 — Tutorial audit result**

```bash
git add src/screens/FTUEOverlay.js src/screens/TutorialOrchestrator.js src/screens/BoosterSpotlight.js src/screens/CarTypeIntroCard.js
git commit -m "$(cat <<'EOF'
refactor(tutorial): remove dead code from tutorial system files

Audited all four tutorial systems with Playwright screenshots.
All four are active and wiring is correct. Removed unreachable
internal code paths found during audit.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

(Only create this commit if actual changes were made in Task 4.)

- [ ] **Step 4: Commit 4 — GameApp dead references**

```bash
git add src/renderer/GameApp.js
git commit -m "$(cat <<'EOF'
chore(app): remove dead imports and stale comments from GameApp

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

(Only create this commit if actual changes were made in Task 5.)

- [ ] **Step 5: Push**

```bash
git push origin master
```

---

## Self-Review Checklist

- [x] Car3D: delete targets listed exactly — smoke (PlaneGeometry canvas), crack (PlaneGeometry canvas), shadow (CircleGeometry 1.0 r14)
- [x] Car3D: boss ring (_bossTorusGeo) preserved — split from _ensureSharedGeos
- [x] Shooter3D: three CircleGeometry instances deleted — halo (1.55r), vignette (+0.01r), highlight (0.66r)
- [x] Shooter3D: damage badge PlaneGeometry KEPT — it's the correct UI element
- [x] Tutorial systems: all 4 verified active in GameApp.js before any deletion planned
- [x] No placeholder steps — every step has exact code or command
- [x] No test coverage exists for 3D renderer — verifying via Playwright only
