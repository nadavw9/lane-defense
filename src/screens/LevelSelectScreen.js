// LevelSelectScreen — the world map (premium pass, 2026-09-28).
//
// One page per game world (15 / 15 / 10 levels, levelMapLayout.js). Each page is
// a baked 3D diorama (scripts/render-3d-sprites.mjs map) with the road running
// through the level nodes; the city-repair building for every level stands on
// its plot beside the road — rubble until the level is beaten, repaired after
// (VISION: City Repair meta loop, persisted in ProgressManager cityState).
//
// Tapping an unlocked node calls onSelectLevel(levelId) — the level card
// (PreLevelScreen) is the one popup; the old in-map popup is gone.
import { Container, Graphics, Sprite, Assets, FillGradient } from 'pixi.js';
import { uiIcon } from '../renderer/UIIcon.js';
import { ribbon, roundButton, titleText, bodyText, GOLD, GOLD_DEEP } from '../renderer/PremiumUI.js';
import { INK, WHITE, shade, tint } from '../renderer/ToyStyle.js';
import { MAP_WORLDS, mapNodes, worldForLevel } from './levelMapLayout.js';
import { LEVEL_COUNT, isBossLevel } from '../game/LevelManager.js';

const _B = import.meta.env.BASE_URL;
const NODE_R = 27;
const ACCENT = { world1: 0x2F7FE0, world2: 0xF08A24, world3: 0x8B4FE0,
  world4: 0xE0A02F, world5: 0x3FB6D8, world6: 0xE0584F, world7: 0x5A5AE0 };

const _faceGrads = new Map();
function faceGrad(color) {
  let g = _faceGrads.get(color);
  if (!g) {
    g = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
      colorStops: [{ offset: 0, color: tint(color, 0.35) }, { offset: 0.6, color }, { offset: 1, color: shade(color, 0.75) }] });
    _faceGrads.set(color, g);
  }
  return g;
}

function sprite(path, w = null) {
  const tex = Assets.get(`${_B}${path}`);
  if (!tex) return null;
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  if (w) s.scale.set(w / tex.width);
  return s;
}

export class LevelSelectScreen {
  constructor(stage, appW, appH, progress,
    { onSelectLevel, onBack, onShop, onAchievements, audio, weeklyLevels = [], cityAnim = null }) {
    this._container = new Container();
    stage.addChild(this._container);
    this._appW = appW;
    this._appH = appH;
    this._progress = progress;
    this._weeklyLevels = weeklyLevels;
    this._callbacks = { onSelectLevel, onBack, onShop, onAchievements, audio };
    this._cityAnim = cityAnim;
    this._t = 0;
    this._current = null;       // { node, marker } of the next level to play
    this._repairAnims = [];
    const unlocked = progress.unlockedLevel ?? 1;
    const focus = (cityAnim && typeof cityAnim.building === 'number') ? cityAnim.building : Math.min(LEVEL_COUNT, unlocked);
    this._page = worldForLevel(focus).page;
    this._build();
  }

  destroy() { this._container.destroy({ children: true }); }

