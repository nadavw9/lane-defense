// RescueOverlay — shown after a lane breach.
//
// Sequence:
//   1. Instant red flash (0.45 s) covering the whole screen — breach impact feel.
//   2. Dark rescue panel fades in with three options:
//        "▶ CONTINUE"   — watch a rewarded ad, resume from the breach moment
//        "RETRY"        — free full level restart (no ad)
//        "LEVEL SELECT" — decline; level failed, back to the map
//
// The caller is responsible for calling update(dt) every render frame until
// the overlay is no longer needed.
import { Container, Graphics } from 'pixi.js';
import { uiIcon } from '../renderer/UIIcon.js';
import { panel, ribbon, button, titleText, bodyText, backdrop, GOLD } from '../renderer/PremiumUI.js';
import { INK, WHITE } from '../renderer/ToyStyle.js';
import { RESCUE_COIN_COST } from '../director/DirectorConfig.js';

const FLASH_DURATION = 0.45;   // seconds for the red screen flash

export class RescueOverlay {
  // Callbacks:
  //   onRescueAd()     — "CONTINUE" accepted; caller shows the rewarded ad then gs.rescue()
  //   onRescueCoins()  — "CONTINUE · coins" — shown only when the player can afford it
  //   onRetry()        — free full restart; caller destroys overlay and restarts the level
  //   onLevelSelect()  — decline; caller destroys overlay and returns to level select
  constructor(stage, appW, appH, gs, { onRescueAd, onRescueCoins, onRetry, onLevelSelect }) {
    this._container = new Container();
    stage.addChild(this._container);

    this._appW  = appW;
    this._appH  = appH;
    this._gs    = gs;

    this._flashLife  = FLASH_DURATION;
    this._panelBuilt = false;

    this._onRescueAd    = onRescueAd;
    this._onRescueCoins = onRescueCoins;
    this._onRetry       = onRetry;
    this._onLevelSelect = onLevelSelect;

    // The flash graphic is built immediately; the panel is built after the flash.
    this._flash = this._buildFlash();
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  // Call every render frame from the GameApp render ticker.
  update(dt) {
    if (this._panelBuilt) {
      this._t = (this._t ?? 0) + dt;
      if (this._pulse && !this._pulse.destroyed) this._pulse.scale.set(1 + 0.04 * Math.sin(this._t * 4.5));
      return;
    }

    this._flashLife -= dt;
    this._flash.alpha = Math.max(0, (this._flashLife / FLASH_DURATION) * 0.75);

    if (this._flashLife <= 0) {
      this._panelBuilt = true;
      this._buildPanel();
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _buildFlash() {
    const g = new Graphics();
    g.rect(0, 0, this._appW, this._appH);
    g.fill(0xff2020);
    g.alpha = 0.75;
    this._container.addChild(g);
    return g;
  }

  _buildPanel() {
    const { _appW: w, _appH: h, _gs: gs } = this;
    const c = new Container();
    this._container.addChild(c);
    c.addChild(backdrop(w, h, 0.78));

    const PW = 330;
    const PH = 470 + ((gs?.coins ?? 0) >= RESCUE_COIN_COST && this._onRescueCoins ? 76 : 0);
    const card = new Container();
    // Anchored to the 470px layout so CONTINUE never moves; extra rows grow downward.
    card.x = (w - PW) / 2; card.y = (h - 470) / 2 - 6;
    c.addChild(card);
    card.addChild(panel(PW, PH, { face: 0x4A2440 }));
    const rb = ribbon('BREACH!', 220, { size: 30 });
    rb.x = PW / 2; rb.y = 2;
    card.addChild(rb);

    // Warning medallion.
    const mg = new Graphics();
    mg.circle(PW / 2, 108, 50).fill({ color: 0xFF3D3D, alpha: 0.18 });
    mg.circle(PW / 2, 108, 38).fill(0xE8453C).stroke({ color: INK, width: 3.5 });
    mg.ellipse(PW / 2, 92, 24, 11).fill({ color: WHITE, alpha: 0.28 });
    card.addChild(mg);
    const ex = titleText('!', 46);
    ex.x = PW / 2; ex.y = 110;
    card.addChild(ex);

    // Loss-aversion line: how close the goal was.
    const goalLeft = gs?.goalProgress?.reduce((a, r) => a + r, 0) ?? 0;
    const head = titleText('A CAR BROKE THROUGH', 20, WHITE);
    head.x = PW / 2; head.y = 180;
    card.addChild(head);
    const goalTotal = gs?.goals?.reduce((a, g) => a + g.count, 0) ?? 0;
    const close = goalTotal > 0 && goalLeft <= goalTotal * 0.3;
    // A boss goal counts as "1" — it is not "one car left", it is a whole boss.
    const bossLevel = gs?.goals?.some(g => g.type === 'defeatBoss');
    const bossLights = (gs?.lanes ?? []).flatMap(l => l.cars).filter(c => c.sequence).reduce((a, c) => a + c.hp, 0);
    const sub = bodyText(bossLevel ? (bossLights > 0 ? `The boss has ${bossLights} light${bossLights === 1 ? '' : 's'} left — keep going?` : 'The boss is still out there — keep going?')
      : goalLeft <= 0 ? 'Keep going from right here?'
      : goalLeft === 1 ? 'Just ONE car left to win!'
      : close ? `Only ${goalLeft} cars left to win!` : 'Keep going from right here?', 16, GOLD, { outline: false });
    sub.x = PW / 2; sub.y = 212;
    card.addChild(sub);

    // CONTINUE — one-time rewarded-ad rescue; resumes from the breach moment.
    const play = uiIcon('play', 26, '▶');
    const cont = button('CONTINUE', { variant: 'green', w: 250, h: 76, size: 30, icon: play, sub: 'Watch a video', onTap: () => this._onRescueAd() });
    cont.x = PW / 2; cont.y = 290;
    card.addChild(cont);
    this._pulse = cont;

    // CONTINUE with coins — the no-ad option; only offered when affordable.
    let dy = 0;
    if ((gs?.coins ?? 0) >= RESCUE_COIN_COST && this._onRescueCoins) {
      const pay = button(String(RESCUE_COIN_COST), { variant: 'gold', w: 250, h: 66, size: 26,
        icon: uiIcon('coin', 26, '◆'), sub: 'Continue with coins', onTap: () => this._onRescueCoins() });
      pay.x = PW / 2; pay.y = 372;
      card.addChild(pay);
      dy = 76;
    }

    // RETRY — free, immediate full restart of the current level (no ad).
    const retry = button('RETRY', { variant: 'blue', w: 200, h: 58, size: 24, onTap: () => this._onRetry?.() });
    retry.x = PW / 2; retry.y = 372 + dy;
    card.addChild(retry);

    // Decline → back to level select (level failed).
    const give = bodyText('Give up', 15, 0xC9A3C0, { outline: false });
    give.x = PW / 2; give.y = 430 + dy;
    give.eventMode = 'static'; give.cursor = 'pointer';
    give.on('pointerup', () => this._onLevelSelect?.());
    card.addChild(give);
    const ul = new Graphics();
    ul.rect(PW / 2 - give.width / 2, 440 + dy, give.width, 1.5).fill({ color: 0xC9A3C0, alpha: 0.6 });
    card.addChild(ul);
  }
}
