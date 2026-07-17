// §3d near-miss drama — trigger + re-arm state machine (GameLoop._checkNearMiss).
//
// Fires _onNearMiss ONLY when the player is ≥80% to winning AND a car reached the
// last two rows. Re-arm model (NOT once-per-level): fires once per danger episode,
// silent while the danger persists, re-arms only after the board returns clearly
// safe. Headless — real GameLoop/GameState/models, no Pixi/Three/DOM.

import { describe, it, expect, vi } from 'vitest';
import { GameLoop }        from '../src/game/GameLoop.js';
import { GameState }       from '../src/game/GameState.js';
import { CombatResolver }  from '../src/game/CombatResolver.js';
import { CarDirector }     from '../src/director/CarDirector.js';
import { ShooterDirector } from '../src/director/ShooterDirector.js';
import { FairnessArbiter } from '../src/director/FairnessArbiter.js';
import { IntensityPhase }  from '../src/director/IntensityPhase.js';
import { SeededRandom }    from '../src/utils/SeededRandom.js';
import { Lane }            from '../src/models/Lane.js';
import { Column }          from '../src/models/Column.js';
import { Car }             from '../src/models/Car.js';

const mockApp = { ticker: { add: vi.fn(), remove: vi.fn() } };

// gridRows=11 → ROWS-1=10 breach, ROWS-2=9 danger, re-arm when maxFrontRow < 8.
function setup(goals = [{ type: 'destroyColor', color: 'Red', count: 10 }]) {
  const lanes   = Array.from({ length: 4 }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: 4 }, (_, id) => new Column({ id }));
  const gs = new GameState({
    lanes, columns, colors: ['Red', 'Blue'],
    world: { hpMultiplier: 1, speed: { base: 5, variance: 0.5 } },
    duration: 90, phaseMan: new IntensityPhase(90),
    laneCount: 4, colCount: 4, gridRows: 11,
  });
  gs.goals = goals;
  gs.goalProgress = goals.map(g => g.count);
  const rng = new SeededRandom(1);
  const onNearMiss = vi.fn();
  const loop = new GameLoop({
    app: mockApp, gameState: gs,
    carDir: new CarDirector({}, rng),
    shooterDir: new ShooterDirector({}, rng, new FairnessArbiter()),
    combatResolver: new CombatResolver(), rng,
  });
  loop._onNearMiss = onNearMiss;
  return { gs, loop, onNearMiss };
}

// Place a single car at `row` in lane 0 (clears the lane first).
function setFrontRow(gs, row) {
  gs.lanes[0].cars = [];
  if (row >= 0) {
    const c = new Car({ color: 'Red', hp: 2, speed: 5, row });
    c.position = row;
    gs.lanes[0].cars.push(c);
  }
}

describe('near-miss trigger conditions', () => {
  it('fires when ≥80% done AND a car is in the last two rows', () => {
    const { gs, loop, onNearMiss } = setup();
    gs.goalProgress = [2];      // 8/10 done → 20% remaining (nearWin boundary, inclusive)
    setFrontRow(gs, 9);         // ROWS-2 → danger
    loop._checkNearMiss();
    expect(onNearMiss).toHaveBeenCalledTimes(1);
  });

  it('is SILENT in the midgame — a near-breach at 50% done does not fire', () => {
    const { gs, loop, onNearMiss } = setup();
    gs.goalProgress = [5];      // only 50% done
    setFrontRow(gs, 10);        // literally one row from breach…
    loop._checkNearMiss();
    expect(onNearMiss).not.toHaveBeenCalled();   // …but it's a Tuesday, not the story
  });

  it('is SILENT when ≥80% done but no car is close (danger gate)', () => {
    const { gs, loop, onNearMiss } = setup();
    gs.goalProgress = [1];      // 90% done
    setFrontRow(gs, 6);         // far from breach
    loop._checkNearMiss();
    expect(onNearMiss).not.toHaveBeenCalled();
  });

  it('does not fire once the level is already won (remaining 0)', () => {
    const { gs, loop, onNearMiss } = setup();
    gs.goalProgress = [0];      // already met
    setFrontRow(gs, 9);
    loop._checkNearMiss();
    expect(onNearMiss).not.toHaveBeenCalled();
  });

  it('does not fire on a legacy kill-goal level (no goals array)', () => {
    const { gs, loop, onNearMiss } = setup([]);
    setFrontRow(gs, 9);
    loop._checkNearMiss();
    expect(onNearMiss).not.toHaveBeenCalled();
  });

  it('does not fire when the game is over', () => {
    const { gs, loop, onNearMiss } = setup();
    gs.goalProgress = [2];
    setFrontRow(gs, 9);
    gs.isOver = true;
    loop._checkNearMiss();
    expect(onNearMiss).not.toHaveBeenCalled();
  });
});

describe('near-miss re-arm state machine', () => {
  it('fires ONCE per danger episode — silent through a persistent-danger stretch', () => {
    const { gs, loop, onNearMiss } = setup();
    gs.goalProgress = [2];
    // Danger persists across several advances (car teeters at rows 9,9,10,9).
    for (const row of [9, 9, 10, 9]) { setFrontRow(gs, row); loop._checkNearMiss(); }
    expect(onNearMiss).toHaveBeenCalledTimes(1);   // not four heartbeats — one
  });

  it('re-arms after the board returns clearly safe, then fires on the NEXT brush', () => {
    const { gs, loop, onNearMiss } = setup();
    gs.goalProgress = [2];

    setFrontRow(gs, 9); loop._checkNearMiss();      // episode 1 → fire
    expect(onNearMiss).toHaveBeenCalledTimes(1);

    setFrontRow(gs, 9); loop._checkNearMiss();      // still dangerous → silent
    expect(onNearMiss).toHaveBeenCalledTimes(1);

    setFrontRow(gs, 6); loop._checkNearMiss();      // pulled clearly safe (< ROWS-3) → re-arm
    expect(onNearMiss).toHaveBeenCalledTimes(1);    // safe frame itself is silent

    setFrontRow(gs, 9); loop._checkNearMiss();      // fresh brush with death → fire again
    expect(onNearMiss).toHaveBeenCalledTimes(2);
  });

  it('the L30-style climax case: an early near-miss does NOT silence the 95% climax', () => {
    const { gs, loop, onNearMiss } = setup();

    // Turn A — 80% done, tank hits row 9 → drama fires.
    gs.goalProgress = [2]; setFrontRow(gs, 9); loop._checkNearMiss();
    expect(onNearMiss).toHaveBeenCalledTimes(1);

    // Player clears it; board goes safe (re-arm).
    setFrontRow(gs, 5); loop._checkNearMiss();

    // Turn B — 95% done, bigrig reaches row 10 (the real climax) → fires again.
    gs.goalProgress = [1]; setFrontRow(gs, 10); loop._checkNearMiss();
    expect(onNearMiss).toHaveBeenCalledTimes(2);   // once-per-level would have missed this
  });
});
