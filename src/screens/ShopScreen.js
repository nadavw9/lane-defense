// ShopScreen — boosters, a value pack, free coins for a video and the daily gift.
//
// Everything bought here lands in the persistent inventory (ProgressManager
// .addInventory), which GameApp carries into every level and debits only by
// what a level actually spends. Nothing here touches the live BoosterState.
//
// Layout (390 × 844 stage):
//   header (ribbon, back, coin pill)
//   BOOSTER PACK hero card — the value offer
//   2 × 2 booster tiles     — colour change, freeze, bomb, streak shield
//   FREE row                — rewarded-video coins, daily gift
import { Container, Graphics, FillGradient, Ticker } from 'pixi.js';
import { uiIcon, boosterIcon } from '../renderer/UIIcon.js';
import { roundButton, button, bodyText, titleText, ribbon, screenBg, GOLD_DEEP } from '../renderer/PremiumUI.js';
import { INK } from '../renderer/ToyStyle.js';
import { ProgressManager } from '../game/ProgressManager.js';
import { logEvent } from '../analytics/Analytics.js';

export const SHOP_ITEMS = [
  { key: 'colorChange', label: 'COLOR SWAP', desc: 'Recolor a whole colour', cost: 20, icon: 'colorchange', glow: 0xB070FF, face: [0x4A3A96, 0x2A2268] },
  { key: 'freeze',      label: 'FREEZE',     desc: 'Traffic skips a turn',   cost: 30, icon: 'freeze',      glow: 0x5CC8FF, face: [0x2F4E9A, 0x1B2B66] },
  { key: 'bombs',       label: 'BOMB',       desc: 'Clears a whole lane',    cost: 40, icon: 'bomb',        glow: 0xFF7A3C, face: [0x6A3480, 0x3A1C58] },
  { key: 'shield',      label: 'SHIELD',     desc: 'Saves a daily streak',   cost: 30, icon: null,          glow: 0xFFC93C, face: [0x5A4A2A, 0x33291A] },
];

// Value pack: two of each in-level booster.
export const SHOP_PACK = { each: 2, keys: ['colorChange', 'freeze', 'bombs'], cost: 140 };
const PACK_FULL = SHOP_PACK.keys.reduce((s, k) => s + SHOP_ITEMS.find(i => i.key === k).cost * SHOP_PACK.each, 0);

const grad = (stops) => new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
  colorStops: stops.map(([offset, color]) => ({ offset, color })) });

function itemIcon(item, size) {
  return item.icon ? boosterIcon(item.icon, size, '?') : uiIcon('shield', size * 0.8, '🛡');
}

export class ShopScreen {
  constructor(stage, appW, appH, progress, _boosterState, { onBack, onPurchase, onDaily, onWatchAd, audio }) {
    this._stage     = stage;
    this._appW      = appW;
    this._appH      = appH;
    this._progress  = progress;
    this._onBack    = onBack;
    this._onPurchase = onPurchase ?? null;
    this._onDaily   = onDaily ?? null;
    this._onWatchAd = onWatchAd ?? null;
    this._audio     = audio;
    this._t         = 0;
    this._pulses    = [];
    this._tick      = (tk) => this._update(tk.deltaMS / 1000);
    Ticker.shared.add(this._tick);
    this._container = new Container();
    stage.addChild(this._container);
    this._build();
  }

  destroy() {
    Ticker.shared.remove(this._tick);
    clearInterval(this._shakeId);
    clearTimeout(this._toastId);
    this._container.destroy({ children: true });
  }

  _rebuild() {
    this._container.destroy({ children: true });
    this._pulses = [];
    this._toastTxt = null;
    this._container = new Container();
    this._stage.addChild(this._container);
    this._build();
  }

  _update(dt) {
    this._t += dt;
    for (const p of this._pulses) {
      if (p.destroyed) continue;
      const s = 1 + Math.sin(this._t * p.speed) * p.amp;
      p.scale.set(s);
    }
    if (this._rays && !this._rays.destroyed) this._rays.rotation += dt * 0.25;
    if (this._dailyTimer && !this._dailyTimer.destroyed) {
      const ms = this._progress.dailyReadyIn();
      if (ms <= 0) { this._dailyTimer = null; this._rebuild(); return; }
      this._dailyTimer.text = fmtCountdown(ms);
    }
  }

