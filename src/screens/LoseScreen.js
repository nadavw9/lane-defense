// LoseScreen — full-screen game-over overlay with stats and near-miss psychology.
//
// Enhancements over v1:
//   • Stats panel: Cars Destroyed, Time Survived, Accuracy
//   • Near-miss detection: if timer was >80% used, show "SO CLOSE!"
//   • Hearts display: shows remaining lives
import { Container, Graphics, Text } from 'pixi.js';

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
    this._build(appW, appH, onRetry, onMenu, audio, gs, heartsRemaining);
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  update(dt) {
    if (!this._crackAnim.active) return;
    this._crackAnim.t += dt;

    const crackProgress   = Math.min(this._crackAnim.t / 0.6, 1);
    const overlayProgress = Math.max(0, Math.min((this._crackAnim.t - 0.6) / 0.3, 1));

    if (this._crackGraphics) {
      this._crackGraphics.clear();
      this._drawCracks(this._crackGraphics, crackProgress);
    }
    if (this._overlayGraphics) this._overlayGraphics.alpha = overlayProgress * 0.50;
    if (this._crackAnim.t >= 0.9) this._crackAnim.active = false;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _build(w, h, onRetry, onMenu, audio, gs, heartsRemaining) {
    this._crackOriginX = w / 2;
    this._crackOriginY = 510;

    this._crackGraphics = new Graphics();
    this._container.addChild(this._crackGraphics);

    this._overlayGraphics = new Graphics();
    this._overlayGraphics.rect(0, 0, w, h);
    this._overlayGraphics.fill({ color: 0x000000, alpha: 0 });
    this._container.addChild(this._overlayGraphics);

    const backdrop = new Graphics();
    backdrop.rect(0, 0, w, h);
    backdrop.fill({ color: 0x000000, alpha: 0 });
    backdrop.eventMode = 'static';
    this._container.addChild(backdrop);

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

    const panel = new Graphics();
    panel.roundRect(px, py, panelW, panelH, 18);
    panel.fill({ color: 0x1a0505, alpha: 0.97 });
    panel.roundRect(px, py, panelW, panelH, 18);
    panel.stroke({ color: 0xdd2222, width: 2, alpha: 0.60 });
    this._container.addChild(panel);

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
    this._text(subMsg, cx, cy, { fontSize: 13, fill: 0x999999, fontWeight: 'normal' });
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

      const tot = gs.totalDeploys ?? 0;
      const acc = tot > 0 ? Math.round(((gs.correctDeploys ?? 0) / tot) * 100) : 100;
      this._statRow(px + 14, cy, rowW, rowH,
        '🎯  Accuracy', `${acc}%`,
        acc >= 80 ? 0x44ff88 : acc >= 50 ? 0xffcc00 : 0xff6666);
      cy += rowH + 16;
    }

    // Hearts
    if (heartsRemaining !== null) {
      this._drawHearts(cx, cy + 8, heartsRemaining);
      cy += 36;
    }

    cy += 6;
    this._button('RETRY', cx, cy, 0x3a1010, 0xff7777, onRetry, audio);
    cy += 58;
    this._button('LEVEL SELECT', cx, cy, 0x1a2a3a, 0x88bbdd, onMenu, audio);
  }

  _drawHearts(cx, cy, count) {
    const MAX = 5, sz = 18, gap = 6;
    const x0  = cx - (MAX * sz + (MAX - 1) * gap) / 2;
    for (let i = 0; i < MAX; i++) {
      const t = new Text({ text: '♥', style: { fontSize: sz, fill: i < count ? 0xff4466 : 0x333344 } });
      t.anchor.set(0.5, 0.5);
      t.x = x0 + i * (sz + gap) + sz / 2;
      t.y = cy;
      this._container.addChild(t);
    }
  }

  _statRow(x, y, w, h, label, value, color) {
    const bg = new Graphics();
    bg.roundRect(x, y, w, h, 7);
    bg.fill({ color: 0x0d0808, alpha: 0.85 });
    this._container.addChild(bg);

    const lbl = new Text({ text: label, style: { fontSize: 12, fontWeight: 'bold', fill: 0x887777 } });
    lbl.anchor.set(0, 0.5);
    lbl.x = x + 10; lbl.y = y + h / 2;
    this._container.addChild(lbl);

    const val = new Text({ text: value, style: { fontSize: 16, fontWeight: 'bold', fill: color } });
    val.anchor.set(1, 0.5);
    val.x = x + w - 10; val.y = y + h / 2;
    this._container.addChild(val);
  }

  _text(str, x, y, style) {
    const t = new Text({ text: str, style: { fontWeight: 'bold', ...style } });
    t.anchor.set(0.5, 0.5);
    t.x = x; t.y = y;
    this._container.addChild(t);
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
    this._container.addChild(btn);
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
