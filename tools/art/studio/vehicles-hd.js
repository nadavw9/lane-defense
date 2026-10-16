// Premium vehicle models for the sprite studio (2026-09-28).
//
// Replaces the first-pass box-built toys: every body is a curved SIDE PROFILE
// extruded across the width with a generous bevel (the way a real car body
// reads from above — hood, windscreen, roof and boot as one continuous shell),
// with inset glass, chrome, lit head/tail lights, arches, seams, mirrors and
// proper wheels. Proportions stay chunky (the studio's CHUNK widening) so the
// cars remain readable at gameplay size.
//
// Conventions (same as studio.js): +Z = vehicle FRONT (screen bottom), +Y up,
// X = width. Units ≈ metres at toy scale; a sedan is ~4.2 long.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ── Materials ────────────────────────────────────────────────────────────────
export const paintHD = (hex) => new THREE.MeshPhysicalMaterial({
  color: hex, roughness: 0.45, metalness: 0.05, clearcoat: 0.55, clearcoatRoughness: 0.18,
});
const shade = (hex, f) => new THREE.Color(hex).multiplyScalar(f).getHex();
export const MHD = {
  glass:   new THREE.MeshPhysicalMaterial({ color: 0x152238, roughness: 0.04, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.02 }),
  tint:    new THREE.MeshPhysicalMaterial({ color: 0x0E1626, roughness: 0.08, metalness: 0.4, clearcoat: 1 }),
  tyre:    new THREE.MeshStandardMaterial({ color: 0x1D1B22, roughness: 0.92 }),
  rim:     new THREE.MeshStandardMaterial({ color: 0xC9D0DA, roughness: 0.22, metalness: 0.95 }),
  rimDark: new THREE.MeshStandardMaterial({ color: 0x3C3F48, roughness: 0.35, metalness: 0.8 }),
  chrome:  new THREE.MeshStandardMaterial({ color: 0xE8EDF3, roughness: 0.12, metalness: 1.0 }),
  trim:    new THREE.MeshStandardMaterial({ color: 0x23222B, roughness: 0.55 }),
  arch:    new THREE.MeshStandardMaterial({ color: 0x0C0B10, roughness: 1.0 }),
  grille:  new THREE.MeshStandardMaterial({ color: 0x15141A, roughness: 0.45, metalness: 0.4 }),
  head:    new THREE.MeshBasicMaterial({ color: 0xFFF7D6 }),
  headRim: new THREE.MeshStandardMaterial({ color: 0xDCE3EC, roughness: 0.15, metalness: 0.9 }),
  tail:    new THREE.MeshBasicMaterial({ color: 0xFF2E3F }),
  amber:   new THREE.MeshBasicMaterial({ color: 0xFFA227 }),
  plate:   new THREE.MeshStandardMaterial({ color: 0xF4F1E6, roughness: 0.5 }),
  seam:    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
  crease:  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.14 }),
  glint:   new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.28 }),
  steelHD: new THREE.MeshStandardMaterial({ color: 0x9098A6, roughness: 0.35, metalness: 0.9 }),
  rubber:  new THREE.MeshStandardMaterial({ color: 0x2A2830, roughness: 0.8 }),
  leather: new THREE.MeshStandardMaterial({ color: 0x2B2530, roughness: 0.6 }),
  visor:   new THREE.MeshPhysicalMaterial({ color: 0x1B2745, roughness: 0.05, metalness: 0.6, clearcoat: 1 }),
};

// ── Geometry helpers ─────────────────────────────────────────────────────────
function rbox(w, h, d, r, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.max(0.001, Math.min(r, w / 2, h / 2, d / 2) - 1e-3)), mat);
  m.position.set(x, y, z);
  return m;
}

// Side profile path in the (z, y) plane: ['M', z, y], ['L', z, y],
// ['Q', cz, cy, z, y], ['C', c1z, c1y, c2z, c2y, z, y]. Extruded across the
// width (X), centred, with a rounded bevel on every edge.
function profile(cmds, width, bevel, mat, { segs = 5, x = 0 } = {}) {
  const s = new THREE.Shape();
  for (const c of cmds) {
    if (c[0] === 'M') s.moveTo(c[1], c[2]);
    else if (c[0] === 'L') s.lineTo(c[1], c[2]);
    else if (c[0] === 'Q') s.quadraticCurveTo(c[1], c[2], c[3], c[4]);
    else if (c[0] === 'C') s.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]);
  }
  s.closePath();
  const depth = Math.max(0.01, width - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(s, {
    depth, curveSegments: 20, bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel * 0.85, bevelSegments: segs,
  });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);          // shape x → world z (front), extrude → world x
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.position.x = x;
  return m;
}

