// CityEdges — dark urban city strips on both sides of the 3D road.
//
// Strip width is computed from the current lane count so that buildings always
// fill the exact space outside the visible road, regardless of how narrow the
// road is for low-lane-count levels.
//
// Layer: cityEdgeLayer — sits between backgroundLayer and laneLayer.

import { Graphics, Container } from 'pixi.js';
import { ROAD_TOP_Y, ROAD_BOTTOM_Y } from './LaneRenderer.js';

const APP_W  = 390;
const ROAD_H = ROAD_BOTTOM_Y - ROAD_TOP_Y;

// Frustum half-X in world units — derived from Scene3D._computeFrustum constants.
// fHalfZe ≈ 20.884 → fHalfX = 20.884 * (390/844) ≈ 9.650
const FRUSTUM_HALF_X = 9.650;

// roadHalfW(n) mirrors Scene3D.roadHalfW — n * 2.0 + 0.4
function _roadHW(n) { return n * 2.0 + 0.4; }

// Compute how many pixels of city strip appear on each side given lane count.
function _stripWidths(laneCount) {
  const hw     = _roadHW(laneCount);
  const leftW  = Math.max(0, Math.round((-hw / (2 * FRUSTUM_HALF_X) + 0.5) * APP_W));
  const rightW = Math.max(0, APP_W - Math.round(Math.min(APP_W, (hw / (2 * FRUSTUM_HALF_X) + 0.5) * APP_W)));
  return { leftW, rightW };
}

// Colors — dark urban night palette
const COL_SWALK    = 0xB8B0A0;
const COL_KERB     = 0x888070;
const COL_BUILD_BG = 0x1E1E28;

// Building facade colors — 5 variants for depth
const BUILD_COLORS = [0x1E2030, 0x252535, 0x1A1A28, 0x222238, 0x1C1C2C];

// Window colors — lit warm/cool, plus dim (unlit)
const WIN_COLORS = [0xFFE88A, 0xFFD54F, 0xE0F4FF, 0xFFEE88, 0xFFF3B0];
const WIN_DIM    = 0x2A3050;

// Tree canopy
const COL_TREE = 0x1A3A1A;

// Scan-line overlay
const SL_SPACING = 8;
const SL_ALPHA   = 0.028;

// Fixed sizes for sidewalk / kerb (clamped if strip is very narrow)
const SWALK_MAX = 10;
const KERB_MAX  =  3;

// Buildings: y-span definitions as fractions of ROAD_H (5 segments per side)
const BLDG_Y = [
  { yFrac: 0.00, hFrac: 0.18, cIdx: 0 },
  { yFrac: 0.20, hFrac: 0.22, cIdx: 2 },
  { yFrac: 0.44, hFrac: 0.16, cIdx: 1 },
  { yFrac: 0.62, hFrac: 0.20, cIdx: 3 },
  { yFrac: 0.84, hFrac: 0.16, cIdx: 4 },
];

// Deterministic per-building window pattern: { bldgIdx, row, col, lit }
const LEFT_WINS = [
  { b:0,r:0,c:0,lit:1 }, { b:0,r:0,c:1,lit:0 }, { b:0,r:1,c:0,lit:1 }, { b:0,r:1,c:1,lit:1 },
  { b:1,r:0,c:0,lit:0 }, { b:1,r:0,c:1,lit:1 }, { b:1,r:1,c:0,lit:1 }, { b:1,r:1,c:1,lit:0 },
  { b:2,r:0,c:0,lit:1 }, { b:2,r:1,c:0,lit:1 },
  { b:3,r:0,c:0,lit:1 }, { b:3,r:0,c:1,lit:0 }, { b:3,r:1,c:0,lit:0 }, { b:3,r:1,c:1,lit:1 },
  { b:4,r:0,c:0,lit:0 }, { b:4,r:1,c:0,lit:1 },
];
const RIGHT_WINS = [
  { b:0,r:0,c:0,lit:1 }, { b:0,r:0,c:1,lit:1 }, { b:0,r:1,c:0,lit:0 }, { b:0,r:1,c:1,lit:1 },
  { b:1,r:0,c:0,lit:1 }, { b:1,r:1,c:0,lit:0 },
  { b:2,r:0,c:0,lit:0 }, { b:2,r:0,c:1,lit:1 }, { b:2,r:1,c:0,lit:1 }, { b:2,r:1,c:1,lit:0 },
  { b:3,r:0,c:0,lit:1 }, { b:3,r:1,c:0,lit:1 }, { b:3,r:1,c:1,lit:0 },
  { b:4,r:0,c:0,lit:1 }, { b:4,r:1,c:0,lit:0 }, { b:4,r:1,c:1,lit:1 },
];

const LEFT_TREES  = [{ yFrac: 0.10 }, { yFrac: 0.38 }, { yFrac: 0.74 }];
const RIGHT_TREES = [{ yFrac: 0.19 }, { yFrac: 0.54 }, { yFrac: 0.88 }];

