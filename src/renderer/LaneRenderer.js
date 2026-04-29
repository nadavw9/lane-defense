// LaneRenderer — draws the perspective road surface onto the lane layer.
//
// Layout: a single perspective road stretching from top (far, narrow) to
// bottom (near, wide).  Four lane columns divide it vertically.  Cars travel
// from position 0 (top/far) to position 100 (bottom/near), scaling 0.4 → 1.0.
//
// Perspective geometry:
//   Top of road  (y = ROAD_TOP_Y)    : x = 115 … 275  (ROAD_TOP_W  = 160 px)
//   Bottom of road (y = ROAD_BOTTOM_Y): x = 0   … 390  (ROAD_BOTTOM_W = 390 px)
//
// Exported helper functions (used by CarRenderer, ParticleSystem, DragDrop, etc.)
//   laneCenterX(laneIdx, t)  — screen X for lane centre at normalised position t [0-1]
//   posToScreenY(position)   — screen Y for game position [0-100]
//   posToScale(position)     — visual scale factor [0.4 - 1.0]
import { Graphics } from 'pixi.js';

// ── Layout constants ───────────────────────────────────────────────────────────

export const ROAD_TOP_Y    = 44;   // px — HUD bottom / road top
export const ROAD_BOTTOM_Y = 510;  // px — road bottom / shooter area boundary
export const ROAD_HEIGHT   = ROAD_BOTTOM_Y - ROAD_TOP_Y;  // 466 px

export const ROAD_TOP_X    = 115;  // px — left edge of road at top
export const ROAD_TOP_W    = 160;  // px — road width at top
export const ROAD_BOTTOM_W = 390;  // px — road width at bottom (= APP_W)

export const LANE_COUNT    = 4;

// Car scale range: 0.4× at position 0 (far) → 1.0× at position 100 (near)
export const SCALE_MIN = 0.40;
export const SCALE_MAX = 1.00;

const APP_W = 390;

// ── Geometry helpers ──────────────────────────────────────────────────────────

// Screen X for the visual centre of lane `laneIdx`.
// With the orthographic top-down road camera (left=-6, right=+6 in world space),
// all positions along a lane share the same screen X — no perspective convergence.
// This matches the PixiJS column centres (48.75 / 146.25 / 243.75 / 341.25).
export function laneCenterX(laneIdx, t) {  // eslint-disable-line no-unused-vars
  return (laneIdx + 0.5) * (ROAD_BOTTOM_W / LANE_COUNT);   // = 48.75 * (laneIdx + 0.5) * 2
}

// Screen Y for game-unit position [0-100].
export function posToScreenY(position) {
  return ROAD_TOP_Y + (position / 100) * ROAD_HEIGHT;
}

// Car scale factor for game-unit position [0-100].
export function posToScale(position) {
  return SCALE_MIN + (SCALE_MAX - SCALE_MIN) * (position / 100);
}

// ── Renderer ──────────────────────────────────────────────────────────────────

export class LaneRenderer {
  constructor(layerManager, appWidth) {
    this._layer  = layerManager.get('laneLayer');
    this._appW   = appWidth;
    this._draw(appWidth);

    // Separate Graphics for the pulsing breach line so only it gets redrawn.
    this._breachG = new Graphics();
    this._layer.addChild(this._breachG);
    this._drawBreach(1.0);

    // Hidden by default — 3D renderer handles road visuals during gameplay.
    // showTitle() re-enables it for the 2D title-screen backdrop.
    this._layer.visible = false;
  }

  // No-op kept for call-site compatibility.
  setActiveLaneCount(_n) {}

  // No-op — breach pulse handled by Road3D in 3D mode; showTitle restores
  // laneLayer visibility when the 2D backdrop is needed.
  update(_elapsed) {}


  _drawBreach(alpha) {
    this._breachG.clear();
    // Soft red bloom behind the breach line
    this._breachG.rect(0, ROAD_BOTTOM_Y - 8, this._appW, 16);
    this._breachG.fill({ color: 0xdd2222, alpha: 0.15 * alpha });
    // Crisp 4px glowing red line
    this._breachG.moveTo(0, ROAD_BOTTOM_Y);
    this._breachG.lineTo(this._appW, ROAD_BOTTOM_Y);
    this._breachG.stroke({ color: 0xff3333, width: 4, alpha });
  }

