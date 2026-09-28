// Sprite studio — renders the game's vehicles and bombs as real 3D toy models
// and bakes them to flat sprites (pre-rendered 3D, the look of Parking Jam /
// Car Out style hybrid-casual games): physical paint with clear-coat, glass,
// soft contact shadow, one key light from the top-left, and a thick ink outline
// composited in 2D so the sprites keep the Toy Town silhouette.
//
// The game still draws flat billboards; only the ART is 3D. Everything here is
// deterministic, so re-running the driver reproduces identical sprites.
//
// Conventions: +Z = vehicle FRONT (screen bottom — cars drive down the screen),
// +Y = up, X = width. The camera looks down, tilted toward the front, so the
// windscreen and grille read.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BUILD_HD, buildBossHD, BOSS_PANEL_HD } from './vehicles-hd.js';
import { renderBackdrop } from './backdrop.js';
import { renderMapHD, renderRepairHD } from './mapdiorama.js';
import { renderTitle } from './title.js';

export const PALETTE = {
  Red: 0xFF3D3D, Orange: 0xFF8A1C, Yellow: 0xFFD42A,
  Green: 0x2FCC55, Blue: 0x2F8CFF, Purple: 0xA35CFF,
};
const INK = '#1F1A33';
const TILT = THREE.MathUtils.degToRad(36);   // camera pitch away from straight-down

// ── Renderer / scene ─────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.4;

scene.add(new THREE.HemisphereLight(0xffffff, 0x5a5578, 0.85));
const key = new THREE.DirectionalLight(0xfff4e0, 2.1);
key.position.set(-5, 12, 4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.radius = 6;
key.shadow.blurSamples = 16;
Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 40 });
key.shadow.bias = -0.0004;
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.35);   // soft front-right fill for the glass and grille
fill.position.set(6, 5, 10);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xcfe3ff, 0.9);
rim.position.set(4, 6, -8);
scene.add(rim);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.38 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

// ── Materials ────────────────────────────────────────────────────────────────
const paint = (hex) => new THREE.MeshPhysicalMaterial({
  color: hex, roughness: 0.5, metalness: 0.0, clearcoat: 0.8, clearcoatRoughness: 0.12,
});
const shadeHex = (hex, f) => new THREE.Color(hex).multiplyScalar(f).getHex();
const M = {
  glass:  new THREE.MeshPhysicalMaterial({ color: 0x1B2745, roughness: 0.06, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }),
  tyre:   new THREE.MeshStandardMaterial({ color: 0x24212C, roughness: 0.85 }),
  hub:    new THREE.MeshStandardMaterial({ color: 0xE3E7EE, roughness: 0.3, metalness: 0.6 }),
  trim:   new THREE.MeshStandardMaterial({ color: 0x3A3748, roughness: 0.6 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xDDE3EC, roughness: 0.18, metalness: 0.9 }),
  head:   new THREE.MeshBasicMaterial({ color: 0xFFF6CF }),
  tail:   new THREE.MeshBasicMaterial({ color: 0xFF4A4A }),
  white:  new THREE.MeshStandardMaterial({ color: 0xF6F3EA, roughness: 0.5 }),
  fuse:   new THREE.MeshStandardMaterial({ color: 0x8A6A45, roughness: 0.9 }),
  spark:  new THREE.MeshBasicMaterial({ color: 0xFFE27A }),
};

// ── Geometry helpers ─────────────────────────────────────────────────────────
function rbox(w, h, d, r, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2) - 1e-3), mat);
  m.position.set(x, y, z);
  return m;
}
function wheel(x, z, r = 0.38, w = 0.3) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 28), M.tyre);
  tyre.rotation.z = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, w + 0.02, 20), M.hub);
  hub.rotation.z = Math.PI / 2;
  g.add(tyre, hub);
  g.position.set(x, r, z);
  return g;
}
function lights(g, z, y, xs, mat, w = 0.36, h = 0.16) {
  for (const x of xs) g.add(rbox(w, h, 0.08, 0.05, mat, x, y, z));
}

// ── Vehicles ─────────────────────────────────────────────────────────────────
const BUILD = {
  // Motorbike + rider.
  small(c) {
    const g = new THREE.Group(), p = paint(c);
    g.add(wheel(0, 0.74, 0.4, 0.18), wheel(0, -0.74, 0.4, 0.18));
    g.add(rbox(0.5, 0.42, 1.35, 0.2, p, 0, 0.66, 0.05));
    g.add(rbox(0.38, 0.14, 0.62, 0.07, M.trim, 0, 0.92, -0.25));
    g.add(rbox(0.62, 0.62, 0.46, 0.22, p, 0, 1.2, -0.12));                 // rider torso
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 16), paint(shadeHex(c, 0.8)));
    helmet.position.set(0, 1.66, 0.05);
    const visor = rbox(0.34, 0.14, 0.12, 0.06, M.glass, 0, 1.66, 0.28);
    g.add(helmet, visor);
    g.add(rbox(0.96, 0.07, 0.07, 0.03, M.chrome, 0, 1.08, 0.5));            // handlebar
    lights(g, 0.74, 0.78, [0], M.head, 0.22, 0.16);
    return g;
  },
  // Sedan.
  big(c) {
    const g = new THREE.Group(), p = paint(c);
    for (const [x, z] of [[-0.9, 1.22], [0.9, 1.22], [-0.9, -1.22], [0.9, -1.22]]) g.add(wheel(x, z));
    g.add(rbox(1.9, 0.62, 3.9, 0.3, p, 0, 0.62, 0));
    g.add(rbox(1.96, 0.18, 0.34, 0.08, M.trim, 0, 0.42, 1.86), rbox(1.96, 0.18, 0.34, 0.08, M.trim, 0, 0.42, -1.86));
    g.add(rbox(1.62, 0.56, 2.0, 0.26, M.glass, 0, 1.12, -0.2));
    g.add(rbox(1.5, 0.14, 1.5, 0.07, p, 0, 1.42, -0.28));
    for (const x of [-0.22, 0.22]) {                                          // twin racing stripes
      g.add(rbox(0.16, 0.02, 1.52, 0.01, M.white, x, 1.5, -0.28));
      g.add(rbox(0.16, 0.02, 1.2, 0.01, M.white, x, 0.94, 1.3));
    }
    g.add(rbox(0.16, 0.12, 0.26, 0.05, p, -1.0, 1.0, 0.72), rbox(0.16, 0.12, 0.26, 0.05, p, 1.0, 1.0, 0.72));
    lights(g, 1.95, 0.72, [-0.6, 0.6], M.head);
    lights(g, -1.95, 0.72, [-0.6, 0.6], M.tail);
    return g;
  },
  // Van.
  jeep(c) {
    const g = new THREE.Group(), p = paint(c);
    for (const [x, z] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) g.add(wheel(x, z, 0.4));
    g.add(rbox(2.0, 1.45, 4.1, 0.32, p, 0, 1.08, 0));
    g.add(rbox(2.03, 0.42, 2.5, 0.12, M.glass, 0, 1.46, -0.45));            // side window band
    const ws = rbox(1.78, 0.62, 0.16, 0.08, M.glass, 0, 1.36, 1.98);
    ws.rotation.x = -0.32;
    g.add(ws);
    g.add(rbox(0.1, 0.08, 3.0, 0.04, M.chrome, -0.62, 1.84, -0.3), rbox(0.1, 0.08, 3.0, 0.04, M.chrome, 0.62, 1.84, -0.3));
    g.add(rbox(0.7, 0.1, 0.6, 0.05, M.trim, 0, 1.84, -1.2));                 // roof vent
    g.add(rbox(2.06, 0.2, 0.34, 0.08, M.trim, 0, 0.46, 1.98), rbox(2.06, 0.2, 0.34, 0.08, M.trim, 0, 0.46, -1.98));
    lights(g, 2.06, 0.82, [-0.66, 0.66], M.head);
    return g;
  },
  // Tanker truck: cab up front, round tank with hatches behind.
  truck(c) {
    const g = new THREE.Group(), p = paint(c);
    for (const z of [1.55, -0.55, -1.55]) g.add(wheel(-0.95, z, 0.42), wheel(0.95, z, 0.42));
    g.add(rbox(1.7, 0.3, 4.4, 0.1, M.trim, 0, 0.5, -0.1));                   // chassis
    g.add(rbox(1.96, 1.35, 1.35, 0.28, p, 0, 1.12, 1.55));
    const ws = rbox(1.72, 0.55, 0.14, 0.07, M.glass, 0, 1.4, 2.2);
    ws.rotation.x = -0.25;
    g.add(ws);
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.88, 1.9, 8, 28), paint(shadeHex(c, 0.95)));
    tank.rotation.x = Math.PI / 2;
    tank.position.set(0, 1.28, -0.85);
    g.add(tank);
    for (const z of [-0.2, -1.4]) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 20), M.chrome);
      h.position.set(0, 2.16, z);
      g.add(h);
    }
    g.add(rbox(0.12, 0.1, 2.6, 0.04, M.chrome, 0, 2.12, -0.8));
    lights(g, 2.24, 0.86, [-0.64, 0.64], M.head);
    return g;
  },
  // Big rig: flat-nosed cab + tall box trailer.
  bigrig(c) {
    const g = new THREE.Group(), p = paint(c);
    for (const z of [2.0, 0.9, -1.6, -2.3]) g.add(wheel(-0.95, z, 0.42), wheel(0.95, z, 0.42));
    g.add(rbox(1.96, 1.45, 1.35, 0.26, p, 0, 1.16, 2.02));
    const ws = rbox(1.72, 0.58, 0.14, 0.07, M.glass, 0, 1.46, 2.68);
    ws.rotation.x = -0.12;
    g.add(ws);
    g.add(rbox(1.7, 0.36, 0.5, 0.14, p, 0, 2.02, 1.8));                      // roof fairing
    g.add(rbox(2.04, 1.85, 3.6, 0.16, p, 0, 1.52, -0.72));
    g.add(rbox(2.08, 0.34, 3.2, 0.06, M.white, 0, 1.62, -0.72));             // livery stripe
    for (let i = 0; i < 6; i++) g.add(rbox(1.86, 0.05, 0.1, 0.02, M.trim, 0, 2.46, -2.25 + i * 0.6));   // roof ribs
    g.add(rbox(2.0, 0.22, 0.2, 0.08, M.trim, 0, 0.5, 2.7));
    lights(g, 2.72, 0.86, [-0.66, 0.66], M.head);
    return g;
  },
  // Tank: tracks, hull, turret, barrel toward the player.
  tank(c) {
    const g = new THREE.Group(), p = paint(c), pd = paint(shadeHex(c, 0.78));
    for (const x of [-1.08, 1.08]) {
      g.add(rbox(0.62, 0.66, 4.1, 0.26, M.tyre, x, 0.34, 0));
      for (let i = 0; i < 9; i++) g.add(rbox(0.64, 0.06, 0.16, 0.02, M.trim, x, 0.69, -1.7 + i * 0.425));
    }
    g.add(rbox(1.7, 0.56, 3.7, 0.24, p, 0, 0.8, 0));
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.82, 0.46, 32), p);
    turret.position.set(0, 1.3, -0.25);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), pd);
    dome.position.set(-0.2, 1.52, -0.45);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 2.0, 18), pd);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 1.3, 1.25);
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.24, 18), M.trim);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 1.3, 2.25);
    g.add(turret, dome, barrel, muzzle);
    return g;
  },
};

