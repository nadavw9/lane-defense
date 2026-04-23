// LevelSelectScreen — Car-themed world map + Candy Crush pre-level popup.
import { Container, Graphics, Text } from 'pixi.js';
import { adManager, AD_COSTS } from '../ads/AdManager.js';

const HEADER_H = 68;
const NODE_R   = 26;
const COLS_X   = [52, 150, 240, 338];
const ROWS_Y   = [138, 302, 466, 630, 794];

// Per-level colour palette — cycles through vivid hues.
const LEVEL_COLORS = [
  0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12,
  0x9b59b6, 0x1abc9c, 0xe91e63, 0xff5722,
  0x00bcd4, 0x8bc34a, 0xff9800, 0x673ab7,
  0x4caf50, 0xf44336, 0x2196f3, 0xffeb3b,
  0x9c27b0, 0x009688, 0xff5722, 0x03a9f4,
];

function levelColor(levelId) { return LEVEL_COLORS[(levelId - 1) % LEVEL_COLORS.length]; }

function nodePos(levelId) {
  const i = levelId - 1;
  const dataRow   = Math.floor(i / 4);
  const posInRow  = i % 4;
  const visualRow = 4 - dataRow;
  const isRTL     = dataRow % 2 === 1;
  const col       = isRTL ? (3 - posInRow) : posInRow;
  return { x: COLS_X[col], y: ROWS_Y[visualRow] };
}

export class LevelSelectScreen {
  constructor(stage, appW, appH, progress,
    { onSelectLevel, onBack, onShop, onAchievements, audio, weeklyLevels = [] },
    livesManager = null) {

    this._container    = new Container();
    stage.addChild(this._container);
    this._stage        = stage;
    this._glowNode     = null;
    this._glowTime     = 0;
    this._lives        = livesManager;
    this._worldPage    = 1;
    this._progress     = progress;
    this._appW         = appW;
    this._appH         = appH;
    this._weeklyLevels = weeklyLevels;
    this._callbacks    = { onSelectLevel, onBack, onShop, onAchievements, audio, weeklyLevels };
    this._revealAnims  = [];
    this._popup        = null;   // active pre-level popup
    this._build(appW, appH, progress, onSelectLevel, onBack, onShop, onAchievements, audio);
  }

  destroy() {
    this._popup?.destroy({ children: true });
    this._container.destroy({ children: true });
  }

