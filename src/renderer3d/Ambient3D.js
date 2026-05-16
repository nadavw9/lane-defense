// Ambient3D — background life: dust motes, birds on arc paths, faint light rays.
//
// Design note: all elements are deliberately subtle. They exist to break the
// "empty game-engine scene" feeling without drawing the eye away from gameplay.
// Max opacity: dust=0.18, birds=0.55, rays=0.06.

import * as THREE from 'three';

// ── Tunables ────────────────────────────────────────────────────────────────────
const MOTE_COUNT  = 28;        // dust particle count
const MOTE_SPREAD = 10;        // XZ half-width
const MOTE_Y_MIN  = 0.6;
const MOTE_Y_MAX  = 4.5;
const MOTE_DRIFT  = 0.04;      // slow upward float speed
const MOTE_SWAY   = 0.012;     // gentle XZ sway amplitude

const BIRD_COUNT  = 6;
const RAY_COUNT   = 0;

export class Ambient3D {
  constructor(scene) {
    this._scene   = scene;
    this._group   = new THREE.Group();
    scene.add(this._group);
    this._elapsed = 0;

    this._buildDustMotes();
    this._buildBirds();
    this._buildLightRays();
  }

  // ── Dust motes ────────────────────────────────────────────────────────────────
  _buildDustMotes() {
    const positions = new Float32Array(MOTE_COUNT * 3);
    const sizes     = new Float32Array(MOTE_COUNT);
    this._motePhases = new Float32Array(MOTE_COUNT);

    for (let i = 0; i < MOTE_COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * MOTE_SPREAD * 2;
      positions[i * 3 + 1] = MOTE_Y_MIN + Math.random() * (MOTE_Y_MAX - MOTE_Y_MIN);
      positions[i * 3 + 2] = -2 - Math.random() * 18;
      sizes[i]             = 0.04 + Math.random() * 0.06;
      this._motePhases[i]  = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

    // Soft warm circle texture baked to canvas.
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0,   'rgba(255,248,220,0.90)');
    grad.addColorStop(0.5, 'rgba(255,240,200,0.40)');
    grad.addColorStop(1,   'rgba(255,240,200,0.00)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);

    const mat = new THREE.PointsMaterial({
      map:          new THREE.CanvasTexture(canvas),
      size:         0.12,
      sizeAttenuation: true,
      transparent: true,
      opacity:     0.18,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });

    this._motePts  = new THREE.Points(geo, mat);
    this._moteGeo  = geo;
    this._group.add(this._motePts);
  }

  _updateDustMotes(t) {
    const pos = this._moteGeo.attributes.position;
    for (let i = 0; i < MOTE_COUNT; i++) {
      const ph = this._motePhases[i];
      let y = pos.getY(i) + MOTE_DRIFT * 0.016;
      if (y > MOTE_Y_MAX) y = MOTE_Y_MIN;
      const x = pos.getX(i) + Math.sin(t * 0.4 + ph) * MOTE_SWAY * 0.016;
      pos.setXYZ(i, x, y, pos.getZ(i));
    }
    pos.needsUpdate = true;
  }

  // ── Birds ─────────────────────────────────────────────────────────────────────
  _buildBirds() {
    this._birds = [];
    for (let i = 0; i < BIRD_COUNT; i++) {
      const bird = this._makeBirdMesh();
      // Each bird has an arc: center, radius, speed, height, phase.
      bird.userData = {
        cx:    (Math.random() - 0.5) * 16,
        cz:    -12 - Math.random() * 16,
        r:     5 + Math.random() * 8,
        speed: (0.15 + Math.random() * 0.20) * (Math.random() < 0.5 ? 1 : -1),
        h:     6 + Math.random() * 5,
        phase: Math.random() * Math.PI * 2,
      };
      this._group.add(bird);
      this._birds.push(bird);
    }
  }

  _makeBirdMesh() {
    // Two thin triangles — left wing + right wing — like a seagull silhouette.
    const geo = new THREE.BufferGeometry();
    // Wing span 0.35, body at center.
    const verts = new Float32Array([
      // left wing
      -0.175, 0, 0,    -0.06, 0.05, 0,   0, 0, 0,
      // right wing
       0.175, 0, 0,     0.06, 0.05, 0,   0, 0, 0,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    const mat = new THREE.MeshBasicMaterial({
      color:       0x223344,
      transparent: true,
      opacity:     0.55,
      side:        THREE.DoubleSide,
      depthWrite:  false,
    });
    return new THREE.Mesh(geo, mat);
  }

  _updateBirds(t) {
    for (const bird of this._birds) {
      const d = bird.userData;
      const angle = t * d.speed + d.phase;
      bird.position.set(
        d.cx + Math.cos(angle) * d.r,
        d.h  + Math.sin(t * 0.7 + d.phase) * 0.3,
        d.cz + Math.sin(angle) * d.r * 0.5,
      );
      // Bank slightly into the turn.
      bird.rotation.z = -d.speed * 0.6;
      // Face direction of travel.
      bird.rotation.y = -angle + (d.speed > 0 ? 0 : Math.PI);

      // Flap: morph the wing Y vertices.
      const flapY = 0.05 * Math.sin(t * 4.5 + d.phase);
      const pos   = bird.geometry.attributes.position;
      pos.setY(1,  flapY);   // left inner wing tip
      pos.setY(4,  flapY);   // right inner wing tip
      pos.needsUpdate = true;
    }
  }

  // ── Light rays ────────────────────────────────────────────────────────────────
  _buildLightRays() {
    this._rays = [];
    const positions = [-6, 0, 6];
    for (let i = 0; i < RAY_COUNT; i++) {
      // Tall thin plane, tilted to simulate god-ray coming from upper-right.
      const geo = new THREE.PlaneGeometry(0.6, 22, 1, 1);
      const mat = new THREE.MeshBasicMaterial({
        color:       0xfff8e0,
        transparent: true,
        opacity:     0.055,
        side:        THREE.DoubleSide,
        depthWrite:  false,
        blending:    THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(positions[i], 5, -20);
      mesh.rotation.z = 0.18 + (i - 1) * 0.06;  // slight tilt variation
      mesh.rotation.x = -0.15;                   // lean toward camera
      mesh.userData.baseOpacity = 0.04 + i * 0.008;
      mesh.userData.phase       = (i / RAY_COUNT) * Math.PI * 2;
      this._group.add(mesh);
      this._rays.push(mesh);
    }
  }

  _updateRays(t) {
    for (const ray of this._rays) {
      const pulsed = ray.userData.baseOpacity
        + 0.02 * Math.sin(t * 0.3 + ray.userData.phase);
      ray.material.opacity = pulsed;
    }
  }

  // ── Per-frame update ──────────────────────────────────────────────────────────
  update(dt) {
    this._elapsed += dt;
    const t = this._elapsed;
    this._updateDustMotes(t);
    this._updateBirds(t);
    this._updateRays(t);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────────
  dispose() {
    this._group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => { if (m) { if (m.map) m.map.dispose(); m.dispose(); } });
    });
    this._scene.remove(this._group);
  }
}
