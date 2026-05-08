// Shooter3D — Royal Match / Color Block Jam candy-bomb visuals.
// Top-down orthographic camera (layer 1): bombs appear as circles from above.
// Design: color-dominant sphere + billiard-ball shading + colored ground halo.
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

// ── Shared textures (created once, reused across all slots) ───────────────────
let _hlTex   = null;
let _vignTex = null;

/** Specular crescent: bright center fading to transparent, offset top-left. */
function _getHighlightTex() {
  if (_hlTex) return _hlTex;
  const cv  = document.createElement('canvas');
  cv.width  = cv.height = 48;
  const ctx = cv.getContext('2d');
  const g   = ctx.createRadialGradient(14, 12, 0, 16, 14, 20);
  g.addColorStop(0,    'rgba(255,255,255,0.95)');
  g.addColorStop(0.38, 'rgba(255,255,255,0.60)');
  g.addColorStop(0.70, 'rgba(255,255,255,0.18)');
  g.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(22, 20, 20, 0, Math.PI * 2); ctx.fill();
  _hlTex = new THREE.CanvasTexture(cv);
  return _hlTex;
}

/** Vignette: transparent center → dark edge. Creates billiard-ball rim shading. */
function _getVignetteTex() {
  if (_vignTex) return _vignTex;
  const cv  = document.createElement('canvas');
  cv.width  = cv.height = 64;
  const ctx = cv.getContext('2d');
  const g   = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0,    'rgba(0,0,0,0)');
  g.addColorStop(0.52, 'rgba(0,0,0,0)');
  g.addColorStop(0.80, 'rgba(0,0,0,0.32)');
  g.addColorStop(1,    'rgba(0,0,0,0.72)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(32, 32, 32, 0, Math.PI * 2); ctx.fill();
  _vignTex = new THREE.CanvasTexture(cv);
  return _vignTex;
}

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

    // ── Front-slot glow rings — colored, pulsing ──────────────────────────────
    this._glowRings = [];
    const ringGeo   = new THREE.RingGeometry(BOMB_R * 1.30, BOMB_R * 1.78, 32);
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
    slot.group.scale.setScalar(1.40 * slot._baseScale);
    slot._punchT   = 0;
    slot._punching = true;
    slot._flashT   = 0;
    slot._flashing = true;
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

        // Sync colors on change
        if (slot.lastColor !== hex || slot.lastDamage !== damage) {
          slot.lastColor  = hex;
          slot.lastDamage = damage;
          slot.sphereMat.color.setHex(hex);
          slot.sphereMat.emissive.setHex(hex);
          slot.haloMat.color.setHex(hex);   // colored ground shadow matches bomb
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

      // Glow ring — colored, pulsing amplitude
      const gr = this._glowRings[li];
      gr.mesh.visible = mainVisible;
      if (mainVisible) {
        const pulse    = 0.5 + 0.5 * Math.sin(elapsed * 3.0 + li * 0.8);
        gr.mat.opacity = 0.32 + 0.52 * pulse;
        const s        = 1.0 + 0.12 * pulse;
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
        slot.vignMesh.geometry.dispose();
        slot.hlMesh.geometry.dispose();
        slot.haloMesh.geometry.dispose();
        slot.fuseMesh.geometry.dispose();
        slot.badgeMesh.geometry.dispose();
        slot.sphereMat.dispose();
        slot.vignMat.dispose();
        slot.hlMat.dispose();
        slot.haloMat.dispose();
        slot.fuseMat.dispose();
        slot.badgeMat.dispose();
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

    // ── Colored ground halo — Royal Match style cast shadow ───────────────────
    // Flat disc at road surface level in the lane color. Reads like a colored
    // "cast shadow" that immediately communicates color identity before the
    // player even looks at the sphere. Most visible at queue depth 2–3.
    const haloMat = new THREE.MeshBasicMaterial({
      color:      new THREE.Color(0x888888),   // synced to lane color each frame
      transparent: true,
      opacity:    0.38 * alpha,
      depthWrite: false,
    });
    const haloMesh = new THREE.Mesh(
      new THREE.CircleGeometry(BOMB_R * 1.55, 32),
      haloMat,
    );
    haloMesh.rotation.x = -Math.PI / 2;
    haloMesh.position.set(BOMB_CX, 0.003, BOMB_CZ);
    group.add(haloMesh);

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

    // ── Vignette disc — billiard-ball rim darkening ───────────────────────────
    // Dark-edge radial gradient laid flat on the sphere's top pole.
    // From the top-down camera this creates the illusion of a sphere curving
    // away at the edges (lighter center → darker equatorial rim). Radius
    // slightly exceeds BOMB_R so it covers the full sphere silhouette.
    const vignMat = new THREE.MeshBasicMaterial({
      map:        _getVignetteTex(),
      transparent: true,
      opacity:    0.52 * alpha,
      depthTest:  false,
    });
    const vignMesh = new THREE.Mesh(
      new THREE.CircleGeometry(BOMB_R + 0.010, 32),
      vignMat,
    );
    vignMesh.rotation.x = -Math.PI / 2;
    // Place flush with sphere top (y = BOMB_CY + BOMB_R), epsilon above sphere surface
    // so the top-down camera sees it above the sphere.
    vignMesh.position.set(BOMB_CX, BOMB_CY + BOMB_R + 0.001, BOMB_CZ);
    group.add(vignMesh);

    // ── Specular highlight — top-left white crescent ──────────────────────────
    // Off-center bright spot simulating a light source from top-left.
    // Larger and more opaque than a single point glint to read clearly
    // at small display sizes.
    const hlMat = new THREE.MeshBasicMaterial({
      map:        _getHighlightTex(),
      transparent: true,
      opacity:    alpha * 0.90,
      depthTest:  false,
    });
    const hlMesh = new THREE.Mesh(
      new THREE.CircleGeometry(BOMB_R * 0.66, 18),
      hlMat,
    );
    hlMesh.rotation.x = -Math.PI / 2;
    hlMesh.position.set(
      BOMB_CX - BOMB_R * 0.22,
      BOMB_CY + BOMB_R + 0.003,   // above vignette disc
      BOMB_CZ - BOMB_R * 0.22,    // offset toward top of screen (negative Z = up)
    );
    group.add(hlMesh);

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
    // Positioned below the sphere in screen space (+Z = lower on screen).
    // depthTest:false ensures it always renders even though it sits near y=0.
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
    badgeMesh.position.set(BOMB_CX, 0.005, BOMB_R + BADGE_H * 0.65);
    group.add(badgeMesh);

    // All meshes render only on the shooter camera (layer 1)
    group.traverse(obj => { if (obj.isMesh) obj.layers.set(1); });

    group.scale.setScalar(scale);
    group.position.set(laneToX(laneIdx), 0, worldZ);
    group.visible = false;
    this._scene.add(group);

    return {
      group,
      sphereMesh, sphereMat,
      vignMesh,   vignMat,
      hlMesh,     hlMat,
      haloMesh,   haloMat,
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
