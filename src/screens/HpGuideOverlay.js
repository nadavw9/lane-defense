// HpGuideOverlay — the car manual. Shows THIS LEVEL'S ACTUAL car HP.
//
// IT USED TO SHOW A HARDCODED TABLE AND IT WAS WRONG ON SHIPPED BUILDS.
// The numbers were 3/6/8/10/15/30 with a footer reading "Base values — actual HP
// scales by level". Those were CAR_TYPES' real base values on 0f4b7fa, the commit
// that added this panel, and were never touched again when the balance pass moved
// them to 2/4/5/7/11/20. A comment here said "Keep the HP numbers in sync with
// CarTypes.js" — a comment is not a mechanism, and the copy drifted for months.
//
// Two things were wrong, and only one of them was the stale numbers:
//   1. the table disagreed with the code
//   2. "base values, scales by level" is not usable information. A player looking
//      at a 4 HP van on the board cannot derive it from an 8 in the manual. The
//      manual has to answer "how much HP does THAT car have", not "what would it
//      have at hpMultiplier 1.0", which is a number the game never shows anywhere.
//
// Everything is now computed live: HP through CarTypes.carHpFor (the same function
// CarDirector spawns with) and availability through CarTypes.spawnableTypesFor, so
// the panel cannot list a Tank on a level that never spawns one. Guarded by
// tests/car-manual-hp.test.js, which spawns real cars and compares.

import { Container, Graphics, Text, Sprite, Assets } from 'pixi.js';
import { uiIcon } from '../renderer/UIIcon.js';
import { CAR_TYPES, carHpFor, spawnableTypesFor } from '../director/CarTypes.js';

const BASE_URL = import.meta.env.BASE_URL ?? '';

// Presentation only — art and accent colour per type. NEVER hp: that is computed.
// Order is the progression order the player meets them in.
const TYPE_ART = [
  { type: 'small',  color: 0xE24B4A, sprite: 'sprites/designed/bike-red.png'          },
  { type: 'big',    color: 0xEF9F27, sprite: 'sprites/designed/car-red-processed.png' },
  { type: 'jeep',   color: 0x378ADD, sprite: 'sprites/designed/van-red.png'           },
  { type: 'truck',  color: 0x639922, sprite: 'sprites/designed/truck-red.png'         },
  { type: 'bigrig', color: 0xD85A30, sprite: 'sprites/designed/bigrig-red.png'        },
  { type: 'tank',   color: 0x7F77DD, sprite: 'sprites/designed/tank.png'              },
];

const ROW_H   = 46;
const SPR_BOX = 40;   // sprite fits within a 40×40 box

export class HpGuideOverlay {
  // level: { levelId, hpMultiplier, gridRows, spawnScript } — the LIVE values from
  // GameState, not a snapshot taken at boot. Omitted only if the panel were ever
  // opened outside a level, which today it cannot be (see _build).
  constructor(stage, appW, appH, { onClose, level = null }) {
    this._container = new Container();
    stage.addChild(this._container);
    this._build(appW, appH, onClose, level);
  }

  destroy() { this._container.destroy({ children: true }); }

  _build(W, H, onClose, level) {
    const PW = 300;
    const mult      = level?.hpMultiplier ?? 1.0;
    const spawnable = level
      ? spawnableTypesFor(level.levelId, level.gridRows, level.cfg)
      : null;
    const rows = TYPE_ART.map((a) => ({
      ...a,
      name:      CAR_TYPES[a.type].label,
      hp:        carHpFor(a.type, mult),
      available: spawnable ? spawnable.has(a.type) : true,
    }));
    const PH = 86 + rows.length * ROW_H + 24;
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
    rows.forEach((c, i) => {
      const cy = rowsTop + i * ROW_H + ROW_H / 2;

      // Car sprite (replaces the old colour dot). Coloured placeholder while it loads.
      const plh = new Graphics();
      plh.roundRect(sprCX - SPR_BOX / 2, cy - SPR_BOX / 2, SPR_BOX, SPR_BOX, 6);
      plh.fill({ color: c.color, alpha: c.available ? 0.14 : 0.05 });
      this._container.addChild(plh);

      Assets.load(`${BASE_URL}${c.sprite}`).then(tex => {
        if (this._container?.destroyed) return;
        const spr = new Sprite(tex);
        const scale = Math.min(SPR_BOX / spr.width, SPR_BOX / spr.height);
        spr.scale.set(scale);
        spr.anchor.set(0.5, 0.5);
        spr.x = sprCX; spr.y = cy;
        spr.alpha = c.available ? 1 : 0.30;   // greyed: cannot spawn on this level
        this._container.removeChild(plh);
        plh.destroy();
        this._container.addChild(spr);
      }).catch(() => {});

      const name = new Text({
        text: c.name,
        style: { fontSize: 16, fontWeight: 'bold', fill: c.available ? 0xe8ecf4 : 0x5a6274 },
      });
      name.anchor.set(0, 0.5);
      name.x = PX + 60; name.y = cy;
      this._container.addChild(name);

      // An unavailable type shows no number at all. Printing its HP would be
      // answering a question the player cannot ask on this level, and a greyed-out
      // number still reads as "this is what it has".
      const hp = new Text({
        text: c.available ? `${c.hp} HP` : 'not here',
        style: { fontSize: c.available ? 16 : 12, fontWeight: 'bold',
                 fill: c.available ? 0xffd54a : 0x5a6274 },
      });
      hp.anchor.set(1, 0.5);
      hp.x = PX + PW - 22; hp.y = cy;
      this._container.addChild(hp);

      if (i < rows.length - 1) {
        const sep = new Graphics();
        sep.rect(PX + 22, cy + ROW_H / 2 - 0.5, PW - 44, 1);
        sep.fill({ color: 0xffffff, alpha: 0.07 });
        this._container.addChild(sep);
      }
    });

    // Footnote
    const note = new Text({
      // Names the level, so the numbers are unambiguous rather than "base values"
      // the player has no way to convert.
      text: level
        ? `Actual HP on level ${level.levelId}`
        : 'Start a level to see its car HP',
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
    const t = uiIcon('close', 18, '✕', { emojiFill: 0xffffff });
    t.x = 15; t.y = 15;
    g.addChild(t);
    g.x = x; g.y = y;
    g.eventMode = 'static';
    g.cursor    = 'pointer';
    g.on('pointerdown', () => onClose?.());
    this._container.addChild(g);
  }
}
