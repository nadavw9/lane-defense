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

import { Container, Graphics, Sprite, Assets } from 'pixi.js';
import { panel, ribbon, roundButton, titleText, bodyText, backdrop, well, RIBBON } from '../renderer/PremiumUI.js';
import { INK, shade } from '../renderer/ToyStyle.js';
import { uiIcon } from '../renderer/UIIcon.js';
import { CAR_TYPES, carHpFor, spawnableTypesFor } from '../director/CarTypes.js';

const BASE_URL = import.meta.env.BASE_URL ?? '';

// Presentation only — art and accent colour per type. NEVER hp: that is computed.
// Order is the progression order the player meets them in.
const TYPE_ART = [
  { type: 'small',  color: 0x3DBB3A, sprite: 'sprites/designed/bike-red.png'          },
  { type: 'big',    color: 0x9CC42A, sprite: 'sprites/designed/car-red-processed.png' },
  { type: 'jeep',   color: 0xF2B21B, sprite: 'sprites/designed/van-red.png'           },
  { type: 'truck',  color: 0xF07A1C, sprite: 'sprites/designed/truck-red.png'         },
  { type: 'bigrig', color: 0xE8453C, sprite: 'sprites/designed/bigrig-red.png'        },
  { type: 'tank',   color: 0xB02A5A, sprite: 'sprites/designed/tank.png'              },
];

const ROW_H   = 56;
const SPR_BOX = 46;   // sprite fits within a 46×46 box

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
    const PW = 330;
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
    const PH = 90 + rows.length * ROW_H + 44;
    const PX = (W - PW) / 2;
    const PY = Math.max(40, (H - PH) / 2);
    const C = this._container;

    C.addChild(backdrop(W, H, 0.78));
    const pn = panel(PW, PH);
    pn.x = PX; pn.y = PY;
    C.addChild(pn);
    const rb = ribbon('CAR HP', 200, { size: 26 });
    rb.x = W / 2; rb.y = PY + 2;
    C.addChild(rb);

    // Rows: vehicle art + name (left) … HP pill (right), each in an inset well.
    const rowsTop = PY + 50;
    const sprCX = PX + 50;
    rows.forEach((c, i) => {
      const top = rowsTop + i * ROW_H, cy = top + ROW_H / 2 - 3;
      const bg = well(PW - 36, ROW_H - 6);
      bg.x = PX + 18; bg.y = top;
      bg.alpha = c.available ? 1 : 0.55;
      C.addChild(bg);

      Assets.load(`${BASE_URL}${c.sprite}`).then(tex => {
        if (this._container?.destroyed) return;
        const spr = new Sprite(tex);
        spr.scale.set(Math.min(SPR_BOX / spr.width, SPR_BOX / spr.height));
        spr.anchor.set(0.5, 0.5);
        spr.x = sprCX; spr.y = cy;
        spr.alpha = c.available ? 1 : 0.3;   // greyed: cannot spawn on this level
        this._container.addChild(spr);
      }).catch(() => {});

      const name = bodyText(c.name, 17, c.available ? 0xFFFFFF : 0x6E68A0, { outline: c.available, align: 'left' });
      name.anchor.set(0, 0.5);
      name.x = PX + 84; name.y = cy;
      C.addChild(name);

      // An unavailable type shows no number at all. Printing its HP would be
      // answering a question the player cannot ask on this level, and a greyed-out
      // number still reads as "this is what it has".
      if (c.available) {
        const pill = new Graphics();
        const pw2 = 78, ph2 = 30, px2 = PX + PW - 30 - pw2, py2 = cy - ph2 / 2;
        pill.roundRect(px2, py2 + 2, pw2, ph2, ph2 / 2).fill(shade(c.color, 0.55));
        pill.roundRect(px2, py2, pw2, ph2 - 2, ph2 / 2).fill(c.color);
        pill.roundRect(px2, py2, pw2, ph2, ph2 / 2).stroke({ color: INK, width: 2.5 });
        C.addChild(pill);
        const heart = uiIcon('heart', 16, '❤', { emojiFill: 0xff4466 });
        heart.x = px2 + 16; heart.y = cy - 1;
        C.addChild(heart);
        const hp = titleText(`${c.hp} HP`, 16);
        hp.anchor.set(0, 0.5); hp.x = px2 + 28; hp.y = cy - 1;
        C.addChild(hp);
      } else {
        const hp = bodyText('not on this level', 11, 0x6E68A0, { outline: false });
        hp.anchor.set(1, 0.5);
        hp.x = PX + PW - 32; hp.y = cy;
        C.addChild(hp);
      }
    });

    // Footnote — names the level, so the numbers are unambiguous rather than
    // "base values" the player has no way to convert.
    const note = bodyText(level ? `Actual HP on level ${level.levelId}` : 'Start a level to see its car HP',
      12, 0xC9C3F0, { outline: false, weight: '600' });
    note.x = W / 2; note.y = PY + PH - 26;
    C.addChild(note);

    const close = roundButton(uiIcon('close', 22, '✕'), { r: 22, color: RIBBON, onTap: () => onClose?.() });
    close.x = PX + PW - 14; close.y = PY + 14;
    C.addChild(close);
  }
}
