// LevelSelectScreen — World Map layout.
//
// 20 levels arranged in a snake path from L1 (bottom-left) to L20 (top-right).
// 5 rows × 4 columns.  Even data-rows go left→right; odd rows go right→left.
//
// Header: ← BACK | WORLD 1 | SHOP
//         ◆ coins | ★ ACHIEVEMENTS
//
// Features:
//   • Path lines (green for reached, dark for locked)
//   • Level nodes (circles) with stars and lock icons
//   • Pulsing green ring on the next-to-play node
//   • Decorative landmarks (trees/buildings) at screen edges
//   • "WORLD 2 COMING SOON" banner above top row
import { Container, Graphics, Text } from 'pixi.js';

// ── Layout constants ────────────────────────────────────────────────────────
const HEADER_H   = 68;
const NODE_R     = 22;
const GLOW_PERIOD = 1.2;   // seconds per pulse cycle

// Four column centres, spread across the 390px canvas.
const COLS_X = [45, 145, 245, 345];

// Five row centres, from top (row 0) to bottom (row 4).
// visualRow 0 → L17-20; visualRow 4 → L1-4
const ROWS_Y = [128, 296, 464, 632, 800];

// ── Helpers ─────────────────────────────────────────────────────────────────

// Returns the screen {x, y} centre for a given level id (1-20).
function nodePos(levelId) {
  const i        = levelId - 1;
  const dataRow  = Math.floor(i / 4);   // 0 = L1-4 … 4 = L17-20
  const posInRow = i % 4;
  const visualRow = 4 - dataRow;        // flip so L1 ends up at bottom
  const isRTL    = dataRow % 2 === 1;   // odd data-rows go right→left in the visual
  const col      = isRTL ? (3 - posInRow) : posInRow;
  return { x: COLS_X[col], y: ROWS_Y[visualRow] };
}

// ── Main class ───────────────────────────────────────────────────────────────

