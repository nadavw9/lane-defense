// SettingsScreen — full Lane Defense design-system rewrite.
//
// Layout (390×844):
//   Header bar  64px — ← BACK pill  |  ⚙ SETTINGS  |
//   Sound card       — SFX + Music sliders with % readout
//   Accessibility    — Colorblind Mode iOS-toggle
//   Controls         — Haptic Feedback iOS-toggle
//   How To Play      — 3-slide step cards + dots + ◀/▶ nav
//   Credits footer
//
// All values follow colors_and_type.css tokens.
import { Container, Graphics, Text } from 'pixi.js';
import { setColorblindMode } from '../game/ColorblindMode.js';
import { uiIcon } from '../renderer/UIIcon.js';

const VERSION = 'v1.1.0';

const SLIDES = [
  {
    num: '01', accent: 0x378ADD,
    head: 'DRAG TO FIRE',
    body: 'Drag a bomb up from the bottom\ninto a lane matching its color.',
  },
  {
    num: '02', accent: 0xE24B4A,
    head: 'STOP THE BREACH',
    body: 'Destroy every car before it crosses\nthe red breach line at the bottom.',
  },
  {
    num: '03', accent: 0xffcc22,
    head: 'BUILD COMBOS',
    body: 'Chain kills quickly for bonus coins\nand a speed boost!',
  },
];

// ── Design tokens ─────────────────────────────────────────────────────────────
const C_BG     = 0x060610;   // --hud-bg
const C_PANEL  = 0x0d1a2e;   // --panel-bg
const C_ROW    = 0x081420;   // --row-bg
const C_LABEL  = 0x7799aa;   // muted section header
const C_SEP    = 0x1a2a3a;   // inner card divider
const C_TEXT   = 0xffffff;
const C_SUB    = 0x556677;
const C_BLUE   = 0x44aaff;   // slider fill, back button
const C_GREEN  = 0x276b27;   // toggle ON track

const CARD_MX  = 14;   // horizontal margin
const CARD_R   = 14;   // corner radius
const CARD_P   = 14;   // inner padding
const CARD_W   = 390 - CARD_MX * 2;   // 362

// ── Section card dimensions ───────────────────────────────────────────────────
// Sound:         label(22) + gap(8) + sep(1) + row(44) + sep(1) + row(44) + padV(14+12) = 146
// Accessibility: label(22) + gap(8) + sep(1) + row(56) + padV(14+12)                   = 113
// Controls:      same as accessibility                                                  = 113
// HowToPlay:     label(22) + gap(8) + sep(1) + slide(148) + nav(36) + padV(14+12)      = 241

export class SettingsScreen {
  constructor(stage, appW, appH, audio, { onClose }, progress = null, haptics = null) {
    this._stage    = stage;
    this._appW     = appW;
    this._appH     = appH;
    this._audio    = audio;
    this._progress = progress;
    this._haptics  = haptics;
    this._onClose  = onClose;
    this._slideIdx = 0;

    this._slideHolder  = null;
    this._slideNavTxt  = null;
    this._slideBoxY    = 0;
    this._slideBoxH    = 148;

    this._container = new Container();
    stage.addChild(this._container);
    this._build();
  }

  destroy() { this._container.destroy({ children: true }); }

  // ── Build ─────────────────────────────────────────────────────────────────

  _build() {
    const w = this._appW;

    // Full-screen dark background
    const bg = new Graphics();
    bg.rect(0, 0, w, this._appH);
    bg.fill(C_BG);
    bg.rect(0, 0, w, 160);
    bg.fill({ color: 0x08081a, alpha: 0.55 });
    bg.eventMode = 'static';
    this._container.addChild(bg);

    this._buildHeader();

    let y = 76;
    y = this._buildSoundCard(y);       y += 10;
    y = this._buildAccessCard(y);      y += 10;
    y = this._buildControlsCard(y);    y += 10;
    y = this._buildHowToPlayCard(y);   y += 10;
    this._buildCredits(y);
  }

  // ── Header bar ────────────────────────────────────────────────────────────

