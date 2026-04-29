// Shooter3D — each slot is a THREE.Group with a SphereGeometry bomb body,
// a TubeGeometry fuse, and a horizontal CanvasTexture badge for the damage
// number.  Viewed from the top-down orthographic shooter camera (layer 1).
//
// Queue depth cue: slot index 0 = main/front, 1–3 = receding queue.
// Achieved by scaling the group down and reducing sphere emissive intensity.

import * as THREE from 'three';
import { laneToX } from './Scene3D.js';

// ── Layout ────────────────────────────────────────────────────────────────────
const SLOT_Z  = [-1.5, -0.5, 0.5, 1.4];   // world-Z per slot row
const LANE_COUNT = 4;

// ── Per-slot depth parameters ─────────────────────────────────────────────────
const SLOT_SCALE     = [1.00, 0.92, 0.83, 0.74];   // group uniform scale
const SLOT_ALPHA     = [1.00, 0.80, 0.60, 0.40];   // material opacity
const SLOT_EMISSIVE  = [0.35, 0.22, 0.15, 0.08];   // sphere emissive intensity

// ── Bomb geometry (group-local coords) ───────────────────────────────────────
const BOMB_R  = 0.28;    // sphere radius
const BOMB_CX = -0.25;   // sphere center X within group (left side)
const BOMB_CY = BOMB_R;  // sphere center Y (sits on the floor plane)
const BOMB_CZ = 0;       // sphere center Z

// ── Spark emissive bead (per lane, at main-slot fuse tip) ─────────────────────
const SPARK_BEAD_COLOR    = 0xff8800;
const SPARK_BEAD_RADIUS   = 0.045;
const SPARK_FLICKER_SPEED = 12;   // radians/sec

// ── Badge canvas ──────────────────────────────────────────────────────────────
const BADGE_CVS_W = 80;
const BADGE_CVS_H = 40;
const BADGE_W     = 0.65;   // world-unit badge width
const BADGE_H     = 0.32;   // world-unit badge height

// ── Color palette ─────────────────────────────────────────────────────────────
const COLOR_HEX = {
  Red:    0xE24B4A, Blue:   0x378ADD, Green:  0x639922,
  Yellow: 0xEF9F27, Purple: 0x7F77DD, Orange: 0xD85A30,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function drawDamageBadge(ctx, W, H, damage) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,12,0.80)';
  if (ctx.roundRect) ctx.roundRect(1, 1, W - 2, H - 2, 6);
  else               ctx.rect(1, 1, W - 2, H - 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.72)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();
  ctx.font         = `bold ${Math.round(H * 0.68)}px Arial`;
  ctx.fillStyle    = '#ffffff';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor  = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur   = 3;
  ctx.fillText(String(damage), W / 2, H / 2);
  ctx.shadowBlur   = 0;
}

