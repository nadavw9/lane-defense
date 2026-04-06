// PauseScreen — modal overlay shown when the player taps the pause button
// during gameplay.
//
// Buttons:
//   RESUME      — close overlay, unpause game
//   SETTINGS    — open settings (game stays paused)
//   QUIT TO MENU — end the current attempt, go to level select
import { Container, Graphics, Text } from 'pixi.js';

export class PauseScreen {
  // callbacks: { onResume, onSettings, onQuit }
  constructor(stage, appW, appH, { onResume, onSettings, onQuit, audio }) {
    this._container = new Container();
    stage.addChild(this._container);
    this._build(appW, appH, onResume, onSettings, onQuit, audio);
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build(w, h, onResume, onSettings, onQuit, audio) {
    // Semi-transparent backdrop — blocks clicks to game layers.
    const backdrop = new Graphics();
    backdrop.rect(0, 0, w, h);
    backdrop.fill({ color: 0x000011, alpha: 0.78 });
    backdrop.eventMode = 'static';
    this._container.addChild(backdrop);

    // Panel
    const panelW = 290, panelH = 300;
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2 - 30;

    const panel = new Graphics();
    panel.roundRect(px, py, panelW, panelH, 18);
    panel.fill({ color: 0x0d1a2e, alpha: 0.97 });
    panel.roundRect(px, py, panelW, panelH, 18);
    panel.stroke({ color: 0x44aaff, width: 2, alpha: 0.35 });
    this._container.addChild(panel);

    const cx = w / 2;
    let y    = py + 44;

    // Title
    const title = new Text({
      text: '⏸ PAUSED',
      style: { fontSize: 28, fontWeight: 'bold', fill: 0xffffff },
    });
    title.anchor.set(0.5, 0.5);
    title.x = cx;
    title.y = y;
    this._container.addChild(title);
    y += 56;

    const tap = (fn) => () => { audio?.play('button_tap'); fn(); };
    this._btn('RESUME',       cx, y, 0x1a5a2a, 0x55ff99, tap(onResume));   y += 58;
    this._btn('SETTINGS',     cx, y, 0x1a2a4a, 0x55aaff, tap(onSettings)); y += 58;
    this._btn('QUIT TO MENU', cx, y, 0x2a0d0d, 0xff6666, tap(onQuit));
  }

  _btn(label, cx, y, bg, fg, onClick) {
    const W = 220, H = 48;
    const b = new Graphics();
    b.roundRect(-W / 2, -H / 2, W, H, 12);
    b.fill(bg);
    b.x = cx;
    b.y = y;
    b.eventMode = 'static';
    b.cursor    = 'pointer';
    b.on('pointerdown', onClick);
    b.on('pointerover',  () => { b.alpha = 0.78; });
    b.on('pointerout',   () => { b.alpha = 1.00; });

    const t = new Text({ text: label, style: { fontSize: 18, fontWeight: 'bold', fill: fg } });
    t.anchor.set(0.5, 0.5);
    b.addChild(t);
    this._container.addChild(b);
  }
}
