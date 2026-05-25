// Car3D — PNG sprite billboards per car type+color + programmatic boss.
// Top-down orthographic view. Pre-colored sprites; material.color stays white.
// Size/shape set by TYPE_DIMS per type.
//
// Sprite files (public/sprites/designed/):
//   small  → bike-{color}.png
//   big    → car-{color}-processed.png
//   jeep   → van-{color}.png
//   truck  → truck-{color}.png
//   bigrig → bigrig-{color}.png
//   tank   → tank.png (single military-green sprite, no tint)
//   boss   → programmatic CanvasTexture (styled rectangle)

import * as THREE from 'three';
import { CELL, posToZ, laneToX } from './Scene3D.js';

// ── Canvas size for programmatic textures ────────────────────────────────────
const CVS    = 256;
const MARGIN = 8;

// ── Timings ──────────────────────────────────────────────────────────────────
const LERP_DURATION       = 0.25;
const SPAWN_LERP_DURATION = 0.45;  // slower entry so cars glide in rather than snap
const DEATH_DURATION   = 0.30;
const DEATH_SCALE_MAX  = 1.40;
const DEATH_VY         = 2.5;
const MAX_TILT_X       = 0.20;
const SPAWN_OFFSET     = 5.0;   // bigrig half-height=2.52 + frustum margin → fully off-screen
const POWER_FLASH_DUR  = 0.25;
const POWER_SQUASH_DUR = 0.18;
const POWER_SCALE_PEAK = 1.12;

// ── Danger aura ───────────────────────────────────────────────────────────────
const AURA_RATE = 1 / 0.3;
const AURA_FREQ = 1.5;
const AURA_AMP  = 0.3;

// ── Wobble ───────────────────────────────────────────────────────────────────
const WOBBLE_X_AMP   = 0.08;
const WOBBLE_X_FREQ  = 1.1;
const WOBBLE_ROT_AMP = 0.015;
const WOBBLE_ROT_FREQ = 0.9;

// ── Colors ───────────────────────────────────────────────────────────────────
const COLOR_HEX = {
  Red:    0xE24B4A,
  Blue:   0x378ADD,
  Green:  0x639922,
  Yellow: 0xEF9F27,
  Purple: 0x7F77DD,
  Orange: 0xD85A30,
  Boss:   0xCC44CC,
};

// ── Per-type plane dimensions (fractions of CELL) ───────────────────────────
// PlaneGeometry = CELL*wF × CELL*hF.
const TYPE_DIMS = {
  small:  { wF: 0.40, hF: 0.77 },   // motorbike — recognizable handlebar width
  big:    { wF: 0.58, hF: 0.77 },   // standard sedan
  jeep:   { wF: 0.62, hF: 0.81 },   // van — just wider than sedan
  truck:  { wF: 0.60, hF: 0.98 },   // pickup
  bigrig: { wF: 0.60, hF: 1.26 },   // semi — long but not wide
  tank:   { wF: 0.72, hF: 1.01 },   // widest, still within lane
  boss:   { wF: 1.33, hF: 1.33 },
};

// ── Sprite map: nested by type → color (pre-colored PNGs, no material tint) ──
const SPRITE_MAP = {
  small: {
    Red:    'sprites/designed/bike-red.png',
    Blue:   'sprites/designed/bike-blue.png',
    Green:  'sprites/designed/bike-green.png',
    Yellow: 'sprites/designed/bike-yellow.png',
    Orange: 'sprites/designed/bike-orange.png',
    Purple: 'sprites/designed/bike-purple.png',
  },
  big: {
    Red:    'sprites/designed/car-red-processed.png',
    Blue:   'sprites/designed/car-blue-processed.png',
    Green:  'sprites/designed/car-green-processed.png',
    Yellow: 'sprites/designed/car-yellow-processed.png',
    Orange: 'sprites/designed/car-orange-processed.png',
    Purple: 'sprites/designed/car-purple-processed.png',
  },
  jeep: {
    Red:    'sprites/designed/van-red.png',
    Blue:   'sprites/designed/van-blue.png',
    Green:  'sprites/designed/van-green.png',
    Yellow: 'sprites/designed/van-yellow.png',
    Orange: 'sprites/designed/van-orange.png',
    Purple: 'sprites/designed/van-purple.png',
  },
  truck: {
    Red:    'sprites/designed/truck-red.png',
    Blue:   'sprites/designed/truck-blue.png',
    Green:  'sprites/designed/truck-green.png',
    Yellow: 'sprites/designed/truck-yellow.png',
    Orange: 'sprites/designed/truck-orange.png',
    Purple: 'sprites/designed/truck-purple.png',
  },
  bigrig: {
    Red:    'sprites/designed/bigrig-red.png',
    Blue:   'sprites/designed/bigrig-blue.png',
    Green:  'sprites/designed/bigrig-green.png',
    Yellow: 'sprites/designed/bigrig-yellow.png',
    Orange: 'sprites/designed/bigrig-orange.png',
    Purple: 'sprites/designed/bigrig-purple.png',
  },
  tank: { all: 'sprites/designed/tank.png' },
};

