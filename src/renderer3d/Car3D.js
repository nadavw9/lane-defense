// Car3D — manages all live car meshes in the 3D road scene.
// small/big/jeep/truck/bigrig → Kenney Car Kit GLB models (CC0).
// tank → procedural geometry (no Kenney 3D tank exists; the kit is 2D sprites only).
// HP darkening, damage state, death animation all preserved.

import * as THREE from 'three';
import { posToZ, laneToX } from './Scene3D.js';
import { assetLoader } from './AssetLoader.js';

// Uniform scale applied to each loaded GLB model
const TYPE_SCALES = {
  small:  0.70,
  big:    0.90,
  jeep:   1.00,
  truck:  1.10,
  bigrig: 1.25,
  boss:   1.35,
};

const CAR_Y       = 0;     // GLB wheel bottoms sit at y = 0
const CAR_Y_TANK  = 0.43;  // procedural tank group Y so tracks touch road
const HL_Y        = 0.5;   // approximate headlight height for GLB cars

// Coordinate constants for the procedural tank builder (ported from brand-cars.html)
const SX = 1.74;           // X scale: design space → game width
const OY = -CAR_Y_TANK;   // Y offset aligns tank geometry to road surface
const DEATH_DURATION  = 0.30;
const DEATH_SCALE_MAX = 1.40;
const DEATH_VY        = 2.5;
const LERP_DURATION   = 0.45;
const MAX_TILT_X      = 0.20;
const TURRET_ROT_SPEED = 0.18;
const WHEEL_SPIN      = 3.5;    // radians per world unit (approx 1/wheelRadius)

const COLOR_HEX = {
  Red:    0xE24B4A,
  Blue:   0x378ADD,
  Green:  0x639922,
  Yellow: 0xEF9F27,
  Purple: 0x7F77DD,
  Orange: 0xD85A30,
  Boss:   0xcc44cc,
};

function carHex(car) {
  return COLOR_HEX[car.color] ?? (car.type === 'boss' ? COLOR_HEX.Boss : 0x888888);
}

// Returns true if a material should be EXCLUDED from color tinting.
// Wheels/tires, glass, headlights/taillights, chrome/trim, tank tracks/hatch keep their own colors.
function _isExcludedMaterial(mat) {
  if (!mat?.isMaterial) return true;
  return /wheel|tire|tyre|glass|window|windshield|chrome|rim|track|tread|hatch|light|lamp|lens/i.test(mat.name);
}

// Convert a hex color to a vibrant jewel tone: S→1.0, L clamped to 0.45–0.55.
function _boostColor(hex) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  hsl.s = 1.0;
  hsl.l = Math.max(0.45, Math.min(0.55, hsl.l));
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return (Math.round(c.r * 255) << 16) | (Math.round(c.g * 255) << 8) | Math.round(c.b * 255);
}

// ── Material helpers for procedural tank ──────────────────────────────────────

function _paintMat(hex) {
  return new THREE.MeshStandardMaterial({
    color: hex, metalness: 0.08, roughness: 0.30, transparent: true, opacity: 1,
    emissive: new THREE.Color(hex), emissiveIntensity: 0.28,
  });
}
function _darkMat(hex = 0x1a1a1a) {
  return new THREE.MeshStandardMaterial({ color: hex, metalness: 0.20, roughness: 0.80, transparent: true, opacity: 1 });
}
function _tireMat() { return _darkMat(0x111114); }

// ── Shared geos that are never disposed ────────────────────────────────────────

let _bossTorusGeo = null;

// ── Car3D class ────────────────────────────────────────────────────────────────

export class Car3D {
  constructor(scene, lanes) {
    this._scene = scene;
    this._lanes = lanes;
    this._live  = new Map();
    this._dying = [];
    if (!_bossTorusGeo) _bossTorusGeo = new THREE.TorusGeometry(1.4, 0.06, 8, 28);
  }

  clearAll() {
    for (const entry of this._live.values()) this._disposeEntry(entry);
    this._live.clear();
    for (const d of this._dying) this._disposeDying(d);
    this._dying.length = 0;
  }