// ── V2 special-car variants ───────────────────────────────────────────────────
// Each variant decorates the base vehicle and is framed with the BASE vehicle's
// bounds (see window.studio.vehicle), so the sprite keeps the type's aspect and
// body box — Car3D draws both on the same plane.
const STEEL  = new THREE.MeshStandardMaterial({ color: 0xA7B0BF, roughness: 0.32, metalness: 0.85 });
const STEELD = new THREE.MeshStandardMaterial({ color: 0x6E7788, roughness: 0.4, metalness: 0.8 });
const HAZARD_Y = new THREE.MeshStandardMaterial({ color: 0xFFD42A, roughness: 0.5 });
const HAZARD_K = new THREE.MeshStandardMaterial({ color: 0x24212C, roughness: 0.6 });

// Surface landmarks of the premium models (tools/art/studio/vehicles-hd.js),
// read off the model code: body half-width, nose/tail z, hood top and its z
// span, roof top and its z span, and the boot/tail deck height.
const DECK = {
  small:  { hw: 0.25, zF: 0.95, zB: -0.95, hoodY: 1.0,  hood: [0.3, 0.85],  roofY: 1.0,  roof: [-0.7, -0.2],  tailY: 0.98 },
  big:    { hw: 0.98, zF: 2.12, zB: -2.1,  hoodY: 0.9,  hood: [1.05, 1.95], roofY: 1.46, roof: [-0.72, 0.34], tailY: 0.9 },
  jeep:   { hw: 1.02, zF: 2.22, zB: -2.2,  hoodY: 1.12, hood: [1.55, 2.1],  roofY: 1.9,  roof: [-1.86, 1.0],  tailY: 1.9 },
  truck:  { hw: 1.0,  zF: 2.42, zB: -2.4,  hoodY: 1.42, hood: [1.95, 2.35], roofY: 2.12, roof: [1.0, 1.7],    tailY: 2.35 },
  bigrig: { hw: 1.05, zF: 2.82, zB: -2.72, hoodY: 1.5,  hood: [2.45, 2.75], roofY: 2.62, roof: [-2.5, 0.9],   tailY: 2.62 },
};

function bolts(g, xs, y, zs) {
  for (const x of xs) for (const z of zs) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), STEELD);
    b.position.set(x, y, z);
    g.add(b);
  }
}

