// Lighting3D — Static scene lights + dynamic explosion flash pool.
//
// Static lights:
//   • HemisphereLight    — daytime sky/ground fill (bright daylight)
//   • DirectionalLight   — sun at high angle, warm white
//
// Dynamic lights (pooled):
//   • 8 PointLights reserved for muzzle flashes and explosion bursts.
//     Call acquireFlash(color, x, y, z) to grab one; it auto-returns to pool
//     after the intensity decays to zero.

import * as THREE from 'three';

const FLASH_POOL_SIZE = 8;

export class Lighting3D {
  constructor(scene) {
    this._scene  = scene;
    this._flPool = [];    // { light, active, timer, duration }

    // ── Hemisphere — daytime sky/ground ────────────────────────────────────
    const hemi = new THREE.HemisphereLight(0xc8e8ff, 0x7ac043, 1.4);
    scene.add(hemi);
    this._hemi = hemi;

    // ── Directional sun — warm white, high angle ────────────────────────────
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.6);
    sun.position.set(8, 18, 5);
    sun.castShadow = false;   // no shadow cost for now
    scene.add(sun);
    this._sun = sun;   // keep ref for dispose()

    // ── Ambient fill — bright daylight base ─────────────────────────────────
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    this._ambient     = ambient;
    this._ambientBase = 0.6;   // resting intensity

    // Ambient flash state (driven by ambientFlash()).
    this._ambientFlashTimer    = 0;
    this._ambientFlashDuration = 0.30;
    this._ambientPeak          = 0;

    // ── Flash pool ───────────────────────────────────────────────────────────
    for (let i = 0; i < FLASH_POOL_SIZE; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 8);
      light.castShadow = false;  // no shadow cost for transient lights
      scene.add(light);
      this._flPool.push({ light, active: false, timer: 0, duration: 1, peakIntensity: 0 });
    }
  }

  // Acquire a flash light at world position (x, y, z).
  // color    — 0xRRGGBB hex
  // Apply a theme's lighting colors and intensities.
  setTheme(theme) {
    if (theme.hemi) {
      this._hemi.color.setHex(theme.hemi.sky);
      this._hemi.groundColor.setHex(theme.hemi.ground);
      this._hemi.intensity = theme.hemi.intensity;
    }
    if (theme.sun) {
      this._sun.color.setHex(theme.sun.color);
      this._sun.intensity = theme.sun.intensity;
    }
    if (theme.ambient) {
      this._ambient.color.setHex(theme.ambient.color ?? 0xffffff);
      this._ambientBase   = theme.ambient.intensity ?? 0.6;
      this._ambient.intensity = this._ambientBase;
    }
  }

  // intensity — peak intensity (default 3.0)
  // duration  — fade duration in seconds (default 0.35)
  acquireFlash(color, x, y, z, intensity = 3.0, duration = 0.35) {
    const slot = this._flPool.find(s => !s.active);
    if (!slot) return;

    slot.light.color.setHex(color);
    slot.light.intensity   = intensity;
    slot.light.position.set(x, y + 0.5, z);
    slot.active        = true;
    slot.timer         = duration;
    slot.duration      = duration;
    slot.peakIntensity = intensity;
  }

  // Call once per frame from the render loop.
  update(dt) {
    for (const slot of this._flPool) {
      if (!slot.active) continue;
      slot.timer -= dt;
      if (slot.timer <= 0) {
        slot.light.intensity = 0;
        slot.active = false;
      } else {
        const t = slot.timer / slot.duration;
        slot.light.intensity = slot.peakIntensity * t * t;
      }
    }

    // Decay ambient flash back to base.
    if (this._ambientFlashTimer > 0) {
      this._ambientFlashTimer -= dt;
      const t = Math.max(0, this._ambientFlashTimer / this._ambientFlashDuration);
      this._ambient.intensity = this._ambientBase + this._ambientPeak * t * t;
      if (this._ambientFlashTimer <= 0) {
        this._ambient.intensity = this._ambientBase;
      }
    }
  }

  // Gentle full-scene brightness pulse — replaces the localized PointLight flash
  // that used to light up both side barriers as two bright parallel lines.
  // boost    — how much to add on top of the base ambient (default 0.6)
  // duration — fade time in seconds (default 0.30)
  ambientFlash(boost = 0.6, duration = 0.30) {
    this._ambientFlashTimer    = duration;
    this._ambientFlashDuration = duration;
    this._ambientPeak          = boost;
  }

  // Convenience: muzzle flash — kept but halved so it doesn't bleed to barriers.
  muzzleFlash(color, x, y, z) {
    this.acquireFlash(color, x, y, z, 1.2, 0.10);
  }

  // Convenience: explosion — now triggers ambient pulse instead of a PointLight.
  explosionFlash(color, x, y, z) {
    this.ambientFlash(0.55, 0.28);
  }

  dispose() {
    // Remove all lights from scene and free shadow map GPU memory.
    this._scene.children
      .filter(c => c.isLight)
      .forEach(c => this._scene.remove(c));
    this._flPool.length = 0;
  }
}
