// Projectile3D — 3D shots with ribbon trails and muzzle cone flashes.
//
// Each shot:
//   • Emissive sphere (SphereGeometry, shooter colour)
//   • PointLight traveling with sphere
//   • Ribbon trail  — LINE_TRAIL_LEN positions tracked; drawn as a
//     THREE.Line with vertex colours fading from bright → transparent
//   • Muzzle cone   — brief ConeGeometry at barrel tip; fades in 0.12 s
//
// Muzzle cones: spawned when a slot first activates; stored separately
// from the in-flight projectile so they can die independently.

import * as THREE from 'three';
import { posToZ, laneToX, ROAD_Z_FAR } from './Scene3D.js';

const PROJ_LIFE  = 0.14;
const PROJ_SPEED = 280;
const PROJ_R     = 0.10;
const PROJ_Y     = 0.35;

// Trail settings
const TRAIL_LEN   = 14;    // number of trail segments
const TRAIL_WIDTH = 0.06;  // trail half-width for wide-line effect (visual only via scale)

// Muzzle cone (appears at shooter barrel tip)
const CONE_LIFE    = 0.12;
const CONE_R_BASE  = 0.28;
const CONE_HEIGHT  = 0.75;
// Muzzle spawns at ~Z=0 (breach line) – BARREL_OFFSET_Z from Shooter3D
const MUZZLE_Z_OFFSET = -0.55;  // world Z of barrel tip (TURRET_Z + BARREL_OFFSET_Z)
const MUZZLE_Y         = 0.82;  // world Y of barrel tip

const COLOR_HEX = {
  Red:    0xE24B4A,
  Blue:   0x378ADD,
  Green:  0x639922,
  Yellow: 0xEF9F27,
  Purple: 0x7F77DD,
  Orange: 0xD85A30,
};

// Shared cone geometry (all muzzle cones reuse it).
let _coneGeo = null;
function getConeGeo() {
  if (!_coneGeo) _coneGeo = new THREE.ConeGeometry(CONE_R_BASE, CONE_HEIGHT, 10, 1, true);
  return _coneGeo;
}

export class Projectile3D {
  constructor(scene, firingSlots, lanes) {
    this._scene       = scene;
    this._firingSlots = firingSlots;
    this._lanes       = lanes;

    this._slotWasActive = new Array(firingSlots.length).fill(false);
    this._projectiles   = [];
    this._cones         = [];  // { mesh, mat, life }

    this._geo = new THREE.SphereGeometry(PROJ_R, 8, 6);
  }

  reset() {
    for (const p of this._projectiles) this._disposeProj(p);
    this._projectiles.length = 0;
    for (const c of this._cones) this._disposeCone(c);
    this._cones.length = 0;
    this._slotWasActive.fill(false);
  }

  update(dt) {
    // ── Detect new shots ────────────────────────────────────────────────────
    for (let i = 0; i < this._firingSlots.length; i++) {
      const slot = this._firingSlots[i];
      if (slot && !this._slotWasActive[i]) {
        this._spawn(i, slot);
        this._spawnMuzzleCone(i, slot);
      }
      this._slotWasActive[i] = !!slot;
    }

    // ── Advance projectiles ─────────────────────────────────────────────────
    for (let i = this._projectiles.length - 1; i >= 0; i--) {
      const p = this._projectiles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this._disposeProj(p);
        this._projectiles.splice(i, 1);
        continue;
      }

      // Move toward target.
      const dir = Math.sign(p.tz - p.z);
      p.z += dir * PROJ_SPEED * dt;
      if (dir < 0 && p.z < p.tz) p.z = p.tz;
      if (dir > 0 && p.z > p.tz) p.z = p.tz;

      p.mesh.position.set(p.x, p.y, p.z);
      p.light.position.set(p.x, p.y + 0.2, p.z);

      const frac = p.life / PROJ_LIFE;
      p.mesh.material.opacity           = frac * 0.92;
      p.mesh.material.emissiveIntensity = frac * 1.8;
      p.light.intensity                 = frac * 1.5;

      // ── Update ribbon trail ─────────────────────────────────────────────
      const pos = p.trail.geometry.attributes.position;
      const col = p.trail.geometry.attributes.color;

      // Shift all segments back one.
      for (let j = TRAIL_LEN - 1; j > 0; j--) {
        pos.setXYZ(j, pos.getX(j - 1), pos.getY(j - 1), pos.getZ(j - 1));
      }
      // Insert current sphere position at head.
      pos.setXYZ(0, p.x, p.y, p.z);

      // Recompute vertex colours: head = bright, tail = black.
      const c = p.color;
      for (let j = 0; j < TRAIL_LEN; j++) {
        const t = 1 - j / (TRAIL_LEN - 1);
        col.setXYZ(j, c.r * t * frac, c.g * t * frac, c.b * t * frac);
      }

      pos.needsUpdate = true;
      col.needsUpdate = true;
    }

