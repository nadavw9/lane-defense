// Scene3D — Three.js scene, camera, renderer, and post-processing pipeline.
//
// Coordinate system:
//   X: -6 (left) → +6 (right)   — 4 lanes centered, each ~3 units wide
//   Y: 0 = road surface, positive = up
//   Z: -40 (far/horizon) → +2 (near/bottom of screen)

import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ── Layout constants ───────────────────────────────────────────────────────────
export const ROAD_Z_FAR   = -40;
export const ROAD_Z_NEAR  =   0;
export const LANE_X       = [-4.5, -1.5, 1.5, 4.5];
export const ROAD_HALF_W  = 6.5;

export function posToZ(position) {
  return ROAD_Z_FAR + (position / 100) * (ROAD_Z_NEAR - ROAD_Z_FAR);
}
export function laneToX(laneIdx) { return LANE_X[laneIdx]; }
export function posToWorld(laneIdx, position) {
  return new THREE.Vector3(laneToX(laneIdx), 0, posToZ(position));
}

// ── Scene3D class ─────────────────────────────────────────────────────────────

export class Scene3D {
  constructor(canvas, width, height) {
    this.width  = width;
    this.height = height;

    // ── WebGL Renderer ──────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias:       true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled  = true;
    this.renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace   = THREE.SRGBColorSpace;

    // ── Scene ───────────────────────────────────────────────────────────────
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x090e16, 0.022);

    // ── Environment map (drives PBR reflections on road + cars) ─────────────
    // RoomEnvironment generates a simple PMREM env map from a virtual room of
    // area lights — cheap to compute at startup, gives PBR materials realistic
    // ambient reflections without a full cube render pass every frame.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    this._envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment    = this._envMap;
    this.scene.environmentIntensity = 0.35;   // subtle — road stay dark
    pmrem.dispose();

    // ── Camera ──────────────────────────────────────────────────────────────
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 200);
    this.camera.position.set(0, 9, 16);
    this.camera.lookAt(0, 0, -8);

    // ── Post-Processing ─────────────────────────────────────────────────────
    // Pass order: RenderPass → BloomPass → [ChromaPass → VignettePass] → OutputPass
    // The custom PostFX passes are inserted by PostFX3D after bloom.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this._bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      /* strength  */ 0.65,
      /* radius    */ 0.45,
      /* threshold */ 0.55,  // raised from 0.28 — only very bright emissives bloom now
    );
    this.composer.addPass(this._bloomPass);
    this.composer.addPass(new OutputPass());
  }

  resize(width, height) {
    this.width  = width;
    this.height = height;
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this._bloomPass.resolution.set(width, height);
  }

  render() { this.composer.render(); }

  destroy() {
    this._envMap?.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }

  add(obj) { this.scene.add(obj); return obj; }
  setBloomStrength(v) { this._bloomPass.strength = v; }
  getBloomStrength()  { return this._bloomPass.strength; }
}
