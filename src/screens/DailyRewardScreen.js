// DailyRewardScreen — modal overlay showing the 7-day reward calendar.
//
// States per box:
//   claimed  — days before the current streak day (or current day if
//               already claimed today): dimmed with a check mark
//   active   — the current day with a claimable reward: bright green border
//   cooldown — current day already claimed today: dim green border
//   future   — days not yet reached: dark/locked
//
// The CLAIM button is only enabled when canClaimDaily() is true.
// After claiming, the screen rebuilds to reflect the new state.
// The CLOSE button is always available.
import { Container, Graphics, Text } from 'pixi.js';
import { DAILY_REWARDS }             from '../game/ProgressManager.js';

const PANEL_W = 370;
const PANEL_H = 330;

// Per-day box geometry
const BOX_W    = 44;
const BOX_H    = 80;
const BOX_GAP  = 6;
// 7 boxes: 7*44 + 6*6 = 344, centred inside PANEL_W (13px each side)
const BOXES_X0 = (PANEL_W - (7 * BOX_W + 6 * BOX_GAP)) / 2;

export class DailyRewardScreen {
  // progress  — ProgressManager instance
  // callbacks — { onClose }
  // stage     — PixiJS stage (needed for _rebuild)
  constructor(stage, appW, appH, progress, { onClose }) {
    this._stage    = stage;
    this._appW     = appW;
    this._appH     = appH;
    this._progress = progress;
    this._onClose  = onClose;
    this._container = new Container();
    stage.addChild(this._container);
    this._build();
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _rebuild() {
    this._container.destroy({ children: true });
    this._container = new Container();
    this._stage.addChild(this._container);
    this._build();
  }

  _build() {
    const w  = this._appW;
    const h  = this._appH;
    const p  = this._progress;
    const px = (w - PANEL_W) / 2;
    const py = (h - PANEL_H) / 2 - 10;
    const cx = w / 2;

    // ── Backdrop (semi-transparent, blocks game layer clicks) ─────────────
    const backdrop = new Graphics();
    backdrop.rect(0, 0, w, h);
    backdrop.fill({ color: 0x000011, alpha: 0.80 });
    backdrop.eventMode = 'static';
    this._container.addChild(backdrop);

    // ── Panel ─────────────────────────────────────────────────────────────
    const panel = new Graphics();
    panel.roundRect(px, py, PANEL_W, PANEL_H, 18);
    panel.fill({ color: 0x0d1a2e, alpha: 0.97 });
    panel.roundRect(px, py, PANEL_W, PANEL_H, 18);
    panel.stroke({ color: 0x44aaff, width: 2, alpha: 0.40 });
    this._container.addChild(panel);

    // ── Title ─────────────────────────────────────────────────────────────
    this._text('DAILY REWARDS', cx, py + 34, { fontSize: 22, fill: 0xffffff });

    const day       = p.dailyDay;          // 0-6 (next day to claim)
    const canClaim  = p.canClaimDaily();

    // Which day box index is "today" for labelling purposes:
    // • canClaim  → day is the claimable box
    // • !canClaim → day-1 (mod 7) was claimed today, day is next
    const claimedUpTo = canClaim ? day - 1 : day - 1;  // last fully claimed index
    // Boxes 0..claimedUpTo are claimed, day is current, day+1..6 are future
    // Special: if day=0 and !canClaim → just completed full cycle

    const justCompleted = (day === 0 && !canClaim);

    let subtitle;
    if (justCompleted) {
      subtitle = 'Cycle complete! Come back tomorrow.';
    } else if (canClaim) {
      subtitle = `Day ${day + 1} reward ready to claim!`;
    } else {
      subtitle = `Next reward: Day ${day + 1} — come back tomorrow!`;
    }
    this._text(subtitle, cx, py + 60, { fontSize: 13, fill: 0x7799aa, fontWeight: 'normal' });

    // ── Day boxes ─────────────────────────────────────────────────────────
    const boxesY = py + 90;
    for (let i = 0; i < 7; i++) {
      let state;
      if (justCompleted) {
        state = 'claimed';
      } else if (i < day) {
        state = 'claimed';
      } else if (i === day) {
        state = canClaim ? 'active' : 'cooldown';
      } else {
        state = 'future';
      }
      this._buildDayBox(i, px + BOXES_X0 + i * (BOX_W + BOX_GAP), boxesY, state);
    }

    // ── CLAIM button ──────────────────────────────────────────────────────
    const btnY = py + PANEL_H - 130;
    if (canClaim && !justCompleted) {
      this._button('CLAIM REWARD', cx, btnY, 0x1a5a2a, 0x44ff88, () => {
        p.claimDaily();
        this._rebuild();
      });
    } else {
      this._text(
        justCompleted ? '7-day streak complete!' : 'Already claimed today',
        cx, btnY + 5,
        { fontSize: 14, fill: 0x556677, fontWeight: 'normal' },
      );
    }

    // ── CLOSE button ──────────────────────────────────────────────────────
    this._button('CLOSE', cx, py + PANEL_H - 52, 0x1a1a2a, 0x88aacc, this._onClose);
  }

  _buildDayBox(dayIdx, x, y, state) {
    const reward = DAILY_REWARDS[dayIdx];

    // Box colors by state
    const BG = {
      claimed:  0x080e08,
      active:   0x0a1e0a,
      cooldown: 0x080e0a,
      future:   0x080808,
    };
    const BORDER = {
      claimed:  0x1a2a1a,
      active:   0x44ff88,
      cooldown: 0x226633,
      future:   0x181818,
    };
    const CONTENT_ALPHA = {
      claimed:  0.35,
      active:   1.0,
      cooldown: 0.55,
      future:   0.20,
    };

    const g = new Graphics();
    g.roundRect(x, y, BOX_W, BOX_H, 8);
    g.fill(BG[state]);
    g.roundRect(x, y, BOX_W, BOX_H, 8);
    g.stroke({ color: BORDER[state], width: state === 'active' ? 2 : 1.2, alpha: 1 });
    this._container.addChild(g);

    const alpha   = CONTENT_ALPHA[state];
    const centerX = x + BOX_W / 2;

    // Day label
    const dayLabel = new Text({
      text:  `D${dayIdx + 1}`,
      style: { fontSize: 11, fontWeight: 'bold', fill: 0xaabbcc },
    });
    dayLabel.anchor.set(0.5, 0.5);
    dayLabel.x     = centerX;
    dayLabel.y     = y + 14;
    dayLabel.alpha = alpha;
    this._container.addChild(dayLabel);

    // Reward label (2 lines: icon + amount)
    const { line1, line2, color } = _rewardLabel(reward);
    const rL1 = new Text({ text: line1, style: { fontSize: 14, fontWeight: 'bold', fill: color } });
    rL1.anchor.set(0.5, 0.5);
    rL1.x     = centerX;
    rL1.y     = y + 38;
    rL1.alpha = alpha;
    this._container.addChild(rL1);

    if (line2) {
      const rL2 = new Text({ text: line2, style: { fontSize: 10, fill: color, fontWeight: 'normal' } });
      rL2.anchor.set(0.5, 0.5);
      rL2.x     = centerX;
      rL2.y     = y + 54;
      rL2.alpha = alpha;
      this._container.addChild(rL2);
    }

    // Checkmark overlay for claimed days
    if (state === 'claimed') {
      const tick = new Text({ text: '✓', style: { fontSize: 22, fontWeight: 'bold', fill: 0x44aa66 } });
      tick.anchor.set(0.5, 0.5);
      tick.x = centerX;
      tick.y = y + BOX_H / 2;
      this._container.addChild(tick);
    }
  }

  _text(str, x, y, style) {
    const t = new Text({ text: str, style: { fontWeight: 'bold', ...style } });
    t.anchor.set(0.5, 0.5);
    t.x = x;
    t.y = y;
    this._container.addChild(t);
    return t;
  }

  _button(label, cx, y, bgColor, labelColor, onClick) {
    const btnW = 220, btnH = 48;
    const btn  = new Graphics();
    btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
    btn.fill(bgColor);
    btn.x = cx;
    btn.y = y;
    btn.eventMode = 'static';
    btn.cursor    = 'pointer';
    btn.on('pointerdown', onClick);
    btn.on('pointerover',  () => { btn.alpha = 0.78; });
    btn.on('pointerout',   () => { btn.alpha = 1.00; });

    const t = new Text({ text: label, style: { fontSize: 18, fontWeight: 'bold', fill: labelColor } });
    t.anchor.set(0.5, 0.5);
    btn.addChild(t);
    this._container.addChild(btn);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _rewardLabel(reward) {
  if (reward.type === 'coins') {
    return { line1: `◆${reward.amount}`, line2: 'coins', color: 0xf5c842 };
  }
  if (reward.type === 'swap') {
    return { line1: '+1', line2: 'SWAP', color: 0x66aaff };
  }
  if (reward.type === 'peek') {
    return { line1: '+1', line2: 'PEEK', color: 0x66ff88 };
  }
  return { line1: '?', line2: null, color: 0xffffff };
}
