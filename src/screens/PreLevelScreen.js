// PreLevelScreen — the level card shown between the map tap and the level
// (premium pass, 2026-09-28). Replaces the old "POWER UP? watch 1/2/3 ads" gate:
// the card's job is to tell the player what this level IS — its name, its goals,
// and anything new (a special car, a boss) — with one big PLAY button. Boosters
// are an optional side offer: one rewarded ad starts the level with that booster.
//
// §3d DDA mercy: when the caller passes `freeBooster` (fail streak ≥ 2) that
// booster is marked FREE — no ad — and PLAY includes it. It never mentions the
// player's losses; it reads as a gift.
//
// Decoupled from AdManager: onSelect(adCount, bundle) reports the choice; the
// caller runs the ad(s) and starts the level with the bundle.
import { Container, Graphics, Sprite, Assets } from 'pixi.js';
import { boosterIcon, uiIcon } from '../renderer/UIIcon.js';
import { panel, ribbon, button, roundButton, bodyText, titleText, backdrop, well, GOLD } from '../renderer/PremiumUI.js';
import { INK, WHITE } from '../renderer/ToyStyle.js';

const _B = import.meta.env.BASE_URL;
const BOOSTERS = [
  { key: 'colorchange', label: 'Recolor', bundle: { colorChange: 1, freeze: 0, bombs: 0 } },
  { key: 'freeze',      label: 'Freeze',  bundle: { colorChange: 0, freeze: 1, bombs: 0 } },
  { key: 'bomb',        label: 'Bomb',    bundle: { colorChange: 0, freeze: 0, bombs: 1 } },
];

function spriteFit(path, size) {
  const tex = Assets.get(`${_B}${path}`);
  if (!tex) return null;
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  s.scale.set(size / Math.max(tex.width, tex.height));
  return s;
}

function goalIcon(goal) {
  if (goal.type === 'destroyColor') return spriteFit(`sprites/designed/car-${goal.color.toLowerCase()}-processed.png`, 44);
  if (goal.type === 'defeatBoss')   return spriteFit('sprites/designed/boss.png', 48);
  if (goal.type === 'destroyType') {
    const f = { small: 'bike', big: 'car', jeep: 'van', truck: 'truck', bigrig: 'bigrig', tank: 'tank' }[goal.carType] ?? 'car';
    return spriteFit(`sprites/designed/${f}-red${f === 'car' ? '-processed' : ''}.png`, 44);
  }
  return uiIcon('explosion', 40, '💥');
}

export class PreLevelScreen {
  // opts: { onSelect(adCount, bundle), onClose, audio, freeBooster, level }
  //   level = { id, name, goals, hintText } (the level config)
  constructor(stage, appW, appH, levelLabel, { onSelect, onClose = null, audio, freeBooster = null, level = null }) {
    this._container = new Container();
    stage.addChild(this._container);
    this._onSelect = onSelect;
    this._onClose = onClose;
    this._audio = audio;
    this._free = freeBooster;
    this._level = level;
    this._done = false;
    this._t = 0;
    this._play = null;
    this._card = null;
    this._build(appW, appH, levelLabel);
  }

  destroy() { this._container.destroy({ children: true }); }

  update(dt = 1 / 60) {
    this._t += dt;
    if (this._card && this._t < 0.35) {             // pop-in
      const p = this._t / 0.35;
      const e = 1 + 0.12 * Math.sin(Math.PI * p) * (1 - p);
      this._card.scale.set(Math.min(1, 0.7 + 0.3 * p) * e);
      this._card.alpha = Math.min(1, p * 2);
    } else if (this._card) { this._card.scale.set(1); this._card.alpha = 1; }
    if (this._play) this._play.scale.set(1 + 0.035 * Math.sin(this._t * 4.2));
  }

  _choose(adCount, bundle) {
    if (this._done) return;
    this._done = true;
    this._audio?.play('button_tap');
    this._onSelect?.(adCount, bundle);
  }

