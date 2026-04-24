// Shooter3D — 3D cannon turrets positioned at the near road edge.
//
// Renders one cannon per column (the "top" shooter) as a 3D mesh.
// The existing PixiJS ShooterRenderer keeps handling all 2D UI, drag-drop,
// and stacked shooter display in the screen-bottom panel.  Shooter3D adds
// visual 3D cannons that appear AT the breach line so shots visually
// originate from a physical object on the road.
//
// Each cannon group:
//   • Track base — rounded cylinder, dark (sits on ground)
//   • Barrel     — tapered cone, shooter colour (points upward)
//   • Muzzle     — small dark sphere at barrel tip
//   • Recoil     — barrel rotates back on fire, springs back
//
// Animations:
//   • Idle bounce  — gentle Y oscillation (±0.06 units at 2.4 Hz)
//   • Deploy punch — scale 1.30 → 1.0 over 0.15 s (triggered by GameApp)
//   • Recoil       — barrel rotates back on fire, springs back

import * as THREE from 'three';
import { laneToX, ROAD_Z_NEAR } from './Scene3D.js';

// ── Cannon dimensions ─────────────────────────────────────────────────────────
const TRACK_R    = 0.45;   // track base radius
const TRACK_H    = 0.12;   // track height
const BARREL_R_BASE = 0.12;  // barrel radius at base
const BARREL_H   = 0.70;   // barrel length (points straight up)
const MUZZLE_R   = 0.10;   // muzzle cap radius
const MUZZLE_Y   = BARREL_H - 0.05;  // muzzle sits at barrel tip
// Legacy aliases used by queue slot code
const BODY_H     = BARREL_H;   // for positioning

// Turret world position for the shooter viewport camera.
// TOP-DOWN camera at (0, 4.5, 0) looking down, up=(0,0,-1), vFOV=70°.
// Main turret at Z=0 (camera focus) → screen Y ≈ 610.
// Queue slots stacked in Z (further from camera origin = lower in viewport):
//   Slot 0 (top/main) : Z=0.0  → screen Y ≈ 610  (fully opaque)
//   Slot 1 (2nd)      : Z=1.8  → screen Y ≈ 661  (62% scale, 62% opacity)
//   Slot 2 (3rd)      : Z=2.8  → screen Y ≈ 690  (40% scale, 40% opacity)

const TURRET_Y    = TRACK_H / 2;   // track base sits on ground, centre at TRACK_H/2
// Z positions — with top-down camera at Y=4.5, vFOV=70°:
//   screen_Y = (1 - Z/3.15) / 2 * 180 + 520
//   TURRET_Z=-1.5 → Y≈567  SLOT1_Z=-0.5 → Y≈596  SLOT2_Z=0.5 → Y≈624  SLOT3_Z=1.4 → Y≈650
const TURRET_Z    = -1.5;  // main: barrel tip at Y≈529, body at Y≈567
const SLOT1_Z     = -0.5;  // slot1: screen Y ≈ 596
const SLOT2_Z     =  0.5;  // slot2: screen Y ≈ 624
const SLOT3_Z     =  1.4;  // slot3: screen Y ≈ 650
const SLOT_SCALE  =  1.0;  // all queue slots same size as main

// Idle bounce
const BOUNCE_AMP   = 0.06;
const BOUNCE_SPEED = 2.4;   // rad/s

// Deploy punch
const PUNCH_DURATION = 0.15;
const PUNCH_SCALE    = 1.30;

// Barrel recoil
const RECOIL_ANGLE   = 0.35;   // how far barrel rotates back (radians)
const RECOIL_DURATION = 0.12;   // total recoil duration (s)

// Barrel tip glow
const TIP_GLOW_PEAK = 3.0;      // emissiveIntensity peak on fire
const TIP_GEO_R     = 0.09;     // sphere radius

function easeOut(t) { return 1 - Math.pow(1 - Math.min(t, 1), 3); }

// ── Colour palette ─────────────────────────────────────────────────────────────
const COLOR_HEX = {
  Red:    0xE24B4A,
  Blue:   0x378ADD,
  Green:  0x639922,
  Yellow: 0xEF9F27,
  Purple: 0x7F77DD,
  Orange: 0xD85A30,
};

const LANE_COUNT = 4;

// ── Shared geometry ───────────────────────────────────────────────────────────
let _trackGeo   = null;
let _barrelGeo  = null;
let _muzzleGeo  = null;
let _trackMat   = null;

