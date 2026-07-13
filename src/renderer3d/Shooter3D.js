// Shooter3D — Bomb visual: flat powerball sprite + damage badge per slot.
// Top-down orthographic camera: PlaneGeometry rotated to face up shows the
// full bomb sprite (fuse, spark, shine) from directly above.
//
// Slot layout: 4 evenly-spaced cells filling the bomb zone (Z=0 breach line
// to the booster bar). Slot Z positions come from projection.js's
// bombSlotZ() — the canonical source every consumer (this file's 3D ball,
// PositionRegistry, ShooterRenderer, DragDrop) must use; see that function's
// comment for why.

import * as THREE from 'three';
import { laneToX, CELL } from './Scene3D.js';
import { BOMB_R, MERGE_SCALE, BOMB_ZONE_SCALE, bombSlotZ } from './projection.js';

// ── Powerball texture cache (one loader shared across all slots) ───────────────
const _texLoader  = new THREE.TextureLoader();
const _texCache   = {};
// merged=true → the special lightning-crack merged-bomb sprite for that colour.
function _getPowerballTex(colorName, merged = false) {
  const color = colorName.toLowerCase();
  const key   = merged ? `merged-${color}` : color;
  if (!_texCache[key]) {
    const file = merged ? `powerball-merged-${color}.png` : `powerball-${color}.png`;
    const tex  = _texLoader.load(`${import.meta.env.BASE_URL}sprites/designed/${file}`);
    tex.colorSpace = THREE.SRGBColorSpace;
    _texCache[key] = tex;
  }
  return _texCache[key];
}

// ── Layout ─────────────────────────────────────────────────────────────────────
const LANE_COUNT = 4;
const SLOT_COUNT = 3;   // visible queue depth (was 4; 4th slot is now the stash)

// ── Bomb geometry ──────────────────────────────────────────────────────────────
// BOMB_R, MERGE_SCALE, and slot Z positions (bombSlotZ) are imported from
// projection.js — the SINGLE canonical source for bomb-slot geometry.
// Formerly duplicated here (own slotZ formula + breach-clearance derivation);
// PositionRegistry and ShooterRenderer each carried their OWN independent
// copies too, and the three silently drifted apart. Never re-derive any of
// this locally — see the projection.js comment above bombSlotZ.
const BOMB_CX  = 0;
const BOMB_CZ  = 0;

function slotZ(s) { return bombSlotZ(s); }

// Stash slot sits directly below the 3 queue slots (same position as old slot 3).
const STASH_Z = slotZ(3);
// Plane size: sprite is 1254×1254 with bomb body ~72% of image → scale up so
// body diameter matches the original sphere's visual size.
const BOMB_PLANE_SIZE = BOMB_R * 2.8;

// ── Badge canvas ───────────────────────────────────────────────────────────────
// The canvas is sized from the badge's ACTUAL on-screen size (world units ×
// device px/wu, passed in by GameRenderer3D from projection.js) × 2 supersample.
// The old fixed 192×112 canvas displayed at ~23 screen px minified ~8× through
// the mip chain — the numbers rendered blurry, worst at side slots where the
// sprite lands on fractional pixels. BADGE_SS=2 needs only one clean 2:1
// downsample with plain linear filtering (mipmaps off).
const BADGE_SS = 2;
const BADGE_PX_PER_WU_FALLBACK = 35;   // ≈ 390-stage px/wu (17.4) × DPR 2
// Badge world size, expressed as a fixed ratio to BOMB_R (2.30/1.60 tuned
// against the unscaled 1.064wu ball: digit cap height ≈54% of ball diameter,
// the match-3 standard for at-a-glance readability) so the number ALWAYS
// scales in lockstep with the ball — BOMB_ZONE_SCALE shrinks both together,
// never independently (a badge that shrank on its own axis would drift off
// the ball's new size, or stay readable-but-oversized against a smaller ball).
const BADGE_WORLD_W = 2.30 * BOMB_ZONE_SCALE;
const BADGE_WORLD_H = 1.60 * BOMB_ZONE_SCALE;

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

  // Proportional stroke — slightly heavier than body text so the digit reads
  // as a game piece label at arm's length.
  ctx.lineWidth   = Math.max(1.5, fontSize * 0.10);
  ctx.strokeStyle = 'rgba(0,0,0,0.92)';
  ctx.strokeText(String(damage), W / 2, H / 2 + 1);

  ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(damage), W / 2, H / 2 + 1);
}

