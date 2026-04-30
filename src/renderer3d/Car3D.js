// Car3D — manages all live car meshes in the 3D road scene.
//
// Mirrors the role of CarRenderer.js but produces THREE.Group objects instead
// of PixiJS containers.  Reads lanes[] from GameState every frame — never
// writes to game state.
//
// Each car group contains:
//   • body    — BoxGeometry, PBR material (car colour, metalness 0.4)
//   • roof    — BoxGeometry, slightly darker
//   • 4 wheels — CylinderGeometry, black rubber
//   • 2 headlights — small emissive box + dim PointLight
//   • HP bar   — THREE.Sprite above car, canvas texture updated on HP change
//
// Death animation (0.30 s):
//   car pops upward (Y velocity), scales x1.4, alpha → 0

import * as THREE from 'three';
import { posToZ, laneToX } from './Scene3D.js';
import { CAR_TYPES } from '../director/CarTypes.js';

// ── Car geometry dimensions (world units) ─────────────────────────────────────
const BODY_W = 1.50;
const BODY_H = 0.42;
const BODY_D = 2.10;

const ROOF_W = 0.95;
const ROOF_H = 0.30;
const ROOF_D = 1.15;
const ROOF_Y = BODY_H / 2 + ROOF_H / 2;          // sits on top of body
const ROOF_Z = -0.15;                              // slightly rearward

const WHEEL_R = 0.22;
const WHEEL_L = 0.14;    // axle length (thin disc)
const WHEEL_Y = -(BODY_H / 2);
const WHEEL_OFFSETS = [
  [-BODY_W / 2 - WHEEL_L / 2,  WHEEL_Y,  BODY_D / 2 - 0.30],  // front-left
  [ BODY_W / 2 + WHEEL_L / 2,  WHEEL_Y,  BODY_D / 2 - 0.30],  // front-right
  [-BODY_W / 2 - WHEEL_L / 2,  WHEEL_Y, -BODY_D / 2 + 0.30],  // rear-left
  [ BODY_W / 2 + WHEEL_L / 2,  WHEEL_Y, -BODY_D / 2 + 0.30],  // rear-right
];

const HEADLIGHT_W = 0.18;
const HEADLIGHT_H = 0.10;
const HEADLIGHT_D = 0.08;
const HEADLIGHT_Z  = BODY_D / 2 + HEADLIGHT_D / 2;
const HEADLIGHT_Y  = BODY_H * 0.05;
const HEADLIGHT_XS = [-0.42, 0.42];

// Car sits with its bottom at Y = 0 (road surface).
const CAR_Y = BODY_H / 2 + WHEEL_R;

// HP sprite — scene-space Sprite above car, only shown when HP < maxHp.
const HP_CANVAS_W = 64;
const HP_CANVAS_H = 28;
const HP_SPRITE_W = 0.55;   // world-unit sprite width
const HP_SPRITE_H = 0.24;   // world-unit sprite height
const HP_SPRITE_Y = CAR_Y + BODY_H + 0.7;  // world Y above car

// Death animation
const DEATH_DURATION  = 0.30;
const DEATH_SCALE_MAX = 1.40;
const DEATH_VY        = 2.5;             // world units/s upward pop

// Render-side movement lerp (row jumps smooth over this duration)
const LERP_DURATION = 0.45;   // seconds
const MAX_TILT_X    = 0.20;   // radians forward lean at peak of lerp

// First-encounter callout sprite animation phases (seconds)
const CALLOUT_IN    = 0.25;
const CALLOUT_HOLD  = 2.50;
const CALLOUT_OUT   = 0.40;
const CALLOUT_TOTAL = CALLOUT_IN + CALLOUT_HOLD + CALLOUT_OUT;
const CALLOUT_SPRITE_W = 2.4;   // world-unit sprite width
const CALLOUT_SPRITE_H = 0.9;   // world-unit sprite height

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

// Slightly darken a hex colour for the roof.
function darken(hex, amount = 0x282828) {
  const r = Math.max(0, ((hex >> 16) & 0xff) - ((amount >> 16) & 0xff));
  const g = Math.max(0, ((hex >>  8) & 0xff) - ((amount >>  8) & 0xff));
  const b = Math.max(0, ( hex        & 0xff) - ( amount        & 0xff));
  return (r << 16) | (g << 8) | b;
}

