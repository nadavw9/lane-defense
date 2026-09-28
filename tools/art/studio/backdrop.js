// Backdrop studio — bakes the WHOLE gameplay scene behind the cars as one lit
// 3D diorama: road surface with worn paint, the zebra crossing at the breach,
// kerbs, sidewalks with street furniture, trees throwing real shadows onto the
// road, rooftops at the screen edges, and the bomb depot floor whose tracks
// continue each lane down into its bomb column.
//
// It is rendered with the SAME camera tilt and key light as the vehicle
// sprites (studio.js), so cars and world read as one toy diorama. The game's
// camera is straight top-down orthographic; the bake maps game ground (x, z)
// exactly onto the stage by stretching ground z by 1/cos(tilt) — the tilted
// camera then projects it back to the game's own scale. Heights still lean
// toward the top of the screen, which is what gives the 3/4 depth.
//
// Every number that ties the art to gameplay (frustum, road half-width, lane
// x's, breach, bomb slot rows, bar top) is PASSED IN by the driver from
// src/renderer3d/projection.js — never hardcoded here.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ── Deterministic randomness ────────────────────────────────────────────────
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
const css = (hex) => '#' + hex.toString(16).padStart(6, '0');
const mix = (a, b, t) => {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return ca.lerp(cb, t).getHex();
};

