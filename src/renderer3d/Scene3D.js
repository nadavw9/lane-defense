// Scene3D — Three.js scene, camera, renderer, and post-processing pipeline.
//
// Coordinate system:
//   X: symmetric around 0, width scales with active lane count
//   Y: 0 = road surface, positive = up
//   Z: -40 (far/horizon) → +2 (near/bottom of screen)
//
// Lane layout adapts dynamically:
//   n lanes → each lane is 3 world-units wide, symmetric around x=0
//   laneToX(idx, n) computes the centre X of lane idx for n active lanes
//   roadHalfW(n)    computes the half-width of the road for n active lanes

import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ── Tweakable design constants ─────────────────────────────────────────────────
const FOG_COLOR = 0xc8e8ff;   // very light pale blue — daytime atmospheric haze
const FOG_NEAR  = 25;         // cars at Z=-15 (pos~30) are fog-free
const FOG_FAR   = 90;         // sky plane at Z=-48 (~58 dist) → barely tinted

// Shooter viewport column divider style
const DIV_COLOR      = 0xddddcc;   // yellow-white, matches Road3D COL_DIVIDER
const DIV_OPACITY_HI = 0.75;       // opacity at top (near road boundary)
const DIV_OPACITY_LO = 0.10;       // opacity at bottom

// ── Layout constants ───────────────────────────────────────────────────────────
export const ROAD_Z_FAR  = -40;
export const ROAD_Z_NEAR =   0;

// 4-lane backward-compat constants (static).
export const ROAD_HALF_W = 6.5;
export const LANE_X      = [-4.5, -1.5, 1.5, 4.5];

// ── Module-level active lane count ─────────────────────────────────────────────
// All renderers that import laneToX() use this as the default so they
// automatically adapt when a new level starts — no call-site changes needed.
let _activeLaneCount = 4;

export function setActiveLaneCount(n) { _activeLaneCount = n; }

/**
 * Centre X of lane `laneIdx` for a road with `n` active lanes.
 * Each lane is 3 world-units wide, symmetric around x=0.
 *   n=1: lane 0 → 0
 *   n=2: lanes → -1.5, +1.5
 *   n=4: lanes → -4.5, -1.5, +1.5, +4.5
 *
 * Callers that omit `n` get the current active lane count automatically.
 */
export function laneToX(laneIdx, n = _activeLaneCount) {
  const laneW = 3.0;
  return -(n * laneW) / 2 + laneW / 2 + laneIdx * laneW;
}

/**
 * Half-width of the road (centre → outer edge, excluding barrier) for n lanes.
 *   n=1 → 2.0   n=2 → 3.5   n=3 → 5.0   n=4 → 6.5 (= legacy ROAD_HALF_W)
 */
export function roadHalfW(n = _activeLaneCount) {
  return n * 1.5 + 0.5;
}

