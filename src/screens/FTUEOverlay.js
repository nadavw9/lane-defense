// FTUEOverlay — visual tutorial layers for early levels:
//
//   1. Dim mask — covers inactive lane columns and shooter columns.
//
//   2. Level-specific hints:
//        L1: Animated arrow + hintText (dismisses on first deploy).
//            HUD labels: "TIMER ↑" (left) and "↑ COINS" (right) below the HUD bar,
//            auto-fade after 8 s.
//        L2: Color-match hint banner (auto-fade 8 s).
//            After first kill: combo hint banner shows for 5 s.
//        L3: Area labels "↑ INCOMING CARS" and "↓ YOUR SHOOTERS" auto-fade 6 s.
//            Plus dim mask (lanes 0-2, cols 0-2 already handled by mask).
//        Other levels with hintText: auto-hiding text banner (8 s).
//
//   3. onFirstDeploy(damage?) — hides the L1 arrow; for early levels (L1-L5)
//      shows a one-time "Deals [damage] damage!" tip at the shooter area.
//   4. onFirstKill() — triggers the L2 combo hint.
//
// update(dt) must be called from the render ticker while the overlay is live.
import { Container, Graphics, Text } from 'pixi.js';
import {
  ROAD_TOP_Y, ROAD_BOTTOM_Y,
} from '../renderer/LaneRenderer.js';
import {
  SHOOTER_AREA_Y,
  TOP_RADIUS,
} from '../renderer/ShooterRenderer.js';
import { getColumnScreenX, getColumnScreenY } from '../renderer/PositionRegistry.js';

const HUD_H          = 44;
const HINT_AUTO_HIDE = 8;  // seconds for banner auto-hide

