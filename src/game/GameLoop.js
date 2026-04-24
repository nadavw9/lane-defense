// GameLoop — fixed-timestep logic driver.
// Adds its own PixiJS ticker listener for deterministic game logic at 60fps.
// The render ticker in GameApp runs separately at display refresh rate.
//
// Public API:
//   deploy(colIdx, laneIdx) — called by DragDrop; resolves combat immediately
//   restart()               — full level reset + reprime; called by screens
import { PHASE_CONFIG } from '../director/DirectorConfig.js';

const KILLS_PER_BOMB      = 10;    // kills needed to earn one bomb charge
const BOMB_MAX_CHARGES    = 3;     // max bombs a player can hold
const BOMB_DAMAGE         = 8;     // HP damage dealt per car in blast zone
const BOMB_POS_RADIUS     = 22;    // blast radius in road-position units (0-100 scale)
const BOMB_FREEZE_DURATION = 2.0;  // seconds all cars are frozen after bomb detonation

const FIXED_DT = 1 / 60; // logic step in seconds

// Time in seconds for the single projectile to reach the car before damage lands.
// Short enough to feel instant; long enough for the visual to register.
const SHOT_TRAVEL_TIME = 0.12;

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
                onKill, onChainHit, onShoot, onHit, onMiss, onEnd, onCrisis,
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
    this._onCrisis      = onCrisis      ?? (() => {});
    this._onBombEarned  = null;  // set by GameApp after construction
    this._onBombExplode = null;  // set by GameApp after construction

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
    // Turn-based: block new deploy if any shot is still in flight.
    if (Object.values(this._gs.firingSlots).some(s => s !== null)) return;
    if (this._gs.firingSlots[laneIdx]) return;
    col.consume();
    this._sDir.recordDeploy(this._gs.elapsed);
    this._startFiring(shooter, laneIdx, colIdx);
  }

  // Called by DragDrop → onDeployFromBench (bench source).
  // Shooter is already extracted from BenchStorage by DragDrop.
  deployFromBench(shooter, laneIdx) {
    if (this._gs.firingSlots[laneIdx]) return;
    this._gs.benchUsed++;
    this._sDir.recordDeploy(this._gs.elapsed);
    this._startFiring(shooter, laneIdx, -1);
  }

  // Called by GameApp when the player taps the road during bomb placement mode.
  // bombPos: 0-100 road-position units (0 = far end, 100 = breach line).
  placeBomb(bombPos) {
    const gs = this._gs;
    const bs = this._boosterState;
    if (!bs?.consumeBomb()) return;

    // Damage all cars within BOMB_POS_RADIUS position units of the tap.
    const killed = [];
    for (let li = 0; li < gs.activeLaneCount; li++) {
      for (const car of gs.lanes[li].cars) {
        if (Math.abs(car.position - bombPos) <= BOMB_POS_RADIUS) {
          car.hp -= BOMB_DAMAGE;
          if (car.hp <= 0) killed.push({ car, lane: gs.lanes[li] });
        }
      }
    }

    // Register kills (in order, no carry-over between bomb kills).
    for (const { car, lane } of killed) {
      const idx = lane.cars.indexOf(car);
      if (idx >= 0) lane.cars.splice(idx, 1);
      const combo = gs.recordKill(false);
      this._onKill(combo);
      // Bomb kills also contribute toward the next bomb charge.
      if (bs && gs.killsTowardBomb % KILLS_PER_BOMB === 0 && bs.bombs < BOMB_MAX_CHARGES) {
        bs.bombs++;
        this._onBombEarned?.();
      }
    }

    // Concussion freeze: briefly stop all cars (separate from FREEZE booster).
    gs.bombFreezeUntil = gs.elapsed + BOMB_FREEZE_DURATION;

    this._onBombExplode?.(bombPos, killed.length);
  }

  // Place shooter in the firing slot for one short travel window, trigger
  // audio/animation callbacks, and start time dilation.  Combat resolves once
  // the single projectile travel time elapses.
  // Travel time is shortened by comboFireMultiplier so high-combo streaks
  // feel snappier — at 2× the shot resolves in 0.06 s instead of 0.12 s.
  // colIdx === -1 means the shooter came from the bench (no punch animation).
  _startFiring(shooter, laneIdx, colIdx) {
    const gs         = this._gs;
    const travelTime = SHOT_TRAVEL_TIME / (gs.comboFireMultiplier ?? 1.0);
    gs.firingSlots[laneIdx] = { shooter, colIdx, timeLeft: travelTime };
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
      // Turn-based: even a miss (wrong colour) advances the grid.
      if (!gs.isOver) this._advanceGrid();
      return;
    }

    this._onHit(laneIdx, carGameX, shooter.color, damageDealt, kills > 0);

    if (kills === 0) return;

    if (carryOverKills > 0) this._onChain(laneIdx);

    for (let i = 0; i < kills; i++) {
      const isCarryOver = i > 0;
      const combo = gs.recordKill(isCarryOver);
      this._onKill(combo);
      // Award bomb charge every KILLS_PER_BOMB kills.
      const bs = this._boosterState;
      if (bs && gs.killsTowardBomb % KILLS_PER_BOMB === 0 && bs.bombs < BOMB_MAX_CHARGES) {
        bs.bombs++;
        this._onBombEarned?.();
      }
    }

    // Turn-based: after every shot resolves, advance the entire grid one step.
    if (!gs.isOver) this._advanceGrid();
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

  // ── Helper: map a car's row to position (0-100) for rendering ──────────────
  _rowToPosition(row, gridRows) {
    return gridRows <= 1 ? 100 : (row / (gridRows - 1)) * 100;
  }

  // ── Turn-based grid advance ────────────────────────────────────────────────
  // Called after every shot resolves.  Moves all cars one row toward the breach,
  // checks for breach/win, then spawns new cars at row 0.
  _advanceGrid() {
    const gs       = this._gs;
    const ROWS     = gs.gridRows ?? 6;
    const MAX_ROW  = ROWS - 1;

    // 1. Move all cars forward one row.
    for (let li = 0; li < gs.activeLaneCount; li++) {
      for (const car of gs.lanes[li].cars) {
        car.row++;
        car.position = this._rowToPosition(car.row, ROWS);
        if (car.position > gs.maxCarPosition) gs.maxCarPosition = car.position;
      }
    }

    // 2. Check breach — any car that moved past the last row is a loss.
    for (let li = 0; li < gs.activeLaneCount; li++) {
      const breached = gs.lanes[li].cars.filter(c => c.row > MAX_ROW);
      if (breached.length > 0) {
        // Remove breaching cars and end the game.
        for (const car of breached) {
          const idx = gs.lanes[li].cars.indexOf(car);
          if (idx >= 0) gs.lanes[li].cars.splice(idx, 1);
        }
        gs.endGame(false);
        this._onEnd(false, li);
        return;
      }
    }

    // 3. Win check — enough kills accumulated.
    if (gs.totalKills >= gs.targetKills) {
      gs.endGame(true);
      this._onEnd(true);
      return;
    }

    // 4. Generate new cars at row 0.
    this._spawnNewRowCars();

    // 5. Refill columns so the player always has something to deploy.
    const dirState    = gs.asDirectorState();
    const phaseParams = gs.phaseMan.getParams();
    this._sDir.fillColumns(gs.activeCols, dirState, phaseParams);

    // 6. Viability guard.
    this._enforceViableMove(gs);
  }

  // Spawn 1–2 new cars at row 0 (back of lane) for random active lanes.
  _spawnNewRowCars() {
    const gs   = this._gs;
    const ROWS = gs.gridRows ?? 6;

    // How many new cars to add per advance (scales with active lanes).
    const maxNew = gs.activeLaneCount <= 2 ? 1 : 2;

    // Candidate lanes: active, and row 0 not already occupied.
    const candidates = [];
    for (let li = 0; li < gs.activeLaneCount; li++) {
      if (!gs.lanes[li].cars.some(c => c.row === 0)) candidates.push(li);
    }

    // Shuffle deterministically using the internal RNG.
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(this._rng.nextFloat(0, 1) * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const chosen = candidates.slice(0, maxNew);
    for (const li of chosen) {
      // Reuse carDir factory so HP/type/color distribution matches level config.
      const newCar    = this._carDir.generateCar(gs.lanes[li], 'CALM', gs.world, gs.colors);
      newCar.row       = 0;
      newCar.position  = 0;
      gs.lanes[li].addCar(newCar);
    }
  }

  _step(dt) {
    const gs = this._gs;
    gs.elapsed += dt;

    gs.phaseMan.update(gs.elapsed);
    const phaseParams = gs.phaseMan.getParams();
    const dirState    = gs.asDirectorState();

    // Win condition is now kill-based; checked in _advanceGrid().
    // Car movement is turn-based; cars only move when _advanceGrid() is called
    // (after each shot resolves). No continuous movement here.

    // Refill active shooter columns.
    this._sDir.fillColumns(gs.activeCols, dirState, phaseParams);

    // 6. Viability guard: ensure the player always has at least one valid move.
    //    Checks column tops + bench (when unlocked) against front car colors.
    //    If no overlap, forces a column top to match a front car color.
    this._enforceViableMove(gs);

    // 6.5. CRISIS assist — inject a guaranteed-match shooter at the top of the
    //      column aligned with the most dangerous lane. Only fires in PRESSURE,
    //      CLIMAX, or RELIEF when the player has been active (2+ deploys in 10s).
    if (phaseParams.crisisEnabled) {
      const crisis = this._sDir.triggerCrisis(dirState);
      if (crisis) {
        const laneIdx = gs.activeLanes.indexOf(crisis.lane);
        const colIdx  = Math.max(0, Math.min(laneIdx >= 0 ? laneIdx : 0, gs.activeColCount - 1));
        crisis.shooter.column = colIdx;
        gs.columns[colIdx].shooters.unshift(crisis.shooter);
        // Keep column within capacity.
        if (gs.columns[colIdx].shooters.length > 6) gs.columns[colIdx].shooters.length = 6;
        this._onCrisis(colIdx, laneIdx);
      }
    }

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

  // Start each active lane with exactly one car at row 0 (the far end).
  // The player must shoot it to advance and the game gradually fills up.
  _primeInitialCars() {
    const gs   = this._gs;
    const ROWS = gs.gridRows ?? 10;
    for (let li = 0; li < gs.activeLaneCount; li++) {
      const car    = this._carDir.generateCar(gs.lanes[li], 'CALM', gs.world, gs.colors);
      car.row      = 0;
      car.position = this._rowToPosition(0, ROWS);
      gs.lanes[li].addCar(car);
    }
    this._enforceViableMove(gs);
  }
}