export function posToZ(position) {
  return ROAD_Z_FAR + (position / 100) * (ROAD_Z_NEAR - ROAD_Z_FAR);
}
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
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled   = false;
    this.renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace    = THREE.SRGBColorSpace;

    // ── Scene ───────────────────────────────────────────────────────────────
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);

    // ── Environment map ──────────────────────────────────────────────────────
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    this._envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment          = this._envMap;
    this.scene.environmentIntensity = 0.35;
    pmrem.dispose();

    // ── Road camera ──────────────────────────────────────────────────────────
    this.camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 200);
    this.camera.position.set(0, 7, 12);
    this.camera.lookAt(0, 0, -10);
    this.camera.layers.set(0);

    // ── HP sprite camera ─────────────────────────────────────────────────────
    this.hpCamera = new THREE.PerspectiveCamera(65, width / height, 0.1, 200);
    this.hpCamera.position.set(0, 7, 12);
    this.hpCamera.lookAt(0, 0, -10);
    this.hpCamera.layers.set(2);

    // ── Shooter viewport — top-down orthographic, adapts to lane count ────────
    const hw = roadHalfW(4);
    this.shooterCamera = new THREE.OrthographicCamera(-hw, hw, 2.0, -1.8, -50, 50);
    this.shooterCamera.position.set(0, 4.5, 0);
    this.shooterCamera.up.set(0, 0, -1);
    this.shooterCamera.lookAt(0, 0, 0);
    this.shooterCamera.layers.set(1);

    // ── Dashed column dividers (layer 1 — shooter viewport only) ─────────────
    this._divMeshes    = [];
    this._divMaterials = [];
    this._buildDividers(4);

    // ── Post-Processing ─────────────────────────────────────────────────────
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this._bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      /* strength  */ 0.0,
      /* radius    */ 0.35,
      /* threshold */ 1.0,
    );
    this.composer.addPass(this._bloomPass);
    this.composer.addPass(new OutputPass());
  }

  // ── Lane-count adaptation ─────────────────────────────────────────────────

  /**
   * Rebuild shooter viewport dividers and resize the orthographic camera to
   * match the active road width.  Call BEFORE Road3D.setLaneCount so that
   * laneToX() already returns the correct values when Road3D rebuilds.
   */
  setLaneCount(n) {
    setActiveLaneCount(n);

    // Dispose and remove old divider meshes.
    for (const m of this._divMeshes) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    for (const m of this._divMaterials) m.dispose();
    this._divMeshes    = [];
    this._divMaterials = [];
    this._buildDividers(n);

    // Fit orthographic shooter camera to new road width.
    const hw = roadHalfW(n);
    this.shooterCamera.left  = -hw;
    this.shooterCamera.right =  hw;
    this.shooterCamera.updateProjectionMatrix();
  }

  // ── Renderer wrappers ─────────────────────────────────────────────────────

  resize(width, height) {
    this.width  = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this._bloomPass.resolution.set(width, height);
    this.camera.aspect   = width / height;
    this.camera.updateProjectionMatrix();
    this.hpCamera.aspect = width / height;
    this.hpCamera.updateProjectionMatrix();
  }

  render() { this.composer.render(); }

  renderDual() {
    const { renderer, composer } = this;
    const w = this.width;
    const h = this.height;
    const SHOOTER_GL_Y = h - 700;
    const SHOOTER_GL_H = 180;

    renderer.autoClear = false;

    renderer.setViewport(0, 0, w, h);
    renderer.clear(true, true, true);
    composer.render();

    renderer.clearDepth();
    renderer.render(this.scene, this.hpCamera);

    renderer.clearDepth();
    renderer.setViewport(0, SHOOTER_GL_Y, w, SHOOTER_GL_H);
    renderer.setScissor(0, SHOOTER_GL_Y, w, SHOOTER_GL_H);
    renderer.setScissorTest(true);
    renderer.render(this.scene, this.shooterCamera);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);

    renderer.autoClear = true;
  }

  destroy() {
    this._envMap?.dispose();
    for (const m of this._divMeshes) { m.geometry.dispose(); }
    for (const m of this._divMaterials) m.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }

  add(obj) { this.scene.add(obj); return obj; }
  setBloomStrength(v) { this._bloomPass.strength = v; }
  getBloomStrength()  { return this._bloomPass.strength; }

  // ── Private ───────────────────────────────────────────────────────────────

  _buildDividers(n) {
    // Dividers between consecutive lanes — n-1 dividers for n lanes.
    const divXs = [];
    for (let i = 0; i < n - 1; i++) {
      divXs.push(laneToX(i, n) + 1.5);   // midpoint between lane i and i+1
    }

    const Z_TOP     = -1.5;
    const Z_BOT     =  1.4;
    const DIV_RANGE = Z_BOT - Z_TOP;
    const DASH_LEN  = 0.18;
    const GAP_LEN   = 0.12;
    const PERIOD    = DASH_LEN + GAP_LEN;
    const DASH_CT   = Math.ceil(DIV_RANGE / PERIOD);

    for (const dx of divXs) {
      for (let d = 0; d < DASH_CT; d++) {
        const z = Z_TOP + d * PERIOD + DASH_LEN / 2;
        if (z > Z_BOT) break;
        const t       = (z - Z_TOP) / DIV_RANGE;
        const opacity = DIV_OPACITY_HI - t * (DIV_OPACITY_HI - DIV_OPACITY_LO);
        const mat  = new THREE.MeshBasicMaterial({ color: DIV_COLOR, transparent: true, opacity });
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.05, DASH_LEN), mat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(dx, -0.18, z);
        dash.layers.set(1);
        this.scene.add(dash);
        this._divMeshes.push(dash);
        this._divMaterials.push(mat);
      }
    }
  }
}
