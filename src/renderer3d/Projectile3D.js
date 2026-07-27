// Projectile3D — 3D shots with ribbon trails and muzzle cone flashes.
//
// Each shot:
//   • Emissive sphere (SphereGeometry, shooter colour)
//   • PointLight traveling with sphere
//   • Ribbon trail  — LINE_TRAIL_LEN positions tracked; drawn as a
//     THREE.Line with vertex colours fading from bright → transparent
//   • Muzzle cone   — brief ConeGeometry at barrel tip; fades in 0.12 s
//
// Muzzle cones: spawned when a slot first activates; stored separately
// from the in-flight projectile so they can die independently.

import * as THREE from 'three';
import { posToZ, laneToX, ROAD_Z_FAR } from './Scene3D.js';

const PROJ_LIFE  = 0.18;   // travel duration — matches SHOT_TRAVEL_TIME so the bomb
                           // lands exactly when the shot resolves
const PROJ_R     = 0.22;   // bigger so the in-flight bomb reads clearly as "the throw"
const PROJ_Y     = 0.35;
// The bomb travels FROM the player's release point TO the target car across the road
// plane (X and Z), with an ease-in and a slight sine throw-arc in height, then splats
// flat on landing before the explosion fires.
const PROJ_ARC   = 0.6;    // throw-arc height (Y), peaks midway through the travel
const IMPACT_DUR = 0.03;   // 30ms flat-splat frame on landing
const TOTAL_LIFE = PROJ_LIFE + IMPACT_DUR;
const IMPACT_SX  = 1.5;    // splat: wider on the road…
const IMPACT_SY  = 0.3;    // …and flattened (hit something solid)

// Trail settings
const TRAIL_LEN   = 14;    // number of trail segments
const TRAIL_WIDTH = 0.06;  // trail half-width for wide-line effect (visual only via scale)

// Muzzle cone (appears at shooter barrel tip)
const CONE_LIFE    = 0.12;
const CONE_R_BASE  = 0.28;
const CONE_HEIGHT  = 0.75;
// Muzzle spawns at ~Z=0 (breach line) – BARREL_OFFSET_Z from Shooter3D
const MUZZLE_Z_OFFSET = -0.55;  // world Z of barrel tip (TURRET_Z + BARREL_OFFSET_Z)
const MUZZLE_Y         = 0.82;  // world Y of barrel tip

const COLOR_HEX = {
  Red:    0xE24B4A,
  Blue:   0x378ADD,
  Green:  0x639922,
  Yellow: 0xEF9F27,
  Purple: 0x7F77DD,
  Orange: 0xD85A30,
};

// Shared cone geometry (all muzzle cones reuse it).
let _coneGeo = null;
function getConeGeo() {
  if (!_coneGeo) _coneGeo = new THREE.ConeGeometry(CONE_R_BASE, CONE_HEIGHT, 10, 1, true);
  return _coneGeo;
}

