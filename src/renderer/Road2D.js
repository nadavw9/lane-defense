// Road2D — clean top-down 2D road for the sky-view camera.
//
// Replaces the perspective LaneRenderer / 3D Road3D visuals during gameplay.
// The view is straight down, so the road is a plain vertical channel: dark
// asphalt, lighter edge borders, and dashed white lane dividers between lanes.
//
// On every shot fired the dashed dividers scroll DOWN by one dash period
// (ease-out over SCROLL_MS). The dash pattern repeats every period, so the
// scroll loops seamlessly — it reads as the road rushing toward the player by
// exactly one car-advance.
//
// Lane count adapts via setLaneCount(n). Draws into 'laneLayer' (behind cars).
import { Graphics, Container } from 'pixi.js';
import {
  ROAD_TOP_Y,
  ROAD_BOTTOM_Y,
  ROAD_HEIGHT,
  ROAD_BOTTOM_W,
} from './LaneRenderer.js';

const COL_ASPHALT = 0x1a1a2e;   // dark blue-grey asphalt (not pure black)
const COL_EDGE    = 0x2c2c44;   // slightly lighter road shoulder
const COL_EDGE_LN = 0x3a3a55;   // edge line
const COL_DIVIDER = 0xffffff;   // dashed lane divider

const EDGE_W      = 10;         // shoulder strip width, px
const DASH_LEN    = 26;         // px
const GAP_LEN     = 22;         // px
const PERIOD      = DASH_LEN + GAP_LEN;
const DASH_W      = 4;          // px
const SCROLL_MS   = 250;        // one-shot scroll duration

function easeOutCubic(t) { return 1 - Math.pow(1 - Math.min(1, t), 3); }

export class Road2D {
  constructor(layerManager) {
    this._root = new Container();
    layerManager.get('laneLayer').addChild(this._root);

    this._laneCount = 4;

    this._bg       = new Graphics();   // static asphalt + edges
    this._dividers = new Graphics();   // dashed lines (scrolled via .y)
    this._root.addChild(this._bg);
    this._root.addChild(this._dividers);

    // Clip the scrolling dividers to the road rect so they never spill into
    // the shooter zone below ROAD_BOTTOM_Y.
    this._mask = new Graphics()
      .rect(0, ROAD_TOP_Y, ROAD_BOTTOM_W, ROAD_HEIGHT)
      .fill(0xffffff);
    this._root.addChild(this._mask);
    this._dividers.mask = this._mask;

    // Scroll state.
    this._scrollFrom = 0;   // px
    this._scrollTo   = 0;
    this._scrollT    = 1;   // 1 = idle (no animation in flight)

    this._build();
  }

  show() { this._root.visible = true; }
  hide() { this._root.visible = false; }

  reset() {
    this._scrollFrom = this._scrollTo = 0;
    this._scrollT = 1;
    this._dividers.y = 0;
  }

  setLaneCount(n) {
    if (n === this._laneCount) return;
    this._laneCount = n;
    this._build();
  }

  // Trigger one seamless one-shot scroll (called on each shot fired).
  scrollTick() {
    // Continue from wherever the current animation is, advance one period.
    const cur = this._currentScroll();
    this._scrollFrom = cur;
    this._scrollTo   = cur + PERIOD;
    this._scrollT    = 0;
  }

  update(dt) {
    if (this._scrollT >= 1) return;
    this._scrollT += (dt * 1000) / SCROLL_MS;
    const y = this._currentScroll();
    // Keep the offset wrapped into [0, PERIOD) — pattern repeats, so this is
    // visually seamless while never letting the number grow unbounded.
    this._dividers.y = y % PERIOD;
    if (this._scrollT >= 1) {
      this._scrollT = 1;
      this._scrollFrom = this._scrollTo = this._dividers.y;
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _currentScroll() {
    if (this._scrollT >= 1) return this._scrollFrom;
    const e = easeOutCubic(this._scrollT);
    return this._scrollFrom + (this._scrollTo - this._scrollFrom) * e;
  }

  _build() {
    const W = ROAD_BOTTOM_W;
    const n = this._laneCount;

    // ── Background: asphalt + edge shoulders + edge lines ──────────────────
    const bg = this._bg;
    bg.clear();
    bg.rect(0, ROAD_TOP_Y, W, ROAD_HEIGHT).fill(COL_ASPHALT);
    bg.rect(0, ROAD_TOP_Y, EDGE_W, ROAD_HEIGHT).fill(COL_EDGE);
    bg.rect(W - EDGE_W, ROAD_TOP_Y, EDGE_W, ROAD_HEIGHT).fill(COL_EDGE);
    bg.rect(EDGE_W, ROAD_TOP_Y, 2, ROAD_HEIGHT).fill(COL_EDGE_LN);
    bg.rect(W - EDGE_W - 2, ROAD_TOP_Y, 2, ROAD_HEIGHT).fill(COL_EDGE_LN);

    // ── Dashed dividers between lanes (n-1 dividers for n lanes) ───────────
    const d = this._dividers;
    d.clear();
    const laneW = W / n;
    // Draw one extra period above the top so the seamless wrap (y in
    // [0,PERIOD)) never reveals a gap when scrolled down.
    for (let li = 1; li < n; li++) {
      const x = li * laneW - DASH_W / 2;
      for (let y = ROAD_TOP_Y - PERIOD; y < ROAD_BOTTOM_Y; y += PERIOD) {
        d.rect(x, y, DASH_W, DASH_LEN).fill({ color: COL_DIVIDER, alpha: 0.85 });
      }
    }
    d.y = this._dividers.y || 0;
  }
}
