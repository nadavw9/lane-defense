// Shooter3D — 3D bomb shapes in the shooter viewport (top-down orthographic camera).
//
// Each shooter appears as a classic bomb:
//   • Base disc  — flat cylinder, dark (sits on ground)
//   • Body       — sphere, shooter colour
//   • Fuse       — thin cylinder pointing straight up from sphere top
//   • Spark      — small emissive sphere at fuse tip
//   • Ring       — equatorial TorusGeometry, colour-matched emissive glow
//
// Viewed from the top-down shooter camera the bomb looks like a colored circle
// with a ring around it and a fuse tip — immediately recognisable as a bomb.
//
// Animations:
//   • Idle bounce  — gentle Y oscillation (±0.06 units at 2.4 Hz)
//   • Deploy punch — scale 1.30 → 1.0 over 0.15 s

import * as THREE from 'three';
import { laneToX } from './Scene3D.js';

// ── Bomb dimensions ───────────────────────────────────────────────────────────
const BASE_R     = 0.44;   // base disc radius
const BASE_H     = 0.06;   // base disc height
const BODY_R     = 0.34;   // sphere body radius
const FUSE_R     = 0.05;   // fuse cylinder radius
const FUSE_H     = 0.44;   // fuse length
const TORUS_R    = 0.34;   // equatorial ring major radius
const TORUS_TUBE = 0.05;   // equatorial ring tube radius
const SPARK_R    = 0.08;   // spark sphere at fuse tip

const TURRET_Y   = BASE_H + BODY_R;   // group Y: base on ground, sphere centred at BODY_R

const TURRET_Z   = -1.5;
const SLOT1_Z    = -0.5;
const SLOT2_Z    =  0.5;
const SLOT3_Z    =  1.4;
const SLOT_SCALE =  1.0;

const BOUNCE_AMP   = 0.06;
const BOUNCE_SPEED = 2.4;
const PUNCH_DURATION = 0.15;
const PUNCH_SCALE    = 1.30;

function easeOut(t) { return 1 - Math.pow(1 - Math.min(t, 1), 3); }

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
let _baseGeo  = null;
let _bodyGeo  = null;
let _fuseGeo  = null;
let _torusGeo = null;
let _sparkGeo = null;
let _baseMat  = null;
let _sparkMat = null;

function sharedGeo() {
  if (!_baseGeo) {
    _baseGeo  = new THREE.CylinderGeometry(BASE_R, BASE_R, BASE_H, 16);
    _bodyGeo  = new THREE.SphereGeometry(BODY_R, 18, 12);
    _fuseGeo  = new THREE.CylinderGeometry(FUSE_R, FUSE_R * 0.7, FUSE_H, 8);
    _torusGeo = new THREE.TorusGeometry(TORUS_R, TORUS_TUBE, 8, 24);
    _sparkGeo = new THREE.SphereGeometry(SPARK_R, 8, 6);
    _baseMat  = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.8, metalness: 0.2 });
    _sparkMat = new THREE.MeshStandardMaterial({
      color: 0xffdd44, emissive: 0xffdd44, emissiveIntensity: 1.5,
      roughness: 0.3,
    });
  }
}

export class Shooter3D {
  constructor(scene, columns) {
    this._scene   = scene;
    this._columns = columns;
    sharedGeo();
    this._turrets = [];
    for (let i = 0; i < LANE_COUNT; i++) this._turrets.push(this._createTurret(i));
    this._elapsed = 0;
  }

  // ── Public ───────────────────────────────────────────────────────────────────

  triggerPunch(colIdx) {
    if (colIdx < 0 || colIdx >= this._turrets.length) return;
    const t = this._turrets[colIdx];
    t.punchActive = true;
    t.punchT      = 0;
  }