  update(dt, isFrozen = false) {
    const liveCars = new Set();
    for (const lane of this._lanes) for (const car of lane.cars) liveCars.add(car);

    for (const [car, entry] of this._live) {
      if (!liveCars.has(car)) {
        this._dying.push({
          group: entry.group,
          bossRing: entry.bossRing, bossRingMat: entry.bossRingMat,
          t: 0,
        });
        this._live.delete(car);
      }
    }

    for (let laneIdx = 0; laneIdx < this._lanes.length; laneIdx++) {
      for (const car of this._lanes[laneIdx].cars) {
        if (!this._live.has(car)) this._live.set(car, this._createEntry(car, laneIdx));

        const entry = this._live.get(car);
        const g     = entry.group;

        // Render-side position lerp
        const newTargetZ = posToZ(car.position);
        if (Math.abs(newTargetZ - entry.targetZ) > 0.001) {
          entry.lerpStartZ = entry.renderZ;
          entry.targetZ    = newTargetZ;
          entry.lerpT      = 0;
        }
        if (entry.lerpT < 1) {
          entry.lerpT   = Math.min(1, entry.lerpT + dt / LERP_DURATION);
          const eased   = 1 - Math.pow(1 - entry.lerpT, 3);
          entry.renderZ = entry.lerpStartZ + (entry.targetZ - entry.lerpStartZ) * eased;
          g.rotation.x  = -MAX_TILT_X * Math.sin(Math.PI * entry.lerpT);
        } else {
          entry.renderZ = entry.targetZ;
          g.rotation.x  = 0;
        }
        g.position.set(laneToX(laneIdx), entry.groupY, entry.renderZ);

        // Wheel spin
        const dZ = entry.renderZ - entry.lastRenderZ;
        if (Math.abs(dZ) > 0.0001) {
          for (const w of entry.wheels) w.rotation.x -= dZ * WHEEL_SPIN;
        }
        entry.lastRenderZ = entry.renderZ;

        // Boss ring orbit
        if (entry.bossRing) {
          entry.bossAngle += dt * 1.8;
          const gp = g.position;
          entry.bossRing.position.set(gp.x, gp.y + 0.5, gp.z);
          entry.bossRing.rotation.y = entry.bossAngle;
          entry.bossRing.rotation.x = 0.35;
          entry.bossRingMat.emissiveIntensity = 1.2 + 0.6 * Math.sin(entry.bossAngle * 3);
        }

        // Tank turret rotation
        if (entry.turretGroup) entry.turretGroup.rotation.y += dt * TURRET_ROT_SPEED;

        const hpRatio = car.maxHp > 0 ? car.hp / car.maxHp : 0;

        // Damage visual state
        if (isFrozen) {
          if (!entry._prevFrozen) {
            // First freeze frame: tint all body materials 40% toward ice blue
            const ICE_R = 0xAA / 255, ICE_G = 0xDD / 255, ICE_B = 0xFF / 255;
            for (let mi = 0; mi < entry.colorMats.length; mi++) {
              const base = entry.colorBaseHexes[mi];
              const br = ((base >> 16) & 0xff) / 255;
              const bg = ((base >>  8) & 0xff) / 255;
              const bb = ( base        & 0xff) / 255;
              entry.colorMats[mi].color.setRGB(
                br * 0.6 + ICE_R * 0.4,
                bg * 0.6 + ICE_G * 0.4,
                bb * 0.6 + ICE_B * 0.4,
              );
            }
            entry._prevFrozen = true;
          }
          entry.bodyMat.emissive.setHex(0xAADDFF);
          entry.bodyMat.emissiveIntensity = 0.35;
          g.rotation.z = 0;
          for (const hl of entry.headLights) hl.intensity = 0.30;
        } else {
          if (entry._prevFrozen) {
            // Unfreeze: restore original vivid colors
            for (let mi = 0; mi < entry.colorMats.length; mi++) {
              entry.colorMats[mi].color.setHex(entry.colorBaseHexes[mi]);
            }
            entry._prevFrozen = false;
          }
        }
        if (!isFrozen) {
          if (hpRatio < 0.35) {
            entry.bodyMat.emissive.setHex(0xff3300);
            entry.bodyMat.emissiveIntensity = 0.25;
            g.rotation.z = -0.10 * (1 - hpRatio);
            for (const hl of entry.headLights) hl.intensity = 0.10;
          } else if (hpRatio < 0.65) {
            entry.bodyMat.emissive.setHex(0xff7700);
            entry.bodyMat.emissiveIntensity = 0.15;
            g.rotation.z = -0.04 * (1 - hpRatio);
            for (const hl of entry.headLights) hl.intensity = 0.15;
          } else {
            entry.bodyMat.emissive.setHex(entry.colorBaseHexes[0] ?? 0x000000);
            entry.bodyMat.emissiveIntensity = 0.28;
            g.rotation.z = 0;
            for (const hl of entry.headLights) hl.intensity = 0.30;
          }
        }

        // HP tracking (no darkening — cars keep vivid color at all damage levels)
        if (car.hp !== entry.lastHp) {
          entry.lastHp = car.hp;
        }
      }
    }

    // Death animations
    for (let i = this._dying.length - 1; i >= 0; i--) {
      const d = this._dying[i];
      d.t += dt;
      if (d.t >= DEATH_DURATION) { this._disposeDying(d); this._dying.splice(i, 1); continue; }
      const prog  = d.t / DEATH_DURATION;
      const scale = 1 + (DEATH_SCALE_MAX - 1) * prog;
      d.group.scale.set(scale, scale, scale);
      d.group.position.y += DEATH_VY * dt;
      d.group.traverse(child => { if (child.material) child.material.opacity = 1 - prog; });
    }
  }

