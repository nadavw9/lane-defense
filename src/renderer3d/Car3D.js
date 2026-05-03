// Car3D — manages all live car meshes in the 3D road scene.
//
// Vehicle types (design-ported from brand-cars.html preview):
//   small  — motorbike: narrow 2-wheel, frame + fuel tank + handlebars
//   big    — sedan: long 3-box, chrome belt-line, slanted windscreens
//   jeep   — delivery van: tall boxy, upright windshield, rear cargo doors
//   truck  — pickup truck: short cab + open cargo bed with walls
//   bigrig — semi truck: cab + white trailer + twin smokestacks [NEW]
//   tank   — military tank: camo hull, rotating turret, tread segments, star insignia
//   boss   — generic body+roof with orbiting ring
//
// HP sprite: scene-space THREE.Sprite shown when hp < maxHp.
// Death animation (0.30 s): pop up, scale to 1.4×, fade out.

import * as THREE from 'three';
import { posToZ, laneToX } from './Scene3D.js';
import { CAR_TYPES } from '../director/CarTypes.js';

// ── Base geometry dimensions (used by generic/boss type only) ─────────────────
const BODY_W = 2.00;
const BODY_H = 0.42;
const BODY_D = 2.40;

const ROOF_W = 0.95;
const ROOF_H = 0.30;
const ROOF_D = 1.15;
const ROOF_Y = BODY_H / 2 + ROOF_H / 2;
const ROOF_Z = -0.15;

const WHEEL_R = 0.22;
const WHEEL_L = 0.14;
const WHEEL_Y = -(BODY_H / 2);
const WHEEL_OFFSETS = [
  [-BODY_W / 2 - WHEEL_L / 2,  WHEEL_Y,  BODY_D / 2 - 0.30],
  [ BODY_W / 2 + WHEEL_L / 2,  WHEEL_Y,  BODY_D / 2 - 0.30],
  [-BODY_W / 2 - WHEEL_L / 2,  WHEEL_Y, -BODY_D / 2 + 0.30],
  [ BODY_W / 2 + WHEEL_L / 2,  WHEEL_Y, -BODY_D / 2 + 0.30],
];

const HEADLIGHT_W = 0.18;
const HEADLIGHT_H = 0.10;
const HEADLIGHT_D = 0.08;
const HEADLIGHT_Z = BODY_D / 2 + HEADLIGHT_D / 2;
const HEADLIGHT_Y = BODY_H * 0.05;
const HEADLIGHT_XS = [-0.56, 0.56];

const CAR_Y = BODY_H / 2 + WHEEL_R;   // group Y: body bottom at road surface

// ── Design-builder coordinate constants ────────────────────────────────────────
// Builders ported from brand-cars.html use design-space coords (road at local y=0).
// SX scales X to match game width (sedan 1.15 design → 2.0 game).
// OY shifts Y so road contact aligns with CAR_Y group positioning.
const SX = 1.74;
const OY = -CAR_Y;   // = -0.43

// HP sprite
const HP_CANVAS_W = 64;
const HP_CANVAS_H = 28;
const HP_SPRITE_W = 0.55;
const HP_SPRITE_H = 0.24;
const HP_SPRITE_Y = CAR_Y + BODY_H + 0.7;

// Death animation
const DEATH_DURATION  = 0.30;
const DEATH_SCALE_MAX = 1.40;
const DEATH_VY        = 2.5;

// Render-side movement lerp
const LERP_DURATION = 0.45;
const MAX_TILT_X    = 0.20;

// Wheel spin rate (radians per world unit of travel)
const WHEEL_SPIN_RATE = 1 / WHEEL_R;

// Turret rotation speed (rad/s)
const TURRET_ROT_SPEED = 0.18;

// ── Colour palette ─────────────────────────────────────────────────────────────
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

function darken(hex, amount = 0x282828) {
  const r = Math.max(0, ((hex >> 16) & 0xff) - ((amount >> 16) & 0xff));
  const g = Math.max(0, ((hex >>  8) & 0xff) - ((amount >>  8) & 0xff));
  const b = Math.max(0, ( hex        & 0xff) - ( amount        & 0xff));
  return (r << 16) | (g << 8) | b;
}

// ── Shared geometry caches (generic/boss type only) ───────────────────────────
const _sharedGeos = new Set();

let _wheelGeo     = null;
let _headGeo      = null;
let _bossTorusGeo = null;
let _shadowGeo    = null;
let _hlConeGeo    = null;
let _hlStripeGeo  = null;
let _wheelMat     = null;
let _gGeos        = null;   // generic body + roof

