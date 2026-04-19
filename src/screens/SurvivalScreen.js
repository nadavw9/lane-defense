// SurvivalScreen — pre-game screen for Survival / Endless mode.
//
// Shows rules, personal best, and a START button.
// Survival mode: escalating 30s waves with no win condition.
// Players see their wave reached and total kills after dying.
import { Container, Graphics, Text } from 'pixi.js';

export class SurvivalScreen {
  /**
   * @param {object} opts.progress  — ProgressManager
   * @param {object} opts.onStart   — () => void
   * @param {object} opts.onBack    — () => void
   * @param {object} opts.audio     — AudioManager
   */
  constructor(stage, appW, appH, { progress, onStart, onBack, audio }) {
    this._container = new Container();
    stage.addChild(this._container);
    this._build(appW, appH, progress, onStart, onBack, audio);
  }

  destroy() { this._container.destroy({ children: true }); }

  _build(w, h, progress, onStart, onBack, audio) {
    const cx = w / 2;

    const bg = new Graphics();
    bg.rect(0, 0, w, h);
    bg.fill(0x050510);
    bg.eventMode = 'static';
    this._container.addChild(bg);

    // Back button
    const back = new Text({ text: '← BACK', style: { fontSize: 15, fontWeight: 'bold', fill: 0x44aaff } });
    back.anchor.set(0, 0.5); back.x = 14; back.y = 34;
    back.eventMode = 'static'; back.cursor = 'pointer';
    back.on('pointerdown', () => { audio?.play('button_tap'); onBack(); });
    this._container.addChild(back);

    // Title
    const title = new Text({
      text: '⚡ SURVIVAL',
      style: { fontSize: 42, fontWeight: 'bold', fill: 0xff8844,
               dropShadow: { color: 0xff4400, blur: 20, distance: 0, alpha: 0.7 } },
    });
    title.anchor.set(0.5, 0.5); title.x = cx; title.y = h * 0.22;
    this._container.addChild(title);

    const sub = new Text({ text: 'Endless waves. How far can you go?', style: { fontSize: 15, fill: 0x8899aa, fontWeight: 'normal' } });
    sub.anchor.set(0.5, 0.5); sub.x = cx; sub.y = h * 0.22 + 50;
    this._container.addChild(sub);

    // Rules panel
    const panelW = 320, panelH = 170;
    const px = (w - panelW) / 2, py = h * 0.36;
    const panel = new Graphics();
    panel.roundRect(px, py, panelW, panelH, 14);
    panel.fill({ color: 0x0d1a2e, alpha: 0.95 });
    panel.roundRect(px, py, panelW, panelH, 14);
    panel.stroke({ color: 0xff8844, width: 1.5, alpha: 0.5 });
    this._container.addChild(panel);

    const rules = [
      '⏱  Each wave lasts 30 seconds',
      '🔴  Car breach = instant game over',
      '📈  Cars get faster every wave',
      '🎨  New colors unlock at wave 4, 8, 12...',
      '💫  No rescue — pure skill',
    ];
    rules.forEach((rule, i) => {
      const rt = new Text({ text: rule, style: { fontSize: 13, fill: 0xaabbcc, fontWeight: 'normal' } });
      rt.anchor.set(0, 0.5); rt.x = px + 16; rt.y = py + 22 + i * 28;
      this._container.addChild(rt);
    });

    // Personal best
    const best = progress?.survivalBest ?? { wave: 0, kills: 0 };
    const bestY = py + panelH + 32;
    if (best.wave > 0) {
      const bestTxt = new Text({
        text: `🏆 Best: Wave ${best.wave}  ·  ${best.kills} kills`,
        style: { fontSize: 17, fontWeight: 'bold', fill: 0xffcc00,
          dropShadow: { color: 0x000000, blur: 4, distance: 1, alpha: 0.8 } },
      });
      bestTxt.anchor.set(0.5, 0.5); bestTxt.x = cx; bestTxt.y = bestY;
      this._container.addChild(bestTxt);
    } else {
      const noScore = new Text({ text: 'No runs yet — be the first!', style: { fontSize: 14, fill: 0x556677, fontWeight: 'normal' } });
      noScore.anchor.set(0.5, 0.5); noScore.x = cx; noScore.y = bestY;
      this._container.addChild(noScore);
    }

    // START button
    const startY = h * 0.78;
    const btn    = new Graphics();
    btn.roundRect(-110, -30, 220, 60, 14);
    btn.fill(0x881800);
    btn.roundRect(-110, -30, 220, 60, 14);
    btn.stroke({ color: 0xff8844, width: 2, alpha: 0.8 });
    btn.x = cx; btn.y = startY;
    btn.eventMode = 'static'; btn.cursor = 'pointer';
    btn.on('pointerdown', () => { audio?.play('button_tap'); onStart(); });
    btn.on('pointerover',  () => { btn.alpha = 0.80; });
    btn.on('pointerout',   () => { btn.alpha = 1.00; });
    const btnTxt = new Text({ text: '⚡ START', style: { fontSize: 26, fontWeight: 'bold', fill: 0xff8844 } });
    btnTxt.anchor.set(0.5, 0.5); btn.addChild(btnTxt);
    this._container.addChild(btn);
  }
}
