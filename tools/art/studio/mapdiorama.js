// Map diorama — the level-map pages and the city-repair buildings, built from
// the SAME detailed props, textures and sun as the gameplay backdrops
// (backdrop.js), so the map reads as the same toy world at a wider zoom.
//
// Map px ↔ ground: X = (px − W/2)/S, Z = (py − H/2)/(S·cos tilt) — the tilted
// orthographic camera projects ground Z back by cos(tilt), so node and plot
// pixel positions from levelMapLayout.js land exactly where the Pixi screen
// draws the nodes and buildings.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  THEME, rng, pick, mix, std, glow, rbox, box, cyl, blob, plane, canvas, toTex, speckle, blotch,
  paverTexture, grassTexture, tree, pine, bush, flowerBed, lamp, bench, bollard, planterPot,
  townHouse, warehouse, shippingContainer, drum, pallet, cone, fence, tower, neonSign,
  FAMILY, greenery, bedFor, potFor, townOpts, starTexture, cactus, rockCluster, snowDrift, frostPine,
} from './backdrop.js';

const NEW_WORLD = (w) => Number(w.slice(5)) > 3;
const HEDGE = { world1: 0x3F8F3E, world4: 0xD8B27C, world5: 0xF2F7FB };
const WALL = { world1: 0xEFDCC0, world2: 0xC9C4BA, world3: 0x3E4258, world4: 0xF0D2A0, world5: 0xA8744A, world6: 0xC9D3DC, world7: 0x3E3066 };

function ribbon(points, width, mat, y, uvLen = 0) {
  const pos = [], idx = [], uv = [];
  let acc = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    if (i > 0) acc += Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]);
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const nx = -dz * width / 2, nz = dx * width / 2;
    pos.push(p[0] + nx, y, p[1] + nz, p[0] - nx, y, p[1] - nz);
    const v = uvLen ? acc / uvLen : 0;
    uv.push(0, v, 1, v);
    if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
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
// Asphalt strip texture for the map road (U across, V along; repeats along V).
function roadStripTexture(T, world, r) {
  const W = 128, H = 256;
  const [c, x] = canvas(W, H);
  x.fillStyle = '#' + T.asphalt.toString(16).padStart(6, '0'); x.fillRect(0, 0, W, H);
  speckle(x, W, H, r, 1600, FAMILY[world] === 'night' ? ['#4A4F66', '#1C1E28'] : ['#8A8C92', '#3E4046'], 0.5, 1.3, 0.2, 0.5);
  // Edge lines + centre dash.
  x.fillStyle = NEW_WORLD(world) ? T.paint : world === 'world2' ? '#F2F0EA' : world === 'world3' ? '#4FE3FF' : '#F4F1E6';
  x.fillRect(8, 0, 6, H); x.fillRect(W - 14, 0, 6, H);
  x.fillStyle = NEW_WORLD(world) ? T.centre : world === 'world2' ? '#FFC21A' : world === 'world3' ? '#FF3DB8' : '#F4F1E6';
  x.fillRect(W / 2 - 3, 0, 6, H * 0.5);
  return toTex(c);
}

