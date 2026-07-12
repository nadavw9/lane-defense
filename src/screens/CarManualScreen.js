// CarManualScreen — in-game car encyclopedia.
// Shows all 6 car types; unencountered ones appear as locked silhouettes.
// Access via pause menu "CAR INFO" button or HUD book icon.

import { Container, Graphics, Text, Sprite, Assets } from 'pixi.js';
import { uiIcon } from '../renderer/UIIcon.js';
import { CAR_TYPES } from '../director/CarTypes.js';

const BASE_URL = import.meta.env.BASE_URL ?? '';

// hp comes from CAR_TYPES (single source of truth) — the manual shows base HP;
// live cars scale it by the level's hpMultiplier. (The values previously
// hardcoded here were from the reverted gridRows-16 HP raise.)
const CAR_ENTRIES = [
  { key: 'small',  name: 'MOTORBIKE', hp: CAR_TYPES.small.hp,  color: 0x44BB99, sprite: 'sprites/designed/bike-red.png'           },
  { key: 'big',    name: 'CAR',       hp: CAR_TYPES.big.hp,    color: 0xDD8833, sprite: 'sprites/designed/car-red-processed.png'  },
  { key: 'jeep',   name: 'VAN',       hp: CAR_TYPES.jeep.hp,   color: 0x378ADD, sprite: 'sprites/designed/van-red.png'            },
  { key: 'truck',  name: 'TENDER',    hp: CAR_TYPES.truck.hp,  color: 0x639922, sprite: 'sprites/designed/truck-red.png'          },
  { key: 'bigrig', name: 'BIG RIG',   hp: CAR_TYPES.bigrig.hp, color: 0xD85A30, sprite: 'sprites/designed/bigrig-red.png'         },
  { key: 'tank',   name: 'TANK',      hp: CAR_TYPES.tank.hp,   color: 0x7F77DD, sprite: 'sprites/designed/tank.png'               },
];

const ENTRY_H    = 100;
const ENTRY_GAP  = 5;
const SPR_ZONE_W = 76;   // left zone width for the sprite
const SPR_MAX_W  = 62;
const SPR_MAX_H  = 80;

