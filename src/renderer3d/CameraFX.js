// CameraFX — 3D camera animations for juice effects.
//
// Effects:
//   shake(magnitude, duration)   — random jitter on camera.position, decays
//   startBreachZoom(duration)    — FoV pulse over duration
//   setCombo(level)              — subtle camera pull-back at high combo tiers
//   setLaneCount(n)              — adapt resting Y and FoV for road width
//
// Call update(dt) every frame from the render loop.
// The camera's base position/target is never permanently modified — all
// offsets are applied on top of the resting pose and removed when done.

import * as THREE from 'three';

// ── Camera resting pose (4-lane defaults) ─────────────────────────────────────
export const CAM_POS    = new THREE.Vector3(0, 9, 16);
export const CAM_TARGET = new THREE.Vector3(0, 0, -8);
export const CAM_FOV    = 60;

// Lane-count resting adjustments:
//   laneScale 0 (1 lane) → Y = 7.65, FOV = 52
//   laneScale 1 (4 lanes)→ Y = 9.00, FOV = 60
const LANE_Y_MIN   = 7.65;   // camera height at 1 lane
const LANE_FOV_MIN = 52;     // field-of-view at 1 lane (narrower = zoomed in)

// Level intro sweep: start position + look target
const INTRO_FROM_POS    = new THREE.Vector3(0, 12, 20);
const INTRO_FROM_TARGET = new THREE.Vector3(0, 0,  8);
const INTRO_DURATION    = 0.60;   // seconds

function _easeOutCubic(t) { return 1 - Math.pow(1 - Math.min(t, 1), 3); }

const SHAKE_DECAY = 0.35;
const ZOOM_FOV_DELTA = 10;   // breach zoom narrows FOV by this amount at peak

const COMBO_PULLBACK = [
  { threshold: 12, dz: 1.5 },
  { threshold:  7, dz: 0.8 },
  { threshold:  3, dz: 0.3 },
];

export class CameraFX {
  constructor(camera) {
    this._camera = camera;

    camera.position.copy(CAM_POS);
    camera.lookAt(CAM_TARGET);
    camera.fov = CAM_FOV;
    camera.updateProjectionMatrix();

    this._shakeMag  = 0;
    this._shakeTime = 0;

    this._breachT        = -1;
    this._breachDuration = 0;
    this._breachDone     = false;

    this._targetPullbackZ  = 0;
    this._currentPullbackZ = 0;

    this._introActive = false;
    this._introT      = 0;

    // Lane-count adaptation:
    //   _targetLaneScale  = (n-1)/3  →  0 for n=1, 1 for n=4
    //   _currentLaneScale lerps toward target each frame
    this._targetLaneScale  = 1.0;
    this._currentLaneScale = 1.0;
  }

  // ── Public ───────────────────────────────────────────────────────────────────

  shake(magnitude = 0.15, duration = SHAKE_DECAY) {
    if (magnitude >= this._shakeMag || this._shakeTime <= 0) {
      this._shakeMag  = magnitude;
      this._shakeTime = duration;
    }
  }

  startBreachZoom(duration = 0.50) {
    this._breachT        = 0;
    this._breachDuration = duration;
    this._breachDone     = false;
  }

  setCombo(combo) {
    let dz = 0;
    for (const tier of COMBO_PULLBACK) {
      if (combo >= tier.threshold) { dz = tier.dz; break; }
    }
    this._targetPullbackZ = dz;
  }

  /**
   * Adapt resting camera height and FoV to the number of active lanes.
   * 1 lane → zoomed-in feel; 4 lanes → current full-width pose.
   */
  setLaneCount(n) {
    this._targetLaneScale = (Math.max(1, Math.min(4, n)) - 1) / 3;
  }

