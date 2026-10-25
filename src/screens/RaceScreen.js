// RaceScreen — the Traffic Race card (docs/superpowers/specs/2026-10-19-race-design.md).
//
// One card, four faces, chosen from the race object:
//   no race   — the rules and the prize, START RACE (headline "NEW! TRAFFIC RACE" the first time)
//   running   — five tracks with each racer's toy car, hearts, time left, PLAY NEXT LEVEL
//   decided   — the result headline, the tracks, the prize, CLAIM (or OK when nothing was won)
// Rules live in src/game/race.js; this file only draws. The caller rebuilds the card after START.
import { Container, Graphics, Sprite, Assets } from 'pixi.js';
import { uiIcon, boosterIcon } from '../renderer/UIIcon.js';
import { panel, ribbon, button, roundButton, titleText, bodyText, backdrop, GOLD } from '../renderer/PremiumUI.js';
import { INK, WHITE, shade } from '../renderer/ToyStyle.js';
import { RACE_GOAL, RACE_HEARTS, RACE_PRIZES, raceStandings, racePrize } from '../game/race.js';

const _B = import.meta.env.BASE_URL;
const PW = 350;
const CAR_COLOR = { Red: 0xFF3D3D, Blue: 0x2F8CFF, Green: 0x2FCC55, Yellow: 0xFFD42A, Purple: 0xA35CFF, Orange: 0xFF8A1C };
const PLACE = ['1ST', '2ND', '3RD', '4TH', '5TH'];
const BOOSTER_ICON = { colorChange: ['colorchange', '🎨'], freeze: ['freeze', '❄'], bombs: ['bomb', '💣'] };

