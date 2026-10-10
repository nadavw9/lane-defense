// SettingsScreen — sound, gameplay toggles, help and about.
//
// Layout (390 × 844):
//   header   — ribbon + back
//   SOUND    — Sound FX / Music: label + value on one line, full-width slider under it
//   GAMEPLAY — Colorblind shapes, Haptics (toggles)
//   HELP     — HOW TO PLAY and CAR GUIDE buttons (open the real overlays)
//   ABOUT    — privacy links, version
import { Container, Graphics } from 'pixi.js';
import { isReducedMotion, setReducedMotion } from '../game/MotionPrefs.js';
import { setColorblindMode } from '../game/ColorblindMode.js';
import { uiIcon } from '../renderer/UIIcon.js';
import { ribbon, roundButton, button, bodyText, titleText, screenBg, card, GOLD } from '../renderer/PremiumUI.js';
import { INK } from '../renderer/ToyStyle.js';
import { Capacitor } from '@capacitor/core';
import { adManager } from '../ads/AdManager.js';
import { getInstallId } from '../analytics/Analytics.js';

const PRIVACY_URL = 'https://nadavw9.github.io/lane-defense/privacy.html';
const VERSION = 'v1.1.0';

const MX = 16;              // card side margin
const CW = 390 - MX * 2;    // card width
const PADX = 18;            // card inner padding

export class SettingsScreen {
  constructor(stage, appW, appH, audio, { onClose, onHowToPlay = null, onCarGuide = null }, progress = null, haptics = null) {
    this._stage    = stage;
    this._appW     = appW;
    this._appH     = appH;
    this._audio    = audio;
    this._progress = progress;
    this._haptics  = haptics;
    this._onClose  = onClose;
    this._onHowToPlay = onHowToPlay;
    this._onCarGuide  = onCarGuide;
    this._container = new Container();
    stage.addChild(this._container);
    this._build();
  }

  destroy() { this._container.destroy({ children: true }); }

  _build() {
    const w = this._appW;
    const c = this._container;
    c.addChild(screenBg(w, this._appH));

    const rb = ribbon('SETTINGS', 220, { size: 26 });
    rb.x = w / 2; rb.y = 40;
    c.addChild(rb);
    const back = roundButton(uiIcon('back', 22, '←'), { r: 22, color: 0x2F7FE0, onTap: () => { this._audio?.play('button_tap'); this._onClose(); } });
    back.x = 32; back.y = 40;
    c.addChild(back);

    let y = 92;
    y = this._soundCard(y) + 16;
    y = this._gameplayCard(y) + 16;
    y = this._helpCard(y) + 16;
    y = this._aboutCard(y) + 16;
    this._makeScrollable(c, 3, 76, y);
  }

  // The cards outgrow one screen on short phones: everything after the header
  // (bg, ribbon, back) moves into a body that drags and wheel-scrolls under a mask.
  _makeScrollable(c, headerCount, top, contentBottom) {
    const h = this._appH, w = this._appW;
    const viewH = h - top;
    const maxScroll = Math.max(0, contentBottom - h);
    if (maxScroll <= 0) return;
    const body = new Container();
    c.children.slice(headerCount).forEach(k => body.addChild(k));
    const hit = new Graphics();
    hit.rect(0, top, w, contentBottom - top).fill({ color: 0x000000, alpha: 0.001 });
    body.addChildAt(hit, 0);
    c.addChild(body);
    const mask = new Graphics();
    mask.rect(0, top, w, viewH).fill(0xffffff);
    c.addChild(mask);
    body.mask = mask;
    body.eventMode = 'static';
    let scroll = 0, dragFrom = null, startScroll = 0, moved = false;
    const apply = () => { body.y = -scroll; };
    // Only a drag that STARTS on the background scrolls — sliders, toggles and
    // buttons keep their own gestures.
    body.on('pointerdown', (e) => { if (e.target?.cursor !== 'pointer') { dragFrom = e.global.y; startScroll = scroll; moved = false; } });
    body.on('globalpointermove', (e) => {
      if (dragFrom == null) return;
      const dy = e.global.y - dragFrom;
      if (!moved && Math.abs(dy) > 6) {
        // From here it is a scroll, not a tap: nothing under the finger may fire when it
        // lifts (buttons act on pointerup, wherever the finger happens to be).
        moved = true;
        c.interactiveChildren = false;
      }
      if (!moved) return;
      scroll = Math.max(0, Math.min(maxScroll, startScroll - dy));
      apply();
    });
    const end = () => {
      if (dragFrom == null) return;
      dragFrom = null;
      if (moved) setTimeout(() => { c.interactiveChildren = true; }, 0);   // after this pointerup is routed
    };
    c.eventMode = 'static';
    c.on('pointerup', end); c.on('pointerupoutside', end);
    body.on('wheel', (e) => { scroll = Math.max(0, Math.min(maxScroll, scroll + e.deltaY * 0.6)); apply(); });
  }