  _buildHeader() {
    const w  = this._appW;
    const cx = w / 2;

    const hdr = new Graphics();
    hdr.rect(0, 0, w, 64);
    hdr.fill({ color: 0x08081a, alpha: 0.95 });
    hdr.rect(0, 63, w, 1);
    hdr.fill({ color: 0xffffff, alpha: 0.07 });
    this._container.addChild(hdr);

    // Back pill button
    const backPill = new Graphics();
    backPill.roundRect(10, 14, 82, 36, 18);
    backPill.fill({ color: 0xffffff, alpha: 0.07 });
    backPill.roundRect(10, 14, 82, 36, 18);
    backPill.stroke({ color: C_BLUE, width: 1, alpha: 0.45 });
    backPill.eventMode = 'static'; backPill.cursor = 'pointer';
    this._container.addChild(backPill);
    backPill.on('pointerdown', () => { this._audio?.play('button_tap'); this._onClose(); });
    backPill.on('pointerover',  () => { backPill.alpha = 0.70; });
    backPill.on('pointerout',   () => { backPill.alpha = 1.00; });

    const backTxt = new Text({ text: '← BACK', style: { fontSize: 15, fontWeight: 'bold', fill: C_BLUE, letterSpacing: 0.4 } });
    backTxt.anchor.set(0.5, 0.5); backTxt.x = 51; backTxt.y = 32;
    backTxt.eventMode = 'static'; backTxt.cursor = 'pointer';
    backTxt.on('pointerdown', () => { this._audio?.play('button_tap'); this._onClose(); });
    this._container.addChild(backTxt);

    // Title centered — [gear] SETTINGS
    const title = new Text({ text: 'SETTINGS', style: { fontSize: 20, fontWeight: 'bold', fill: C_TEXT, letterSpacing: 0.5,
      dropShadow: { color: 0x000000, blur: 6, distance: 0, alpha: 0.6 } } });
    title.anchor.set(0, 0.5);
    const gearIco = uiIcon('gear', 22, '⚙');
    const tTot = 22 + 6 + title.width;
    gearIco.x = cx - tTot / 2 + 11;      gearIco.y = 32;
    title.x   = cx - tTot / 2 + 22 + 6;  title.y   = 32;
    this._container.addChild(gearIco);
    this._container.addChild(title);
  }

  // ── Sound card ────────────────────────────────────────────────────────────

  _buildSoundCard(y) {
    const h = 146;
    this._drawCard(y, h);

    const ry0 = y + CARD_P;
    this._addSectionLabel('🔊', 'SOUND', ry0 + 11);
    this._drawInnerSep(ry0 + 22 + 8);

    let ry = ry0 + 22 + 9;
    ry = this._addVolumeRow('SFX Volume', ry, 44,
      this._progress?.sfxVolume ?? 1.0,
      (v) => { this._progress?.setSfxVolume(v); this._audio?.setSfxVolume?.(v); },
    );
    this._drawInnerSep(ry);
    this._addVolumeRow('Music Volume', ry, 44,
      this._progress?.musicVolume ?? 1.0,
      (v) => { this._progress?.setMusicVolume(v); this._audio?.setMusicVolume?.(v); },
    );
    return y + h;
  }

  // ── Accessibility card ────────────────────────────────────────────────────

  _buildAccessCard(y) {
    const h = 113;
    this._drawCard(y, h);

    const ry0 = y + CARD_P;
    this._addSectionLabel('♿', 'ACCESSIBILITY', ry0 + 11);
    this._drawInnerSep(ry0 + 22 + 8);

    this._addToggleRow(
      'Colorblind Mode',
      '●▲■★◆▼  Shape symbols on colors',
      ry0 + 22 + 9, 56,
      this._progress?.colorblindMode ?? false,
      (v) => { this._progress?.setColorblindMode(v); setColorblindMode(v); this._audio?.play('button_tap'); },
    );
    return y + h;
  }

  // ── Controls card ─────────────────────────────────────────────────────────

  _buildControlsCard(y) {
    const h = 113;
    this._drawCard(y, h);

    const ry0 = y + CARD_P;
    this._addSectionLabel('🕹', 'CONTROLS', ry0 + 11);
    this._drawInnerSep(ry0 + 22 + 8);

    this._addToggleRow(
      'Haptic Feedback',
      'Vibration on deploy & kills',
      ry0 + 22 + 9, 56,
      this._progress?.hapticsEnabled ?? true,
      (v) => {
        this._progress?.setHapticsEnabled(v);
        if (this._haptics) this._haptics.enabled = v;
        this._audio?.play('button_tap');
        if (v) this._haptics?.light();
      },
    );
    return y + h;
  }

