// WS3 §3c boss infrastructure (INFRA-A scripted openings, INFRA-C spawnScript)
// + the live↔sim HP-parity contract. Headless — real GameLoop/GameState/CarDirector/
// SimulationRunner, no Pixi/Three/DOM.
//
// SIM PARITY IS A HARD REQUIREMENT (VISION rule 6): SimulationRunner consumes the
// SAME CarDirector implementation as the live game for spawnScript, and the same
// hp formula (base × hpMultiplier, HP_MINIMUM clamp, applied ONCE — the sim's old
// re-multiplication fought ~half-hp heavy cars and biased every balance report).

import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GameLoop }         from '../src/game/GameLoop.js';
import { LevelManager }     from '../src/game/LevelManager.js';
import { GameState }        from '../src/game/GameState.js';
import { CombatResolver }   from '../src/game/CombatResolver.js';
import { CarDirector }      from '../src/director/CarDirector.js';
import { ShooterDirector }  from '../src/director/ShooterDirector.js';
import { FairnessArbiter }  from '../src/director/FairnessArbiter.js';
import { IntensityPhase }   from '../src/director/IntensityPhase.js';
import { SeededRandom }     from '../src/utils/SeededRandom.js';
import { Lane }             from '../src/models/Lane.js';
import { Column }           from '../src/models/Column.js';
import { CAR_TYPES, bandWeights } from '../src/director/CarTypes.js';
import { HP_MINIMUM }       from '../src/director/DirectorConfig.js';
import { SimulationRunner } from '../src/simulation/SimulationRunner.js';

const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };

function makeLoop({ laneCount = 4, hpMultiplier = 1, initialCars = null, goals = [] } = {}) {
  const lanes   = Array.from({ length: 4 }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns,
    colors:   ['Red', 'Blue', 'Green'],
    world:    { hpMultiplier, speed: { base: 5, variance: 0.5 } },
    duration: 90, phaseMan: new IntensityPhase(90),
    laneCount, colCount: laneCount, gridRows: 16,
    spawnBudget: 12, laneTargetCarCount: 2,
  });
  gs.initialCars = initialCars;
  gs.goals = goals;
  gs.goalProgress = goals.map(g => g.count);
  const rng    = new SeededRandom(7);
  const carDir = new CarDirector({}, rng);
  const loop = new GameLoop({
    app: mockApp, gameState: gs,
    carDir,
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(),
    rng, onEnd: vi.fn(), onAdvance: vi.fn(),
  });
  return { gs, loop, carDir };
}

// ── INFRA-A — _primeInitialCars honors { lane, row, type, color } ────────────────

describe('INFRA-A: scripted opening board (initialCars)', () => {
  it('a 4-entry initialCars lands one car in each named lane with the named row/type/color', () => {
    const defs = [
      { lane: 0, row: 2, type: 'truck',  color: 'Blue'  },
      { lane: 1, row: 5, type: 'tank',   color: 'Red'   },
      { lane: 2, row: 0, type: 'small',  color: 'Green' },
      { lane: 3, row: 7, type: 'bigrig', color: 'Blue'  },
    ];
    const { gs, loop } = makeLoop({ initialCars: defs });
    loop._primeInitialCars();
    for (const def of defs) {
      const cars = gs.lanes[def.lane].cars;
      expect(cars.length).toBe(1);
      expect(cars[0].row).toBe(def.row);
      expect(cars[0].type).toBe(def.type);
      expect(cars[0].color).toBe(def.color);
    }
  });

  it('recomputes hp for the named type (base × hpMultiplier, HP_MINIMUM clamp) — a scripted tank is not born with a rolled bike hp', () => {
    const { gs, loop } = makeLoop({
      hpMultiplier: 0.5,
      initialCars: [
        { lane: 0, row: 1, type: 'tank'  },   // 20 × 0.5 = 10
        { lane: 1, row: 1, type: 'truck' },   //  7 × 0.5 = 3.5 → 4
        { lane: 2, row: 1, type: 'small' },   //  2 × 0.5 = 1 → clamps to HP_MINIMUM
      ],
    });
    loop._primeInitialCars();
    expect(gs.lanes[0].cars[0].hp).toBe(10);
    expect(gs.lanes[0].cars[0].maxHp).toBe(10);
    expect(gs.lanes[1].cars[0].hp).toBe(4);
    expect(gs.lanes[2].cars[0].hp).toBe(HP_MINIMUM);
  });

  it('the array defines the ENTIRE opening: unnamed lanes start empty (refill handles them)', () => {
    const { gs, loop } = makeLoop({
      initialCars: [{ lane: 0, row: 0 }, { lane: 1, row: 1 }],
    });
    loop._primeInitialCars();
    expect(gs.lanes[0].cars.length).toBe(1);
    expect(gs.lanes[1].cars.length).toBe(1);
    expect(gs.lanes[2].cars.length).toBe(0);
    expect(gs.lanes[3].cars.length).toBe(0);
  });

  it('an off-palette color is ignored (keeps the generated palette color); lane clamps to active lanes', () => {
    const { gs, loop } = makeLoop({
      laneCount: 2,
      initialCars: [{ lane: 9, row: 3, color: 'Magenta' }],
    });
    loop._primeInitialCars();
    const cars = gs.lanes[1].cars;   // lane 9 clamps to last active lane (1)
    expect(cars.length).toBe(1);
    expect(['Red', 'Blue', 'Green']).toContain(cars[0].color);
  });
});

