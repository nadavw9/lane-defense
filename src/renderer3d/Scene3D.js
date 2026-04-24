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
    this.renderer.shadowMap.enabled  = false;   // disabled — too expensive on mobile
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

    // ── Road camera — ORTHOGRAPHIC top-down ─────────────────────────────────
    // Replaces the old perspective camera that caused angled lanes.
    // left=-6 / right=+6 maps lane positions [-4.5,-1.5,+1.5,+4.5] to EXACTLY
    // the same screen X as the PixiJS column centres (48.75 / 146.25 / 243.75 / 341.25):
    //   screen_X = (laneX + 6) / 12 × 390  →  lane 0 = 48.75px ✓
    // Camera sits above road centre (Y=20, Z=-20), looks straight down.
    // up=(0,0,-1) so Z=-40 (far) appears at the top of the viewport.
    //
    // Frustum top/bottom calculated so:
    //   world Z=-40 (road far)  → screen Y = 44   (ROAD_TOP_Y)
    //   world Z= 0  (road near) → screen Y = 510  (ROAD_BOTTOM_Y)
    //   (camera local_Y = -(worldZ + 20))  → top=23.77, bottom=-48.67
    this.camera = new THREE.OrthographicCamera(-6, 6, 23.77, -48.67, -50, 200);
    this.camera.position.set(0, 20, -20);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, -20);
    this.camera.layers.set(0);

    // ── HP sprite camera — orthographic, same frustum as road camera ─────────
    this.hpCamera = new THREE.OrthographicCamera(-6, 6, 23.77, -48.67, -50, 200);
    this.hpCamera.position.set(0, 20, -20);
    this.hpCamera.up.set(0, 0, -1);
    this.hpCamera.lookAt(0, 0, -20);
    this.hpCamera.layers.set(2);

    // ── Shooter viewport camera — orthographic, SAME X range as road ────────
    // left=-6 / right=+6 guarantees lane X aligns perfectly with road lanes.
    // top=2.0 / bottom=-1.8 covers shooter slots TURRET_Z=-1.5 to SLOT3_Z=1.4.
    // Camera local_Y = -worldZ (camera at Z=0, looking down from Y=4.5).
    //   worldZ=-1.5 → local_Y=1.5 → screen Y≈544 (TOP_Y in ShooterRenderer)
    //   worldZ= 1.4 → local_Y=-1.4 → screen Y≈681
    const SHOOTER_H = 180;
    this.shooterCamera = new THREE.OrthographicCamera(-6, 6, 2.0, -1.8, -50, 50);
    this.shooterCamera.position.set(0, 4.5, 0);
    this.shooterCamera.up.set(0, 0, -1);
    this.shooterCamera.lookAt(0, 0, 0);
    this.shooterCamera.layers.set(1);

    // Flat dark-navy ground plane for the shooter viewport (layer 1).
    // PlaneGeometry lies in XY by default; rotate -π/2 around X to lie flat (XZ plane).
    // Extended to cover the gap between road (Z=0) and shooter slots (Z=-1.5 to 1.4).
    this._shooterBgGeo = new THREE.PlaneGeometry(16, 10);   // increased from 8 to 10
    this._shooterBgMat = new THREE.MeshBasicMaterial({ color: 0x0d0f1e });
    this._shooterBg    = new THREE.Mesh(this._shooterBgGeo, this._shooterBgMat);
    this._shooterBg.rotation.x = -Math.PI / 2;
    this._shooterBg.position.set(0, -0.2, 0.7);   // moved back to cover gap
    this._shooterBg.layers.set(1);
    this.scene.add(this._shooterBg);

    // Thin column dividers (layer 1) — faint lines at X=-3, 0, +3.
    const divMat = new THREE.MeshBasicMaterial({ color: 0x1e2a48 });
    for (const dx of [-3, 0, 3]) {
      const div = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 8), divMat);
      div.position.set(dx, -0.19, 0.5);
      div.layers.set(1);
      this.scene.add(div);
    }

    // ── Post-Processing ─────────────────────────────────────────────────────
    // Pass order: RenderPass → BloomPass → [ChromaPass → VignettePass] → OutputPass
    // The custom PostFX passes are inserted by PostFX3D after bloom.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this._bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      /* strength  */ 0.0,   // disabled — too expensive on mobile
      /* radius    */ 0.35,
      /* threshold */ 1.0,
    );
    this.composer.addPass(this._bloomPass);
    this.composer.addPass(new OutputPass());
  }

  resize(width, height) {
    this.width  = width;
    this.height = height;
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    // OrthographicCamera: frustum bounds are in absolute world units — no aspect update.
    // Bloom resolution must be refreshed.
    this._bloomPass.resolution.set(width, height);
  }

  // Standard single-pass render.
  render() { this.composer.render(); }

  // Three-pass render:
  //   Pass 1 — road scene via bloom+PostFX composer → full canvas (layer 0)
  //   Pass 2 — HP sprites → full canvas (layer 2, after PostFX so never bloomed)
  //   Pass 3 — shooter columns → bottom 180 px (layer 1, no bloom)
  renderDual() {
    const { renderer, composer } = this;
    const w = this.width;
    const h = this.height;
    const SHOOTER_GL_Y = h - 700;   // 844 - 700 = 144 in WebGL coords
    const SHOOTER_GL_H = 180;

    renderer.autoClear = false;

    // Pass 1: road + PostFX (full canvas, layer 0).
    renderer.setViewport(0, 0, w, h);
    renderer.clear(true, true, true);
    composer.render();

    // Pass 2: HP sprites on top of PostFX output (full canvas, layer 2).
    renderer.clearDepth();
    renderer.render(this.scene, this.hpCamera);

    // Pass 3: shooter columns (bottom viewport, layer 1, no bloom).
    renderer.clearDepth();
    renderer.setViewport(0, SHOOTER_GL_Y, w, SHOOTER_GL_H);
    renderer.setScissor(0, SHOOTER_GL_Y, w, SHOOTER_GL_H);
    renderer.setScissorTest(true);
    renderer.render(this.scene, this.shooterCamera);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);   // restore

    renderer.autoClear = true;
  }

  destroy() {
    this._envMap?.dispose();
    this._shooterBgGeo?.dispose();
    this._shooterBgMat?.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }

  add(obj) { this.scene.add(obj); return obj; }
  setBloomStrength(v) { this._bloomPass.strength = v; }
  getBloomStrength()  { return this._bloomPass.strength; }
}
