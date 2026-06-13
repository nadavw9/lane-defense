// ShopScreen — booster purchase screen accessible from Level Select.
//
// Shows four booster rows plus a daily-gift banner that fills the lower third.
// Coin balance and booster counts update immediately on purchase.
import { Container, Graphics, Text } from 'pixi.js';

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

    // Full-screen background
    const bg = new Graphics();
    bg.rect(0, 0, w, h);
    bg.fill(0x060610);
    bg.eventMode = 'static';
    this._container.addChild(bg);

    // ── Header ─────────────────────────────────────────────────────────────
    const backBtn = new Text({
      text: '← BACK',
      style: { fontSize: 16, fontWeight: 'bold', fill: 0x44aaff },
    });
    backBtn.anchor.set(0, 0.5);
    backBtn.x = 14;
    backBtn.y = 34;
    backBtn.eventMode = 'static';
    backBtn.cursor    = 'pointer';
    backBtn.on('pointerdown', () => { this._audio?.play('button_tap'); this._onBack(); });
    this._container.addChild(backBtn);

    const title = new Text({
      text: 'BOOSTER SHOP',
      style: { fontSize: 24, fontWeight: 'bold', fill: 0xffffff },
    });
    title.anchor.set(0.5, 0.5);
    title.x = w / 2;
    title.y = 34;
    this._container.addChild(title);

    const coinsTxt = new Text({
      text: `◆ ${p.coins}`,
      style: { fontSize: 18, fontWeight: 'bold', fill: 0xf5c842 },
    });
    coinsTxt.anchor.set(1, 0.5);
    coinsTxt.x = w - 14;
    coinsTxt.y = 34;
    this._container.addChild(coinsTxt);

    const sep = new Graphics();
    sep.rect(0, 58, w, 1.5);
    sep.fill({ color: 0x224466, alpha: 0.7 });
    this._container.addChild(sep);

    // ── Booster cards ──────────────────────────────────────────────────────
    const boosters  = p.getBoosters();
    const CARD_PAD  = 12;
    const CARD_H    = 118;
    const CARD_GAP  = 10;
    let   cardY     = 72;

    for (const def of BOOSTER_DEFS) {
      this._buildCard(def, boosters, cardY, CARD_PAD, CARD_H, w);
      cardY += CARD_H + CARD_GAP;
    }

    // ── Daily Gift banner — fills the empty lower area ──────────────────────
    const bannerY = cardY + 8;
    const bannerH = h - bannerY - 16;
    if (bannerH >= 72) {
      this._buildDailyBanner(CARD_PAD, bannerY, w - CARD_PAD * 2, bannerH);
    }
  }

  _buildCard(def, boosters, cardY, PAD, CARD_H, w) {
    const p        = this._progress;
    const CARD_W   = w - PAD * 2;
    const canAfford = p.coins >= def.cost;

    // Card background — unified dark navy for all cards
    const card = new Graphics();
    card.roundRect(PAD, cardY, CARD_W, CARD_H, CARD_RADIUS);
    card.fill(CARD_BG);
    card.roundRect(PAD, cardY, CARD_W, CARD_H, CARD_RADIUS);
    card.stroke({ color: def.border, width: 1.5, alpha: 0.75 });
    this._container.addChild(card);

    // Left accent strip using border color
    const accentBar = new Graphics();
    accentBar.roundRect(PAD, cardY, 4, CARD_H, CARD_RADIUS);
    accentBar.fill({ color: def.border, alpha: 0.9 });
    this._container.addChild(accentBar);

    // Booster label
    const label = new Text({
      text: def.label,
      style: { fontSize: 19, fontWeight: 'bold', fill: 0xffffff },
    });
    label.anchor.set(0, 0.5);
    label.x = PAD + 18;
    label.y = cardY + 28;
    this._container.addChild(label);

    // Description
    const desc = new Text({
      text: def.desc,
      style: { fontSize: 13, fill: 0x99bbcc, fontWeight: 'normal' },
    });
    desc.anchor.set(0, 0.5);
    desc.x = PAD + 18;
    desc.y = cardY + 72;
    desc.alpha = 0.90;
    this._container.addChild(desc);

    // Owned count badge
    const countKey = def.key;
    const ownedCt  = countKey === 'shield'
      ? (p.streakShields ?? 0)
      : countKey === 'colorChange'
      ? (this._boosterState?.colorChange ?? 0)
      : (boosters[countKey] ?? 0);
    const countTxt = new Text({
      text: `×${ownedCt} owned`,
      style: { fontSize: 13, fontWeight: 'bold', fill: 0x99bbcc },
    });
    countTxt.anchor.set(1, 0.5);
    countTxt.x = PAD + CARD_W - 104;
    countTxt.y = cardY + 20;
    this._container.addChild(countTxt);

    // BUY button — vivid colored background + white text
    const BTN_W = 90, BTN_H = 40;
    const btnX  = PAD + CARD_W - BTN_W - 10;
    const btnY  = cardY + (CARD_H - BTN_H) / 2;

    const btn = new Graphics();
    btn.roundRect(btnX, btnY, BTN_W, BTN_H, 10);
    btn.fill(canAfford ? def.btnBg : 0x1a1a2a);
    btn.roundRect(btnX, btnY, BTN_W, BTN_H, 10);
    btn.stroke({ color: canAfford ? 0xffffff : 0x333355, width: 1.5, alpha: canAfford ? 0.35 : 0.20 });
    this._container.addChild(btn);

    const btnLabelTxt = new Text({
      text: `◆ ${def.cost}`,
      style: {
        fontSize: 16,
        fontWeight: 'bold',
        fill: canAfford ? 0xffffff : 0x555577,
      },
    });
    btnLabelTxt.anchor.set(0.5, 0.5);
    btnLabelTxt.x = btnX + BTN_W / 2;
    btnLabelTxt.y = btnY + BTN_H / 2;
    this._container.addChild(btnLabelTxt);

    if (canAfford) {
      btn.eventMode = 'static';
      btn.cursor    = 'pointer';
      btn.on('pointerdown', () => this._purchase(def));
      btn.on('pointerover',  () => { btn.alpha = 0.80; });
      btn.on('pointerout',   () => { btn.alpha = 1.00; });
    }
  }

  _buildDailyBanner(x, y, w, h) {
    const banner = new Graphics();
    banner.roundRect(x, y, w, h, CARD_RADIUS);
    banner.fill(0x0d1a10);
    banner.roundRect(x, y, w, h, CARD_RADIUS);
    banner.stroke({ color: 0x336622, width: 1.5, alpha: 0.7 });
    this._container.addChild(banner);

    const accentBar = new Graphics();
    accentBar.roundRect(x, y, 4, h, CARD_RADIUS);
    accentBar.fill({ color: 0x44aa44, alpha: 0.9 });
    this._container.addChild(accentBar);

    const headline = new Text({
      text: '🎁  DAILY GIFT',
      style: { fontSize: 17, fontWeight: 'bold', fill: 0x66dd66 },
    });
    headline.anchor.set(0.5, 0.5);
    headline.x = x + w / 2;
    headline.y = y + h / 2 - 12;
    this._container.addChild(headline);

    const sub = new Text({
      text: 'Free coins every day — come back tomorrow!',
      style: { fontSize: 12, fill: 0x99bbaa },
    });
    sub.anchor.set(0.5, 0.5);
    sub.x = x + w / 2;
    sub.y = y + h / 2 + 14;
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
