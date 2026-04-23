// LevelSelectScreen — Car-themed world map, Candy Crush style.
//
// Visual design: night highway with city skyline, road markings path,
// road-sign level nodes, reveal animation on new unlock.
//
// Layout: 20 levels in a snaking path, 5 rows × 4 columns.
// Even data-rows L→R; odd rows R→L (same snake as before).
import { Container, Graphics, Text } from 'pixi.js';

// ── Layout constants ────────────────────────────────────────────────────────
const HEADER_H  = 68;
const NODE_R    = 26;

// Column centres and row centres (same snake geometry as before).
const COLS_X = [52, 150, 240, 338];
const ROWS_Y = [138, 302, 466, 630, 794];

// Shooter color palette (cars on path use these).
const CAR_COLORS = [0xE24B4A, 0x378ADD, 0x639922, 0xEF9F27, 0x7F77DD, 0xD85A30];

// ── Helpers ─────────────────────────────────────────────────────────────────

function nodePos(levelId) {
  const i        = levelId - 1;
  const dataRow  = Math.floor(i / 4);
  const posInRow = i % 4;
  const visualRow = 4 - dataRow;
  const isRTL    = dataRow % 2 === 1;
  const col      = isRTL ? (3 - posInRow) : posInRow;
  return { x: COLS_X[col], y: ROWS_Y[visualRow] };
}

// ── Main class ───────────────────────────────────────────────────────────────

export class LevelSelectScreen {
  constructor(stage, appW, appH, progress,
    { onSelectLevel, onBack, onShop, onAchievements, audio, weeklyLevels = [] },
    livesManager = null) {

    this._container     = new Container();
    stage.addChild(this._container);
    this._glowNode      = null;
    this._glowTime      = 0;
    this._lives         = livesManager;
    this._worldPage     = 1;
    this._progress      = progress;
    this._appW          = appW;
    this._appH          = appH;
    this._weeklyLevels  = weeklyLevels;
    this._callbacks     = { onSelectLevel, onBack, onShop, onAchievements, audio, weeklyLevels };
    // Reveal animations: { node: Container, t: 0, duration: 0.45 }
    this._revealAnims   = [];
    this._build(appW, appH, progress, onSelectLevel, onBack, onShop, onAchievements, audio);
  }

  destroy() { this._container.destroy({ children: true }); }

