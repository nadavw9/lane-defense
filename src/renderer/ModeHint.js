// ModeHint — the prompt shown while a booster is ARMED (bomb / colour change):
// the player has tapped a booster and now has to tap the road, and nothing on
// screen said so. One pill, mid-road, in the same style as the other helpers
// (dark card, gold rim); it pulses gently and disappears the moment the mode ends.
import { Container, Graphics } from 'pixi.js';
import { bodyText, GOLD } from './PremiumUI.js';

export class ModeHint {
  constructor(stage, appW, y = 452) {
    this._c = new Container();
    this._c.visible = false;
    this._c.eventMode = 'none';      // never intercepts a tap meant for the road
    this._w = appW; this._y = y; this._t = 0; this._text = null;
    stage.addChild(this._c);
  }

  // text: string to show, or null to hide.
  set(text) {
    if (text === this._text) return;
    this._text = text;
    this._c.removeChildren().forEach(o => o.destroy({ children: true }));
    if (!text) { this._c.visible = false; return; }
    const label = bodyText(text, 17, 0xFFFFFF);
    const w = label.width + 44, h = 40;
    const g = new Graphics();
    g.roundRect(-w / 2, -h / 2, w, h, h / 2).fill({ color: 0x17143A, alpha: 0.94 }).stroke({ color: GOLD, width: 2.5 });
    g.roundRect(-w / 2 + 4, -h / 2 + 3, w - 8, h * 0.4, h * 0.2).fill({ color: 0xffffff, alpha: 0.08 });
    label.x = 0; label.y = 0;
    this._c.addChild(g, label);
    this._c.x = this._w / 2; this._c.y = this._y;
    this._c.visible = true;
  }

  update(dt) {
    if (!this._c.visible) return;
    this._t += dt;
    this._c.scale.set(1 + 0.03 * Math.sin(this._t * 5));
  }

  destroy() { this._c.destroy({ children: true }); }
}
