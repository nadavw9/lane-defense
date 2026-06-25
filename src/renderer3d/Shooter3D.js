// Shooter3D — Bomb visual: flat powerball sprite + damage badge per slot.
// Top-down orthographic camera: PlaneGeometry rotated to face up shows the
// full bomb sprite (fuse, spark, shine) from directly above.
//
// Slot layout: 4 evenly-spaced cells filling the bomb zone (Z=0 breach line
// to Z≈11.2 booster bar). Each cell = CELL × 0.70 world units tall.
// Slot centers at midpoint of each cell: Z = (s + 0.5) × CELL × 0.70.

import * as THREE from 'three';
import { laneToX, CELL } from './Scene3D.js';

// ── Powerball texture cache (one loader shared across all slots) ───────────────
const _texLoader  = new THREE.TextureLoader();
const _texCache   = {};
function _getPowerballTex(colorName) {
  const key = colorName.toLowerCase();
  if (!_texCache[key]) {
    const tex = _texLoader.load(
      `${import.meta.env.BASE_URL}sprites/designed/powerball-${key}.png`,
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    _texCache[key] = tex;
  }
  return _texCache[key];
}

// ── Layout ─────────────────────────────────────────────────────────────────────
const LANE_COUNT = 4;
const SLOT_COUNT = 3;   // visible queue depth (was 4; 4th slot is now the stash)

// Bomb zone: Z=0 (breach) to Z≈11.2 (booster bar). Cell height = CELL × 0.70.
function slotZ(s) { return (s + 0.5) * CELL * 0.70; }

// Stash slot sits directly below the 3 queue slots (same position as old slot 3).
const STASH_Z = slotZ(3);

// ── Bomb geometry ──────────────────────────────────────────────────────────────
// BOMB_R = cell_height × 0.38 = CELL × 0.70 × 0.38 ≈ CELL × 0.266.
const BOMB_R   = CELL * 0.266;   // ≈ 1.064 world units (body radius for badge sizing)
const BOMB_CX  = 0;
const BOMB_CZ  = 0;
// Plane size: sprite is 1254×1254 with bomb body ~72% of image → scale up so
// body diameter matches the original sphere's visual size.
const BOMB_PLANE_SIZE = BOMB_R * 2.8;

// ── Badge canvas — single size for all slots ───────────────────────────────────
// BADGE_WORLD_H = 1.10 world units ≈ 22 px on screen (readable from across a room)
const BADGE_CVS_W   = 192;
const BADGE_CVS_H   = 112;
// World size kept inside the visible bomb ball (≈1.50 dia) so the dark pill behind
// the number doesn't bleed past the bomb edge.
const BADGE_WORLD_W = 1.34;
const BADGE_WORLD_H = 0.80;

// ── Color palette ──────────────────────────────────────────────────────────────
const COLOR_HEX = {
  Red:    0xFF1111,
  Blue:   0x1166FF,
  Green:  0x11CC11,
  Yellow: 0xFFDD00,
  Purple: 0xBB11FF,
  Orange: 0xFF7700,
};

// ── Cross-browser rounded rect ─────────────────────────────────────────────────
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

// ── Badge drawing — NO background, just a bold white number with a heavy dark
// stroke + drop-shadow so it reads on any bomb colour and never bleeds a dark
// rectangle outside the round bomb sprite.
function drawDamageBadge(ctx, W, H, damage) {
  ctx.clearRect(0, 0, W, H);

  const ph       = H * 0.78;
  const fontSize = Math.round(ph * 0.92);
  ctx.font         = `900 ${fontSize}px Arial`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  // Thin crisp outline + a small soft shadow — readable on any bomb colour
  // without forming a dark blob/background around the digit.
  ctx.shadowColor   = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur    = Math.max(2, H * 0.05);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.max(1, H * 0.02);

  ctx.lineWidth   = Math.max(2.5, fontSize * 0.07);
  ctx.strokeStyle = 'rgba(0,0,0,0.92)';
  ctx.strokeText(String(damage), W / 2, H / 2 + 1);

  ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(damage), W / 2, H / 2 + 1);
}