// ── Shared geometry / material cache (created once, reused) ───────────────────
let _bodyGeo    = null;
let _roofGeo    = null;
let _wheelGeo   = null;
let _headGeo    = null;
let _wheelMat   = null;
let _bossTorusGeo = null;   // orbiting ring for boss cars

function sharedGeo() {
  if (!_bodyGeo) {
    _bodyGeo      = new THREE.BoxGeometry(BODY_W, BODY_H, BODY_D);
    _roofGeo      = new THREE.BoxGeometry(ROOF_W, ROOF_H, ROOF_D);
    _wheelGeo     = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, WHEEL_L, 10);
    _headGeo      = new THREE.BoxGeometry(HEADLIGHT_W, HEADLIGHT_H, HEADLIGHT_D);
    _bossTorusGeo = new THREE.TorusGeometry(1.4, 0.06, 8, 28);
    _wheelMat     = new THREE.MeshStandardMaterial({
      color:       0x111111,
      roughness:   0.9,
      metalness:   0.1,
      transparent: true,
      opacity:     1,
    });
  }
}

// ── Car3D class ───────────────────────────────────────────────────────────────

export class Car3D {
  /**
   * @param {THREE.Scene} scene
   * @param {Array}       lanes  — live ref to gs.lanes
   */
  constructor(scene, lanes) {
    this._scene   = scene;
    this._lanes   = lanes;

    // Map<Car object, CarEntry>
    this._live  = new Map();

    // Dying entries: { group, bodyMat, hpTex, bossRing, bossRingMat, t }
    this._dying = [];

    // First-encounter callout: types seen this level session.
    this._seenTypes = new Set();

    sharedGeo();
  }

  // ── Public ───────────────────────────────────────────────────────────────────

  clearAll() {
    for (const entry of this._live.values()) this._disposeEntry(entry);
    this._live.clear();
    for (const d of this._dying) this._disposeDying(d);
    this._dying.length = 0;
    this._seenTypes.clear();
  }