  update(dt) {
    // Pulse the "next to play" ring.
    if (this._glowNode) {
      this._glowTime += dt;
      const t = (this._glowTime % 1.4) / 1.4;
      this._glowNode.alpha = 0.30 + 0.55 * Math.abs(Math.sin(t * Math.PI));
    }
    // Drive reveal animations.
    for (let i = this._revealAnims.length - 1; i >= 0; i--) {
      const a = this._revealAnims[i];
      a.t = Math.min(a.t + dt / a.duration, 1);
      const ease = 1 - Math.pow(1 - a.t, 3);
      const overshoot = a.t < 0.7 ? Math.sin(a.t / 0.7 * Math.PI) * 0.35 : 0;
      const s = ease * (1 + overshoot);
      a.node.scale.set(s);
      a.node.alpha = Math.min(1, a.t * 2.5);
      if (a.t >= 1) this._revealAnims.splice(i, 1);
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build(w, h, progress, onSelectLevel, onBack, onShop, onAchievements, audio) {
    // ── Background: night city highway ─────────────────────────────────────
    this._drawBackground(w, h);

    // ── Road path (grey road with dashed centre line) ──────────────────────
    const unlocked = progress.unlockedLevel ?? 1;
    this._drawRoadPath(unlocked);

    // ── Decorative mini-cars along path ────────────────────────────────────
    this._drawCars();

    // ── Level nodes ────────────────────────────────────────────────────────
    const worldBase  = (this._worldPage - 1) * 20;
    const firstId    = worldBase + 1;
    const lastId     = worldBase + 20;
    const nextToPlay = (unlocked >= firstId && unlocked <= lastId && progress.getStars(unlocked) === 0)
      ? unlocked : null;

    // Detect newly unlocked level for reveal animation.
    const newlyUnlocked = (unlocked >= firstId && unlocked <= lastId) ? unlocked : null;

    for (let levelId = firstId; levelId <= lastId; levelId++) {
      const localId    = levelId - worldBase;
      const { x, y }  = nodePos(localId);
      const stars      = progress.getStars(levelId);
      const isUnlocked = levelId <= unlocked;
      const isWeekly   = this._weeklyLevels.includes(levelId);
      const isNew      = (levelId === newlyUnlocked && stars === 0);

      const node = this._buildNode(levelId, x, y, stars, isUnlocked, isWeekly, () => {
        if (isUnlocked) { audio?.play('button_tap'); onSelectLevel(levelId); }
      });

      // Queue reveal animation only for the brand-new next level.
      if (isNew && isUnlocked) {
        node.scale.set(0);
        node.alpha = 0;
        this._revealAnims.push({ node, t: 0, duration: 0.45 });
      }
    }

    // ── Pulsing glow ring on next-to-play node ─────────────────────────────
    if (nextToPlay !== null) {
      const localId = nextToPlay - worldBase;
      const { x, y } = nodePos(localId);
      const glow = new Graphics();
      glow.circle(x, y, NODE_R + 10);
      glow.stroke({ color: 0xffcc00, width: 3, alpha: 1 });
      this._container.addChild(glow);
      this._glowNode = glow;
    }

    // ── Header ─────────────────────────────────────────────────────────────
    this._buildHeader(w, progress, onBack, onShop, onAchievements, audio);
  }

  _drawBackground(w, h) {
    const g = new Graphics();

    // Sky gradient: deep navy at top → dark blue-grey at horizon.
    const SKY_H = HEADER_H + 72;
    for (let i = 0; i < 16; i++) {
      const t     = i / 15;
      const r     = Math.round(4  + t * 10);
      const gr    = Math.round(6  + t * 14);
      const b     = Math.round(18 + t * 28);
      const color = (r << 16) | (gr << 8) | b;
      g.rect(0, HEADER_H + i * (SKY_H / 16), w, SKY_H / 16 + 1);
      g.fill(color);
    }

    // Lower map area: asphalt grey with subtle grid.
    g.rect(0, HEADER_H + SKY_H, w, h - HEADER_H - SKY_H);
    g.fill(0x0d1020);

    this._container.addChild(g);

    // ── City skyline silhouette ──────────────────────────────────────────────
    this._drawSkyline(w, h);

    // ── Stars in sky ────────────────────────────────────────────────────────
    this._drawStars(w);

    // ── Subtle road grid on the lower map ────────────────────────────────────
    const grid = new Graphics();
    const gridTop = HEADER_H + SKY_H;
    for (let gx = 0; gx < w; gx += 52) {
      grid.moveTo(gx, gridTop); grid.lineTo(gx, h);
      grid.stroke({ color: 0x1a2040, width: 1, alpha: 0.35 });
    }
    for (let gy = gridTop; gy < h; gy += 52) {
      grid.moveTo(0, gy); grid.lineTo(w, gy);
      grid.stroke({ color: 0x1a2040, width: 1, alpha: 0.35 });
    }
    this._container.addChild(grid);
  }

  _drawStars(w) {
    const stars = new Graphics();
    // Deterministic star positions (no random).
    const pos = [
      [22, 80], [68, 95], [110, 74], [155, 88], [200, 72], [240, 92],
      [290, 78], [340, 85], [375, 76], [45, 105], [188, 110], [320, 102],
    ];
    for (const [sx, sy] of pos) {
      const r = (sx * 7 + sy * 3) % 3 === 0 ? 1.5 : 1.0;
      stars.circle(sx, sy, r);
      stars.fill({ color: 0xffffff, alpha: 0.55 + ((sx + sy) % 3) * 0.15 });
    }
    this._container.addChild(stars);
  }

  _drawSkyline(w, h) {
    const sky = new Graphics();
    const baseY = HEADER_H + 100;
    // Buildings: [x, width, height, hasWindow]
    const buildings = [
      [0, 28, 62, true],  [28, 18, 44, false], [46, 32, 78, true],
      [78, 22, 52, false], [100, 14, 36, false], [114, 40, 68, true],
      [154, 20, 48, false], [174, 30, 84, true], [204, 16, 42, false],
      [220, 36, 58, true], [256, 24, 70, false], [280, 18, 46, true],
      [298, 40, 88, true], [338, 22, 50, false], [360, 30, 64, true],
    ];
    for (const [bx, bw, bh, hasWin] of buildings) {
      sky.rect(bx, baseY - bh, bw, bh);
      sky.fill({ color: 0x080c18, alpha: 0.85 });
      if (hasWin) {
        // Window grid: bright yellow/white dots.
        for (let wy = baseY - bh + 6; wy < baseY - 6; wy += 10) {
          for (let wx = bx + 4; wx < bx + bw - 4; wx += 8) {
            if ((wx + wy) % 3 !== 0) continue;
            sky.rect(wx, wy, 3, 4);
            sky.fill({ color: 0xffee88, alpha: 0.45 + ((wx * wy) % 3) * 0.15 });
          }
        }
      }
    }
    this._container.addChild(sky);
  }

  _drawRoadPath(unlockedLevel) {
    const worldBase = (this._worldPage - 1) * 20;

    for (let localId = 1; localId < 20; localId++) {
      const levelId = worldBase + localId;
      const { x: ax, y: ay } = nodePos(localId);
      const { x: bx, y: by } = nodePos(localId + 1);
      const reached = levelId < unlockedLevel;

      // Road surface (wide grey strip).
      const road = new Graphics();
      road.moveTo(ax, ay);
      road.lineTo(bx, by);
      road.stroke({ color: reached ? 0x3a5a2a : 0x1e2838, width: 12, cap: 'round' });
      this._container.addChild(road);

      // Dashed centre line.
      if (reached) {
        const dashCount = 5;
        const dash = new Graphics();
        for (let d = 0; d < dashCount; d++) {
          const t0 = (d + 0.15) / dashCount;
          const t1 = (d + 0.55) / dashCount;
          dash.moveTo(ax + (bx - ax) * t0, ay + (by - ay) * t0);
          dash.lineTo(ax + (bx - ax) * t1, ay + (by - ay) * t1);
          dash.stroke({ color: 0x88ff66, width: 1.5, alpha: 0.55, cap: 'round' });
        }
        this._container.addChild(dash);
      }
    }
  }

  _drawCars() {
    // Small decorative cars between specific nodes (static positions).
    const carPositions = [
      { localId: 2, t: 0.50 }, { localId: 5, t: 0.35 }, { localId: 8, t: 0.60 },
      { localId: 11, t: 0.45 }, { localId: 14, t: 0.55 }, { localId: 17, t: 0.40 },
    ];
    for (let ci = 0; ci < carPositions.length; ci++) {
      const { localId, t } = carPositions[ci];
      const { x: ax, y: ay } = nodePos(localId);
      const { x: bx, y: by } = nodePos(localId + 1);
      const cx = ax + (bx - ax) * t;
      const cy = ay + (by - ay) * t;
      const angle = Math.atan2(by - ay, bx - ax);
      const color = CAR_COLORS[ci % CAR_COLORS.length];
      this._drawMiniCar(cx, cy, angle, color);
    }
  }

  _drawMiniCar(cx, cy, angle, color) {
    const g = new Graphics();
    // Simple top-down car: 18×9 rect with smaller 10×5 cabin on top.
    const cw = 18, ch = 9, rw = 10, rh = 5;
    g.rect(-cw / 2, -ch / 2, cw, ch);
    g.fill({ color, alpha: 0.90 });
    g.rect(-rw / 2, -rh / 2, rw, rh);
    g.fill({ color: 0x111122, alpha: 0.75 });
    // Headlights.
    g.circle(-cw / 2 + 2, -ch / 4, 1.5);
    g.circle(-cw / 2 + 2,  ch / 4, 1.5);
    g.fill({ color: 0xffffcc, alpha: 0.90 });
    g.x = cx; g.y = cy; g.rotation = angle;
    this._container.addChild(g);
  }

  _buildNode(levelId, x, y, stars, isUnlocked, isWeekly, onClick) {
    const node = new Container();
    node.x = x; node.y = y;
    this._container.addChild(node);

    // ── Drop shadow ──────────────────────────────────────────────────────────
    const shadow = new Graphics();
    shadow.circle(2, 4, NODE_R + 2);
    shadow.fill({ color: 0x000000, alpha: 0.35 });
    node.addChild(shadow);

    // ── Road-sign ring (outer) ────────────────────────────────────────────────
    const ringColor = isUnlocked
      ? (stars > 0 ? 0x55cc77 : 0x4488bb)
      : 0x2a3040;
    const ring = new Graphics();
    ring.circle(0, 0, NODE_R + 3);
    ring.fill({ color: ringColor, alpha: isUnlocked ? 0.90 : 0.35 });
    node.addChild(ring);

    // ── Inner disc (sign face) ────────────────────────────────────────────────
    const bgColor = isUnlocked
      ? (stars > 0 ? 0x1a3a22 : 0x0e1e2e)
      : 0x0c0f18;
    const disc = new Graphics();
    disc.circle(0, 0, NODE_R);
    disc.fill(bgColor);
    node.addChild(disc);

    if (isUnlocked) {
      // Level number.
      const num = new Text({ text: String(levelId), style: {
        fontSize: stars > 0 ? 13 : 15, fontWeight: 'bold', fill: 0xffffff,
      }});
      num.anchor.set(0.5, 0.5);
      num.y = stars > 0 ? -7 : 0;
      node.addChild(num);

      // Star row.
      if (stars > 0) this._drawMiniStars(node, stars);

      // Weekly badge.
      if (isWeekly) {
        const badge = new Text({ text: '⭐', style: { fontSize: 11 } });
        badge.anchor.set(0.5, 0.5);
        badge.x = NODE_R - 4; badge.y = -NODE_R + 4;
        node.addChild(badge);
      }

      // Speed stripe decoration (Candy Crush energy feel).
      const stripe = new Graphics();
      stripe.moveTo(-NODE_R + 4, NODE_R - 6);
      stripe.lineTo(-NODE_R + 14, NODE_R - 6);
      stripe.stroke({ color: 0x88ff66, width: 2, alpha: 0.40 });
      node.addChild(stripe);

      // Hit area.
      disc.eventMode = 'static'; disc.cursor = 'pointer';
      disc.on('pointerdown', onClick);
      disc.on('pointerover',  () => { ring.alpha = 0.70; });
      disc.on('pointerout',   () => { ring.alpha = 1.00; });
    } else {
      // Lock icon (padlock).
      const lock = new Graphics();
      // Shackle arc.
      lock.arc(0, -4, 5, Math.PI, 0, false);
      lock.stroke({ color: 0x445566, width: 2, alpha: 0.70 });
      // Body.
      lock.roundRect(-5, -2, 10, 8, 2);
      lock.fill({ color: 0x2a3a4a, alpha: 0.80 });
      // Keyhole.
      lock.circle(0, 2, 2);
      lock.fill({ color: 0x111828 });
      node.addChild(lock);
    }

    return node;
  }

  _drawMiniStars(parent, count) {
    const starColors = { 1: 0xffaa00, 2: 0xffcc00, 3: 0xffee00 };
    const color = starColors[count] ?? 0xffcc00;
    const size  = 5;
    const gap   = 11;
    const startX = -(count - 1) * gap / 2;
    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      // 5-point star.
      const pts = [];
      for (let p = 0; p < 10; p++) {
        const r  = p % 2 === 0 ? size : size * 0.42;
        const a  = (p / 10) * Math.PI * 2 - Math.PI / 2;
        pts.push(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.poly(pts); g.fill({ color, alpha: 0.95 });
      g.x = startX + i * gap; g.y = 10;
      parent.addChild(g);
    }
  }

  _buildHeader(w, progress, onBack, onShop, onAchievements, audio) {
    // Semi-dark header bar.
    const headerBg = new Graphics();
    headerBg.rect(0, 0, w, HEADER_H);
    headerBg.fill({ color: 0x060c18, alpha: 0.95 });
    headerBg.moveTo(0, HEADER_H); headerBg.lineTo(w, HEADER_H);
    headerBg.stroke({ color: 0x334466, width: 1, alpha: 0.60 });
    this._container.addChild(headerBg);

    // BACK button.
    const back = new Text({ text: '← BACK', style: { fontSize: 14, fontWeight: 'bold', fill: 0x66aaff } });
    back.anchor.set(0, 0.5); back.x = 14; back.y = 22;
    back.eventMode = 'static'; back.cursor = 'pointer';
    back.on('pointerdown', () => { audio?.play('button_tap'); onBack(); });
    this._container.addChild(back);

    // World title with road-sign aesthetic.
    const title = new Text({ text: `WORLD ${this._worldPage}`, style: {
      fontSize: 20, fontWeight: 'bold', fill: 0xffffff,
      dropShadow: { color: 0x00cc44, blur: 8, distance: 0, alpha: 0.6 },
    }});
    title.anchor.set(0.5, 0.5); title.x = w / 2; title.y = 22;
    this._container.addChild(title);

    // SHOP button.
    const shop = new Text({ text: 'SHOP', style: { fontSize: 14, fontWeight: 'bold', fill: 0xf5c842 } });
    shop.anchor.set(1, 0.5); shop.x = w - 14; shop.y = 22;
    shop.eventMode = 'static'; shop.cursor = 'pointer';
    shop.on('pointerdown', () => { audio?.play('button_tap'); onShop?.(); });
    this._container.addChild(shop);

    // Row 2: coins | achievements.
    const coins = new Text({ text: `🏅 ${progress.coins ?? 0}`, style: {
      fontSize: 14, fontWeight: 'bold', fill: 0xf5c842,
    }});
    coins.anchor.set(0, 0.5); coins.x = 14; coins.y = 50;
    this._container.addChild(coins);

    if (onAchievements) {
      const ach = new Text({ text: '★ ACHIEVEMENTS', style: { fontSize: 12, fontWeight: 'bold', fill: 0x99bbcc } });
      ach.anchor.set(1, 0.5); ach.x = w - 14; ach.y = 50;
      ach.eventMode = 'static'; ach.cursor = 'pointer';
      ach.on('pointerdown', () => { audio?.play('button_tap'); onAchievements(); });
      this._container.addChild(ach);
    }

    // World page arrows.
    const canW2 = (progress.unlockedLevel ?? 1) > 20;
    if (this._worldPage === 1 && canW2) {
      const w2 = new Text({ text: 'W2 ▶', style: { fontSize: 12, fontWeight: 'bold', fill: 0x66aaff } });
      w2.anchor.set(1, 0.5); w2.x = w / 2 + 70; w2.y = 22;
      w2.eventMode = 'static'; w2.cursor = 'pointer';
      w2.on('pointerdown', () => { audio?.play('button_tap'); this._switchWorld(2); });
      this._container.addChild(w2);
    }
    if (this._worldPage === 2) {
      const w1 = new Text({ text: '◀ W1', style: { fontSize: 12, fontWeight: 'bold', fill: 0x66aaff } });
      w1.anchor.set(0, 0.5); w1.x = w / 2 - 70; w1.y = 22;
      w1.eventMode = 'static'; w1.cursor = 'pointer';
      w1.on('pointerdown', () => { audio?.play('button_tap'); this._switchWorld(1); });
      this._container.addChild(w1);
    }
  }

  _switchWorld(page) {
    this._worldPage = page;
    this._container.removeChildren();
    this._glowNode    = null;
    this._glowTime    = 0;
    this._revealAnims = [];
    const { onSelectLevel, onBack, onShop, onAchievements, audio } = this._callbacks;
    this._build(this._appW, this._appH, this._progress,
      onSelectLevel, onBack, onShop, onAchievements, audio);
  }
}