export function buildMapHD(theme, seed, { W, H, S, road, nodes, plots, tilt }) {
  const T = THEME[theme], r = rng(seed * 131 + 7 + theme.length + (NEW_WORLD(theme) ? Number(theme.slice(5)) * 977 : 0));
  const cT = Math.cos(tilt);
  const toW = ([x, y]) => [(x - W / 2) / S, (y - H / 2) / (S * cT)];
  const Wu = W / S, Lu = H / (S * cT);
  const g = new THREE.Group();
  const fam = FAMILY[theme];
  const night = fam === 'night';
  const accent = theme === 'world3' ? 0x4FE3FF : theme === 'world7' ? 0xA35CFF : null;

  // Ground.
  let groundMat;
  if (theme === 'world1') groundMat = std(0xffffff, 0.95, { map: grassTexture([0x6FBF55, 0x5DAE47], 40, Wu + 6, Lu + 10, r) });
  else if (fam === 'town') groundMat = std(0xffffff, 0.95, { map: grassTexture(T.lawn, 40, Wu + 6, Lu + 10, r) });
  else if (theme === 'world6') groundMat = std(0xffffff, 0.9, { map: paverTexture(T.depot, T.depotJoint, 40, Wu + 6, Lu + 10, r, { tile: 1.6 }) });
  else if (theme === 'world7') groundMat = std(0xffffff, 0.8, { map: starTexture(Wu + 6, Lu + 10, r, 14) });
  else if (theme === 'world2') groundMat = std(0xffffff, 0.9, { map: paverTexture([0x9A9DA2, 0x93969B, 0xA2A5AA], '#7E8187', 40, Wu + 6, Lu + 10, r, { tile: 1.6 }) });
  else groundMat = std(0xffffff, 0.6, { map: paverTexture([0x262A3C, 0x2A2F44, 0x232738], '#191B26', 40, Wu + 6, Lu + 10, r, { tile: 1.2 }), metalness: 0.2 });
  g.add(plane(Wu + 6, Lu + 10, groundMat, 0, 0, 0));
  if (theme === 'world1') {
    // Mowing stripes + a few darker meadow patches.
    for (let i = 0; i < 14; i++) {
      const [c, x] = canvas(8, 8); x.fillStyle = '#000'; x.fillRect(0, 0, 8, 8);
      const m = plane(0.9 + r() * 2.4, 0.9 + r() * 2.4, new THREE.MeshBasicMaterial({ color: 0x3E8A3A, transparent: true, opacity: 0.12, depthWrite: false }), (r() - 0.5) * Wu, 0.005, (r() - 0.5) * Lu);
      m.receiveShadow = false; g.add(m);
    }
  }

  // Road: kerb ribbon + asphalt ribbon with markings.
  const path = road.map(toW);
  const roadW = 30 / S;
  let pathLen = 0; for (let i = 1; i < path.length; i++) pathLen += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  const kerbCol = NEW_WORLD(theme) ? (theme === 'world6' ? 0xFF8A1C : T.kerb) : theme === 'world2' ? 0xFFC21A : theme === 'world3' ? 0x4A4E62 : 0xE8E1D2;
  g.add(ribbon(path, roadW + 0.55, std(kerbCol, 0.7), 0.04));
  const rt = roadStripTexture(T, theme, r);
  rt.repeat.set(1, 1);
  g.add(ribbon(path, roadW, std(0xffffff, night ? 0.4 : 0.85, { map: rt, metalness: night ? 0.2 : 0 }), 0.06, roadW * 2));
  if (night) g.add(ribbon(path, roadW + 0.7, new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.25, depthWrite: false }), 0.035));

  // Node plazas (round, paved) and building plots (paved lot, low hedge / fence).
  const pavTex = paverTexture(T.walk, T.walkJoint, 60, 3.4, 3.4, r, { tile: 0.42 });
  for (const n of nodes) {
    const [x, z] = toW([n.x, n.y]);
    const rim = cyl(1.36, 1.42, 0.1, std(accent ?? kerbCol, 0.6, accent ? { emissive: accent, emissiveIntensity: 0.6 } : {}), x, 0.05, z, 44);
    rim.scale.z = 1 / cT; g.add(rim);
    const pad = cyl(1.26, 1.26, 0.13, std(0xffffff, 0.85, { map: pavTex }), x, 0.08, z, 44);
    pad.scale.z = 1 / cT; g.add(pad);
  }
  // Building lots: world1 a mown garden with a low hedge; world2 a concrete
  // pad with a painted edge; world3 a dark pad with a neon rim.
  const plotW = 2.75, plotD = 1.95;
  for (const [x, z] of plots.map(toW)) {
    const zc = z + 0.15;
    if (fam === 'town') {
      const lotCols = theme === 'world1' ? [0x86CF62, 0x78C257] : T.lawn;
      g.add(plane(plotW, plotD / cT, std(0xffffff, 0.95, { map: grassTexture(lotCols, 48, plotW, plotD, r) }), x, 0.02, zc));
      for (const [hw, hd, hx, hz] of [[plotW, 0.16, 0, -plotD / cT / 2], [0.16, plotD / cT, -plotW / 2, 0], [0.16, plotD / cT, plotW / 2, 0]]) {
        g.add(rbox(hw, 0.22, hd, 0.07, std(HEDGE[theme], 0.85), x + hx, 0.11, zc + hz));
      }
    } else {
      g.add(rbox(plotW + 0.14, 0.06, plotD / cT + 0.14, 0.06, accent ? glow(accent) : std(theme === 'world6' ? 0xFF8A1C : 0xFFC21A, 0.6), x, 0.03, zc));
      g.add(rbox(plotW, 0.08, plotD / cT, 0.06, std(theme === 'world3' ? 0x2E3246 : theme === 'world7' ? 0x30244F : theme === 'world6' ? 0x8E9CAA : 0xB5B8BD, 0.85), x, 0.05, zc));
    }
  }

  // Scatter dressing, rejection-sampled away from the road, plots and nodes.
  const nodesW = nodes.map(n => toW([n.x, n.y]));
  const plotsW = plots.map(toW);
  const clear = (x, z, rad) => distToPolyline([x, z], path) > roadW / 2 + rad + 0.35
    && plotsW.every(([px, pz]) => Math.abs(px - x) > plotW / 2 + rad + 0.2 || Math.abs(pz + 0.3 - z) > plotD / cT / 2 + rad + 0.2)
    && nodesW.every(([px, pz]) => Math.hypot(px - x, (pz - z) * cT) > 1.9 + rad);
  const placed = [];
  const free = (x, z, rad) => placed.every(([a, b, rr]) => Math.hypot(a - x, b - z) > rr + rad);
  const tryPut = (obj, x, z, rad) => {
    if (!clear(x, z, rad) || !free(x, z, rad)) return false;
    placed.push([x, z, rad]); obj.position.x = x; obj.position.z = z; g.add(obj); return true;
  };
  // Road-side furniture first (lamps / benches just off the kerb).
  for (let i = 3; i < path.length - 3; i += 7) {
    const a = path[i - 1], b = path[i + 1], p = path[i];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const side = r() < 0.5 ? 1 : -1;
    const ox = -dz * side * (roadW / 2 + 0.75), oz = dx * side * (roadW / 2 + 0.75);
    if (!free(p[0] + ox, p[1] + oz, 0.4)) continue;
    const item = r() < 0.6 ? lamp(T, r, night, 1) : (fam === 'yard' ? cone() : bench(r));
    item.scale.setScalar(0.85);
    if (!tryPut(item, p[0] + ox, p[1] + oz, 0.35)) continue;
  }
  const budget = fam === 'town' ? (theme === 'world1' ? 140 : 110) : fam === 'yard' ? 60 : 85;
  for (let k = 0; k < 3000 && placed.length < budget; k++) {
    const x = (r() - 0.5) * (Wu + 1), z = (r() - 0.5) * (Lu + 2);
    const p = r();
    let obj, rad;
    if (theme === 'world4' || theme === 'world5') {
      if (p < 0.5) { rad = 0.75; obj = greenery(theme, T, r, 0.95 + r() * 0.4); }
      else if (p < 0.68) { rad = 0.6; obj = bedFor(theme, T, r, 1.2, 0.8); }
      else if (p < 0.78) { rad = 0.45; obj = potFor(theme, T, r, 1.2); }
      else { rad = 1.5; obj = townHouse(T, r, 2.2, 1.8, 1.0 + r() * 0.5, 1, townOpts(theme)); }
    } else if (theme === 'world1') {
      if (p < 0.42) { rad = 0.75; obj = tree(T, r, 0.9 + r() * 0.35); }
      else if (p < 0.58) { rad = 0.6; obj = pine(T, r, 1 + r() * 0.3); }
      else if (p < 0.72) { rad = 0.5; obj = bush(T, r, 1.2); }
      else if (p < 0.82) { rad = 0.8; obj = flowerBed(T, r, 1.2, 0.8); }
      else if (p < 0.9) { rad = 0.45; obj = planterPot(T, r, 1.2); }
      else { rad = 1.5; obj = townHouse(T, r, 2.2, 1.8, 1.0 + r() * 0.5, 1); }
    } else if (fam === 'yard') {
      if (p < 0.34) {
        // A stacked container yard (2–3 boxes, some double-height).
        rad = 1.6; obj = new THREE.Group();
        const cols = [0x2F8CFF, 0xE8453C, 0x2FA36B, 0xFF8A1C, 0x6E7B88];
        const n = 2 + Math.floor(r() * 2);
        for (let k = 0; k < n; k++) { const c = shippingContainer(r, cols); c.position.set(-0.5 * (n - 1) + k * 1.0, 0, 0); obj.add(c); if (r() < 0.4) { const t2 = shippingContainer(r, cols); t2.position.set(-0.5 * (n - 1) + k * 1.0, 0.92, 0.1); obj.add(t2); } }
        if (r() < 0.5) obj.rotation.y = Math.PI / 2;
      }
      else if (p < 0.52) { rad = 2.0; obj = warehouse(T, r, 2.8, 2.2, 1.2 + r() * 0.5); }
      else if (p < 0.68) { rad = 0.75; obj = greenery(theme, T, r, 0.9); }
      else if (p < 0.8) { rad = 0.6; obj = new THREE.Group(); const dc = pick(r, [0x2F8CFF, 0xE0574A, 0x2FA36B, 0xFFC21A]); for (const [dx, dz] of [[-0.2, 0], [0.2, 0.1], [0, 0.4], [0.35, 0.45]]) { const d = drum(dc); d.position.set(dx, 0, dz); obj.add(d); } }
      else if (p < 0.9) { rad = 0.7; obj = new THREE.Group(); for (let k = 0; k < 2; k++) { const pl = pallet(r); pl.position.x = k * 0.85; obj.add(pl); } }
      else { rad = 0.5; obj = new THREE.Group(); for (let k = 0; k < 3; k++) { const c = cone(); c.position.x = k * 0.35; obj.add(c); } }
    } else {
      if (p < 0.18) { rad = 0.4; obj = lamp(T, r, true, 1); }
      else if (p < 0.6) { rad = 1.6; obj = tower(T, r, 2.0 + r() * 0.6, 1.8, 1.8 + r() * 2.4); }
      else if (p < 0.75) { rad = 0.7; obj = greenery(theme, T, r, 0.8); }
      else if (p < 0.88) { rad = 0.6; obj = neonSign(T, r, 1.0); }
      else { rad = 0.3; obj = bollard(0x4A4E62); }
    }
    tryPut(obj, x, z, rad);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = !o.material.isMeshBasicMaterial && o.material.opacity === 1; o.receiveShadow = true; } });
  return g;
}