// Rainbow color-bomb badge — dark pill with a gold star (no damage number).
function drawColorBombBadge(ctx, W, H) {
  ctx.clearRect(0, 0, W, H);
  const pw = W * 0.90, ph = H * 0.78;
  const px = (W - pw) / 2, py = (H - ph) / 2;
  const r  = ph / 2;

  ctx.shadowColor   = 'rgba(0,0,0,0.80)';
  ctx.shadowBlur    = Math.max(4, H * 0.10);
  ctx.shadowOffsetY = Math.max(2, H * 0.05);
  _roundRect(ctx, px, py, pw, ph, r);
  ctx.fillStyle = 'rgb(40,30,55)';   // dark neutral so the gold star pops
  ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  _roundRect(ctx, px, py, pw, ph, r);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth   = 2.0;
  ctx.stroke();

  const fontSize = Math.round(ph * 0.82);
  ctx.font         = `900 ${fontSize}px Arial`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth    = Math.max(5, fontSize * 0.18);
  ctx.strokeStyle  = 'rgba(0,0,0,0.90)';
  ctx.strokeText('★', W / 2, H / 2 + 1);
  ctx.fillStyle = '#ffe14a';
  ctx.fillText('★', W / 2, H / 2 + 1);
}

// ── Punch ease-out ─────────────────────────────────────────────────────────────
function easeOut3(t) { return 1 - Math.pow(1 - Math.min(t, 1), 3); }

export class Shooter3D {
  constructor(scene, columns) {
    this._scene   = scene;
    this._columns = columns;
    this._elapsed = 0;

    this._bgPlane = this._createBgPlane();

    this._slots = [];
    for (let li = 0; li < LANE_COUNT; li++) {
      this._slots.push(
        Array.from({ length: SLOT_COUNT }, (_, si) => {
          const slot = this._createSlot(li, slotZ(si));
          if (si === 0) this._addColorBombOverlay(slot);
          return slot;
        }),
      );
    }

    // One stash slot per column — positioned at STASH_Z (below the 3 queue slots).
    this._stashSlots = [];
    for (let li = 0; li < LANE_COUNT; li++) {
      this._stashSlots.push(this._createStashSlot(li, STASH_Z));
    }

    this._activeColCount = LANE_COUNT;
    this._shakeT = 0;   // bomb-zone shake timer (wrong-shot feedback, 1D)
    this._selectedCol = -1;                              // 3B: grabbed-bomb column
    this._stashPulse  = new Array(LANE_COUNT).fill(0);   // 3D: per-column stash pulse
  }

  // ── Public API ─────────────────────────────────────────────────────────────────

  setLaneCount(n) {
    for (let li = 0; li < this._slots.length; li++) {
      const x = laneToX(li, n);
      for (let si = 0; si < this._slots[li].length; si++) {
        this._slots[li][si].group.position.x = x;
        this._slots[li][si].group.position.z = slotZ(si);
        this._slots[li][si].group._baseX      = x;   // shake/bob offset from this
      }
      if (this._stashSlots[li]) {
        this._stashSlots[li].group.position.x = x;
        this._stashSlots[li].group.position.z = STASH_Z;
        this._stashSlots[li].group._baseX     = x;
      }
    }
  }

  setActiveColCount(n) { this._activeColCount = n; }

  // Get the world position of a queue slot (for DragDrop hit-test coordination)
  // Not used for rendering (3D doesn't do 2D hit-tests), but called by DragDrop for symmetry
  getQueueSlotCenter(colIdx, rowIdx) {
    const x = laneToX(colIdx);
    const z = slotZ(rowIdx ?? 0);
    return { x, z };  // 3D uses x,z not x,y
  }

  // Brief horizontal jitter of the whole bomb queue — used on a wrong-colour shot
  // so the rejection reads in the bomb zone without shaking the whole screen. (1D)
  shakeZone(dur = 0.18) { this._shakeT = dur; }

  // 3B: which column's bomb is currently grabbed (-1 = none). The front bomb of
  // that column pops to 1.15x and the bombs behind it dim, for a focus effect.
  setSelectedColumn(colIdx) { this._selectedCol = colIdx ?? -1; }

  // 3D: pulse a column's stash slot (scale 1→1.2→1) to confirm a place/retrieve.
  pulseStash(colIdx) { if (colIdx >= 0 && colIdx < this._stashPulse.length) this._stashPulse[colIdx] = 0.2; }

  triggerPunch(colIdx) {
    const slot = this._slots[colIdx]?.[0];
    if (!slot) return;
    slot.group.scale.setScalar(1.40 * slot._baseScale);
    slot._punchT   = 0;
    slot._punching = true;
  }