function sharedGeo() {
  if (!_trackGeo) {
    _trackGeo   = new THREE.CylinderGeometry(TRACK_R, TRACK_R, TRACK_H, 16);
    // Tapered barrel: cone from base radius to tip
    _barrelGeo  = new THREE.ConeGeometry(BARREL_R_BASE, BARREL_H, 12);
    _muzzleGeo  = new THREE.SphereGeometry(MUZZLE_R, 10, 8);
    _trackMat   = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.8, metalness: 0.2 });
  }
}

export class Shooter3D {
  constructor(scene, columns) {
    this._scene   = scene;
    this._columns = columns;

    sharedGeo();

    // Per-column state: { group, barrelGroup, barrelMat, muzzleMat, punchState }
    this._turrets = [];

    for (let i = 0; i < LANE_COUNT; i++) {
      this._turrets.push(this._createTurret(i));
    }

    this._elapsed = 0;
  }

  // ── Public ───────────────────────────────────────────────────────────────────

  /** Trigger the deploy punch animation for column colIdx. */
  triggerPunch(colIdx) {
    if (colIdx < 0 || colIdx >= this._turrets.length) return;
    const t = this._turrets[colIdx];
    t.punchActive  = true;
    t.punchT       = 0;
    t.recoilActive = true;
    t.recoilT      = 0;
    t.tipGlowT     = 0;      // resets glow countdown
  }

  update(dt, elapsed) {
    this._elapsed = elapsed;
    const bounce  = Math.sin(elapsed * BOUNCE_SPEED) * BOUNCE_AMP;

    for (let i = 0; i < LANE_COUNT; i++) {
      const col    = this._columns[i];
      const turret = this._turrets[i];
      const top    = col.top();

      if (!top) {
        // No shooter in column — hide turret and all queue slots.
        turret.group.visible = false;
        turret.slot1.group.visible = false;
        turret.slot2.group.visible = false;
        turret.slot3.group.visible = false;
        turret.numSprite0.sprite.visible  = false;
        turret.slot1.numSprite.sprite.visible = false;
        turret.slot2.numSprite.sprite.visible = false;
        turret.slot3.numSprite.sprite.visible = false;
        continue;
      }

      // Top slot: show the main cannon so the player can see what they'll drag.
      turret.group.visible = true;
      turret.numSprite0.sprite.visible  = false;

      // Update colour when shooter changes.
      const hex = COLOR_HEX[top.color] ?? 0x888888;
      if (turret.lastColor !== hex) {
        turret.lastColor = hex;
        turret.barrelMat.color.setHex(hex);
        turret.muzzleMat.emissive.setHex(0x333333);
      }
      // Always refresh main number sprite (damage can change without color change).
      this._refreshNumberSprite(turret.numSprite0, top.damage ?? 1, hex);
      turret.numSprite0.sprite.visible = true;

      // Sync queue slot colours.
      const s1 = col.shooters?.[1];
      const s2 = col.shooters?.[2];
      const h1 = s1 ? (COLOR_HEX[s1.color] ?? 0x888888) : null;
      const h2 = s2 ? (COLOR_HEX[s2.color] ?? 0x888888) : null;
      const s3 = col.shooters?.[3];
      const h3 = s3 ? (COLOR_HEX[s3.color] ?? 0x888888) : null;
      turret.slot1.group.visible = !!s1;
      turret.slot2.group.visible = !!s2;
      turret.slot3.group.visible = !!s3;
      if (s1 && turret.slot1.lastColor !== h1) {
        turret.slot1.lastColor = h1;
        turret.slot1.barrelMat.color.setHex(h1);
      }
      if (turret.slot1.group.visible)
        this._refreshNumberSprite(turret.slot1.numSprite, s1?.damage ?? 1, h1 ?? 0x888888);
      turret.slot1.numSprite.sprite.visible = !!s1;

      if (s2 && turret.slot2.lastColor !== h2) {
        turret.slot2.lastColor = h2;
        turret.slot2.barrelMat.color.setHex(h2);
      }
      if (turret.slot2.group.visible)
        this._refreshNumberSprite(turret.slot2.numSprite, s2?.damage ?? 1, h2 ?? 0x888888);
      turret.slot2.numSprite.sprite.visible = !!s2;

      if (s3 && turret.slot3.lastColor !== h3) {
        turret.slot3.lastColor = h3;
        turret.slot3.barrelMat.color.setHex(h3);
      }
      if (turret.slot3.group.visible)
        this._refreshNumberSprite(turret.slot3.numSprite, s3?.damage ?? 1, h3 ?? 0x888888);
      turret.slot3.numSprite.sprite.visible = !!s3;

      // Idle bounce (Y).
      const baseY = TURRET_Y;

      // ── Deploy punch ─────────────────────────────────────────────────────
      if (turret.punchActive) {
        turret.punchT += dt;
        const prog = Math.min(1, turret.punchT / PUNCH_DURATION);
        const s    = PUNCH_SCALE - (PUNCH_SCALE - 1) * easeOut(prog);
        turret.group.scale.set(s, s, s);
        turret.group.position.y = baseY;
        if (turret.punchT >= PUNCH_DURATION) {
          turret.punchActive = false;
          turret.group.scale.set(1, 1, 1);
        }
      } else {
        turret.group.position.y = baseY + bounce;
      }

      // ── Barrel recoil ─────────────────────────────────────────────────────
      if (turret.recoilActive) {
        turret.recoilT += dt;
        const prog = Math.min(1, turret.recoilT / RECOIL_DURATION);
        // First half: kick back; second half: spring return.
        const kick = prog < 0.5
          ? prog * 2 * RECOIL_ANGLE
          : (1 - (prog - 0.5) * 2) * RECOIL_ANGLE;
        turret.barrelGroup.rotation.z = -kick;  // rotate barrel back (negative Z)
        if (turret.recoilT >= RECOIL_DURATION) {
          turret.recoilActive = false;
          turret.barrelGroup.rotation.z = 0;
        }
      }

      // ── Tip glow ─────────────────────────────────────────────────────
      turret.tipGlowT = Math.min(turret.tipGlowT + dt, 0.30);
      const glowFrac  = Math.max(0, 1 - turret.tipGlowT / 0.22);
      turret.muzzleMat.emissiveIntensity = TIP_GLOW_PEAK * glowFrac;
      turret.muzzleMat.opacity           = 0.3 + 0.7 * glowFrac;
    }
  }

