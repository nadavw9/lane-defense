// Lighting3D — Static scene lights + dynamic explosion flash pool.
//
// Static lights:
//   • AmbientLight       — low-level night fill
//   • HemisphereLight    — sky/ground colour separation
//   • DirectionalLight   — moonlight, casts shadows
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

    // ── Ambient ─────────────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0x334466, 0.5);
    scene.add(ambient);

    // ── Hemisphere (sky = deep blue, ground = near-black purple) ────────────
    const hemi = new THREE.HemisphereLight(0x223366, 0x110822, 0.35);
    scene.add(hemi);

    // ── Directional / moonlight ─────────────────────────────────────────────
    const moon = new THREE.DirectionalLight(0x8899cc, 0.9);
    moon.position.set(-6, 18, 4);
    moon.castShadow             = true;
    moon.shadow.mapSize.width   = 2048;
    moon.shadow.mapSize.height  = 2048;
    moon.shadow.camera.near     = 0.5;
    moon.shadow.camera.far      = 80;
    moon.shadow.camera.left     = -14;
    moon.shadow.camera.right    =  14;
    moon.shadow.camera.top      =  14;
    moon.shadow.camera.bottom   = -14;
    moon.shadow.bias            = -0.001;
    scene.add(moon);
    this._moon = moon;   // keep ref for dispose()

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
  // intensity — peak intensity (default 3.0)
  // duration  — fade duration in seconds (default 0.35)
  acquireFlash(color, x, y, z, intensity = 3.0, duration = 0.35) {
    const slot = this._flPool.find(s => !s.active);
    if (!slot) return;   // all busy; skip gracefully

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
        // Ease-out fade: intensity tracks (timer/duration)²
        const t = slot.timer / slot.duration;
        slot.light.intensity = slot.peakIntensity * t * t;
      }
    }
  }

  // Convenience: acquire a muzzle flash (short, bright, shooter-color).
  muzzleFlash(color, x, y, z) {
    this.acquireFlash(color, x, y, z, 2.5, 0.12);
  }

  // Convenience: acquire an explosion flash (longer, bigger radius).
  explosionFlash(color, x, y, z) {
    this.acquireFlash(color, x, y, z, 4.5, 0.40);
  }

  dispose() {
    // Remove all lights from scene and free shadow map GPU memory.
    this._scene.children
      .filter(c => c.isLight)
      .forEach(c => this._scene.remove(c));
    this._moon?.shadow?.map?.dispose();
    this._flPool.length = 0;
  }
}