function timeLeft(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m left` : `${m}m left`;
}

export class RaceScreen {
  /**
   * @param {{ race: object|null, intro: boolean, canStart: boolean, now: number,
   *           onStart: Function, onPlay: Function, onClaim: Function, onClose: Function, audio?: object }} o
   */
  constructor(stage, appW, appH, o) {
    this._o = o;
    this._w = appW; this._h = appH;
    this._t = 0;
    this._cars = [];
    this._container = new Container();
    stage.addChild(this._container);
    this._build();
  }

  destroy() { this._container.destroy({ children: true }); }

  /** Cars ease from their previous step to the current one; the action button pulses. */
  update(dt) {
    this._t += dt;
    const k = Math.min(1, this._t / 0.9), e = 1 - Math.pow(1 - k, 3);
    for (const c of this._cars) if (!c.sp.destroyed) c.sp.x = c.from + (c.to - c.from) * e;
    if (this._pulse && !this._pulse.destroyed) this._pulse.scale.set(1 + 0.035 * Math.sin(this._t * 4.5));
  }

  _tap(fn) { return () => { this._o.audio?.play('button_tap'); fn?.(); }; }

  _build() {
    const { race } = this._o;
    const w = this._w, h = this._h;
    this._container.addChild(backdrop(w, h, 0.78));
    const decided = !!race?.result;
    const PH = race ? 560 : 580;
    const card = new Container();
    card.x = (w - PW) / 2; card.y = (h - PH) / 2;
    this._container.addChild(card);
    card.addChild(panel(PW, PH));
    const rb = ribbon('TRAFFIC RACE', 270, { size: 27 });
    rb.x = PW / 2; rb.y = 2;
    card.addChild(rb);
    if (!decided) {
      const close = roundButton(uiIcon('close', 22, '✕'), { r: 22, color: 0xE8453C, onTap: this._tap(this._o.onClose) });
      close.x = PW - 14; close.y = 14;
      card.addChild(close);
    }
    if (!race) this._buildStart(card, PH);
    else this._buildRace(card, PH, decided);
  }

  // ── No race: rules + prize + START ──────────────────────────────────────────
  _buildStart(card, PH) {
    const { intro, canStart } = this._o;
    const head = titleText(intro ? 'NEW! RACE YOUR RIVALS' : 'READY FOR A RACE?', 21, GOLD);
    head.x = PW / 2; head.y = 70;
    card.addChild(head);
    this._buildTracks(card, 104, null);   // everyone on the start line
    const rules = [
      ['car', '🚗', `First to win ${RACE_GOAL} new levels`],
      ['heart', '❤', `${RACE_HEARTS} race hearts: a lost level costs one`],
      ['timer', '⏱', '24 hours to finish'],
    ];
    rules.forEach(([icon, emoji, text], i) => {
      const y = 326 + i * 30;
      const ic = uiIcon(icon, 22, emoji); ic.x = 40; ic.y = y;
      const tx = bodyText(text, 15, WHITE, { outline: false, align: 'left' });
      tx.anchor.set(0, 0.5); tx.x = 60; tx.y = y;
      card.addChild(ic, tx);
    });
    this._buildPrize(card, 424, RACE_PRIZES[0], '1ST PLACE');
    const label = canStart ? 'START RACE' : 'NO RACE NOW';
    const go = button(label, { variant: canStart ? 'green' : 'blue', w: 250, h: 66, size: 27,
      onTap: canStart ? this._tap(this._o.onStart) : this._tap(this._o.onClose) });
    go.x = PW / 2; go.y = PH - 56;
    card.addChild(go);
    if (canStart) this._pulse = go;
  }

  // ── A race: tracks + status + PLAY / CLAIM ──────────────────────────────────
  _buildRace(card, PH, decided) {
    const { race, now } = this._o;
    const res = race.result;
    const prize = racePrize(race);
    const headline = !decided ? 'WIN LEVELS TO MOVE AHEAD'
      : res.outcome === 'finished' ? (res.place === 1 ? 'YOU WON THE RACE!' : `YOU FINISHED ${PLACE[res.place - 1]}!`)
      : res.outcome === 'out' ? 'OUT OF HEARTS' : "TIME'S UP";
    const head = titleText(headline, decided ? 23 : 19, decided && res.place === 1 ? GOLD : WHITE);
    head.x = PW / 2; head.y = 70;
    card.addChild(head);

    this._buildTracks(card, 100, race);

    // Status row: hearts and the clock.
    const sy = 318;
    for (let i = 0; i < RACE_HEARTS; i++) {
      const hp = uiIcon('heart', 26, '❤', { tint: i < race.hearts ? undefined : 0x4A4570 });
      hp.x = 44 + i * 30; hp.y = sy;
      card.addChild(hp);
    }
    if (!decided) {
      const clock = uiIcon('timer', 22, '⏱'); clock.x = PW - 128; clock.y = sy;
      const tl = bodyText(timeLeft(race.endsAt - now), 15, WHITE, { outline: false, align: 'left' });
      tl.anchor.set(0, 0.5); tl.x = PW - 112; tl.y = sy;
      card.addChild(clock, tl);
    }

    if (decided) {
      if (prize) this._buildPrize(card, 372, prize, `${PLACE[res.place - 1]} PLACE PRIZE`);
      else {
        const msg = bodyText(res.outcome === 'out' ? 'So close! Start a new race any time.'
          : 'The clock ran out. Start a new race any time.', 15, 0xC9C3F0, { outline: false, wrap: 280 });
        msg.x = PW / 2; msg.y = 400;
        card.addChild(msg);
      }
      const btn = button(prize ? 'CLAIM' : 'OK', { variant: prize ? 'green' : 'blue', w: 230, h: 66, size: 28, onTap: this._tap(this._o.onClaim) });
      btn.x = PW / 2; btn.y = PH - 56;
      card.addChild(btn);
      this._pulse = btn;
    } else {
      this._buildPrize(card, 372, RACE_PRIZES[0], '1ST PLACE');
      const play = button('PLAY NEXT LEVEL', { variant: 'green', w: 296, h: 66, size: 22, icon: uiIcon('play', 24, '▶'), onTap: this._tap(this._o.onPlay) });
      play.x = PW / 2; play.y = PH - 56;
      card.addChild(play);
      this._pulse = play;
    }
  }

  // Five lanes: name on the left, a road from START to the flag, the racer's toy car on it.
  _buildTracks(card, top, race) {
    const rows = race ? raceStandings(race) : [
      { name: 'YOU', color: 'Red', you: true, progress: 0 },
      ...['Blue', 'Green', 'Purple', 'Orange'].map(c => ({ name: '???', color: c, you: false, progress: 0 })),
    ];
    const ROW = 40, X0 = 138, X1 = PW - 34, NAME_W = 84;
    const g = new Graphics();
    rows.forEach((r, i) => {
      const y = top + i * ROW + ROW / 2;
      if (r.you) g.roundRect(14, y - ROW / 2 + 3, PW - 28, ROW - 6, 12).fill({ color: GOLD, alpha: 0.18 }).stroke({ color: GOLD, width: 2 });
      g.roundRect(X0 - 6, y - 9, X1 - X0 + 18, 18, 9).fill(0x2A2650).stroke({ color: INK, width: 2 });
      for (let s = 1; s < RACE_GOAL; s++) g.circle(X0 + (X1 - X0) * s / RACE_GOAL, y, 2).fill({ color: WHITE, alpha: 0.35 });
    });
    card.addChild(g);
    // Finish flag: a chequered post at the end of the tracks.
    const flag = new Graphics();
    const fx = X1 + 6, fy = top - 8, fh = rows.length * ROW + 8;
    flag.rect(fx - 1.5, fy, 3, fh).fill(INK);
    for (let r = 0; r < Math.ceil(fh / 6); r++) for (let c = 0; c < 2; c++)
      flag.rect(fx + 2 + c * 6, fy + r * 6, 6, 6).fill((r + c) % 2 ? INK : WHITE);
    card.addChild(flag);

    rows.forEach((r, i) => {
      const y = top + i * ROW + ROW / 2;
      const nm = bodyText(r.you ? 'YOU' : r.name, r.you ? 15 : 12, r.you ? GOLD : WHITE, { outline: true, align: 'left' });
      nm.anchor.set(0, 0.5); nm.x = 22; nm.y = y;
      if (nm.width > NAME_W) nm.scale.set(NAME_W / nm.width);   // long rival names shrink, never collide
      card.addChild(nm);
      const frac = Math.min(1, (r.progress ?? 0) / RACE_GOAL);
      const START = X0 + 14;   // the car's nose sits on the start line, clear of the win count
      const to = START + (X1 - START) * frac;
      const from = START;   // every opening replays the race from the start line
      const tex = Assets.get(`${_B}sprites/designed/car-${r.color.toLowerCase()}-processed.png`);
      let sp;
      if (tex) {
        sp = new Sprite(tex);
        sp.anchor.set(0.5); sp.rotation = Math.PI / 2;
        sp.scale.set(30 / tex.height);
      } else {
        sp = new Graphics().roundRect(-14, -8, 28, 16, 5).fill(CAR_COLOR[r.color] ?? 0xffffff).stroke({ color: INK, width: 2 });
      }
      sp.x = from; sp.y = y;
      card.addChild(sp);
      this._cars.push({ sp, from, to });
      if (race && r.wins != null) {
        const n = bodyText(String(r.wins), 13, r.you ? GOLD : WHITE);
        n.x = X0 - 20; n.y = y;
        card.addChild(n);
      }
    });
  }

  // The prize strip: coins + boosters, with a label above.
  _buildPrize(card, y, prize, label) {
    const g = new Graphics();
    g.roundRect(24, y - 10, PW - 48, 70, 16).fill(shade(0x2B2760, 0.85)).stroke({ color: GOLD, width: 2.5 });
    card.addChild(g);
    const lb = bodyText(label, 13, GOLD);
    lb.x = PW / 2; lb.y = y;
    card.addChild(lb);
    const items = [['coin', '◆', prize.coins, null]];
    for (const [k, n] of Object.entries(prize.boosters ?? {})) items.push([k, null, n, BOOSTER_ICON[k]]);
    const gap = 74, x0 = PW / 2 - ((items.length - 1) * gap) / 2;
    items.forEach(([key, emoji, n, bi], i) => {
      const x = x0 + i * gap;
      const ic = bi ? boosterIcon(bi[0], 30, bi[1]) : uiIcon('coin', 28, emoji);
      ic.x = x - 14; ic.y = y + 32;
      const tx = bodyText(bi ? `x${n}` : String(n), 17, bi ? WHITE : GOLD);
      tx.anchor.set(0, 0.5); tx.x = x + 4; tx.y = y + 32;
      card.addChild(ic, tx);
    });
  }
}