// Module-level texture cache (shared across all Car3D instances)
const _texLoader = new THREE.TextureLoader();
const _texCache  = {};

function _getSpriteTex(type, color, base) {
  const cacheKey = type === 'tank' ? 'tank' : `${type}:${color}`;
  if (!_texCache[cacheKey]) {
    const spritePath = type === 'tank'
      ? SPRITE_MAP.tank.all
      : SPRITE_MAP[type]?.[color];
    const tex = _texLoader.load(`${base}${spritePath}`);
    tex.colorSpace = THREE.SRGBColorSpace;
    _texCache[cacheKey] = tex;
  }
  return _texCache[cacheKey];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function carHex(car) {
  return COLOR_HEX[car.color] ?? (car.type === 'boss' ? COLOR_HEX.Boss : 0x888888);
}

function _boostColor(hex) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl, THREE.SRGBColorSpace);
  hsl.s = 1.0;
  // Keep L in sRGB perceptual space, never above 0.50 (avoids washed-out tints)
  hsl.l = Math.max(0.35, Math.min(0.50, hsl.l));
  c.setHSL(hsl.h, hsl.s, hsl.l, THREE.SRGBColorSpace);
  return c.getHex(THREE.SRGBColorSpace);
}

function _rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }
}

// ── Programmatic texture drawing (boss only) ──────────────────────────────────
function _drawBoss(ctx, W, H, hex) {
  ctx.clearRect(0, 0, W, H);
  const cr = (hex >> 16) & 0xff;
  const cg = (hex >>  8) & 0xff;
  const cb =  hex        & 0xff;
  _rrect(ctx, MARGIN, MARGIN, W - 2 * MARGIN, H - 2 * MARGIN, 14);
  ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 4;
  ctx.stroke();
  // Boss mark — inner X
  const m = MARGIN + 18;
  ctx.beginPath();
  ctx.moveTo(m, m); ctx.lineTo(W - m, H - m);
  ctx.moveTo(W - m, m); ctx.lineTo(m, H - m);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 6;
  ctx.stroke();
}

// ── Speed line geometry (reused) ─────────────────────────────────────────────
let _slGeo = null;
function _getSpeedLineGeo() {
  if (!_slGeo) _slGeo = new THREE.PlaneGeometry(0.08, 0.50);
  return _slGeo;
}

// ── Boss torus (reused) ───────────────────────────────────────────────────────
let _bossTorusGeo = null;

// ─────────────────────────────────────────────────────────────────────────────

export class Car3D {
  constructor(scene, lanes) {
    this._scene = scene;
    this._lanes = lanes;
    this._live  = new Map();
    this._dying = [];
    this._emissiveBoost = 0;
    if (!_bossTorusGeo) _bossTorusGeo = new THREE.TorusGeometry(1.4, 0.06, 8, 28);
  }

  setTheme(theme) {
    this._emissiveBoost = theme?.emissiveBoost ?? 0;
  }

  clearAll() {
    for (const entry of this._live.values()) this._disposeEntry(entry);
    this._live.clear();
    for (const d of this._dying) this._disposeDying(d);
    this._dying.length = 0;
  }

  triggerPowerHit(laneIdx, isKill) {
    const lane = this._lanes[laneIdx];
    if (!lane) return;
    const frontCar = lane.cars.reduce((best, c) => (!best || c.row > best.row) ? c : best, null);
    if (!frontCar) return;
    const entry = this._live.get(frontCar);
    if (!entry) return;
    entry._powerFlashT    = 0;
    entry._powerFlashing  = true;
    entry._powerSquashT   = 0;
    entry._powerSquashing = true;
  }

