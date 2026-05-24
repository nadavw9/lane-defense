// Shooter3D — Bomb visual: one solid-color sphere + damage badge per slot.
// Top-down orthographic camera: bombs appear as colored circles from above.
// No fuse, no spark — one sphere, one badge, nothing else.
//
// Slot layout: 4 evenly-spaced cells filling the bomb zone (Z=0 breach line
// to Z≈11.2 booster bar). Each cell = CELL × 0.70 world units tall.
// Slot centers at midpoint of each cell: Z = (s + 0.5) × CELL × 0.70.

import * as THREE from 'three';
import { laneToX, CELL } from './Scene3D.js';

// ── Layout ─────────────────────────────────────────────────────────────────────
const LANE_COUNT = 4;
const SLOT_COUNT = 4;

// Bomb zone: Z=0 (breach) to Z≈11.2 (booster bar). Cell height = CELL × 0.70.
function slotZ(s) { return (s + 0.5) * CELL * 0.70; }

// ── Bomb geometry ──────────────────────────────────────────────────────────────
// BOMB_R = cell_height × 0.38 = CELL × 0.70 × 0.38 ≈ CELL × 0.266.
const BOMB_R  = CELL * 0.266;   // ≈ 1.064 world units
const BOMB_CX = 0;
const BOMB_CY = BOMB_R;         // sphere sits with bottom at y=0
const BOMB_CZ = 0;

// ── Badge canvas — single size for all slots ───────────────────────────────────
// BADGE_WORLD_H = 1.10 world units ≈ 22 px on screen (readable from across a room)
const BADGE_CVS_W   = 192;
const BADGE_CVS_H   = 112;
const BADGE_WORLD_W = 1.70;
const BADGE_WORLD_H = 1.00;

// ── Color palette ──────────────────────────────────────────────────────────────
const COLOR_HEX = {
  Red:    0xFF1111,
  Blue:   0x1166FF,
  Green:  0x11CC11,
  Yellow: 0xFFDD00,
  Purple: 0xBB11FF,
  Orange: 0xFF7700,
};

// ── Cross-browser rounded rect ─────────────────────────────────────────────────
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }
}

// ── Badge drawing — colored pill + bold white number ───────────────────────────
function drawDamageBadge(ctx, W, H, damage, colorHex) {
  const cr = (colorHex >> 16) & 0xff;
  const cg = (colorHex >>  8) & 0xff;
  const cb =  colorHex        & 0xff;
  // Badge background: same color family as bomb, but darker (×0.7) so it reads
  // as part of the bomb rather than a foreign white element floating on top.
  const dr = Math.round(cr * 0.7);
  const dg = Math.round(cg * 0.7);
  const db = Math.round(cb * 0.7);

  ctx.clearRect(0, 0, W, H);

  const pw = W * 0.90, ph = H * 0.78;
  const px = (W - pw) / 2, py = (H - ph) / 2;
  const r  = ph / 2;

  ctx.shadowColor   = 'rgba(0,0,0,0.80)';
  ctx.shadowBlur    = Math.max(4, H * 0.10);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.max(2, H * 0.05);

  _roundRect(ctx, px, py, pw, ph, r);
  ctx.fillStyle = `rgb(${dr},${dg},${db})`;
  ctx.fill();

  ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

  _roundRect(ctx, px + 2, py + 2, pw - 4, ph * 0.40, r);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fill();

  _roundRect(ctx, px, py, pw, ph, r);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth   = 2.0;
  ctx.stroke();

  const fontSize = Math.round(ph * 0.90);
  ctx.font         = `900 ${fontSize}px Arial`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth    = Math.max(5, fontSize * 0.18);
  ctx.strokeStyle  = 'rgba(0,0,0,0.90)';
  ctx.strokeText(String(damage), W / 2, H / 2 + 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(damage), W / 2, H / 2 + 1);
}

// ── Punch ease-out ─────────────────────────────────────────────────────────────
function easeOut3(t) { return 1 - Math.pow(1 - Math.min(t, 1), 3); }

export class Shooter3D {
  constructor(scene, columns) {
    this._scene   = scene;
    this._columns = columns;
    this._elapsed = 0;

    this._slots = [];
    for (let li = 0; li < LANE_COUNT; li++) {
      this._slots.push(
        Array.from({ length: SLOT_COUNT }, (_, si) => this._createSlot(li, slotZ(si))),
      );
    }

    this._activeColCount = LANE_COUNT;
  }

  // ── Public API ─────────────────────────────────────────────────────────────────

  setLaneCount(n) {
    for (let li = 0; li < this._slots.length; li++) {
      const x = laneToX(li, n);
      for (let si = 0; si < this._slots[li].length; si++) {
        this._slots[li][si].group.position.x = x;
        this._slots[li][si].group.position.z = slotZ(si);
      }
    }
  }

  setActiveColCount(n) { this._activeColCount = n; }

  triggerPunch(colIdx) {
    const slot = this._slots[colIdx]?.[0];
    if (!slot) return;
    slot.group.scale.setScalar(1.40 * slot._baseScale);
    slot._punchT   = 0;
    slot._punching = true;
    slot._flashT   = 0;
    slot._flashing = true;
    slot.sphereMat.color.setHex(0xffffff);
  }

