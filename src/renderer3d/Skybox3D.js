// Skybox3D — Night-city backdrop with animated stars, aurora borealis,
//            moon breathing, animated clouds, and flickering windows.

import * as THREE from 'three';

const SKY_NEAR    = 0x4a1a5c;   // deep purple (zenith)
const SKY_FAR     = 0x1a3a6e;   // blue (mid-sky)
const SKY_HORIZON = 0x2a8a9e;   // teal horizon band (lowest 15%)
const BUILD_FAR   = 0x0b1520;
const BUILD_NEAR  = 0x0f1d2c;
const BUILD_FAR2  = 0x070d18;   // second silhouette layer colour

// Window colour palette — each window picks one randomly.
const WIN_COLORS = [
  0xffee88,   // warm yellow
  0xff9944,   // amber
  0x44ddff,   // cyan
  0xff5588,   // pink
  0x88ff44,   // lime
  0xddaaff,   // lavender
];

const MOON_COLOR = 0xfff5cc;

// Aurora: 3-colour cycle — pink → cyan → lime
const AURORA_COLORS = [
  new THREE.Color(0xff44aa),
  new THREE.Color(0x44ddff),
  new THREE.Color(0x88ff44),
];

export class Skybox3D {
  constructor(scene) {
    this._scene   = scene;
    this._group   = new THREE.Group();
    scene.add(this._group);

    this._elapsed    = 0;
    this._cloudObjs  = [];
    this._windows    = [];
    this._combo      = 0;   // driven by GameRenderer3D.setCombo()

    this._moonMesh      = null;
    this._moonGlowMat   = null;
    this._starColors    = null;
    this._starPoints    = null;
    this._starPhases    = null;
    this._starSpeeds    = null;
    this._auroraGeo     = null;
    this._auroraMat     = null;

    this._buildSky();
    this._buildMoon();
    this._buildStars();
    this._buildAurora();
    this._buildBuildings();
    this._buildSilhouetteLayer();
    this._buildClouds();
  }

  // ── Set combo intensity (drives aurora amplitude) ─────────────────────────────
  setCombo(combo) { this._combo = combo; }

