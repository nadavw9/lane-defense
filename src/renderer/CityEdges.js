// CityEdges — dark urban city strips on both sides of the 3D road.
//
// Strip width is computed from the current lane count so that buildings always
// fill the exact space outside the visible road, regardless of how narrow the
// road is for low-lane-count levels.
//
// MIN_STRIP_PX enforces a minimum strip width on high-lane-count levels so that
// buildings and trees remain visible (≥ 9% of screen on each side).
//
// When sprites are preloaded (spriteFlags.loaded), building segments use
// building-1 through building-4 PNG sprites, and tree canopies use the three
// top-down tree PNGs (oak/elm/pine) instead of programmatic green circles.
//
// Layer: cityEdgeLayer — sits between backgroundLayer and laneLayer.

import { Graphics, Container, Sprite, TilingSprite, Assets } from 'pixi.js';
import { spriteFlags } from './SpriteFlags.js';
import { ROAD_TOP_Y, ROAD_BOTTOM_Y } from './LaneRenderer.js';

const APP_W  = 390;
const ROAD_H = ROAD_BOTTOM_Y - ROAD_TOP_Y;
const BOMB_ZONE_BOTTOM = 752;

// Minimum city-edge strip width — ensures buildings/trees are always visible
// even on 4-lane levels where the road nearly fills the screen.
const MIN_STRIP_PX = 35;   // ≈ 9% of 390px screen width

const FRUSTUM_HALF_X = 9.650;   // derived from Scene3D._computeFrustum at 390×844
function _roadHW(n) { return n * 2.0 + 0.4; }

function _stripWidths(laneCount) {
  const hw      = _roadHW(laneCount);
  const rawLeft  = Math.round((-hw / (2 * FRUSTUM_HALF_X) + 0.5) * APP_W);
  const rawRight = APP_W - Math.round(Math.min(APP_W, (hw / (2 * FRUSTUM_HALF_X) + 0.5) * APP_W));
  const leftW  = Math.max(MIN_STRIP_PX, rawLeft);
  const rightW = Math.max(MIN_STRIP_PX, rawRight);
  return { leftW, rightW };
}

const COL_SWALK    = 0xB8B0A0;
const COL_KERB     = 0x888070;
const COL_BUILD_BG = 0x1E1E28;
const COL_GRASS    = 0x2D4A18;  // dark grass green for bomb-zone extension below buildings

const BUILD_COLORS = [0x1E2030, 0x252535, 0x1A1A28, 0x222238, 0x1C1C2C];

const WIN_COLORS = [0xFFE88A, 0xFFD54F, 0xE0F4FF, 0xFFEE88, 0xFFF3B0];
const WIN_DIM    = 0x2A3050;

const SL_SPACING = 8;
const SL_ALPHA   = 0.028;

const SWALK_MAX = 10;
const KERB_MAX  =  3;

const BLDG_Y = [
  { yFrac: 0.00, hFrac: 0.18, cIdx: 0 },
  { yFrac: 0.20, hFrac: 0.22, cIdx: 2 },
  { yFrac: 0.44, hFrac: 0.16, cIdx: 1 },
  { yFrac: 0.62, hFrac: 0.20, cIdx: 3 },
  { yFrac: 0.84, hFrac: 0.16, cIdx: 4 },
];

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

// 4 tree positions — one per gap between adjacent building segments.
// Building segments end at yFrac 0.18, 0.42, 0.60, 0.82; midpoints of gaps are here.
const TREE_GAP_YFRACS = [
  { yFrac: 0.19 }, { yFrac: 0.43 }, { yFrac: 0.61 }, { yFrac: 0.83 },
];

const _BASE = import.meta.env.BASE_URL;

// Sidewalk-grass strip — 64×256, tiles vertically behind city edge strips.
const SWALK_GRASS_URL = `${_BASE}sprites/designed/sidewalk-grass-strip.png`;

// Park-grass tile — seamless 512×512 park ground (grass + flowers + pebbles).
// Tiled across the full bomb-zone side panels (theme-independent, all levels).
const PARK_GRASS_URL = `${_BASE}sprites/designed/park-grass-tile.png`;
const PARK_TILE_DISPLAY = 132;   // on-screen px per tile (tileScale = this/512)

// Theme building sets, swapped by world. tutorial keeps the original 4-variant
// scheme; industrial/night each have 5 variants (one per building slot).
const BUILDING_SET_INFO = {
  tutorial:   { prefix: 'building-tutorial',   count: 5 },
  industrial: { prefix: 'building-industrial', count: 5 },
  night:      { prefix: 'building-night',      count: 5 },
};

// Three top-down tree canopy sprites — oak, elm, pine.
const TREE_URLS = [
  `${_BASE}sprites/designed/tree-oak-topdown.png`,
  `${_BASE}sprites/designed/tree-elm-topdown.png`,
  `${_BASE}sprites/designed/tree-pine-topdown.png`,
];