  // ── Entry creation ─────────────────────────────────────────────────────────────

  _createEntry(car, laneIdx) {
    const hex        = carHex(car);
    const colorMats  = [];
    const colorBaseHexes = [];

    let group, bodyMat, turretGroup = null, wheels = [], headLights = [];

    if (car.type === 'tank') {
      // ── Tank: procedural builder (Kenney has no 3D tank GLB) ─────────────────
      const boostedHex = _boostColor(hex);
      group = new THREE.Group();
      const result = this._buildTank(group, boostedHex, colorMats, colorBaseHexes);
      bodyMat      = result.bodyMat;
      bodyMat.emissive.setHex(boostedHex);
      bodyMat.emissiveIntensity = 0.28;
      turretGroup  = result.turretGroup;
      if (group.userData.tankPtLight) headLights.push(group.userData.tankPtLight);

    } else {
      // ── All other types: Kenney Car Kit GLB ───────────────────────────────────
      group = assetLoader.getModel(car.type);
      group.scale.setScalar(TYPE_SCALES[car.type] ?? 1.0);

      // Ensure all materials support transparency (needed for death fade + damage)
      group.traverse(node => {
        if (!node.isMesh) return;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        for (const m of mats) { m.transparent = true; m.opacity = 1; }
      });

      // Tint ALL non-excluded materials aggressively to the lane's boosted color
      const boostedHex = _boostColor(hex);
      group.traverse(node => {
        if (!node.isMesh) return;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        for (const mat of mats) {
          if (_isExcludedMaterial(mat)) continue;
          mat.color.setHex(boostedHex);
          mat.emissive.setHex(boostedHex);
          mat.emissiveIntensity = 0.28;
          mat.roughness = 0.30;
          mat.metalness = 0.08;
          if (!bodyMat) bodyMat = mat;
          colorMats.push(mat);
          colorBaseHexes.push(boostedHex);
        }
      });

      // Fallback: if no body material detected, create one manually
      if (!bodyMat) {
        bodyMat = new THREE.MeshStandardMaterial({ color: boostedHex, transparent: true, opacity: 1, roughness: 0.30, metalness: 0.08 });
        bodyMat.emissive.setHex(boostedHex);
        bodyMat.emissiveIntensity = 0.28;
        colorMats.push(bodyMat);
        colorBaseHexes.push(boostedHex);
      }

      // Find wheels by mesh name for spin animation
      group.traverse(node => {
        if (node.isMesh && /wheel|tire|tyre/i.test(node.name)) wheels.push(node);
      });

      // Headlight point light at front of car
      const ptLight = new THREE.PointLight(0xffffaa, car.type === 'boss' ? 0.80 : 0.30, 4);
      ptLight.position.set(0, HL_Y, 1.2);
      group.add(ptLight);
      headLights.push(ptLight);
    }

    const metalness = 0.08;
    for (const mat of colorMats) {
      if (mat.metalness !== undefined) mat.metalness = metalness;
    }

    // Boss ring
    let bossRing = null, bossRingMat = null;
    if (car.type === 'boss') {
      bossRingMat = new THREE.MeshStandardMaterial({
        color: hex, emissive: hex, emissiveIntensity: 1.5,
        transparent: true, opacity: 0.75,
      });
      bossRing = new THREE.Mesh(_bossTorusGeo, bossRingMat);
      this._scene.add(bossRing);
    }

    const groupY = car.type === 'tank' ? CAR_Y_TANK : CAR_Y;
    group.position.set(laneToX(laneIdx), groupY, posToZ(car.position));
    this._scene.add(group);

    const startZ = posToZ(car.position);
    const entry = {
      group, bodyMat, colorMats, colorBaseHexes,
      headLights,
      wheels, turretGroup, lastRenderZ: startZ,
      lastHp: -1, _prevFrozen: false,
      laneIdx, bossRing, bossRingMat, bossAngle: 0,
      groupY,
      renderZ: startZ, targetZ: startZ, lerpStartZ: startZ, lerpT: 1.0,
    };
    return entry;
  }

  // ── Procedural tank builder ────────────────────────────────────────────────────
  // Used because Kenney's "Tanks" pack is 2D-sprite-only (no GLB available).
  // Hull sits at y = CAR_Y_TANK so the group is positioned the same way as legacy cars.

