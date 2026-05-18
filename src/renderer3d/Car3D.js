// Car3D — flat colored billboard planes per car type, shaped via CanvasTexture.
// Top-down orthographic view. Each type has a distinct silhouette.
//
// Type → shape mapping (game type → visual description):
//   small  → Motorbike: narrow tall rect  (30% × 55%)
//   big    → Sedan:     wide short rect   (60% × 50%)
//   jeep   → Van:       wide medium rect  (70% × 52%)
//   truck  → Truck:     square-ish rect   (65% × 65%)
//   bigrig → Big Rig:   tall rect + cab line at 35% (65% × 85%)
//   tank   → Tank:      wide rect + turret circle   (80% × 70%)
//   boss   → Boss:      largest rect (90% × 90%)

import * as THREE from 'three';
import { CELL, posToZ, laneToX } from './Scene3D.js';

const CVS    = 128;
const MARGIN = 6;   // canvas px margin so 4px stroke is fully visible

const DEATH_DURATION  = 0.30;
const DEATH_SCALE_MAX = 1.40;
const DEATH_VY        = 2.5;
const LERP_DURATION   = 0.45;
const MAX_TILT_X      = 0.20;

const POWER_FLASH_DUR  = 0.25;
const POWER_SQUASH_DUR = 0.18;
const POWER_SCALE_PEAK = 1.12;

const AURA_RATE = 1 / 0.3;
const AURA_FREQ = 1.5;
const AURA_AMP  = 0.3;

const COLOR_HEX = {
  Red:    0xE24B4A,
  Blue:   0x378ADD,
  Green:  0x639922,
  Yellow: 0xEF9F27,
  Purple: 0x7F77DD,
  Orange: 0xD85A30,
  Boss:   0xcc44cc,
};

// Per-type plane dimensions (fractions of CELL) and canvas draw config.
// PlaneGeometry = CELL*wF × CELL*hF — plane aspect ratio gives correct proportions.
// Canvas texture is always 128×128; plane stretching corrects the aspect.
const TYPE_DIMS = {
  small:  { wF: 0.30, hF: 0.55, radius: 18, kind: 'rect'   },
  big:    { wF: 0.60, hF: 0.50, radius: 12, kind: 'rect'   },
  jeep:   { wF: 0.70, hF: 0.52, radius: 12, kind: 'rect'   },
  truck:  { wF: 0.65, hF: 0.65, radius: 12, kind: 'rect'   },
  bigrig: { wF: 0.65, hF: 0.85, radius: 12, kind: 'bigrig' },
  tank:   { wF: 0.80, hF: 0.70, radius: 12, kind: 'tank'   },
  boss:   { wF: 0.90, hF: 0.90, radius: 14, kind: 'rect'   },
};

function carHex(car) {
  return COLOR_HEX[car.color] ?? (car.type === 'boss' ? COLOR_HEX.Boss : 0x888888);
}

function _boostColor(hex) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  hsl.s = 1.0;
  hsl.l = Math.max(0.45, Math.min(0.55, hsl.l));
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return (Math.round(c.r * 255) << 16) | (Math.round(c.g * 255) << 8) | Math.round(c.b * 255);
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

function _drawCarShape(ctx, W, H, type, hex) {
  ctx.clearRect(0, 0, W, H);
  const cfg = TYPE_DIMS[type] ?? TYPE_DIMS.big;
  const M   = MARGIN;
  const cw  = W - 2 * M;
  const ch  = H - 2 * M;
  const r   = cfg.radius;
  const cr  = (hex >> 16) & 0xff;
  const cg  = (hex >>  8) & 0xff;
  const cb  =  hex        & 0xff;

  ctx.fillStyle   = `rgb(${cr},${cg},${cb})`;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth   = 4;

  if (cfg.kind === 'bigrig') {
    _rrect(ctx, M, M, cw, ch, r);
    ctx.fill(); ctx.stroke();
    // Thin horizontal line at 35% from top — cab/trailer division
    const lineY = M + ch * 0.35;
    ctx.beginPath();
    ctx.moveTo(M + 3, lineY);
    ctx.lineTo(M + cw - 3, lineY);
    ctx.lineWidth   = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.stroke();

  } else if (cfg.kind === 'tank') {
    // Hull
    _rrect(ctx, M, M, cw, ch, r);
    ctx.fill(); ctx.stroke();
    // Turret: darker shade centered on canvas
    const dr = Math.round(cr * 0.70);
    const dg = Math.round(cg * 0.70);
    const db = Math.round(cb * 0.70);
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 20, 0, Math.PI * 2);
    ctx.fillStyle   = `rgb(${dr},${dg},${db})`;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth   = 3;
    ctx.fill(); ctx.stroke();

  } else {
    _rrect(ctx, M, M, cw, ch, r);
    ctx.fill(); ctx.stroke();
  }
}

let _bossTorusGeo = null;