export class Projectile3D {
  constructor(scene, firingSlots, lanes) {
    this._scene       = scene;
    this._firingSlots = firingSlots;
    this._lanes       = lanes;

    this._slotWasActive = new Array(firingSlots.length).fill(false);
    this._projectiles   = [];
    this._cones         = [];  // { mesh, mat, life }
    // Per-lane world {x,z} the next spawned bomb travels FROM (the release point).
    this._nextStart     = new Array(firingSlots.length).fill(null);

    this._geo = new THREE.SphereGeometry(PROJ_R, 8, 6);

    // ── Fixed PointLight pool — scene light COUNT must never change ──────────
    // Every bomb used to add a PointLight on spawn and remove it on despawn.
    // Three bakes the scene's light counts into each material's program cache
    // key, so adding or removing ANY light invalidates every lit material and
    // forces the programs to re-link. The re-link is resolved synchronously the
    // next time the program is used (`gl.getProgramParameter(LINK_STATUS)`
    // blocks on the driver), so each shot paid a compile stall — TWICE, once on
    // spawn and once on despawn.
    //
    // Measured on L5 @4x CPU throttle (2026-07-26), profiling only the release
    // window: getProgramParameter was 259ms of 1610ms (16.1%), landing as a
    // ~235ms hitch at the moment of the drop. That is the "response isn't
    // fluent" complaint.
    //
    // Lights are now created ONCE, added ONCE, and never removed — a shot just
    // claims one, sets its colour/position, and parks it at intensity 0 when
    // done. Light count is therefore constant for the whole session and no
    // re-link is ever triggered. Pool size = one per lane, which is the real
    // ceiling: firingSlots holds at most one in-flight bomb per lane.
    this._lightPool = [];
    for (let i = 0; i < Math.max(1, firingSlots.length); i++) {
      const l = new THREE.PointLight(0xffffff, 0, 4);
      l.visible = false;
      scene.add(l);
      this._lightPool.push({ light: l, inUse: false });
    }

    // ── Projectile pool — mesh + material + trail, created ONCE ───────────────
    // Same reasoning as the lights, one level up: a brand-new material acquires
    // its shader program the first time it renders, and Three resolves that link
    // synchronously (gl.getProgramParameter(LINK_STATUS) blocks on the driver).
    // _spawn used to allocate a MeshStandardMaterial, a BufferGeometry and a
    // LineBasicMaterial per shot, so the FIRST shot of every level paid a link
    // stall.
    //
    // Measured under SwiftShader (the software renderer CI uses), L5:
    //   first shot resolved in 4768ms; 2nd 853ms; 3rd 658ms.
    // The visual-smoke drag test allows 5000ms, so the first shot sat at 95% of
    // budget — which is why `boundaries.spec` failed in CI on LANE 0 (always the
    // first shot, never lane 2) regardless of what the commit changed.
    this._projPool = [];
    for (let i = 0; i < Math.max(1, firingSlots.length); i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.8,
        transparent: true, opacity: 0.92,
      });
      const mesh = new THREE.Mesh(this._geo, mat);
      mesh.visible = false;
      scene.add(mesh);

