// GameRenderer3D — Orchestrator for the Three.js gameplay scene.
//
// Event API:
//   r3d.onHit(laneIdx, color, damage, isKill)
//   r3d.onMiss(laneIdx)
//   r3d.onShoot(laneIdx)
//   r3d.onBreach()
//   r3d.onShake()
//   r3d.setCombo(combo)
//   r3d.triggerDeployPunch(colIdx)
//   r3d.resetLevel()

import { Scene3D, posToZ } from './Scene3D.js';
import { Lighting3D }    from './Lighting3D.js';
import { levelTheme }    from './ThemeRegistry.js';
import { Road3D }        from './Road3D.js';
import { Skybox3D }      from './Skybox3D.js';
import { Car3D }         from './Car3D.js';
import { Shooter3D }     from './Shooter3D.js';
import { Projectile3D }  from './Projectile3D.js';
import { Particles3D }   from './Particles3D.js';
import { CameraFX }      from './CameraFX.js';
import { LaneFlash3D }   from './LaneFlash3D.js';
import { PostFX3D }      from './PostFX3D.js';
import { ScorchMarks3D } from './ScorchMarks3D.js';
import { Environment3D } from './Environment3D.js';
import { Ambient3D }     from './Ambient3D.js';

export class GameRenderer3D {
  constructor(width, height) {
    this._width   = width;
    this._height  = height;
    this._canvas  = null;
    this._scene3d  = null;
    this._lighting = null;
    this._road     = null;
    this._skybox   = null;
    this._cars     = null;
    this._shooters = null;
    this._projectiles = null;
    this._particles   = null;
    this._cameraFX    = null;
    this._laneFlash    = null;
    this._postFX       = null;
    this._scorchMarks  = null;
    this._environment  = null;
    this._ambient      = null;
    this._mounted  = false;

    // Per-lane cache of the front car's game position, updated every frame.
    // Used by onHit to place scorch marks at the correct position even if
    // the car has already been removed from the lane when the callback fires.
    this._laneCarPosCache = [50, 50, 50, 50];

    this._lanes       = null;
    this._columns     = null;
    this._firingSlots = null;
    this._prevFrozen  = false;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  init() {
    if (this._mounted) return;

    this._canvas = document.createElement('canvas');
    this._canvas.id = 'three-canvas';
    this._canvas.style.cssText = [
      'position:absolute',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      'z-index:0',
      'pointer-events:none',
    ].join(';');

    const pixiCanvas = document.querySelector('canvas:not(#three-canvas)');
    if (pixiCanvas) {
      pixiCanvas.style.background = 'transparent';
      pixiCanvas.style.zIndex     = '1';
      document.body.insertBefore(this._canvas, pixiCanvas);
    } else {
      document.body.appendChild(this._canvas);
    }

    this._syncCanvasSize();

    this._scene3d  = new Scene3D(this._canvas, this._width, this._height);
    this._lighting = new Lighting3D(this._scene3d.scene);
    this._skybox   = new Skybox3D(this._scene3d.scene);
    this._skybox._group.visible = false;  // sky/hills geometry not suited for top-down view
    this._road     = new Road3D(this._scene3d.scene);
    this._cameraFX    = new CameraFX(this._scene3d.camera);
    this._laneFlash   = new LaneFlash3D(this._scene3d.scene);
    this._scorchMarks = new ScorchMarks3D(this._scene3d.scene);
    this._postFX      = new PostFX3D(this._scene3d.composer);
    this._environment = new Environment3D(this._scene3d.scene);
    this._environment.setVisible(false);  // grass/flowers not suited for top-down view
    this._ambient     = new Ambient3D(this._scene3d.scene);
    this._ambient._group.visible = false;  // light rays / birds appear as corner artifacts in top-down view

    this._mounted = true;
  }

  setGameData(lanes, columns, firingSlots) {
    this._lanes       = lanes;
    this._columns     = columns;
    this._firingSlots = firingSlots;
    if (this._mounted) this._buildGameObjects();
  }

  show() { if (this._canvas) this._canvas.style.display = ''; }
  hide() { if (this._canvas) this._canvas.style.display = 'none'; }
  isVisible() { return !!this._canvas && this._canvas.style.display !== 'none'; }

  // Apply per-level theme: sky gradient, lighting, fog, and background.
  applyTheme(levelId) {
    if (!this._scene3d) return;
    const theme = levelTheme(typeof levelId === 'number' ? levelId : 5);
    const fog   = this._scene3d.scene.fog;
    if (fog) {
      fog.color.setHex(theme.fog.color);
      fog.near = theme.fog.near;
      fog.far  = theme.fog.far;
    }
    // Background tints the area outside the road — use sky zenith so each
    // theme has a distinct outer-frame color (sunset indigo vs misty grey).
    if (this._scene3d.scene.background && theme.sky?.zenith != null) {
      this._scene3d.scene.background.setHex(theme.sky.zenith);
    }
    this._lighting?.setTheme(theme);
    this._skybox?.setTheme(theme);
    this._cars?.setTheme(theme);
    this._road?.setTheme?.(theme);
  }

  resetLevel() {
    this._cars?.clearAll();
    this._projectiles?.reset();
    this._particles?.dispose();
    this._laneFlash?.dispose();
    this._scorchMarks?.dispose();
    this._cameraFX?.reset();
    this._postFX?.setBreach(0);
    this._postFX?.setCombo(0);
    this._skybox?.setCombo(0);
    if (this._mounted && this._lanes) {
      this._particles   = new Particles3D(this._scene3d.scene, this._lighting, this._lanes);
      this._laneFlash   = new LaneFlash3D(this._scene3d.scene);
      this._scorchMarks = new ScorchMarks3D(this._scene3d.scene);
    }
  }

  // ── Event API (called from GameApp callbacks) ──────────────────────────────

  /** Colored hit sparks + damage number + optional explosion. */
  /**
   * Immediate impact reaction, fired the instant the projectile lands (before the
   * hit-stop resolves combat). Squashes + flashes the still-present target car, so
   * even a KILL shows the car react before it explodes.
   */
  onImpact(laneIdx, color) {
    this._cars?.triggerPowerHit(laneIdx, false);
    this._particles?.spawnFlash(laneIdx, color, null, 0.6);
    this._particles?.spawnShockwave(laneIdx, color);   // 1A: ground impact ring
  }

  /**
   * Combat resolved. `killCount` = cars destroyed by this shot (0 = survived).
   * Shake / chroma / explosion size escalate with the multi-kill count so a 4-car
   * shot reacts proportionally bigger than a 1-car shot. The car squash/flash has
   * already played via onImpact.
   */
  onHit(laneIdx, color, damage, killCount = 0) {
    this._particles?.spawnHit(laneIdx, color);
    if (killCount > 0) {
      const k      = Math.min(4, killCount);
      const shake  = { 1: 0.12, 2: 0.18, 3: 0.25, 4: 0.35 }[k];
      const chroma = { 1: 0.022, 2: 0.035, 3: 0.050, 4: 0.070 }[k];
      const escale = { 1: 1.0,  2: 1.3,  3: 1.6,  4: 2.0 }[k];
      this._particles?.spawnExplosion(laneIdx, color, escale);
      this._particles?.spawnKillNumber(laneIdx, color, damage);   // 1C: +N kill popup
      this._cameraFX?.shake(shake, 0.25 + 0.06 * (k - 1));
      this._postFX?.triggerChroma(chroma, 0.30);
      const cachedPos = this._laneCarPosCache[laneIdx] ?? 50;
      this._scorchMarks?.spawnScorch(laneIdx, cachedPos);
    } else {
      // Non-killing hit: car survived. The squash + flash already fired in onImpact.
      this._particles?.spawnDamageNumber(laneIdx, damage);
      this._postFX?.triggerChroma(0.010, 0.18);
    }
  }

  /** Wrong-color shot: grey puffs + a red "rejected" bounce-back, and a shake of
   *  just the bomb zone (not the whole screen). (1D) */
  onMiss(laneIdx) {
    this._particles?.spawnMiss(laneIdx);
    this._particles?.spawnMissBounce(laneIdx);          // red blob kicks back to player
    this._particles?.spawnFlash(laneIdx, 'Red', null, 0.5);  // brief red flash on the bomb
    this._shooters?.shakeZone();                        // jitter the bomb queue only
    this._postFX?.triggerChroma(0.006, 0.15);
  }

  onShoot(laneIdx) {
    // Lane flash disabled — no lane glow during gameplay.
  }

  onBreach() {
    this._cameraFX?.startBreachZoom(0.50);
    this._cameraFX?.shake(0.30, 0.50);
    this._postFX?.setBreach(1.0);
    this._postFX?.triggerChroma(0.04, 0.60);
  }

  onShake(magnitude = 0.10) {
    this._cameraFX?.shake(magnitude, 0.20);
  }

  setCombo(combo) {
    this._cameraFX?.setCombo(combo);
    this._postFX?.setCombo(combo);
    this._skybox?.setCombo(combo);   // drives aurora amplitude + colour shift
    // Keep bloom at resting level regardless of combo — headlights bloom yellow above 0.65+
    this._scene3d?.setBloomStrength(0.65);
  }

  triggerDeployPunch(colIdx) {
    this._shooters?.triggerPunch(colIdx);
  }

  /** Gold bloom burst when CRISIS assist fires — the cavalry has arrived. */
  triggerCrisisGlow(colIdx) {
    this._shooters?.triggerPunch(colIdx);
    this._scene3d?.setBloomStrength(1.8);
    this._cameraFX?.shake(0.05, 0.20);
  }

  /**
   * Bomb detonated — large AOE explosion + concussion freeze visual.
   * @param {number} bombPos  road-position 0-100 where bomb was placed
   * @param {number} carsHit  number of cars damaged
   */
  onBombExplode(bombPos, carsHit) {
    this._particles?.spawnBombExplosion(bombPos);
    const shakeMag = 0.30 + Math.min(carsHit, 6) * 0.04;
    this._cameraFX?.shake(shakeMag, 0.55);
    this._scene3d?.setBloomStrength(1.5);
    this._postFX?.triggerChroma(0.05, 0.60);
    // Expanding ring decal on road surface + white screen flash
    this._road?.spawnBombRing(bombPos);
    this._postFX?.setFlash(0.4, 0.05);
  }

  /**
   * Color-bomb power shot fired — a 3-stage cascade rather than one simultaneous blast.
   * Called from GameApp._onColorBomb after _fireColorBomb removes cars.
   *   Stage 1 (0ms):     every matching car flashes its colour at ~2x intensity (120ms)
   *   Stage 2 (120ms+):  cars explode one-by-one, 50ms apart, FRONT-to-BACK
   *                      (closest to breach first)
   *   Stage 3 (after last): the full-clear bloom / chroma / shake fires once
   * Positions are captured before removal, so explosions land where the cars were.
   */
  onColorBomb(color, killed = []) {
    if (!killed.length) return;

    // Front-to-back: closest to the breach (highest position) detonates first.
    const order = [...killed].sort((a, b) => b.position - a.position);

    const FLASH_MS = 120;   // stage-1 highlight duration before detonations begin
    const STEP_MS  = 50;    // gap between consecutive explosions

    // ── Stage 1 — all matching cars flash simultaneously ──────────────────────
    for (const k of order) this._particles?.spawnFlash(k.laneIdx, color, k.position);
    this._postFX?.setFlash(0.28, 0.10);   // subtle global pre-flash

    // ── Stage 2 — staggered detonations, front to back ────────────────────────
    order.forEach((k, i) => {
      setTimeout(() => {
        this._particles?.spawnExplosion(k.laneIdx, color, 2.2, k.position);
        this._cameraFX?.shake(0.10, 0.12);   // small kick per pop
      }, FLASH_MS + i * STEP_MS);
    });

    // ── Stage 3 — full-clear punctuation, once, after the last explosion ───────
    const lastMs = FLASH_MS + (order.length - 1) * STEP_MS;
    setTimeout(() => {
      this._cameraFX?.shake(0.45, 0.65);
      this._scene3d?.setBloomStrength(3.0);
      this._postFX?.triggerChroma(0.09, 1.00);
      this._postFX?.setFlash(0.55, 0.12);
    }, lastMs + 30);
  }

  /** DEV proof helper: front car's current {x,y} mesh scale in a lane. */
  peekCarScale(laneIdx) { return this._cars?.peekFrontScale(laneIdx) ?? null; }

  /** 3B: highlight the grabbed column's bomb (-1 = none). */
  setSelectedBomb(colIdx) { this._shooters?.setSelectedColumn(colIdx); }

  /** 3D: pulse a column's stash slot on place/retrieve. */
  pulseStash(colIdx) { this._shooters?.pulseStash(colIdx); }

  // Project a queue slot's bomb (3D) to 2D screen pixels (stage coords) by running
  // its world position through the actual camera — the ground-truth on-screen
  // centre. Used by 2D overlays (the merge halo) so they land exactly on the bomb.
  getBombSlotScreenXY(col, row) {
    const world = this._shooters?.getSlotWorldPosition(col, row);
    const cam   = this._scene3d?.camera;
    if (!world || !cam) return null;
    world.project(cam);   // world → NDC [-1,1]
    return {
      x: (world.x * 0.5 + 0.5) * this._width,
      y: (-world.y * 0.5 + 0.5) * this._height,
    };
  }

  // ── Merge-sequence passthroughs to Shooter3D (3D bomb-group control) ──────────
  lockBombSlot(col, row, locked)      { this._shooters?.setSlotAnimLock(col, row, locked); }
  setBombSlotScale(col, row, s)       { this._shooters?.setSlotScale(col, row, s); }
  setBombSlotWorld(col, row, x, y, z) { this._shooters?.setSlotWorldXYZ(col, row, x, y, z); }
  getBombSlotWorld(col, row)          { return this._shooters?.getSlotWorldPosition(col, row) ?? null; }
  getBombSlotBaseWorld(col, row)      { return this._shooters?.getSlotBaseWorld(col, row) ?? null; }
  resetBombSlot(col, row)             { this._shooters?.resetSlotTransform(col, row); }
  clearBombAnimLocks()                { this._shooters?.clearAllAnimLocks(); }

  /** Set the world {x,z} the next bomb in this lane should travel FROM (release point). */
  setDropStart(laneIdx, world) { this._projectiles?.setNextStart(laneIdx, world); }

  /** Grid stepped one row — punctuate it with a light sweep across the road. */
  onAdvance() {
    this._road?.triggerAdvanceSweep();
  }

  /** Show a colored glow plane on the road lane during drag-hover. */
  showLaneGlow(laneIdx, colorHex) {
    this._road?.showLaneGlow(laneIdx, colorHex);
  }

  /** Remove the lane glow plane when pointer leaves the lane. */
  clearLaneGlow() {
    this._road?.clearLaneGlow();
  }

  /** Sweep camera from high steep angle to gameplay position over 0.6 s. */
  startLevelIntro() {
    this._cameraFX?.startLevelIntro();
  }

  setActiveLaneCount(n) {
    this._activeLaneCount = n;       // remembered so rebuilt Car3D can re-apply it
    this._scene3d?.setLaneCount(n);
    this._road?.setLaneCount(n);
    this._cameraFX?.setLaneCount(n);
    this._shooters?.setLaneCount(n);
    this._cars?.setLaneCount(n);     // center cars on low-lane roads (fixes L1-3)
    this._environment?.setLaneCount(n);
  }

  setActiveColCount(n) {
    this._shooters?.setActiveColCount(n);
  }

  // ── Per-frame update ────────────────────────────────────────────────────────

  update(gameState, dt, elapsed) {
    if (!this._mounted) return;
    if (this._canvas?.style.display === 'none') return;

    // Sync gridRows to Car3D for danger aura proximity calculation.
    if (gameState?.gridRows && this._cars) {
      this._cars.setGridRows(gameState.gridRows);
    }

    const isFrozen = (gameState?.boosterState?.isFrozen?.() ?? false)
      || (gameState?.lanes && elapsed < (gameState.bombFreezeUntil ?? -Infinity))
      || (gameState?.comboFreezeShots ?? 0) > 0;

    // Detect freeze onset — spawn ice burst on each lane that has a car
    if (isFrozen && !this._prevFrozen && this._particles && this._lanes) {
      for (let i = 0; i < this._lanes.length; i++) {
        if (this._lanes[i]?.cars.length > 0) this._particles.spawnFreezeActivation(i);
      }
    }
    this._prevFrozen = isFrozen;

    // 4A: while frozen, keep emitting drifting ice crystals above each frozen car.
    if (isFrozen && this._particles && this._lanes) {
      this._freezeEmitT = (this._freezeEmitT ?? 0) + dt;
      if (this._freezeEmitT >= 0.18) {
        this._freezeEmitT = 0;
        for (let i = 0; i < this._lanes.length; i++) {
          if (this._lanes[i]?.cars.length > 0) this._particles.spawnIceSparkle(i);
        }
      }
    }

    this._lighting.update(dt);
    this._skybox.update(dt);
    this._road.update(dt);
    this._environment?.update(dt);
    this._ambient?.update(dt);
    this._cameraFX?.update(dt);
    this._laneFlash?.update(dt);
    this._scorchMarks?.update(dt);
    this._particles?.update(dt);
    this._postFX?.update(dt);
    this._cars?.update(dt, isFrozen);
    this._shooters?.update(dt, elapsed, gameState?.colorBombArmed ?? false);
    this._projectiles?.update(dt);

    // Decay breach back to 0 when not active.
    if (this._postFX && this._postFX._breachTarget > 0 && !gameState?.isBreaching) {
      this._postFX.setBreach(0);
    }

    // Update front-car position cache (before cars may be removed by combat).
    if (this._lanes) {
      for (let i = 0; i < this._lanes.length; i++) {
        const fc = this._lanes[i]?.cars[0];
        if (fc) this._laneCarPosCache[i] = fc.position;
      }
    }

    // Decay bloom back to resting strength.
    if (this._scene3d) {
      const cur  = this._scene3d?.getBloomStrength() ?? 0.65;
      const rest = 0.65;
      if (cur > rest) this._scene3d.setBloomStrength(cur - dt * 0.8);
    }
  }

  render() {
    if (!this._mounted) return;
    if (this._canvas?.style.display === 'none') return;
    this._scene3d.renderDual();
  }

  // ── Teardown ────────────────────────────────────────────────────────────────

  destroy() {
    if (!this._mounted) return;

    this._cars?.clearAll();
    this._projectiles?.dispose();
    this._shooters?.dispose();
    this._particles?.dispose();
    this._laneFlash?.dispose();
    this._scorchMarks?.dispose();
    this._postFX?.dispose();
    this._environment?.dispose();
    this._ambient?.dispose();
    this._road?.dispose();
    this._skybox?.dispose();
    this._lighting?.dispose();
    this._cameraFX?.reset();
    this._scene3d?.destroy();

    this._canvas?.parentNode?.removeChild(this._canvas);

    const pixiCanvas = document.querySelector('canvas');
    if (pixiCanvas) {
      pixiCanvas.style.background = '';
      pixiCanvas.style.zIndex     = '';
    }

    this._canvas      = null;
    this._scene3d     = null;
    this._lighting    = null;
    this._road        = null;
    this._skybox      = null;
    this._cars        = null;
    this._shooters    = null;
    this._projectiles = null;
    this._particles   = null;
    this._cameraFX    = null;
    this._laneFlash    = null;
    this._postFX       = null;
    this._scorchMarks  = null;
    this._environment  = null;
    this._ambient      = null;
    this._mounted      = false;
  }

  // ── Resize ──────────────────────────────────────────────────────────────────

  onResize() {
    if (!this._mounted) return;
    this._syncCanvasSize();
    this._scene3d.resize(this._width, this._height);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _buildGameObjects() {
    if (!this._mounted || !this._lanes) return;

    this._cars?.clearAll();
    this._projectiles?.dispose();
    this._shooters?.dispose();
    this._particles?.dispose();

    const scene = this._scene3d.scene;
    this._cars        = new Car3D(scene, this._lanes);
    this._shooters    = new Shooter3D(scene, this._columns);
    this._projectiles = new Projectile3D(scene, this._firingSlots, this._lanes);
    this._particles   = new Particles3D(scene, this._lighting, this._lanes);
    // Re-apply the active lane count to the freshly-built renderers.
    if (this._activeLaneCount != null) {
      this._cars.setLaneCount(this._activeLaneCount);
      this._shooters.setLaneCount(this._activeLaneCount);
    }
  }

  

  _syncCanvasSize() {
    if (!this._canvas) return;
    const pixiCanvas = document.querySelector('canvas:not(#three-canvas)');
    if (pixiCanvas) {
      this._canvas.style.width  = pixiCanvas.style.width;
      this._canvas.style.height = pixiCanvas.style.height;
    } else {
      const scale = Math.min(window.innerWidth / this._width, window.innerHeight / this._height);
      this._canvas.style.width  = `${this._width  * scale}px`;
      this._canvas.style.height = `${this._height * scale}px`;
    }
  }
}
