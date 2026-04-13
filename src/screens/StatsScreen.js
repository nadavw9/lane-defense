// StatsScreen — displays player statistics and lifetime achievements.
//
// Shows:
//   • Total Stars
//   • Total Coins
//   • Favorite Booster
//   • Cars Destroyed
//   • Longest Combo
//   • Shot Accuracy

import { Container, Graphics, Text } from 'pixi.js';

export class StatsScreen {
  // options: { app, progressManager, onBack }
  constructor(stage, appW, appH, { app, progressManager, onBack, audio }) {
    this._stage = stage;
    this._progressManager = progressManager;
    this._onBack = onBack;
    this._audio = audio;
    this._container = new Container();
    this._build(appW, appH);
  }

  show() {
    if (!this._container.parent) {
      this._stage.addChild(this._container);
    }
  }

  hide() {
    if (this._container.parent) {
      this._stage.removeChild(this._container);
    }
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build(w, h) {
    // Full-screen dark background
    const bg = new Graphics();
    bg.rect(0, 0, w, h);
    bg.fill(0x0d0d1a);
    bg.eventMode = 'static';
    this._container.addChild(bg);

    // Title
    const title = new Text({
      text: 'YOUR STATS',
      style: {
        fontSize: 32,
        fontWeight: 'bold',
        fill: 0xffffff,
      },
    });
    title.anchor.set(0.5, 0);
    title.x = w / 2;
    title.y = 60;
    this._container.addChild(title);

    // Stat rows
    const stats = [
      { label: 'Total Stars', value: this._progressManager.getTotalStars() + ' ⭐' },
      { label: 'Total Coins', value: this._progressManager.coins + ' 🪙' },
      { label: 'Favorite Booster', value: this._progressManager.getFavoriteBooster() },
      { label: 'Cars Destroyed', value: this._progressManager.totalCarsDestroyed },
      { label: 'Longest Combo', value: this._progressManager.longestCombo + 'x' },
      { label: 'Shot Accuracy', value: this._progressManager.getAccuracy() + '%' },
    ];

    let y = 140;
    const ROW_HEIGHT = 72;

    stats.forEach((stat) => {
      this._drawStatRow(w / 2, y, stat.label, stat.value);
      y += ROW_HEIGHT;
    });

    // Back button
    this._drawBackButton(w / 2, h - 84);
  }

  _drawStatRow(cx, y, label, value) {
    // Label (left side)
    const labelText = new Text({
      text: label,
      style: {
        fontSize: 18,
        fontWeight: 'normal',
        fill: 0x99aacc,
      },
    });
    labelText.anchor.set(0.5, 0.5);
    labelText.x = cx - 80;
    labelText.y = y;
    this._container.addChild(labelText);

    // Value (right side)
    const valueText = new Text({
      text: String(value),
      style: {
        fontSize: 22,
        fontWeight: 'bold',
        fill: 0xffffff,
      },
    });
    valueText.anchor.set(0.5, 0.5);
    valueText.x = cx + 60;
    valueText.y = y;
    this._container.addChild(valueText);
  }

  _drawBackButton(cx, cy) {
    const btnW = 140, btnH = 48;
    const btn = new Graphics();
    btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
    btn.fill(0x1a2a3a);
    btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
    btn.stroke({ color: 0x88bbdd, width: 2, alpha: 0.70 });
    btn.x = cx;
    btn.y = cy;
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', () => {
      this._audio?.play('button_tap');
      this._onBack?.();
    });
    btn.on('pointerover', () => { btn.alpha = 0.78; });
    btn.on('pointerout', () => { btn.alpha = 1.00; });

    const btnText = new Text({
      text: 'BACK',
      style: {
        fontSize: 18,
        fontWeight: 'bold',
        fill: 0x88bbdd,
      },
    });
    btnText.anchor.set(0.5, 0.5);
    btn.addChild(btnText);
    this._container.addChild(btn);
  }
}
