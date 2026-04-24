// Shooter3D — each slot is ONE flat PlaneGeometry with ONE CanvasTexture.
// The canvas draws the complete bomb visual: colored body + fuse + spark + number.
// No separate objects for fuse/ring/number — everything on the canvas.
// Viewed from the top-down orthographic shooter camera.

import * as THREE from 'three';
import { laneToX } from './Scene3D.js';

// ── Layout ────────────────────────────────────────────────────────────────────
// Slot Z positions in world space (top-down camera: -Z = top of viewport)
const SLOT_Z  = [-1.5, -0.5, 0.5, 1.4];   // main + 3 queue slots
const SLOT_W  = 2.4;   // world units wide (fits in 3-unit lane with margin)
const SLOT_H  = 0.80;  // world units tall (1.0 Z spacing − 0.2 gap)
const CVS_W   = 192;   // canvas pixels wide  (matches 3:1 aspect of plane)
const CVS_H   = 64;    // canvas pixels tall

const SLOT_ALPHA = [1.0, 0.70, 0.45, 0.28];  // main→queue opacity

const LANE_COUNT = 4;

const COLOR_HEX = {
  Red:    0xE24B4A, Blue:   0x378ADD, Green:  0x639922,
  Yellow: 0xEF9F27, Purple: 0x7F77DD, Orange: 0xD85A30,
};

function hexToCss(hex) {
  return `#${((hex >> 16) & 0xff).toString(16).padStart(2,'0')}` +
         `${((hex >>  8) & 0xff).toString(16).padStart(2,'0')}` +
         `${( hex        & 0xff).toString(16).padStart(2,'0')}`;
}

// Draw complete bomb (color + damage) onto a canvas.
function drawBomb(ctx, W, H, hexColor, damage) {
  ctx.clearRect(0, 0, W, H);

  const bx = H / 2;       // bomb centre X = midpoint of left square
  const by = H / 2;       // bomb centre Y = vertical centre
  const R  = H * 0.37;    // bomb body radius
  const css = hexToCss(hexColor);

  // Outer glow
  ctx.shadowColor = css;
  ctx.shadowBlur  = 10;

  // Bomb body (shooter color)
  ctx.fillStyle = css;
  ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // Dark top-half shading (makes it look spherical)
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.arc(bx, by, R, Math.PI, 0, false);
  ctx.closePath(); ctx.fill();

  // Shine highlight (top-left)
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.arc(bx - R * 0.28, by - R * 0.28, R * 0.32, 0, Math.PI * 2);
  ctx.fill();

  // Fuse — short curved line from 12 o'clock
  ctx.strokeStyle = '#aaaaaa';
  ctx.lineWidth   = Math.max(2, H * 0.04);
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(bx, by - R);
  ctx.quadraticCurveTo(bx + H * 0.08, by - R - H * 0.14, bx + H * 0.13, by - R - H * 0.22);
  ctx.stroke();

  // Spark at fuse tip
  ctx.fillStyle   = '#ffee44';
  ctx.shadowColor = '#ff8800';
  ctx.shadowBlur  = 5;
  ctx.beginPath();
  ctx.arc(bx + H * 0.13, by - R - H * 0.22, H * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Damage number (right portion of canvas)
  const numX = H + (W - H) / 2;
  ctx.font         = `bold ${Math.round(H * 0.56)}px Arial`;
  ctx.fillStyle    = '#ffffff';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor  = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur   = 4;
  ctx.fillText(String(damage), numX, by);
  ctx.shadowBlur = 0;
}

export class Shooter3D {
  constructor(scene, columns) {
    this._scene   = scene;
    this._columns = columns;

    // _slots[laneIdx][slotIdx] = { mesh, mat, tex, ctx, canvas, lastColor, lastDamage }
    this._slots = [];
    for (let li = 0; li < LANE_COUNT; li++) {
      this._slots.push(SLOT_Z.map((z, si) => this._createSlot(li, z, SLOT_ALPHA[si])));
    }

    this._elapsed = 0;
  }

  // ── Public ───────────────────────────────────────────────────────────────────

  triggerPunch(colIdx) {
    // Brief scale-pop on the main slot plane.
    const slot = this._slots[colIdx]?.[0];
    if (!slot) return;
    const s = slot.mesh.scale;
    s.set(1.25, 1.25, 1.25);
    slot._punchT = 0;
    slot._punching = true;
  }

  update(dt, elapsed) {
    this._elapsed = elapsed;

    for (let li = 0; li < LANE_COUNT; li++) {
      const col   = this._columns[li];
      const slots = this._slots[li];

      for (let si = 0; si < SLOT_Z.length; si++) {
        const slot    = slots[si];
        const shooter = col.shooters?.[si] ?? null;

        if (!shooter) {
          slot.mesh.visible = false;
          continue;
        }

        slot.mesh.visible = true;

        const hex    = COLOR_HEX[shooter.color] ?? 0x888888;
        const damage = shooter.damage ?? 1;

        if (slot.lastColor !== hex || slot.lastDamage !== damage) {
          slot.lastColor  = hex;
          slot.lastDamage = damage;
          drawBomb(slot.ctx, CVS_W, CVS_H, hex, damage);
          slot.tex.needsUpdate = true;
        }

        // Punch animation on main slot
        if (si === 0 && slot._punching) {
          slot._punchT += dt;
          const prog = Math.min(1, slot._punchT / 0.15);
          const s    = 1.25 - 0.25 * (1 - Math.pow(1 - prog, 3));
          slot.mesh.scale.set(s, s, s);
          if (slot._punchT >= 0.15) { slot._punching = false; slot.mesh.scale.set(1,1,1); }
        }

        // Gentle Y-bob on main slot
        if (si === 0) {
          slot.mesh.position.y = 0.01 + Math.sin(elapsed * 2.4) * 0.04;
        }
      }
    }
  }

  dispose() {
    for (const laneSlots of this._slots) {
      for (const slot of laneSlots) {
        slot.tex.dispose();
        slot.mat.dispose();
        slot.mesh.geometry.dispose();
        this._scene.remove(slot.mesh);
      }
    }
    this._slots = [];
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _createSlot(laneIdx, worldZ, alpha) {
    const canvas = document.createElement('canvas');
    canvas.width  = CVS_W;
    canvas.height = CVS_H;
    const ctx = canvas.getContext('2d');

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: alpha,
      depthTest: false, side: THREE.DoubleSide,
    });

    const geo  = new THREE.PlaneGeometry(SLOT_W, SLOT_H);
    const mesh = new THREE.Mesh(geo, mat);

    // Lie flat in the XZ plane (top-down camera looks down −Y).
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(laneToX(laneIdx), 0.01, worldZ);
    mesh.visible = false;
    mesh.layers.set(1);
    this._scene.add(mesh);

    return {
      mesh, mat, tex, ctx, canvas,
      lastColor: -1, lastDamage: -1,
      _punching: false, _punchT: 0,
    };
  }
}
