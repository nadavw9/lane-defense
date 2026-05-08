// Shooter3D — candy-colored bomb visuals for the top-down orthographic shooter camera (layer 1).
//
// Camera setup: position=(0,4.5,0), up=(0,0,-1), lookAt origin → looking straight DOWN.
//   X = left/right  |  Z = top/bottom (more negative Z = higher on screen)  |  Y = depth
//
// Each column has up to 4 visible slots stacked along the Z axis:
//   SLOT_Z = [-1.5, -0.5, 0.5, 1.4] — slot 0 (front) at top, slot 3 at bottom.

import * as THREE from 'three';
import { laneToX } from './Scene3D.js';

// ── Layout ─────────────────────────────────────────────────────────────────────
const SLOT_Z     = [-1.5, -0.5, 0.5, 1.4];
const LANE_COUNT = 4;

// ── Per-slot depth parameters ──────────────────────────────────────────────────
const SLOT_SCALE    = [1.15, 0.72, 0.58, 0.44];
const SLOT_ALPHA    = [1.00, 0.80, 0.65, 0.55];   // min raised to 0.55 for readability
const SLOT_EMISSIVE = [0.20, 0.14, 0.10, 0.06];   // gentle inner glow (sphere IS the color)

// ── Bomb geometry (group-local coords) ────────────────────────────────────────
const BOMB_R  = 0.36;
const BOMB_CX = -0.25;
const BOMB_CY = BOMB_R;
const BOMB_CZ = 0;

// ── Spark bead ─────────────────────────────────────────────────────────────────
const SPARK_BEAD_RADIUS   = 0.060;   // larger than before (was 0.045)
const SPARK_FLICKER_SPEED = 12;

// ── Badge canvas ───────────────────────────────────────────────────────────────
const BADGE_CVS_W = 80;
const BADGE_CVS_H = 52;
const BADGE_W     = 0.72;   // wider pill (was 0.58)
const BADGE_H     = 0.44;

// ── Shared highlight texture (created once, reused per slot) ──────────────────
let _hlTex = null;
function _getHighlightTex() {
  if (_hlTex) return _hlTex;
  const cv  = document.createElement('canvas');
  cv.width  = cv.height = 32;
  const ctx = cv.getContext('2d');
  const g   = ctx.createRadialGradient(11, 9, 0, 14, 12, 14);
  g.addColorStop(0,   'rgba(255,255,255,0.90)');
  g.addColorStop(0.45,'rgba(255,255,255,0.45)');
  g.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(16, 16, 14, 0, Math.PI * 2); ctx.fill();
  _hlTex = new THREE.CanvasTexture(cv);
  return _hlTex;
}

// ── Color palette ──────────────────────────────────────────────────────────────
const COLOR_HEX = {
  Red:    0xE24B4A, Blue:   0x378ADD, Green:  0x639922,
  Yellow: 0xEF9F27, Purple: 0x7F77DD, Orange: 0xD85A30,
};

