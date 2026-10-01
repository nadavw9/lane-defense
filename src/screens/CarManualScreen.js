// CarManualScreen — the in-game car guide (premium pass, 2026-09-28).
//
// Two sections: the six vehicle types (base HP from CAR_TYPES, the single source
// of truth; the in-level CAR HP panel shows the exact numbers for that level) and
// the four V2 special cars. Anything the player has not met yet is a locked tile.
// Access via the pause menu "CAR GUIDE" button.
import { Container, Graphics, Sprite, Assets } from 'pixi.js';
import { uiIcon } from '../renderer/UIIcon.js';
import { CAR_TYPES } from '../director/CarTypes.js';
import { panel, ribbon, button, roundButton, titleText, bodyText, backdrop, well, GOLD, RIBBON } from '../renderer/PremiumUI.js';
import { INK, shade } from '../renderer/ToyStyle.js';
import { TRAIT_KEYS, traitInfo, traitSpritePath } from '../renderer/traitIcons.js';
import { LEVEL_COUNT, levelConfigFor } from '../game/LevelManager.js';

const BASE_URL = import.meta.env.BASE_URL ?? '';

const CAR_ENTRIES = [
  { key: 'small',  name: 'MOTORBIKE', hp: CAR_TYPES.small.hp,  color: 0x3DBB3A, sprite: 'sprites/designed/bike-red.png'          },
  { key: 'big',    name: 'CAR',       hp: CAR_TYPES.big.hp,    color: 0x9CC42A, sprite: 'sprites/designed/car-red-processed.png' },
  { key: 'jeep',   name: 'VAN',       hp: CAR_TYPES.jeep.hp,   color: 0xF2B21B, sprite: 'sprites/designed/van-red.png'           },
  { key: 'truck',  name: 'TRUCK',     hp: CAR_TYPES.truck.hp,  color: 0xF07A1C, sprite: 'sprites/designed/truck-red.png'         },
  { key: 'bigrig', name: 'BIG RIG',   hp: CAR_TYPES.bigrig.hp, color: 0xE8453C, sprite: 'sprites/designed/bigrig-red.png'        },
  { key: 'tank',   name: 'TANK',      hp: CAR_TYPES.tank.hp,   color: 0xB02A5A, sprite: 'sprites/designed/tank.png'              },
];

// Special cars, revealed once the player has reached the level that introduces
// them. The intro level is DERIVED from the level table (first level whose trait
// mix contains it), so adding or moving a level never leaves the guide stale.
function firstLevelWith(trait) {
  for (let id = 1; id <= LEVEL_COUNT; id++) if (levelConfigFor(id)?.traits?.[trait] > 0) return id;
  return null;
}
function buildSpecials() {
  const list = TRAIT_KEYS.map(k => ({ trait: k, ...traitInfo(k), sprite: traitSpritePath(k), level: firstLevelWith(k) }))
    .filter(e => e.level != null);
  list.push({ trait: 'boss', name: 'BOSS', level: 10, sprite: 'sprites/designed/boss.png', rule: 'Hit its roof colors in order' });
  return list.sort((a, b) => a.level - b.level);
}

export class CarManualScreen {
  // seenTypes: Set of type keys the player has been introduced to
  // (ProgressManager.getIntroducedCarTypes()). unlockedLevel reveals specials.
  constructor(stage, appW, appH, { onClose, seenTypes, unlockedLevel = 1 }) {
    this._seenTypes = seenTypes ?? new Set();
    this._unlocked = unlockedLevel;
    this._container = new Container();
    stage.addChild(this._container);
    this._build(appW, appH, onClose);
  }

  destroy() { this._container.destroy({ children: true }); }

  _build(W, H, onClose) {
    const C = this._container;
    const PW = 358, PH = 784;
    const PX = (W - PW) / 2, PY = Math.max(40, (H - PH) / 2 + 6);
    C.addChild(backdrop(W, H, 0.8));
    const pn = panel(PW, PH);
    pn.x = PX; pn.y = PY;
    C.addChild(pn);
    const rb = ribbon('CAR GUIDE', 230, { size: 26 });
    rb.x = W / 2; rb.y = PY + 2;
    C.addChild(rb);
    const close = roundButton(uiIcon('close', 22, '✕'), { r: 22, color: RIBBON, onTap: () => onClose?.() });
    close.x = PX + PW - 14; close.y = PY + 14;
    C.addChild(close);

    // Vehicles: 3 × 2 tiles.
    this._label('VEHICLES · BASE HP', W / 2, PY + 52);
    const tw = 100, th = 108, gap = 10;
    const gx = PX + (PW - (3 * tw + 2 * gap)) / 2, gy = PY + 66;
    CAR_ENTRIES.forEach((e, i) => {
      this._vehicleTile(e, gx + (i % 3) * (tw + gap), gy + Math.floor(i / 3) * (th + gap), tw, th, this._seenTypes.has(e.key));
    });

    // Specials: 2 columns, as many rows as the campaign has special cars.
    const sy = gy + 2 * (th + gap) + 14;
    this._label('SPECIAL CARS', W / 2, sy);
    const sw = (PW - 36 - gap) / 2, sh = 86;
    buildSpecials().forEach((s, i) => {
      this._specialTile(s, PX + 18 + (i % 2) * (sw + gap), sy + 14 + Math.floor(i / 2) * (sh + 8), sw, sh, this._unlocked >= s.level);
    });

    const ok = button('GOT IT', { variant: 'blue', w: 180, h: 56, size: 24, onTap: () => onClose?.() });
    ok.x = W / 2; ok.y = PY + PH - 44;
    C.addChild(ok);
  }