  // ── Build ──────────────────────────────────────────────────────────────
  _build() {
    const w = this._appW;
    const c = this._container;
    const p = this._progress;
    const inv = p.getInventory();

    c.addChild(screenBg(w, this._appH));

    const rb = ribbon('SHOP', 170, { size: 28 });
    rb.x = w / 2; rb.y = 40;
    c.addChild(rb);
    const back = roundButton(uiIcon('back', 22, '←'), { r: 22, color: 0x2F7FE0, onTap: () => { this._audio?.play('button_tap'); this._onBack(); } });
    back.x = 32; back.y = 40;
    c.addChild(back);
    this._buildCoinPill(w - 58, 40, p.coins);

    const PAD = 16, GAP = 12;
    this._buildPack(PAD, 84, w - PAD * 2, 126, inv);

    const tileW = (w - PAD * 2 - GAP) / 2, tileH = 186;
    this._tiles = {};
    SHOP_ITEMS.forEach((item, i) => {
      const x = PAD + (i % 2) * (tileW + GAP);
      const y = 228 + Math.floor(i / 2) * (tileH + GAP);
      this._buildTile(item, x, y, tileW, tileH, item.key === 'shield' ? p.streakShields : (inv[item.key] ?? 0));
    });

    const freeY = 228 + 2 * (tileH + GAP) + 6;
    this._sectionLabel('FREE STUFF', w / 2, freeY + 8);
    const fy = freeY + 24, fh = 150;
    this._buildVideoCard(PAD, fy, tileW, fh);
    this._buildDailyCard(PAD + tileW + GAP, fy, tileW, fh);
  }

  _buildCoinPill(cx, cy, coins) {
    const g = new Graphics();
    g.roundRect(cx - 44, cy - 17, 88, 34, 17).fill(0x14112F).stroke({ color: GOLD_DEEP, width: 2.5 });
    g.roundRect(cx - 38, cy - 13, 76, 8, 4).fill({ color: 0xffffff, alpha: 0.08 });
    this._container.addChild(g);
    const coin = uiIcon('coin', 30, '◆'); coin.x = cx - 36; coin.y = cy;
    this._container.addChild(coin);
    const t = titleText(String(coins), 19, 0xFFE08A);
    t.anchor.set(1, 0.5); t.x = cx + 34; t.y = cy;
    this._container.addChild(t);
    this._coinPill = t;
  }

  _sectionLabel(str, cx, cy) {
    const t = titleText(str, 16, 0xFFE08A);
    t.anchor.set(0.5); t.x = cx; t.y = cy;
    const line = new Graphics();
    const half = t.width / 2 + 10;
    line.roundRect(cx - half - 90, cy - 1.5, 90, 3, 1.5).fill({ color: 0xFFE08A, alpha: 0.35 });
    line.roundRect(cx + half, cy - 1.5, 90, 3, 1.5).fill({ color: 0xFFE08A, alpha: 0.35 });
    this._container.addChild(line, t);
  }

