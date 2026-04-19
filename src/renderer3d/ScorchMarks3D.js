// ScorchMarks3D — temporary burn-mark decals left on the road after car kills.
//
// Each scorch:
//   • RingGeometry flat on road surface (Y = 0.008)
//   • Expands from 0 → full size over 0.4 s (splat)
//   • Fades opacity 0.55 → 0 over FADE_DURATION seconds
//   • Pool capped at MAX_SCORCHES; oldest is evicted when full

import * as THREE from 'three';
import { laneToX, posToZ } from './Scene3D.js';

const MAX_SCORCHES    = 12;
const SPLAT_DURATION  = 0.40;   // seconds to reach full size
const FADE_DURATION   = 6.0;    // seconds to fully disappear
const SCORCH_OPACITY  = 0.55;

// Ring inner/outer radii (world units) at full scale.
const INNER_R = 0.20;
const OUTER_R = 1.10;

// Shared ring geometry — all scorches reuse it.
const _ringGeo = new THREE.RingGeometry(INNER_R, OUTER_R, 24);

export class ScorchMarks3D {
  constructor(scene) {
    this._scene  = scene;
    this._marks  = [];   // { mesh, mat, splatT, fadeT }
  }

  // ── Public ───────────────────────────────────────────────────────────────────

  /**
   * Spawn a scorch mark at a car's impact position.
   * @param {number} laneIdx
   * @param {number} carPosition  — game position [0..100]
   */
  spawnScorch(laneIdx, carPosition) {
    // Evict oldest when at capacity.
    if (this._marks.length >= MAX_SCORCHES) {
      const oldest = this._marks.shift();
      oldest.mat.dispose();
      this._scene.remove(oldest.mesh);
    }

    const mat = new THREE.MeshBasicMaterial({
      color:       0x110a05,
      transparent: true,
      opacity:     0,
      side:        THREE.DoubleSide,
      depthWrite:  false,
    });
    const mesh = new THREE.Mesh(_ringGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(
      laneToX(laneIdx) + (Math.random() - 0.5) * 0.6,
      0.008,
      posToZ(carPosition) + (Math.random() - 0.5) * 0.4,
    );
    mesh.scale.set(0.01, 0.01, 0.01);   // start invisible-small
    this._scene.add(mesh);
    this._marks.push({ mesh, mat, splatT: 0, fadeT: 0, splatDone: false });
  }

  /** Call every frame. */
  update(dt) {
    for (let i = this._marks.length - 1; i >= 0; i--) {
      const m = this._marks[i];

      if (!m.splatDone) {
        // Phase 1: splat expand.
        m.splatT += dt;
        const prog = Math.min(1, m.splatT / SPLAT_DURATION);
        // Ease-out cubic.
        const e = 1 - Math.pow(1 - prog, 3);
        m.mesh.scale.set(e, e, e);
        m.mat.opacity = e * SCORCH_OPACITY;
        if (m.splatT >= SPLAT_DURATION) m.splatDone = true;
      } else {
        // Phase 2: slow fade.
        m.fadeT += dt;
        const fade = 1 - Math.min(1, m.fadeT / FADE_DURATION);
        m.mat.opacity = SCORCH_OPACITY * fade;

        if (m.fadeT >= FADE_DURATION) {
          m.mat.dispose();
          this._scene.remove(m.mesh);
          this._marks.splice(i, 1);
        }
      }
    }
  }

  dispose() {
    for (const m of this._marks) {
      m.mat.dispose();
      this._scene.remove(m.mesh);
    }
    this._marks.length = 0;
    // Shared geo is module-level — do not dispose here.
  }
}