// ── INFRA-C — spawnScript stage table on CarDirector (single shared impl) ───────

describe('INFRA-C: spawnScript { untilPct, weights?, rate? }', () => {
  const SCRIPT = [
    { untilPct: 0.33, weights: { small: 1 }, rate: 1 },
    { untilPct: 0.66, weights: { truck: 1 } },
    { untilPct: 1.00, weights: { tank: 1 },  rate: 3 },
  ];
  const WC = { hpMultiplier: 1, speed: { base: 5, variance: 0 } };

  // Carry-over bait/reward cars (hp 1-2, type small) are a separate mechanic that
  // bypasses stage weights by design — spawn checks below exclude them.
  const spawnTypes = (dir, n = 40) => {
    const types = [];
    for (let i = 0; i < n; i++) {
      const car = dir.generateCar({ id: i % 4 }, 'BUILD', WC, ['Red', 'Blue'], 16);
      if (!(car.type === 'small' && car.hp <= 2)) types.push(car.type);
    }
    return types;
  };

  it('stage selection follows kill-progress (inclusive untilPct boundaries)', () => {
    const dir = new CarDirector({}, new SeededRandom(11));
    dir.setSpawnScript(SCRIPT);

    dir.setProgress(0);
    expect(spawnTypes(dir).every(t => t === 'small')).toBe(true);
    dir.setProgress(0.33);   // boundary: still stage 1
    expect(dir.scriptStage()).toBe(SCRIPT[0]);
    dir.setProgress(0.34);
    expect(spawnTypes(dir).every(t => t === 'truck')).toBe(true);
    dir.setProgress(0.9);
    expect(spawnTypes(dir).every(t => t === 'tank')).toBe(true);
    dir.setProgress(1.0);    // last stage catches 1.0
    expect(dir.scriptStage()).toBe(SCRIPT[2]);
  });

  it('scriptRate returns the stage rate, null when the stage has none or no script is set', () => {
    const dir = new CarDirector({}, new SeededRandom(11));
    expect(dir.scriptRate()).toBe(null);           // no script
    dir.setSpawnScript(SCRIPT);
    expect(dir.scriptRate()).toBe(1);              // stage 1 (progress resets to 0)
    dir.setProgress(0.5);
    expect(dir.scriptRate()).toBe(null);           // stage 2 has no rate
    dir.setProgress(0.9);
    expect(dir.scriptRate()).toBe(3);
  });

  it('setSpawnScript(null/[]) clears the script; unknown types in weights are ignored', () => {
    const dir = new CarDirector({}, new SeededRandom(11));
    dir.setSpawnScript([]);
    expect(dir.scriptStage()).toBe(null);
    dir.setSpawnScript([{ untilPct: 1, weights: { ufo: 5, truck: 1 } }]);
    expect(spawnTypes(dir).every(t => t === 'truck')).toBe(true);
    dir.setSpawnScript(null);
    expect(dir.scriptStage()).toBe(null);
  });

  it('GameLoop._refillLanes uses the stage rate as the lane-fill target', () => {
    const { gs, loop, carDir } = makeLoop({
      goals: [{ type: 'destroyTotal', count: 10 }],
    });
    carDir.setSpawnScript([{ untilPct: 1, weights: { small: 1 }, rate: 1 }]);
    loop._refillLanes();
    for (let li = 0; li < 4; li++) {
      expect(gs.lanes[li].cars.length).toBe(1);   // rate 1 overrides laneTargetCarCount 2
    }
  });

  it('SimulationRunner consumes the same spawnScript (parity): an all-tank script makes a level measurably harder than an all-small one', () => {
    const base = {
      duration: 90, colors: ['Red', 'Blue'], levelId: 20,
      worldConfig: { hpMultiplier: 0.8, speed: { base: 5, variance: 0.2 } },
      laneCount: 4, colCount: 4, laneTargetCarCount: 2, spawnBudget: 12, gridRows: 16,
      goals: [{ type: 'destroyTotal', count: 20 }], skill: 'average',
    };
    const run = (spawnScript) => {
      const r = new SimulationRunner({ ...base, spawnScript });
      let wins = 0;
      for (let s = 0; s < 120; s++) if (r.runLevel(1 + s).won) wins++;
      return wins / 120;
    };
    const easy = run([{ untilPct: 1, weights: { small: 1 } }]);
    const hard = run([{ untilPct: 1, weights: { tank: 1 } }]);
    expect(easy).toBeGreaterThan(hard + 0.10);   // deterministic seeds; wide margin
  });
});

