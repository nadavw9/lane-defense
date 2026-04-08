// ShopScreen — booster purchase screen accessible from Level Select.
//
// Shows three booster rows:
//   Swap   — 20 coins, +1 charge; swap two shooter column colors
//   Peek   — 20 coins, +1 charge; reveal upcoming shooter colors
//   Freeze — 30 coins, +1 charge; freeze all cars for 10 seconds
//
// Coin balance and booster counts update immediately on purchase.
// Buying deducts coins via ProgressManager.spendCoins() and increments
// booster counts via ProgressManager.setBoosters().
// If boosterState is provided, in-memory counts are also updated so a
// mid-session purchase takes effect without restarting.
import { Container, Graphics, Text } from 'pixi.js';

const BOOSTER_DEFS = [
  {
    key:      'swap',
    label:    'SWAP',
    desc:     'Swap two shooter\ncolumn colors',
    cost:     20,
    bg:       0x0a1a30,
    border:   0x2255aa,
    btnColor: 0x1a3a6a,
    btnLabel: 0x66aaff,
  },
  {
    key:      'peek',
    label:    'PEEK',
    desc:     'Reveal next 3\nincoming car colors',
    cost:     20,
    bg:       0x0a200a,
    border:   0x225522,
    btnColor: 0x1a4a1a,
    btnLabel: 0x66ff88,
  },
  {
    key:      'freeze',
    label:    'FREEZE',
    desc:     'Freeze all cars\nfor 10 seconds',
    cost:     30,
    bg:       0x001a2a,
    border:   0x004466,
    btnColor: 0x002a44,
    btnLabel: 0x44ccff,
  },
];

export class ShopScreen {
  // progress     — ProgressManager (reads coins/boosters, persists changes)
  // boosterState — BoosterState instance for in-memory sync (may be null)
  // callbacks    — { onBack, onPurchase }
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

  // ── Private ────────────────────────────────────────────────────────────────

  // Tear down and rebuild in-place (used after every purchase to refresh counts).
  _rebuild() {
    this._container.destroy({ children: true });
    this._container = new Container();
    this._stage.addChild(this._container);
    this._build();
  }

