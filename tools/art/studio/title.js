// Title key art — the same toy town as gameplay and the map, staged for the
// title screen: a street crossing the screen where the intro car drives and
// the bomb drops (TitleScreen: carY = 0.455·H), a row of full townhouses above
// it (the logo sits over their roofs), and a café plaza with a fountain below
// (under the round menu buttons).
//
// Map px ↔ ground exactly as the map diorama: X = (px − W/2)/S,
// Z = (py − H/2)/(S·cos tilt).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  THEME, rng, pick, mix, std, glow, rbox, box, cyl, blob, plane, canvas, toTex, speckle, blotch,
  paverTexture, grassTexture, tree, pine, bush, flowerBed, lamp, bench, hydrant, bollard, bin, planterPot, parasol,
  townHouse,
} from './backdrop.js';
import { BUILD_HD } from './vehicles-hd.js';

function streetTexture(pxu, wU, dU, r) {
  // Horizontal two-lane street: asphalt, white edge lines, dashed centre line.
  const W = Math.round(wU * pxu), H = Math.round(dU * pxu);
  const [c, x] = canvas(W, H);
  x.fillStyle = '#575A63'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 20; i++) blotch(x, r() * W, r() * H, 40 + r() * 90, r() < 0.5 ? 0x62656F : 0x4C4F57, 0.1);
  speckle(x, W, H, r, Math.floor(W * H * 0.02), ['#9A9CA3', '#45474D', '#B5B7BD'], 0.5, 1.4, 0.15, 0.5);
  x.fillStyle = '#F4F1E6';
  x.fillRect(0, H * 0.1, W, pxu * 0.12); x.fillRect(0, H * 0.9 - pxu * 0.12, W, pxu * 0.12);
  for (let xx = 0; xx < W; xx += pxu * 2.2) x.fillRect(xx, H / 2 - pxu * 0.07, pxu * 1.2, pxu * 0.14);
  return toTex(c);
}

function fountain(r) {
  const g = new THREE.Group();
  const stone = std(0xE6DCC8, 0.7), dark = std(0xB9AD96, 0.8);
  g.add(cyl(1.35, 1.45, 0.34, stone, 0, 0.17, 0, 40));
  g.add(cyl(1.2, 1.2, 0.3, std(0x3FA9E0, 0.08, { metalness: 0.3, emissive: 0x1D6FA8, emissiveIntensity: 0.25 }), 0, 0.2, 0, 40));
  g.add(cyl(0.18, 0.24, 0.9, dark, 0, 0.6, 0, 16));
  g.add(cyl(0.62, 0.5, 0.14, stone, 0, 1.02, 0, 32));
  g.add(cyl(0.54, 0.54, 0.1, std(0x5FC0F0, 0.08, { metalness: 0.3 }), 0, 1.06, 0, 32));
  g.add(cyl(0.08, 0.12, 0.5, dark, 0, 1.3, 0, 12));
  const jet = blob(0.16, std(0xDFF4FF, 0.1, { transparent: true, opacity: 0.8 }), r, 1, 0.2);
  jet.position.y = 1.62; g.add(jet);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const d = blob(0.08, std(0xDFF4FF, 0.1, { transparent: true, opacity: 0.7 }), r, 0, 0.3);
    d.position.set(Math.cos(a) * 0.5, 0.95, Math.sin(a) * 0.5); g.add(d);
  }
  return g;
}

function cafeTable(r, cols) {
  const g = new THREE.Group();
  const p = parasol(r, cols);
  g.add(p);
  for (const a of [0, Math.PI]) {
    const ch = rbox(0.22, 0.26, 0.22, 0.04, std(0xF2EEE6, 0.5), Math.cos(a) * 0.45, 0.13, Math.sin(a) * 0.45);
    g.add(ch);
  }
  return g;
}

function vehicle(type, color, scale = 1) {
  const v = BUILD_HD[type](color);
  v.scale.setScalar(scale);
  return v;
}