  // ── Damage number sprites ────────────────────────────────────────────────────
  // Builds a canvas-texture THREE.Sprite showing the damage value.
  // Sprites are on layer 1 so they render in the shooter viewport alongside turrets.
  _makeNumberSprite(damage, hexColor, z) {
    const W = 64, H = 32;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx    = canvas.getContext('2d');
    const mat    = new THREE.SpriteMaterial({ map: null, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.10, 0.52, 1);   // world units → ~34×16 px at viewport scale
    sprite.layers.set(1);
    const obj = { sprite, mat, canvas, ctx, lastDamage: -1, lastColor: -1 };
    this._refreshNumberSprite(obj, damage, hexColor);
    return obj;
  }

  _refreshNumberSprite(obj, damage, hexColor) {
    if (obj.lastDamage === damage && obj.lastColor === hexColor) return;
    obj.lastDamage = damage;
    obj.lastColor  = hexColor;
    const { canvas, ctx, mat } = obj;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const r = ((hexColor >> 16) & 0xff).toString(16).padStart(2,'0');
    const g = ((hexColor >>  8) & 0xff).toString(16).padStart(2,'0');
    const b = ( hexColor        & 0xff).toString(16).padStart(2,'0');
    ctx.fillStyle = `#${r}${g}${b}`;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(3, 3, W-6, H-6, 7);
    else               ctx.rect(3, 3, W-6, H-6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth   = 2.5;
    ctx.stroke();
    ctx.font         = `bold ${H - 6}px Arial`;
    ctx.fillStyle    = '#ffffff';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur   = 4;
    ctx.fillText(String(damage), W / 2, H / 2);
    if (mat.map) mat.map.dispose();
    mat.map = new THREE.CanvasTexture(canvas);
    // Do NOT set mat.needsUpdate=true — causes a full shader recompile each time,
    // which is the primary source of gameplay freeze on mobile.
  }

  dispose() {
    for (const t of this._turrets) {
      // Clean up main number sprite.
      t.numSprite0?.mat?.map?.dispose();
      t.numSprite0?.mat?.dispose();
      this._scene.remove(t.numSprite0?.sprite);
      // Clean up queue slots and their number sprites.
      for (const slot of [t.slot1, t.slot2, t.slot3]) {
        slot.numSprite?.mat?.map?.dispose();
        slot.numSprite?.mat?.dispose();
        this._scene.remove(slot.numSprite?.sprite);
        slot.group.traverse(obj => {
          if (obj.geometry && obj.geometry !== _trackGeo && obj.geometry !== _barrelGeo &&
              obj.geometry !== _muzzleGeo) obj.geometry.dispose();
          if (obj.material && obj.material !== _trackMat) obj.material.dispose();
        });
        this._scene.remove(slot.group);
      }
      t.group.traverse(obj => {
        // Skip module-level shared geometries and base material.
        const isSharedGeo = obj.geometry &&
          (obj.geometry === _trackGeo || obj.geometry === _barrelGeo ||
           obj.geometry === _muzzleGeo);
        if (!isSharedGeo && obj.geometry) obj.geometry.dispose();

        if (obj.material && obj.material !== _trackMat) obj.material.dispose();
      });
      this._scene.remove(t.group);
    }
    // Null out module-level cache so sharedGeo() recreates on next Shooter3D instance.
    _trackGeo = _barrelGeo = _muzzleGeo = _trackMat = null;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _createTurret(laneIdx) {
    const group = new THREE.Group();
    group.position.set(laneToX(laneIdx), TURRET_Y, TURRET_Z);

    // Track base (dark cylinder).
    const track = new THREE.Mesh(_trackGeo, _trackMat);
    track.position.y = 0;
    group.add(track);

    // Barrel group (for recoil rotation).
    const barrelGroup = new THREE.Group();
    barrelGroup.position.y = TRACK_H / 2;  // sits on top of track
    group.add(barrelGroup);

    // Barrel (tapered cone, colored).
    const barrelMat = new THREE.MeshStandardMaterial({
      color:     0x888888,
      metalness: 0.5,
      roughness: 0.4,
    });
    const barrel = new THREE.Mesh(_barrelGeo, barrelMat);
    barrel.castShadow = true;
    barrel.position.y = BARREL_H / 2;  // cone centre at half height
    barrelGroup.add(barrel);

    // Muzzle cap (dark sphere at barrel tip).
    const muzzleMat = new THREE.MeshStandardMaterial({
      color:             0x111111,
      emissive:          0x333333,
      emissiveIntensity: 0,
      transparent:       true,
      opacity:           0.85,
    });
    const muzzle = new THREE.Mesh(_muzzleGeo, muzzleMat);
    muzzle.position.y = BARREL_H - MUZZLE_R;  // sits at barrel tip
    barrelGroup.add(muzzle);

    this._scene.add(group);

    // Damage number sprite — follows main turret, always above body.
    const numSprite0 = this._makeNumberSprite(1, 0x888888, TURRET_Z);
    numSprite0.sprite.position.set(laneToX(laneIdx), TURRET_Y + 0.45, TURRET_Z);
    this._scene.add(numSprite0.sprite);

    // ── Queue slots (2nd, 3rd, 4th shooter) — all same size as main ──────
    const slot1 = this._createQueueSlot(laneIdx, SLOT1_Z, SLOT_SCALE);
    const slot2 = this._createQueueSlot(laneIdx, SLOT2_Z, SLOT_SCALE);
    const slot3 = this._createQueueSlot(laneIdx, SLOT3_Z, SLOT_SCALE);

    // Layer 1: only visible to the shooter viewport camera (not the road camera).
    group.traverse(obj => obj.layers.set(1));
    slot1.group.traverse(obj => obj.layers.set(1));
    slot2.group.traverse(obj => obj.layers.set(1));
    slot3.group.traverse(obj => obj.layers.set(1));

    return {
      group, barrelGroup, barrelMat, muzzleMat,
      numSprite0, slot1, slot2, slot3,
      lastColor:   -1,
      punchActive: false,
      punchT:      0,
      recoilActive: false,
      recoilT:      0,
      tipGlowT:     0.30,   // starts fully decayed (no glow at spawn)
    };
  }

  // Create a simplified queue-slot cannon (track + barrel only).
  _createQueueSlot(laneIdx, worldZ, scale) {
    const group = new THREE.Group();
    // Top-down view: queue stacks in Z (depth); Y same as main turret.
    group.position.set(laneToX(laneIdx), TURRET_Y, worldZ);
    group.scale.set(scale, scale, scale);

    // Track base.
    const track = new THREE.Mesh(_trackGeo, _trackMat);
    track.position.y = 0;
    group.add(track);

    // Barrel (simplified, no recoil group needed for queue slots).
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0x888888, metalness: 0.5, roughness: 0.4, transparent: true, opacity: scale,
    });
    const barrel = new THREE.Mesh(_barrelGeo, barrelMat);
    barrel.position.y = TRACK_H / 2 + BARREL_H / 2;
    group.add(barrel);

    // Muzzle.
    const muzzleMat = new THREE.MeshStandardMaterial({
      color: 0x111111, transparent: true, opacity: scale,
    });
    const muzzle = new THREE.Mesh(_muzzleGeo, muzzleMat);
    muzzle.position.y = TRACK_H / 2 + BARREL_H - MUZZLE_R;
    group.add(muzzle);

    this._scene.add(group);
    // Number sprite for this queue slot.
    const numSprite = this._makeNumberSprite(1, 0x888888, worldZ);
    numSprite.sprite.position.set(laneToX(laneIdx), TURRET_Y + 0.45, worldZ);
    this._scene.add(numSprite.sprite);
    return { group, barrelMat, lastColor: -1, numSprite };
  }
}