export class FTUEOverlay {
  constructor(stage, appW, appH, levelConfig) {
    this._container = new Container();
    stage.addChild(this._container);

    this._appW         = appW;
    this._elapsed      = 0;
    this._levelId      = levelConfig.id;
    this._hintVisible  = !!levelConfig.hintText;
    this._isArrow      = !!levelConfig.showArrow;
    this._ring         = null;
    this._arrowGroup   = null;
    this._arrowBaseY   = 0;
    this._banner       = null;
    this._hudHints     = null;
    this._areaLabels   = null;
    this._comboHint    = null;
    this._damageTip    = null;
    this._damageTipT   = 0;
    this._comboHintT   = 0;
    this._comboHintOn  = false;

    this._buildDimMask(appW, levelConfig);

    if (levelConfig.showArrow && levelConfig.hintText) {
      this._buildArrowHint(appW, levelConfig.hintText);
      this._buildHUDHints(appW);   // L1: timer + coins labels
    } else if (levelConfig.hintText) {
      this._buildBanner(appW, levelConfig.hintText);
    }

    if (levelConfig.showAreaLabels) {
      this._buildAreaLabels(appW);  // L3
    }
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  // Call after the first deploy.  For early levels, optionally shows a
  // one-time damage tooltip near the shooter area.
  onFirstDeploy(damage) {
    // Dismiss arrow hint on L1.
    if (this._isArrow && this._hintVisible) {
      this._hintVisible = false;
      if (this._arrowGroup) this._arrowGroup.visible = false;
      if (this._ring)       this._ring.visible       = false;
    }

    // Show damage tooltip for first deploy (levels 1-5 only).
    if (damage != null && this._damageTip === null) {
      this._damageTip = this._buildDamageTip(this._appW, damage);
      this._damageTipT = 3;
    }
  }

  // Call when the player scores their first kill (used by L2 combo hint).
  onFirstKill() {
    if (this._levelId !== 2 || this._comboHintOn) return;
    this._comboHintOn = true;
    this._comboHint   = this._buildComboHint(this._appW);
    this._comboHintT  = 5;
  }

  // Call every render frame.
  update(dt) {
    this._elapsed += dt;

    // ── Arrow hint (L1) ────────────────────────────────────────────────────
    if (this._isArrow && this._hintVisible) {
      if (this._arrowGroup) {
        this._arrowGroup.y     = this._arrowBaseY + Math.sin(this._elapsed * 2.8) * 8;
        this._arrowGroup.alpha = 0.68 + Math.sin(this._elapsed * 2.1) * 0.28;
      }
      if (this._ring) {
        const t     = this._elapsed * 4.2;
        const scale = 1 + Math.sin(t) * 0.14;
        const alpha = 0.42 + Math.sin(t) * 0.38;
        this._ring.clear();
        this._ring.circle(getColumnScreenX(0), getColumnScreenY(), TOP_RADIUS * 1.45 * scale);
        this._ring.stroke({ color: 0xffee44, width: 3.5, alpha });
      }
    }

    // ── Auto-fade banner (non-arrow hints) ────────────────────────────────
    if (!this._isArrow && this._hintVisible && this._banner) {
      if (this._elapsed >= HINT_AUTO_HIDE) {
        this._hintVisible    = false;
        this._banner.visible = false;
      } else {
        const fadeStart = HINT_AUTO_HIDE - 2;
        if (this._elapsed > fadeStart) {
          this._banner.alpha = 1 - (this._elapsed - fadeStart) / 2;
        }
      }
    }

    // ── HUD hints auto-fade (L1) ─────────────────────────────────────────
    if (this._hudHints) {
      if (this._elapsed >= HINT_AUTO_HIDE) {
        this._hudHints.visible = false;
      } else {
        const fadeStart = HINT_AUTO_HIDE - 2;
        if (this._elapsed > fadeStart) {
          this._hudHints.alpha = 1 - (this._elapsed - fadeStart) / 2;
        }
      }
    }

    // ── Area labels auto-fade (L3) ────────────────────────────────────────
    if (this._areaLabels) {
      if (this._elapsed >= 6) {
        this._areaLabels.visible = false;
      } else if (this._elapsed > 4) {
        this._areaLabels.alpha = 1 - (this._elapsed - 4) / 2;
      }
    }

    // ── Damage tooltip float + fade ───────────────────────────────────────
    if (this._damageTip && this._damageTipT > 0) {
      this._damageTipT -= dt;
      this._damageTip.y -= 22 * dt;
      if (this._damageTipT < 1) {
        this._damageTip.alpha = Math.max(0, this._damageTipT);
      }
      if (this._damageTipT <= 0) {
        this._damageTip.destroy({ children: true });
        this._damageTip = null;
      }
    }

    // ── Combo hint timer (L2) ─────────────────────────────────────────────
    if (this._comboHint && this._comboHintT > 0) {
      this._comboHintT -= dt;
      if (this._comboHintT < 1) {
        this._comboHint.alpha = Math.max(0, this._comboHintT);
      }
      if (this._comboHintT <= 0) {
        this._comboHint.destroy({ children: true });
        this._comboHint = null;
      }
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _buildDimMask(_w, _cfg) {
    // The 3D road renders only the active lanes — no inactive lane area to dim.
    // Previously this drew a black trapezoid over inactive PixiJS lane columns,
    // but that overlay covers the 3D scene now that lane count adapts in 3D.
  }

  _buildBanner(w, text) {
    const grp = new Container();
    this._container.addChild(grp);
    this._banner = grp;

    const bg = new Graphics();
    bg.roundRect(20, 0, w - 40, 44, 10);
    bg.fill({ color: 0x000000, alpha: 0.65 });
    bg.roundRect(20, 0, w - 40, 44, 10);
    bg.stroke({ color: 0x44aaff, width: 1.5, alpha: 0.50 });
    grp.addChild(bg);

    const txt = new Text({
      text,
      style: {
        fontSize: 15, fontWeight: 'bold', fill: 0x88ccff, align: 'center',
        wordWrap: true, wordWrapWidth: w - 60,
        dropShadow: { color: 0x000000, blur: 4, distance: 2, alpha: 0.9 },
      },
    });
    txt.anchor.set(0.5, 0.5);
    txt.x = w / 2;
    txt.y = 22;
    grp.addChild(txt);

    grp.y = SHOOTER_AREA_Y - 54;
  }

  // HUD labels for L1: timer and coins explanations just below the HUD bar.
  _buildHUDHints(w) {
    const grp = new Container();
    this._container.addChild(grp);
    this._hudHints = grp;

    const style = {
      fontSize: 12, fontWeight: 'bold', align: 'center',
      dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.9 },
    };

    // Timer label (left-aligned, points upward)
    const timerTxt = new Text({ text: '↑ TIMER\nSurvive until it\nruns out!', style: { ...style, fill: 0x44cc88 } });
    timerTxt.anchor.set(0, 0);
    timerTxt.x = 8;
    timerTxt.y = HUD_H + 4;
    grp.addChild(timerTxt);

    // Coins label (right-aligned, points upward)
    const coinsTxt = new Text({ text: 'COINS ↑\nEarn by\nkilling cars', style: { ...style, fill: 0xf5c842 } });
    coinsTxt.anchor.set(1, 0);
    coinsTxt.x = w - 8;
    coinsTxt.y = HUD_H + 4;
    grp.addChild(coinsTxt);
  }

  // Area labels for L3: "INCOMING CARS" above lanes, "YOUR SHOOTERS" below.
  _buildAreaLabels(w) {
    const grp = new Container();
    this._container.addChild(grp);
    this._areaLabels = grp;

    const style = {
      fontSize: 14, fontWeight: 'bold', align: 'center',
      dropShadow: { color: 0x000000, blur: 4, distance: 2, alpha: 0.9 },
    };

    const carsLbl = new Text({ text: '↓  INCOMING CARS  ↓', style: { ...style, fill: 0xff8866 } });
    carsLbl.anchor.set(0.5, 0);
    carsLbl.x = w / 2;
    carsLbl.y = ROAD_TOP_Y + 4;
    grp.addChild(carsLbl);

    const shootersLbl = new Text({ text: '↑  YOUR SHOOTERS  ↑', style: { ...style, fill: 0x66aaff } });
    shootersLbl.anchor.set(0.5, 1);
    shootersLbl.x = w / 2;
    shootersLbl.y = SHOOTER_AREA_Y - 4;
    grp.addChild(shootersLbl);
  }

  // Floating "Deals X damage!" tooltip near the shooter area.
  _buildDamageTip(w, damage) {
    const tip = new Text({
      text: `This shooter deals ${damage} damage!`,
      style: {
        fontSize: 15, fontWeight: 'bold', fill: 0xffffff, align: 'center',
        dropShadow: { color: 0x000000, blur: 5, distance: 2, alpha: 0.9 },
      },
    });
    tip.anchor.set(0.5, 1);
    tip.x = w / 2;
    tip.y = SHOOTER_AREA_Y - 8;
    this._container.addChild(tip);
    return tip;
  }

  // Combo explanation banner shown after first kill on L2.
  _buildComboHint(w) {
    const grp = new Container();
    this._container.addChild(grp);

    const bg = new Graphics();
    bg.roundRect(20, 0, w - 40, 50, 10);
    bg.fill({ color: 0x1a0a00, alpha: 0.85 });
    bg.roundRect(20, 0, w - 40, 50, 10);
    bg.stroke({ color: 0xffcc44, width: 1.5, alpha: 0.70 });
    grp.addChild(bg);

    const txt = new Text({
      text: 'COMBO! Chain kills quickly for bonus coins\nand faster fire speed!',
      style: {
        fontSize: 14, fontWeight: 'bold', fill: 0xffee88, align: 'center',
        wordWrap: true, wordWrapWidth: w - 60,
        dropShadow: { color: 0x000000, blur: 4, distance: 2, alpha: 0.9 },
      },
    });
    txt.anchor.set(0.5, 0.5);
    txt.x = w / 2;
    txt.y = 25;
    grp.addChild(txt);

    // Position just above the HUD bar (centred vertically between HUD and road top)
    grp.y = HUD_H + 4;
    return grp;
  }

  _buildArrowHint(w, text) {
    const ring = new Graphics();
    this._ring = ring;
    this._container.addChild(ring);

    const grp = new Container();
    this._container.addChild(grp);
    this._arrowGroup = grp;

    grp.x = getColumnScreenX(0);

    const baseY = ROAD_BOTTOM_Y - 80;
    this._arrowBaseY = baseY;
    grp.y = baseY;

    const ag = new Graphics();
    ag.poly([0, -80, -22, -48, 22, -48]);
    ag.fill(0xffee44);
    ag.rect(-5, -48, 10, 48);
    ag.fill(0xffee44);
    grp.addChild(ag);

    const txt = new Text({
      text,
      style: {
        fontSize: 17, fontWeight: 'bold', fill: 0xffffff, align: 'center',
        wordWrap: true, wordWrapWidth: w - 60,
        dropShadow: { color: 0x000000, blur: 4, distance: 2, alpha: 0.9 },
      },
    });
    txt.anchor.set(0.5, 0);
    txt.x = w / 2 - grp.x;
    txt.y = 14;
    grp.addChild(txt);
  }
}