export function buildTitle({ W, H, S, tilt }) {
  const T = THEME.world1, r = rng(4242);
  const cT = Math.cos(tilt);
  const toW = ([x, y]) => [(x - W / 2) / S, (y - H / 2) / (S * cT)];
  const Wu = W / S, Lu = H / (S * cT);
  const g = new THREE.Group();
  const pxu = 48;

  // Ground: plaza pavers everywhere, lawn beds on the margins.
  g.add(plane(Wu + 6, Lu + 8, std(0xffffff, 0.9, { map: paverTexture(T.walk, T.walkJoint, pxu, Wu + 6, Lu + 8, r, { tile: 0.55, style: 'brick' }) }), 0, 0, 0));

  // The street — centred on the intro car's line (0.455·H).
  const roadY = H * 0.455, roadH = 118;
  const [, zr] = toW([W / 2, roadY]);
  const dU = roadH / S;                            // ground depth in game units
  g.add(plane(Wu + 6, dU / cT, std(0xffffff, 0.85, { map: streetTexture(pxu, Wu + 6, dU, r) }), 0, 0.02, zr));
  for (const s of [-1, 1]) {
    const kz = zr + s * (dU / cT / 2 + 0.12);
    g.add(rbox(Wu + 6, 0.16, 0.26, 0.04, std(0xDCD4C4, 0.7), 0, 0.08, kz));
  }
  // Zebra crossings at both ends of the street.
  for (const cx of [-Wu / 2 + 1.6, Wu / 2 - 1.6]) {
    for (let i = 0; i < 6; i++) {
      const z = zr - dU / cT / 2 + 0.35 + i * (dU / cT - 0.7) / 5;
      g.add(box(1.5, 0.012, 0.28, std(0xF4F1E6, 0.6), cx, 0.03, z));
    }
  }
  // Parked toy cars in the far lane, clear of the intro car's path (near lane).
  const parked = [['big', 0xFF3D3D, -Wu / 2 + 3.4], ['jeep', 0xFFD42A, Wu / 2 - 3.2]];
  for (const [type, col, x] of parked) {
    const v = vehicle(type, col, 0.62);
    v.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    v.position.set(x, 0.02, zr - dU / cT * 0.22);
    g.add(v);
  }

  // North side: sidewalk furniture then a row of FULL townhouses.
  const [, zTopWalk] = toW([W / 2, roadY - roadH / 2 - 14]);
  for (let i = 0; i < 5; i++) {
    const x = -Wu / 2 + 1.4 + i * (Wu - 2.8) / 4;
    const t = tree(T, r, 1.2); t.position.set(x + 0.6, 0.02, zTopWalk - 0.2); g.add(t);
    if (i % 2 === 0) { const l = lamp(T, r, false, 1); l.position.set(x - 0.7, 0.02, zTopWalk + 0.1); g.add(l); }
  }
  const houses = [
    { roof: 0xB5654A, wall: 0xF3E6CF, style: 'pitched' },
    { roof: 0x6F7F90, wall: 0xE6E9EC, style: 'pitched' },
    { roof: 0x8A9A84, wall: 0xEFDCC0, style: 'flat', kit: 0.9 },
    { roof: 0xBC8456, wall: 0xF4E4CC, style: 'pitched' },
  ];
  const [, zRow] = toW([W / 2, roadY - roadH / 2 - 92]);
  for (let i = 0; i < 4; i++) {
    const w = 3.6, d = 2.8, h = 1.9 + (i % 2) * 0.4;
    const x = -Wu / 2 + 2.1 + i * (Wu - 4.2) / 3;
    const hs = townHouse(T, rng(900 + i * 17), w, d, h, 1, houses[i]);
    hs.position.set(x, 0.02, zRow);
    g.add(hs);
    const aw = new THREE.Group();
    const cols = [[0xE8453C, 0xFFFFFF], [0x2F8CFF, 0xFFFFFF], [0x2FA36B, 0xFFFFFF], [0xFFB02E, 0xFFFFFF]][i];
    for (let k = 0; k < 7; k++) aw.add(box(w / 7, 0.03, 0.6, std(k % 2 ? cols[1] : cols[0], 0.6), -w / 2 + (k + 0.5) * w / 7, 0, 0));
    aw.rotation.x = 0.35;
    aw.position.set(x, 1.1, zRow + d / 2 + 0.28);
    g.add(aw);
  }
  // Back row (under the logo): big trees and roofs peeking out.
  const [, zBack] = toW([W / 2, 120]);
  for (let i = 0; i < 7; i++) {
    const t = (i % 2 ? pine : tree)(T, r, 1.5 + r() * 0.4);
    t.position.set(-Wu / 2 + 0.8 + i * (Wu - 1.6) / 6, 0.02, zBack + (r() - 0.5) * 2);
    g.add(t);
  }
  for (let i = 0; i < 3; i++) {
    const hs = townHouse(T, rng(700 + i * 5), 3.2, 2.6, 2.3, 1, { style: 'pitched', roof: [0x7A8896, 0xA65A42, 0x8A9A84][i] });
    hs.position.set(-Wu / 2 + 3 + i * (Wu - 6) / 2, 0.02, zBack - 3.2);
    g.add(hs);
  }

  // South side: sidewalk, café, flower beds, fountain plaza.
  const [, zBotWalk] = toW([W / 2, roadY + roadH / 2 + 14]);
  for (let i = 0; i < 4; i++) {
    const x = -Wu / 2 + 1.8 + i * (Wu - 3.6) / 3;
    if (i === 1 || i === 2) { const b = bollard(); b.position.set(x, 0.02, zBotWalk); g.add(b); continue; }
    const t = tree(T, r, 1.1); t.position.set(x, 0.02, zBotWalk + 0.2); g.add(t);
  }
  const [, zCafe] = toW([W / 2, roadY + roadH / 2 + 190]);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const ct = cafeTable(r, pick(r, T.awnings));
      ct.position.set(s * (Wu / 2 - 1.6 - k * 1.8), 0.02, zCafe + (k - 0.5) * 2.2);
      g.add(ct);
    }
    const fb = flowerBed(T, r, 1.6, 0.8); fb.position.set(s * (Wu / 2 - 1.3), 0.02, zCafe + 4.2); g.add(fb);
    const pp = planterPot(T, r, 1.3); pp.position.set(s * 2.4, 0.02, zCafe - 2.2); g.add(pp);
  }
  const [, zFount] = toW([W / 2, H * 0.86]);
  const f = fountain(r); f.scale.setScalar(1.25); f.position.set(0, 0.02, zFount); g.add(f);
  // A ring of low hedges around the fountain.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    if (Math.abs(Math.sin(a)) > 0.9 && Math.cos(a) > -0.2) continue;   // gap toward the viewer
    const b = bush(T, r, 1.1);
    b.position.set(Math.cos(a) * 2.6, 0.02, zFount + Math.sin(a) * 2.6 / cT);
    g.add(b);
  }
  for (const s of [-1, 1]) {
    const bn = bench(r); bn.position.set(s * 3.6, 0.02, zFount); bn.rotation.y = s > 0 ? Math.PI : 0; g.add(bn);
    const t = tree(T, r, 1.4); t.position.set(s * (Wu / 2 - 0.9), 0.02, zFount + 1.5); g.add(t);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = !o.material.isMeshBasicMaterial; o.receiveShadow = true; } });
  return g;
}

