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
import { traitInfo, traitSpritePath } from '../renderer/traitIcons.js';
import { levelDifficulty } from '../game/LevelManager.js';

const _B = import.meta.env.BASE_URL;
const BOOSTERS = [
  { key: 'colorchange', inv: 'colorChange', label: 'Recolor', bundle: { colorChange: 1, freeze: 0, bombs: 0 } },
  { key: 'freeze',      inv: 'freeze',      label: 'Freeze',  bundle: { colorChange: 0, freeze: 1, bombs: 0 } },
  { key: 'bomb',        inv: 'bombs',       label: 'Bomb',    bundle: { colorChange: 0, freeze: 0, bombs: 1 } },
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
  if (goal.type === 'destroyTrait') {
    const sp = spriteFit(traitSpritePath(goal.trait) ?? 'sprites/designed/car-red-processed.png', 56);
    const t = traitInfo(goal.trait);
    if (sp && t?.tint != null) sp.tint = t.tint;
    return sp;
  }
  if (goal.type === 'destroyType') {
    const f = { small: 'bike', big: 'car', jeep: 'van', truck: 'truck', bigrig: 'bigrig', tank: 'tank' }[goal.carType] ?? 'car';
    return spriteFit(`sprites/designed/${f}-red${f === 'car' ? '-processed' : ''}.png`, 44);
  }
  // destroyTotal: "any cars" — a small fanned traffic jam of three colours.
  const jam = new Container();
  for (const [col, dx, dy, rot] of [['blue', -17, 4, -0.22], ['yellow', 17, 4, 0.22], ['red', 0, -2, 0]]) {
    const s = spriteFit(`sprites/designed/car-${col}-processed.png`, 38);
    if (!s) continue;
    s.x = dx; s.y = dy; s.rotation = rot;
    jam.addChild(s);
  }
  return jam.children.length ? jam : uiIcon('explosion', 40, '💥');
}

// Which sprite introduces a level's new piece (from its intro line).
function introSprite(intro, lv) {
  if (/BOSS/.test(intro)) return 'sprites/designed/boss.png';
  if (/Speeder/i.test(intro)) return 'sprites/designed/speeder-big-yellow.png';
  if (/Armou?r/i.test(intro)) return 'sprites/designed/armored-big-blue.png';
  if (/COLOR SWAP/i.test(intro)) return 'sprites/designed/booster-colorchange.png';
  if (/BIG WAVE/.test(intro)) return 'sprites/ui/icon-skull.png';
  if (/Plated|plating/i.test(intro)) return traitSpritePath('plated');
  if (/Mender/i.test(intro)) return traitSpritePath('mender');
  if (/Volatile/i.test(intro)) return traitSpritePath('volatile');
  if (/Phantom/i.test(intro)) return traitSpritePath('phantom');
  if (/Chameleon/i.test(intro)) return 'sprites/designed/chameleon-big-green.png';
  if (/Bench/i.test(intro)) return 'sprites/designed/powerball-red.png';
  if (/FREEZE/i.test(intro)) return 'sprites/designed/booster-freeze.png';
  return 'sprites/designed/car-red-processed.png';
}

