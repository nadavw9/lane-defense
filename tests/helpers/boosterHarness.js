// Headless harness: the REAL GameLoop, built the way GameApp builds it for a level,
// plus a seeded "player" that drives shots and boosters through the same public
// entry points the UI uses (deploy, deployFromBench, placeBombOnLane, activateFreeze,
// applyColorChange). Used by booster-matrix.test.js.
import { vi } from 'vitest';
import { GameLoop }        from '../../src/game/GameLoop.js';
import { GameState }       from '../../src/game/GameState.js';
import { CombatResolver }  from '../../src/game/CombatResolver.js';
import { BoosterState }    from '../../src/game/BoosterState.js';
import { BenchStorage }    from '../../src/game/BenchStorage.js';
import { CarDirector }     from '../../src/director/CarDirector.js';
import { ShooterDirector } from '../../src/director/ShooterDirector.js';
import { FairnessArbiter } from '../../src/director/FairnessArbiter.js';
import { IntensityPhase }  from '../../src/director/IntensityPhase.js';
import { SeededRandom }    from '../../src/utils/SeededRandom.js';
import { Lane }            from '../../src/models/Lane.js';
import { Column }          from '../../src/models/Column.js';
import { applyDda }        from '../../src/game/dda.js';
import { LevelManager, openingRowsForLevel, clampInitialCarsToDepth, streakEnabledFor } from '../../src/game/LevelManager.js';

export const DT = 1 / 60;

export function levelCfg(id, overrides = {}) {
  const lm = new LevelManager();
  lm.goToLevel(id);
  return { ...lm.current, ...overrides };
}

// Mirrors GameApp.applyLevelConfig + _startLevel (booster reset) without Pixi/Three.
export function buildGame(cfg, { seed = 1, bombs = 0, freeze = 0, colorChange = 0 } = {}) {
  const rng = new SeededRandom(seed);
  const lanes   = Array.from({ length: 4 }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns, colors: cfg.colors, world: cfg.worldConfig, duration: cfg.duration,
    phaseMan: new IntensityPhase(cfg.duration), laneCount: cfg.laneCount, colCount: cfg.colCount,
  });
  const carDir = new CarDirector({}, rng);
  const shooterDir = new ShooterDirector({}, rng, new FairnessArbiter());
  const bs = new BoosterState();
  const bench = new BenchStorage();
  const loop = new GameLoop({
    app: { ticker: { add: vi.fn(), remove: vi.fn() } },
    gameState: gs, carDir, shooterDir, combatResolver: new CombatResolver(), rng,
    boosterState: bs, benchStorage: bench,
  });
  const events = { end: [], kills: 0, bombExplode: 0 };
  loop._onEnd = (won) => { events.end.push(won); };
  const origKill = loop._onKill; loop._onKill = (c) => { events.kills++; origKill?.call(loop, c); };
  loop._onBombExplode = () => { events.bombExplode++; };

  gs.activeLaneCount = cfg.laneCount; gs.activeColCount = cfg.colCount;
  gs.colors = cfg.colors; gs.world = applyDda(cfg.worldConfig, 0);
  gs.phaseMan = new IntensityPhase(cfg.duration); loop.baseDuration = cfg.duration;
  gs.targetKills = cfg.targetKills ?? Math.max(5, Math.round((cfg.duration ?? 60) * 0.12));
  gs.gridRows = cfg.gridRows ?? 10; gs.stepsPerRow = cfg.stepsPerRow ?? 1;
  gs.initialCars = clampInitialCarsToDepth(cfg.initialCars ?? null, gs.gridRows);
  gs.openingRows = openingRowsForLevel(cfg.id, gs.gridRows);
  gs.spawnBudget = cfg.spawnBudget ?? null; gs._initialSpawnBudget = cfg.spawnBudget ?? null;
  gs.laneTargetCarCount = cfg.laneTargetCarCount ?? 2;
  gs.goals = cfg.goals ?? []; gs._initialGoals = cfg.goals ? JSON.parse(JSON.stringify(cfg.goals)) : [];
  gs.goalProgress = gs.goals.map(g => g.count);
  carDir.setLevel(typeof cfg.id === 'number' ? cfg.id : 1);
  carDir.setSpawnScript(cfg.spawnScript ?? null);
  carDir.setTraits(cfg.traits ?? null, cfg.colors);
  gs.streakEnabled = streakEnabledFor(cfg);
  shooterDir.setColorBias(cfg.shooterColorWeights ?? null);
  gs.levelId = typeof cfg.id === 'number' ? cfg.id : 99;

  bs.colorChange = colorChange; bs.freeze = freeze; bs.bombs = bombs;
  loop.restart();
  return { loop, gs, bs, bench, rng, events, cfg };
}

export const shotInFlight = (loop) => loop._shotInFlight();

// Run logic steps until every shot has landed and resolved (or the game ends).
export function settle(loop, gs, maxSteps = 1200) {
  for (let i = 0; i < maxSteps; i++) {
    if (gs.isOver || !loop._shotInFlight()) { return true; }
    loop._step(DT);
  }
  return false;   // never resolved — itself a finding
}

