// SettingsScreen — full settings overlay.
//
// Sections:
//   • Sound         — SFX volume + Music volume sliders
//   • Accessibility — Colorblind mode toggle (shape symbols on colors)
//   • Controls      — Haptic feedback toggle
//   • How to Play   — 3-slide step-through tutorial
//   • Credits
import { Container, Graphics, Text } from 'pixi.js';
import { setColorblindMode } from '../game/ColorblindMode.js';

const VERSION = 'v1.1.0';

const SLIDES = [
  {
    num:  '01',
    head: 'Drag to Fire',
    body: 'Drag a shooter up from\nthe bottom columns into\na lane matching its color.',
  },
  {
    num:  '02',
    head: 'Stop the Breach',
    body: 'Destroy every car before\nit crosses the red breach\nline at the bottom.',
  },
  {
    num:  '03',
    head: 'Build Combos',
    body: 'Chain kills quickly for\nbonus coins and a\nspeed boost!',
  },
];

export class SettingsScreen {
  /**
   * @param {object} audio    — AudioManager
   * @param {object} opts     — { onClose }
   * @param {object} progress — ProgressManager (optional)
   * @param {object} haptics  — HapticsManager (optional)
   */
  constructor(stage, appW, appH, audio, { onClose }, progress = null, haptics = null) {
    this._stage    = stage;
    this._appW     = appW;
    this._appH     = appH;
    this._audio    = audio;
    this._progress = progress;
    this._haptics  = haptics;
    this._onClose  = onClose;
    this._slideIdx = 0;

    this._container   = new Container();
    this._slideHolder = null;
    stage.addChild(this._container);
    this._build();
  }

  destroy() { this._container.destroy({ children: true }); }

  // ── Private ────────────────────────────────────────────────────────────────

  _build() {
    const w = this._appW, h = this._appH;
    const cx = w / 2;

    const bg = new Graphics();
    bg.rect(0, 0, w, h);
    bg.fill(0x060610);
    bg.eventMode = 'static';
    this._container.addChild(bg);

    // Nav bar
    const back = new Text({ text: '← BACK', style: { fontSize: 15, fontWeight: 'bold', fill: 0x44aaff } });
    back.anchor.set(0, 0.5); back.x = 14; back.y = 34;
    back.eventMode = 'static'; back.cursor = 'pointer';
    back.on('pointerdown', () => { this._audio?.play('button_tap'); this._onClose(); });
    this._container.addChild(back);
    this._addText('SETTINGS', cx, 34, { fontSize: 22, fill: 0xffffff });
    this._addSep(56);

    let y = 76;

    // ── Sound ─────────────────────────────────────────────────────────────
    this._addText('SOUND', 14, y, { fontSize: 13, fill: 0x7799aa }, { anchor: [0, 0.5] });
    y += 20;

    y = this._addVolumeRow('SFX Volume', y,
      this._progress?.sfxVolume ?? 1.0,
      (v) => { this._progress?.setSfxVolume(v); this._audio?.setSfxVolume?.(v); });

    y = this._addVolumeRow('Music Volume', y,
      this._progress?.musicVolume ?? 1.0,
      (v) => { this._progress?.setMusicVolume(v); this._audio?.setMusicVolume?.(v); });

    this._addSep(y); y += 22;

    // ── Accessibility ────────────────────────────────────────────────────
    this._addText('ACCESSIBILITY', 14, y, { fontSize: 13, fill: 0x7799aa }, { anchor: [0, 0.5] });
    y += 20;

    y = this._addToggleRow(
      'Colorblind Mode',
      'Shape symbols on colors  ●▲■★◆▼',
      this._progress?.colorblindMode ?? false,
      y,
      (v) => { this._progress?.setColorblindMode(v); setColorblindMode(v); this._audio?.play('button_tap'); },
    );

    this._addSep(y); y += 22;

    // ── Controls ─────────────────────────────────────────────────────────
    this._addText('CONTROLS', 14, y, { fontSize: 13, fill: 0x7799aa }, { anchor: [0, 0.5] });
    y += 20;

    y = this._addToggleRow(
      'Haptic Feedback',
      'Vibration on deploy & kills',
      this._progress?.hapticsEnabled ?? true,
      y,
      (v) => {
        this._progress?.setHapticsEnabled(v);
        if (this._haptics) this._haptics.enabled = v;
        this._audio?.play('button_tap');
        if (v) this._haptics?.light();
      },
    );

    this._addSep(y); y += 22;

    // ── How to Play ───────────────────────────────────────────────────────
    this._addText('HOW TO PLAY', cx, y, { fontSize: 13, fill: 0x7799aa });
    y += 14;

    const slideBoxH = 160;
    const sbg = new Graphics();
    sbg.roundRect(14, y, w - 28, slideBoxH, 12);
    sbg.fill({ color: 0x0d1a2e, alpha: 0.85 });
    sbg.stroke({ color: 0x224466, width: 1, alpha: 0.50 });
    this._container.addChild(sbg);

    this._slideHolder = new Container();
    this._slideBoxY   = y;
    this._slideBoxH   = slideBoxH;
    this._container.addChild(this._slideHolder);
    this._renderSlide(y, slideBoxH);

    const navY = y + slideBoxH + 18;
    this._buildSlideNav(w, navY);
    this._addSep(navY + 28);

    // ── Credits ───────────────────────────────────────────────────────────
    const credY = navY + 60;
    this._addText('CREDITS', cx, credY,        { fontSize: 13, fill: 0x7799aa });
    this._addText('Made by Nadav', cx, credY + 26, { fontSize: 16, fill: 0xddeeee, fontWeight: 'normal' });
    this._addText(VERSION, cx, credY + 50,     { fontSize: 11, fill: 0x445566, fontWeight: 'normal' });
  }

