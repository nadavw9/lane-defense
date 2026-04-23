// Particles3D — hit sparks, explosions, shockwave rings, and floating
//               damage-number sprites in 3D world-space.
//
// All effects are spawned by event (spawnHit / spawnExplosion / spawnMiss /
// spawnDamageNumber) and self-expire after their lifetime.  Every frame
// update() advances all active effects; dispose() cleans up GPU resources.
//
// Particles use individual THREE.Mesh objects (small sphere geometry) rather
// than a GPU point buffer — particle counts per event are tiny (4–12) so
// draw-call overhead is negligible on mobile WebGL.

import * as THREE from 'three';
import { posToZ, laneToX } from './Scene3D.js';

// Y position of car body centre on road (mirrors Car3D.CAR_Y).
const CAR_Y = 0.43;

// ── Shared geometry (created once) ────────────────────────────────────────────
let _sparkGeo    = null;   // tiny sphere for sparks / explosion bits
let _ringGeo     = null;   // flat ring for shockwave
// Size-bucketed explosion particle geos (reused to avoid per-kill allocs).
let _explGeoSm   = null;   // ~0.10 radius
let _explGeoMd   = null;   // ~0.15 radius
let _explGeoLg   = null;   // ~0.20 radius

function sharedGeo() {
  if (!_sparkGeo) {
    _sparkGeo  = new THREE.SphereGeometry(0.07, 6, 4);
    _ringGeo   = new THREE.RingGeometry(0.1, 0.3, 24);
    _explGeoSm = new THREE.SphereGeometry(0.10, 6, 4);
    _explGeoMd = new THREE.SphereGeometry(0.15, 6, 4);
    _explGeoLg = new THREE.SphereGeometry(0.20, 6, 4);
  }
}

// Pick the closest shared explosion geo for a given size value.
function explGeoForSize(size) {
  if (size < 0.125) return _explGeoSm;
  if (size < 0.175) return _explGeoMd;
  return _explGeoLg;
}

// ── Colour palette ─────────────────────────────────────────────────────────────
const COLOR_HEX = {
  Red:    0xE24B4A,
  Blue:   0x378ADD,
  Green:  0x639922,
  Yellow: 0xEF9F27,
  Purple: 0x7F77DD,
  Orange: 0xD85A30,
};

// Particle Y height above road surface.
const PARTICLE_Y = 0.40;

// ── Gravity helper ─────────────────────────────────────────────────────────────
const GRAVITY = -9.8;

// ── Damage-number canvas size ──────────────────────────────────────────────────
const DMG_CANVAS_W = 64;
const DMG_CANVAS_H = 32;

export class Particles3D {
  /**
   * @param {THREE.Scene} scene
   * @param {object}      lighting  — Lighting3D instance (for explosion flash)
   * @param {Array}       lanes     — live ref to gs.lanes (locate car positions)
   */
  constructor(scene, lighting, lanes) {
    this._scene    = scene;
    this._lighting = lighting;
    this._lanes    = lanes;

    // Active particle entries.
    this._sparks     = [];
    this._shockwaves = [];
    this._dmgNums    = [];

    // Exhaust smoke: persistent puffs emitted from cars each frame.
    // { mesh, mat, vx, vy, vz, life, maxLife }
    this._smoke      = [];

    // Accumulator for sub-frame exhaust timing (emit ~2 puffs/s per car).
    this._exhaustAccum = 0;

    this._dmgCanvas = document.createElement('canvas');
    this._dmgCanvas.width  = DMG_CANVAS_W;
    this._dmgCanvas.height = DMG_CANVAS_H;
    this._dmgCtx = this._dmgCanvas.getContext('2d');

    sharedGeo();
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Spawn colored spark particles at the front car in lane laneIdx.
   * @param {number} laneIdx
   * @param {string} color     — shooter color name ('Red', 'Blue', …)
   */
  spawnHit(laneIdx, color) {
    const pos = this._frontCarPos(laneIdx);
    if (!pos) return;

    const hex   = COLOR_HEX[color] ?? 0xffffff;
    const count = 4 + Math.floor(Math.random() * 3);   // 4–6

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 5;
      const mat   = new THREE.MeshStandardMaterial({
        color:             hex,
        emissive:          hex,
        emissiveIntensity: 1.2,
        transparent:       true,
        opacity:           1,
      });
      const mesh = new THREE.Mesh(_sparkGeo, mat);
      mesh.position.set(pos.x + (Math.random() - 0.5) * 0.3,
                        PARTICLE_Y + Math.random() * 0.3,
                        pos.z + (Math.random() - 0.5) * 0.3);
      this._scene.add(mesh);

      this._sparks.push({
        mesh, mat,
        vx: Math.cos(angle) * speed,
        vy: 2 + Math.random() * 3,
        vz: Math.sin(angle) * speed * 0.5,
        life:    0.32,
        maxLife: 0.32,
      });
    }
  }

