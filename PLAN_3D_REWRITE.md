# Plan: Full 3D Renderer Rewrite — Lane Defense

## Architecture Decision

**Two-renderer strategy (pragmatic, production-grade):**
- **Three.js** → Gameplay scene: 3D road, cars, shooters, particles, lighting, post-processing
- **PixiJS** → Meta screens only (Title, LevelSelect, Win, Lose, Shop, Pause, etc.) — kept 100% intact
- **HTML/CSS overlay** → In-game HUD (timer bar, combo, coins) replacing HUDRenderer.js

**What stays untouched:**
- `src/game/` — GameLoop, GameState, CombatResolver, BoosterState, etc.
- `src/models/` — Lane, Column, Shooter, Car data models
- `src/director/` — CarDirector, ShooterDirector, FairnessArbiter
- `src/input/` — DragDrop, InputManager (interaction zones stay screen-space)
- `src/audio/` — AudioManager (all synthesized, untouched)
- `src/analytics/` — Analytics, AutoTuner
- `src/screens/` — all 14 meta screens (PixiJS, untouched)

**What gets replaced:**
- `src/renderer/GameApp.js` — bootstrap modified to route gameplay to Three.js
- `src/renderer/LaneRenderer.js` → `src/renderer3d/Road3D.js`
- `src/renderer/CarRenderer.js` → `src/renderer3d/Car3D.js`
- `src/renderer/ShooterRenderer.js` → `src/renderer3d/Shooter3D.js`
- `src/renderer/ParticleSystem.js` → `src/renderer3d/Particles3D.js`
- `src/renderer/HUDRenderer.js` → HTML/CSS `id="hud-overlay"` div
- `src/renderer/CityBackground.js` → `src/renderer3d/Skybox3D.js`
- `src/renderer/FiringLineRenderer.js` → merged into Shooter3D / Particles3D
- `src/renderer/ComboGlow.js` → bloom post-processing replaces this
- `src/renderer/LaneFlash.js` → 3D plane mesh flash effect

---

## New Files: `src/renderer3d/`

### 1. `Scene3D.js` — Three.js scene + EffectComposer
- `THREE.WebGLRenderer` at 390×844, shadow maps (PCFSoftShadowMap), device pixel ratio
- Camera: `PerspectiveCamera(55°, 390/844)` at position (0, 8, 14), looking at (0, 0, -10)
- Post-processing via `EffectComposer`:
  - `RenderPass`
  - `UnrealBloomPass` (strength 0.9, radius 0.4, threshold 0.3) — glow on bright objects
  - `OutputPass`
- Coordinate system: Z=-40 (far, position 0) → Z=0 (near, position 100); X=-3 to +3 (4 lanes)
- Exports `posToWorld(laneIdx, position)` helper for mapping game coords to 3D world coords

### 2. `Lighting3D.js` — Static + Dynamic lights
- `AmbientLight` (0x334466, intensity 0.4) — night-time base
- `DirectionalLight` (0x8899bb, intensity 0.8) — moonlight from upper-left, casts shadows
- `HemisphereLight` (sky: 0x223355, ground: 0x110822, intensity 0.3) — fill light
- Pool of 8 `PointLight`s for dynamic explosion flashes (color-matched to shooter, intensity burst → 0 over 0.4s)

### 3. `Road3D.js` — 3D road + environment mesh
- `PlaneGeometry` road surface extending from Z=-40 to Z=2, 12 units wide
  - Material: `MeshStandardMaterial` with procedural asphalt texture (dark grey, roughness 0.9, metalness 0.0)
  - Custom UV mapping for lane-stripe detail
- Lane dividers: white `PlaneGeometry` strips along Z axis, emissive (0xffffff, 0.3) so they glow slightly
- Concrete barriers: `BoxGeometry` on left/right edges, grey material with edge highlight
- Lamp posts: `CylinderGeometry` poles + `SphereGeometry` heads with `emissive: 0xffee88`
  - Each lamp has a `PointLight` (warm yellow, intensity 0.3, distance 8)
- Horizon atmospheric fog: `THREE.FogExp2(0x090e16, 0.025)`
- Breach indicator: red emissive `PlaneGeometry` at Z=0, pulsing emissiveIntensity via sine wave

### 4. `Skybox3D.js` — City silhouette + sky
- `THREE.Scene.background` = dark gradient texture (0x090e16 → 0x0f1c2a)
- City buildings: `BoxGeometry` silhouettes at Z=-45 (behind road), no shadows, dark material
- Moon: `SphereGeometry` (radius 0.4) at upper-right, emissive white
- Animated clouds: textured planes drifting along X
- Parallax: far buildings move at 0.2× camera-relative X, near at 0.5×