  // ── Sky gradient ──────────────────────────────────────────────────────────────
  _buildSky() {
    // 1×5 segments → 6 vertex rows, giving enough resolution for the 3-stop gradient.
    const geo = new THREE.PlaneGeometry(80, 40, 1, 5);
    const col = new THREE.Color();
    const pos = geo.attributes.position;
    const colours = [];
    const cHorizon = new THREE.Color(SKY_HORIZON);
    const cNear    = new THREE.Color(SKY_NEAR);
    const cFar     = new THREE.Color(SKY_FAR);
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) + 20) / 40;   // 0 = bottom horizon, 1 = zenith
      if (t < 0.15) {
        col.lerpColors(cHorizon, cNear, t / 0.15);
      } else {
        col.lerpColors(cNear, cFar, (t - 0.15) / 0.85);
      }
      colours.push(col.r, col.g, col.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    const mat  = new THREE.MeshBasicMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 10, -48);
    this._group.add(mesh);
  }

  // ── Moon ─────────────────────────────────────────────────────────────────────
  _buildMoon() {
    this._moonGlowMat = new THREE.SpriteMaterial({
      color: MOON_COLOR, transparent: true, opacity: 0.08,
    });
    const glow = new THREE.Sprite(this._moonGlowMat);
    glow.scale.set(3.2, 3.2, 1);
    glow.position.set(10, 18, -47);
    this._group.add(glow);

    this._moonMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 32),
      new THREE.MeshStandardMaterial({
        color:             MOON_COLOR,
        emissive:          MOON_COLOR,
        emissiveIntensity: 0.9,
      }),
    );
    this._moonMesh.position.set(10, 18, -46.5);
    this._group.add(this._moonMesh);
  }

  // ── Star field (400 twinkling points) ────────────────────────────────────────
  _buildStars() {
    const COUNT = 400;
    const positions = new Float32Array(COUNT * 3);
    const colors    = new Float32Array(COUNT * 3);
    this._starPhases = new Float32Array(COUNT);
    this._starSpeeds = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI * 0.52;
      const r     = 44 + Math.random() * 4;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 4;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 22;

      const base = 0.75 + Math.random() * 0.25;
      colors[i * 3]     = base;
      colors[i * 3 + 1] = base;
      colors[i * 3 + 2] = 0.90 + Math.random() * 0.10;

      this._starPhases[i] = Math.random() * Math.PI * 2;
      this._starSpeeds[i] = 0.8 + Math.random() * 2.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const colAttr = new THREE.BufferAttribute(colors, 3);
    geo.setAttribute('color', colAttr);
    this._starColors = colAttr;

    const mat = new THREE.PointsMaterial({
      size:            0.22,
      vertexColors:    true,
      transparent:     true,
      sizeAttenuation: true,
      opacity:         0.90,
    });
    this._starPoints = new THREE.Points(geo, mat);
    this._group.add(this._starPoints);
  }

  // ── Aurora ribbon ─────────────────────────────────────────────────────────────
  _buildAurora() {
    const SEG_X = 60;
    const SEG_Y = 2;
    const geo = new THREE.PlaneGeometry(56, 5, SEG_X, SEG_Y);
    geo.rotateX(-Math.PI / 2);

    this._auroraGeo = geo;
    this._auroraMat = new THREE.MeshBasicMaterial({
      color:       AURORA_COLORS[0],
      transparent: true,
      opacity:     0.0,
      side:        THREE.DoubleSide,
      depthWrite:  false,
    });
    const mesh = new THREE.Mesh(geo, this._auroraMat);
    mesh.position.set(0, 20, -46);
    this._group.add(mesh);
  }

  // ── Buildings (primary layer with windows) ────────────────────────────────────
  _buildBuildings() {
    const configs = [
      { x: -22, w: 5.0, h: 12, col: BUILD_FAR,  z: -47, win: true  },
      { x: -15, w: 3.5, h: 18, col: BUILD_FAR,  z: -47, win: true  },
      { x: -10, w: 4.0, h: 9,  col: BUILD_FAR,  z: -47, win: false },
      { x:  -5, w: 3.0, h: 14, col: BUILD_FAR,  z: -47, win: true  },
      { x:   1, w: 4.5, h: 20, col: BUILD_FAR,  z: -47, win: true  },
      { x:   8, w: 3.2, h: 11, col: BUILD_FAR,  z: -47, win: true  },
      { x:  14, w: 5.0, h: 16, col: BUILD_FAR,  z: -47, win: false },
      { x:  20, w: 4.0, h: 13, col: BUILD_FAR,  z: -47, win: true  },
      { x: -18, w: 3.8, h: 8,  col: BUILD_NEAR, z: -44, win: true  },
      { x: -12, w: 2.5, h: 12, col: BUILD_NEAR, z: -44, win: false },
      { x:  -7, w: 4.0, h: 7,  col: BUILD_NEAR, z: -44, win: true  },
      { x:   4, w: 3.5, h: 15, col: BUILD_NEAR, z: -44, win: true  },
      { x:  11, w: 4.2, h: 10, col: BUILD_NEAR, z: -44, win: true  },
      { x:  17, w: 3.0, h: 9,  col: BUILD_NEAR, z: -44, win: false },
    ];
    for (const c of configs) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(c.w, c.h, 0.5),
        new THREE.MeshBasicMaterial({ color: c.col }),
      );
      mesh.position.set(c.x, c.h / 2, c.z);
      this._group.add(mesh);

      if (!c.win) continue;
      const winCount = Math.floor(c.w * c.h * 0.15);
      for (let i = 0; i < winCount; i++) {
        const wx = c.x + (Math.random() - 0.5) * (c.w - 0.6);
        const wy = 0.5 + Math.random() * (c.h - 1.0);
        const winColor = WIN_COLORS[Math.floor(Math.random() * WIN_COLORS.length)];
        const winMat = new THREE.MeshBasicMaterial({
          color: winColor, transparent: true, opacity: 0.4,
        });
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.38), winMat);
        win.position.set(wx, wy, c.z + 0.28);
        this._group.add(win);
        this._windows.push({ mat: winMat, phase: Math.random() * Math.PI * 2 });
      }
    }
  }

  // ── Silhouette layer (second parallax, further back, no windows) ───────────────
  _buildSilhouetteLayer() {
    const configs = [
      { x: -25, w: 6.0, h: 22 },
      { x: -17, w: 4.0, h: 16 },
      { x:  -9, w: 5.5, h: 28 },
      { x:   0, w: 3.5, h: 18 },
      { x:   7, w: 5.0, h: 24 },
      { x:  15, w: 4.5, h: 14 },
      { x:  22, w: 6.0, h: 20 },
    ];
    const mat = new THREE.MeshBasicMaterial({
      color: BUILD_FAR2, transparent: true, opacity: 0.7,
    });
    for (const c of configs) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, 0.5), mat);
      mesh.position.set(c.x, c.h / 2, -49.5);
      this._group.add(mesh);
    }
  }

  // ── Clouds ────────────────────────────────────────────────────────────────────
  _buildClouds() {
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.10,
    });
    for (let i = 0; i < 5; i++) {
      const group = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const r = 1.2 + Math.random() * 1.0;
        const blob = new THREE.Mesh(new THREE.CircleGeometry(r, 12), cloudMat);
        blob.position.set((j - 1) * 1.4, Math.random() * 0.4, 0);
        group.add(blob);
      }
      group.position.set((Math.random() - 0.5) * 50, 12 + Math.random() * 5, -46);
      group.userData.speed = 0.4 + Math.random() * 0.6;
      this._group.add(group);
      this._cloudObjs.push(group);
    }
  }

  // ── Per-frame update ──────────────────────────────────────────────────────────
  update(dt) {
    this._elapsed += dt;
    const t = this._elapsed;

    // ── Moon breathing ───────────────────────────────────────────────────────
    const breathe = 0.85 + 0.30 * Math.sin(t * (Math.PI * 2 / 4.5));
    if (this._moonMesh) {
      this._moonMesh.material.emissiveIntensity = breathe;
    }
    if (this._moonGlowMat) {
      this._moonGlowMat.opacity = 0.06 + 0.05 * breathe;
    }

    // ── Star twinkle ─────────────────────────────────────────────────────────
    const col = this._starColors;
    const count = this._starPhases.length;
    for (let i = 0; i < count; i++) {
      const bright = 0.65 + 0.35 * Math.sin(t * this._starSpeeds[i] + this._starPhases[i]);
      col.setXYZ(i, bright, bright, 0.88 + 0.12 * bright);
    }
    col.needsUpdate = true;

    // ── Aurora ribbon ─────────────────────────────────────────────────────────
    const comboAmp  = Math.min(1.0, this._combo / 12);
    const amplitude = 0.4 + comboAmp * 2.0;
    const speed     = 1.2 + comboAmp * 1.5;
    const targetOpacity = 0.15 + comboAmp * 0.30;   // 0.15 → 0.45

    this._auroraMat.opacity += (targetOpacity - this._auroraMat.opacity) * Math.min(1, dt * 2);

    // 3-colour cycling: pink → cyan → lime → pink
    const cycle = (t * 0.15) % 1;
    const ci0   = Math.floor(cycle * 3) % 3;
    const ci1   = (ci0 + 1) % 3;
    const frac  = (cycle * 3) % 1;
    const auroraCol = new THREE.Color();
    auroraCol.lerpColors(AURORA_COLORS[ci0], AURORA_COLORS[ci1], frac);
    this._auroraMat.color.copy(auroraCol);

    // Animate vertex Y positions with a sine wave.
    const pos = this._auroraGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x     = pos.getX(i);
      const waveY = Math.sin(x * 0.18 + t * speed) * amplitude
                  + Math.sin(x * 0.07 + t * speed * 0.5) * amplitude * 0.4;
      pos.setY(i, waveY);
    }
    pos.needsUpdate = true;

    // ── Window flicker ───────────────────────────────────────────────────────
    for (const w of this._windows) {
      const brightness = 0.55 + 0.45 * Math.sin(t * 1.8 + w.phase);
      w.mat.opacity = 0.38 * brightness;
    }

    // ── Cloud drift ──────────────────────────────────────────────────────────
    for (const cloud of this._cloudObjs) {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 30) cloud.position.x = -30;
    }
  }

  dispose() {
    this._group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    this._scene.remove(this._group);
  }
}