  // ── Cards ──────────────────────────────────────────────────────────────
  _cardFrame(y, h, title, icon) {
    const g = card(CW, h, { r: 20 });
    g.x = MX; g.y = y;
    this._container.addChild(g);
    const ic = uiIcon(icon, 24, '•');
    ic.x = MX + PADX + 12; ic.y = y + 24;
    this._container.addChild(ic);
    const t = titleText(title, 17, GOLD);
    t.anchor.set(0, 0.5); t.x = MX + PADX + 30; t.y = y + 25;
    this._container.addChild(t);
    const sep = new Graphics();
    sep.roundRect(MX + PADX, y + 46, CW - PADX * 2, 2, 1).fill({ color: 0x000000, alpha: 0.25 });
    sep.roundRect(MX + PADX, y + 48, CW - PADX * 2, 1, 0.5).fill({ color: 0xffffff, alpha: 0.08 });
    this._container.addChild(sep);
    return y + 52;
  }

  _soundCard(y) {
    const h = 52 + 2 * 66 + 8;
    let ry = this._cardFrame(y, h, 'SOUND', 'speaker');
    ry = this._sliderRow('Sound FX', ry, this._progress?.sfxVolume ?? 1,
      (v) => { this._progress?.setSfxVolume(v); this._audio?.setSfxVolume?.(v); },
      () => this._audio?.play('button_tap'));
    this._sliderRow('Music', ry, this._progress?.musicVolume ?? 1,
      (v) => { this._progress?.setMusicVolume(v); this._audio?.setMusicVolume?.(v); });
    return y + h;
  }

  _gameplayCard(y) {
    const h = 52 + 3 * 60 + 8;
    let ry = this._cardFrame(y, h, 'GAMEPLAY', 'gear');
    ry = this._toggleRow('Colorblind shapes', 'Adds ● ▲ ■ ★ to every colour', ry,
      this._progress?.colorblindMode ?? false,
      (v) => { this._progress?.setColorblindMode(v); setColorblindMode(v); this._audio?.play('button_tap'); });
    ry = this._toggleRow('Reduce motion', 'No screen shake or flashes', ry,
      isReducedMotion(),
      (v) => { this._progress?.setReducedMotion(v); setReducedMotion(v); this._audio?.play('button_tap'); });
    this._toggleRow('Vibration', 'Buzz on shots and kills', ry,
      this._progress?.hapticsEnabled ?? true,
      (v) => {
        this._progress?.setHapticsEnabled(v);
        if (this._haptics) this._haptics.enabled = v;
        this._audio?.play('button_tap');
        if (v) this._haptics?.light();
      });
    return y + h;
  }