export class PreLevelScreen {
  // opts: { onSelect(adCount, bundle), onClose, audio, freeBooster, level }
  //   level = { id, name, goals, hintText } (the level config)
  constructor(stage, appW, appH, levelLabel, { onSelect, onClose = null, audio, freeBooster = null, level = null, owned = null, streak = null, offered = null }) {
    // Which booster tiles to show ({ colorchange, freeze, bomb } booleans, boosterUnlocks.js);
    // null = all three (old callers).
    this._boosters = BOOSTERS.filter(b => !offered || offered[b.key] || freeBooster?.key === b.key);
    this._streak = streak;   // { count, gift, toNext } — see src/game/winStreak.js
    this._owned = owned ?? {};
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
    const intro = (lv.hintText && /^(NEW!|BOSS!|FINAL BOSS!|BIG WAVE!)/.test(lv.hintText)) ? lv.hintText : null;
    const hard = !!intro && /^BIG WAVE!/.test(intro);   // big-wave intro box (red)
    const tier = levelDifficulty(lv.id);                 // 'hard' | 'superhard' | 'normal' (same tiers the tuner uses)
    const tierPill = tier !== 'normal';

    const streak = this._streak;
    const boosters = this._boosters;
    const PW = 344, PH = 470 + (intro ? 100 : 0) + (streak ? 62 : 0) + (tierPill ? 36 : 0) - (boosters.length ? 0 : 136);
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

    // Difficulty pill: HARD (red) / SUPER HARD (purple), as on the map node. Said up front,
    // so a loss reads as the level being hard, and a booster as the answer.
    if (tierPill) {
      const sup = tier === 'superhard';
      const pw = sup ? 168 : 138, ph = 28;
      const pill = new Graphics();
      pill.roundRect(PW / 2 - pw / 2, y - 6, pw, ph, 14).fill(sup ? 0x8A3CE0 : 0xE8453C).stroke({ color: INK, width: 2.5 });
      pill.roundRect(PW / 2 - pw / 2 + 6, y - 3, pw - 12, ph * 0.35, 8).fill({ color: 0xffffff, alpha: 0.25 });
      card.addChild(pill);
      const ic = uiIcon(sup ? 'skull' : 'fire', 18, sup ? '💀' : '🔥');
      ic.x = PW / 2 - pw / 2 + 18; ic.y = y + 8;
      card.addChild(ic);
      const t = titleText(sup ? 'SUPER HARD' : 'HARD LEVEL', 16);
      t.x = PW / 2 + 10; t.y = y + 8;
      card.addChild(t);
      y += 36;
    }

    // Goals.
    const gl = bodyText('GOALS', 15, 0xC9C3F0, { outline: false });
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

    // Win streak: what the run of wins is worth on this level, or how close the first gift is.
    if (streak) {
      const sw = PW - 48, sh = 50, sx = 24;
      const live = !!streak.gift;
      const bar = new Graphics();
      bar.roundRect(sx, y, sw, sh, 25).fill(live ? 0x7A2E12 : 0x2A2458).stroke({ color: live ? 0xFF9A3C : 0x5A54A0, width: 2.5 });
      bar.roundRect(sx + 8, y + 4, sw - 16, sh * 0.38, 18).fill({ color: 0xffffff, alpha: 0.08 });
      card.addChild(bar);
      const fire = uiIcon('fire', 34, '🔥', live ? {} : { tint: 0x8A84C8 });
      fire.x = sx + 30; fire.y = y + sh / 2;
      card.addChild(fire);
      if (live) {
        const t = titleText(`WIN STREAK ×${streak.count}`, 18, GOLD);
        t.anchor.set(0, 0.5); t.x = sx + 54; t.y = y + sh / 2;
        card.addChild(t);
        // The free boosters this streak brings, right-aligned, each with a small FREE tag.
        const keys = [['freeze', 'freeze'], ['colorChange', 'colorchange']].filter(([k]) => streak.gift[k] > 0);
        keys.forEach(([, icon], i) => {
          const cx = sx + sw - 26 - i * 42;
          const ic = boosterIcon(icon, 32, '?');
          ic.x = cx; ic.y = y + sh / 2 - 2;
          card.addChild(ic);
          const tag = bodyText('FREE', 10, 0x9CFF8A, { outline: true });
          tag.x = cx; tag.y = y + sh - 6;
          card.addChild(tag);
        });
      } else {
        const need = streak.toNext;
        const t = bodyText(streak.count > 0 ? `Win ${need} more for a free FREEZE` : `Win ${need} in a row for a free FREEZE`, 14, 0xD8D3FF, { outline: false, weight: '700' });
        t.anchor.set(0, 0.5); t.x = sx + 54; t.y = y + sh / 2;
        card.addChild(t);
      }
      y += sh + 12;
    }

    // New this level — the car (or boss) itself, and one line on its rule.
    if (intro) {
      const iw = PW - 48, ih = 86;
      const box = new Graphics();
      box.roundRect(24, y, iw, ih, 16).fill({ color: hard ? 0xFF3D3D : 0xFFC93C, alpha: hard ? 0.18 : 0.14 }).stroke({ color: hard ? 0xFF5A4A : GOLD, width: 2 });
      card.addChild(box);
      const pic = spriteFit(introSprite(intro, lv), /BOSS/.test(intro) ? 78 : 66);
      if (pic) { pic.x = 24 + 44; pic.y = y + ih / 2; card.addChild(pic); }
      const tag = hard ? 'BIG WAVE' : intro.match(/^(NEW!|BOSS!|FINAL BOSS!)/)[1];
      const tg = titleText(tag, 18, hard ? 0xFF6A5A : GOLD);
      tg.anchor.set(0, 0.5); tg.x = 24 + 88; tg.y = y + 20;
      card.addChild(tg);
      const txt = intro.replace(/^(NEW!|BOSS!|FINAL BOSS!|BIG WAVE!)\s*/, '');
      const t = bodyText(txt, 13, WHITE, { outline: false, align: 'left', wrap: iw - 100, weight: '600' });
      t.anchor.set(0, 0); t.x = 24 + 88; t.y = y + 32;
      card.addChild(t);
      y += ih + 14;
    }

    // Booster offer — only the boosters the player has met (one tile on L2-8, two on L9-12).
    if (boosters.length) {
    const bl = bodyText('START WITH A BOOSTER', 14, 0xC9C3F0, { outline: false });
    bl.x = PW / 2; bl.y = y;
    card.addChild(bl);
    y += 16;
    }
    const bw = 90, bh = 104, bgap = 12;
    const bt = boosters.length * bw + (boosters.length - 1) * bgap;
    boosters.forEach((b, i) => {
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
      chip.roundRect(-38, 20, 76, 28, 14).fill(isFree ? 0x3DBB3A : 0x2F7FE0).stroke({ color: INK, width: 2.5 });
      chip.roundRect(-32, 23, 64, 8, 4).fill({ color: 0xffffff, alpha: 0.3 });
      tile.addChild(chip);
      if (isFree) {
        const ft = titleText('FREE', 16); ft.y = 34; tile.addChild(ft);
      } else {
        // "+1 with a video" — a play badge and the gain, not the word AD.
        const pb = new Graphics();
        pb.circle(-17, 34, 9).fill(0xffffff);
        pb.moveTo(-20, 29).lineTo(-12, 34).lineTo(-20, 39).closePath().fill(0x2F7FE0);
        tile.addChild(pb);
        const at = titleText('+1', 17); at.x = 9; at.y = 34; tile.addChild(at);
      }
      // Owned boosters come along automatically — say so on the tile.
      const own = this._owned[b.inv] ?? 0;
      if (own > 0) {
        const ob = new Graphics();
        ob.circle(bw / 2 - 12, -bh / 2 + 12, 15).fill(0x3DBB3A).stroke({ color: INK, width: 2.5 });
        ob.ellipse(bw / 2 - 12, -bh / 2 + 6, 8, 4).fill({ color: 0xffffff, alpha: 0.35 });
        tile.addChild(ob);
        const ot = titleText(`×${own}`, 13); ot.x = bw / 2 - 12; ot.y = -bh / 2 + 12;
        tile.addChild(ot);
      }
      tile.eventMode = 'static';
      tile.cursor = 'pointer';
      tile.on('pointerdown', () => tile.scale.set(0.94));
      tile.on('pointerupoutside', () => tile.scale.set(1));
      tile.on('pointerup', () => { tile.scale.set(1); this._choose(isFree ? 0 : 1, b.bundle); });
      card.addChild(tile);
    });
    if (boosters.length) y += bh + 30;

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