// One idle tick, as the ticker would run between player actions.
export const tick = (loop, n = 1) => { for (let i = 0; i < n; i++) loop._step(DT); };

export function frontColors(gs) {
  const s = new Set();
  for (const l of gs.activeLanes) { const f = l.frontCar(); if (f) s.add(f.color); }
  return s;
}

// A matching source: column top, bench slot or rainbow.
export function findMatch(gs, bench) {
  for (let li = 0; li < gs.activeLaneCount; li++) {
    const f = gs.lanes[li].frontCar(); if (!f) continue;
    for (let ci = 0; ci < gs.activeColCount; ci++) {
      const t = gs.columns[ci].top();
      if (t && (t.isColorBomb || t.color === f.color)) return { src: 'col', ci, li };
    }
    for (let bi = 0; bi < bench.size; bi++) {
      const s = bench.getSlot(bi);
      if (s && s.color === f.color) return { src: 'bench', bi, li };
    }
  }
  return null;
}

// Board invariants. Returns an array of violation strings (empty = healthy).
export function checkInvariants(h, tag = '') {
  const { gs, bs, bench } = h; const bad = [];
  const rows = gs.gridRows;
  for (let li = 0; li < 4; li++) {
    const cars = gs.lanes[li].cars;
    if (li >= gs.activeLaneCount && cars.length) bad.push(`${tag} inactive lane ${li} holds ${cars.length} cars`);
    const seen = new Set();
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      if (!Number.isFinite(c.row) || c.row < 0) bad.push(`${tag} lane ${li} car bad row ${c.row}`);
      if (!gs.isOver && c.row > rows - 1) bad.push(`${tag} lane ${li} car past breach row ${c.row} while running`);
      if (seen.has(c.row)) bad.push(`${tag} lane ${li} two cars share row ${c.row}`);
      seen.add(c.row);
      if (i > 0 && cars[i - 1].row < c.row) bad.push(`${tag} lane ${li} not front-first (${cars[i-1].row} before ${c.row})`);
      if (!(c.hp > 0)) bad.push(`${tag} lane ${li} car hp ${c.hp}`);
      if (!gs.colors.includes(c.color)) bad.push(`${tag} lane ${li} car colour ${c.color} not in level palette`);
    }
  }
  if (bs.bombs < 0 || bs.bombs > bs.bombsMax) bad.push(`${tag} bombs ${bs.bombs} outside 0..${bs.bombsMax}`);
  if (bs.freeze < 0 || bs.colorChange < 0) bad.push(`${tag} negative booster count`);
  if (bs.freezeShots < 0 || bs.freezeShots > 1) bad.push(`${tag} freezeShots ${bs.freezeShots}`);
  if (gs.goalProgress.some(g => g < 0)) bad.push(`${tag} negative goal progress ${gs.goalProgress}`);
  if (gs.isOver && gs.won && gs.goals.length && !gs.isGoalMet()) bad.push(`${tag} won with goals unmet ${gs.goalProgress}`);
  if (gs.isOver && !gs.won && gs.goals.length && gs.isGoalMet()) bad.push(`${tag} LOST although goals met`);
  if (!gs.isOver) {
    if (gs.goals.length && gs.isGoalMet()) bad.push(`${tag} goals met but level still running`);
    const total = gs.activeLanes.reduce((n, l) => n + l.cars.length, 0);
    if (total === 0) bad.push(`${tag} empty road while running`);
    const visible = gs.activeLanes.reduce((n, l) => n + l.cars.filter(c => c.row >= 1).length, 0);
    if (visible === 0) bad.push(`${tag} no visible car (all hidden at row 0) while running`);
  }
  return bad;
}