// ── V2 boss vehicles (L10/L20/L30/L40) — config fidelity ────────────────────────
// 2026-09-27 V2 redesign: the four bosses are real vehicles with a colour
// sequence (TrafficRules.makeBoss), replacing the V1 spawn-weight "bosses"
// (L20 surge rate script, L30 tank weights, L40 staged gauntlet, L10 supply
// bias). These pin each boss's designed twist so a retune cannot quietly erase it.
describe('V2 boss vehicles: each boss level carries its designed twist', () => {
  const cfgOf = (id) => { const lm = new LevelManager(); lm.goToLevel(id); return lm.current; };
  const bosses = (cfg) => (cfg.initialCars ?? []).filter((d) => d.sequence);

  it('every boss level has a defeatBoss goal matching its boss count, with sequences in the palette', () => {
    for (const id of [10, 20, 30, 40]) {
      const cfg = cfgOf(id);
      const bs = bosses(cfg);
      expect(bs.length, `L${id} boss count`).toBeGreaterThan(0);
      expect(cfg.goals).toEqual([{ type: 'defeatBoss', count: bs.length }]);
      for (const b of bs) for (const c of b.sequence) expect(cfg.colors).toContain(c);
    }
  });

  it('L10 "The Hauler" is a plain sequence boss; L20 "Iron Hauler" re-plates', () => {
    expect(bosses(cfgOf(10))[0].reArmor).toBeFalsy();
    expect(bosses(cfgOf(20))[0].reArmor).toBe(true);
  });

  it('L30 "Chameleon King" is the longest single sequence and is flanked by speeders', () => {
    const cfg = cfgOf(30);
    const len = bosses(cfg)[0].sequence.length;
    for (const id of [10, 20]) expect(len).toBeGreaterThan(bosses(cfgOf(id))[0].sequence.length);
    expect(cfg.traits?.speeder).toBeGreaterThan(0);
  });

  it('L40 "Twin Titans" fields two bosses, one of them armoured', () => {
    const bs = bosses(cfgOf(40));
    expect(bs).toHaveLength(2);
    expect(bs.filter((b) => b.reArmor)).toHaveLength(1);
  });
});

// ── L10 v2 "The Bench Test" — bomb-supply color bias (§3c) ──────────────────────

describe('L10 v2: shooterColorWeights supply bias', () => {
  const mkGameState = () => ({
    colorPalette: ['Red', 'Blue'],
    // Balanced fronts/stacks so demand-match wouldn't skew a control run.
    lanes: [
      { cars: [{ color: 'Red', hp: 2 }],  frontCar() { return this.cars[0]; } },
      { cars: [{ color: 'Blue', hp: 2 }], frontCar() { return this.cars[0]; } },
      { cars: [{ color: 'Red', hp: 2 }],  frontCar() { return this.cars[0]; } },
      { cars: [{ color: 'Blue', hp: 2 }], frontCar() { return this.cars[0]; } },
    ],
    columns: [],
  });
  const noopArbiter = { checkShooter: () => ({ fixed: false }) };

  it('bias {Blue:3,Red:1} rolls ~75% Blue (overdue floor still forces the scarce color to reappear)', () => {
    const dir = new ShooterDirector({}, new SeededRandom(5), noopArbiter);
    dir.setColorBias({ Blue: 3, Red: 1 });
    const gs = mkGameState();
    let blue = 0, maxRedGap = 0, gap = 0;
    for (let i = 0; i < 600; i++) {
      const s = dir.generateShooter(0, gs, { damageSkew: 'standard' });
      if (s.color === 'Blue') { blue++; gap++; maxRedGap = Math.max(maxRedGap, gap); }
      else gap = 0;
    }
    expect(blue / 600).toBeGreaterThan(0.62);   // biased well above uniform 50%
    expect(blue / 600).toBeLessThan(0.85);      // but the overdue floor caps the drift
    expect(maxRedGap).toBeLessThanOrEqual(7);   // COLOR_WINDOW guarantee: red within every 7 shots
  });

  it('setColorBias(null/{}) turns the bias off; off-palette colors in the map are ignored', () => {
    const dir = new ShooterDirector({}, new SeededRandom(5), noopArbiter);
    dir.setColorBias({ Green: 100 });            // not in this level's palette
    const gs = mkGameState();
    let blue = 0;
    for (let i = 0; i < 400; i++) if (dir.generateShooter(0, gs, { damageSkew: 'standard' }).color === 'Blue') blue++;
    expect(blue / 400).toBeGreaterThan(0.3);     // falls through to demand-match/uniform
    expect(blue / 400).toBeLessThan(0.7);
    dir.setColorBias(null);
    dir.setColorBias({});
  });

  // (The skipped real-L10 supply-bias test was retired with the V1 "Bench Test"
  //  boss: V2's L10 is a boss vehicle and carries no supply bias.)
});