  // ── Volume slider row ──────────────────────────────────────────────────────
  _addVolumeRow(label, y, initialValue, onChange) {
    const w    = this._appW;
    const rowH = 42;
    const cx   = w / 2;

    this._addText(label, 14, y + rowH / 2,
      { fontSize: 14, fill: 0xccddee }, { anchor: [0, 0.5] });

    const TRACK_X = w - 160;
    const TRACK_W = 138;
    const TRACK_Y = y + rowH / 2;
    let value = Math.max(0, Math.min(1, initialValue));

    const track = new Graphics();
    const fill  = new Graphics();
    const thumb = new Graphics();
    this._container.addChild(track);
    this._container.addChild(fill);
    this._container.addChild(thumb);

    const redraw = (v) => {
      const tx = TRACK_X + v * TRACK_W;
      track.clear();
      track.roundRect(TRACK_X, TRACK_Y - 3, TRACK_W, 6, 3);
      track.fill(0x1a2a3a);
      fill.clear();
      fill.roundRect(TRACK_X, TRACK_Y - 3, v * TRACK_W, 6, 3);
      fill.fill(0x44aaff);
      thumb.clear();
      thumb.circle(tx, TRACK_Y, 9);
      thumb.fill(0xffffff);
    };
    redraw(value);

    const hitZone = new Graphics();
    hitZone.rect(TRACK_X - 4, TRACK_Y - 16, TRACK_W + 8, 32);
    hitZone.fill({ color: 0xffffff, alpha: 0.001 });
    hitZone.eventMode = 'static'; hitZone.cursor = 'pointer';
    this._container.addChild(hitZone);

    const onMove = (e) => {
      const localX = e.global?.x ?? e.x;
      value = Math.max(0, Math.min(1, (localX - TRACK_X) / TRACK_W));
      redraw(value);
      onChange(value);
    };
    hitZone.on('pointerdown', onMove);
    hitZone.on('pointermove', (e) => { if (e.buttons > 0) onMove(e); });

    void cx;
    return y + rowH;
  }

  // ── Toggle row ─────────────────────────────────────────────────────────────
  _addToggleRow(label, sublabel, initialValue, y, onChange) {
    const w    = this._appW;
    const rowH = 48;

    this._addText(label, 14, y + 13,
      { fontSize: 14, fill: 0xccddee }, { anchor: [0, 0.5] });
    this._addText(sublabel, 14, y + 34,
      { fontSize: 11, fill: 0x556677, fontWeight: 'normal' }, { anchor: [0, 0.5] });

    this._buildCompactToggle(w - 14, y + rowH / 2, initialValue, onChange);
    return y + rowH;
  }