// A flat panel lying along a slope between two (z, y) points — windscreens,
// rear windows. `inset` shrinks it from the ends; `lift` pushes it off the shell.
function slopePanel(z0, y0, z1, y1, width, mat, { inset = 0.06, lift = 0.012, thick = 0.02, r = 0.06 } = {}) {
  const dz = z1 - z0, dy = y1 - y0, len = Math.hypot(dz, dy);
  const m = rbox(width, thick, Math.max(0.02, len - 2 * inset), r, mat);
  const ang = Math.atan2(dy, dz);
  m.rotation.x = -ang;
  const nz = -dy / len, ny = dz / len;           // outward normal of the slope (toward the top/outside)
  m.position.set(0, (y0 + y1) / 2 + ny * lift, (z0 + z1) / 2 + nz * lift);
  return m;
}

// Wheel: tyre with sidewall bevel, alloy rim with spokes, dark arch behind.
function wheelHD(x, z, r = 0.4, w = 0.32, { spokes = 5, archR = null, rimMat = MHD.rim } = {}) {
  const g = new THREE.Group();
  const side = Math.sign(x) || 1;
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 36, 1), MHD.tyre);
  tyre.rotation.z = Math.PI / 2;
  const wall = new THREE.Mesh(new THREE.TorusGeometry(r * 0.86, r * 0.14, 10, 36), MHD.tyre);
  wall.rotation.y = Math.PI / 2;
  wall.position.x = side * w / 2;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.04, 28), rimMat);
  rim.rotation.z = Math.PI / 2;
  rim.position.x = side * (w / 2 + 0.01);
  g.add(tyre, wall, rim);
  for (let i = 0; i < spokes; i++) {
    const sp = rbox(0.03, r * 1.1, 0.09, 0.015, MHD.rimDark);
    sp.rotation.x = (i / spokes) * Math.PI;
    sp.position.x = side * (w / 2 + 0.03);
    g.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.16, r * 0.16, 0.06, 16), MHD.chrome);
  hub.rotation.z = Math.PI / 2;
  hub.position.x = side * (w / 2 + 0.035);
  g.add(hub);
  g.position.set(x, r, z);
  const out = new THREE.Group();
  out.add(g);
  if (archR) {
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(archR, archR, w * 0.9, 28, 1, false, 0, Math.PI), MHD.arch);
    arch.rotation.z = Math.PI / 2;
    arch.rotation.y = Math.PI / 2;
    arch.position.set(x - side * 0.02, r, z);
    out.add(arch);
  }
  return out;
}

function light(mat, w, h, d, x, y, z, r = 0.04) { return rbox(w, h, d, r, mat, x, y, z); }

// PLAN-VIEW solid: an outline in the (x, z) plane (+z = front), extruded UP
// from y0 to y1 with a rounded bevel on the top and bottom edges. From above a
// vehicle is read by its plan silhouette — tapered nose, fender bulges, waist —
// so bodies are built this way. The outline is inset by the bevel so the
// finished solid lands on the given outline. Commands as `profile`, in (x, z).
function plan(cmds, y0, y1, bevel, mat, { segs = 6 } = {}) {
  const s = new THREE.Shape();
  for (const c of cmds) {
    if (c[0] === 'M') s.moveTo(c[1], -c[2]);
    else if (c[0] === 'L') s.lineTo(c[1], -c[2]);
    else if (c[0] === 'Q') s.quadraticCurveTo(c[1], -c[2], c[3], -c[4]);
    else if (c[0] === 'C') s.bezierCurveTo(c[1], -c[2], c[3], -c[4], c[5], -c[6]);
  }
  s.closePath();
  const bt = Math.min(bevel, (y1 - y0) / 2 - 0.005);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.005, y1 - y0 - 2 * bt), curveSegments: 24, bevelEnabled: bevel > 0,
    bevelThickness: bt, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: segs,
  });
  g.rotateX(-Math.PI / 2);            // shape (x, -z) → world (x, z); extrude → +y
  g.translate(0, y0 + bt, 0);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