export class CarManualScreen {
  // seenTypes: Set of type keys the player has been introduced to
  // (ProgressManager.getIntroducedCarTypes()); others render as locked silhouettes.
  constructor(stage, appW, appH, { onClose, seenTypes }) {
    this._seenTypes = seenTypes ?? new Set();
    this._container = new Container();
    stage.addChild(this._container);
    this._build(appW, appH, onClose);
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build(W, H, onClose) {
    const PW = 356;
    const ENTRIES_H = CAR_ENTRIES.length * (ENTRY_H + ENTRY_GAP) - ENTRY_GAP;
    const PH = 66 + ENTRIES_H + 16 + 48 + 20;  // header + entries + gap + btn + padding
    const PX = (W - PW) / 2;
    const PY = Math.max(10, (H - PH) / 2);

    const seenTypes = this._seenTypes;

    // Backdrop — blocks game clicks
    const backdrop = new Graphics();
    backdrop.rect(0, 0, W, H);
    backdrop.fill({ color: 0x000011, alpha: 0.85 });
    backdrop.eventMode = 'static';
    this._container.addChild(backdrop);

    // Panel
    const panel = new Graphics();
    panel.roundRect(PX, PY, PW, PH, 18);
    panel.fill({ color: 0x0d1a2e, alpha: 0.98 });
    panel.roundRect(PX, PY, PW, PH, 18);
    panel.stroke({ color: 0x44aaff, width: 2, alpha: 0.30 });
    this._container.addChild(panel);

    // Header
    const eyebrow = new Text({
      text: 'CAR ENCYCLOPEDIA',
      style: { fontSize: 10, fontWeight: 'bold', fill: 0x6688aa, letterSpacing: 3 },
    });
    eyebrow.anchor.set(0.5, 0);
    eyebrow.x = W / 2; eyebrow.y = PY + 14;
    this._container.addChild(eyebrow);

    const heading = new Text({
      text: 'VEHICLES',
      style: { fontSize: 22, fontWeight: 'bold', fill: 0xffffff },
    });
    heading.anchor.set(0.5, 0);
    heading.x = W / 2; heading.y = PY + 30;
    this._container.addChild(heading);

    // Entries
    const startY = PY + 66;
    for (let i = 0; i < CAR_ENTRIES.length; i++) {
      const entry = CAR_ENTRIES[i];
      const ey    = startY + i * (ENTRY_H + ENTRY_GAP);
      this._buildEntry(entry, ey, PX + 8, PW - 16, seenTypes.has(entry.key));
    }

    // Close button
    const closeY = startY + ENTRIES_H + 16;
    const BW = 200, BH = 48;
    const btn = new Graphics();
    btn.roundRect((W - BW) / 2, closeY, BW, BH, 12);
    btn.fill({ color: 0x1a2a4a, alpha: 1 });
    btn.eventMode = 'static'; btn.cursor = 'pointer';
    btn.on('pointerdown', onClose);
    btn.on('pointerover', () => { btn.alpha = 0.75; });
    btn.on('pointerout',  () => { btn.alpha = 1.00; });
    this._container.addChild(btn);

    const btnTxt = new Text({
      text: 'CLOSE',
      style: { fontSize: 18, fontWeight: 'bold', fill: 0x88aacc },
    });
    btnTxt.anchor.set(0.5, 0.5);
    btnTxt.x = W / 2; btnTxt.y = closeY + BH / 2;
    this._container.addChild(btnTxt);
  }

  _buildEntry(entry, ey, ex, ew, revealed) {
    const sprCX = ex + SPR_ZONE_W / 2;
    const sprCY = ey + ENTRY_H / 2;
    const textX  = ex + SPR_ZONE_W + 10;

    // Entry background
    const bg = new Graphics();
    bg.roundRect(ex, ey, ew, ENTRY_H, 10);
    bg.fill({ color: revealed ? 0x0e1a28 : 0x0a0a14, alpha: 1 });
    if (revealed) {
      bg.roundRect(ex, ey, ew, ENTRY_H, 10);
      bg.stroke({ color: entry.color, width: 1.5, alpha: 0.38 });
    }
    this._container.addChild(bg);

    if (revealed) {
      // Colored placeholder while sprite loads
      const plh = new Graphics();
      plh.roundRect(ex + 6, ey + (ENTRY_H - SPR_MAX_H) / 2, SPR_MAX_W, SPR_MAX_H, 6);
      plh.fill({ color: entry.color, alpha: 0.12 });
      this._container.addChild(plh);

      Assets.load(`${BASE_URL}${entry.sprite}`).then(tex => {
        if (this._container?.destroyed) return;
        const spr = new Sprite(tex);
        const scale = Math.min(SPR_MAX_W / spr.width, SPR_MAX_H / spr.height);
        spr.scale.set(scale);
        spr.anchor.set(0.5, 0.5);
        spr.x = sprCX; spr.y = sprCY;
        this._container.removeChild(plh);
        plh.destroy();
        this._container.addChild(spr);
      }).catch(() => {});

      // Name
      const nameTxt = new Text({
        text: entry.name,
        style: { fontSize: 17, fontWeight: '900', fill: 0xffffff },
      });
      nameTxt.anchor.set(0, 0);
      nameTxt.x = textX; nameTxt.y = ey + 12;
      this._container.addChild(nameTxt);

      // HP badge
      const bw = 96, bh = 26;
      const hpBadge = new Graphics();
      hpBadge.roundRect(textX, ey + 36, bw, bh, bh / 2);
      hpBadge.fill({ color: entry.color, alpha: 0.85 });
      this._container.addChild(hpBadge);

      const hpTxt = new Text({
        text: `${entry.hp} HP`,
        style: { fontSize: 13, fontWeight: 'bold', fill: 0xffffff },
      });
      hpTxt.anchor.set(0, 0.5);
      const hpHeart = uiIcon('heart', 14, '❤', { emojiFill: 0xff4466 });
      hpHeart.x = textX + 10 + 7; hpHeart.y = ey + 36 + bh / 2;
      hpTxt.x = textX + 10 + 18;  hpTxt.y = ey + 36 + bh / 2;
      this._container.addChild(hpHeart);
      this._container.addChild(hpTxt);

      // Damage tip
      const tipTxt = new Text({
        text: `A ${entry.hp}-damage bomb destroys in one hit`,
        style: {
          fontSize:      10,
          fill:          0x8899aa,
          wordWrap:      true,
          wordWrapWidth: ew - SPR_ZONE_W - 20,
        },
      });
      tipTxt.anchor.set(0, 0);
      tipTxt.x = textX; tipTxt.y = ey + 70;
      this._container.addChild(tipTxt);

    } else {
      // Locked: silhouette circle with lock symbol + ??? name + ? HP badge
      const lockBg = new Graphics();
      lockBg.circle(sprCX, sprCY, 30);
      lockBg.fill({ color: 0x151e28, alpha: 0.90 });
      lockBg.circle(sprCX, sprCY, 30);
      lockBg.stroke({ color: 0x2a3a4a, width: 1.5, alpha: 0.70 });
      this._container.addChild(lockBg);

      // Lock body (rectangle)
      const lockBody = new Graphics();
      lockBody.roundRect(sprCX - 9, sprCY - 2, 18, 14, 3);
      lockBody.fill({ color: 0x334455, alpha: 1 });
      this._container.addChild(lockBody);
      // Lock shackle (arc top)
      const shackle = new Graphics();
      shackle.arc(sprCX, sprCY - 4, 8, Math.PI, 0);
      shackle.stroke({ color: 0x334455, width: 4 });
      this._container.addChild(shackle);

      const qTxt = new Text({
        text: '???',
        style: { fontSize: 17, fontWeight: '900', fill: 0x334455 },
      });
      qTxt.anchor.set(0, 0);
      qTxt.x = textX; qTxt.y = ey + 12;
      this._container.addChild(qTxt);

      // "? HP" badge — same layout as revealed HP badge but greyed out
      const hpBadge = new Graphics();
      hpBadge.roundRect(textX, ey + 36, 70, 26, 13);
      hpBadge.fill({ color: 0x1e2d3e, alpha: 1 });
      this._container.addChild(hpBadge);

      const hpTxt = new Text({
        text: '? HP',
        style: { fontSize: 13, fontWeight: 'bold', fill: 0x44596e },
      });
      hpTxt.anchor.set(0, 0.5);
      hpTxt.x = textX + 10; hpTxt.y = ey + 36 + 13;
      this._container.addChild(hpTxt);
    }
  }
}