function _addShared(geo) { _sharedGeos.add(geo); return geo; }

function sharedGeo() {
  if (_wheelGeo) return;
  _wheelGeo     = _addShared(new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, WHEEL_L, 10));
  _headGeo      = _addShared(new THREE.BoxGeometry(HEADLIGHT_W, HEADLIGHT_H, HEADLIGHT_D));
  _bossTorusGeo = _addShared(new THREE.TorusGeometry(1.4, 0.06, 8, 28));
  _shadowGeo    = _addShared(new THREE.CircleGeometry(1.0, 14));
  _hlConeGeo    = _addShared(new THREE.ConeGeometry(0.09, 0.45, 6, 1, true));
  _hlStripeGeo  = _addShared(new THREE.BoxGeometry(BODY_W * 0.80, 0.025, BODY_D * 0.80));
  _wheelMat     = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.1, transparent: true, opacity: 1 });
  _gGeos = {
    body: _addShared(new THREE.BoxGeometry(BODY_W, BODY_H, BODY_D)),
    roof: _addShared(new THREE.BoxGeometry(ROOF_W, ROOF_H, ROOF_D)),
  };
}

// ── Material helpers ───────────────────────────────────────────────────────────

function _paintMat(hex) {
  return new THREE.MeshStandardMaterial({
    color: hex, metalness: 0.42, roughness: 0.48, transparent: true, opacity: 1,
    emissive: new THREE.Color(0x181818), emissiveIntensity: 0.12,
  });
}
function _roofMat(hex) {
  return new THREE.MeshStandardMaterial({
    color: hex, metalness: 0.68, roughness: 0.14, transparent: true, opacity: 1,
  });
}
function _darkMat(hex = 0x1a1a1a) {
  return new THREE.MeshStandardMaterial({ color: hex, metalness: 0.20, roughness: 0.80, transparent: true, opacity: 1 });
}
function _glassMat() {
  return new THREE.MeshStandardMaterial({ color: 0x182838, roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.92 });
}
function _chromeMat() {
  return new THREE.MeshStandardMaterial({ color: 0xcfcfd2, roughness: 0.2, metalness: 0.95, transparent: true, opacity: 1 });
}
function _rimMat() {
  return new THREE.MeshStandardMaterial({ color: 0xddddde, roughness: 0.3, metalness: 0.9, transparent: true, opacity: 1 });
}
function _tireMat() {
  return _darkMat(0x111114);
}
function _hlMesh(group, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.22 * SX, 0.07, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xfff8d0, emissive: 0xffe066, emissiveIntensity: 1.0, transparent: true, opacity: 1 }));
  m.position.set(x, y, z); group.add(m); return m;
}
function _brMesh(group, w, h, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w * SX, h, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xcc0000, emissiveIntensity: 0.8, transparent: true, opacity: 1 }));
  m.position.set(x, y, z); group.add(m); return m;
}

// ── Car3D class ───────────────────────────────────────────────────────────────

export class Car3D {
  constructor(scene, lanes) {
    this._scene = scene;
    this._lanes = lanes;
    this._live  = new Map();
    this._dying = [];
    sharedGeo();
  }

  // ── Public ───────────────────────────────────────────────────────────────────

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
          group: entry.group,
          bodyMat: entry.bodyMat,
          hpTex: entry.hpTex, smokeTex: entry.smokeTex, crackTex: entry.crackTex,
          bossRing: entry.bossRing, bossRingMat: entry.bossRingMat,
          shadowMesh: entry.shadowMesh, shadowMat: entry.shadowMat,
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
        g.position.set(laneToX(laneIdx), CAR_Y, entry.renderZ);
        if (entry.shadowMesh) {
          entry.shadowMesh.position.set(laneToX(laneIdx), 0.005, entry.renderZ);
        }

        // Wheel spin
        if (entry.wheels.length > 0) {
          const dZ = entry.renderZ - entry.lastRenderZ;
          if (Math.abs(dZ) > 0.0001) {
            for (const w of entry.wheels) w.rotation.x -= dZ * WHEEL_SPIN_RATE;
          }
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
        if (entry.turretGroup) {
          entry.turretGroup.rotation.y += dt * TURRET_ROT_SPEED;
        }

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

        // HP sprite position
        if (entry.hpMesh?.visible) {
          entry.hpMesh.position.set(g.position.x, HP_SPRITE_Y, entry.renderZ);
        }

        // HP change: darken colorMats + update HP sprite + cracks
        if (car.hp !== entry.lastHp) {
          entry.lastHp = car.hp;
          const mult   = 0.55 + 0.45 * hpRatio;
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
            if (entry.hpMesh.visible) {
              entry.hpMesh.position.set(g.position.x, HP_SPRITE_Y, entry.renderZ);
            }
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
      if (d.t >= DEATH_DURATION) {
        this._disposeDying(d);
        this._dying.splice(i, 1);
        continue;
      }
      const prog  = d.t / DEATH_DURATION;
      const scale = 1 + (DEATH_SCALE_MAX - 1) * prog;
      d.group.scale.set(scale, scale, scale);
      d.group.position.y += DEATH_VY * dt;
      d.group.traverse(child => {
        if (child.material && child.material !== _wheelMat) child.material.opacity = 1 - prog;
      });
      if (d.shadowMat) d.shadowMat.opacity = 0.28 * (1 - prog);
    }
  }

