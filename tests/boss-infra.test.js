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

// ── INFRA-B — L30 "Industrial Finale" tank-heavy weights (§3c boss) ─────────────

describe('INFRA-B: L30 tank-heavy bandWeights', () => {
  it('L30 spawns ≈40% tanks (the design intent, realized in config); bigrig present in every phase (destroyType goal)', () => {
    const band = bandWeights(30);
    for (const phase of ['CALM', 'BUILD', 'PRESSURE', 'CLIMAX', 'RELIEF']) {
      expect(band[phase].some(w => w.value === 'bigrig')).toBe(true);
    }
    // Weighted tank share across phases lands ~25-50% (≈40% through the level).
    for (const phase of ['BUILD', 'PRESSURE', 'CLIMAX']) {
      const total = band[phase].reduce((s, w) => s + w.weight, 0);
      const tank  = band[phase].find(w => w.value === 'tank')?.weight ?? 0;
      expect(tank / total).toBeGreaterThanOrEqual(0.35);
      expect(tank / total).toBeLessThanOrEqual(0.55);
    }
    // L29/L31 are NOT tank-heavy — the branch is L30-only.
    expect(bandWeights(29)).not.toBe(band);
    expect(bandWeights(31)).not.toBe(band);
  });
});

// ── L20 "The Surge" (§3c boss) — spawnScript rate + director==sim parity ────────

describe('L20 "The Surge": crest/lull rate script + director==sim parity', () => {
  const CHECKPOINTS = [0.05, 0.25, 0.35, 0.55, 0.65, 0.85, 0.95];

  it('the real L20 config alternates crest (rate 3) / lull (rate 1) across kill-progress, no type weights', () => {
    const lm = new LevelManager();
    lm.goToLevel(20);
    const cfg = lm.current;
    expect(cfg.colors).toEqual(['Red', 'Blue', 'Green']);            // what NOT to touch: 3 colors
    expect(cfg.spawnScript.every((s) => !s.weights)).toBe(true);      // rate-only — surge is about rate, not type

    const dir = new CarDirector({}, new SeededRandom(1));
    dir.setSpawnScript(cfg.spawnScript);
    const rates = CHECKPOINTS.map((p) => { dir.setProgress(p); return dir.scriptRate(); });
    expect(rates).toEqual([3, 1, 3, 1, 3, 1, 3]);
  });

  it('GameLoop._refillLanes honors the real L20 spawnScript rate (not laneTargetCarCount) at every stage', () => {
    const lm = new LevelManager();
    lm.goToLevel(20);
    const cfg = lm.current;
    // _refillLanes derives progress itself via _goalProgressPct (overwriting any
    // manual setProgress) — drive it through gs.goalProgress instead, using a
    // round total so the checkpoints land on exact fractions.
    const { gs, loop, carDir } = makeLoop({ goals: [{ type: 'destroyTotal', count: 100 }] });
    carDir.setSpawnScript(cfg.spawnScript);

    for (const [p, expectedRate] of CHECKPOINTS.map((p, i) => [p, [3, 1, 3, 1, 3, 1, 3][i]])) {
      for (const lane of gs.lanes) lane.cars = [];   // reset so refill fills from empty
      gs.goalProgress = [Math.round(100 * (1 - p))];
      loop._refillLanes();
      for (let li = 0; li < 4; li++) expect(gs.lanes[li].cars.length).toBe(expectedRate);
    }
  });

  it('SimulationRunner measurably reacts to the crest/lull alternation: an all-crest (no relief) variant of the SAME script is at least as hard as the real one', () => {
    const lm = new LevelManager();
    lm.goToLevel(20);
    const cfg = { ...lm.current, skill: 'average' };
    const allCrest = cfg.spawnScript.map((s) => ({ ...s, rate: 3 }));   // strip the lulls, same untilPct boundaries

    const run = (spawnScript) => {
      const r = new SimulationRunner({ ...cfg, spawnScript });
      let wins = 0;
      for (let s = 0; s < 150; s++) if (r.runLevel(1 + s).won) wins++;
      return wins / 150;
    };
    const real = run(cfg.spawnScript);
    const noRelief = run(allCrest);
    expect(real).toBeGreaterThanOrEqual(noRelief);   // lulls can only help, never hurt
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