// ── Badge drawing — white pill with bold colored number ────────────────────────
function drawDamageBadge(ctx, W, H, damage, colorHex) {
  const cr = (colorHex >> 16) & 0xff;
  const cg = (colorHex >>  8) & 0xff;
  const cb =  colorHex        & 0xff;

  ctx.clearRect(0, 0, W, H);

  // Pill shape: rounded rect wider than tall
  const pw = W * 0.88, ph = H * 0.60;
  const px = (W - pw) / 2, py = (H - ph) / 2;
  const r  = ph / 2;

  // White pill background
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, r);
  else {
    ctx.moveTo(px + r, py);
    ctx.arcTo(px + pw, py, px + pw, py + ph, r);
    ctx.arcTo(px + pw, py + ph, px, py + ph, r);
    ctx.arcTo(px, py + ph, px, py, r);
    ctx.arcTo(px, py, px + pw, py, r);
    ctx.closePath();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fill();

  // Thin colored border for contrast
  ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.70)`;
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Damage number: dark stroke + colored fill for max contrast on white pill
  const fontSize = Math.round(ph * 0.82);
  ctx.font         = `bold ${fontSize}px Arial`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth    = 3.5;
  ctx.strokeStyle  = 'rgba(20,10,10,0.70)';
  ctx.strokeText(String(damage), W / 2, H / 2);
  ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
  ctx.fillText(String(damage), W / 2, H / 2);
}

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

    // Spark beads — one per lane at fuse tip
    this._sparkBeads = [];
    for (let li = 0; li < LANE_COUNT; li++) {
      const mat = new THREE.MeshStandardMaterial({
        color:             new THREE.Color(0xff8800),
        emissive:          new THREE.Color(0xff8800),
        emissiveIntensity: 0,
        roughness:         0.2,
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

    // Front-slot glow rings
    this._glowRings = [];
    const ringGeo   = new THREE.RingGeometry(BOMB_R * 1.30, BOMB_R * 1.78, 28);
    for (let li = 0; li < LANE_COUNT; li++) {
      const mat  = new THREE.MeshBasicMaterial({
        color: 0xffcc44, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(laneToX(li) + BOMB_CX, 0.01, SLOT_Z[0]);
      mesh.visible = false;
      mesh.layers.set(1);
      this._scene.add(mesh);
      this._glowRings.push({ mesh, mat });
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  setLaneCount(n) {
    for (let li = 0; li < this._slots.length; li++) {
      const x = laneToX(li, n);
      for (const slot of this._slots[li]) slot.group.position.x = x;
      const sb = this._sparkBeads[li];
      if (sb) sb.bead.position.x = x + BOMB_CX + 0.15;
      const gr = this._glowRings[li];
      if (gr) gr.mesh.position.x = x + BOMB_CX;
    }
  }

  setActiveColCount(n) { this._activeColCount = n; }

  triggerPunch(colIdx) {
    const slot = this._slots[colIdx]?.[0];
    if (!slot) return;
    slot.group.scale.setScalar(1.40 * slot._baseScale);  // juicier overshoot
    slot._punchT    = 0;
    slot._punching  = true;
    slot._flashT    = 0;
    slot._flashing  = true;
    // Immediate white emissive flash
    slot.sphereMat.emissive.setHex(0xffffff);
    slot.sphereMat.emissiveIntensity = 1.0;
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

        // Sync sphere color to lane color on change
        if (slot.lastColor !== hex || slot.lastDamage !== damage) {
          slot.lastColor  = hex;
          slot.lastDamage = damage;
          slot.sphereMat.color.setHex(hex);
          slot.sphereMat.emissive.setHex(hex);
          drawDamageBadge(slot.badgeCtx, BADGE_CVS_W, BADGE_CVS_H, damage, hex);
          slot.badgeTex.needsUpdate = true;
        }

        // White flash decay (punch effect)
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
            // Keep emissive white during flash, fade back to lane color
            const t = easeOut3(prog);
            const fc = new THREE.Color(0xffffff).lerp(new THREE.Color(slot.lastColor), t);
            slot.sphereMat.emissive.copy(fc);
          }
        }

        // Punch scale animation
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

        // Gentle Y-bob on front slot
        if (si === 0) {
          slot.group.position.y = Math.sin(elapsed * 2.4) * 0.03;
        }
      }

      // Spark bead flicker
      const mainVisible = slots[0].group.visible;
      const bead = this._sparkBeads[li];
      bead.bead.visible = mainVisible;
      if (mainVisible) {
        // Flicker between orange (0xff8800) and bright yellow (0xffee22)
        const t = 0.5 + 0.5 * Math.sin(elapsed * SPARK_FLICKER_SPEED + li * 1.3);
        bead.mat.emissiveIntensity = 0.50 + 0.70 * t;
        bead.mat.color.setRGB(1.0, 0.53 + 0.40 * t, 0.0 + 0.13 * t);
        bead.mat.emissive.copy(bead.mat.color);
      }

      // Glow ring — colored, higher opacity, more pronounced pulse
      const gr = this._glowRings[li];
      gr.mesh.visible = mainVisible;
      if (mainVisible) {
        const pulse    = 0.5 + 0.5 * Math.sin(elapsed * 3.0 + li * 0.8);
        gr.mat.opacity = 0.35 + 0.55 * pulse;   // base 0.35, amplitude 0.55 (was 0.25+0.45)
        const s        = 1.0 + 0.10 * pulse;
        gr.mesh.scale.set(s, s, 1);
        const frontHex = slots[0].lastColor;
        if (frontHex > 0) gr.mat.color.setHex(frontHex);
      }
    }
  }

  dispose() {
    for (const laneSlots of this._slots) {
      for (const slot of laneSlots) {
        slot.badgeTex.dispose();
        slot.sphereMesh.geometry.dispose();
        slot.fuseMesh.geometry.dispose();
        slot.badgeMesh.geometry.dispose();
        slot.hlMesh.geometry.dispose();
        slot.sphereMat.dispose();
        slot.fuseMat.dispose();
        slot.badgeMat.dispose();
        slot.hlMat.dispose();
        this._scene.remove(slot.group);
      }
    }
    for (const { bead, mat } of this._sparkBeads) {
      bead.geometry.dispose(); mat.dispose(); this._scene.remove(bead);
    }
    for (const { mesh, mat } of this._glowRings) {
      mat.dispose(); this._scene.remove(mesh);
    }
    this._slots = []; this._sparkBeads = []; this._glowRings = [];
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  _createSlot(laneIdx, worldZ, slotIdx) {
    const alpha    = SLOT_ALPHA[slotIdx];
    const emissive = SLOT_EMISSIVE[slotIdx];
    const scale    = SLOT_SCALE[slotIdx];
    const group    = new THREE.Group();

    // ── Candy-colored sphere body ─────────────────────────────────────────────
    // Color IS the lane color — the sphere body carries the color identity.
    const sphereMat = new THREE.MeshStandardMaterial({
      color:             new THREE.Color(0x888888),  // updated dynamically in update()
      emissive:          new THREE.Color(0x888888),
      emissiveIntensity: emissive,
      metalness:         0.10,   // candy/glossy, not metallic
      roughness:         0.35,
      transparent:       alpha < 1,
      opacity:           alpha,
    });
    const sphereMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BOMB_R, 20, 14),
      sphereMat,
    );
    sphereMesh.position.set(BOMB_CX, BOMB_CY, BOMB_CZ);
    group.add(sphereMesh);

    // ── Specular highlight disc (top-left crescent) ───────────────────────────
    // Viewed from above, this is a soft white glow inside the sphere circle.
    // Offset toward top-left (camera up=-Z → more negative Z = higher on screen).
    const hlTex = _getHighlightTex();
    const hlMat = new THREE.MeshBasicMaterial({
      map: hlTex, transparent: true,
      opacity: alpha * 0.72,
      depthTest: false,
    });
    const hlMesh = new THREE.Mesh(
      new THREE.CircleGeometry(BOMB_R * 0.64, 14),
      hlMat,
    );
    hlMesh.rotation.x = -Math.PI / 2;   // lie flat, face the top-down camera
    // Offset toward top-left in screen space: -X (left), -Z (up/toward horizon)
    hlMesh.position.set(
      BOMB_CX - BOMB_R * 0.22,
      BOMB_CY + BOMB_R + 0.002,   // just above sphere top pole
      BOMB_CZ - BOMB_R * 0.22,
    );
    group.add(hlMesh);

    // ── Fuse — slightly thicker, warm brown with orange-emissive tip ──────────
    const fuseStart = new THREE.Vector3(BOMB_CX,        BOMB_CY + BOMB_R,        BOMB_CZ);
    const fuseMid   = new THREE.Vector3(BOMB_CX + 0.09, BOMB_CY + BOMB_R + 0.14, BOMB_CZ - 0.14);
    const fuseEnd   = new THREE.Vector3(BOMB_CX + 0.18, BOMB_CY + BOMB_R + 0.26, BOMB_CZ - 0.27);
    const fuseCurve = new THREE.CatmullRomCurve3([fuseStart, fuseMid, fuseEnd]);
    const fuseGeo   = new THREE.TubeGeometry(fuseCurve, 8, 0.035, 6, false);  // thicker (was 0.022)
    const fuseMat   = new THREE.MeshStandardMaterial({
      color:             0x6b4423,   // dark brown
      emissive:          new THREE.Color(0xb84800),
      emissiveIntensity: 0.18,
      roughness:         0.85,
      metalness:         0.0,
      transparent:       alpha < 1,
      opacity:           alpha,
    });
    const fuseMesh = new THREE.Mesh(fuseGeo, fuseMat);
    group.add(fuseMesh);

    // ── Damage badge — white pill, below the bomb sphere ─────────────────────
    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width  = BADGE_CVS_W;
    badgeCanvas.height = BADGE_CVS_H;
    const badgeCtx = badgeCanvas.getContext('2d');
    const badgeTex = new THREE.CanvasTexture(badgeCanvas);
    const badgeMat = new THREE.MeshBasicMaterial({
      map: badgeTex, transparent: true, opacity: alpha, depthTest: false,
    });
    const badgeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(BADGE_W, BADGE_H),
      badgeMat,
    );
    badgeMesh.rotation.x = -Math.PI / 2;
    // Position: below the bomb in screen space (+Z in local = lower on screen)
    // and centered with the bomb in X.
    badgeMesh.position.set(BOMB_CX, 0.005, BOMB_R + BADGE_H * 0.65);
    group.add(badgeMesh);

    // Layer 1 = shooter camera only
    group.traverse(obj => { if (obj.isMesh) obj.layers.set(1); });

    group.scale.setScalar(scale);
    group.position.set(laneToX(laneIdx), 0, worldZ);
    group.visible = false;
    this._scene.add(group);

    return {
      group, sphereMesh, sphereMat, hlMesh, hlMat,
      fuseMesh, fuseMat,
      badgeCanvas, badgeCtx, badgeTex, badgeMesh, badgeMat,
      lastColor: -1, lastDamage: -1,
      _punching: false, _punchT: 0,
      _flashing: false, _flashT: 0,
      _baseScale: scale,
    };
  }
}