  update(dt, isFrozen = false) {
    const liveCars = new Set();
    for (const lane of this._lanes) for (const car of lane.cars) liveCars.add(car);

    // Retire cars no longer in state
    for (const [car, entry] of this._live) {
      if (!liveCars.has(car)) {
        this._killSpeedLines(entry);
        this._dying.push({
          group: entry.group, bossRing: entry.bossRing,
          bossRingMat: entry.bossRingMat, t: 0,
        });
        this._live.delete(car);
      }
    }

    const now = performance.now() / 1000;

    for (let laneIdx = 0; laneIdx < this._lanes.length; laneIdx++) {
      const _laneCars = this._lanes[laneIdx].cars;
      const _maxRow   = _laneCars.length > 0
        ? _laneCars.reduce((m, c) => Math.max(m, c.row), 0) : -1;

      for (const car of _laneCars) {
        if (!this._live.has(car)) this._live.set(car, this._createEntry(car, laneIdx));

        const entry = this._live.get(car);
        const g     = entry.group;

        // ── Smooth advance lerp ───────────────────────────────────────────────
        const newTargetZ = posToZ(car.position);
        if (Math.abs(newTargetZ - entry.targetZ) > 0.001) {
          entry.lerpStartZ = entry.renderZ;
          entry.targetZ    = newTargetZ;
          entry.lerpT      = 0;
          // Spawn speed lines when advancing (not on first spawn)
          if (!entry._isSpawning) this._spawnSpeedLines(entry, laneIdx, car);
        }
        if (entry.lerpT < 1) {
          const dur     = entry._isSpawning ? SPAWN_LERP_DURATION : LERP_DURATION;
          entry.lerpT   = Math.min(1, entry.lerpT + dt / dur);
          const eased   = 1 - Math.pow(1 - entry.lerpT, 3);
          entry.renderZ = entry.lerpStartZ + (entry.targetZ - entry.lerpStartZ) * eased;
          g.rotation.x  = -MAX_TILT_X * Math.sin(Math.PI * entry.lerpT);
          if (entry.lerpT >= 1) entry._isSpawning = false;
        } else {
          entry.renderZ   = entry.targetZ;
          g.rotation.x    = 0;
          entry._isSpawning = false;
        }

        // ── Update speed lines ────────────────────────────────────────────────
        this._updateSpeedLines(entry, dt);

        // ── Wobble ────────────────────────────────────────────────────────────
        const wobbleX   = Math.sin(now * WOBBLE_X_FREQ   + laneIdx * 0.7) * WOBBLE_X_AMP;
        const wobbleRot = Math.sin(now * WOBBLE_ROT_FREQ + laneIdx * 1.3) * WOBBLE_ROT_AMP;

        g.position.set(laneToX(laneIdx) + wobbleX, 0, entry.renderZ);

        // ── Boss ring ─────────────────────────────────────────────────────────
        if (entry.bossRing) {
          entry.bossAngle += dt * 1.8;
          entry.bossRing.position.set(g.position.x, g.position.y + 0.5, g.position.z);
          entry.bossRing.rotation.y = entry.bossAngle;
          entry.bossRing.rotation.x = 0.35;
          entry.bossRingMat.emissiveIntensity = 1.2 + 0.6 * Math.sin(entry.bossAngle * 3);
        }

        const hpRatio = car.maxHp > 0 ? car.hp / car.maxHp : 0;

        // ── Color effects (MeshBasicMaterial tinting) ─────────────────────────
        entry._auraT += dt;
        let colorSet = false;

        if (isFrozen) {
          entry.bodyMat.color.setRGB(0.67, 0.87, 1.0);
          if (!entry._prevFrozen) entry._prevFrozen = true;
          colorSet = true;
        } else {
          if (entry._prevFrozen) {
            entry._prevFrozen = false;
            entry.bodyMat.color.setHex(entry.baseHex);
          }

          // Power hit flash
          if (entry._powerFlashing) {
            entry._powerFlashT += dt;
            const prog = Math.min(1, entry._powerFlashT / POWER_FLASH_DUR);
            if (prog < 1) {
              if (prog < 0.4) {
                const t = prog / 0.4;
                entry.bodyMat.color.setRGB(1, 1 - 0.55 * t, 1 - 0.9 * t);
              } else {
                const t = (prog - 0.4) / 0.6;
                entry.bodyMat.color.setRGB(1, 0.45 + 0.55 * t, 0.1 + 0.9 * t);
              }
              colorSet = true;
            } else {
              entry._powerFlashing = false;
            }
          }

          // Danger aura — 2 frontmost cars per lane
          const _isNearBreach = _maxRow >= 0 && car.row >= _maxRow - 1;
          const auraTarget = _isNearBreach ? 1.0 : 0.0;
          const blendStep  = AURA_RATE * dt;
          entry._auraBlend = auraTarget > entry._auraBlend
            ? Math.min(auraTarget, entry._auraBlend + blendStep)
            : Math.max(auraTarget, entry._auraBlend - blendStep);

          if (!colorSet && entry._auraBlend > 0.001) {
            const pulse  = 0.7 + AURA_AMP * Math.sin(2 * Math.PI * AURA_FREQ * entry._auraT);
            const t = entry._auraBlend * pulse * 0.55;
            // Boost red channel, dim others — preserves hue identity while signalling danger
            entry.bodyMat.color.setHex(entry.baseHex);
            const mc = entry.bodyMat.color;
            mc.r = Math.min(1.0, mc.r + t * 0.40);
            mc.g = mc.g * (1 - t * 0.55);
            mc.b = mc.b * (1 - t * 0.55);
            colorSet = true;
          }

          // Damage tint (lowest priority) — darken base color, preserve hue identity
          if (!colorSet) {
            const bright = hpRatio < 0.35 ? 0.45 : hpRatio < 0.65 ? 0.70 : 1.0;
            if (bright < 1.0) {
              entry.bodyMat.color.setHex(entry.baseHex);
              entry.bodyMat.color.multiplyScalar(bright);
            } else {
              entry.bodyMat.color.setHex(entry.baseHex);
            }
          }
        }

        // ── Damage rotation tilt ──────────────────────────────────────────────
        let tiltZ = 0;
        if (!isFrozen) {
          if (hpRatio < 0.35)      tiltZ = -0.10 * (1 - hpRatio);
          else if (hpRatio < 0.65) tiltZ = -0.04 * (1 - hpRatio);
        }
        g.rotation.z = tiltZ + wobbleRot;

        // ── Power squash-and-stretch ──────────────────────────────────────────
        if (entry._powerSquashing) {
          entry._powerSquashT += dt;
          const prog  = Math.min(1, entry._powerSquashT / POWER_SQUASH_DUR);
          const spike = Math.sin(Math.PI * prog);
          const s     = 1 + (POWER_SCALE_PEAK - 1) * spike;
          g.scale.setScalar((g.userData.baseScale ?? 1.0) * s);
          if (prog >= 1) {
            entry._powerSquashing = false;
            g.scale.setScalar(g.userData.baseScale ?? 1.0);
          }
        }

        if (car.hp !== entry.lastHp) entry.lastHp = car.hp;
      }
    }

    // ── Death animations ──────────────────────────────────────────────────────
    for (let i = this._dying.length - 1; i >= 0; i--) {
      const d = this._dying[i];
      d.t += dt;
      if (d.t >= DEATH_DURATION) { this._disposeDying(d); this._dying.splice(i, 1); continue; }
      const prog  = d.t / DEATH_DURATION;
      const scale = 1 + (DEATH_SCALE_MAX - 1) * prog;
      d.group.scale.set(scale, scale, scale);
      d.group.position.y += DEATH_VY * dt;
      d.group.traverse(child => {
        if (child.isMesh && child.material) child.material.opacity = 1 - prog;
      });
    }
  }

