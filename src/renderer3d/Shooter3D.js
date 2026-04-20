// Shooter3D — 3D turret columns positioned at the near road edge.
//
// Renders one turret per column (the "top" shooter) as a 3D mesh.
// The existing PixiJS ShooterRenderer keeps handling all 2D UI, drag-drop,
// and stacked shooter display in the screen-bottom panel.  Shooter3D adds
// visual 3D turrets that appear AT the breach line so shots visually
// originate from a physical object on the road.
//
// Each turret group:
//   • Base disc  — flat CylinderGeometry, dark
//   • Body       — BoxGeometry, shooter colour
//   • Barrel     — CylinderGeometry, pointing toward road (+Z direction = away from camera)
//   • Emissive ring — TorusGeometry around base, colour-matched glow
//
// Animations:
//   • Idle bounce  — gentle Y oscillation (±0.06 units at 2.4 Hz)
//   • Deploy punch — scale 1.30 → 1.0 over 0.15 s (triggered by GameApp)
//   • Fire state   — barrel extends slightly forward; emissive ring brightens

import * as THREE from 'three';
import { laneToX, ROAD_Z_NEAR } from './Scene3D.js';

// ── Turret dimensions ─────────────────────────────────────────────────────────
const BASE_R     = 0.55;
const BASE_H     = 0.08;
const BODY_W     = 0.70;
const BODY_H     = 0.55;
const BODY_D     = 0.70;
const BARREL_R   = 0.12;
const BARREL_H   = 1.00;   // extends toward road (toward -Z from turret)
const TORUS_R    = 0.52;   // ring radius
const TORUS_TUBE = 0.04;

// Turret world position for the shooter viewport camera.
// Camera at (0, 0.5, 8) looks at (0, 0.5, 0).
// Turrets at Z=0 appear at the camera's focus point — fills the viewport well.
const TURRET_Z = 0.0;
const TURRET_Y = BASE_H + BODY_H / 2;

// Barrel tip offset from body centre (points in +Z direction = toward road/camera).
// We rotate the barrel so it points in -Z (toward far road), i.e., up toward cars.
const BARREL_OFFSET_Z = -BARREL_H / 2 - BODY_D / 2;

// Idle bounce
const BOUNCE_AMP   = 0.06;
const BOUNCE_SPEED = 2.4;   // rad/s

// Deploy punch
const PUNCH_DURATION = 0.15;
const PUNCH_SCALE    = 1.30;

// Barrel recoil
const RECOIL_BACK    =  0.18;   // how far barrel kicks back (world units)
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
let _baseGeo   = null;
let _bodyGeo   = null;
let _barrelGeo = null;
let _torusGeo  = null;
let _tipGeo    = null;   // small sphere for barrel-tip glow
let _baseMat   = null;

function sharedGeo() {
  if (!_baseGeo) {
    _baseGeo   = new THREE.CylinderGeometry(BASE_R, BASE_R, BASE_H, 16);
    _bodyGeo   = new THREE.BoxGeometry(BODY_W, BODY_H, BODY_D);
    _barrelGeo = new THREE.CylinderGeometry(BARREL_R, BARREL_R * 0.85, BARREL_H, 10);
    _torusGeo  = new THREE.TorusGeometry(TORUS_R, TORUS_TUBE, 8, 24);
    _tipGeo    = new THREE.SphereGeometry(TIP_GEO_R, 8, 6);
    _baseMat   = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.8, metalness: 0.2 });
  }
}

export class Shooter3D {
  constructor(scene, columns) {
    this._scene   = scene;
    this._columns = columns;

    sharedGeo();

    // Per-column state: { group, bodyMat, ringMat, punchState }
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
        // No shooter in column — hide turret.
        turret.group.visible = false;
        continue;
      }

      turret.group.visible = true;

      // Update colour when shooter changes.
      const hex = COLOR_HEX[top.color] ?? 0x888888;
      if (turret.lastColor !== hex) {
        turret.lastColor = hex;
        turret.bodyMat.color.setHex(hex);
        turret.ringMat.color.setHex(hex);
        turret.ringMat.emissive.setHex(hex);
        turret.barrelMat.color.setHex(hex);
        turret.tipGlowMat.color.setHex(hex);
        turret.tipGlowMat.emissive.setHex(hex);
      }

      // Idle bounce (Y).
      const baseY = TURRET_Y;

