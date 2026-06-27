// HpGuideOverlay — quick reference of each car type and its BASE HP.
// Opened from the 🚗 button on the left of the goal bar. Base values only;
// actual in-game HP scales by the level's hpMultiplier.
//
// Keep the HP numbers in sync with src/director/CarTypes.js base values.

import { Container, Graphics, Text, Sprite, Assets } from 'pixi.js';

const BASE_URL = import.meta.env.BASE_URL ?? '';

// Sprite paths match CarManualScreen / the live car art. HP = CarTypes.js base HP.
const CAR_HP = [
  { name: 'Motorbike', hp: 3,  color: 0xE24B4A, sprite: 'sprites/designed/bike-red.png'          },
  { name: 'Car',       hp: 6,  color: 0xEF9F27, sprite: 'sprites/designed/car-red-processed.png' },
  { name: 'Van',       hp: 8,  color: 0x378ADD, sprite: 'sprites/designed/van-red.png'           },
  { name: 'Tender',    hp: 10, color: 0x639922, sprite: 'sprites/designed/truck-red.png'         },
  { name: 'Big Rig',   hp: 15, color: 0xD85A30, sprite: 'sprites/designed/bigrig-red.png'        },
  { name: 'Tank',      hp: 30, color: 0x7F77DD, sprite: 'sprites/designed/tank.png'              },
];

const ROW_H   = 46;
const SPR_BOX = 40;   // sprite fits within a 40×40 box

export class HpGuideOverlay {
  constructor(stage, appW, appH, { onClose }) {
    this._container = new Container();
    stage.addChild(this._container);
    this._build(appW, appH, onClose);
  }

  destroy() { this._container.destroy({ children: true }); }

  _build(W, H, onClose) {
    const PW = 300;
    const PH = 86 + CAR_HP.length * ROW_H + 24;
    const PX = (W - PW) / 2;
    const PY = Math.max(20, (H - PH) / 2);

    // Backdrop — blocks game input
    const backdrop = new Graphics();
    backdrop.rect(0, 0, W, H);
    backdrop.fill({ color: 0x000011, alpha: 0.82 });
    backdrop.eventMode = 'static';
    this._container.addChild(backdrop);

    // Panel
    const panel = new Graphics();
    panel.roundRect(PX, PY, PW, PH, 18);
    panel.fill({ color: 0x141a28, alpha: 0.98 });
    panel.roundRect(PX, PY, PW, PH, 18);
    panel.stroke({ color: 0xffffff, width: 1.5, alpha: 0.18 });
    this._container.addChild(panel);

    // Title
    const title = new Text({
      text: 'CAR HP',
      style: { fontSize: 20, fontWeight: 'bold', fill: 0xffffff, letterSpacing: 2 },
    });
    title.anchor.set(0.5, 0);
    title.x = W / 2; title.y = PY + 18;
    this._container.addChild(title);

    // Rows: colour dot + name (left) … HP value (right)
    const rowsTop = PY + 56;
    const sprCX = PX + 32;   // sprite-zone centre
    CAR_HP.forEach((c, i) => {
      const cy = rowsTop + i * ROW_H + ROW_H / 2;

      // Car sprite (replaces the old colour dot). Coloured placeholder while it loads.
      const plh = new Graphics();
      plh.roundRect(sprCX - SPR_BOX / 2, cy - SPR_BOX / 2, SPR_BOX, SPR_BOX, 6);
      plh.fill({ color: c.color, alpha: 0.14 });
      this._container.addChild(plh);

      Assets.load(`${BASE_URL}${c.sprite}`).then(tex => {
        if (this._container?.destroyed) return;
        const spr = new Sprite(tex);
        const scale = Math.min(SPR_BOX / spr.width, SPR_BOX / spr.height);
        spr.scale.set(scale);
        spr.anchor.set(0.5, 0.5);
        spr.x = sprCX; spr.y = cy;
        this._container.removeChild(plh);
        plh.destroy();
        this._container.addChild(spr);
      }).catch(() => {});

      const name = new Text({
        text: c.name,
        style: { fontSize: 16, fontWeight: 'bold', fill: 0xe8ecf4 },
      });
      name.anchor.set(0, 0.5);
      name.x = PX + 60; name.y = cy;
      this._container.addChild(name);

      const hp = new Text({
        text: `${c.hp} HP`,
        style: { fontSize: 16, fontWeight: 'bold', fill: 0xffd54a },
      });
      hp.anchor.set(1, 0.5);
      hp.x = PX + PW - 22; hp.y = cy;
      this._container.addChild(hp);

      if (i < CAR_HP.length - 1) {
        const sep = new Graphics();
        sep.rect(PX + 22, cy + ROW_H / 2 - 0.5, PW - 44, 1);
        sep.fill({ color: 0xffffff, alpha: 0.07 });
        this._container.addChild(sep);
      }
    });

    // Footnote
    const note = new Text({
      text: 'Base values — actual HP scales by level',
      style: { fontSize: 11, fill: 0x8a93a6, align: 'center' },
    });
    note.anchor.set(0.5, 1);
    note.x = W / 2; note.y = PY + PH - 12;
    this._container.addChild(note);

    // ✕ close button (top-right of panel)
    this._addClose(PX + PW - 30, PY + 8, onClose);
  }

  _addClose(x, y, onClose) {
    const g = new Graphics();
    g.roundRect(0, 0, 30, 30, 8);
    g.fill({ color: 0xffffff, alpha: 0.10 });
    const t = new Text({ text: '✕', style: { fontSize: 18, fontWeight: 'bold', fill: 0xffffff } });
    t.anchor.set(0.5, 0.5); t.x = 15; t.y = 15;
    g.addChild(t);
    g.x = x; g.y = y;
    g.eventMode = 'static';
    g.cursor    = 'pointer';
    g.on('pointerdown', () => onClose?.());
    this._container.addChild(g);
  }
}