  _draw(w) {
    const g = new Graphics();

    const RIGHT_ROAD_TOP_X   = ROAD_TOP_X + ROAD_TOP_W;  // 275
    const SH_TOP             = 8;    // shoulder width at top of road, px
    const LEFT_BARRIER_INNER = ROAD_TOP_X - SH_TOP;      // 107
    const RIGHT_BARRIER_INNER = RIGHT_ROAD_TOP_X + SH_TOP; // 283

    // Helper: road left x at normalised position t [0=top, 1=bottom]
    const roadLeft  = t => ROAD_TOP_X * (1 - t);
    const roadRight = t => RIGHT_ROAD_TOP_X + (w - RIGHT_ROAD_TOP_X) * t;

    // ── Dark background (fills entire lane area, visible behind barriers) ──────
    g.rect(0, ROAD_TOP_Y, w, ROAD_HEIGHT);
    g.fill(0x141414);

    // ── Left barrier wall: light grey concrete triangle ───────────────────────
    g.poly([0, ROAD_TOP_Y, LEFT_BARRIER_INNER, ROAD_TOP_Y, 0, ROAD_BOTTOM_Y]);
    g.fill({ color: 0x666666 });
    // Darker top face for 3-D depth
    g.rect(0, ROAD_TOP_Y, LEFT_BARRIER_INNER, 4);
    g.fill({ color: 0x444444 });

    // ── Right barrier wall ────────────────────────────────────────────────────
    g.poly([RIGHT_BARRIER_INNER, ROAD_TOP_Y, w, ROAD_TOP_Y, w, ROAD_BOTTOM_Y]);
    g.fill({ color: 0x666666 });
    g.rect(RIGHT_BARRIER_INNER, ROAD_TOP_Y, w - RIGHT_BARRIER_INNER, 4);
    g.fill({ color: 0x444444 });

    // ── Left shoulder: dark strip between barrier inner face and road edge ─────
    g.poly([LEFT_BARRIER_INNER, ROAD_TOP_Y, ROAD_TOP_X, ROAD_TOP_Y, 0, ROAD_BOTTOM_Y]);
    g.fill({ color: 0x222222 });

    // ── Right shoulder ─────────────────────────────────────────────────────────
    g.poly([RIGHT_ROAD_TOP_X, ROAD_TOP_Y, RIGHT_BARRIER_INNER, ROAD_TOP_Y, w, ROAD_BOTTOM_Y]);
    g.fill({ color: 0x222222 });

    // ── Asphalt surface: thin alternating strips, darker at top, lighter at bottom
    // Alternates #383838 / #404040 grain, with perspective gradient overlay.
    const STRIP_H  = 3;
    const nStrips  = Math.ceil(ROAD_HEIGHT / STRIP_H);
    for (let s = 0; s < nStrips; s++) {
      const t0   = s / nStrips;
      const t1   = Math.min(1, (s + 1) / nStrips);
      const tMid = (t0 + t1) / 2;
      const y0   = ROAD_TOP_Y + t0 * ROAD_HEIGHT;
      const y1   = ROAD_TOP_Y + t1 * ROAD_HEIGHT;
      const lx0  = roadLeft(t0),  rx0 = roadRight(t0);
      const lx1  = roadLeft(t1),  rx1 = roadRight(t1);
      // Perspective gradient: dark grey at horizon, lighter near player
      const isDark  = s % 2 === 0;
      const topGray = isDark ? 0x2a : 0x32;
      const botGray = isDark ? 0x42 : 0x4a;
      const gray    = Math.round(topGray + (botGray - topGray) * tMid);
      const color   = (gray << 16) | (gray << 8) | gray;
      g.poly([lx0, y0, rx0, y0, rx1, y1, lx1, y1]);
      g.fill(color);
    }

    // ── Road surface markings: faint transverse lines (expansion joints) ───────
    for (let p = 5; p < 100; p += 12) {
      const t  = p / 100;
      const y  = ROAD_TOP_Y + t * ROAD_HEIGHT;
      const lx = roadLeft(t), rx = roadRight(t);
      g.moveTo(lx, y);
      g.lineTo(rx, y);
      g.stroke({ color: 0xffffff, width: 1, alpha: 0.06 });
    }

    // ── Lane divider dashes (white, 1px at top → 3px at bottom) ──────────────
    const DASH_COUNT = 14;
    for (let lane = 1; lane < LANE_COUNT; lane++) {
      const topX = ROAD_TOP_X + lane * ROAD_TOP_W  / LANE_COUNT;
      const botX =              lane * ROAD_BOTTOM_W / LANE_COUNT;
      for (let d = 0; d < DASH_COUNT; d++) {
        const t0 = (d + 0.1) / DASH_COUNT;
        const t1 = (d + 0.6) / DASH_COUNT;
        if (t1 > 1) continue;
        const y0 = ROAD_TOP_Y + t0 * ROAD_HEIGHT;
        const y1 = ROAD_TOP_Y + t1 * ROAD_HEIGHT;
        const x0 = topX + (botX - topX) * t0;
        const x1 = topX + (botX - topX) * t1;
        const lw = 1 + 2 * ((t0 + t1) / 2);  // 1px at top, 3px at bottom
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke({ color: 0xffffff, width: lw, alpha: 0.80 });
      }
    }

    // ── Road edge lines (solid white on outer road boundary) ──────────────────
    g.moveTo(ROAD_TOP_X, ROAD_TOP_Y);
    g.lineTo(0, ROAD_BOTTOM_Y);
    g.stroke({ color: 0xffffff, width: 2.5, alpha: 0.90 });

    g.moveTo(RIGHT_ROAD_TOP_X, ROAD_TOP_Y);
    g.lineTo(w, ROAD_BOTTOM_Y);
    g.stroke({ color: 0xffffff, width: 2.5, alpha: 0.90 });

    // ── Barrier inner-face highlight (thin bright line for 3-D depth) ─────────
    g.moveTo(LEFT_BARRIER_INNER, ROAD_TOP_Y);
    g.lineTo(0, ROAD_BOTTOM_Y);
    g.stroke({ color: 0xaaaaaa, width: 1, alpha: 0.50 });

    g.moveTo(RIGHT_BARRIER_INNER, ROAD_TOP_Y);
    g.lineTo(w, ROAD_BOTTOM_Y);
    g.stroke({ color: 0xaaaaaa, width: 1, alpha: 0.50 });

    // ── Yellow reflector dots on barrier inner faces ──────────────────────────
    for (let dotY = ROAD_TOP_Y + 30; dotY < ROAD_BOTTOM_Y - 30; dotY += 60) {
      const t  = (dotY - ROAD_TOP_Y) / ROAD_HEIGHT;
      const r  = Math.max(1.5, 3 * (1 - t * 0.8));
      // Left barrier inner face converges from LEFT_BARRIER_INNER at top to 0 at bottom
      const leftDotX = LEFT_BARRIER_INNER * (1 - t) - 2;
      if (leftDotX > 2) {
        g.circle(leftDotX, dotY, r);
        g.fill({ color: 0xffdd00 });
      }
      // Right barrier inner face: RIGHT_BARRIER_INNER at top, w at bottom
      const rightDotX = RIGHT_BARRIER_INNER + (w - RIGHT_BARRIER_INNER) * t + 2;
      if (rightDotX < w - 2) {
        g.circle(rightDotX, dotY, r);
        g.fill({ color: 0xffdd00 });
      }
    }

    // ── Lamp posts on barrier inner faces (perspective-scaled) ──────────────────
    for (let lampY = ROAD_TOP_Y + 30; lampY < ROAD_BOTTOM_Y; lampY += 120) {
      const t = (lampY - ROAD_TOP_Y) / ROAD_HEIGHT;
      const scale = 0.25 + 0.75 * t;
      const poleW = Math.max(1, 2 * scale);
      const poleH = 16 * scale;
      const headR = Math.max(1.5, 3 * scale);
      const glowR = Math.max(2, 5 * scale);

      // Left post
      const leftPostX = LEFT_BARRIER_INNER * (1 - t) - 8;
      if (leftPostX > 6) {
        // Pole (drawn upward from lampY)
        g.rect(leftPostX - poleW / 2, lampY - poleH, poleW, poleH);
        g.fill({ color: 0x555555 });
        // Glow (larger circle, lower alpha)
        g.circle(leftPostX, lampY - poleH, glowR);
        g.fill({ color: 0xffee88, alpha: 0.20 });
        // Lamp head (bright circle at top of pole)
        g.circle(leftPostX, lampY - poleH, headR);
        g.fill({ color: 0xffee88 });
      }

      // Right post
      const rightPostX = RIGHT_BARRIER_INNER + (w - RIGHT_BARRIER_INNER) * t + 8;
      if (rightPostX < w - 6) {
        // Pole (drawn upward from lampY)
        g.rect(rightPostX - poleW / 2, lampY - poleH, poleW, poleH);
        g.fill({ color: 0x555555 });
        // Glow (larger circle, lower alpha)
        g.circle(rightPostX, lampY - poleH, glowR);
        g.fill({ color: 0xffee88, alpha: 0.20 });
        // Lamp head (bright circle at top of pole)
        g.circle(rightPostX, lampY - poleH, headR);
        g.fill({ color: 0xffee88 });
      }
    }

    // ── Distance haze: blue-grey fog at road top (alpha 0.30→0 over 76px) ─────
    const FOG_H     = 76;
    const FOG_BANDS = 10;
    for (let fb = 0; fb < FOG_BANDS; fb++) {
      const t0    = fb / FOG_BANDS;
      const t1    = (fb + 1) / FOG_BANDS;
      const alpha = 0.30 * (1 - t0) * (1 - t0);   // quadratic fade
      if (alpha < 0.01) continue;
      const y0  = ROAD_TOP_Y + t0 * FOG_H;
      const y1  = ROAD_TOP_Y + t1 * FOG_H;
      const tR0 = t0 * FOG_H / ROAD_HEIGHT;
      const tR1 = t1 * FOG_H / ROAD_HEIGHT;
      g.poly([roadLeft(tR0), y0, roadRight(tR0), y0, roadRight(tR1), y1, roadLeft(tR1), y1]);
      g.fill({ color: 0x8899aa, alpha });
    }

    // ── Horizon line at road top ───────────────────────────────────────────────
    g.moveTo(ROAD_TOP_X, ROAD_TOP_Y);
    g.lineTo(RIGHT_ROAD_TOP_X, ROAD_TOP_Y);
    g.stroke({ color: 0xdddddd, width: 1.5, alpha: 0.55 });

    this._layer.addChild(g);
  }
}