  // ── How To Play card ──────────────────────────────────────────────────────

  _buildHowToPlayCard(y) {
    const slideH = 148;
    const navH   = 36;
    const h = CARD_P + 22 + 9 + slideH + navH + 12;   // 241

    this._drawCard(y, h);

    const ry0 = y + CARD_P;
    this._addSectionLabel('📖', 'HOW TO PLAY', ry0 + 11);
    this._drawInnerSep(ry0 + 22 + 8);

    this._slideBoxY = ry0 + 22 + 9;
    this._slideHolder = new Container();
    this._container.addChild(this._slideHolder);
    this._renderSlide();

    const navY = this._slideBoxY + slideH + navH / 2;
    this._buildSlideNav(navY);

    return y + h;
  }

  // ── Credits ───────────────────────────────────────────────────────────────

  _buildCredits(y) {
    const cx = this._appW / 2;
    const line = new Text({
      text: `Made by Nadav  ·  ${VERSION}`,
      style: { fontSize: 12, fill: 0x334455, fontWeight: 'normal' },
    });
    line.anchor.set(0.5, 0); line.x = cx; line.y = y + 8;
    this._container.addChild(line);
  }

  // ── Card drawing ──────────────────────────────────────────────────────────

  _drawCard(y, h) {
    const g = new Graphics();
    // Base fill
    g.roundRect(CARD_MX, y, CARD_W, h, CARD_R);
    g.fill({ color: C_PANEL, alpha: 0.97 });
    // Inset top highlight strip (top 2px of card)
    g.roundRect(CARD_MX, y, CARD_W, 2, 0);
    g.fill({ color: 0xffffff, alpha: 0.05 });
    // Border
    g.roundRect(CARD_MX, y, CARD_W, h, CARD_R);
    g.stroke({ color: 0xffffff, width: 1, alpha: 0.07 });
    this._container.addChild(g);
  }

  _addSectionLabel(icon, label, cy) {
    const t = new Text({
      text: `${icon}  ${label}`,
      style: { fontSize: 11, fontWeight: 'bold', fill: C_LABEL, letterSpacing: 0.6 },
    });
    t.anchor.set(0, 0.5);
    t.x = CARD_MX + CARD_P;
    t.y = cy;
    this._container.addChild(t);
  }

  _drawInnerSep(y) {
    const g = new Graphics();
    g.rect(CARD_MX + 14, y, CARD_W - 28, 1);
    g.fill({ color: C_SEP, alpha: 0.80 });
    this._container.addChild(g);
  }

  // ── Volume slider row ─────────────────────────────────────────────────────

  _addVolumeRow(label, y, rowH, initVal, onChange) {
    const w  = this._appW;
    const cy = y + rowH / 2;

    const labelTxt = new Text({ text: label, style: { fontSize: 14, fontWeight: 'bold', fill: 0xccddee } });
    labelTxt.anchor.set(0, 0.5);
    labelTxt.x = CARD_MX + CARD_P;
    labelTxt.y = cy;
    this._container.addChild(labelTxt);

    const TRACK_X = CARD_MX + CARD_P + 118;
    const VAL_X   = w - CARD_MX - CARD_P;
    const TRACK_W = VAL_X - 40 - TRACK_X;   // leave 40px for "100%"
    const TH = 6;
    let val = Math.max(0, Math.min(1, initVal));

    const valTxt = new Text({ text: `${Math.round(val * 100)}%`, style: { fontSize: 13, fontWeight: 'bold', fill: C_LABEL } });
    valTxt.anchor.set(1, 0.5);
    valTxt.x = VAL_X; valTxt.y = cy;
    this._container.addChild(valTxt);

    const gTrack = new Graphics();
    const gFill  = new Graphics();
    const gThumb = new Graphics();
    this._container.addChild(gTrack);
    this._container.addChild(gFill);
    this._container.addChild(gThumb);

    const redraw = (v) => {
      const tx = TRACK_X + v * TRACK_W;

      gTrack.clear();
      gTrack.roundRect(TRACK_X, cy - TH / 2, TRACK_W, TH, 3);
      gTrack.fill({ color: 0x1a2a3a });
      gTrack.roundRect(TRACK_X, cy - TH / 2, TRACK_W, TH, 3);
      gTrack.stroke({ color: 0x000000, width: 0.5, alpha: 0.35 });

      gFill.clear();
      if (v > 0.005) {
        gFill.roundRect(TRACK_X, cy - TH / 2, v * TRACK_W, TH, 3);
        gFill.fill(C_BLUE);
        gFill.roundRect(TRACK_X, cy - TH / 2, v * TRACK_W, 3, 1);
        gFill.fill({ color: 0xffffff, alpha: 0.22 });
      }

      gThumb.clear();
      gThumb.circle(tx, cy + 1.5, 9);
      gThumb.fill({ color: 0x000000, alpha: 0.20 });
      gThumb.circle(tx, cy, 9);
      gThumb.fill(0xffffff);
      gThumb.circle(tx - 2.5, cy - 2.5, 3);
      gThumb.fill({ color: 0xffffff, alpha: 0.55 });

      valTxt.text = `${Math.round(v * 100)}%`;
    };
    redraw(val);

    const hit = new Graphics();
    hit.rect(TRACK_X - 4, cy - 18, TRACK_W + 8, 36);
    hit.fill({ color: 0, alpha: 0.001 });
    hit.eventMode = 'static'; hit.cursor = 'pointer';
    this._container.addChild(hit);

    const move = (e) => {
      const lx = e.global?.x ?? e.x;
      val = Math.max(0, Math.min(1, (lx - TRACK_X) / TRACK_W));
      redraw(val);
      onChange(val);
    };
    hit.on('pointerdown', move);
    hit.on('pointermove', (e) => { if (e.buttons > 0) move(e); });

    return y + rowH;
  }