  _buildCompactToggle(rx, cy, initial, onToggle) {
    const W = 68, H = 30;
    let on = initial;

    const btn = new Graphics();
    btn.x = rx; btn.y = cy;
    btn.eventMode = 'static'; btn.cursor = 'pointer';
    this._container.addChild(btn);

    const lbl = new Text({ text: '', style: { fontSize: 13, fontWeight: 'bold', fill: 0x55ff99 } });
    lbl.anchor.set(0.5, 0.5); lbl.x = -W / 2; lbl.y = 0;
    btn.addChild(lbl);

    const draw = () => {
      btn.clear();
      btn.roundRect(-W, -H / 2, W, H, 9);
      btn.fill(on ? 0x1a4a2a : 0x1a1a1a);
      btn.roundRect(-W, -H / 2, W, H, 9);
      btn.stroke({ color: on ? 0x44aa66 : 0x333333, width: 1.5, alpha: 0.8 });
      lbl.text  = on ? 'ON' : 'OFF';
      lbl.style = { fontSize: 13, fontWeight: 'bold', fill: on ? 0x55ff99 : 0x555555 };
    };
    draw();

    btn.on('pointerdown', () => { on = !on; draw(); onToggle(on); });
    btn.on('pointerover',  () => { btn.alpha = 0.75; });
    btn.on('pointerout',   () => { btn.alpha = 1.00; });
    return btn;
  }

  _renderSlide(boxY, boxH) {
    this._slideHolder.removeChildren().forEach(c => c.destroy({ children: true }));
    const w     = this._appW;
    const slide = SLIDES[this._slideIdx];
    const cx    = w / 2;
    const midY  = boxY + boxH / 2;

    const num = new Text({ text: slide.num, style: { fontSize: 38, fontWeight: 'bold', fill: 0x334455 } });
    num.anchor.set(0.5, 0.5); num.x = cx; num.y = midY - 44;
    this._slideHolder.addChild(num);

    const head = new Text({ text: slide.head, style: { fontSize: 19, fontWeight: 'bold', fill: 0x44ff88 } });
    head.anchor.set(0.5, 0.5); head.x = cx; head.y = midY - 12;
    this._slideHolder.addChild(head);

    const body = new Text({ text: slide.body, style: { fontSize: 13, fill: 0xaabbcc, fontWeight: 'normal', align: 'center' } });
    body.anchor.set(0.5, 0.5); body.x = cx; body.y = midY + 40;
    this._slideHolder.addChild(body);
  }

  _buildSlideNav(w, y) {
    const cx = w / 2;
    this._slideCounterTxt = new Text({
      text: `${this._slideIdx + 1} / ${SLIDES.length}`,
      style: { fontSize: 13, fontWeight: 'bold', fill: 0x6688aa },
    });
    this._slideCounterTxt.anchor.set(0.5, 0.5);
    this._slideCounterTxt.x = cx; this._slideCounterTxt.y = y;
    this._container.addChild(this._slideCounterTxt);

    for (const [dir, txt, ox] of [[-1, '◀', -48], [1, '▶', 48]]) {
      const btn = new Text({ text: txt, style: { fontSize: 19, fill: 0x44aaff } });
      btn.anchor.set(0.5, 0.5); btn.x = cx + ox; btn.y = y;
      btn.eventMode = 'static'; btn.cursor = 'pointer';
      btn.on('pointerdown', () => this._navSlide(dir));
      btn.on('pointerover',  () => { btn.alpha = 0.65; });
      btn.on('pointerout',   () => { btn.alpha = 1.00; });
      this._container.addChild(btn);
    }
  }

  _navSlide(dir) {
    this._slideIdx = (this._slideIdx + dir + SLIDES.length) % SLIDES.length;
    this._renderSlide(this._slideBoxY, this._slideBoxH);
    this._slideCounterTxt.text = `${this._slideIdx + 1} / ${SLIDES.length}`;
  }

  _addText(str, x, y, style, opts = {}) {
    const t = new Text({ text: str, style: { fontWeight: 'bold', ...style } });
    const anchor = opts.anchor ?? [0.5, 0.5];
    t.anchor.set(...anchor); t.x = x; t.y = y;
    this._container.addChild(t);
    return t;
  }

  _addSep(y) {
    const g = new Graphics();
    g.rect(14, y, this._appW - 28, 1);
    g.fill({ color: 0x224466, alpha: 0.45 });
    this._container.addChild(g);
  }
}