  // Hero offer: gold card, rotating rays behind a fan of the three boosters.
  _buildPack(x, y, w, h, inv) {
    const c = this._container;
    const g = new Graphics();
    g.roundRect(x + 2, y + 6, w, h, 20).fill({ color: 0x000000, alpha: 0.32 });
    g.roundRect(x, y + 4, w, h - 2, 20).fill(0x9A5A10);
    g.roundRect(x, y, w, h - 4, 20).fill(grad([[0, 0xFFD865], [0.5, 0xFFB42E], [1, 0xE9851C]]));
    g.roundRect(x + 10, y + 6, w - 20, 26, 12).fill({ color: 0xffffff, alpha: 0.28 });
    g.roundRect(x, y, w, h, 20).stroke({ color: INK, width: 3.5 });
    c.addChild(g);

    // Icon stage on the left: a round well with slow rays.
    const icx = x + 72, icy = y + h / 2 + 2;
    const stageMask = new Graphics().circle(icx, icy, 50).fill(0xffffff);
    const well = new Graphics().circle(icx, icy, 50).fill(0xC0620E).circle(icx, icy, 50).stroke({ color: 0x8A430A, width: 2 });
    const rays = new Graphics();
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2, a1 = a0 + Math.PI / 12;
      rays.moveTo(0, 0).lineTo(Math.cos(a0) * 60, Math.sin(a0) * 60).lineTo(Math.cos(a1) * 60, Math.sin(a1) * 60).closePath();
    }
    rays.fill({ color: 0xFFE9A0, alpha: 0.45 });
    rays.x = icx; rays.y = icy; rays.mask = stageMask;
    this._rays = rays;
    c.addChild(well, stageMask, rays);
    const fan = [['colorchange', -30, 8, -0.28], ['freeze', 30, 8, 0.28], ['bomb', 0, -6, 0]];
    for (const [name, dx, dy, rot] of fan) {
      const ic = boosterIcon(name, name === 'bomb' ? 66 : 54, '?');
      ic.x = icx + dx; ic.y = icy + dy; ic.rotation = rot;
      c.addChild(ic);
    }

    // BEST VALUE tag hanging off the top edge.
    const tag = new Container();
    const tg = new Graphics();
    tg.roundRect(-52, -13, 104, 26, 13).fill(0xE8453C).stroke({ color: INK, width: 3 });
    tg.roundRect(-46, -10, 92, 8, 4).fill({ color: 0xffffff, alpha: 0.3 });
    tag.addChild(tg);
    const tt = titleText('BEST VALUE', 14); tt.anchor.set(0.5); tt.y = 1;
    tag.addChild(tt);
    tag.x = x + 72; tag.y = y - 2; tag.rotation = -0.06;
    c.addChild(tag);
    this._pulses.push(Object.assign(tag, { speed: 4, amp: 0.04 }));

    const tx = x + 142;
    const title = titleText('BOOSTER PACK', 22);
    title.anchor.set(0, 0.5); title.x = tx; title.y = y + 30;
    c.addChild(title);
    const sub = bodyText(`${SHOP_PACK.each}× Swap · Freeze · Bomb`, 13, 0x5A3000, { outline: false, weight: '800', align: 'left' });
    sub.anchor.set(0, 0.5); sub.x = tx; sub.y = y + 56;
    c.addChild(sub);

    // Old price, struck through, above the buy button.
    const old = bodyText(String(PACK_FULL), 20, 0xFFFFFF, { weight: '800' });
    old.anchor.set(0, 0.5); old.x = tx; old.y = y + 92;
    c.addChild(old);
    const strike = new Graphics();
    strike.moveTo(tx - 2, y + 95).lineTo(tx + old.width + 2, y + 89).stroke({ color: 0xE8231A, width: 4 });
    c.addChild(strike);
    const save = Math.round((1 - SHOP_PACK.cost / PACK_FULL) * 100);
    const burst = new Container();
    const bg = new Graphics();
    const pts = [];
    for (let i = 0; i < 24; i++) { const r = i % 2 ? 21 : 26, a = (i / 24) * Math.PI * 2; pts.push(Math.cos(a) * r, Math.sin(a) * r); }
    bg.poly(pts).fill(0xE8453C).stroke({ color: INK, width: 3 });
    bg.circle(0, -5, 11).fill({ color: 0xffffff, alpha: 0.18 });
    burst.addChild(bg);
    const saveTxt = titleText(`-${save}%`, 13); saveTxt.y = 1;
    burst.addChild(saveTxt);
    burst.x = x + w - 14; burst.y = y + 62; burst.rotation = 0.22;   // sticker on the buy button
    c.addChild(burst);
    this._pulses.push(Object.assign(burst, { speed: 3.2, amp: 0.05 }));