  // ── Toggle row (iOS-style pill) ───────────────────────────────────────────

  _addToggleRow(label, sublabel, y, rowH, initVal, onChange) {
    const w  = this._appW;
    const cy = y + rowH / 2;
    const TW = 52, TH = 28;
    let on = initVal;

    const labelTxt = new Text({ text: label, style: { fontSize: 14, fontWeight: 'bold', fill: 0xccddee } });
    labelTxt.anchor.set(0, 1);
    labelTxt.x = CARD_MX + CARD_P;
    labelTxt.y = cy + 1;
    this._container.addChild(labelTxt);

    const subTxt = new Text({ text: sublabel, style: { fontSize: 11, fill: C_SUB, fontWeight: 'normal' } });
    subTxt.anchor.set(0, 0);
    subTxt.x = CARD_MX + CARD_P;
    subTxt.y = cy + 5;
    this._container.addChild(subTxt);

    const tog = new Graphics();
    tog.x = w - CARD_MX - CARD_P - TW;
    tog.y = cy - TH / 2;
    tog.eventMode = 'static'; tog.cursor = 'pointer';

    const draw = () => {
      tog.clear();
      // Track fill
      tog.roundRect(0, 0, TW, TH, TH / 2);
      tog.fill(on ? C_GREEN : 0x1a1a2e);
      // Inner top sheen
      tog.roundRect(0, 0, TW, TH * 0.44, TH / 2);
      tog.fill({ color: 0xffffff, alpha: on ? 0.14 : 0.04 });
      // Track border
      tog.roundRect(0, 0, TW, TH, TH / 2);
      tog.stroke({ color: on ? 0x44aa66 : 0x2a3a4a, width: 1.5, alpha: 0.85 });
      // Thumb shadow
      const tx = on ? TW - 14 : 14;
      tog.circle(tx, TH / 2 + 1.2, 10);
      tog.fill({ color: 0x000000, alpha: 0.22 });
      // Thumb
      tog.circle(tx, TH / 2, 10);
      tog.fill(0xffffff);
      // Thumb inner shine
      tog.circle(tx - 2.5, TH / 2 - 2.5, 3.5);
      tog.fill({ color: 0xffffff, alpha: 0.60 });
    };
    draw();

    tog.on('pointerdown', () => { on = !on; draw(); onChange(on); });
    tog.on('pointerover',  () => { tog.alpha = 0.82; });
    tog.on('pointerout',   () => { tog.alpha = 1.00; });
    this._container.addChild(tog);
  }

  // ── Slide rendering ───────────────────────────────────────────────────────

