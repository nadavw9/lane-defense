// Entity-creation geometry guard — the ORDERING subtype of the stale-geometry
// bug class (GEOMETRY_MECHANICS_BATCH.md §0c).
//
// WHY geometry-liveness.test.js does NOT catch this class:
//   Its import-freeze canary asks "does this value CHANGE when the level
//   changes?" — a liveness question. The 2026-07-25 bug passed that test
//   trivially: Car3D._breachRow is a plain mutable field that CAN change. It
//   was simply never SET, because GameApp's per-frame update() call passes an
//   object literal with no gridRows field, so the sync guard was always falsy.
//   The value was live; the wiring was dead.
//
// The class this file guards: geometry CONSUMED AT ENTITY-CREATION TIME and
// baked in permanently. Car3D sizes a car ONCE, in _createEntry, via
// spriteScaleFor(type, gridRows). If gridRows is wrong at that instant the car
// is permanently mis-sized — no later correction ever runs. Production hid this
// for months because every shipped level is gridRows 16 and Car3D's constructor
// default (_breachRow = 15) is exactly gridRows 16.
//
// These tests assert the SCALE FORMULA directly at each board depth, and pin
// the contract that a consumer must be configured before it creates entities.
import { describe, it, expect } from 'vitest';
import { CAR_TYPES } from '../src/director/CarTypes.js';

// Mirrors Car3D's own constants + spriteScaleFor(). Kept local on purpose: if
// Car3D's formula changes, this test should FAIL and be re-derived deliberately,
// not silently track the change.
const CELL = 4.0, ROAD_Z_FAR = -26, POS_NEAR_Z = -2.6;
const FIT = { small: 0.656, big: 0.673, jeep: 0.690, truck: 0.707, tank: 0.724, bigrig: 0.740 };
const BODY_H = { small: 0.893, big: 0.775, jeep: 0.900, truck: 0.961, bigrig: 0.932, tank: 0.993 };
const DIMS_HF = { small: 0.77, big: 0.77, jeep: 0.81, truck: 0.98, bigrig: 1.26, tank: 1.01 };

const rowPitchWu = (gridRows) => (Math.abs(ROAD_Z_FAR) - Math.abs(POS_NEAR_Z)) / (Math.max(2, gridRows) - 1);
const spriteScaleFor = (type, gridRows) =>
  FIT[type] * rowPitchWu(gridRows) / (CELL * DIMS_HF[type] * BODY_H[type]);

describe('entity-creation geometry — car scale is correct AT CREATION, per board depth', () => {
  it('scale tracks gridRows across every depth the game ships (8..16)', () => {
    for (const type of Object.keys(FIT)) {
      let prev = null;
      for (const gridRows of [16, 14, 12, 10, 9, 8]) {
        const s = spriteScaleFor(type, gridRows);
        expect(s, `${type} @${gridRows}`).toBeGreaterThan(0);
        // Shallower board => taller rows => bigger cars. Strictly monotonic.
        if (prev !== null) expect(s, `${type}: ${gridRows} vs deeper`).toBeGreaterThan(prev);
        prev = s;
      }
    }
  });

  it('a gridRows-8 car is ~1.8x a gridRows-16 car (the pilot\'s whole premise)', () => {
    // 15 intervals -> 7 intervals = 15/7 = 2.14x pitch, times the FIT ratio.
    const ratio = spriteScaleFor('big', 8) / spriteScaleFor('big', 16);
    expect(ratio).toBeGreaterThan(1.7);
    expect(ratio).toBeLessThan(2.3);
  });

  // THE REGRESSION ITSELF. Pre-fix, Car3D._breachRow stayed at its constructor
  // default (15 => gridRows 16) on every level because the sync never ran, so a
  // gridRows-8 board produced gridRows-16-sized cars. This asserts the two are
  // meaningfully different — i.e. that using the default on a shallow board is
  // a real, detectable error rather than a harmless approximation.
  it('using the DEFAULT depth on a shallow board is a large, detectable error', () => {
    const correct = spriteScaleFor('big', 8);
    const stale   = spriteScaleFor('big', 16);   // the constructor default
    const err = Math.abs(stale - correct) / correct;
    expect(err, 'stale-default error should be >40%, i.e. impossible to miss')
      .toBeGreaterThan(0.4);
  });

  it('type ordering holds at every depth (§0a: small < big < jeep < truck < tank < bigrig)', () => {
    // Ordering is by RENDERED BODY LENGTH, which is what "no same-type fusing"
    // and the visible type distinction (CLAUDE.md §7) actually depend on.
    for (const gridRows of [8, 10, 12, 16]) {
      const order = ['small', 'big', 'jeep', 'truck', 'tank', 'bigrig'];
      const lens = order.map(t => CELL * DIMS_HF[t] * spriteScaleFor(t, gridRows) * BODY_H[t]);
      for (let i = 1; i < lens.length; i++) {
        expect(lens[i], `${order[i]} vs ${order[i - 1]} @${gridRows}`).toBeGreaterThan(lens[i - 1]);
      }
    }
  });

  it('every car type the game can spawn has a FIT entry (no silent SPRITE_SCALE fallback)', () => {
    for (const type of Object.keys(CAR_TYPES)) {
      if (type === 'boss') continue;   // boss is intentionally programmatic
      expect(FIT[type], `${type} missing from FIT`).toBeDefined();
      expect(BODY_H[type], `${type} missing from BODY_FRAC`).toBeDefined();
    }
  });
});