  _helpCard(y) {
    const h = 52 + 78;
    const ry = this._cardFrame(y, h, 'HELP', 'book');
    const bw = (CW - PADX * 2 - 12) / 2;
    const mk = (label, icon, variant, x, fn) => {
      const b = button(label, { variant, w: bw, h: 54, size: 16, icon: uiIcon(icon, 20, '•'),
        onTap: () => { this._audio?.play('button_tap'); fn?.(); } });
      b.x = x; b.y = ry + 36;
      this._container.addChild(b);
    };
    mk('HOW TO PLAY', 'book', 'blue', MX + PADX + bw / 2, this._onHowToPlay);
    mk('CAR GUIDE', 'car', 'purple', MX + PADX + bw * 1.5 + 12, this._onCarGuide);
    return y + h;
  }

  _aboutCard(y) {
    const h = 52 + 122;
    const ry = this._cardFrame(y, h, 'ABOUT', 'star-filled');
    const links = [['Privacy Policy', () => this._openUrl(PRIVACY_URL)]];
    if (adManager.hasPrivacyOptions) links.push(['Ad choices', () => adManager.showPrivacyOptions()]);
    const bw = links.length > 1 ? (CW - PADX * 2 - 12) / 2 : CW - PADX * 2;
    links.forEach(([label, fn], i) => {
      const b = button(label, { variant: 'dark', w: bw, h: 44, size: 16,
        onTap: () => { this._audio?.play('button_tap'); fn(); } });
      b.x = MX + PADX + bw / 2 + i * (bw + 12); b.y = ry + 28;
      this._container.addChild(b);
    });
    const v = bodyText(`Traffic Bomb ${VERSION}  ·  Made by Nadav`, 13, 0xA9A3D6, { outline: false, weight: '700' });
    v.anchor.set(0.5); v.x = this._appW / 2; v.y = ry + 72;
    this._container.addChild(v);
    // Install ID: quoted in a data-deletion email (see the privacy policy). Tap copies it.
    const id = getInstallId();
    const idText = bodyText(`Data ID (tap to copy)\n${id}`, 11, 0xA9A3D6, { outline: false, weight: '700', align: 'center' });
    idText.anchor.set(0.5); idText.x = this._appW / 2; idText.y = ry + 108;
    idText.eventMode = 'static'; idText.cursor = 'pointer';
    idText.on('pointertap', () => {
      this._audio?.play('button_tap');
      try { navigator.clipboard?.writeText(id); } catch { /* clipboard unavailable: ID stays readable */ }
    });
    this._container.addChild(idText);
    return y + h;
  }

  _openUrl(url) {
    if (Capacitor.isNativePlatform()) window.location.href = url;
    else window.open(url, '_blank', 'noopener');
  }

