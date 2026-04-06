// SettingsScreen — full-screen settings overlay.
//
// Sections:
//   • Sound toggle — ON/OFF, synced immediately with AudioManager
//   • How to Play  — 3-slide step-through tutorial
//   • Credits      — "Made by Nadav"  •  version "v0.1.0"
import { Container, Graphics, Text } from 'pixi.js';

const VERSION = 'v0.1.0';

const SLIDES = [
  {
    num:  '01',
    head: 'Drag to Fire',
    body: 'Drag a shooter up from\nthe bottom columns into\na lane that matches its color.',
  },
  {
    num:  '02',
    head: 'Stop the Breach',
    body: 'Destroy every car before\nit crosses the red breach\nline at the bottom.',
  },
  {
    num:  '03',
    head: 'Build Combos',
    body: 'Chain kills in quick\nsuccession for bonus coins\nand a speed boost!',
  },
];

export class SettingsScreen {
  // audio    — AudioManager (for mute toggle)
  // onClose  — called when the back button is pressed
  constructor(stage, appW, appH, audio, { onClose }) {
    this._stage    = stage;
    this._appW     = appW;
    this._appH     = appH;
    this._audio    = audio;
    this._onClose  = onClose;
    this._slideIdx = 0;

    this._container   = new Container();
    this._slideHolder = null;
    stage.addChild(this._container);
    this._build();
  }

