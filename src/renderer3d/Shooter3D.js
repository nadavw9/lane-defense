// Shooter3D — each slot is ONE flat PlaneGeometry with ONE CanvasTexture.
// The canvas draws the complete bomb visual: colored body + gradient fuse + spark + badge.
// Viewed from the top-down orthographic shooter camera (layer 1).

import * as THREE from 'three';
import { laneToX } from './Scene3D.js';

// ── Tweakable design constants ─────────────────────────────────────────────────
const SLOT_ALPHA  = [1.0, 0.70, 0.45, 0.28];   // main → queue opacity
const SLOT_SCALE_Y = [1.0, 0.90, 0.80, 0.70];   // depth illusion — queue slots shrink
const SLOT_DESAT   = [0.0, 0.15, 0.15, 0.15];   // saturation reduction for queue slots

// Spark emissive bead (per lane, visible on main slot fuse tip)
const SPARK_BEAD_COLOR    = 0xff8800;
const SPARK_BEAD_RADIUS   = 0.045;
const SPARK_FLICKER_SPEED = 12;   // radians/sec

// ── Layout ────────────────────────────────────────────────────────────────────
const SLOT_Z  = [-1.5, -0.5, 0.5, 1.4];
const SLOT_W  = 2.4;
const SLOT_H  = 0.80;
const CVS_W   = 192;
const CVS_H   = 64;

const LANE_COUNT = 4;

const COLOR_HEX = {
  Red:    0xE24B4A, Blue:   0x378ADD, Green:  0x639922,
  Yellow: 0xEF9F27, Purple: 0x7F77DD, Orange: 0xD85A30,
};

// ── Canvas helpers ─────────────────────────────────────────────────────────────
function hexToCss(hex) {
  return `#${((hex >> 16) & 0xff).toString(16).padStart(2,'0')}` +
         `${((hex >>  8) & 0xff).toString(16).padStart(2,'0')}` +
         `${( hex        & 0xff).toString(16).padStart(2,'0')}`;
}

// Blend hex color toward gray by `amount` (0=original, 1=full gray) → css string.
function desaturateHex(hex, amount) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >>  8) & 0xff;
  const b =  hex        & 0xff;
  const gray = (r + g + b) / 3;
  const nr = Math.round(r + (gray - r) * amount);
  const ng = Math.round(g + (gray - g) * amount);
  const nb = Math.round(b + (gray - b) * amount);
  return `#${nr.toString(16).padStart(2,'0')}${ng.toString(16).padStart(2,'0')}${nb.toString(16).padStart(2,'0')}`;
}

function cssFromHex(hex, desatAmt) {
  return desatAmt > 0 ? desaturateHex(hex, desatAmt) : hexToCss(hex);
}

// Draw rounded rectangle path on canvas 2d context.
function canvasRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x, y + h - r,     r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y,         x + r, y,          r);
  ctx.closePath();
}

// Draw complete bomb onto a canvas context.
// slotIdx > 0 reduces saturation (queue depth cue).
function drawBomb(ctx, W, H, hexColor, damage, slotIdx) {
  ctx.clearRect(0, 0, W, H);

  const desat = SLOT_DESAT[slotIdx] ?? 0;
  const css   = cssFromHex(hexColor, desat);

  // Bomb center: shifted down from top so fuse has room above
  const bx = H * 0.50;
  const by = H * 0.58;
  const R  = H * 0.35;

  // ── Outer glow ──────────────────────────────────────────────────────────────
  ctx.shadowColor = css;
  ctx.shadowBlur  = 12;
  ctx.fillStyle   = css;
  ctx.beginPath(); ctx.arc(bx, by, R + 3, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur  = 0;

  // ── Bomb body ────────────────────────────────────────────────────────────────
  ctx.fillStyle = css;
  ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2); ctx.fill();

  // ── Rim highlight gradient (upper-left edge) ─────────────────────────────────
  const rimGrad = ctx.createLinearGradient(bx - R, by - R, bx + R * 0.4, by + R * 0.4);
  rimGrad.addColorStop(0, 'rgba(255,255,255,0.20)');
  rimGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rimGrad;
  ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2); ctx.fill();

  // ── Dark bottom-half shading (spherical look) ─────────────────────────────────
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.arc(bx, by, R, Math.PI * 0.05, Math.PI * 0.95, false);
  ctx.closePath(); ctx.fill();

  // ── Specular hotspot upper-left ───────────────────────────────────────────────
  const specGrad = ctx.createRadialGradient(
    bx - R * 0.30, by - R * 0.30, 0,
    bx - R * 0.30, by - R * 0.30, R * 0.38,
  );
  specGrad.addColorStop(0, 'rgba(255,255,255,0.70)');
  specGrad.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  specGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = specGrad;
  ctx.beginPath(); ctx.arc(bx - R * 0.30, by - R * 0.30, R * 0.38, 0, Math.PI * 2); ctx.fill();

  // ── White border ──────────────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2); ctx.stroke();

  // ── Fuse — thicker curved line with gradient (light at base, dark at tip) ─────
  const fuseEndX  = bx + H * 0.14;
  const fuseEndY  = by - R - H * 0.18;
  const fuseCPX   = bx + H * 0.08;
  const fuseCPY   = by - R - H * 0.08;
  const fuseGrad  = ctx.createLinearGradient(bx, by - R, fuseEndX, fuseEndY);
  fuseGrad.addColorStop(0, '#cccccc');
  fuseGrad.addColorStop(1, '#777777');
  ctx.strokeStyle = fuseGrad;
  ctx.lineWidth   = Math.max(2.5, H * 0.05);   // thicker than before
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(bx, by - R);
  ctx.quadraticCurveTo(fuseCPX, fuseCPY, fuseEndX, fuseEndY);
  ctx.stroke();

  // ── Spark dot at fuse tip ─────────────────────────────────────────────────────
  ctx.fillStyle   = '#ffee44';
  ctx.shadowColor = '#ff8800';
  ctx.shadowBlur  = 6;
  ctx.beginPath();
  ctx.arc(fuseEndX, fuseEndY, H * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // ── Damage badge plate (dark rounded rect on lower body) ──────────────────────
  const numX = H + (W - H) / 2;   // right portion of canvas
  const numY = by;
  const badgeW = (W - H) * 0.72;
  const badgeH = H * 0.48;
  canvasRoundRect(ctx, numX - badgeW / 2, numY - badgeH / 2, badgeW, badgeH, 6);
  ctx.fillStyle   = '#0a0a14';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.70)';
  ctx.lineWidth   = 1.2;
  ctx.stroke();

  // ── Damage number inside badge ────────────────────────────────────────────────
  ctx.font         = `bold ${Math.round(H * 0.52)}px Arial`;
  ctx.fillStyle    = '#ffffff';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor  = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur   = 3;
  ctx.fillText(String(damage), numX, numY);
  ctx.shadowBlur = 0;
}

