// Road3D — 3D road surface, lane markings, concrete barriers, breach indicator,
//          traffic light trails, emissive reflection strips, speed lines,
//          and per-lane hover glow for drag feedback.
//
// The road runs from Z = ROAD_Z_FAR (-40) to Z = ROAD_Z_NEAR (0).

import * as THREE from 'three';
import { ROAD_Z_FAR, ROAD_Z_NEAR, ROAD_HALF_W, LANE_X, posToZ } from './Scene3D.js';

// ── Tweakable design constants ─────────────────────────────────────────────────
const COL_ASPHALT      = 0x2a2a32;   // was 0x1c1c22 — brighter, more inviting
const COL_ASPHALT_DARK = 0x222228;   // alternate lane strip
const COL_DIVIDER      = 0xddddcc;
const COL_BARRIER      = 0x666672;
const COL_BARRIER_TOP  = 0x888896;
const COL_REFLECTOR    = 0xffdd00;
const COL_BREACH_LINE  = 0xdd2222;

// Breach line pulse: emissive intensity swings between these on a 1.5 s cycle
const BREACH_EMISSIVE_LO = 0.6;
const BREACH_EMISSIVE_HI = 1.0;
const BREACH_PULSE_PERIOD = 1.5;   // seconds

// Traffic light trail dots along each barrier
const TRAFFIC_DOT_COUNT = 30;
const TRAFFIC_DOT_SPEED = 4.0;     // world units / sec

// Emissive reflection strip colors at far end of road (picks up sky/aurora palette)
const REFL_AURORA_COLORS = [0x2a8a9e, 0x4a1a5c, 0xff44aa];

// Speed-line constants
const SPEED_LINE_COUNT     = 20;
const SPEED_LINE_BASE_SPEED = 6.0;   // always-on subtle streaks

// Lane hover glow
const LANE_GLOW_OPACITY = 0.18;
const LANE_WIDTH_WORLD  = 2.8;

const LANE_COUNT    = 4;
const ROAD_LENGTH   = ROAD_Z_NEAR - ROAD_Z_FAR;
const ROAD_CENTER_Z = (ROAD_Z_FAR + ROAD_Z_NEAR) / 2;

export class Road3D {
  constructor(scene) {
    this._scene   = scene;
    this._group   = new THREE.Group();
    scene.add(this._group);

    this._elapsed       = 0;
    this._reflStrips    = [];
    this._trafficTrails = [];
    this._speedLines    = [];
    this._activeLaneGlow = null;
    this._bombRings      = [];

    this._buildRoadSurface();
    this._buildLaneDividers();
    this._buildBarriers();
    this._buildBreachLine();
    this._buildReflectionStrips();
    this._buildTrafficTrails();
    this._buildSpeedLines();
  }

  // No-op kept for call-site compatibility.
  setActiveLaneCount(_n) {}

