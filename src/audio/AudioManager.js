// AudioManager — synthesized audio via Web Audio API (no asset files).
//
// Architecture:
//   oscillators/sources → _master (0.45) → ctx.destination
//   music sources       → _musicGain (0.65) → _master
//
// Muting _master silences everything (music + SFX) in one ramp.
//
// ── Music tracks (looping) ───────────────────────────────────────────────────
//   'title'              — slow Cmaj7 pad, 8-second loop
//   'gameplay_calm'      — 90 BPM kick+hat+bass, 4-beat loop
//   'gameplay_pressure'  — 120 BPM double-kick + snare + busier bass
//   'gameplay_climax'    — 150 BPM full kit + rapid hi-hats
//
// ── SFX catalogue (play via audio.play(name, opts)) ─────────────────────────
//   shoot, hit_match, hit_miss, car_destroy, combo_milestone  (original)
//   button_tap, star_earn, level_start, rescue_offer,
//   booster_activate, coin_collect, daily_reward,
//   win_fanfare, lose_tone                                     (new)

const MASTER_VOL = 0.45;
const MUSIC_VOL  = 0.65;   // relative to master; music ≈ 0.29 of full scale

export class AudioManager {
  constructor() {
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      this._ctx = null;
    }

    this._muted    = false;
    this._sfxVol   = 1.0;   // multiplier for setSfxVolume
    this._musicVol = 1.0;   // multiplier for setMusicVolume

    if (this._ctx) {
      // Single master gain — ramping to 0 silences everything at once.
      this._master = this._ctx.createGain();
      this._master.gain.value = MASTER_VOL;
      this._master.connect(this._ctx.destination);

      // Music sub-gain sits between music sources and _master.
      this._musicGain = this._ctx.createGain();
      this._musicGain.gain.value = MUSIC_VOL;
      this._musicGain.connect(this._master);

      // 1-second white-noise buffer shared by all noise sources.
      this._noise = this._makeNoiseBuffer(1.0);
    }

