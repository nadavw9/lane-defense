// AssetLoader — singleton that pre-loads all GLB models before gameplay starts.
// Car3D and Environment3D call getModel(name) to get a deep-cloned THREE.Group
// with per-instance materials so each car/tree can be tinted independently.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Maps CarTypes key → GLB filename (without .glb), or null for procedural types.
export const CAR_ASSET_MAP = {
  small:  'bike',
  big:    'sedan',
  jeep:   'van',
  truck:  'truck',
  bigrig: 'bigrig',
  tank:   null,   // procedural geometry built in Car3D._buildTank(); no Kenney 3D tank exists
};

const ENV_ASSETS = [
  'tree-pine', 'tree-oak',
  'rock-large', 'rock-small',
  'bush', 'grass-clump',
];

class AssetLoader {
  constructor() {
    this._loader = new GLTFLoader();
    this._models = {};
    this._ready  = false;
  }

  async loadAll() {
    const base = import.meta.env.BASE_URL;
    const jobs  = [];

    // Deduplicate and skip null entries (procedural types like tank)
    const carGlbs = [...new Set(Object.values(CAR_ASSET_MAP).filter(Boolean))];
    for (const name of carGlbs) {
      jobs.push(this._loadOne(name, `${base}models/cars/${name}.glb`));
    }
    for (const name of ENV_ASSETS) {
      jobs.push(this._loadOne(name, `${base}models/environment/${name}.glb`));
    }

    await Promise.allSettled(jobs);
    console.log('[AssetLoader] loaded models:', Object.keys(this._models));
    this._ready = true;
  }

  async _loadOne(name, url) {
    try {
      const gltf = await this._loader.loadAsync(url);
      gltf.scene.traverse(n => { if (n.isMesh) n.castShadow = true; });
      this._models[name] = gltf.scene;
    } catch (e) {
      console.warn(`[AssetLoader] Could not load ${url} — will use box fallback.`, e);
    }
  }

  // Returns a deep-cloned Group with own materials (safe for per-instance tinting).
  // nameOrType may be a CarTypes key ('small') or a direct glb name ('tree-pine').
  getModel(nameOrType) {
    const glbName = (nameOrType in CAR_ASSET_MAP) ? CAR_ASSET_MAP[nameOrType] : nameOrType;

    // null means the type uses procedural geometry — return fallback box as placeholder
    if (glbName === null) return this._fallbackBox();

    const source = this._models[glbName];
    if (source) {
      const clone = skeletonClone(source);
      clone.traverse(node => {
        if (!node.isMesh) return;
        if (Array.isArray(node.material)) {
          node.material = node.material.map(m => m.clone());
        } else {
          node.material = node.material.clone();
        }
      });
      return clone;
    }

    return this._fallbackBox();
  }

  _fallbackBox() {
    const group = new THREE.Group();
    const mesh  = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.6, 2),
      new THREE.MeshStandardMaterial({ color: 0x888888 }),
    );
    mesh.castShadow = true;
    group.add(mesh);
    return group;
  }

  isReady() { return this._ready; }
}

export const assetLoader = new AssetLoader();