// Rainbow color-bomb badge — dark pill with a gold star (no damage number).
// Pill fractions are tuned against the ENLARGED badge quad (2.30×1.60 wu) to
// keep the pill at its original on-screen size (~1.2×0.62 wu).
function drawColorBombBadge(ctx, W, H) {
  ctx.clearRect(0, 0, W, H);
  const pw = W * 0.52, ph = H * 0.40;
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
  // pxPerWu: device (render-target) pixels per world unit — computed by
  // GameRenderer3D from projection.computeFrustum × renderer pixel ratio, so
  // badge canvases match their real on-screen size instead of a guessed one.
  constructor(scene, columns, pxPerWu = BADGE_PX_PER_WU_FALLBACK) {
    this._scene   = scene;
    this._columns = columns;
    this._elapsed = 0;
    this._badgeW  = Math.max(32, Math.round(BADGE_WORLD_W * pxPerWu * BADGE_SS));
    this._badgeH  = Math.max(20, Math.round(BADGE_WORLD_H * pxPerWu * BADGE_SS));

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

  // ── Merge-animation hooks (driven by the GameApp merge sequencer) ─────────────
  // While a slot is anim-locked, update() leaves its position/scale/opacity alone
  // so the sequencer can drive them; texture/visibility still sync from data.
  setSlotAnimLock(col, row, locked) {
    const slot = this._slots[col]?.[row];
    if (slot) slot._animLock = !!locked;
  }
  setSlotScale(col, row, s) {
    const slot = this._slots[col]?.[row];
    if (slot) slot.group.scale.setScalar(s * (slot._baseScale ?? 1));
  }
  setSlotWorldXYZ(col, row, x, y, z) {
    const slot = this._slots[col]?.[row];
    if (slot) slot.group.position.set(x, y, z);
  }
  // Called the instant a merge/refill animation releases a slot (still inside
  // the SAME synchronous call as setSlotAnimLock(false) — see GameApp's
  // _beginFill). Must land on the FINAL resting scale immediately: a merged
  // dest slot's resting scale is MERGE_SCALE, not the generic _baseScale
  // (1.0) — landing on 1.0 here and relying on the next update() tick to
  // correct it to MERGE_SCALE produced a one-frame shrink-then-regrow after
  // every merge (visible as a glitch, 2026-07-13).
  resetSlotTransform(col, row) {
    const slot = this._slots[col]?.[row];
    if (!slot) return;
    const shooter = this._columns[col]?.shooters?.[row];
    const scale = (row === 0 && shooter?.isMerged) ? MERGE_SCALE : 1;
    slot.group.scale.setScalar(scale * (slot._baseScale ?? 1));  // position restored by idle bob once unlocked
  }
  // CANONICAL resting world position of a slot (NOT the live group, which may be
  // mid-animation) — the drop-in target for a freshly spawned bomb.
  getSlotBaseWorld(col, row) {
    const slot = this._slots[col]?.[row];
    if (!slot) return null;
    const x = slot.group._baseX ?? slot.group.position.x;
    return new THREE.Vector3(x, 0, slotZ(row));
  }
  clearAllAnimLocks() {
    for (const col of this._slots) for (const slot of col) slot._animLock = false;
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
        if (this._slots[li][si]._animLock) continue;   // merge sequencer drives this slot
        const g = this._slots[li][si].group;
        if (g._baseX != null) g.position.x = g._baseX + shakeX;
        // Bombs rest STILL. The old idle bob spanned only ±0.12 wu ≈ ±2.4 device
        // px — a sine that small renders as discrete 1px steps with ~0.5s dwells
        // at its extremes ("stuck then jumps"), and it dragged the big damage
        // digit with it. Liveliness comes from alpha effects (merge halo pulse,
        // merge-ready ball pulse) and event motion (punch spring, shake), which
        // read smoothly because they don't crawl geometry across pixels.
        if (g._baseZ == null) g._baseZ = g.position.z;
        g.position.z = g._baseZ;
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
            drawColorBombBadge(slot.badgeCtx, slot.badgeCanvas.width, slot.badgeCanvas.height);
          } else {
            // Merged bombs use the dedicated lightning-crack sprite; the 2D halo
            // ring (ShooterRenderer.drawMergeOverlay) still layers on top.
            slot.sphereMesh.material.map = _getPowerballTex(shooter.color, isMerged);
            slot.sphereMesh.material.needsUpdate = true;
            drawDamageBadge(slot.badgeCtx, slot.badgeCanvas.width, slot.badgeCanvas.height, damage, hex);
          }
          slot.badgeTex.needsUpdate = true;
        }

        // Merge sequencer owns this slot's scale/opacity while locked.
        if (slot._animLock) continue;

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

        // Merged bomb visual: enlarged, STATIC. MERGE_SCALE is the exact value
        // slotZ()'s breach clearance was derived against, so the ball body is
        // guaranteed to clear the hazard stripe at this scale — the old
        // 1.30±15% pulse (up to 1.50×) exceeded what any fixed clearance could
        // absorb and pushed the ball under the stripe every cycle. No scale
        // pulse either: ±4% on the crisp digit smeared it sub-pixel every
        // frame; the 2D halo's alpha pulse carries the glow instead.
        if (si === 0 && !slot._punching && isMerged) {
          slot.group.scale.setScalar(MERGE_SCALE * slot._baseScale);
        } else if (si === 0 && !slot._punching) {
          // 3B: the grabbed column's front bomb pops to 1.15x (focus); others rest.
          const sel = (li === this._selectedCol) ? 1.15 : 1.0;
          slot.group.scale.setScalar(sel * slot._baseScale);
        }

        // Opacity: dim bombs queued behind the grabbed column (0.7); pulse bombs
        // one swap from a vertical merge (merge-ready preview, 600ms cycle).
        // The damage NUMBER never pulses — flashing the big white digit every
        // 0.6 s read as jitter; the hint lives on the ball alone (soft 0.85→1.0).
        let ballOpacity = 1.0;
        if (si > 0 && li === this._selectedCol) ballOpacity = 0.7;
        else if (previewRows.has(si) && li !== this._selectedCol) {
          ballOpacity = 0.85 + 0.15 * (previewPulse - 0.7) / 0.3;
        }
        slot.sphereMesh.material.transparent = ballOpacity < 1.0;
        slot.sphereMesh.material.opacity     = ballOpacity;
        if (slot.badgeMesh.material) {
          const badgeOpacity = (si > 0 && li === this._selectedCol) ? 0.7 : 1.0;
          slot.badgeMesh.material.opacity = badgeOpacity;
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
          drawDamageBadge(stash.badgeCtx, stash.badgeCanvas.width, stash.badgeCanvas.height, damage, hex);
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

    // ── Damage badge — bold white number, canvas at 2× on-screen pixel size ────
    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width  = this._badgeW;
    badgeCanvas.height = this._badgeH;
    const badgeCtx = badgeCanvas.getContext('2d');
    const badgeTex = new THREE.CanvasTexture(badgeCanvas);
    // Only a single 2:1 minification happens — plain linear filtering keeps the
    // glyph edges crisp; the mip chain blurred them on the old 192px canvas.
    badgeTex.generateMipmaps = false;
    badgeTex.minFilter = THREE.LinearFilter;
    const badgeMat = new THREE.SpriteMaterial({
      map: badgeTex, transparent: true, depthTest: false,
      // Required: alpha-0 canvas texels otherwise render as a dark quad in the
      // tonemapped composer pipeline. Harmless to crispness at ~1:1 texel scale
      // (it only eroded glyphs when combined with the old 8× mip minification).
      alphaTest: 0.04,
      // UI text, not scene lighting: skip ACES so the digits stay pure white
      // with a full-contrast black stroke instead of tonemapped grey.
      toneMapped: false,
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

    // ── Damage badge — canvas at 2× the stash's 0.80-scaled on-screen size ─────
    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width  = Math.round(this._badgeW * 0.80);
    badgeCanvas.height = Math.round(this._badgeH * 0.80);
    const badgeCtx = badgeCanvas.getContext('2d');
    const badgeTex = new THREE.CanvasTexture(badgeCanvas);
    badgeTex.generateMipmaps = false;
    badgeTex.minFilter = THREE.LinearFilter;
    const badgeMat = new THREE.SpriteMaterial({
      map: badgeTex, transparent: true, depthTest: false,
      alphaTest:  0.04,   // same dark-quad guard as the queue-slot badge
      toneMapped: false,  // pure-white digits (see queue-slot badge)
    });
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