// Symmetric plan outline from a half-profile: [[x, z], ...] listed front → back
// on the RIGHT side (x > 0); mirrored for the left. Smoothed with quadratic
// joins through the midpoints so the silhouette flows.
function symPlan(half) {
  const pts = [...half, ...half.slice().reverse().map(([x, z]) => [-x, z])];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const n = pts.length;
  const cmds = [['M', ...mid(pts[n - 1], pts[0])]];
  for (let i = 0; i < n; i++) cmds.push(['Q', ...pts[i], ...mid(pts[i], pts[(i + 1) % n])]);
  return cmds;
}

// A diagonal light streak on glass — the cue that it IS glass.
function glint(w, x, y, z) {
  const m = rbox(w, 0.01, 0.07, 0.03, MHD.glint, x, y, z);
  m.rotation.y = 0.6;
  return m;
}

// A flat decal plate sitting on a top surface (lights, stripes, seams).
function decal(w, d, mat, x, y, z, r = 0.04) { return rbox(w, 0.03, d, r, mat, x, y, z); }


function seam(x, y, z, h, d = 0.02) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.012, h, d), MHD.seam);
  m.position.set(x, y, z);
  return m;
}

// ── Vehicles ─────────────────────────────────────────────────────────────────
export const BUILD_HD = {
  // Sport bike + rider in matching leathers. Chunky fairing so it reads.
  small(c) {
    const g = new THREE.Group(), p = paintHD(c), pd = paintHD(shade(c, 0.55));
    g.add(wheelHD(0, 0.74, 0.36, 0.2, { spokes: 3, rimMat: MHD.rimDark }), wheelHD(0, -0.72, 0.38, 0.24, { spokes: 3, rimMat: MHD.rimDark }));
    // Fairing + tank + tail as one profile.
    g.add(profile([['M', -0.95, 0.62], ['L', -0.7, 0.98], ['Q', -0.45, 1.02, -0.2, 0.9], ['L', 0.25, 0.98],
      ['Q', 0.7, 1.12, 0.95, 0.86], ['Q', 1.02, 0.62, 0.8, 0.46], ['L', -0.55, 0.42], ['Z']], 0.5, 0.12, p));
    g.add(rbox(0.26, 0.1, 0.5, 0.05, MHD.leather, 0, 0.98, -0.42));          // seat
    g.add(slopePanel(0.62, 1.1, 0.9, 0.9, 0.34, MHD.tint, { inset: 0.02 }));  // screen
    g.add(light(MHD.head, 0.24, 0.1, 0.06, 0, 0.78, 0.97, 0.04));
    g.add(light(MHD.tail, 0.18, 0.06, 0.05, 0, 0.94, -0.95, 0.02));
    // Rider: torso leaning forward, arms to the bars, helmet with visor.
    const torso = rbox(0.5, 0.62, 0.42, 0.2, pd, 0, 1.3, -0.18);
    torso.rotation.x = 0.45;
    g.add(torso);
    for (const sd of [-1, 1]) {
      const arm = rbox(0.14, 0.14, 0.62, 0.07, pd, sd * 0.3, 1.27, 0.2);
      arm.rotation.x = 0.35;
      g.add(arm);
    }
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.26, 32, 20), p);
    helmet.position.set(0, 1.62, 0.12);
    helmet.scale.set(1, 0.95, 1.12);
    const visor = rbox(0.36, 0.16, 0.14, 0.07, MHD.visor, 0, 1.6, 0.36);
    visor.rotation.x = 0.35;
    g.add(helmet, visor);
    g.add(rbox(0.06, 0.02, 0.4, 0.01, MHD.glint, 0.09, 1.885, 0.08));         // helmet stripe
    g.add(rbox(0.8, 0.05, 0.05, 0.02, MHD.chrome, 0, 1.12, 0.52));           // bars
    for (const sd of [-1, 1]) g.add(rbox(0.08, 0.06, 0.1, 0.03, MHD.chrome, sd * 0.2, 1.15, 0.72));   // mirrors
    return g;
  },

  // Sport coupe, modelled in PLAN: tapered nose, front and rear fender bulges,
  // a pinched waist, a glass greenhouse and a painted roof on top of it.
  big(c) {
    const g = new THREE.Group(), p = paintHD(c), pd = paintHD(shade(c, 0.72));
    for (const [x, z] of [[-0.86, 1.3], [0.86, 1.3], [-0.86, -1.3], [0.86, -1.3]]) g.add(wheelHD(x, z, 0.38, 0.3));
    const body = symPlan([[0.55, 2.12], [0.9, 1.98], [1.0, 1.35], [0.94, 0.3], [0.95, -0.4], [1.02, -1.3], [0.92, -1.95], [0.6, -2.1]]);
    g.add(plan(body, 0.26, 0.9, 0.24, p));
    // Bumper bands (dark, slightly lower) front and back.
    g.add(plan(symPlan([[0.62, 2.16], [0.86, 2.02], [0.8, 1.9], [0.5, 1.98]]), 0.26, 0.5, 0.08, MHD.trim));
    g.add(plan(symPlan([[0.8, -1.98], [0.62, -2.14], [0.5, -2.02], [0.76, -1.9]]), 0.26, 0.5, 0.08, MHD.trim));
    // Greenhouse (glass) and roof.
    g.add(plan(symPlan([[0.66, 0.92], [0.78, 0.5], [0.8, -0.7], [0.7, -1.12]]), 0.8, 1.38, 0.2, MHD.glass));
    g.add(plan(symPlan([[0.52, 0.34], [0.6, 0.1], [0.62, -0.5], [0.52, -0.72]]), 1.34, 1.46, 0.05, p));
    // Hood and boot details.
    for (const sd of [-1, 1]) {
      g.add(decal(0.04, 0.8, MHD.crease, sd * 0.36, 0.905, 1.42, 0.02));        // hood creases
      g.add(decal(0.46, 0.18, MHD.headRim, sd * 0.56, 0.9, 1.9, 0.08));         // headlight housing
      g.add(decal(0.38, 0.11, MHD.head, sd * 0.56, 0.915, 1.91, 0.05));         // lamp
      g.add(decal(0.4, 0.1, MHD.tail, sd * 0.56, 0.91, -1.95, 0.04));           // tail lamp
      g.add(rbox(0.2, 0.1, 0.16, 0.05, p, sd * 0.93, 1.02, 0.78));              // mirror
    }
    g.add(decal(1.12, 0.1, pd, 0, 0.93, -1.72, 0.05));                          // boot spoiler
    g.add(glint(0.5, 0.25, 1.36, 0.72));                                        // windscreen glint
    return g;
  },

  // Chunky van: short hood, tall glass band all round, painted roof with rails.
  jeep(c) {
    const g = new THREE.Group(), p = paintHD(c);
    for (const [x, z] of [[-0.9, 1.4], [0.9, 1.4], [-0.9, -1.45], [0.9, -1.45]]) g.add(wheelHD(x, z, 0.42, 0.32));
    g.add(plan(symPlan([[0.7, 2.22], [0.98, 2.06], [1.04, 1.35], [1.02, -1.9], [0.86, -2.2]]), 0.3, 1.12, 0.24, p));
    g.add(plan(symPlan([[0.62, 2.24], [0.9, 2.1], [0.84, 2.0], [0.5, 2.08]]), 0.3, 0.56, 0.08, MHD.trim));
    g.add(plan(symPlan([[0.66, 1.52], [0.9, 1.22], [0.94, -1.92], [0.8, -2.1]]), 1.0, 1.78, 0.2, MHD.glass));
    g.add(plan(symPlan([[0.6, 1.16], [0.84, 0.94], [0.88, -1.86], [0.74, -2.0]]), 1.72, 1.9, 0.07, p));
    for (const sd of [-1, 1]) {
      g.add(rbox(0.06, 0.08, 2.7, 0.03, MHD.chrome, sd * 0.66, 1.95, -0.45));   // roof rails
      g.add(decal(0.44, 0.18, MHD.headRim, sd * 0.6, 1.12, 1.98, 0.08));
      g.add(decal(0.36, 0.11, MHD.head, sd * 0.6, 1.135, 1.99, 0.05));
      g.add(decal(0.16, 0.34, MHD.tail, sd * 0.84, 1.13, -1.98, 0.04));
      g.add(rbox(0.2, 0.12, 0.16, 0.05, p, sd * 1.02, 1.24, 1.3));             // mirror
    }
    for (const z of [-1.3, 0.1]) g.add(rbox(1.4, 0.05, 0.08, 0.02, MHD.rubber, 0, 1.99, z));
    g.add(glint(0.7, 0.3, 1.66, 1.42));
    return g;
  },

  // Tanker: cab up front, polished tank with chrome bands and a catwalk.
  truck(c) {
    const g = new THREE.Group(), p = paintHD(c);
    for (const z of [1.7, -0.6, -1.5]) g.add(wheelHD(-0.92, z, 0.44, 0.34), wheelHD(0.92, z, 0.44, 0.34));
    g.add(rbox(1.7, 0.3, 4.6, 0.08, MHD.trim, 0, 0.55, -0.1));
    g.add(plan(symPlan([[0.72, 2.42], [0.98, 2.28], [1.02, 1.3], [0.98, 0.86]]), 0.42, 1.42, 0.22, p));
    g.add(plan(symPlan([[0.66, 2.04], [0.9, 1.82], [0.92, 1.0], [0.84, 0.9]]), 1.3, 2.02, 0.18, MHD.glass));
    g.add(plan(symPlan([[0.62, 1.74], [0.86, 1.56], [0.88, 1.02], [0.8, 0.94]]), 1.96, 2.12, 0.06, p));
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 2.1, 12, 36), paintHD(shade(c, 0.95)));
    tank.rotation.x = Math.PI / 2;
    tank.position.set(0, 1.45, -0.85);
    g.add(tank);
    for (const z of [-1.95, -0.85, 0.25]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.905, 0.035, 10, 40), MHD.chrome);
      ring.position.set(0, 1.45, z);
      g.add(ring);
    }
    g.add(rbox(0.46, 0.05, 2.6, 0.02, MHD.steelHD, 0, 2.37, -0.85));
    for (const z of [-1.6, -0.1]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 24), MHD.chrome); h.position.set(0, 2.39, z); g.add(h); }
    for (const sd of [-1, 1]) {
      g.add(decal(0.42, 0.16, MHD.headRim, sd * 0.6, 1.42, 2.22, 0.07));
      g.add(decal(0.34, 0.1, MHD.head, sd * 0.6, 1.435, 2.23, 0.04));
      g.add(rbox(0.12, 0.08, 0.12, 0.03, MHD.amber, sd * 0.55, 2.16, 1.6));
      g.add(rbox(0.22, 0.14, 0.18, 0.05, p, sd * 1.05, 1.6, 1.9));             // mirror
    }
    g.add(decal(1.5, 0.08, MHD.tail, 0, 0.72, -2.4, 0.03));
    g.add(glint(0.7, 0.25, 1.9, 1.9));
    return g;
  },

  // Big rig: flat-nosed cab with sleeper + ribbed trailer in the body colour.
  bigrig(c) {
    const g = new THREE.Group(), p = paintHD(c), pd = paintHD(shade(c, 0.8));
    for (const z of [2.1, 1.0, -1.7, -2.4]) g.add(wheelHD(-0.95, z, 0.44, 0.34), wheelHD(0.95, z, 0.44, 0.34));
    g.add(rbox(1.7, 0.3, 5.4, 0.08, MHD.trim, 0, 0.55, 0));
    g.add(plan(symPlan([[0.74, 2.82], [1.0, 2.66], [1.04, 1.5], [0.98, 1.28]]), 0.45, 1.5, 0.22, p));
    g.add(plan(symPlan([[0.7, 2.5], [0.94, 2.34], [0.96, 1.9], [0.9, 1.8]]), 1.4, 2.1, 0.16, MHD.glass));
    g.add(plan(symPlan([[0.66, 2.28], [0.92, 2.1], [0.96, 1.34], [0.88, 1.26]]), 2.02, 2.42, 0.14, pd));   // sleeper + fairing
    g.add(plan(symPlan([[0.96, 1.1], [1.06, 0.98], [1.06, -2.6], [0.96, -2.72]]), 0.62, 2.62, 0.12, p));   // trailer
    for (let i = 0; i < 8; i++) g.add(decal(1.9, 0.05, MHD.crease, 0, 2.625, -2.45 + i * 0.47, 0.02));
    g.add(decal(0.34, 3.4, MHD.plate, 0, 2.63, -0.8, 0.06));                                              // roof stripe
    for (const sd of [-1, 1]) {
      g.add(decal(0.4, 0.16, MHD.headRim, sd * 0.62, 1.5, 2.62, 0.07));
      g.add(decal(0.32, 0.1, MHD.head, sd * 0.62, 1.515, 2.63, 0.04));
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.4, 16), MHD.chrome);
      st.position.set(sd * 0.92, 2.45, 1.4);
      g.add(st);
      g.add(rbox(0.22, 0.14, 0.18, 0.05, p, sd * 1.08, 1.7, 2.3));
    }
    for (const x of [-0.45, 0, 0.45]) g.add(rbox(0.13, 0.07, 0.1, 0.03, MHD.amber, x, 2.46, 2.2));
    g.add(decal(1.8, 0.08, MHD.tail, 0, 0.9, -2.74, 0.03));
    g.add(glint(0.7, 0.3, 2.06, 2.3));
    return g;
  },

  // Battle tank: sloped hull, tracks with road wheels, faceted turret, long gun.
  tank(c) {
    const g = new THREE.Group(), p = paintHD(c), pd = paintHD(shade(c, 0.72));
    for (const sd of [-1, 1]) {
      g.add(rbox(0.6, 0.72, 4.2, 0.28, MHD.tyre, sd * 1.1, 0.38, 0));
      for (let i = 0; i < 12; i++) g.add(rbox(0.62, 0.05, 0.12, 0.02, MHD.rubber, sd * 1.1, 0.75, -1.9 + i * 0.345));
      for (let i = 0; i < 5; i++) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 20), MHD.rimDark);
        w.rotation.z = Math.PI / 2;
        w.position.set(sd * 1.42, 0.34, -1.5 + i * 0.75);
        g.add(w);
      }
      g.add(rbox(0.66, 0.06, 4.3, 0.03, MHD.rimDark, sd * 1.1, 0.78, 0));       // track guard (steel)
    }
    g.add(plan(symPlan([[0.5, 2.2], [0.8, 1.9], [0.82, -1.9], [0.6, -2.15]]), 0.5, 1.18, 0.16, p));
    g.add(plan(symPlan([[0.34, 0.66], [0.72, 0.32], [0.76, -0.72], [0.46, -1.08]]), 1.16, 1.68, 0.14, pd));
    g.add(plan(symPlan([[0.3, 0.52], [0.62, 0.24], [0.66, -0.64], [0.4, -0.94]]), 1.6, 1.72, 0.05, p));   // turret top
    g.add(decal(1.2, 0.05, MHD.crease, 0, 1.19, 1.0, 0.02));
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.12, 20), pd);
    hatch.position.set(-0.3, 1.7, -0.4);
    g.add(hatch);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 2.2, 20), MHD.rimDark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 1.42, 1.5);
    const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.3, 20), MHD.trim);
    brake.rotation.x = Math.PI / 2;
    brake.position.set(0, 1.42, 2.6);
    g.add(barrel, brake);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 6), MHD.trim);
    ant.position.set(0.45, 2.1, -0.7);
    g.add(ant);
    for (const sd of [-1, 1]) g.add(light(MHD.head, 0.16, 0.08, 0.05, sd * 0.6, 0.95, 2.1, 0.03));
    return g;
  },
};

