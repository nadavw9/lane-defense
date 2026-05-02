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
const SLOT_SCALE     = [1.15, 0.70, 0.55, 0.40];   // group uniform scale
const SLOT_ALPHA     = [1.00, 0.80, 0.60, 0.40];   // material opacity
const SLOT_EMISSIVE  = [0.35, 0.22, 0.15, 0.08];   // sphere body emissive
const BAND_EMISSIVE  = [0.95, 0.68, 0.48, 0.30];   // colored equator band emissive

// ── Bomb geometry (group-local coords) ───────────────────────────────────────
const BOMB_R  = 0.36;    // sphere radius
const BOMB_CX = -0.25;   // sphere center X within group (left side)
const BOMB_CY = BOMB_R;  // sphere center Y (sits on the floor plane)
const BOMB_CZ = 0;       // sphere center Z

// ── Spark emissive bead (per lane, at main-slot fuse tip) ─────────────────────
const SPARK_BEAD_COLOR    = 0xff8800;
const SPARK_BEAD_RADIUS   = 0.045;
const SPARK_FLICKER_SPEED = 12;   // radians/sec

// ── Badge canvas ──────────────────────────────────────────────────────────────
const BADGE_CVS_W = 64;
const BADGE_CVS_H = 64;
const BADGE_W     = 0.58;   // world-unit badge (square hex)
const BADGE_H     = 0.58;

