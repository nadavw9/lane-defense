// Road3D — 3D road surface, lane markings, concrete barriers, lamp posts,
//          breach indicator line, and atmospheric overlay.
//
// The road runs from Z = ROAD_Z_FAR (-40) to Z = ROAD_Z_NEAR (0).
// Road half-width at near end: ROAD_HALF_W (6.5).  At the horizon the road
// tapers via perspective naturally — the camera does the work.

import * as THREE from 'three';
import { ROAD_Z_FAR, ROAD_Z_NEAR, ROAD_HALF_W, LANE_X, posToZ } from './Scene3D.js';

// How wide each lane boundary is (minor detail lines).
const LANE_COUNT    = 4;
const ROAD_LENGTH   = ROAD_Z_NEAR - ROAD_Z_FAR;   // 40 units
const ROAD_CENTER_Z = (ROAD_Z_FAR + ROAD_Z_NEAR) / 2;

// ── Colour palette ─────────────────────────────────────────────────────────────
const COL_ASPHALT      = 0x1c1c22;
const COL_ASPHALT_DARK = 0x141418;
const COL_DIVIDER      = 0xddddcc;
const COL_BARRIER      = 0x666672;
const COL_BARRIER_TOP  = 0x888896;
const COL_REFLECTOR    = 0xffdd00;
const COL_LAMP_POLE    = 0x333344;
const COL_LAMP_HEAD    = 0xffee88;
const COL_BREACH_LINE  = 0xdd2222;

export class Road3D {
  constructor(scene) {
    this._scene   = scene;
    this._group   = new THREE.Group();
    scene.add(this._group);

    this._buildRoadSurface();
    this._buildLaneDividers();
    this._buildBarriers();
    this._buildLampPosts();
    this._buildBreachLine();

    // Elapsed time for animations.
    this._elapsed = 0;
  }

  // Show only the first n lanes visually (hides excess lane dividers).
  // No dark overlay — inactive area stays open so the road surface is always visible.
  setActiveLaneCount(n) {
    if (!this._dividers) return;
    // Lane dividers: divider[0] = between lanes 0-1, [1] = 1-2, [2] = 2-3
    for (let di = 0; di < this._dividers.length; di++) {
      const show = (di < n - 1);
      for (const m of this._dividers[di]) m.visible = show;
    }
  }

  // ── Road surface ─────────────────────────────────────────────────────────────
  _buildRoadSurface() {
    // Primary asphalt plane — lower roughness + some metalness for wet look.
    // The scene's RoomEnvironment envMap provides subtle city reflections.
    const geo = new THREE.PlaneGeometry(ROAD_HALF_W * 2, ROAD_LENGTH, 1, 16);
    const mat = new THREE.MeshStandardMaterial({
      color:            COL_ASPHALT,
      roughness:        0.55,   // reduced from 0.92 — allows env-map reflections
      metalness:        0.20,   // slight metallic sheen for wet asphalt
      envMapIntensity:  0.5,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, -0.01, ROAD_CENTER_Z);
    mesh.receiveShadow = true;
    this._group.add(mesh);

    // Alternating lane strips — slightly more reflective on even lanes.
    for (let i = 0; i < LANE_COUNT; i++) {
      const x      = LANE_X[i];
      const color  = i % 2 === 0 ? COL_ASPHALT : COL_ASPHALT_DARK;
      const strip  = new THREE.Mesh(
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

    // Thin water film on the near half of the road (Y slightly above asphalt).
    // Acts as a mirror-like overlay where headlights and explosion flashes
    // reflect as colorful smears on the wet surface.
    const waterMat = new THREE.MeshStandardMaterial({
      color:            0x112233,
      roughness:        0.0,    // perfect mirror
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

    // Expansion-joint lines.
    const jointMat = new THREE.MeshBasicMaterial({
      color:       0xffffff,
      transparent: true,
      opacity:     0.06,
    });
    for (let i = 1; i <= 12; i++) {
      const z    = ROAD_Z_FAR + (i / 13) * ROAD_LENGTH;
      const joint = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF_W * 2, 0.06), jointMat);
      joint.rotation.x = -Math.PI / 2;
      joint.position.set(0, 0.001, z);
      this._group.add(joint);
    }
  }

  // ── Lane dividers (dashed white lines) ───────────────────────────────────────
  _buildLaneDividers() {
    // 3 dividers between the 4 lanes.
    const dividerXs = [-3.0, 0.0, 3.0];
    const dashLen   = 1.4;
    const gapLen    = 1.0;
    const period    = dashLen + gapLen;
    const dashCount = Math.ceil(ROAD_LENGTH / period);

    const dashMat = new THREE.MeshBasicMaterial({
      color:       COL_DIVIDER,
      transparent: true,
      opacity:     0.75,
    });

    this._dividers = [];   // array of { dividerIdx, meshes[] } for show/hide
    for (let di = 0; di < dividerXs.length; di++) {
      const x = dividerXs[di];
      const meshes = [];
      for (let d = 0; d < dashCount; d++) {
        const z = ROAD_Z_FAR + d * period + dashLen / 2;
        if (z > ROAD_Z_NEAR) break;
        const dash = new THREE.Mesh(
          new THREE.PlaneGeometry(0.08, dashLen),
          dashMat,
        );
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, 0.002, z);
        this._group.add(dash);
        meshes.push(dash);
      }
      this._dividers.push(meshes);
    }



    // Shoulder edge lines (solid white stripes at road edges).
    for (const sx of [-ROAD_HALF_W + 0.2, ROAD_HALF_W - 0.2]) {
      const edge = new THREE.Mesh(
        new THREE.PlaneGeometry(0.12, ROAD_LENGTH),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }),
      );
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(sx, 0.002, ROAD_CENTER_Z);
      this._group.add(edge);
    }
  }

