// PreLevelScreen — optional "Power Up?" offer shown between the level-select tap
// and the level start. The player can watch rewarded ads to begin the level with
// boosters, or skip and start with none (FIX 4D).
//
//   Watch 1 ad  → 1 COLOR CHANGE
//   Watch 2 ads → COLOR CHANGE + FREEZE
//   Watch 3 ads → all 3 (COLOR CHANGE + FREEZE + BOMB)
//   Skip        → start with 0 boosters
//
// The screen is decoupled from AdManager: it reports the player's choice via
// onSelect(adCount, bundle); the caller runs the ads, then starts the level with
// the bundle. One tap on SKIP (or the choice button) dismisses it.
import { Container, Graphics, Text } from 'pixi.js';

export class PreLevelScreen {
  // callbacks: { onSelect(adCount, bundle), audio }
  //   bundle = { colorChange, freeze, bombs }
  constructor(stage, appW, appH, levelLabel, { onSelect, audio }) {
    this._container = new Container();
    stage.addChild(this._container);
    this._onSelect = onSelect;
    this._audio    = audio;
    this._done     = false;
    this._build(appW, appH, levelLabel);
  }

  destroy() { this._container.destroy({ children: true }); }
  update()  { /* static screen — no animation loop needed */ }

  _choose(adCount, bundle) {
    if (this._done) return;
    this._done = true;
    this._audio?.play('button_tap');
    this._onSelect?.(adCount, bundle);
  }

  _build(w, h, levelLabel) {
    const bg = new Graphics();
    bg.rect(0, 0, w, h);
    bg.fill({ color: 0x0a0a18, alpha: 0.92 });
    bg.eventMode = 'static';
    this._container.addChild(bg);

    const panelW = 320, panelH = 420;
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2;
    const cx = w / 2;

    const panel = new Graphics();
    panel.roundRect(px, py, panelW, panelH, 20);
    panel.fill({ color: 0x141430, alpha: 0.98 });
    panel.roundRect(px, py, panelW, panelH, 20);
    panel.stroke({ color: 0xCC66FF, width: 2, alpha: 0.6 });
    this._container.addChild(panel);

    let y = py + 40;
    this._text('POWER UP?', cx, y, { fontSize: 30, fill: 0xffd54a });
    y += 34;
    this._text(levelLabel != null ? `Before ${levelLabel}` : 'Before you start', cx, y,
      { fontSize: 14, fill: 0xaab4cc, fontWeight: 'normal' });
    y += 40;

    // Three ad-for-boosters offers + a free skip.
    this._offer(px + 20, y, panelW - 40, '🎨  Watch 1 Ad', '1 Color Change', 0xCC66FF,
      () => this._choose(1, { colorChange: 1, freeze: 0, bombs: 0 }));
    y += 70;
    this._offer(px + 20, y, panelW - 40, '🎨❄  Watch 2 Ads', 'Color Change + Freeze', 0x44ccff,
      () => this._choose(2, { colorChange: 1, freeze: 1, bombs: 0 }));
    y += 70;
    this._offer(px + 20, y, panelW - 40, '🎨❄💣  Watch 3 Ads', 'All 3 Boosters', 0xffaa00,
      () => this._choose(3, { colorChange: 1, freeze: 1, bombs: 1 }));
    y += 84;

    this._button('SKIP — START NOW', cx, y, panelW - 40, 0x1a2a3a, 0x88bbdd,
      () => this._choose(0, { colorChange: 0, freeze: 0, bombs: 0 }));
  }

  _offer(x, y, wdt, label, sub, accent, onClick) {
    const h = 58;
    const card = new Graphics();
    card.roundRect(x, y, wdt, h, 12);
    card.fill({ color: 0x0c0c1e });
    card.roundRect(x, y, wdt, h, 12);
    card.stroke({ color: accent, width: 1.5, alpha: 0.6 });
    // 4px solid bottom shadow — the design-system "press" stack.
    card.roundRect(x, y + h - 4, wdt, 4, 12);
    card.fill({ color: accent, alpha: 0.35 });
    card.eventMode = 'static';
    card.cursor = 'pointer';
    card.on('pointerdown', onClick);
    card.on('pointerover', () => { card.alpha = 0.82; });
    card.on('pointerout',  () => { card.alpha = 1.0; });
    this._container.addChild(card);

    const lbl = new Text({ text: label, style: { fontSize: 17, fontWeight: 'bold', fill: 0xffffff } });
    lbl.anchor.set(0, 0.5); lbl.x = x + 14; lbl.y = y + 20;
    this._container.addChild(lbl);

    const s = new Text({ text: sub, style: { fontSize: 12, fontWeight: 'normal', fill: accent } });
    s.anchor.set(0, 0.5); s.x = x + 14; s.y = y + 40;
    this._container.addChild(s);
  }

  _button(label, cx, y, wdt, bgCol, lblCol, onClick) {
    const h = 48;
    const btn = new Graphics();
    btn.roundRect(cx - wdt / 2, y, wdt, h, 12);
    btn.fill(bgCol);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', onClick);
    btn.on('pointerover', () => { btn.alpha = 0.8; });
    btn.on('pointerout',  () => { btn.alpha = 1.0; });
    this._container.addChild(btn);

    const t = new Text({ text: label, style: { fontSize: 18, fontWeight: 'bold', fill: lblCol } });
    t.anchor.set(0.5, 0.5); t.x = cx; t.y = y + h / 2;
    this._container.addChild(t);
  }

  _text(str, x, y, style) {
    const t = new Text({ text: str, style: { fontWeight: 'bold', ...style } });
    t.anchor.set(0.5, 0.5); t.x = x; t.y = y;
    this._container.addChild(t);
    return t;
  }
}