const VARIANT = {
  // Bolted steel plates on hood and roof, side skirts, a hazard ram on the nose.
  armored(g, type) {
    const D = DECK[type] ?? DECK.big, hw = D.hw;
    const hl = (D.hood[1] - D.hood[0]) * 0.85, hz = (D.hood[0] + D.hood[1]) / 2;
    g.add(rbox(hw * 1.35, 0.07, hl, 0.04, STEEL, 0, D.hoodY + 0.03, hz));
    bolts(g, [-hw * 0.58, hw * 0.58], D.hoodY + 0.08, [hz - hl * 0.38, hz + hl * 0.38]);
    const rl = (D.roof[1] - D.roof[0]) * 0.8, rz = (D.roof[0] + D.roof[1]) / 2;
    g.add(rbox(hw * 1.2, 0.07, rl, 0.04, STEEL, 0, D.roofY + 0.03, rz));
    bolts(g, [-hw * 0.5, hw * 0.5], D.roofY + 0.08, [rz - rl * 0.4, rz + rl * 0.4]);
    for (const sd of [-1, 1]) g.add(rbox(0.1, 0.34, (D.zF - D.zB) * 0.7, 0.04, STEEL, sd * (hw + 0.03), 0.62, (D.zF + D.zB) / 2));
    const ram = new THREE.Group();
    ram.add(rbox(hw * 2.05, 0.28, 0.2, 0.08, HAZARD_K, 0, 0, 0));
    for (let i = -2; i <= 2; i++) { const c = rbox(hw * 0.3, 0.29, 0.21, 0.03, HAZARD_Y, i * hw * 0.42, 0, 0); c.rotation.z = 0.5; ram.add(c); }
    ram.position.set(0, 0.42, D.zF + 0.04);
    g.add(ram);
  },
  // Street racer: lightning bolt on the hood, a wing over the tail, side pipes.
  speeder(g, type, c) {
    const D = DECK[type] ?? DECK.big, hw = D.hw;
    const bolt = new THREE.Shape();
    const s = type === 'small' ? 0.22 : 0.42;
    bolt.moveTo(0.1 * s, 1 * s); bolt.lineTo(-0.45 * s, -0.05 * s); bolt.lineTo(-0.05 * s, -0.05 * s);
    bolt.lineTo(-0.2 * s, -1 * s); bolt.lineTo(0.45 * s, 0.12 * s); bolt.lineTo(0.05 * s, 0.12 * s); bolt.closePath();
    const bm = new THREE.Mesh(new THREE.ExtrudeGeometry(bolt, { depth: 0.03, bevelEnabled: false }), M.white);
    bm.rotation.x = -Math.PI / 2;
    bm.position.set(0, D.hoodY + 0.02, (D.hood[0] + D.hood[1]) / 2);
    g.add(bm);
    if (type === 'small') {
      for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.7, 12), M.chrome); p.rotation.x = Math.PI / 2; p.position.set(sd * 0.3, 0.5, -0.6); g.add(p); }
      return;
    }
    const wingM = paint(shadeHex(c, 0.6));
    g.add(rbox(hw * 2.0, 0.07, 0.4, 0.03, wingM, 0, D.tailY + 0.3, D.zB + 0.35));
    for (const sd of [-1, 1]) g.add(rbox(0.07, 0.3, 0.1, 0.03, M.trim, sd * hw * 0.62, D.tailY + 0.14, D.zB + 0.35));
    for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, (D.zF - D.zB) * 0.5, 14), M.chrome); p.rotation.x = Math.PI / 2; p.position.set(sd * (hw + 0.07), 0.4, (D.zF + D.zB) / 2 - 0.2); g.add(p); }
  },
  // Shape-shifter: a crest of fins along the roof and a glass dome in its middle
  // (the game lights the dome with the colour it will turn into next).
  chameleon(g, type, c) {
    const D = DECK[type] ?? DECK.big;
    const fin = paint(shadeHex(c, 0.68));
    const small = type === 'small';
    const domeZ = small ? -0.45 : (D.roof[0] + D.roof[1]) / 2;
    const n = small ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const z = D.roof[0] + 0.12 + (i / Math.max(1, n - 1)) * Math.max(0, domeZ - 0.5 - D.roof[0] - 0.12);
      const sz = (small ? 0.1 : 0.16) * (0.7 + 0.3 * (i / Math.max(1, n - 1)));
      const f = new THREE.Mesh(new THREE.ConeGeometry(sz, sz * 2.2, 4), fin);
      f.position.set(0, D.roofY + sz, z);
      f.rotation.y = Math.PI / 4;
      g.add(f);
    }
    const r = small ? 0.18 : 0.36;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ color: 0xF4F1FF, roughness: 0.05, clearcoat: 1, metalness: 0.1 }));
    dome.position.set(0, (small ? 1.02 : D.roofY) + 0.02, small ? -0.62 : domeZ);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.01, 0.045, 8, 28), M.chrome);
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(dome.position);
    g.add(dome, ring);
  },
};

// ── Boss vehicle ──────────────────────────────────────────────────────────────
// A monster hauler: charcoal body, hazard ram, six chunky wheels, exhaust stacks
// and a black light panel on the roof where the game draws the colour sequence.
const BOSS_PANEL = { x: 0, y: 2.62, z: -0.45, w: 2.2, d: 2.9 };
function buildBoss({ armored = false } = {}) {
  const g = new THREE.Group();
  g.scale.set(1.22, 1, 1);   // wide and squat: it owns the lane
  const body = paint(0x3B3F4E), bodyD = paint(0x262833);
  for (const z of [2.1, 0.2, -1.9]) g.add(wheel(-1.35, z, 0.62, 0.5), wheel(1.35, z, 0.62, 0.5));
  g.add(rbox(2.5, 0.4, 5.6, 0.12, M.trim, 0, 0.72, 0));                       // chassis
  g.add(rbox(2.9, 1.5, 2.0, 0.34, body, 0, 1.55, 1.85));                        // cab
  const ws = rbox(2.5, 0.6, 0.16, 0.08, M.glass, 0, 1.95, 2.84);
  ws.rotation.x = -0.2;
  g.add(ws);
  // Angry brow over the windscreen + yellow eyes (headlights).
  const brow = rbox(2.7, 0.18, 0.3, 0.06, bodyD, 0, 2.34, 2.78);
  brow.rotation.x = 0.25;
  g.add(brow);
  lights(g, 2.88, 1.25, [-0.85, 0.85], new THREE.MeshBasicMaterial({ color: 0xFFD42A }), 0.5, 0.24);
  g.add(rbox(3.0, 1.9, 3.7, 0.22, body, 0, 1.75, -0.95));                       // cargo box
  g.add(rbox(BOSS_PANEL.w, 0.1, BOSS_PANEL.d, 0.06, new THREE.MeshStandardMaterial({ color: 0x15121F, roughness: 0.35 }),
    BOSS_PANEL.x, BOSS_PANEL.y, BOSS_PANEL.z));                                   // light panel
  g.add(rbox(BOSS_PANEL.w + 0.2, 0.08, BOSS_PANEL.d + 0.2, 0.05, M.chrome, BOSS_PANEL.x, BOSS_PANEL.y - 0.05, BOSS_PANEL.z));
  // Hazard ram across the nose.
  const ram = new THREE.Group();
  ram.add(rbox(3.2, 0.5, 0.3, 0.1, HAZARD_K, 0, 0, 0));
  for (let i = -3; i <= 3; i++) { const c = rbox(0.34, 0.51, 0.31, 0.03, HAZARD_Y, i * 0.46, 0, 0); c.rotation.z = 0.55; ram.add(c); }
  ram.position.set(0, 0.8, 2.95);
  g.add(ram);
  // Exhaust stacks behind the cab.
  for (const sd of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.3, 16), M.chrome);
    st.position.set(sd * 1.2, 2.55, 0.75);
    g.add(st);
  }
  // Hazard trim along the cargo box's top edges, amber beacons on the cab roof,
  // chrome teeth on the grille: it has to read as THE threat at a glance.
  for (const sd of [-1, 1]) {
    const trim = new THREE.Group();
    trim.add(rbox(0.22, 0.12, 3.7, 0.04, HAZARD_K, 0, 0, 0));
    for (let i = 0; i < 9; i++) { const c = rbox(0.23, 0.13, 0.2, 0.02, HAZARD_Y, 0, 0, -1.7 + i * 0.425); c.rotation.x = 0.6; trim.add(c); }
    trim.position.set(sd * 1.42, 2.7, -0.95);
    g.add(trim);
  }
  const beacon = new THREE.MeshBasicMaterial({ color: 0xFF9A1C });
  for (const x of [-1.1, -0.4, 0.4, 1.1]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), beacon);
    b.position.set(x, 2.3, 2.1);
    g.add(b);
  }
  for (let i = 0; i < 7; i++) g.add(rbox(0.2, 0.55, 0.12, 0.05, M.chrome, -1.05 + i * 0.35, 1.05, 2.86));
  if (armored) {
    for (const sd of [-1, 1]) g.add(rbox(0.12, 0.8, 5.0, 0.05, STEEL, sd * 1.52, 1.2, 0));
    g.add(rbox(2.6, 0.1, 1.2, 0.04, STEEL, 0, 2.33, 1.7));
    bolts(g, [-1.53, 1.53], 1.55, [-2, -1, 0, 1, 2]);
  }
  return g;
}

// Booster icons — same materials and light as the game pieces.
const ICONS = {
  // Beach-ball of the six game colours: "change colour".
  colorchange() {
    const g = new THREE.Group(), cols = Object.values(PALETTE);
    for (let i = 0; i < 6; i++) {
      const seg = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 24, (i / 6) * Math.PI * 2, Math.PI * 2 / 6),
        new THREE.MeshPhysicalMaterial({ color: cols[i], roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 }),
      );
      seg.rotation.x = 0.5;
      g.add(seg);
    }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), M.white);
    cap.position.set(0, 0.88, 0.48);
    g.add(cap);
    g.position.y = 1;
    return g;
  },
  // Six-armed ice crystal.
  freeze() {
    const g = new THREE.Group();
    const ice = new THREE.MeshPhysicalMaterial({ color: 0xBFEFFF, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
    for (let i = 0; i < 6; i++) {
      const arm = new THREE.Group();
      arm.add(rbox(0.26, 0.2, 1.9, 0.1, ice, 0, 0, 0.95));
      for (const [z, s] of [[1.1, 0.55], [1.55, 0.4]]) {
        for (const sd of [-1, 1]) {
          const b = rbox(0.18, 0.16, s, 0.08, ice, sd * s * 0.32, 0, z);
          b.rotation.y = sd * 0.8;
          arm.add(b);
        }
      }
      arm.rotation.y = (i / 6) * Math.PI * 2;
      g.add(arm);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.24, 6), ice);
    g.add(hub);
    g.position.y = 0.3;
    return g;
  },
  // Classic black bomb.
  bomb() { return buildBomb(0x2E2A3A); },
};