// A repair building for its plot: 2 = repaired, 1 = scaffolding, 0 = rubble.
export function buildRepairHD(theme, state, variant) {
  const T = THEME[theme], r = rng(variant * 977 + state * 13 + theme.length * 7 + (NEW_WORLD(theme) ? Number(theme.slice(5)) * 131 : 0));
  const g = new THREE.Group();
  const w = 2.4, d = 1.9;
  const full = () => {
    if (theme === 'world4' || theme === 'world5') {
      const styles = theme === 'world4' ? [
        { style: 'flat', roof: 0xE08A44, wall: 0xF4DDB2, kit: 0.2 },
        { style: 'flat', roof: 0xD9683D, wall: 0xEBC993, kit: 0.5 },
        { style: 'pitched', roof: 0xD9683D, wall: 0xF7E7C9 },
      ] : [
        { style: 'pitched', roof: 0xF2F6FA, wall: 0xA8744A },
        { style: 'pitched', roof: 0xE4ECF4, wall: 0x9A6B45 },
        { style: 'pitched', roof: 0xF2F6FA, wall: 0xB98354 },
      ];
      const hs = townHouse(T, rng(variant * 31 + 5), w, d, 1.15, 1, styles[variant % 3]);
      const grp = new THREE.Group(); grp.add(hs);
      const fb = bedFor(theme, T, r, 0.9, 0.35); fb.position.set(-0.5, 0, d / 2 + 0.3); grp.add(fb);
      const t = greenery(theme, T, r, 0.75); t.position.set(w / 2 + 0.2, 0, -0.3); grp.add(t);
      return grp;
    }
    if (theme === 'world1') {
      const styles = [
        { style: 'pitched', roof: 0xB5654A, wall: 0xF3E6CF },
        { style: 'flat', roof: 0x8A9A84, wall: 0xEFDCC0, kit: 0.9 },
        { style: 'pitched', roof: 0x6F7F90, wall: 0xE6E9EC },
      ];
      const hs = townHouse(T, rng(variant * 31 + 5), w, d, 1.15, 1, styles[variant % 3]);
      const grp = new THREE.Group(); grp.add(hs);
      const fb = flowerBed(T, r, 0.9, 0.35); fb.position.set(-0.5, 0, d / 2 + 0.3); grp.add(fb);
      const t = tree(T, r, 0.75); t.position.set(w / 2 + 0.2, 0, -0.3); grp.add(t);
      return grp;
    }
    if (FAMILY[theme] === 'yard') return warehouse(T, rng(variant * 31 + 9), w, d, 1.1 + variant * 0.15);
    return tower(T, rng(variant * 31 + 3), 2.1, 1.8, 2.0 + (variant % 3) * 0.45);
  };
  if (state === 2) { g.add(full()); return g; }
  const wallMat = std(WALL[theme], 0.85);
  const Hh = FAMILY[theme] === 'night' ? 1.7 : 1.15;
  if (state === 1) {
    // Half-built: walls to mid-height, scaffold frame with planks, crates, a crane arm.
    g.add(rbox(w * 0.92, Hh * 0.62, d * 0.9, 0.04, wallMat, 0, Hh * 0.31, 0));
    for (let i = 0; i < 4; i++) g.add(box(0.28, 0.2, 0.02, std(0x3B5B86, 0.2), -w / 2 + 0.4 + i * 0.52, Hh * 0.35, d * 0.45 + 0.01));
    const pole = std(0xF0A020, 0.5, { metalness: 0.3 }), plank = std(0xB07A3A, 0.8);
    for (const x of [-w / 2 - 0.1, 0, w / 2 + 0.1]) for (const z of [-d / 2 - 0.1, d / 2 + 0.1]) g.add(box(0.06, Hh * 1.25, 0.06, pole, x, Hh * 0.62, z));
    for (const y of [Hh * 0.45, Hh * 0.95]) for (const z of [-d / 2 - 0.1, d / 2 + 0.1]) {
      g.add(box(w + 0.3, 0.05, 0.06, pole, 0, y, z));
      g.add(box(w + 0.2, 0.04, 0.26, plank, 0, y + 0.04, z + (z > 0 ? 0.1 : -0.1)));
    }
    for (let i = 0; i < 3; i++) g.add(rbox(0.36, 0.3, 0.36, 0.03, std(0xC99A5B, 0.8), w / 2 + 0.4, 0.15 + (i === 2 ? 0.3 : 0), d / 2 + 0.2 - (i % 2) * 0.4));
    const c = cone(); c.position.set(-w / 2 - 0.35, 0, d / 2 + 0.35); g.add(c);
    return g;
  }
  // Rubble: broken wall stubs, a heap of blocks and beams, warning cones.
  g.add(rbox(1.0, Hh * 0.55, 0.18, 0.04, wallMat, -0.6, Hh * 0.27, -0.6));
  g.add(rbox(0.18, Hh * 0.35, 0.8, 0.04, wallMat, 0.9, Hh * 0.17, -0.3));
  for (let i = 0; i < 22; i++) {
    const s = 0.18 + r() * 0.32;
    const b = rbox(s, s * 0.6, s * 0.8, 0.04, i % 3 ? wallMat : std(0x8A8378, 0.9), (r() - 0.5) * 1.9, s * 0.3 + r() * 0.15, (r() - 0.5) * 1.4);
    b.rotation.set(r() * 0.6, r() * 3, r() * 0.6);
    g.add(b);
  }
  for (let i = 0; i < 2; i++) { const beam = box(1.2, 0.08, 0.1, std(0x8A5A3B, 0.8), (r() - 0.5), 0.3, (r() - 0.5) * 0.8); beam.rotation.set(0, r() * 3, 0.3); g.add(beam); }
  for (const [x, z] of [[1.1, 0.9], [-1.1, 0.9]]) { const c = cone(); c.position.set(x, 0, z); g.add(c); }
  return g;
}

