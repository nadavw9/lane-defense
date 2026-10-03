import { describe, it, expect, afterEach } from 'vitest';
import { CameraFX } from '../src/renderer3d/CameraFX.js';
import { setReducedMotion } from '../src/game/MotionPrefs.js';

function fakeCamera(x = 0, y = 8, z = -3) {
  const mk = (a, b, c) => ({
    x: a, y: b, z: c,
    set(i, j, k) { this.x = i; this.y = j; this.z = k; },
    copy(o) { this.x = o.x; this.y = o.y; this.z = o.z; },
    clone() { return mk(this.x, this.y, this.z); },
  });
  return { position: mk(x, y, z), zoom: 1, updateProjectionMatrix() { this.zoomTouched = true; } };
}

afterEach(() => setReducedMotion(null));

describe('CameraFX (shake-only)', () => {
  it('never changes zoom and never recomputes the projection', () => {
    const cam = fakeCamera(); const fx = new CameraFX(cam);
    fx.shake(0.4, 0.5);
    for (let i = 0; i < 40; i++) fx.update(0.016);
    expect(cam.zoom).toBe(1);
    expect(cam.zoomTouched).toBeUndefined();
    expect(fx.setCombo).toBeUndefined();
    expect(fx.startBreachZoom).toBeUndefined();
    expect(fx.startLevelIntro).toBeUndefined();
  });

  it('shake offsets stay within the magnitude and settle exactly at rest', () => {
    const cam = fakeCamera(); const fx = new CameraFX(cam);
    fx.shake(0.3, 0.3);
    for (let i = 0; i < 10; i++) {
      fx.update(0.016);
      expect(Math.abs(fx.offsetX)).toBeLessThanOrEqual(0.3);
      expect(cam.position.x).toBeCloseTo(0 + fx.offsetX, 9);
      expect(cam.position.z).toBeCloseTo(-3 + fx.offsetZ, 9);
    }
    for (let i = 0; i < 40; i++) fx.update(0.016);
    expect(fx.offsetX).toBe(0); expect(fx.offsetZ).toBe(0);
    expect(cam.position.x).toBe(0); expect(cam.position.z).toBe(-3);
  });

  it('decays over the shake own duration, not a fixed one', () => {
    const cam = fakeCamera(); const fx = new CameraFX(cam);
    fx.shake(0.4, 0.65);
    expect(fx.update(0.5)).toBe(true);    // still running after 0.5s of a 0.65s shake
    expect(fx.update(0.2)).toBe(false);
  });

  it('a weaker hit does not cut a stronger one short; a stronger one replaces it', () => {
    const fx = new CameraFX(fakeCamera());
    fx.shake(0.4, 0.6);
    fx.shake(0.05, 0.1);
    expect(fx._shakeMag).toBe(0.4); expect(fx._shakeDur).toBe(0.6);
    fx.shake(0.5, 0.3);
    expect(fx._shakeMag).toBe(0.5);
  });

  it('reset restores the resting pose and clears offsets', () => {
    const cam = fakeCamera(); const fx = new CameraFX(cam);
    fx.shake(0.4, 0.6); fx.update(0.016);
    fx.reset();
    expect(cam.position.x).toBe(0); expect(cam.position.z).toBe(-3);
    expect(fx.offsetX).toBe(0); expect(fx.update(0.016)).toBe(false);
  });

  it('setLaneCount re-captures the resting pose Scene3D just set', () => {
    const cam = fakeCamera(); const fx = new CameraFX(cam);
    cam.position.set(0, 8, -5.5);          // Scene3D moved the band
    fx.setLaneCount(3);
    fx.update(0.016);
    expect(cam.position.z).toBe(-5.5);     // not reverted to -3
  });

  it('reduced motion blocks new shakes and cancels a running one', () => {
    const cam = fakeCamera(); const fx = new CameraFX(cam);
    setReducedMotion(true);
    fx.shake(0.4, 0.5);
    expect(fx.update(0.016)).toBe(false);
    setReducedMotion(false);
    fx.shake(0.4, 0.5);
    setReducedMotion(true);
    expect(fx.update(0.016)).toBe(false);
    expect(cam.position.x).toBe(0);
  });
});