// Cartoon bomb: glossy sphere, metal cap, short fuse with a spark.
function buildBomb(c) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshPhysicalMaterial({
    color: c, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08,
  }));
  ball.position.y = 1;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.26, 24), M.chrome);
  cap.position.set(0.34, 1.9, -0.36);
  cap.rotation.set(-0.35, 0, -0.35);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.38, 2.0, -0.4), new THREE.Vector3(0.55, 2.28, -0.5), new THREE.Vector3(0.8, 2.36, -0.42),
  ]);
  const fuse = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.07, 10), M.fuse);
  const spark = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), M.spark);
  spark.position.set(0.84, 2.38, -0.4);
  g.add(ball, cap, fuse, spark);
  return g;
}

// Toy proportions: every vehicle renders at ~one row LENGTH in game (Car3D
// normalises length), so width is the lever for on-screen presence. Wider and
// a touch shorter reads chunkier and toy-like, and fills more of the lane.
const CHUNK = {
  small: [1.3, 1.05, 0.95], big: [1.2, 1.05, 0.9], jeep: [1.18, 1.03, 0.9],
  truck: [1.18, 1.03, 0.9], bigrig: [1.16, 1.02, 0.9], tank: [1.06, 1.05, 0.95],
};

// Premium models are already built chunky; only a light widening on top.
const CHUNK_HD = {
  small: [1.5, 1, 1], big: [1.32, 1, 0.95], jeep: [1.26, 1, 0.95],
  truck: [1.26, 1, 0.95], bigrig: [1.24, 1, 0.95], tank: [1.2, 1, 1],
};

// ── Rendering ────────────────────────────────────────────────────────────────
function place(obj) {
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(obj);
  return obj;
}

// Aim the tilted orthographic camera at `obj`, sized to its projected bounds.
function frame(obj, pxPerUnit, marginPx, forcedPx = null) {
  const dir = new THREE.Vector3(0, Math.cos(TILT), Math.sin(TILT));   // toward camera
  camera.position.copy(dir.clone().multiplyScalar(30));
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  // Project the object's world-space bbox corners (and its shadow footprint on
  // the ground) into camera space for the frame extents.
  const box = new THREE.Box3().setFromObject(obj);
  const pts = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [0, box.max.y]) for (const z of [box.min.z, box.max.z]) pts.push(new THREE.Vector3(x, y, z));
  const inv = camera.matrixWorldInverse;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { p.applyMatrix4(inv); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const m = marginPx / pxPerUnit;
  let W = Math.ceil((x1 - x0 + 2 * m) * pxPerUnit), H = Math.ceil((y1 - y0 + 2 * m) * pxPerUnit);
  let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  if (forcedPx) { W = H = forcedPx; }
  const hw = W / pxPerUnit / 2, hh = H / pxPerUnit / 2;
  Object.assign(camera, { left: cx - hw, right: cx + hw, top: cy + hh, bottom: cy - hh });
  camera.updateProjectionMatrix();
  renderer.setSize(W, H, false);
  return { W, H };
}

// Renders and copies to a W×H canvas. When the renderer is larger (a
// supersampled vehicle render), the copy downsamples with high-quality
// filtering — that is the anti-aliasing.
function snapshot(W, H) {
  renderer.render(scene, camera);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  x.drawImage(renderer.domElement, 0, 0, W, H);
  return c;
}
const SS = 3;   // vehicle supersampling factor

// Two passes: the object alone (for colour + silhouette) and its shadow alone.
function renderPasses(obj, W, H) {
  ground.visible = false;
  const body = snapshot(W, H);
  ground.visible = true;
  const mats = [];
  obj.traverse(o => { if (o.isMesh) { mats.push([o, o.material.colorWrite]); o.material = o.material.clone(); o.material.colorWrite = false; } });
  const shadow = snapshot(W, H);
  obj.traverse(o => { if (o.isMesh) o.material.colorWrite = true; });
  return { body, shadow };
}

// Ink outline: stamp the tinted silhouette in a ring, then the body on top.
function compose({ body, shadow }, W, H, outlinePx, withShadow = true) {
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d');
  if (withShadow) ctx.drawImage(shadow, 0, 0);
  const sil = document.createElement('canvas');
  sil.width = W; sil.height = H;
  const s = sil.getContext('2d');
  s.drawImage(body, 0, 0);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = INK;
  s.fillRect(0, 0, W, H);
  const steps = 32;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ctx.drawImage(sil, Math.cos(a) * outlinePx, Math.sin(a) * outlinePx);
  }
  ctx.drawImage(sil, 0, 0);
  ctx.drawImage(body, 0, 0);
  return out;
}

function clearObj(obj) {
  scene.remove(obj);
  obj.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose?.(); } });
}