  // ── Rows ───────────────────────────────────────────────────────────────
  // Label and value share the first line; the slider runs full width under
  // them, so the readout can never sit under the knob.
  _sliderRow(label, y, init, onChange, onRelease = null) {
    const c = this._container;
    const x0 = MX + PADX, x1 = MX + CW - PADX;
    const lt = bodyText(label, 16, 0xFFFFFF, { outline: false, weight: '800', align: 'left' });
    lt.anchor.set(0, 0.5); lt.x = x0; lt.y = y + 16;
    c.addChild(lt);
    const vt = titleText('', 17, 0xFFE08A);
    vt.anchor.set(1, 0.5); vt.x = x1; vt.y = y + 16;
    c.addChild(vt);

    const KR = 14;                                  // knob radius
    const tx0 = x0 + KR, tx1 = x1 - KR, TW = tx1 - tx0, cy = y + 46, TH = 12;
    const track = new Graphics();
    track.roundRect(tx0 - 6, cy - TH / 2, TW + 12, TH, TH / 2).fill({ color: 0x0C0A26, alpha: 0.75 }).stroke({ color: INK, width: 2 });
    c.addChild(track);
    const fill = new Graphics(), knob = new Graphics();
    c.addChild(fill, knob);
    knob.circle(0, 3, KR).fill({ color: 0x000000, alpha: 0.3 });
    knob.circle(0, 0, KR).fill(0xFFD865).stroke({ color: INK, width: 3 });
    knob.ellipse(0, -KR * 0.4, KR * 0.6, KR * 0.3).fill({ color: 0xffffff, alpha: 0.5 });
    knob.y = cy;

    let val = Math.max(0, Math.min(1, init));
    const draw = () => {
      const kx = tx0 + val * TW;
      fill.clear();
      if (val > 0.005) {
        fill.roundRect(tx0 - 4, cy - TH / 2 + 2, kx - tx0 + 4, TH - 4, (TH - 4) / 2).fill(GOLD);
        fill.roundRect(tx0 - 2, cy - TH / 2 + 3, Math.max(0, kx - tx0), 2.5, 1).fill({ color: 0xffffff, alpha: 0.45 });
      }
      knob.x = kx;
      vt.text = val < 0.005 ? 'OFF' : `${Math.round(val * 100)}%`;
    };
    draw();

    const hit = new Graphics();
    hit.rect(x0 - 6, cy - 22, x1 - x0 + 12, 44).fill({ color: 0, alpha: 0.001 });
    hit.eventMode = 'static'; hit.cursor = 'pointer';
    c.addChild(hit);
    let dragging = false;
    const move = (e) => {
      const lx = this._container.toLocal(e.global).x;
      val = Math.max(0, Math.min(1, (lx - tx0) / TW));
      draw(); onChange(val);
    };
    hit.on('pointerdown', (e) => { dragging = true; knob.scale.set(1.12); move(e); });
    hit.on('globalpointermove', (e) => { if (dragging) move(e); });
    const end = () => { if (!dragging) return; dragging = false; knob.scale.set(1); onRelease?.(); };
    hit.on('pointerup', end); hit.on('pointerupoutside', end);
    return y + 66;
  }

  _toggleRow(label, sub, y, init, onChange) {
    const c = this._container;
    const x0 = MX + PADX, x1 = MX + CW - PADX;
    const cy = y + 30;
    const lt = bodyText(label, 16, 0xFFFFFF, { outline: false, weight: '800', align: 'left' });
    lt.anchor.set(0, 1); lt.x = x0; lt.y = cy + 1;
    c.addChild(lt);
    const st = bodyText(sub, 13, 0xA9A3D6, { outline: false, weight: '700', align: 'left' });
    st.anchor.set(0, 0); st.x = x0; st.y = cy + 4;
    c.addChild(st);

    const TW = 64, TH = 34;
    const tog = new Container();
    tog.x = x1 - TW; tog.y = cy - TH / 2;
    const g = new Graphics();
    tog.addChild(g);
    let on = !!init;
    const draw = () => {
      g.clear();
      g.roundRect(0, 3, TW, TH, TH / 2).fill({ color: 0x000000, alpha: 0.3 });
      g.roundRect(0, 0, TW, TH, TH / 2).fill(on ? 0x3DBB3A : 0x1A1740);
      g.roundRect(4, 3, TW - 8, TH * 0.36, TH / 4).fill({ color: 0xffffff, alpha: on ? 0.25 : 0.06 });
      g.roundRect(0, 0, TW, TH, TH / 2).stroke({ color: INK, width: 3 });
      const kx = on ? TW - TH / 2 : TH / 2;
      g.circle(kx, TH / 2 + 2, TH / 2 - 4).fill({ color: 0x000000, alpha: 0.25 });
      g.circle(kx, TH / 2, TH / 2 - 4).fill(0xffffff).stroke({ color: INK, width: 2.5 });
      g.ellipse(kx, TH / 2 - 5, 7, 3.5).fill({ color: 0xffffff, alpha: 0.9 });
    };
    draw();
    tog.eventMode = 'static'; tog.cursor = 'pointer';
    tog.hitArea = { contains: (px, py) => px >= -12 && px <= TW + 12 && py >= -12 && py <= TH + 12 };
    tog.on('pointertap', () => { on = !on; draw(); onChange(on); });
    c.addChild(tog);
    return y + 60;
  }
}
