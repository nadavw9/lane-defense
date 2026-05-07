// Road3D — 3D road surface, lane markings, concrete barriers, breach indicator,
//          traffic light trails, emissive reflection strips, speed lines,
//          and per-lane hover glow for drag feedback.
//
// The road runs from Z = ROAD_Z_FAR (-40) to Z = ROAD_Z_NEAR (0).
// Call setLaneCount(n) to rebuild geometry for 1–4 active lanes.

import * as THREE from 'three';
import { ROAD_Z_FAR, ROAD_Z_NEAR, ROAD_Z_VANISHING, laneToX, roadHalfW, posToZ } from './Scene3D.js';

// ── Tweakable design constants ─────────────────────────────────────────────────
const COL_ASPHALT      = 0x3a3835;   // warm dark asphalt
const COL_ASPHALT_DARK = 0x2e2c2a;
const COL_DIVIDER      = 0xfff5a0;   // bright sunny yellow lane dividers
const COL_BARRIER      = 0x9a9a9a;   // medium concrete — not glowing white
const COL_BARRIER_TOP  = 0xb0b0b0;   // slightly lighter cap, no glow
const COL_REFLECTOR    = 0xffdd00;
const COL_BREACH_LINE  = 0xdd2222;

const BREACH_EMISSIVE_LO  = 0.6;
const BREACH_EMISSIVE_HI  = 1.0;
const BREACH_PULSE_PERIOD = 1.5;   // seconds

const TRAFFIC_DOT_COUNT = 30;
const TRAFFIC_DOT_SPEED = 4.0;    // world units / sec

const REFL_STRIP_COLORS  = [0xfff5a0, 0xc8e8ff, 0xd4f0a0];   // sunny yellow / sky blue / pale green

const SPEED_LINE_COUNT      = 20;
const SPEED_LINE_BASE_SPEED = 6.0;

const LANE_GLOW_OPACITY = 0.18;
const LANE_GLOW_WIDTH   = 3.75;

const ROAD_LENGTH   = ROAD_Z_NEAR - ROAD_Z_FAR;
const ROAD_CENTER_Z = (ROAD_Z_FAR + ROAD_Z_NEAR) / 2;

// Start gate at the spawn line (Z = ROAD_Z_FAR = -22)
const GATE_POST_H   = 3.5;
const GATE_BAR_Y    = 2.0;
const GATE_OPEN_DUR = 1.2;   // seconds for doors to slide open

export class Road3D {
  constructor(scene) {
    this._scene      = scene;
    this._group      = new THREE.Group();
    scene.add(this._group);

    this._elapsed       = 0;
    this._laneCount     = 4;

    // Refs to animated materials — reset on each rebuild.
    this._breachMat     = null;
    this._breachGlowMat = null;
    this._breachGlow    = null;
    this._reflStrips    = [];
    this._trafficTrails = [];
    this._speedLines    = [];
    this._activeLaneGlow = null;
    this._bombRings      = [];
    this._dividers       = [];
    this._gate           = null;
    this._noiseTex       = null;

    this._build();
  }

  // ── Public ────────────────────────────────────────────────────────────────────

  /**
   * Rebuild all road geometry for `n` active lanes (1–4).
   * Preserves any in-flight bomb rings (they expire on their own).
   */
  setLaneCount(n) {
    if (n === this._laneCount && this._breachMat !== null) return;
    this._laneCount = n;

    // Clear existing geometry (leave bomb rings — they auto-expire).
    this._clearGeometry();
    this._build();
  }

  // Legacy no-op kept for call-site compat (replaced by setLaneCount).
  setActiveLaneCount(n) { this.setLaneCount(n); }

