// GameLoop — fixed-timestep logic driver.
// Adds its own PixiJS ticker listener for deterministic game logic at 60fps.
// The render ticker in GameApp runs separately at display refresh rate.
//
// Public API:
//   deploy(colIdx, laneIdx) — called by DragDrop; resolves combat immediately
//   restart()               — full level reset + reprime; called by screens
import { PHASE_CONFIG } from '../director/DirectorConfig.js';
import { Shooter } from '../models/Shooter.js';

const KILLS_PER_BOMB      = 10;    // kills needed to earn one bomb charge
const MULTI_KILLS_PER_BOMB = 3;    // multi-kills (2+ cars/shot) banked to earn a color bomb
const BOMB_MAX_CHARGES    = 3;     // max bombs a player can hold
const BOMB_DAMAGE         = 8;     // HP damage dealt per car in blast zone
const BOMB_POS_RADIUS     = 22;    // blast radius in road-position units (0-100 scale)
const BOMB_FREEZE_DURATION = 2.0;  // seconds all cars are frozen after bomb detonation

const FIXED_DT = 1 / 60; // logic step in seconds

// Time in seconds for the bomb to visibly travel to the car before damage lands.
// The 3D projectile (Projectile3D) eases across this whole window and lands exactly
// when the shot resolves — the travel IS the anticipation (FIX 6). Kept in the
// 150-200ms "satisfying throw" range (ref: Royal Match / Toon Blast).
const SHOT_TRAVEL_TIME = 0.18;

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
    this._onBombEarned   = null;  // set by GameApp after construction
    this._onBombExplode  = null;  // set by GameApp after construction
    this._onColorBomb    = null;  // set by GameApp; (color, killed) → visual FX when a rainbow fires
    this._onComboFreeze  = null;  // set by GameApp; () → visual FX
    this._onColorBombEarned = null;  // set by GameApp; (colIdx) → color-bomb earned flash + intro card + SFX
    this._onMultiKill       = null;  // set by GameApp; (count, needed) → "MULTI-KILL n/3" notification
    this.onNewCarType    = null;  // set by GameApp; fires with typeKey when a car is added to a lane

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

  // Called by GameApp when the player places a bomb — kills all cars in the
  // same row as the front car of the target lane (row = grid depth, highest
  // value = closest to the breach line).
  placeBombOnLane(laneIdx) {
    const gs = this._gs;
    const bs = this._boosterState;
    if (!bs?.consumeBomb()) return;

    const lane = gs.lanes[laneIdx];
    if (!lane) return;

    // Front car = highest row (closest to breach).
    const frontCar = lane.cars.reduce((best, c) => (!best || c.row > best.row) ? c : best, null);
    if (!frontCar) {
      // No car in target lane — refund the bomb so the player isn't penalized.
      bs.bombs = Math.min(bs.bombsMax ?? 3, bs.bombs + 1);
      return;
    }

    // Find and kill every car at the same row across all lanes that matches the front car's color.
    // Strategic: player waits for same-color cars to align in a row before firing.
    const targetRow   = frontCar.row;
    const targetColor = frontCar.color;
    for (let li = 0; li < gs.lanes.length; li++) {
      const l = gs.lanes[li];
      for (let ci = l.cars.length - 1; ci >= 0; ci--) {
        const car = l.cars[ci];
        if (car.row !== targetRow) continue;
        if (car.color !== targetColor) continue;
        l.cars.splice(ci, 1);
        const combo = gs.recordKill(false);
        this._onKill(combo);
        if (bs && gs.killsTowardBomb % KILLS_PER_BOMB === 0 && bs.bombs < BOMB_MAX_CHARGES) {
          bs.bombs++;
          this._onBombEarned?.();
        }
        this._onBombExplode?.(car.position, 1);
      }
    }

    // Brief freeze on all remaining cars.
    gs.bombFreezeUntil = gs.elapsed + BOMB_FREEZE_DURATION;
  }

  // Place shooter in the firing slot for one short travel window, trigger
  // audio/animation callbacks, and start time dilation.  Combat resolves once
  // the single projectile travel time elapses.
  // Travel time is shortened by comboFireMultiplier so high-combo streaks
  // feel snappier — at 2× the shot resolves in 0.06 s instead of 0.12 s.
  // colIdx === -1 means the shooter came from the bench (no punch animation).
  _startFiring(shooter, laneIdx, colIdx) {
    const gs         = this._gs;
    gs.firingSlots[laneIdx] = { shooter, colIdx, timeLeft: SHOT_TRAVEL_TIME };
    this._onShoot(shooter.damage, laneIdx, colIdx);
    gs.triggerDilation();
  }

  // Phase 1.5 — the projectile has arrived. Fire the immediate impact reaction
  // (squash + flash on the still-present target car) and start a hit-stop sized
  // by the predicted outcome. _step() resolves the shot once the freeze expires.
  // A miss / empty lane has no impact, so it resolves straight away.
  _beginHitStop(shooter, laneIdx) {
    const gs       = this._gs;
    const lane     = gs.lanes[laneIdx];
    const frontCar = lane?.frontCar();
    const colorBomb = !!shooter.isColorBomb;

    let dur = 0;
    if (colorBomb) {
      dur = 0.080;
    } else if (frontCar && shooter.color === frontCar.color) {
      dur = frontCar.hp <= shooter.damage ? 0.050 : 0.030;   // kill : non-kill
    }

    if (dur > 0) {
      // Impact reaction on the car that's still here (works for kills too — the
      // squash plays during the freeze, then the explosion fires on resolve).
      this._onImpact?.(laneIdx, shooter.color, colorBomb);
      gs.hitStopRemaining = dur;
      this._pendingShot   = { shooter, laneIdx };
    } else {
      this._resolveShot(shooter, laneIdx);   // miss / nothing to hit
    }
  }

  // Phase 2 — delayed combat resolution once the fire duration elapses.
  // Called from _step() when firingSlots[laneIdx].timeLeft reaches 0.
  _resolveShot(shooter, laneIdx) {
    const gs       = this._gs;
    const lane     = gs.lanes[laneIdx];
    const frontCar = lane.frontCar();

    // Nothing to shoot at — slot clears silently.
    if (!frontCar) return;

    const carGameX       = frontCar.position;
    const isCorrectColor = shooter.color === frontCar.color;

    // Rainbow color bomb (earned via correct-shot streak): destroy every car
    // matching the TARGET lane's front-car colour, across all lanes. The player
    // aims it by choosing which lane to drop it on. It does not affect the streak
    // (already reset on earn), and it advances the grid EXACTLY ONCE — like any
    // single shot: matching cars are destroyed, then all survivors step forward.
    if (shooter.isColorBomb) {
      const targetColor = frontCar.color;
      const killed = this._fireColorBomb(targetColor);
      this._onColorBomb?.(targetColor, killed);
      if (!gs.isOver) this._advanceGrid();   // one advance total, not per kill
      return;
    }

    // Freeze power shot: normal hit resolves, then all cars skip the next grid advance.
    const isFreezeShot = gs.freezeArmed;
    if (isFreezeShot) {
      gs.freezeArmed = false;
    }

    gs.recordDeploy(isCorrectColor);

    const { kills, carryOverKills, damageDealt } = this._combat.resolve(shooter, lane);

    if (damageDealt === 0) {
      this._onMiss(laneIdx, carGameX);
      // Color mismatch: wasted bomb slot, grid does NOT advance.
      return;
    }

    if (isFreezeShot) {
      gs.comboFreezeShots = 1;
      gs.resetCombo();
      this._onComboFreeze?.();
    }

    // Pass the kill COUNT (not just a boolean) so the renderer can escalate the
    // shake / chroma / explosion size for multi-kills.
    this._onHit(laneIdx, carGameX, shooter.color, damageDealt, kills);

    // Bullet-time on a big play: a 3+ kill shot briefly drops the renderer to 0.3x.
    if (kills >= 3) {
      gs.timeScale       = 0.3;
      gs.slowMoRemaining = 0.20;
    }

    if (kills > 0) {
      if (kills > gs.maxSingleShotKills) gs.maxSingleShotKills = kills;  // win-screen "best multi-kill"
      if (carryOverKills > 0) this._onChain(laneIdx, carGameX);

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
    }

    // Multi-kill reward: a shot that destroys 2+ cars (via carry-over) is a
    // "multi-kill". Banking MULTI_KILLS_PER_BOMB of them in a level earns one
    // rainbow color bomb (rarer + more earned than a per-shot reward).
    if (kills >= 2) {
      gs.multiKillCount++;
      this._onMultiKill?.(gs.multiKillCount, MULTI_KILLS_PER_BOMB);
      if (gs.multiKillCount >= MULTI_KILLS_PER_BOMB) {
        gs.multiKillCount = 0;
        this._earnColorBomb();   // fires _onColorBombEarned → flash + one-time intro card
      }
    }

    // Turn-based: advance the grid after every hit — damage-only AND kill shots.
    if (!gs.isOver) this._advanceGrid();
  }

  // Earn a rainbow color bomb: replace the "next bomb" (top shooter) of the
  // strategically least-costly column — the active column whose top bomb has the
  // LOWEST damage — with a rainbow color-bomb powerball. Picking the lowest-damage
  // top means the player sacrifices the least useful bomb to gain the reward.
  _earnColorBomb() {
    const gs = this._gs;
    let bestCol = -1, lowestDmg = Infinity;
    for (let c = 0; c < gs.activeColCount; c++) {
      const top = gs.columns[c]?.top();
      if (top && !top.isColorBomb && top.damage < lowestDmg) { lowestDmg = top.damage; bestCol = c; }
    }
    if (bestCol === -1) bestCol = 0;  // fallback: first column
    const col     = gs.columns[bestCol];
    const rainbow = new Shooter({ color: 'Rainbow', damage: 0, column: bestCol, isColorBomb: true });
    if (col.shooters.length > 0) col.shooters[0] = rainbow;  // replace the next bomb
    else                          col.shooters.unshift(rainbow);
    this._onColorBombEarned?.(bestCol);
  }

  // Color bomb power shot: instantly remove all cars matching `color` from every lane.
  // Kills are registered (combo, coins, bomb charge) but the grid does NOT advance.
  // Returns the list of destroyed cars as { laneIdx, position } so the renderer
  // can place explosions ONLY on cars actually killed (not on survivors).
  _fireColorBomb(color) {
    const gs = this._gs;
    const bs = this._boosterState;
    const killed = [];
    for (let li = 0; li < gs.activeLaneCount; li++) {
      const lane = gs.lanes[li];
      for (let ci = lane.cars.length - 1; ci >= 0; ci--) {
        if (lane.cars[ci].color !== color) continue;
        killed.push({ laneIdx: li, position: lane.cars[ci].position });  // capture before removal
        lane.cars.splice(ci, 1);
        const combo = gs.recordKill(false);
        this._onKill(combo);
        if (bs && gs.killsTowardBomb % KILLS_PER_BOMB === 0 && bs.bombs < BOMB_MAX_CHARGES) {
          bs.bombs++;
          this._onBombEarned?.();
        }
      }
    }
    return killed;
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

    // FREEZE (booster or combo power shot): skip grid advance, cars don't move.
    const boosterFrozen = this._boosterState?.isFrozen() ?? false;
    const comboFrozen   = gs.comboFreezeShots > 0;
    if (boosterFrozen || comboFrozen) {
      if (boosterFrozen) this._boosterState.consumeFreezeShot();
      if (comboFrozen)   gs.comboFreezeShots--;
      // Still refill columns and run viability guard, but cars don't move.
      const dirState = gs.asDirectorState();
      const phaseParams = gs.phaseMan.getParams();
      this._sDir.fillColumns(gs.activeCols, dirState, phaseParams);
      this._enforceViableMove(gs);
      return;
    }

    // 1. Move all cars forward one row.
    for (let li = 0; li < gs.activeLaneCount; li++) {
      for (const car of gs.lanes[li].cars) {
        car.row++;
        car.position = this._rowToPosition(car.row, ROWS);
        if (car.position > gs.maxCarPosition) gs.maxCarPosition = car.position;
      }
    }

    // Notify the renderer that the world just stepped (cars actually moved) so it
    // can punctuate the advance with a visual beat. Frozen advances return earlier
    // and never reach here, so no beat fires when nothing moved.
    this._onAdvance?.();

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

    // 3. Win check.
    // Budget-based (preferred): all budget spent AND all lanes empty.
    // Legacy kill-based: totalKills reaches targetKills (tests / levels without budget).
    if (gs.spawnBudget !== null) {
      if (gs.spawnBudget <= 0 && gs.activeLanes.every(l => l.cars.length === 0)) {
        gs.endGame(true);
        this._onEnd(true);
        return;
      }
    } else if (gs.totalKills >= gs.targetKills) {
      gs.endGame(true);
      this._onEnd(true);
      return;
    }

    // 4. Refill lanes: each active lane tries to maintain laneTargetCarCount cars.
    this._refillLanes();

    // 5. Refill columns so the player always has something to deploy.
    const dirState    = gs.asDirectorState();
    const phaseParams = gs.phaseMan.getParams();
    this._sDir.fillColumns(gs.activeCols, dirState, phaseParams);

    // 6. Viability guard.
    this._enforceViableMove(gs);
  }

  // Refill each active lane up to laneTargetCarCount, consuming spawnBudget.
  // In legacy mode (spawnBudget === null), falls back to spawning 1-2 per advance.
  _refillLanes() {
    const gs     = this._gs;
    const target = gs.laneTargetCarCount ?? 2;

    if (gs.spawnBudget !== null) {
      // Budget mode: refill every under-stocked lane as long as budget remains.
      for (let li = 0; li < gs.activeLaneCount; li++) {
        if (gs.spawnBudget <= 0) break;
        const lane = gs.lanes[li];
        if (lane.cars.length < target && !lane.cars.some(c => c.row < 2)) {
          const car = this._carDir.generateCar(lane, 'CALM', gs.world, gs.colors, gs.gridRows);
          car.row = 0; car.position = 0;
          lane.addCar(car);
          this.onNewCarType?.(car.type);
          gs.spawnBudget--;
        }
      }
    } else {
      // Legacy mode: pick at most 1-2 random candidate lanes.
      const maxNew     = gs.activeLaneCount <= 2 ? 1 : 2;
      const candidates = [];
      for (let li = 0; li < gs.activeLaneCount; li++) {
        if (!gs.lanes[li].cars.some(c => c.row < 2)) candidates.push(li);
      }
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(this._rng.nextFloat(0, 1) * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      for (const li of candidates.slice(0, maxNew)) {
        const car = this._carDir.generateCar(gs.lanes[li], 'CALM', gs.world, gs.colors, gs.gridRows);
        car.row = 0; car.position = 0;
        gs.lanes[li].addCar(car);
        this.onNewCarType?.(car.type);
      }
    }
  }

  _step(dt) {
    const gs = this._gs;

    // ── Hit-stop: freeze ALL game logic for a few ms after a bomb lands, so the
    //    impact registers as having weight. The renderer keeps running (the impact
    //    flash plays), only this logic step is paused. When it expires, the pending
    //    shot finally resolves.
    if (gs.hitStopRemaining > 0) {
      gs.hitStopRemaining = Math.max(0, gs.hitStopRemaining - dt);
      if (gs.hitStopRemaining === 0 && this._pendingShot) {
        const { shooter, laneIdx } = this._pendingShot;
        this._pendingShot = null;
        this._resolveShot(shooter, laneIdx);
      }
      return;   // nothing else advances during a hit-stop
    }

    // ── Slow-mo (bullet-time) decay — set by a 3+ multi-kill. Visible via the
    //    renderer dt being scaled by gs.timeScale in the GameApp render loop.
    if (gs.slowMoRemaining > 0) {
      gs.slowMoRemaining = Math.max(0, gs.slowMoRemaining - dt);
      if (gs.slowMoRemaining === 0) gs.timeScale = 1;
    }

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
        // Keep column within capacity (3 + 1 extra tolerance for crisis inject).
        if (gs.columns[colIdx].shooters.length > 4) gs.columns[colIdx].shooters.length = 4;
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
        this._beginHitStop(shooter, i);   // hit-stop, then _resolveShot
        if (gs.isOver) return;   // breach may occur during resolution
        // One impact at a time: if a hit-stop just started, let remaining lanes'
        // shots resolve on later steps (otherwise a second begin would clobber the
        // pending shot). They keep their timeLeft until the freeze clears.
        if (gs.hitStopRemaining > 0) break;
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

  // Start each active lane with one car at row 0 (the far end), or place
  // pre-defined cars if the level config supplies an initialCars array.
  // Each placed car is charged against spawnBudget (if set).
  _primeInitialCars() {
    const gs   = this._gs;
    const ROWS = gs.gridRows ?? 10;

    const spendBudget = () => {
      if (gs.spawnBudget !== null && gs.spawnBudget > 0) gs.spawnBudget--;
    };

    if (gs.initialCars && gs.initialCars.length > 0 && gs.activeLaneCount > 0) {
      for (const def of gs.initialCars) {
        const car    = this._carDir.generateCar(gs.lanes[0], 'CALM', gs.world, gs.colors, ROWS);
        car.row      = def.row ?? 0;
        car.type     = def.type ?? car.type;
        car.position = this._rowToPosition(car.row, ROWS);
        gs.lanes[0].addCar(car);
        spendBudget();
      }
      for (let li = 1; li < gs.activeLaneCount; li++) {
        const car    = this._carDir.generateCar(gs.lanes[li], 'CALM', gs.world, gs.colors, ROWS);
        car.row      = 0;
        car.position = this._rowToPosition(0, ROWS);
        gs.lanes[li].addCar(car);
        spendBudget();
      }
    } else {
      // Open with the uniform 3-car/lane density at gs.openingRows (rows [0,1,2] —
      // see openingRowsForLevel), so every level starts the same and cars enter from
      // the top. laneTargetCarCount controls ongoing refill, not the opening.
      const rows = (gs.openingRows && gs.openingRows.length) ? gs.openingRows : [0];
      for (let li = 0; li < gs.activeLaneCount; li++) {
        for (const row of rows) {
          const car    = this._carDir.generateCar(gs.lanes[li], 'CALM', gs.world, gs.colors, ROWS);
          car.row      = row;
          car.position = this._rowToPosition(row, ROWS);
          gs.lanes[li].addCar(car);
          spendBudget();
        }
      }
    }
    this._enforceViableMove(gs);
  }
}
