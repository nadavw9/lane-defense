// LoseScreen — full-screen game-over overlay with stats and near-miss psychology.
//
// Enhancements over v1:
//   • Stats panel: Cars Destroyed, Time Survived, Accuracy
//   • Near-miss detection: if timer was >80% used, show "SO CLOSE!"
//   • Hearts display: shows remaining lives
import { Container, Graphics, Text } from 'pixi.js';
import { uiIcon } from '../renderer/UIIcon.js';
import { ROAD_BOTTOM_Y } from '../renderer/LaneRenderer.js';

export class LoseScreen {
  // callbacks: { onRetry, onMenu }
  // gs: GameState snapshot (for stats), optional
  // heartsRemaining: number (0-5), optional
  constructor(stage, appW, appH, { onRetry, onMenu, audio }, gs = null, heartsRemaining = null) {
    this._container = new Container();
    stage.addChild(this._container);
    this._appW = appW;
    this._appH = appH;
    this._crackAnim = { active: true, t: 0, lines: [] };
    this._panelGroup = null;   // 5C: content slides up from the bottom
    this._slideT     = 0;
    this._flashG     = null;   // 5C: brief red "breach" flash
    this._flashT     = 0;
    this._build(appW, appH, onRetry, onMenu, audio, gs, heartsRemaining);
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  update(dt) {
    // 5C: red breach flash fades over ~150ms.
    if (this._flashG) {
      this._flashT += dt;
      this._flashG.alpha = 0.5 * Math.max(0, 1 - this._flashT / 0.15);
      if (this._flashT >= 0.15) { this._container.removeChild(this._flashG); this._flashG.destroy(); this._flashG = null; }
    }
    // 5C: panel slides up from the bottom with an ease-out bounce over 300ms.
    if (this._panelGroup && this._slideT < 0.3) {
      this._slideT += dt;
      const p = Math.min(1, this._slideT / 0.3);
      const c1 = 1.70158, c3 = c1 + 1;
      const e  = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);   // easeOutBack
      this._panelGroup.y = this._appH * (1 - e);
      if (p >= 1) this._panelGroup.y = 0;
    }

    if (!this._crackAnim.active) return;
    this._crackAnim.t += dt;

    const crackProgress = Math.min(this._crackAnim.t / 0.6, 1);
    if (this._crackGraphics) {
      this._crackGraphics.clear();
      this._drawCracks(this._crackGraphics, crackProgress);
    }
    if (this._crackAnim.t >= 0.9) this._crackAnim.active = false;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _build(w, h, onRetry, onMenu, audio, gs, heartsRemaining) {
    this._crackOriginX = w / 2;
    this._crackOriginY = 510;

    // Solid dim backdrop — immediate and reliable (matches WinScreen). Strongly
    // darkens the world so it doesn't bleed through, and catches all touches.
    // (The prior animated overlay used a 0-alpha fill, so it never dimmed.)
    const backdrop = new Graphics();
    backdrop.rect(0, 0, w, h);
    backdrop.fill({ color: 0x000000, alpha: 0.85 });
    backdrop.eventMode = 'static';
    this._container.addChild(backdrop);

    // Cracks render ON TOP of the dim (white lines read clearly on dark).
    this._crackGraphics = new Graphics();
    this._container.addChild(this._crackGraphics);

    // Clip the shatter to the road area (above the breach line). Without this the
    // cracks radiate past the panel and bleed over the bomb queue below; the mask
    // keeps the effect within the gameplay road and never over the bomb zone.
    const crackMask = new Graphics();
    crackMask.rect(0, 0, w, ROAD_BOTTOM_Y);
    crackMask.fill(0xffffff);
    this._container.addChild(crackMask);
    this._crackGraphics.mask = crackMask;

    this._generateCrackLines();

    // Near-miss detection
    const timeUsedRatio = gs && gs.timeRemaining != null
      ? gs.elapsed / Math.max(1, gs.elapsed + gs.timeRemaining)
      : 0;
    const isNearMiss = timeUsedRatio >= 0.80;

    const hasStats = gs !== null;
    const panelH   = hasStats ? (heartsRemaining !== null ? 390 : 360) : 250;
    const panelW   = 310;
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2 - 20;
    const cx = w / 2;

    // 5C: all panel content lives in a group that slides up from the bottom.
    this._panelGroup = new Container();
    this._panelGroup.y = this._appH;   // start off the bottom edge
    this._container.addChild(this._panelGroup);

    const panel = new Graphics();
    panel.roundRect(px, py, panelW, panelH, 18);
    panel.fill({ color: 0x1a0505, alpha: 0.97 });
    panel.roundRect(px, py, panelW, panelH, 18);
    panel.stroke({ color: 0xdd2222, width: 2, alpha: 0.60 });
    this._panelGroup.addChild(panel);

    let cy = py + 44;

    // Header
    const header = isNearMiss ? 'SO CLOSE!' : 'GAME OVER';
    const hColor = isNearMiss ? 0xff8844 : 0xff4444;
    this._text(header, cx, cy,
      { fontSize: isNearMiss ? 34 : 32, fill: hColor,
        dropShadow: { color: isNearMiss ? 0xff4400 : 0x880000, blur: 12, distance: 0, alpha: 0.7 } });
    cy += 36;

    let subMsg = 'Car breached the end zone.';
    if (isNearMiss && gs) {
      const s = Math.round(gs.timeRemaining ?? 0);
      subMsg = s > 0 ? `${s}s left when the car broke through!` : 'Just seconds away!';
    }
    this._text(subMsg, cx, cy, { fontSize: 13, fill: 0xbbbbbb, fontWeight: 'normal' });
    cy += 28;

    // Stats
    if (hasStats) {
      cy += 8;
      const rowW = panelW - 28, rowH = 38;

      this._statRow(px + 14, cy, rowW, rowH,
        '🚗  Cars Destroyed', String(gs.totalKills ?? 0), 0xff8844);
      cy += rowH + 6;

      const m = Math.floor((gs.elapsed ?? 0) / 60);
      const s = Math.floor((gs.elapsed ?? 0) % 60);
      this._statRow(px + 14, cy, rowW, rowH,
        '⏱  Time Survived', m > 0 ? `${m}m ${s}s` : `${s}s`, 0x66aaff);
      cy += rowH + 6;

      // Guard the 0-shot case: 0/0 must not read as a misleading "100%".
      const tot = gs.totalDeploys ?? 0;
      const acc = tot > 0 ? Math.round(((gs.correctDeploys ?? 0) / tot) * 100) : null;
      this._statRow(px + 14, cy, rowW, rowH,
        '🎯  Accuracy', acc === null ? '—' : `${acc}%`,
        acc === null ? 0x99aabb : acc >= 80 ? 0x44ff88 : acc >= 50 ? 0xffcc00 : 0xff6666);
      cy += rowH + 16;
    }

    // Hearts
    if (heartsRemaining !== null) {
      this._text('LIVES REMAINING', cx, cy + 4, { fontSize: 11, fill: 0x667788, fontWeight: 'bold' });
      cy += 20;
      this._drawHearts(cx, cy + 8, heartsRemaining);
      cy += 36;
    }

    cy += 6;
    this._button('RETRY', cx, cy, 0x3a1010, 0xff7777, onRetry, audio);
    cy += 58;
    this._button('LEVEL SELECT', cx, cy, 0x1a2a3a, 0x88bbdd, onMenu, audio);

    // 5C: brief red "breach" flash over everything (fades in update).
    this._flashG = new Graphics();
    this._flashG.rect(0, 0, w, h);
    this._flashG.fill(0xff0000);
    this._flashG.alpha = 0.5;
    this._container.addChild(this._flashG);
    this._flashT = 0;
  }

  _drawHearts(cx, cy, count) {
    const MAX = 5, sz = 18, gap = 6;
    const x0  = cx - (MAX * sz + (MAX - 1) * gap) / 2;
    for (let i = 0; i < MAX; i++) {
      // filled = natural red heart; empty = dark-tinted heart
      const t = i < count
        ? uiIcon('heart', sz + 2, '♥', { emojiFill: 0xff4466 })
        : uiIcon('heart', sz + 2, '♥', { tint: 0x333344, emojiFill: 0x333344 });
      t.x = x0 + i * (sz + gap) + sz / 2;
      t.y = cy;
      this._panelGroup.addChild(t);
    }
  }

  _statRow(x, y, w, h, label, value, color) {
    const bg = new Graphics();
    bg.roundRect(x, y, w, h, 7);
    bg.fill({ color: 0x0d0808, alpha: 0.85 });
    this._panelGroup.addChild(bg);

    const lbl = new Text({ text: label, style: { fontSize: 12, fontWeight: 'bold', fill: 0xaabbcc } });
    lbl.anchor.set(0, 0.5);
    lbl.x = x + 10; lbl.y = y + h / 2;
    this._panelGroup.addChild(lbl);

    const val = new Text({ text: value, style: { fontSize: 16, fontWeight: 'bold', fill: color } });
    val.anchor.set(1, 0.5);
    val.x = x + w - 10; val.y = y + h / 2;
    this._panelGroup.addChild(val);
  }

  _text(str, x, y, style) {
    const t = new Text({ text: str, style: { fontWeight: 'bold', ...style } });
    t.anchor.set(0.5, 0.5);
    t.x = x; t.y = y;
    this._panelGroup.addChild(t);
    return t;
  }

  _button(label, cx, y, bgCol, lblCol, onClick, audio) {
    const btnW = 210, btnH = 48;
    const btn  = new Graphics();
    btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
    btn.fill(bgCol);
    btn.x = cx; btn.y = y;
    btn.eventMode = 'static';
    btn.cursor    = 'pointer';
    btn.on('pointerdown', () => { audio?.play('button_tap'); onClick(); });
    btn.on('pointerover',  () => { btn.alpha = 0.78; });
    btn.on('pointerout',   () => { btn.alpha = 1.00; });
    const t = new Text({ text: label, style: { fontSize: 20, fontWeight: 'bold', fill: lblCol } });
    t.anchor.set(0.5, 0.5);
    btn.addChild(t);
    this._panelGroup.addChild(btn);
  }

  _generateCrackLines() {
    const count = 4 + Math.floor(Math.random() * 3);
    this._crackAnim.lines = Array.from({ length: count }, (_, i) => {
      const base = (i / count) * Math.PI * 2;
      let x = this._crackOriginX, y = this._crackOriginY;
      const segs = [{ x, y }];
      for (let j = 0, n = 3 + Math.floor(Math.random() * 3); j < n; j++) {
        const dir = base + (Math.random() - 0.5) * (Math.PI / 3);
        const len = 30 + Math.random() * 30;
        x += Math.cos(dir) * len;
        y += Math.sin(dir) * len;
        segs.push({ x, y });
      }
      return segs;
    });
  }

  _drawCracks(g, progress) {
    for (const line of this._crackAnim.lines) {
      if (line.length < 2) continue;
      let totalLen = 0;
      const dists  = [0];
      for (let i = 1; i < line.length; i++) {
        const dx = line[i].x - line[i - 1].x, dy = line[i].y - line[i - 1].y;
        totalLen += Math.sqrt(dx * dx + dy * dy);
        dists.push(totalLen);
      }
      const visible = progress * totalLen;
      g.moveTo(line[0].x, line[0].y);
      let si = 0;
      for (let i = 1; i < line.length; i++) {
        if (dists[i] <= visible) { g.lineTo(line[i].x, line[i].y); si = i; }
        else break;
      }
      if (si < line.length - 1) {
        const p1 = line[si], p2 = line[si + 1];
        const seg = dists[si + 1] - dists[si];
        const rem = visible - dists[si];
        const tp  = seg > 0 ? rem / seg : 0;
        g.lineTo(p1.x + (p2.x - p1.x) * tp, p1.y + (p2.y - p1.y) * tp);
      }
      g.stroke({ width: 2, color: 0xffffff, alpha: 1 });
    }
  }
}
