// Environment3D — procedural roadside scenery: grass, trees, bushes, rocks, mountains.
// All geometry is rebuilt when lane count changes so the scene edge tracks road width.
// Uses a seeded LCG RNG for deterministic placement across resets.

import * as THREE from 'three';
import { roadHalfW } from './Scene3D.js';
import { assetLoader } from './AssetLoader.js';

// ── Seeded LCG RNG ────────────────────────────────────────────────────────────
function makeLCG(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// ── Design constants ──────────────────────────────────────────────────────────
const GRASS_COLOR   = 0x8fd96a;   // bright saturated green
const GRASS_LIGHT   = 0xa8e878;   // lighter green variation strip

const MTN_COLOR     = 0x7ac043;   // green hills matching Skybox3D
const FLOWER_COLORS = [0xffea44, 0xff88aa, 0xfafafa, 0xff7722];   // yellow/pink/white/orange

const Z_NEAR  = 2.5;    // closest Z (toward camera)
const Z_FAR   = -38;    // farthest Z (horizon)
const Z_RANGE = Z_NEAR - Z_FAR;

const SIDE_GAP   = 0.6;   // gap between road edge and first decoration
const SIDE_DEPTH = 12;    // how far out from road edge decorations extend

// ── EnvironmentChunk — one side (sign = +1 right, -1 left) ───────────────────
class EnvironmentChunk {
  constructor(scene, sign, rng, hw) {
    this._scene  = scene;
    this._meshes = [];
    this._sign   = sign;
    this._build(rng, hw);
  }

  _xBase(hw) { return this._sign * (hw + SIDE_GAP); }

  _build(rng, hw) {
    const xBase = this._xBase(hw);
    const dummy = new THREE.Object3D();

    // ── Grass plane ───────────────────────────────────────────────────────────
    const grassW = SIDE_DEPTH;
    const grassD = Z_RANGE;
    const grassGeo = new THREE.PlaneGeometry(grassW, grassD, 1, 6);
    // Vertex-color the strips to break monotony
    const posAttr = grassGeo.attributes.position;
    const colors  = [];
    for (let i = 0; i < posAttr.count; i++) {
      const z = posAttr.getZ(i);
      const t = (z - Z_FAR) / Z_RANGE;
      const c = (t > 0.5) ? new THREE.Color(GRASS_LIGHT) : new THREE.Color(GRASS_COLOR);
      colors.push(c.r, c.g, c.b);
    }
    grassGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const grassMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(xBase + this._sign * grassW / 2, -0.01, (Z_NEAR + Z_FAR) / 2);
    this._add(grass);

    // ── Trees — Kenney GLB models (tree-pine / tree-oak alternated) ──────────────
    const TREE_MODELS = ['tree-pine', 'tree-oak'];
    const TREE_COUNT  = 18;
    for (let i = 0; i < TREE_COUNT; i++) {
      const x    = xBase + this._sign * (rng() * (SIDE_DEPTH - 0.5) + 0.5);
      const z    = Z_FAR + rng() * Z_RANGE;
      const s    = 0.7 + rng() * 0.6;
      const name = TREE_MODELS[i % TREE_MODELS.length];
      const g    = assetLoader.getModel(name);
      g.scale.setScalar(s);
      g.position.set(x, 0, z);
      g.rotation.y = rng() * Math.PI * 2;
      this._add(g);
    }

    // ── Bushes — Kenney GLB model (plant_bushLarge) ────────────────────────────
    const BUSH_COUNT = 28;
    for (let i = 0; i < BUSH_COUNT; i++) {
      const x = xBase + this._sign * (rng() * (SIDE_DEPTH - 0.3) + 0.2);
      const z = Z_FAR + rng() * Z_RANGE;
      const s = 0.5 + rng() * 0.8;
      const g = assetLoader.getModel('bush');
      g.scale.set(s, s * 0.75, s);
      g.position.set(x, 0, z);
      g.rotation.y = rng() * Math.PI * 2;
      this._add(g);
    }

    // ── Rocks — Kenney GLB models (rock-large / rock-small) ───────────────────
    const ROCK_MODELS = ['rock-large', 'rock-small'];
    const ROCK_COUNT  = 22;
    for (let i = 0; i < ROCK_COUNT; i++) {
      const x    = xBase + this._sign * (rng() * (SIDE_DEPTH - 0.2) + 0.1);
      const z    = Z_FAR + rng() * Z_RANGE;
      const s    = 0.5 + rng() * 1.2;
      const name = ROCK_MODELS[i % ROCK_MODELS.length];
      const g    = assetLoader.getModel(name);
      g.scale.set(s, s * (0.6 + rng() * 0.5), s * (0.8 + rng() * 0.4));
      g.position.set(x, 0, z);
      g.rotation.y = rng() * Math.PI * 2;
      this._add(g);
    }

    // ── Flowers (tiny flat discs scattered near road) ─────────────────────────
    const FLOWER_COUNT = 60;
    const flowerGeo    = new THREE.CircleGeometry(0.15, 5);   // larger patches
    for (const color of FLOWER_COLORS) {
      const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
      const im  = new THREE.InstancedMesh(flowerGeo, mat, FLOWER_COUNT);
      im.count  = 0;
      this._add(im);
    }
    const flowerIMs = this._meshes.slice(-FLOWER_COLORS.length);
    for (let i = 0; i < FLOWER_COUNT; i++) {
      const x  = xBase + this._sign * (rng() * 4.0 + 0.1);
      const z  = Z_FAR + rng() * Z_RANGE;
      const fi = Math.floor(rng() * FLOWER_COLORS.length);
      const im = flowerIMs[fi];
      dummy.position.set(x, 0.02, z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(-Math.PI / 2, 0, rng() * Math.PI * 2);
      dummy.updateMatrix();
      im.setMatrixAt(im.count++, dummy.matrix);
    }
    for (const im of flowerIMs) im.instanceMatrix.needsUpdate = true;
  }

  _add(mesh) {
    this._scene.add(mesh);
    this._meshes.push(mesh);
  }

  dispose() {
    for (const m of this._meshes) {
      this._scene.remove(m);
      if (m.isGroup) {
        // GLB clone — dispose per-instance materials only; geometries are shared across clones.
        m.traverse(node => {
          if (!node.isMesh) return;
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          for (const mat of mats) mat.dispose();
        });
      } else {
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose());
        else m.material?.dispose();
      }
    }
    this._meshes = [];
  }
}

// ── Mountain silhouette (shared, behind both sides) ───────────────────────────
class MountainSilhouette {
  constructor(scene) {
    this._scene = scene;
    this._mesh  = null;
    this._build();
  }

  _build() {
    // A single wide plane far behind the horizon, vertex-colored dark blue-grey.
    const W = 60, H = 8;
    const geo = new THREE.PlaneGeometry(W, H, 12, 1);
    // Push vertices into a mountain ridge silhouette shape
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      if (y > 0) {
        // Top edge: shape into peaks using sine harmonics
        const nx = x / (W / 2);
        const ht = 1.8 * Math.abs(Math.sin(nx * 1.7 + 0.5))
                 + 0.9 * Math.abs(Math.sin(nx * 3.1 + 1.1))
                 + 0.5 * Math.abs(Math.sin(nx * 5.3 + 0.7));
        pos.setY(i, ht);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const mat  = new THREE.MeshBasicMaterial({ color: MTN_COLOR, side: THREE.FrontSide });
    this._mesh = new THREE.Mesh(geo, mat);
    this._mesh.position.set(0, 3.5, Z_FAR - 1);
    this._scene.add(this._mesh);
  }

  dispose() {
    if (this._mesh) {
      this._scene.remove(this._mesh);
      this._mesh.geometry.dispose();
      this._mesh.material.dispose();
      this._mesh = null;
    }
  }
}

// ── Environment3D ─────────────────────────────────────────────────────────────
export class Environment3D {
  constructor(scene) {
    this._scene    = scene;
    this._laneCount = 4;
    this._left     = null;
    this._right    = null;
    this._mountain = new MountainSilhouette(scene);
    this._rebuild(4);
  }

  setLaneCount(n) {
    if (n === this._laneCount) return;
    this._laneCount = n;
    this._left?.dispose();
    this._right?.dispose();
    this._rebuild(n);
  }

  // Environment is static — no per-frame update needed.
  // Stub present so callers can treat it uniformly.
  update(_dt) {}

  dispose() {
    this._left?.dispose();
    this._right?.dispose();
    this._mountain?.dispose();
    this._left     = null;
    this._right    = null;
    this._mountain = null;
  }

  _rebuild(n) {
    const hw  = roadHalfW(n);
    // Seed is fixed so the layout is identical across resets.
    const rng = makeLCG(0xdeadbeef);
    this._left  = new EnvironmentChunk(this._scene, -1, rng, hw);
    // Fresh RNG for right side so it doesn't mirror left.
    const rng2  = makeLCG(0xcafebabe);
    this._right = new EnvironmentChunk(this._scene, +1, rng2, hw);
  }
}