  update(dt) {
    if (this._glowNode) {
      this._glowTime += dt;
      const t = (this._glowTime % 1.4) / 1.4;
      this._glowNode.alpha = 0.30 + 0.55 * Math.abs(Math.sin(t * Math.PI));
    }
    for (let i = this._revealAnims.length - 1; i >= 0; i--) {
      const a  = this._revealAnims[i];
      a.t      = Math.min(a.t + dt / a.duration, 1);
      const e  = 1 - Math.pow(1 - a.t, 3);
      const ov = a.t < 0.7 ? Math.sin(a.t / 0.7 * Math.PI) * 0.35 : 0;
      a.node.scale.set(e * (1 + ov));
      a.node.alpha = Math.min(1, a.t * 3);
      if (a.t >= 1) this._revealAnims.splice(i, 1);
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build(w, h, progress, onSelectLevel, onBack, onShop, onAchievements, audio) {
    this._drawBackground(w, h);
    const unlocked = progress.unlockedLevel ?? 1;
    this._drawRoadPath(unlocked);
    this._drawCars();

    const worldBase  = (this._worldPage - 1) * 20;
    const firstId    = worldBase + 1;
    const lastId     = worldBase + 20;
    const nextToPlay = (unlocked >= firstId && unlocked <= lastId && progress.getStars(unlocked) === 0)
      ? unlocked : null;

    for (let levelId = firstId; levelId <= lastId; levelId++) {
      const localId    = levelId - worldBase;
      const { x, y }  = nodePos(localId);
      const stars      = progress.getStars(levelId);
      const isUnlocked = levelId <= unlocked;
      const isWeekly   = this._weeklyLevels.includes(levelId);
      const isNew      = (levelId === unlocked && stars === 0);

      const node = this._buildNode(levelId, x, y, stars, isUnlocked, isWeekly, () => {
        if (isUnlocked) {
          audio?.play('button_tap');
          this._showLevelPopup(levelId, stars, isWeekly, audio, onSelectLevel);
        }
      });

      if (isNew && isUnlocked) {
        node.scale.set(0); node.alpha = 0;
        this._revealAnims.push({ node, t: 0, duration: 0.45 });
      }
    }

    if (nextToPlay !== null) {
      const localId = nextToPlay - worldBase;
      const { x, y } = nodePos(localId);
      const glow = new Graphics();
      glow.circle(x, y, NODE_R + 12);
      glow.stroke({ color: 0xffffff, width: 3.5, alpha: 1 });
      this._container.addChild(glow);
      this._glowNode = glow;
    }

    this._buildHeader(w, progress, onBack, onShop, onAchievements, audio);
  }

  // ── Level popup (Candy Crush style) ──────────────────────────────────────

  _showLevelPopup(levelId, stars, isWeekly, audio, onSelectLevel) {
    if (this._popup) { this._popup.destroy({ children: true }); this._popup = null; }

    const w = this._appW, h = this._appH;
    const popup = new Container();
    this._stage.addChild(popup);
    this._popup = popup;

    // Dim overlay
    const dim = new Graphics();
    dim.rect(0, 0, w, h);
    dim.fill({ color: 0x000000, alpha: 0.65 });
    dim.eventMode = 'static';   // block taps through overlay
    popup.addChild(dim);

    // Card
    const CW = 310, CH = 370, CX = (w - CW) / 2, CY = (h - CH) / 2 - 30;
    const color = levelColor(levelId);

    const card = new Graphics();
    // Shadow
    card.roundRect(CX + 5, CY + 8, CW, CH, 22);
    card.fill({ color: 0x000000, alpha: 0.45 });
    // Card bg
    card.roundRect(CX, CY, CW, CH, 20);
    card.fill(0x0d1525);
    // Coloured top bar
    card.roundRect(CX, CY, CW, 56, 20);
    card.fill(color);
    card.rect(CX, CY + 36, CW, 20);
    card.fill(color);
    popup.addChild(card);

    // Level label
    const lbl = new Text({ text: `LEVEL ${levelId}`, style: {
      fontSize: 26, fontWeight: 'bold', fill: 0xffffff,
      dropShadow: { color: 0x000000, blur: 6, distance: 0, alpha: 0.7 },
    }});
    lbl.anchor.set(0.5, 0.5); lbl.x = w / 2; lbl.y = CY + 28;
    popup.addChild(lbl);

    if (isWeekly) {
      const wb = new Text({ text: '⭐ WEEKLY', style: { fontSize: 11, fill: 0xffee44, fontWeight: 'bold' } });
      wb.anchor.set(0.5, 0.5); wb.x = w / 2; wb.y = CY + 54;
      popup.addChild(wb);
    }

    // Stars row
    const starY = CY + 88;
    for (let s = 0; s < 3; s++) {
      const filled = s < stars;
      const sc = new Text({ text: filled ? '★' : '☆', style: {
        fontSize: 28, fill: filled ? 0xffcc00 : 0x445566,
      }});
      sc.anchor.set(0.5, 0.5); sc.x = w / 2 - 28 + s * 28; sc.y = starY;
      popup.addChild(sc);
    }

    // Booster section header
    const bh = new Text({ text: 'WATCH AN AD FOR A BOOSTER', style: {
      fontSize: 11, fill: 0x88aacc, fontWeight: 'bold',
    }});
    bh.anchor.set(0.5, 0.5); bh.x = w / 2; bh.y = CY + 126;
    popup.addChild(bh);

    // Ad booster buttons — driven by AdManager
    const boosterDefs = [
      { key: 'swap',   label: '🔄 SWAP',  color: 0x1a4a8a, glow: 0x66aaff },
      { key: 'freeze', label: '❄ FREEZE', color: 0x0a3a5a, glow: 0x44ccff },
      { key: 'bomb',   label: '💣 BOMB',  color: 0x3a1a00, glow: 0xffaa00 },
    ];
    boosterDefs.forEach((b, idx) => {
      const bx = CX + 16 + idx * 92, by = CY + 142;
      const unlocked = adManager.isUnlocked(b.key);
      const prog     = adManager.progressLabel(b.key);
      const cost     = adManager.getCost(b.key);

      const bg = new Graphics();
      bg.roundRect(bx, by, 84, 44, 10);
      bg.fill(unlocked ? 0x1a3a1a : b.color);
      bg.roundRect(bx, by, 84, 44, 10);
      bg.stroke({ color: unlocked ? 0x44ff66 : b.glow, width: unlocked ? 2.5 : 1.5, alpha: 0.80 });
      popup.addChild(bg);

      const bt = new Text({ text: unlocked ? '✓ ' + b.label : b.label,
        style: { fontSize: 10, fill: unlocked ? 0x88ff88 : 0xffffff, fontWeight: 'bold' } });
      bt.anchor.set(0.5, 0.5); bt.x = bx + 42; bt.y = by + 14;
      popup.addChild(bt);

      // Progress sub-label: "1 / 3 ads" or "✓ Unlocked"
      const sub = new Text({ text: unlocked ? '✓ Unlocked' : `${prog} ads`,
        style: { fontSize: 9, fill: unlocked ? 0x66ee66 : 0xaaaaaa } });
      sub.anchor.set(0.5, 0.5); sub.x = bx + 42; sub.y = by + 32;
      popup.addChild(sub);

      if (!unlocked) {
        bg.eventMode = 'static'; bg.cursor = 'pointer';
        bg.on('pointerdown', () => {
          audio?.play('button_tap');
          adManager.showRewardedAd(b.key,
            (type) => {
              // Reward: update progress label and check if fully unlocked.
              const newProg = adManager.progressLabel(type);
              const nowUnlocked = adManager.isUnlocked(type);
              sub.text = nowUnlocked ? '✓ Unlocked' : `${newProg} ads`;
              if (nowUnlocked) {
                bt.style.fill = 0x88ff88;
                bt.text = '✓ ' + b.label;
                bg.clear();
                bg.roundRect(bx, by, 84, 44, 10);
                bg.fill(0x1a3a1a);
                bg.roundRect(bx, by, 84, 44, 10);
                bg.stroke({ color: 0x44ff66, width: 2.5, alpha: 0.80 });
                sub.style.fill = 0x66ee66;
              }
            },
            null,   // onDismissed — do nothing
          );
        });
        bg.on('pointerover', () => { bg.alpha = 0.80; });
        bg.on('pointerout',  () => { bg.alpha = 1.00; });
      }
    });

    // START button
    const sx = CX + 20, sy = CY + 202;
    const startBg = new Graphics();
    startBg.roundRect(sx, sy, CW - 40, 56, 14);
    startBg.fill(color);
    startBg.roundRect(sx + 2, sy + 2, CW - 44, 26, 12);
    startBg.fill({ color: 0xffffff, alpha: 0.18 });   // sheen
    popup.addChild(startBg);

    const startTxt = new Text({ text: '▶  START LEVEL', style: {
      fontSize: 20, fontWeight: 'bold', fill: 0xffffff,
      dropShadow: { color: 0x000000, blur: 4, distance: 2, alpha: 0.6 },
    }});
    startTxt.anchor.set(0.5, 0.5); startTxt.x = w / 2; startTxt.y = sy + 28;
    startBg.eventMode = 'static'; startBg.cursor = 'pointer';
    startBg.on('pointerdown', () => {
      audio?.play('button_tap');
      // Reset ad tracking for new level attempt.
      adManager.resetForLevel();
      popup.destroy({ children: true }); this._popup = null;
      onSelectLevel(levelId);
    });
    startBg.on('pointerover',  () => { startBg.alpha = 0.85; });
    startBg.on('pointerout',   () => { startBg.alpha = 1.00; });
    popup.addChild(startTxt);

    // Divider
    const div = new Graphics();
    div.moveTo(CX + 20, CY + 274); div.lineTo(CX + CW - 20, CY + 274);
    div.stroke({ color: 0x223355, width: 1, alpha: 0.60 });
    popup.addChild(div);

    // Secondary buttons row
    const btnStyle = { fontSize: 13, fontWeight: 'bold', fill: 0x88aacc };
    const backBtn = new Text({ text: '← BACK', style: btnStyle });
    backBtn.anchor.set(0, 0.5); backBtn.x = CX + 20; backBtn.y = CY + 298;
    backBtn.eventMode = 'static'; backBtn.cursor = 'pointer';
    backBtn.on('pointerdown', () => {
      audio?.play('button_tap');
      popup.destroy({ children: true }); this._popup = null;
    });
    popup.addChild(backBtn);

    const lvlSel = new Text({ text: 'LEVEL SELECT ▶', style: btnStyle });
    lvlSel.anchor.set(1, 0.5); lvlSel.x = CX + CW - 20; lvlSel.y = CY + 298;
    lvlSel.eventMode = 'static'; lvlSel.cursor = 'pointer';
    lvlSel.on('pointerdown', () => {
      popup.destroy({ children: true }); this._popup = null;
    });
    popup.addChild(lvlSel);

    // Animate card entrance: slide up from below
    popup.y = 80; popup.alpha = 0;
    let t = 0;
    const tick = (ticker) => {
      t += ticker.deltaMS / 1000;
      const prog = Math.min(1, t / 0.22);
      const ease = 1 - Math.pow(1 - prog, 3);
      popup.y     = 80 * (1 - ease);
      popup.alpha = ease;
      if (prog >= 1) this._stage.app?.ticker?.remove(tick);
    };
    // Use a manual animation via requestAnimationFrame-style approach
    const rafId = setInterval(() => {
      t += 1 / 60;
      const prog = Math.min(1, t / 0.22);
      const ease = 1 - Math.pow(1 - prog, 3);
      popup.y     = 80 * (1 - ease);
      popup.alpha = ease;
      if (prog >= 1) clearInterval(rafId);
    }, 1000 / 60);
  }

  // ── Background drawing ────────────────────────────────────────────────────

  _drawBackground(w, h) {
    const g = new Graphics();
    // Deep gradient: navy → dark blue-purple
    for (let i = 0; i < 20; i++) {
      const t = i / 19;
      const r = Math.round(4 + t * 15);
      const gr = Math.round(5 + t * 10);
      const b  = Math.round(20 + t * 40);
      g.rect(0, HEADER_H + i * ((h - HEADER_H) / 20), w, (h - HEADER_H) / 20 + 1);
      g.fill((r << 16) | (gr << 8) | b);
    }
    this._container.addChild(g);
    this._drawSkyline(w, h);
    this._drawStarField(w);
    this._drawStreetLights(w);
    this._drawGridOverlay(w, h);
  }

  _drawStarField(w) {
    const g = new Graphics();
    const positions = [
      [18,78],[65,92],[108,74],[150,86],[198,70],[238,90],[285,76],
      [335,84],[372,74],[42,104],[185,108],[318,100],[88,118],[260,116],
      [370,108],[12,130],[155,122],[295,132],[50,140],[220,136],
    ];
    for (const [sx, sy] of positions) {
      const r = (sx % 3 === 0) ? 1.5 : 1.0;
      const a = 0.4 + ((sx + sy) % 4) * 0.15;
      g.circle(sx, sy, r);
      g.fill({ color: 0xffffff, alpha: a });
    }
    // Coloured accent stars
    for (const [sx, sy, col] of [[72,82,0xffd700],[188,96,0x88ccff],[330,72,0xff88cc]]) {
      g.circle(sx, sy, 2); g.fill({ color: col, alpha: 0.60 });
    }
    this._container.addChild(g);
  }

  _drawSkyline(w, h) {
    const g = new Graphics();
    const baseY = HEADER_H + 110;
    const buildings = [
      [0,30,68,0x0c1226,true],[30,20,46,0x0e1430,false],[50,36,82,0x0a0f22,true],
      [86,24,54,0x0d1228,false],[110,14,38,0x0c1124,false],[124,44,72,0x0b1020,true],
      [168,22,50,0x0d1228,false],[190,32,88,0x090e1e,true],[222,18,44,0x0c1226,false],
      [240,38,62,0x0b1122,true],[278,26,74,0x0a1020,false],[304,20,48,0x0d1328,true],
      [324,44,92,0x090e1e,true],[368,24,52,0x0c1126,false],[
        392,32,68,0x0b1020,true],
    ];
    for (const [bx, bw, bh, bgc, hasWin] of buildings) {
      g.rect(bx, baseY - bh, bw, bh); g.fill(bgc);
      if (hasWin) {
        for (let wy = baseY - bh + 8; wy < baseY - 8; wy += 10) {
          for (let wx = bx + 4; wx < bx + bw - 4; wx += 8) {
            if ((wx * 3 + wy * 2) % 5 < 3) {
              const wc = (wx + wy) % 3 === 0 ? 0xffee66 : 0x88ccff;
              g.rect(wx, wy, 3, 5); g.fill({ color: wc, alpha: 0.55 });
            }
          }
        }
      }
    }
    this._container.addChild(g);
  }

  _drawStreetLights(w) {
    const g = new Graphics();
    // Pairs of street lights between node rows
    const lightPositions = [
      [0, 210], [w, 210], [0, 380], [w, 380],
      [0, 545], [w, 545], [0, 710], [w, 710],
    ];
    for (const [lx, ly] of lightPositions) {
      const side = lx === 0 ? 1 : -1;
      const px = lx === 0 ? 8 : w - 8;
      // Pole
      g.rect(px - 2, ly - 30, 4, 30); g.fill(0x334466);
      // Arm
      g.rect(px, ly - 30, side * 20, 3); g.fill(0x334466);
      // Lamp
      const lampX = px + side * 20;
      g.circle(lampX, ly - 30, 5); g.fill({ color: 0xffee88, alpha: 0.85 });
      // Glow halo
      g.circle(lampX, ly - 30, 10); g.fill({ color: 0xffee88, alpha: 0.18 });
    }
    this._container.addChild(g);
  }

  _drawGridOverlay(w, h) {
    const g = new Graphics();
    const top = HEADER_H + 120;
    for (let gx = 40; gx < w; gx += 50) {
      g.moveTo(gx, top); g.lineTo(gx, h);
      g.stroke({ color: 0x1a2548, width: 1, alpha: 0.20 });
    }
    for (let gy = top; gy < h; gy += 50) {
      g.moveTo(0, gy); g.lineTo(w, gy);
      g.stroke({ color: 0x1a2548, width: 1, alpha: 0.20 });
    }
    this._container.addChild(g);
  }

  // ── Road path ─────────────────────────────────────────────────────────────

  _drawRoadPath(unlockedLevel) {
    const worldBase = (this._worldPage - 1) * 20;
    for (let localId = 1; localId < 20; localId++) {
      const levelId = worldBase + localId;
      const { x: ax, y: ay } = nodePos(localId);
      const { x: bx, y: by } = nodePos(localId + 1);
      const reached = levelId < unlockedLevel;
      const c = levelColor(levelId);

      // Road base
      const road = new Graphics();
      road.moveTo(ax, ay); road.lineTo(bx, by);
      road.stroke({ color: reached ? c : 0x1a2040, width: 14, alpha: reached ? 0.55 : 0.50, cap: 'round' });
      this._container.addChild(road);

      // Road edge lines
      if (reached) {
        const edge = new Graphics();
        edge.moveTo(ax, ay); edge.lineTo(bx, by);
        edge.stroke({ color: 0xffffff, width: 14, alpha: 0.10, cap: 'round' });
        this._container.addChild(edge);
      }

      // Dashed centre line
      if (reached) {
        const dash = new Graphics();
        for (let d = 0; d < 5; d++) {
          const t0 = (d + 0.15) / 5, t1 = (d + 0.55) / 5;
          dash.moveTo(ax + (bx - ax) * t0, ay + (by - ay) * t0);
          dash.lineTo(ax + (bx - ax) * t1, ay + (by - ay) * t1);
          dash.stroke({ color: 0xffffff, width: 2, alpha: 0.60, cap: 'round' });
        }
        this._container.addChild(dash);
      }
    }
  }

  // ── Decorative cars ───────────────────────────────────────────────────────

  _drawCars() {
    const carPositions = [
      { localId: 2, t: 0.50 }, { localId: 5, t: 0.35 }, { localId: 8, t: 0.60 },
      { localId: 11, t: 0.45 }, { localId: 14, t: 0.55 }, { localId: 17, t: 0.40 },
    ];
    for (let ci = 0; ci < carPositions.length; ci++) {
      const { localId, t } = carPositions[ci];
      const { x: ax, y: ay } = nodePos(localId);
      const { x: bx, y: by } = nodePos(localId + 1);
      const cx = ax + (bx - ax) * t, cy = ay + (by - ay) * t;
      this._drawMiniCar(cx, cy, Math.atan2(by - ay, bx - ax),
        LEVEL_COLORS[(localId + ci) % LEVEL_COLORS.length]);
    }
  }

  _drawMiniCar(cx, cy, angle, color) {
    const g = new Graphics();
    g.rect(-9, -5, 18, 10); g.fill({ color, alpha: 0.92 });
    g.rect(-5, -3, 10, 6);  g.fill({ color: 0x111122, alpha: 0.75 });
    g.circle(-9, -3, 1.5);  g.fill({ color: 0xffffcc, alpha: 0.90 });
    g.circle(-9,  3, 1.5);  g.fill({ color: 0xffffcc, alpha: 0.90 });
    g.x = cx; g.y = cy; g.rotation = angle;
    this._container.addChild(g);
  }

  // ── Level nodes ───────────────────────────────────────────────────────────

  _buildNode(levelId, x, y, stars, isUnlocked, isWeekly, onClick) {
    const color = levelColor(levelId);
    const node  = new Container();
    node.x = x; node.y = y;
    this._container.addChild(node);

    // Shadow
    const shadow = new Graphics();
    shadow.circle(3, 5, NODE_R + 3); shadow.fill({ color: 0x000000, alpha: 0.40 });
    node.addChild(shadow);

    if (isUnlocked) {
      // Outer coloured glow ring
      const glow = new Graphics();
      glow.circle(0, 0, NODE_R + 7);
      glow.fill({ color, alpha: 0.30 });
      node.addChild(glow);

      // White border
      const border = new Graphics();
      border.circle(0, 0, NODE_R + 3);
      border.fill({ color: 0xffffff, alpha: 0.85 });
      node.addChild(border);

      // Coloured disc
      const disc = new Graphics();
      disc.circle(0, 0, NODE_R);
      disc.fill(color);
      // Shine overlay
      disc.arc(0, 0, NODE_R - 2, Math.PI * 1.1, Math.PI * 1.75);
      disc.stroke({ color: 0xffffff, width: 4, alpha: 0.30 });
      node.addChild(disc);

      // Stars completed: show star count or level number
      if (stars > 0) {
        const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
        const st = new Text({ text: starStr, style: { fontSize: 11, fill: 0xffee00 } });
        st.anchor.set(0.5, 0.5); st.y = 9;
        node.addChild(st);
        const num = new Text({ text: String(levelId), style: { fontSize: 13, fontWeight: 'bold', fill: 0xffffff } });
        num.anchor.set(0.5, 0.5); num.y = -7;
        node.addChild(num);
      } else {
        const num = new Text({ text: String(levelId), style: { fontSize: 16, fontWeight: 'bold', fill: 0xffffff,
          dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.6 },
        }});
        num.anchor.set(0.5, 0.5);
        node.addChild(num);
      }

      if (isWeekly) {
        const wk = new Text({ text: '⭐', style: { fontSize: 11 } });
        wk.anchor.set(0.5, 0.5); wk.x = NODE_R - 3; wk.y = -NODE_R + 4;
        node.addChild(wk);
      }

      disc.eventMode = 'static'; disc.cursor = 'pointer';
      disc.on('pointerdown', onClick);
      disc.on('pointerover',  () => { node.scale.set(1.10); });
      disc.on('pointerout',   () => { node.scale.set(1.00); });
    } else {
      // Locked node — dim grey
      const disc = new Graphics();
      disc.circle(0, 0, NODE_R + 3); disc.fill({ color: 0x1a2030, alpha: 0.85 });
      disc.circle(0, 0, NODE_R);     disc.fill(0x0d1020);
      node.addChild(disc);
      const lock = new Graphics();
      lock.arc(0, -4, 5, Math.PI, 0, false);
      lock.stroke({ color: 0x2a3a4a, width: 2, alpha: 0.70 });
      lock.roundRect(-5, -2, 10, 8, 2); lock.fill({ color: 0x1a2a38, alpha: 0.85 });
      lock.circle(0, 2, 2);            lock.fill(0x0d141e);
      node.addChild(lock);
    }

    return node;
  }

  // ── Header ────────────────────────────────────────────────────────────────

  _buildHeader(w, progress, onBack, onShop, onAchievements, audio) {
    const hg = new Graphics();
    hg.rect(0, 0, w, HEADER_H); hg.fill({ color: 0x060c18, alpha: 0.96 });
    hg.moveTo(0, HEADER_H); hg.lineTo(w, HEADER_H);
    hg.stroke({ color: 0x2a4a7a, width: 1.5, alpha: 0.70 });
    this._container.addChild(hg);

    const mkBtn = (txt, x, anchorX, y, color, cb) => {
      const t = new Text({ text: txt, style: { fontSize: 14, fontWeight: 'bold', fill: color } });
      t.anchor.set(anchorX, 0.5); t.x = x; t.y = y;
      t.eventMode = 'static'; t.cursor = 'pointer';
      t.on('pointerdown', () => { audio?.play('button_tap'); cb(); });
      t.on('pointerover', () => { t.alpha = 0.70; });
      t.on('pointerout',  () => { t.alpha = 1.00; });
      this._container.addChild(t);
      return t;
    };

    mkBtn('← BACK', 14,   0, 22, 0x66aaff, onBack);
    mkBtn('SHOP',   w-14, 1, 22, 0xf5c842, () => onShop?.());
    if (onAchievements) mkBtn('★ ACHIEVEMENTS', w - 14, 1, 50, 0x99bbcc, onAchievements);

    const title = new Text({ text: `WORLD ${this._worldPage}`, style: {
      fontSize: 22, fontWeight: 'bold', fill: 0xffffff,
      dropShadow: { color: 0x3399ff, blur: 10, distance: 0, alpha: 0.7 },
    }});
    title.anchor.set(0.5, 0.5); title.x = w / 2; title.y = 22;
    this._container.addChild(title);

    const coins = new Text({ text: `🏅 ${progress.coins ?? 0}`, style: { fontSize: 14, fontWeight: 'bold', fill: 0xf5c842 } });
    coins.anchor.set(0, 0.5); coins.x = 14; coins.y = 50;
    this._container.addChild(coins);

    const canW2 = (progress.unlockedLevel ?? 1) > 20;
    if (this._worldPage === 1 && canW2) {
      mkBtn('W2 ▶', w / 2 + 70, 1, 22, 0x66aaff, () => this._switchWorld(2));
    }
    if (this._worldPage === 2) {
      mkBtn('◀ W1', w / 2 - 70, 0, 22, 0x66aaff, () => this._switchWorld(1));
    }
  }

  _switchWorld(page) {
    this._worldPage = page;
    this._container.removeChildren();
    this._glowNode = null; this._glowTime = 0; this._revealAnims = [];
    const { onSelectLevel, onBack, onShop, onAchievements, audio } = this._callbacks;
    this._build(this._appW, this._appH, this._progress,
      onSelectLevel, onBack, onShop, onAchievements, audio);
  }
}
