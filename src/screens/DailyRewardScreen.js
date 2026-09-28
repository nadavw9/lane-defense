// DailyRewardScreen — the 7-day reward calendar (premium pass, 2026-09-28).
//
// Days 1–6 are tiles in a 3×2 grid; day 7 is the wide jackpot tile. Tile states:
//   claimed  — before today (or today once claimed): dimmed with a green check
//   active   — today's claimable reward: gold rim, glow, "TODAY" tag
//   cooldown — today, already claimed
//   future   — not reached yet
//
// CLAIM is only offered when canClaimDaily() is true; claiming rebuilds the card.
import { Container, Graphics } from 'pixi.js';
import { uiIcon, boosterIcon } from '../renderer/UIIcon.js';
import { DAILY_REWARDS } from '../game/ProgressManager.js';
import { panel, ribbon, button, roundButton, titleText, bodyText, backdrop, GOLD, GREEN } from '../renderer/PremiumUI.js';
import { INK } from '../renderer/ToyStyle.js';

const PW = 350, PH = 540;

export class DailyRewardScreen {
  constructor(stage, appW, appH, progress, { onClose, audio }) {
    this._stage = stage;
    this._appW = appW;
    this._appH = appH;
    this._progress = progress;
    this._onClose = onClose;
    this._audio = audio;
    this._container = new Container();
    stage.addChild(this._container);
    this._build();
  }

  destroy() { this._container.destroy({ children: true }); }

  _rebuild() {
    this._container.destroy({ children: true });
    this._container = new Container();
    this._stage.addChild(this._container);
    this._build();
  }

  _build() {
    const w = this._appW, h = this._appH, p = this._progress;
    this._container.addChild(backdrop(w, h));
    const card = new Container();
    card.x = (w - PW) / 2; card.y = (h - PH) / 2 + 10;
    this._container.addChild(card);
    card.addChild(panel(PW, PH));
    const rb = ribbon('DAILY REWARD', 262, { size: 27 });
    rb.x = PW / 2; rb.y = 2;
    card.addChild(rb);
    const close = roundButton(uiIcon('close', 22, '✕'), { r: 22, color: 0xE8453C, onTap: () => { this._audio?.play('button_tap'); this._onClose(); } });
    close.x = PW - 14; close.y = 14;
    card.addChild(close);

    const day = p.dailyDay;              // 0-6, next day to claim
    const canClaim = p.canClaimDaily();
    const justCompleted = day === 0 && !canClaim;
    const sub = justCompleted ? 'Week complete! A new week starts tomorrow.'
      : canClaim ? 'Come back every day — day 7 is the jackpot!'
      : 'Come back tomorrow for your next reward!';
    const st = bodyText(sub, 13, 0xC9C3F0, { outline: false, weight: '600' });
    st.x = PW / 2; st.y = 56;
    card.addChild(st);

    const stateOf = (i) => justCompleted || i < day ? 'claimed' : i === day ? (canClaim ? 'active' : 'cooldown') : 'future';
    const tw = 94, th = 112, gap = 10;
    const gx = (PW - (3 * tw + 2 * gap)) / 2, gy = 80;
    for (let i = 0; i < 6; i++) {
      this._tile(card, i, gx + (i % 3) * (tw + gap), gy + Math.floor(i / 3) * (th + gap), tw, th, stateOf(i));
    }
    this._tile(card, 6, gx, gy + 2 * (th + gap), 3 * tw + 2 * gap, 108, stateOf(6), true);

    const by = PH - 60;
    if (canClaim && !justCompleted) {
      const b = button('CLAIM', { variant: 'green', w: 230, h: 68, size: 32, onTap: () => {
        this._audio?.play('daily_reward');
        p.claimDaily();
        this._rebuild();
      } });
      b.x = PW / 2; b.y = by;
      card.addChild(b);
    } else {
      const b = button('OK', { variant: 'blue', w: 200, h: 62, size: 30, onTap: () => { this._audio?.play('button_tap'); this._onClose(); } });
      b.x = PW / 2; b.y = by;
      card.addChild(b);
    }
  }

  _tile(parent, i, x, y, tw, th, state, jackpot = false) {
    const reward = DAILY_REWARDS[i];
    const active = state === 'active';
    const g = new Graphics();
    if (active) g.roundRect(x - 4, y - 4, tw + 8, th + 8, 18).fill({ color: GOLD, alpha: 0.28 });
    const face = active ? 0x4A3F9A : state === 'future' ? 0x221E4E : 0x2A2656;
    g.roundRect(x, y, tw, th, 14).fill(face);
    g.roundRect(x, y, tw, th * 0.45, 14).fill({ color: 0xFFFFFF, alpha: active ? 0.1 : 0.04 });
    g.roundRect(x, y, tw, th, 14).stroke({ color: active ? GOLD : 0x0C0A26, width: active ? 3 : 2 });
    parent.addChild(g);

    const dim = state === 'claimed' || state === 'future' ? 0.45 : 1;
    const dl = bodyText(jackpot ? 'DAY 7 — JACKPOT' : `DAY ${i + 1}`, 12, active ? GOLD : 0xC9C3F0, { outline: active });
    dl.x = x + tw / 2; dl.y = y + 14;
    dl.alpha = Math.max(dim, 0.7);
    parent.addChild(dl);

    const { icon, label } = rewardArt(reward, jackpot ? 58 : 44);
    const amount = titleText(label, jackpot ? 26 : 20);
    if (jackpot) {
      icon.x = x + tw / 2 - 50; icon.y = y + th / 2 + 8;
      amount.anchor.set(0, 0.5); amount.x = x + tw / 2 - 10; amount.y = y + th / 2 + 8;
      const gift = uiIcon('gift', 50, '🎁');
      gift.x = x + tw - 44; gift.y = y + th / 2 + 6;
      gift.alpha = dim;
      parent.addChild(gift);
    } else {
      icon.x = x + tw / 2; icon.y = y + 52;
      amount.x = x + tw / 2; amount.y = y + th - 20;
    }
    icon.alpha = dim; amount.alpha = dim;
    parent.addChild(icon, amount);

    if (state === 'claimed') {
      const ck = new Graphics();
      ck.circle(x + tw - 14, y + 14, 13).fill(GREEN).stroke({ color: INK, width: 2.5 });
      parent.addChild(ck);
      const t = uiIcon('check', 16, '✓');
      t.x = x + tw - 14; t.y = y + 14;
      parent.addChild(t);
    }
  }
}

function rewardArt(reward, size) {
  if (reward.type === 'swap') return { icon: boosterIcon('colorchange', size, '🎨'), label: '+1' };
  if (reward.type === 'coins') return { icon: uiIcon('coin', size, '🪙'), label: String(reward.amount) };
  return { icon: uiIcon('gift', size, '🎁'), label: '?' };
}
