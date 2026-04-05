// GameLoop — fixed-timestep logic driver.
// Adds its own PixiJS ticker listener for deterministic game logic at 60fps.
// The render ticker in GameApp runs separately at display refresh rate.
//
// Exposes deploy(colIdx, laneIdx) — called by the onDeploy callback wired
// through DragDrop.  Combat and state updates all live here.
import { PHASE_CONFIG } from '../director/DirectorConfig.js';

const FIXED_DT = 1 / 60; // logic step in seconds

export class GameLoop {
  // opts:
  //   app            — PixiJS Application
  //   gameState      — GameState
  //   carDir         — CarDirector
  //   shooterDir     — ShooterDirector
  //   combatResolver — CombatResolver
  //   rng            — SeededRandom (shared with directors)
  //   onKill(combo)      — called after each kill with updated combo count
  //   onChainHit(laneIdx)— called when a carry-over kill occurs
  constructor({ app, gameState, carDir, shooterDir, combatResolver, rng, onKill, onChainHit, onEnd }) {
    this._app      = app;
    this._gs       = gameState;
    this._carDir   = carDir;
    this._sDir     = shooterDir;
    this._combat   = combatResolver;
    this._rng      = rng;
    this._onKill   = onKill   ?? (() => {});
    this._onChain  = onChainHit ?? (() => {});
    this._onEnd    = onEnd    ?? (() => {});

    this._accumulator = 0;
    this._bound       = this._tick.bind(this);
  }

  start() { this._app.ticker.add(this._bound); }
  stop()  { this._app.ticker.remove(this._bound); }

  // Called by DragDrop → onDeploy.
  // Applies combat immediately, then triggers dilation and callbacks.
  deploy(colIdx, laneIdx) {
    const gs      = this._gs;
    const col     = gs.columns[colIdx];
    const lane    = gs.lanes[laneIdx];
    const shooter = col.top();
    if (!shooter) return;

    // Consume the shooter before resolving so the column starts refilling.
    col.consume();

    const { kills, carryOverKills } = this._combat.resolve(shooter, lane);

    // Deploy time dilation — cars slow briefly on every deploy regardless of hit.
    gs.triggerDilation();

    if (kills === 0) return;

    // Fire onChainHit before onKill so the overlay appears with the kill count.
    if (carryOverKills > 0) this._onChain(laneIdx);

    for (let i = 0; i < kills; i++) {
      const isCarryOver = i > 0;
      const combo = gs.recordKill(isCarryOver);
      this._onKill(combo);
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _tick(ticker) {
    if (this._gs.isOver) return;

    const frameDt     = Math.min(ticker.deltaMS / 1000, 0.05);
    this._accumulator += frameDt;

    while (this._accumulator >= FIXED_DT) {
      this._step(FIXED_DT);
      this._accumulator -= FIXED_DT;
      if (this._gs.isOver) break;
    }

    // Expire combo if the kill window closed.
    if (!this._gs.isOver && this._gs.isComboExpired()) {
      this._gs.resetCombo();
      this._onKill(0);  // notify renderer to clear combo display
    }
  }

  _step(dt) {
    const gs = this._gs;
    gs.elapsed += dt;

    // Win: timer reached zero.
    if (gs.elapsed >= gs.duration) {
      gs.endGame(true);
      this._onEnd(true);
      return;
    }

    gs.phaseMan.update(gs.elapsed);
    const phaseCfg    = PHASE_CONFIG[gs.phase];
    const phaseParams = gs.phaseMan.getParams();
    const dirState    = gs.asDirectorState();

    // 1. Advance cars — apply deploy time dilation if active.
    for (const lane of gs.lanes) lane.advance(dt * gs.speedMultiplier);

    // 2. Check for breach — any car reaching the endpoint is a loss.
    for (const lane of gs.lanes) {
      if (lane.frontCar()?.position >= 100) {
        gs.endGame(false);
        this._onEnd(false);
        return;
      }
    }

    // 3. Spawn new cars.
    this._carDir.updateSpawnTimers(gs.lanes, dt, phaseCfg);
    for (const lane of gs.lanes) {
      if (this._carDir.isReadyToSpawn(lane)) {
        lane.addCar(this._carDir.generateCar(lane, gs.phase, gs.world, gs.colors));
        this._carDir.resetSpawnTimer(lane, phaseCfg);
      }
    }

    // 4. Refill shooter columns.
    this._sDir.fillColumns(gs.columns, dirState, phaseParams);
  }

  _resetLevel() {
    const gs      = this._gs;
    gs.elapsed    = 0;
    gs.combo      = 0;
    gs.lastKillTime = -Infinity;
    for (const lane of gs.lanes)   lane.cars.length = 0;
    for (const col  of gs.columns) col.shooters.length = 0;
    this._primeInitialCars();
  }

  // Stagger initial cars so the level looks alive from frame 1.
  _primeInitialCars() {
    const gs      = this._gs;
    const calmCfg = PHASE_CONFIG['CALM'];
    for (const lane of gs.lanes) {
      const car     = this._carDir.generateCar(lane, 'CALM', gs.world, gs.colors);
      car.position  = this._rng.nextFloat(8, 50);
      lane.addCar(car);
      this._carDir.resetSpawnTimer(lane, calmCfg);
    }
  }
}
