// Car3D — manages all live car meshes in the 3D road scene.
//
// Each car type has distinctive per-type geometry:
//   small  — compact 2-box body + roof, front lip + rear wing
//   big    — 3-segment hood/cabin/trunk sedan
//   jeep   — boxy body, roof rack, bull bar, spotlights
//   truck  — split cabin + cargo bed
//   tank   — flat armored body, side treads, rotating gun turret
//   boss   — generic body+roof with orbiting ring
//
// HP sprite: scene-space THREE.Sprite shown when hp < maxHp.
// Death animation (0.30 s): pop up, scale to 1.4×, fade out.

import * as THREE from 'three';
import { posToZ, laneToX } from './Scene3D.js';
import { CAR_TYPES } from '../director/CarTypes.js';

// ── Base geometry dimensions ───────────────────────────────────────────────────
const BODY_W = 2.00;
const BODY_H = 0.42;
const BODY_D = 2.40;

const ROOF_W = 0.95;
const ROOF_H = 0.30;
const ROOF_D = 1.15;
const ROOF_Y = BODY_H / 2 + ROOF_H / 2;   // sits on top of body
const ROOF_Z = -0.15;                       // slightly rearward

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

// ── Shared geometry caches ─────────────────────────────────────────────────────
// All shared geometries are added to _sharedGeos so _disposeGroup skips them.
const _sharedGeos = new Set();

let _wheelGeo     = null;
let _headGeo      = null;
let _bossTorusGeo = null;
let _wheelMat     = null;

// Per-type shared geometry pools (keyed by part name)
let _sGeos = null;   // small extras
let _bGeos = null;   // big extras
let _jGeos = null;   // jeep extras
let _tGeos = null;   // truck extras
let _kGeos = null;   // tank extras
let _gGeos = null;   // generic (body + roof, shared by small/jeep/generic)

function _addShared(geo) { _sharedGeos.add(geo); return geo; }

function sharedGeo() {
  if (_wheelGeo) return;

  _wheelGeo     = _addShared(new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, WHEEL_L, 10));
  _headGeo      = _addShared(new THREE.BoxGeometry(HEADLIGHT_W, HEADLIGHT_H, HEADLIGHT_D));
  _bossTorusGeo = _addShared(new THREE.TorusGeometry(1.4, 0.06, 8, 28));
  _wheelMat     = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.1, transparent: true, opacity: 1 });

  // Generic (used by small, jeep, boss)
  _gGeos = {
    body: _addShared(new THREE.BoxGeometry(BODY_W, BODY_H, BODY_D)),
    roof: _addShared(new THREE.BoxGeometry(ROOF_W, ROOF_H, ROOF_D)),
  };

  // small extras: front lip + rear wing blade
  _sGeos = {
    lip:  _addShared(new THREE.BoxGeometry(BODY_W * 0.70, 0.05, 0.10)),
    wing: _addShared(new THREE.BoxGeometry(BODY_W * 0.80, 0.14, 0.05)),
  };

  // big (sedan): hood, cabin, trunk, side mirror, antenna
  _bGeos = {
    hood:    _addShared(new THREE.BoxGeometry(BODY_W,       BODY_H * 0.68, BODY_D * 0.40)),
    cabin:   _addShared(new THREE.BoxGeometry(BODY_W * 0.88, BODY_H * 1.35, BODY_D * 0.44)),
    trunk:   _addShared(new THREE.BoxGeometry(BODY_W,       BODY_H * 0.78, BODY_D * 0.36)),
    mirror:  _addShared(new THREE.BoxGeometry(0.05, 0.09, 0.20)),
    antenna: _addShared(new THREE.BoxGeometry(0.04, 0.26, 0.04)),
  };

  // jeep extras: 3 roof-rack bars, horizontal + 2 vertical bull bar, 2 spotlights
  _jGeos = {
    rack:  _addShared(new THREE.BoxGeometry(BODY_W * 0.78, 0.05, 0.09)),
    bullH: _addShared(new THREE.BoxGeometry(BODY_W * 0.88, 0.08, 0.05)),
    bullV: _addShared(new THREE.BoxGeometry(0.07, 0.30, 0.05)),
    spot:  _addShared(new THREE.BoxGeometry(0.09, 0.09, 0.09)),
  };

  // truck: cabin box, cargo bed, 2 side walls, rear wall
  _tGeos = {
    cab:    _addShared(new THREE.BoxGeometry(BODY_W * 1.02, BODY_H * 1.35, BODY_D * 0.42)),
    bed:    _addShared(new THREE.BoxGeometry(BODY_W * 1.02, BODY_H * 0.65, BODY_D * 0.52)),
    wallS:  _addShared(new THREE.BoxGeometry(0.06, BODY_H * 0.50, BODY_D * 0.52)),
    wallR:  _addShared(new THREE.BoxGeometry(BODY_W * 1.02, BODY_H * 0.50, 0.06)),
  };

  // tank: flat body, side treads, turret base, dome, barrel, front armor
  _kGeos = {
    body:    _addShared(new THREE.BoxGeometry(BODY_W,        BODY_H * 0.70, BODY_D)),
    tread:   _addShared(new THREE.BoxGeometry(0.30,          BODY_H,        BODY_D * 1.10)),
    turBase: _addShared(new THREE.BoxGeometry(BODY_W * 0.78, BODY_H * 0.38, BODY_W * 0.78)),
    turDome: _addShared(new THREE.CylinderGeometry(0.40, 0.46, 0.28, 8)),
    barrel:  _addShared(new THREE.BoxGeometry(0.12, 0.10, BODY_D * 0.85)),
    armor:   _addShared(new THREE.BoxGeometry(BODY_W * 1.40, BODY_H * 0.42, 0.10)),
  };
}