  update(dt) {
    this._t += dt;
    if (this._current) {
      const k = 0.5 + 0.5 * Math.sin(this._t * 4);
      this._current.node.scale.set(1 + 0.06 * k);
      this._current.ring.alpha = 0.35 + 0.5 * k;
      this._current.ring.scale.set(1 + 0.12 * k);
      this._current.marker.y = this._current.baseY - 6 * Math.abs(Math.sin(this._t * 3.2));
    }
    for (let i = this._repairAnims.length - 1; i >= 0; i--) {
      const a = this._repairAnims[i];
      a.t = Math.min(1, a.t + dt / 0.75);
      a.prior.alpha = Math.max(0, 1 - a.t / 0.4);
      const e = 1 - Math.pow(1 - a.t, 3);
      const ov = a.t < 0.7 ? Math.sin(a.t / 0.7 * Math.PI) * 0.22 : 0;
      a.next.scale.set(a.base * e * (1 + ov));
      a.next.alpha = Math.min(1, a.t * 3);
      if (a.t >= 1) { a.prior.destroy(); a.next.scale.set(a.base); this._repairAnims.splice(i, 1); }
    }
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  _build() {
    const w = this._appW, h = this._appH, p = this._progress;
    const world = MAP_WORLDS[this._page - 1];
    const unlocked = p.unlockedLevel ?? 1;
    const accent = ACCENT[world.theme];

    const bg = sprite(`sprites/designed/map-${world.theme}.png`);
    if (bg) { bg.anchor.set(0); bg.width = w; bg.height = h; this._container.addChild(bg); }
    else { const g = new Graphics(); g.rect(0, 0, w, h).fill(0x3A6B3A); this._container.addChild(g); }
    // Catch taps that miss a node (so nothing underneath reacts).
    bg && (bg.eventMode = 'static');

    const nodes = mapNodes(this._page);
    const city = p.getCityState();
    const anim = this._cityAnim;
    this._cityAnim = null;

    // Buildings first (behind nodes), in back-to-front order for overlap.
    for (const n of [...nodes].sort((a, b) => a.plotY - b.plotY)) {
      const bId = p.buildingForLevel(n.levelId);
      const state = city[String(bId)] ?? 0;
      const variant = n.levelId % 3;
      if (anim && anim.building === bId && anim.prior !== 2) {
        const prior = this._building(world.theme, anim.prior, variant, n);
        const next = this._building(world.theme, 2, variant, n);
        const base = next.scale.x;
        next.scale.set(0); next.alpha = 0;
        this._repairAnims.push({ prior, next, base, t: 0 });
        this._callbacks.audio?.play('coin_collect');
      } else {
        this._building(world.theme, state, variant, n);
      }
    }

    for (const n of nodes) {
      const stars = p.getStars(n.levelId);
      const open = n.levelId <= unlocked;
      const isNext = n.levelId === unlocked && stars === 0;
      this._node(n, { stars, open, isNext, accent, boss: isBossLevel(n.levelId), weekly: this._weeklyLevels.includes(n.levelId) });
    }

    this._header(world, accent);
  }

  _building(theme, state, variant, n) {
    const s = sprite(`sprites/designed/repair-${theme}-${state}-${variant}.png`, 150);
    if (!s) return new Container();
    s.x = n.plotX; s.y = n.plotY + 1;
    this._container.addChild(s);
    return s;
  }

  /** Screen position of a level's node on the current page (QA / dev hooks). */
  nodePosition(levelId) { return this._nodePos?.[levelId] ?? null; }

  _node(n, { stars, open, isNext, accent, boss, weekly }) {
    (this._nodePos ??= {})[n.levelId] = { x: n.x, y: n.y };
    const node = new Container();
    node.x = n.x; node.y = n.y;
    const g = new Graphics();
    // Played = the world's accent, the one to play next = PLAY green (it pulses,
    // with the arrow), boss = red, locked = grey.
    const face = !open ? 0x77738F : boss ? 0xE8453C : stars > 0 ? accent : 0x3DBB3A;
    g.circle(2, 6, NODE_R + 4).fill({ color: 0x000000, alpha: 0.35 });
    g.circle(0, 3, NODE_R + 4).fill(open ? GOLD_DEEP : 0x4A475E);
    g.circle(0, 0, NODE_R + 4).fill(open ? faceGrad(GOLD) : faceGrad(0x9A97AE));
    g.circle(0, 0, NODE_R + 4).stroke({ color: INK, width: 3 });
    g.circle(0, 0, NODE_R - 1).fill(faceGrad(face));
    g.circle(0, 0, NODE_R - 1).stroke({ color: shade(face, 0.55), width: 2 });
    g.ellipse(0, -NODE_R * 0.45, NODE_R * 0.62, NODE_R * 0.3).fill({ color: WHITE, alpha: 0.3 });
    node.addChild(g);

    if (open) {
      const num = titleText(String(n.levelId), n.levelId >= 10 ? 22 : 24);
      num.y = 1;
      node.addChild(num);
    } else {
      const lock = new Graphics();
      lock.roundRect(-9, -3, 18, 14, 3).fill(0xE9E6F2).stroke({ color: INK, width: 2 });
      lock.moveTo(-6, -3).arc(0, -3, 6, Math.PI, 0).stroke({ color: INK, width: 5 });
      lock.moveTo(-6, -3).arc(0, -3, 6, Math.PI, 0).stroke({ color: 0xE9E6F2, width: 2.5 });
      node.addChild(lock);
    }

    // Corner badge on its own disc, so it reads as a badge rather than a sprite
    // colliding with the node ring.
    const badge = boss ? ['skull', 18, '💀', 0x3A1030] : (weekly && open) ? ['star-filled', 17, '⭐', 0x2B2760] : null;
    if (badge) {
      const bx = NODE_R + 1, by = -NODE_R + 2;
      const bd = new Graphics();
      bd.circle(bx + 1, by + 2, 13).fill({ color: 0x000000, alpha: 0.3 });
      bd.circle(bx, by, 13).fill(badge[3]).stroke({ color: GOLD, width: 2.5 });
      node.addChild(bd);
      const ic = uiIcon(badge[0], badge[1], badge[2]);
      ic.x = bx; ic.y = by;
      node.addChild(ic);
    }

    // Stars plaque under completed levels.
    if (open && stars > 0) {
      const pl = new Graphics();
      pl.roundRect(-30, NODE_R - 2, 60, 20, 10).fill(0x1F1A33).stroke({ color: GOLD_DEEP, width: 2 });
      node.addChild(pl);
      for (let i = 0; i < 3; i++) {
        const st = uiIcon(i < stars ? 'star-filled' : 'star-empty', 17, i < stars ? '★' : '☆', i < stars ? {} : { tint: 0x4A4660 });
        st.x = -18 + i * 18; st.y = NODE_R + 8;
        node.addChild(st);
      }
    }

    if (open) {
      node.eventMode = 'static';
      node.cursor = 'pointer';
      node.hitArea = { contains: (x, y) => x * x + y * y <= (NODE_R + 10) * (NODE_R + 10) };
      node.on('pointerdown', () => node.scale.set(0.92));
      node.on('pointerupoutside', () => node.scale.set(1));
      node.on('pointerup', () => {
        node.scale.set(1);
        this._callbacks.audio?.play('button_tap');
        this._callbacks.onSelectLevel?.(n.levelId);
      });
    }

    if (isNext) {
      const ring = new Graphics();
      ring.circle(0, 0, NODE_R + 12).stroke({ color: WHITE, width: 4 });
      ring.x = n.x; ring.y = n.y;
      this._container.addChild(ring);
      // A gold arrow bobs above the node: "play me".
      const marker = new Graphics();
      marker.poly([-13, -12, 13, -12, 13, -2, 22, -2, 0, 18, -22, -2, -13, -2]).fill(GOLD).stroke({ color: INK, width: 3 });
      marker.poly([-9, -9, 9, -9, 9, -4, -9, -4]).fill({ color: WHITE, alpha: 0.45 });
      marker.x = n.x; marker.y = n.y - NODE_R - 30;
      this._container.addChild(node);
      this._container.addChild(marker);
      this._current = { node, ring, marker, baseY: marker.y };
    } else {
      this._container.addChild(node);
    }
  }

  _header(world, accent) {
    const w = this._appW;
    const band = new Graphics();
    band.rect(0, 0, w, 96).fill(new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
      colorStops: [{ offset: 0, color: 0x17143A }, { offset: 1, color: 0x2B2760 }] }));
    band.rect(0, 94, w, 4).fill(GOLD_DEEP);
    band.rect(0, 98, w, 3).fill({ color: 0x000000, alpha: 0.25 });
    this._container.addChild(band);

