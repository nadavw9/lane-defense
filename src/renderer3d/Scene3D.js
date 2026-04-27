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

// ── Tweakable design constants ─────────────────────────────────────────────────
const FOG_COLOR = 0x1a3a6e;   // matches Skybox3D SKY_FAR
const FOG_NEAR  = 15;
const FOG_FAR   = 45;

// Shooter background gradient (top = near road, bottom = deep navy)
const SHOOTER_BG_TOP = 0x2a2a32;   // matches Road3D COL_ASPHALT
const SHOOTER_BG_BOT = 0x0d0f1e;

// Shooter viewport column divider style
const DIV_COLOR      = 0xddddcc;   // yellow-white, matches Road3D COL_DIVIDER
const DIV_OPACITY_HI = 0.75;       // opacity at top (near road boundary)
const DIV_OPACITY_LO = 0.10;       // opacity at bottom

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
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled  = false;
    this.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace   = THREE.SRGBColorSpace;

    // ── Scene ───────────────────────────────────────────────────────────────
    this.scene = new THREE.Scene();
    // Linear fog — distant cars emerge from atmospheric haze
    this.scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);

    // ── Environment map ──────────────────────────────────────────────────────
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    this._envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment         = this._envMap;
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

    // ── Shooter viewport camera — top-down orthographic ──────────────────────
    this.shooterCamera = new THREE.OrthographicCamera(-6, 6, 2.0, -1.8, -50, 50);
    this.shooterCamera.position.set(0, 4.5, 0);
    this.shooterCamera.up.set(0, 0, -1);
    this.shooterCamera.lookAt(0, 0, 0);
    this.shooterCamera.layers.set(1);

    // ── Shooter background — vertical gradient (top → COL_ASPHALT, bottom → navy)
    // PlaneGeometry in XY rotated -π/2 → lies flat in XZ.
    // Local Y maps to world -Z: Y=+5 → world Z=-4.3 (top, near road),
    //                           Y=-5 → world Z=+5.7 (bottom, below viewport).
    this._shooterBgGeo = new THREE.PlaneGeometry(16, 10, 1, 3);
    const bgPos    = this._shooterBgGeo.attributes.position;
    const bgColors = [];
    const topCol   = new THREE.Color(SHOOTER_BG_TOP);
    const botCol   = new THREE.Color(SHOOTER_BG_BOT);
    for (let i = 0; i < bgPos.count; i++) {
      // t=1 at local Y=+5 (top, near road), t=0 at local Y=-5 (bottom)
      const t = (bgPos.getY(i) + 5) / 10;
      const c = new THREE.Color().lerpColors(botCol, topCol, t);
      bgColors.push(c.r, c.g, c.b);
    }
    this._shooterBgGeo.setAttribute('color', new THREE.Float32BufferAttribute(bgColors, 3));
    this._shooterBgMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this._shooterBg    = new THREE.Mesh(this._shooterBgGeo, this._shooterBgMat);
    this._shooterBg.rotation.x = -Math.PI / 2;
    this._shooterBg.position.set(0, -0.2, 0.7);
    this._shooterBg.layers.set(1);
    this.scene.add(this._shooterBg);

    // ── Dashed column dividers — yellow-white, fading from bright (near road)
    // to faint (bottom). Aligns with Road3D lane divider markings at x=-3,0,+3.
    const DIV_XS    = [-3, 0, 3];
    const Z_TOP     = -1.5;  // near road boundary (top of shooter viewport)
    const Z_BOT     =  1.4;  // bottom of shooter viewport
    const DIV_RANGE = Z_BOT - Z_TOP;
    const DASH_LEN  = 0.18;
    const GAP_LEN   = 0.12;
    const PERIOD    = DASH_LEN + GAP_LEN;
    const DASH_CT   = Math.ceil(DIV_RANGE / PERIOD);

    this._divMaterials = [];   // kept for dispose()
    for (const dx of DIV_XS) {
      for (let d = 0; d < DASH_CT; d++) {
        const z = Z_TOP + d * PERIOD + DASH_LEN / 2;
        if (z > Z_BOT) break;
        const t       = (z - Z_TOP) / DIV_RANGE;   // 0 = top, 1 = bottom
        const opacity = DIV_OPACITY_HI - t * (DIV_OPACITY_HI - DIV_OPACITY_LO);
        const mat = new THREE.MeshBasicMaterial({
          color: DIV_COLOR, transparent: true, opacity,
        });
        this._divMaterials.push(mat);
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.05, DASH_LEN), mat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(dx, -0.18, z);
        dash.layers.set(1);
        this.scene.add(dash);
      }
    }

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
    this._shooterBgGeo?.dispose();
    this._shooterBgMat?.dispose();
    for (const m of this._divMaterials) m.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }

  add(obj) { this.scene.add(obj); return obj; }
  setBloomStrength(v) { this._bloomPass.strength = v; }
  getBloomStrength()  { return this._bloomPass.strength; }
}
