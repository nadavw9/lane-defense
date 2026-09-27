// ShopScreen — booster purchase screen accessible from Level Select.
//
// Shows four booster rows plus a daily-gift banner that fills the lower third.
// Coin balance and booster counts update immediately on purchase.
import { Container, Graphics, Text, FillGradient } from 'pixi.js';
import { uiIcon, boosterIcon } from '../renderer/UIIcon.js';
import { ribbon, roundButton, button, bodyText, titleText, well, GOLD_DEEP } from '../renderer/PremiumUI.js';
import { INK } from '../renderer/ToyStyle.js';

// Unified card background — all cards share one dark navy base.
const CARD_BG     = 0x0d1525;
const CARD_RADIUS = 12;

const BOOSTER_DEFS = [
  {
    key:       'colorChange',
    label:     'COLOR CHANGE',
    icon:      '🎨',
    desc:      'Recolor every car\nof one color',
    cost:      20,
    border:    0x9a55ee,
    btnBg:     0x7a44cc,
  },
  {
    key:       'freeze',
    label:     'FREEZE',
    icon:      '❄',
    desc:      'One free shot —\nno cars advance',
    cost:      30,
    border:    0x0088bb,
    btnBg:     0x0077aa,
  },
  {
    key:       'shield',
    label:     'STREAK SHIELD',
    icon:      '🛡',
    desc:      'Protect your streak\nif you miss a day',
    cost:      30,
    border:    0xaa7700,
    btnBg:     0x8855aa,
  },
];

export class ShopScreen {
  constructor(stage, appW, appH, progress, boosterState, { onBack, onPurchase, audio }) {
    this._stage        = stage;
    this._appW         = appW;
    this._appH         = appH;
    this._progress     = progress;
    this._boosterState = boosterState;
    this._onBack       = onBack;
    this._onPurchase   = onPurchase ?? null;
    this._audio        = audio;
    this._container    = new Container();
    stage.addChild(this._container);
    this._build();
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  _rebuild() {
    this._container.destroy({ children: true });
    this._container = new Container();
    this._stage.addChild(this._container);
    this._build();
  }

  _build() {
    const w = this._appW;
    const h = this._appH;
    const p = this._progress;

    const bg = new Graphics();
    bg.rect(0, 0, w, h).fill(new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
      colorStops: [{ offset: 0, color: 0x3A2F7A }, { offset: 1, color: 0x17143A }] }));
    bg.eventMode = 'static';
    this._container.addChild(bg);

    // ── Header: ribbon, back, coin balance ─────────────────────────────────
    const rb = ribbon('SHOP', 170, { size: 28 });
    rb.x = w / 2; rb.y = 38;
    this._container.addChild(rb);
    const back = roundButton(uiIcon('back', 22, '←'), { r: 22, color: 0x2F7FE0, onTap: () => { this._audio?.play('button_tap'); this._onBack(); } });
    back.x = 32; back.y = 38;
    this._container.addChild(back);
    const pill = new Graphics();
    pill.roundRect(w - 96, 22, 84, 32, 16).fill(0x14112F).stroke({ color: GOLD_DEEP, width: 2.5 });
    this._container.addChild(pill);
    const coin = uiIcon('coin', 26, '◆'); coin.x = w - 92 + 13; coin.y = 38;
    this._container.addChild(coin);
    const coinsTxt = bodyText(String(p.coins), 17, 0xFFE08A);
    coinsTxt.anchor.set(1, 0.5); coinsTxt.x = w - 22; coinsTxt.y = 38;
    this._container.addChild(coinsTxt);

    // ── Booster cards ──────────────────────────────────────────────────────
    const boosters  = p.getBoosters();
    const CARD_PAD  = 16;
    const CARD_H    = 116;
    const CARD_GAP  = 14;
    let   cardY     = 92;
    for (const def of BOOSTER_DEFS) {
      this._buildCard(def, boosters, cardY, CARD_PAD, CARD_H, w);
      cardY += CARD_H + CARD_GAP;
    }