### 5. `Car3D.js` — 3D car objects
Each car is a `THREE.Group` containing:
- **Body**: `BoxGeometry(1.6, 0.5, 2.4)` with `MeshStandardMaterial` (color-matched, metalness 0.4, roughness 0.5)
- **Roof**: `BoxGeometry(1.1, 0.35, 1.4)` offset up+back, slightly darker
- **Windshield**: `PlaneGeometry` with transparent glass material (opacity 0.3, emissive 0x88aaff)
- **Wheels**: 4× `CylinderGeometry` rotated 90°, black rubber material
- **Headlights**: 2× small emissive boxes (0xffffaa) with `PointLight` (dim yellow, distance 4)
- **Shadow**: `castShadow = true`, `receiveShadow = true`

**Position**: mapped via `posToWorld(laneIdx, position)`, Y=0 (on road), scale via z-depth (closer = larger)
**Death animation**: 3D burst — body scale x1.4, Y-velocity +2 units/s, rotation tumble, alpha fade via dissolve material opacity
**HP bar**: `THREE.Sprite` above car using `SpriteMaterial` + canvas texture (green → yellow → red)
**Freeze tint**: blue emissive overlay material (0x4488ff, 0.3 intensity)

### 6. `Shooter3D.js` — 3D turret objects
Each shooter is a `THREE.Group` containing:
- **Base platform**: `CylinderGeometry` (flat disc), dark material
- **Turret body**: `BoxGeometry` (squat box), color-matched
- **Barrel**: `CylinderGeometry` (tall, thin), pointing UP (+Y), color-matched
- **Muzzle tip**: `SphereGeometry` (small, dark)
- **Emissive ring**: thin torus around base, color-matched glow

**4 Columns**: shooters placed at fixed X positions (-4.5, -1.5, +1.5, +4.5), Y below road (Y=-1.5)
**Stacking**: column shows top-3 shooters; 2nd shooter offset -Y and 80% scale; 3rd = 60% scale
**Deploy animation**: barrel rotates to face lane, scale punch 1.3× → 1.0× over 0.15s
**Fire animation**: barrel recoil (translate -Y 0.1 → +Y 0.1, 0.1s)
**Muzzle flash**: `PointLight` burst at barrel tip (color-matched, intensity 2.0 → 0 over 0.1s)
**Idle bounce**: subtle Y oscillation ±0.05 units at 2.4 Hz

### 7. `Projectile3D.js` — Shots with trails
- Each shot: `SphereGeometry(0.08)` with `MeshStandardMaterial` (emissive = shooter color)
- **Trail**: `THREE.Points` system — 12 trailing particles spawned behind projectile, fading out
- Travel from shooter barrel tip → car position over SHOT_TRAVEL_TIME (0.12s), speed: ~500 units/s
- `PointLight` on projectile (color-matched, intensity 0.5, distance 3) for projectile glow

### 8. `Particles3D.js` — Explosion + spark system
- **Spark burst** (hit): 4–6 `THREE.Points` emitted outward in shooter-color
- **Explosion** (kill): 10–14 particles, larger, colored + white core, with `PointLight` flash
- **Damage numbers**: `THREE.Sprite` with canvas-rendered "-X" text, floats up 1.5 units in 0.5s
- **Shockwave**: flat `RingGeometry` at impact point, scales 0 → 3 and alpha → 0 over 0.3s

### 9. `CameraFX.js` — Camera animations
- **Shake**: random jitter on camera.position.x/y, decaying over 0.35s (breach, big kills)
- **Breach zoom**: camera.fov 55° → 48° → 55° over 0.5s (sinusoidal), `camera.updateProjectionMatrix()`
- **High combo**: subtle camera pull-back at combo 12+ (z += 1.5) over 1s
- **Freeze booster**: brief desaturation via ColorCorrectionShader on EffectComposer

### 10. `HUD3D.js` — HTML overlay (replaces HUDRenderer.js)
```html
<div id="hud-overlay">
  <div id="timer-bar-track"><div id="timer-bar-fill"></div></div>
  <div id="hud-combo"></div>
  <div id="hud-coins"></div>
  <button id="btn-pause"></button>
</div>
```
- Positioned absolutely over Three.js canvas via CSS
- `update(gameState)` called from render loop: updates timer width, combo text + color tier, coin count
- Timer fill color interpolated via JS: green → yellow → red
- Combo text scales via CSS `transform: scale()` for spring-like bounce

### 11. `LaneFlash3D.js` — Deploy feedback
- Flat `PlaneGeometry` the width of the breached lane, at Z=0..−40 (full lane length)
- Material: `MeshBasicMaterial(color: 0xffffff, transparent: true, alpha: 0.38 → 0 over 0.18s)`
- Created per-deploy, destroyed on fade-out