    const rb = ribbon(world.name.toUpperCase(), 240, { size: 22, color: accent === ACCENT.world1 ? 0xE8453C : shade(accent, 0.95) });
    rb.x = w / 2; rb.y = 34;
    rb.scale.set(0.92);
    this._container.addChild(rb);

    const cb = this._callbacks;
    const back = roundButton(uiIcon('back', 20, '←'), { r: 20, color: 0x2F7FE0, onTap: () => { cb.audio?.play('button_tap'); cb.onBack?.(); } });
    back.x = 28; back.y = 34;
    this._container.addChild(back);
    const shop = roundButton(uiIcon('coin', 26, '◆'), { r: 20, color: 0xF0A020, onTap: () => { cb.audio?.play('button_tap'); cb.onShop?.(); } });
    shop.x = w - 28; shop.y = 34;
    this._container.addChild(shop);

    // Row 2: coins · world dots / arrows · trophies.
    const pill = new Graphics();
    pill.roundRect(12, 62, 86, 26, 13).fill(0x14112F).stroke({ color: GOLD_DEEP, width: 2 });
    this._container.addChild(pill);
    const coin = uiIcon('coin', 22, '◆'); coin.x = 26; coin.y = 75;
    this._container.addChild(coin);
    const coins = bodyText(String(this._progress.coins ?? 0), 15, 0xFFE08A);
    coins.anchor.set(0, 0.5); coins.x = 42; coins.y = 75;
    this._container.addChild(coins);

    const cx = w / 2;
    for (let i = 0; i < MAP_WORLDS.length; i++) {
      const d = new Graphics();
      const on = i + 1 === this._page;
      d.circle(cx + (i - 1) * 20, 75, on ? 6.5 : 5).fill(on ? GOLD : 0x5E5A80).stroke({ color: INK, width: 2 });
      this._container.addChild(d);
    }
    if (this._page > 1) {
      const prev = roundButton(uiIcon('back', 16, '◀'), { r: 14, color: 0x3A3662, onTap: () => this._switch(this._page - 1) });
      prev.x = cx - 58; prev.y = 75;
      this._container.addChild(prev);
    }
    if (this._page < MAP_WORLDS.length) {
      const next = roundButton(uiIcon('back', 16, '▶', { flipX: true }), { r: 14, color: 0x3A3662, onTap: () => this._switch(this._page + 1) });
      next.x = cx + 58; next.y = 75;
      this._container.addChild(next);
    }
    if (cb.onAchievements) {
      const tr = roundButton(uiIcon('trophy', 20, '🏆'), { r: 15, color: 0x8B4FE0, onTap: () => { cb.audio?.play('button_tap'); cb.onAchievements(); } });
      tr.x = w - 28; tr.y = 75;
      this._container.addChild(tr);
    }
  }

  _switch(page) {
    this._callbacks.audio?.play('button_tap');
    this._page = page;
    this._container.removeChildren().forEach(c => c.destroy({ children: true }));
    this._current = null;
    this._repairAnims = [];
    this._build();
  }
}