  _build() {
    const w = this._appW;
    const p = this._progress;

    // Full-screen background
    const bg = new Graphics();
    bg.rect(0, 0, w, this._appH);
    bg.fill(0x060610);
    bg.eventMode = 'static';
    this._container.addChild(bg);

    // ── Header ─────────────────────────────────────────────────────────────
    const backBtn = new Text({
      text: '← BACK',
      style: { fontSize: 15, fontWeight: 'bold', fill: 0x44aaff },
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

    // Coin balance (top-right)
    const coinsTxt = new Text({
      text: `◆ ${p.coins}`,
      style: { fontSize: 17, fontWeight: 'bold', fill: 0xf5c842 },
    });
    coinsTxt.anchor.set(1, 0.5);
    coinsTxt.x = w - 14;
    coinsTxt.y = 34;
    this._container.addChild(coinsTxt);

    // Separator
    const sep = new Graphics();
    sep.rect(0, 58, w, 1);
    sep.fill({ color: 0x224466, alpha: 0.5 });
    this._container.addChild(sep);

    // ── Booster cards ──────────────────────────────────────────────────────
    const boosters = p.getBoosters();
    const CARD_PAD = 12;
    const CARD_H   = 120;
    let   cardY    = 74;

    for (const def of BOOSTER_DEFS) {
      this._buildCard(def, boosters, cardY, CARD_PAD, CARD_H, w);
      cardY += CARD_H + 10;
    }
  }

  _buildCard(def, boosters, cardY, PAD, CARD_H, w) {
    const p        = this._progress;
    const CARD_W   = w - PAD * 2;
    const canAfford = p.coins >= def.cost;
    const enabled  = !def.reserved && canAfford;

    // Card background
    const card = new Graphics();
    card.roundRect(PAD, cardY, CARD_W, CARD_H, 12);
    card.fill(def.bg);
    card.roundRect(PAD, cardY, CARD_W, CARD_H, 12);
    card.stroke({ color: def.border, width: 1.5, alpha: def.reserved ? 0.25 : 0.7 });
    this._container.addChild(card);

    // Booster label
    const labelAlpha = def.reserved ? 0.40 : 1.0;
    const label = new Text({
      text: def.label,
      style: { fontSize: 20, fontWeight: 'bold', fill: 0xffffff, alpha: labelAlpha },
    });
    label.anchor.set(0, 0.5);
    label.x = PAD + 14;
    label.y = cardY + 28;
    label.alpha = labelAlpha;
    this._container.addChild(label);

    // Description
    const desc = new Text({
      text: def.desc,
      style: { fontSize: 13, fill: 0x88aabb, fontWeight: 'normal' },
    });
    desc.anchor.set(0, 0.5);
    desc.x = PAD + 14;
    desc.y = cardY + 72;
    desc.alpha = def.reserved ? 0.35 : 0.85;
    this._container.addChild(desc);

    // Count badge (e.g. "×3 owned")
    const countKey  = def.key;
    const ownedCt   = boosters[countKey] ?? 0;
    const countTxt  = new Text({
      text: countKey ? `×${ownedCt} owned` : '—',
      style: { fontSize: 14, fontWeight: 'bold', fill: 0xaaccee },
    });
    countTxt.anchor.set(1, 0);
    countTxt.x = PAD + CARD_W - 100;
    countTxt.y = cardY + 14;
    countTxt.alpha = def.reserved ? 0.30 : 1.0;
    this._container.addChild(countTxt);

    // BUY button
    const BTN_W = 86, BTN_H = 40;
    const btnX  = PAD + CARD_W - BTN_W - 10;
    const btnY  = cardY + (CARD_H - BTN_H) / 2;

    const btn = new Graphics();
    btn.roundRect(btnX, btnY, BTN_W, BTN_H, 10);
    btn.fill(enabled ? def.btnColor : 0x1a1a1a);
    btn.roundRect(btnX, btnY, BTN_W, BTN_H, 10);
    btn.stroke({ color: enabled ? def.btnLabel : 0x333333, width: 1.5, alpha: enabled ? 0.8 : 0.3 });
    this._container.addChild(btn);

    const btnLabelTxt = new Text({
      text: `◆ ${def.cost}`,
      style: { fontSize: 15, fontWeight: 'bold', fill: enabled ? def.btnLabel : 0x555555 },
    });
    btnLabelTxt.anchor.set(0.5, 0.5);
    btnLabelTxt.x = btnX + BTN_W / 2;
    btnLabelTxt.y = btnY + BTN_H / 2;
    this._container.addChild(btnLabelTxt);

    if (enabled) {
      btn.eventMode = 'static';
      btn.cursor    = 'pointer';
      btn.on('pointerdown', () => this._purchase(def));
      btn.on('pointerover',  () => { btn.alpha = 0.75; });
      btn.on('pointerout',   () => { btn.alpha = 1.00; });
    }
  }

  _purchase(def) {
    const p = this._progress;
    if (!p.spendCoins(def.cost)) { this._audio?.play('button_tap'); return; }
    this._audio?.play('coin_collect');

    // Increment the booster count in progress.
    const saved = p.getBoosters();
    if (def.key === 'swap') {
      p.setBoosters(saved.swap + 1, saved.peek, saved.freeze);
      if (this._boosterState) this._boosterState.swap = saved.swap + 1;
    } else if (def.key === 'peek') {
      p.setBoosters(saved.swap, saved.peek + 1, saved.freeze);
      if (this._boosterState) this._boosterState.peek = saved.peek + 1;
    } else if (def.key === 'freeze') {
      p.setBoosters(saved.swap, saved.peek, saved.freeze + 1);
      if (this._boosterState) this._boosterState.freeze = saved.freeze + 1;
    }

    // Track cumulative purchases for Shopkeeper achievement.
    p.incrementBoostersPurchased();
    this._onPurchase?.();

    // Rebuild UI to reflect new coin balance and counts.
    this._rebuild();
  }
}