export class Shooter3D {
  constructor(scene, columns) {
    this._scene   = scene;
    this._columns = columns;
    this._elapsed = 0;

    // _slots[laneIdx][slotIdx] = { mesh, mat, tex, ctx, canvas, lastColor, lastDamage, _baseScaleY, ... }
    this._slots = [];
    for (let li = 0; li < LANE_COUNT; li++) {
      this._slots.push(SLOT_Z.map((z, si) => this._createSlot(li, z, si)));
    }

    // Emissive spark beads — one per lane at approximate fuse tip position
    this._sparkBeads = [];
    for (let li = 0; li < LANE_COUNT; li++) {
      const mat = new THREE.MeshStandardMaterial({
        color:             new THREE.Color(SPARK_BEAD_COLOR),
        emissive:          new THREE.Color(SPARK_BEAD_COLOR),
        emissiveIntensity: 0,
        roughness:         0.3,
      });
      const bead = new THREE.Mesh(new THREE.SphereGeometry(SPARK_BEAD_RADIUS, 6, 6), mat);
      // Approximate fuse-tip world position above main slot
      bead.position.set(laneToX(li) + 0.14, 0.22, SLOT_Z[0] - 0.22);
      bead.visible = false;
      bead.layers.set(1);
      this._scene.add(bead);
      this._sparkBeads.push({ bead, mat });
    }
  }

  // ── Public ───────────────────────────────────────────────────────────────────

  triggerPunch(colIdx) {
    const slot = this._slots[colIdx]?.[0];
    if (!slot) return;
    slot.mesh.scale.set(1.25, 1.25, 1.25);
    slot._punchT   = 0;
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
          drawBomb(slot.ctx, CVS_W, CVS_H, hex, damage, si);
          slot.tex.needsUpdate = true;
        }

        // Punch animation on main slot
        if (si === 0 && slot._punching) {
          slot._punchT += dt;
          const prog = Math.min(1, slot._punchT / 0.15);
          const s    = 1.25 - 0.25 * (1 - Math.pow(1 - prog, 3));
          // Preserve Y base scale during punch
          slot.mesh.scale.set(s, s * slot._baseScaleY, s);
          if (slot._punchT >= 0.15) {
            slot._punching = false;
            slot.mesh.scale.set(1, slot._baseScaleY, 1);
          }
        }

        // Gentle Y-bob on main slot
        if (si === 0) {
          slot.mesh.position.y = 0.01 + Math.sin(elapsed * 2.4) * 0.04;
        }
      }

      // Spark bead flicker for this lane's main slot
      const mainVisible = this._slots[li][0].mesh.visible;
      const bead = this._sparkBeads[li];
      bead.bead.visible = mainVisible;
      if (mainVisible) {
        bead.mat.emissiveIntensity =
          0.35 + 0.65 * (0.5 + 0.5 * Math.sin(elapsed * SPARK_FLICKER_SPEED + li * 1.3));
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
    for (const { bead, mat } of this._sparkBeads) {
      bead.geometry.dispose();
      mat.dispose();
      this._scene.remove(bead);
    }
    this._slots = [];
    this._sparkBeads = [];
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _createSlot(laneIdx, worldZ, slotIdx) {
    const canvas = document.createElement('canvas');
    canvas.width  = CVS_W;
    canvas.height = CVS_H;
    const ctx = canvas.getContext('2d');

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: SLOT_ALPHA[slotIdx],
      depthTest: false, side: THREE.DoubleSide,
    });

    const geo  = new THREE.PlaneGeometry(SLOT_W, SLOT_H);
    const mesh = new THREE.Mesh(geo, mat);

    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(laneToX(laneIdx), 0.01, worldZ);
    // Queue slots get a smaller Y scale for a depth-receding look
    const baseScaleY = SLOT_SCALE_Y[slotIdx];
    mesh.scale.set(1, baseScaleY, 1);
    mesh.visible = false;
    mesh.layers.set(1);
    this._scene.add(mesh);

    return {
      mesh, mat, tex, ctx, canvas,
      lastColor: -1, lastDamage: -1,
      _punching: false, _punchT: 0,
      _baseScaleY: baseScaleY,
    };
  }
}