  /**
   * Spawn grey miss puffs (wrong-color shot).
   * @param {number} laneIdx
   */
  spawnMiss(laneIdx) {
    const pos = this._frontCarPos(laneIdx);
    if (!pos) return;

    const count = 3;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color:       0x888888,
        transparent: true,
        opacity:     0.7,
      });
      const mesh = new THREE.Mesh(_sparkGeo, mat);
      mesh.position.set(pos.x + (Math.random() - 0.5) * 0.4,
                        PARTICLE_Y + Math.random() * 0.2,
                        pos.z + (Math.random() - 0.5) * 0.2);
      this._scene.add(mesh);

      this._sparks.push({
        mesh, mat,
        vx: (Math.random() - 0.5) * 2,
        vy: 0.5 + Math.random() * 1.5,
        vz: (Math.random() - 0.5) * 1,
        life:    0.28,
        maxLife: 0.28,
      });
    }
  }

  /**
   * Spawn a kill explosion: large colored burst + shockwave ring + flash light.
   * @param {number} laneIdx
   * @param {string} color
   */
  spawnExplosion(laneIdx, color) {
    const pos = this._frontCarPos(laneIdx);
    if (!pos) return;

    const hex   = COLOR_HEX[color] ?? 0xffffff;
    const count = 9 + Math.floor(Math.random() * 4);   // 9–12

    // ── Large colored burst particles ───────────────────────────────────────
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 5 + Math.random() * 8;
      const size  = 0.10 + Math.random() * 0.12;
      const geo   = explGeoForSize(size);
      const mat   = new THREE.MeshStandardMaterial({
        color:             hex,
        emissive:          hex,
        emissiveIntensity: 1.5,
        transparent:       true,
        opacity:           1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x + (Math.random() - 0.5) * 0.2,
                        PARTICLE_Y + 0.1,
                        pos.z + (Math.random() - 0.5) * 0.2);
      this._scene.add(mesh);

      this._sparks.push({
        mesh, mat,
        vx: Math.cos(angle) * speed,
        vy: 3 + Math.random() * 6,
        vz: Math.sin(angle) * speed * 0.6,
        life:    0.52,
        maxLife: 0.52,
        isExplosion: true,
      });
    }

    // ── Shockwave ring ───────────────────────────────────────────────────────
    const ringMat = new THREE.MeshBasicMaterial({
      color:       hex,
      transparent: true,
      opacity:     0.55,
      side:        THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(_ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.02, pos.z);
    this._scene.add(ring);
    this._shockwaves.push({ mesh: ring, mat: ringMat, life: 0.38, maxLife: 0.38, scaleRate: 10 });

    // ── Dynamic light flash ──────────────────────────────────────────────────
    this._lighting?.explosionFlash(hex, pos.x, PARTICLE_Y, pos.z);
  }

  /**
   * Spawn a floating damage number sprite above the hit car.
   * @param {number} laneIdx
   * @param {number} damage
   */
  spawnDamageNumber(laneIdx, damage) {
    const pos = this._frontCarPos(laneIdx);
    if (!pos) return;

    // Draw "-damage" onto the shared canvas.
    const ctx = this._dmgCtx;
    ctx.clearRect(0, 0, DMG_CANVAS_W, DMG_CANVAS_H);
    ctx.font         = 'bold 22px Arial';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#ffffff';
    ctx.shadowColor  = '#000000';
    ctx.shadowBlur   = 5;
    ctx.fillText(`-${damage}`, DMG_CANVAS_W / 2, DMG_CANVAS_H / 2);

    // Create a one-off canvas texture + Sprite.
    const canvas = document.createElement('canvas');
    canvas.width  = DMG_CANVAS_W;
    canvas.height = DMG_CANVAS_H;
    canvas.getContext('2d').drawImage(this._dmgCanvas, 0, 0);
    const tex    = new THREE.CanvasTexture(canvas);
    const mat    = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 1, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.9, 0.45, 1);
    sprite.position.set(pos.x + (Math.random() - 0.5) * 0.4,
                        PARTICLE_Y + 0.7,
                        pos.z);
    this._scene.add(sprite);
    this._dmgNums.push({ sprite, mat, tex, vy: 2.5, life: 0.5, maxLife: 0.5 });
  }

  /**
   * Spawn a large bomb explosion at road position bombPos (0-100).
   * Covers all 4 lanes with a wide shockwave + concussion freeze ring.
   * @param {number} bombPos  road-position 0-100
   */
  spawnBombExplosion(bombPos) {
    const z   = posToZ(bombPos);
    const count = 20;

    // ── Large amber burst across all lanes ─────────────────────────────────
    for (let i = 0; i < count; i++) {
      const angle  = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const spread = 3 + Math.random() * 5;  // wider than normal explosion
      const size   = 0.14 + Math.random() * 0.18;
      const geo    = explGeoForSize(size);
      const hex    = i % 3 === 0 ? 0xff8800 : (i % 3 === 1 ? 0xffdd00 : 0xff4400);
      const mat    = new THREE.MeshStandardMaterial({
        color:             hex,
        emissive:          hex,
        emissiveIntensity: 1.8,
        transparent:       true,
        opacity:           1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      // Spread X across the full road width (≈ ±3 lanes)
      mesh.position.set(
        (Math.random() - 0.5) * 6,
        PARTICLE_Y + 0.2,
        z + (Math.random() - 0.5) * 2,
      );
      this._scene.add(mesh);
      this._sparks.push({
        mesh, mat,
        vx: Math.cos(angle) * spread * 0.8,
        vy: 4 + Math.random() * 8,
        vz: Math.sin(angle) * spread * 0.5,
        life: 0.65, maxLife: 0.65,
        isExplosion: true,
      });
    }

    // ── Large amber shockwave ring ─────────────────────────────────────────
    const waveMatAmber = new THREE.MeshBasicMaterial({
      color: 0xff8800, transparent: true, opacity: 0.60, side: THREE.DoubleSide,
    });
    const bigRing = new THREE.Mesh(_ringGeo, waveMatAmber);
    bigRing.rotation.x = -Math.PI / 2;
    bigRing.position.set(0, 0.02, z);
    this._scene.add(bigRing);
    this._shockwaves.push({ mesh: bigRing, mat: waveMatAmber, life: 0.5, maxLife: 0.5, scaleRate: 20 });

    // ── Ice-blue concussion freeze ring (second wave) ──────────────────────
    const waveMatBlue = new THREE.MeshBasicMaterial({
      color: 0x44ccff, transparent: true, opacity: 0.45, side: THREE.DoubleSide,
    });
    const iceRing = new THREE.Mesh(_ringGeo, waveMatBlue);
    iceRing.rotation.x = -Math.PI / 2;
    iceRing.position.set(0, 0.04, z);
    this._scene.add(iceRing);
    this._shockwaves.push({ mesh: iceRing, mat: waveMatBlue, life: 0.7, maxLife: 0.7, scaleRate: 14 });

    // ── Three sequential dynamic light flashes ─────────────────────────────
    this._lighting?.explosionFlash(0xff8800, 0, PARTICLE_Y + 0.5, z);
    setTimeout(() => this._lighting?.explosionFlash(0xffffff, 0, PARTICLE_Y + 0.5, z), 80);
    setTimeout(() => this._lighting?.explosionFlash(0x44ccff, 0, PARTICLE_Y + 0.5, z), 200);
  }

    // ── Per-frame update ──────────────────────────────────────────────────────────

  update(dt) {
    // ── Spark particles ──────────────────────────────────────────────────────
    for (let i = this._sparks.length - 1; i >= 0; i--) {
      const p = this._sparks[i];
      p.life -= dt;
      if (p.life <= 0) {
        // Only dispose per-instance geometries (none now — all shared).
        if (p.mesh.geometry !== _sparkGeo &&
            p.mesh.geometry !== _explGeoSm &&
            p.mesh.geometry !== _explGeoMd &&
            p.mesh.geometry !== _explGeoLg) p.mesh.geometry.dispose();
        p.mat.dispose();
        this._scene.remove(p.mesh);
        this._sparks.splice(i, 1);
        continue;
      }

      p.vy += GRAVITY * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      // Clamp at road surface.
      if (p.mesh.position.y < 0.02) p.mesh.position.y = 0.02;

      const frac = p.life / p.maxLife;
      p.mat.opacity           = frac * 0.92;
      p.mat.emissiveIntensity = frac * (p.isExplosion ? 1.5 : 1.2);
    }

    // ── Shockwave rings ──────────────────────────────────────────────────────
    for (let i = this._shockwaves.length - 1; i >= 0; i--) {
      const s = this._shockwaves[i];
      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.material.dispose();
        this._scene.remove(s.mesh);
        this._shockwaves.splice(i, 1);
        continue;
      }
      const prog = 1 - s.life / s.maxLife;
      const sc   = 1 + prog * s.scaleRate;
      s.mesh.scale.set(sc, sc, sc);
      s.mat.opacity = (1 - prog) * 0.55;
    }

    // ── Damage numbers ───────────────────────────────────────────────────────
    for (let i = this._dmgNums.length - 1; i >= 0; i--) {
      const d = this._dmgNums[i];
      d.life -= dt;
      if (d.life <= 0) {
        d.tex.dispose();
        d.mat.dispose();
        this._scene.remove(d.sprite);
        this._dmgNums.splice(i, 1);
        continue;
      }
      d.sprite.position.y += d.vy * dt;
      d.mat.opacity = d.life / d.maxLife;
    }

    // ── Exhaust smoke ─────────────────────────────────────────────────────────
    // Emit new smoke puffs from each live car (rate scales with damage).
    this._exhaustAccum += dt;
    if (this._exhaustAccum >= 0.18) {   // ~5-6 puffs/s max
      this._exhaustAccum = 0;
      for (let laneIdx = 0; laneIdx < this._lanes.length; laneIdx++) {
        for (const car of this._lanes[laneIdx].cars) {
          const hpRatio  = car.maxHp > 0 ? car.hp / car.maxHp : 0;
          // Only emit smoke when damaged (below 80% HP).
          if (hpRatio > 0.80) continue;
          const dmg      = 1 - hpRatio;
          // Darker, denser smoke the more damaged the car is.
          const grey     = Math.floor(0x55 + 0x66 * hpRatio);
          const colorHex = (grey << 16) | (grey << 8) | grey;
          const size     = 0.08 + dmg * 0.14;
          const geo      = new THREE.SphereGeometry(size, 5, 4);
          const mat      = new THREE.MeshBasicMaterial({
            color:       colorHex,
            transparent: true,
            opacity:     0.25 + dmg * 0.20,
          });
          const mesh = new THREE.Mesh(geo, mat);
          const wx   = laneToX(laneIdx) + (Math.random() - 0.5) * 0.5;
          const wz   = posToZ(car.position) - 0.8;   // rear of car
          mesh.position.set(wx, CAR_Y + 0.3, wz);
          this._scene.add(mesh);
          this._smoke.push({
            mesh, mat,
            vx: (Math.random() - 0.5) * 0.4,
            vy: 0.5 + Math.random() * 1.0,
            vz: (Math.random() - 0.5) * 0.3,
            life:    0.8 + dmg * 0.6,
            maxLife: 0.8 + dmg * 0.6,
          });
        }
      }
    }

    // Advance existing smoke puffs.
    for (let i = this._smoke.length - 1; i >= 0; i--) {
      const s = this._smoke[i];
      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.geometry.dispose();
        s.mat.dispose();
        this._scene.remove(s.mesh);
        this._smoke.splice(i, 1);
        continue;
      }
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      // Puff grows as it ages and fades linearly.
      const prog = 1 - s.life / s.maxLife;
      const sc   = 1 + prog * 2.5;
      s.mesh.scale.set(sc, sc, sc);
      s.mat.opacity = Math.max(0, (s.life / s.maxLife) * 0.35);
    }
  }

  dispose() {
    for (const p of this._sparks) {
      if (p.mesh.geometry !== _sparkGeo &&
          p.mesh.geometry !== _explGeoSm &&
          p.mesh.geometry !== _explGeoMd &&
          p.mesh.geometry !== _explGeoLg) p.mesh.geometry.dispose();
      p.mat.dispose();
      this._scene.remove(p.mesh);
    }
    for (const s of this._shockwaves) {
      s.mat.dispose(); this._scene.remove(s.mesh);
    }
    for (const d of this._dmgNums) {
      d.tex.dispose(); d.mat.dispose(); this._scene.remove(d.sprite);
    }
    for (const s of this._smoke) {
      s.mesh.geometry.dispose(); s.mat.dispose(); this._scene.remove(s.mesh);
    }
    this._sparks.length     = 0;
    this._shockwaves.length = 0;
    this._dmgNums.length    = 0;
    this._smoke.length      = 0;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /** Return the 3D world XZ of the front car in laneIdx, or null. */
  _frontCarPos(laneIdx) {
    const car = this._lanes[laneIdx]?.cars[0];
    if (!car) return null;
    return { x: laneToX(laneIdx), z: posToZ(car.position) };
  }
}