// ── Color palette ─────────────────────────────────────────────────────────────
const COLOR_HEX = {
  Red:    0xE24B4A, Blue:   0x378ADD, Green:  0x639922,
  Yellow: 0xEF9F27, Purple: 0x7F77DD, Orange: 0xD85A30,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function drawDamageBadge(ctx, W, H, damage, colorHex = 0x378ADD) {
  const cr = (colorHex >> 16) & 0xff;
  const cg = (colorHex >> 8)  & 0xff;
  const cb =  colorHex        & 0xff;
  const cx = W / 2, cy = H / 2;
  const r  = Math.min(W, H) / 2 - 2;

  ctx.clearRect(0, 0, W, H);

  // Hexagonal shape (point-up)
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a  = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();

  // Dark fill
  ctx.fillStyle = 'rgba(14,12,24,0.92)';
  ctx.fill();

  // Colored border
  ctx.strokeStyle = `rgb(${cr},${cg},${cb})`;
  ctx.lineWidth   = 2.5;
  ctx.stroke();

  // White damage number with colored glow
  ctx.font         = `bold ${Math.round(H * 0.50)}px Arial`;
  ctx.fillStyle    = '#ffffff';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor  = `rgba(${cr},${cg},${cb},0.75)`;
  ctx.shadowBlur   = 5;
  ctx.fillText(String(damage), cx, cy);
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

    // Front-slot glow rings — flat ring on ground plane, pulsing to signal "drag me"
    this._glowRings = [];
    const ringGeo   = new THREE.RingGeometry(BOMB_R * 1.25, BOMB_R * 1.70, 26);
    for (let li = 0; li < LANE_COUNT; li++) {
      const mat  = new THREE.MeshBasicMaterial({
        color: 0xffcc44, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(laneToX(li) + BOMB_CX, 0.02, SLOT_Z[0]);
      mesh.visible = false;
      mesh.layers.set(1);
      this._scene.add(mesh);
      this._glowRings.push({ mesh, mat });
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
      const gr = this._glowRings[li];
      if (gr) gr.mesh.position.x = x + BOMB_CX;
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
          // Dark sphere keeps body color; only inner emissive tints to lane color
          slot.sphereMat.emissive.setHex(hex);
          // Colored equator band is the primary color signal
          slot.bandMat.color.setHex(hex);
          slot.bandMat.emissive.setHex(hex);
          // Redraw hexagonal damage badge
          drawDamageBadge(slot.badgeCtx, BADGE_CVS_W, BADGE_CVS_H, damage, hex);
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

      // Front-slot glow ring — pulsing gold halo around the draggable bomb
      const gr = this._glowRings[li];
      gr.mesh.visible = mainVisible;
      if (mainVisible) {
        const pulse     = 0.5 + 0.5 * Math.sin(elapsed * 3.0 + li * 0.8);
        gr.mat.opacity  = 0.25 + 0.45 * pulse;
        const s         = 1.0 + 0.08 * pulse;
        gr.mesh.scale.set(s, s, 1);
        // Tint ring to front bomb's color
        const frontHex = this._slots[li][0].lastColor;
        if (frontHex > 0) gr.mat.color.setHex(frontHex);
      }
    }
  }

  dispose() {
    for (const laneSlots of this._slots) {
      for (const slot of laneSlots) {
        slot.badgeTex.dispose();
        slot.sphereMesh.geometry.dispose();
        slot.bandMesh.geometry.dispose();
        slot.fuseMesh.geometry.dispose();
        slot.badgeMesh.geometry.dispose();
        slot.sphereMat.dispose();
        slot.bandMat.dispose();
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
    for (const { mesh, mat } of this._glowRings) {
      // ringGeo is shared — don't dispose it here
      mat.dispose();
      this._scene.remove(mesh);
    }
    this._slots      = [];
    this._sparkBeads = [];
    this._glowRings  = [];
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _createSlot(laneIdx, worldZ, slotIdx) {
    const alpha    = SLOT_ALPHA[slotIdx];
    const emissive = SLOT_EMISSIVE[slotIdx];
    const scale    = SLOT_SCALE[slotIdx];
    const group    = new THREE.Group();

    // ── Sphere body — dark with faint inner color glow ────────────────────────
    const sphereMat = new THREE.MeshStandardMaterial({
      color:             0x1a1a22,
      emissive:          new THREE.Color(0x1a1a22),
      emissiveIntensity: emissive * 0.8,
      metalness:         0.60,
      roughness:         0.30,
      transparent:       alpha < 1,
      opacity:           alpha,
    });
    const sphereMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BOMB_R, 16, 12),
      sphereMat,
    );
    sphereMesh.position.set(BOMB_CX, BOMB_CY, BOMB_CZ);
    group.add(sphereMesh);

    // ── Colored equator band (torus lying flat, visible from top-down cam) ────
    const bandMat = new THREE.MeshStandardMaterial({
      color:             0x888888,
      emissive:          new THREE.Color(0x888888),
      emissiveIntensity: BAND_EMISSIVE[slotIdx],
      metalness:         0.15,
      roughness:         0.25,
      transparent:       alpha < 1,
      opacity:           alpha,
    });
    const bandMesh = new THREE.Mesh(
      new THREE.TorusGeometry(BOMB_R * 0.90, 0.042, 8, 22),
      bandMat,
    );
    bandMesh.rotation.x = Math.PI / 2;   // lie flat for top-down readability
    bandMesh.position.set(BOMB_CX, BOMB_CY, BOMB_CZ);
    group.add(bandMesh);

    // ── Rope fuse (TubeGeometry, brown twine) ─────────────────────────────────
    const fuseStart = new THREE.Vector3(BOMB_CX,        BOMB_CY + BOMB_R,        BOMB_CZ);
    const fuseMid   = new THREE.Vector3(BOMB_CX + 0.08, BOMB_CY + BOMB_R + 0.14, BOMB_CZ - 0.14);
    const fuseEnd   = new THREE.Vector3(BOMB_CX + 0.16, BOMB_CY + BOMB_R + 0.25, BOMB_CZ - 0.26);
    const fuseCurve = new THREE.CatmullRomCurve3([fuseStart, fuseMid, fuseEnd]);
    const fuseGeo   = new THREE.TubeGeometry(fuseCurve, 8, 0.022, 5, false);
    const fuseMat   = new THREE.MeshStandardMaterial({
      color:       0x8b6040,   // rope brown
      roughness:   0.90,
      metalness:   0.0,
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
    badgeMesh.rotation.x = -Math.PI / 2;
    badgeMesh.position.set(0.46, 0.005, 0);
    group.add(badgeMesh);

    // All meshes in layer 1 (shooter camera only).
    group.traverse(obj => { if (obj.isMesh) obj.layers.set(1); });

    group.scale.setScalar(scale);
    group.position.set(laneToX(laneIdx), 0, worldZ);
    group.visible = false;
    this._scene.add(group);

    return {
      group, sphereMesh, sphereMat, bandMesh, bandMat,
      fuseMesh, fuseMat,
      badgeCanvas, badgeCtx, badgeTex, badgeMesh, badgeMat,
      lastColor: -1, lastDamage: -1,
      _punching: false, _punchT: 0,
      _baseScale: scale,
    };
  }
}
