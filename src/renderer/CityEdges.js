// CityEdges — dark urban city strips on both sides of the 3D road,
// plus ultra-faint scan lines across the full road surface.
//
// The Three.js orthographic camera frustum is ~11% wider than the road itself
// (frustum halfX ≈ 9.65 vs road halfX = 8.4), leaving ≈25 px of non-road
// canvas on each edge.  This layer draws INTO those margins in PixiJS so the
// player sees city context (sidewalk → kerb → buildings) framing the road.
//
// Layer: cityEdgeLayer — sits between backgroundLayer and laneLayer.
// Visibility: always on, never hidden by _startLevel, so it shows during gameplay.
//
// Urban dark aesthetic: narrow sidewalk → kerb stripe → building facades with
// lit windows → dark tree canopies (World 1 only).

import { Graphics, Container } from 'pixi.js';
import { ROAD_TOP_Y, ROAD_BOTTOM_Y } from './LaneRenderer.js';

// ── Layout ────────────────────────────────────────────────────────────────────
const ROAD_H = ROAD_BOTTOM_Y - ROAD_TOP_Y;   // ~466 px

// Side strip widths — sized to fit within the ~25 px frustum margin
const STRIP_W   = 26;   // total side strip width per side
const SWALK_W   = 10;   // sidewalk (road-adjacent, light grey)
const KERB_W    =  3;   // kerb stripe between sidewalk and buildings
const BUILD_W   = STRIP_W - SWALK_W - KERB_W;  // 13 px building zone

// Colors — dark urban night palette
const COL_SWALK     = 0xB8B0A0;   // warm grey sidewalk
const COL_KERB      = 0x888070;   // dark stone kerb
const COL_BUILD_BG  = 0x1E1E28;   // very dark building base fill

// Building facade colors — slight variation for depth
const BUILD_COLORS  = [0x1E2030, 0x252535, 0x1A1A28, 0x222238, 0x1C1C2C];

// Window colors — lit windows: warm yellow, cool white, occasional dim
const WIN_COLORS    = [0xFFE88A, 0xFFD54F, 0xE0F4FF, 0xFFEE88, 0xFFF3B0];
const WIN_DIM       = 0x2A3050;   // unlit window

// Tree canopy (World 1) — dark urban green
const COL_TREE  = 0x1A3A1A;
const TREE_R    = 5;

// Scan-line parameters (road surface texture)
const SL_SPACING = 8;
const SL_ALPHA   = 0.030;

// ── Deterministic building / tree layout ──────────────────────────────────────

// Buildings: { yFrac, hFrac, colorIdx }  — yFrac/hFrac are fractions of ROAD_H
// Each building is a rectangle filling BUILD_W, varying height.
const LEFT_BUILDINGS = [
  { yFrac: 0.00, hFrac: 0.18, colorIdx: 0 },
  { yFrac: 0.20, hFrac: 0.22, colorIdx: 2 },
  { yFrac: 0.44, hFrac: 0.16, colorIdx: 1 },
  { yFrac: 0.62, hFrac: 0.20, colorIdx: 3 },
  { yFrac: 0.84, hFrac: 0.16, colorIdx: 4 },
];
const RIGHT_BUILDINGS = [
  { yFrac: 0.00, hFrac: 0.20, colorIdx: 1 },
  { yFrac: 0.22, hFrac: 0.16, colorIdx: 3 },
  { yFrac: 0.40, hFrac: 0.22, colorIdx: 0 },
  { yFrac: 0.64, hFrac: 0.18, colorIdx: 2 },
  { yFrac: 0.84, hFrac: 0.16, colorIdx: 4 },
];

// Windows: { bldgIdx, row, col }  — 0-indexed row/col within a 2-row × 3-col grid
// per building. winColor picks from WIN_COLORS deterministically.
const LEFT_WINDOWS = [
  { b:0, r:0, c:0, lit:true  }, { b:0, r:0, c:1, lit:false }, { b:0, r:1, c:0, lit:true  }, { b:0, r:1, c:1, lit:true  },
  { b:1, r:0, c:0, lit:false }, { b:1, r:0, c:1, lit:true  }, { b:1, r:1, c:0, lit:true  }, { b:1, r:1, c:1, lit:false },
  { b:2, r:0, c:0, lit:true  }, { b:2, r:1, c:0, lit:true  },
  { b:3, r:0, c:0, lit:true  }, { b:3, r:0, c:1, lit:false }, { b:3, r:1, c:0, lit:false }, { b:3, r:1, c:1, lit:true  },
  { b:4, r:0, c:0, lit:false }, { b:4, r:1, c:0, lit:true  },
];
const RIGHT_WINDOWS = [
  { b:0, r:0, c:0, lit:true  }, { b:0, r:0, c:1, lit:true  }, { b:0, r:1, c:0, lit:false }, { b:0, r:1, c:1, lit:true  },
  { b:1, r:0, c:0, lit:true  }, { b:1, r:1, c:0, lit:false },
  { b:2, r:0, c:0, lit:false }, { b:2, r:0, c:1, lit:true  }, { b:2, r:1, c:0, lit:true  }, { b:2, r:1, c:1, lit:false },
  { b:3, r:0, c:0, lit:true  }, { b:3, r:1, c:0, lit:true  }, { b:3, r:1, c:1, lit:false },
  { b:4, r:0, c:0, lit:true  }, { b:4, r:1, c:0, lit:false }, { b:4, r:1, c:1, lit:true  },
];