### 12. `GameRenderer3D.js` — Orchestrator (replaces PixiJS gameplay rendering)
- Owns Scene3D, Lighting3D, Road3D, Skybox3D, Car3D pool, Shooter3D pool, Particles3D, CameraFX, HUD3D
- `init()` — build scene, insert Three.js canvas into DOM
- `update(gameState, dt)` — sync all 3D objects to gameState, tick animations
- `destroy()` — tear down Three.js canvas, restore PixiJS canvas for screens

---

## Modified Files

### `package.json`
- Add: `"three": "^0.167.0"` to dependencies

### `index.html`
- Add `<div id="hud-overlay">` (initially hidden)
- Add CSS: `#hud-overlay { position: absolute; top: 0; left: 0; pointer-events: none; }`

### `src/renderer/GameApp.js`
- During `showScreen('game')`: mount `GameRenderer3D`, hide PixiJS canvas
- During `showScreen('win'/'lose'/'title'/etc.)`: destroy GameRenderer3D, show PixiJS canvas
- Pass the same `gameState` and `gameLoop` callbacks to GameRenderer3D
- Screen transition: fade-in/out both canvases

### `src/input/DragDrop.js` — minimal changes
- Shooter column hit areas stay in screen-space (same pixel positions: 4 × 97.5px columns)
- Lane drop zones map to screen-space X bands (unchanged: 0–97.5, 97.5–195, 195–292.5, 292.5–390)
- No 3D raycasting needed; game is still portrait mobile with fixed layout

---

## Phase Plan

### Phase 1 — Foundation (Scene + Road)
1. `npm install three`
2. Implement `Scene3D.js`: renderer, camera, EffectComposer + UnrealBloomPass
3. Implement `Lighting3D.js`: static lights
4. Implement `Road3D.js`: 3D road mesh, lane dividers, barriers, lamp posts, fog, breach line
5. Implement `Skybox3D.js`: city silhouette, moon, clouds
6. Wire `GameRenderer3D.js` skeleton + test scene renders correctly

### Phase 2 — Game Objects (Cars + Shooters)
7. Implement `Car3D.js`: procedural mesh, PBR material, headlights, death animation, HP sprite
8. Implement `Shooter3D.js`: turret geometry, barrel, idle bounce, deploy/fire animations
9. Implement `Projectile3D.js`: shot with particle trail, muzzle flash light
10. Connect to GameState: car positions, HP, death events, shooter deployment events

### Phase 3 — Effects + Post-Processing
11. Implement `Particles3D.js`: sparks, explosions, shockwave ring, damage number sprites
12. Implement `CameraFX.js`: shake, breach zoom, high-combo pull-back
13. Implement `LaneFlash3D.js`: per-deploy white flash plane
14. Tune UnrealBloomPass + add ColorCorrectionShader for game-over desaturation

### Phase 4 — HUD + Integration
15. Implement `HUD3D.js`: HTML overlay, timer bar, combo, coins
16. Modify `GameApp.js`: dual-renderer routing (Three.js ↔ PixiJS), canvas swap on screen transitions
17. Wire input: verify DragDrop still works with Three.js canvas on top
18. Smoke-test full game loop: title → gameplay → win/lose → back to title

### Phase 5 — Polish
19. Add dynamic point lights from explosions (pool of 8 lights in Lighting3D)
20. Add car damage state (bump roughness, dim headlights after each hit)
21. Tune fog, bloom threshold, shadow quality for mobile performance
22. Add freeze-booster desaturation (ColorMatrixShader on EffectComposer)
23. Final pass: timing, easing, juice

---

## Visual Outcome vs. Current

| Feature | Before (2D PixiJS) | After (Three.js) |
|---|---|---|
| Road geometry | Flat trapezoid (2D) | Real 3D mesh, recedes to horizon |
| Car rendering | Flat sprites / rounded rects | 3D box cars with PBR, metallic finish |
| Car headlights | None | Emissive + PointLight casting light on road |
| Shadows | Ellipse sprite below car | Real-time PCFSoft shadows on road |
| Explosions | Circle particles (2D) | 3D particle burst + shockwave ring + bloom glow |
| Projectile | Plain colored circle | 3D sphere with particle trail + glow |
| Glow | Multi-pass 2D Graphics | GPU bloom (UnrealBloomPass) |
| Lighting | Static painted-on | Ambient + directional + dynamic explosion lights |
| Camera | Static (2D canvas) | 3D camera with shake, FoV zoom, pull-back |
| Atmospheric depth | Fog-colored overlay | THREE.FogExp2 (true depth fog) |
| Color grading | None | ColorCorrectionShader (game-over desaturation, high-combo warmth) |
| Shooter cannons | Programmatic 2D shapes | 3D turret with barrel recoil + muzzle flash light |
