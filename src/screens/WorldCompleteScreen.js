// WorldCompleteScreen — the end-of-world ceremony (rules: src/game/worldComplete.js).
//
// Plays after the normal win screen of a world's last level, on NEXT, once per world:
//   1. COMPLETE  the finished world's map behind a trophy in gold rays, "WORLD n COMPLETE!",
//                the world's stars counting up, and a gift the player taps open.
//   2. OPENED    the gift bursts into its coins and boosters (already credited by the caller),
//                NEXT WORLD appears.
//   3. REVEAL    the next world's map fades in with its name ribbon and one line on what is new
//                there; LET'S GO hands over to the map, where the toy car drives on.
// Every tap is ignored for MIN_HOLD after a phase starts, so a stray tap from the win screen
// cannot skip it. The back key (skip()) steps through the same phases.
import { Container, Graphics, Sprite, Assets } from 'pixi.js';
import { uiIcon, boosterIcon } from '../renderer/UIIcon.js';
import { panel, ribbon, button, titleText, bodyText, GOLD } from '../renderer/PremiumUI.js';
import { INK, WHITE } from '../renderer/ToyStyle.js';
import { ConfettiSystem } from './WinScreen.js';

const _B = import.meta.env.BASE_URL;
const MIN_HOLD = 0.4;
const BOOSTER_ICON = { bombs: ['bomb', '💣'], freeze: ['freeze', '❄'], colorChange: ['colorchange', '🎨'] };
const CONFETTI = [0xFF3D3D, 0x2F8CFF, 0x2FCC55, 0xFFD42A, 0xA35CFF, 0xFF8A1C];

const easeOutBack = (k) => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

function mapSprite(theme, w, h, onReady) {
  const url = `${_B}sprites/designed/map-${theme}.png`;
  const make = (tex) => { const sp = new Sprite(tex); sp.width = w; sp.height = h; return sp; };
  const tex = Assets.get(url);
  if (tex) return make(tex);
  Assets.load(url).then(t => onReady?.(make(t))).catch(() => {});
  return null;
}

export class WorldCompleteScreen {
  /**
   * @param {{ world: object, next: object, stars: number, maxStars: number,
   *           reward: { coins: number, boosters: object }, teaser: string,
   *           audio?: object, onDone: Function }} o
   */
  constructor(stage, appW, appH, o) {
    this._o = o; this._w = appW; this._h = appH;
    this._t = 0; this._phaseT = 0; this._phase = 'complete';
    this._gone = false;
    this._root = new Container();
    this._root.eventMode = 'static';
    this._root.hitArea = { contains: () => true };   // swallow every tap behind the ceremony
    stage.addChild(this._root);

    this._bgLayer = new Container();
    this._root.addChild(this._bgLayer);
    this._setMap(o.world.theme);
    // The map stays recognisable but quiet: a deep indigo wash, darker at the top and bottom.
    const shade = new Graphics();
    shade.rect(0, 0, appW, appH).fill({ color: 0x120F30, alpha: 0.66 });
    for (let i = 0; i < 12; i++) {
      const a = 0.05 * (1 - i / 12);
      shade.rect(0, i * 14, appW, 14).fill({ color: 0x120F30, alpha: a * 3 });
      shade.rect(0, appH - (i + 1) * 14, appW, 14).fill({ color: 0x120F30, alpha: a * 3 });
    }
    this._root.addChild(shade);

    this._content = new Container();
    this._root.addChild(this._content);
    this._fx = new Container();
    this._root.addChild(this._fx);
    this._confetti = new ConfettiSystem(this._fx, appW, appH);

    this._buildComplete();
    o.audio?.play('win_fanfare');
    this._confetti.burstUp(40, CONFETTI);
  }

  get phase() { return this._phase; }

  _setMap(theme) {
    const put = (sp) => {
      if (this._gone || !sp) return;
      sp.alpha = this._bgLayer.children.length ? 0 : 1;   // a second map fades in over the first
      this._bgLayer.addChild(sp);
      this._fadeMap = sp.alpha < 1 ? sp : null;
    };
    put(mapSprite(theme, this._w, this._h, put));
  }

  // ── 1. WORLD COMPLETE ───────────────────────────────────────────────────────
  _buildComplete() {
    const { world, stars, maxStars } = this._o;
    const w = this._w, c = this._content, cx = w / 2;

    const label = bodyText(`WORLD ${world.page}`, 18, GOLD);
    label.x = cx; label.y = 74;
    const rb = ribbon(world.name.toUpperCase(), 280, { size: 28 });
    rb.x = cx; rb.y = 118;
    c.addChild(label, rb);

    // Trophy in slowly turning gold rays.
    this._rays = new Container();
    this._rays.x = cx; this._rays.y = 268;
    const rays = new Graphics();
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * Math.PI * 2, a1 = a0 + Math.PI / 22;
      rays.poly([0, 0, Math.cos(a0) * 200, Math.sin(a0) * 200, Math.cos(a1) * 200, Math.sin(a1) * 200]).fill({ color: GOLD, alpha: 0.16 });
    }
    for (const [r, a] of [[130, 0.06], [100, 0.08], [74, 0.12], [50, 0.16]]) rays.circle(0, 0, r).fill({ color: 0xFFE9A0, alpha: a });
    this._rays.addChild(rays);
    c.addChild(this._rays);
    this._trophy = uiIcon('trophy', 150, '🏆');
    this._trophy.x = cx; this._trophy.y = 268;
    this._trophy.scale.set(0);
    this._trophyScale = 150 / Math.max(1, this._trophyBase());
    c.addChild(this._trophy);