export class Shooter3D {
  constructor(scene, columns) {
    this._scene   = scene;
    this._columns = columns;
    this._elapsed = 0;

    // _slots[laneIdx][slotIdx] = {
    //   group, sphereMesh, sphereMat, fuseMesh,
    //   badgeCanvas, badgeCtx, badgeTex, badgeMesh,
    //   lastColor, lastDamage, _punching, _punchT, _baseScale
    // }
    this._slots = [];
    for (let li = 0; li < LANE_COUNT; li++) {
      this._slots.push(SLOT_Z.map((z, si) => this._createSlot(li, z, si)));
    }

    this._activeColCount = LANE_COUNT;

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
      bead.position.set(laneToX(li) + BOMB_CX + 0.15, BOMB_CY + 0.38, SLOT_Z[0] - 0.30);
      bead.visible = false;
      bead.layers.set(1);
      this._scene.add(bead);
      this._sparkBeads.push({ bead, mat });
    }
  }

  // ── Public ───────────────────────────────────────────────────────────────────

  setLaneCount(n) {
    for (let li = 0; li < this._slots.length; li++) {
      const x = laneToX(li, n);
      for (const slot of this._slots[li]) {
        slot.group.position.x = x;
      }
      const sb = this._sparkBeads[li];
      if (sb) sb.bead.position.x = x + BOMB_CX + 0.15;
    }
  }

  setActiveColCount(n) {
    this._activeColCount = n;
  }

  triggerPunch(colIdx) {
    const slot = this._slots[colIdx]?.[0];
    if (!slot) return;
    slot.group.scale.setScalar(1.30);
    slot._punchT   = 0;
    slot._punching = true;
  }

  update(dt, elapsed) {
    this._elapsed = elapsed;

    for (let li = 0; li < LANE_COUNT; li++) {
      const col   = this._columns[li];
      const slots = this._slots[li];

      // Inactive columns: hide all slots and spark bead.
      if (li >= this._activeColCount) {
        for (const slot of slots) slot.group.visible = false;
        this._sparkBeads[li].bead.visible = false;
        continue;
      }

      for (let si = 0; si < SLOT_Z.length; si++) {
        const slot    = slots[si];
        const shooter = col.shooters?.[si] ?? null;

        if (!shooter) {
          slot.group.visible = false;
          continue;
        }

        slot.group.visible = true;

        const hex    = COLOR_HEX[shooter.color] ?? 0x888888;
        const damage = shooter.damage ?? 1;

        if (slot.lastColor !== hex || slot.lastDamage !== damage) {
          slot.lastColor  = hex;
          slot.lastDamage = damage;
          // Update sphere material color + emissive
          slot.sphereMat.color.setHex(hex);
          slot.sphereMat.emissive.setHex(hex);
          // Redraw damage badge
          drawDamageBadge(slot.badgeCtx, BADGE_CVS_W, BADGE_CVS_H, damage);
          slot.badgeTex.needsUpdate = true;
        }

        // Punch animation on main slot
        if (si === 0 && slot._punching) {
          slot._punchT += dt;
          const prog = Math.min(1, slot._punchT / 0.15);
          const s    = (1.30 - 0.30 * (1 - Math.pow(1 - prog, 3))) * slot._baseScale;
          slot.group.scale.setScalar(s);
          if (slot._punchT >= 0.15) {
            slot._punching = false;
            slot.group.scale.setScalar(slot._baseScale);
          }
        }

        // Gentle Y-bob on main slot
        if (si === 0) {
          slot.group.position.y = Math.sin(elapsed * 2.4) * 0.03;
        }
      }

      // Spark bead flicker for this lane's main slot
      const mainVisible = this._slots[li][0].group.visible;
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
        slot.badgeTex.dispose();
        slot.sphereMesh.geometry.dispose();
        slot.fuseMesh.geometry.dispose();
        slot.badgeMesh.geometry.dispose();
        slot.sphereMat.dispose();
        slot.fuseMat.dispose();
        slot.badgeMat.dispose();
        this._scene.remove(slot.group);
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
    const alpha    = SLOT_ALPHA[slotIdx];
    const emissive = SLOT_EMISSIVE[slotIdx];
    const scale    = SLOT_SCALE[slotIdx];
    const group    = new THREE.Group();

    // ── Sphere body ───────────────────────────────────────────────────────────
    const sphereMat = new THREE.MeshStandardMaterial({
      color:             0x888888,
      emissive:          new THREE.Color(0x888888),
      emissiveIntensity: emissive,
      metalness:         0.30,
      roughness:         0.45,
      transparent:       alpha < 1,
      opacity:           alpha,
    });
    const sphereMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BOMB_R, 14, 10),
      sphereMat,
    );
    sphereMesh.position.set(BOMB_CX, BOMB_CY, BOMB_CZ);
    sphereMesh.castShadow = false;
    group.add(sphereMesh);

    // ── Fuse (TubeGeometry along a curved path) ───────────────────────────────
    // Curve goes from sphere top toward the upper-right, visible from above.
    const fuseStart = new THREE.Vector3(BOMB_CX,        BOMB_CY + BOMB_R,        BOMB_CZ);
    const fuseMid   = new THREE.Vector3(BOMB_CX + 0.08, BOMB_CY + BOMB_R + 0.14, BOMB_CZ - 0.14);
    const fuseEnd   = new THREE.Vector3(BOMB_CX + 0.16, BOMB_CY + BOMB_R + 0.25, BOMB_CZ - 0.26);
    const fuseCurve = new THREE.CatmullRomCurve3([fuseStart, fuseMid, fuseEnd]);
    const fuseGeo   = new THREE.TubeGeometry(fuseCurve, 8, 0.022, 5, false);
    const fuseMat   = new THREE.MeshStandardMaterial({
      color:       0xaaaaaa,
      roughness:   0.8,
      transparent: alpha < 1,
      opacity:     alpha,
    });
    const fuseMesh = new THREE.Mesh(fuseGeo, fuseMat);
    group.add(fuseMesh);

    // ── Damage badge (horizontal PlaneGeometry with canvas texture) ───────────
    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width  = BADGE_CVS_W;
    badgeCanvas.height = BADGE_CVS_H;
    const badgeCtx = badgeCanvas.getContext('2d');
    const badgeTex = new THREE.CanvasTexture(badgeCanvas);
    const badgeMat = new THREE.MeshBasicMaterial({
      map: badgeTex, transparent: true, opacity: alpha, depthTest: false,
    });
    const badgeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(BADGE_W, BADGE_H),
      badgeMat,
    );
    // Lie flat so it's readable from the top-down shooter camera.
    badgeMesh.rotation.x = -Math.PI / 2;
    badgeMesh.position.set(0.42, 0.005, 0);
    group.add(badgeMesh);

    // All meshes in layer 1 (shooter camera only).
    group.traverse(obj => { if (obj.isMesh) obj.layers.set(1); });

    group.scale.setScalar(scale);
    group.position.set(laneToX(laneIdx), 0, worldZ);
    group.visible = false;
    this._scene.add(group);

    return {
      group, sphereMesh, sphereMat, fuseMesh, fuseMat,
      badgeCanvas, badgeCtx, badgeTex, badgeMesh, badgeMat,
      lastColor: -1, lastDamage: -1,
      _punching: false, _punchT: 0,
      _baseScale: scale,
    };
  }
}
