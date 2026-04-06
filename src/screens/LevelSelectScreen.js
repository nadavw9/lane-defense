// LevelSelectScreen — shows all 20 levels in a 4×5 grid.
//
// Each card shows:
//   • Level number
//   • Best star count (0-3) if completed
//   • Lock icon if not yet unlocked
//
// Tapping an unlocked level fires onSelectLevel(levelId).
// The back arrow fires onBack (returns to title).
import { Container, Graphics, Text } from 'pixi.js';

// Grid layout
const COLS     = 4;
const SIDE_PAD = 10;
const GAP      = 8;
const CARD_W   = Math.floor((390 - 2 * SIDE_PAD - (COLS - 1) * GAP) / COLS); // 86
const CARD_H   = 96;
const HEADER_H = 72;

export class LevelSelectScreen {
  // progress    — ProgressManager instance (read-only here)
  // callbacks   — { onSelectLevel(levelId), onBack }
  constructor(stage, appW, appH, progress, { onSelectLevel, onBack }) {
    this._container = new Container();
    stage.addChild(this._container);
    this._build(appW, appH, progress, onSelectLevel, onBack);
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build(w, h, progress, onSelectLevel, onBack) {
    // Background — absorbs all pointer events.
    const bg = new Graphics();
    bg.rect(0, 0, w, h);
    bg.fill(0x060610);
    bg.eventMode = 'static';
    this._container.addChild(bg);

    // ── Header ─────────────────────────────────────────────────────────────
    const hdr = new Text({
      text: 'SELECT LEVEL',
      style: { fontSize: 24, fontWeight: 'bold', fill: 0xffffff },
    });
    hdr.anchor.set(0.5, 0.5);
    hdr.x = w / 2;
    hdr.y = 34;
    this._container.addChild(hdr);

    // Coins balance (top-right)
    const coinsTxt = new Text({
      text: `◆ ${progress.coins}`,
      style: { fontSize: 17, fontWeight: 'bold', fill: 0xf5c842 },
    });
    coinsTxt.anchor.set(1, 0.5);
    coinsTxt.x = w - 14;
    coinsTxt.y = 34;
    this._container.addChild(coinsTxt);

    // Back arrow (top-left)
    const backBtn = new Text({
      text: '← BACK',
      style: { fontSize: 15, fontWeight: 'bold', fill: 0x44aaff },
    });
    backBtn.anchor.set(0, 0.5);
    backBtn.x = 14;
    backBtn.y = 34;
    backBtn.eventMode = 'static';
    backBtn.cursor    = 'pointer';
    backBtn.on('pointerdown', onBack);
    this._container.addChild(backBtn);

    // Thin separator line
    const sep = new Graphics();
    sep.rect(0, HEADER_H - 1, w, 1);
    sep.fill({ color: 0x224466, alpha: 0.5 });
    this._container.addChild(sep);

    // ── Level grid ──────────────────────────────────────────────────────────
    const unlocked = progress.unlockedLevel;
    for (let i = 0; i < 20; i++) {
      const levelId   = i + 1;
      const col       = i % COLS;
      const row       = Math.floor(i / COLS);
      const x         = SIDE_PAD + col * (CARD_W + GAP);
      const y         = HEADER_H + row * (CARD_H + GAP);
      const stars     = progress.getStars(levelId);
      const isUnlocked = levelId <= unlocked;

      this._buildCard(levelId, x, y, stars, isUnlocked, () => {
        if (isUnlocked) onSelectLevel(levelId);
      });
    }
  }

  _buildCard(levelId, x, y, stars, isUnlocked, onClick) {
    const c = new Container();
    c.x = x;
    c.y = y;

    // Card background
    const bgColor = isUnlocked
      ? (stars > 0 ? 0x0b1a30 : 0x101820)
      : 0x0a0a0a;
    const borderColor = isUnlocked
      ? (stars > 0 ? 0x3388cc : 0x223344)
      : 0x1a1a1a;
    const borderAlpha = isUnlocked ? 0.65 : 0.25;

    const g = new Graphics();
    g.roundRect(0, 0, CARD_W, CARD_H, 10);
    g.fill(bgColor);
    g.roundRect(0, 0, CARD_W, CARD_H, 10);
    g.stroke({ color: borderColor, width: 1.5, alpha: borderAlpha });
    c.addChild(g);

    // Level number
    const numColor = isUnlocked ? 0xffffff : 0x3a4a55;
    const numSize  = isUnlocked ? 30 : 24;
    const numText  = new Text({
      text: String(levelId),
      style: { fontSize: numSize, fontWeight: 'bold', fill: numColor },
    });
    numText.anchor.set(0.5, 0.5);
    numText.x = CARD_W / 2;
    numText.y = isUnlocked ? 34 : CARD_H / 2;
    c.addChild(numText);

    if (isUnlocked) {
      // Stars row at the bottom of the card
      this._drawStars(c, stars, CARD_W / 2, 68);

      // Click handling
      g.eventMode = 'static';
      g.cursor    = 'pointer';
      g.on('pointerdown', onClick);
      g.on('pointerover',  () => { c.alpha = 0.78; });
      g.on('pointerout',   () => { c.alpha = 1.00; });
    } else {
      // Lock icon
      this._drawLock(c, CARD_W / 2, 66);
    }

    this._container.addChild(c);
  }

  // Three small stars at (cx, cy).
  _drawStars(parent, filledCount, cx, cy) {
    const R = 8, GAP = 5;
    const totalW = 3 * R * 2 + 2 * GAP;
    const x0     = cx - totalW / 2 + R;
    for (let i = 0; i < 3; i++) {
      const g = new Graphics();
      this._starShape(g, R, i < filledCount ? 0xffcc00 : 0x222833);
      g.x = x0 + i * (R * 2 + GAP);
      g.y = cy;
      parent.addChild(g);
    }
  }

  _starShape(g, outerR, color) {
    const pts    = 5;
    const innerR = outerR * 0.42;
    const points = [];
    for (let i = 0; i < pts * 2; i++) {
      const angle  = (Math.PI * i) / pts - Math.PI / 2;
      const radius = (i % 2 === 0) ? outerR : innerR;
      points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    g.poly(points);
    g.fill(color);
  }

  // Minimal lock glyph centered at (cx, cy).
  _drawLock(parent, cx, cy) {
    const g = new Graphics();
    // Body
    g.roundRect(-9, -3, 18, 14, 3);
    g.fill(0x2a3a45);
    // Shackle arc
    g.arc(cx, cy - 5, 6, Math.PI, 0, false);
    g.stroke({ color: 0x2a3a45, width: 3.5 });
    g.x = cx;
    g.y = cy;
    parent.addChild(g);
  }
}