    const title = titleText('WORLD COMPLETE!', 38, GOLD);
    title.x = cx; title.y = 392;
    c.addChild(title);

    // Stars collected in this world, counting up.
    const star = uiIcon('star-filled', 34, '★');
    this._starText = titleText(`0 / ${maxStars}`, 28, WHITE);
    this._starText.anchor.set(0, 0.5);
    const rowW = 34 + 10 + this._measure(`${stars} / ${maxStars}`, 28);
    star.x = cx - rowW / 2 + 17; star.y = 446;
    this._starText.x = cx - rowW / 2 + 44; this._starText.y = 446;
    c.addChild(star, this._starText);
    this._starCount = 0;

    // The gift.
    const PW = 320, PH = 230;
    this._giftPanel = new Container();
    this._giftPanel.x = (w - PW) / 2; this._giftPanel.y = 494;
    this._giftPanel.addChild(panel(PW, PH));
    const gl = bodyText('WORLD REWARD', 16, GOLD);
    gl.x = PW / 2; gl.y = 32;
    this._giftPanel.addChild(gl);
    this._gift = uiIcon('gift', 116, '🎁');
    this._gift.x = PW / 2; this._gift.y = 120;
    this._giftBase = this._gift.scale.x;
    this._giftPanel.addChild(this._gift);
    this._tapHint = bodyText('TAP TO OPEN', 18, WHITE);
    this._tapHint.x = PW / 2; this._tapHint.y = 196;
    this._giftPanel.addChild(this._tapHint);
    this._giftPanel.eventMode = 'static';
    this._giftPanel.cursor = 'pointer';
    this._giftPanel.on('pointertap', () => this._open());
    c.addChild(this._giftPanel);
  }

  _trophyBase() { return this._trophy.texture ? Math.max(this._trophy.texture.width, this._trophy.texture.height) : 150; }

  _measure(str, size) { const t = titleText(str, size); const wd = t.width; t.destroy(); return wd; }

  // ── 2. The gift opens ───────────────────────────────────────────────────────
  _open() {
    if (this._phase !== 'complete' || this._phaseT < MIN_HOLD) return;
    this._phase = 'opened'; this._phaseT = 0;
    this._o.audio?.play('daily_reward');
    this._o.audio?.play('coin_collect');
    this._starCount = this._o.stars;
    this._confetti.burstUp(46, CONFETTI);
    this._giftPanel.eventMode = 'none';
    this._gift.visible = false;
    this._tapHint.visible = false;

    const { coins, boosters } = this._o.reward;
    const items = [['coin', '🪙', `+${coins}`, null]];
    for (const [k, n] of Object.entries(boosters)) items.push([k, null, `x${n}`, BOOSTER_ICON[k]]);
    const PW = 320, gap = items.length > 3 ? 72 : 88, x0 = PW / 2 - ((items.length - 1) * gap) / 2;
    this._items = items.map(([key, emoji, txt, bi], i) => {
      const it = new Container();
      it.x = x0 + i * gap; it.y = 112;
      const ic = bi ? boosterIcon(bi[0], 58, bi[1]) : uiIcon('coin', 54, emoji);
      ic.y = -14;
      const tx = titleText(txt, 24, bi ? WHITE : GOLD);
      tx.y = 40;
      it.addChild(ic, tx);
      it.scale.set(0);
      it._delay = 0.12 * i;
      this._giftPanel.addChild(it);
      return it;
    });

    const btn = button('NEXT WORLD', { variant: 'green', w: 270, h: 70, size: 28, icon: uiIcon('play', 24, '▶'), onTap: () => this._reveal() });
    btn.x = this._w / 2; btn.y = 784;
    btn.alpha = 0;
    this._content.addChild(btn);
    this._pulse = btn;
  }

  // ── 3. The next world ───────────────────────────────────────────────────────
  _reveal() {
    if (this._phase !== 'opened' || this._phaseT < MIN_HOLD) return;
    this._o.audio?.play('button_tap');
    this._phase = 'reveal'; this._phaseT = 0;
    this._content.destroy({ children: true });
    this._content = new Container();
    this._root.addChildAt(this._content, this._root.getChildIndex(this._fx));
    this._setMap(this._o.next.theme);

    const { next, teaser } = this._o;
    const w = this._w, cx = w / 2, c = this._content;
    const lead = bodyText('NEXT WORLD', 20, GOLD);
    lead.x = cx; lead.y = 214;
    const num = titleText(`WORLD ${next.page}`, 34, WHITE);
    num.x = cx; num.y = 262;
    const rb = ribbon(next.name.toUpperCase(), 300, { size: 30 });
    rb.x = cx; rb.y = 330;
    c.addChild(lead, num, rb);

    const PW = 320, PH = 150;
    const tp = new Container();
    tp.x = (w - PW) / 2; tp.y = 410;
    tp.addChild(panel(PW, PH));
    const nh = bodyText('WHAT\'S NEW', 15, GOLD);
    nh.x = PW / 2; nh.y = 34;
    const tt = bodyText(teaser, 18, WHITE, { wrap: PW - 50 });
    tt.x = PW / 2; tt.y = 88;
    tp.addChild(nh, tt);
    c.addChild(tp);

    const levels = bodyText(`Levels ${next.first}-${next.last}`, 16, 0xC9C3F0, { outline: true });
    levels.x = cx; levels.y = 596;
    c.addChild(levels);

    const go = button("LET'S GO!", { variant: 'green', w: 270, h: 72, size: 30, onTap: () => this._finish() });
    go.x = cx; go.y = 784;
    c.addChild(go);
    this._pulse = go;
    c.alpha = 0;
    this._confetti.spawn(30);
  }

  _finish() {
    if (this._phase !== 'reveal' || this._phaseT < MIN_HOLD || this._gone) return;
    this._o.audio?.play('level_start');
    const done = this._o.onDone;
    this.destroy();
    done?.();
  }

  /** Back key: one step forward (open the gift, show the next world, go). */
  skip() {
    this._phaseT = Math.max(this._phaseT, MIN_HOLD);
    if (this._phase === 'complete') this._open();
    else if (this._phase === 'opened') this._reveal();
    else this._finish();
  }

  update(dt) {
    if (this._gone) return false;
    this._t += dt; this._phaseT += dt;
    this._confetti.update(dt);
    if (this._fadeMap && !this._fadeMap.destroyed) {
      this._fadeMap.alpha = Math.min(1, this._fadeMap.alpha + dt / 0.6);
      if (this._fadeMap.alpha >= 1) this._fadeMap = null;
    }
    if (this._phase === 'complete' || this._phase === 'opened') {
      if (this._rays && !this._rays.destroyed) this._rays.rotation += dt * 0.25;
      if (this._trophy && !this._trophy.destroyed) {
        const k = Math.min(1, this._t / 0.55);
        const s = (this._trophyScale ?? 1) * easeOutBack(k) * (1 + 0.03 * Math.sin(this._t * 3));
        this._trophy.scale.set(Math.max(0, s));
      }
      // Stars count up after the trophy lands.
      const target = this._o.stars;
      if (this._t > 0.5 && this._starCount < target) {
        const prev = Math.floor(this._starCount);
        this._starCount = Math.min(target, this._starCount + dt * Math.max(12, target / 1.2));
        if (Math.floor(this._starCount) !== prev && Math.floor(this._starCount) % 3 === 0) this._o.audio?.play('star_earn');
      }
      if (this._starText && !this._starText.destroyed) this._starText.text = `${Math.floor(this._starCount)} / ${this._o.maxStars}`;
    }
    if (this._phase === 'complete' && this._gift && !this._gift.destroyed) {
      // The gift wobbles and bounces, asking to be tapped.
      const b = this._giftBase;
      const hop = Math.max(0, Math.sin(this._t * 4.2));
      this._gift.rotation = 0.09 * Math.sin(this._t * 9) * hop;
      this._gift.scale.set(b * (1 + 0.06 * hop));
      if (this._tapHint && !this._tapHint.destroyed) this._tapHint.alpha = 0.65 + 0.35 * Math.sin(this._t * 5);
    }
    if (this._phase === 'opened') {
      for (const it of this._items ?? []) {
        if (it.destroyed) continue;
        const k = Math.max(0, Math.min(1, (this._phaseT - it._delay) / 0.4));
        it.scale.set(easeOutBack(k));
      }
      if (this._pulse && !this._pulse.destroyed) this._pulse.alpha = Math.min(1, Math.max(0, (this._phaseT - 0.5) / 0.3));
    }
    if (this._phase === 'reveal' && this._content && !this._content.destroyed) {
      this._content.alpha = Math.min(1, this._phaseT / 0.45);
    }
    if (this._pulse && !this._pulse.destroyed && this._pulse.alpha >= 1) this._pulse.scale.set(1 + 0.035 * Math.sin(this._t * 4.5));
    return true;
  }

  destroy() {
    if (this._gone) return;
    this._gone = true;
    this._confetti.destroy();
    this._root.destroy({ children: true });
  }
}
