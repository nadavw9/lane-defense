// AssetLoader — singleton that pre-loads environment GLB models before
// gameplay starts. Environment3D calls getModel(name) to get a deep-cloned
// THREE.Group with per-instance materials so each prop can be tinted
// independently. (Cars are 2D sprites now — see Car2D.js — so no car GLBs.)

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

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
  // name is a direct glb basename ('tree-pine', 'bush', …).
  getModel(name) {
    const source = this._models[name];
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
