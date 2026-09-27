// PauseScreen — modal overlay shown when the player taps pause during gameplay
// (premium pass, 2026-09-28).
//
// Buttons:
//   RESUME     — close overlay, unpause game
//   RESTART    — restart this level (only when the caller supplies onRestart)
//   CAR GUIDE  — open the car encyclopedia
//   SETTINGS   — open settings (game stays paused)
//   QUIT       — two-step: the first tap arms it ("TAP AGAIN TO QUIT"), a second
//                tap within 2.5s ends the attempt. A stray tap never throws a
//                level away.
import { Container } from 'pixi.js';
import { panel, ribbon, button, backdrop } from '../renderer/PremiumUI.js';
import { uiIcon } from '../renderer/UIIcon.js';

export class PauseScreen {
  // callbacks: { onResume, onRestart?, onCarManual, onSettings, onQuit, audio }
  constructor(stage, appW, appH, { onResume, onRestart = null, onCarManual, onSettings, onQuit, audio }) {
    this._container = new Container();
    stage.addChild(this._container);
    this._quitTimer = null;
    this._build(appW, appH, { onResume, onRestart, onCarManual, onSettings, onQuit, audio });
  }

  destroy() {
    clearTimeout(this._quitTimer);
    this._container.destroy({ children: true });
  }

  _build(w, h, { onResume, onRestart, onCarManual, onSettings, onQuit, audio }) {
    this._container.addChild(backdrop(w, h));
    const rows = onRestart ? 5 : 4;
    const PW = 310, PH = 90 + rows * 74 + 20;
    const px = (w - PW) / 2, py = (h - PH) / 2 - 10;
    const pnl = panel(PW, PH);
    pnl.x = px; pnl.y = py;
    this._container.addChild(pnl);
    const rb = ribbon('PAUSED', 220);
    rb.x = w / 2; rb.y = py + 2;
    this._container.addChild(rb);

    const tap = (fn) => () => { audio?.play('button_tap'); fn?.(); };
    let y = py + 88;
    const add = (label, variant, fn, icon = null) => {
      const b = button(label, { variant, w: 236, h: 60, size: 24, icon, onTap: fn });
      b.x = w / 2; b.y = y;
      this._container.addChild(b);
      y += 74;
      return b;
    };
    add('RESUME', 'green', tap(onResume), uiIcon('play', 22, '▶'));
    if (onRestart) add('RESTART', 'purple', tap(onRestart));
    add('CAR GUIDE', 'blue', tap(onCarManual), uiIcon('book', 24, '📖'));
    add('SETTINGS', 'dark', tap(onSettings), uiIcon('gear', 24, '⚙'));

    // Two-step quit.
    let armed = false;
    const quit = add('QUIT LEVEL', 'red', () => {
      audio?.play('button_tap');
      if (armed) { onQuit?.(); return; }
      armed = true;
      this._setLabel(quit, 'TAP AGAIN TO QUIT');
      this._quitTimer = setTimeout(() => { armed = false; if (!quit.destroyed) this._setLabel(quit, 'QUIT LEVEL'); }, 2500);
    });
  }

  // The button's title Text is the last child of its body container.
  _setLabel(btn, text) {
    const body = btn.children[0];
    const t = body?.children[body.children.length - 1];
    if (t && 'text' in t) {
      t.text = text;
      t.scale.set(text.length > 12 ? 0.72 : 1);
    }
  }
}
