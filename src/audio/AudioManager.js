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
const MUSIC_VOL  = 0.55;   // relative to master; warm island feel sits quieter

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

  // 16s Cmaj7→Am7→Fmaj7→G7 theme: warm pad + marimba arpeggio + shaker + whistle.
  _trackTitle(dst, t) {
    const DUR       = 16.0;
    const CHORD_DUR = 4.0;

    const chords = [
      { pad: [130.8, 164.8, 196.0], arp: [261.6, 329.6, 392.0, 493.9] },  // Cmaj7
      { pad: [110.0, 130.8, 164.8], arp: [220.0, 261.6, 329.6, 392.0] },  // Am7
      { pad: [87.3,  110.0, 130.8], arp: [174.6, 220.0, 261.6, 329.6] },  // Fmaj7
      { pad: [98.0,  123.5, 146.8], arp: [196.0, 246.9, 293.7, 349.2] },  // G7
    ];

    for (let ci = 0; ci < 4; ci++) {
      const ct = t + ci * CHORD_DUR;
      const ch = chords[ci];
      for (const f of ch.pad) this._mWarmPad(dst, ct, f, CHORD_DUR, 0.09);
      ch.arp.forEach((f, i) => this._mMarimba(dst, ct + i * 0.32, f, 0.17));
      // Partial descending run fills the second half of each chord
      ch.arp.slice(0, 2).reverse().forEach((f, i) =>
        this._mMarimba(dst, ct + 4 * 0.32 + i * 0.32, f, 0.12));
    }

    // Shaker — steady 8th notes (one every 0.5 s for 16 s)
    for (let i = 0; i < 32; i++) {
      this._mShaker(dst, t + i * 0.5, i % 2 === 0 ? 0.13 : 0.07);
    }

    // Whistle melody — two phrases per chord
    const whistlePhrases = [
      [392.0, 1.8, 329.6, 1.8],  // G4→E4 over Cmaj
      [329.6, 1.8, 261.6, 1.8],  // E4→C4 over Am
      [261.6, 1.8, 293.7, 1.8],  // C4→D4 over Fmaj
      [349.2, 1.5, 392.0, 2.0],  // F4→G4 over G7 (resolution)
    ];
    for (let ci = 0; ci < 4; ci++) {
      const ct = t + ci * CHORD_DUR;
      const w  = whistlePhrases[ci];
      this._mWhistle(dst, ct,              w[0], w[1], 0.15);
      this._mWhistle(dst, ct + w[1] + 0.1, w[2], w[3], 0.12);
    }

    return DUR;
  }

  // Calm gameplay — 100 BPM, ukulele strum + marimba pentatonic melody, 4-beat loop.
  _trackGameplayCalm(dst, t) {
    const BEAT = 60 / 100;
    const DUR  = BEAT * 4;

    // Ukulele strum — open C chord (G4 C4 E4 A4)
    const C_UK = [392.0, 261.6, 329.6, 440.0];
    this._mUkulele(dst, t,              C_UK,                    0.13);
    this._mUkulele(dst, t + BEAT * 0.5, C_UK.slice().reverse(), 0.07);  // upstroke
    this._mUkulele(dst, t + BEAT * 2,   C_UK,                    0.13);
    this._mUkulele(dst, t + BEAT * 2.5, C_UK.slice().reverse(), 0.07);

    // Marimba melody — pentatonic C: C4 D4 E4 G4 A4
    const penta = [261.6, 293.7, 329.6, 392.0, 440.0];
    [2, 4, 3, 1, 2, 0].forEach((ni, i) =>
      this._mMarimba(dst, t + i * BEAT * 0.5, penta[ni], 0.15));

    // Gentle kick on 1 and 3
    this._mkick(dst, t,            0.28);
    this._mkick(dst, t + BEAT * 2, 0.28);

    // Shaker on 8th notes
    for (let i = 0; i < 8; i++) {
      this._mShaker(dst, t + i * BEAT * 0.5, i % 2 === 0 ? 0.09 : 0.05);
    }

    return DUR;
  }

  // Pressure gameplay — 115 BPM, minor mode, tom offbeats, synth bell arpeggio.
  _trackGameplayPressure(dst, t) {
    const BEAT = 60 / 115;
    const DUR  = BEAT * 4;

    // Kick + tom
    this._mkick(dst, t,              0.44);
    this._mkick(dst, t + BEAT * 2,   0.44);
    this._mtom (dst, t + BEAT * 1.5, 0.28);
    this._mtom (dst, t + BEAT * 3.5, 0.28);

    // Snare on 2 and 4
    this._msnare(dst, t + BEAT,     0.30);
    this._msnare(dst, t + BEAT * 3, 0.30);

    // Hi-hat 8ths
    for (let i = 0; i < 8; i++) this._mhihat(dst, t + i * BEAT * 0.5, 0.11);

    // Bass in A minor
    this._mbass(dst, t,            55.0, BEAT * 0.75, 0.24);
    this._mbass(dst, t + BEAT * 2, 65.4, BEAT * 0.75, 0.20);

    // Synth bell arpeggio — A4 C5 E5 G5 (Am7)
    [440.0, 523.3, 659.3, 784.0].forEach((f, i) =>
      this._mSynthBell(dst, t + i * BEAT * 0.5, f, 0.13));

    return DUR;
  }

  // Climax gameplay — 150 BPM, full kit + major-key resolution burst at loop end.
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
    // Major-key resolution at beat 4 — C major landing
    [261.6, 329.6, 392.0, 523.3].forEach(f =>
      this._mMarimba(dst, t + BEAT * 3, f, 0.12));
    return DUR;
  }

  // ── Warm instrument helpers ───────────────────────────────────────────────

  // Marimba: sine fundamental + brief inharmonic overtone → woody mallet decay.
  _mMarimba(dst, t, freq, vol) {
    const ctx  = this._ctx;
    const osc  = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g    = ctx.createGain();
    const g2   = ctx.createGain();
    osc.type  = 'sine'; osc.frequency.value  = freq;
    osc2.type = 'sine'; osc2.frequency.value = freq * 2.756;
    const decay = Math.max(0.22, 0.7 - freq / 2000);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    g2.gain.setValueAtTime(vol * 0.28, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(g);   g.connect(dst);
    osc2.connect(g2); g2.connect(dst);
    osc.start(t);  osc.stop(t + decay + 0.05);
    osc2.start(t); osc2.stop(t + 0.05);
  }

  // Ukulele strum: triangle-wave pluck per string, strummed bottom-to-top.
  _mUkulele(dst, t, freqs, vol) {
    const ctx = this._ctx;
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const lpf = ctx.createBiquadFilter();
      const g   = ctx.createGain();
      const st  = t + i * 0.011;
      osc.type = 'triangle'; osc.frequency.value = freq;
      lpf.type = 'lowpass';  lpf.frequency.value = 2400;
      g.gain.setValueAtTime(vol, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.38);
      osc.connect(lpf); lpf.connect(g); g.connect(dst);
      osc.start(st); osc.stop(st + 0.40);
    });
  }

  // Whistle/flute: pure sine with gentle LFO vibrato.
  _mWhistle(dst, t, freq, dur, vol) {
    const ctx   = this._ctx;
    const osc   = ctx.createOscillator();
    const lfo   = ctx.createOscillator();
    const lfoGn = ctx.createGain();
    const g     = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = freq;
    lfo.type = 'sine'; lfo.frequency.value = 5.5;
    lfoGn.gain.value = freq * 0.007;
    lfo.connect(lfoGn); lfoGn.connect(osc.frequency);
    const atk = Math.min(0.08, dur * 0.18);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.setValueAtTime(vol, t + dur - 0.07);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(g); g.connect(dst);
    lfo.start(t); lfo.stop(t + dur + 0.05);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  // Shaker: brief bandpass noise burst around 4.5 kHz.
  _mShaker(dst, t, vol) {
    const ctx = this._ctx;
    const src = ctx.createBufferSource();
    const bpf = ctx.createBiquadFilter();
    const g   = ctx.createGain();
    src.buffer          = this._noise;
    bpf.type            = 'bandpass';
    bpf.frequency.value = 4500; bpf.Q.value = 1.5;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(bpf); bpf.connect(g); g.connect(dst);
    src.start(t); src.stop(t + 0.06);
  }

  // Warm pad: detuned sine+triangle through lowpass, slow attack/release.
  _mWarmPad(dst, t, freq, dur, vol) {
    const ctx  = this._ctx;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const lpf  = ctx.createBiquadFilter();
    const g    = ctx.createGain();
    const g2   = ctx.createGain();
    osc1.type = 'sine';     osc1.frequency.value = freq;
    osc2.type = 'triangle'; osc2.frequency.value = freq * 1.005;
    lpf.type  = 'lowpass';  lpf.frequency.value  = 700;
    g2.gain.value = 0.45;
    const atk = Math.min(0.5, dur * 0.12);
    const rel = Math.min(0.6, dur * 0.12);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.setValueAtTime(vol, t + dur - rel);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc1.connect(lpf); osc2.connect(g2); g2.connect(lpf);
    lpf.connect(g); g.connect(dst);
    osc1.start(t); osc1.stop(t + dur + 0.05);
    osc2.start(t); osc2.stop(t + dur + 0.05);
  }

  // Tom drum: pitched sine sweep, lower and longer than snare.
  _mtom(dst, t, vol) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.18);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
    osc.connect(g); g.connect(dst);
    osc.start(t); osc.stop(t + 0.22);
  }

  // Synth bell: bright sine + octave partial, bell-like exponential decay.
  _mSynthBell(dst, t, freq, vol) {
    const ctx  = this._ctx;
    const osc  = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g    = ctx.createGain();
    const g2   = ctx.createGain();
    osc.type  = 'sine'; osc.frequency.value  = freq;
    osc2.type = 'sine'; osc2.frequency.value = freq * 2.0;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.50);
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(vol * 0.4, t + 0.005);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g);   g.connect(dst);
    osc2.connect(g2); g2.connect(dst);
    osc.start(t);  osc.stop(t + 0.55);
    osc2.start(t); osc2.stop(t + 0.20);
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
