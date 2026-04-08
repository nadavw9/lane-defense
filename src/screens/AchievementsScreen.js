// AchievementsScreen — full-screen grid showing all 10 achievements.
// Earned achievements appear in gold with their name and description.
// Locked achievements show "???" until earned.
import { Container, Graphics, Text } from 'pixi.js';
import { ACHIEVEMENTS } from '../game/AchievementManager.js';

const CARD_W   = 174;
const CARD_H   = 78;
const CARD_GAP = 8;
const SIDE_PAD = 12;

export class AchievementsScreen {
  constructor(stage, appW, appH, progress, { onBack, audio }) {
    this._container = new Container();
    stage.addChild(this._container);
    this._build(appW, appH, progress, onBack, audio);
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build(w, h, progress, onBack, audio) {
    // Full-screen background
    const bg = new Graphics();
    bg.rect(0, 0, w, h);
    bg.fill(0x060610);
    bg.eventMode = 'static';
    this._container.addChild(bg);

    // ── Header ─────────────────────────────────────────────────────────────
    const backBtn = new Text({ text: '← BACK',
      style: { fontSize: 15, fontWeight: 'bold', fill: 0x44aaff } });
    backBtn.anchor.set(0, 0.5); backBtn.x = 14; backBtn.y = 26;
    backBtn.eventMode = 'static'; backBtn.cursor = 'pointer';
    backBtn.on('pointerdown', () => { audio?.play('button_tap'); onBack(); });
    this._container.addChild(backBtn);

    const title = new Text({ text: 'ACHIEVEMENTS',
      style: { fontSize: 22, fontWeight: 'bold', fill: 0xf5c842 } });
    title.anchor.set(0.5, 0.5); title.x = w / 2; title.y = 26;
    this._container.addChild(title);

    const earned = ACHIEVEMENTS.filter(a => progress.hasAchievement(a.id)).length;
    const cntTxt = new Text({ text: `${earned} / ${ACHIEVEMENTS.length}`,
      style: { fontSize: 14, fontWeight: 'bold', fill: 0x889aaa } });
    cntTxt.anchor.set(1, 0.5); cntTxt.x = w - 14; cntTxt.y = 26;
    this._container.addChild(cntTxt);

    const sep = new Graphics();
    sep.rect(0, 48, w, 1); sep.fill({ color: 0x334466, alpha: 0.5 });
    this._container.addChild(sep);

    // ── Achievement cards (2 columns) ────────────────────────────────────────
    ACHIEVEMENTS.forEach((a, i) => {
      const col    = i % 2;
      const row    = Math.floor(i / 2);
      const cx     = SIDE_PAD + col * (CARD_W + CARD_GAP);
      const cy     = 58 + row * (CARD_H + CARD_GAP);
      const isEarned = progress.hasAchievement(a.id);
      this._buildCard(a, isEarned, cx, cy, w);
    });
  }

  _buildCard(achievement, isEarned, x, y, _w) {
    // Background card
    const g = new Graphics();
    g.roundRect(x, y, CARD_W, CARD_H, 10);
    g.fill(isEarned ? 0x1a1400 : 0x0c0c14);
    g.roundRect(x, y, CARD_W, CARD_H, 10);
    g.stroke({ color: isEarned ? 0xf5c842 : 0x222f40, width: 1.5, alpha: isEarned ? 0.80 : 0.35 });
    this._container.addChild(g);

    // Badge icon — gold star or grey dot
    const iconG = new Graphics();
    if (isEarned) {
      this._starShape(iconG, 13, 0xf5c842);
    } else {
      iconG.roundRect(-10, -10, 20, 20, 5);
      iconG.fill(0x1a2030);
      iconG.rect(-4, -2, 8, 11); iconG.fill(0x2a3a50);
      iconG.arc(0, -2, 5, Math.PI, 0, false); iconG.stroke({ color: 0x2a3a50, width: 3 });
    }
    iconG.x = x + 22;
    iconG.y = y + CARD_H / 2;
    this._container.addChild(iconG);

    // Name
    const nameTxt = new Text({
      text: isEarned ? achievement.name : '???',
      style: { fontSize: 13, fontWeight: 'bold', fill: isEarned ? 0xf5c842 : 0x445566 },
    });
    nameTxt.anchor.set(0, 0.5);
    nameTxt.x = x + 42; nameTxt.y = y + 24;
    this._container.addChild(nameTxt);

    // Description
    const descTxt = new Text({
      text: isEarned ? achievement.desc : 'Keep playing to unlock',
      style: { fontSize: 11, fill: isEarned ? 0x998866 : 0x334455,
        wordWrap: true, wordWrapWidth: CARD_W - 48 },
    });
    descTxt.anchor.set(0, 0);
    descTxt.x = x + 42; descTxt.y = y + 38;
    this._container.addChild(descTxt);
  }

  _starShape(g, outerR, color) {
    const pts = 5, innerR = outerR * 0.42;
    const pts2d = [];
    for (let i = 0; i < pts * 2; i++) {
      const angle = (Math.PI * i) / pts - Math.PI / 2;
      const r = (i % 2 === 0) ? outerR : innerR;
      pts2d.push(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    g.poly(pts2d); g.fill(color);
  }
}
