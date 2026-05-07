// Car3D — manages all live car meshes in the 3D road scene.
// small/big/jeep/truck/bigrig → Kenney Car Kit GLB models (CC0).
// tank → procedural geometry (no Kenney 3D tank exists; the kit is 2D sprites only).
// HP sprite, damage darkening, smoke trail, death animation all preserved.

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
const HP_SPRITE_Y     = 2.2;    // world-Y for HP number sprite
const HP_CANVAS_W     = 64;
const HP_CANVAS_H     = 28;
const HP_SPRITE_W     = 0.55;
const HP_SPRITE_H     = 0.24;
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

// Tracks which types have had material names logged (first spawn only, debug).
const _loggedTypes = new Set();

// Returns true if a material looks like painted body surface (for color tinting).
// Explicit exclusions first so wheels/glass/chrome/trim are never tinted.
function _isBodyMaterial(mat) {
  if (!mat?.isMaterial) return false;
  if (/wheel|tire|tyre|glass|window|windshield|chrome|rim|metal|black|grey|gray|light/i.test(mat.name)) return false;
  if (/body|paint|color|main|^_default/i.test(mat.name)) return true;
  if (!mat.name) {
    const hsl = {};
    try { new THREE.Color(mat.color).getHSL(hsl); } catch { return false; }
    return hsl.s > 0.40 && hsl.l > 0.25 && hsl.l < 0.65;
  }
  return false;
}

// ── Material helpers for procedural tank ──────────────────────────────────────

function _paintMat(hex) {
  return new THREE.MeshStandardMaterial({
    color: hex, metalness: 0.42, roughness: 0.48, transparent: true, opacity: 1,
    emissive: new THREE.Color(0x181818), emissiveIntensity: 0.12,
  });
}
function _darkMat(hex = 0x1a1a1a) {
  return new THREE.MeshStandardMaterial({ color: hex, metalness: 0.20, roughness: 0.80, transparent: true, opacity: 1 });
}
function _tireMat() { return _darkMat(0x111114); }

// ── Shared geos that are never disposed ────────────────────────────────────────

let _shadowGeo    = null;
let _bossTorusGeo = null;
function _ensureSharedGeos() {
  if (_shadowGeo) return;
  _shadowGeo    = new THREE.CircleGeometry(1.0, 14);
  _bossTorusGeo = new THREE.TorusGeometry(1.4, 0.06, 8, 28);
}

// ── Car3D class ────────────────────────────────────────────────────────────────

