// CameraFX — shake-only camera juice.
//
// POLICY (2026-10-03): the camera NEVER zooms. The Pixi layer (sockets, tap
// targets, hit sparks, goal band) is anchored to rest geometry from
// projection.js and does not follow the 3D camera, so any zoom desynchronises
// the two (bomb zone drifting off its sockets, exposed backdrop edges, tap
// misalignment, stuck zoom state). Shake is a pure translation, which the
// bomb zone cancels exactly via GameRenderer3D's zone offset.
//
//   shake(magnitude, duration)  — decaying X/Z position jitter
//   setLaneCount(n)             — re-captures the resting pose from the camera
//                                 (Scene3D sets the band's zCenter first; without
//                                 re-capture update() would revert it every frame)
//   update(dt)                  — per frame; exposes offsetX/offsetZ (the applied jitter)
//   reset()                     — restore resting pose, drop any shake

import { isReducedMotion } from '../game/MotionPrefs.js';

const SHAKE_DECAY = 0.35;

export class CameraFX {
  constructor(camera) {
    this._camera = camera;
    this._baseP  = camera.position.clone();
    this._shakeMag = 0;
    this._shakeTime = 0;
    this._shakeDur = SHAKE_DECAY;
    /** Jitter applied to the camera this frame (world units). */
    this.offsetX = 0;
    this.offsetZ = 0;
  }

  shake(magnitude = 0.15, duration = SHAKE_DECAY) {
    if (isReducedMotion()) return;
    const cur = this._shakeTime > 0
      ? this._shakeMag * (this._shakeTime / this._shakeDur) : 0;
    // A weaker hit never cuts a stronger one short.
    if (magnitude >= cur) {
      this._shakeMag = magnitude;
      this._shakeTime = duration;
      this._shakeDur = duration;
    }
  }

  setLaneCount(_n) {
    this._baseP.copy(this._camera.position);
    this.offsetX = 0; this.offsetZ = 0;
  }

  /** Call every frame. Returns true while a shake is running. */
  update(dt) {
    let sx = 0, sz = 0;
    if (isReducedMotion()) {
      this._shakeTime = 0;
    } else if (this._shakeTime > 0) {
      this._shakeTime -= dt;
      if (this._shakeTime > 0) {
        const m = this._shakeMag * (this._shakeTime / this._shakeDur);
        sx = (Math.random() - 0.5) * 2 * m;
        sz = (Math.random() - 0.5) * 2 * m;
      } else {
        this._shakeTime = 0;
      }
    }
    this.offsetX = sx; this.offsetZ = sz;
    this._camera.position.set(this._baseP.x + sx, this._baseP.y, this._baseP.z + sz);
    return this._shakeTime > 0;
  }

  reset() {
    this._shakeTime = 0; this._shakeMag = 0;
    this.offsetX = 0; this.offsetZ = 0;
    this._camera.position.copy(this._baseP);
  }
}