// ── Scenery (side verges) ────────────────────────────────────────────────────
// Rendered with the SAME camera tilt and light as the vehicles, so the world
// and the cars read as one diorama. No ink outline: scenery must recede behind
// the gameplay pieces. Strips tile vertically in game, so everything tall is
// kept clear of the top/bottom edges and every repeating pattern divides the
// visible ground length exactly.
function rng(seed) {                               // mulberry32 — well-mixed low bits
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const std = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const basic = (color) => new THREE.MeshBasicMaterial({ color });

// Mottled ground texture (two tones), tiled `rep` times across the plane.
function noiseTex(a, b, seed, speckles = 1400, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = a; x.fillRect(0, 0, size, size);
  for (let i = 0; i < speckles; i++) {
    x.fillStyle = b; x.globalAlpha = 0.18 + r() * 0.35;
    const px = r() * size, py = r() * size, rad = 1 + r() * 4;
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      x.beginPath(); x.ellipse(px + ox, py + oy, rad * 1.6, rad, r() * 3, 0, Math.PI * 2); x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function slab(w, d, mat, x, z, y = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), mat);
  m.position.set(x, y + 0.01, z);
  m.receiveShadow = true;
  return m;
}
function gableRoof(w, d, h, mat) {
  // Triangular prism, ridge along Z.
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(0, h); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return new THREE.Mesh(g, mat);
}
function tree(x, z, s, r, palette = [0x3FA652, 0x4DB860, 0x36944A]) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 0.9 * s, 10), std(0x8A5A3B, 0.9));
  trunk.position.y = 0.45 * s;
  g.add(trunk);
  const leaf = std(palette[Math.floor(r() * palette.length)], 0.75, { flatShading: true });
  for (const [ox, oy, oz, rr] of [[0, 1.35, 0, 0.72], [-0.38, 1.05, 0.18, 0.5], [0.4, 1.12, -0.1, 0.52], [0.05, 1.75, -0.05, 0.45]]) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(rr * s, 1), leaf);
    b.position.set(ox * s, oy * s, oz * s);
    g.add(b);
  }
  g.position.set(x, 0, z);
  g.rotation.y = r() * 6.28;
  return g;
}
function bush(x, z, s, r) {
  const g = new THREE.Group(), m = std(0x4DB560, 0.8, { flatShading: true });
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry((0.32 + r() * 0.14) * s, 1), m);
    b.position.set((i - 1) * 0.38 * s, 0.28 * s, (r() - 0.5) * 0.2 * s);
    g.add(b);
  }
  g.position.set(x, 0, z);
  return g;
}
const WALLS = [0xF6EBD9, 0xF2E3C6, 0xE8EEF2, 0xF7E1D7, 0xE6F0DE];
const ROOFS = [0xE0574A, 0x4F86D9, 0x3FA0A0, 0xE9923A, 0x8E6BD6, 0xC9503F];
function house(x, z, w, d, r) {
  const g = new THREE.Group();
  const turned = r() < 0.35;                       // ridge across instead of along
  if (turned) [w, d] = [d, w];
  // Colours CYCLE (from a random start per strip) instead of pure random, so a
  // strip never ends up all one or two roof colours.
  house.k = (house.k ?? Math.floor(r() * 60)) + 1;
  const wall = std(WALLS[house.k % WALLS.length], 0.85);
  const roofM = std(ROOFS[(house.k * 5) % ROOFS.length], 0.6);
  const H = 1.25 + r() * 0.35;
  g.add(rbox(w, H, d, 0.08, wall, 0, H / 2, 0));
  const roof = gableRoof(w + 0.35, d + 0.35, 0.95 + r() * 0.3, roofM);
  roof.position.y = H;
  g.add(roof);
  const ch = rbox(0.34, 0.7, 0.34, 0.04, std(0xB9ADA0, 0.9), w * 0.22, H + 0.55, -d * 0.2);
  g.add(ch);
  // Front (+Z) face: door + windows, facing the camera.
  g.add(rbox(0.46, 0.8, 0.06, 0.05, std(0x8A5A3B, 0.7), -w * 0.22, 0.4, d / 2 + 0.02));
  for (const wx of [w * 0.12, w * 0.34]) g.add(rbox(0.38, 0.38, 0.06, 0.05, M.glass, wx, 0.82, d / 2 + 0.02));
  g.position.set(x, 0, z);
  return g;
}
function hedge(x, z, len, along = true) {
  const m = std(0x3F9A4E, 0.85, { flatShading: true });
  return rbox(along ? 0.34 : len, 0.36, along ? len : 0.34, 0.14, m, x, 0.18, z);
}
function flowers(x, z, r) {
  const g = new THREE.Group();
  const cols = [0xFF6FA8, 0xFFE14A, 0xFFFFFF, 0xFF8A3C, 0xB48CFF];
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), basic(cols[Math.floor(r() * cols.length)]));
    f.position.set((r() - 0.5) * 0.9, 0.12, (r() - 0.5) * 0.5);
    g.add(f);
  }
  g.add(slab(1.0, 0.6, std(0x7A5A40, 0.95), 0, 0, 0.01));
  g.position.set(x, 0, z);
  return g;
}
function lampPost(x, z, night = false) {
  const g = new THREE.Group(), pole = std(0x4A4658, 0.5, { metalness: 0.4 });
  g.add(rbox(0.1, 2.2, 0.1, 0.04, pole, 0, 1.1, 0));
  g.add(rbox(0.5, 0.08, 0.1, 0.04, pole, 0.2, 2.2, 0));
  const head = rbox(0.3, 0.12, 0.2, 0.05, night ? basic(0xFFF1B0) : std(0xF4F1E6, 0.4), 0.42, 2.15, 0);
  g.add(head);
  g.position.set(x, 0, z);
  return g;
}
// Industrial props.
const CONTAINER = [0xE0574A, 0x2F8CFF, 0x2FA36B, 0xE9923A, 0x6E5BD0];
function container(x, z, r, y = 0) {
  const m = std(CONTAINER[Math.floor(r() * CONTAINER.length)], 0.55);
  const g = new THREE.Group();
  g.add(rbox(1.3, 1.25, 2.9, 0.05, m, 0, 0.63 + y, 0));
  for (let i = 0; i < 7; i++) g.add(rbox(1.32, 1.1, 0.06, 0.02, std(0x000000, 0.9, { transparent: true, opacity: 0.12 }), 0, 0.63 + y, -1.2 + i * 0.4));
  g.position.set(x, 0, z);
  return g;
}
function warehouse(x, z, w, d, r) {
  const g = new THREE.Group();
  const wall = std([0xC9CDD4, 0xD8C7A8, 0xB8C4CC][Math.floor(r() * 3)], 0.8);
  const roofM = std([0xE9923A, 0x3FA0A0, 0x7A8190][Math.floor(r() * 3)], 0.55);
  g.add(rbox(w, 2.0, d, 0.06, wall, 0, 1.0, 0));
  g.add(rbox(w + 0.2, 0.18, d + 0.2, 0.05, roofM, 0, 2.08, 0));
  for (let i = 0; i < Math.floor(d / 0.5); i++) g.add(rbox(w + 0.22, 0.05, 0.08, 0.02, std(0x000000, 0.9, { transparent: true, opacity: 0.18 }), 0, 2.19, -d / 2 + 0.25 + i * 0.5));
  g.add(rbox(w * 0.55, 1.2, 0.06, 0.04, std(0x6F7482, 0.6), 0, 0.6, d / 2 + 0.02));            // roller door
  for (let i = 0; i < 5; i++) g.add(rbox(w * 0.55, 0.03, 0.07, 0.01, std(0x4A4E5A, 0.6), 0, 0.2 + i * 0.22, d / 2 + 0.04));
  g.position.set(x, 0, z);
  return g;
}
function drum(x, z, color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.62, 18), std(color, 0.5));
  m.position.set(x, 0.31, z);
  return m;
}
function cone(x, z) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.46, 16), std(0xFF7A1A, 0.5));
  c.position.y = 0.25;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.125, 0.07, 16), std(0xFFFFFF, 0.5));
  band.position.y = 0.26;
  g.add(rbox(0.36, 0.04, 0.36, 0.02, std(0x2A2733, 0.8), 0, 0.02, 0), c, band);
  g.position.set(x, 0, z);
  return g;
}
// Night props.
function tower(x, z, w, d, h, r) {
  const g = new THREE.Group();
  g.add(rbox(w, h, d, 0.08, std([0x2B3050, 0x322A4E, 0x23304A][Math.floor(r() * 3)], 0.7), 0, h / 2, 0));
  const lit = [basic(0xFFD76A), basic(0x8FE8FF), basic(0xFF9BD5)];
  const cols = Math.max(2, Math.floor(w / 0.45)), rows = Math.max(2, Math.floor(h / 0.5));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    if (r() < 0.45) continue;
    g.add(rbox(0.22, 0.26, 0.04, 0.02, lit[Math.floor(r() * 3)], -w / 2 + (i + 0.5) * (w / cols), 0.35 + j * (h - 0.5) / rows, d / 2 + 0.02));
  }
  // Parapet rim so the roof reads as a roof, then a neon sign bar or AC units.
  g.add(rbox(w + 0.06, 0.1, d + 0.06, 0.04, std(0x4A5378, 0.6), 0, h + 0.02, 0));
  g.add(rbox(w - 0.2, 0.06, d - 0.2, 0.03, std([0x2B3050, 0x322A4E, 0x23304A][Math.floor(r() * 3)], 0.8), 0, h + 0.06, 0));
  if (r() < 0.5) { g.add(rbox(0.05, 0.6, 0.05, 0.02, std(0x7A8199, 0.5), -w * 0.3, h + 0.35, -d * 0.2)); g.add(rbox(0.1, 0.1, 0.1, 0.03, basic(0xFF4A4A), -w * 0.3, h + 0.68, -d * 0.2)); }
  if (r() < 0.6) g.add(rbox(w * 0.7, 0.18, 0.08, 0.04, basic([0xFF4FD8, 0x39E6FF, 0xFFE14A][Math.floor(r() * 3)]), 0, h + 0.25, d * 0.3));
  else g.add(rbox(0.5, 0.3, 0.5, 0.05, std(0x5A6078, 0.6), w * 0.2, h + 0.15, 0));
  g.position.set(x, 0, z);
  return g;
}

const WORLD = {
  world1: {
    grass: ['#5E9E45', '#79B65A'], walk: 0xC9C4B6, kerb: 0xF1EDE2, lamps: false,
    light: { hemi: 0.85, key: 2.1, keyColor: 0xfff4e0, env: 0.35 },
  },
  world2: {
    grass: ['#8E8A80', '#A39E92'], walk: 0xBFBBB2, kerb: 0xF2C230, lamps: false,
    light: { hemi: 0.85, key: 2.0, keyColor: 0xffe8c8, env: 0.35 },
  },
  world3: {
    grass: ['#1C2036', '#2A2F4C'], walk: 0x3A3F5C, kerb: 0x39E6FF, lamps: true,
    light: { hemi: 0.45, key: 0.9, keyColor: 0x9fb4ff, env: 0.2 },
  },
};