  // ── Concrete barriers (left + right) ─────────────────────────────────────────
  _buildBarriers() {
    for (const side of [-1, 1]) {
      const bx = side * (ROAD_HALF_W + 0.55);

      // Main barrier body.
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.9, ROAD_LENGTH),
        new THREE.MeshStandardMaterial({ color: COL_BARRIER, roughness: 0.85, metalness: 0.05 }),
      );
      body.position.set(bx, 0.44, ROAD_CENTER_Z);
      body.castShadow    = true;
      body.receiveShadow = true;
      this._group.add(body);

      // Top cap (slightly lighter).
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.12, ROAD_LENGTH),
        new THREE.MeshStandardMaterial({ color: COL_BARRIER_TOP, roughness: 0.8 }),
      );
      top.position.set(bx, 0.94, ROAD_CENTER_Z);
      this._group.add(top);

      // Reflector dots spaced along barrier inner face.
      const reflMat = new THREE.MeshBasicMaterial({ color: COL_REFLECTOR });
      const reflGeo = new THREE.CircleGeometry(0.06, 8);
      const innerX  = bx - side * 0.36;   // inner face
      for (let i = 0; i < 10; i++) {
        const z    = ROAD_Z_FAR + (i + 0.5) * (ROAD_LENGTH / 10);
        const refl = new THREE.Mesh(reflGeo, reflMat);
        refl.position.set(innerX, 0.5, z);
        refl.rotation.y = side * Math.PI / 2;
        this._group.add(refl);
      }
    }
  }

  // ── Lamp posts ────────────────────────────────────────────────────────────────
  _buildLampPosts() {
    this._lamps = [];   // { light } for potential future animation

    const lampZPositions = [-30, -18, -8];  // place 3 pairs of lamps

    for (const z of lampZPositions) {
      for (const side of [-1, 1]) {
        const bx = side * (ROAD_HALF_W + 0.55);

        // Pole.
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.08, 3.5, 6),
          new THREE.MeshStandardMaterial({ color: COL_LAMP_POLE, roughness: 0.7 }),
        );
        pole.position.set(bx, 1.75 + 0.9, z);  // sits on top of barrier
        pole.castShadow = true;
        this._group.add(pole);

        // Arm (horizontal bar extending over road).
        const arm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6),
          new THREE.MeshStandardMaterial({ color: COL_LAMP_POLE, roughness: 0.7 }),
        );
        arm.rotation.z = Math.PI / 2;
        arm.position.set(bx - side * 0.7, 3.5 + 0.9, z);
        this._group.add(arm);

        // Lamp head (emissive capsule).
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 8, 6),
          new THREE.MeshStandardMaterial({
            color:             COL_LAMP_HEAD,
            emissive:          COL_LAMP_HEAD,
            emissiveIntensity: 0.6,   // reduced from 1.4 to tame bloom halos
            roughness:         0.4,
          }),
        );
        head.position.set(bx - side * 1.4, 3.45 + 0.9, z);
        this._group.add(head);

        // Point light for this lamp — dimmed to avoid large halos with bloom.
        const light = new THREE.PointLight(0xffee88, 0.20, 9);
        light.position.set(bx - side * 1.4, 3.2 + 0.9, z);
        this._group.add(light);
        this._lamps.push({ light });
      }
    }
  }

  // ── Breach indicator line ────────────────────────────────────────────────────
  _buildBreachLine() {
    // A glowing red band at Z = ROAD_Z_NEAR (position 100 = breach point).
    const geo = new THREE.PlaneGeometry(ROAD_HALF_W * 2, 0.25);
    this._breachMat = new THREE.MeshBasicMaterial({
      color:       COL_BREACH_LINE,
      transparent: true,
      opacity:     0.7,
    });
    const line = new THREE.Mesh(geo, this._breachMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.005, ROAD_Z_NEAR);
    this._group.add(line);

    // Soft glow billboard behind the line (faces camera always).
    this._breachGlowMat = new THREE.SpriteMaterial({
      color:       COL_BREACH_LINE,
      transparent: true,
      opacity:     0.18,
      sizeAttenuation: true,
    });
    this._breachGlow = new THREE.Sprite(this._breachGlowMat);
    this._breachGlow.scale.set(ROAD_HALF_W * 2.2, 1.4, 1);
    this._breachGlow.position.set(0, 0.3, ROAD_Z_NEAR);
    this._group.add(this._breachGlow);
  }

  // ── Per-frame update (animations) ────────────────────────────────────────────
  update(dt) {
    this._elapsed += dt;

    // Pulse breach line opacity.
    const pulse = 0.65 + 0.35 * Math.sin(this._elapsed * 5.5);
    this._breachMat.opacity     = pulse * 0.8;
    this._breachGlowMat.opacity = pulse * 0.20;
  }

  dispose() {
    this._group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    this._scene.remove(this._group);
  }
}