// Trees: { yFrac }  — staggered between buildings (World 1 only)
const LEFT_TREES  = [{ yFrac: 0.10 }, { yFrac: 0.38 }, { yFrac: 0.74 }];
const RIGHT_TREES = [{ yFrac: 0.19 }, { yFrac: 0.54 }, { yFrac: 0.88 }];

export class CityEdges {
  constructor(layerManager, appW) {
    this._appW = appW;
    const layer = layerManager.get('cityEdgeLayer');

    this._container = new Container();
    layer.addChild(this._container);

    this._draw(appW);
  }

  // Static — no per-frame update needed.
  update(_dt) {}

  // ── Private ───────────────────────────────────────────────────────────────────

  _draw(appW) {
    const g = new Graphics();

    // ── LEFT strip ────────────────────────────────────────────────────────────
    // Building zone background (outermost, leftmost)
    g.rect(0, ROAD_TOP_Y, BUILD_W, ROAD_H);
    g.fill(COL_BUILD_BG);

    // Left buildings
    for (let i = 0; i < LEFT_BUILDINGS.length; i++) {
      const b  = LEFT_BUILDINGS[i];
      const by = ROAD_TOP_Y + b.yFrac * ROAD_H;
      const bh = b.hFrac * ROAD_H;
      g.rect(0, by, BUILD_W, bh);
      g.fill(BUILD_COLORS[b.colorIdx]);
    }

    // Left building windows (2×2 grid inside each building)
    for (const w of LEFT_WINDOWS) {
      const b  = LEFT_BUILDINGS[w.b];
      const by = ROAD_TOP_Y + b.yFrac * ROAD_H;
      const bh = b.hFrac * ROAD_H;
      const ww = 2, wh = 2;          // window size in px
      const cols = 2, rows = 2;
      const padX = Math.max(1, (BUILD_W - cols * (ww + 1)) / 2);
      const padY = Math.max(2, (bh - rows * (wh + 2)) / 2);
      const wx = padX + w.c * (ww + 1);
      const wy = by + padY + w.r * (wh + 2);
      const col = w.lit ? WIN_COLORS[(w.b * 3 + w.r * 2 + w.c) % WIN_COLORS.length] : WIN_DIM;
      g.rect(wx, wy, ww, wh);
      g.fill(col);
    }

    // Left trees (between buildings for World 1 feel)
    for (const t of LEFT_TREES) {
      const cx = BUILD_W / 2;
      const cy = ROAD_TOP_Y + t.yFrac * ROAD_H;
      g.circle(cx, cy, TREE_R);
      g.fill(COL_TREE);
    }

    // Kerb stripe (between building zone and sidewalk)
    g.rect(BUILD_W, ROAD_TOP_Y, KERB_W, ROAD_H);
    g.fill(COL_KERB);

    // Sidewalk (road-adjacent)
    g.rect(BUILD_W + KERB_W, ROAD_TOP_Y, SWALK_W, ROAD_H);
    g.fill(COL_SWALK);

    // ── RIGHT strip ───────────────────────────────────────────────────────────
    const rx = appW - STRIP_W;   // left edge of right strip

    // Sidewalk (road-adjacent)
    g.rect(rx, ROAD_TOP_Y, SWALK_W, ROAD_H);
    g.fill(COL_SWALK);

    // Kerb stripe
    g.rect(rx + SWALK_W, ROAD_TOP_Y, KERB_W, ROAD_H);
    g.fill(COL_KERB);

    // Building zone background
    const rbx = rx + SWALK_W + KERB_W;
    g.rect(rbx, ROAD_TOP_Y, BUILD_W, ROAD_H);
    g.fill(COL_BUILD_BG);

    // Right buildings
    for (let i = 0; i < RIGHT_BUILDINGS.length; i++) {
      const b  = RIGHT_BUILDINGS[i];
      const by = ROAD_TOP_Y + b.yFrac * ROAD_H;
      const bh = b.hFrac * ROAD_H;
      g.rect(rbx, by, BUILD_W, bh);
      g.fill(BUILD_COLORS[b.colorIdx]);
    }

    // Right building windows
    for (const w of RIGHT_WINDOWS) {
      const b  = RIGHT_BUILDINGS[w.b];
      const by = ROAD_TOP_Y + b.yFrac * ROAD_H;
      const bh = b.hFrac * ROAD_H;
      const ww = 2, wh = 2;
      const cols = 2, rows = 2;
      const padX = Math.max(1, (BUILD_W - cols * (ww + 1)) / 2);
      const padY = Math.max(2, (bh - rows * (wh + 2)) / 2);
      const wx = rbx + padX + w.c * (ww + 1);
      const wy = by + padY + w.r * (wh + 2);
      const col = w.lit ? WIN_COLORS[(w.b * 3 + w.r * 2 + w.c) % WIN_COLORS.length] : WIN_DIM;
      g.rect(wx, wy, ww, wh);
      g.fill(col);
    }

    // Right trees
    for (const t of RIGHT_TREES) {
      const cx = rbx + BUILD_W / 2;
      const cy = ROAD_TOP_Y + t.yFrac * ROAD_H;
      g.circle(cx, cy, TREE_R);
      g.fill(COL_TREE);
    }

    // ── Road scan lines — full road width, road height ────────────────────────
    for (let y = ROAD_TOP_Y; y < ROAD_BOTTOM_Y; y += SL_SPACING) {
      g.rect(0, y, appW, 1);
      g.fill({ color: 0xffffff, alpha: SL_ALPHA });
    }

    this._container.addChild(g);
  }
}