  update(dt, elapsed) {
    this._elapsed = elapsed;
    const bounce  = Math.sin(elapsed * BOUNCE_SPEED) * BOUNCE_AMP;

    for (let i = 0; i < LANE_COUNT; i++) {
      const col    = this._columns[i];
      const turret = this._turrets[i];
      const top    = col.top();

      if (!top) {
        turret.group.visible = false;
        turret.slot1.group.visible = false;
        turret.slot2.group.visible = false;
        turret.slot3.group.visible = false;
        turret.numSprite0.sprite.visible        = false;
        turret.slot1.numSprite.sprite.visible   = false;
        turret.slot2.numSprite.sprite.visible   = false;
        turret.slot3.numSprite.sprite.visible   = false;
        continue;
      }

      // Show main bomb.
      turret.group.visible = true;

      // Colour sync.
      const hex = COLOR_HEX[top.color] ?? 0x888888;
      if (turret.lastColor !== hex) {
        turret.lastColor = hex;
        turret.bodyMat.color.setHex(hex);
        turret.ringMat.color.setHex(hex);
        turret.ringMat.emissive.setHex(hex);
      }
      this._refreshNumberSprite(turret.numSprite0, top.damage ?? 1, hex);
      turret.numSprite0.sprite.visible = true;

      // Queue slots.
      const s1 = col.shooters?.[1];
      const s2 = col.shooters?.[2];
      const s3 = col.shooters?.[3];
      const h1 = s1 ? (COLOR_HEX[s1.color] ?? 0x888888) : null;
      const h2 = s2 ? (COLOR_HEX[s2.color] ?? 0x888888) : null;
      const h3 = s3 ? (COLOR_HEX[s3.color] ?? 0x888888) : null;

      turret.slot1.group.visible = !!s1;
      turret.slot2.group.visible = !!s2;
      turret.slot3.group.visible = !!s3;

      if (s1 && turret.slot1.lastColor !== h1) {
        turret.slot1.lastColor = h1;
        turret.slot1.bodyMat.color.setHex(h1);
        turret.slot1.ringMat.color.setHex(h1);
        turret.slot1.ringMat.emissive.setHex(h1);
      }
      if (turret.slot1.group.visible)
        this._refreshNumberSprite(turret.slot1.numSprite, s1.damage ?? 1, h1);
      turret.slot1.numSprite.sprite.visible = !!s1;

      if (s2 && turret.slot2.lastColor !== h2) {
        turret.slot2.lastColor = h2;
        turret.slot2.bodyMat.color.setHex(h2);
        turret.slot2.ringMat.color.setHex(h2);
        turret.slot2.ringMat.emissive.setHex(h2);
      }
      if (turret.slot2.group.visible)
        this._refreshNumberSprite(turret.slot2.numSprite, s2.damage ?? 1, h2);
      turret.slot2.numSprite.sprite.visible = !!s2;

      if (s3 && turret.slot3.lastColor !== h3) {
        turret.slot3.lastColor = h3;
        turret.slot3.bodyMat.color.setHex(h3);
        turret.slot3.ringMat.color.setHex(h3);
        turret.slot3.ringMat.emissive.setHex(h3);
      }
      if (turret.slot3.group.visible)
        this._refreshNumberSprite(turret.slot3.numSprite, s3.damage ?? 1, h3);
      turret.slot3.numSprite.sprite.visible = !!s3;

      // Idle bounce.
      if (turret.punchActive) {
        turret.punchT += dt;
        const prog = Math.min(1, turret.punchT / PUNCH_DURATION);
        const s    = PUNCH_SCALE - (PUNCH_SCALE - 1) * easeOut(prog);
        turret.group.scale.set(s, s, s);
        turret.group.position.y = TURRET_Y;
        if (turret.punchT >= PUNCH_DURATION) {
          turret.punchActive = false;
          turret.group.scale.set(1, 1, 1);
        }
      } else {
        turret.group.position.y = TURRET_Y + bounce;
        turret.ringMat.emissiveIntensity = 0.4 + 0.2 * Math.sin(elapsed * 3.0);
      }
    }
  }

  // ── Number sprites ────────────────────────────────────────────────────────────

