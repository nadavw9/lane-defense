// AudioManager — synthesized placeholder sounds via Web Audio API oscillators.
//
// All five sounds are generated programmatically so the game has real audio
// feedback before production assets exist.  The public interface mirrors what
// a Howler-based implementation would expose, so swapping in real files later
// only requires changes here.
//
// Sound catalogue:
//   shoot(damage)       — short pop; pitch rises with shooter damage
//   hit_match           — satisfying low thud + click transient
//   hit_miss            — quiet muted dud (pfft)
//   car_destroy         — noise-burst explosion with pitch sweep
//   combo_milestone     — ascending 4-note chime; pitch shifts with combo tier

export class AudioManager {
  constructor() {
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      this._ctx = null;   // audio unavailable (e.g. test environment)
    }

    this._muted = false;

    if (this._ctx) {
      // Single master gain so mute/unmute is instant with no per-sound logic.
      this._master = this._ctx.createGain();
      this._master.gain.value = 0.45;
      this._master.connect(this._ctx.destination);

      // Pre-bake a 1-second white-noise buffer reused for all noise sources.
      this._noise = this._makeNoiseBuffer(1.0);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  // play(name, opts)
  //   opts.damage  — shooter damage stat (2-8), used by 'shoot'
  //   opts.combo   — current combo count,       used by 'combo_milestone'
  play(name, opts = {}) {
    if (this._muted || !this._ctx) return;
    // Browser autoplay policy: resume context on the first user-gesture call.
    if (this._ctx.state === 'suspended') this._ctx.resume();

    switch (name) {
      case 'shoot':           return this._shoot(opts.damage ?? 4);
      case 'hit_match':       return this._hitMatch();
      case 'hit_miss':        return this._hitMiss();
      case 'car_destroy':     return this._carDestroy();
      case 'combo_milestone': return this._comboMilestone(opts.combo ?? 4);
    }
  }

  // Flip mute state.  Returns the new muted boolean.
  toggleMute() {
    this._muted = !this._muted;
    if (this._master) {
      // Ramp to avoid a click on toggle.
      this._master.gain.linearRampToValueAtTime(
        this._muted ? 0 : 0.45,
        this._ctx.currentTime + 0.04,
      );
    }
    return this._muted;
  }

  get muted() { return this._muted; }

  // ── Synth implementations ─────────────────────────────────────────────────

  // Short pop — damage 2-8 maps to ~256–476 Hz.
  _shoot(damage) {
    const ctx  = this._ctx;
    const now  = ctx.currentTime;
    const freq = 220 + damage * 32;

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.52, now + 0.08);

    gain.gain.setValueAtTime(0.50, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this._master);
    osc.start(now);
    osc.stop(now + 0.10);
  }

  // Satisfying thud — low sine sweep + short noise click.
  _hitMatch() {
    const ctx = this._ctx;
    const now = ctx.currentTime;

    // Sub-bass punch: 140 Hz → 65 Hz, punchy envelope
    const osc  = ctx.createOscillator();
    const og   = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.14);
    og.gain.setValueAtTime(0.65, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(og);
    og.connect(this._master);
    osc.start(now);
    osc.stop(now + 0.16);

    // Short attack click from filtered noise
    this._noiseBurst(0.22, 700, now, 0.035);
  }

  // Muted dud — quiet low sine, no transient.  Feels like a pfft.
  _hitMiss() {
    const ctx  = this._ctx;
    const now  = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.06);
    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(this._master);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Explosion burst — filtered noise sweep + sawtooth pitch drop.
  _carDestroy() {
    const ctx = this._ctx;
    const now = ctx.currentTime;

    // Noise burst through a falling low-pass filter
    const src    = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const ng     = ctx.createGain();
    src.buffer   = this._noise;
    src.loop     = true;
    filter.type  = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(160, now + 0.27);
    ng.gain.setValueAtTime(0.75, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
    src.connect(filter);
    filter.connect(ng);
    ng.connect(this._master);
    src.start(now);
    src.stop(now + 0.32);

    // Sawtooth tone sweep for tonal character
    const osc  = ctx.createOscillator();
    const og   = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.22);
    og.gain.setValueAtTime(0.38, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(og);
    og.connect(this._master);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  // 4-note ascending chime — E4 G4 B4 E5, notes staggered 85ms apart.
  // Pitch shifts up slightly at higher combo tiers for extra excitement.
  _comboMilestone(combo) {
    const ctx   = this._ctx;
    const now   = ctx.currentTime;
    // Small pitch multiplier grows with combo (capped so it stays musical)
    const scale = 1 + Math.min(Math.max(combo - 4, 0), 8) * 0.025;
    const freqs = [330, 392, 494, 659].map(f => f * scale);

    freqs.forEach((freq, i) => {
      const t    = now + i * 0.085;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      // Soft attack so notes blend; natural exponential decay
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.30, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(this._master);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  // Filtered noise burst helper — gain ramps to zero over duration.
  _noiseBurst(gainVal, cutoffHz, startTime, duration) {
    const ctx    = this._ctx;
    const src    = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g      = ctx.createGain();
    src.buffer     = this._noise;
    filter.type    = 'lowpass';
    filter.frequency.value = cutoffHz;
    g.gain.setValueAtTime(gainVal, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this._master);
    src.start(startTime);
    src.stop(startTime + duration + 0.005);
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