// ── Config-shape audit: spawnScript weights are { type: weight } OBJECTS ────────
// CarDirector consumes them via Object.entries; GameApp._levelCarTypes scans them
// via Object.keys (car-type intro cards). L40 was the FIRST config to carry
// spawnScript weights and exposed a for...of over the object in GameApp (crash on
// level start) — pin the shape for every level so a future array-shaped weights
// entry (bandWeights style) fails here instead of at runtime.
describe('config audit: spawnScript weight shape across all 40 levels', () => {
  it('every spawnScript stage has untilPct, and weights (when present) is a plain object of known CAR_TYPES', () => {
    const lm = new LevelManager();
    for (let id = 1; id <= 40; id++) {
      lm.goToLevel(id);
      for (const stage of lm.current.spawnScript ?? []) {
        expect(typeof stage.untilPct).toBe('number');
        if (stage.weights !== undefined) {
          expect(Array.isArray(stage.weights)).toBe(false);
          expect(typeof stage.weights).toBe('object');
          for (const t of Object.keys(stage.weights)) {
            expect(CAR_TYPES[t], `L${id} spawnScript has unknown car type "${t}"`).toBeDefined();
          }
        }
        if (stage.rate !== undefined) expect(Number.isFinite(stage.rate)).toBe(true);
      }
      for (const def of lm.current.initialCars ?? []) {
        if (def.type) expect(CAR_TYPES[def.type], `L${id} initialCars has unknown type "${def.type}"`).toBeDefined();
        if (def.color) expect(lm.current.colors).toContain(def.color);
      }
    }
  });
});

// ── Live↔sim HP parity (the double-discount regression) ─────────────────────────

describe('live↔sim HP parity', () => {
  it('CarDirector._buildCar applies hpMultiplier ONCE with the HP_MINIMUM clamp (the value both live play and the sim must use)', () => {
    const dir = new CarDirector({}, new SeededRandom(3));
    dir.setLevel(30);
    const wc = { hpMultiplier: 0.53, speed: { base: 4, variance: 0 } };
    // Sample until each heavy type appears; assert the exact live formula.
    const seen = {};
    for (let i = 0; i < 3000 && Object.keys(seen).length < 3; i++) {
      const car = dir.generateCar({ id: i % 4 }, 'CLIMAX', wc, ['Red'], 16);
      if (car.hp <= 2 && car.type === 'small') continue;   // carry-over pair
      seen[car.type] = car.hp;
    }
    for (const [type, hp] of Object.entries(seen)) {
      expect(hp).toBe(Math.max(HP_MINIMUM, Math.round(CAR_TYPES[type].hp * wc.hpMultiplier)));
    }
  });

  it('AUDIT tripwire: SimulationRunner must not re-multiply car.hp by hpMultiplier (it already carries it)', () => {
    // Static audit in the WS1 style (like the asset-manifest and registry-constant
    // audits): the double-discount bug was one expression; make its return trip a test
    // failure. If a legitimate use ever appears, restructure it to not match.
    const src = fs.readFileSync(
      path.resolve(__dirname, '../src/simulation/SimulationRunner.js'), 'utf8');
    expect(src).not.toMatch(/car\.hp\s*\*\s*worldConfig\.hpMultiplier/);
  });
});
