// GameLoop — fixed-timestep logic driver.
// Adds its own PixiJS ticker listener for deterministic game logic at 60fps.
// The render ticker in GameApp runs separately at display refresh rate.
//
// Public API:
//   deploy(colIdx, laneIdx) — called by DragDrop; resolves combat immediately
//   restart()               — full level reset + reprime; called by screens
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
  //   onKill(combo)              — called after each kill with updated combo
  //   onChainHit(laneIdx)        — called when a carry-over kill occurs
  //   onShoot(damage)            — fires on every deploy (before hit/miss check)
  //   onHit(laneIdx,gameX,color,damage,isKill) — every shot that deals damage
  //   onMiss(laneIdx,gameX)      — color-mismatch shot (0 damage)
  //   onEnd(won, laneIdx?)       — win or lose; laneIdx provided on breach
  constructor({ app, gameState, carDir, shooterDir, combatResolver, rng,
                onKill, onChainHit, onShoot, onHit, onMiss, onEnd }) {
    this._app      = app;
    this._gs       = gameState;
    this._carDir   = carDir;
    this._sDir     = shooterDir;
    this._combat   = combatResolver;
    this._rng      = rng;
    this._onKill   = onKill     ?? (() => {});
    this._onChain  = onChainHit ?? (() => {});
    this._onShoot  = onShoot    ?? (() => {});
    this._onHit    = onHit      ?? (() => {});
    this._onMiss   = onMiss     ?? (() => {});
    this._onEnd    = onEnd      ?? (() => {});

    // Base level duration — used to reset gs.duration on restart.
    this._baseDuration = gameState.duration;

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

    // Capture front car position BEFORE combat removes cars.
    const frontCar = lane.frontCar();
    const carGameX = frontCar?.position ?? 50;

    // Consume the shooter before resolving so the column starts refilling.
    col.consume();

    // Notify audio of the deploy (fires before we know if it's a hit or miss,
    // so the shoot sound always plays regardless of color match).
    this._onShoot(shooter.damage);

    // Deploy time dilation — cars slow briefly on every deploy regardless of hit.
    gs.triggerDilation();

    // Nothing to shoot at — consume silently.
    if (!frontCar) return;

    const { kills, carryOverKills, damageDealt } = this._combat.resolve(shooter, lane);

    if (damageDealt === 0) {
      // Color mismatch — grey dud puff.
      this._onMiss(laneIdx, carGameX);
      return;
    }

    // Damage was dealt: sparks + damage number on the first car.
    this._onHit(laneIdx, carGameX, shooter.color, damageDealt, kills > 0);

    if (kills === 0) return;

    // Fire onChainHit before onKill so the overlay appears with the kill count.
    if (carryOverKills > 0) this._onChain(laneIdx);

    for (let i = 0; i < kills; i++) {
      const isCarryOver = i > 0;
      const combo = gs.recordKill(isCarryOver);
      this._onKill(combo);
    }
  }

  // Full level restart — resets state and reprimes cars/columns.
  restart() {
    const gs = this._gs;
    gs.duration = this._baseDuration;   // undo any rescue-added time
    gs.resetLevel();
    gs.phaseMan.update(0);
    this._accumulator = 0;
    this._primeInitialCars();
    this._sDir.fillColumns(gs.columns, gs.asDirectorState(), gs.phaseMan.getParams());
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

    // 2. Track the highest car position reached (used for star rating on win).
    for (const lane of gs.lanes) {
      const front = lane.frontCar();
      if (front && front.position > gs.maxCarPosition) {
        gs.maxCarPosition = front.position;
      }
    }

    // 3. Check for breach — any car reaching the endpoint is a loss.
    for (let li = 0; li < gs.lanes.length; li++) {
      if (gs.lanes[li].frontCar()?.position >= 100) {
        gs.endGame(false);
        this._onEnd(false, li);
        return;
      }
    }

    // 4. Spawn new cars.
    this._carDir.updateSpawnTimers(gs.lanes, dt, phaseCfg);
    for (const lane of gs.lanes) {
      if (this._carDir.isReadyToSpawn(lane)) {
        lane.addCar(this._carDir.generateCar(lane, gs.phase, gs.world, gs.colors));
        this._carDir.resetSpawnTimer(lane, phaseCfg);
      }
    }

    // 5. Refill shooter columns.
    this._sDir.fillColumns(gs.columns, dirState, phaseParams);
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
