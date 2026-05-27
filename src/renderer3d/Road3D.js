// Road3D — 3D road surface, lane markings, concrete barriers, breach indicator,
//          traffic light trails, emissive reflection strips, speed lines,
//          and per-lane hover glow for drag feedback.
//
// The road runs from Z = ROAD_Z_FAR (-22) to Z = ROAD_Z_NEAR (0).
// Call setLaneCount(n) to rebuild geometry for 1–4 active lanes.

import * as THREE from 'three';
import { ROAD_Z_FAR, ROAD_Z_NEAR, ROAD_Z_VANISHING, laneToX, roadHalfW, posToZ } from './Scene3D.js';

// ── Road tile texture (loaded once, shared across rebuilds) ───────────────────
const _roadTexLoader = new THREE.TextureLoader();
let   _roadTex = null;
function _getRoadTex() {
  if (!_roadTex) {
    _roadTex = _roadTexLoader.load(
      `${import.meta.env.BASE_URL}sprites/designed/road-tile.jpg`,
    );
    _roadTex.wrapS  = _roadTex.wrapT = THREE.RepeatWrapping;
    _roadTex.colorSpace = THREE.SRGBColorSpace;
  }
  return _roadTex;
}

// ── Breach-warning texture (loaded once) ──────────────────────────────────────
const _breachTexLoader = new THREE.TextureLoader();
let   _breachTex = null;
function _getBreachTex() {
  if (!_breachTex) {
    _breachTex = _breachTexLoader.load(
      `${import.meta.env.BASE_URL}sprites/designed/breach-warning.png`,
    );
    _breachTex.wrapS       = THREE.RepeatWrapping;
    _breachTex.wrapT       = THREE.ClampToEdgeWrapping;
    _breachTex.colorSpace  = THREE.SRGBColorSpace;
  }
  return _breachTex;
}

// ── Tweakable design constants ─────────────────────────────────────────────────
const COL_ASPHALT      = 0x1c1c1e;   // very dark warm grey (design spec)
const COL_ASPHALT_DARK = 0x161618;
const COL_DIVIDER      = 0xffffff;   // white lane dividers
const COL_BARRIER      = 0x9a9a9a;   // medium concrete — not glowing white
const COL_BARRIER_TOP  = 0xb0b0b0;   // slightly lighter cap, no glow
const COL_REFLECTOR    = 0xffdd00;

const SHOULDER_COLOR = 0x1a1a1a;   // dark pavement flanking road
const SHOULDER_W     = 5.0;        // world units wide (≈60 px on screen)
const EDGE_LINE_W    = 0.15;       // white edge stripe width (world units)

const TRAFFIC_DOT_COUNT = 30;
const TRAFFIC_DOT_SPEED = 4.0;    // world units / sec

const REFL_STRIP_COLORS  = [0xfff5a0, 0xc8e8ff, 0xd4f0a0];   // sunny yellow / sky blue / pale green

const SPEED_LINE_COUNT      = 20;
const SPEED_LINE_BASE_SPEED = 6.0;

const LANE_GLOW_OPACITY = 0.18;
const LANE_GLOW_WIDTH   = 3.75;

const ROAD_LENGTH   = ROAD_Z_NEAR - ROAD_Z_FAR;
const ROAD_CENTER_Z = (ROAD_Z_FAR + ROAD_Z_NEAR) / 2;


export class Road3D {
  constructor(scene) {
    this._scene      = scene;
    this._group      = new THREE.Group();
    scene.add(this._group);

    this._elapsed       = 0;
    this._laneCount     = 4;
    this._roadColor     = COL_ASPHALT;
    this._roadColorDark = COL_ASPHALT_DARK;

    // Refs to animated materials — reset on each rebuild.
    this._reflStrips    = [];
    this._trafficTrails = [];
    this._speedLines    = [];
    this._activeLaneGlow = null;
    this._bombRings      = [];
    this._dividers       = [];
    this._noiseTex       = null;
    // Road surface materials — updated by setTheme() without rebuild.
    this._roadMats      = [];

    this._build();
  }

