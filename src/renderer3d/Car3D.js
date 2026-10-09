// Car3D — PNG sprite billboards per car type+color + programmatic boss.
// Top-down orthographic view. Pre-colored sprites; material.color stays white.
// Size/shape set by TYPE_DIMS per type.
//
// Sprite files (public/sprites/designed/):
//   small  → bike-{color}.png
//   big    → car-{color}-processed.png
//   jeep   → van-{color}.png
//   truck  → truck-{color}.png
//   bigrig → bigrig-{color}.png
//   tank   → tank-{color}.png (per-color, so the colour-match read is clear)
//   boss   → programmatic CanvasTexture (styled rectangle)

import * as THREE from 'three';
import { CELL, posToZ, laneToX } from './Scene3D.js';
import { ROAD_Z_FAR, POS_NEAR_Z } from './projection.js';
import { CAR_SPRITE_GEOMETRY } from './carSpriteGeometry.js';
import { BOSS_SPRITE_GEOMETRY } from './bossSpriteGeometry.js';
import { isColorblind } from '../game/ColorblindMode.js';
import { drawColorShapeBadge } from './colorShapeCanvas.js';
import { TRAIT_TYPES, isHiddenPhantom } from '../director/TrafficRules.js';

// ── Canvas size for programmatic textures ────────────────────────────────────
const CVS    = 256;
const MARGIN = 8;

// ── Timings ──────────────────────────────────────────────────────────────────
const LERP_DURATION       = 0.25;
const SPAWN_LERP_DURATION = 0.45;  // slower entry so cars glide in rather than snap
const DEATH_DURATION   = 0.25;   // spin + scale-up + fade (1B)
const DEATH_SCALE_MAX  = 1.30;
const DEATH_VY         = 2.5;
const DEATH_SPIN       = Math.PI; // 180° yaw spin, direction = away from centre lane
const MAX_TILT_X       = 0.20;
const SPAWN_OFFSET     = 5.0;   // bigrig half-height=2.52 + frustum margin → fully off-screen
const POWER_FLASH_DUR  = 0.25;
const POWER_SQUASH_DUR = 0.16;   // total squash→stretch→settle duration

// Global car render scale (<1 = smaller). The gap between cars comes from car SIZE
// relative to the on-screen row pitch. gridRows went 11 → 16, so the pitch shrank
// by 10/15; the scale is reduced proportionally (0.65 × 10/15 ≈ 0.43) so adjacent
// rows keep a clear gap instead of overlapping.
const SPRITE_SCALE     = 0.43;   // boss/fallback only — real types use spriteScaleFor()

// ── Per-type sprite scale, derived from the projected row pitch (Bug B) ───────
// One global scale rendered car BODIES at 66%–130% of the row pitch because the
// art padding is wildly inconsistent (sedan body = 78% of its image height, tank
// ≈ 99%): sedans looked tiny while truck/tank/bigrig physically overlapped the
// car behind. spriteScaleFor() normalizes each type's MEASURED body length to
// FIT × row pitch — nothing touches its lane neighbour, and the size ordering
// (bike < sedan < van < truck < tank < bigrig) is preserved.
// BODY_FRAC (alpha-bbox fractions of the sprite image) and cx (body-center X
// offset, + = right of image center) are MEASURED — since the 3D toy art
// (2026-09-27) by scripts/render-3d-sprites.mjs, which bakes the models in
// tools/art/studio and GENERATES carSpriteGeometry.js (solid body + outline
// only; the soft baked shadow is excluded). Every colour shares one geometry,
// so the per-type table is valid for every colour.
const BODY_FRAC = Object.fromEntries(
  [...Object.entries(CAR_SPRITE_GEOMETRY), ['boss', BOSS_SPRITE_GEOMETRY]]
    .map(([t, g]) => [t, { w: g.w, h: g.h, cx: g.cx }]),
);
// Body length as a fraction of the row pitch. The first pass targeted a ~1.9px
// worst gap — it perceptually FUSED (antialiased sprite edges eat ~1px each side,
// and any screenshot downscale erases the rest). Revised 2026-07-11: worst stacked
// pair (bigrig behind bigrig) keeps a ~4px gap — clearly separated at any scale.
// Phase 1 (2026-07-18): +0.10 across the board — cars fill more of the row pitch
// for a ~1.13× on-screen size bump (part of the ~1.3× decoupled car-size increase,
// with the ROAD_Z_FAR/road-band moves in projection.js). No balance cost: the sim
// reads no render geometry. Gaps stay no-touch (0.23→0.13 of the pitch).
// 2026-07-25 ROWS-8 + 2× PILOT (L4-L8): the whole set scaled by k = 0.84138,
// derived (not guessed) from the reference-car measurement — FIT(big) is solved
// so the sedan body lands at exactly 2.00× the SHIPPED 4-lane baseline
// (22.93px @ band 540 / gridRows 16 / FIT .80) at the pilot's geometry
// (gridRows 8, band 600):
//     FIT_big = 2.0 × 22.93px ÷ (rowPitchWu(8) × pxPerWu(600)) = 0.67311
// Per-TYPE, not one collapsed value: the .78-.88 spread is scaled
// proportionally, so type ORDERING (small < big < jeep < truck < tank < bigrig)
// is preserved as §0a requires, and types stay visibly different in size/shape
// per CLAUDE.md §7. Resulting growth runs 1.95× (small) to 2.20× (bigrig).
//
// WHY FIT DROPS while cars get BIGGER — the identity that drove this design:
//     gap / car = (1 − FIT) / FIT        (band and gridRows cancel out entirely)
// Spacing is a pure function of FIT. Halving gridRows doubles the row PITCH, so
// cars grow ~2× even as FIT falls .80 → .673, and the inter-car gap widens from
// 0.25 to ~0.49 car-lengths (~6px → ~22px on screen). Raising FIT back toward
// .88 would re-fuse the cars; lowering it further trades car size for more air
// (FIT .50 = a full car-length gap, but only ~1.79× size — measured, rejected).
const FIT = { small: 0.656, big: 0.673, jeep: 0.690, truck: 0.707, tank: 0.724, bigrig: 0.740 };
// The boss spans 1.5 rows: its lane carries no other traffic, so it can't touch
// a neighbour, and it has to read as the biggest thing on the road. Kept OUT of
// FIT on purpose: projection.MAX_CAR_FIT sizes the row-0 cover band from FIT, and
// a boss never sits on row 0 (boss openings start at row 1).
const BOSS_FIT = 1.75;

// World-unit distance between adjacent rows: cars span ROAD_Z_FAR→POS_NEAR_Z
// over (gridRows-1) steps. gridRows 16 everywhere today, but derive anyway.
function rowPitchWu(gridRows) {
  return (Math.abs(ROAD_Z_FAR) - Math.abs(POS_NEAR_Z)) / (Math.max(2, gridRows) - 1);
}

function spriteScaleFor(type, gridRows) {
  const fit = type === 'boss' ? BOSS_FIT : FIT[type], body = BODY_FRAC[type], dims = TYPE_DIMS[type];
  if (!fit || !body || !dims) return SPRITE_SCALE;   // boss / unknown types
  return fit * rowPitchWu(gridRows) / (CELL * dims.hF * body.h);
}