export function renderTitle(renderer, { W = 390, H = 844, S = 22, tilt, scale = 2, ss = 2 } = {}) {
  const T = THEME.world1;
  const cT = Math.cos(tilt);
  const Wu = W / S, Hu = H / S, Lu = H / (S * cT);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = T.sun.env;
  scene.add(new THREE.HemisphereLight(T.sun.hemi[0], T.sun.hemi[1], T.sun.hemi[2]));
  const sun = new THREE.DirectionalLight(T.sun.color, T.sun.intensity);
  sun.position.set(-7, 10, 4).multiplyScalar(4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 2; sun.shadow.blurSamples = 12;
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02;
  const span = Math.max(Wu, Lu) * 0.62;
  Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 160 });
  scene.add(sun, sun.target);
  const obj = buildTitle({ W, H, S, tilt });
  scene.add(obj);
  const camera = new THREE.OrthographicCamera(-Wu / 2, Wu / 2, Hu / 2, -Hu / 2, 0.1, 400);
  camera.position.set(0, Math.cos(tilt) * 120, Math.sin(tilt) * 120);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  const prev = { tm: renderer.toneMapping, exp: renderer.toneMappingExposure };
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = T.sun.exposure;
  renderer.setClearColor(0x000000, 1);
  renderer.setSize(W * scale * ss, H * scale * ss, false);
  renderer.render(scene, camera);
  const [c, x] = canvas(W * scale, H * scale);
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(renderer.domElement, 0, 0, W * scale, H * scale);
  renderer.toneMapping = prev.tm; renderer.toneMappingExposure = prev.exp;
  renderer.setClearColor(0x000000, 0);
  obj.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.map?.dispose?.(); o.material.dispose?.(); } });
  pmrem.dispose();
  return c;
}