  // ── Entry creation ─────────────────────────────────────────────────────────

  _createEntry(car, laneIdx) {
    const hex        = carHex(car);
    const boostedHex = _boostColor(hex);

    // Pre-colored sprites for all types except boss (which stays programmatic)
    const hasSprite = SPRITE_MAP[car.type] != null && car.type !== 'boss';
    let bodyMat;

    if (hasSprite) {
      const tex = _getSpriteTex(car.type, car.color, import.meta.env.BASE_URL);
      bodyMat = new THREE.MeshBasicMaterial({
        map:         tex,
        transparent: true,
        alphaTest:   0.08,
        color:       new THREE.Color(0xffffff),  // pre-colored sprite — no tint
        side:        THREE.DoubleSide,
      });
    } else {
      // boss — programmatic canvas
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = CVS;
      _drawBoss(canvas.getContext('2d'), CVS, CVS, boostedHex);
      const tex = new THREE.CanvasTexture(canvas);
      bodyMat = new THREE.MeshBasicMaterial({
        map:         tex,
        transparent: true,
        alphaTest:   0.05,
        color:       new THREE.Color(0xffffff),
        side:        THREE.DoubleSide,
      });
    }

    const cfg   = TYPE_DIMS[car.type] ?? TYPE_DIMS.big;
    const group = new THREE.Group();
    const mesh  = new THREE.Mesh(
      new THREE.PlaneGeometry(CELL * cfg.wF, CELL * cfg.hF),
      bodyMat,
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.05;
    group.add(mesh);

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

    group.userData.baseScale = 1.0;

    // Spawn animation: start off-screen (further from breach)
    const targetZ = posToZ(car.position);
    const spawnZ  = targetZ - SPAWN_OFFSET;
    group.position.set(laneToX(laneIdx), 0, spawnZ);

    this._scene.add(group);

    return {
      group, bodyMat,
      baseHex: 0xffffff,  // always white — all sprites pre-colored, boss canvas bakes color
      lastHp: -1, _prevFrozen: false,
      bossRing, bossRingMat, bossAngle: 0,
      renderZ: spawnZ, targetZ, lerpStartZ: spawnZ, lerpT: 0,
      _isSpawning: true,
      _auraBlend: 0, _auraT: 0,
      _powerFlashing: false, _powerFlashT: 0,
      _powerSquashing: false, _powerSquashT: 0,
      _speedLines: [],
    };
  }

  // ── Speed lines ───────────────────────────────────────────────────────────

  _spawnSpeedLines(entry, laneIdx, car) {
    const cfg = TYPE_DIMS[car.type] ?? TYPE_DIMS.big;
    const lx  = laneToX(laneIdx);
    const geo  = _getSpeedLineGeo();

    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color:       new THREE.Color(entry.baseHex),
        transparent: true,
        opacity:     0.50,
        depthWrite:  false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      const xOff = (i === 0 ? -0.30 : 0.30) * CELL * cfg.wF;
      mesh.position.set(lx + xOff, 0.03, entry.renderZ - 0.30);
      this._scene.add(mesh);
      entry._speedLines.push({ mesh, mat, t: 0, startZ: entry.renderZ });
    }
  }