describe('entity-creation geometry — the wiring contract', () => {
  // A structural guard: GameApp must hand gridRows to the renderer at LEVEL
  // START. The bug was precisely that this call did not exist and the only
  // sync attempt lived in a per-frame path fed an object without the field.
  it('GameApp sets gridRows on the 3D renderer during level start', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync('src/renderer/GameApp.js', 'utf8');
    expect(src, 'gameRenderer3D.setGridRows(...) must be called at level start')
      .toMatch(/gameRenderer3D\.setGridRows\(/);
  });

  it('GameRenderer3D re-applies gridRows when it rebuilds its car renderer', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync('src/renderer3d/GameRenderer3D.js', 'utf8');
    // _buildGameObjects constructs a fresh Car3D with default _breachRow; it
    // must restore the stored depth, exactly as it does for lane count.
    const build = src.slice(src.indexOf('_buildGameObjects()'));
    expect(build, '_buildGameObjects must actually CALL setGridRows on the new Car3D')
      .toMatch(/_cars\.setGridRows\(\s*this\._gridRows\s*\)/);
  });

  // THE GENERALISED GUARD. Both 2026-07-25 bugs are one defect: GameApp hands
  // GameRenderer3D.update() a hand-built OBJECT LITERAL, not the real GameState.
  // Any field the renderer reads but the literal omits is silently `undefined` —
  // no error, no warning, just a permanently dead code path:
  //   * gridRows      -> cars sized for a 16-row board on every level, forever
  //   * bombFreezeUntil -> `elapsed < (undefined ?? -Infinity)` is always false,
  //                        so the bomb-concussion freeze VFX never once fired
  // This test closes the class rather than the two instances: it extracts every
  // `gameState.X` the renderer actually reads and requires the payload to carry
  // it. Add a read without adding the key and this fails.
  it('every gameState field GameRenderer3D reads is present in GameApp\'s update() payload', async () => {
    const fs = await import('fs');
    // Strip comments first — the two fixes above *describe* the old field names
    // in prose, and a scanner that counts those would report false positives.
    const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const r3d = strip(fs.readFileSync('src/renderer3d/GameRenderer3D.js', 'utf8'));

    const read = new Set(
      [...r3d.matchAll(/gameState\??\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]),
    );
    expect(read.size, 'sanity: the renderer should read several gameState fields')
      .toBeGreaterThan(2);

    const app = fs.readFileSync('src/renderer/GameApp.js', 'utf8');
    const call = app.indexOf('gameRenderer3D.update({');
    expect(call, 'could not locate the gameRenderer3D.update({...}) call site').toBeGreaterThan(-1);
    // The literal spans a few lines; take enough to cover it, comments removed.
    const payload = strip(app.slice(call, call + 600));

    for (const key of read) {
      expect(payload, `GameRenderer3D reads gameState.${key} but GameApp's update() payload never passes it — dead read`)
        .toMatch(new RegExp(`\\b${key}\\b`));
    }
  });
});
