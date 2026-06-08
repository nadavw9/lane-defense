// Scene3D — Three.js scene, camera, renderer, and post-processing pipeline.
//
// Coordinate system:
//   X: symmetric around 0, width scales with active lane count
//   Y: 0 = road surface, positive = up
//   Z: -22 (far/horizon) → +2 (near/bottom of screen)
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
import { ROAD_TOP_Y, ROAD_BOTTOM_Y } from '../renderer/LaneRenderer.js';

// ── Tweakable design constants ─────────────────────────────────────────────────
const FOG_COLOR = 0xffd0a8;   // morning default — themes override on level start
const FOG_NEAR  = 35;
const FOG_FAR   = 110;

// Shooter viewport column divider style
const DIV_COLOR      = 0xddddcc;   // yellow-white, matches Road3D COL_DIVIDER
const DIV_OPACITY_HI = 0.75;       // opacity at top (near road boundary)
const DIV_OPACITY_LO = 0.10;       // opacity at bottom

// ── Layout constants ───────────────────────────────────────────────────────────
export const ROAD_Z_FAR       = -26;   // gameplay zone far edge (cars spawn here)
export const ROAD_Z_NEAR      =   0;   // gameplay zone near edge (breach line)
export const ROAD_Z_SPAWN     = -26;   // semantic alias: where cars enter the road
export const ROAD_Z_VANISHING = -65;   // road surface extends here visually (no gameplay)

// Extra world units revealed above ROAD_Z_FAR so a bigrig body (half-depth ≈2.52)
// is fully visible before it crosses the spawn line.
const SPAWN_VIEWPORT_EXTRA = 4.0;

// ── Unified grid constants (single source of truth) ───────────────────────────
export const CELL       = 4.0;            // == lane width (laneToX pitch)
export const SLOT_COUNT = 4;              // bomb queue depth (== Shooter3D SLOT_Z length)

/** World Z of bomb-queue slot s (0 = front/active, nearest the breach line).
 *  Step = 0.4 × CELL → slots at 1.6, 3.2, 4.8, 6.4 (≈22% of screen height). */
export function queueZ(s) { return (s + 1) * CELL * 0.4; }   // 1.6, 3.2, 4.8, 6.4

// 4-lane backward-compat constants (static).
export const ROAD_HALF_W = 8.4;
export const LANE_X      = [-6, -2, 2, 6];

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
  const laneW = 4.0;
  return -(n * laneW) / 2 + laneW / 2 + laneIdx * laneW;
}

/**
 * Half-width of the road (centre → outer edge, excluding barrier) for n lanes.
 *   n=1 → 2.0   n=2 → 3.5   n=3 → 5.0   n=4 → 6.5 (= legacy ROAD_HALF_W)
 */
export function roadHalfW(n = _activeLaneCount) {
  return n * 2.0 + 0.4;
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
    this.scene.background = new THREE.Color(0x0d1117);  // dark neutral behind road

    // ── Environment map ──────────────────────────────────────────────────────
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    this._envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment          = this._envMap;
    this.scene.environmentIntensity = 0.35;
    pmrem.dispose();

    // ── Single top-down orthographic camera ──────────────────────────────────
    // Looks straight down -Y. World +X → screen right; world -Z (far/spawn) →
    // screen up. Frustum is computed from the coordinate system, never typed.
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.camera.position.set(0, 8, 0);   // ortho: Y only affects clipping
    this.camera.up.set(0, 0, -1);
    this.camera.layers.enableAll();        // one camera renders all layers
    this._activeLaneCount = 4;
    this._computeFrustum(4);

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

    this._activeLaneCount = n;
    this._computeFrustum(n);
  }

  // ── Renderer wrappers ─────────────────────────────────────────────────────

  resize(width, height) {
    this.width  = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this._bloomPass.resolution.set(width, height);
    this._computeFrustum(this._activeLaneCount);
  }

  render() { this.composer.render(); }

  renderDual() {
    // Single ortho camera, single pass. (Name kept for call-site compat.)
    this.composer.render();
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

  /** Derive ortho frustum so z=ROAD_Z_FAR projects to y=ROAD_TOP_Y and
   *  z=ROAD_Z_NEAR projects to y=ROAD_BOTTOM_Y in PixiJS screen coordinates.
   *  The top is extended by SPAWN_VIEWPORT_EXTRA so the full car body is visible
   *  before it crosses the spawn line. The bottom is preserved (bomb zone unchanged). */
  _computeFrustum(n) {
    const roadZSpan  = ROAD_Z_NEAR - ROAD_Z_FAR;                       // 22
    const pixiRoadH  = ROAD_BOTTOM_Y - ROAD_TOP_Y;                     // 466
    const fHalfZ     = roadZSpan * this.height / (2 * pixiRoadH);      // 19.922
    const topFrac    = ROAD_TOP_Y / this.height;                       // 44/844
    const baseCenter = ROAD_Z_FAR + fHalfZ * (1 - 2 * topFrac);       // -4.156

    // Keep frustum bottom fixed; extend top only.
    const bottomZ  = baseCenter + fHalfZ;                              // +15.768
    const topZ     = ROAD_Z_FAR - SPAWN_VIEWPORT_EXTRA;               // -26
    const fHalfZe  = (bottomZ - topZ) / 2;                            // 20.884
    const zCenter  = (bottomZ + topZ) / 2;                            // -5.116
    const fHalfX   = fHalfZe * (this.width / this.height);

    const cam  = this.camera;
    const camY = 8;
    cam.left   = -fHalfX; cam.right  =  fHalfX;
    cam.top    =  fHalfZe; cam.bottom = -fHalfZe;
    cam.position.set(0, camY, zCenter);
    cam.lookAt(0, 0, zCenter);
    cam.up.set(0, 0, -1);
    cam.near = 0.1;
    cam.far  = camY + 6;
    cam.updateProjectionMatrix();
  }

  _buildDividers(n) {
    // Dividers between consecutive lanes — n-1 dividers for n lanes.
    const divXs = [];
    for (let i = 0; i < n - 1; i++) {
      divXs.push(laneToX(i, n) + 2.0);   // midpoint between lane i and i+1
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
