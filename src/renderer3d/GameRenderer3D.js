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

import { Scene3D }       from './Scene3D.js';
import { Lighting3D }    from './Lighting3D.js';
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
    this._laneFlash   = null;
    this._postFX      = null;
    this._scorchMarks = null;
    this._mounted  = false;

    // Per-lane cache of the front car's game position, updated every frame.
    // Used by onHit to place scorch marks at the correct position even if
    // the car has already been removed from the lane when the callback fires.
    this._laneCarPosCache = [50, 50, 50, 50];

    // Accumulated time used to drive the 1Hz danger-warning bloom pulse.
    this._warningPhase = 0;

    this._lanes       = null;
    this._columns     = null;
    this._firingSlots = null;
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
    this._road     = new Road3D(this._scene3d.scene);
    this._cameraFX = new CameraFX(this._scene3d.camera);
    this._laneFlash = new LaneFlash3D(this._scene3d.scene);
    this._scorchMarks = new ScorchMarks3D(this._scene3d.scene);
    this._postFX = new PostFX3D(this._scene3d.composer);

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
    this._warningPhase = 0;
    if (this._mounted && this._lanes) {
      this._particles   = new Particles3D(this._scene3d.scene, this._lighting, this._lanes);
      this._laneFlash   = new LaneFlash3D(this._scene3d.scene);
      this._scorchMarks = new ScorchMarks3D(this._scene3d.scene);
    }
  }

  // ── Event API (called from GameApp callbacks) ──────────────────────────────

  /** Colored hit sparks + damage number + optional explosion. */
  onHit(laneIdx, color, damage, isKill) {
    this._particles?.spawnHit(laneIdx, color);
    this._particles?.spawnDamageNumber(laneIdx, damage);
    if (isKill) {
      this._particles?.spawnExplosion(laneIdx, color);
      this._cameraFX?.shake(0.12, 0.25);
      this._postFX?.triggerChroma(0.022, 0.30);
      const strength = Math.min(1.6, (this._scene3d?.getBloomStrength() ?? 0.85) + 0.05);
      this._scene3d?.setBloomStrength(strength);
      // Use cached car position — the car may already be removed from the lane
      // when this callback fires (game state updated before events).
      const cachedPos = this._laneCarPosCache[laneIdx] ?? 50;
      this._scorchMarks?.spawnScorch(laneIdx, cachedPos);
    } else {
      this._postFX?.triggerChroma(0.010, 0.18);
    }
  }

  /** Grey miss puffs (wrong-color shot). */
  onMiss(laneIdx) {
    this._particles?.spawnMiss(laneIdx);
    this._postFX?.triggerChroma(0.006, 0.15);   // tiny chroma on miss
  }

  onShoot(laneIdx) {
    if (laneIdx >= 0) this._laneFlash?.flash(laneIdx);
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
    const strength = combo >= 12 ? 1.4 : combo >= 7 ? 1.1 : combo >= 3 ? 0.95 : 0.85;
    this._scene3d?.setBloomStrength(strength);
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

  // ── Per-frame update ────────────────────────────────────────────────────────

  update(gameState, dt, elapsed) {
    if (!this._mounted) return;
    if (this._canvas?.style.display === 'none') return;

    const isFrozen = gameState?.boosterState?.isFrozen?.(elapsed) ?? false;

    this._lighting.update(dt);
    this._skybox.update(dt);
    this._road.update(dt);
    this._cameraFX?.update(dt);
    this._laneFlash?.update(dt);
    this._scorchMarks?.update(dt);
    this._particles?.update(dt);
    this._postFX?.update(dt);
    this._cars?.update(dt, isFrozen);
    this._shooters?.update(dt, elapsed);
    this._projectiles?.update(dt);

    // Decay breach back to 0 when not active.
    if (this._postFX && this._postFX._breachTarget > 0 && !gameState?.isBreaching) {
      this._postFX.setBreach(0);
    }

    if (this._cars) this._syncHpBarPositions();

    // Update front-car position cache (before cars may be removed by combat).
    if (this._lanes) {
      for (let i = 0; i < this._lanes.length; i++) {
        const fc = this._lanes[i]?.cars[0];
        if (fc) this._laneCarPosCache[i] = fc.position;
      }
    }

    // Danger warning: when any front car is past 80% of the lane, pulse bloom
    // and add a subtle red vignette so the player feels the threat viscerally.
    // Only active when not already in a full breach state.
    let warningBoost = 0;
    if (!gameState?.isBreaching && this._lanes) {
      let maxDanger = 0;
      for (const lane of this._lanes) {
        const fc = lane.cars[0];
        if (fc) maxDanger = Math.max(maxDanger, (fc.position - 80) / 20); // 0@80% → 1@100%
      }
      maxDanger = Math.max(0, Math.min(1, maxDanger));
      if (maxDanger > 0) {
        this._warningPhase += dt * Math.PI * 2; // 1 Hz pulse
        const pulse = (Math.sin(this._warningPhase) * 0.5 + 0.5); // 0–1
        warningBoost = maxDanger * pulse * 0.55;
        this._postFX?.setBreach(maxDanger * pulse * 0.28);
      } else {
        this._warningPhase = 0;
        this._postFX?.setBreach(0);
      }
    }

    // Bloom: decay toward resting strength (which rises with danger warning).
    if (this._scene3d) {
      const cur  = this._scene3d?.getBloomStrength() ?? 0.85;
      const rest = 0.85 + warningBoost;
      if (cur > rest) this._scene3d.setBloomStrength(cur - dt * 0.8);
      else if (cur < rest) this._scene3d.setBloomStrength(Math.min(rest, cur + dt * 2.5));
    }
  }

  render() {
    if (!this._mounted) return;
    if (this._canvas?.style.display === 'none') return;
    this._scene3d.render();
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
    this._laneFlash   = null;
    this._postFX      = null;
    this._scorchMarks = null;
    this._mounted     = false;
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
  }

  _syncHpBarPositions() {
    if (!this._cars) return;
    for (const [, entry] of this._cars._live) {
      const g = entry.group;
      // Scale the Y offset so the bar clears the visual top of scaled cars (boss = 1.35×).
      const yOffset = 0.55 * (g.scale.y > 1 ? g.scale.y * 1.1 : 1);
      entry.hpSprite.position.set(g.position.x, g.position.y + yOffset, g.position.z);
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