export class CityEdges {
  constructor(layerManager, appW) {
    this._appW  = appW;
    this._layer = layerManager.get('cityEdgeLayer');

    this._container = new Container();
    this._layer.addChild(this._container);

    this._laneCount   = 4;
    this._buildingSet = 'tutorial';
    this._worldPanel  = 'world1';   // AI city panel per world (world1|world2|world3)

    this._draw(this._laneCount);
  }

  setLaneCount(n) {
    this._laneCount = n;
    this._redraw();
  }

  // Swap the theme building set (tutorial | industrial | night).
  // Stores the set; the subsequent setLaneCount() call in _startLevel redraws.
  // Used only by the programmatic fallback path (when sprites aren't loaded).
  setBuildingSet(set) {
    this._buildingSet = BUILDING_SET_INFO[set] ? set : 'tutorial';
  }

  // Swap the AI-generated world side-panel image (world1 | world2 | world3).
  // Stores it; the subsequent setLaneCount() call in _startLevel redraws.
  setWorldPanel(world) {
    if (world === 'world1' || world === 'world2' || world === 'world3') this._worldPanel = world;
  }

  _redraw() {
    this._container.removeChildren();
    this._draw(this._laneCount);
  }

  update(_dt) {}

  // Build the sprite URL for one slot, using the active theme set.
  // tutorial (count 4) keeps the original formula exactly; 5-variant sets reuse it.
  _buildingUrl(sideIdx, slotIdx) {
    const info = BUILDING_SET_INFO[this._buildingSet] ?? BUILDING_SET_INFO.tutorial;
    return `${_BASE}sprites/designed/${info.prefix}-${((sideIdx * 3 + slotIdx) % info.count) + 1}.png`;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _draw(laneCount) {
    const { leftW, rightW } = _stripWidths(laneCount);
    const appW = this._appW;

    // ── World-panel mode (primary) ───────────────────────────────────────────
    // One full-height AI city image per side replaces the tiled building /
    // sidewalk / tree / park system. Falls back to the programmatic system below
    // if sprites aren't loaded or a panel texture is missing.
    if (spriteFlags.loaded && this._worldPanel) {
      const okL = leftW  <= 0 || this._addWorldPanel(0, leftW, 'left');
      const okR = rightW <= 0 || this._addWorldPanel(appW - rightW, rightW, 'right');
      if (okL && okR) return;
      this._container.removeChildren();   // a panel texture was missing → fall through
    }

    const extH = BOMB_ZONE_BOTTOM - ROAD_BOTTOM_Y;
    const tsH  = ROAD_H + extH;

    // Background: sidewalk-grass texture (loaded) or dark fill (fallback).
    // The texture (64×256) tiles vertically. Left strip is flipped so grass faces buildings.
    const sgTex = spriteFlags.loaded ? Assets.get(SWALK_GRASS_URL) : null;
    if (sgTex) {
      if (leftW > 0) {
        const ts = new TilingSprite({ texture: sgTex, width: leftW, height: tsH });
        ts.tileScale.set(leftW / 64, 1);
        ts.scale.x = -1;
        ts.x       = leftW;   // mirror origin so strip renders at [0, leftW] flipped
        ts.y       = ROAD_TOP_Y;
        this._container.addChild(ts);
      }
      if (rightW > 0) {
        const ts = new TilingSprite({ texture: sgTex, width: rightW, height: tsH });
        ts.tileScale.set(rightW / 64, 1);
        ts.x = appW - rightW;
        ts.y = ROAD_TOP_Y;
        this._container.addChild(ts);
      }
    } else {
      const g_bg = new Graphics();
      if (leftW  > 0) {
        const { bx, buildW } = this._layout(0, leftW, false);
        g_bg.rect(bx, ROAD_TOP_Y, buildW, tsH);
        g_bg.fill(COL_BUILD_BG);
      }
      if (rightW > 0) {
        const { bx, buildW } = this._layout(appW - rightW, rightW, true);
        g_bg.rect(bx, ROAD_TOP_Y, buildW, tsH);
        g_bg.fill(COL_BUILD_BG);
      }
      this._container.addChild(g_bg);
    }

    // Building sprites sit over texture/backdrop (added after = higher z-order)
    if (leftW  > 0) this._addBuildingSprites(0,          leftW,  0);
    if (rightW > 0) this._addBuildingSprites(appW - rightW, rightW, 1);

    // Sidewalk, kerb, windows, fallback trees, scan lines
    const g = new Graphics();

    if (leftW  > 0) this._drawStrip(g, 0,          leftW,  false);
    if (rightW > 0) this._drawStrip(g, appW - rightW, rightW, true);

    for (let y = ROAD_TOP_Y; y < ROAD_BOTTOM_Y; y += SL_SPACING) {
      g.rect(0, y, appW, 1);
      g.fill({ color: 0xffffff, alpha: SL_ALPHA });
    }

    this._container.addChild(g);

    // ── Park-grass over the FULL bomb-zone side panels (both sides, all themes) ─
    // Seamless TilingSprite from road bottom to bomb-zone bottom, no flat gaps.
    const parkTex = spriteFlags.loaded ? Assets.get(PARK_GRASS_URL) : null;
    if (parkTex) {
      const py = ROAD_BOTTOM_Y;
      const ph = BOMB_ZONE_BOTTOM - ROAD_BOTTOM_Y;
      const ts = PARK_TILE_DISPLAY / 512;
      if (leftW > 0) {
        const t = new TilingSprite({ texture: parkTex, width: leftW, height: ph });
        t.tileScale.set(ts, ts); t.x = 0;            t.y = py; this._container.addChild(t);
      }
      if (rightW > 0) {
        const t = new TilingSprite({ texture: parkTex, width: rightW, height: ph });
        t.tileScale.set(ts, ts); t.x = appW - rightW; t.y = py; this._container.addChild(t);
      }
    }

    // PNG tree sprites on top of everything (replaces fallback circles when loaded)
    if (leftW  > 0) this._addTreeSprites(0,           leftW,  false);
    if (rightW > 0) this._addTreeSprites(appW - rightW, rightW, true);
  }

  // Render one full-height world panel image over the whole side strip
  // (screen edge → road edge, road top → bomb-zone bottom). Uses COVER-CROP: the
  // image is scaled to fill the strip at its natural proportions (no horizontal
  // squish on narrow 4-lane strips), anchored to the outer screen edge (where the
  // buildings sit) and masked to the strip so the overflow is cropped away.
  // Returns false if the texture isn't available so the caller can fall back.
  _addWorldPanel(x0, stripW, side) {
    const tex = Assets.get(`${_BASE}sprites/designed/${this._worldPanel}-${side}.png`);
    if (!tex) return false;
    const top    = ROAD_TOP_Y;
    const panelH = BOMB_ZONE_BOTTOM - ROAD_TOP_Y;
    const scale  = Math.max(stripW / tex.width, panelH / tex.height);   // cover

    const spr = new Sprite(tex);
    spr.scale.set(scale);
    spr.y = top;
    if (side === 'right') { spr.anchor.set(1, 0); spr.x = x0 + stripW; }  // buildings hug screen-right
    else                  { spr.anchor.set(0, 0); spr.x = x0; }           // buildings hug screen-left

    const mask = new Graphics();
    mask.rect(x0, top, stripW, panelH).fill(0xffffff);
    spr.mask = mask;
    this._container.addChild(mask);
    this._container.addChild(spr);
    return true;
  }

  // Compute strip layout from x0 + width (shared between sprite and graphics paths)
  _layout(x0, w, rightSide) {
    const swalkW = Math.min(SWALK_MAX, Math.round(w * 0.30));
    const kerbW  = Math.min(KERB_MAX,  Math.round(w * 0.10));
    const buildW = Math.max(1, w - swalkW - kerbW);
    let bx, swalkX, kerbX;
    if (rightSide) {
      swalkX = x0; kerbX = x0 + swalkW; bx = x0 + swalkW + kerbW;
    } else {
      bx = x0; kerbX = x0 + buildW; swalkX = x0 + buildW + kerbW;
    }
    return { bx, swalkX, kerbX, swalkW, kerbW, buildW };
  }

  // Add one Sprite per building segment; only called when spriteFlags.loaded.
  _addBuildingSprites(x0, w, sideIdx) {
    if (!spriteFlags.loaded) return;
    const { bx, buildW } = this._layout(x0, w, sideIdx === 1);
    for (let i = 0; i < BLDG_Y.length; i++) {
      const b       = BLDG_Y[i];
      const by      = ROAD_TOP_Y + b.yFrac * ROAD_H;
      const bh      = b.hFrac * ROAD_H;
      const texture = Assets.get(this._buildingUrl(sideIdx, i));
      if (!texture) continue;
      const sprite  = new Sprite(texture);
      sprite.x      = bx;
      sprite.y      = by;
      sprite.width  = buildW;
      sprite.height = bh;
      this._container.addChild(sprite);
    }
  }

  // Add PNG tree canopy sprites; only called when spriteFlags.loaded.
  // Trees are placed at the sidewalk center (road-facing edge of the strip) so
  // they read as street trees standing in front of buildings, not on them.
  // Large trees on wide strips (L1) get a subtle grey-green tint for atmosphere.
  _addTreeSprites(x0, w, rightSide) {
    if (!spriteFlags.loaded) return;
    const { bx, buildW } = this._layout(x0, w, rightSide);
    const sideBase  = rightSide ? 1 : 0;
    // Cap tree size so canopies sit in the gaps between buildings rather than
    // covering them — especially on wide strips (L1 single-lane) where buildW is
    // large. Was 70 (Batch A); reduced so trees read as street trees.
    const treeSize  = Math.round(Math.max(22, Math.min(42, buildW * 0.85)));
    const cx        = bx + buildW / 2;
    const jitterMax = Math.max(1, Math.min(4, buildW * 0.12));

    for (let i = 0; i < TREE_GAP_YFRACS.length; i++) {
      const url     = TREE_URLS[(i + sideBase) % TREE_URLS.length];
      const texture = Assets.get(url);
      if (!texture) continue;
      const sprite  = new Sprite(texture);
      sprite.anchor.set(0.5);
      const xOff   = ((i * 7 + sideBase * 3) % 5 - 2) * jitterMax * 0.5;
      sprite.x     = cx + xOff;
      sprite.y     = ROAD_TOP_Y + TREE_GAP_YFRACS[i].yFrac * ROAD_H;
      sprite.width  = treeSize;
      sprite.height = treeSize;
      if (treeSize > 50) sprite.tint = 0xCCDDCC;
      this._container.addChild(sprite);
    }
  }

  _drawStrip(g, x0, w, rightSide) {
    const { bx, swalkX, kerbX, swalkW, kerbW, buildW } = this._layout(x0, w, rightSide);

    // Building zone background — only when sprites are not loaded.
    if (!spriteFlags.loaded) {
      g.rect(bx, ROAD_TOP_Y, buildW, ROAD_H);
      g.fill(COL_BUILD_BG);
    }

    const wins = rightSide ? RIGHT_WINS : LEFT_WINS;
    this._drawBuildings(g, bx, buildW, wins, TREE_GAP_YFRACS);

    g.rect(kerbX, ROAD_TOP_Y, kerbW, ROAD_H);
    g.fill(COL_KERB);

    g.rect(swalkX, ROAD_TOP_Y, swalkW, ROAD_H);
    g.fill(COL_SWALK);

    g.rect(swalkX, ROAD_TOP_Y, swalkW, 1);
    g.fill({ color: 0xffffff, alpha: 0.10 });

    // Bomb-zone side panels are filled by a park-grass TilingSprite covering the
    // FULL strip (added in _draw). Flat fallback only when the texture isn't loaded.
    if (!spriteFlags.loaded) {
      const extH = BOMB_ZONE_BOTTOM - ROAD_BOTTOM_Y;
      g.rect(x0, ROAD_BOTTOM_Y, w, extH); g.fill(COL_GRASS);
    }
  }

  _drawBuildings(g, bx, buildW, wins, trees) {
    const cols = buildW >= 8 ? 2 : 1;
    const ww   = Math.max(1, Math.round(buildW / (cols * 3.5)));
    const wh   = Math.max(1, Math.round(ww * 1.0));

    const OPACITIES = [0.92, 0.85, 0.95, 0.88, 0.90];

    // Flat-color building rects — fallback when sprites are not loaded.
    if (!spriteFlags.loaded) {
      for (let i = 0; i < BLDG_Y.length; i++) {
        const b  = BLDG_Y[i];
        const by = ROAD_TOP_Y + b.yFrac * ROAD_H;
        const bh = b.hFrac * ROAD_H;
        g.rect(bx, by, buildW, bh);
        g.fill({ color: BUILD_COLORS[b.cIdx], alpha: OPACITIES[i] });
      }
    }

    // Programmatic windows painted dark-navy (WIN_DIM) squares on top of the
    // warm tutorial building sprites (which carry their own rooftop detail).
    // Suppress them for the tutorial set when sprites are loaded. Industrial/
    // night keep their existing overlay unchanged (left exactly as before).
    const drawWindows = !spriteFlags.loaded || this._buildingSet !== 'tutorial';
    if (drawWindows) {
      for (const w of wins) {
        const b    = BLDG_Y[w.b];
        const by   = ROAD_TOP_Y + b.yFrac * ROAD_H;
        const bh   = b.hFrac * ROAD_H;
        const rows = 2;
        const padX = Math.max(1, (buildW - cols * (ww + 1)) / 2);
        const padY = Math.max(2, (bh - rows * (wh + 2)) / 2);
        if (w.c >= cols) continue;
        const wx  = bx + padX + w.c * (ww + 1);
        const wy  = by + padY + w.r * (wh + 2);
        const col = w.lit ? WIN_COLORS[(w.b * 3 + w.r * 2 + w.c) % WIN_COLORS.length] : WIN_DIM;
        g.rect(wx, wy, ww, wh);
        g.fill(col);
      }
    }

    // Tree canopies — programmatic fallback when PNG sprites not loaded.
    if (!spriteFlags.loaded) {
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
}