  _buildTank(group, hex, colorMats, colorBaseHexes) {
    const w = 1.55 * SX, l = 2.8;
    const bm = _paintMat(hex);
    const dm = _darkMat(0x3a3a3a);
    const tm = _tireMat();
    const camoMat = new THREE.MeshStandardMaterial({ color: 0x6a7a3a, roughness: 0.85, transparent: true, opacity: 1 });
    colorMats.push(bm); colorBaseHexes.push(hex);

    const hull = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, l - 0.4), bm);
    hull.position.set(0, 0.55 + OY, 0); hull.castShadow = hull.receiveShadow = true; group.add(hull);

    const front = new THREE.Mesh(new THREE.BoxGeometry(w, 0.30, 0.5), dm);
    front.position.set(0, 0.48 + OY, l / 2 - 0.25); front.rotation.x = -0.25; group.add(front);

    for (const [x, y, z, h, xs, zs] of [
      [ 0.4 * SX, 0.85 + OY,  0.3, 0.08, 0.5 * SX, 0.4],
      [-0.5 * SX, 0.85 + OY, -0.4, 0.10, 0.4 * SX, 0.5],
      [ 0.0,      0.85 + OY, -0.9, 0.06, 0.6 * SX, 0.3],
    ]) {
      const patch = new THREE.Mesh(new THREE.BoxGeometry(xs, h, zs), camoMat);
      patch.position.set(x, y, z); group.add(patch);
    }

    for (const s of [-1, 1]) {
      const trackBase = new THREE.Mesh(new THREE.BoxGeometry(0.28 * SX, 0.36, l), dm);
      trackBase.position.set(s * (w / 2 + 0.04 * SX), 0.22 + OY, 0); group.add(trackBase);
      for (let i = 0; i < 9; i++) {
        const tread = new THREE.Mesh(new THREE.BoxGeometry(0.32 * SX, 0.06, 0.12), tm);
        tread.position.set(s * (w / 2 + 0.04 * SX), 0.42 + OY, -l / 2 + 0.2 + i * (l - 0.4) / 8);
        group.add(tread);
      }
      for (let i = 0; i < 5; i++) {
        const rw = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.10, 12), tm);
        rw.rotation.z = Math.PI / 2;
        rw.position.set(s * (w / 2 + 0.04 * SX), 0.18 + OY, -l / 2 + 0.32 + i * (l - 0.6) / 4);
        group.add(rw);
      }
    }

    const turretGroup = new THREE.Group();
    const turretBody  = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * SX, 0.65 * SX, 0.42, 12), bm);
    turretBody.position.y = 0.21; turretGroup.add(turretBody);
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.10, 12), dm);
    hatch.position.y = 0.47; turretGroup.add(hatch);
    const breech = new THREE.Mesh(new THREE.BoxGeometry(0.22 * SX, 0.22, 0.4), dm);
    breech.position.set(0, 0.21, 0.45); turretGroup.add(breech);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 1.4, 12), dm);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.21, 1.25); turretGroup.add(barrel);
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.10, 0.18, 12), dm);
    muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, 0.21, 1.95); turretGroup.add(muzzle);
    turretGroup.position.set(0, 0.85 + OY, -0.1);
    group.add(turretGroup);

    const R = 0.18 * SX, r = 0.075 * SX;
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? R : r;
      const a   = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      if (i === 0) starShape.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else         starShape.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    starShape.closePath();
    const star = new THREE.Mesh(new THREE.ShapeGeometry(starShape),
      new THREE.MeshStandardMaterial({ color: 0xf0f0e0, transparent: true, opacity: 1 }));
    star.rotation.x = -Math.PI / 2;
    star.position.set(0, 1.31 + OY, -0.2);
    group.add(star);

    const ptLight = new THREE.PointLight(0xffffaa, 0.30, 4);
    ptLight.position.set(0, 0.60 + OY, l / 2 + 0.2); group.add(ptLight);
    group.userData.tankPtLight = ptLight;

    return { bodyMat: bm, turretGroup };
  }

  // ── Disposal ───────────────────────────────────────────────────────────────────

  _disposeDying(d) {
    this._disposeGroup(d.group);
    if (d.bossRing) { d.bossRingMat?.dispose(); this._scene.remove(d.bossRing); }
  }

  _disposeEntry(entry) {
    this._disposeGroup(entry.group);
    if (entry.bossRing) { entry.bossRingMat?.dispose(); this._scene.remove(entry.bossRing); }
  }

  _disposeGroup(group) {
    const isTankGroup = !!group.userData.tankPtLight;
    group.traverse(obj => {
      // GLB geometries are shared across clones — do not dispose them.
      // Procedural tank geometries are unique per instance — safe to dispose.
      if (isTankGroup && obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    });
    this._scene.remove(group);
  }
}