  /**
   * Sync 3D meshes to current GameState.
   * @param {number}  dt        frame delta time (seconds)
   * @param {boolean} isFrozen  freeze-booster active?
   */
  update(dt, isFrozen = false) {
    // ── Build set of live car objects ───────────────────────────────────────
    const liveCars = new Set();
    for (const lane of this._lanes) for (const car of lane.cars) liveCars.add(car);

    // ── Retire cars that died this frame ────────────────────────────────────
    for (const [car, entry] of this._live) {
      if (!liveCars.has(car)) {
        // Scene-space sprites (HP, callout) — remove immediately on death.
        if (entry.hpMesh) {
          entry.hpMesh.material.map?.dispose();
          entry.hpMesh.material.dispose();
          this._scene.remove(entry.hpMesh);
        }
        if (entry.calloutMesh) {
          entry.calloutMesh.material.map?.dispose();
          entry.calloutMesh.material.dispose();
          this._scene.remove(entry.calloutMesh);
        }
        this._dying.push({ group: entry.group, bodyMat: entry.bodyMat, hpTex: entry.hpTex, smokeTex: entry.smokeTex, crackTex: entry.crackTex, bossRing: entry.bossRing, bossRingMat: entry.bossRingMat, t: 0 });
        this._live.delete(car);
      }
    }

    // ── Create / update live car visuals ────────────────────────────────────
    for (let laneIdx = 0; laneIdx < this._lanes.length; laneIdx++) {
      for (const car of this._lanes[laneIdx].cars) {
        if (!this._live.has(car)) this._live.set(car, this._createEntry(car, laneIdx));

        const entry = this._live.get(car);
        const g     = entry.group;

        // ── Render-side position lerp (row jump → smooth glide) ────────────
        const newTargetZ = posToZ(car.position);
        if (Math.abs(newTargetZ - entry.targetZ) > 0.001) {
          entry.lerpStartZ = entry.renderZ;
          entry.targetZ    = newTargetZ;
          entry.lerpT      = 0;
        }
        if (entry.lerpT < 1) {
          entry.lerpT   = Math.min(1, entry.lerpT + dt / LERP_DURATION);
          const eased   = 1 - Math.pow(1 - entry.lerpT, 3); // easeOutCubic
          entry.renderZ = entry.lerpStartZ + (entry.targetZ - entry.lerpStartZ) * eased;
          // Forward tilt peaks at mid-lerp and returns to zero at landing.
          g.rotation.x  = -MAX_TILT_X * Math.sin(Math.PI * entry.lerpT);
        } else {
          entry.renderZ = entry.targetZ;
          g.rotation.x  = 0;
        }
        g.position.set(laneToX(laneIdx), CAR_Y, entry.renderZ);

        // HP plane is a child of the group — position sync is automatic.

        // ── Boss ring orbit ─────────────────────────────────────────────────
        if (entry.bossRing) {
          entry.bossAngle += dt * 1.8;
          const gp = g.position;
          entry.bossRing.position.set(gp.x, gp.y + 0.5, gp.z);
          entry.bossRing.rotation.y = entry.bossAngle;
          entry.bossRing.rotation.x = 0.35;   // tilted for visual interest
          // Pulse ring emissive.
          entry.bossRingMat.emissiveIntensity = 1.2 + 0.6 * Math.sin(entry.bossAngle * 3);
        }

        const hpRatio = car.maxHp > 0 ? car.hp / car.maxHp : 0;

        // ── Damage visual state (overrides freeze tint) ─────────────────────
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
          entry.bodyMat.roughness = 0.50;
          g.rotation.z = 0;
          for (const hl of entry.headLights) hl.intensity = 0.30;
          if (entry.smokeMesh) entry.smokeMesh.visible = false;
        }

        // HP sprite — update position each frame; show only when damaged.
        if (entry.hpMesh) {
          if (entry.hpMesh.visible) {
            entry.hpMesh.position.set(g.position.x, HP_SPRITE_Y, entry.renderZ);
          }
        }

        // HP-change: body darkening + HP sprite visibility + crack stage.
        if (car.hp !== entry.lastHp) {
          entry.lastHp = car.hp;
          const mult   = 0.55 + 0.45 * hpRatio;
          const origHex = entry.hexColor;
          entry.bodyMat.color.setRGB(
            Math.round(((origHex >> 16) & 0xff) * mult) / 255,
            Math.round(((origHex >>  8) & 0xff) * mult) / 255,
            Math.round(( origHex        & 0xff) * mult) / 255,
          );
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

        // ── Callout sprite (scene-level, tracks car world position) ──────────
        if (entry.calloutMesh && entry.calloutT >= 0 && entry.calloutT < CALLOUT_TOTAL) {
          entry.calloutT += dt;
          const t       = Math.min(CALLOUT_TOTAL, entry.calloutT);
          const worldX  = g.position.x;
          const worldZ  = entry.renderZ;

          if (t < CALLOUT_IN) {
            const prog = t / CALLOUT_IN;
            const sc   = 0.5 + 0.5 * prog;
            entry.calloutMesh.material.opacity = prog;
            entry.calloutMesh.scale.set(CALLOUT_SPRITE_W * sc, CALLOUT_SPRITE_H * sc, 1);
            entry.calloutMesh.position.set(worldX, CAR_Y + BODY_H + 1.6, worldZ);
          } else if (t < CALLOUT_IN + CALLOUT_HOLD) {
            entry.calloutMesh.material.opacity = 1;
            entry.calloutMesh.scale.set(CALLOUT_SPRITE_W, CALLOUT_SPRITE_H, 1);
            entry.calloutMesh.position.set(worldX, CAR_Y + BODY_H + 1.6, worldZ);
          } else {
            const prog = (t - CALLOUT_IN - CALLOUT_HOLD) / CALLOUT_OUT;
            entry.calloutMesh.material.opacity = 1 - prog;
            entry.calloutMesh.position.set(worldX, CAR_Y + BODY_H + 1.6 + prog * 0.5, worldZ);
          }

          if (entry.calloutT >= CALLOUT_TOTAL) {
            entry.calloutMesh.visible = false;
          }
        }

      }
    }

    // ── Advance death animations ─────────────────────────────────────────────
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
      // Fade all per-car materials; skip the shared _wheelMat to avoid corrupting
      // wheel opacity on live cars (which share the same material instance).
      d.group.children.forEach(child => {
        if (child.material && child.material !== _wheelMat) child.material.opacity = 1 - prog;
      });
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _createEntry(car, laneIdx) {
    const hex     = carHex(car);
    const group   = new THREE.Group();

    // ── Body ─────────────────────────────────────────────────────────────────
    const bodyMat = new THREE.MeshStandardMaterial({
      color:       hex,
      metalness:   0.40,
      roughness:   0.50,
      transparent: true,
      opacity:     1,
    });
    const body = new THREE.Mesh(_bodyGeo, bodyMat);
    body.castShadow    = true;
    body.receiveShadow = true;
    group.add(body);

    // ── Roof ─────────────────────────────────────────────────────────────────
    const roofMat = new THREE.MeshStandardMaterial({
      color:       darken(hex),
      metalness:   0.35,
      roughness:   0.55,
      transparent: true,
      opacity:     1,
    });
    const roof = new THREE.Mesh(_roofGeo, roofMat);
    roof.position.set(0, ROOF_Y, ROOF_Z);
    roof.castShadow = true;
    group.add(roof);

    // ── Wheels ───────────────────────────────────────────────────────────────
    for (const [wx, wy, wz] of WHEEL_OFFSETS) {
      const wheel = new THREE.Mesh(_wheelGeo, _wheelMat);
      wheel.rotation.z = Math.PI / 2;   // axle along X
      wheel.position.set(wx, wy, wz);
      wheel.castShadow = true;
      group.add(wheel);
    }

    // ── Headlights ───────────────────────────────────────────────────────────
    const headLights = [];
    const headMat    = new THREE.MeshStandardMaterial({
      color:             0xffffcc,
      emissive:          0xffffcc,
      emissiveIntensity: 0.35,   // below bloom threshold (0.55) — lights visible but don't bloom yellow
      transparent: true,
      opacity: 1,
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

    // ── Type-based geometry scale ─────────────────────────────────────────────
    let bossRing = null;
    let bossRingMat = null;
    if (car.type === 'boss') {
      group.scale.set(1.35, 1.35, 1.35);
      bossRingMat = new THREE.MeshStandardMaterial({
        color:             hex,
        emissive:          hex,
        emissiveIntensity: 1.5,
        transparent:       true,
        opacity:           0.75,
      });
      bossRing = new THREE.Mesh(_bossTorusGeo, bossRingMat);
      this._scene.add(bossRing);
    } else {
      const td = CAR_TYPES[car.type];
      if (td) group.scale.set(td.scaleX, td.scaleY, td.scaleZ);
    }

    // ── HP sprite — scene-space, visible only when damaged ────────────────────
    const hpCanvas = document.createElement('canvas');
    hpCanvas.width  = HP_CANVAS_W;
    hpCanvas.height = HP_CANVAS_H;
    const hpCtx = hpCanvas.getContext('2d');
    const hpTex = new THREE.CanvasTexture(hpCanvas);
    const hpMat = new THREE.SpriteMaterial({ map: hpTex, transparent: true, depthTest: false });
    const hpMesh = new THREE.Sprite(hpMat);
    hpMesh.scale.set(HP_SPRITE_W, HP_SPRITE_H, 1);
    hpMesh.visible = false;   // shown only when hp < maxHp
    this._scene.add(hpMesh);

    // ── Smoke sprite (visible when HP < 50%) ──────────────────────────────────
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
    smokeMesh.rotation.x = -Math.PI / 2;   // lies flat on road plane — visible from above
    smokeMesh.position.set(0, BODY_H + 0.08, 0);
    smokeMesh.visible = false;
    group.add(smokeMesh);

    // ── First-encounter callout — Sprite always faces camera ─────────────────
    let calloutMesh = null;   // THREE.Sprite (naming kept for disposal compat)
    let calloutT    = -1;     // -1 = no callout, 0..CALLOUT_TOTAL = animating
    const typeDef = CAR_TYPES[car.type];
    if (typeDef && !this._seenTypes.has(car.type)) {
      this._seenTypes.add(car.type);
      calloutMesh = this._createCalloutSprite(typeDef, hex);
      // Added to scene directly (not group) so group.scale doesn't distort it.
      const startPos = group.position;
      calloutMesh.position.set(startPos.x, CAR_Y + BODY_H + 1.6, startPos.z);
      calloutMesh.material.opacity = 0;
      calloutMesh.scale.set(CALLOUT_SPRITE_W * 0.5, CALLOUT_SPRITE_H * 0.5, 1);
      this._scene.add(calloutMesh);
      calloutT = 0;
    }

    // ── Tank crack overlay (4 damage stages on car roof) ─────────────────────
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
      group, bodyMat, hpCanvas, hpCtx, hpTex, hpMesh, headLights,
      lastHp: -1, lastCrackStage: -1,
      laneIdx, bossRing, bossRingMat, bossAngle: 0, hexColor: hex,
      smokeMesh, smokeTex, crackCanvas, crackCtx, crackTex, crackMesh,
      calloutMesh, calloutT,
      renderZ: startZ, targetZ: startZ, lerpStartZ: startZ, lerpT: 1.0,
    };
    this._drawHpBar(entry, car);
    return entry;
  }

  _drawHpBar(entry, car) {
    const W = HP_CANVAS_W, H = HP_CANVAS_H;
    const { hpCtx, hpTex, hexColor } = entry;

    hpCtx.clearRect(0, 0, W, H);

    // Semi-transparent dark background
    hpCtx.fillStyle = 'rgba(0,0,0,0.70)';
    if (hpCtx.roundRect) hpCtx.roundRect(1, 1, W - 2, H - 2, 4);
    else                 hpCtx.rect(1, 1, W - 2, H - 2);
    hpCtx.fill();

    // Bold HP number in white, centered
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
    if (entry.calloutMesh) {
      entry.calloutMesh.material.map?.dispose();
      entry.calloutMesh.material.dispose();
      this._scene.remove(entry.calloutMesh);
    }
    this._disposeGroup(entry.group);
    if (entry.bossRing) {
      entry.bossRingMat?.dispose();
      this._scene.remove(entry.bossRing);
    }
  }

  _drawCracks(ctx, stage) {
    ctx.clearRect(0, 0, 64, 64);
    if (stage === 0) return;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth   = stage >= 3 ? 2.5 : 1.8;
    // Four radial crack lines emanating from center; add more per stage.
    const lines = [
      [[32,32],[14,12],[6,22]],
      [[32,32],[52,14],[60,26]],
      [[32,32],[20,54],[12,58]],
      [[32,32],[50,52],[56,46]],
    ];
    const count = stage;
    for (let i = 0; i < count; i++) {
      const pts = lines[i];
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
      ctx.stroke();
    }
  }

  _createCalloutSprite(typeDef, colorHex) {
    const W = 256, H = 96;
    const cvs = document.createElement('canvas');
    cvs.width = W; cvs.height = H;
    const ctx = cvs.getContext('2d');

    // White pill background
    ctx.fillStyle = '#ffffff';
    if (ctx.roundRect) ctx.roundRect(3, 3, W - 6, H - 6, 22);
    else               ctx.rect(3, 3, W - 6, H - 6);
    ctx.fill();

    // Colored border (matches car color)
    const r = (colorHex >> 16) & 0xff;
    const g = (colorHex >>  8) & 0xff;
    const b =  colorHex        & 0xff;
    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.lineWidth   = 5;
    if (ctx.roundRect) ctx.roundRect(3, 3, W - 6, H - 6, 22);
    else               ctx.rect(3, 3, W - 6, H - 6);
    ctx.stroke();

    // Type label
    ctx.font         = 'bold 30px Arial';
    ctx.fillStyle    = '#111111';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typeDef.label, W / 2, H * 0.35);

    // HP info
    ctx.font      = 'bold 22px Arial';
    ctx.fillStyle = '#444444';
    ctx.fillText(`❤ ${typeDef.hp} HP`, W / 2, H * 0.72);

    const tex = new THREE.CanvasTexture(cvs);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    return new THREE.Sprite(mat);
  }

  _disposeGroup(group) {
    group.traverse(obj => {
      // Skip shared module-level geometries — they must not be GPU-freed
      // until the Car3D class itself is destroyed (handled by clearAll when
      // the level ends and a new Car3D is created).
      const isSharedGeo = obj.geometry &&
        (obj.geometry === _bodyGeo || obj.geometry === _roofGeo ||
         obj.geometry === _wheelGeo || obj.geometry === _headGeo ||
         obj.geometry === _bossTorusGeo);

      if (!isSharedGeo && obj.geometry) obj.geometry.dispose();

      if (obj.material) {
        // Skip the shared wheel material.
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m !== _wheelMat) m.dispose();
        }
      }
    });
    this._scene.remove(group);
  }
}