// ── Canvas texture helpers ──────────────────────────────────────────────────
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function toTex(c, { repeat = [1, 1], srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
// Speckle: n dots of random size/alpha in a colour list.
function speckle(x, w, h, r, n, colors, rMin = 0.6, rMax = 1.8, aMin = 0.15, aMax = 0.6) {
  for (let i = 0; i < n; i++) {
    x.globalAlpha = aMin + r() * (aMax - aMin);
    x.fillStyle = pick(r, colors);
    const px = r() * w, py = r() * h, rad = rMin + r() * (rMax - rMin);
    x.beginPath(); x.arc(px, py, rad, 0, Math.PI * 2); x.fill();
  }
  x.globalAlpha = 1;
}
// Soft blotches (large-scale mottling / stains).
function blotch(x, cx, cy, rad, color, alpha) {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
  const c = new THREE.Color(color);
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  g.addColorStop(0, `rgba(${rgb},${alpha})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g;
  x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
}
// Worn paint: a rectangle filled with paint, then eroded with noise holes.
function wornRect(x, px, py, w, h, color, r, wear = 0.25) {
  x.fillStyle = color;
  x.globalAlpha = 0.92;
  x.fillRect(px, py, w, h);
  x.globalAlpha = 1;
  x.save();
  x.beginPath(); x.rect(px - 2, py - 2, w + 4, h + 4); x.clip();
  x.globalCompositeOperation = 'destination-out';
  const holes = Math.floor(w * h * wear * 0.02);
  for (let i = 0; i < holes; i++) {
    x.globalAlpha = 0.25 + r() * 0.6;
    x.beginPath(); x.arc(px + r() * w, py + r() * h, 0.6 + r() * 2.2, 0, Math.PI * 2); x.fill();
  }
  x.restore();
  x.globalAlpha = 1;
}

// ── Materials ───────────────────────────────────────────────────────────────
const std = (color, roughness = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const glow = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });

// ── Geometry helpers ────────────────────────────────────────────────────────
function rbox(w, h, d, r, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), mat);
  m.position.set(x, y, z);
  return m;
}
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  return m;
}
function sphere(rad, mat, x = 0, y = 0, z = 0, ws = 18, hs = 12) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(rad, ws, hs), mat);
  m.position.set(x, y, z);
  return m;
}
// A lumpy blob (canopy puff / bush): icosahedron with seeded vertex noise.
function blob(rad, mat, r, detail = 2, lump = 0.16) {
  const g = new THREE.IcosahedronGeometry(rad, detail);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const k1 = r() * 10, k2 = r() * 10;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 5.1 + k1) * Math.cos(v.z * 4.3 + k2) + Math.sin(v.y * 6.7 + k1 * 0.5) * 0.6;
    v.multiplyScalar(1 + n * lump * 0.5);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}
function plane(w, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

// ── World themes ────────────────────────────────────────────────────────────
const THEME = {
  world1: {
    asphalt: 0x575A63, asphaltHi: 0x62656F, asphaltLo: 0x4C4F57, paint: '#F4F1E6', centre: '#F4F1E6',
    kerb: 0xD9D2C3, gutter: 0x5C5F66, walk: [0xE8DCC6, 0xDCCDB3, 0xEFE4CF], walkJoint: '#B9AA90',
    lawn: [0x6DBE55, 0x5FAE4B], leaf: [0x49A844, 0x5BBE4F, 0x3E9A3F, 0x6CC957], trunk: 0x7A5337,
    roofs: [0xB5654A, 0xA65A42, 0x7A8896, 0x8A9A84, 0xBC8456, 0x6F7F90], walls: [0xF3E6CF, 0xEFDCC0, 0xE6E9EC, 0xF4E4CC],
    awnings: [[0xE8453C, 0xFFFFFF], [0x2F8CFF, 0xFFFFFF], [0x2FA36B, 0xFFFFFF], [0xFFB02E, 0xFFFFFF]],
    depot: [0xCDBFA6, 0xC4B59B, 0xD3C6AE], depotJoint: '#A89880', track: 0x7D7566, trackEdge: 0xF2EDE2,
    sun: { color: 0xFFEFD2, intensity: 3.1, hemi: [0xCFE2FF, 0x7D7258, 0.62], env: 0.3, exposure: 1.0 },
  },
  world2: {
    asphalt: 0x8A8C8F, asphaltHi: 0x9C9EA1, asphaltLo: 0x74767A, paint: '#F2F0EA', centre: '#FFC21A',
    kerb: 0xB9BCC2, gutter: 0x6A6C70, walk: [0xA8ABB0, 0x9FA2A8, 0xB2B5BA], walkJoint: '#7F8288',
    lawn: [0x8A9A6A, 0x7C8C5E], leaf: [0x6E9150, 0x7FA35C, 0x5F8246, 0x8DAE66], trunk: 0x6A4E36,
    roofs: [0x5E7D9E, 0xA87A52, 0x7A8590, 0x5F8A7E, 0x8F6A5C], walls: [0xC9C4BA, 0xB7BEC6, 0xD4CFC4],
    awnings: [[0xFFC21A, 0x2A2733]], depot: [0x7E8388, 0x747A80, 0x888D92], depotJoint: '#5B6066', track: 0x5E6369, trackEdge: 0xFFC21A,
    sun: { color: 0xFFE9CC, intensity: 3.0, hemi: [0xD0DDEB, 0x6E685C, 0.62], env: 0.3, exposure: 1.0 },
  },
  world3: {
    asphalt: 0x343A50, asphaltHi: 0x3E4560, asphaltLo: 0x2B3044, paint: '#E9F2FF', centre: '#4FE3FF',
    kerb: 0x4A4E62, gutter: 0x1E2029, walk: [0x3A3D4F, 0x34374A, 0x414458], walkJoint: '#23252F',
    lawn: [0x1F3B3A, 0x1A3231], leaf: [0x1F6B66, 0x28807A, 0x1A5C58, 0x2E918A], trunk: 0x3A2E2A,
    roofs: [0x4A4F68, 0x535872, 0x444A62, 0x564C6E], walls: [0x3E4258, 0x353A50],
    awnings: [[0xFF3DB8, 0x2A2D40], [0x4FE3FF, 0x2A2D40]], depot: [0x2E3142, 0x33374A, 0x2A2D3C], depotJoint: '#1C1E28', track: 0x1F2230, trackEdge: 0x4FE3FF,
    neon: [0xFF3DB8, 0x4FE3FF, 0xFFD42A, 0xA35CFF],
    sun: { color: 0xB9CAFF, intensity: 1.9, hemi: [0x7C8BD8, 0x241C38, 0.7], env: 0.25, exposure: 1.05 },
  },
};

// ── Textures ────────────────────────────────────────────────────────────────
// Road surface, painted in GAME units: pxu px per world unit on both axes.
function roadTexture(T, world, L, r) {
  const { pxu, halfW, laneXs, z0, z1, crossZ } = L;
  const W = Math.round(halfW * 2 * pxu), H = Math.round((z1 - z0) * pxu);
  const [c, x] = canvas(W, H);
  const X = (wx) => (wx + halfW) * pxu, Y = (wz) => (wz - z0) * pxu;
  // Base + large mottling.
  x.fillStyle = css(T.asphalt); x.fillRect(0, 0, W, H);
  for (let i = 0; i < 36; i++) blotch(x, r() * W, r() * H, 70 + r() * 180, r() < 0.5 ? T.asphaltHi : T.asphaltLo, 0.07 + r() * 0.07);
  if (world === 'world2') {
    // Concrete slabs: expansion joints across and along each lane.
    x.strokeStyle = 'rgba(40,42,46,0.55)'; x.lineWidth = 2.2;
    for (let wz = Math.ceil(z0 / 4.5) * 4.5; wz < z1; wz += 4.5) { x.beginPath(); x.moveTo(0, Y(wz)); x.lineTo(W, Y(wz)); x.stroke(); }
    for (const lx of laneXs) for (const s of [-1, 1]) { x.beginPath(); x.moveTo(X(lx + s * 2), 0); x.lineTo(X(lx + s * 2), H); x.stroke(); }
    // Slab-to-slab tone shifts.
    for (let wz = Math.ceil(z0 / 4.5) * 4.5; wz < z1; wz += 4.5) for (const lx of laneXs) {
      x.globalAlpha = 0.03 + r() * 0.04; x.fillStyle = r() < 0.5 ? '#FFFFFF' : '#000000';
      x.fillRect(X(lx - 2), Y(wz), 4 * pxu, 4.5 * pxu);
    }
    x.globalAlpha = 1;
  }
  // Aggregate grain.
  speckle(x, W, H, r, Math.floor(W * H * 0.018), world === 'world3' ? ['#4A4F66', '#191B24', '#5B6178'] : ['#9A9CA3', '#45474D', '#B5B7BD', '#3A3C41'], 0.5, 1.4, 0.15, 0.55);
  // Tyre wear: two darker polished bands per lane.
  for (const lx of laneXs) for (const s of [-1, 1]) {
    const bx = X(lx + s * 0.95), bw = 0.7 * pxu;
    const g = x.createLinearGradient(bx - bw / 2, 0, bx + bw / 2, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, world === 'world3' ? 'rgba(90,110,170,0.10)' : 'rgba(20,20,26,0.13)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(bx - bw / 2, 0, bw, H);
  }
  // Oil drips down the lane centres.
  for (const lx of laneXs) for (let i = 0; i < 9; i++) blotch(x, X(lx + (r() - 0.5) * 0.8), r() * H, 8 + r() * 18, 0x1A1A20, 0.12 + r() * 0.1);
  // Patches and cracks (not on concrete).
  if (world !== 'world2') {
    // Tar-sealed cracks ("tar snakes"): glossy dark meandering lines.
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (let i = 0; i < 7; i++) {
      let px = r() * W, py = r() * H;
      x.strokeStyle = 'rgba(28,29,34,0.55)'; x.lineWidth = 3 + r() * 2.5;
      x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 9; k++) { px += (r() - 0.5) * 40; py += 10 + r() * 26; x.lineTo(px, py); }
      x.stroke();
    }
    x.strokeStyle = world === 'world3' ? 'rgba(10,10,16,0.6)' : 'rgba(30,30,36,0.5)';
    for (let i = 0; i < 16; i++) {
      let px = r() * W, py = r() * H;
      x.lineWidth = 0.8 + r() * 1.2;
      x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 7; k++) { px += (r() - 0.5) * 26; py += (r() - 0.3) * 22; x.lineTo(px, py); }
      x.stroke();
    }
  }
  // Night: wet sheen + lamp light pools and neon reflections.
  if (world === 'world3') {
    // Wet asphalt: warm lamp pools and long neon streak reflections, added
    // light-on-dark ('lighter') so they glow instead of staining.
    x.save(); x.globalCompositeOperation = 'lighter';
    for (const [lx, lz, col] of L.lampPools ?? []) {
      blotch(x, X(lx), Y(lz), 3.2 * pxu, col, 0.22);
      blotch(x, X(lx), Y(lz), 1.4 * pxu, 0xFFE2A8, 0.16);
    }
    for (const [sx, sz, col] of L.neonStreaks ?? []) {
      const gx = X(sx), gy = Y(sz), hw = 0.35 * pxu, hh = 2.6 * pxu;
      const g = x.createLinearGradient(gx, gy - hh, gx, gy + hh);
      const c = new THREE.Color(col), rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
      g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.5, `rgba(${rgb},0.35)`); g.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = g;
      x.beginPath(); x.ellipse(gx, gy, hw, hh, 0, 0, Math.PI * 2); x.fill();
    }
    x.restore();
  }
  // Lane markings.
  const dash = world === 'world2' ? [2.6, 1.8] : [2.2, 2.0];
  const dw = 0.16 * pxu;
  for (let i = 0; i < laneXs.length - 1; i++) {
    const dx = X((laneXs[i] + laneXs[i + 1]) / 2);
    for (let wz = z0 - 0.7; wz < crossZ - 2.4; wz += dash[0] + dash[1]) {
      const a = Math.max(wz, z0), b = Math.min(wz + dash[0], crossZ - 2.4);
      if (b > a) wornRect(x, dx - dw / 2, Y(a), dw, (b - a) * pxu, i === Math.floor((laneXs.length - 2) / 2) && world === 'world2' ? T.centre : T.paint, r, 0.3);
    }
  }
  // Edge lines.
  for (const s of [-1, 1]) {
    const ex = X(s * (halfW - 0.42)) - dw / 2;
    wornRect(x, ex, 0, dw, Y(crossZ - 2.4), world === 'world3' ? T.centre : T.paint, r, 0.22);
  }
  // Lane arrows (pointing down the road) a few rows above the crossing.
  x.save();
  for (const lx of laneXs) {
    const ax = X(lx), ay = Y(crossZ - 6.4);
    x.translate(ax, ay);
    x.fillStyle = T.paint; x.globalAlpha = 0.75;
    x.beginPath();
    const s = pxu;
    x.moveTo(-0.14 * s, -1.1 * s); x.lineTo(0.14 * s, -1.1 * s); x.lineTo(0.14 * s, 0.1 * s); x.lineTo(0.42 * s, 0.1 * s);
    x.lineTo(0, 0.75 * s); x.lineTo(-0.42 * s, 0.1 * s); x.lineTo(-0.14 * s, 0.1 * s); x.closePath(); x.fill();
    x.globalAlpha = 1;
    x.translate(-ax, -ay);
  }
  x.restore();
  // Zebra crossing just above the breach + solid stop line.
  const stripeW = 0.55, gap = 0.45;
  const zx0 = -halfW + 0.7, zx1 = halfW - 0.7;
  const n = Math.floor((zx1 - zx0 + gap) / (stripeW + gap));
  const off = ((zx1 - zx0) - (n * stripeW + (n - 1) * gap)) / 2;
  for (let i = 0; i < n; i++) {
    const sx = X(zx0 + off + i * (stripeW + gap));
    wornRect(x, sx, Y(crossZ - 1.95), stripeW * pxu, 1.55 * pxu, world === 'world2' ? '#F2F0EA' : T.paint, r, 0.28);
  }
  wornRect(x, X(zx0), Y(crossZ - 0.3), (zx1 - zx0) * pxu, 0.2 * pxu, T.paint, r, 0.2);
  // Ambient occlusion where the road meets the kerbs.
  for (const s of [-1, 1]) {
    const ex = X(s * halfW), gw = 0.55 * pxu;
    const g = x.createLinearGradient(ex, 0, ex - s * gw, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.38)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(Math.min(ex, ex - s * gw), 0, gw, H);
  }
  return toTex(c);
}

// Square pavers / cobbles, in world units: pxu px per unit, tile = unit size.
function paverTexture(cols, joint, pxu, wU, dU, r, { tile = 0.5, style = 'grid' } = {}) {
  const W = Math.round(wU * pxu), H = Math.round(dU * pxu);
  const [c, x] = canvas(W, H);
  x.fillStyle = joint; x.fillRect(0, 0, W, H);
  const t = tile * pxu, j = Math.max(1.2, pxu * 0.03);
  if (style === 'herring') {
    const L2 = t * 1.0, S2 = t * 0.5;
    for (let yy = -L2; yy < H + L2; yy += S2) for (let xx = -L2; xx < W + L2; xx += L2) {
      const k = Math.round(yy / S2) + Math.round(xx / L2);
      x.fillStyle = css(pick(r, cols));
      if (k % 2) x.fillRect(xx + j / 2, yy + j / 2, L2 - j, S2 - j);
      else x.fillRect(xx + j / 2, yy + j / 2, S2 - j, L2 - j);
    }
  } else {
    for (let yy = 0, row = 0; yy < H; yy += t, row++) for (let xx = (style === 'brick' && row % 2 ? -t / 2 : 0); xx < W; xx += t) {
      x.fillStyle = css(pick(r, cols));
      x.beginPath();
      x.roundRect ? x.roundRect(xx + j / 2, yy + j / 2, t - j, t - j, j) : x.rect(xx + j / 2, yy + j / 2, t - j, t - j);
      x.fill();
      x.globalAlpha = 0.18; x.fillStyle = '#FFFFFF'; x.fillRect(xx + j, yy + j, t - 2 * j, (t - 2 * j) * 0.22); x.globalAlpha = 1;
    }
  }
  speckle(x, W, H, r, Math.floor(W * H * 0.004), ['#000000', '#FFFFFF'], 0.4, 1.0, 0.05, 0.14);
  return toTex(c);
}

function grassTexture(cols, pxu, wU, dU, r) {
  const W = Math.round(wU * pxu), H = Math.round(dU * pxu);
  const [c, x] = canvas(W, H);
  x.fillStyle = css(cols[0]); x.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) blotch(x, r() * W, r() * H, 20 + r() * 60, cols[1], 0.35);
  x.strokeStyle = css(mix(cols[0], 0xFFFFFF, 0.25));
  for (let i = 0; i < W * H * 0.01; i++) {
    const px = r() * W, py = r() * H;
    x.globalAlpha = 0.25 + r() * 0.35; x.lineWidth = 0.8;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 2, py - 2 - r() * 3); x.stroke();
  }
  x.globalAlpha = 1;
  return toTex(c);
}

// Clay roof tiles: rows of scalloped tiles along the slope.
function roofTileTexture(color, r) {
  const [c, x] = canvas(128, 128);
  x.fillStyle = css(mix(color, 0x000000, 0.2)); x.fillRect(0, 0, 128, 128);
  for (let row = 0; row < 8; row++) for (let i = -1; i < 9; i++) {
    const cx = i * 16 + (row % 2 ? 8 : 0), cy = row * 16 + 16;
    const shade = 0.88 + r() * 0.2;
    x.fillStyle = css(new THREE.Color(color).multiplyScalar(shade).getHex());
    x.beginPath(); x.moveTo(cx - 8, cy - 16); x.lineTo(cx + 8, cy - 16); x.lineTo(cx + 8, cy - 4);
    x.quadraticCurveTo(cx, cy + 3, cx - 8, cy - 4); x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(cx - 7, cy - 15, 3, 9);
  }
  return toTex(c);
}
function corrugatedTexture(color) {
  const [c, x] = canvas(64, 64);
  const g = x.createLinearGradient(0, 0, 8, 0);
  const a = css(mix(color, 0xFFFFFF, 0.22)), b = css(mix(color, 0x000000, 0.22));
  g.addColorStop(0, b); g.addColorStop(0.5, a); g.addColorStop(1, b);
  x.fillStyle = g;
  for (let i = 0; i < 8; i++) { x.save(); x.translate(i * 8, 0); x.fillRect(0, 0, 8, 64); x.restore(); }
  return toTex(c);
}
function windowTexture(litCols, r, lit = 0.7) {
  const [c, x] = canvas(64, 128);
  x.fillStyle = '#1E2130'; x.fillRect(0, 0, 64, 128);
  for (let yy = 6; yy < 124; yy += 12) for (let xx = 5; xx < 60; xx += 11) {
    x.fillStyle = r() < lit ? css(pick(r, litCols)) : '#2B2F44';
    x.fillRect(xx, yy, 7, 8);
  }
  return toTex(c);
}

// ── Props ───────────────────────────────────────────────────────────────────
function tree(T, r, s = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.07 * s, 0.1 * s, 0.9 * s, std(T.trunk, 0.9), 0, 0.45 * s, 0, 10));
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r(), d = 0.22 * s + r() * 0.12 * s;
    const col = pick(r, T.leaf);
    const puff = blob((0.38 + r() * 0.14) * s, std(col, 0.78), r, 2, 0.22);
    puff.position.set(Math.cos(a) * d, (1.05 + r() * 0.25) * s, Math.sin(a) * d);
    g.add(puff);
  }
  const top = blob(0.44 * s, std(pick(r, T.leaf), 0.75), r, 2, 0.2);
  top.position.set(0, 1.42 * s, 0);
  g.add(top);
  return g;
}
function pine(T, r, s = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.06 * s, 0.08 * s, 0.5 * s, std(T.trunk, 0.9), 0, 0.25 * s, 0, 8));
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry((0.55 - i * 0.14) * s, 0.7 * s, 9), std(pick(r, T.leaf), 0.8));
    m.position.y = (0.65 + i * 0.36) * s;
    m.rotation.y = r() * 3;
    g.add(m);
  }
  return g;
}
function bush(T, r, s = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const b = blob((0.2 + r() * 0.1) * s, std(pick(r, T.leaf), 0.8), r, 1, 0.25);
    b.position.set((r() - 0.5) * 0.35 * s, 0.18 * s, (r() - 0.5) * 0.35 * s);
    g.add(b);
  }
  return g;
}
function flowerBed(T, r, w, d) {
  const g = new THREE.Group();
  g.add(rbox(w, 0.22, d, 0.05, std(0xB8876A, 0.8), 0, 0.11, 0));
  g.add(box(w - 0.1, 0.05, d - 0.1, std(0x5A3E2B, 0.95), 0, 0.2, 0));
  const petals = [0xFF5C7A, 0xFFD42A, 0xFFFFFF, 0xB65CFF, 0xFF8A1C];
  for (let i = 0; i < Math.floor(w * d * 40); i++) {
    const f = sphere(0.035 + r() * 0.02, std(pick(r, petals), 0.6), (r() - 0.5) * (w - 0.2), 0.26 + r() * 0.03, (r() - 0.5) * (d - 0.2), 6, 4);
    g.add(f);
  }
  for (let i = 0; i < Math.floor(w * d * 12); i++) {
    const b = blob(0.07, std(pick(r, T.leaf), 0.8), r, 0, 0.3);
    b.position.set((r() - 0.5) * (w - 0.2), 0.24, (r() - 0.5) * (d - 0.2));
    g.add(b);
  }
  return g;
}
function lamp(T, r, night = false, facing = 1) {
  const g = new THREE.Group();
  const metal = std(night ? 0x3A3E52 : 0x2F3440, 0.4, { metalness: 0.5 });
  g.add(cyl(0.045, 0.06, 1.9, metal, 0, 0.95, 0, 10));
  g.add(cyl(0.1, 0.12, 0.12, metal, 0, 0.06, 0, 12));
  const arm = box(0.5, 0.05, 0.05, metal, facing * 0.25, 1.88, 0);
  g.add(arm);
  const head = rbox(0.26, 0.1, 0.16, 0.04, metal, facing * 0.5, 1.84, 0);
  g.add(head);
  g.add(box(0.2, 0.02, 0.12, night ? glow(0xFFE7A8) : std(0xFFF6D8, 0.3, { emissive: 0xFFF1C8, emissiveIntensity: 0.4 }), facing * 0.5, 1.78, 0));
  return g;
}
function bench(r, color = 0x8A5A3B) {
  const g = new THREE.Group();
  const wood = std(color, 0.7), iron = std(0x2E3138, 0.5, { metalness: 0.4 });
  for (let i = 0; i < 3; i++) g.add(box(0.09, 0.03, 0.9, wood, -0.1 + i * 0.1, 0.28, 0));
  for (let i = 0; i < 2; i++) g.add(box(0.03, 0.09, 0.9, wood, -0.2, 0.42 + i * 0.1, 0));
  for (const z of [-0.38, 0.38]) g.add(box(0.3, 0.28, 0.04, iron, -0.05, 0.14, z));
  return g;
}
function hydrant() {
  const g = new THREE.Group();
  const red = std(0xE0392F, 0.45, { metalness: 0.1 });
  g.add(cyl(0.09, 0.1, 0.36, red, 0, 0.18, 0, 12));
  g.add(sphere(0.095, red, 0, 0.37, 0, 12, 8));
  const noz = cyl(0.035, 0.035, 0.26, red, 0, 0.26, 0, 8); noz.rotation.z = Math.PI / 2; g.add(noz);
  return g;
}
function bollard(color = 0x2E3138) {
  const g = new THREE.Group();
  g.add(cyl(0.06, 0.07, 0.42, std(color, 0.5, { metalness: 0.3 }), 0, 0.21, 0, 12));
  g.add(cyl(0.065, 0.065, 0.05, std(0xF2F0EA, 0.4), 0, 0.34, 0, 12));
  return g;
}
function bin() {
  const g = new THREE.Group();
  g.add(cyl(0.16, 0.14, 0.45, std(0x2F6B4A, 0.6), 0, 0.225, 0, 14));
  g.add(cyl(0.18, 0.18, 0.05, std(0x24543A, 0.6), 0, 0.47, 0, 14));
  return g;
}
function planterPot(T, r, s = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.26 * s, 0.2 * s, 0.34 * s, std(pick(r, [0xC06A45, 0xE8E1D4, 0x5C6B7A]), 0.7), 0, 0.17 * s, 0, 16));
  const b = bush(T, r, 0.9 * s); b.position.y = 0.2 * s; g.add(b);
  return g;
}
function parasol(r, cols) {
  const g = new THREE.Group();
  g.add(cyl(0.03, 0.03, 1.1, std(0xE8E1D4, 0.5), 0, 0.55, 0, 8));
  const [a, b] = cols;
  const n = 8;
  for (let i = 0; i < n; i++) {
    const seg = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.26, 3, 1, true, (i / n) * Math.PI * 2, Math.PI * 2 / n), std(i % 2 ? a : b, 0.6, { side: THREE.DoubleSide }));
    seg.position.y = 1.18;
    g.add(seg);
  }
  g.add(cyl(0.3, 0.3, 0.04, std(0xF2EEE6, 0.5), 0, 0.5, 0, 16));
  return g;
}
function awning(w, cols, facing) {
  // Striped awning sloping away from a wall toward the street (facing = +1/-1 along x).
  const g = new THREE.Group();
  const n = Math.max(4, Math.round(w / 0.22));
  for (let i = 0; i < n; i++) {
    const seg = box(0.55, 0.03, w / n, std(i % 2 ? cols[1] : cols[0], 0.6), 0, 0, -w / 2 + (i + 0.5) * (w / n));
    g.add(seg);
  }
  // Scalloped valance.
  for (let i = 0; i < n; i++) g.add(box(0.03, 0.12, w / n - 0.02, std(i % 2 ? cols[1] : cols[0], 0.6), facing * 0.27, -0.06, -w / 2 + (i + 0.5) * (w / n)));
  g.rotation.z = -facing * 0.35;
  return g;
}

// A town house seen from above: body, pitched tile roof or flat roof with kit.
function townHouse(T, r, w, d, h, facing) {
  const g = new THREE.Group();
  const wall = std(pick(r, T.walls), 0.85);
  g.add(rbox(w, h, d, 0.04, wall, 0, h / 2, 0));
  // Windows on the camera-facing side (+z) and street side.
  const winM = std(0x3B5B86, 0.15, { metalness: 0.3 });
  for (let i = 0; i < Math.max(1, Math.floor(w / 0.55)); i++) {
    for (let fl = 0; fl < Math.max(1, Math.floor(h / 0.7)); fl++) {
      g.add(box(0.26, 0.3, 0.02, winM, -w / 2 + 0.35 + i * 0.55, 0.45 + fl * 0.7, d / 2 + 0.005));
    }
  }
  const roofCol = pick(r, T.roofs);
  if (r() < 0.62) {
    // Pitched roof along z (ridge runs along the street) with tile texture.
    const tex = roofTileTexture(roofCol, r);
    tex.repeat.set(w * 0.5, d * 0.5);
    const mat = std(0xffffff, 0.75, { map: tex });
    const rh = 0.55 + r() * 0.2, over = 0.12;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 - over, 0); shape.lineTo(0, rh); shape.lineTo(w / 2 + over, 0); shape.lineTo(-w / 2 - over, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d + over * 2, bevelEnabled: false });
    geo.translate(0, 0, -(d + over * 2) / 2);
    const roof = new THREE.Mesh(geo, mat);
    roof.position.y = h;
    g.add(roof);
    g.add(box(0.08, 0.05, d + over * 2, std(mix(roofCol, 0x000000, 0.35), 0.7), 0, h + rh + 0.01, 0));
    if (r() < 0.8) {   // chimney
      const cx = (r() - 0.5) * w * 0.5;
      g.add(rbox(0.22, 0.5, 0.22, 0.03, std(0xB0674A, 0.8), cx, h + rh * 0.8, (r() - 0.5) * d * 0.5));
    }
    if (r() < 0.5) {   // dormer skylight
      g.add(box(0.3, 0.02, 0.36, std(0x9FC3E8, 0.1, { metalness: 0.4 }), -w * 0.22 * facing, h + rh * 0.55, (r() - 0.5) * d * 0.4));
    }
  } else {
    // Flat roof: parapet, gravel, AC units, water tank / solar panels / garden.
    const top = mix(roofCol, 0xBFB8AA, 0.6);
    g.add(rbox(w + 0.06, 0.12, d + 0.06, 0.03, std(mix(top, 0x000000, 0.15), 0.8), 0, h + 0.06, 0));
    g.add(box(w - 0.14, 0.04, d - 0.14, std(top, 0.95), 0, h + 0.1, 0));
    const kit = r();
    if (kit < 0.35) {
      for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
        const ac = rbox(0.34, 0.2, 0.3, 0.03, std(0xE4E6EA, 0.5), (r() - 0.5) * (w - 0.5), h + 0.22, (r() - 0.5) * (d - 0.5));
        g.add(ac);
        g.add(cyl(0.1, 0.1, 0.02, std(0x3A3E48, 0.5), ac.position.x, h + 0.33, ac.position.z, 14));
      }
    } else if (kit < 0.6) {
      const tank = new THREE.Group();
      tank.add(cyl(0.28, 0.28, 0.5, std(0x9A6B45, 0.8), 0, 0.55, 0, 16));
      tank.add(new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.2, 16), std(0x6E4A30, 0.8)));
      tank.children[1].position.y = 0.9;
      for (const [a, b] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) tank.add(cyl(0.02, 0.02, 0.4, std(0x3A3E48, 0.6), a, 0.2, b, 6));
      tank.position.set((r() - 0.5) * (w - 0.8), h + 0.1, (r() - 0.5) * (d - 0.8));
      g.add(tank);
    } else if (kit < 0.8) {
      const solar = std(0x243A66, 0.2, { metalness: 0.5 });
      for (let i = 0; i < 3; i++) {
        const p = box(Math.min(0.6, w - 0.4), 0.03, 0.34, solar, 0, h + 0.2, -d / 2 + 0.35 + i * 0.42);
        p.rotation.x = -0.35;
        g.add(p);
      }
    } else {
      const garden = grassTexture(T.lawn, 64, w, d, r);
      g.add(plane(w - 0.3, d - 0.3, std(0xffffff, 0.9, { map: garden }), 0, h + 0.125, 0));
      for (let i = 0; i < 3; i++) { const b = bush(T, r, 0.7); b.position.set((r() - 0.5) * (w - 0.6), h + 0.12, (r() - 0.5) * (d - 0.6)); g.add(b); }
    }
  }
  return g;
}

function warehouse(T, r, w, d, h) {
  const g = new THREE.Group();
  const col = pick(r, T.roofs);
  g.add(rbox(w, h, d, 0.04, std(pick(r, T.walls), 0.8), 0, h / 2, 0));
  const tex = corrugatedTexture(col);
  tex.repeat.set(w * 3, 1);
  // Barrel-ish roof: two slopes.
  const rh = 0.35;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - 0.08, 0); shape.lineTo(0, rh); shape.lineTo(w / 2 + 0.08, 0); shape.lineTo(-w / 2 - 0.08, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d + 0.16, bevelEnabled: false });
  geo.translate(0, 0, -(d + 0.16) / 2);
  const roofM = new THREE.Mesh(geo, std(0xffffff, 0.45, { map: tex, metalness: 0.35 }));
  roofM.position.y = h;
  g.add(roofM);
  // Skylight strips + vents.
  for (let i = 0; i < 3; i++) g.add(box(0.12, 0.03, d * 0.7, std(0xBFD8EE, 0.1, { metalness: 0.4 }), -w * 0.25 + i * w * 0.25, h + rh * 0.55, 0));
  for (let i = 0; i < 2; i++) g.add(cyl(0.08, 0.08, 0.25, std(0xB9BCC2, 0.4, { metalness: 0.6 }), (r() - 0.5) * w * 0.6, h + rh + 0.1, (r() - 0.5) * d * 0.5, 10));
  // Loading door on the camera side.
  g.add(box(w * 0.4, h * 0.6, 0.03, std(0xD9D2C3, 0.6), 0, h * 0.3, d / 2 + 0.01));
  for (let i = 0; i < 5; i++) g.add(box(w * 0.4, 0.02, 0.035, std(0x9A948A, 0.6), 0, h * 0.08 + i * h * 0.11, d / 2 + 0.02));
  return g;
}
function shippingContainer(r, cols) {
  const g = new THREE.Group();
  const col = pick(r, cols);
  const tex = corrugatedTexture(col);
  tex.repeat.set(12, 1);
  g.add(rbox(0.9, 0.9, 2.2, 0.03, std(0xffffff, 0.55, { map: tex, metalness: 0.2 }), 0, 0.45, 0));
  g.add(box(0.86, 0.02, 2.16, std(mix(col, 0x000000, 0.2), 0.6), 0, 0.91, 0));
  return g;
}
function drum(color) {
  const g = new THREE.Group();
  g.add(cyl(0.18, 0.18, 0.5, std(color, 0.45, { metalness: 0.3 }), 0, 0.25, 0, 16));
  for (const y of [0.15, 0.35]) g.add(cyl(0.185, 0.185, 0.03, std(mix(color, 0x000000, 0.25), 0.4), 0, y, 0, 16));
  g.add(cyl(0.16, 0.16, 0.01, std(mix(color, 0x000000, 0.35), 0.5), 0, 0.505, 0, 16));
  return g;
}
function pallet(r) {
  const g = new THREE.Group();
  const wood = std(0xB88A55, 0.85);
  for (let i = 0; i < 5; i++) g.add(box(0.1, 0.03, 0.8, wood, -0.3 + i * 0.15, 0.1, 0));
  for (const z of [-0.33, 0, 0.33]) g.add(box(0.75, 0.08, 0.08, std(0x9A6F42, 0.85), 0, 0.04, z));
  if (r() < 0.7) {
    const crate = rbox(0.6, 0.45, 0.6, 0.03, std(pick(r, [0xC99A5B, 0x5E7FA6, 0x7A9A5A]), 0.8), 0, 0.35, 0);
    g.add(crate);
  }
  return g;
}
function cone() {
  const g = new THREE.Group();
  g.add(box(0.3, 0.03, 0.3, std(0x2A2733, 0.7), 0, 0.015, 0));
  const cn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.42, 14), std(0xFF7A1F, 0.5));
  cn.position.y = 0.23;
  g.add(cn);
  g.add(cyl(0.068, 0.085, 0.07, std(0xF6F3EA, 0.5), 0, 0.2, 0, 14));
  return g;
}
function fence(len, color = 0x9AA0A8) {
  const g = new THREE.Group();
  const m = std(color, 0.4, { metalness: 0.6 });
  for (let z = -len / 2; z <= len / 2; z += 0.6) g.add(cyl(0.02, 0.02, 0.6, m, 0, 0.3, z, 6));
  g.add(box(0.02, 0.02, len, m, 0, 0.58, 0));
  g.add(box(0.012, 0.5, len, std(color, 0.6, { transparent: true, opacity: 0.35, metalness: 0.5 }), 0, 0.3, 0));
  return g;
}
function tower(T, r, w, d, h) {
  // Night world: dark tower top with lit window bands and a neon rim.
  const g = new THREE.Group();
  const body = std(pick(r, T.walls), 0.6);
  g.add(rbox(w, h, d, 0.04, body, 0, h / 2, 0));
  const tex = windowTexture([0xFFE7A8, 0xBFE8FF, 0xFFD27A], r, 0.65);
  tex.repeat.set(w * 1.2, h * 0.6);
  const facade = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, h * 0.92), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  facade.position.set(0, h / 2, d / 2 + 0.01);
  g.add(facade);
  g.add(rbox(w + 0.04, 0.1, d + 0.04, 0.02, std(0x1C1E2A, 0.6), 0, h + 0.05, 0));
  const neon = pick(r, T.neon);
  // Thin neon rim around the parapet.
  for (const [ww, dd, x, z] of [[w, 0.025, 0, d / 2 + 0.02], [w, 0.025, 0, -d / 2 - 0.02], [0.025, d, w / 2 + 0.02, 0], [0.025, d, -w / 2 - 0.02, 0]]) g.add(box(ww, 0.025, dd, glow(neon), x, h + 0.11, z));
  // Lit skylight grid on the roof deck.
  const sky = glow(0xFFE2A8);
  for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) if (r() < 0.7) g.add(box(0.22, 0.012, 0.16, sky, -w / 2 + 0.4 + i * (w - 0.8) / 2, h + 0.115, -d / 4 + k * d / 2));
  // Rooftop billboard facing the camera (reads in the 3/4 view).
  if (r() < 0.65) {
    const bw = Math.min(1.3, w * 0.6), bcol = pick(r, T.neon);
    const bb = new THREE.Group();
    bb.add(rbox(bw, 0.5, 0.06, 0.03, std(0x1C1E2A, 0.5), 0, 0.5, 0));
    bb.add(box(bw - 0.1, 0.4, 0.02, glow(bcol), 0, 0.5, 0.04));
    bb.add(box(bw - 0.3, 0.08, 0.021, glow(0xFFFFFF), 0, 0.55, 0.045));
    bb.add(box(bw - 0.5, 0.05, 0.021, glow(0xFFFFFF), 0, 0.42, 0.045));
    for (const sx of [-1, 1]) bb.add(cyl(0.02, 0.02, 0.3, std(0x3A3E52, 0.5), sx * bw / 3, 0.12, 0, 6));
    bb.position.set((r() - 0.5) * w * 0.3, h + 0.1, d * 0.15);
    g.add(bb);
  }
  // Roof kit: helipad / antenna / AC.
  if (r() < 0.4) {
    g.add(cyl(Math.min(w, d) * 0.32, Math.min(w, d) * 0.32, 0.03, std(0x3A3E52, 0.7), 0, h + 0.12, 0, 24));
    g.add(box(0.3, 0.012, 0.06, glow(0xF2F0EA), 0, h + 0.14, 0));
  } else {
    g.add(cyl(0.02, 0.02, 0.9, std(0x8A8FA0, 0.4, { metalness: 0.6 }), w * 0.25, h + 0.5, -d * 0.2, 6));
    g.add(sphere(0.05, glow(0xFF4A4A), w * 0.25, h + 0.97, -d * 0.2, 8, 6));
    for (let i = 0; i < 2; i++) g.add(rbox(0.3, 0.18, 0.26, 0.03, std(0x4A4E62, 0.5), (r() - 0.5) * (w - 0.5), h + 0.18, (r() - 0.5) * (d - 0.5)));
  }
  return g;
}
function neonSign(T, r, w) {
  const g = new THREE.Group();
  const col = pick(r, T.neon);
  g.add(rbox(w, 0.34, 0.06, 0.04, std(0x1C1E2A, 0.5), 0, 0.5, 0));
  g.add(box(w - 0.12, 0.2, 0.02, glow(col), 0, 0.5, 0.04));
  g.add(cyl(0.02, 0.02, 0.35, std(0x3A3E52, 0.5), -w / 3, 0.17, 0, 6));
  g.add(cyl(0.02, 0.02, 0.35, std(0x3A3E52, 0.5), w / 3, 0.17, 0, 6));
  return g;
}

// ── Scene assembly ──────────────────────────────────────────────────────────
// L (layout, game units): halfX, topZ, bottomZ, halfW (road half-width incl.
// shoulder), laneXs, breachZ, barZ (bomb-zone bottom), slotZs (bomb rows).
export function buildBackdrop(world, variant, L) {
  const T = THEME[world];
  const r = rng(({ a: 11, b: 29, c: 47 }[variant] ?? 7) * 1009 + world.length * 31 + L.laneXs.length);
  const cT = Math.cos(L.tilt);
  const Z = (gz) => gz / cT;                 // game z → studio z (see header)
  const g = new THREE.Group();
  const night = world === 'world3';
  const pxu = 64;                           // texture density (px per world unit)

  const z0 = L.topZ - 3, z1 = L.bottomZ + 3;
  const roadLen = L.breachZ - z0;
  const crossZ = L.breachZ;

  // Street lamps (both sides), used for night light pools too.
  const lampZs = [];
  for (let gz = L.topZ + 3 + r() * 2; gz < L.breachZ - 2.5; gz += 7.5 + r() * 1.5) lampZs.push(gz);
  const lampPools = night ? lampZs.flatMap((lz) => [[-(L.halfW - 0.9), lz + 0.3, 0xFFB45A], [(L.halfW - 0.9), lz + 3.6, 0xFFB45A]]) : [];
  const neonStreaks = night ? Array.from({ length: 9 }, (_, i) => [(i % 2 ? 1 : -1) * (L.halfW - 0.5 - r() * 0.6), L.topZ + 2 + i * 3.1 + r(), pick(r, [0xFF3DB8, 0x4FE3FF, 0xA35CFF])]) : [];

  // 1. Road surface (textured plane in game units, stretched onto studio z).
  const roadTex = roadTexture(T, world, { pxu, halfW: L.halfW, laneXs: L.laneXs, z0, z1: L.breachZ + 0.05, crossZ, lampPools, neonStreaks }, r);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(L.halfW * 2, Z(L.breachZ + 0.05) - Z(z0)),
    std(0xffffff, night ? 0.35 : 0.9, { map: roadTex, metalness: night ? 0.15 : 0 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, (Z(z0) + Z(L.breachZ + 0.05)) / 2);
  road.receiveShadow = true;
  g.add(road);

  // 2. Kerbs + gutters + sidewalks along both edges, down to the breach.
  const kerbW = 0.3, walkW = L.halfX - L.halfW - kerbW + 1.2;   // runs off-screen
  const walkTex = paverTexture(T.walk, T.walkJoint, pxu, walkW, roadLen, r, { tile: world === 'world2' ? 0.9 : 0.5, style: world === 'world1' ? 'brick' : 'grid' });
  for (const s of [-1, 1]) {
    const kx = s * (L.halfW + kerbW / 2);
    const kerbMat = world === 'world2' ? std(0xffffff, 0.7, { map: hazardTex(pxu, kerbW, roadLen) }) : std(T.kerb, 0.7);
    g.add(rbox(kerbW, 0.16, Z(L.breachZ) - Z(z0), 0.04, kerbMat, kx, 0.08, (Z(z0) + Z(L.breachZ)) / 2));
    const wx = s * (L.halfW + kerbW + walkW / 2);
    const walk = plane(walkW, Z(L.breachZ) - Z(z0), std(0xffffff, 0.9, { map: walkTex }), wx, 0.1, (Z(z0) + Z(L.breachZ)) / 2);
    g.add(walk);
    // Drain grates in the gutter.
    for (let gz = L.topZ + 4 + r() * 3; gz < L.breachZ - 3; gz += 9 + r() * 3) {
      g.add(box(0.28, 0.012, Z(0.6) - Z(0), std(0x2A2C31, 0.6, { metalness: 0.4 }), s * (L.halfW - 0.2), 0.006, Z(gz)));
      for (let k = 0; k < 5; k++) g.add(box(0.2, 0.014, 0.025, std(0x121318, 0.8), s * (L.halfW - 0.2), 0.008, Z(gz) - Z(0.24) + k * Z(0.12)));
    }
  }
  // Manhole covers on the road.
  for (let i = 0; i < 2; i++) {
    const mx = pick(r, L.laneXs) + (r() - 0.5) * 1.2, mz = L.topZ + 6 + r() * (roadLen - 14);
    const cover = cyl(0.42, 0.42, 0.012, std(night ? 0x3A3E50 : 0x5A5C62, 0.5, { metalness: 0.5 }), mx, 0.006, Z(mz), 28);
    cover.scale.z = 1 / cT;
    g.add(cover);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 6, 28), std(0x3A3C42, 0.5, { metalness: 0.6 }));
    ring.rotation.x = -Math.PI / 2; ring.scale.y = 1 / cT; ring.position.set(mx, 0.014, Z(mz));
    g.add(ring);
    for (let k = -2; k <= 2; k++) g.add(box(0.6 - Math.abs(k) * 0.1, 0.016, 0.03, std(0x3A3C42, 0.5), mx, 0.014, Z(mz + k * 0.14)));
  }

  // 3. Sidewalk furniture + edge buildings, per side.
  for (const s of [-1, 1]) {
    const walkIn = s * (L.halfW + kerbW + 0.45);       // furniture line near the kerb
    const bandIn = s * (L.halfW + kerbW + (world === 'world1' ? 1.35 : 1.05));   // buildings start here
    // Lamps.
    lampZs.forEach((lz, i) => {
      const lp = lamp(T, r, night, -s);
      lp.position.set(walkIn, 0.1, Z(lz + (s > 0 ? 3.3 : 0)));
      g.add(lp);
    });
    // Trees in pits / planters between lamps.
    let tz = L.topZ + 1 + r() * 2;
    while (tz < L.breachZ - 1.2) {
      const kind = r();
      const px = walkIn + s * 0.1;
      if (world === 'world1') {
        if (kind < 0.55) {
          const pit = cyl(0.36, 0.36, 0.02, std(0x3A3C42, 0.5, { metalness: 0.5 }), px, 0.11, Z(tz), 24); pit.scale.z = 1 / cT; g.add(pit);
          const soil = cyl(0.26, 0.26, 0.022, std(0x4A3526, 0.95), px, 0.115, Z(tz), 24); soil.scale.z = 1 / cT; g.add(soil);
          const t = tree(T, r, 0.95 + r() * 0.25); t.position.set(px, 0.1, Z(tz)); g.add(t);
        } else if (kind < 0.72) {
          const fb = flowerBed(T, r, 0.62, 1.1); fb.position.set(px, 0.1, Z(tz)); g.add(fb);
        } else if (kind < 0.86) {
          const b = bench(r); b.position.set(px + s * 0.1, 0.1, Z(tz)); if (s > 0) b.rotation.y = Math.PI; g.add(b);
        } else {
          const h = hydrant(); h.position.set(px - s * 0.12, 0.1, Z(tz)); g.add(h);
          const bi = bin(); bi.position.set(px + s * 0.1, 0.1, Z(tz + 0.9)); g.add(bi);
        }
      } else if (world === 'world2') {
        if (kind < 0.35) { const c = cone(); c.position.set(px - s * 0.1, 0.1, Z(tz)); g.add(c); const c2 = cone(); c2.position.set(px - s * 0.1, 0.1, Z(tz + 0.7)); g.add(c2); }
        else if (kind < 0.6) { for (let k = 0; k < 3; k++) { const b = bollard(0xFFC21A); b.position.set(px - s * 0.15, 0.1, Z(tz + k * 0.8)); g.add(b); } }
        else if (kind < 0.8) { const p = pallet(r); p.position.set(px, 0.1, Z(tz)); p.rotation.y = r() * 0.4; g.add(p); }
        else { const t = tree(T, r, 0.8); t.position.set(px, 0.1, Z(tz)); g.add(t); }
      } else {
        if (kind < 0.4) { const t = tree(T, r, 0.85); t.position.set(px, 0.1, Z(tz)); g.add(t); }
        else if (kind < 0.7) { const b = bollard(0x4A4E62); b.position.set(px - s * 0.1, 0.1, Z(tz)); g.add(b); const b2 = bollard(0x4A4E62); b2.position.set(px - s * 0.1, 0.1, Z(tz + 0.7)); g.add(b2); }
        else { const n = neonSign(T, r, 0.9); n.position.set(px + s * 0.15, 0.1, Z(tz)); n.rotation.y = Math.PI / 2; g.add(n); }
      }
      tz += 1.8 + r() * 1.6;
    }
    // Buildings / yards beyond the sidewalk (mostly off-screen: we see their
    // street edge — rooftops, awnings, café tables).
    let bz = L.topZ - 1.5;
    while (bz < L.breachZ + 0.5) {
      const d = world === 'world2' ? 3.2 + r() * 1.6 : 2.0 + r() * 1.2;
      const w = 2.6 + r() * 0.8;
      const cx = bandIn + s * w / 2;
      const zc = bz + d / 2;
      if (world === 'world1') {
        const h = 1.0 + r() * 0.9;
        const hs = townHouse(T, r, w, Z(d) - Z(0) - 0.25, h, -s);
        hs.position.set(cx, 0.1, Z(zc));
        g.add(hs);
        if (r() < 0.55) {   // shopfront awning facing the street + café table
          const aw = awning(Math.min(1.6, Z(d) - Z(0) - 0.6), pick(r, T.awnings), -s);
          aw.position.set(cx - s * (w / 2 + 0.22), 0.1 + Math.min(1.0, h * 0.75), Z(zc));
          g.add(aw);
          if (r() < 0.6) { const p = parasol(r, pick(r, T.awnings)); p.position.set(bandIn - s * 0.35, 0.1, Z(zc + 0.2)); g.add(p); }
        }
      } else if (world === 'world2') {
        if (r() < 0.55) {
          const wh = warehouse(T, r, w, Z(d) - Z(0) - 0.3, 1.3 + r() * 0.6);
          wh.position.set(cx, 0.1, Z(zc));
          g.add(wh);
        } else {
          // Container yard behind a fence.
          const f = fence(Z(d) - Z(0) - 0.2); f.position.set(bandIn + s * 0.05, 0.1, Z(zc)); g.add(f);
          const cols = [0x2F8CFF, 0xE8453C, 0x2FA36B, 0xFF8A1C, 0x6E7B88];
          for (let k = 0; k < 2; k++) {
            const sc = shippingContainer(r, cols); sc.position.set(bandIn + s * (0.7 + k * 1.0), 0.1, Z(zc)); g.add(sc);
            if (r() < 0.45) { const top = shippingContainer(r, cols); top.position.set(bandIn + s * (0.7 + k * 1.0), 1.0, Z(zc) + 0.2); g.add(top); }
          }
          for (let k = 0; k < 3; k++) { const dr = drum(pick(r, [0x2F8CFF, 0xE0574A, 0x2FA36B])); dr.position.set(bandIn + s * (0.3 + r() * 0.3), 0.1, Z(zc - d / 2 + 0.4 + k * 0.4)); g.add(dr); }
        }
      } else {
        const h = 1.8 + r() * 2.2;
        const tw = tower(T, r, w, Z(d) - Z(0) - 0.3, h);
        tw.position.set(cx, 0.1, Z(zc));
        g.add(tw);
      }
      bz += d;
    }
    // Ground under buildings (lawn / lot / dark plaza), off the sidewalk.
    const lotW = 5;
    const lot = plane(lotW, Z(z1) - Z(z0), world === 'world1' ? std(0xffffff, 0.95, { map: grassTexture(T.lawn, 32, lotW, z1 - z0, r) }) : std(world === 'world2' ? 0x8E9196 : 0x1C1E28, 0.95),
      s * (L.halfW + kerbW + walkW + lotW / 2 - 1.3), 0.09, (Z(z0) + Z(z1)) / 2);
    g.add(lot);
  }

  // 4. Bomb depot: from the breach down past the bar top, full width.
  const dz0 = L.breachZ, dz1 = z1;
  const depotW = L.halfX * 2 + 4;
  const depotTex = paverTexture(T.depot, T.depotJoint, pxu, depotW, dz1 - dz0, r, { tile: world === 'world2' ? 1.0 : 0.6, style: world === 'world1' ? 'herring' : 'grid' });
  g.add(plane(depotW, Z(dz1) - Z(dz0), std(0xffffff, night ? 0.5 : 0.9, { map: depotTex, metalness: night ? 0.2 : 0 }), 0, 0.02, (Z(dz0) + Z(dz1)) / 2));
  // A low wall with the stop line on top where road meets depot.
  g.add(rbox(L.halfW * 2 + 0.6, 0.12, Z(0.34) - Z(0), 0.04, std(world === 'world2' ? 0xFFC21A : T.kerb, 0.6), 0, 0.06, Z(dz0 + 0.17)));
  // Launch bays: a recessed channel continuing each lane into its bomb column,
  // with a metal-rimmed cradle under every bomb slot (the bomb sits IN it).
  const rimM = night ? std(0x5A5F78, 0.3, { metalness: 0.7 }) : std(world === 'world2' ? 0x9EA3AA : 0xE9E3D6, 0.35, { metalness: world === 'world2' ? 0.6 : 0.1 });
  for (const lx of L.laneXs) {
    const tw = L.bombR * 3.3, tLen = (L.slotZs.at(-1) + L.bombR * 2.2) - dz0;
    const zc = Z(dz0 + tLen / 2), zl = Z(tLen) - Z(0);
    g.add(rbox(tw + 0.24, 0.06, zl + 0.2, 0.08, rimM, lx, 0.03, zc));
    g.add(rbox(tw, 0.07, zl, 0.12, std(mix(T.track, 0x000000, 0.15), night ? 0.35 : 0.75, { metalness: night ? 0.3 : 0 }), lx, 0.04, zc));
    for (const sz of L.slotZs) {
      const pad = cyl(L.bombR * 1.28, L.bombR * 1.2, 0.05, std(mix(T.track, 0x000000, 0.55), 0.6), lx, 0.08, Z(sz), 36);
      pad.scale.z = 1 / cT;
      g.add(pad);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(L.bombR * 1.3, 0.035, 8, 40), night ? glow(T.trackEdge) : std(mix(T.track, 0xFFFFFF, 0.35), 0.4));
      ring.rotation.x = -Math.PI / 2; ring.scale.y = 1 / cT;
      ring.position.set(lx, 0.11, Z(sz));
      g.add(ring);
    }
    // Chevrons between the cradles, pointing up the lane toward the road.
    for (let k = 0; k < L.slotZs.length; k++) {
      const cz = k === 0 ? dz0 + 0.45 : (L.slotZs[k - 1] + L.slotZs[k]) / 2;
      for (const sx of [-1, 1]) {
        const c = box(0.3, 0.012, 0.07, night ? glow(T.trackEdge) : std(T.trackEdge, 0.5), lx + sx * 0.12, 0.085, Z(cz));
        c.rotation.y = sx * 0.6;
        g.add(c);
      }
    }
  }
  // Depot dressing on the outer flanks (beside the columns, off the road width).
  for (const s of [-1, 1]) {
    const fx = s * (L.halfW + 1.1);
    if (world === 'world1') {
      const t = tree(T, r, 1.0); t.position.set(fx + s * 0.4, 0.02, Z(dz0 + 1.6)); g.add(t);
      const fb = flowerBed(T, r, 0.9, 1.4); fb.position.set(fx, 0.02, Z(dz0 + 4.4)); g.add(fb);
      const pp = planterPot(T, r, 1.1); pp.position.set(fx - s * 0.3, 0.02, Z(dz0 + 6.3)); g.add(pp);
    } else if (world === 'world2') {
      for (let k = 0; k < 3; k++) { const dr = drum(pick(r, [0xFFC21A, 0x2F8CFF, 0xE0574A])); dr.position.set(fx + s * (k % 2) * 0.35, 0.02, Z(dz0 + 1.2 + k * 0.45)); g.add(dr); }
      const p = pallet(r); p.position.set(fx, 0.02, Z(dz0 + 4.4)); g.add(p);
      const c = cone(); c.position.set(fx - s * 0.2, 0.02, Z(dz0 + 6.2)); g.add(c);
    } else {
      const n = neonSign(T, r, 1.1); n.position.set(fx + s * 0.2, 0.02, Z(dz0 + 2.2)); g.add(n);
      const t = tree(T, r, 0.9); t.position.set(fx, 0.02, Z(dz0 + 5.0)); g.add(t);
    }
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = !o.material.isMeshBasicMaterial; o.receiveShadow = true; } });
  road.castShadow = false;
  return g;
}

// Yellow/black hazard kerb texture (industrial world).
function hazardTex(pxu, wU, lU) {
  const [c, x] = canvas(32, 64);
  x.fillStyle = '#FFC21A'; x.fillRect(0, 0, 32, 64);
  x.fillStyle = '#2A2733';
  x.beginPath(); x.moveTo(0, 0); x.lineTo(32, 0); x.lineTo(32, 16); x.lineTo(0, 48); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(0, 64); x.lineTo(0, 64); x.lineTo(32, 32); x.lineTo(32, 48); x.lineTo(16, 64); x.closePath(); x.fill();
  const t = toTex(c);
  t.repeat.set(1, lU / 0.8);
  return t;
}

// ── Render ──────────────────────────────────────────────────────────────────
// Returns a canvas W×H (stage px × scale) with the backdrop exactly covering
// the stage: ground (x, zGame) → stage (worldXToScreenX, zToScreenY).
export function renderBackdrop(renderer, world, variant, L, { scale = 2, ss = 2 } = {}) {
  const T = THEME[world];
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = T.sun.env;
  scene.background = null;
  scene.add(new THREE.HemisphereLight(T.sun.hemi[0], T.sun.hemi[1], T.sun.hemi[2]));
  const sun = new THREE.DirectionalLight(T.sun.color, T.sun.intensity);
  // Same direction as the vehicle key light (studio.js: -5, 12, 4).
  sun.position.set(-7, 10, 4).multiplyScalar(4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 2;
  sun.shadow.blurSamples = 12;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  const cT = Math.cos(L.tilt);
  const span = Math.max(L.halfX * 2 + 6, (L.bottomZ - L.topZ + 8) / cT) * 0.62;
  Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 140 });
  const zMid = ((L.topZ + L.bottomZ) / 2) / cT;
  sun.target.position.set(0, 0, zMid);
  sun.position.add(new THREE.Vector3(0, 0, zMid));
  scene.add(sun, sun.target);
  if (world === 'world3') {
    // Coloured neon fill from the flanks.
    const a = new THREE.DirectionalLight(0xFF3DB8, 0.35); a.position.set(-10, 6, zMid); scene.add(a);
    const b = new THREE.DirectionalLight(0x4FE3FF, 0.35); b.position.set(10, 6, zMid); scene.add(b);
  }

  const obj = buildBackdrop(world, variant, L);
  scene.add(obj);

  const W = Math.round(390 * scale), H = Math.round(844 * scale);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  camera.position.set(0, Math.cos(L.tilt) * 120, Math.sin(L.tilt) * 120 + zMid);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, zMid);
  camera.updateMatrixWorld(true);
  // Vertical extents: project the stage's top/bottom ground points.
  const inv = camera.matrixWorldInverse;
  const pTop = new THREE.Vector3(0, 0, L.topZ / cT).applyMatrix4(inv);
  const pBot = new THREE.Vector3(0, 0, L.bottomZ / cT).applyMatrix4(inv);
  Object.assign(camera, { left: -L.halfX, right: L.halfX, top: pTop.y, bottom: pBot.y });
  camera.updateProjectionMatrix();

  const prev = { tm: renderer.toneMapping, exp: renderer.toneMappingExposure };
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = T.sun.exposure;
  renderer.setClearColor(0x000000, 1);
  renderer.setSize(W * ss, H * ss, false);
  renderer.render(scene, camera);
  const [c, x] = canvas(W, H);
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(renderer.domElement, 0, 0, W, H);
  // Soft vignette on the far flanks only (keeps the eye on the road).
  const vg = x.createLinearGradient(0, 0, W, 0);
  vg.addColorStop(0, 'rgba(10,8,24,0.28)'); vg.addColorStop(0.09, 'rgba(10,8,24,0)');
  vg.addColorStop(0.91, 'rgba(10,8,24,0)'); vg.addColorStop(1, 'rgba(10,8,24,0.28)');
  x.fillStyle = vg; x.fillRect(0, 0, W, H);

  renderer.toneMapping = prev.tm; renderer.toneMappingExposure = prev.exp;
  renderer.setClearColor(0x000000, 0);
  obj.traverse(o => { if (o.isMesh) { o.geometry.dispose(); const m = o.material; m.map?.dispose?.(); m.dispose?.(); } });
  pmrem.dispose();
  return c;
}