  update(dt, elapsed) {
    this._elapsed = elapsed;

    for (let li = 0; li < LANE_COUNT; li++) {
      const col   = this._columns[li];
      const slots = this._slots[li];

      if (li >= this._activeColCount) {
        for (const slot of slots) slot.group.visible = false;
        continue;
      }

      for (let si = 0; si < SLOT_COUNT; si++) {
        const slot    = slots[si];
        const shooter = col.shooters?.[si] ?? null;

        if (!shooter) {
          slot.group.visible      = true;
          slot.sphereMesh.visible = false;
          slot.badgeMesh.visible  = false;
          slot.emptyMesh.visible  = true;
          continue;
        }

        slot.group.visible      = true;
        slot.sphereMesh.visible = true;
        slot.badgeMesh.visible  = true;
        slot.emptyMesh.visible  = false;

        const hex    = COLOR_HEX[shooter.color] ?? 0x888888;
        const damage = shooter.damage ?? 1;

        // Sync color + badge on change
        if (slot.lastColor !== hex || slot.lastDamage !== damage) {
          slot.lastColor  = hex;
          slot.lastDamage = damage;
          slot.sphereMat.color.setHex(hex);
          drawDamageBadge(slot.badgeCtx, BADGE_CVS_W, BADGE_CVS_H, damage, hex);
          slot.badgeTex.needsUpdate = true;
        }

        // White flash decay after punch
        if (si === 0 && slot._flashing) {
          slot._flashT += dt;
          const FLASH_DUR = 0.08;
          if (slot._flashT >= FLASH_DUR) {
            slot._flashing = false;
            slot.sphereMat.color.setHex(slot.lastColor > 0 ? slot.lastColor : 0x888888);
          } else {
            const fc = new THREE.Color(0xffffff).lerp(
              new THREE.Color(slot.lastColor), easeOut3(slot._flashT / FLASH_DUR),
            );
            slot.sphereMat.color.copy(fc);
          }
        }

        // Punch scale spring (front slot only)
        if (si === 0 && slot._punching) {
          slot._punchT += dt;
          const PUNCH_DUR = 0.15;
          const prog = Math.min(1, slot._punchT / PUNCH_DUR);
          const s    = (1.40 - 0.40 * easeOut3(prog)) * slot._baseScale;
          slot.group.scale.setScalar(s);
          if (slot._punchT >= PUNCH_DUR) {
            slot._punching = false;
            slot.group.scale.setScalar(slot._baseScale);
          }
        }

        // Gentle Y-bob on front slot only
        if (si === 0) {
          slot.group.position.y = Math.sin(elapsed * 2.4) * 0.03;
        }
      }
    }
  }

  dispose() {
    for (const laneSlots of this._slots) {
      for (const slot of laneSlots) {
        slot.badgeTex.dispose();
        slot.sphereMesh.geometry.dispose();
        slot.emptyMesh.geometry.dispose();
        slot.sphereMat.dispose();
        slot.emptyMat.dispose();
        slot.badgeMat.dispose();
        this._scene.remove(slot.group);
      }
    }
    this._slots = [];
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _createSlot(laneIdx, worldZ) {
    const group = new THREE.Group();

    // ── Sphere — MeshBasicMaterial for true, lighting-independent color ────────
    const sphereMat = new THREE.MeshBasicMaterial({
      color:       new THREE.Color(0x888888),
      transparent: false,
    });
    const sphereMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BOMB_R, 26, 18),
      sphereMat,
    );
    sphereMesh.position.set(BOMB_CX, BOMB_CY, BOMB_CZ);
    group.add(sphereMesh);

    // ── Damage badge — colored pill, bold white number ─────────────────────────
    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width  = BADGE_CVS_W;
    badgeCanvas.height = BADGE_CVS_H;
    const badgeCtx = badgeCanvas.getContext('2d');
    const badgeTex = new THREE.CanvasTexture(badgeCanvas);
    const badgeMat = new THREE.SpriteMaterial({
      map: badgeTex, transparent: true, depthTest: false,
    });
    const badgeMesh = new THREE.Sprite(badgeMat);
    badgeMesh.scale.set(BADGE_WORLD_W, BADGE_WORLD_H, 1);
    badgeMesh.position.set(BOMB_CX, BOMB_CY + BOMB_R + 0.60, BOMB_CZ);
    group.add(badgeMesh);

    // ── Empty slot placeholder — dim grey sphere when no shooter ──────────────
    const emptyMat = new THREE.MeshStandardMaterial({
      color:             0x888888,
      emissive:          0x333333,
      emissiveIntensity: 0.10,
      metalness:         0.0,
      roughness:         0.70,
      transparent:       true,
      opacity:           0.25,
    });
    const emptyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BOMB_R, 12, 8),
      emptyMat,
    );
    emptyMesh.position.set(BOMB_CX, BOMB_CY, BOMB_CZ);
    emptyMesh.visible = false;
    group.add(emptyMesh);

    group.traverse(obj => { if (obj.isMesh || obj.isSprite) obj.layers.set(0); });

    group.scale.setScalar(1.0);
    group.position.set(laneToX(laneIdx), 0, worldZ);
    group.visible = false;
    this._scene.add(group);

    return {
      group,
      sphereMesh, sphereMat,
      emptyMesh,  emptyMat,
      badgeCanvas, badgeCtx, badgeTex, badgeMesh, badgeMat,
      lastColor:  -1,
      lastDamage: -1,
      _punching: false, _punchT: 0,
      _flashing: false, _flashT: 0,
      _baseScale: 1.0,
    };
  }
}
