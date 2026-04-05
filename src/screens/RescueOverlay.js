// RescueOverlay — shown after a lane breach.
//
// Sequence:
//   1. Instant red flash (0.45 s) covering the whole screen — breach impact feel.
//   2. Dark rescue panel fades in with three options:
//        "Watch Ad  +10s"  — always available
//        "◆ 50 Coins +10s" — disabled (greyed) if player can't afford it
//        "RETRY"           — full level restart
//
// The caller is responsible for calling update(dt) every render frame until
// the overlay is no longer needed.
import { Container, Graphics, Text } from 'pixi.js';

const FLASH_DURATION = 0.45;   // seconds for the red screen flash

export class RescueOverlay {
  // Callbacks:
  //   onRescueAd()    — "Watch Ad" accepted; caller should call gs.rescue() then destroy
  //   onRescueCoins() — "50 Coins" accepted; caller handles coin deduction + gs.rescue()
  //   onRetry()       — full restart; caller destroys overlay and calls gameLoop.restart()
  constructor(stage, appW, appH, gs, { onRescueAd, onRescueCoins, onRetry }) {
    this._container = new Container();
    stage.addChild(this._container);

    this._appW  = appW;
    this._appH  = appH;
    this._gs    = gs;

    this._flashLife  = FLASH_DURATION;
    this._panelBuilt = false;

    this._onRescueAd    = onRescueAd;
    this._onRescueCoins = onRescueCoins;
    this._onRetry       = onRetry;

    // The flash graphic is built immediately; the panel is built after the flash.
    this._flash = this._buildFlash();
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  // Call every render frame from the GameApp render ticker.
  update(dt) {
    if (this._panelBuilt) return;

    this._flashLife -= dt;
    this._flash.alpha = Math.max(0, (this._flashLife / FLASH_DURATION) * 0.75);

    if (this._flashLife <= 0) {
      this._panelBuilt = true;
      this._buildPanel();
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _buildFlash() {
    const g = new Graphics();
    g.rect(0, 0, this._appW, this._appH);
    g.fill(0xff2020);
    g.alpha = 0.75;
    this._container.addChild(g);
    return g;
  }

  _buildPanel() {
    const { _appW: w, _appH: h, _gs: gs } = this;
    const c = new Container();
    this._container.addChild(c);

    // Dim backdrop — also absorbs pointer events so game layers stay inert.
    const bg = new Graphics();
    bg.rect(0, 0, w, h);
    bg.fill({ color: 0x000000, alpha: 0.78 });
    bg.eventMode = 'static';
    c.addChild(bg);

    // Panel border
    const panelW = 310, panelH = 330;
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2 - 10;

    const panel = new Graphics();
    panel.roundRect(px, py, panelW, panelH, 18);
    panel.fill({ color: 0x1a0505, alpha: 0.97 });
    panel.roundRect(px, py, panelW, panelH, 18);
    panel.stroke({ color: 0xdd2222, width: 2, alpha: 0.6 });
    c.addChild(panel);

    const cx = w / 2;
    let y = py + 44;

    this._text(c, 'LANE BREACHED!', cx, y, { fontSize: 28, fill: 0xff4444 });
    y += 44;
    this._text(c, 'Continue playing?', cx, y, { fontSize: 16, fill: 0xbbbbbb, fontWeight: 'normal' });
    y += 50;

    // Watch Ad — always available
    this._button(c, '▶  Watch Ad  +10s', cx, y, 0x0d2a5a, 0x66aaff, () => this._onRescueAd());
    y += 62;

    // 50 Coins — greyed when unaffordable
    const canAfford = gs.coins >= 50;
    this._button(
      c,
      `◆ 50 Coins  +10s`,
      cx, y,
      canAfford ? 0x3a2800 : 0x252525,
      canAfford ? 0xf5c842 : 0x555555,
      canAfford ? () => this._onRescueCoins() : null,
    );
    y += 68;

    // Retry
    this._button(c, 'RETRY', cx, y, 0x2a0000, 0xff7777, () => this._onRetry());
  }

  _text(parent, str, x, y, style) {
    const t = new Text({ text: str, style: { fontWeight: 'bold', ...style } });
    t.anchor.set(0.5, 0.5);
    t.x = x;
    t.y = y;
    parent.addChild(t);
    return t;
  }

  _button(parent, label, cx, y, bgColor, labelColor, onClick) {
    const btnW = 236, btnH = 48;
    const btn  = new Graphics();
    btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
    btn.fill(bgColor);
    btn.x = cx;
    btn.y = y;
    if (onClick) {
      btn.eventMode = 'static';
      btn.cursor    = 'pointer';
      btn.on('pointerdown', onClick);
      btn.on('pointerover',  () => { btn.alpha = 0.78; });
      btn.on('pointerout',   () => { btn.alpha = 1.00; });
    }
    const t = new Text({ text: label, style: { fontSize: 19, fontWeight: 'bold', fill: labelColor } });
    t.anchor.set(0.5, 0.5);
    btn.addChild(t);
    parent.addChild(btn);
  }
}