// Shared lighting rig (same sun as the gameplay backdrops).
function rig(renderer, theme, center = new THREE.Vector3(), span = 30) {
  const T = THEME[theme];
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = T.sun.env;
  scene.add(new THREE.HemisphereLight(T.sun.hemi[0], T.sun.hemi[1], T.sun.hemi[2]));
  const sun = new THREE.DirectionalLight(T.sun.color, T.sun.intensity);
  sun.position.set(-7, 10, 4).multiplyScalar(4).add(center);
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 2;
  sun.shadow.blurSamples = 12;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 160 });
  scene.add(sun, sun.target);
  return { scene, pmrem };
}

export function renderMapHD(renderer, theme, seed, { W, H, S, road, nodes, plots, tilt, scale = 2, ss = 2 }) {
  const cT = Math.cos(tilt);
  const Wu = W / S, Hu = H / S, Lu = H / (S * cT);
  const { scene, pmrem } = rig(renderer, theme, new THREE.Vector3(), Math.max(Wu, Lu) * 0.62);
  const obj = buildMapHD(theme, seed, { W, H, S, road, nodes, plots, tilt });
  scene.add(obj);
  const camera = new THREE.OrthographicCamera(-Wu / 2, Wu / 2, Hu / 2, -Hu / 2, 0.1, 400);
  camera.position.set(0, Math.cos(tilt) * 120, Math.sin(tilt) * 120);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  const prev = { tm: renderer.toneMapping, exp: renderer.toneMappingExposure };
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = THEME[theme].sun.exposure;
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

// Transparent sprite of one repair building on a fixed frame (all states align).
export function renderRepairHD(renderer, theme, state, variant, { S = 22, scale = 2, px = 150, tilt }) {
  const { scene, pmrem } = rig(renderer, theme, new THREE.Vector3(), 6);
  const shadowGround = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.32 }));
  shadowGround.rotation.x = -Math.PI / 2; shadowGround.receiveShadow = true;
  scene.add(shadowGround);
  const obj = buildRepairHD(theme, state, variant);
  obj.traverse(o => { if (o.isMesh) { o.castShadow = !o.material.isMeshBasicMaterial; o.receiveShadow = true; } });
  scene.add(obj);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.position.set(0, Math.cos(tilt) * 60, Math.sin(tilt) * 60);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const hw = px / S / 2;
  const c0 = new THREE.Vector3(0, 1.0, 0).applyMatrix4(camera.matrixWorldInverse);
  Object.assign(camera, { left: c0.x - hw, right: c0.x + hw, top: c0.y + hw, bottom: c0.y - hw });
  camera.updateProjectionMatrix();
  const prev = { tm: renderer.toneMapping, exp: renderer.toneMappingExposure };
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = THEME[theme].sun.exposure;
  renderer.setClearColor(0x000000, 0);
  const N = px * scale;
  renderer.setSize(N * 2, N * 2, false);
  renderer.render(scene, camera);
  const [c, x] = canvas(N, N);
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(renderer.domElement, 0, 0, N, N);
  renderer.toneMapping = prev.tm; renderer.toneMappingExposure = prev.exp;
  obj.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.map?.dispose?.(); o.material.dispose?.(); } });
  pmrem.dispose();
  return c;
}