  // ── Private: entry creation ───────────────────────────────────────────────────

  _createEntry(car, laneIdx) {
    const hex   = carHex(car);
    const group = new THREE.Group();

    const colorMats      = [];
    const colorBaseHexes = [];

    let bodyMat;
    let turretGroup = null;
    let wheels      = [];

    switch (car.type) {
      case 'small':
        bodyMat = this._buildBike(group, hex, colorMats, colorBaseHexes);
        break;
      case 'big':
        bodyMat = this._buildSedan(group, hex, colorMats, colorBaseHexes);
        break;
      case 'jeep':
        bodyMat = this._buildVan(group, hex, colorMats, colorBaseHexes);
        break;
      case 'truck':
        bodyMat = this._buildPickup(group, hex, colorMats, colorBaseHexes);
        break;
      case 'bigrig':
        bodyMat = this._buildBigRig(group, hex, colorMats, colorBaseHexes);
        break;
      case 'tank':
        ({ bodyMat, turretGroup } = this._buildTank(group, hex, colorMats, colorBaseHexes));
        break;
      default:
        bodyMat = this._buildGeneric(group, hex, colorMats, colorBaseHexes);
        wheels  = this._addWheels(group);
        break;
    }

    // Wheels from design builders
    if (group.userData.wheels?.length) wheels = group.userData.wheels;

    // Headlights: design builders provide their own; boss/generic gets the generic set
    const headLights = [];
    if (group.userData.hasBuiltinLights) {
      if (group.userData.pointLights) headLights.push(...group.userData.pointLights);
    } else {
      const headMat = new THREE.MeshStandardMaterial({
        color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.75,
        transparent: true, opacity: 1,
      });
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xffffee, transparent: true, opacity: 0.07,
        side: THREE.BackSide, depthWrite: false,
      });
      for (const hx of HEADLIGHT_XS) {
        const hl = new THREE.Mesh(_headGeo, headMat);
        hl.position.set(hx, HEADLIGHT_Y, HEADLIGHT_Z);
        group.add(hl);
        const cone = new THREE.Mesh(_hlConeGeo, coneMat);
        cone.rotation.x = -Math.PI / 2;
        cone.position.set(hx, HEADLIGHT_Y, HEADLIGHT_Z + 0.25);
        group.add(cone);
        const ptLight = new THREE.PointLight(0xffffaa, car.type === 'boss' ? 0.80 : 0.30, car.type === 'boss' ? 6 : 4);
        ptLight.position.set(hx, HEADLIGHT_Y, HEADLIGHT_Z + 0.2);
        group.add(ptLight);
        headLights.push(ptLight);
      }
      // Roof highlight stripe (generic/boss only — design types position their own roofs)
      const stripeMat  = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.10, depthWrite: false,
      });
      const stripeMesh = new THREE.Mesh(_hlStripeGeo, stripeMat);
      stripeMesh.position.set(0, BODY_H / 2 + 0.013, 0);
      group.add(stripeMesh);
    }

    // Type-based group scale + boss ring
    let bossRing = null, bossRingMat = null;
    if (car.type === 'boss') {
      group.scale.set(1.35, 1.35, 1.35);
      bossRingMat = new THREE.MeshStandardMaterial({
        color: hex, emissive: hex, emissiveIntensity: 1.5,
        transparent: true, opacity: 0.75,
      });
      bossRing = new THREE.Mesh(_bossTorusGeo, bossRingMat);
      this._scene.add(bossRing);
    } else {
      const td = CAR_TYPES[car.type];
      if (td) group.scale.set(td.scaleX, td.scaleY, td.scaleZ);
    }

    // HP sprite
    const hpCanvas = document.createElement('canvas');
    hpCanvas.width  = HP_CANVAS_W;
    hpCanvas.height = HP_CANVAS_H;
    const hpCtx = hpCanvas.getContext('2d');
    const hpTex = new THREE.CanvasTexture(hpCanvas);
    const hpMat = new THREE.SpriteMaterial({ map: hpTex, transparent: true, depthTest: false });
    const hpMesh = new THREE.Sprite(hpMat);
    hpMesh.scale.set(HP_SPRITE_W, HP_SPRITE_H, 1);
    hpMesh.visible = false;
    this._scene.add(hpMesh);

    // Smoke sprite
    const smokeCanvas = document.createElement('canvas');
    smokeCanvas.width = smokeCanvas.height = 32;
    const sCtx = smokeCanvas.getContext('2d');
    const sGrad = sCtx.createRadialGradient(16, 16, 2, 16, 16, 14);
    sGrad.addColorStop(0,   'rgba(160,160,160,0.55)');
    sGrad.addColorStop(0.6, 'rgba(120,120,120,0.30)');
    sGrad.addColorStop(1,   'rgba(80,80,80,0)');
    sCtx.fillStyle = sGrad;
    sCtx.beginPath(); sCtx.arc(16, 16, 14, 0, Math.PI * 2); sCtx.fill();
    const smokeTex  = new THREE.CanvasTexture(smokeCanvas);
    const smokeMat  = new THREE.MeshBasicMaterial({ map: smokeTex, transparent: true, depthTest: false });
    const smokeMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), smokeMat);
    smokeMesh.rotation.x = -Math.PI / 2;
    smokeMesh.position.set(0, BODY_H + 0.08, 0);
    smokeMesh.visible = false;
    group.add(smokeMesh);

    // Tank crack overlay
    let crackCanvas = null, crackCtx = null, crackTex = null, crackMesh = null;
    if (car.type === 'tank') {
      crackCanvas        = document.createElement('canvas');
      crackCanvas.width  = 64;
      crackCanvas.height = 64;
      crackCtx   = crackCanvas.getContext('2d');
      crackTex   = new THREE.CanvasTexture(crackCanvas);
      const crackMat = new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, depthTest: false });
      crackMesh  = new THREE.Mesh(new THREE.PlaneGeometry(BODY_W * 0.88, BODY_D * 0.88), crackMat);
      crackMesh.rotation.x = -Math.PI / 2;
      crackMesh.position.set(0, BODY_H / 2 + 0.01, 0);
      crackMesh.visible = false;
      group.add(crackMesh);
    }

    // Contact shadow
    const shadowMat  = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(_shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.scale.set(1.05, 1, 1.20);
    shadowMesh.position.set(laneToX(laneIdx), 0.005, posToZ(car.position));
    this._scene.add(shadowMesh);

    group.position.set(laneToX(laneIdx), CAR_Y, posToZ(car.position));
    this._scene.add(group);

    const startZ = posToZ(car.position);
    const entry = {
      group, bodyMat, colorMats, colorBaseHexes,
      hpCanvas, hpCtx, hpTex, hpMesh, headLights,
      wheels, turretGroup, lastRenderZ: startZ,
      lastHp: -1, lastCrackStage: -1,
      laneIdx, bossRing, bossRingMat, bossAngle: 0, hexColor: hex,
      smokeMesh, smokeTex, crackCanvas, crackCtx, crackTex, crackMesh,
      shadowMesh, shadowMat,
      renderZ: startZ, targetZ: startZ, lerpStartZ: startZ, lerpT: 1.0,
    };
    this._drawHpBar(entry, car);
    return entry;
  }

  // ── Per-type geometry builders ────────────────────────────────────────────────

  // Motorbike — narrow 2-wheel, frame + fuel tank + seat + handlebars
  _buildBike(group, hex, colorMats, colorBaseHexes) {
    const bm = _paintMat(hex);
    const dm = _darkMat(darken(hex, 0x383838));
    const tm = _tireMat();
    const cm = new THREE.MeshStandardMaterial({ color: 0xc0c0c5, roughness: 0.3, metalness: 0.85, transparent: true, opacity: 1 });
    colorMats.push(bm); colorBaseHexes.push(hex);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.36 * SX, 0.32, 1.0), bm);
    frame.position.set(0, 0.55 + OY, 0); frame.castShadow = true; group.add(frame);

    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.32 * SX, 0.20, 0.45), bm);
    tank.position.set(0, 0.78 + OY, 0.05); group.add(tank);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.34 * SX, 0.10, 0.40), dm);
    seat.position.set(0, 0.78 + OY, -0.30); group.add(seat);

    const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45 * SX, 8), cm);
    hb.rotation.z = Math.PI / 2; hb.position.set(0, 0.92 + OY, 0.46); group.add(hb);

    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.06 * SX, 0.5, 0.06), cm);
    fork.position.set(0, 0.5 + OY, 0.55); group.add(fork);

    const wGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.10 * SX, 16);
    const wf = new THREE.Mesh(wGeo, tm); wf.rotation.z = Math.PI / 2; wf.position.set(0, 0.28 + OY,  0.62); group.add(wf);
    const wb = new THREE.Mesh(wGeo, tm); wb.rotation.z = Math.PI / 2; wb.position.set(0, 0.28 + OY, -0.55); group.add(wb);

    const hlMesh = new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff8d0, emissive: 0xffcc00, emissiveIntensity: 0.9, transparent: true, opacity: 1 }));
    hlMesh.position.set(0, 0.78 + OY, 0.68); group.add(hlMesh);

    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.18 * SX, 0.06, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xaa0000, emissiveIntensity: 0.6, transparent: true, opacity: 1 }));
    bl.position.set(0, 0.74 + OY, -0.62); group.add(bl);

    const ptLight = new THREE.PointLight(0xffffaa, 0.30, 4);
    ptLight.position.set(0, 0.78 + OY, 0.85); group.add(ptLight);

    group.userData.hasBuiltinLights = true;
    group.userData.pointLights      = [ptLight];
    group.userData.wheels           = [wf, wb];
    return bm;
  }

  // Sedan — long 3-box, chrome belt-line, slanted windscreens, slim headlights
  _buildSedan(group, hex, colorMats, colorBaseHexes) {
    const w = 1.15 * SX, l = 2.45;
    const bm = _paintMat(hex);
    const dm = _darkMat(darken(hex, 0x383838));
    colorMats.push(bm); colorBaseHexes.push(hex);

    const lower = new THREE.Mesh(new THREE.BoxGeometry(w, 0.38, l), bm);
    lower.position.set(0, 0.32 + OY, 0); lower.castShadow = true; group.add(lower);

    const skirt = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02 * SX, 0.10, l - 0.05), dm);
    skirt.position.set(0, 0.16 + OY, 0); group.add(skirt);

    const cabinL = l * 0.42;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.36, cabinL), bm);
    cabin.position.set(0, 0.70 + OY, -l * 0.04); group.add(cabin);

    const gm = _glassMat();
    const wfg = new THREE.Mesh(new THREE.BoxGeometry(w * 0.74, 0.34, 0.06), gm);
    wfg.rotation.x = 0.42; wfg.position.set(0, 0.78 + OY, -l * 0.04 + cabinL / 2 - 0.04); group.add(wfg);
    const wbk = new THREE.Mesh(new THREE.BoxGeometry(w * 0.74, 0.32, 0.06), gm);
    wbk.rotation.x = -0.42; wbk.position.set(0, 0.78 + OY, -l * 0.04 - cabinL / 2 + 0.04); group.add(wbk);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.74, 0.04, cabinL * 0.7), bm);
    roof.position.set(0, 0.90 + OY, -l * 0.04); group.add(roof);

    const cm = _chromeMat();
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04 * SX, 0.04, l - 0.1), cm);
    trim.position.set(0, 0.55 + OY, 0); group.add(trim);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.16, 0.06), _darkMat(0x202028));
    grille.position.set(0, 0.34 + OY, l / 2 - 0.005); group.add(grille);
    const grilleTrim = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.04, 0.07), cm);
    grilleTrim.position.set(0, 0.42 + OY, l / 2 - 0.005); group.add(grilleTrim);

    const rm = _rimMat(), tm = _tireMat();
    const wheels = [], ptLights = [];
    const wx = w / 2 + 0.02 * SX;
    for (const [x, y, z] of [[wx, 0.24 + OY, l / 2 - 0.42], [-wx, 0.24 + OY, l / 2 - 0.42],
                              [wx, 0.24 + OY, -l / 2 + 0.42], [-wx, 0.24 + OY, -l / 2 + 0.42]]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 16), tm);
      tire.rotation.z = Math.PI / 2; tire.position.set(x, y, z); group.add(tire);
      const rim  = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.17, 10), rm);
      rim.rotation.z  = Math.PI / 2; rim.position.set(x, y, z); group.add(rim);
      wheels.push(tire);
    }
    for (const s of [-1, 1]) {
      _hlMesh(group, s * w * 0.34, 0.44 + OY, l / 2 - 0.005);
      _brMesh(group, 0.30, 0.07, s * w * 0.30, 0.44 + OY, -l / 2 + 0.005);
      const ptLight = new THREE.PointLight(0xffffaa, 0.30, 4);
      ptLight.position.set(s * w * 0.34, 0.44 + OY, l / 2 + 0.2); group.add(ptLight);
      ptLights.push(ptLight);
    }
    group.userData.hasBuiltinLights = true;
    group.userData.pointLights      = ptLights;
    group.userData.wheels           = wheels;
    return bm;
  }

  // Delivery van — tall boxy, upright windshield, side cargo windows, rear doors
  _buildVan(group, hex, colorMats, colorBaseHexes) {
    const w = 1.25 * SX, l = 2.4;
    const bm = _paintMat(hex);
    const dm = _darkMat(darken(hex, 0x383838));
    colorMats.push(bm); colorBaseHexes.push(hex);

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, 1.20, l - 0.20), bm);
    body.position.set(0, 0.78 + OY, -0.10); body.castShadow = true; group.add(body);

    const skirt = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02 * SX, 0.10, l - 0.05), dm);
    skirt.position.set(0, 0.22 + OY, 0); group.add(skirt);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, 0.30), bm);
    snout.position.set(0, 0.58 + OY, l / 2 - 0.20); group.add(snout);

    const gm = _glassMat();
    const wfg = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.55, 0.06), gm);
    wfg.rotation.x = 0.18; wfg.position.set(0, 1.05 + OY, l / 2 - 0.18); group.add(wfg);

    for (const s of [-1, 1]) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.20, 0.7), gm);
      sw.position.set(s * (w / 2 + 0.005), 1.15 + OY, -0.20); group.add(sw);
    }

    const door = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06 * SX, 1.00, 0.04), dm);
    door.position.set(0, 0.82 + OY, -l / 2 + 0.06); group.add(door);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.03 * SX, 0.95, 0.05), _tireMat());
    seam.position.set(0, 0.82 + OY, -l / 2 + 0.07); group.add(seam);

    const roofLip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04 * SX, 0.04, l - 0.20), dm);
    roofLip.position.set(0, 1.39 + OY, -0.10); group.add(roofLip);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 0.18, 0.06), _darkMat(0x202028));
    grille.position.set(0, 0.36 + OY, l / 2 - 0.005); group.add(grille);

    const rm = _rimMat(), tm = _tireMat();
    const wheels = [], ptLights = [];
    const wx = w / 2 + 0.02 * SX;
    for (const [x, y, z] of [[wx, 0.24 + OY, l / 2 - 0.42], [-wx, 0.24 + OY, l / 2 - 0.42],
                              [wx, 0.24 + OY, -l / 2 + 0.42], [-wx, 0.24 + OY, -l / 2 + 0.42]]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 16), tm);
      tire.rotation.z = Math.PI / 2; tire.position.set(x, y, z); group.add(tire);
      const rim  = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.17, 10), rm);
      rim.rotation.z  = Math.PI / 2; rim.position.set(x, y, z); group.add(rim);
      wheels.push(tire);
    }
    for (const s of [-1, 1]) {
      _hlMesh(group, s * w * 0.36, 0.50 + OY, l / 2 - 0.005);
      _brMesh(group, 0.18, 0.32, s * w * 0.40, 0.95 + OY, -l / 2 + 0.005);
      const ptLight = new THREE.PointLight(0xffffaa, 0.30, 4);
      ptLight.position.set(s * w * 0.36, 0.50 + OY, l / 2 + 0.2); group.add(ptLight);
      ptLights.push(ptLight);
    }
    group.userData.hasBuiltinLights = true;
    group.userData.pointLights      = ptLights;
    group.userData.wheels           = wheels;
    return bm;
  }

  // Pickup truck — short cab + open cargo bed with visible walls
  _buildPickup(group, hex, colorMats, colorBaseHexes) {
    const w = 1.30 * SX, l = 2.9;
    const bm = _paintMat(hex);
    const dm = _darkMat(darken(hex, 0x383838));
    colorMats.push(bm); colorBaseHexes.push(hex);

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(w, 0.50, l), bm);
    chassis.position.set(0, 0.45 + OY, 0); chassis.castShadow = true; group.add(chassis);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02 * SX, 0.12, l - 0.05), dm);
    skirt.position.set(0, 0.22 + OY, 0); group.add(skirt);

    const cabL = l * 0.40;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.55, cabL), bm);
    cab.position.set(0, 0.95 + OY, l / 2 - cabL / 2 - 0.05); group.add(cab);

    const gm = _glassMat();
    const wfg = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.36, 0.06), gm);
    wfg.rotation.x = 0.30; wfg.position.set(0, 1.05 + OY, l / 2 - 0.10); group.add(wfg);
    for (const s of [-1, 1]) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.30, cabL * 0.7), gm);
      sw.position.set(s * (w * 0.46 + 0.005), 1.05 + OY, l / 2 - cabL / 2 - 0.05); group.add(sw);
    }

    const bedL = l * 0.55, bedZ = -l / 2 + bedL / 2 + 0.02;
    const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(w - 0.10 * SX, 0.06, bedL - 0.06), dm);
    bedFloor.position.set(0, 0.74 + OY, bedZ); group.add(bedFloor);
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, bedL - 0.04), bm);
      wall.position.set(s * (w / 2 - 0.04 * SX), 0.92 + OY, bedZ); group.add(wall);
    }
    const fwall = new THREE.Mesh(new THREE.BoxGeometry(w - 0.10 * SX, 0.32, 0.08), bm);
    fwall.position.set(0, 0.92 + OY, bedZ + bedL / 2 - 0.04); group.add(fwall);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04 * SX, 0.30, 0.08), bm);
    tail.position.set(0, 0.91 + OY, -l / 2 + 0.06); group.add(tail);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.22, 0.06), _darkMat(0x202028));
    grille.position.set(0, 0.46 + OY, l / 2 - 0.005); group.add(grille);

    const tm = _tireMat();
    const wheels = [], ptLights = [];
    const wx = w / 2 + 0.04 * SX;
    for (const [x, y, z] of [[wx, 0.30 + OY, l / 2 - 0.50], [-wx, 0.30 + OY, l / 2 - 0.50],
                              [wx, 0.30 + OY, -l / 2 + 0.50], [-wx, 0.30 + OY, -l / 2 + 0.50]]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.20, 16), tm);
      tire.rotation.z = Math.PI / 2; tire.position.set(x, y, z); tire.castShadow = true; group.add(tire);
      wheels.push(tire);
    }
    for (const s of [-1, 1]) {
      _hlMesh(group, s * w * 0.36, 0.56 + OY, l / 2 - 0.005);
      _brMesh(group, 0.22, 0.10, s * w * 0.36, 0.74 + OY, -l / 2 + 0.005);
      const ptLight = new THREE.PointLight(0xffffaa, 0.30, 4);
      ptLight.position.set(s * w * 0.36, 0.56 + OY, l / 2 + 0.2); group.add(ptLight);
      ptLights.push(ptLight);
    }
    group.userData.hasBuiltinLights = true;
    group.userData.pointLights      = ptLights;
    group.userData.wheels           = wheels;
    return bm;
  }

  // Semi truck — tall cab + white trailer + twin smokestacks + 10 wheels
  _buildBigRig(group, hex, colorMats, colorBaseHexes) {
    const w = 1.45 * SX, l = 3.9;
    const bm = _paintMat(hex);
    const dm = _darkMat(darken(hex, 0x383838));
    const trailerM = new THREE.MeshStandardMaterial({ color: 0xe8e8ec, roughness: 0.6, transparent: true, opacity: 1 });
    const cm = new THREE.MeshStandardMaterial({ color: 0xc8c8cc, roughness: 0.25, metalness: 0.95, transparent: true, opacity: 1 });
    colorMats.push(bm); colorBaseHexes.push(hex);

    const cabL = l * 0.32, cabZ = l / 2 - cabL / 2;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(w, 1.30, cabL), bm);
    cab.position.set(0, 0.85 + OY, cabZ); cab.castShadow = true; group.add(cab);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.55, 0.55), bm);
    hood.position.set(0, 0.50 + OY, cabZ + cabL / 2 - 0.05); group.add(hood);

    const gm = _glassMat();
    const wfg = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, 0.55, 0.06), gm);
    wfg.rotation.x = 0.20; wfg.position.set(0, 1.20 + OY, cabZ + cabL / 2 - 0.06); group.add(wfg);

    for (const s of [-1, 1]) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.95, 10), cm);
      stack.position.set(s * (w / 2 + 0.05 * SX), 1.65 + OY, cabZ - cabL / 4); group.add(stack);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.08, 0.10, 10), _tireMat());
      cap.position.set(s * (w / 2 + 0.05 * SX), 2.18 + OY, cabZ - cabL / 4); group.add(cap);
    }

    const trailerL = l * 0.62, trailerZ = -l / 2 + trailerL / 2 + 0.10;
    const trailer = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05 * SX, 1.55, trailerL), trailerM);
    trailer.position.set(0, 0.95 + OY, trailerZ); group.add(trailer);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.10 * SX, 0.10, trailerL), bm);
    stripe.position.set(0, 1.20 + OY, trailerZ); group.add(stripe);

    const doorSeam = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.40, 0.03), _tireMat());
    doorSeam.position.set(0, 0.95 + OY, -l / 2 + 0.13); group.add(doorSeam);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.30, 0.06), _darkMat(0x202028));
    grille.position.set(0, 0.42 + OY, l / 2 - 0.005); group.add(grille);

    const tm = _tireMat();
    const wheels = [], ptLights = [];
    const wx = w / 2 + 0.04 * SX;
    const axles = [
      { z: l / 2 - 0.50,           dual: false },
      { z: cabZ - cabL / 2 - 0.10, dual: true  },
      { z: trailerZ + trailerL / 2 - 0.45, dual: false },
      { z: -l / 2 + 0.50,          dual: false },
    ];
    for (const { z, dual } of axles) {
      for (const s of [-1, 1]) {
        for (const off of dual ? [0, 0.28] : [0]) {
          const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.18, 16), tm);
          tire.rotation.z = Math.PI / 2;
          tire.position.set(s * wx, 0.30 + OY, z + off);
          group.add(tire); wheels.push(tire);
        }
      }
    }
    for (const s of [-1, 1]) {
      _hlMesh(group, s * w * 0.38, 0.60 + OY, l / 2 - 0.005);
      _brMesh(group, 0.18, 0.12, s * w * 0.40, 0.50 + OY, -l / 2 + 0.10);
      const ptLight = new THREE.PointLight(0xffffaa, 0.30, 4);
      ptLight.position.set(s * w * 0.38, 0.60 + OY, l / 2 + 0.2); group.add(ptLight);
      ptLights.push(ptLight);
    }
    group.userData.hasBuiltinLights = true;
    group.userData.pointLights      = ptLights;
    group.userData.wheels           = wheels;
    return bm;
  }

  // Military tank — camo hull, caterpillar tracks with tread segments, rotating turret + cannon, star insignia
  _buildTank(group, hex, colorMats, colorBaseHexes) {
    const w = 1.55 * SX, l = 2.8;
    const bm = _paintMat(hex);
    const dm = _darkMat(darken(hex, 0x383838));
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
    const turretBody = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * SX, 0.65 * SX, 0.42, 12), bm);
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

    // White star insignia on hull top
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

    group.userData.hasBuiltinLights = true;
    group.userData.pointLights      = [];
    return { bodyMat: bm, turretGroup };
  }

  // Generic — used for boss type (box body + roof)
  _buildGeneric(group, hex, colorMats, colorBaseHexes) {
    const roofHex = darken(hex);
    const bodyMat = _paintMat(hex);
    const rMat    = _roofMat(roofHex);
    const body    = new THREE.Mesh(_gGeos.body, bodyMat);
    body.castShadow = body.receiveShadow = true;
    group.add(body);
    colorMats.push(bodyMat); colorBaseHexes.push(hex);
    const roof = new THREE.Mesh(_gGeos.roof, rMat);
    roof.position.set(0, ROOF_Y, ROOF_Z);
    roof.castShadow = true;
    group.add(roof);
    colorMats.push(rMat); colorBaseHexes.push(roofHex);
    return bodyMat;
  }

  // ── Add shared wheels to a group (generic/boss) ───────────────────────────────

  _addWheels(group) {
    const wheels = [];
    for (const [wx, wy, wz] of WHEEL_OFFSETS) {
      const wheel = new THREE.Mesh(_wheelGeo, _wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      wheel.castShadow = true;
      group.add(wheel);
      wheels.push(wheel);
    }
    return wheels;
  }

  // ── HP bar canvas ─────────────────────────────────────────────────────────────

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

  // ── Tank crack overlay ────────────────────────────────────────────────────────

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

  // ── Disposal ──────────────────────────────────────────────────────────────────

  _disposeDying(d) {
    d.hpTex?.dispose();
    d.smokeTex?.dispose();
    d.crackTex?.dispose();
    this._disposeGroup(d.group);
    if (d.bossRing) {
      d.bossRingMat?.dispose();
      this._scene.remove(d.bossRing);
    }
    if (d.shadowMesh) {
      d.shadowMat?.dispose();
      this._scene.remove(d.shadowMesh);
    }
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
    if (entry.bossRing) {
      entry.bossRingMat?.dispose();
      this._scene.remove(entry.bossRing);
    }
    if (entry.shadowMesh) {
      entry.shadowMat?.dispose();
      this._scene.remove(entry.shadowMesh);
    }
  }

  _disposeGroup(group) {
    group.traverse(obj => {
      if (obj.geometry && !_sharedGeos.has(obj.geometry)) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m !== _wheelMat) m.dispose();
        }
      }
    });
    this._scene.remove(group);
  }
}
