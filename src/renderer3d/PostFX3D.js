// PostFX3D — custom ShaderPasses added on top of the UnrealBloom pipeline.
//
// Passes (inserted after UnrealBloomPass, before OutputPass):
//   1. LensDistortionPass  — subtle barrel lens warp (always on, ramps with bloom)
//   2. ChromaticAberrationPass — RGB channel split, spikes on kills/hits
//   3. VignettePass        — dark screen-edges + red breach pulse + combo tint

import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// ── Lens Barrel Distortion Shader ─────────────────────────────────────────────
// Subtle pincushion/barrel warp that makes the scene feel like it's rendered
// through a real camera lens.  Intensity ramps up with bloom strength.
const LensDistortionShader = {
  name: 'LensDistortionShader',
  uniforms: {
    tDiffuse:    { value: null },
    distortion:  { value: 0.10 },   // 0 = no warp, +ve = barrel, -ve = pincushion
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float distortion;
    varying vec2 vUv;
    void main() {
      vec2 uv  = vUv - 0.5;
      float r2 = dot(uv, uv);
      vec2 warped = uv * (1.0 + distortion * r2 * r2) + 0.5;
      // Clamp to black outside visible area.
      if (warped.x < 0.0 || warped.x > 1.0 || warped.y < 0.0 || warped.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      } else {
        gl_FragColor = texture2D(tDiffuse, warped);
      }
    }
  `,
};

// ── Chromatic Aberration Shader ────────────────────────────────────────────────
const ChromaShader = {
  name: 'ChromaShader',
  uniforms: {
    tDiffuse:  { value: null },
    intensity: { value: 0.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float intensity;
    varying vec2 vUv;
    void main() {
      vec2 dir = (vUv - 0.5) * intensity;
      float r = texture2D(tDiffuse, vUv + dir * 1.0).r;
      float g = texture2D(tDiffuse, vUv          ).g;
      float b = texture2D(tDiffuse, vUv - dir * 1.0).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

// ── Vignette + Breach Pulse + Flash Shader ────────────────────────────────────
const VignetteShader = {
  name: 'VignetteShader',
  uniforms: {
    tDiffuse:      { value: null },
    vigStrength:   { value: 0.55 },   // base dark edge strength
    breachPulse:   { value: 0.0 },    // 0..1 red breach overlay
    comboTint:     { value: 0.0 },    // 0..1 warm orange combo tint
    flashIntensity: { value: 0.0 },   // 0..1 white screen flash (bomb detonation)
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float vigStrength;
    uniform float breachPulse;
    uniform float comboTint;
    uniform float flashIntensity;
    varying vec2 vUv;
    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      // Radial vignette mask (stronger at corners).
      float dist = distance(vUv, vec2(0.5)) * 1.414;
      float mask = smoothstep(0.35, 1.0, dist);
      // Base dark vignette.
      vec3 result = mix(col.rgb, vec3(0.0), mask * vigStrength);
      // Breach: bleed red in from all edges.
      result = mix(result, vec3(0.75, 0.0, 0.0), mask * breachPulse);
      // High-combo: warm orange edge tint.
      result = mix(result, vec3(0.9, 0.45, 0.0), mask * comboTint * 0.35);
      // Bomb flash: full-screen white overlay, slightly attenuated at edges.
      result = mix(result, vec3(1.0), flashIntensity * (1.0 - mask * 0.4));
      gl_FragColor = vec4(result, 1.0);
    }
  `,
};

// ── PostFX3D class ────────────────────────────────────────────────────────────

export class PostFX3D {
  constructor(composer) {
    this._lensPass      = new ShaderPass(LensDistortionShader);
    this._chromaPass    = new ShaderPass(ChromaShader);
    this._vignettePass  = new ShaderPass(VignetteShader);

    // Insert all passes before the OutputPass (always the last pass).
    const passes    = composer.passes;
    const outputIdx = passes.length - 1;
    composer.insertPass(this._lensPass,     outputIdx);
    composer.insertPass(this._chromaPass,   outputIdx + 1);
    composer.insertPass(this._vignettePass, outputIdx + 2);

    // Lens distortion: disabled — the barrel warp hides game content.
    this._lensPass.uniforms.distortion.value = 0.0;

    // Vignette: very subtle — just enough to frame the scene, not hide it.
    this._vignettePass.uniforms.vigStrength.value = 0.12;

    // Chroma decay state.
    this._chromaTarget  = 0;
    this._chromaCurrent = 0;

    // Breach pulse state.
    this._breachTarget  = 0;
    this._breachCurrent = 0;

    // Combo state.
    this._comboTarget   = 0;
    this._comboCurrent  = 0;

    // Lens distortion target — kept at 0; lens warp is disabled.
    this._lensTarget    = 0.0;

    // Screen flash state (bomb detonation).
    this._flashCurrent = 0;
    this._flashDecay   = 0;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  triggerChroma(intensity = 0.008, duration = 0.20) {
    // Cap chroma at 0.010 — higher values create distracting colored edge lines.
    this._chromaTarget = Math.max(this._chromaTarget, Math.min(0.010, intensity));
    this._chromaDecay  = this._chromaTarget / duration;
  }

  setBreach(t) {
    this._breachTarget = Math.max(0, Math.min(1, t));
  }

  /**
   * Instant white screen flash that decays over `duration` seconds.
   * Max alpha 0.4. Used for bomb detonation impact.
   */
  setFlash(intensity = 0.4, duration = 0.05) {
    this._flashCurrent = Math.min(0.4, intensity);
    this._flashDecay   = this._flashCurrent / Math.max(0.001, duration);
  }

  setCombo(combo) {
    // Combo tint only at very high combos, kept subtle so it doesn't hide content.
    this._comboTarget = combo >= 12 ? 0.35 : combo >= 8 ? 0.15 : 0;
    this._lensTarget  = 0.0;  // lens distortion stays off
  }

  update(dt) {
    // Chroma decay.
    if (this._chromaTarget > 0) {
      this._chromaTarget = Math.max(0, this._chromaTarget - (this._chromaDecay ?? 0.1) * dt);
    }
    this._chromaCurrent += (this._chromaTarget - this._chromaCurrent) * Math.min(1, dt * 12);
    this._chromaPass.uniforms.intensity.value = this._chromaCurrent;

    // Breach lerp.
    this._breachCurrent += (this._breachTarget - this._breachCurrent) * Math.min(1, dt * 8);
    this._vignettePass.uniforms.breachPulse.value = this._breachCurrent;

    // Combo tint lerp.
    this._comboCurrent += (this._comboTarget - this._comboCurrent) * Math.min(1, dt * 4);
    this._vignettePass.uniforms.comboTint.value = this._comboCurrent;

    // Flash decay (instant-on, rapid decay).
    if (this._flashCurrent > 0) {
      this._flashCurrent = Math.max(0, this._flashCurrent - this._flashDecay * dt);
    }
    this._vignettePass.uniforms.flashIntensity.value = this._flashCurrent;
  }

  dispose() {
    this._lensPass.dispose?.();
    this._chromaPass.dispose?.();
    this._vignettePass.dispose?.();
  }
}
