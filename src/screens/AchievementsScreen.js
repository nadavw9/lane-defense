// AchievementsScreen — the trophy room (premium pass, 2026-09-28).
//
// A progress card, then one scrolling column of trophy rows. Locked trophies
// show their goal (players chase what they can see) greyed with a lock; earned
// ones are gold with a check. Survival-mode trophies are hidden: that mode was
// removed, so they can never be earned.
import { Container, Graphics } from 'pixi.js';
import { ACHIEVEMENTS } from '../game/AchievementManager.js';
import { uiIcon } from '../renderer/UIIcon.js';
import { screenBg, screenHeader, card, bar, titleText, bodyText, GOLD, GREEN } from '../renderer/PremiumUI.js';
import { INK } from '../renderer/ToyStyle.js';

const ROW_H = 76, ROW_GAP = 10, PAD = 16;

// One icon per trophy so the list isn't eighteen identical cups.
const ICON = {
  first_blood: 'explosion', combo_starter: 'fire', combo_master: 'fire', combo_legend: 'fire',
  bench_warmer: 'hand', sharpshooter: 'target', survivor: 'shield', speed_demon: 'timer',
  collector: 'coin', shopkeeper: 'gift', big_spender: 'coin', dedicated: 'star-filled',
  streak_master: 'star-filled', chain_reaction: 'lightning', crisis_saved: 'heart',
  weekly_hero: 'trophy', no_mercy: 'skull', daily_challenger: 'lightning',
};

export class AchievementsScreen {
  constructor(stage, appW, appH, progress, { onBack, audio }) {
    this._container = new Container();
    stage.addChild(this._container);
    this._scrollY = 0;
    this._build(appW, appH, progress, onBack, audio);
  }

  destroy() { this._container.destroy({ children: true }); }

  _build(w, h, progress, onBack, audio) {
    const c = this._container;
    c.addChild(screenBg(w, h));
    screenHeader(c, w, 'TROPHIES', () => { audio?.play('button_tap'); onBack(); });

    const list = ACHIEVEMENTS.filter(a => !a.id.startsWith('survival_'));
    const earnedSet = new Set(list.filter(a => progress.hasAchievement(a.id)).map(a => a.id));
    // Earned first, then locked — both in definition order.
    const ordered = [...list.filter(a => earnedSet.has(a.id)), ...list.filter(a => !earnedSet.has(a.id))];

    // Progress card.
    const pw = w - PAD * 2, ph = 74, py = 88;
    const pc = card(pw, ph, { rim: GOLD });
    pc.x = PAD; pc.y = py;
    c.addChild(pc);
    const tr = uiIcon('trophy', 52, '🏆');
    tr.x = PAD + 42; tr.y = py + ph / 2;
    c.addChild(tr);
    const cnt = titleText(`${earnedSet.size} / ${list.length}`, 26, GOLD);
    cnt.anchor.set(0, 0.5); cnt.x = PAD + 82; cnt.y = py + 24;
    c.addChild(cnt);
    const lab = bodyText('UNLOCKED', 13, 0xC9C3F0, { outline: false });
    lab.anchor.set(0, 0.5); lab.x = cnt.x + cnt.width + 10; lab.y = py + 26;
    c.addChild(lab);
    const pb = bar(pw - 100, 16, earnedSet.size / Math.max(1, list.length), { color: GOLD });
    pb.x = PAD + 82; pb.y = py + 44;
    c.addChild(pb);

    // Scrolling list.
    const top = py + ph + 14, viewH = h - top - 8;
    const view = new Container();
    view.y = top;
    c.addChild(view);
    const mask = new Graphics();
    mask.rect(0, top, w, viewH).fill(0xffffff);
    c.addChild(mask);
    view.mask = mask;
    const content = new Container();
    view.addChild(content);
    ordered.forEach((a, i) => this._row(content, a, earnedSet.has(a.id), PAD, i * (ROW_H + ROW_GAP), w - PAD * 2));
    const contentH = ordered.length * (ROW_H + ROW_GAP) + 8;
    this._maxScroll = Math.max(0, contentH - viewH);

    // Drag / wheel scrolling.
    const hit = new Graphics();
    hit.rect(0, 0, w, viewH).fill({ color: 0x000000, alpha: 0.001 });
    view.addChildAt(hit, 0);
    view.eventMode = 'static';
    let dragFrom = null, startScroll = 0;
    const apply = () => { content.y = -this._scrollY; };
    view.on('pointerdown', (e) => { dragFrom = e.global.y; startScroll = this._scrollY; });
    view.on('globalpointermove', (e) => {
      if (dragFrom == null) return;
      this._scrollY = Math.max(0, Math.min(this._maxScroll, startScroll - (e.global.y - dragFrom)));
      apply();
    });
    const end = () => { dragFrom = null; };
    view.on('pointerup', end); view.on('pointerupoutside', end);
    view.on('wheel', (e) => { this._scrollY = Math.max(0, Math.min(this._maxScroll, this._scrollY + e.deltaY * 0.6)); apply(); });
  }

  _row(parent, a, earned, x, y, rw) {
    const bg = card(rw, ROW_H, { rim: earned ? GOLD : undefined, dim: !earned });
    bg.x = x; bg.y = y;
    parent.addChild(bg);

    // Medallion.
    const mx = x + 40, my = y + ROW_H / 2;
    const med = new Graphics();
    med.circle(mx, my + 2, 25).fill({ color: 0x000000, alpha: 0.3 });
    med.circle(mx, my, 25).fill(earned ? 0xFFE08A : 0x2A2656).stroke({ color: earned ? 0xB9771C : 0x0C0A26, width: 3 });
    med.circle(mx, my, 19).fill(earned ? GOLD : 0x1C1946);
    parent.addChild(med);
    const ic = uiIcon(ICON[a.id] ?? 'trophy', 28, '🏆');
    ic.x = mx; ic.y = my;
    if (!earned) { ic.tint = 0x6A6496; ic.alpha = 0.85; }
    parent.addChild(ic);

    const name = bodyText(a.name, 17, earned ? 0xFFFFFF : 0x9C96C8, { outline: earned, align: 'left' });
    name.anchor.set(0, 0.5); name.x = x + 78; name.y = y + 26;
    parent.addChild(name);
    const desc = bodyText(a.desc, 13, earned ? 0xE6E1FF : 0x7D77AD, { outline: false, align: 'left', weight: '600', wrap: rw - 140 });
    desc.anchor.set(0, 0); desc.x = x + 78; desc.y = y + 40;
    parent.addChild(desc);

    // Status chip.
    const sx = x + rw - 34, sy = y + ROW_H / 2;
    const chip = new Graphics();
    chip.circle(sx, sy, 16).fill(earned ? GREEN : 0x2A2656).stroke({ color: INK, width: 2.5 });
    parent.addChild(chip);
    const s = earned ? uiIcon('check', 20, '✓') : lockGlyph();
    s.x = sx; s.y = sy;
    parent.addChild(s);
  }
}

function lockGlyph() {
  const g = new Graphics();
  g.roundRect(-7, -2, 14, 11, 3).fill(0x8C86BA);
  g.moveTo(-5, -2).arc(0, -2, 5, Math.PI, 0).stroke({ color: 0x8C86BA, width: 2.5 });
  return g;
}