// ── Idle bob (2A) — gentle continuous up/down so the road feels alive ──────────
const BOB_AMP   = 0.05;                 // world units
const BOB_FREQ  = (2 * Math.PI) / 1.2;  // 1.2s cycle
const BOB_PHASE = 1.3;                  // per-lane phase offset (so they don't sync)

// ── Danger aura (2C) — ramps with absolute proximity to the breach line ────────
// gridRows is now configurable (was 11, now 16), so breach = gridRows - 1.
// BREACH_ROW is now set per-instance via setGridRows().
//
// 2026-07-25 (rows-8 pilot): DANGER_ROWS was a flat 3. That is ~19% of a 16-row
// board — a deliberate "last fifth of the road is scary" read — but 37% of an
// 8-row board, which would leave a third of the board permanently lit and
// destroy the signal (if everything is urgent, nothing is). It is now a
// FRACTION of board depth, clamped to at least 1 row so it never vanishes on a
// very shallow board. At gridRows 16 this returns 3 — byte-identical to before.
const DANGER_ROWS_FRACTION = 3 / 16;    // the shipped 16-row look, as a ratio
function dangerRowsFor(gridRows) {
  return Math.max(1, Math.round((gridRows ?? 16) * DANGER_ROWS_FRACTION));
}
const AURA_RATE = 1 / 0.3;
const AURA_FREQ = 1.4;                  // base pulse; scales up nearer the breach
const AURA_AMP  = 0.3;

// ── Wobble ───────────────────────────────────────────────────────────────────
const WOBBLE_X_AMP   = 0.08;
const WOBBLE_X_FREQ  = 1.1;
const WOBBLE_ROT_AMP = 0.015;
const WOBBLE_ROT_FREQ = 0.9;

// ── Colors ───────────────────────────────────────────────────────────────────
const COLOR_HEX = {
  Red:    0xFF3D3D,
  Blue:   0x2F8CFF,
  Green:  0x2FCC55,
  Yellow: 0xFFD42A,
  Purple: 0xA35CFF,
  Orange: 0xFF8A1C,
  Boss:   0xCC44CC,
};

// ── Per-type plane dimensions (fractions of CELL) ───────────────────────────
// PlaneGeometry = CELL*wF × CELL*hF.
// hF is the length basis; wF = hF × the sprite image's measured aspect
// (carSpriteGeometry.js) so the art is never stretched. The old painted sprites
// were square-ish canvases squeezed onto these planes.
const HF = { small: 0.77, big: 0.77, jeep: 0.81, truck: 0.98, bigrig: 1.26, tank: 1.01 };
const TYPE_DIMS = {
  ...Object.fromEntries(Object.entries(HF).map(([t, hF]) =>
    [t, { wF: hF * (CAR_SPRITE_GEOMETRY[t]?.aspect ?? 0.6), hF }])),
  boss:   { wF: 1.4 * BOSS_SPRITE_GEOMETRY.aspect, hF: 1.4 },
};

// ── V2 special cars (TrafficRules) — which sprite a car shows right now ───────
// Variant sprites (armored-/speeder-/chameleon-<type>-<color>.png) share their
// base sprite's canvas, so a swap is a texture change on the same plane.
// Armour shows only while plated; a boss shows its armoured body while plated.
function spritePathFor(car) {
  if (car.type === 'boss') return (car.armor ?? 0) > 0 ? 'sprites/designed/boss-armored.png' : 'sprites/designed/boss.png';
  const c = car.color?.toLowerCase();
  const t = car.trait;
  // plated reuses the armoured body (same plates, two hits); mender / volatile /
  // phantom keep the plain body and carry programmatic overlays instead.
  const art = t === 'plated' ? 'armored' : t;
  const hasVariantArt = art === 'armored' || art === 'speeder' || art === 'chameleon'
    || (art === 'mender' && car.type !== 'small') || art === 'volatile';
  if (hasVariantArt && TRAIT_TYPES[t]?.has(car.type) && (art !== 'armored' || (car.armor ?? 0) > 0)) {
    return `sprites/designed/${art}-${car.type}-${c}.png`;
  }
  return SPRITE_MAP[car.type]?.[car.color] ?? null;
}

// ── Sprite map: nested by type → color (pre-colored PNGs, no material tint) ──
const SPRITE_MAP = {
  small: {
    Red:    'sprites/designed/bike-red.png',
    Blue:   'sprites/designed/bike-blue.png',
    Green:  'sprites/designed/bike-green.png',
    Yellow: 'sprites/designed/bike-yellow.png',
    Orange: 'sprites/designed/bike-orange.png',
    Purple: 'sprites/designed/bike-purple.png',
  },
  big: {
    Red:    'sprites/designed/car-red-processed.png',
    Blue:   'sprites/designed/car-blue-processed.png',
    Green:  'sprites/designed/car-green-processed.png',
    Yellow: 'sprites/designed/car-yellow-processed.png',
    Orange: 'sprites/designed/car-orange-processed.png',
    Purple: 'sprites/designed/car-purple-processed.png',
  },
  jeep: {
    Red:    'sprites/designed/van-red.png',
    Blue:   'sprites/designed/van-blue.png',
    Green:  'sprites/designed/van-green.png',
    Yellow: 'sprites/designed/van-yellow.png',
    Orange: 'sprites/designed/van-orange.png',
    Purple: 'sprites/designed/van-purple.png',
  },
  truck: {
    Red:    'sprites/designed/truck-red.png',
    Blue:   'sprites/designed/truck-blue.png',
    Green:  'sprites/designed/truck-green.png',
    Yellow: 'sprites/designed/truck-yellow.png',
    Orange: 'sprites/designed/truck-orange.png',
    Purple: 'sprites/designed/truck-purple.png',
  },
  bigrig: {
    Red:    'sprites/designed/bigrig-red.png',
    Blue:   'sprites/designed/bigrig-blue.png',
    Green:  'sprites/designed/bigrig-green.png',
    Yellow: 'sprites/designed/bigrig-yellow.png',
    Orange: 'sprites/designed/bigrig-orange.png',
    Purple: 'sprites/designed/bigrig-purple.png',
  },
  tank: {
    Red:    'sprites/designed/tank-red.png',
    Blue:   'sprites/designed/tank-blue.png',
    Green:  'sprites/designed/tank-green.png',
    Yellow: 'sprites/designed/tank-yellow.png',
    Orange: 'sprites/designed/tank-orange.png',
    Purple: 'sprites/designed/tank-purple.png',
  },
};

// Colour-blind roof badge: one shared texture per colour. Stored in _texCache
// (declared below) under 'shape:<Color>' so _disposeGroup never frees it.
const SHAPE_BADGE_WU = 0.95;   // on-screen badge diameter in world units (~19 stage px)
function _getShapeTex(color) {
  const key = `shape:${color}`;
  if (!_texCache[key]) {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    drawColorShapeBadge(c.getContext('2d'), color, 48, 48, 44);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    _texCache[key] = t;
  }
  return _texCache[key];
}