export class CityEdges {
  constructor(layerManager, appW) {
    this._appW  = appW;
    this._layer = layerManager.get('cityEdgeLayer');

    this._container = new Container();
    this._layer.addChild(this._container);

    this._draw(4);   // default to 4 lanes; GameApp calls setLaneCount at level start
  }

  setLaneCount(n) {
    this._container.removeChildren();
    this._draw(n);
  }

  update(_dt) {}

  // ── Private ─────────────────────────────────────────────────────────────────

  _draw(laneCount) {
    const { leftW, rightW } = _stripWidths(laneCount);
    const appW = this._appW;

    const g = new Graphics();

    if (leftW > 0)  this._drawStrip(g, 0,        leftW,  false);
    if (rightW > 0) this._drawStrip(g, appW - rightW, rightW, true);

    // Scan lines across full road surface
    for (let y = ROAD_TOP_Y; y < ROAD_BOTTOM_Y; y += SL_SPACING) {
      g.rect(0, y, appW, 1);
      g.fill({ color: 0xffffff, alpha: SL_ALPHA });
    }

    this._container.addChild(g);
  }

  // Draw one city strip.  `x0` is left edge, `w` is strip width.
  // `rightSide`: if true, sidewalk is innermost (road-adjacent), buildings outermost.
  _drawStrip(g, x0, w, rightSide) {
    const swalkW = Math.min(SWALK_MAX, Math.round(w * 0.30));
    const kerbW  = Math.min(KERB_MAX,  Math.round(w * 0.10));
    const buildW = Math.max(1, w - swalkW - kerbW);

    let bx, swalkX, kerbX;
    if (rightSide) {
      // layout: sidewalk | kerb | buildings (outermost)
      swalkX = x0;
      kerbX  = x0 + swalkW;
      bx     = x0 + swalkW + kerbW;
    } else {
      // layout: buildings | kerb | sidewalk (road-adjacent)
      bx     = x0;
      kerbX  = x0 + buildW;
      swalkX = x0 + buildW + kerbW;
    }

    // Building zone background
    g.rect(bx, ROAD_TOP_Y, buildW, ROAD_H);
    g.fill(COL_BUILD_BG);

    // Tiled building segments
    const wins  = rightSide ? RIGHT_WINS  : LEFT_WINS;
    const trees = rightSide ? RIGHT_TREES : LEFT_TREES;
    this._drawBuildings(g, bx, buildW, wins, trees);

    // Kerb stripe
    g.rect(kerbX, ROAD_TOP_Y, kerbW, ROAD_H);
    g.fill(COL_KERB);

    // Sidewalk
    g.rect(swalkX, ROAD_TOP_Y, swalkW, ROAD_H);
    g.fill(COL_SWALK);

    // Subtle top highlight on sidewalk
    g.rect(swalkX, ROAD_TOP_Y, swalkW, 1);
    g.fill({ color: 0xffffff, alpha: 0.10 });
  }

  _drawBuildings(g, bx, buildW, wins, trees) {
    // Scale window grid to building width — at least 2 cols when buildW ≥ 8px
    const cols  = buildW >= 8 ? 2 : 1;
    const ww    = Math.max(1, Math.round(buildW / (cols * 3.5)));  // window width
    const wh    = Math.max(1, Math.round(ww * 1.0));               // window height

    // Slight opacity variation per building for depth
    const OPACITIES = [0.92, 0.85, 0.95, 0.88, 0.90];

    for (let i = 0; i < BLDG_Y.length; i++) {
      const b   = BLDG_Y[i];
      const by  = ROAD_TOP_Y + b.yFrac * ROAD_H;
      const bh  = b.hFrac * ROAD_H;
      const col = BUILD_COLORS[b.cIdx];

      g.rect(bx, by, buildW, bh);
      g.fill({ color: col, alpha: OPACITIES[i] });
    }

    // Windows drawn over building rects
    for (const w of wins) {
      const b   = BLDG_Y[w.b];
      const by  = ROAD_TOP_Y + b.yFrac * ROAD_H;
      const bh  = b.hFrac * ROAD_H;
      const rows = 2;
      const padX = Math.max(1, (buildW - cols * (ww + 1)) / 2);
      const padY = Math.max(2, (bh - rows * (wh + 2)) / 2);
      if (w.c >= cols) continue;   // skip extra windows if too narrow
      const wx  = bx + padX + w.c * (ww + 1);
      const wy  = by + padY + w.r * (wh + 2);
      const col = w.lit ? WIN_COLORS[(w.b * 3 + w.r * 2 + w.c) % WIN_COLORS.length] : WIN_DIM;
      g.rect(wx, wy, ww, wh);
      g.fill(col);
    }

    // Tree canopies (World 1 feel)
    const cx = bx + buildW / 2;
    const tr  = Math.max(3, Math.round(buildW * 0.30));
    for (const t of trees) {
      const cy = ROAD_TOP_Y + t.yFrac * ROAD_H;
      g.circle(cx, cy, tr);
      g.fill({ color: 0x1A3A1A, alpha: 0.88 });
      g.circle(cx, cy - tr * 0.25, tr * 0.55);
      g.fill({ color: 0x224422, alpha: 0.60 });
    }
  }
}
