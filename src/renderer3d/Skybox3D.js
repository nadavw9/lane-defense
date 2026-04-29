// Skybox3D — Bright sunny-day backdrop: blue sky gradient, fluffy clouds,
//            warm sun with halo, and rolling green hills on the horizon.

import * as THREE from 'three';

// ── Tweakable colour palette ────────────────────────────────────────────────────
const SKY_ZENITH  = 0x4ab8ee;   // bright sky blue at top
const SKY_MID     = 0x88d8ff;   // lighter blue mid-sky
const SKY_HORIZON = 0xfff5e0;   // warm cream-white at horizon
const SKY_GLOW    = 0xffe8a8;   // soft golden sun haze near horizon (lowest 5%)

const HILL_NEAR   = 0x7ac043;   // bright green near hills
const HILL_FAR    = 0x9bd05a;   // lighter green far hills

const SUN_COLOR   = 0xfff5d0;   // warm white sun disc
const SUN_GLOW    = 0xffe5a0;   // golden halo

// WIN_COLORS kept for potential future use (e.g. vehicle accent colours).
export const WIN_COLORS = [
  0xffee88, 0xff9944, 0x44ddff, 0xff5588, 0x88ff44, 0xddaaff,
];

export class Skybox3D {
  constructor(scene) {
    this._scene      = scene;
    this._group      = new THREE.Group();
    scene.add(this._group);

    this._elapsed   = 0;
    this._cloudObjs = [];
    this._combo     = 0;

    // Sun glow material — pulsed gently in update().
    this._sunGlowMat = null;

    this._buildSky();
    this._buildSun();
    this._buildHills();
    this._buildClouds();
  }

  // ── Set combo intensity (kept for API compatibility — unused in sunny mode) ──
  setCombo(combo) { this._combo = combo; }

  // ── Sky gradient ──────────────────────────────────────────────────────────────
  _buildSky() {
    // 1×8 segments → 9 vertex rows for smooth 4-stop gradient.
    const geo = new THREE.PlaneGeometry(80, 40, 1, 8);
    const col = new THREE.Color();
    const pos = geo.attributes.position;
    const colours = [];
    const cGlow    = new THREE.Color(SKY_GLOW);
    const cHorizon = new THREE.Color(SKY_HORIZON);
    const cMid     = new THREE.Color(SKY_MID);
    const cZenith  = new THREE.Color(SKY_ZENITH);
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) + 20) / 40;   // 0 = bottom horizon, 1 = zenith
      if (t < 0.05) {
        col.lerpColors(cGlow, cHorizon, t / 0.05);
      } else if (t < 0.25) {
        col.lerpColors(cHorizon, cMid, (t - 0.05) / 0.20);
      } else {
        col.lerpColors(cMid, cZenith, (t - 0.25) / 0.75);
      }
      colours.push(col.r, col.g, col.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    const mat  = new THREE.MeshBasicMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 10, -48);
    this._group.add(mesh);
  }

  // ── Sun: bright disc + soft halo sprite ───────────────────────────────────────
  _buildSun() {
    // Halo sprite (soft glow behind sun disc).
    this._sunGlowMat = new THREE.SpriteMaterial({
      color: SUN_GLOW, transparent: true, opacity: 0.35,
    });
    const glow = new THREE.Sprite(this._sunGlowMat);
    glow.scale.set(5.0, 5.0, 1);
    glow.position.set(10, 14, -47);
    this._group.add(glow);

    // Sun disc — emissive so it stays bright regardless of scene lighting.
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 32),
      new THREE.MeshBasicMaterial({ color: SUN_COLOR }),
    );
    disc.position.set(10, 14, -46.5);
    this._group.add(disc);
  }

  // ── Rolling hills silhouette ───────────────────────────────────────────────────
  _buildHills() {
    // Near hills (brighter, closer)
    this._buildHillPlane(HILL_NEAR, -47.5, 4.0, 0.9);
    // Far hills (lighter, further back)
    this._buildHillPlane(HILL_FAR, -49.0, 3.0, 0.7);
  }

  _buildHillPlane(color, z, maxH, opacityVal) {
    const W = 80;
    const SEG = 20;
    const geo = new THREE.PlaneGeometry(W, maxH * 2, SEG, 1);
    const pos = geo.attributes.position;

    // Top edge only: shape into gentle rounded hills using sine harmonics.
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0) {
        const nx  = pos.getX(i) / (W / 2);
        const ht  = maxH * (
          0.50 * (0.5 + 0.5 * Math.sin(nx * 1.8 + 0.4))
        + 0.30 * (0.5 + 0.5 * Math.sin(nx * 3.5 + 1.2))
        + 0.20 * (0.5 + 0.5 * Math.sin(nx * 6.0 + 0.7))
        );
        pos.setY(i, ht);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const mat  = new THREE.MeshBasicMaterial({
      color, transparent: opacityVal < 1, opacity: opacityVal,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 3.5, z);
    this._group.add(mesh);
  }

  // ── Fluffy clouds ─────────────────────────────────────────────────────────────
  _buildClouds() {
    for (let i = 0; i < 7; i++) {
      const group = new THREE.Group();
      const blobCount = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < blobCount; j++) {
        const r   = 1.0 + Math.random() * 1.4;
        const mat = new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.82 + Math.random() * 0.12,
        });
        const blob = new THREE.Mesh(new THREE.CircleGeometry(r, 10), mat);
        blob.position.set((j - blobCount / 2) * 1.5 + (Math.random() - 0.5) * 0.8,
                          Math.random() * 0.6, 0);
        group.add(blob);
      }
      group.position.set(
        (Math.random() - 0.5) * 55,
        12 + Math.random() * 6,
        -45 - Math.random() * 3,
      );
      group.userData.speed = 0.3 + Math.random() * 0.5;
      this._group.add(group);
      this._cloudObjs.push(group);
    }
  }

  // ── Per-frame update ──────────────────────────────────────────────────────────
  update(dt) {
    this._elapsed += dt;
    const t = this._elapsed;

    // Gentle sun halo pulse
    if (this._sunGlowMat) {
      this._sunGlowMat.opacity = 0.28 + 0.10 * Math.sin(t * 0.8);
    }

    // Cloud drift — wrap around
    for (const cloud of this._cloudObjs) {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 32) cloud.position.x = -32;
    }
  }

  dispose() {
    this._group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose());
      } else if (obj.material) {
        obj.material.dispose();
      }
    });
    this._scene.remove(this._group);
  }
}