  // ── Road surface ─────────────────────────────────────────────────────────────
  _buildRoadSurface() {
    const geo = new THREE.PlaneGeometry(ROAD_HALF_W * 2, ROAD_LENGTH, 1, 16);
    const mat = new THREE.MeshStandardMaterial({
      color:            COL_ASPHALT,
      roughness:        0.55,
      metalness:        0.20,
      envMapIntensity:  0.5,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, -0.01, ROAD_CENTER_Z);
    mesh.receiveShadow = true;
    this._group.add(mesh);

    for (let i = 0; i < LANE_COUNT; i++) {
      const x     = LANE_X[i];
      const color = i % 2 === 0 ? COL_ASPHALT : COL_ASPHALT_DARK;
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(2.8, ROAD_LENGTH),
        new THREE.MeshStandardMaterial({
          color,
          roughness:       i % 2 === 0 ? 0.50 : 0.60,
          metalness:       0.18,
          envMapIntensity: 0.4,
        }),
      );
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(x, 0, ROAD_CENTER_Z);
      strip.receiveShadow = true;
      this._group.add(strip);
    }

    // Wet surface mirror overlay
    const waterMat = new THREE.MeshStandardMaterial({
      color:            0x112233,
      roughness:        0.0,
      metalness:        1.0,
      transparent:      true,
      opacity:          0.22,
      envMapIntensity:  1.8,
      depthWrite:       false,
    });
    const waterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_HALF_W * 2, ROAD_LENGTH * 0.6),
      waterMat,
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
      const joint = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF_W * 2, 0.06), jointMat);
      joint.rotation.x = -Math.PI / 2;
      joint.position.set(0, 0.001, z);
      this._group.add(joint);
    }
  }

  // ── Lane dividers (dashed white lines) ───────────────────────────────────────
  _buildLaneDividers() {
    const dividerXs = [-3.0, 0.0, 3.0];
    const dashLen   = 1.4;
    const gapLen    = 1.0;
    const period    = dashLen + gapLen;
    const dashCount = Math.ceil(ROAD_LENGTH / period);

    const dashMat = new THREE.MeshBasicMaterial({
      color: COL_DIVIDER, transparent: true, opacity: 0.75,
    });

    this._dividers = [];
    for (let di = 0; di < dividerXs.length; di++) {
      const x = dividerXs[di];
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

  // ── Concrete barriers (left + right) ─────────────────────────────────────────
  _buildBarriers() {
    for (const side of [-1, 1]) {
      const bx = side * (ROAD_HALF_W + 0.55);

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.9, ROAD_LENGTH),
        new THREE.MeshStandardMaterial({ color: COL_BARRIER, roughness: 0.85, metalness: 0.05 }),
      );
      body.position.set(bx, 0.44, ROAD_CENTER_Z);
      body.castShadow    = true;
      body.receiveShadow = true;
      this._group.add(body);

      const top = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.12, ROAD_LENGTH),
        new THREE.MeshStandardMaterial({ color: COL_BARRIER_TOP, roughness: 0.8 }),
      );
      top.position.set(bx, 0.94, ROAD_CENTER_Z);
      this._group.add(top);

      // Reflector dots
      const reflMat = new THREE.MeshBasicMaterial({ color: COL_REFLECTOR });
      const reflGeo = new THREE.CircleGeometry(0.06, 8);
      const innerX  = bx - side * 0.36;
      for (let i = 0; i < 10; i++) {
        const z    = ROAD_Z_FAR + (i + 0.5) * (ROAD_LENGTH / 10);
        const refl = new THREE.Mesh(reflGeo, reflMat);
        refl.position.set(innerX, 0.5, z);
        refl.rotation.y = side * Math.PI / 2;
        this._group.add(refl);
      }
    }
  }

  // ── Breach indicator line ────────────────────────────────────────────────────
  _buildBreachLine() {
    const geo = new THREE.PlaneGeometry(ROAD_HALF_W * 2, 0.25);
    // Emissive material so the line glows even in dark conditions
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

    // Soft glow sprite behind the line
    this._breachGlowMat = new THREE.SpriteMaterial({
      color: COL_BREACH_LINE, transparent: true, opacity: 0.18, sizeAttenuation: true,
    });
    this._breachGlow = new THREE.Sprite(this._breachGlowMat);
    this._breachGlow.scale.set(ROAD_HALF_W * 2.2, 1.4, 1);
    this._breachGlow.position.set(0, 0.3, ROAD_Z_NEAR);
    this._group.add(this._breachGlow);
  }

  // ── Emissive reflection strips at road's far end ─────────────────────────────
  // Thin emissive planes that cycle through aurora colors for a subtle glow.
  _buildReflectionStrips() {
    for (let i = 0; i < REFL_AURORA_COLORS.length; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color:             0x000000,
        emissive:          new THREE.Color(REFL_AURORA_COLORS[i]),
        emissiveIntensity: 0.30,
        transparent:       true,
        opacity:           0.55,
        depthWrite:        false,
      });
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(ROAD_HALF_W * 2, 0.06),
        mat,
      );
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(0, 0.002, ROAD_Z_FAR + i * 0.6 + 0.5);
      this._group.add(strip);
      this._reflStrips.push({ mat });
    }
  }

  // ── Traffic light trail dots along barriers ───────────────────────────────────
  // Points moving toward the camera on each side — mimics adjacent highway traffic.
  _buildTrafficTrails() {
    for (const side of [-1, 1]) {
      const bx = side * (ROAD_HALF_W + 0.55);
      const N  = TRAFFIC_DOT_COUNT;

      const positions = new Float32Array(N * 3);
      const colors    = new Float32Array(N * 3);

      for (let i = 0; i < N; i++) {
        positions[i * 3]     = bx;
        positions[i * 3 + 1] = 0.97;   // top of barrier
        positions[i * 3 + 2] = ROAD_Z_FAR + (i / N) * ROAD_LENGTH;

        // Alternate yellow / red taillights
        if (i % 2 === 0) { colors[i*3] = 1.0; colors[i*3+1] = 0.87; colors[i*3+2] = 0.0; }
        else              { colors[i*3] = 1.0; colors[i*3+1] = 0.20; colors[i*3+2] = 0.0; }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

      const mat = new THREE.PointsMaterial({
        size:            0.14,
        vertexColors:    true,
        transparent:     true,
        opacity:         0.72,
        sizeAttenuation: true,
      });

      const points = new THREE.Points(geo, mat);
      this._group.add(points);
      this._trafficTrails.push({ geo, mat });
    }
  }

  // ── Speed lines along road edges ─────────────────────────────────────────────
  // Subtle white streaks at x ≈ ±ROAD_HALF_W suggesting forward motion.
  _buildSpeedLines() {
    for (const side of [-1, 1]) {
      const bx = side * (ROAD_HALF_W - 0.4);
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
        color:           0xffffff,
        size:            0.07,
        transparent:     true,
        opacity:         0.25,
        sizeAttenuation: true,
        depthWrite:      false,
      });

      const points = new THREE.Points(geo, mat);
      this._group.add(points);
      this._speedLines.push({ geo, mat });
    }
  }

  // ── Expanding ring decal when a bomb explodes ────────────────────────────────
  // Ring scales from 1→3 units over 0.3 s, fading white → bomb color.
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

  // ── Per-lane hover glow (called from DragDrop via GameRenderer3D) ────────────
  showLaneGlow(laneIdx, colorHex) {
    this.clearLaneGlow();
    const x   = LANE_X[laneIdx];
    const mat = new THREE.MeshBasicMaterial({
      color:      new THREE.Color(colorHex),
      transparent: true,
      opacity:    LANE_GLOW_OPACITY,
      depthWrite: false,
      side:       THREE.DoubleSide,
    });
    const geo  = new THREE.PlaneGeometry(LANE_WIDTH_WORLD, ROAD_LENGTH);
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

  // ── Per-frame update ─────────────────────────────────────────────────────────
  update(dt) {
    this._elapsed += dt;
    const t = this._elapsed;

    // ── Breach line: emissive intensity on 1.5 s sine cycle ──────────────────
    const breachPulse = BREACH_EMISSIVE_LO + (BREACH_EMISSIVE_HI - BREACH_EMISSIVE_LO) *
      (0.5 + 0.5 * Math.sin(t * (Math.PI * 2 / BREACH_PULSE_PERIOD)));
    this._breachMat.emissiveIntensity = breachPulse;
    this._breachGlowMat.opacity       = 0.10 + 0.12 * (breachPulse / BREACH_EMISSIVE_HI);

    // ── Reflection strips: cycle through aurora colors ────────────────────────
    const auroraC = REFL_AURORA_COLORS.map(h => new THREE.Color(h));
    const acLen   = auroraC.length;
    for (let i = 0; i < this._reflStrips.length; i++) {
      const cycle = ((t * 0.40 + i / acLen) % 1 + 1) % 1;
      const ci    = Math.floor(cycle * acLen);
      const ci2   = (ci + 1) % acLen;
      const frac  = (cycle * acLen) % 1;
      this._reflStrips[i].mat.emissive.lerpColors(auroraC[ci], auroraC[ci2], frac);
    }

    // ── Traffic trail dots: scroll toward camera ──────────────────────────────
    for (const trail of this._trafficTrails) {
      const pos = trail.geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let z = pos.getZ(i) + TRAFFIC_DOT_SPEED * dt;
        if (z > ROAD_Z_NEAR) z = ROAD_Z_FAR;
        pos.setZ(i, z);
      }
      pos.needsUpdate = true;
    }

    // ── Speed lines: constant subtle scroll ───────────────────────────────────
    for (const sl of this._speedLines) {
      const pos = sl.geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let z = pos.getZ(i) + SPEED_LINE_BASE_SPEED * dt;
        if (z > ROAD_Z_NEAR) z = ROAD_Z_FAR;
        pos.setZ(i, z);
      }
      pos.needsUpdate = true;
    }

    // ── Bomb rings: expand + fade ─────────────────────────────────────────────
    for (let i = this._bombRings.length - 1; i >= 0; i--) {
      const ring = this._bombRings[i];
      ring.elapsed += dt;
      const prog  = Math.min(1, ring.elapsed / ring.duration);
      const scale = 1 + prog * 2;   // 1 → 3
      ring.mesh.scale.set(scale, scale, scale);
      // Fade opacity and lerp white → bomb color
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
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    this._scene.remove(this._group);
  }
}