// Module-level texture cache (shared across all Car3D instances)
const _texLoader = new THREE.TextureLoader();
const _texCache  = {};

function _getSpriteTex(type, color, base) {
  const cacheKey = `${type}:${color}`;
  if (!_texCache[cacheKey]) {
    const spritePath = SPRITE_MAP[type]?.[color];
    const tex = _texLoader.load(`${base}${spritePath}`);
    tex.colorSpace = THREE.SRGBColorSpace;
    _texCache[cacheKey] = tex;
  }
  return _texCache[cacheKey];
}

function _getTexByPath(path, base) {
  const key = `path:${path}`;
  if (!_texCache[key]) {
    const tex = _texLoader.load(`${base}${path}`);
    tex.colorSpace = THREE.SRGBColorSpace;
    _texCache[key] = tex;
  }
  return _texCache[key];
}

function _canvasTex(key, size, draw) {
  if (!_texCache[key]) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    _texCache[key] = t;
  }
  return _texCache[key];
}

const INK_CSS = '#1F1A33';
const cssHex = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

// Chameleon "next colour" lamp: a glowing disc of the colour it turns into next,
// with a white rim and two cycle arrows — reads as "this is coming".
function _nextColorTex(color) {
  return _canvasTex(`next:${color}`, 128, (ctx, S) => {
    const c = S / 2, r = S * 0.30;
    const glow = ctx.createRadialGradient(c, c, r * 0.6, c, c, S / 2);
    glow.addColorStop(0, cssHex(COLOR_HEX[color] ?? 0xffffff) + 'cc');
    glow.addColorStop(1, cssHex(COLOR_HEX[color] ?? 0xffffff) + '00');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, S, S);
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fillStyle = cssHex(COLOR_HEX[color] ?? 0xffffff); ctx.fill();
    ctx.lineWidth = S * 0.05; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
    ctx.lineWidth = S * 0.025; ctx.strokeStyle = INK_CSS;
    ctx.beginPath(); ctx.arc(c, c, r + S * 0.035, 0, Math.PI * 2); ctx.stroke();
    // Cycle arrows.
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = S * 0.04; ctx.lineCap = 'round';
    for (const a0 of [0.3, Math.PI + 0.3]) {
      ctx.beginPath(); ctx.arc(c, c, r * 0.55, a0, a0 + 2.1); ctx.stroke();
      const ax = c + Math.cos(a0 + 2.1) * r * 0.55, ay = c + Math.sin(a0 + 2.1) * r * 0.55;
      const t = a0 + 2.1 + Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(ax + Math.cos(t - 0.6) * S * 0.07, ay + Math.sin(t - 0.6) * S * 0.07);
      ctx.lineTo(ax, ay);
      ctx.lineTo(ax + Math.cos(t + 2.2) * S * 0.07, ay + Math.sin(t + 2.2) * S * 0.07);
      ctx.stroke();
    }
  });
}