    const bannerY = cardY + 6;
    const bannerH = Math.min(120, h - bannerY - 20);
    if (bannerH >= 72) this._buildDailyBanner(CARD_PAD, bannerY, w - CARD_PAD * 2, bannerH);
  }

  _buildCard(def, boosters, cardY, PAD, CARD_H, w) {
    const p        = this._progress;
    const CARD_W   = w - PAD * 2;
    const canAfford = p.coins >= def.cost;

    const card = new Graphics();
    card.roundRect(PAD + 2, cardY + 6, CARD_W, CARD_H, 18).fill({ color: 0x000000, alpha: 0.3 });
    card.roundRect(PAD, cardY, CARD_W, CARD_H, 18).fill(new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
      colorStops: [{ offset: 0, color: 0x3A3580 }, { offset: 1, color: 0x221F58 }] }));
    card.roundRect(PAD, cardY, CARD_W, CARD_H, 18).stroke({ color: GOLD_DEEP, width: 2.5 });
    card.roundRect(PAD + 3, cardY + 3, CARD_W - 6, CARD_H - 6, 15).stroke({ color: 0xffffff, width: 1, alpha: 0.12 });
    this._container.addChild(card);

    // Icon in a well on the left.
    const wl = well(84, 84, { r: 18 });
    wl.x = PAD + 14; wl.y = cardY + (CARD_H - 84) / 2;
    this._container.addChild(wl);
    const ic = def.key === 'shield' ? uiIcon('shield', 56, '🛡') : boosterIcon(def.key === 'colorChange' ? 'colorchange' : def.key, 58, def.icon);
    ic.x = PAD + 14 + 42; ic.y = cardY + CARD_H / 2;
    this._container.addChild(ic);

    const label = titleText(def.label, 20);
    label.anchor.set(0, 0.5);
    label.x = PAD + 112; label.y = cardY + 30;
    this._container.addChild(label);
    const desc = bodyText(def.desc.replace('\n', ' '), 13, 0xC9C3F0, { outline: false, align: 'left', wrap: 130, weight: '600' });
    desc.anchor.set(0, 0.5);
    desc.x = PAD + 112; desc.y = cardY + 70;
    this._container.addChild(desc);

    const countKey = def.key;
    const ownedCt  = countKey === 'shield'
      ? (p.streakShields ?? 0)
      : countKey === 'colorChange'
      ? (this._boosterState?.colorChange ?? 0)
      : (boosters[countKey] ?? 0);
    const chip = new Graphics();
    chip.roundRect(PAD + 70, cardY + 8, 32, 22, 11).fill(0xE8453C).stroke({ color: INK, width: 2 });
    this._container.addChild(chip);
    const ct = bodyText(String(ownedCt), 13, 0xffffff);
    ct.x = PAD + 86; ct.y = cardY + 19;
    this._container.addChild(ct);

    // BUY: gold button with the coin cost. Always tappable — can't-afford shakes.
    const btnX = PAD + CARD_W - 60, btnY = cardY + CARD_H / 2;
    const btn = button(String(def.cost), { variant: canAfford ? 'gold' : 'dark', w: 96, h: 50, size: 22,
      icon: uiIcon('coin', 22, '◆'),
      onTap: () => {
        if (canAfford) this._purchase(def);
        else { this._audio?.play('button_tap'); this._shake([btn], btn.x); this._toast('Not enough coins!'); }
      } });
    btn.x = btnX; btn.y = btnY;
    this._container.addChild(btn);
  }

  // Horizontal shake for rejected purchases (denied feedback).
  _shake(objs, baseX) {
    let n = 0;
    const id = setInterval(() => {
      const dx = (n % 2 === 0 ? 4 : -4) * (1 - n / 6);
      for (const o of objs) o.x = (o._shakeBaseX ?? (o._shakeBaseX = o.x)) + dx;
      if (++n >= 6) {
        clearInterval(id);
        for (const o of objs) { o.x = o._shakeBaseX; delete o._shakeBaseX; }
      }
    }, 40);
  }

  // Small transient toast above the booster cards.
  _toast(msg) {
    if (this._toastTxt) { this._toastTxt.destroy(); this._toastTxt = null; }
    const t = new Text({
      text: msg,
      style: { fontSize: 15, fontWeight: 'bold', fill: 0xff6666,
        dropShadow: { color: 0x000000, blur: 4, distance: 0, alpha: 0.9 } },
    });
    t.anchor.set(0.5, 0.5);
    t.x = this._appW / 2; t.y = 80;
    this._container.addChild(t);
    this._toastTxt = t;
    setTimeout(() => { if (this._toastTxt === t) { t.destroy(); this._toastTxt = null; } }, 1400);
  }

  _buildDailyBanner(x, y, w, h) {
    const banner = new Graphics();
    banner.roundRect(x + 2, y + 6, w, h, 18).fill({ color: 0x000000, alpha: 0.3 });
    banner.roundRect(x, y, w, h, 18).fill(new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
      colorStops: [{ offset: 0, color: 0x3FAE4A }, { offset: 1, color: 0x237A33 }] }));
    banner.roundRect(x, y, w, h, 18).stroke({ color: INK, width: 3 });
    banner.roundRect(x + 8, y + 6, w - 16, h * 0.28, 10).fill({ color: 0xffffff, alpha: 0.18 });
    this._container.addChild(banner);
    const gift = uiIcon('gift', 64, '🎁');
    gift.x = x + 52; gift.y = y + h / 2;
    this._container.addChild(gift);
    const hl = titleText('DAILY GIFT', 24);
    hl.anchor.set(0, 0.5); hl.x = x + 96; hl.y = y + h / 2 - 14;
    this._container.addChild(hl);
    const sub = bodyText('Free coins every day!', 14, 0xEFFFE8, { outline: false, weight: '600' });
    sub.anchor.set(0, 0.5); sub.x = x + 96; sub.y = y + h / 2 + 16;
    this._container.addChild(sub);
  }

  _purchase(def) {
    const p = this._progress;
    if (!p.spendCoins(def.cost)) { this._audio?.play('button_tap'); return; }
    this._audio?.play('coin_collect');

    const saved = p.getBoosters();
    if (def.key === 'colorChange') {
      // Boosters reset to 0 each level, so the live BoosterState is the meaningful
      // target (there is no persisted colorChange slot — and none is needed).
      if (this._boosterState) this._boosterState.colorChange = (this._boosterState.colorChange ?? 0) + 1;
    } else if (def.key === 'freeze') {
      p.setBoosters(0, saved.freeze + 1);   // swap is retired — no longer preserved
      if (this._boosterState) this._boosterState.freeze = saved.freeze + 1;
    } else if (def.key === 'shield') {
      p.addStreakShield(1);
    }

    p.incrementBoostersPurchased();
    this._onPurchase?.();

    this._rebuild();
  }
}
