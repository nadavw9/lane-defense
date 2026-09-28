// StatsScreen — the player's profile page (premium pass, 2026-09-28).
//
// A hero card for star progress across the 40 levels, then a 2×3 grid of stat
// tiles: coins, levels cleared, cars destroyed, longest combo, accuracy and the
// favourite booster. All values come from ProgressManager; nothing is stored here.
import { Container } from 'pixi.js';
import { uiIcon, boosterIcon } from '../renderer/UIIcon.js';
import { screenBg, screenHeader, card, bar, titleText, bodyText, GOLD } from '../renderer/PremiumUI.js';

const MAX_LEVEL = 40;
const BOOSTER_ICON = { 'Color Change': 'colorchange', 'Freeze': 'freeze', 'Bomb': 'bomb', 'Swap': 'colorchange' };

export class StatsScreen {
  // options: { app, progressManager, onBack, audio }
  constructor(stage, appW, appH, { progressManager, onBack, audio }) {
    this._stage = stage;
    this._pm = progressManager;
    this._onBack = onBack;
    this._audio = audio;
    this._container = new Container();
    this._build(appW, appH);
  }

  show() { if (!this._container.parent) this._stage.addChild(this._container); }
  hide() { if (this._container.parent) this._stage.removeChild(this._container); }
  destroy() { this._container.destroy({ children: true }); }

  _build(w, h) {
    const c = this._container;
    c.addChild(screenBg(w, h));
    screenHeader(c, w, 'MY STATS', () => { this._audio?.play('button_tap'); this._onBack?.(); });

    const pm = this._pm;
    const stars = pm.getTotalStars?.() ?? 0;
    const maxStars = MAX_LEVEL * 3;

    // Hero: star progress.
    const hx = 16, hy = 92, hw = w - 32, hh = 132;
    const hero = card(hw, hh, { rim: GOLD });
    hero.x = hx; hero.y = hy;
    c.addChild(hero);
    const star = uiIcon('star-filled', 78, '⭐');
    star.x = hx + 62; star.y = hy + hh / 2 - 4;
    c.addChild(star);
    const sv = titleText(String(stars), 44, GOLD);
    sv.anchor.set(0, 0.5); sv.x = hx + 118; sv.y = hy + 44;
    c.addChild(sv);
    const sof = bodyText(`/ ${maxStars} STARS`, 16, 0xC9C3F0, { outline: false });
    sof.anchor.set(0, 0.5); sof.x = sv.x + sv.width + 8; sof.y = hy + 48;
    c.addChild(sof);
    const pb = bar(hw - 136, 20, stars / maxStars, { color: GOLD });
    pb.x = hx + 118; pb.y = hy + 76;
    c.addChild(pb);
    const pct = bodyText(`${Math.round((stars / maxStars) * 100)}% of the city's stars`, 12, 0xA9A3D6, { outline: false, weight: '600' });
    pct.anchor.set(0, 0.5); pct.x = hx + 118; pct.y = hy + 112;
    c.addChild(pct);

    // Tile grid.
    const fav = pm.getFavoriteBooster?.() ?? 'None';
    const cleared = Math.max(0, Math.min(MAX_LEVEL, (pm.unlockedLevel ?? 1) - 1));
    const tiles = [
      { icon: () => uiIcon('coin', 46, '🪙'),        value: fmt(pm.coins ?? 0),              label: 'COINS' },
      { icon: () => uiIcon('trophy', 46, '🏆'),      value: `${cleared}/${MAX_LEVEL}`,       label: 'LEVELS CLEARED' },
      { icon: () => uiIcon('explosion', 48, '💥'),   value: fmt(pm.totalCarsDestroyed ?? 0), label: 'CARS DESTROYED' },
      { icon: () => uiIcon('fire', 46, '🔥'),        value: `${pm.longestCombo ?? 0}x`,      label: 'LONGEST COMBO' },
      { icon: () => uiIcon('target', 46, '🎯'),      value: `${pm.getAccuracy?.() ?? 0}%`,   label: 'SHOT ACCURACY' },
      { icon: () => BOOSTER_ICON[fav] ? boosterIcon(BOOSTER_ICON[fav], 48, '?') : uiIcon('lightning', 46, '⚡'),
        value: fav === 'None' ? '—' : fav, label: 'FAVORITE BOOSTER', small: fav !== 'None' },
    ];
    const gx = 16, gy = hy + hh + 18, gap = 12;
    const tw = (w - 32 - gap) / 2, th = 150;
    tiles.forEach((t, i) => {
      const x = gx + (i % 2) * (tw + gap), y = gy + Math.floor(i / 2) * (th + gap);
      const bg = card(tw, th);
      bg.x = x; bg.y = y;
      c.addChild(bg);
      const ic = t.icon();
      ic.x = x + tw / 2; ic.y = y + 42;
      c.addChild(ic);
      const v = titleText(t.value, t.small ? 22 : 30);
      v.x = x + tw / 2; v.y = y + 94;
      if (v.width > tw - 16) v.scale.set((tw - 16) / v.width);
      c.addChild(v);
      const l = bodyText(t.label, 12, 0xC9C3F0, { outline: false });
      l.x = x + tw / 2; l.y = y + 128;
      c.addChild(l);
    });
  }
}

function fmt(n) { return Number(n).toLocaleString('en-US'); }