// ── V3 trait badges (canvas, cached) ─────────────────────────────────────────
function _badgeBase(ctx, S, fill) {
  const c = S / 2, r = S * 0.40;
  ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = S * 0.06; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
  ctx.lineWidth = S * 0.03; ctx.strokeStyle = INK_CSS;
  ctx.beginPath(); ctx.arc(c, c, r + S * 0.045, 0, Math.PI * 2); ctx.stroke();
  return { c, r };
}
// Plated: steel disc with one pip per plate still on (2 → 1 → gone).
function _plateTex(n) {
  return _canvasTex(`plate:${n}`, 128, (ctx, S) => {
    const { c, r } = _badgeBase(ctx, S, '#8E9AB0');
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = INK_CSS; ctx.lineWidth = S * 0.025;
    const xs = n === 1 ? [c] : [c - r * 0.38, c + r * 0.38];
    for (const x of xs) { ctx.beginPath(); ctx.arc(x, c, r * 0.26, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  });
}
// Mender: green disc with a white plus — "this one heals".
function _menderTex() {
  return _canvasTex('mender', 128, (ctx, S) => {
    const { c, r } = _badgeBase(ctx, S, '#2FCC55');
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = INK_CSS; ctx.lineWidth = S * 0.02;
    const t = r * 0.34, l = r * 0.95;
    ctx.beginPath();
    ctx.rect(c - t / 2, c - l / 2, t, l); ctx.rect(c - l / 2, c - t / 2, l, t);
    ctx.fill();
  });
}
// Volatile: hazard disc (orange, black bang) — "kill me and the other lanes surge".
function _volatileTex() {
  return _canvasTex('volatile', 128, (ctx, S) => {
    const { c, r } = _badgeBase(ctx, S, '#FF8A1C');
    ctx.fillStyle = INK_CSS;
    ctx.beginPath(); ctx.roundRect(c - r * 0.13, c - r * 0.62, r * 0.26, r * 0.78, r * 0.1); ctx.fill();
    ctx.beginPath(); ctx.arc(c, c + r * 0.46, r * 0.15, 0, Math.PI * 2); ctx.fill();
  });
}
// Phantom: violet disc with a question mark — colour not revealed yet.
function _phantomTex() {
  return _canvasTex('phantom', 128, (ctx, S) => {
    const { c } = _badgeBase(ctx, S, '#5B3FA0');
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${S * 0.58}px sans-serif`;
    ctx.fillText('?', c, c + S * 0.03);
  });
}

// Speeder exhaust flame (teardrop, hot core → orange → transparent).
function _flameTex() {
  return _canvasTex('flame', 64, (ctx, S) => {
    const g = ctx.createRadialGradient(S / 2, S * 0.72, 1, S / 2, S * 0.6, S * 0.5);
    g.addColorStop(0, 'rgba(255,255,230,1)');
    g.addColorStop(0.3, 'rgba(255,212,42,0.95)');
    g.addColorStop(0.65, 'rgba(255,110,30,0.7)');
    g.addColorStop(1, 'rgba(255,60,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(S / 2, 0);
    ctx.bezierCurveTo(S * 0.95, S * 0.5, S * 0.8, S, S / 2, S);
    ctx.bezierCurveTo(S * 0.2, S, S * 0.05, S * 0.5, S / 2, 0);
    ctx.fill();
  });
}

// Boss roof panel: the colour sequence as a grid of lights. Done lights go dark
// with a tick, the current light is full size with a white ring (and a steel
// lock ring while the boss is plated), the rest are dimmed previews.
function _drawBossPanel(ctx, W, H, car) {
  // Upper half: the colour to hit NOW, as one big lit lamp. Lower half: the
  // whole sequence as large pips (two rows when it is long), knocked-out lights
  // dark, the current one ringed white — so the order reads at a glance.
  ctx.clearRect(0, 0, W, H);
  const seq = car.sequence ?? [];
  const n = seq.length;
  const cur = seq[car.seqIdx];
  const topH = H * 0.5;
  const bigR = Math.min(W * 0.5, topH) * 0.4;
  const bx = W / 2, by = topH * 0.52;
  if (cur) {
    const hex = cssHex(COLOR_HEX[cur] ?? 0x888888);
    const glow = ctx.createRadialGradient(bx, by, bigR * 0.6, bx, by, bigR * 1.5);
    glow.addColorStop(0, hex + 'cc'); glow.addColorStop(1, hex + '00');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, topH);
    ctx.beginPath(); ctx.arc(bx, by, bigR, 0, Math.PI * 2);
    ctx.fillStyle = hex; ctx.fill();
    ctx.lineWidth = bigR * 0.18; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
    ctx.lineWidth = bigR * 0.08; ctx.strokeStyle = INK_CSS;
    ctx.beginPath(); ctx.arc(bx, by, bigR * 1.1, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx - bigR * 0.35, by - bigR * 0.35, bigR * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
    if ((car.armor ?? 0) > 0) {
      ctx.save();
      ctx.beginPath(); ctx.arc(bx, by, bigR * 0.95, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = 'rgba(185,193,207,0.92)';
      for (let i = -1; i <= 1; i++) ctx.fillRect(bx - bigR, by + i * bigR * 0.55 - bigR * 0.14, bigR * 2, bigR * 0.28);
      ctx.restore();
    }
  }
  // Sequence plate.
  const rows = n > 4 ? 2 : 1, perRow = Math.ceil(n / rows);
  const plateY = topH + H * 0.02, plateH = H - plateY - H * 0.02;
  ctx.fillStyle = 'rgba(20,17,38,0.9)';
  _rrect(ctx, W * 0.03, plateY, W * 0.94, plateH, Math.min(plateH, W) * 0.18); ctx.fill();
  ctx.lineWidth = Math.max(2, W * 0.018); ctx.strokeStyle = INK_CSS; ctx.stroke();
  const cellW = (W * 0.9) / perRow, cellH = plateH / rows;
  const pr = Math.min(cellW, cellH) * 0.36;
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / perRow), col = i % perRow;
    const inRow = row === rows - 1 ? n - row * perRow : perRow;
    const x0 = W / 2 - (inRow * cellW) / 2;
    const px = x0 + (col + 0.5) * cellW, py = plateY + (row + 0.5) * cellH;
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2);
    if (i < car.seqIdx) {
      ctx.fillStyle = '#2A2638'; ctx.fill(); ctx.lineWidth = pr * 0.18; ctx.strokeStyle = '#5E587A'; ctx.stroke();
      continue;
    }
    ctx.fillStyle = cssHex(COLOR_HEX[seq[i]] ?? 0x888888); ctx.fill();
    ctx.lineWidth = pr * (i === car.seqIdx ? 0.34 : 0.18);
    ctx.strokeStyle = i === car.seqIdx ? '#FFFFFF' : INK_CSS; ctx.stroke();
    ctx.beginPath(); ctx.arc(px - pr * 0.3, py - pr * 0.3, pr * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function carHex(car) {
  return COLOR_HEX[car.color] ?? (car.type === 'boss' ? COLOR_HEX.Boss : 0x888888);
}

function _boostColor(hex) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl, THREE.SRGBColorSpace);
  hsl.s = 1.0;
  // Keep L in sRGB perceptual space, never above 0.50 (avoids washed-out tints)
  hsl.l = Math.max(0.35, Math.min(0.50, hsl.l));
  c.setHSL(hsl.h, hsl.s, hsl.l, THREE.SRGBColorSpace);
  return c.getHex(THREE.SRGBColorSpace);
}

function _rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }
}

// ── Programmatic texture drawing (boss only) ──────────────────────────────────
function _drawBoss(ctx, W, H, hex) {
  ctx.clearRect(0, 0, W, H);
  const cr = (hex >> 16) & 0xff;
  const cg = (hex >>  8) & 0xff;
  const cb =  hex        & 0xff;
  _rrect(ctx, MARGIN, MARGIN, W - 2 * MARGIN, H - 2 * MARGIN, 14);
  ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 4;
  ctx.stroke();
  // Boss mark — inner X
  const m = MARGIN + 18;
  ctx.beginPath();
  ctx.moveTo(m, m); ctx.lineTo(W - m, H - m);
  ctx.moveTo(W - m, m); ctx.lineTo(m, H - m);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 6;
  ctx.stroke();
}

// ── Speed line geometry (reused) ─────────────────────────────────────────────
let _slGeo = null;
function _getSpeedLineGeo() {
  if (!_slGeo) _slGeo = new THREE.PlaneGeometry(0.08, 0.50);
  return _slGeo;
}

// ── Boss torus (reused) ───────────────────────────────────────────────────────
let _bossTorusGeo = null;

// ─────────────────────────────────────────────────────────────────────────────

export class Car3D {
  constructor(scene, lanes) {
    this._scene = scene;
    this._lanes = lanes;
    this._live  = new Map();
    this._dying = [];
    this._emissiveBoost = 0;
    // Active lane count — drives horizontal placement so cars center on the
    // road for low-lane levels (L1-3). Defaults to all lanes; set per level via
    // setLaneCount() (mirrors Shooter3D). Without this, L1 cars rendered at the
    // 4-lane X (≈ -6) and sat off the narrow 1-lane road → invisible.
    this._laneCount = lanes.length;
    // Breach row (gridRows - 1) for danger aura proximity calculation.
    // Defaults to 15 (gridRows=16); set per level via setGridRows().
    this._breachRow = 15;
    if (!_bossTorusGeo) _bossTorusGeo = new THREE.TorusGeometry(1.4, 0.06, 8, 28);
  }

  // Match the active lane count so laneToX centers cars on the current road.
  setLaneCount(n) { this._laneCount = n; }

  // Set gridRows so breach row (gridRows-1) is correct for danger aura.
  setGridRows(gridRows) { this._breachRow = gridRows - 1; }

  setTheme(theme) {
    this._emissiveBoost = theme?.emissiveBoost ?? 0;
  }

  clearAll() {
    for (const entry of this._live.values()) this._disposeEntry(entry);
    this._live.clear();
    for (const d of this._dying) this._disposeDying(d);
    this._dying.length = 0;
    for (const s of this._shards ?? []) { this._scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose(); }
    if (this._shards) this._shards.length = 0;
  }

  // DEV proof helper: current {x,y} mesh scale of the front car in a lane (or null).
  peekFrontScale(laneIdx) {
    const lane = this._lanes[laneIdx];
    const frontCar = lane?.cars.reduce((best, c) => (!best || c.row > best.row) ? c : best, null);
    const entry = frontCar && this._live.get(frontCar);
    return entry ? { x: entry.mesh.scale.x, y: entry.mesh.scale.y } : null;
  }

  triggerPowerHit(laneIdx, isKill) {
    const lane = this._lanes[laneIdx];
    if (!lane) return;
    const frontCar = lane.cars.reduce((best, c) => (!best || c.row > best.row) ? c : best, null);
    if (!frontCar) return;
    const entry = this._live.get(frontCar);
    if (!entry) return;
    entry._powerFlashT    = 0;
    entry._powerFlashing  = true;
    entry._powerSquashT   = 0;
    entry._powerSquashing = true;
  }

  // ── V2 trait effects, per car per frame ──────────────────────────────────────
  _updateTraitFx(entry, car, dt, now) {
    const fx = entry.traitFx;
    if (!fx) return;
    // Armour knocked off → steel shards fly out of the car.
    const armor = car.armor ?? 0;
    if (fx.armor > 0 && armor === 0) this._spawnShards(entry);
    fx.armor = armor;
    if (fx.lamp) {
      if (fx.lampColor !== car.altColor) {
        fx.lampColor = car.altColor;
        fx.lamp.material.map = _nextColorTex(car.altColor);
        fx.lamp.material.needsUpdate = true;
      }
      const s = 1 + 0.08 * Math.sin(now * 5);
      fx.lamp.scale.set(s, s, 1);
    }
    if (fx.badge) {
      if (car.trait === 'plated') {
        const key = `p${armor}`;
        if (fx.badgeKey !== key) {
          fx.badgeKey = key;
          fx.badge.visible = armor > 0;
          if (armor > 0) { fx.badge.material.map = _plateTex(armor); fx.badge.material.needsUpdate = true; }
        }
      } else if (car.trait === 'phantom') {
        fx.badge.visible = isHiddenPhantom(car);
      } else if (car.trait === 'volatile') {
        const s = 1 + 0.1 * Math.sin(now * 7);
        fx.badge.scale.set(s, s, 1);
      }
    }
    if (fx.shade) {
      fx.shade.visible = isHiddenPhantom(car);
      fx.shade.material.map = entry.bodyMat.map;
    }
    if (fx.flames) {
      for (let i = 0; i < fx.flames.length; i++) {
        const f = fx.flames[i];
        const flick = 0.8 + 0.35 * Math.abs(Math.sin(now * 23 + i * 1.7)) + 0.15 * Math.sin(now * 41 + i);
        f.scale.set(0.9 + 0.1 * Math.sin(now * 31 + i), flick, 1);
        f.material.opacity = 0.75 + 0.25 * Math.sin(now * 17 + i * 2);
      }
    }
    if (fx.panel) {
      const key = `${car.seqIdx}:${armor}:${car.sequence?.[car.seqIdx]}`;   // COLOR CHANGE rewrites the current light in place
      if (fx.panelKey !== key) {
        fx.panelKey = key;
        _drawBossPanel(fx.panelCanvas.getContext('2d'), fx.panelCanvas.width, fx.panelCanvas.height, car);
        fx.panelTex.needsUpdate = true;
      }
    }
  }

  _spawnShards(entry) {
    const g = entry.group;
    this._shards ??= [];
    const mat = new THREE.MeshBasicMaterial({ color: 0xB9C1CF, transparent: true, depthWrite: false });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), mat.clone());
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.random() * 3;
      m.position.set(g.position.x, 0.3, g.position.z);
      this._scene.add(m);
      this._shards.push({ mesh: m, vx: Math.cos(a) * 4.5, vz: Math.sin(a) * 4.5, spin: (Math.random() - 0.5) * 14, t: 0 });
    }
    mat.dispose();
  }

  _updateShards(dt) {
    if (!this._shards?.length) return;
    for (let i = this._shards.length - 1; i >= 0; i--) {
      const s = this._shards[i];
      s.t += dt;
      const p = s.t / 0.45;
      if (p >= 1) {
        this._scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose();
        this._shards.splice(i, 1);
        continue;
      }
      s.mesh.position.x += s.vx * dt * (1 - p);
      s.mesh.position.z += s.vz * dt * (1 - p);
      s.mesh.rotation.z += s.spin * dt;
      s.mesh.material.opacity = 1 - p;
    }
  }

  update(dt, isFrozen = false) {
    this._updateShards(dt);
    const liveCars = new Set();
    for (const lane of this._lanes) for (const car of lane.cars) liveCars.add(car);

    // Retire cars no longer in state
    for (const [car, entry] of this._live) {
      if (!liveCars.has(car)) {
        this._killSpeedLines(entry);
        this._disposeGhosts(entry);   // clean up any in-flight spawn ghosts
        this._dying.push({
          group: entry.group, bossRing: entry.bossRing,
          bossRingMat: entry.bossRingMat, t: 0,
          baseScale: entry.group.userData.baseScale ?? 1,
          spinDir:   entry.group.position.x >= 0 ? 1 : -1,   // spin away from centre
        });
        this._live.delete(car);
      }
    }

    const now = performance.now() / 1000;

    for (let laneIdx = 0; laneIdx < this._lanes.length; laneIdx++) {
      const _laneCars = this._lanes[laneIdx].cars;
      const _maxRow   = _laneCars.length > 0
        ? _laneCars.reduce((m, c) => Math.max(m, c.row), 0) : -1;

      for (const car of _laneCars) {
        if (!this._live.has(car)) this._live.set(car, this._createEntry(car, laneIdx));

        const entry = this._live.get(car);
        const g     = entry.group;

        // COLOR CHANGE booster recolors a live car in GameState (car.color mutates
        // in place). Swap its sprite to the new color so the visual matches the
        // logic — without this the car kept its old (e.g. blue) sprite while combat
        // already treated it as the new color.
        // V2: the sprite also changes when armour comes off, a chameleon flips, or
        // a boss re-plates — spritePathFor() is the one source of which art shows.
        const path = spritePathFor(car);
        if (entry.spritePath !== path && path) {
          entry.spritePath = path;
          entry.bodyMat.map = _getTexByPath(path, import.meta.env.BASE_URL);
          entry.bodyMat.needsUpdate = true;
        }
        if (entry.color !== car.color) {
          entry.color = car.color;
          if (entry.shapeBadge) {
            entry.shapeBadge.material.map = _getShapeTex(car.color);
            entry.shapeBadge.material.needsUpdate = true;
          }
        }
        // A hidden phantom hides its colour on purpose; the colour-blind shape would reveal it.
        if (entry.shapeBadge) entry.shapeBadge.visible = isColorblind() && !isHiddenPhantom(car);
        this._updateTraitFx(entry, car, dt, now);

        // ── Smooth advance lerp ───────────────────────────────────────────────
        const newTargetZ = posToZ(car.position);
        if (Math.abs(newTargetZ - entry.targetZ) > 0.001) {
          entry.lerpStartZ = entry.renderZ;
          entry.targetZ    = newTargetZ;
          entry.lerpT      = 0;
          // Spawn speed lines when advancing (not on first spawn)
          if (!entry._isSpawning) this._spawnSpeedLines(entry, laneIdx, car);
        }
        if (entry.lerpT < 1) {
          const dur     = entry._isSpawning ? SPAWN_LERP_DURATION : LERP_DURATION;
          entry.lerpT   = Math.min(1, entry.lerpT + dt / dur);
          const eased   = 1 - Math.pow(1 - entry.lerpT, 3);
          entry.renderZ = entry.lerpStartZ + (entry.targetZ - entry.lerpStartZ) * eased;
          g.rotation.x  = -MAX_TILT_X * Math.sin(Math.PI * entry.lerpT);
          if (entry.lerpT >= 1) entry._isSpawning = false;
        } else {
          entry.renderZ   = entry.targetZ;
          g.rotation.x    = 0;
          entry._isSpawning = false;
        }

        // ── Update speed lines ────────────────────────────────────────────────
        this._updateSpeedLines(entry, dt);

        // ── Wobble ────────────────────────────────────────────────────────────
        const wobbleX   = Math.sin(now * WOBBLE_X_FREQ   + laneIdx * 0.7) * WOBBLE_X_AMP;
        const wobbleRot = Math.sin(now * WOBBLE_ROT_FREQ + laneIdx * 1.3) * WOBBLE_ROT_AMP;
        // 2A: continuous idle bob, phase-offset per lane so they don't bob in sync.
        // Top-down ortho collapses the Y axis, so "up/down" reads on Z (screen-vertical).
        const bobZ      = Math.sin(now * BOB_FREQ + laneIdx * BOB_PHASE) * BOB_AMP;

        g.position.set(laneToX(laneIdx, this._laneCount) + wobbleX, 0, entry.renderZ + bobZ);

        // 2D: spawn motion-blur trail — fade the ghost frames in behind the car.
        if (entry._ghosts) this._updateSpawnGhosts(entry, dt);

        // ── Boss ring ─────────────────────────────────────────────────────────
        if (entry.bossRing) {
          entry.bossAngle += dt * 1.8;
          entry.bossRing.position.set(g.position.x, g.position.y + 0.5, g.position.z);
          entry.bossRing.rotation.y = entry.bossAngle;
          entry.bossRing.rotation.x = 0.35;
          entry.bossRingMat.emissiveIntensity = 1.2 + 0.6 * Math.sin(entry.bossAngle * 3);
        }

        const hpRatio = car.maxHp > 0 ? car.hp / car.maxHp : 0;

        // ── Color effects (MeshBasicMaterial tinting) ─────────────────────────
        entry._auraT += dt;
        let colorSet = false;

        if (isFrozen) {
          entry.bodyMat.color.setRGB(0.67, 0.87, 1.0);
          if (!entry._prevFrozen) entry._prevFrozen = true;
          colorSet = true;
        } else {
          if (entry._prevFrozen) {
            entry._prevFrozen = false;
            entry.bodyMat.color.setHex(entry.baseHex);
          }

          // Power hit flash
          if (entry._powerFlashing) {
            entry._powerFlashT += dt;
            const prog = Math.min(1, entry._powerFlashT / POWER_FLASH_DUR);
            if (prog < 1) {
              if (prog < 0.4) {
                const t = prog / 0.4;
                entry.bodyMat.color.setRGB(1, 1 - 0.55 * t, 1 - 0.9 * t);
              } else {
                const t = (prog - 0.4) / 0.6;
                entry.bodyMat.color.setRGB(1, 0.45 + 0.55 * t, 0.1 + 0.9 * t);
              }
              colorSet = true;
            } else {
              entry._powerFlashing = false;
            }
          }

          // Danger aura (2C) — intensity ramps with proximity to the breach row:
          // dangerRows out = subtle, ramping to strong 1 row away. dangerRows is
          // a FRACTION of board depth (see dangerRowsFor) so the lit zone stays
          // ~19% of the road at any gridRows, not a fixed 3 rows.
          const dangerRows = dangerRowsFor(this._breachRow + 1);
          const rowsOut    = this._breachRow - car.row;   // 1 = one step from breaching
          const auraTarget = Math.max(0, Math.min(1, (dangerRows + 1 - rowsOut) / dangerRows));
          const blendStep  = AURA_RATE * dt;
          entry._auraBlend = auraTarget > entry._auraBlend
            ? Math.min(auraTarget, entry._auraBlend + blendStep)
            : Math.max(auraTarget, entry._auraBlend - blendStep);

          if (!colorSet && entry._auraBlend > 0.001) {
            // Pulse rate accelerates as the car nears the breach (2C).
            const auraFreq = AURA_FREQ * (1 + entry._auraBlend * 1.6);
            const pulse  = 0.7 + AURA_AMP * Math.sin(2 * Math.PI * auraFreq * entry._auraT);
            const t = entry._auraBlend * pulse * 0.6;
            // Boost red channel, dim others — preserves hue identity while signalling danger
            entry.bodyMat.color.setHex(entry.baseHex);
            const mc = entry.bodyMat.color;
            mc.r = Math.min(1.0, mc.r + t * 0.40);
            mc.g = mc.g * (1 - t * 0.55);
            mc.b = mc.b * (1 - t * 0.55);
            colorSet = true;
          }

          // Damage tint (lowest priority) — darken base color, preserve hue identity
          if (!colorSet) {
            const bright = hpRatio < 0.35 ? 0.45 : hpRatio < 0.65 ? 0.70 : 1.0;
            if (bright < 1.0) {
              entry.bodyMat.color.setHex(entry.baseHex);
              entry.bodyMat.color.multiplyScalar(bright);
            } else {
              entry.bodyMat.color.setHex(entry.baseHex);
            }
          }
        }

        // ── Damage rotation tilt ──────────────────────────────────────────────
        let tiltZ = 0;
        if (!isFrozen) {
          if (hpRatio < 0.35)      tiltZ = -0.10 * (1 - hpRatio);
          else if (hpRatio < 0.65) tiltZ = -0.04 * (1 - hpRatio);
        }
        g.rotation.z = tiltZ + wobbleRot;

        // ── Power squash-and-stretch (true non-uniform) ───────────────────────
        // Bombs arrive from below (south), so the car compresses vertically and
        // bulges horizontally, then snaps tall+narrow, then settles. Applied to the
        // MESH (local scale 1) so it composes with the group's SPRITE_SCALE.
        if (entry._powerSquashing) {
          entry._powerSquashT += dt;
          const t = entry._powerSquashT;
          let sx, sy;
          if (t < 0.040)      { sx = 1.35; sy = 0.70; }   // squash: wider + shorter
          else if (t < 0.100) { sx = 0.90; sy = 1.25; }   // stretch: snaps tall + narrow
          else if (t < POWER_SQUASH_DUR) {                // ease back to rest
            const p = (t - 0.100) / (POWER_SQUASH_DUR - 0.100);
            const e = 1 - Math.pow(1 - p, 2);
            sx = 0.90 + (1.0 - 0.90) * e;
            sy = 1.25 + (1.0 - 1.25) * e;
          } else {
            sx = 1; sy = 1;
            entry._powerSquashing = false;
          }
          entry.mesh.scale.set(sx, sy, 1);
        }

        if (car.hp !== entry.lastHp) entry.lastHp = car.hp;
      }
    }

    // ── Death animations ──────────────────────────────────────────────────────
    for (let i = this._dying.length - 1; i >= 0; i--) {
      const d = this._dying[i];
      d.t += dt;
      if (d.t >= DEATH_DURATION) { this._disposeDying(d); this._dying.splice(i, 1); continue; }
      const prog  = d.t / DEATH_DURATION;
      // Spin (180° yaw, away from centre) + scale up + rise + fade → "launched by
      // the blast" instead of just vanishing. Scale is relative to the car's base
      // render scale so it doesn't pop bigger at the start. (1B)
      const scale = (d.baseScale ?? 1) * (1 + (DEATH_SCALE_MAX - 1) * prog);
      d.group.scale.set(scale, scale, scale);
      d.group.rotation.y = d.spinDir * DEATH_SPIN * prog;
      d.group.position.y += DEATH_VY * dt;
      d.group.traverse(child => {
        if (child.isMesh && child.material) child.material.opacity = 1 - prog;
      });
    }
  }

  // ── Entry creation ─────────────────────────────────────────────────────────

  _createEntry(car, laneIdx) {
    const hex        = carHex(car);
    const boostedHex = _boostColor(hex);

    // Pre-coloured sprites (V2 variants and the boss included — spritePathFor).
    const spritePath = spritePathFor(car);
    const hasSprite = spritePath != null;
    let bodyMat;

    if (hasSprite) {
      const tex = _getTexByPath(spritePath, import.meta.env.BASE_URL);
      bodyMat = new THREE.MeshBasicMaterial({
        map:         tex,
        transparent: true,
        alphaTest:   0.08,
        color:       new THREE.Color(0xffffff),  // pre-colored sprite — no tint
        side:        THREE.DoubleSide,
      });
    } else {
      // boss — programmatic canvas
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = CVS;
      _drawBoss(canvas.getContext('2d'), CVS, CVS, boostedHex);
      const tex = new THREE.CanvasTexture(canvas);
      bodyMat = new THREE.MeshBasicMaterial({
        map:         tex,
        transparent: true,
        alphaTest:   0.05,
        color:       new THREE.Color(0xffffff),
        side:        THREE.DoubleSide,
      });
    }

    const cfg   = TYPE_DIMS[car.type] ?? TYPE_DIMS.big;
    const group = new THREE.Group();
    const mesh  = new THREE.Mesh(
      new THREE.PlaneGeometry(CELL * cfg.wF, CELL * cfg.hF),
      bodyMat,
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.05;
    // Center the sprite's MEASURED body (not its padded image) on the lane: the
    // group sits at laneToX(); this local offset cancels the art asymmetry
    // (bigrig body rides 10.8% right of image center). Unlike the old hand-tuned
    // SPRITE_X_OFFSET table (removed in 9e878b1 — stale/wrong-signed), these come
    // from scripts/measure-car-bbox.mjs and regenerate with the art.
    mesh.position.x = -(BODY_FRAC[car.type]?.cx ?? 0) * CELL * cfg.wF;
    group.add(mesh);

    // (The old spinning boss torus is gone — V2 bosses carry their sequence panel.)
    const bossRing = null, bossRingMat = null;

    const spriteScale = spriteScaleFor(car.type, this._breachRow + 1);
    group.userData.baseScale = spriteScale;
    group.scale.setScalar(spriteScale);

    // Colour-blind roof badge — built for every car, shown only while the
    // setting is on (update() toggles it, so the Settings switch takes effect
    // on cars already on the road). Local size cancels the group scale.
    let shapeBadge = null;
    if (car.type !== 'boss') {
      const side = SHAPE_BADGE_WU / spriteScale;
      shapeBadge = new THREE.Mesh(
        new THREE.PlaneGeometry(side, side),
        new THREE.MeshBasicMaterial({ map: _getShapeTex(car.color), transparent: true, depthWrite: false, toneMapped: false }),
      );
      shapeBadge.rotation.x = -Math.PI / 2;
      shapeBadge.position.y = 0.12;
      shapeBadge.renderOrder = 2;
      shapeBadge.visible = isColorblind();
      group.add(shapeBadge);
    }

    // ── V2 overlays (children of the group, so they ride, bob and die with it) ─
    // Positions are in the plane's local frame: image u → x, image v (from the
    // top) → z; one CELL*wF × CELL*hF plane, offset by the body-centring shift.
    const planeW = CELL * cfg.wF, planeH = CELL * cfg.hF;
    const imgToLocal = (u, v) => ({ x: (u - 0.5) * planeW + mesh.position.x, z: (v - 0.5) * planeH });
    const traitFx = {};
    if (car.trait === 'chameleon') {
      // "Next colour" lamp on the roof dome (behind the centre, toward the tail).
      const side = 1.25 / spriteScale;
      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(side, side),
        new THREE.MeshBasicMaterial({ map: _nextColorTex(car.altColor), transparent: true, depthWrite: false, toneMapped: false }));
      lamp.rotation.x = -Math.PI / 2;
      const p = imgToLocal(0.5, 0.40);
      lamp.position.set(p.x, 0.14, p.z);
      lamp.renderOrder = 3;
      group.add(lamp);
      traitFx.lamp = lamp; traitFx.lampColor = car.altColor;
    }
    if (car.trait === 'speeder') {
      // Two exhaust flames off the tail (image top = vehicle rear).
      const body = BODY_FRAC[car.type] ?? { w: 0.8, h: 0.8 };
      const fw = planeW * 0.22, fh = planeH * 0.34;
      traitFx.flames = [-1, 1].map(sd => {
        const f = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh),
          new THREE.MeshBasicMaterial({ map: _flameTex(), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
        f.rotation.x = -Math.PI / 2;
        const p = imgToLocal(0.5 + sd * body.w * 0.22, 0.5 - body.h / 2 - 0.10);
        f.position.set(p.x, 0.02, p.z);
        f.userData.baseZ = p.z;
        group.add(f);
        return f;
      });
    }
    if (car.trait === 'plated' || car.trait === 'phantom' || (car.trait === 'mender' && car.type === 'small')) {
      const side = 1.25 / spriteScale;
      const badge = new THREE.Mesh(new THREE.PlaneGeometry(side, side),
        new THREE.MeshBasicMaterial({ map: car.trait === 'plated' ? _plateTex(car.armor ?? 2) : car.trait === 'mender' ? _menderTex()
          : car.trait === 'volatile' ? _volatileTex() : _phantomTex(), transparent: true, depthWrite: false, toneMapped: false }));
      badge.rotation.x = -Math.PI / 2;
      const p = imgToLocal(0.5, 0.40);
      badge.position.set(p.x, 0.14, p.z);
      badge.renderOrder = 3;
      group.add(badge);
      traitFx.badge = badge; traitFx.badgeKey = car.trait === 'plated' ? `p${car.armor ?? 2}` : car.trait;
    }
    if (car.trait === 'phantom') {
      // Dark silhouette over the body until the car reaches the reveal row.
      const shade = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({
        map: bodyMat.map, color: 0x1c1830, transparent: true, alphaTest: 0.08, depthWrite: false,
        side: THREE.DoubleSide, toneMapped: false }));
      shade.rotation.x = -Math.PI / 2;
      shade.position.set(mesh.position.x, 0.07, 0);
      shade.renderOrder = 2;
      shade.visible = isHiddenPhantom(car);
      group.add(shade);
      traitFx.shade = shade;
    }
    if (car.type === 'boss') {
      // Colour-sequence panel drawn onto the roof light panel.
      const P = BOSS_SPRITE_GEOMETRY.panel;
      const cw = 256, ch = Math.max(64, Math.round(256 * (P.h * planeH) / (P.w * planeW)));
      const canvas = document.createElement('canvas');
      canvas.width = cw; canvas.height = ch;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(P.w * planeW, P.h * planeH),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
      panel.rotation.x = -Math.PI / 2;
      const p = imgToLocal(P.cx, P.cy);
      panel.position.set(p.x, 0.14, p.z);
      panel.renderOrder = 3;
      group.add(panel);
      traitFx.panel = panel; traitFx.panelCanvas = canvas; traitFx.panelTex = tex; traitFx.panelKey = '';
    }
    traitFx.armor = car.armor ?? 0;

    // Spawn animation: start off-screen (further from breach) and glide in.
    // EXCEPTION — the opening board (car.isInitial, set by GameLoop._primeInitialCars):
    // there's nothing to "arrive" at level start, so it renders settled immediately
    // (no glide, no ghost trail). Mid-play spawns (lane refills after a kill) never
    // carry this flag and keep the normal glide-in.
    const targetZ  = posToZ(car.position);
    const spawnZ   = car.isInitial ? targetZ : targetZ - SPAWN_OFFSET;
    const worldX   = laneToX(laneIdx, this._laneCount);
    group.position.set(worldX, 0, spawnZ);


    this._scene.add(group);

    // 2D: spawn motion-blur trail — 3 faded ghost copies of the sprite that trail
    // behind the car during its entrance glide, then fade out. Share the car's
    // geometry + texture (disposed with the car, never by the ghost cleanup).
    // Skipped for the opening board — no glide means no trail to draw.
    const ghosts = [];
    if (bodyMat.map && !car.isInitial) {
      for (let i = 0; i < 3; i++) {
        const gm = new THREE.MeshBasicMaterial({
          map: bodyMat.map, transparent: true, opacity: 0,
          alphaTest: 0.05, depthWrite: false, side: THREE.DoubleSide,
        });
        const gMesh = new THREE.Mesh(mesh.geometry, gm);
        gMesh.rotation.x = -Math.PI / 2;
        gMesh.scale.setScalar(spriteScale);
        gMesh.position.set(worldX, 0.04, spawnZ);
        this._scene.add(gMesh);
        ghosts.push({ mesh: gMesh, mat: gm, lag: (i + 1) * 0.7 });
      }
    }

    return {
      group, mesh, bodyMat,
      color: car.color,   // sprite was built for this color; resynced if COLOR CHANGE recolors the car
      spritePath,         // which art is showing (V2: variants swap on armour/flip)
      traitFx,
      shapeBadge,
      baseHex: 0xffffff,  // always white — all sprites pre-colored, boss canvas bakes color
      lastHp: -1, _prevFrozen: false,
      bossRing, bossRingMat, bossAngle: 0,
      renderZ: spawnZ, targetZ, lerpStartZ: spawnZ, lerpT: car.isInitial ? 1 : 0,
      _isSpawning: !car.isInitial,
      _auraBlend: 0, _auraT: 0,
      _powerFlashing: false, _powerFlashT: 0,
      _powerSquashing: false, _powerSquashT: 0,
      _speedLines: [],
      _ghosts: ghosts.length ? ghosts : null,
    };
  }

  // 2D: advance the spawn ghost trail. Ghosts trail behind the gliding car at a
  // fixed lag with decreasing opacity, then fade + dispose once the car settles.
  _updateSpawnGhosts(entry, dt) {
    const g = entry.group;
    let allGone = true;
    for (let i = 0; i < entry._ghosts.length; i++) {
      const gh = entry._ghosts[i];
      if (entry._isSpawning) {
        gh.mesh.position.set(g.position.x, 0.04, entry.renderZ - gh.lag);
        gh.mat.opacity = 0.42 - i * 0.13;   // 0.42 / 0.29 / 0.16
        allGone = false;
      } else {
        gh.mat.opacity = Math.max(0, gh.mat.opacity - dt * 3.5);
        if (gh.mat.opacity > 0.01) allGone = false;
      }
    }
    if (allGone) this._disposeGhosts(entry);
  }

  _disposeGhosts(entry) {
    if (!entry._ghosts) return;
    for (const gh of entry._ghosts) {
      gh.mat.dispose();              // shared geo + texture are NOT disposed here
      this._scene.remove(gh.mesh);
    }
    entry._ghosts = null;
  }

  // ── Speed lines ───────────────────────────────────────────────────────────

  _spawnSpeedLines(entry, laneIdx, car) {
    const cfg = TYPE_DIMS[car.type] ?? TYPE_DIMS.big;
    const lx  = laneToX(laneIdx, this._laneCount);
    const geo  = _getSpeedLineGeo();

    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color:       new THREE.Color(entry.baseHex),
        transparent: true,
        opacity:     0.50,
        depthWrite:  false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      // Flank at ~1.4× the rendered half-width (was 0.30×wF hand-tuned against the
      // old global 0.43 scale — now follows each car's actual per-type scale).
      const flank = 0.70 * CELL * cfg.wF * (entry.group.userData.baseScale ?? SPRITE_SCALE);
      const xOff = i === 0 ? -flank : flank;
      mesh.position.set(lx + xOff, 0.03, entry.renderZ - 0.30);
      this._scene.add(mesh);
      entry._speedLines.push({ mesh, mat, t: 0, startZ: entry.renderZ });
    }
  }

  _updateSpeedLines(entry, dt) {
    for (const sl of entry._speedLines) {
      sl.t += dt;
      const prog = Math.min(1, sl.t / LERP_DURATION);
      sl.mat.opacity = 0.50 * (1 - prog);
      sl.mesh.position.z = sl.startZ - 0.30 - prog * 0.40;
    }
    // Remove finished lines
    entry._speedLines = entry._speedLines.filter(sl => {
      if (sl.t >= LERP_DURATION) {
        this._scene.remove(sl.mesh);
        sl.mat.dispose();
        return false;
      }
      return true;
    });
  }

  _killSpeedLines(entry) {
    for (const sl of entry._speedLines) {
      this._scene.remove(sl.mesh);
      sl.mat.dispose();
    }
    entry._speedLines.length = 0;
  }

  // ── Disposal ───────────────────────────────────────────────────────────────

  _disposeDying(d) {
    this._disposeGroup(d.group);
    if (d.bossRing) { d.bossRingMat?.dispose(); this._scene.remove(d.bossRing); }
  }

  _disposeEntry(entry) {
    this._killSpeedLines(entry);
    this._disposeGhosts(entry);
    this._disposeGroup(entry.group);
    if (entry.bossRing) { entry.bossRingMat?.dispose(); this._scene.remove(entry.bossRing); }
  }

  _disposeGroup(group) {
    group.traverse(obj => {
      if (obj.isMesh) {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
        for (const m of mats) {
          // Do NOT dispose cached sprite textures — only dispose CanvasTextures
          if (m.map && !(Object.values(_texCache).includes(m.map))) m.map.dispose();
          m.dispose();
        }
      }
    });
    this._scene.remove(group);
  }
}