  _updateSpeedLines(entry, dt) {
    for (const sl of entry._speedLines) {
      sl.t += dt;
      const prog = Math.min(1, sl.t / LERP_DURATION);
      sl.mat.opacity = 0.50 * (1 - prog);
      sl.mesh.position.z = sl.startZ - 0.30 - prog * 0.40;
    }
    // Remove finished lines
    entry._speedLines = entry._speedLines.filter(sl => {
      if (sl.t >= LERP_DURATION) {
        this._scene.remove(sl.mesh);
        sl.mat.dispose();
        return false;
      }
      return true;
    });
  }

  _killSpeedLines(entry) {
    for (const sl of entry._speedLines) {
      this._scene.remove(sl.mesh);
      sl.mat.dispose();
    }
    entry._speedLines.length = 0;
  }

  // ── Disposal ───────────────────────────────────────────────────────────────

  _disposeDying(d) {
    this._disposeGroup(d.group);
    if (d.bossRing) { d.bossRingMat?.dispose(); this._scene.remove(d.bossRing); }
  }

  _disposeEntry(entry) {
    this._killSpeedLines(entry);
    this._disposeGroup(entry.group);
    if (entry.bossRing) { entry.bossRingMat?.dispose(); this._scene.remove(entry.bossRing); }
  }

  _disposeGroup(group) {
    group.traverse(obj => {
      if (obj.isMesh) {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
        for (const m of mats) {
          // Do NOT dispose cached sprite textures — only dispose CanvasTextures
          if (m.map && !(Object.values(_texCache).includes(m.map))) m.map.dispose();
          m.dispose();
        }
      }
    });
    this._scene.remove(group);
  }
}
