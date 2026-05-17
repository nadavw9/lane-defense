// Shooter3D — Royal Match / Color Block Jam candy-bomb visuals.
// Top-down orthographic camera (layer 1): bombs appear as circles from above.
// Design: color-dominant sphere + billiard-ball shading.
//
// Camera: position=(0,4.5,0), up=(0,0,-1), lookAt origin → looking straight DOWN.
//   X = left/right  |  Z = top/bottom (more negative Z = higher on screen)  |  Y = depth
//
// Slot layout along Z: SLOT_Z = [-1.5, -0.5, 0.5, 1.4]
//   slot 0 (front/active) at top, slot 3 (deep queue) at bottom.

import * as THREE from 'three';
import { laneToX } from './Scene3D.js';

// ── Layout ─────────────────────────────────────────────────────────────────────
const SLOT_Z     = [-1.5, -0.5, 0.5, 1.4];
const LANE_COUNT = 4;

// ── Per-slot depth parameters ──────────────────────────────────────────────────
// emissive is high so candy colors read vividly regardless of scene lighting.
const SLOT_SCALE    = [1.18, 0.78, 0.62, 0.48];
const SLOT_ALPHA    = [1.00, 0.82, 0.68, 0.55];
const SLOT_EMISSIVE = [0.50, 0.30, 0.18, 0.10];

// ── Bomb geometry (group-local coords) ────────────────────────────────────────
const BOMB_R  = 0.36;
const BOMB_CX = -0.25;   // slight X offset for asymmetry/artistry
const BOMB_CY = BOMB_R;  // sphere sits with bottom at y=0
const BOMB_CZ = 0;

// ── Spark bead ─────────────────────────────────────────────────────────────────
const SPARK_BEAD_RADIUS   = 0.062;
const SPARK_FLICKER_SPEED = 12;

// ── Badge canvas ───────────────────────────────────────────────────────────────
const BADGE_CVS_W = 96;
const BADGE_CVS_H = 56;
const BADGE_W     = 0.82;   // world-space width
const BADGE_H     = 0.46;

// ── Color palette ──────────────────────────────────────────────────────────────
const COLOR_HEX = {
  Red:    0xE24B4A,
  Blue:   0x378ADD,
  Green:  0x639922,
  Yellow: 0xEF9F27,
  Purple: 0x7F77DD,
  Orange: 0xD85A30,
};

// ── Cross-browser rounded rect path helper ────────────────────────────────────
function _roundRect(ctx, x, y, w, h, r) {
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

// ── Badge drawing — Color Block Jam style ─────────────────────────────────────
// Colored pill background (the lane color) + bold white number.
// The pill color reinforces the bomb color identity below the sphere.
function drawDamageBadge(ctx, W, H, damage, colorHex) {
  const cr = (colorHex >> 16) & 0xff;
  const cg = (colorHex >>  8) & 0xff;
  const cb =  colorHex        & 0xff;

  ctx.clearRect(0, 0, W, H);

  const pw = W * 0.88, ph = H * 0.70;
  const px = (W - pw) / 2, py = (H - ph) / 2;
  const r  = ph / 2;

  // Drop shadow behind the pill
  ctx.shadowColor   = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur    = 5;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 3;

  // Colored pill background
  _roundRect(ctx, px, py, pw, ph, r);
  ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
  ctx.fill();

  ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

  // Top-gloss strip: 30% white overlay on upper 38% of pill
  _roundRect(ctx, px + 2, py + 2, pw - 4, ph * 0.38, r);
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.fill();

  // Thin white rim border for crisp edge separation
  _roundRect(ctx, px, py, pw, ph, r);
  ctx.strokeStyle = 'rgba(255,255,255,0.40)';
  ctx.lineWidth   = 1.2;
  ctx.stroke();

  // Number: weight-900 bold, white fill + dark stroke for max legibility
  const fontSize = Math.round(ph * 0.88);
  ctx.font         = `900 ${fontSize}px Arial`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  ctx.lineWidth   = 4.0;
  ctx.strokeStyle = 'rgba(0,0,0,0.82)';
  ctx.strokeText(String(damage), W / 2, H / 2 + 1);

  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(damage), W / 2, H / 2 + 1);
}

