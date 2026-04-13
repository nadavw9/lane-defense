// CityBackground — dark city silhouette at the road horizon.
//
// Drawn in backgroundLayer (layer 0) so the road and everything else
// sits on top.  Buildings sit at the road horizon (ROAD_TOP_Y = 44),
// with tops reaching upward into the sky strip (y = 0–44).
//
// Parallax: two depth layers (far / near) are separate Containers so
// only their x position changes each frame — no Graphics redraw.
// A third small Graphics redraws only the flickering window lights.
//
// Enhanced with:
// - Building variety: rectangles, antenna towers, stepped tops
// - Animated clouds that drift across the sky
// - Moon in upper-right with glow
import { Graphics, Container } from 'pixi.js';
import { ROAD_TOP_Y } from './LaneRenderer.js';

// ── Building definitions ──────────────────────────────────────────────────────
// depth 0 = far (slow), depth 1 = near (faster).
// x, w in screen pixels; h = full building height (clipped to sky strip).
// type: 'rect' (default), 'antenna' (tall tower on top), 'stepped' (descending width steps)
const BUILDINGS = [
  // far layer
  { x:   0, w: 30, h: 70, depth: 0, type: 'antenna' },
  { x:  24, w: 18, h: 40, depth: 0, type: 'rect' },
  { x:  44, w: 32, h: 60, depth: 0, type: 'stepped' },
  { x:  82, w: 20, h: 48, depth: 0, type: 'rect' },
  { x: 108, w: 14, h: 32, depth: 0, type: 'antenna' },
  { x: 130, w: 22, h: 50, depth: 0, type: 'rect' },
  { x: 158, w: 28, h: 65, depth: 0, type: 'stepped' },
  { x: 188, w: 22, h: 38, depth: 0, type: 'antenna' },
  { x: 214, w: 26, h: 54, depth: 0, type: 'rect' },
  { x: 258, w: 18, h: 42, depth: 0, type: 'stepped' },
  { x: 288, w: 32, h: 62, depth: 0, type: 'antenna' },
  { x: 328, w: 20, h: 46, depth: 0, type: 'rect' },
  { x: 352, w: 22, h: 40, depth: 0, type: 'rect' },
  { x: 374, w: 16, h: 68, depth: 0, type: 'antenna' },
  // near layer
  { x:   8, w: 36, h: 44, depth: 1, type: 'rect' },
  { x:  58, w: 28, h: 52, depth: 1, type: 'antenna' },
  { x: 100, w: 24, h: 48, depth: 1, type: 'stepped' },
  { x: 128, w: 24, h: 38, depth: 1, type: 'rect' },
  { x: 158, w: 42, h: 60, depth: 1, type: 'antenna' },
  { x: 210, w: 30, h: 55, depth: 1, type: 'stepped' },
  { x: 238, w: 26, h: 46, depth: 1, type: 'rect' },
  { x: 270, w: 32, h: 58, depth: 1, type: 'antenna' },
  { x: 308, w: 32, h: 54, depth: 1, type: 'rect' },
  { x: 346, w: 22, h: 42, depth: 1, type: 'stepped' },
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

    // ── Moon (static, drawn once) ────────────────────────────────────────────
    const moonG = new Graphics();
    const moonX = appW - 50, moonY = 18;
    const moonRadius = 16;
    // Glow ring (larger, low alpha)
    moonG.circle(moonX, moonY, moonRadius + 6);
    moonG.fill({ color: 0xfff5cc, alpha: 0.08 });
    // Moon (full circle)
    moonG.circle(moonX, moonY, moonRadius);
    moonG.fill({ color: 0xfff5cc, alpha: 0.85 });
    layer.addChild(moonG);

    // ── Building containers (one per depth, shifted for parallax) ─────────────
    this._containers = [new Container(), new Container()];
    for (const con of this._containers) layer.addChild(con);

    this._buildBuildings();

    // ── Window lights (redrawn each frame for flicker) ────────────────────────
    this._winG = new Graphics();
    layer.addChild(this._winG);

    // ── Clouds (animated, redrawn each frame) ────────────────────────────────
    this._cloudG = new Graphics();
    layer.addChild(this._cloudG);

    // Initialize cloud state: { x, y, w, h, speed }
    this._clouds = [
      { x: 20, y: 10, w: 35, h: 12, speed: 8 },
      { x: 120, y: 6, w: 42, h: 14, speed: 12 },
      { x: 240, y: 16, w: 38, h: 11, speed: 10 },
      { x: 340, y: 8, w: 40, h: 13, speed: 15 },
    ];
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

    // Update and redraw clouds.
    this._updateClouds(elapsed);
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
      const type = b.type || 'rect';

      if (type === 'antenna') {
        // Main rectangle body
        g.rect(b.x, by, b.w, bh);
        g.fill(col);

        // Rooftop accent
        g.rect(b.x, by, b.w, 1.5);
        g.fill({ color: 0x1e3045, alpha: 0.70 });

        // Antenna tower on top: narrow tall rectangle (12-20px tall, 3px wide)
        const towerH = 12 + Math.random() * 8;
        const tx = b.x + b.w * 0.5 - 1.5;  // centered
        g.rect(tx, by - towerH, 3, towerH);
        g.fill({ color: 0x1a2c3c, alpha: 0.75 });

        // Antenna tip
        g.circle(tx + 1.5, by - towerH - 2, 1.2);
        g.fill({ color: 0xff6b35, alpha: 0.60 });

      } else if (type === 'stepped') {
        // Stepped roofline: 2-3 descending steps
        // Bottom section (full width)
        g.rect(b.x, by, b.w, bh * 0.6);
        g.fill(col);
        // Middle section (80% width, offset 10%)
        g.rect(b.x + b.w * 0.1, by + bh * 0.6 * 0.5, b.w * 0.8, bh * 0.3);
        g.fill({ color: col, alpha: 0.95 });
        // Top section (60% width, offset 20%)
        g.rect(b.x + b.w * 0.2, by + bh * 0.9 * 0.5, b.w * 0.6, bh * 0.1);
        g.fill({ color: col, alpha: 0.90 });

        // Rooftop accent on each step
        g.rect(b.x, by, b.w, 1.5);
        g.fill({ color: 0x1e3045, alpha: 0.70 });
        g.rect(b.x + b.w * 0.1, by + bh * 0.6 * 0.5, b.w * 0.8, 1.0);
        g.fill({ color: 0x1e3045, alpha: 0.55 });

      } else {
        // Standard rectangle (default)
        g.rect(b.x, by, b.w, bh);
        g.fill(col);

        // Rooftop accent
        g.rect(b.x, by, b.w, 1.5);
        g.fill({ color: 0x1e3045, alpha: 0.70 });
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

  _updateClouds(elapsed) {
    // Update cloud positions (wrap around screen)
    for (const cloud of this._clouds) {
      cloud.x += cloud.speed * 0.016;  // roughly 16ms per frame
      // Wrap to left when cloud exits right edge
      if (cloud.x > this._appW + 50) {
        cloud.x = -cloud.w - 20;
      }
    }

    // Redraw all clouds
    this._drawClouds();
  }

  _drawClouds() {
    const g = this._cloudG;
    g.clear();

    for (const cloud of this._clouds) {
      // Each cloud is 2-3 overlapping ellipses (approximated as circles)
      // Left circle
      g.circle(cloud.x, cloud.y, cloud.w * 0.35);
      g.fill({ color: 0xffffff, alpha: 0.15 });
      // Middle circle (largest)
      g.circle(cloud.x + cloud.w * 0.25, cloud.y + cloud.h * 0.15, cloud.w * 0.45);
      g.fill({ color: 0xffffff, alpha: 0.18 });
      // Right circle
      g.circle(cloud.x + cloud.w * 0.5, cloud.y - cloud.h * 0.10, cloud.w * 0.40);
      g.fill({ color: 0xffffff, alpha: 0.12 });
    }
  }
}
