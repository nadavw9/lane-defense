// Projectile pooling — state must NOT leak between uses.
//
// Why this test exists: a pooled object that resets only "the fields the caller
// happens to overwrite" works until someone writes another field. The failure
// mode is an intermittently wrong-COLOURED or wrong-SIZED projectile — it passes
// every functional test and shows up on a device. So the contract asserted here
// is acquire -> mutate everything -> release -> re-acquire -> object is pristine.
//
// Pooling exists because a fresh material acquires its shader program on first
// render and Three resolves the link synchronously. Measured under SwiftShader
// (CI's software renderer) on L5: first shot resolved in 4768ms vs 853/658ms for
// the 2nd/3rd, against a 5000ms test budget — which is why boundaries.spec kept
// failing in CI on LANE 0, always the first shot.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { Projectile3D } from '../src/renderer3d/Projectile3D.js';

function makeSubject(lanes = 3) {
  const scene = new THREE.Scene();
  const firingSlots = new Array(lanes).fill(null);
  const laneObjs = Array.from({ length: lanes }, () => ({ cars: [{ position: 50, hp: 3 }] }));
  return { p: new Projectile3D(scene, firingSlots, laneObjs), scene, firingSlots };
}

describe('Projectile3D pooling — no state leaks between shots', () => {
  it('pre-creates a fixed pool and adds it to the scene ONCE', () => {
    const { p, scene } = makeSubject(3);
    expect(p._projPool.length).toBe(3);
    expect(p._lightPool.length).toBe(3);
    // Everything pooled is already parented, and starts hidden.
    for (const s of p._projPool) {
      expect(s.mesh.parent).toBe(scene);
      expect(s.trail.parent).toBe(scene);
      expect(s.mesh.visible).toBe(false);
    }
    for (const s of p._lightPool) expect(s.light.parent).toBe(scene);
  });

  it('acquire -> mutate -> release -> re-acquire yields a PRISTINE object', () => {
    const { p } = makeSubject(1);
    const first = p._acquireProj(0xff0000, 1, 2);
    expect(first).not.toBeNull();

    // Trash every field a live projectile mutates during flight/splat.
    first.mesh.scale.set(1.5, 0.3, 1.5);          // impact splat
    first.mesh.rotation.set(1, 2, 3);
    first.mesh.material.opacity = 0.02;            // faded out
    first.mesh.material.emissiveIntensity = 0.1;
    first.mesh.position.set(99, 99, 99);
    first.trail.visible = false;
    const tpos = first.trail.geometry.attributes.position;
    for (let i = 0; i < tpos.array.length; i++) tpos.array[i] = 42;

    p._releaseProj(first);
    expect(first.inUse).toBe(false);

    const second = p._acquireProj(0x00ff00, 7, 8);
    expect(second, 'single-slot pool must hand back the same object').toBe(first);

    // Pristine: geometry transform, material look, trail, visibility.
    expect(second.mesh.scale.toArray()).toEqual([1, 1, 1]);
    expect(second.mesh.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    expect(second.mesh.material.opacity).toBeCloseTo(0.92, 5);
    expect(second.mesh.material.emissiveIntensity).toBeCloseTo(1.8, 5);
    expect(second.mesh.visible).toBe(true);
    expect(second.trail.visible).toBe(true);
    // Colour is the NEW shot's, not the old one's.
    expect(second.mesh.material.color.getHex()).toBe(0x00ff00);
    expect(second.mesh.material.emissive.getHex()).toBe(0x00ff00);
    // Position is the new spawn point.
    expect(second.mesh.position.x).toBeCloseTo(7, 5);
    expect(second.mesh.position.z).toBeCloseTo(8, 5);
    // Trail fully collapsed onto the new spawn point — no segment survives.
    const pos = second.trail.geometry.attributes.position.array;
    const col = second.trail.geometry.attributes.color.array;
    for (let j = 0; j < pos.length / 3; j++) {
      expect(pos[j * 3]).toBeCloseTo(7, 5);
      expect(pos[j * 3 + 2]).toBeCloseTo(8, 5);
      expect(col[j * 3]).toBe(0);
    }
  });

  it('light pool resets colour, intensity, distance AND decay on acquire', () => {
    const { p } = makeSubject(1);
    const a = p._acquireLight(0xff0000);
    a.light.intensity = 0; a.light.distance = 999; a.light.decay = 9; a.light.visible = false;
    p._releaseLight(a);
    const b = p._acquireLight(0x0000ff);
    expect(b).toBe(a);
    expect(b.light.color.getHex()).toBe(0x0000ff);
    expect(b.light.intensity).toBeCloseTo(1.5, 5);
    expect(b.light.distance).toBe(4);
    expect(b.light.decay).toBe(2);
    expect(b.light.visible).toBe(true);
  });

  it('releasing PARKS objects — it never removes or disposes them', () => {
    const { p, scene } = makeSubject(2);
    const disposeSpy = vi.spyOn(p._projPool[0].mesh.material, 'dispose');
    const slot = p._acquireProj(0xffffff, 0, 0);
    p._releaseProj(slot);
    expect(slot.mesh.visible).toBe(false);
    expect(slot.trail.visible).toBe(false);
    expect(slot.mesh.parent, 'must stay in the scene').toBe(scene);
    expect(disposeSpy, 'disposing would force a program re-acquire next shot').not.toHaveBeenCalled();
  });

  it('never grows: exhausting the pool returns null rather than allocating', () => {
    const { p } = makeSubject(2);
    expect(p._acquireProj(0xffffff, 0, 0)).not.toBeNull();
    expect(p._acquireProj(0xffffff, 0, 0)).not.toBeNull();
    expect(p._acquireProj(0xffffff, 0, 0), 'third concurrent shot must not allocate').toBeNull();
    expect(p._projPool.length).toBe(2);
  });

  it('exposes its materials and meshes for the level-intro warm-up', () => {
    const { p } = makeSubject(3);
    // Pooling alone would only move the stall to shot #1; the warm-up is what
    // removes it, and it needs both the materials and the (hidden) objects.
    expect(p.warmupMaterials().length).toBe(6);
    expect(p.warmupMeshes().length).toBe(6);
  });
});