// ── Heat glow tables (indexed by tier 0-3) ────────────────────────────────────
const HEAT_EMISSIVE_COLOR = [null, 0xffee44, 0xff7700, 0xff2200]; // tier→target emissive tint
const HEAT_ADD_INTENSITY  = [0,    0.08,     0.18,    0.35     ]; // tier→extra emissive intensity
const HEAT_SCALE_MULT     = [1.0,  1.0,      1.02,    1.0      ]; // tier→scale (active uses pulse)
const HEAT_LERP_PER_SEC   = 0.08 * 60;                            // 0.08/frame at 60fps

// ── Punch ease-out ─────────────────────────────────────────────────────────────
function easeOut3(t) { return 1 - Math.pow(1 - Math.min(t, 1), 3); }

export class Shooter3D {
  constructor(scene, columns) {
    this._scene   = scene;
    this._columns = columns;
    this._elapsed = 0;

    this._slots = [];
    for (let li = 0; li < LANE_COUNT; li++) {
      this._slots.push(SLOT_Z.map((z, si) => this._createSlot(li, z, si)));
    }

    this._activeColCount = LANE_COUNT;

    // ── Streak Shot heat glow state ────────────────────────────────────────────
    this._streakCount  = 0;
    this._streakActive = false;

    // ── Spark beads — one per lane, flicker orange/yellow at fuse tip ─────────
    this._sparkBeads = [];
    for (let li = 0; li < LANE_COUNT; li++) {
      const mat = new THREE.MeshStandardMaterial({
        color:             new THREE.Color(0xff8800),
        emissive:          new THREE.Color(0xff8800),
        emissiveIntensity: 0,
        roughness:         0.2,
        metalness:         0,
      });
      const bead = new THREE.Mesh(
        new THREE.SphereGeometry(SPARK_BEAD_RADIUS, 8, 8), mat,
      );
      bead.position.set(laneToX(li) + BOMB_CX + 0.15, BOMB_CY + 0.38, SLOT_Z[0] - 0.30);
      bead.visible = false;
      bead.layers.set(1);
      this._scene.add(bead);
      this._sparkBeads.push({ bead, mat });
    }

  }

  // ── Public API ────────────────────────────────────────────────────────────────

  setLaneCount(n) {
    for (let li = 0; li < this._slots.length; li++) {
      const x = laneToX(li, n);
      for (const slot of this._slots[li]) slot.group.position.x = x;
      const sb = this._sparkBeads[li];
      if (sb) sb.bead.position.x = x + BOMB_CX + 0.15;
    }
  }

  setActiveColCount(n) { this._activeColCount = n; }

  triggerPunch(colIdx) {
    const slot = this._slots[colIdx]?.[0];
    if (!slot) return;
    slot.group.scale.setScalar(1.40 * slot._baseScale);
    slot._punchT   = 0;
    slot._punching = true;
    slot._flashT   = 0;
    slot._flashing = true;
    // Immediate white emissive flash
    slot.sphereMat.emissive.setHex(0xffffff);
    slot.sphereMat.emissiveIntensity = 1.0;
  }

  /** Called each frame with the current global streak state from GameState. */
  setStreak(streakCount, streakActive) {
    this._streakCount  = streakCount;
    this._streakActive = streakActive;
  }