// Seeded player. Each call performs ONE action then settles. Returns a label.
export function playOne(h, rng, mix = {}) {
  const { loop, gs, bs, bench } = h;
  const m = { deploy: 55, wrong: 6, bomb: 10, freeze: 7, colour: 7, bench: 6, edge: 9, neglect: 0, ...mix };
  const roll = rng.nextFloat(0, 1) * Object.values(m).reduce((a, b) => a + b, 0);
  let acc = 0; let kind = 'deploy';
  for (const [k, v] of Object.entries(m)) { acc += v; if (roll < acc) { kind = k; break; } }
  const pick = (n) => Math.floor(rng.nextFloat(0, 1) * n);
  const aliveLanes = () => gs.activeLanes.map((l, i) => l.cars.length ? i : -1).filter(i => i >= 0);

  if (kind === 'bomb') {
    if (bs.bombs <= 0) bs.bombs = 1 + pick(3);
    bs.activateBomb();
    const lanes = aliveLanes(); const li = lanes[pick(lanes.length)] ?? 0;
    loop.placeBombOnLane(li, pick(gs.gridRows));
    bs.cancelBomb();
  } else if (kind === 'freeze') {
    if (bs.freeze <= 0) bs.freeze = 1;
    if (!bs.isFrozen()) bs.activateFreeze();          // GameApp refuses a second freeze
  } else if (kind === 'colour') {
    if (bs.colorChange <= 0) bs.colorChange = 1;
    const present = [...new Set(gs.activeLanes.flatMap(l => l.cars.map(c => c.color)))];
    const from = present[pick(present.length)];
    const to = gs.colors[pick(gs.colors.length)];
    if (bs.activateColorChange() && from) { bs.setColorChangeCar(from); loop.applyColorChange(from, to); }
    bs.cancelColorChange();
  } else if (kind === 'bench') {
    const ci = pick(gs.activeColCount); const t = gs.columns[ci].top();
    if (t && !bench.isFull && !t.isColorBomb && !loop._shotInFlight()) { gs.columns[ci].consume(); bench.store(t); }
  } else if (kind === 'wrong') {
    const li = pick(gs.activeLaneCount); const ci = pick(gs.activeColCount);
    loop.deploy(ci, li);
  } else if (kind === 'edge') {
    // Hostile inputs the UI can produce: lane out of range / empty lane / shot in flight / spent bomb.
    const e = pick(4);
    if (e === 0) { bs.bombs = Math.max(bs.bombs, 1); bs.activateBomb(); loop.placeBombOnLane(gs.activeLaneCount + pick(2), 3); bs.cancelBomb(); }
    else if (e === 1) { bs.bombs = Math.max(bs.bombs, 1); bs.activateBomb(); loop.placeBombOnLane(-1, 0); bs.cancelBomb(); }
    else if (e === 2) {
      const m2 = findMatch(gs, bench);
      if (m2 && m2.src === 'col') {
        loop.deploy(m2.ci, m2.li);
        const before = bs.bombs; bs.bombs = Math.max(bs.bombs, 1); const b0 = bs.bombs; bs.activateBomb();
        loop.placeBombOnLane(m2.li, 2);                 // shot in flight → must be refused untouched
        if (bs.bombs !== b0) h.violations.push(`bomb consumed while shot in flight (${b0}->${bs.bombs})`);
        bs.cancelBomb(); bs.bombs = before;
      }
    } else { loop.applyColorChange(gs.colors[0], gs.colors[0]); loop.applyColorChange('Nope', gs.colors[0]); }
  } else if (kind === 'neglect') {
    // Deliberately bad play: shoot only the LEAST threatened matching lane, so the front
    // lane marches into the breach. Forces the LOSS path (and rescue) to be exercised.
    let best = null;
    for (let li = 0; li < gs.activeLaneCount; li++) {
      const f = gs.lanes[li].frontCar(); if (!f) continue;
      for (let ci = 0; ci < gs.activeColCount; ci++) {
        const t = gs.columns[ci].top();
        if (t && (t.isColorBomb || t.color === f.color) && (!best || f.row < best.row)) best = { ci, li, row: f.row };
      }
    }
    if (best) loop.deploy(best.ci, best.li); else loop.deploy(pick(gs.activeColCount), pick(gs.activeLaneCount));
  } else {
    const m2 = findMatch(gs, bench);
    if (m2?.src === 'col') loop.deploy(m2.ci, m2.li);
    else if (m2?.src === 'bench') { const s = bench.take(m2.bi); if (!loop.deployFromBench(s, m2.li)) bench.store(s); }
    else { loop.deploy(pick(gs.activeColCount), pick(gs.activeLaneCount)); kind = 'deploy-nomatch'; }
  }
  const ok = settle(loop, gs);
  if (!ok) h.violations.push(`shot never resolved after ${kind}`);
  tick(loop, 2);
  return kind;
}

// Play until the level ends or the action budget runs out. Returns a summary.
export function playOut(h, { actions = 400, mix = {}, playSeed = 7, rescue = false } = {}) {
  const rng = new SeededRandom(playSeed);
  h.violations = h.violations ?? [];
  const log = [];
  let noProgress = 0, lastTurn = h.gs.turnCount, lastKills = h.gs.totalKills;
  let rescued = 0;
  for (let a = 0; a < actions; a++) {
    if (h.gs.isOver) {
      if (rescue && !h.gs.won && !h.gs.rescueUsed) {          // same steps as GameApp.resumeAfterRescue
        h.gs.rescue(10); h.loop.prepareForRescue(); h.loop.resume(); rescued++;
        for (const v of checkInvariants(h, 'post-rescue')) h.violations.push(v);
        const mi = h.gs.isOver; if (mi) h.violations.push('still over after rescue');
        continue;
      }
      break;
    }
    const kind = playOne(h, rng, mix); log.push(kind);
    for (const v of checkInvariants(h, `a${a}:${kind}`)) h.violations.push(v);
    if (h.violations.length > 12) break;
    if (h.gs.turnCount === lastTurn && h.gs.totalKills === lastKills) noProgress++; else noProgress = 0;
    lastTurn = h.gs.turnCount; lastKills = h.gs.totalKills;
    if (noProgress > 40) { h.violations.push(`no progress for 40 actions (log tail ${log.slice(-6)})`); break; }
  }
  return { over: h.gs.isOver, won: h.gs.won, actions: log.length, log, rescued };
}