function buildVerge(world, side, seed, Wu, Lu) {
  const cfg = WORLD[world], r = rng(seed * 97 + (side === 'left' ? 1 : 7));
  const g = new THREE.Group();
  const s = side === 'left' ? 1 : -1;           // +1: road is at +X
  const roadX = s * Wu / 2;
  // Ground bands: lawn/lot, sidewalk, kerb.
  // No sidewalk band: in game the road's own light shoulder already reads as
  // the pavement, and every unit spent on it shrinks the houses.
  const walkW = 0, kerbW = 0.28;
  const tex = noiseTex(cfg.grass[0], cfg.grass[1], seed);
  tex.repeat.set(Wu / 6, Lu / 6);
  g.add(slab(Wu + 2, Lu + 8, std(0xffffff, 0.95, { map: tex }), 0, 0));
  const walkX = roadX - s * (kerbW + 0.45);          // furniture line just inside the kerb
  const kerb = rbox(kerbW, 0.16, Lu + 8, 0.04, world === 'world3' ? basic(cfg.kerb) : std(cfg.kerb, 0.7), roadX - s * kerbW / 2, 0.08, 0);
  g.add(kerb);
  if (world === 'world2') {                         // hazard chevrons on the kerb
    for (let i = 0; i < 40; i++) g.add(rbox(kerbW + 0.01, 0.17, 0.18, 0.02, std(0x2A2733, 0.7), roadX - s * kerbW / 2, 0.08, -Lu / 2 + (i + 0.5) * (Lu / 40)));
  }
  if (world === 'world1') g.add(hedge(roadX - s * (kerbW + 0.25), 0, Lu + 8));
  // Content band: from the outer screen edge to the sidewalk.
  const inner = roadX - s * (kerbW + (world === 'world1' ? 0.55 : 0.2)), outer = -roadX + s * 0.05;
  const bandC = (inner + outer) / 2, bandW = Math.abs(inner - outer);
  const tanT = Math.tan(TILT);
  // Walk down the strip placing props, leaving clear space at both edges.
  let z = -Lu / 2 + 0.6;
  const zEnd = Lu / 2 - 0.4;
  const put = (obj, depth, height) => {
    // Tall things lean toward the far edge on screen by height·tan(tilt).
    const zc = z + height * tanT + depth / 2;
    if (zc + depth / 2 > zEnd) return false;
    obj.position.z = zc;
    g.add(obj);
    z = zc + depth / 2 + 0.5 + r() * 0.6;
    return true;
  };
  let guard = 0;
  while (z < zEnd - 1 && guard++ < 40) {
    const p = r();
    if (world === 'world1') {
      if (p < 0.55) {
        // A plot: house pushed to one side, a tree or flower bed beside it.
        const w = Math.min(bandW - 0.9, 2.5 + r() * 0.4), d = 2.4 + r() * 0.6;
        const off = (bandW - w) / 2 - 0.15, hx = bandC + (r() < 0.5 ? -off : off) * 0.9;
        const plot = new THREE.Group();
        plot.add(house(hx - bandC, 0, w, d, r));
        const sideX = (hx < bandC ? 1 : -1) * (w / 2 + 0.55);
        plot.add(r() < 0.6 ? tree(hx - bandC + sideX, 0.2, 0.75 + r() * 0.2, r) : flowers(hx - bandC + sideX, 0.3, r));
        plot.position.x = bandC;
        if (!put(plot, Math.max(w, d) + 0.2, 2.4)) break;
      } else if (p < 0.85) {
        const grp = new THREE.Group();
        grp.add(tree(-bandW * 0.2, 0, 0.95 + r() * 0.3, r), tree(bandW * 0.22, 0.5, 0.8 + r() * 0.3, r));
        grp.position.x = bandC;
        if (!put(grp, 1.8, 2.2)) break;
      } else {
        const grp = new THREE.Group();
        grp.add(bush(-0.5, 0, 1, r), flowers(0.7, 0.1, r));
        grp.position.x = bandC;
        if (!put(grp, 0.9, 0.6)) break;
      }
    } else if (world === 'world2') {
      if (p < 0.45) { const w = Math.min(bandW - 0.3, 3.4), d = 3.2 + r() * 1.2; if (!put(warehouse(bandC, 0, w, d, r), d, 2.2)) break; }
      else if (p < 0.8) {
        const grp = new THREE.Group();
        grp.add(container(-0.7, 0, r), container(0.7, 0, r));
        if (r() < 0.5) grp.add(container(0, 0, r, 1.25));
        grp.position.x = bandC;
        if (!put(grp, 2.9, 2.5)) break;
      } else {
        const grp = new THREE.Group();
        const dc = [0x2F8CFF, 0xE0574A, 0x2FA36B][Math.floor(r() * 3)];
        grp.add(drum(-0.4, 0, dc), drum(0.2, 0.1, dc), drum(-0.1, 0.55, dc));
        grp.position.x = bandC;
        if (!put(grp, 1.0, 0.6)) break;
      }
    } else {
      const w = Math.min(bandW - 0.2, 2.8 + r() * 0.6), d = 2.4 + r() * 0.8, h = 2.4 + r() * 1.6;
      if (!put(tower(bandC, 0, w, d, h, r), d, h + 0.4)) break;
    }
  }
  // Sidewalk furniture: lamps (all worlds), cones (industrial).
  for (let i = 0; i < 3; i++) {
    const lz = -Lu / 2 + (i + 0.5) * (Lu / 3) + 1.2;
    if (cfg.lamps) {                                  // night: glowing lamp heads on short posts
      const lamp = lampPost(walkX + s * 0.35, lz, true);
      lamp.scale.setScalar(0.6);
      lamp.rotation.y = s > 0 ? 0 : Math.PI;
      g.add(lamp);
    }
    if (world === 'world2') g.add(cone(walkX - s * 0.2, lz + 2.4));
  }
  return g;
}

function setLight(l) {
  scene.children.find(o => o.isHemisphereLight).intensity = l.hemi;
  key.intensity = l.key;
  key.color.set(l.keyColor);
  scene.environmentIntensity = l.env;
}
const DEFAULT_LIGHT = { hemi: 0.85, key: 2.1, keyColor: 0xfff4e0, env: 0.4 };

// Public API for the driver. Returns a PNG data URL.

// ── Level map (2026-09-28) ─────────────────────────────────────────────────────
// A top-down diorama per world with the road running through the level nodes.
// Map px ↔ ground: X = (px - W/2)/S, Z = (py - H/2)/(S·cos TILT) (the tilted
// ortho camera maps ground z linearly to screen y). Same light and tilt as the
// verges and the vehicles, so the map is the same toy world.
const MAP_THEME = {
  world1: { ground: ['#6FB24E', '#86C763'], road: 0x5B5F6E, kerb: 0xEDE7D6, dash: 0xFFFFFF, pad: 0xE6DCC6, padEdge: 0x3F9A4E },
  world2: { ground: ['#9C978B', '#B1AC9F'], road: 0x4E525C, kerb: 0xF2C230, dash: 0xF2C230, pad: 0xC9C4B8, padEdge: 0xF2C230 },
  world3: { ground: ['#1E2340', '#2A3052'], road: 0x2B2F45, kerb: 0x39E6FF, dash: 0xFF4FD8, pad: 0x363C5C, padEdge: 0x39E6FF },
};

function ribbon(points, width, mat, y) {
  // points: [[X, Z], ...] world units; flat strip of `width` at height y.
  const pos = [], idx = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const nx = -dz * width / 2, nz = dx * width / 2;
    pos.push(p[0] + nx, y, p[1] + nz, p[0] - nx, y, p[1] - nz);
    if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  mat.side = THREE.DoubleSide;
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

function distToPolyline(p, pts) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz || 1;
    let t = ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / L2;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vz)));
  }
  return best;
}