    const btn = this._priceButton(SHOP_PACK.cost, 118, 52, () => this._buyPack(btn));
    btn.x = x + w - 84; btn.y = y + 92;
    c.addChild(btn);
    c.addChild(burst);   // sticker sits on top of the button
  }

  _buildTile(item, x, y, w, h, owned) {
    const c = this._container;
    const g = new Graphics();
    g.roundRect(x + 2, y + 6, w, h, 20).fill({ color: 0x000000, alpha: 0.3 });
    g.roundRect(x, y, w, h, 20).fill(grad([[0, item.face[0]], [1, item.face[1]]]));
    g.roundRect(x + 3, y + 3, w - 6, h * 0.5, 17).fill({ color: 0xffffff, alpha: 0.06 });
    g.circle(x + w / 2, y + 56, 44).fill({ color: item.glow, alpha: 0.16 });
    g.circle(x + w / 2, y + 56, 30).fill({ color: item.glow, alpha: 0.18 });
    g.roundRect(x, y, w, h, 20).stroke({ color: GOLD_DEEP, width: 2.5 });
    g.roundRect(x + 3, y + 3, w - 6, h - 6, 17).stroke({ color: 0xffffff, width: 1, alpha: 0.12 });
    c.addChild(g);

    const holder = new Container();
    holder.x = x + w / 2; holder.y = y + 56;
    holder.addChild(itemIcon(item, 78));
    c.addChild(holder);

    if (owned > 0) {
      const chip = new Graphics();
      chip.roundRect(x + w - 50, y + 10, 40, 26, 13).fill(0x3DBB3A).stroke({ color: INK, width: 2.5 });
      chip.roundRect(x + w - 46, y + 13, 32, 7, 3.5).fill({ color: 0xffffff, alpha: 0.3 });
      c.addChild(chip);
      const ct = titleText(`×${owned}`, 15);
      ct.anchor.set(0.5); ct.x = x + w - 30; ct.y = y + 24;
      c.addChild(ct);
    }

    const name = titleText(item.label, 19);
    name.anchor.set(0.5); name.x = x + w / 2; name.y = y + 102;
    c.addChild(name);
    const desc = bodyText(item.desc, 13, 0xD6D0FF, { outline: false, weight: '700' });
    desc.anchor.set(0.5); desc.x = x + w / 2; desc.y = y + 123;
    c.addChild(desc);

    const btn = this._priceButton(item.cost, w - 30, 42, () => this._buy(item, btn));
    btn.x = x + w / 2; btn.y = y + h - 24;
    c.addChild(btn);
    this._tiles[item.key] = { holder, x: x + w / 2, y: y + 56 };
  }

  // Always gold: a price button that is grey looks broken, not expensive.
  _priceButton(cost, w, h, onTap) {
    return button(String(cost), { variant: 'gold', w, h, size: h >= 50 ? 24 : 21,
      icon: uiIcon('coin', h >= 50 ? 26 : 22, '◆'), onTap });
  }

  _buildVideoCard(x, y, w, h) {
    const c = this._container;
    const left = this._progress.videoCoinsLeft();
    const g = new Graphics();
    g.roundRect(x + 2, y + 6, w, h, 20).fill({ color: 0x000000, alpha: 0.3 });
    g.roundRect(x, y, w, h, 20).fill(grad(left > 0 ? [[0, 0x46B94E], [1, 0x1F7A33]] : [[0, 0x3A3662], [1, 0x24214A]]));
    g.roundRect(x + 8, y + 6, w - 16, 22, 11).fill({ color: 0xffffff, alpha: 0.18 });
    g.roundRect(x, y, w, h, 20).stroke({ color: INK, width: 3 });
    c.addChild(g);

    // Coin stack with a play badge.
    const coin = uiIcon('coin', 56, '◆'); coin.x = x + 46; coin.y = y + 50;
    c.addChild(coin);
    const badge = new Graphics();
    badge.circle(x + 66, y + 68, 15).fill(0xE8453C).stroke({ color: INK, width: 2.5 });
    badge.moveTo(x + 61, y + 60).lineTo(x + 74, y + 68).lineTo(x + 61, y + 76).closePath().fill(0xffffff);
    c.addChild(badge);
    const amt = titleText(`+${ProgressManager.VIDEO_COINS}`, 28, 0xFFE08A);
    amt.anchor.set(0, 0.5); amt.x = x + 88; amt.y = y + 50;
    c.addChild(amt);

    if (left > 0) {
      const btn = button('WATCH', { variant: 'blue', w: w - 30, h: 42, size: 20, onTap: () => this._watch() });
      btn.x = x + w / 2; btn.y = y + h - 44;
      c.addChild(btn);
      const note = bodyText(`${left} left today`, 13, 0xE6FFE0, { outline: false, weight: '700' });
      note.anchor.set(0.5); note.x = x + w / 2; note.y = y + h - 12;
      c.addChild(note);
    } else {
      const done = titleText('ALL WATCHED', 16, 0xC9C3F0);
      done.anchor.set(0.5); done.x = x + w / 2; done.y = y + h - 46;
      c.addChild(done);
      const note = bodyText('More tomorrow', 13, 0xA8A2D8, { outline: false, weight: '700' });
      note.anchor.set(0.5); note.x = x + w / 2; note.y = y + h - 22;
      c.addChild(note);
    }
  }

  _buildDailyCard(x, y, w, h) {
    const c = this._container;
    const ready = this._progress.canClaimDaily();
    const g = new Graphics();
    g.roundRect(x + 2, y + 6, w, h, 20).fill({ color: 0x000000, alpha: 0.3 });
    g.roundRect(x, y, w, h, 20).fill(grad(ready ? [[0, 0xB45CFF], [1, 0x6A2BB8]] : [[0, 0x3A3662], [1, 0x24214A]]));
    g.roundRect(x + 8, y + 6, w - 16, 22, 11).fill({ color: 0xffffff, alpha: 0.18 });
    g.roundRect(x, y, w, h, 20).stroke({ color: INK, width: 3 });
    c.addChild(g);

    const gift = new Container();
    gift.addChild(uiIcon('gift', 60, '🎁'));
    gift.x = x + 48; gift.y = y + 50;
    c.addChild(gift);
    const hl = titleText('DAILY\nGIFT', 18);
    hl.style.align = 'left'; hl.style.lineHeight = 20;
    hl.anchor.set(0, 0.5); hl.x = x + 86; hl.y = y + 50;
    c.addChild(hl);

    if (ready) {
      this._pulses.push(Object.assign(gift, { speed: 5, amp: 0.07 }));
      const btn = button('OPEN', { variant: 'gold', w: w - 30, h: 42, size: 20,
        onTap: () => { this._audio?.play('button_tap'); this._onDaily?.(); } });
      btn.x = x + w / 2; btn.y = y + h - 44;
      c.addChild(btn);
      const note = bodyText(`Day ${this._progress.dailyDay + 1} of 7`, 13, 0xF2E6FF, { outline: false, weight: '700' });
      note.anchor.set(0.5); note.x = x + w / 2; note.y = y + h - 12;
      c.addChild(note);
      // Whole card is a target too.
      g.eventMode = 'static'; g.cursor = 'pointer';
      g.on('pointertap', () => { this._audio?.play('button_tap'); this._onDaily?.(); });
    } else {
      const lbl = bodyText('NEXT GIFT IN', 13, 0xA8A2D8, { outline: false, weight: '800' });
      lbl.anchor.set(0.5); lbl.x = x + w / 2; lbl.y = y + h - 56;
      c.addChild(lbl);
      const tm = titleText(fmtCountdown(this._progress.dailyReadyIn()), 22, 0xFFE08A);
      tm.anchor.set(0.5); tm.x = x + w / 2; tm.y = y + h - 30;
      c.addChild(tm);
      this._dailyTimer = tm;
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────
  _buy(item, btn) {
    const p = this._progress;
    if (!p.spendCoins(item.cost)) return this._deny(btn);
    this._audio?.play('coin_collect');
    if (item.key === 'shield') p.addStreakShield(1);
    else p.addInventory(item.key, 1);
    p.incrementBoostersPurchased();
    logEvent('shop_purchase', { item: item.key, cost: item.cost });
    this._onPurchase?.();
    this._rebuild();
    this._celebrate([item.key], '+1');
  }

  _buyPack(btn) {
    const p = this._progress;
    if (!p.spendCoins(SHOP_PACK.cost)) return this._deny(btn);
    this._audio?.play('coin_collect');
    for (const k of SHOP_PACK.keys) p.addInventory(k, SHOP_PACK.each);
    p.incrementBoostersPurchased();
    logEvent('shop_purchase', { item: 'pack', cost: SHOP_PACK.cost });
    this._onPurchase?.();
    this._rebuild();
    this._celebrate(SHOP_PACK.keys, `+${SHOP_PACK.each}`);
  }

  _watch() {
    this._audio?.play('button_tap');
    if (!this._onWatchAd) return;
    this._onWatchAd(() => {
      const got = this._progress.claimVideoCoins();
      if (!got) return;
      this._audio?.play('coin_collect');
      if (this._container.destroyed) return;
      this._rebuild();
      this._floatText(`+${got}`, this._appW - 58, 72, 0xFFE08A);
    });
  }

  _deny(btn) {
    this._audio?.play('button_tap');
    this._shake(btn);
    this._toast('Not enough coins!\nWatch a video for free coins.', btn.y - 58);
  }

  // Pop the bought tiles' icons and float the gain above them.
  _celebrate(keys, label) {
    for (const k of keys) {
      const t = this._tiles[k];
      if (!t) continue;
      const start = this._t;
      const fn = () => {
        const e = this._t - start;
        if (t.holder.destroyed || e > 0.45) { t.holder.destroyed || t.holder.scale.set(1); Ticker.shared.remove(fn); return; }
        t.holder.scale.set(1 + Math.sin(Math.min(1, e / 0.45) * Math.PI) * 0.28);
      };
      Ticker.shared.add(fn);
      this._floatText(label, t.x, t.y - 30, 0xB6FF9A);
    }
  }

  _floatText(str, x, y, color) {
    const t = titleText(str, 26, color);
    t.anchor.set(0.5); t.x = x; t.y = y;
    this._container.addChild(t);
    const start = this._t;
    const fn = () => {
      const e = this._t - start;
      if (t.destroyed) { Ticker.shared.remove(fn); return; }
      t.y = y - e * 60; t.alpha = Math.max(0, 1 - e / 0.9);
      if (e > 0.9) { Ticker.shared.remove(fn); t.destroy(); }
    };
    Ticker.shared.add(fn);
  }

  _shake(obj) {
    clearInterval(this._shakeId);
    const base = obj.x;
    let n = 0;
    this._shakeId = setInterval(() => {
      if (obj.destroyed) { clearInterval(this._shakeId); return; }
      obj.x = base + (n % 2 === 0 ? 6 : -6) * (1 - n / 8);
      if (++n >= 8) { clearInterval(this._shakeId); obj.x = base; }
    }, 35);
  }

  _toast(msg, y = this._appH - 60) {
    if (this._toastTxt && !this._toastTxt.destroyed) this._toastTxt.destroy();
    const box = new Container();
    const t = bodyText(msg, 14, 0xffffff, { wrap: 300 });
    t.anchor.set(0.5);
    const g = new Graphics();
    g.roundRect(-t.width / 2 - 16, -t.height / 2 - 10, t.width + 32, t.height + 20, 16)
      .fill({ color: 0x1A1640, alpha: 0.96 }).stroke({ color: 0xE8453C, width: 2.5 });
    box.addChild(g, t);
    box.x = this._appW / 2; box.y = y;
    this._container.addChild(box);
    this._toastTxt = box;
    clearTimeout(this._toastId);
    this._toastId = setTimeout(() => { if (!box.destroyed) box.destroy({ children: true }); }, 1800);
  }
}

function fmtCountdown(ms) {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
