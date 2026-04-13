// CityBackground — dark city silhouette at the road horizon.
//
// Drawn in backgroundLayer (layer 0) so the road and everything else
// sits on top.  Buildings sit at the road horizon (ROAD_TOP_Y = 44),
// with tops reaching upward into the sky strip (y = 0–44).
//
// Parallax: two depth layers (far / near) are separate Containers so
// only their x position changes each frame — no Graphics redraw.
// A third small Graphics redraws only the flickering window lights.
import { Graphics, Container } from 'pixi.js';
import { ROAD_TOP_Y } from './LaneRenderer.js';

// ── Building definitions ──────────────────────────────────────────────────────
// depth 0 = far (slow), depth 1 = near (faster).
// x, w in screen pixels; h = full building height (clipped to sky strip).
const BUILDINGS = [
  // far layer
  { x:   0, w: 30, h: 70, depth: 0 },
  { x:  24, w: 18, h: 40, depth: 0 },
  { x:  44, w: 32, h: 60, depth: 0 },
  { x:  82, w: 20, h: 48, depth: 0 },
  { x: 108, w: 14, h: 32, depth: 0 },
  { x: 188, w: 22, h: 38, depth: 0 },
  { x: 214, w: 26, h: 54, depth: 0 },
  { x: 258, w: 18, h: 42, depth: 0 },
  { x: 288, w: 32, h: 62, depth: 0 },
  { x: 328, w: 20, h: 46, depth: 0 },
  { x: 352, w: 22, h: 40, depth: 0 },
  { x: 374, w: 16, h: 68, depth: 0 },
  // near layer
  { x:   8, w: 36, h: 44, depth: 1 },
  { x:  58, w: 28, h: 52, depth: 1 },
  { x: 128, w: 24, h: 38, depth: 1 },
  { x: 158, w: 42, h: 60, depth: 1 },
  { x: 238, w: 26, h: 46, depth: 1 },
  { x: 308, w: 32, h: 54, depth: 1 },
  { x: 346, w: 22, h: 42, depth: 1 },
];

// Window coords: [x, y] relative to screen (fixed — parallax containers handle shift).
// y values are in the 0–44 range; off-screen ones are skipped at draw time.
const WINDOWS = [
  [  6, ROAD_TOP_Y - 52 ], [  14, ROAD_TOP_Y - 44 ], [   6, ROAD_TOP_Y - 36 ],
  [ 50, ROAD_TOP_Y - 48 ], [  54, ROAD_TOP_Y - 38 ], [  54, ROAD_TOP_Y - 28 ],
  [ 92, ROAD_TOP_Y - 38 ], [  96, ROAD_TOP_Y - 28 ],
  [164, ROAD_TOP_Y - 50 ], [ 168, ROAD_TOP_Y - 40 ], [ 164, ROAD_TOP_Y - 30 ],
  [172, ROAD_TOP_Y - 50 ], [ 176, ROAD_TOP_Y - 38 ],
  [294, ROAD_TOP_Y - 52 ], [ 300, ROAD_TOP_Y - 44 ], [ 294, ROAD_TOP_Y - 34 ],
  [332, ROAD_TOP_Y - 38 ], [ 336, ROAD_TOP_Y - 28 ],
  [354, ROAD_TOP_Y - 32 ],
  [376, ROAD_TOP_Y - 58 ], [ 380, ROAD_TOP_Y - 48 ], [ 376, ROAD_TOP_Y - 38 ],
];

// Parallax parameters per depth.
const PARALLAX = [
  { amp: 1.5, speed: 0.13 },   // far
  { amp: 3.0, speed: 0.21 },   // near
];

export class CityBackground {
  constructor(layerManager, appW) {
    this._appW = appW;
    const layer = layerManager.get('backgroundLayer');

    // ── Sky gradient (drawn once, never changes) ──────────────────────────────
    const sky = new Graphics();
    sky.rect(0, 0, appW, ROAD_TOP_Y + 10);   // slightly past horizon for overlap
    sky.fill(0x090e16);                        // very dark blue-black at top
    // Lighter band near horizon
    sky.rect(0, ROAD_TOP_Y * 0.55, appW, ROAD_TOP_Y * 0.55);
    sky.fill({ color: 0x0f1c2a, alpha: 0.65 });
    layer.addChild(sky);

    // ── Building containers (one per depth, shifted for parallax) ─────────────
    this._containers = [new Container(), new Container()];
    for (const con of this._containers) layer.addChild(con);

    this._buildBuildings();

    // ── Window lights (redrawn each frame for flicker) ────────────────────────
    this._winG = new Graphics();
    layer.addChild(this._winG);
  }

  // Call every render frame.  elapsed = gs.elapsed (seconds).
  update(elapsed) {
    // Shift each depth container — no Graphics redraw needed.
    for (let d = 0; d < 2; d++) {
      const p = PARALLAX[d];
      this._containers[d].x = Math.sin(elapsed * p.speed) * p.amp;
    }

    // Redraw window flicker (cheap: ~22 tiny rect calls).
    this._drawWindows(elapsed);
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _buildBuildings() {
    // Two Graphics objects — one per depth — drawn once.
    const gfx = [new Graphics(), new Graphics()];

    for (const b of BUILDINGS) {
      const g   = gfx[b.depth];
      const bh  = Math.min(b.h, ROAD_TOP_Y);   // clip to sky strip height
      const by  = ROAD_TOP_Y - bh;
      const col = b.depth === 0 ? 0x0b1520 : 0x0f1d2c;

      // Building body
      g.rect(b.x, by, b.w, bh);
      g.fill(col);

      // Rooftop accent — single-pixel brighter line for definition
      g.rect(b.x, by, b.w, 1.5);
      g.fill({ color: 0x1e3045, alpha: 0.70 });

      // Water tower / antenna on taller buildings (depth 0 only, every 3rd)
      if (b.depth === 0 && b.h > 50) {
        const tx = b.x + b.w * 0.6;
        g.rect(tx,     by - 6, 3, 6);
        g.fill({ color: 0x1a2c3c, alpha: 0.75 });
        g.rect(tx - 2, by - 10, 7, 4);
        g.fill({ color: 0x1e3348, alpha: 0.65 });
      }
    }

    for (let d = 0; d < 2; d++) {
      this._containers[d].addChild(gfx[d]);
    }
  }

  _drawWindows(elapsed) {
    const g = this._winG;
    g.clear();

    for (let i = 0; i < WINDOWS.length; i++) {
      const [wx, wy] = WINDOWS[i];
      if (wy < 0 || wy >= ROAD_TOP_Y) continue;   // outside sky strip

      // Slow individual flicker so not all windows pulse together
      const brightness = 0.55 + 0.45 * Math.sin(elapsed * 1.8 + i * 1.27);
      g.rect(wx, wy, 2.5, 2.5);
      g.fill({ color: 0xffee88, alpha: 0.38 * brightness });
    }
  }
}