// ── Material helpers ───────────────────────────────────────────────────────────

function _paintMat(hex) {
  return new THREE.MeshStandardMaterial({ color: hex, metalness: 0.40, roughness: 0.50, transparent: true, opacity: 1 });
}
function _roofMat(hex) {
  return new THREE.MeshStandardMaterial({ color: hex, metalness: 0.35, roughness: 0.55, transparent: true, opacity: 1 });
}
function _darkMat(hex = 0x1a1a1a) {
  return new THREE.MeshStandardMaterial({ color: hex, metalness: 0.20, roughness: 0.80, transparent: true, opacity: 1 });
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
    // ── Build set of live car objects ─────────────────────────────────────────
    const liveCars = new Set();
    for (const lane of this._lanes) for (const car of lane.cars) liveCars.add(car);

    // ── Retire cars that died this frame ──────────────────────────────────────
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
          t: 0,
        });
        this._live.delete(car);
      }
    }

    // ── Create / update live car visuals ──────────────────────────────────────
    for (let laneIdx = 0; laneIdx < this._lanes.length; laneIdx++) {
      for (const car of this._lanes[laneIdx].cars) {
        if (!this._live.has(car)) this._live.set(car, this._createEntry(car, laneIdx));

        const entry = this._live.get(car);
        const g     = entry.group;

        // ── Render-side position lerp ──────────────────────────────────────
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

        // ── Wheel spin based on position delta ─────────────────────────────
        if (entry.wheels.length > 0) {
          const dZ = entry.renderZ - entry.lastRenderZ;
          if (Math.abs(dZ) > 0.0001) {
            for (const w of entry.wheels) w.rotation.x -= dZ * WHEEL_SPIN_RATE;
          }
        }
        entry.lastRenderZ = entry.renderZ;

        // ── Boss ring orbit ────────────────────────────────────────────────
        if (entry.bossRing) {
          entry.bossAngle += dt * 1.8;
          const gp = g.position;
          entry.bossRing.position.set(gp.x, gp.y + 0.5, gp.z);
          entry.bossRing.rotation.y = entry.bossAngle;
          entry.bossRing.rotation.x = 0.35;
          entry.bossRingMat.emissiveIntensity = 1.2 + 0.6 * Math.sin(entry.bossAngle * 3);
        }

        // ── Tank turret rotation ───────────────────────────────────────────
        if (entry.turretGroup) {
          entry.turretGroup.rotation.y += dt * TURRET_ROT_SPEED;
        }

        const hpRatio = car.maxHp > 0 ? car.hp / car.maxHp : 0;

        // ── Damage visual state ────────────────────────────────────────────
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

        // ── HP sprite position ─────────────────────────────────────────────
        if (entry.hpMesh?.visible) {
          entry.hpMesh.position.set(g.position.x, HP_SPRITE_Y, entry.renderZ);
        }

        // ── HP change: darken all colorMats + update HP sprite + cracks ───
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

    // ── Death animations ──────────────────────────────────────────────────────
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
      d.group.children.forEach(child => {
        if (child.material && child.material !== _wheelMat) child.material.opacity = 1 - prog;
      });
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

    // Per-type geometry build
    switch (car.type) {
      case 'small':
        bodyMat = this._buildSmall(group, hex, colorMats, colorBaseHexes);
        wheels  = this._addWheels(group);
        break;
      case 'big':
        bodyMat = this._buildBig(group, hex, colorMats, colorBaseHexes);
        wheels  = this._addWheels(group);
        break;
      case 'jeep':
        bodyMat = this._buildJeep(group, hex, colorMats, colorBaseHexes);
        wheels  = this._addWheels(group);
        break;
      case 'truck':
        bodyMat = this._buildTruck(group, hex, colorMats, colorBaseHexes);
        wheels  = this._addWheels(group);
        break;
      case 'tank':
        ({ bodyMat, turretGroup } = this._buildTank(group, hex, colorMats, colorBaseHexes));
        // tank uses tread pads instead of cylinder wheels
        break;
      default:
        bodyMat = this._buildGeneric(group, hex, colorMats, colorBaseHexes);
        wheels  = this._addWheels(group);
        break;
    }

    // ── Headlights ──────────────────────────────────────────────────────────
    const headLights = [];
    const headMat    = new THREE.MeshStandardMaterial({
      color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.35,
      transparent: true, opacity: 1,
    });
    for (const hx of HEADLIGHT_XS) {
      const hl = new THREE.Mesh(_headGeo, headMat);
      hl.position.set(hx, HEADLIGHT_Y, HEADLIGHT_Z);
      group.add(hl);
      const ptLight = new THREE.PointLight(0xffffaa, car.type === 'boss' ? 0.80 : 0.30, car.type === 'boss' ? 6 : 4);
      ptLight.position.set(hx, HEADLIGHT_Y, HEADLIGHT_Z + 0.2);
      group.add(ptLight);
      headLights.push(ptLight);
    }

    // ── Type-based group scale & boss ring ──────────────────────────────────
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

    // ── HP sprite (scene-space) ─────────────────────────────────────────────
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

    // ── Smoke sprite ────────────────────────────────────────────────────────
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

    // ── Tank crack overlay ──────────────────────────────────────────────────
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
      renderZ: startZ, targetZ: startZ, lerpStartZ: startZ, lerpT: 1.0,
    };
    this._drawHpBar(entry, car);
    return entry;
  }

  // ── Per-type geometry builders ────────────────────────────────────────────────

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

  _buildSmall(group, hex, colorMats, colorBaseHexes) {
    const roofHex = darken(hex);
    const bodyMat = _paintMat(hex);
    const rMat    = _roofMat(roofHex);

    const body = new THREE.Mesh(_gGeos.body, bodyMat);
    body.castShadow = body.receiveShadow = true;
    group.add(body);
    colorMats.push(bodyMat); colorBaseHexes.push(hex);

    const roof = new THREE.Mesh(_gGeos.roof, rMat);
    roof.position.set(0, ROOF_Y, ROOF_Z);
    roof.castShadow = true;
    group.add(roof);
    colorMats.push(rMat); colorBaseHexes.push(roofHex);

    // Front lip spoiler (dark accent)
    const lipMat = _darkMat(0x141414);
    const lip    = new THREE.Mesh(_sGeos.lip, lipMat);
    lip.position.set(0, WHEEL_Y + 0.025, BODY_D / 2 - 0.04);
    group.add(lip);

    // Rear wing blade
    const wingMat = _darkMat(0x141414);
    const wing    = new THREE.Mesh(_sGeos.wing, wingMat);
    wing.position.set(0, ROOF_Y + ROOF_H / 2 + 0.07, -BODY_D / 2 + 0.05);
    group.add(wing);

    return bodyMat;
  }

  _buildBig(group, hex, colorMats, colorBaseHexes) {
    const roofHex  = darken(hex);
    const bodyMat  = _paintMat(hex);
    const cabinMat = _roofMat(roofHex);

    // Hood (front, lower)
    const hoodY = WHEEL_Y + BODY_H * 0.68 / 2;
    const hoodZ = BODY_D * 0.30;
    const hood  = new THREE.Mesh(_bGeos.hood, bodyMat);
    hood.position.set(0, hoodY, hoodZ);
    hood.castShadow = true;
    group.add(hood);
    colorMats.push(bodyMat); colorBaseHexes.push(hex);

    // Cabin (center, taller, roof-colored)
    const cabinY = WHEEL_Y + BODY_H * 1.35 / 2;
    const cabin  = new THREE.Mesh(_bGeos.cabin, cabinMat);
    cabin.position.set(0, cabinY, 0);
    cabin.castShadow = true;
    group.add(cabin);
    colorMats.push(cabinMat); colorBaseHexes.push(roofHex);

    // Trunk (rear, medium)
    const trunkY = WHEEL_Y + BODY_H * 0.78 / 2;
    const trunkZ = -BODY_D * 0.30;
    const trunk  = new THREE.Mesh(_bGeos.trunk, bodyMat);
    trunk.position.set(0, trunkY, trunkZ);
    trunk.castShadow = true;
    group.add(trunk);
    // bodyMat already in colorMats

    // Side mirrors (tiny dark boxes)
    const mirMat = _darkMat(0x222222);
    const mirY   = cabinY + BODY_H * 0.10;
    const mirZ   = BODY_D * 0.12;
    for (const sx of [-1, 1]) {
      const mir = new THREE.Mesh(_bGeos.mirror, mirMat);
      mir.position.set(sx * (BODY_W / 2 + 0.05), mirY, mirZ);
      group.add(mir);
    }

    // Antenna
    const antMat = _darkMat(0x333333);
    const ant    = new THREE.Mesh(_bGeos.antenna, antMat);
    const cabTop = cabinY + BODY_H * 1.35 / 2;
    ant.position.set(BODY_W * 0.25, cabTop + 0.13, -BODY_D * 0.05);
    group.add(ant);

    return bodyMat;
  }

  _buildJeep(group, hex, colorMats, colorBaseHexes) {
    const roofHex = darken(hex);
    const bodyMat = _paintMat(hex);
    const rMat    = _roofMat(roofHex);

    const body = new THREE.Mesh(_gGeos.body, bodyMat);
    body.castShadow = body.receiveShadow = true;
    group.add(body);
    colorMats.push(bodyMat); colorBaseHexes.push(hex);

    const roof = new THREE.Mesh(_gGeos.roof, rMat);
    roof.position.set(0, ROOF_Y, ROOF_Z);
    roof.castShadow = true;
    group.add(roof);
    colorMats.push(rMat); colorBaseHexes.push(roofHex);

    // Roof rack (2 cross bars)
    const rackMat  = _darkMat(0x333333);
    const rackTopY = ROOF_Y + ROOF_H / 2 + 0.025;
    for (const rz of [-0.15, 0.20]) {
      const bar = new THREE.Mesh(_jGeos.rack, rackMat);
      bar.position.set(0, rackTopY, rz);
      group.add(bar);
    }

    // Bull bar at front (1 horizontal + 2 vertical)
    const bullMat = _darkMat(0x2a2a2a);
    const bullZ   = BODY_D / 2 + 0.05;
    const bh      = new THREE.Mesh(_jGeos.bullH, bullMat);
    bh.position.set(0, WHEEL_Y + 0.30, bullZ);
    group.add(bh);

    for (const sx of [-1, 1]) {
      const bv = new THREE.Mesh(_jGeos.bullV, bullMat);
      bv.position.set(sx * BODY_W * 0.38, WHEEL_Y + 0.15, bullZ);
      group.add(bv);
    }

    // Roof spotlights (emissive yellow)
    const spotMat = new THREE.MeshStandardMaterial({
      color: 0xffee88, emissive: 0xffee88, emissiveIntensity: 0.6,
      transparent: true, opacity: 1,
    });
    for (const sx of [-1, 1]) {
      const spot = new THREE.Mesh(_jGeos.spot, spotMat);
      spot.position.set(sx * ROOF_W * 0.35, rackTopY + 0.05, 0.20);
      group.add(spot);
    }

    return bodyMat;
  }

  _buildTruck(group, hex, colorMats, colorBaseHexes) {
    const bedHex  = darken(hex, 0x181818);
    const bodyMat = _paintMat(hex);
    const bedMat  = _roofMat(bedHex);

    const cabD   = BODY_D * 0.42;
    const bedD   = BODY_D * 0.52;
    const cabH   = BODY_H * 1.35;
    const bedH   = BODY_H * 0.65;
    const wallH  = BODY_H * 0.50;

    const cabY  = WHEEL_Y + cabH / 2;
    const cabZ  = BODY_D / 2 - cabD / 2;           // front
    const bedY  = WHEEL_Y + bedH / 2;
    const bedZ  = -(BODY_D / 2 - bedD / 2);        // rear

    // Cabin
    const cab = new THREE.Mesh(_tGeos.cab, bodyMat);
    cab.position.set(0, cabY, cabZ);
    cab.castShadow = true;
    group.add(cab);
    colorMats.push(bodyMat); colorBaseHexes.push(hex);

    // Cargo bed
    const bed = new THREE.Mesh(_tGeos.bed, bedMat);
    bed.position.set(0, bedY, bedZ);
    group.add(bed);
    colorMats.push(bedMat); colorBaseHexes.push(bedHex);

    // Bed walls (left, right, rear)
    const wallMat = _darkMat(0x1e1e1e);
    const wallY   = bedY + bedH / 2 - wallH / 2 + 0.02;

    for (const sx of [-1, 1]) {
      const sw = new THREE.Mesh(_tGeos.wallS, wallMat);
      sw.position.set(sx * (BODY_W * 1.02 / 2 + 0.03), wallY, bedZ);
      group.add(sw);
    }
    const rw = new THREE.Mesh(_tGeos.wallR, wallMat);
    rw.position.set(0, wallY, bedZ - bedD / 2 - 0.03);
    group.add(rw);

    return bodyMat;
  }

  _buildTank(group, hex, colorMats, colorBaseHexes) {
    const turHex  = darken(hex, 0x181818);
    const bodyMat = _paintMat(hex);
    const turMat  = _roofMat(turHex);
    const darkMat = _darkMat(0x0e0e0e);

    // Main body (flat)
    const bodyH = BODY_H * 0.70;
    const tankBody = new THREE.Mesh(_kGeos.body, bodyMat);
    tankBody.position.set(0, -BODY_H / 2 + bodyH / 2, 0);
    tankBody.castShadow = tankBody.receiveShadow = true;
    group.add(tankBody);
    colorMats.push(bodyMat); colorBaseHexes.push(hex);

    // Side treads (dark rubber pads)
    const treadX = BODY_W / 2 + 0.17;
    const treadY = -BODY_H / 2 + BODY_H / 2;   // center at 0
    for (const sx of [-1, 1]) {
      const tread = new THREE.Mesh(_kGeos.tread, darkMat);
      tread.position.set(sx * treadX, treadY, 0);
      group.add(tread);
    }

    // Turret group (rotates independently)
    const turretGroup = new THREE.Group();
    const bodyTop     = -BODY_H / 2 + bodyH;    // top of tank body in local y

    const turBase = new THREE.Mesh(_kGeos.turBase, turMat);
    turBase.position.set(0, bodyTop + BODY_H * 0.38 / 2, 0);
    turretGroup.add(turBase);
    colorMats.push(turMat); colorBaseHexes.push(turHex);

    const turDome = new THREE.Mesh(_kGeos.turDome, turMat);
    turDome.position.set(0, bodyTop + BODY_H * 0.38 + 0.14, 0);
    turretGroup.add(turDome);

    // Barrel extends forward from dome center
    const barrelMat = _darkMat(0x1a1a1a);
    const barrel    = new THREE.Mesh(_kGeos.barrel, barrelMat);
    barrel.position.set(0, bodyTop + BODY_H * 0.38 + 0.12, BODY_D * 0.425 + 0.10);
    turretGroup.add(barrel);

    group.add(turretGroup);

    // Front armor plate (static)
    const armor = new THREE.Mesh(_kGeos.armor, darkMat);
    armor.position.set(0, -BODY_H * 0.12, BODY_D / 2 + 0.04);
    group.add(armor);

    return { bodyMat, turretGroup };
  }

  // ── Add shared wheels to a group and return mesh array ───────────────────────

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