export class Car3D {
  constructor(scene, lanes) {
    this._scene         = scene;
    this._lanes         = lanes;
    this._live          = new Map();
    this._dying         = [];
    this._emissiveBoost = 0;  // kept for setTheme API compat
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

    for (const [car, entry] of this._live) {
      if (!liveCars.has(car)) {
        this._dying.push({
          group: entry.group, bossRing: entry.bossRing, bossRingMat: entry.bossRingMat, t: 0,
        });
        this._live.delete(car);
      }
    }

    for (let laneIdx = 0; laneIdx < this._lanes.length; laneIdx++) {
      const _laneCars = this._lanes[laneIdx].cars;
      const _maxRow   = _laneCars.length > 0
        ? _laneCars.reduce((m, c) => Math.max(m, c.row), 0) : -1;

      for (const car of _laneCars) {
        if (!this._live.has(car)) this._live.set(car, this._createEntry(car, laneIdx));

        const entry = this._live.get(car);
        const g     = entry.group;

        // Smooth position lerp
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
        g.position.set(laneToX(laneIdx), 0, entry.renderZ);

        // Boss ring orbit
        if (entry.bossRing) {
          entry.bossAngle += dt * 1.8;
          entry.bossRing.position.set(g.position.x, g.position.y + 0.5, g.position.z);
          entry.bossRing.rotation.y = entry.bossAngle;
          entry.bossRing.rotation.x = 0.35;
          entry.bossRingMat.emissiveIntensity = 1.2 + 0.6 * Math.sin(entry.bossAngle * 3);
        }

        const hpRatio = car.maxHp > 0 ? car.hp / car.maxHp : 0;

        // MeshBasicMaterial — all visual effects via .color tinting
        entry._auraT += dt;
        let colorSet = false;

        if (isFrozen) {
          entry.bodyMat.color.setRGB(0.67, 0.87, 1.0);  // ice-blue tint
          if (!entry._prevFrozen) entry._prevFrozen = true;
          g.rotation.z = 0;
          colorSet = true;
        } else {
          if (entry._prevFrozen) {
            entry._prevFrozen = false;
            entry.bodyMat.color.setHex(0xffffff);
          }

          // Power hit flash: white → orange
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
            } else {
              entry._powerFlashing = false;
            }
            colorSet = true;
          }

          // Danger aura: pulsing red tint on 2 frontmost cars per lane
          const _isNearBreach = _maxRow >= 0 && car.row >= _maxRow - 1;
          const auraTarget = _isNearBreach ? 1.0 : 0.0;
          const blendStep  = AURA_RATE * dt;
          entry._auraBlend = auraTarget > entry._auraBlend
            ? Math.min(auraTarget, entry._auraBlend + blendStep)
            : Math.max(auraTarget, entry._auraBlend - blendStep);

          if (!colorSet && entry._auraBlend > 0.001) {
            const pulse  = 0.7 + AURA_AMP * Math.sin(2 * Math.PI * AURA_FREQ * entry._auraT);
            const redAmt = entry._auraBlend * pulse;
            entry.bodyMat.color.setRGB(1, 1 - 0.65 * redAmt, 1 - 0.65 * redAmt);
            colorSet = true;
          }

          // Damage tint (lowest priority)
          if (!colorSet) {
            if (hpRatio < 0.35) {
              entry.bodyMat.color.setRGB(1.0, 0.40, 0.30);
              g.rotation.z = -0.10 * (1 - hpRatio);
            } else if (hpRatio < 0.65) {
              entry.bodyMat.color.setRGB(1.0, 0.65, 0.40);
              g.rotation.z = -0.04 * (1 - hpRatio);
            } else {
              entry.bodyMat.color.setHex(0xffffff);
              g.rotation.z = 0;
            }
          }
        }

        // Power hit squash-and-stretch
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

    // Death animations
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

  // ── Entry creation ─────────────────────────────────────────────────────────────

  _createEntry(car, laneIdx) {
    const hex        = carHex(car);
    const boostedHex = _boostColor(hex);

    const canvas = document.createElement('canvas');
    canvas.width  = CVS;
    canvas.height = CVS;
    _drawCarShape(canvas.getContext('2d'), CVS, CVS, car.type, boostedHex);
    const tex = new THREE.CanvasTexture(canvas);

    // MeshBasicMaterial: unaffected by scene lights, color tinting for effects
    const bodyMat = new THREE.MeshBasicMaterial({
      map:         tex,
      transparent: true,
      alphaTest:   0.05,
      color:       new THREE.Color(0xffffff),
      side:        THREE.DoubleSide,
    });

    const cfg   = TYPE_DIMS[car.type] ?? TYPE_DIMS.big;
    const group = new THREE.Group();
    const mesh  = new THREE.Mesh(
      new THREE.PlaneGeometry(CELL * cfg.wF, CELL * cfg.hF),
      bodyMat,
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.05;
    group.add(mesh);

    // Boss: orbiting torus ring for visual identity
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
    const startZ = posToZ(car.position);
    group.position.set(laneToX(laneIdx), 0, startZ);
    this._scene.add(group);

    return {
      group, bodyMat, glowHex: boostedHex,
      lastHp: -1, _prevFrozen: false,
      bossRing, bossRingMat, bossAngle: 0,
      renderZ: startZ, targetZ: startZ, lerpStartZ: startZ, lerpT: 1.0,
      _auraBlend: 0, _auraT: 0,
      _powerFlashing: false, _powerFlashT: 0,
      _powerSquashing: false, _powerSquashT: 0,
    };
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
    group.traverse(obj => {
      if (obj.isMesh) {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
        for (const m of mats) { m.map?.dispose(); m.dispose(); }
      }
    });
    this._scene.remove(group);
  }
}