  // ── Public ────────────────────────────────────────────────────────────────────

  /**
   * Rebuild all road geometry for `n` active lanes (1–4).
   * Preserves any in-flight bomb rings (they expire on their own).
   */
  setLaneCount(n) {
    if (n === this._laneCount && this._built) return;
    this._laneCount = n;

    // Clear existing geometry (leave bomb rings — they auto-expire).
    this._clearGeometry();
    this._build();
  }

  // Legacy no-op kept for call-site compat (replaced by setLaneCount).
  setActiveLaneCount(n) { this.setLaneCount(n); }

  /** Update road surface color from theme. No geometry rebuild needed. */
  setTheme(theme) {
    if (!theme?.roadColor) return;
    const base = theme.roadColor;
    // Dark variant: subtract a small fixed offset per channel to keep contrast
    const dr = Math.max(0, ((base >> 16) & 0xff) - 6);
    const dg = Math.max(0, ((base >>  8) & 0xff) - 6);
    const db = Math.max(0, ( base        & 0xff) - 6);
    const dark = (dr << 16) | (dg << 8) | db;
    this._roadColor     = base;
    this._roadColorDark = dark;
    for (const entry of this._roadMats) {
      entry.mat.color.setHex(entry.dark ? dark : base);
    }
  }

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
    this._built = true;
    this._buildRoadSurface();
    this._buildNoiseOverlay();
    this._buildLaneDividers();
    this._buildBarriers();
    this._buildReflectionStrips();
    this._buildTrafficTrails();
    this._buildSpeedLines();
    this._buildTerminus();
    this._buildBreachLine();
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
    this._roadMats      = [];
    this._built         = false;
  }

  _buildRoadSurface() {
    const n    = this._laneCount;
    const hw   = roadHalfW(n);
    const W    = hw * 2;
    const dark = this._roadColorDark;

    // ── Tiled asphalt texture — one tile = 4 world units (≈ 1 lane width) ────
    const roadTex = _getRoadTex();

    // Main asphalt plane
    const texCopyMain = roadTex.clone();
    texCopyMain.repeat.set(W / 4.0, ROAD_LENGTH / 4.0);
    texCopyMain.needsUpdate = true;
    const mat = new THREE.MeshBasicMaterial({ map: texCopyMain });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, ROAD_LENGTH, 1, 1), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, -0.01, ROAD_CENTER_Z);
    this._group.add(mesh);

    // Expansion joints — subtle white lines across full road width
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
    const VANISH_LEN    = ROAD_Z_FAR - ROAD_Z_VANISHING;
    const vanishCenterZ = ROAD_Z_VANISHING + VANISH_LEN / 2;

    const texCopyVanish = roadTex.clone();
    texCopyVanish.repeat.set(W / 4.0, VANISH_LEN / 4.0);
    texCopyVanish.needsUpdate = true;
    const vanishMat = new THREE.MeshBasicMaterial({ map: texCopyVanish, color: 0x888888 });
    const vanishMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, VANISH_LEN, 1, 1), vanishMat);
    vanishMesh.rotation.x = -Math.PI / 2;
    vanishMesh.position.set(0, -0.01, vanishCenterZ);
    this._group.add(vanishMesh);

    // Lane dividers in the extension
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

    // Near-ground extension — covers frustum area below breach line (flat dark)
    const NEAR_EXT_LEN = 24;
    const nearMat = new THREE.MeshBasicMaterial({ color: dark });
    this._roadMats.push({ mat: nearMat, dark: true });
    const nearExtMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 12, NEAR_EXT_LEN),
      nearMat,
    );
    nearExtMesh.rotation.x = -Math.PI / 2;
    nearExtMesh.position.set(0, -0.02, ROAD_Z_NEAR + NEAR_EXT_LEN / 2);
    this._group.add(nearExtMesh);

    // ── Road shoulders ────────────────────────────────────────────────────
    const shoulderMat = new THREE.MeshBasicMaterial({ color: SHOULDER_COLOR });
    for (const side of [-1, 1]) {
      const sx = side * (hw + SHOULDER_W / 2);
      const shoulder = new THREE.Mesh(
        new THREE.PlaneGeometry(SHOULDER_W, ROAD_LENGTH),
        shoulderMat,
      );
      shoulder.rotation.x = -Math.PI / 2;
      shoulder.position.set(sx, -0.015, ROAD_CENTER_Z);
      this._group.add(shoulder);

      const edgeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.20,
      });
      const ex = side * (hw + EDGE_LINE_W / 2);
      const edge = new THREE.Mesh(
        new THREE.PlaneGeometry(EDGE_LINE_W, ROAD_LENGTH),
        edgeMat,
      );
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(ex, 0.002, ROAD_CENTER_Z);
      this._group.add(edge);
    }
  }

  _buildLaneDividers() {
    const n = this._laneCount;
    const dashLen   = 1.4;
    const gapLen    = 1.0;
    const period    = dashLen + gapLen;
    const dashCount = Math.ceil(ROAD_LENGTH / period);
    const dashMat   = new THREE.MeshBasicMaterial({
      color: COL_DIVIDER, transparent: true, opacity: 0.25,
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


  _buildBarriers() {
    // Barriers are concrete walls designed for perspective view.
    // In top-down ortho the top face dominates and reads as bright white strips.
    // Use MeshBasicMaterial matching asphalt so they blend with the road surface.
    const n = this._laneCount;
    const hw = roadHalfW(n);
    for (const side of [-1, 1]) {
      const bx = side * (hw + 0.55);
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.45, ROAD_LENGTH),
        new THREE.MeshBasicMaterial({ color: COL_ASPHALT_DARK }),
      );
      body.position.set(bx, 0.22, ROAD_CENTER_Z);
      this._group.add(body);
      // Reflector dots omitted — not visible from top-down at this scale
    }
  }

  _buildReflectionStrips() {
    // Removed — colored emissive strips (yellow/blue/green) were visible from top-down view
    this._reflStrips = [];
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

  _buildTerminus() {
    const n    = this._laneCount;
    const hw   = roadHalfW(n);
    const capD = 1.0;   // Z-depth of terminus band inside the play road

    // Concrete cap at the road's far edge — visible as a horizontal bar
    // at the top of the top-down viewport (Z = ROAD_Z_FAR is top of screen).
    const capMat = new THREE.MeshBasicMaterial({ color: COL_BARRIER });
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, capD), capMat);
    cap.rotation.x = -Math.PI / 2;
    cap.position.set(0, 0.01, ROAD_Z_FAR + capD / 2);
    this._group.add(cap);

    // Bright boundary stripe at the road/cap junction
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.65,
    });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 0.14), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.015, ROAD_Z_FAR + 0.07);
    this._group.add(line);
  }

  _buildBreachLine() {
    const hw = roadHalfW(this._laneCount);
    const W  = hw * 2;
    // Strip height: 0.80 world units, centered on Z=0 (ROAD_Z_NEAR).
    // Sprite is 1774×887 (2:1 aspect) → tile horizontally so hazard stripes
    // repeat at natural scale: each tile = 0.80 × 1.60 world units.
    const H  = 0.80;
    const tex = _getBreachTex();
    const texCopy = tex.clone();
    texCopy.repeat.set(W / (H * 2), 1);
    texCopy.needsUpdate = true;

    const mat = new THREE.MeshBasicMaterial({
      map: texCopy, transparent: true, alphaTest: 0.05, depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0.02, ROAD_Z_NEAR);
    this._group.add(mesh);
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