  destroy() {
    this._container.destroy({ children: true });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build() {
    const w = this._appW;

    // Full-screen background
    const bg = new Graphics();
    bg.rect(0, 0, w, this._appH);
    bg.fill(0x060610);
    bg.eventMode = 'static';
    this._container.addChild(bg);

    // ── Nav bar ───────────────────────────────────────────────────────────
    const backBtn = new Text({
      text: '← BACK',
      style: { fontSize: 15, fontWeight: 'bold', fill: 0x44aaff },
    });
    backBtn.anchor.set(0, 0.5);
    backBtn.x = 14;
    backBtn.y = 34;
    backBtn.eventMode = 'static';
    backBtn.cursor    = 'pointer';
    backBtn.on('pointerdown', () => { this._audio?.play('button_tap'); this._onClose(); });
    this._container.addChild(backBtn);

    this._addText('SETTINGS', w / 2, 34, { fontSize: 22, fill: 0xffffff });

    this._addSep(58);

    // ── Sound toggle ──────────────────────────────────────────────────────
    this._addText('SOUND', 24, 96, { fontSize: 16, fill: 0x99bbcc }, { anchor: [0, 0.5] });
    this._soundToggle = this._buildToggle(w - 24, 96);

    this._addSep(124);

    // ── How to Play ───────────────────────────────────────────────────────
    this._addText('HOW TO PLAY', w / 2, 154, { fontSize: 16, fill: 0x99bbcc });

    // Slide box background
    const slideBoxY = 172;
    const slideBoxH = 200;
    const sbg = new Graphics();
    sbg.roundRect(14, slideBoxY, w - 28, slideBoxH, 12);
    sbg.fill({ color: 0x0d1a2e, alpha: 0.85 });
    sbg.stroke({ color: 0x224466, width: 1, alpha: 0.50 });
    this._container.addChild(sbg);

    this._slideHolder = new Container();
    this._container.addChild(this._slideHolder);
    this._renderSlide(slideBoxY, slideBoxH);

    // Prev / next nav
    const navY = slideBoxY + slideBoxH + 22;
    this._buildSlideNav(w, navY);

    this._addSep(navY + 36);

    // ── Credits ───────────────────────────────────────────────────────────
    const credY = navY + 70;
    this._addText('CREDITS', w / 2, credY, { fontSize: 16, fill: 0x99bbcc });
    this._addText('Made by Nadav', w / 2, credY + 32,
      { fontSize: 18, fill: 0xddeeee, fontWeight: 'normal' });
    this._addText(VERSION, w / 2, credY + 64,
      { fontSize: 14, fill: 0x445566, fontWeight: 'normal' });
  }

  // Replace only the slide content without rebuilding everything.
  _renderSlide(boxY, boxH) {
    this._slideHolder.removeChildren().forEach(c => c.destroy({ children: true }));

    const w     = this._appW;
    const slide = SLIDES[this._slideIdx];
    const cx    = w / 2;
    const midY  = boxY + boxH / 2;

    const num = new Text({
      text: slide.num,
      style: { fontSize: 42, fontWeight: 'bold', fill: 0x334455 },
    });
    num.anchor.set(0.5, 0.5);
    num.x = cx;
    num.y = midY - 52;
    this._slideHolder.addChild(num);

    const head = new Text({
      text: slide.head,
      style: { fontSize: 22, fontWeight: 'bold', fill: 0x44ff88 },
    });
    head.anchor.set(0.5, 0.5);
    head.x = cx;
    head.y = midY - 14;
    this._slideHolder.addChild(head);

    const body = new Text({
      text: slide.body,
      style: { fontSize: 14, fill: 0xaabbcc, fontWeight: 'normal', align: 'center' },
    });
    body.anchor.set(0.5, 0.5);
    body.x = cx;
    body.y = midY + 48;
    this._slideHolder.addChild(body);
  }

  _buildSlideNav(w, y) {
    const cx = w / 2;

    // Slide counter "1 / 3"
    this._slideCounterTxt = new Text({
      text: `${this._slideIdx + 1} / ${SLIDES.length}`,
      style: { fontSize: 15, fontWeight: 'bold', fill: 0x6688aa },
    });
    this._slideCounterTxt.anchor.set(0.5, 0.5);
    this._slideCounterTxt.x = cx;
    this._slideCounterTxt.y = y;
    this._container.addChild(this._slideCounterTxt);

    // Prev arrow
    const prevBtn = new Text({ text: '◀', style: { fontSize: 22, fill: 0x44aaff } });
    prevBtn.anchor.set(0.5, 0.5);
    prevBtn.x = cx - 56;
    prevBtn.y = y;
    prevBtn.eventMode = 'static';
    prevBtn.cursor    = 'pointer';
    prevBtn.on('pointerdown', () => this._navSlide(-1));
    prevBtn.on('pointerover',  () => { prevBtn.alpha = 0.65; });
    prevBtn.on('pointerout',   () => { prevBtn.alpha = 1.00; });
    this._container.addChild(prevBtn);

    // Next arrow
    const nextBtn = new Text({ text: '▶', style: { fontSize: 22, fill: 0x44aaff } });
    nextBtn.anchor.set(0.5, 0.5);
    nextBtn.x = cx + 56;
    nextBtn.y = y;
    nextBtn.eventMode = 'static';
    nextBtn.cursor    = 'pointer';
    nextBtn.on('pointerdown', () => this._navSlide(+1));
    nextBtn.on('pointerover',  () => { nextBtn.alpha = 0.65; });
    nextBtn.on('pointerout',   () => { nextBtn.alpha = 1.00; });
    this._container.addChild(nextBtn);
  }

  _navSlide(dir) {
    this._slideIdx = (this._slideIdx + dir + SLIDES.length) % SLIDES.length;
    this._renderSlide(172, 200);   // keep in sync with _build layout
    this._slideCounterTxt.text = `${this._slideIdx + 1} / ${SLIDES.length}`;
  }

  _buildToggle(rx, y) {
    const muted = this._audio.muted;
    const W = 90, H = 38;

    const btn = new Graphics();
    btn.roundRect(-W, -H / 2, W, H, 10);
    btn.fill(muted ? 0x1a1a1a : 0x1a4a2a);
    btn.roundRect(-W, -H / 2, W, H, 10);
    btn.stroke({ color: muted ? 0x333333 : 0x44aa66, width: 1.5, alpha: 0.8 });
    btn.x = rx;
    btn.y = y;
    btn.eventMode = 'static';
    btn.cursor    = 'pointer';
    btn.on('pointerdown', () => {
      this._audio?.play('button_tap');
      this._audio?.toggleMute();
      this._rebuildToggle(btn, rx, y);
    });
    btn.on('pointerover',  () => { btn.alpha = 0.75; });
    btn.on('pointerout',   () => { btn.alpha = 1.00; });

    const label = new Text({
      text: muted ? 'OFF' : 'ON',
      style: { fontSize: 16, fontWeight: 'bold', fill: muted ? 0x555555 : 0x55ff99 },
    });
    label.anchor.set(0.5, 0.5);
    label.x = -W / 2;
    label.y = 0;
    btn.addChild(label);

    this._container.addChild(btn);
    return btn;
  }

  _rebuildToggle(oldBtn, rx, y) {
    const idx = this._container.children.indexOf(oldBtn);
    oldBtn.destroy({ children: true });
    const newBtn = this._buildToggle(rx, y);
    // Move to same z-position (addChild always appends; this is fine visually).
    void idx;  // z-order doesn't matter here since toggle is isolated
    this._soundToggle = newBtn;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _addText(str, x, y, style, opts = {}) {
    const t = new Text({ text: str, style: { fontWeight: 'bold', ...style } });
    const anchor = opts.anchor ?? [0.5, 0.5];
    t.anchor.set(...anchor);
    t.x = x;
    t.y = y;
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