  _renderSlide() {
    this._slideHolder.removeChildren().forEach(c => c.destroy({ children: true }));

    const w     = this._appW;
    const slide = SLIDES[this._slideIdx];
    const by    = this._slideBoxY;
    const bh    = this._slideBoxH;

    // Accent circle with step number
    const circR = 27;
    const circX = CARD_MX + CARD_P + circR;
    const circY = by + 32;

    const accentG = new Graphics();
    accentG.circle(circX, circY, circR);
    accentG.fill({ color: slide.accent, alpha: 0.16 });
    accentG.circle(circX, circY, circR);
    accentG.stroke({ color: slide.accent, width: 2, alpha: 0.60 });
    this._slideHolder.addChild(accentG);

    const numTxt = new Text({ text: slide.num, style: { fontSize: 20, fontWeight: 'bold', fill: slide.accent } });
    numTxt.anchor.set(0.5, 0.5); numTxt.x = circX; numTxt.y = circY;
    this._slideHolder.addChild(numTxt);

    // Heading right of circle
    const headTxt = new Text({ text: slide.head, style: {
      fontSize: 18, fontWeight: 'bold', fill: C_TEXT, letterSpacing: 0.4,
      dropShadow: { color: 0x000000, blur: 4, distance: 0, alpha: 0.5 },
    } });
    headTxt.anchor.set(0, 0.5);
    headTxt.x = CARD_MX + CARD_P + circR * 2 + 10;
    headTxt.y = circY;
    this._slideHolder.addChild(headTxt);

    // Body text below
    const bodyTxt = new Text({ text: slide.body, style: {
      fontSize: 14, fill: 0x889aaa, fontWeight: 'normal',
      align: 'left', wordWrap: true, wordWrapWidth: w - CARD_MX * 2 - CARD_P * 2,
      lineHeight: 20,
    } });
    bodyTxt.anchor.set(0, 0);
    bodyTxt.x = CARD_MX + CARD_P;
    bodyTxt.y = by + circR * 2 + 16;
    this._slideHolder.addChild(bodyTxt);

    // Step dots indicator
    const dotY    = by + bh - 14;
    const dotGap  = 16;
    const dotsX0  = w / 2 - ((SLIDES.length - 1) * dotGap) / 2;
    for (let i = 0; i < SLIDES.length; i++) {
      const dot = new Graphics();
      const r   = i === this._slideIdx ? 5.5 : 3.5;
      dot.circle(dotsX0 + i * dotGap, dotY, r);
      dot.fill(i === this._slideIdx ? slide.accent : 0x2a3a4a);
      this._slideHolder.addChild(dot);
    }
  }

  _buildSlideNav(cy) {
    const w  = this._appW;
    const cx = w / 2;

    this._slideNavTxt = new Text({
      text: `${this._slideIdx + 1} / ${SLIDES.length}`,
      style: { fontSize: 13, fontWeight: 'bold', fill: C_LABEL },
    });
    this._slideNavTxt.anchor.set(0.5, 0.5);
    this._slideNavTxt.x = cx; this._slideNavTxt.y = cy;
    this._container.addChild(this._slideNavTxt);

    for (const [dir, glyph, ox] of [[-1, '◀', -54], [1, '▶', 54]]) {
      const btn = new Graphics();
      btn.roundRect(cx + ox - 20, cy - 16, 40, 32, 10);
      btn.fill({ color: C_ROW, alpha: 0.90 });
      btn.roundRect(cx + ox - 20, cy - 16, 40, 32, 10);
      btn.stroke({ color: C_BLUE, width: 1, alpha: 0.45 });
      btn.eventMode = 'static'; btn.cursor = 'pointer';
      this._container.addChild(btn);

      const btnTxt = new Text({ text: glyph, style: { fontSize: 16, fontWeight: 'bold', fill: C_BLUE } });
      btnTxt.anchor.set(0.5, 0.5); btnTxt.x = cx + ox; btnTxt.y = cy;
      this._container.addChild(btnTxt);

      btn.on('pointerdown', () => this._navSlide(dir));
      btn.on('pointerover',  () => { btn.alpha = 0.65; });
      btn.on('pointerout',   () => { btn.alpha = 1.00; });
    }
  }

  _navSlide(dir) {
    this._slideIdx = (this._slideIdx + dir + SLIDES.length) % SLIDES.length;
    this._renderSlide();
    if (this._slideNavTxt) this._slideNavTxt.text = `${this._slideIdx + 1} / ${SLIDES.length}`;
    this._audio?.play('button_tap');
  }
}
