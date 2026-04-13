// GameLoop — fixed-timestep logic driver.
// Adds its own PixiJS ticker listener for deterministic game logic at 60fps.
// The render ticker in GameApp runs separately at display refresh rate.
//
// Public API:
//   deploy(colIdx, laneIdx) — called by DragDrop; resolves combat immediately
//   restart()               — full level reset + reprime; called by screens
import { PHASE_CONFIG } from '../director/DirectorConfig.js';

const FIXED_DT = 1 / 60; // logic step in seconds

// Fire duration in seconds per shooter damage value — further reduced for faster combat.
const FIRE_DURATIONS = { 2: 0.7, 3: 0.85, 4: 0.9, 5: 1.0, 6: 1.05, 7: 1.1, 8: 1.2 };

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
  //   boosterState               — optional BoosterState; cars freeze when isFrozen()
  //   benchStorage               — optional BenchStorage; included in viability checks (L6+)
  constructor({ app, gameState, carDir, shooterDir, combatResolver, rng,
                onKill, onChainHit, onShoot, onHit, onMiss, onEnd,
                boosterState = null, benchStorage = null }) {
    this._app          = app;
    this._gs           = gameState;
    this._carDir       = carDir;
    this._sDir         = shooterDir;
    this._combat       = combatResolver;
    this._rng          = rng;
    this._boosterState = boosterState;
    this._benchStorage = benchStorage;
    this._onKill   = onKill     ?? (() => {});
    this._onChain  = onChainHit ?? (() => {});
    this._onShoot  = onShoot    ?? (() => {});
    this._onHit    = onHit      ?? (() => {});
    this._onMiss   = onMiss     ?? (() => {});
    this._onEnd    = onEnd      ?? (() => {});

    // Base level duration — used to reset gs.duration on restart.
    this._baseDuration = gameState.duration;

    this._accumulator = 0;
    this._paused      = false;
    this._bound       = this._tick.bind(this);
  }

  start()  { this._app.ticker.add(this._bound); }
  stop()   { this._app.ticker.remove(this._bound); }
  pause()  { this._paused = true; }
  resume() { this._paused = false; }
  get paused() { return this._paused; }

  // Update the base duration used by restart() to reset gs.duration.
  // Call this before restart() when changing levels.
  set baseDuration(d) { this._baseDuration = d; }

  // Called by DragDrop → onDeploy (column source).
  deploy(colIdx, laneIdx) {
    const col     = this._gs.columns[colIdx];
    const shooter = col.top();
    if (!shooter) return;
    // Slot occupancy is enforced by DragDrop; guard here defensively.
    if (this._gs.firingSlots[laneIdx]) return;
    col.consume();
    this._startFiring(shooter, laneIdx, colIdx);
  }

  // Called by DragDrop → onDeployFromBench (bench source).
  // Shooter is already extracted from BenchStorage by DragDrop.
  deployFromBench(shooter, laneIdx) {
    if (this._gs.firingSlots[laneIdx]) return;
    this._gs.benchUsed++;
    this._startFiring(shooter, laneIdx, -1);
  }

  // Phase 1 — immediate effects: place shooter in the firing slot, trigger
  // audio/animation callbacks, and start time dilation.  Combat resolves later.
  // colIdx === -1 means the shooter came from the bench (no punch animation).
  _startFiring(shooter, laneIdx, colIdx) {
    const gs       = this._gs;
    const duration = FIRE_DURATIONS[shooter.damage] ?? 2.0;
    gs.firingSlots[laneIdx] = { shooter, colIdx, timeLeft: duration };
    this._onShoot(shooter.damage, laneIdx, colIdx);
    gs.triggerDilation();
  }

  // Phase 2 — delayed combat resolution once the fire duration elapses.
  // Called from _step() when firingSlots[laneIdx].timeLeft reaches 0.
  _resolveShot(shooter, laneIdx) {
    const gs       = this._gs;
    const lane     = gs.lanes[laneIdx];
    const frontCar = lane.frontCar();

    // Nothing to shoot at — slot clears silently.
    if (!frontCar) return;

    const carGameX = frontCar.position;
    gs.recordDeploy(shooter.color === frontCar.color);

    const { kills, carryOverKills, damageDealt } = this._combat.resolve(shooter, lane);

    if (damageDealt === 0) {
      this._onMiss(laneIdx, carGameX);
      return;
    }

    this._onHit(laneIdx, carGameX, shooter.color, damageDealt, kills > 0);

    if (kills === 0) return;

    if (carryOverKills > 0) this._onChain(laneIdx);

    for (let i = 0; i < kills; i++) {
      const isCarryOver = i > 0;
      const combo = gs.recordKill(isCarryOver);
      this._onKill(combo);
    }
  }

  // Full level restart — resets state and reprimes cars/columns.
  // Before calling, update gs.activeLaneCount/activeColCount/world/colors if
  // the level config changed (e.g. on level advancement).
  restart() {
    const gs = this._gs;
    gs.duration = this._baseDuration;   // undo any rescue-added time
    gs.resetLevel();
    gs.phaseMan.update(0);
    this._accumulator = 0;
    this._primeInitialCars();
    this._sDir.fillColumns(gs.activeCols, gs.asDirectorState(), gs.phaseMan.getParams());
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _tick(ticker) {
    if (this._paused || this._gs.isOver) return;

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
    const isFrozen    = this._boosterState?.isFrozen(gs.elapsed) ?? false;

    if (!isFrozen) {
      // 1. Advance cars — apply deploy time dilation if active.
      for (const lane of gs.activeLanes) lane.advance(dt * gs.speedMultiplier);

      // 2. Track the highest car position reached (used for star rating on win).
      for (const lane of gs.activeLanes) {
        const front = lane.frontCar();
        if (front && front.position > gs.maxCarPosition) {
          gs.maxCarPosition = front.position;
        }
      }

      // 3. Check for breach — any car reaching the endpoint is a loss.
      for (let li = 0; li < gs.activeLaneCount; li++) {
        if (gs.lanes[li].frontCar()?.position >= 100) {
          gs.endGame(false);
          this._onEnd(false, li);
          return;
        }
      }

      // 4. Spawn new cars.
      this._carDir.updateSpawnTimers(gs.activeLanes, dt, phaseCfg);
      for (const lane of gs.activeLanes) {
        if (this._carDir.isReadyToSpawn(lane)) {
          lane.addCar(this._carDir.generateCar(lane, gs.phase, gs.world, gs.colors));
          this._carDir.resetSpawnTimer(lane, phaseCfg);
        }
      }
    }

    // 5. Refill active shooter columns.
    this._sDir.fillColumns(gs.activeCols, dirState, phaseParams);

    // 6. Viability guard: ensure the player always has at least one valid move.
    //    Checks column tops + bench (when unlocked) against front car colors.
    //    If no overlap, forces a column top to match a front car color.
    this._enforceViableMove(gs);

    // 7. Tick firing slots — resolve shots after the per-damage fire duration.
    for (let i = 0; i < gs.activeLaneCount; i++) {
      const slot = gs.firingSlots[i];
      if (!slot) continue;
      slot.timeLeft -= dt;
      if (slot.timeLeft <= 0) {
        const { shooter } = slot;
        gs.firingSlots[i] = null;
        this._resolveShot(shooter, i);
        if (gs.isOver) return;   // breach may occur during resolution
      }
    }
  }

  // After a rescue, force at least 2 column tops to match a front car color,
  // giving the player a real fighting chance with the extra time.
  shuffleForRescue() {
    const gs = this._gs;
    const frontColors = [];
    for (const lane of gs.activeLanes) {
      const fc = lane.frontCar();
      if (fc) frontColors.push(fc.color);
    }
    if (frontColors.length === 0) return;

    // Count how many column tops already match a front car color.
    const activeCols = gs.activeCols;
    let matchesNeeded = 2 - activeCols.filter(col => {
      const top = col.top();
      return top && frontColors.includes(top.color);
    }).length;

    // Re-color non-matching tops until we have 2 matches.
    let colorIdx = 0;
    for (const col of activeCols) {
      if (matchesNeeded <= 0) break;
      const top = col.top();
      if (!top || frontColors.includes(top.color)) continue;
      top.color = frontColors[colorIdx % frontColors.length];
      colorIdx++;
      matchesNeeded--;
    }
  }

  // Guarantee the player always has at least one viable move:
  // at least one source (column top or bench slot) must color-match a front car.
  // If not, force-recolor the first available column top to a matching color.
  _enforceViableMove(gs) {
    // Collect front car colors.
    const frontColors = new Set();
    for (const lane of gs.activeLanes) {
      const fc = lane.frontCar();
      if (fc) frontColors.add(fc.color);
    }
    if (frontColors.size === 0) return; // no cars yet — nothing to enforce

    // Check column tops.
    for (const col of gs.activeCols) {
      if (frontColors.has(col.top()?.color)) return;
    }
    // Check bench slots (if bench is in play).
    if (this._benchStorage) {
      for (let i = 0; i < this._benchStorage.size; i++) {
        if (frontColors.has(this._benchStorage.getSlot(i)?.color)) return;
      }
    }

    // No viable move — force-recolor the first non-empty column top.
    const target = [...frontColors][0];
    for (const col of gs.activeCols) {
      if (col.top()) {
        col.top().color = target;
        return;
      }
    }
  }

  // Stagger initial cars so the level looks alive from frame 1.
  // Only primes active lanes so inactive lanes stay empty.
  _primeInitialCars() {
    const gs      = this._gs;
    const calmCfg = PHASE_CONFIG['CALM'];
    for (const lane of gs.activeLanes) {
      const car     = this._carDir.generateCar(lane, 'CALM', gs.world, gs.colors);
      car.position  = this._rng.nextFloat(8, 50);
      lane.addCar(car);
      this._carDir.resetSpawnTimer(lane, calmCfg);
    }
  }
}