  _label(str, x, y) {
    const t = bodyText(str, 13, 0xC9C3F0, { outline: false });
    t.x = x; t.y = y;
    this._container.addChild(t);
  }

  _sprite(path, maxW, maxH, x, y, tint = null) {
    const holder = new Container();
    holder.x = x; holder.y = y;
    this._container.addChild(holder);
    Assets.load(`${BASE_URL}${path}`).then(tex => {
      if (holder.destroyed) return;
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.scale.set(Math.min(maxW / s.width, maxH / s.height));
      if (tint != null) s.tint = tint;
      holder.addChild(s);
    }).catch(() => {});
  }

  _lock(x, y, r = 26) {
    const g = new Graphics();
    g.circle(x, y, r).fill(0x1C1946).stroke({ color: 0x0C0A26, width: 2.5 });
    g.roundRect(x - 9, y - 3, 18, 14, 3).fill(0x6E68A0);
    g.moveTo(x - 7, y - 4).arc(x, y - 4, 7, Math.PI, 0).stroke({ color: 0x6E68A0, width: 3.5 });
    this._container.addChild(g);
  }

  _vehicleTile(e, x, y, tw, th, revealed) {
    const bg = well(tw, th);
    bg.x = x; bg.y = y;
    this._container.addChild(bg);
    if (!revealed) {
      this._lock(x + tw / 2, y + 48);
      const q = titleText('???', 16, 0x6E68A0);
      q.x = x + tw / 2; q.y = y + th - 22;
      this._container.addChild(q);
      return;
    }
    this._sprite(e.sprite, 54, 50, x + tw / 2, y + 30);
    const n = bodyText(e.name, 13, 0xFFFFFF);
    n.x = x + tw / 2; n.y = y + 63;   // clear of the HP pill (y + th - 28)
    if (n.width > tw - 8) n.scale.set((tw - 8) / n.width);
    this._container.addChild(n);
    // HP pill.
    const pw = 70, ph = 22, px = x + (tw - pw) / 2, py = y + th - 28;
    const pill = new Graphics();
    pill.roundRect(px, py + 2, pw, ph, ph / 2).fill(shade(e.color, 0.55));
    pill.roundRect(px, py, pw, ph - 1, ph / 2).fill(e.color);
    pill.roundRect(px, py, pw, ph, ph / 2).stroke({ color: INK, width: 2 });
    this._container.addChild(pill);
    const heart = uiIcon('heart', 13, '❤', { emojiFill: 0xff4466 });
    heart.x = px + 14; heart.y = py + ph / 2 - 1;
    const hp = titleText(`${e.hp} HP`, 13);
    hp.anchor.set(0, 0.5); hp.x = px + 24; hp.y = py + ph / 2 - 1;
    this._container.addChild(heart, hp);
  }

  _specialTile(s, x, y, sw, sh, revealed) {
    const bg = well(sw, sh);
    bg.x = x; bg.y = y;
    this._container.addChild(bg);
    if (!revealed) {
      this._lock(x + 38, y + sh / 2, 24);
      const q = titleText('???', 16, 0x6E68A0);
      q.anchor.set(0, 0.5); q.x = x + 72; q.y = y + 30;
      this._container.addChild(q);
      const r = bodyText(`Level ${s.level}`, 13, 0x6E68A0, { outline: false, align: 'left' });
      r.anchor.set(0, 0.5); r.x = x + 72; r.y = y + 54;
      this._container.addChild(r);
      return;
    }
    this._sprite(s.sprite, 50, 68, x + 36, y + sh / 2, s.tint);
    const n = titleText(s.name, 15, GOLD);
    n.anchor.set(0, 0.5); n.x = x + 70; n.y = y + 20;
    if (n.width > sw - 76) n.scale.set((sw - 76) / n.width);
    this._container.addChild(n);
    const r = bodyText(s.rule, 13, 0xE6E1FF, { outline: false, align: 'left', weight: '600', wrap: sw - 78 });
    r.anchor.set(0, 0); r.x = x + 70; r.y = y + 34;
    this._container.addChild(r);
  }
}