    // ── Advance muzzle cones ────────────────────────────────────────────────
    for (let i = this._cones.length - 1; i >= 0; i--) {
      const c = this._cones[i];
      c.life -= dt;
      if (c.life <= 0) {
        this._disposeCone(c);
        this._cones.splice(i, 1);
        continue;
      }
      const frac = c.life / CONE_LIFE;
      c.mat.opacity = frac * 0.65;
      // Scale up along cone axis as it fires (gives "blast" feel).
      const s = 1 + (1 - frac) * 0.5;
      c.mesh.scale.set(1, s, 1);
    }
  }

  dispose() {
    for (const p of this._projectiles) this._disposeProj(p);
    this._projectiles.length = 0;
    for (const c of this._cones) this._disposeCone(c);
    this._cones.length = 0;
    this._geo.dispose();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _spawn(laneIdx, slot) {
    const hex   = COLOR_HEX[slot.shooter.color] ?? 0xffffff;
    const color = new THREE.Color(hex);
    const sx    = laneToX(laneIdx);
    const sz    = 0;

    const frontCar = this._lanes[laneIdx]?.cars[0];
    const tz = frontCar ? posToZ(frontCar.position) : ROAD_Z_FAR;

    // Sphere.
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive:          color,
      emissiveIntensity: 1.8,
      transparent:       true,
      opacity:           0.92,
    });
    const mesh = new THREE.Mesh(this._geo, mat);
    mesh.position.set(sx, PROJ_Y, sz);
    this._scene.add(mesh);

    // Point light.
    const light = new THREE.PointLight(hex, 1.5, 4);
    light.position.set(sx, PROJ_Y + 0.2, sz);
    this._scene.add(light);

    // Trail ribbon (LINE_TRAIL_LEN points initialised at spawn position).
    const positions = new Float32Array(TRAIL_LEN * 3);
    const colors    = new Float32Array(TRAIL_LEN * 3);
    for (let j = 0; j < TRAIL_LEN; j++) {
      positions[j * 3]     = sx;
      positions[j * 3 + 1] = PROJ_Y;
      positions[j * 3 + 2] = sz;
      colors[j * 3]     = 0;
      colors[j * 3 + 1] = 0;
      colors[j * 3 + 2] = 0;
    }
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    trailGeo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));
    const trailMat  = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, linewidth: 1 });
    const trail     = new THREE.Line(trailGeo, trailMat);
    this._scene.add(trail);

    this._projectiles.push({ mesh, light, trail, color, x: sx, y: PROJ_Y, z: sz, tz, life: PROJ_LIFE });
  }

  _spawnMuzzleCone(laneIdx, slot) {
    const hex = COLOR_HEX[slot.shooter.color] ?? 0xffffff;
    const mat = new THREE.MeshBasicMaterial({
      color:       hex,
      transparent: true,
      opacity:     0.65,
      side:        THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(getConeGeo(), mat);
    // Cone's default axis is Y; rotate so it points in -Z (toward road horizon).
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(laneToX(laneIdx), MUZZLE_Y, MUZZLE_Z_OFFSET);
    this._scene.add(mesh);
    this._cones.push({ mesh, mat, life: CONE_LIFE });
  }

  _disposeProj(p) {
    p.mesh.material.dispose();
    p.trail.geometry.dispose();
    p.trail.material.dispose();
    this._scene.remove(p.mesh);
    this._scene.remove(p.light);
    this._scene.remove(p.trail);
  }

  _disposeCone(c) {
    // Shared geometry — do NOT dispose _coneGeo here.
    c.mat.dispose();
    this._scene.remove(c.mesh);
  }
}