    // Music state
    this._currentTrackId   = null;
    this._currentTrackGain = null;  // per-track crossfade gain node
    this._loopTimer        = null;
    this._lastPhase        = null;
  }

  // ── Public: SFX ───────────────────────────────────────────────────────────

  play(name, opts = {}) {
    if (this._muted || !this._ctx) return;
    if (this._ctx.state === 'suspended') this._ctx.resume();

    switch (name) {
      case 'shoot':            return this._shoot(opts.damage ?? 4);
      case 'hit_match':        return this._hitMatch();
      case 'hit_miss':         return this._hitMiss();
      case 'car_destroy':      return this._carDestroy();
      case 'combo_milestone':  return this._comboMilestone(opts.combo ?? 4);
      case 'button_tap':       return this._buttonTap();
      case 'star_earn':        return this._starEarn(opts.index ?? 0);
      case 'level_start':      return this._levelStart();
      case 'rescue_offer':     return this._rescueOffer();
      case 'booster_activate': return this._boosterActivate();
      case 'coin_collect':     return this._coinCollect();
      case 'daily_reward':     return this._dailyReward();
      case 'win_fanfare':      return this._winFanfare();
      case 'lose_tone':        return this._loseTone();
      case 'crisis_assist':    return this._crisisAssist();
    }
  }

  // Flip mute state — ramps master gain so the change is click-free.
  // Returns the new muted boolean.
  toggleMute() {
    this._muted = !this._muted;
    if (this._master) {
      this._master.gain.linearRampToValueAtTime(
        this._muted ? 0 : MASTER_VOL,
        this._ctx.currentTime + 0.04,
      );
    }
    return this._muted;
  }

  get muted() { return this._muted; }

  /** Set SFX (master) volume 0.0–1.0. Preserved across mute/unmute. */
  setSfxVolume(v) {
    this._sfxVol = Math.max(0, Math.min(1, v));
    if (!this._muted && this._master) {
      this._master.gain.linearRampToValueAtTime(
        MASTER_VOL * this._sfxVol,
        this._ctx.currentTime + 0.04,
      );
    }
  }

  /** Set music-specific volume multiplier 0.0–1.0. */
  setMusicVolume(v) {
    this._musicVol = Math.max(0, Math.min(1, v));
    if (this._musicGain) {
      this._musicGain.gain.linearRampToValueAtTime(
        MUSIC_VOL * this._musicVol,
        this._ctx.currentTime + 0.04,
      );
    }
  }

  // ── Public: Music ──────────────────────────────────────────────────────────

  // Start (or crossfade to) a named looping track.  No-op if already playing.
  playMusic(trackId) {
    if (!this._ctx) return;
    if (this._currentTrackId === trackId) return;
    if (this._ctx.state === 'suspended') this._ctx.resume();

    this._fadeOutCurrentTrack();
    clearTimeout(this._loopTimer);
    this._currentTrackId = trackId;

    if (!trackId) { this._currentTrackGain = null; return; }

    const now       = this._ctx.currentTime;
    const trackGain = this._ctx.createGain();
    trackGain.gain.setValueAtTime(0, now);
    trackGain.gain.linearRampToValueAtTime(1.0, now + 0.60);
    trackGain.connect(this._musicGain);
    this._currentTrackGain = trackGain;

    this._scheduleLoop(trackId, now + 0.05, trackGain);
  }

  stopMusic() {
    this._fadeOutCurrentTrack();
    clearTimeout(this._loopTimer);
    this._currentTrackId   = null;
    this._currentTrackGain = null;
  }

  // Call from GameApp render ticker during gameplay.
  // Switches music track when the Director phase changes.
  updateMusicPhase(phase) {
    if (phase === this._lastPhase) return;
    this._lastPhase = phase;
    const track = phase === 'CLIMAX'   ? 'gameplay_climax'
                : phase === 'PRESSURE' ? 'gameplay_pressure'
                :                        'gameplay_calm';
    this.playMusic(track);
  }

  // Reset stored phase so the next updateMusicPhase call always fires.
  resetMusicPhase() { this._lastPhase = null; }

  // ── Music scheduler ────────────────────────────────────────────────────────

  _fadeOutCurrentTrack() {
    const old = this._currentTrackGain;
    if (!old || !this._ctx) return;
    const now = this._ctx.currentTime;
    old.gain.cancelScheduledValues(now);
    old.gain.setValueAtTime(old.gain.value, now);
    old.gain.linearRampToValueAtTime(0, now + 0.55);
    setTimeout(() => { try { old.disconnect(); } catch { /* already gone */ } }, 700);
  }

  _scheduleLoop(trackId, t, trackGain) {
    if (this._currentTrackId !== trackId) return;
    const dur    = this._playTrackOnce(trackId, t, trackGain);
    const msLeft = Math.max(0, (t + dur - this._ctx.currentTime - 0.25) * 1000);
    this._loopTimer = setTimeout(() => this._scheduleLoop(trackId, t + dur, trackGain), msLeft);
  }

  _playTrackOnce(trackId, t, dst) {
    switch (trackId) {
      case 'title':             return this._trackTitle(dst, t);
      case 'gameplay_calm':     return this._trackGameplayCalm(dst, t);
      case 'gameplay_pressure': return this._trackGameplayPressure(dst, t);
      case 'gameplay_climax':   return this._trackGameplayClimax(dst, t);
      default: return 4.0;
    }
  }

  // ── Music tracks ──────────────────────────────────────────────────────────

  // Gentle Cmaj7 pad — C3 E3 G3 B3, 8-second loop.
  _trackTitle(dst, t) {
    const DUR   = 8.0;
    const freqs = [130.8, 164.8, 196.0, 246.9];
    for (const f of freqs) {
      const osc = this._ctx.createOscillator();
      const g   = this._ctx.createGain();
      osc.type            = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 1.0);
      g.gain.setValueAtTime(0.16, t + DUR - 1.0);
      g.gain.linearRampToValueAtTime(0, t + DUR);
      osc.connect(g); g.connect(dst);
      osc.start(t); osc.stop(t + DUR + 0.1);
    }
    return DUR;
  }

  // Calm gameplay — 90 BPM, 4-beat loop (2.67 s).
  _trackGameplayCalm(dst, t) {
    const BEAT = 60 / 90;
    const DUR  = BEAT * 4;
    this._mkick(dst, t,            0.40);
    this._mkick(dst, t + BEAT * 2, 0.40);
    this._mhihat(dst, t + BEAT,     0.16);
    this._mhihat(dst, t + BEAT * 3, 0.16);
    this._mbass(dst, t, 65.4, BEAT * 1.4, 0.22);
    return DUR;
  }

  // Pressure gameplay — 120 BPM, 4-beat loop (2.0 s). Double kick + snare.
  _trackGameplayPressure(dst, t) {
    const BEAT = 60 / 120;
    const DUR  = BEAT * 4;
    this._mkick(dst, t,                0.50);
    this._mkick(dst, t + BEAT * 0.5,   0.28);
    this._mkick(dst, t + BEAT * 2,     0.50);
    this._mkick(dst, t + BEAT * 2.5,   0.28);
    this._msnare(dst, t + BEAT,         0.28);
    this._msnare(dst, t + BEAT * 3,     0.28);
    for (let i = 0; i < 8; i++) this._mhihat(dst, t + i * BEAT * 0.5, 0.13);
    this._mbass(dst, t,            65.4, BEAT * 0.85, 0.28);
    this._mbass(dst, t + BEAT * 2, 73.4, BEAT * 0.85, 0.28);
    return DUR;
  }

  // Climax gameplay — 150 BPM, 4-beat loop (1.6 s). Full kit + busy bass.
  _trackGameplayClimax(dst, t) {
    const BEAT = 60 / 150;
    const DUR  = BEAT * 4;
    for (let i = 0; i < 4; i++) this._mkick(dst, t + i * BEAT, 0.55);
    this._msnare(dst, t + BEAT,     0.40);
    this._msnare(dst, t + BEAT * 3, 0.40);
    for (let i = 0; i < 16; i++) {
      this._mhihat(dst, t + i * BEAT * 0.25, i % 4 === 0 ? 0.18 : 0.11);
    }
    this._mbass(dst, t,            65.4, BEAT * 0.75, 0.30);
    this._mbass(dst, t + BEAT,     82.4, BEAT * 0.55, 0.24);
    this._mbass(dst, t + BEAT * 2, 65.4, BEAT * 0.75, 0.30);
    this._mbass(dst, t + BEAT * 3, 98.0, BEAT * 0.55, 0.24);
    return DUR;
  }

  // ── Music building blocks ─────────────────────────────────────────────────

  _mkick(dst, t, vol) {
    const osc = this._ctx.createOscillator();
    const g   = this._ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.22);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(g); g.connect(dst);
    osc.start(t); osc.stop(t + 0.28);
  }

  _msnare(dst, t, vol) {
    const src = this._ctx.createBufferSource();
    const bpf = this._ctx.createBiquadFilter();
    const g   = this._ctx.createGain();
    src.buffer       = this._noise;
    bpf.type         = 'bandpass';
    bpf.frequency.value = 600;
    bpf.Q.value         = 0.8;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(bpf); bpf.connect(g); g.connect(dst);
    src.start(t); src.stop(t + 0.18);
  }

  _mhihat(dst, t, vol) {
    const src = this._ctx.createBufferSource();
    const hpf = this._ctx.createBiquadFilter();
    const g   = this._ctx.createGain();
    src.buffer       = this._noise;
    hpf.type         = 'highpass';
    hpf.frequency.value = 7000;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    src.connect(hpf); hpf.connect(g); g.connect(dst);
    src.start(t); src.stop(t + 0.04);
  }

  _mbass(dst, t, freq, dur, vol) {
    const osc = this._ctx.createOscillator();
    const lpf = this._ctx.createBiquadFilter();
    const g   = this._ctx.createGain();
    osc.type            = 'sawtooth';
    osc.frequency.value = freq;
    lpf.type            = 'lowpass';
    lpf.frequency.value = 220;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.setValueAtTime(vol, t + dur * 0.65);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(lpf); lpf.connect(g); g.connect(dst);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  // ── Original SFX ──────────────────────────────────────────────────────────

  // Short pop — damage 2-8 maps to ~256–476 Hz.
  _shoot(damage) {
    const ctx  = this._ctx, now = ctx.currentTime;
    const freq = 220 + damage * 32;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.52, now + 0.08);
    gain.gain.setValueAtTime(0.50, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain); gain.connect(this._master);
    osc.start(now); osc.stop(now + 0.10);
  }

  // Satisfying thud — low sine sweep + noise click.
  _hitMatch() {
    const ctx = this._ctx, now = ctx.currentTime;
    const osc = ctx.createOscillator(), og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.14);
    og.gain.setValueAtTime(0.65, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(og); og.connect(this._master);
    osc.start(now); osc.stop(now + 0.16);
    this._noiseBurst(0.22, 700, now, 0.035);
  }

  // Muted dud — quiet low sine.
  _hitMiss() {
    const ctx = this._ctx, now = ctx.currentTime;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.06);
    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain); gain.connect(this._master);
    osc.start(now); osc.stop(now + 0.08);
  }

  // Explosion burst — filtered noise + sawtooth drop.
  _carDestroy() {
    const ctx = this._ctx, now = ctx.currentTime;
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), ng = ctx.createGain();
    src.buffer = this._noise; src.loop = true;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(160, now + 0.27);
    ng.gain.setValueAtTime(0.75, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
    src.connect(filter); filter.connect(ng); ng.connect(this._master);
    src.start(now); src.stop(now + 0.32);
    const osc = ctx.createOscillator(), og = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.22);
    og.gain.setValueAtTime(0.38, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(og); og.connect(this._master);
    osc.start(now); osc.stop(now + 0.23);
  }

  // 4-note ascending chime — pitch shifts with combo tier.
  _comboMilestone(combo) {
    const ctx   = this._ctx, now = ctx.currentTime;
    const scale = 1 + Math.min(Math.max(combo - 4, 0), 8) * 0.025;
    const freqs = [330, 392, 494, 659].map(f => f * scale);
    freqs.forEach((freq, i) => {
      const t    = now + i * 0.085;
      const osc  = ctx.createOscillator(), gain = ctx.createGain();
      osc.type            = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.30, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain); gain.connect(this._master);
      osc.start(t); osc.stop(t + 0.24);
    });
  }

  // ── New SFX ────────────────────────────────────────────────────────────────

  // Crisp UI click for all button presses.
  _buttonTap() {
    const ctx = this._ctx, now = ctx.currentTime;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.055);
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(g); g.connect(this._master);
    osc.start(now); osc.stop(now + 0.07);
  }

  // Three ascending sparkle notes.  opts.index staggers each star 350 ms.
  _starEarn(index) {
    const ctx   = this._ctx;
    const start = ctx.currentTime + index * 0.35;
    const notes = [659.3, 987.8, 1318.5]; // E5 B5 E6
    notes.forEach((f, i) => {
      const t = start + i * 0.065;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type            = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
      osc.connect(g); g.connect(this._master);
      osc.start(t); osc.stop(t + 0.22);
    });
  }

  // Noise whoosh + rising sine sweep.
  _levelStart() {
    const ctx = this._ctx, now = ctx.currentTime;
    const src = ctx.createBufferSource(), bpf = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this._noise;
    bpf.type   = 'bandpass';
    bpf.frequency.setValueAtTime(350, now);
    bpf.frequency.exponentialRampToValueAtTime(2800, now + 0.42);
    g.gain.setValueAtTime(0.30, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    src.connect(bpf); bpf.connect(g); g.connect(this._master);
    src.start(now); src.stop(now + 0.52);
    const osc = ctx.createOscillator(), og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.38);
    og.gain.setValueAtTime(0.18, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    osc.connect(og); og.connect(this._master);
    osc.start(now); osc.stop(now + 0.45);
  }

  // Deep boom — dramatic impact when rescue overlay appears.
  _rescueOffer() {
    const ctx = this._ctx, now = ctx.currentTime;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(55, now);
    osc.frequency.exponentialRampToValueAtTime(26, now + 0.85);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.65, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
    osc.connect(g); g.connect(this._master);
    osc.start(now); osc.stop(now + 1.0);
    this._noiseBurst(0.28, 110, now, 0.10);
  }

  // Magical ascending run — A4 through E6.
  _boosterActivate() {
    const ctx   = this._ctx, now = ctx.currentTime;
    const notes = [440, 554.4, 659.3, 880, 1108.7, 1318.5];
    notes.forEach((f, i) => {
      const t = now + i * 0.052;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type            = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.20, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
      osc.connect(g); g.connect(this._master);
      osc.start(t); osc.stop(t + 0.19);
    });
  }

  // Classic two-note coin clink (C6 → E6).
  _coinCollect() {
    const ctx = this._ctx, now = ctx.currentTime;
    for (const [dt, f] of [[0, 1046.5], [0.075, 1318.5]]) {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type            = 'square';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.16, now + dt);
      g.gain.exponentialRampToValueAtTime(0.001, now + dt + 0.11);
      osc.connect(g); g.connect(this._master);
      osc.start(now + dt); osc.stop(now + dt + 0.13);
    }
  }

  // 5-note ascending jingle + shimmer tail — chest-opening feel.
  _dailyReward() {
    const ctx   = this._ctx, now = ctx.currentTime;
    const notes = [523.3, 587.3, 659.3, 784.0, 1046.5]; // C5 D5 E5 G5 C6
    notes.forEach((f, i) => {
      const t = now + i * 0.095;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type            = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.24, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(g); g.connect(this._master);
      osc.start(t); osc.stop(t + 0.30);
    });
    this._noiseBurst(0.14, 3500, now + 0.38, 0.22);
  }

  // Triumphant 5-note ascending fanfare — C5 E5 G5 C6 E6.
  _winFanfare() {
    const ctx   = this._ctx, now = ctx.currentTime;
    const notes = [523.3, 659.3, 784.0, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      const t = now + i * 0.16;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type            = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.32, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.40);
      osc.connect(g); g.connect(this._master);
      osc.start(t); osc.stop(t + 0.45);
    });
  }

  // Descending 3-note sad phrase + low rumble — G4 Eb4 C4.
  _loseTone() {
    const ctx   = this._ctx, now = ctx.currentTime;
    const notes = [392.0, 311.1, 261.6];
    notes.forEach((f, i) => {
      const t = now + i * 0.38;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type            = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.06);
      g.gain.setValueAtTime(0.25, t + 0.22);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(g); g.connect(this._master);
      osc.start(t); osc.stop(t + 0.60);
    });
    // Low rumble tail
    const osc = this._ctx.createOscillator(), g = this._ctx.createGain();
    osc.type            = 'sine';
    osc.frequency.value = 44;
    g.gain.setValueAtTime(0, now + 0.4);
    g.gain.linearRampToValueAtTime(0.28, now + 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    osc.connect(g); g.connect(this._master);
    osc.start(now + 0.4); osc.stop(now + 1.9);
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  // Cavalry-charge arpeggio — G4 B4 D5 G5 — punchy square wave.
  // Signals CRISIS assist: cavalry has arrived, a guaranteed match is ready.
  _crisisAssist() {
    const ctx   = this._ctx, now = ctx.currentTime;
    const notes = [392.0, 493.9, 587.3, 784.0]; // G4 B4 D5 G5
    notes.forEach((f, i) => {
      const t   = now + i * 0.070;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type            = 'square';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(g); g.connect(this._master);
      osc.start(t); osc.stop(t + 0.20);
    });
    // Gold shimmer on top
    this._noiseBurst(0.08, 5500, now + 0.22, 0.14);
  }

  // Filtered noise burst helper.
  _noiseBurst(gainVal, cutoffHz, startTime, duration) {
    const ctx = this._ctx;
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer          = this._noise;
    filter.type         = 'lowpass';
    filter.frequency.value = cutoffHz;
    g.gain.setValueAtTime(gainVal, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    src.connect(filter); filter.connect(g); g.connect(this._master);
    src.start(startTime); src.stop(startTime + duration + 0.005);
  }

  // Create a mono white-noise buffer of the given duration.
  _makeNoiseBuffer(durationSec) {
    const sr     = this._ctx.sampleRate;
    const frames = Math.ceil(sr * durationSec);
    const buf    = this._ctx.createBuffer(1, frames, sr);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}
