// HowToPlayOverlay — 4-slide tutorial slideshow opened from the ❓ button on the
// right of the goal bar. Each slide: → advances; ✕ quits. Last slide has ✕ only.

import { Container, Graphics, Text } from 'pixi.js';

const SLIDES = [
  {
    title: 'GOAL',
    body: 'Destroy the required cars shown at the top.\n\nMeet all targets before any car reaches the breach line!',
  },
  {
    title: 'HOW TO PLAY',
    body: "Drag a bomb to a lane — it must match the car's color.\n\nEvery shot advances ALL cars one step forward. Plan carefully!",
  },
  {
    title: 'MERGE COMBOS',
    body: 'Line up 3 same-color bombs in a row or column to create a powerful merged bomb!\n\nUse your 1 free swap per shot to set up merges.',
  },
  {
    title: 'BOOSTERS',
    body: 'COLOR: Tap a car then pick a color — all matching cars transform!\n\nFREEZE: Earned by a 3-car chain kill.\n\nBOMB: Clears an entire row!',
  },
];

export class HowToPlayOverlay {
  constructor(stage, appW, appH, { onClose }) {
    this._container = new Container();
    stage.addChild(this._container);
    this._W = appW;
    this._H = appH;
    this._onClose = onClose;
    this._idx = 0;

    // Backdrop — blocks game input
    const backdrop = new Graphics();
    backdrop.rect(0, 0, appW, appH);
    backdrop.fill({ color: 0x000011, alpha: 0.82 });
    backdrop.eventMode = 'static';
    this._container.addChild(backdrop);

    // Card group (rebuilt per slide)
    this._card = new Container();
    this._container.addChild(this._card);

    this._render();
  }

  destroy() { this._container.destroy({ children: true }); }

  _render() {
    this._card.removeChildren();

    const W = this._W, H = this._H;
    const PW = 320, PH = 300;
    const PX = (W - PW) / 2;
    const PY = (H - PH) / 2;
    const slide = SLIDES[this._idx];
    const isLast = this._idx === SLIDES.length - 1;

    // Panel
    const panel = new Graphics();
    panel.roundRect(PX, PY, PW, PH, 20);
    panel.fill({ color: 0x141a28, alpha: 0.98 });
    panel.roundRect(PX, PY, PW, PH, 20);
    panel.stroke({ color: 0x44aaff, width: 2, alpha: 0.30 });
    this._card.addChild(panel);

    // Step dots (top)
    const dotsY = PY + 22;
    const dotGap = 16;
    const dotsX = W / 2 - ((SLIDES.length - 1) * dotGap) / 2;
    for (let i = 0; i < SLIDES.length; i++) {
      const d = new Graphics();
      d.circle(dotsX + i * dotGap, dotsY, 4);
      d.fill({ color: 0xffffff, alpha: i === this._idx ? 0.95 : 0.28 });
      this._card.addChild(d);
    }

    // Title
    const title = new Text({
      text: slide.title,
      style: { fontSize: 22, fontWeight: 'bold', fill: 0xffd54a, letterSpacing: 1, align: 'center' },
    });
    title.anchor.set(0.5, 0);
    title.x = W / 2; title.y = PY + 44;
    this._card.addChild(title);

    // Body
    const body = new Text({
      text: slide.body,
      style: {
        fontSize: 15, fill: 0xe8ecf4, align: 'center', lineHeight: 22,
        wordWrap: true, wordWrapWidth: PW - 48,
      },
    });
    body.anchor.set(0.5, 0);
    body.x = W / 2; body.y = PY + 88;
    this._card.addChild(body);

    // ✕ quit (top-right)
    this._addBtn(PX + PW - 30, PY + 8, '✕', 0xffffff, 0.10, () => this._onClose?.());

    // → next (bottom-right) — hidden on the last slide
    if (!isLast) {
      this._addBtn(PX + PW - 60, PY + PH - 56, '→', 0xffffff, 0.16, () => {
        this._idx++;
        this._render();
      }, 48);
    }
  }

  _addBtn(x, y, glyph, color, bgAlpha, onTap, size = 30) {
    const g = new Graphics();
    g.roundRect(0, 0, size, size, 8);
    g.fill({ color: 0xffffff, alpha: bgAlpha });
    const t = new Text({ text: glyph, style: { fontSize: Math.round(size * 0.6), fontWeight: 'bold', fill: color } });
    t.anchor.set(0.5, 0.5); t.x = size / 2; t.y = size / 2;
    g.addChild(t);
    g.x = x; g.y = y;
    g.eventMode = 'static';
    g.cursor    = 'pointer';
    g.on('pointerdown', onTap);
    this._card.addChild(g);
  }
}
