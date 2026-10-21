// StepGrid3D — the step grid painted on the road, UNDER the cars (2026-10-18, owner request:
// "it is hard to count the steps to the red line").
//
// Every correct shot moves traffic one step (TrafficRules: STEPS_PER_ROW steps a row). The road
// gets a faint line per step (firmer where a row ends) and the last steps warm from yellow to
// red. The numbers live beside the road on the StepRuler (owner's pick of two styles, 2026-10-18).
//
// It is a 3D plane on the road (one CanvasTexture), not a Pixi overlay: the Pixi canvas sits
// in front of the 3D canvas, so anything drawn there would paint over the cars.
import * as THREE from 'three';
import { laneToX, roadHalfW, posToZ } from './Scene3D.js';
import { ROAD_Z_NEAR } from './projection.js';

const PX_PER_UNIT = 40;        // texture resolution (px per world unit)
const WARN_STEPS  = 4;         // the last N steps are tinted
const WARN = ['#FF3D3D', '#FF6A2A', '#FF9A1C', '#FFC93C'];   // 1 move left ... 4 moves left

export class StepGrid3D {
  constructor(scene) {
    this._scene = scene;
    this._mesh = null;
    this._key = '';
    this.visible = true;
  }

  /** Rebuild for a level: lanes, board rows, steps per row. */
  configure(laneCount, gridRows, stepsPerRow) {
    const key = `${laneCount}|${gridRows}|${stepsPerRow}`;
    if (key === this._key && this._mesh) return;
    this._key = key;
    this._dispose();
    if (!(gridRows > 1) || !(stepsPerRow > 1)) return;   // whole-row legacy boards: no grid

    const n = laneCount, hw = roadHalfW(n), W = hw * 2;
    const maxRow = gridRows - 1;
    const steps = maxRow * stepsPerRow;                    // step centres k = 0..steps (row = k / spr)
    const zOf = (k) => posToZ((k / steps) * 100);
    const stepLen = zOf(1) - zOf(0);
    // Cover from half a step above row 1 (row 0 hides under the goal band) to the red line.
    const zTop = zOf(stepsPerRow) - stepLen / 2;
    const zBot = ROAD_Z_NEAR;
    const H = zBot - zTop;

    const cw = Math.round(W * PX_PER_UNIT), ch = Math.round(H * PX_PER_UNIT);
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const ctx = cv.getContext('2d');
    const X = (x) => (x + hw) * PX_PER_UNIT;
    const Y = (z) => (z - zTop) * PX_PER_UNIT;
    const laneW = 4.0, inset = 0.34;

    for (let li = 0; li < n; li++) {
      const x0 = X(laneToX(li, n) - laneW / 2 + inset), x1 = X(laneToX(li, n) + laneW / 2 - inset);
      const lw = x1 - x0;
      for (let k = stepsPerRow; k <= steps; k++) {
        const left = steps - k + 1;                         // moves until it crosses the line
        const ya = Y(zOf(k) - stepLen / 2), yb = k === steps ? Y(zBot) : Y(zOf(k) + stepLen / 2);
        const h = yb - ya;
        if (left <= WARN_STEPS) {
          // Warm cells: the fill brightens toward the line and each cell gets a crisp light edge, so
          // they read as lit panels rather than a muddy wash (the pale yellow at low alpha went beige).
          ctx.globalAlpha = 0.16 + 0.07 * (WARN_STEPS - left);
          ctx.fillStyle = WARN[left - 1];
          roundRect(ctx, x0, ya + 2, lw, h - 4, 10); ctx.fill();
          ctx.globalAlpha = 0.22 + 0.08 * (WARN_STEPS - left);
          ctx.lineWidth = 2; ctx.strokeStyle = WARN[left - 1];
          roundRect(ctx, x0 + 1, ya + 3, lw - 2, h - 6, 9); ctx.stroke();
        }
        // a faint line on every step boundary, firmer where a row ends
        ctx.globalAlpha = k % stepsPerRow === 0 ? 0.32 : 0.16;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x0, ya - 1, lw, 2);
      }
    }
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0.012, zTop + H / 2);   // on the asphalt, under the hazard stripe (0.02) and the cars
    mesh.renderOrder = 1;
    mesh.visible = this.visible;
    this._scene.add(mesh);
    this._mesh = mesh;
  }

  setVisible(v) { this.visible = v; if (this._mesh) this._mesh.visible = v; }

  _dispose() {
    if (!this._mesh) return;
    this._scene.remove(this._mesh);
    this._mesh.geometry.dispose();
    this._mesh.material.map?.dispose();
    this._mesh.material.dispose();
    this._mesh = null;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
