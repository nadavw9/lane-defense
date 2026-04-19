// CameraFX — 3D camera animations for juice effects.
//
// Effects:
//   shake(magnitude, duration) — random jitter on camera.position, decays
//   startBreachZoom(duration)  — FoV 60° → 52° → 60° (sine wave) over duration
//   comboIntensity(level)      — subtle camera pull-back at high combo tiers
//
// Call update(dt) every frame from the render loop.
// The camera's base position/target is never permanently modified — all
// offsets are applied on top of the resting pose and removed when done.

import * as THREE from 'three';

// ── Camera resting pose ────────────────────────────────────────────────────────
export const CAM_POS    = new THREE.Vector3(0, 9, 16);
export const CAM_TARGET = new THREE.Vector3(0, 0, -8);
export const CAM_FOV    = 60;

// Shake constants
const SHAKE_DECAY = 0.35;   // seconds for shake to fully decay

// Breach zoom
const ZOOM_FOV_MIN = 50;    // narrowest FoV at peak zoom (zoomed in)

// Combo pull-back: at combo ≥ 12, camera steps back slightly.
const COMBO_PULLBACK = [
  { threshold: 12, dz: 1.5 },
  { threshold:  7, dz: 0.8 },
  { threshold:  3, dz: 0.3 },
];

export class CameraFX {
  constructor(camera) {
    this._camera = camera;

    // Set camera to resting pose.
    camera.position.copy(CAM_POS);
    camera.lookAt(CAM_TARGET);
    camera.fov = CAM_FOV;
    camera.updateProjectionMatrix();

    // ── Shake state ─────────────────────────────────────────────────────────
    this._shakeMag  = 0;
    this._shakeTime = 0;   // remaining shake time

    // ── Breach zoom state ────────────────────────────────────────────────────
    this._breachT        = -1;   // -1 = inactive
    this._breachDuration = 0;
    this._breachDone     = false;

    // ── Combo pull-back ──────────────────────────────────────────────────────
    this._targetPullbackZ = 0;
    this._currentPullbackZ = 0;
  }

  // ── Public ───────────────────────────────────────────────────────────────────

  /**
   * Kick the camera shake.
   * @param {number} magnitude  — max pixel-like jitter in world units (default 0.15)
   * @param {number} duration   — decay time in seconds (default SHAKE_DECAY)
   */
  shake(magnitude = 0.15, duration = SHAKE_DECAY) {
    // Only override with stronger shake.
    if (magnitude >= this._shakeMag || this._shakeTime <= 0) {
      this._shakeMag  = magnitude;
      this._shakeTime = duration;
    }
  }

  /**
   * Start the breach-zoom animation (FoV pulse).
   * @param {number} duration — seconds (default 0.50)
   */
  startBreachZoom(duration = 0.50) {
    this._breachT        = 0;
    this._breachDuration = duration;
    this._breachDone     = false;
  }

  /**
   * Set combo level to drive the pull-back offset.
   * @param {number} combo
   */
  setCombo(combo) {
    let dz = 0;
    for (const tier of COMBO_PULLBACK) {
      if (combo >= tier.threshold) { dz = tier.dz; break; }
    }
    this._targetPullbackZ = dz;
  }

  /** Call every frame. Returns true if any animation is still running. */
  update(dt) {
    const cam = this._camera;
    let shakeX = 0, shakeY = 0;

    // ── Shake ────────────────────────────────────────────────────────────────
    if (this._shakeTime > 0) {
      this._shakeTime -= dt;
      // Clamp t to [0,1] so magnitude never exceeds the requested value.
      const t = Math.max(0, Math.min(1, this._shakeTime / SHAKE_DECAY));
      const m = this._shakeMag * t;
      shakeX = (Math.random() - 0.5) * 2 * m;
      shakeY = (Math.random() - 0.5) * 2 * m;
    } else {
      this._shakeTime = 0;
    }

    // ── Combo pull-back (lerp toward target) ─────────────────────────────────
    this._currentPullbackZ += (this._targetPullbackZ - this._currentPullbackZ) * Math.min(1, dt * 3);

    // ── Apply position offsets ────────────────────────────────────────────────
    cam.position.set(
      CAM_POS.x + shakeX,
      CAM_POS.y + shakeY,
      CAM_POS.z + this._currentPullbackZ,
    );
    cam.lookAt(CAM_TARGET);

    // ── Breach FoV zoom ───────────────────────────────────────────────────────
    if (this._breachT >= 0 && !this._breachDone) {
      this._breachT += dt;
      const prog = Math.min(1, this._breachT / this._breachDuration);
      // Sine pulse: peaks at prog=0.5, returns to base at prog=1.
      const fovRange = CAM_FOV - ZOOM_FOV_MIN;
      cam.fov = CAM_FOV - fovRange * Math.sin(Math.PI * prog);
      cam.updateProjectionMatrix();

      if (this._breachT >= this._breachDuration) {
        cam.fov = CAM_FOV;
        cam.updateProjectionMatrix();
        this._breachDone = true;
        this._breachT    = -1;
      }
    }

    return this._shakeTime > 0 || (this._breachT >= 0 && !this._breachDone);
  }

  /** Reset to resting pose (call when leaving gameplay). */
  reset() {
    this._shakeTime       = 0;
    this._breachT         = -1;
    this._currentPullbackZ = 0;
    this._targetPullbackZ  = 0;
    const cam = this._camera;
    cam.position.copy(CAM_POS);
    cam.lookAt(CAM_TARGET);
    cam.fov = CAM_FOV;
    cam.updateProjectionMatrix();
  }
}
