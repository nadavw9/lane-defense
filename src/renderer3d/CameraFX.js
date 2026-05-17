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