export class Car3D {
  constructor(scene, lanes) {
    this._scene = scene;
    this._lanes = lanes;
    this._live  = new Map();
    this._dying = [];
    _ensureSharedGeos();
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
        if (entry.hpMesh) {
          entry.hpMesh.material.map?.dispose();
          entry.hpMesh.material.dispose();
          this._scene.remove(entry.hpMesh);
        }
        this._dying.push({
          group: entry.group, hpTex: entry.hpTex,
          smokeTex: entry.smokeTex, crackTex: entry.crackTex,
          bossRing: entry.bossRing, bossRingMat: entry.bossRingMat,
          shadowMesh: entry.shadowMesh, shadowMat: entry.shadowMat, t: 0,
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
        if (entry.shadowMesh) entry.shadowMesh.position.set(laneToX(laneIdx), 0.005, entry.renderZ);

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
          entry.bodyMat.emissive.setHex(0x1133aa);
          entry.bodyMat.emissiveIntensity = 0.3;
          g.rotation.z = 0;
          for (const hl of entry.headLights) hl.intensity = 0.30;
          if (entry.smokeMesh) entry.smokeMesh.visible = false;
        } else if (hpRatio < 0.35) {
          entry.bodyMat.emissive.setHex(0xff3300);
          entry.bodyMat.emissiveIntensity = 0.25;
          g.rotation.z = -0.10 * (1 - hpRatio);
          for (const hl of entry.headLights) hl.intensity = 0.10;
          if (entry.smokeMesh) {
            entry.smokeMesh.visible = true;
            entry.smokeMesh.material.opacity = 0.3 + 0.35 * (1 - hpRatio / 0.35);
          }
        } else if (hpRatio < 0.65) {
          entry.bodyMat.emissive.setHex(0xff7700);
          entry.bodyMat.emissiveIntensity = 0.15;
          g.rotation.z = -0.04 * (1 - hpRatio);
          for (const hl of entry.headLights) hl.intensity = 0.15;
          if (entry.smokeMesh) {
            entry.smokeMesh.visible = true;
            entry.smokeMesh.material.opacity = 0.08 + 0.22 * (0.65 - hpRatio) / 0.30;
          }
        } else {
          entry.bodyMat.emissive.setHex(0x000000);
          entry.bodyMat.emissiveIntensity = 0;
          g.rotation.z = 0;
          for (const hl of entry.headLights) hl.intensity = 0.30;
          if (entry.smokeMesh) entry.smokeMesh.visible = false;
        }

        // HP sprite
        if (entry.hpMesh?.visible) entry.hpMesh.position.set(g.position.x, HP_SPRITE_Y, entry.renderZ);

        // HP changed: darken body colors + redraw sprite + crack stage
        if (car.hp !== entry.lastHp) {
          entry.lastHp = car.hp;
          const mult = 0.55 + 0.45 * hpRatio;
          for (let mi = 0; mi < entry.colorMats.length; mi++) {
            const base = entry.colorBaseHexes[mi];
            entry.colorMats[mi].color.setRGB(
              Math.round(((base >> 16) & 0xff) * mult) / 255,
              Math.round(((base >>  8) & 0xff) * mult) / 255,
              Math.round(( base        & 0xff) * mult) / 255,
            );
          }
          this._drawHpBar(entry, car);
          if (entry.hpMesh) {
            entry.hpMesh.visible = car.hp < (car.maxHp ?? 0);
            if (entry.hpMesh.visible) entry.hpMesh.position.set(g.position.x, HP_SPRITE_Y, entry.renderZ);
          }
          if (entry.crackMesh) {
            const stage = hpRatio > 0.75 ? 0 : hpRatio > 0.50 ? 1 : hpRatio > 0.25 ? 2 : 3;
            if (stage !== entry.lastCrackStage) {
              entry.lastCrackStage = stage;
              this._drawCracks(entry.crackCtx, stage);
              entry.crackTex.needsUpdate = true;
              entry.crackMesh.visible    = stage > 0;
            }
          }
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
      if (d.shadowMat) d.shadowMat.opacity = 0.28 * (1 - prog);
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
      group = new THREE.Group();
      const result = this._buildTank(group, hex, colorMats, colorBaseHexes);
      bodyMat      = result.bodyMat;
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

      // Tint body materials to this car's lane color
      group.traverse(node => {
        if (!node.isMesh) return;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        for (const mat of mats) {
          if (!_isBodyMaterial(mat)) continue;
          mat.color.setHex(hex);
          if (!bodyMat) bodyMat = mat;
          colorMats.push(mat);
          colorBaseHexes.push(hex);
        }
      });

      // First-spawn material debug log for each car type
      if (!_loggedTypes.has(car.type)) {
        _loggedTypes.add(car.type);
        const names = [];
        group.traverse(n => {
          if (!n.isMesh) return;
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          for (const m of mats) names.push(m.name || '(unnamed)');
        });
        console.log(`[Car3D] first "${car.type}" mat names:`, names);
      }

      // Fallback: if no body material detected, create one manually
      if (!bodyMat) {
        bodyMat = new THREE.MeshStandardMaterial({ color: hex, transparent: true, opacity: 1 });
        colorMats.push(bodyMat);
        colorBaseHexes.push(hex);
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

    // HP sprite
    const hpCanvas = document.createElement('canvas');
    hpCanvas.width  = HP_CANVAS_W;
    hpCanvas.height = HP_CANVAS_H;
    const hpCtx  = hpCanvas.getContext('2d');
    const hpTex  = new THREE.CanvasTexture(hpCanvas);
    const hpMesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: hpTex, transparent: true, depthTest: false }));
    hpMesh.scale.set(HP_SPRITE_W, HP_SPRITE_H, 1);
    hpMesh.visible = false;
    this._scene.add(hpMesh);

    // Smoke sprite
    const smokeCanvas = document.createElement('canvas');
    smokeCanvas.width = smokeCanvas.height = 32;
    const sCtx  = smokeCanvas.getContext('2d');
    const sGrad = sCtx.createRadialGradient(16, 16, 2, 16, 16, 14);
    sGrad.addColorStop(0,   'rgba(160,160,160,0.55)');
    sGrad.addColorStop(0.6, 'rgba(120,120,120,0.30)');
    sGrad.addColorStop(1,   'rgba(80,80,80,0)');
    sCtx.fillStyle = sGrad;
    sCtx.beginPath(); sCtx.arc(16, 16, 14, 0, Math.PI * 2); sCtx.fill();
    const smokeTex  = new THREE.CanvasTexture(smokeCanvas);
    const smokeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 1.0),
      new THREE.MeshBasicMaterial({ map: smokeTex, transparent: true, depthTest: false }),
    );
    smokeMesh.rotation.x = -Math.PI / 2;
    smokeMesh.position.set(0, 1.2, 0);
    smokeMesh.visible = false;
    group.add(smokeMesh);

    // Tank crack overlay
    let crackCanvas = null, crackCtx = null, crackTex = null, crackMesh = null;
    if (car.type === 'tank') {
      crackCanvas = document.createElement('canvas');
      crackCanvas.width = crackCanvas.height = 64;
      crackCtx  = crackCanvas.getContext('2d');
      crackTex  = new THREE.CanvasTexture(crackCanvas);
      crackMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 2.4),
        new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, depthTest: false }),
      );
      crackMesh.rotation.x = -Math.PI / 2;
      crackMesh.position.set(0, 0.55, 0);
      crackMesh.visible = false;
      group.add(crackMesh);
    }

    // Contact shadow
    const shadowMat  = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
    const shadowMesh = new THREE.Mesh(_shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.scale.set(1.05, 1, 1.20);
    shadowMesh.position.set(laneToX(laneIdx), 0.005, posToZ(car.position));
    this._scene.add(shadowMesh);

    const groupY = car.type === 'tank' ? CAR_Y_TANK : CAR_Y;
    group.position.set(laneToX(laneIdx), groupY, posToZ(car.position));
    this._scene.add(group);

    const startZ = posToZ(car.position);
    const entry = {
      group, bodyMat, colorMats, colorBaseHexes,
      hpCanvas, hpCtx, hpTex, hpMesh, headLights,
      wheels, turretGroup, lastRenderZ: startZ,
      lastHp: -1, lastCrackStage: -1,
      laneIdx, bossRing, bossRingMat, bossAngle: 0,
      smokeMesh, smokeTex: null, crackCanvas, crackCtx, crackTex, crackMesh,
      shadowMesh, shadowMat, groupY,
      renderZ: startZ, targetZ: startZ, lerpStartZ: startZ, lerpT: 1.0,
    };
    // Intentionally unused smokeTex ref (smoke canvas is owned by smokeMesh.material.map)
    entry.smokeTex = smokeTex;
    this._drawHpBar(entry, car);
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

  // ── HP bar canvas ──────────────────────────────────────────────────────────────

  _drawHpBar(entry, car) {
    const W = HP_CANVAS_W, H = HP_CANVAS_H;
    const { hpCtx, hpTex } = entry;
    hpCtx.clearRect(0, 0, W, H);
    hpCtx.fillStyle = 'rgba(0,0,0,0.70)';
    if (hpCtx.roundRect) hpCtx.roundRect(1, 1, W - 2, H - 2, 4);
    else                 hpCtx.rect(1, 1, W - 2, H - 2);
    hpCtx.fill();
    hpCtx.font         = `bold ${Math.round(H * 0.72)}px Arial`;
    hpCtx.fillStyle    = '#ffffff';
    hpCtx.textAlign    = 'center';
    hpCtx.textBaseline = 'middle';
    hpCtx.shadowColor  = 'rgba(0,0,0,0.9)';
    hpCtx.shadowBlur   = 3;
    hpCtx.fillText(String(car.hp), W / 2, H / 2);
    hpCtx.shadowBlur   = 0;
    hpTex.needsUpdate  = true;
  }

  // ── Tank crack overlay ─────────────────────────────────────────────────────────

  _drawCracks(ctx, stage) {
    ctx.clearRect(0, 0, 64, 64);
    if (stage === 0) return;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth   = stage >= 3 ? 2.5 : 1.8;
    const lines = [
      [[32,32],[14,12],[6,22]],
      [[32,32],[52,14],[60,26]],
      [[32,32],[20,54],[12,58]],
      [[32,32],[50,52],[56,46]],
    ];
    for (let i = 0; i < stage; i++) {
      const pts = lines[i];
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
      ctx.stroke();
    }
  }

  // ── Disposal ───────────────────────────────────────────────────────────────────

  _disposeDying(d) {
    d.hpTex?.dispose();
    d.smokeTex?.dispose();
    d.crackTex?.dispose();
    this._disposeGroup(d.group);
    if (d.bossRing) { d.bossRingMat?.dispose(); this._scene.remove(d.bossRing); }
    if (d.shadowMesh) { d.shadowMat?.dispose(); this._scene.remove(d.shadowMesh); }
  }

  _disposeEntry(entry) {
    if (entry.hpMesh) {
      entry.hpTex.dispose();
      entry.hpMesh.material.dispose();
      this._scene.remove(entry.hpMesh);
    } else {
      entry.hpTex?.dispose();
    }
    entry.smokeTex?.dispose();
    entry.crackTex?.dispose();
    this._disposeGroup(entry.group);
    if (entry.bossRing) { entry.bossRingMat?.dispose(); this._scene.remove(entry.bossRing); }
    if (entry.shadowMesh) { entry.shadowMat?.dispose(); this._scene.remove(entry.shadowMesh); }
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