function buildMap(theme, seed, { W, H, S, road, nodes }) {
  const T = MAP_THEME[theme], r = rng(seed * 131 + 7);
  const cz = Math.cos(TILT);
  const toW = ([x, y]) => [(x - W / 2) / S, (y - H / 2) / (S * cz)];
  const Wu = W / S, Lu = H / (S * cz);
  const g = new THREE.Group();
  const tex = noiseTex(T.ground[0], T.ground[1], seed, 2600);
  tex.repeat.set(Wu / 5, Lu / 5);
  g.add(slab(Wu + 4, Lu + 8, std(0xffffff, 0.95, { map: tex }), 0, 0));
  const path = road.map(toW);
  const roadW = 30 / S;
  g.add(ribbon(path, roadW + 0.5, theme === 'world3' ? basic(T.kerb) : std(T.kerb, 0.7), 0.03));
  g.add(ribbon(path, roadW, std(T.road, 0.85), 0.05));
  // Centre dashes along the path.
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let d = 0; d < L; d += 0.1) {
      acc += 0.1;
      if (acc % 1.6 < 0.8) continue;
      const t = d / L, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.01, 0.1), theme === 'world3' ? basic(T.dash) : std(T.dash, 0.6));
      m.position.set(x, 0.07, z);
      g.add(m);
    }
  }
  // Plots under the repair buildings.
  const plots = nodes.map(n => toW([n.plotX, n.plotY + 14]));
  for (const [x, z] of plots) {
    g.add(rbox(2.9, 0.08, 2.4, 0.3, std(T.padEdge, 0.7), x, 0.04, z));
    g.add(rbox(2.6, 0.1, 2.1, 0.25, std(T.pad, 0.9), x, 0.06, z));
  }
  // Node pads (round) under the level buttons.
  for (const n of nodes) {
    const [x, z] = toW([n.x, n.y]);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.55, 0.1, 40), std(T.pad, 0.85));
    pad.scale.z = 1 / cz;
    pad.position.set(x, 0.07, z);
    g.add(pad);
  }
  // Props: rejection-sampled away from the road, plots and nodes.
  const nodesW = nodes.map(n => toW([n.x, n.y]));
  const clear = (x, z, rad) => distToPolyline([x, z], path) > roadW / 2 + rad + 0.3
    && plots.every(([px, pz]) => Math.hypot(px - x, pz - z) > 2.2 + rad)
    && nodesW.every(([px, pz]) => Math.hypot(px - x, pz - z) > 1.9 + rad);
  const placed = [];
  const free = (x, z, rad) => placed.every(([a, b, rr]) => Math.hypot(a - x, b - z) > rr + rad);
  for (let k = 0; k < 900 && placed.length < 70; k++) {
    const x = (r() - 0.5) * (Wu + 1), z = (r() - 0.5) * (Lu + 2);
    const p = r();
    let obj = null, rad = 0.6;
    if (theme === 'world1') {
      if (p < 0.55) { rad = 0.7; obj = tree(x, z, 0.75 + r() * 0.35, r); }
      else if (p < 0.8) { rad = 0.6; obj = bush(x, z, 0.9, r); }
      else { rad = 0.6; obj = flowers(x, z, r); }
    } else if (theme === 'world2') {
      if (p < 0.35) { rad = 1.6; obj = container(x, z, r); obj.rotation.y = r() < 0.5 ? 0 : Math.PI / 2; }
      else if (p < 0.65) { rad = 0.6; obj = new THREE.Group(); const dc = [0x2F8CFF, 0xE0574A, 0x2FA36B][Math.floor(r() * 3)]; obj.add(drum(-0.3, 0, dc), drum(0.25, 0.15, dc)); obj.position.set(x, 0, z); }
      else if (p < 0.85) { rad = 0.35; obj = cone(x, z); }
      else { rad = 0.9; obj = tree(x, z, 0.65, r, [0x6E8B4E, 0x7C9A57, 0x5F7A45]); }
    } else {
      if (p < 0.45) { rad = 0.4; obj = lampPost(x, z, true); obj.scale.setScalar(0.7); }
      else if (p < 0.8) { rad = 1.4; obj = tower(x, z, 1.8 + r() * 0.6, 1.6 + r() * 0.5, 0.9 + r() * 0.9, r); }
      else { rad = 0.7; obj = tree(x, z, 0.7, r, [0x2F6B6A, 0x3A7C7A, 0x285E5D]); }
    }
    if (!clear(x, z, rad) || !free(x, z, rad)) continue;
    placed.push([x, z, rad]);
    g.add(obj);
  }
  return g;
}

// A repair building on its plot: 2 = repaired, 1 = scaffolding, 0 = rubble.
function buildRepair(theme, state, variant) {
  const r = rng(variant * 977 + (theme === 'world2' ? 3 : theme === 'world3' ? 5 : 1));
  const g = new THREE.Group();
  let full;
  if (theme === 'world1') { house.k = [0, 1, 2][variant % 3]; full = house(0, 0, 2.3, 1.9, r); }   // k+1 → roof purple / orange / brick
  else if (theme === 'world2') full = warehouse(0, 0, 2.4, 1.9, r);
  else full = tower(0, 0, 2.2, 1.8, 2.2 + (variant % 3) * 0.4, r);
  if (state === 2) { g.add(full); return g; }
  // Wall colour of the full building, for the broken versions.
  let wallMat = std(0xCFC6B8, 0.85);
  full.traverse(o => { if (o.isMesh && o.geometry?.type === 'BoxGeometry' && !wallMat.__set) { wallMat = o.material; wallMat.__set = true; } });
  const H = theme === 'world3' ? 1.6 : 1.3;
  if (state === 1) {
    g.add(rbox(2.2, H * 0.6, 1.8, 0.06, wallMat, 0, H * 0.3, 0));
    const pole = std(0xF0A020, 0.6), plank = std(0xB07A3A, 0.8);
    for (const x of [-1.2, 1.2]) for (const z of [-1.0, 1.0]) g.add(rbox(0.07, H * 1.2, 0.07, 0.02, pole, x, H * 0.6, z));
    for (const y of [H * 0.45, H * 0.95]) {
      g.add(rbox(2.5, 0.06, 0.08, 0.02, pole, 0, y, 1.0), rbox(2.5, 0.06, 0.08, 0.02, pole, 0, y, -1.0));
      g.add(rbox(2.4, 0.05, 0.3, 0.02, plank, 0, y + 0.05, 1.12));
    }
    g.add(rbox(0.5, 0.5, 0.5, 0.05, std(0x8A6A45, 0.9), 0.9, 0.25, 1.3));   // crate
    return g;
  }
  // Rubble: a broken wall stub and a heap of blocks.
  g.add(rbox(0.9, H * 0.55, 0.2, 0.04, wallMat, -0.6, H * 0.27, -0.7));
  for (let i = 0; i < 14; i++) {
    const s = 0.25 + r() * 0.35;
    const b = rbox(s, s * 0.6, s * 0.8, 0.05, i % 3 ? wallMat : std(0x8A8378, 0.9), (r() - 0.5) * 2.0, s * 0.3 + r() * 0.2, (r() - 0.5) * 1.6);
    b.rotation.set(r() * 0.6, r() * 3, r() * 0.6);
    g.add(b);
  }
  g.add(cone(1.1, 1.0));
  return g;
}