  _build(w, h, levelLabel) {
    this._container.addChild(backdrop(w, h));
    const lv = this._level ?? {};
    const goals = lv.goals ?? [];
    const intro = (lv.hintText && /^(NEW!|BOSS!|FINAL BOSS!)/.test(lv.hintText)) ? lv.hintText : null;

    const PW = 344, PH = 470 + (intro ? 74 : 0);
    const card = new Container();
    card.x = w / 2; card.y = h / 2 + 10;
    card.pivot.set(PW / 2, PH / 2);
    this._container.addChild(card);
    this._card = card;
    card.addChild(panel(PW, PH));

    const rb = ribbon(levelLabel ?? 'LEVEL', 250);
    rb.x = PW / 2; rb.y = 2;
    card.addChild(rb);

    let y = 58;
    if (lv.name) {
      const nm = bodyText(lv.name, 22, GOLD);
      nm.x = PW / 2; nm.y = y;
      card.addChild(nm);
    }
    y += 34;

    // Goals.
    const gl = bodyText(goals.length && goals[0].type === 'defeatBoss' ? 'DEFEAT' : 'GOALS', 15, 0xC9C3F0, { outline: false });
    gl.x = PW / 2; gl.y = y;
    card.addChild(gl);
    y += 18;
    const gw = 92, gh = 92, gap = 12;
    const total = goals.length * gw + (goals.length - 1) * gap;
    goals.forEach((g, i) => {
      const gx = (PW - total) / 2 + i * (gw + gap);
      const bg = well(gw, gh);
      bg.x = gx; bg.y = y;
      card.addChild(bg);
      const ic = goalIcon(g);
      if (ic) { ic.x = gx + gw / 2; ic.y = y + 38; card.addChild(ic); }
      const n = titleText(String(g.count), 24);
      n.x = gx + gw / 2; n.y = y + gh - 16;
      card.addChild(n);
    });
    y += gh + 18;

    // New this level.
    if (intro) {
      const iw = PW - 48;
      const box = new Graphics();
      box.roundRect(24, y, iw, 60, 14).fill({ color: 0xFFC93C, alpha: 0.16 }).stroke({ color: GOLD, width: 2 });
      card.addChild(box);
      const txt = intro.replace(/^(NEW!|BOSS!|FINAL BOSS!)\s*/, '');
      const tag = intro.match(/^(NEW!|BOSS!|FINAL BOSS!)/)[1];
      const tg = titleText(tag, 18, GOLD);
      tg.x = 24 + 14 + tg.width / 2; tg.y = y + 30;
      card.addChild(tg);
      const t = bodyText(txt, 14, WHITE, { outline: false, align: 'left', wrap: iw - tg.width - 40 });
      t.anchor.set(0, 0.5);
      t.x = 24 + 28 + tg.width; t.y = y + 30;
      card.addChild(t);
      y += 74;
    }

    // Booster offer.
    const bl = bodyText('START WITH A BOOSTER', 14, 0xC9C3F0, { outline: false });
    bl.x = PW / 2; bl.y = y;
    card.addChild(bl);
    y += 16;
    const bw = 90, bh = 104, bgap = 12;
    const bt = BOOSTERS.length * bw + (BOOSTERS.length - 1) * bgap;
    BOOSTERS.forEach((b, i) => {
      const bx = (PW - bt) / 2 + i * (bw + bgap);
      const isFree = this._free?.key === b.key;
      const tile = new Container();
      tile.x = bx + bw / 2; tile.y = y + bh / 2;
      const g = well(bw, bh);
      g.x = -bw / 2; g.y = -bh / 2;
      tile.addChild(g);
      const ic = boosterIcon(b.key, 50, '?');
      ic.y = -18;
      tile.addChild(ic);
      const chip = new Graphics();
      chip.roundRect(-36, 20, 72, 26, 13).fill(isFree ? 0x3DBB3A : 0x2F7FE0).stroke({ color: INK, width: 2.5 });
      tile.addChild(chip);
      if (isFree) {
        const ft = titleText('FREE', 16); ft.y = 33; tile.addChild(ft);
      } else {
        const play = uiIcon('play', 14, '▶'); play.x = -14; play.y = 33; tile.addChild(play);
        const at = titleText('AD', 16); at.x = 8; at.y = 33; tile.addChild(at);
      }
      tile.eventMode = 'static';
      tile.cursor = 'pointer';
      tile.on('pointerdown', () => tile.scale.set(0.94));
      tile.on('pointerupoutside', () => tile.scale.set(1));
      tile.on('pointerup', () => { tile.scale.set(1); this._choose(isFree ? 0 : 1, b.bundle); });
      card.addChild(tile);
    });
    y += bh + 30;

    // PLAY (includes the free gift when there is one).
    const playBundle = this._free?.bundle ?? { colorChange: 0, freeze: 0, bombs: 0 };
    const play = button('PLAY', { variant: 'green', w: 230, h: 70, size: 34, onTap: () => this._choose(0, playBundle) });
    play.x = PW / 2; play.y = PH - 58;
    card.addChild(play);
    this._play = play;

    if (this._onClose) {
      const close = roundButton(uiIcon('close', 22, '✕'), { r: 22, color: 0xE8453C, onTap: () => { if (!this._done) { this._done = true; this._onClose(); } } });
      close.x = PW - 14; close.y = 14;
      card.addChild(close);
    }
  }
}