  update(dt, elapsed) {
    this._elapsed = elapsed;

    for (let li = 0; li < LANE_COUNT; li++) {
      const col   = this._columns[li];
      const slots = this._slots[li];

      if (li >= this._activeColCount) {
        for (const slot of slots) slot.group.visible = false;
        this._sparkBeads[li].bead.visible = false;
        continue;
      }

      for (let si = 0; si < SLOT_Z.length; si++) {
        const slot    = slots[si];
        const shooter = col.shooters?.[si] ?? null;

        if (!shooter) { slot.group.visible = false; continue; }
        slot.group.visible = true;

        const hex    = COLOR_HEX[shooter.color] ?? 0x888888;
        const damage = shooter.damage ?? 1;

        // Sync colors on change
        if (slot.lastColor !== hex || slot.lastDamage !== damage) {
          slot.lastColor  = hex;
          slot.lastDamage = damage;
          slot.sphereMat.color.setHex(hex);
          slot.sphereMat.emissive.setHex(hex);
          drawDamageBadge(slot.badgeCtx, BADGE_CVS_W, BADGE_CVS_H, damage, hex);
          slot.badgeTex.needsUpdate = true;
        }

        // White flash decay after punch
        if (si === 0 && slot._flashing) {
          slot._flashT += dt;
          const FLASH_DUR = 0.08;
          if (slot._flashT >= FLASH_DUR) {
            slot._flashing = false;
            slot.sphereMat.emissive.setHex(slot.lastColor > 0 ? slot.lastColor : 0x888888);
            slot.sphereMat.emissiveIntensity = SLOT_EMISSIVE[0];
          } else {
            const prog = slot._flashT / FLASH_DUR;
            slot.sphereMat.emissiveIntensity = 1.0 - (1.0 - SLOT_EMISSIVE[0]) * easeOut3(prog);
            const t  = easeOut3(prog);
            const fc = new THREE.Color(0xffffff).lerp(new THREE.Color(slot.lastColor), t);
            slot.sphereMat.emissive.copy(fc);
          }
        }

        // Punch scale spring
        if (si === 0 && slot._punching) {
          slot._punchT += dt;
          const PUNCH_DUR = 0.15;
          const prog = Math.min(1, slot._punchT / PUNCH_DUR);
          const s    = (1.40 - 0.40 * easeOut3(prog)) * slot._baseScale;
          slot.group.scale.setScalar(s);
          if (slot._punchT >= PUNCH_DUR) {
            slot._punching = false;
            slot.group.scale.setScalar(slot._baseScale);
          }
        }

        // ── Heat glow — streak charge indicator on front slot ────────────────
        if (si === 0 && !slot._flashing) {
          const tier = this._streakActive ? 3 : Math.min(this._streakCount, 2);
          const lerpAlpha = Math.min(1, HEAT_LERP_PER_SEC * dt);

          // Emissive color: lerp base bomb color toward heat tint.
          const baseCol = new THREE.Color(slot.lastColor > 0 ? slot.lastColor : 0x888888);
          if (tier > 0) {
            const heatCol = new THREE.Color(HEAT_EMISSIVE_COLOR[tier]);
            slot.sphereMat.emissive.lerp(baseCol.clone().lerp(heatCol, 0.70), lerpAlpha);
          } else {
            slot.sphereMat.emissive.lerp(baseCol, lerpAlpha);
          }

          // Emissive intensity: base + heat additive, with 2Hz pulse when active.
          let targetIntensity = SLOT_EMISSIVE[0] + HEAT_ADD_INTENSITY[tier];
          if (this._streakActive) {
            targetIntensity += 0.10 * Math.abs(Math.sin(2 * Math.PI * 2 * elapsed));
          }
          slot.sphereMat.emissiveIntensity +=
            (targetIntensity - slot.sphereMat.emissiveIntensity) * lerpAlpha;

          // Scale: lerp toward tier target; active uses 2Hz pulse 1.0→1.06.
          if (!slot._punching) {
            let targetScale = HEAT_SCALE_MULT[tier] * slot._baseScale;
            if (this._streakActive) {
              targetScale = slot._baseScale * (1.0 + 0.06 * Math.abs(Math.sin(2 * Math.PI * 2 * elapsed)));
            }
            const curScale = slot.group.scale.x;
            slot.group.scale.setScalar(curScale + (targetScale - curScale) * lerpAlpha);
          }

          // Fuse flicker: rapid intensity oscillation when streak is fully charged.
          if (this._streakActive) {
            slot.fuseMat.emissiveIntensity = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(elapsed * 20));
          } else if (tier === 0) {
            slot.fuseMat.emissiveIntensity = 0.20;
          }
        }

        // Gentle Y-bob on front slot only
        if (si === 0) {
          slot.group.position.y = Math.sin(elapsed * 2.4) * 0.03;
        }
      }

      // Spark bead flicker
      const mainVisible = slots[0].group.visible;
      const bead = this._sparkBeads[li];
      bead.bead.visible = mainVisible;
      if (mainVisible) {
        const t = 0.5 + 0.5 * Math.sin(elapsed * SPARK_FLICKER_SPEED + li * 1.3);
        bead.mat.emissiveIntensity = 0.50 + 0.70 * t;
        bead.mat.color.setRGB(1.0, 0.53 + 0.40 * t, 0.0 + 0.13 * t);
        bead.mat.emissive.copy(bead.mat.color);
      }

    }
  }

  dispose() {
    for (const laneSlots of this._slots) {
      for (const slot of laneSlots) {
        slot.badgeTex.dispose();
        slot.sphereMesh.geometry.dispose();
        slot.fuseMesh.geometry.dispose();
        slot.sphereMat.dispose();
        slot.fuseMat.dispose();
        slot.badgeMat.dispose();
        this._scene.remove(slot.group);
      }
    }
    for (const { bead, mat } of this._sparkBeads) {
      bead.geometry.dispose(); mat.dispose(); this._scene.remove(bead);
    }
    this._slots = []; this._sparkBeads = [];
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  _createSlot(laneIdx, worldZ, slotIdx) {
    const alpha    = SLOT_ALPHA[slotIdx];
    const emissive = SLOT_EMISSIVE[slotIdx];
    const scale    = SLOT_SCALE[slotIdx];
    const group    = new THREE.Group();

    // ── Candy sphere — color-dominant body ───────────────────────────────────
    // High emissiveIntensity ensures the lane color saturates regardless of
    // the scene's theme lighting (morning 1.4 sun vs misty 0.6 sun).
    // metalness 0.08 + roughness 0.30 → glossy candy plastic, not chrome.
    const sphereMat = new THREE.MeshStandardMaterial({
      color:             new THREE.Color(0x888888),
      emissive:          new THREE.Color(0x888888),
      emissiveIntensity: emissive,
      metalness:         0.08,
      roughness:         0.30,
      transparent:       alpha < 1,
      opacity:           alpha,
    });
    const sphereMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BOMB_R, 26, 18),
      sphereMat,
    );
    sphereMesh.position.set(BOMB_CX, BOMB_CY, BOMB_CZ);
    group.add(sphereMesh);

    // ── Fuse — warm brown cord with orange-emissive tip ───────────────────────
    const fuseStart = new THREE.Vector3(BOMB_CX,        BOMB_CY + BOMB_R,        BOMB_CZ);
    const fuseMid   = new THREE.Vector3(BOMB_CX + 0.09, BOMB_CY + BOMB_R + 0.14, BOMB_CZ - 0.14);
    const fuseEnd   = new THREE.Vector3(BOMB_CX + 0.18, BOMB_CY + BOMB_R + 0.26, BOMB_CZ - 0.27);
    const fuseCurve = new THREE.CatmullRomCurve3([fuseStart, fuseMid, fuseEnd]);
    const fuseMat   = new THREE.MeshStandardMaterial({
      color:             0x6b4423,
      emissive:          new THREE.Color(0xb84800),
      emissiveIntensity: 0.20,
      roughness:         0.85,
      metalness:         0.0,
      transparent:       alpha < 1,
      opacity:           alpha,
    });
    const fuseMesh = new THREE.Mesh(
      new THREE.TubeGeometry(fuseCurve, 8, 0.036, 6, false),
      fuseMat,
    );
    group.add(fuseMesh);

    // ── Damage badge — colored pill, bold white number ────────────────────────
    // Sprite always faces the camera; depthTest:false ensures it renders over
    // the sphere regardless of depth order.  Scale is compensated against the
    // group scale so all slots show the same world-space badge size (queue
    // slots at 0.7× the front-slot size for clear depth hierarchy).
    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width  = BADGE_CVS_W;
    badgeCanvas.height = BADGE_CVS_H;
    const badgeCtx = badgeCanvas.getContext('2d');
    const badgeTex = new THREE.CanvasTexture(badgeCanvas);
    const badgeMat = new THREE.SpriteMaterial({
      map: badgeTex, transparent: true, opacity: alpha, depthTest: false,
    });
    const badgeMesh = new THREE.Sprite(badgeMat);
    const siFactor  = slotIdx === 0 ? 1.0 : 0.7;
    badgeMesh.scale.set(siFactor * BADGE_W / scale, siFactor * BADGE_H / scale, 1);
    badgeMesh.position.set(BOMB_CX, BOMB_CY, BOMB_CZ);
    group.add(badgeMesh);

    // All meshes and sprites render only on the shooter camera (layer 1)
    group.traverse(obj => { if (obj.isMesh || obj.isSprite) obj.layers.set(1); });

    group.scale.setScalar(scale);
    group.position.set(laneToX(laneIdx), 0, worldZ);
    group.visible = false;
    this._scene.add(group);

    return {
      group,
      sphereMesh, sphereMat,
      fuseMesh,   fuseMat,
      badgeCanvas, badgeCtx, badgeTex, badgeMesh, badgeMat,
      lastColor:  -1,
      lastDamage: -1,
      _punching: false, _punchT: 0,
      _flashing: false, _flashT: 0,
      _baseScale: scale,
    };
  }
}