window.studio = {
  types: Object.keys(BUILD),
  colors: Object.keys(PALETTE),
  vehicle(type, color, { pxPerUnit = 110, outline = 3, variant = null, hd = true } = {}) {
    const obj = place((hd ? BUILD_HD : BUILD)[type](PALETTE[color]));
    obj.scale.set(...((hd ? CHUNK_HD : CHUNK)[type] ?? [1, 1, 1]));
    // Frame on the BASE vehicle, then decorate: a variant keeps the base sprite's
    // canvas size and body position, so the game can swap between them freely.
    const { W, H } = frame(obj, pxPerUnit, outline + 10);
    renderer.setSize(W * SS, H * SS, false);
    if (variant) {
      const deco = new THREE.Group();
      VARIANT[variant](deco, type, PALETTE[color]);
      deco.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      obj.add(deco);
    }
    const out = compose(renderPasses(obj, W, H), W, H, outline);
    clearObj(obj);
    return out.toDataURL('image/png');
  },
  variants: Object.keys(VARIANT),
  // Boss vehicle. Returns { url, panel } — panel is the roof light panel's
  // rectangle as fractions of the image (cx, cy, w, h), for the game's overlay.
  boss({ pxPerUnit = 92, outline = 6, armored = false } = {}) {
    const obj = place(buildBossHD({ armored }));
    const { W, H } = frame(obj, pxPerUnit, outline + 10);
    obj.updateMatrixWorld(true);
    const inv = camera.matrixWorldInverse;
    const P = { ...BOSS_PANEL_HD, y: BOSS_PANEL_HD.y + 0.02 };
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
      const p = new THREE.Vector3(P.x + dx * P.w / 2, P.y + 0.05, P.z + dz * P.d / 2).applyMatrix4(obj.matrixWorld).applyMatrix4(inv);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    const fx = (x) => (x - camera.left) / (camera.right - camera.left);
    const fy = (y) => (camera.top - y) / (camera.top - camera.bottom);
    const panel = { cx: (fx(x0) + fx(x1)) / 2, cy: (fy(y0) + fy(y1)) / 2, w: fx(x1) - fx(x0), h: fy(y0) - fy(y1) };
    const out = compose(renderPasses(obj, W, H), W, H, outline);
    clearObj(obj);
    return { url: out.toDataURL('image/png'), panel, W, H };
  },
  // Square canvas; the ball's diameter lands at `ballFrac` of the side.
  bomb(color, { px = 256, ballFrac = 0.715, outline = 5 } = {}) {
    const obj = place(buildBomb(PALETTE[color]));
    const pxPerUnit = (ballFrac * px - 2 * outline) / 2;
    frame(obj, pxPerUnit, 0, px);
    // Centre the frame on the BALL (not the fuse), so it sits in its socket.
    const ballC = new THREE.Vector3(0, 1, 0).applyMatrix4(camera.matrixWorldInverse);
    const hw = px / pxPerUnit / 2;
    Object.assign(camera, { left: ballC.x - hw, right: ballC.x + hw, top: ballC.y + hw, bottom: ballC.y - hw });
    camera.updateProjectionMatrix();
    const out = compose(renderPasses(obj, px, px), px, px, outline, false);
    clearObj(obj);
    return out.toDataURL('image/png');
  },
  // Side verge strip, `px` wide; tiles vertically in game. `Wu` = strip width in
  // world units — sets scenery scale relative to the cars. The strip is only
  // ~50-65 px wide in game, so a narrow world width keeps houses big enough to
  // read (a house ≈ 1.2 car widths).
  verge(world, side, seed, { px = 256, Wu = 4.6, heightPx = 1024 } = {}) {
    house.k = undefined;
    setLight(WORLD[world].light);
    const Hu = Wu * heightPx / px;
    const Lu = Hu / Math.cos(TILT);                 // ground length visible in frame
    const obj = place(buildVerge(world, side, seed, Wu, Lu));
    const pxPerUnit = px / Wu;
    camera.position.set(0, Math.cos(TILT) * 30, Math.sin(TILT) * 30);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    Object.assign(camera, { left: -Wu / 2, right: Wu / 2, top: Hu / 2, bottom: -Hu / 2 });
    camera.updateProjectionMatrix();
    renderer.setSize(px, heightPx, false);
    ground.visible = false;
    key.shadow.camera.left = -Lu; key.shadow.camera.right = Lu; key.shadow.camera.top = Lu; key.shadow.camera.bottom = -Lu;
    key.shadow.camera.updateProjectionMatrix();
    const out = snapshot(px, heightPx);
    Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    key.shadow.camera.updateProjectionMatrix();
    ground.visible = true;
    clearObj(obj);
    setLight(DEFAULT_LIGHT);
    return out.toDataURL('image/png');
  },
  // App icon subject (transparent): a big red bomb, fuse lit, in front of a
  // blue toy sedan heading at the viewer. Composited onto the plum tile by
  // scripts/render-app-icons.mjs.
  appIcon({ px = 1024, outline = 14 } = {}) {
    const g = new THREE.Group();
    const car = BUILD.big(PALETTE.Blue);
    car.scale.set(1.2, 1.05, 0.9);
    car.rotation.y = 0.32;
    car.position.set(0.75, 0, -1.1);
    const bomb = buildBomb(PALETTE.Red);
    bomb.scale.setScalar(1.5);
    bomb.position.set(-0.35, 0, 0.9);
    // A starburst spark (rays + hot core) reads at launcher size; the round
    // in-game spark would read as a blob.
    bomb.traverse(o => { if (o.isMesh && o.material === M.spark) o.visible = false; });
    const burst = new THREE.Group();
    const rayM = new THREE.MeshBasicMaterial({ color: 0xFFC53A });
    for (let i = 0; i < 8; i++) {
      const ray = rbox(0.07, 0.07, i % 2 ? 0.34 : 0.52, 0.03, rayM);
      ray.position.z = (i % 2 ? 0.34 : 0.52) / 2;
      const arm = new THREE.Group();
      arm.add(ray);
      arm.rotation.y = (i / 8) * Math.PI * 2;
      burst.add(arm);
    }
    burst.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: 0xFFFBE6 })));
    burst.rotation.x = TILT;                        // rays lie in a plane facing the camera
    burst.position.set(0.84, 2.4, -0.42);
    bomb.add(burst);
    g.add(car, bomb);
    const obj = place(g);
    burst.traverse(o => { o.castShadow = false; });   // light, not a solid — no shadow
    const box = new THREE.Box3().setFromObject(obj);
    const span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    frame(obj, (px - 2 * (outline + 20)) / (span * 1.1), outline + 20, px);
    const W = renderer.domElement.width, H = renderer.domElement.height;
    const out = compose(renderPasses(obj, W, H), W, H, outline, true);
    clearObj(obj);
    return out.toDataURL('image/png');
  },
  // Square booster icon, subject fitted with a margin for the outline.
  icon(name, { px = 160, outline = 5 } = {}) {
    const obj = place(ICONS[name]());
    const box = new THREE.Box3().setFromObject(obj);
    const span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z, box.max.y - box.min.y);
    const pxPerUnit = (px - 2 * (outline + 8)) / (span * 1.05);
    frame(obj, pxPerUnit, outline + 8);
    const W = renderer.domElement.width, H = renderer.domElement.height;
    const out = compose(renderPasses(obj, W, H), W, H, outline, false);
    clearObj(obj);
    return out.toDataURL('image/png');
  },
  // Level-map background for one world page (W×H map px at `scale`×).
  map(theme, seed, { W = 390, H = 844, S = 22, scale = 2, road, nodes } = {}) {
    // HD diorama (mapdiorama.js): the gameplay backdrop's props and sun.
    const plots = nodes.map(n => [n.plotX, n.plotY + 14]);
    const c = renderMapHD(renderer, theme, seed, { W, H, S, road, nodes, plots, tilt: TILT, scale });
    return c.toDataURL('image/png');
  },
  // One repair building sprite, framed at a fixed scale so all states align.
  repair(theme, state, variant, { S = 22, scale = 2, px = 150 } = {}) {
    const c = renderRepairHD(renderer, theme, state, variant, { S, scale, px, tilt: TILT });
    return c.toDataURL('image/png');
  },
  // Full gameplay backdrop (road, verges, depot) for one world/variant/lane
  // count. L comes from projection.js via the driver; returns a JPEG data URL.
  backdrop(world, variant, L, { scale = 2, ss = 2, quality = 0.9 } = {}) {
    const c = renderBackdrop(renderer, world, variant, { ...L, tilt: TILT }, { scale, ss });
    return c.toDataURL('image/jpeg', quality);
  },
  // Title key art (title.js), 390×844 stage at `scale`×. PNG data URL.
  title({ scale = 2 } = {}) {
    return renderTitle(renderer, { tilt: TILT, scale }).toDataURL('image/png');
  },
  ready: true,
};