  // ── Lane glow ─────────────────────────────────────────────────────────────────
  showLaneGlow(laneIdx, colorHex) {
    this.clearLaneGlow();
    const x   = laneToX(laneIdx);
    const mat = new THREE.MeshBasicMaterial({
      color:       new THREE.Color(colorHex),
      transparent: true,
      opacity:     LANE_GLOW_OPACITY,
      depthWrite:  false,
      side:        THREE.DoubleSide,
    });
    const geo  = new THREE.PlaneGeometry(LANE_GLOW_WIDTH, ROAD_LENGTH);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.003, ROAD_CENTER_Z);
    this._group.add(mesh);
    this._activeLaneGlow = { mesh, mat };
  }

  clearLaneGlow() {
    if (!this._activeLaneGlow) return;
    this._group.remove(this._activeLaneGlow.mesh);
    this._activeLaneGlow.mesh.geometry.dispose();
    this._activeLaneGlow.mat.dispose();
    this._activeLaneGlow = null;
  }

  /** Animate the start gate open (called on level intro). */
  openGate() {
    if (!this._gate) return;
    this._gate.opening = true;
    this._gate.t       = 0;
    this._gate.done    = false;
  }

  /** Reset gate to closed position (called on level reset). */
  resetGate() {
    if (!this._gate) return;
    const { barL, barR, matL, matR, hw } = this._gate;
    barL.visible    = true;   barR.visible    = true;
    barL.position.x = -hw / 2; barL.position.y = GATE_BAR_Y;
    barR.position.x =  hw / 2; barR.position.y = GATE_BAR_Y;
    matL.opacity = 1; matR.opacity = 1;
    this._gate.opening = false;
    this._gate.done    = false;
    this._gate.t       = 0;
  }

  // ── Bomb ring ────────────────────────────────────────────────────────────────
  spawnBombRing(bombPos, colorHex = 0xff8800) {
    const z   = posToZ(bombPos);
    const mat = new THREE.MeshBasicMaterial({
      color:       0xffffff,
      transparent: true,
      opacity:     0.90,
      side:        THREE.DoubleSide,
      depthWrite:  false,
    });
    const geo  = new THREE.RingGeometry(0.92, 1.0, 32);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0.012, z);
    this._group.add(mesh);
    this._bombRings.push({
      mesh, mat,
      elapsed:     0,
      duration:    0.30,
      targetColor: new THREE.Color(colorHex),
    });
  }

  // ── Per-frame update ─────────────────────────────────────────────────────────
  update(dt) {
    this._elapsed += dt;
    const t = this._elapsed;

    // Breach line emissive pulse
    if (this._breachMat) {
      const p = BREACH_EMISSIVE_LO + (BREACH_EMISSIVE_HI - BREACH_EMISSIVE_LO) *
        (0.5 + 0.5 * Math.sin(t * (Math.PI * 2 / BREACH_PULSE_PERIOD)));
      this._breachMat.emissiveIntensity = p;
      if (this._breachGlowMat) {
        this._breachGlowMat.opacity = 0.10 + 0.12 * (p / BREACH_EMISSIVE_HI);
      }
    }

    // Reflection strips — cycle aurora colours
    const auroraC = REFL_STRIP_COLORS.map(h => new THREE.Color(h));
    const acLen   = auroraC.length;
    for (let i = 0; i < this._reflStrips.length; i++) {
      const cycle = ((t * 0.40 + i / acLen) % 1 + 1) % 1;
      const ci    = Math.floor(cycle * acLen);
      const ci2   = (ci + 1) % acLen;
      const frac  = (cycle * acLen) % 1;
      this._reflStrips[i].mat.emissive.lerpColors(auroraC[ci], auroraC[ci2], frac);
    }

    // Traffic trail dots — scroll toward camera
    for (const trail of this._trafficTrails) {
      const pos = trail.geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let z = pos.getZ(i) + TRAFFIC_DOT_SPEED * dt;
        if (z > ROAD_Z_NEAR) z = ROAD_Z_FAR;
        pos.setZ(i, z);
      }
      pos.needsUpdate = true;
    }

    // Speed lines — constant scroll
    for (const sl of this._speedLines) {
      const pos = sl.geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let z = pos.getZ(i) + SPEED_LINE_BASE_SPEED * dt;
        if (z > ROAD_Z_NEAR) z = ROAD_Z_FAR;
        pos.setZ(i, z);
      }
      pos.needsUpdate = true;
    }

    // Gate open animation — doors slide outward, fade, then hide entirely
    if (this._gate?.opening && !this._gate.done) {
      this._gate.t = Math.min(GATE_OPEN_DUR, this._gate.t + dt);
      const prog  = this._gate.t / GATE_OPEN_DUR;
      const eased = 1 - Math.pow(1 - prog, 2.5);
      const { barL, barR, matL, matR, hw } = this._gate;
      barL.position.x = -hw / 2 - eased * hw;
      barL.position.y =  GATE_BAR_Y + eased * 1.2;
      barR.position.x =  hw / 2 + eased * hw;
      barR.position.y =  GATE_BAR_Y + eased * 1.2;
      matL.opacity    = 1 - eased;
      matR.opacity    = 1 - eased;
      if (prog >= 1) {
        this._gate.done  = true;
        barL.visible     = false;
        barR.visible     = false;
      }
    }

    // Bomb rings — expand + fade
    for (let i = this._bombRings.length - 1; i >= 0; i--) {
      const ring = this._bombRings[i];
      ring.elapsed += dt;
      const prog  = Math.min(1, ring.elapsed / ring.duration);
      const scale = 1 + prog * 2;
      ring.mesh.scale.set(scale, scale, scale);
      ring.mat.opacity = 0.90 * (1 - prog);
      ring.mat.color.lerpColors(new THREE.Color(0xffffff), ring.targetColor, prog);
      if (prog >= 1) {
        this._group.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        ring.mat.dispose();
        this._bombRings.splice(i, 1);
      }
    }
  }

  dispose() {
    this.clearLaneGlow();
    this._group.traverse(obj => {
      obj.geometry?.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    this._noiseTex?.dispose();
    this._noiseTex = null;
    this._scene.remove(this._group);
  }

  // ── Private — geometry builders ──────────────────────────────────────────────

  _build() {
    this._buildRoadSurface();
    this._buildNoiseOverlay();
    this._buildLaneDividers();
    this._buildBarriers();
    this._buildBreachLine();
    this._buildReflectionStrips();
    this._buildTrafficTrails();
    this._buildSpeedLines();
    this._buildStartGate();
  }

  _clearGeometry() {
    this.clearLaneGlow();
    // Dispose every mesh/material in the group except in-flight bomb rings,
    // which are tracked separately and self-dispose.
    const ringMeshes = new Set(this._bombRings.map(r => r.mesh));
    const toRemove   = [];
    this._group.traverse(obj => {
      if (obj.isObject3D && obj !== this._group && !ringMeshes.has(obj)) {
        toRemove.push(obj);
      }
    });
    for (const obj of toRemove) {
      this._group.remove(obj);
      obj.geometry?.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    }

    this._reflStrips    = [];
    this._trafficTrails = [];
    this._speedLines    = [];
    this._dividers      = [];
    this._breachMat     = null;
    this._breachGlowMat = null;
    this._breachGlow    = null;
    this._gate          = null;
  }

  _buildRoadSurface() {
    const n    = this._laneCount;
    const hw   = roadHalfW(n);
    const W    = hw * 2;

    // Main asphalt plane
    const geo = new THREE.PlaneGeometry(W, ROAD_LENGTH, 1, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: COL_ASPHALT, roughness: 0.72, metalness: 0.06, envMapIntensity: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, -0.01, ROAD_CENTER_Z);
    this._group.add(mesh);

    // Per-lane alternating colour strips
    for (let i = 0; i < n; i++) {
      const x     = laneToX(i, n);
      const color = i % 2 === 0 ? COL_ASPHALT : COL_ASPHALT_DARK;
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(3.85, ROAD_LENGTH),
        new THREE.MeshStandardMaterial({
          color, roughness: i % 2 === 0 ? 0.70 : 0.78,
          metalness: 0.05, envMapIntensity: 0.25,
        }),
      );
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(x, 0, ROAD_CENTER_Z);
      this._group.add(strip);
    }

    // Wet surface mirror overlay
    const waterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(W, ROAD_LENGTH * 0.6),
      new THREE.MeshStandardMaterial({
        color: 0x112233, roughness: 0.0, metalness: 1.0,
        transparent: true, opacity: 0.22, envMapIntensity: 1.8, depthWrite: false,
      }),
    );
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(0, 0.005, ROAD_Z_FAR + ROAD_LENGTH * 0.7);
    this._group.add(waterMesh);

    // Expansion joints
    const jointMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.06,
    });
    for (let i = 1; i <= 12; i++) {
      const z     = ROAD_Z_FAR + (i / 13) * ROAD_LENGTH;
      const joint = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.06), jointMat);
      joint.rotation.x = -Math.PI / 2;
      joint.position.set(0, 0.001, z);
      this._group.add(joint);
    }

    // ── Visual background extension: road continues to vanishing point ─────
    const VANISH_LEN    = ROAD_Z_FAR - ROAD_Z_VANISHING;  // 43 units
    const vanishCenterZ = ROAD_Z_VANISHING + VANISH_LEN / 2;

    const vanishGeo = new THREE.PlaneGeometry(W, VANISH_LEN, 1, 6);
    const vanishMat = new THREE.MeshStandardMaterial({
      color: COL_ASPHALT, roughness: 0.65, metalness: 0.12, envMapIntensity: 0.25,
    });
    const vanishMesh = new THREE.Mesh(vanishGeo, vanishMat);
    vanishMesh.rotation.x = -Math.PI / 2;
    vanishMesh.position.set(0, -0.01, vanishCenterZ);
    this._group.add(vanishMesh);

    // Per-lane alternating strips in the extension
    for (let i = 0; i < n; i++) {
      const x     = laneToX(i, n);
      const color = i % 2 === 0 ? COL_ASPHALT : COL_ASPHALT_DARK;
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(3.85, VANISH_LEN),
        new THREE.MeshStandardMaterial({
          color, roughness: i % 2 === 0 ? 0.52 : 0.62, metalness: 0.12, envMapIntensity: 0.25,
        }),
      );
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(x, 0, vanishCenterZ);
      this._group.add(strip);
    }

    // Lane dividers in the extension (dimmer opacity — fade into distance)
    const extDashMat = new THREE.MeshBasicMaterial({
      color: COL_DIVIDER, transparent: true, opacity: 0.35,
    });
    const extPeriod  = 1.4 + 1.0;
    const extDashLen = 1.4;
    const extDashCt  = Math.ceil(VANISH_LEN / extPeriod);
    for (let di = 0; di < n - 1; di++) {
      const x = laneToX(di, n) + 2.0;
      for (let d = 0; d < extDashCt; d++) {
        const z = ROAD_Z_VANISHING + d * extPeriod + extDashLen / 2;
        if (z >= ROAD_Z_FAR) break;
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.08, extDashLen), extDashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, 0.002, z);
        this._group.add(dash);
      }
    }
  }

  _buildLaneDividers() {
    const n = this._laneCount;
    const dashLen   = 1.4;
    const gapLen    = 1.0;
    const period    = dashLen + gapLen;
    const dashCount = Math.ceil(ROAD_LENGTH / period);
    const dashMat   = new THREE.MeshBasicMaterial({
      color: COL_DIVIDER, transparent: true, opacity: 0.75,
    });

    // Divider between lane i and i+1: x = laneToX(i, n) + 2.0
    this._dividers = [];
    for (let di = 0; di < n - 1; di++) {
      const x      = laneToX(di, n) + 2.0;
      const meshes = [];
      for (let d = 0; d < dashCount; d++) {
        const z = ROAD_Z_FAR + d * period + dashLen / 2;
        if (z > ROAD_Z_NEAR) break;
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.08, dashLen), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, 0.002, z);
        this._group.add(dash);
        meshes.push(dash);
      }
      this._dividers.push(meshes);
    }
  }

  _buildStartGate() {
    const n  = this._laneCount;
    const hw = roadHalfW(n);
    const gz = ROAD_Z_FAR;   // spawn line = -22

    // Vertical side posts
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x2d3a4a, roughness: 0.55, metalness: 0.55,
    });
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, GATE_POST_H, 0.32),
        postMat,
      );
      post.position.set(sx * (hw + 0.18), GATE_POST_H / 2, gz);
      this._group.add(post);
    }

    // Thin top rail connecting the two posts
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(hw * 2 + 0.36 + 0.32, 0.14, 0.24),
      postMat,
    );
    rail.position.set(0, GATE_POST_H, gz);
    this._group.add(rail);

    // Two door panels (each covers half the road width; animated on openGate())
    const matL = new THREE.MeshStandardMaterial({
      color: 0xee2200, emissive: new THREE.Color(0xcc1100), emissiveIntensity: 0.45,
      roughness: 0.35, metalness: 0.35, transparent: true, opacity: 1.0,
    });
    const matR = matL.clone();

    const barL = new THREE.Mesh(new THREE.BoxGeometry(hw, 0.28, 0.28), matL);
    barL.position.set(-hw / 2, GATE_BAR_Y, gz);
    this._group.add(barL);

    const barR = new THREE.Mesh(new THREE.BoxGeometry(hw, 0.28, 0.28), matR);
    barR.position.set(hw / 2, GATE_BAR_Y, gz);
    this._group.add(barR);

    this._gate = { barL, barR, matL, matR, hw, opening: false, t: 0, done: false };
  }

  _buildBarriers() {
    const n = this._laneCount;
    const hw = roadHalfW(n);
    for (const side of [-1, 1]) {
      const bx = side * (hw + 0.55);

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.45, ROAD_LENGTH),
        new THREE.MeshStandardMaterial({ color: COL_BARRIER, roughness: 0.85, metalness: 0.05 }),
      );
      body.position.set(bx, 0.22, ROAD_CENTER_Z);
      this._group.add(body);

      const reflMat = new THREE.MeshBasicMaterial({ color: COL_REFLECTOR });
      const reflGeo = new THREE.CircleGeometry(0.06, 8);
      const innerX  = bx - side * 0.36;
      for (let i = 0; i < 10; i++) {
        const z    = ROAD_Z_FAR + (i + 0.5) * (ROAD_LENGTH / 10);
        const refl = new THREE.Mesh(reflGeo, reflMat);
        refl.position.set(innerX, 0.28, z);
        refl.rotation.y = side * Math.PI / 2;
        this._group.add(refl);
      }
    }
  }

  _buildBreachLine() {
    const hw  = roadHalfW(this._laneCount);
    const geo = new THREE.PlaneGeometry(hw * 2, 0.25);
    this._breachMat = new THREE.MeshStandardMaterial({
      color:             COL_BREACH_LINE,
      emissive:          new THREE.Color(COL_BREACH_LINE),
      emissiveIntensity: BREACH_EMISSIVE_LO,
      transparent:       true,
      opacity:           0.85,
      roughness:         0.5,
    });
    const line = new THREE.Mesh(geo, this._breachMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.005, ROAD_Z_NEAR);
    this._group.add(line);

    this._breachGlowMat = new THREE.SpriteMaterial({
      color: COL_BREACH_LINE, transparent: true, opacity: 0.18, sizeAttenuation: true,
    });
    this._breachGlow = new THREE.Sprite(this._breachGlowMat);
    this._breachGlow.scale.set(hw * 2.2, 1.4, 1);
    this._breachGlow.position.set(0, 0.3, ROAD_Z_NEAR);
    this._group.add(this._breachGlow);
  }

  _buildReflectionStrips() {
    const hw = roadHalfW(this._laneCount);
    this._reflStrips = [];
    for (let i = 0; i < REFL_STRIP_COLORS.length; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color:             0x000000,
        emissive:          new THREE.Color(REFL_STRIP_COLORS[i]),
        emissiveIntensity: 0.30,
        transparent:       true,
        opacity:           0.55,
        depthWrite:        false,
      });
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 0.06), mat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(0, 0.002, ROAD_Z_FAR + i * 0.6 + 0.5);
      this._group.add(strip);
      this._reflStrips.push({ mat });
    }
  }

  _buildTrafficTrails() {
    const hw = roadHalfW(this._laneCount);
    this._trafficTrails = [];
    for (const side of [-1, 1]) {
      const bx = side * (hw + 0.55);
      const N  = TRAFFIC_DOT_COUNT;

      const positions = new Float32Array(N * 3);
      const colors    = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        positions[i * 3]     = bx;
        positions[i * 3 + 1] = 0.42;
        positions[i * 3 + 2] = ROAD_Z_FAR + (i / N) * ROAD_LENGTH;
        if (i % 2 === 0) { colors[i*3] = 1.0; colors[i*3+1] = 0.87; colors[i*3+2] = 0.0; }
        else              { colors[i*3] = 1.0; colors[i*3+1] = 0.20; colors[i*3+2] = 0.0; }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));
      const mat = new THREE.PointsMaterial({
        size: 0.14, vertexColors: true, transparent: true, opacity: 0.72, sizeAttenuation: true,
      });
      this._group.add(new THREE.Points(geo, mat));
      this._trafficTrails.push({ geo, mat });
    }
  }

  _buildSpeedLines() {
    const hw = roadHalfW(this._laneCount);
    this._speedLines = [];
    for (const side of [-1, 1]) {
      const bx = side * (hw - 0.4);
      const N  = SPEED_LINE_COUNT;

      const positions = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        positions[i * 3]     = bx + (Math.random() - 0.5) * 0.35;
        positions[i * 3 + 1] = 0.08 + Math.random() * 0.25;
        positions[i * 3 + 2] = ROAD_Z_FAR + Math.random() * ROAD_LENGTH;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xffffff, size: 0.07, transparent: true, opacity: 0.25,
        sizeAttenuation: true, depthWrite: false,
      });
      this._group.add(new THREE.Points(geo, mat));
      this._speedLines.push({ geo, mat });
    }
  }

  _buildNoiseOverlay() {
    if (!this._noiseTex) this._noiseTex = this._makeNoiseTexture();

    const n       = this._laneCount;
    const hw      = roadHalfW(n);
    const W       = hw * 2;
    const fullLen = ROAD_Z_NEAR - ROAD_Z_VANISHING;
    const ctrZ    = ROAD_Z_VANISHING + fullLen / 2;

    this._noiseTex.repeat.set(W * 0.55, fullLen * 0.38);
    this._noiseTex.needsUpdate = true;

    const mat  = new THREE.MeshBasicMaterial({
      map: this._noiseTex, transparent: true, opacity: 0.11, depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, fullLen), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0.001, ctrZ);
    this._group.add(mesh);
  }

  _makeNoiseTexture() {
    const size = 256;
    const cv   = document.createElement('canvas');
    cv.width = cv.height = size;
    const img = cv.getContext('2d').createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(Math.random() * 256);
      img.data[i] = img.data[i+1] = img.data[i+2] = v;
      img.data[i+3] = 255;
    }
    cv.getContext('2d').putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
}