      const positions = new Float32Array(TRAIL_LEN * 3);
      const colors    = new Float32Array(TRAIL_LEN * 3);
      const trailGeo  = new THREE.BufferGeometry();
      trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      trailGeo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));
      const trailMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, linewidth: 1 });
      const trail    = new THREE.Line(trailGeo, trailMat);
      trail.visible  = false;
      trail.frustumCulled = false;   // trail verts are rewritten every frame
      scene.add(trail);

      this._projPool.push({ mesh, trail, inUse: false });
    }
  }

  /**
   * Every pooled object goes through THIS on acquire — never rely on the caller
   * to overwrite each field. Leaked state (a stale colour, a mid-splat scale, a
   * faded opacity, last shot's trail vertices) shows up as an intermittently
   * wrong-looking projectile: it passes tests and fails on a device.
   */
  _resetProjSlot(slot, hex, sx, sz) {
    const { mesh, trail } = slot;
    mesh.visible = true;
    mesh.scale.set(1, 1, 1);
    mesh.rotation.set(0, 0, 0);
    mesh.position.set(sx, PROJ_Y, sz);
    mesh.material.color.setHex(hex);
    mesh.material.emissive.setHex(hex);
    mesh.material.emissiveIntensity = 1.8;
    mesh.material.opacity = 0.92;
    mesh.material.transparent = true;
    mesh.material.needsUpdate = false;   // only the uniforms changed, not the program

    // Collapse the whole trail onto the spawn point, and clear its colours, so
    // no segment of the previous shot survives into this one.
    const pos = trail.geometry.attributes.position;
    const col = trail.geometry.attributes.color;
    for (let j = 0; j < TRAIL_LEN; j++) {
      pos.array[j * 3] = sx; pos.array[j * 3 + 1] = PROJ_Y; pos.array[j * 3 + 2] = sz;
      col.array[j * 3] = 0;  col.array[j * 3 + 1] = 0;      col.array[j * 3 + 2] = 0;
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    trail.visible = true;
    trail.scale.set(1, 1, 1);
    trail.position.set(0, 0, 0);
    trail.material.opacity = 1;
  }

  /** Claim a projectile slot, fully reset. Null if all are busy. */
  _acquireProj(hex, sx, sz) {
    const slot = this._projPool.find((s) => !s.inUse);
    if (!slot) return null;
    slot.inUse = true;
    this._resetProjSlot(slot, hex, sx, sz);
    return slot;
  }

  /** Park a projectile slot: hidden, but it STAYS in the scene. */
  _releaseProj(slot) {
    if (!slot) return;
    slot.mesh.visible  = false;
    slot.trail.visible = false;
    slot.inUse = false;
  }

  /**
   * Materials whose programs must be linked BEFORE play, so no shot pays the
   * link stall. GameRenderer3D's warm-up renders these once during the level
   * intro. Pooling alone would only move the stall to shot #1.
   */
  warmupMaterials() {
    return this._projPool.flatMap((s) => [s.mesh.material, s.trail.material]);
  }

  /** The pooled OBJECTS, for the warm-up to reveal while it compiles. */
  warmupMeshes() {
    return this._projPool.flatMap((s) => [s.mesh, s.trail]);
  }

  /** Claim a parked light from the pool, or null if all are busy. */
  _acquireLight(hex) {
    const slot = this._lightPool.find((s) => !s.inUse);
    if (!slot) return null;                 // more in-flight than lanes: skip the glow, never grow the pool
    slot.inUse = true;
    // FULL reset, not just the fields _spawn happens to touch: distance and
    // decay are mutated by nothing today, but a pooled object that resets only
    // "the fields someone currently writes" rots the moment someone writes
    // another one. Same discipline as _resetProjSlot.
    slot.light.color.setHex(hex);
    slot.light.intensity = 1.5;
    slot.light.distance  = 4;
    slot.light.decay     = 2;               // three.js default
    slot.light.position.set(0, PROJ_Y + 0.2, 0);
    slot.light.visible = true;
    return slot;
  }

  /** Park a light: intensity 0 + hidden, but it STAYS in the scene. */
  _releaseLight(slot) {
    if (!slot) return;
    slot.light.intensity = 0;
    slot.light.visible = false;
    slot.inUse = false;
  }

  // Set where the next bomb in a lane should start its travel (player's release).
  setNextStart(laneIdx, world) {
    if (laneIdx >= 0 && laneIdx < this._nextStart.length) this._nextStart[laneIdx] = world ?? null;
  }

  reset() {
    for (const p of this._projectiles) this._disposeProj(p);
    this._projectiles.length = 0;
    for (const c of this._cones) this._disposeCone(c);
    this._cones.length = 0;
    this._slotWasActive.fill(false);
  }

  update(dt) {
    // ── Detect new shots ────────────────────────────────────────────────────
    for (let i = 0; i < this._firingSlots.length; i++) {
      const slot = this._firingSlots[i];
      if (slot && !this._slotWasActive[i]) {
        this._spawn(i, slot);
        // No muzzle cone: bombs drop from above now, they aren't fired from the turret.
      }
      this._slotWasActive[i] = !!slot;
    }

    // ── Advance projectiles ─────────────────────────────────────────────────
    for (let i = this._projectiles.length - 1; i >= 0; i--) {
      const p = this._projectiles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this._disposeProj(p);
        this._projectiles.splice(i, 1);
        continue;
      }

      const elapsed = TOTAL_LIFE - p.life;
      let frac;
      if (elapsed < PROJ_LIFE) {
        // ── Travel: from the release point (sx,sz) to the car (tx,tz) across the
        //    road plane with ease-in, plus a slight sine throw-arc in height.
        const prog = elapsed / PROJ_LIFE;
        const ease = prog * prog;
        p.x = p.sx + (p.tx - p.sx) * ease;
        p.z = p.sz + (p.tz - p.sz) * ease;
        p.y = PROJ_Y + PROJ_ARC * Math.sin(prog * Math.PI);
        p.mesh.scale.set(1, 1, 1);
        frac = 1;
      } else {
        // ── Splat: landed on the car. Flatten wide+short for a beat, fade out as
        //    the explosion takes over.
        const ip = (elapsed - PROJ_LIFE) / IMPACT_DUR;   // 0→1
        p.x = p.tx;
        p.z = p.tz;
        p.y = PROJ_Y;
        p.mesh.scale.set(IMPACT_SX, IMPACT_SY, IMPACT_SX);
        frac = 1 - ip;
      }

      p.mesh.position.set(p.x, p.y, p.z);
      p.light?.position.set(p.x, p.y + 0.2, p.z);

      p.mesh.material.opacity           = frac * 0.92;
      p.mesh.material.emissiveIntensity = 0.6 + frac * 1.2;
      if (p.light) p.light.intensity = frac * 1.5;

      // ── Update ribbon trail ─────────────────────────────────────────────
      const pos = p.trail.geometry.attributes.position;
      const col = p.trail.geometry.attributes.color;

      // Shift all segments back one.
      for (let j = TRAIL_LEN - 1; j > 0; j--) {
        pos.setXYZ(j, pos.getX(j - 1), pos.getY(j - 1), pos.getZ(j - 1));
      }
      // Insert current sphere position at head.
      pos.setXYZ(0, p.x, p.y, p.z);

      // Recompute vertex colours: head = bright, tail = black.
      const c = p.color;
      for (let j = 0; j < TRAIL_LEN; j++) {
        const t = 1 - j / (TRAIL_LEN - 1);
        col.setXYZ(j, c.r * t * frac, c.g * t * frac, c.b * t * frac);
      }

      pos.needsUpdate = true;
      col.needsUpdate = true;
    }

    // ── Advance muzzle cones ────────────────────────────────────────────────
    for (let i = this._cones.length - 1; i >= 0; i--) {
      const c = this._cones[i];
      c.life -= dt;
      if (c.life <= 0) {
        this._disposeCone(c);
        this._cones.splice(i, 1);
        continue;
      }
      const frac = c.life / CONE_LIFE;
      c.mat.opacity = frac * 0.65;
      // Scale up along cone axis as it fires (gives "blast" feel).
      const s = 1 + (1 - frac) * 0.5;
      c.mesh.scale.set(1, s, 1);
    }
  }

  dispose() {
    for (const p of this._projectiles) this._disposeProj(p);
    this._projectiles.length = 0;
    for (const c of this._cones) this._disposeCone(c);
    this._cones.length = 0;
    this._geo.dispose();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _spawn(laneIdx, slot) {
    const hex   = COLOR_HEX[slot.shooter.color] ?? 0xffffff;
    const color = new THREE.Color(hex);

    // Target = the lane's front car. Start = the player's release point (set via
    // setNextStart); falls back to just below the car (player side) if unknown.
    const tx = laneToX(laneIdx);
    const frontCar = this._lanes[laneIdx]?.cars[0];
    const tz = frontCar ? posToZ(frontCar.position) : ROAD_Z_FAR;
    const start = this._nextStart[laneIdx];
    this._nextStart[laneIdx] = null;
    const sx = start ? start.x : tx;
    const sz = start ? start.z : tz + 2.0;

    // Sphere + trail — claimed from the pool and fully reset. Nothing is created
    // or added to the scene here, so no shader program is ever acquired mid-play.
    const projSlot = this._acquireProj(hex, sx, sz);
    if (!projSlot) return;            // more in flight than lanes — drop the visual, never grow
    const { mesh, trail } = projSlot;

    // Point light — claimed from the fixed pool, NOT added to the scene here.
    // See the pool comment in the constructor: adding/removing lights re-links
    // every lit material and stalls the frame.
    const lightSlot = this._acquireLight(hex);
    const light = lightSlot?.light ?? null;
    light?.position.set(sx, PROJ_Y + 0.2, sz);

    this._projectiles.push({
      mesh, light, lightSlot, projSlot, trail, color,
      x: sx, y: PROJ_Y, z: sz, sx, sz, tx, tz, life: TOTAL_LIFE,
    });
  }

  _spawnMuzzleCone(laneIdx, slot) {
    const hex = COLOR_HEX[slot.shooter.color] ?? 0xffffff;
    const mat = new THREE.MeshBasicMaterial({
      color:       hex,
      transparent: true,
      opacity:     0.65,
      side:        THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(getConeGeo(), mat);
    // Cone's default axis is Y; rotate so it points in -Z (toward road horizon).
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(laneToX(laneIdx), MUZZLE_Y, MUZZLE_Z_OFFSET);
    this._scene.add(mesh);
    this._cones.push({ mesh, mat, life: CONE_LIFE });
  }

  _disposeProj(p) {
    // Nothing is disposed or removed: mesh, material, trail and light are POOLED
    // and live in the scene for the session. Disposing them would force the next
    // shot to re-acquire a program — the exact stall this pool exists to avoid.
    this._releaseProj(p.projSlot);
    this._releaseLight(p.lightSlot);
  }

  _disposeCone(c) {
    // Shared geometry — do NOT dispose _coneGeo here.
    c.mat.dispose();
    this._scene.remove(c.mesh);
  }
}