  _makeNumberSprite(damage, hexColor, z) {
    const W = 128, H = 64;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx    = canvas.getContext('2d');
    const mat    = new THREE.SpriteMaterial({ map: null, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.6, 0.8, 1);
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
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    if (ctx.roundRect) ctx.roundRect(2, 2, W - 4, H - 4, 10);
    else               ctx.rect(2, 2, W - 4, H - 4);
    ctx.fill();
    const r = ((hexColor >> 16) & 0xff).toString(16).padStart(2,'0');
    const g = ((hexColor >>  8) & 0xff).toString(16).padStart(2,'0');
    const b = ( hexColor        & 0xff).toString(16).padStart(2,'0');
    ctx.strokeStyle = `#${r}${g}${b}`;
    ctx.lineWidth   = 4;
    ctx.stroke();
    ctx.font         = `bold ${H - 8}px Arial`;
    ctx.fillStyle    = '#ffffff';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur   = 6;
    ctx.fillText(String(damage), W / 2, H / 2);
    if (mat.map) mat.map.dispose();
    mat.map = new THREE.CanvasTexture(canvas);
  }

  dispose() {
    for (const t of this._turrets) {
      t.numSprite0?.mat?.map?.dispose();
      t.numSprite0?.mat?.dispose();
      this._scene.remove(t.numSprite0?.sprite);
      for (const slot of [t.slot1, t.slot2, t.slot3]) {
        slot.numSprite?.mat?.map?.dispose();
        slot.numSprite?.mat?.dispose();
        this._scene.remove(slot.numSprite?.sprite);
        slot.group.traverse(obj => {
          if (obj.geometry && obj.geometry !== _baseGeo && obj.geometry !== _bodyGeo &&
              obj.geometry !== _fuseGeo && obj.geometry !== _torusGeo &&
              obj.geometry !== _sparkGeo) obj.geometry.dispose();
          if (obj.material && obj.material !== _baseMat && obj.material !== _sparkMat)
            obj.material.dispose();
        });
        this._scene.remove(slot.group);
      }
      t.group.traverse(obj => {
        const shared = obj.geometry && (
          obj.geometry === _baseGeo || obj.geometry === _bodyGeo ||
          obj.geometry === _fuseGeo || obj.geometry === _torusGeo ||
          obj.geometry === _sparkGeo);
        if (!shared && obj.geometry) obj.geometry.dispose();
        if (obj.material && obj.material !== _baseMat && obj.material !== _sparkMat)
          obj.material.dispose();
      });
      this._scene.remove(t.group);
    }
    _baseGeo = _bodyGeo = _fuseGeo = _torusGeo = _sparkGeo = _baseMat = _sparkMat = null;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _createTurret(laneIdx) {
    const group = new THREE.Group();
    group.position.set(laneToX(laneIdx), TURRET_Y, TURRET_Z);

    // Base disc.
    const base = new THREE.Mesh(_baseGeo, _baseMat);
    base.position.y = -BODY_R;
    group.add(base);

    // Sphere body (colored).
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x888888, metalness: 0.4, roughness: 0.45,
    });
    const body = new THREE.Mesh(_bodyGeo, bodyMat);
    body.castShadow = true;
    group.add(body);

    // Fuse (thin cylinder, points straight up).
    const fuse = new THREE.Mesh(_fuseGeo, _baseMat);
    fuse.position.y = BODY_R + FUSE_H * 0.5;
    group.add(fuse);

    // Spark at fuse tip.
    const spark = new THREE.Mesh(_sparkGeo, _sparkMat);
    spark.position.y = BODY_R + FUSE_H;
    group.add(spark);

    // Equatorial ring (emissive, colour-matched).
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x888888, emissive: 0x888888, emissiveIntensity: 0.4,
      roughness: 0.4, metalness: 0.1,
    });
    const ring = new THREE.Mesh(_torusGeo, ringMat);
    ring.rotation.x = Math.PI / 2;  // lie flat around equator
    group.add(ring);

    this._scene.add(group);

    // Damage number sprite.
    const numSprite0 = this._makeNumberSprite(1, 0x888888, TURRET_Z);
    numSprite0.sprite.position.set(laneToX(laneIdx), TURRET_Y + BODY_R + FUSE_H + 0.5, TURRET_Z);
    this._scene.add(numSprite0.sprite);

    const slot1 = this._createQueueSlot(laneIdx, SLOT1_Z);
    const slot2 = this._createQueueSlot(laneIdx, SLOT2_Z);
    const slot3 = this._createQueueSlot(laneIdx, SLOT3_Z);

    group.traverse(obj => obj.layers.set(1));
    slot1.group.traverse(obj => obj.layers.set(1));
    slot2.group.traverse(obj => obj.layers.set(1));
    slot3.group.traverse(obj => obj.layers.set(1));

    return {
      group, bodyMat, ringMat, numSprite0, slot1, slot2, slot3,
      lastColor:   -1,
      punchActive: false,
      punchT:      0,
    };
  }

  _createQueueSlot(laneIdx, worldZ) {
    const group = new THREE.Group();
    group.position.set(laneToX(laneIdx), TURRET_Y, worldZ);

    const base = new THREE.Mesh(_baseGeo, _baseMat);
    base.position.y = -BODY_R;
    group.add(base);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x888888, metalness: 0.4, roughness: 0.45,
      transparent: true, opacity: 0.85,
    });
    group.add(new THREE.Mesh(_bodyGeo, bodyMat));

    const fuse = new THREE.Mesh(_fuseGeo, _baseMat);
    fuse.position.y = BODY_R + FUSE_H * 0.5;
    group.add(fuse);

    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x888888, emissive: 0x888888, emissiveIntensity: 0.3,
      roughness: 0.4, transparent: true, opacity: 0.85,
    });
    const ring = new THREE.Mesh(_torusGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    this._scene.add(group);

    const numSprite = this._makeNumberSprite(1, 0x888888, worldZ);
    numSprite.sprite.position.set(laneToX(laneIdx), TURRET_Y + BODY_R + FUSE_H + 0.5, worldZ);
    this._scene.add(numSprite.sprite);

    return { group, bodyMat, ringMat, lastColor: -1, numSprite };
  }
}