  /** Call every frame. Returns true if any animation is still running. */
  update(dt) {
    const cam = this._camera;
    let shakeX = 0, shakeY = 0;

    // ── Lane-scale lerp ──────────────────────────────────────────────────────
    this._currentLaneScale += (this._targetLaneScale - this._currentLaneScale) * Math.min(1, dt * 1.8);
    const ls     = this._currentLaneScale;
    const baseY  = LANE_Y_MIN + (CAM_POS.y  - LANE_Y_MIN)   * ls;
    const baseFOV = LANE_FOV_MIN + (CAM_FOV - LANE_FOV_MIN) * ls;

    // ── Shake ────────────────────────────────────────────────────────────────
    if (this._shakeTime > 0) {
      this._shakeTime -= dt;
      const t = Math.max(0, Math.min(1, this._shakeTime / SHAKE_DECAY));
      const m = this._shakeMag * t;
      shakeX = (Math.random() - 0.5) * 2 * m;
      shakeY = (Math.random() - 0.5) * 2 * m;
    } else {
      this._shakeTime = 0;
    }

    // ── Combo pull-back ──────────────────────────────────────────────────────
    this._currentPullbackZ += (this._targetPullbackZ - this._currentPullbackZ) * Math.min(1, dt * 3);

    // ── Level intro sweep (overrides normal position while active) ────────────
    if (this._introActive) {
      this._introT += dt;
      const e = _easeOutCubic(this._introT / INTRO_DURATION);

      const px = INTRO_FROM_POS.x + (CAM_POS.x - INTRO_FROM_POS.x) * e + shakeX;
      const py = INTRO_FROM_POS.y + (baseY     - INTRO_FROM_POS.y) * e + shakeY;
      const pz = INTRO_FROM_POS.z + (CAM_POS.z + this._currentPullbackZ - INTRO_FROM_POS.z) * e;
      cam.position.set(px, py, pz);

      const tx = INTRO_FROM_TARGET.x + (CAM_TARGET.x - INTRO_FROM_TARGET.x) * e;
      const ty = INTRO_FROM_TARGET.y + (CAM_TARGET.y - INTRO_FROM_TARGET.y) * e;
      const tz = INTRO_FROM_TARGET.z + (CAM_TARGET.z - INTRO_FROM_TARGET.z) * e;
      cam.lookAt(tx, ty, tz);

      if (this._introT >= INTRO_DURATION) {
        this._introActive = false;
        cam.position.set(CAM_POS.x + shakeX, baseY + shakeY, CAM_POS.z + this._currentPullbackZ);
        cam.lookAt(CAM_TARGET);
      }
    } else {
      cam.position.set(
        CAM_POS.x + shakeX,
        baseY     + shakeY,
        CAM_POS.z + this._currentPullbackZ,
      );
      cam.lookAt(CAM_TARGET);
    }

    // ── Breach FoV zoom (pulses relative to current base FOV) ────────────────
    if (this._breachT >= 0 && !this._breachDone) {
      this._breachT += dt;
      const prog = Math.min(1, this._breachT / this._breachDuration);
      cam.fov = baseFOV - ZOOM_FOV_DELTA * Math.sin(Math.PI * prog);
      cam.updateProjectionMatrix();

      if (this._breachT >= this._breachDuration) {
        cam.fov = baseFOV;
        cam.updateProjectionMatrix();
        this._breachDone = true;
        this._breachT    = -1;
      }
    } else {
      // Keep FOV updated during lane-scale transitions.
      cam.fov = baseFOV;
      cam.updateProjectionMatrix();
    }

    return this._shakeTime > 0 || (this._breachT >= 0 && !this._breachDone) || this._introActive;
  }

  /** Sweep camera from a high steep angle to the resting pose over 0.6 s. */
  startLevelIntro() {
    this._introActive = true;
    this._introT      = 0;
    this._camera.position.copy(INTRO_FROM_POS);
    this._camera.lookAt(INTRO_FROM_TARGET);
    this._camera.updateProjectionMatrix();
  }

  /** Reset to resting pose (call when leaving gameplay). */
  reset() {
    this._shakeTime        = 0;
    this._breachT          = -1;
    this._currentPullbackZ = 0;
    this._targetPullbackZ  = 0;
    const cam = this._camera;
    cam.position.copy(CAM_POS);
    cam.lookAt(CAM_TARGET);
    cam.fov = CAM_FOV;
    cam.updateProjectionMatrix();
  }
}