export class LevelSelectScreen {
  // progress      — ProgressManager instance (read-only here)
  // livesManager  — LivesManager (optional; shows hearts in header)
  // callbacks     — { onSelectLevel(levelId), onBack, onShop, onAchievements, audio,
  //                   weeklyLevels: number[] }
  constructor(stage, appW, appH, progress, { onSelectLevel, onBack, onShop, onAchievements, audio, weeklyLevels = [] }, livesManager = null) {
    this._container = new Container();
    stage.addChild(this._container);
    this._glowNode    = null;
    this._glowTime    = 0;
    this._lives       = livesManager;
    this._worldPage   = 1;
    this._progress    = progress;
    this._appW        = appW;
    this._appH        = appH;
    this._weeklyLevels = weeklyLevels;
    this._callbacks   = { onSelectLevel, onBack, onShop, onAchievements, audio, weeklyLevels };
    this._build(appW, appH, progress, onSelectLevel, onBack, onShop, onAchievements, audio);
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  // Called each render frame by GameApp while this screen is active.
  update(dt) {
    if (!this._glowNode) return;
    this._glowTime += dt;
    const t = (this._glowTime % GLOW_PERIOD) / GLOW_PERIOD;
    this._glowNode.alpha = 0.28 + 0.52 * Math.abs(Math.sin(t * Math.PI));
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build(w, h, progress, onSelectLevel, onBack, onShop, onAchievements, audio) {
    // Background — absorbs all pointer events.
    const bg = new Graphics();
    bg.rect(0, 0, w, h);
    bg.fill(0x060610);
    bg.eventMode = 'static';
    this._container.addChild(bg);

    // ── Header row 1 (y=22): BACK | WORLD 1 | SHOP ────────────────────────
    const NAV_Y = 22;

    const backBtn = new Text({ text: '← BACK', style: { fontSize: 15, fontWeight: 'bold', fill: 0x44aaff } });
    backBtn.anchor.set(0, 0.5); backBtn.x = 14; backBtn.y = NAV_Y;
    backBtn.eventMode = 'static'; backBtn.cursor = 'pointer';
    backBtn.on('pointerdown', () => { audio?.play('button_tap'); onBack(); });
    this._container.addChild(backBtn);

    const hdr = new Text({ text: `WORLD ${this._worldPage}`, style: { fontSize: 22, fontWeight: 'bold', fill: 0xffffff } });
    hdr.anchor.set(0.5, 0.5); hdr.x = w / 2; hdr.y = NAV_Y;
    this._container.addChild(hdr);

    // World page arrows — ◄ left (if W2) / right (if W1 completed) ►
    const canGoW2 = (progress.unlockedLevel ?? 1) > 20;
    if (this._worldPage === 1 && canGoW2) {
      const w2Btn = new Text({ text: 'W2 ▶', style: { fontSize: 13, fontWeight: 'bold', fill: 0x66aaff } });
      w2Btn.anchor.set(1, 0.5); w2Btn.x = w / 2 + 70; w2Btn.y = NAV_Y;
      w2Btn.eventMode = 'static'; w2Btn.cursor = 'pointer';
      w2Btn.on('pointerdown', () => { audio?.play('button_tap'); this._switchWorld(2); });
      this._container.addChild(w2Btn);
    }
    if (this._worldPage === 2) {
      const w1Btn = new Text({ text: '◀ W1', style: { fontSize: 13, fontWeight: 'bold', fill: 0x66aaff } });
      w1Btn.anchor.set(0, 0.5); w1Btn.x = w / 2 - 70; w1Btn.y = NAV_Y;
      w1Btn.eventMode = 'static'; w1Btn.cursor = 'pointer';
      w1Btn.on('pointerdown', () => { audio?.play('button_tap'); this._switchWorld(1); });
      this._container.addChild(w1Btn);
    }

    const shopBtn = new Text({ text: 'SHOP', style: { fontSize: 15, fontWeight: 'bold', fill: 0xf5c842 } });
    shopBtn.anchor.set(1, 0.5); shopBtn.x = w - 14; shopBtn.y = NAV_Y;
    shopBtn.eventMode = 'static'; shopBtn.cursor = 'pointer';
    shopBtn.on('pointerdown', () => { audio?.play('button_tap'); onShop?.(); });
    shopBtn.on('pointerover',  () => { shopBtn.alpha = 0.70; });
    shopBtn.on('pointerout',   () => { shopBtn.alpha = 1.00; });
    this._container.addChild(shopBtn);

    // ── Header row 2 (y=50): coins | hearts | ACHIEVEMENTS ────────────────
    const COINS_Y = 50;

    const coinsTxt = new Text({ text: `◆ ${progress.coins}`, style: { fontSize: 16, fontWeight: 'bold', fill: 0xf5c842 } });
    coinsTxt.anchor.set(0, 0.5); coinsTxt.x = 14; coinsTxt.y = COINS_Y;
    this._container.addChild(coinsTxt);

    // Hearts row — centred in header
    if (this._lives) {
      const MAX = 5, h = this._lives.hearts;
      for (let i = 0; i < MAX; i++) {
        const ht = new Text({ text: i < h ? '♥' : '♡', style: { fontSize: 14, fill: i < h ? 0xff4466 : 0x444455 } });
        ht.anchor.set(0.5, 0.5);
        ht.x = w / 2 - (MAX - 1) * 10 / 2 + i * 10;
        ht.y = COINS_Y;
        this._container.addChild(ht);
      }
      // Time until next heart (if not full)
      if (!this._lives.isFull()) {
        const timer = new Text({ text: `+1 in ${this._lives.formatTimeUntilNext()}`, style: { fontSize: 10, fill: 0x7799aa, fontWeight: 'normal' } });
        timer.anchor.set(0.5, 0.5); timer.x = w / 2; timer.y = COINS_Y + 12;
        this._container.addChild(timer);
      }
    }

    if (onAchievements) {
      const achBtn = new Text({ text: '★ ACHIEVEMENTS', style: { fontSize: 13, fontWeight: 'bold', fill: 0xaabbcc } });
      achBtn.anchor.set(1, 0.5); achBtn.x = w - 14; achBtn.y = COINS_Y;
      achBtn.eventMode = 'static'; achBtn.cursor = 'pointer';
      achBtn.on('pointerdown', () => { audio?.play('button_tap'); onAchievements(); });
      achBtn.on('pointerover',  () => { achBtn.alpha = 0.70; });
      achBtn.on('pointerout',   () => { achBtn.alpha = 1.00; });
      this._container.addChild(achBtn);
    }

    // Separator under header
    const sep = new Graphics();
    sep.rect(0, HEADER_H - 2, w, 1);
    sep.fill({ color: 0x224466, alpha: 0.5 });
    this._container.addChild(sep);

    // ── World subtitle banner ──────────────────────────────────────────────
    const worldSub = this._worldPage === 1 ? '20 levels · 3 colors' : '20 levels · 6 colors · Expert';
    const csBanner = new Text({ text: worldSub, style: { fontSize: 12, fill: 0x2a4a3a } });
    csBanner.anchor.set(0.5, 0.5); csBanner.x = w / 2; csBanner.y = 81;
    this._container.addChild(csBanner);

    const csLine = new Graphics();
    csLine.rect(18, 94, w - 36, 1);
    csLine.fill({ color: 0x1a2a3a, alpha: 0.6 });
    this._container.addChild(csLine);

    // ── Decorative landmarks ───────────────────────────────────────────────
    this._drawLandmarks(w);

    // ── Path lines (draw before nodes so nodes appear on top) ────────────
    const unlocked = progress.unlockedLevel;
    this._drawPath(unlocked);

    // ── Level nodes ────────────────────────────────────────────────────────
    const worldBase  = (this._worldPage - 1) * 20;   // 0 for W1, 20 for W2
    const firstId    = worldBase + 1;
    const lastId     = worldBase + 20;
    const nextToPlay = (unlocked >= firstId && unlocked <= lastId && progress.getStars(unlocked) === 0)
      ? unlocked : null;

    for (let levelId = firstId; levelId <= lastId; levelId++) {
      const localId    = levelId - worldBase;     // 1-20 within this world
      const { x, y }  = nodePos(localId);
      const stars      = progress.getStars(levelId);
      const isUnlocked = levelId <= unlocked;
      const isWeekly   = this._weeklyLevels.includes(levelId);
      this._buildNode(levelId, x, y, stars, isUnlocked, isWeekly, () => {
        if (isUnlocked) { audio?.play('button_tap'); onSelectLevel(levelId); }
      });
    }

    // ── Pulsing glow ring for the next-to-play node ────────────────────────
    if (nextToPlay !== null) {
      const localId = nextToPlay - worldBase;
      const { x, y } = nodePos(localId);
      const glow = new Graphics();
      glow.circle(x, y, NODE_R + 9);
      glow.stroke({ color: 0x44ff88, width: 4, alpha: 1 });
      glow.alpha   = 0.28;
      this._glowNode = glow;
      this._container.addChild(glow);
    }
  }

  // Rebuild the screen for a different world page.
  _switchWorld(worldNum) {
    this._worldPage = worldNum;
    this._glowNode  = null;
    this._glowTime  = 0;
    this._container.removeChildren().forEach(c => c.destroy({ children: true }));
    const { onSelectLevel, onBack, onShop, onAchievements, audio } = this._callbacks;
    this._build(this._appW, this._appH, this._progress, onSelectLevel, onBack, onShop, onAchievements, audio);
  }

  // Draw connecting lines between reached level nodes only.
  // Uses poly() with ABSOLUTE world coordinates — no position/rotation transforms
  // on the Graphics object, which avoids all PixiJS v8 moveTo phantom-line bugs.
  _drawPath(unlockedLevel) {
    const worldBase = (this._worldPage - 1) * 20;
    for (let localId = 1; localId < 20; localId++) {
      const levelId = worldBase + localId;
      if (levelId >= unlockedLevel) continue;   // only draw reached segments

      const { x: ax, y: ay } = nodePos(localId);
      const { x: bx, y: by } = nodePos(localId + 1);
      const dx = bx - ax, dy = by - ay;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;

      // Perpendicular unit vector × half-width (4px line)
      const hw = 2;
      const nx = (-dy / len) * hw;
      const ny = ( dx / len) * hw;

      // Four corners of the line segment as a filled polygon.
      const g = new Graphics();
      g.poly([ ax + nx, ay + ny,  ax - nx, ay - ny,
               bx - nx, by - ny,  bx + nx, by + ny ]);
      g.fill({ color: 0x2a7a4a, alpha: 0.85 });
      this._container.addChild(g);
    }
  }

  _buildNode(levelId, x, y, stars, isUnlocked, isWeekly, onClick) {
    // Drop shadow
    const shadow = new Graphics();
    shadow.circle(x, y + 3, NODE_R + 1);
    shadow.fill({ color: 0x000000, alpha: 0.30 });
    this._container.addChild(shadow);

    // Main circle
    const bgColor     = isUnlocked ? (stars > 0 ? 0x152818 : 0x0e1922) : 0x0d0d18;
    const borderColor = isUnlocked ? (stars > 0 ? 0x44bb66 : 0x2a4a6a) : 0x1a2030;
    const borderAlpha = isUnlocked ? 0.85 : 0.30;

    const g = new Graphics();
    g.circle(x, y, NODE_R);
    g.fill(bgColor);
    g.circle(x, y, NODE_R);
    g.stroke({ color: borderColor, width: 2, alpha: borderAlpha });
    this._container.addChild(g);

    if (isUnlocked) {
      // Level number
      const numTxt = new Text({ text: String(levelId), style: { fontSize: 14, fontWeight: 'bold', fill: 0xffffff } });
      numTxt.anchor.set(0.5, 0.5); numTxt.x = x; numTxt.y = y - 5;
      this._container.addChild(numTxt);

      // Mini star row
      this._drawMiniStars(x, y + 11, stars);

      // Weekly featured badge — gold ⭐ at top-right of node
      if (isWeekly) {
        const badge = new Text({
          text: '⭐',
          style: { fontSize: 13 },
        });
        badge.anchor.set(0.5, 0.5);
        badge.x = x + NODE_R - 2;
        badge.y = y - NODE_R + 4;
        this._container.addChild(badge);
      }

      // Hit area + pointer events
      g.eventMode = 'static'; g.cursor = 'pointer';
      g.on('pointerdown', onClick);
      g.on('pointerover',  () => { g.alpha = 0.80; });
      g.on('pointerout',   () => { g.alpha = 1.00; });
    } else {
      // Lock icon
      const lockG = new Graphics();
      lockG.roundRect(x - 7, y - 3, 14, 11, 2);
      lockG.fill(0x252f3a);
      lockG.arc(x, y - 3, 5, Math.PI, 0, false);
      lockG.stroke({ color: 0x252f3a, width: 2.5 });
      this._container.addChild(lockG);
    }
  }

  // Three tiny star dots centred at (cx, cy).
  _drawMiniStars(cx, cy, filledCount) {
    const R = 4, GAP = 3;
    const totalW = 3 * R * 2 + 2 * GAP;
    const x0     = cx - totalW / 2 + R;
    for (let i = 0; i < 3; i++) {
      const g = new Graphics();
      this._starShape(g, R, i < filledCount ? 0xffcc00 : 0x252f3a);
      g.x = x0 + i * (R * 2 + GAP);
      g.y = cy;
      this._container.addChild(g);
    }
  }

  _starShape(g, outerR, color) {
    const pts = 5, innerR = outerR * 0.42;
    const pts2d = [];
    for (let i = 0; i < pts * 2; i++) {
      const angle = (Math.PI * i) / pts - Math.PI / 2;
      const r     = (i % 2 === 0) ? outerR : innerR;
      pts2d.push(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    g.poly(pts2d); g.fill(color);
  }

  // Programmatic landmarks placed at left/right edges between rows.
  // Use deterministic patterns (no Math.random) so they don't flicker on rebuild.
  _drawLandmarks(w) {
    // Between row 4 (y=800) and row 3 (y=632): midpoint ≈ 716
    this._drawTree(14,     716);
    this._drawTree(26,     704);
    this._drawBuilding(w - 18, 724, 20, 48, false);

    // Between row 3 (y=632) and row 2 (y=464): midpoint ≈ 548
    this._drawBuilding(10,     558, 26, 44, true);
    this._drawTree(w - 14, 548);
    this._drawTree(w - 28, 558);

    // Between row 2 (y=464) and row 1 (y=296): midpoint ≈ 380
    this._drawTree(14,     380);
    this._drawBuilding(w - 20, 392, 22, 52, false);

    // Between row 1 (y=296) and row 0 (y=128): midpoint ≈ 212
    this._drawBuilding(10,     220, 24, 46, true);
    this._drawTree(w - 14, 212);
  }

  _drawTree(cx, cy) {
    const g = new Graphics();
    // Trunk
    g.rect(cx - 3, cy, 6, 14);
    g.fill(0x3a2a10);
    // Lower canopy
    g.poly([cx, cy - 20, cx - 11, cy + 4, cx + 11, cy + 4]);
    g.fill(0x163a16);
    // Upper canopy
    g.poly([cx, cy - 30, cx - 8, cy - 14, cx + 8, cy - 14]);
    g.fill(0x1e5020);
    this._container.addChild(g);
  }

  // litAlt: alternating window-lit pattern (true = (r+c)%2===0 is lit, false = (r+c)%2===1)
  _drawBuilding(cx, cy, bldW, bldH, litAlt) {
    const g = new Graphics();
    // Body
    g.rect(cx - bldW / 2, cy - bldH, bldW, bldH);
    g.fill(0x111a26);
    g.rect(cx - bldW / 2, cy - bldH, bldW, bldH);
    g.stroke({ color: 0x1e2e42, width: 1, alpha: 0.7 });
    // Windows (deterministic pattern)
    const wCols = Math.max(1, Math.floor(bldW / 10));
    const wRows = Math.max(1, Math.floor(bldH / 13));
    for (let r = 0; r < wRows; r++) {
      for (let c = 0; c < wCols; c++) {
        const lit = litAlt ? ((r + c) % 2 === 0) : ((r + c) % 2 === 1);
        g.rect(cx - bldW / 2 + 3 + c * 10, cy - bldH + 4 + r * 13, 5, 7);
        g.fill(lit ? 0x2a4a5a : 0x0a1420);
      }
    }
    this._container.addChild(g);
  }
}