// ── Boss hauler (premium) ────────────────────────────────────────────────────
// Gunmetal monster truck: sculpted cab with an angry brow and amber eyes, a
// cargo body carrying the black light panel (the game draws the colour
// sequence on it), hazard trim, chrome stacks and a hazard ram. `panel` is the
// panel rectangle in model space so the studio can project it.
export const BOSS_PANEL_HD = { x: 0, y: 2.74, z: -0.95, w: 2.3, d: 3.0 };
export function buildBossHD({ armored = false } = {}) {
  const g = new THREE.Group();
  // Boss magenta (palette "Boss", #CC44CC): the one vehicle no bomb colour matches,
  // bright enough to read as the hero on every road (dark, concrete, night).
  const body = paintHD(0xCC44CC), bodyD = paintHD(0x8E2C8E);
  const HY = new THREE.MeshStandardMaterial({ color: 0xFFD42A, roughness: 0.45 });
  const HK = new THREE.MeshStandardMaterial({ color: 0x1E1C24, roughness: 0.6 });
  for (const z of [2.1, 0.2, -1.9]) for (const sd of [-1, 1]) g.add(wheelHD(sd * 1.45, z, 0.62, 0.5, { spokes: 6, rimMat: MHD.rimDark }));
  g.add(rbox(2.6, 0.4, 5.8, 0.12, MHD.trim, 0, 0.72, 0));
  // Cab.
  g.add(plan(symPlan([[1.1, 2.95], [1.5, 2.75], [1.55, 1.2], [1.45, 0.95]]), 0.8, 2.0, 0.3, body));
  g.add(plan(symPlan([[1.0, 2.55], [1.36, 2.35], [1.4, 1.25], [1.3, 1.05]]), 1.9, 2.42, 0.2, MHD.glass));
  g.add(plan(symPlan([[0.95, 2.2], [1.3, 2.0], [1.34, 1.3], [1.24, 1.12]]), 2.36, 2.5, 0.06, bodyD));
  const brow = rbox(2.6, 0.16, 0.34, 0.07, bodyD, 0, 2.02, 2.62);
  brow.rotation.x = 0.35;
  g.add(brow);
  for (const sd of [-1, 1]) {
    g.add(decal(0.62, 0.26, MHD.headRim, sd * 0.78, 2.0, 2.72, 0.1));
    g.add(decal(0.52, 0.18, new THREE.MeshBasicMaterial({ color: 0xFFC21F }), sd * 0.78, 2.015, 2.73, 0.08));
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.5, 18), MHD.chrome);
    st.position.set(sd * 1.28, 2.7, 0.8);
    g.add(st);
  }
  for (const x of [-1.0, -0.35, 0.35, 1.0]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), MHD.amber);
    b.position.set(x, 2.5, 1.9);
    g.add(b);
  }
  for (let i = 0; i < 7; i++) g.add(rbox(0.22, 0.6, 0.14, 0.05, MHD.chrome, -1.08 + i * 0.36, 1.2, 2.98));
  // Cargo body with the light panel.
  const P = BOSS_PANEL_HD;
  g.add(plan(symPlan([[1.5, 0.75], [1.6, 0.6], [1.6, -2.6], [1.48, -2.8]]), 0.9, P.y, 0.2, body));
  g.add(rbox(P.w, 0.06, P.d, 0.08, new THREE.MeshStandardMaterial({ color: 0x14121C, roughness: 0.3 }), P.x, P.y + 0.02, P.z));
  g.add(rbox(P.w + 0.16, 0.05, P.d + 0.16, 0.08, MHD.chrome, P.x, P.y, P.z));
  for (const sd of [-1, 1]) {
    const trim = new THREE.Group();
    trim.add(rbox(0.24, 0.1, 3.3, 0.04, HK, 0, 0, 0));
    for (let i = 0; i < 8; i++) { const c = rbox(0.25, 0.11, 0.2, 0.02, HY, 0, 0, -1.5 + i * 0.43); c.rotation.x = 0.6; trim.add(c); }
    trim.position.set(sd * 1.42, P.y + 0.03, P.z);
    g.add(trim);
  }
  // Hazard ram.
  const ram = new THREE.Group();
  ram.add(rbox(3.3, 0.5, 0.32, 0.12, HK, 0, 0, 0));
  for (let i = -3; i <= 3; i++) { const c = rbox(0.34, 0.51, 0.33, 0.03, HY, i * 0.47, 0, 0); c.rotation.z = 0.55; ram.add(c); }
  ram.position.set(0, 0.85, 3.1);
  g.add(ram);
  if (armored) {
    const steel = MHD.steelHD;
    for (const sd of [-1, 1]) g.add(rbox(0.12, 0.8, 5.2, 0.05, steel, sd * 1.66, 1.3, 0));
    g.add(rbox(2.5, 0.08, 1.1, 0.04, steel, 0, 2.54, 1.7));
    for (const sd of [-1, 1]) for (const z of [-2, -1, 0, 1, 2]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), MHD.rimDark);
      b.position.set(sd * 1.73, 1.6, z);
      g.add(b);
    }
  }
  return g;
}