  // World position of a queue slot's bomb. The bomb plane sits at the group origin
  // in X/Z, so the group's world position is the bomb's on-screen centre once
  // projected. GameRenderer3D projects this so 2D overlays (the merge halo) land
  // exactly on the 3D bomb.
  getSlotWorldPosition(col, row) {
    const slot = this._slots[col]?.[row];
    return slot ? slot.group.getWorldPosition(new THREE.Vector3()) : null;
  }

  update(dt, elapsed, colorBombArmed = false) {
    this._elapsed = elapsed;

    // Bomb-zone shake (1D): decaying horizontal jitter on all slot groups. Applied
    // every frame relative to each group's base X so it self-restores when idle.
    let shakeX = 0;
    if (this._shakeT > 0) {
      this._shakeT = Math.max(0, this._shakeT - dt);
      shakeX = Math.sin(this._shakeT * 80) * 0.22 * (this._shakeT / 0.18);
    }
    for (let li = 0; li < this._slots.length; li++) {
      for (let si = 0; si < this._slots[li].length; si++) {
        const g = this._slots[li][si].group;
        if (g._baseX != null) g.position.x = g._baseX + shakeX;
        // 3A: idle bob (top-down → Z is screen-vertical). Front bomb (si 0) bobs
        // more — it reads as the "active" one. Phase-offset per column + slot.
        if (g._baseZ == null) g._baseZ = g.position.z;
        // Merged bombs sit still (amp 0) so their static 2D halo stays concentric.
        const amp = (this._columns[li]?.shooters?.[si]?.isMerged) ? 0 : (si === 0 ? 0.12 : 0.06);
        g.position.z = g._baseZ + Math.sin(elapsed * 2.4 + li * 1.1 + si * 0.6) * amp;
      }
      const sg = this._stashSlots[li]?.group;
      if (sg && sg._baseX != null) sg.position.x = sg._baseX + shakeX;
    }

    for (let li = 0; li < LANE_COUNT; li++) {
      const col   = this._columns[li];
      const slots = this._slots[li];

      if (li >= this._activeColCount) {
        for (const slot of slots) slot.group.visible = false;
        if (this._stashSlots[li]) this._stashSlots[li].group.visible = false;
        continue;
      }

      // Merge-ready preview: a column exactly one swap from a vertical merge —
      // i.e. exactly 2 non-merged bombs share a colour — pulses those bombs so the
      // player can spot the play. 600ms opacity cycle, 0.7→1.0.
      const previewRows = new Set();
      if (col.shooters?.length) {
        const byColor = {};
        col.shooters.forEach((s, idx) => { if (s && !s.isMerged) (byColor[s.color] ??= []).push(idx); });
        for (const idxs of Object.values(byColor)) if (idxs.length === 2) idxs.forEach(idx => previewRows.add(idx));
      }
      const previewPulse = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(elapsed * (2 * Math.PI / 0.6)));

      for (let si = 0; si < SLOT_COUNT; si++) {
        const slot    = slots[si];
        const shooter = col.shooters?.[si] ?? null;

        if (!shooter) {
          slot.group.visible      = true;
          slot.sphereMesh.visible = false;
          slot.badgeMesh.visible  = false;
          slot.emptyMesh.visible  = true;
          continue;
        }

        slot.group.visible      = true;
        slot.sphereMesh.visible = true;
        slot.badgeMesh.visible  = true;
        slot.emptyMesh.visible  = false;

        const hex    = COLOR_HEX[shooter.color] ?? 0x888888;
        const damage = shooter.damage ?? 1;

        // Sync sprite texture + badge on color/damage change
        const isCB = shooter.isColorBomb === true && !shooter.mergeColorBomb;
        const isMerged = shooter.isMerged === true;
        if (slot.lastColor !== shooter.color || slot.lastDamage !== damage || slot.lastMerged !== isMerged) {
          slot.lastColor  = shooter.color;
          slot.lastDamage = damage;
          slot.lastMerged = isMerged;
          if (isCB) {
            // Rainbow: keep the prior powerball as a base; the rainbow swirl
            // overlay (below) dominates. Badge shows a gold star, not a number.
            drawColorBombBadge(slot.badgeCtx, BADGE_CVS_W, BADGE_CVS_H);
          } else {
            slot.sphereMesh.material.map = _getPowerballTex(shooter.color);
            slot.sphereMesh.material.needsUpdate = true;
            drawDamageBadge(slot.badgeCtx, BADGE_CVS_W, BADGE_CVS_H, damage, hex);
          }
          slot.badgeTex.needsUpdate = true;
        }

        // Punch scale spring (front slot only)
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

        // Merged bomb visual: scale up to 1.3x with a subtle pulse. These bombs use
        // MeshBasicMaterial (no emissive channel), so the "glow" reads via scale; a
        // vertical merge additionally shows the color-bomb shimmer below.
        if (si === 0 && !slot._punching && isMerged) {
          const pulseScale = 1.0 + 0.15 * Math.sin(elapsed * 2.5);
          slot.group.scale.setScalar((1.30 * pulseScale) * slot._baseScale);
        } else if (si === 0 && !slot._punching) {
          // 3B: the grabbed column's front bomb pops to 1.15x (focus); others rest.
          const sel = (li === this._selectedCol) ? 1.15 : 1.0;
          slot.group.scale.setScalar(sel * slot._baseScale);
        }

        // Opacity: dim bombs queued behind the grabbed column (0.7); pulse bombs
        // one swap from a vertical merge (merge-ready preview, 0.7→1.0, 600ms).
        let opacity = 1.0;
        if (si > 0 && li === this._selectedCol) opacity = 0.7;
        else if (previewRows.has(si) && li !== this._selectedCol) opacity = previewPulse;
        slot.sphereMesh.material.transparent = opacity < 1.0;
        slot.sphereMesh.material.opacity     = opacity;
        if (slot.badgeMesh.material) {
          slot.badgeMesh.material.transparent = opacity < 1.0;
          slot.badgeMesh.material.opacity     = opacity;
        }

        // Color-bomb indicator — front slot only. Driven by the shooter itself
        // now (the rainbow is a real queue item), not a global armed flag.
        // Rainbow swirl overlay and gold-star badge apply only to earned rainbow bombs,
        // not merge color bombs (which render as solid colour + damage number).
        if (si === 0 && slot.cbOverlayMesh) {
          const armed = shooter.isColorBomb === true && !shooter.mergeColorBomb;
          slot.cbOverlayMesh.visible = armed;
          slot.cbSparkMesh.visible   = armed;
          if (armed) {
            // Slow gradient swirl — one full rotation every ~3 s
            slot.cbOverlayMesh.rotation.z = (elapsed * Math.PI * 2) / 3;
            // Very gentle shimmer, barely perceptible
            slot.cbOverlayMat.opacity = 0.84 + 0.06 * Math.sin(elapsed * 2.0);
            // Sparkle slow twinkle
            slot.cbSparkMat.opacity = 0.60 + 0.40 * Math.abs(Math.sin(elapsed * 1.8));
          }
        }
      }

      // ── Stash slot ──────────────────────────────────────────────────────────
      const stash = this._stashSlots[li];
      if (!stash) continue;
      stash.group.visible = true;

      // 3D: receipt pulse (scale 1→1.2→1) on place/retrieve.
      if (stash._baseScale == null) stash._baseScale = stash.group.scale.x || 1;
      if (this._stashPulse[li] > 0) {
        this._stashPulse[li] = Math.max(0, this._stashPulse[li] - dt);
        const p = 1 - this._stashPulse[li] / 0.2;
        stash.group.scale.setScalar((1 + 0.2 * Math.sin(Math.PI * p)) * stash._baseScale);
        if (this._stashPulse[li] === 0) stash.group.scale.setScalar(stash._baseScale);
      }

      const stashedShooter = col.stash ?? null;
      if (!stashedShooter) {
        stash.sphereMesh.visible = false;
        stash.badgeMesh.visible  = false;
        stash.ringMesh.visible   = false;   // RETIRED: stash drawing removed (bench is the sole storage)
      } else {
        stash.sphereMesh.visible = true;
        stash.badgeMesh.visible  = true;
        stash.ringMesh.visible   = false;

        const hex    = COLOR_HEX[stashedShooter.color] ?? 0x888888;
        const damage = stashedShooter.damage ?? 1;

        if (stash.lastColor !== stashedShooter.color || stash.lastDamage !== damage) {
          stash.lastColor  = stashedShooter.color;
          stash.lastDamage = damage;
          stash.sphereMesh.material.map = _getPowerballTex(stashedShooter.color);
          stash.sphereMesh.material.needsUpdate = true;
          drawDamageBadge(stash.badgeCtx, BADGE_CVS_W, BADGE_CVS_H, damage, hex);
          stash.badgeTex.needsUpdate = true;
          // Dim the stash bomb slightly to distinguish from queue bombs
          stash.sphereMesh.material.opacity = 0.72;
          stash.sphereMesh.material.needsUpdate = true;
        }
      }
    }
  }

  dispose() {
    if (this._bgPlane) {
      this._bgPlane.material.map?.dispose();
      this._bgPlane.material.dispose();
      this._bgPlane.geometry.dispose();
      this._scene.remove(this._bgPlane);
      this._bgPlane = null;
    }
    for (const laneSlots of this._slots) {
      for (const slot of laneSlots) {
        slot.badgeTex.dispose();
        slot.sphereMesh.geometry.dispose();
        slot.sphereMesh.material.dispose();
        slot.emptyMesh.geometry.dispose();
        slot.emptyMat.dispose();
        slot.badgeMat.dispose();
        slot.cbOverlayMesh?.geometry.dispose();
        slot.cbOverlayTex?.dispose();
        slot.cbOverlayMat?.dispose();
        slot.cbSparkTex?.dispose();
        slot.cbSparkMat?.dispose();
        this._scene.remove(slot.group);
      }
    }
    this._slots = [];
    for (const stash of this._stashSlots) {
      stash.badgeTex.dispose();
      stash.sphereMesh.geometry.dispose();
      stash.sphereMesh.material.dispose();
      stash.ringMesh.geometry.dispose();
      stash.ringMat.dispose();
      stash.badgeMat.dispose();
      this._scene.remove(stash.group);
    }
    this._stashSlots = [];
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _createBgPlane() {
    // Covers full bomb zone: Z=0 (breach) to Z≈12.6 (past stash slot).
    // Width wider than widest frustum (≈19.3) so edges are never visible.
    // Y=-0.001 keeps us above the Road3D nearExtMesh at y=-0.02 so depth test wins.
    const BG_W     = CELL * 5;     // 20 world units
    const BG_DEPTH = CELL * 3.15;  // 12.6 world units — Z=0 to past stash

    // Base color visible before/if texture loads — same range as the empty-slot ring color.
    // map is set via onLoad so Three.js never renders the black "pending" placeholder.
    const mat = new THREE.MeshBasicMaterial({
      color: 0x888888,
      side:  THREE.DoubleSide,
    });
    _texLoader.load(
      `${import.meta.env.BASE_URL}sprites/designed/panel-workshop-surface.png`,
      (tex) => {
        tex.wrapS      = THREE.RepeatWrapping;
        tex.wrapT      = THREE.RepeatWrapping;
        tex.repeat.set(5, 3.15);
        tex.colorSpace = THREE.SRGBColorSpace;
        mat.map        = tex;
        // Texture pixels are ~16% gray panels / ~27% grid lines in sRGB.
        // Values > 1.0 multiply the texture brightness so grid lines are clearly
        // visible (target: panels ~30% display brightness, grid ~50%).
        mat.color.setRGB(2.5, 2.6, 3.0);
        mat.needsUpdate = true;
      },
    );
    const geo  = new THREE.PlaneGeometry(BG_W, BG_DEPTH);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0.001, BG_DEPTH / 2);
    this._scene.add(mesh);
    return mesh;
  }

  _createSlot(laneIdx, worldZ) {
    const group = new THREE.Group();

    // ── Bomb plane — powerball sprite lying flat (top-down camera sees full sprite)
    const sphereMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(BOMB_PLANE_SIZE, BOMB_PLANE_SIZE),
      new THREE.MeshBasicMaterial({
        transparent: true,
        alphaTest:   0.05,
        color:       new THREE.Color(0xffffff),
        side:        THREE.DoubleSide,
        depthWrite:  false,
      }),
    );
    sphereMesh.rotation.x = -Math.PI / 2;
    sphereMesh.position.set(BOMB_CX, 0.05, BOMB_CZ);
    group.add(sphereMesh);

    // ── Damage badge — colored pill, bold white number ─────────────────────────
    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width  = BADGE_CVS_W;
    badgeCanvas.height = BADGE_CVS_H;
    const badgeCtx = badgeCanvas.getContext('2d');
    const badgeTex = new THREE.CanvasTexture(badgeCanvas);
    const badgeMat = new THREE.SpriteMaterial({
      map: badgeTex, transparent: true, depthTest: false,
      // Discard fully-transparent texels so the cleared canvas doesn't render as a
      // dark rectangle behind the number (only the digit's pixels draw).
      alphaTest: 0.04,
    });
    const badgeMesh = new THREE.Sprite(badgeMat);
    badgeMesh.scale.set(BADGE_WORLD_W, BADGE_WORLD_H, 1);
    badgeMesh.position.set(BOMB_CX, BOMB_R + 0.60, BOMB_CZ);
    group.add(badgeMesh);

    // ── Empty slot placeholder — dim grey sphere when no shooter ──────────────
    const emptyMat = new THREE.MeshStandardMaterial({
      color:             0x888888,
      emissive:          0x333333,
      emissiveIntensity: 0.10,
      metalness:         0.0,
      roughness:         0.70,
      transparent:       true,
      opacity:           0.25,
    });
    const emptyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BOMB_R, 12, 8),
      emptyMat,
    );
    emptyMesh.position.set(BOMB_CX, BOMB_R, BOMB_CZ);
    emptyMesh.visible = false;
    group.add(emptyMesh);

    group.traverse(obj => { if (obj.isMesh || obj.isSprite) obj.layers.set(0); });

    group.scale.setScalar(1.0);
    group.position.set(laneToX(laneIdx), 0, worldZ);
    group.visible = false;
    this._scene.add(group);

    return {
      group,
      sphereMesh,
      emptyMesh,  emptyMat,
      badgeCanvas, badgeCtx, badgeTex, badgeMesh, badgeMat,
      lastColor:  '',
      lastDamage: -1,
      lastMerged: false,
      _punching: false, _punchT: 0,
      _baseScale: 1.0,
    };
  }

  // Color-bomb-armed overlay: replaces bomb body with a swirling rainbow disc
  // + one white 4-point sparkle badge at top-right. No rings, no halos.
  _addColorBombOverlay(slot) {
    // ── Rainbow gradient canvas ─────────────────────────────────────────────
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = 128;
    const ctx = cvs.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    const RAINBOW = ['#ff2222', '#ff8800', '#ffee00', '#22cc44', '#2288ff', '#cc22ff'];
    if (ctx.createConicGradient) {
      // Smooth gradient sweep starting at top (−π/2)
      const grd = ctx.createConicGradient(-Math.PI / 2, 64, 64);
      for (let i = 0; i <= 6; i++) grd.addColorStop(i / 6, RAINBOW[i % 6]);
      ctx.beginPath();
      ctx.arc(64, 64, 62, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    } else {
      // Fallback: 6 hard-edged pie slices
      const slice = (Math.PI * 2) / 6;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(64, 64);
        ctx.arc(64, 64, 62, i * slice, (i + 1) * slice);
        ctx.closePath();
        ctx.fillStyle = RAINBOW[i];
        ctx.fill();
      }
    }
    const overlayTex = new THREE.CanvasTexture(cvs);
    const overlayMat = new THREE.MeshBasicMaterial({
      map:         overlayTex,
      transparent: true,
      opacity:     0.88,
      depthWrite:  false,
      side:        THREE.DoubleSide,
    });
    // Match the rainbow disc to the regular powerball ball EXACTLY. Measured:
    // the powerball sprite's ball is ~50.2% of its 1254px canvas width, so the
    // rendered ball ≈ 0.502 × BOMB_PLANE_SIZE. The conic gradient fills 62/64
    // (0.969) of the overlay plane, so plane = 0.502 / 0.969 ≈ 0.518 × BOMB_PLANE_SIZE.
    const cbDisc = BOMB_PLANE_SIZE * 0.518;
    const overlayMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(cbDisc, cbDisc),
      overlayMat,
    );
    overlayMesh.rotation.x = -Math.PI / 2;
    overlayMesh.position.set(0, 0.07, 0);  // just above the bomb sprite (y=0.05)
    overlayMesh.visible = false;
    slot.group.add(overlayMesh);

    // ── 4-point sparkle ─────────────────────────────────────────────────────
    const spkCvs = document.createElement('canvas');
    spkCvs.width = spkCvs.height = 64;
    const spkCtx = spkCvs.getContext('2d');
    spkCtx.clearRect(0, 0, 64, 64);
    spkCtx.save();
    spkCtx.translate(32, 32);
    spkCtx.fillStyle = '#ffffff';
    // Vertical arm
    spkCtx.beginPath();
    spkCtx.ellipse(0, 0, 3, 22, 0, 0, Math.PI * 2);
    spkCtx.fill();
    // Horizontal arm
    spkCtx.beginPath();
    spkCtx.ellipse(0, 0, 22, 3, 0, 0, Math.PI * 2);
    spkCtx.fill();
    spkCtx.restore();
    // Bright center
    const cg = spkCtx.createRadialGradient(32, 32, 0, 32, 32, 5);
    cg.addColorStop(0, 'rgba(255,255,255,1)');
    cg.addColorStop(1, 'rgba(255,255,255,0)');
    spkCtx.beginPath();
    spkCtx.arc(32, 32, 5, 0, Math.PI * 2);
    spkCtx.fillStyle = cg;
    spkCtx.fill();

    const spkTex  = new THREE.CanvasTexture(spkCvs);
    const spkMat  = new THREE.SpriteMaterial({ map: spkTex, transparent: true, depthTest: false });
    const spkMesh = new THREE.Sprite(spkMat);
    spkMesh.scale.set(0.60, 0.60, 1);
    // Top-right corner: +X right, −Z toward road = "up" on screen
    spkMesh.position.set(BOMB_R * 1.00, 0.80, -BOMB_R * 0.98);
    spkMesh.visible = false;
    slot.group.add(spkMesh);

    slot.cbOverlayMesh = overlayMesh;
    slot.cbOverlayMat  = overlayMat;
    slot.cbOverlayTex  = overlayTex;
    slot.cbSparkMesh   = spkMesh;
    slot.cbSparkMat    = spkMat;
    slot.cbSparkTex    = spkTex;
  }

  // Creates the stash slot at worldZ. Uses a dashed ring for empty state instead
  // of the queue's dim sphere, so the player can visually distinguish it.
  _createStashSlot(laneIdx, worldZ) {
    const group = new THREE.Group();

    // ── Bomb plane — same as queue slots but 80% scale ─────────────────────────
    const sphereMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(BOMB_PLANE_SIZE * 0.80, BOMB_PLANE_SIZE * 0.80),
      new THREE.MeshBasicMaterial({
        transparent: true,
        alphaTest:   0.05,
        opacity:     0.72,
        color:       new THREE.Color(0xffffff),
        side:        THREE.DoubleSide,
        depthWrite:  false,
      }),
    );
    sphereMesh.rotation.x = -Math.PI / 2;
    sphereMesh.position.set(BOMB_CX, 0.05, BOMB_CZ);
    sphereMesh.visible = false;
    group.add(sphereMesh);

    // ── Damage badge ───────────────────────────────────────────────────────────
    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width  = BADGE_CVS_W;
    badgeCanvas.height = BADGE_CVS_H;
    const badgeCtx = badgeCanvas.getContext('2d');
    const badgeTex = new THREE.CanvasTexture(badgeCanvas);
    const badgeMat = new THREE.SpriteMaterial({ map: badgeTex, transparent: true, depthTest: false });
    const badgeMesh = new THREE.Sprite(badgeMat);
    badgeMesh.scale.set(BADGE_WORLD_W * 0.80, BADGE_WORLD_H * 0.80, 1);
    badgeMesh.position.set(BOMB_CX, BOMB_R * 0.80 + 0.50, BOMB_CZ);
    badgeMesh.visible = false;
    group.add(badgeMesh);

    // ── Empty state: dashed ring (TorusGeometry seen from top looks like a circle)
    const ringMat = new THREE.MeshBasicMaterial({
      color:       0x556677,
      transparent: true,
      opacity:     0.55,
      side:        THREE.DoubleSide,
      depthWrite:  false,
    });
    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(BOMB_R * 0.80, 0.07, 6, 16),
      ringMat,
    );
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(BOMB_CX, 0.02, BOMB_CZ);
    group.add(ringMesh);

    group.traverse(obj => { if (obj.isMesh || obj.isSprite) obj.layers.set(0); });
    group.scale.setScalar(1.0);
    group.position.set(laneToX(laneIdx), 0, worldZ);
    group.visible = false;
    this._scene.add(group);

    return {
      group, sphereMesh, ringMesh, ringMat,
      badgeCanvas, badgeCtx, badgeTex, badgeMesh, badgeMat,
      lastColor: '', lastDamage: -1,
    };
  }
}
