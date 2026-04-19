// LaneFlash3D — semi-transparent white plane covering a full lane for 0.18 s,
//               triggered on each shooter deploy.
//
// In 3D space a flat PlaneGeometry aligned to the road surface naturally
// appears as a trapezoid due to perspective projection — exactly the visual
// the 2D LaneFlash achieved with explicit trapezoid geometry.

import * as THREE from 'three';
import { laneToX, ROAD_Z_FAR, ROAD_Z_NEAR } from './Scene3D.js';

const FLASH_DURATION = 0.18;
const FLASH_ALPHA    = 0.38;

const LANE_WIDTH   = 2.8;
const ROAD_LENGTH  = ROAD_Z_NEAR - ROAD_Z_FAR;
const ROAD_MID_Z   = (ROAD_Z_FAR + ROAD_Z_NEAR) / 2;

// Shared geometry — all flash meshes use the same PlaneGeometry.
const _flashGeo = new THREE.PlaneGeometry(LANE_WIDTH, ROAD_LENGTH);

export class LaneFlash3D {
  constructor(scene) {
    this._scene   = scene;
    this._active  = [];   // { mesh, mat, life }
  }

  // ── Public ───────────────────────────────────────────────────────────────────

  /**
   * Trigger a lane flash for laneIdx [0..3].
   * Multiple flashes on the same lane stack naturally (each has its own mesh).
   */
  flash(laneIdx) {
    // Material is per-flash (independent opacity); geometry is shared.
    const mat = new THREE.MeshBasicMaterial({
      color:       0xffffff,
      transparent: true,
      opacity:     FLASH_ALPHA,
      depthWrite:  false,
    });
    const mesh = new THREE.Mesh(_flashGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(laneToX(laneIdx), 0.015, ROAD_MID_Z);
    this._scene.add(mesh);
    this._active.push({ mesh, mat, life: FLASH_DURATION });
  }

  /** Call every frame from the render loop. */
  update(dt) {
    for (let i = this._active.length - 1; i >= 0; i--) {
      const f = this._active[i];
      f.life -= dt;
      if (f.life <= 0) {
        f.mat.dispose();   // shared geo: do NOT call f.mesh.geometry.dispose()
        this._scene.remove(f.mesh);
        this._active.splice(i, 1);
        continue;
      }
      f.mat.opacity = FLASH_ALPHA * (f.life / FLASH_DURATION);
    }
  }

  dispose() {
    for (const f of this._active) {
      f.mat.dispose();   // shared geo: do NOT dispose geometry
      this._scene.remove(f.mesh);
    }
    this._active.length = 0;
  }
}
