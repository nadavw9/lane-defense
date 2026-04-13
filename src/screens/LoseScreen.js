// LoseScreen — full-screen game-over overlay shown when player loses without rescue.
// Displays "GAME OVER" with a dramatic screen crack animation emanating from the breach point.
// The crack appears to radiate from where cars breached the road.
import { Container, Graphics, Text } from 'pixi.js';

export class LoseScreen {
  // callbacks: { onRetry, onMenu }
  // audio: AudioManager (optional)
  constructor(stage, appW, appH, { onRetry, onMenu, audio }) {
    this._container = new Container();
    stage.addChild(this._container);
    this._appW = appW;
    this._appH = appH;
    this._crackAnim = {
      active: true,
      t: 0,
      lines: [],
    };
    this._overlayAlpha = 0;
    this._build(appW, appH, onRetry, onMenu, audio);
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  // Called each frame to drive crack animation and overlay fade.
  update(dt) {
    if (!this._crackAnim.active) return;

    this._crackAnim.t += dt;

    // Crack animation: 0-600ms for crack growth, then 300ms for overlay fade
    const crackProgress = Math.min(this._crackAnim.t / 600, 1);
    const overlayStart = 600;
    const overlayProgress = Math.max(0, Math.min((this._crackAnim.t - overlayStart) / 300, 1));

    // Redraw crack graphics
    if (this._crackGraphics) {
      this._crackGraphics.clear();
      this._drawCracks(this._crackGraphics, crackProgress);
    }

    // Update overlay fade
    if (this._overlayGraphics) {
      this._overlayGraphics.alpha = overlayProgress * 0.5;
    }

    if (this._crackAnim.t >= overlayStart + 300) {
      this._crackAnim.active = false;
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build(w, h, onRetry, onMenu, audio) {
    // Crack origin: center-bottom of road (where cars breach)
    this._crackOriginX = w / 2;
    this._crackOriginY = 510;  // ROAD_BOTTOM_Y approximate

    // Container for crack graphics (drawn first, so it sits behind the panel)
    this._crackGraphics = new Graphics();
    this._container.addChild(this._crackGraphics);

    // Semi-transparent overlay that fades in after cracks appear
    this._overlayGraphics = new Graphics();
    this._overlayGraphics.rect(0, 0, w, h);
    this._overlayGraphics.fill({ color: 0x000000, alpha: 0 });
    this._container.addChild(this._overlayGraphics);

    // Full-screen click catcher (blocks clicks reaching game layers)
    const backdrop = new Graphics();
    backdrop.rect(0, 0, w, h);
    backdrop.fill({ color: 0x000000, alpha: 0 });
    backdrop.eventMode = 'static';
    this._container.addChild(backdrop);

    // Panel with GAME OVER message
    const panelW = 310, panelH = 240;
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2 - 20;

    const panel = new Graphics();
    panel.roundRect(px, py, panelW, panelH, 18);
    panel.fill({ color: 0x1a0505, alpha: 0.97 });
    panel.roundRect(px, py, panelW, panelH, 18);
    panel.stroke({ color: 0xdd2222, width: 2, alpha: 0.6 });
    this._container.addChild(panel);

    const cx = w / 2;
    let cy = py + 44;

    const addText = (text, x, y, style) => {
      const t = new Text({ text, style: { fontWeight: 'bold', ...style } });
      t.anchor.set(0.5, 0.5);
      t.x = x;
      t.y = y;
      this._container.addChild(t);
    };

    addText('GAME OVER', cx, cy, { fontSize: 32, fill: 0xff4444 });
    cy += 38;
    addText('Car breached the end zone.', cx, cy, { fontSize: 14, fill: 0x999999, fontWeight: 'normal' });
    cy += 52;

    const addBtn = (label, bx, by, bgCol, lblCol, onClick) => {
      const btnW = 210, btnH = 48;
      const btn = new Graphics();
      btn.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 12);
      btn.fill(bgCol);
      btn.x = bx;
      btn.y = by;
      btn.eventMode = 'static';
      btn.cursor = 'pointer';
      btn.on('pointerdown', () => { audio?.play('button_tap'); onClick(); });
      btn.on('pointerover', () => { btn.alpha = 0.78; });
      btn.on('pointerout', () => { btn.alpha = 1.00; });
      const t = new Text({ text: label, style: { fontSize: 20, fontWeight: 'bold', fill: lblCol } });
      t.anchor.set(0.5, 0.5);
      btn.addChild(t);
      this._container.addChild(btn);
    };

    addBtn('RETRY', cx, cy, 0x3a1010, 0xff7777, () => { audio?.play('button_tap'); onRetry(); });
    cy += 60;
    addBtn('LEVEL SELECT', cx, cy, 0x1a2a3a, 0x88bbdd, () => { audio?.play('button_tap'); onMenu(); });

    // Pre-generate crack lines (fixed random seed so they're deterministic)
    this._generateCrackLines();
  }

  _generateCrackLines() {
    // Generate 4-6 jagged lightning-bolt lines radiating outward from origin
    const lineCount = 4 + Math.floor(Math.random() * 3);  // 4-6 lines
    const baseAngles = [];
    for (let i = 0; i < lineCount; i++) {
      baseAngles.push((i / lineCount) * Math.PI * 2);
    }

    this._crackAnim.lines = baseAngles.map(baseAngle => {
      // Each line has 3-5 segments
      const segmentCount = 3 + Math.floor(Math.random() * 3);
      const segments = [];
      let currentX = this._crackOriginX;
      let currentY = this._crackOriginY;
      segments.push({ x: currentX, y: currentY });

      for (let i = 0; i < segmentCount; i++) {
        // Random angle variation: ±30° from base direction
        const angleVar = (Math.random() - 0.5) * (Math.PI / 3);
        const direction = baseAngle + angleVar;

        // Segment length: 30-60px
        const length = 30 + Math.random() * 30;
        currentX += Math.cos(direction) * length;
        currentY += Math.sin(direction) * length;
        segments.push({ x: currentX, y: currentY });
      }

      return segments;
    });
  }

  _drawCracks(graphics, progress) {
    const color = 0xffffff;
    graphics.lineStyle({ width: 2, color, alpha: 1.0 });

    for (const line of this._crackAnim.lines) {
      if (line.length < 2) continue;

      // Calculate total length of this crack line
      let totalLength = 0;
      const distances = [0];
      for (let i = 1; i < line.length; i++) {
        const dx = line[i].x - line[i - 1].x;
        const dy = line[i].y - line[i - 1].y;
        totalLength += Math.sqrt(dx * dx + dy * dy);
        distances.push(totalLength);
      }

      // Draw only up to progress * totalLength
      const visibleLength = progress * totalLength;

      // Find the segment where the line should end
      let segmentStart = 0;
      let segmentEnd = 1;
      for (let i = 1; i < distances.length; i++) {
        if (distances[i] <= visibleLength) {
          segmentStart = i - 1;
          segmentEnd = i;
        } else {
          break;
        }
      }

      // Draw all complete segments
      graphics.moveTo(line[0].x, line[0].y);
      for (let i = 1; i <= segmentStart; i++) {
        graphics.lineTo(line[i].x, line[i].y);
      }

      // Partial segment at the end
      if (segmentStart < line.length - 1) {
        const p1 = line[segmentStart];
        const p2 = line[segmentEnd];
        const segLength = distances[segmentEnd] - distances[segmentStart];
        const remainingLength = visibleLength - distances[segmentStart];
        const t = segLength > 0 ? remainingLength / segLength : 0;
        const endX = p1.x + (p2.x - p1.x) * t;
        const endY = p1.y + (p2.y - p1.y) * t;
        graphics.lineTo(endX, endY);
      }
    }

    graphics.stroke();
  }
}
