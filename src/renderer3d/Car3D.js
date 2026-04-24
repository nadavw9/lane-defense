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

// HP number — canvas and world dimensions
const HP_BAR_CANVAS_W = 40;
const HP_BAR_CANVAS_H = 26;
const HP_BAR_WIDTH    = BODY_W * 0.80;  // slightly wider to fit text
const HP_BAR_HEIGHT   = 0.28;           // taller for readable number
const HP_BAR_Y_OFFSET = 0.60;           // above car roof

// Death animation
const DEATH_DURATION  = 0.30;
const DEATH_SCALE_MAX = 1.40;
const DEATH_VY        = 2.5;             // world units/s upward pop

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
    // CarEntry = { group, bodyMat, hpCanvas, hpCtx, hpTex, hpSprite,
    //              headLights[], lastHp, laneIdx }
    this._live  = new Map();

    // Dying entries: { group, bodyMat, hpSprite, t, vy }
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
        this._dying.push({ group: entry.group, bodyMat: entry.bodyMat, hpSprite: entry.hpSprite, bossRing: entry.bossRing, bossRingMat: entry.bossRingMat, t: 0 });
        this._live.delete(car);
      }
    }

    // ── Create / update live car visuals ────────────────────────────────────
    for (let laneIdx = 0; laneIdx < this._lanes.length; laneIdx++) {
      for (const car of this._lanes[laneIdx].cars) {
        if (!this._live.has(car)) this._live.set(car, this._createEntry(car, laneIdx));

        const entry = this._live.get(car);
        const g     = entry.group;

        // Position on road.
        g.position.set(laneToX(laneIdx), CAR_Y, posToZ(car.position));

        // Keep HP sprite (scene-level, not group-child) in sync every frame.
        // Scale it inversely to Z-distance so it stays the same apparent screen
        // size at all distances (camera is at Z=16 per Scene3D.js).
        // Orthographic camera: all objects appear the same size regardless of Z.
        entry.hpSprite.scale.set(HP_BAR_WIDTH, HP_BAR_HEIGHT, 1);
        entry.hpSprite.position.set(g.position.x, CAR_Y + HP_BAR_Y_OFFSET, g.position.z);

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
          for (const hl of entry.headLights) hl.intensity = 0.30;
        } else {
          // No damage visual effects — keep cars clean and readable
          entry.bodyMat.emissive.setHex(0x000000);
          entry.bodyMat.emissiveIntensity = 0;
          entry.bodyMat.roughness = 0.50;

          // Headlight steady when healthy, dim when damaged.
          for (const hl of entry.headLights) {
            hl.intensity = hpRatio > 0.50 ? 0.30 : 0.15;
          }
        }

        // HP bar — only redraw when HP changed.
        if (car.hp !== entry.lastHp) {
          entry.lastHp = car.hp;
          this._drawHpBar(entry, car);
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
      d.hpSprite.material.opacity = 1 - prog;
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

    // ── Boss-car special treatment ────────────────────────────────────────────
    let bossRing = null;
    let bossRingMat = null;
    if (car.type === 'boss') {
      // Scale up the car body.
      group.scale.set(1.35, 1.35, 1.35);

      // Orbiting energy ring (added to scene, not group, so orbit is world-space).
      bossRingMat = new THREE.MeshStandardMaterial({
        color:             hex,
        emissive:          hex,
        emissiveIntensity: 1.5,
        transparent:       true,
        opacity:           0.75,
      });
      bossRing = new THREE.Mesh(_bossTorusGeo, bossRingMat);
      this._scene.add(bossRing);
    }

    // ── HP bar (canvas Sprite) ────────────────────────────────────────────────
    const hpCanvas = document.createElement('canvas');
    hpCanvas.width  = HP_BAR_CANVAS_W;
    hpCanvas.height = HP_BAR_CANVAS_H;
    const hpCtx = hpCanvas.getContext('2d');
    const hpTex = new THREE.CanvasTexture(hpCanvas);
    const hpMat = new THREE.SpriteMaterial({ map: hpTex, transparent: true, opacity: 1, depthTest: false });
    const hpSprite = new THREE.Sprite(hpMat);
    hpSprite.scale.set(HP_BAR_WIDTH, HP_BAR_HEIGHT, 1);
    hpSprite.position.set(0, CAR_Y + HP_BAR_Y_OFFSET, 0);
    // Layer 2: rendered AFTER the bloom+PostFX composite in a dedicated pass,
    // so the HP number is never washed out by UnrealBloomPass or VignettePass.
    hpSprite.layers.set(2);
    // Sprite is added to scene (not group) so it doesn't inherit group scale during death.
    this._scene.add(hpSprite);

    group.position.set(laneToX(laneIdx), CAR_Y, posToZ(car.position));
    this._scene.add(group);

    const entry = { group, bodyMat, hpCanvas, hpCtx, hpTex, hpSprite, headLights, lastHp: -1, laneIdx, bossRing, bossRingMat, bossAngle: 0, hexColor: hex };
    this._drawHpBar(entry, car);
    return entry;
  }

  _drawHpBar(entry, car) {
    const W = HP_BAR_CANVAS_W, H = HP_BAR_CANVAS_H;
    const { hpCtx, hpTex, hexColor } = entry;

    // Dark pill background.
    hpCtx.clearRect(0, 0, W, H);
    hpCtx.fillStyle = 'rgba(0,0,0,0.80)';
    if (hpCtx.roundRect) hpCtx.roundRect(1, 1, W - 2, H - 2, 5);
    else                 hpCtx.rect(1, 1, W - 2, H - 2);
    hpCtx.fill();

    // Colored border (car color).
    const r = ((hexColor >> 16) & 0xff).toString(16).padStart(2, '0');
    const g = ((hexColor >>  8) & 0xff).toString(16).padStart(2, '0');
    const b = ( hexColor        & 0xff).toString(16).padStart(2, '0');
    hpCtx.strokeStyle = `#${r}${g}${b}`;
    hpCtx.lineWidth   = 2;
    hpCtx.stroke();

    // HP number centered.
    hpCtx.font         = `bold ${H - 4}px Arial`;
    hpCtx.fillStyle    = '#ffffff';
    hpCtx.textAlign    = 'center';
    hpCtx.textBaseline = 'middle';
    hpCtx.shadowColor  = 'rgba(0,0,0,0.9)';
    hpCtx.shadowBlur   = 3;
    hpCtx.fillText(String(car.hp), W / 2, H / 2);

    hpTex.needsUpdate = true;
  }

  _disposeDying(d) {
    this._disposeGroup(d.group);
    d.hpSprite.material.map?.dispose();
    d.hpSprite.material.dispose();
    this._scene.remove(d.hpSprite);
    if (d.bossRing) {
      d.bossRingMat?.dispose();
      this._scene.remove(d.bossRing);
    }
  }

  _disposeEntry(entry) {
    this._disposeGroup(entry.group);
    entry.hpTex.dispose();
    entry.hpSprite.material.map?.dispose();
    entry.hpSprite.material.dispose();
    this._scene.remove(entry.hpSprite);
    if (entry.bossRing) {
      entry.bossRingMat?.dispose();
      this._scene.remove(entry.bossRing);
    }
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