      // ── Deploy punch ─────────────────────────────────────────────────────
      if (turret.punchActive) {
        turret.punchT += dt;
        const prog = Math.min(1, turret.punchT / PUNCH_DURATION);
        const s    = PUNCH_SCALE - (PUNCH_SCALE - 1) * easeOut(prog);
        turret.group.scale.set(s, s, s);
        turret.group.position.y = baseY;
        turret.ringMat.emissiveIntensity = 1.8 * (1 - prog);
        if (turret.punchT >= PUNCH_DURATION) {
          turret.punchActive = false;
          turret.group.scale.set(1, 1, 1);
          turret.ringMat.emissiveIntensity = 0.5;
        }
      } else {
        turret.group.position.y = baseY + bounce;
        turret.ringMat.emissiveIntensity = 0.5;
      }

      // ── Barrel recoil ─────────────────────────────────────────────────────
      if (turret.recoilActive) {
        turret.recoilT += dt;
        const prog = Math.min(1, turret.recoilT / RECOIL_DURATION);
        // First half: kick back; second half: spring return.
        const kick = prog < 0.5
          ? prog * 2 * RECOIL_BACK
          : (1 - (prog - 0.5) * 2) * RECOIL_BACK;
        turret.barrel.position.z = BARREL_OFFSET_Z + kick;
        if (turret.recoilT >= RECOIL_DURATION) {
          turret.recoilActive = false;
          turret.barrel.position.z = BARREL_OFFSET_Z;
        }
      }

      // ── Tip glow ─────────────────────────────────────────────────────────
      turret.tipGlowT = Math.min(turret.tipGlowT + dt, 0.30);
      const glowFrac  = Math.max(0, 1 - turret.tipGlowT / 0.22);
      turret.tipGlowMat.emissiveIntensity = TIP_GLOW_PEAK * glowFrac;
      turret.tipGlowMat.opacity           = 0.3 + 0.7 * glowFrac;
    }
  }

  dispose() {
    for (const t of this._turrets) {
      t.group.traverse(obj => {
        // Skip module-level shared geometries and base material.
        const isSharedGeo = obj.geometry &&
          (obj.geometry === _baseGeo || obj.geometry === _bodyGeo ||
           obj.geometry === _barrelGeo || obj.geometry === _torusGeo ||
           obj.geometry === _tipGeo);
        if (!isSharedGeo && obj.geometry) obj.geometry.dispose();

        if (obj.material && obj.material !== _baseMat) obj.material.dispose();
      });
      this._scene.remove(t.group);
    }
    // Null out module-level cache so sharedGeo() recreates on next Shooter3D instance.
    _baseGeo = _bodyGeo = _barrelGeo = _torusGeo = _tipGeo = _baseMat = null;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _createTurret(laneIdx) {
    const group = new THREE.Group();
    group.position.set(laneToX(laneIdx), TURRET_Y, TURRET_Z);

    // Base disc.
    const base = new THREE.Mesh(_baseGeo, _baseMat);
    base.position.y = -(BODY_H / 2);
    group.add(base);

    // Body.
    const bodyMat = new THREE.MeshStandardMaterial({
      color:     0x888888,
      metalness: 0.5,
      roughness: 0.4,
    });
    const body = new THREE.Mesh(_bodyGeo, bodyMat);
    body.castShadow = true;
    group.add(body);

    // Barrel — points in -Z direction (toward far road).
    const barrelMat = new THREE.MeshStandardMaterial({
      color:     0x888888,
      metalness: 0.6,
      roughness: 0.35,
    });
    const barrel = new THREE.Mesh(_barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = BARREL_OFFSET_Z;
    barrel.castShadow = true;
    group.add(barrel);

    // Barrel tip glow — emissive sphere at muzzle, brightens on fire.
    const tipGlowMat = new THREE.MeshStandardMaterial({
      color:             0xffffff,
      emissive:          0xffffff,
      emissiveIntensity: 0,
      transparent:       true,
      opacity:           0.3,
    });
    const tipGlow = new THREE.Mesh(_tipGeo, tipGlowMat);
    tipGlow.position.z = BARREL_OFFSET_Z - BARREL_H / 2;
    group.add(tipGlow);

    // Emissive ring at base.
    const ringMat = new THREE.MeshStandardMaterial({
      color:             0x888888,
      emissive:          0x888888,
      emissiveIntensity: 0.5,
      roughness:         0.5,
    });
    const ring = new THREE.Mesh(_torusGeo, ringMat);
    ring.position.y = -(BODY_H / 2);
    group.add(ring);

    this._scene.add(group);

    // Layer 1: only visible to the shooter viewport camera (not the road camera).
    group.traverse(obj => obj.layers.set(1));

    return {
      group, bodyMat, ringMat, barrelMat, barrel, tipGlowMat,
      lastColor:   -1,
      punchActive: false,
      punchT:      0,
      recoilActive: false,
      recoilT:      0,
      tipGlowT:     0.30,   // starts fully decayed (no glow at spawn)
    };
  }
}
