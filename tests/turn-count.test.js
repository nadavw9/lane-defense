// gs.turnCount — a pure observable for test harnesses.
//
// Why it exists: harnesses need to know "did a turn complete?", and every
// available proxy is ambiguous. "Did the board advance?" is the worst of them —
// GameLoop._advanceGrid deliberately skips car movement under FREEZE, so
// unchanged rows are satisfied by a CORRECTLY FROZEN GAME and by a BROKEN
// HARNESS alike. That is the wait-condition antipattern (CLAUDE.md §6) inside
// the sanity check written to catch it, and it cost this project several wrong
// readings before it was spotted.
//
// A monotonic counter has no such ambiguity: it moves iff a turn completed.
//
// Contract pinned here:
//   - increments exactly once per completed turn
//   - increments under FREEZE too (a frozen turn is still a turn)
//   - never decrements, never skips
//   - is not read by production logic (observable only)
import { describe, it, expect } from 'vitest';
import fs from 'fs';

const LOOP = fs.readFileSync('src/game/GameLoop.js', 'utf8');
const STATE = fs.readFileSync('src/game/GameState.js', 'utf8');

describe('gs.turnCount — pure turn observable', () => {
  it('is initialised on construction AND on reset', () => {
    // Two sites: the constructor and resetLevel. A counter that survives a level
    // restart would make cross-level harness readings meaningless.
    const inits = STATE.match(/this\.turnCount\s*=\s*0/g) ?? [];
    expect(inits.length, 'expected turnCount = 0 in both the constructor and reset')
      .toBeGreaterThanOrEqual(2);
  });

  it('increments at exactly one place, inside _advanceGrid', () => {
    const incs = LOOP.match(/turnCount\s*=\s*\(?gs\.turnCount/g) ?? [];
    expect(incs.length, 'more than one increment site would double-count a turn').toBe(1);
    const adv = LOOP.slice(LOOP.indexOf('_advanceGrid() {'));
    expect(adv.slice(0, 1200), 'the increment must live in _advanceGrid').toMatch(/turnCount/);
  });

  it('increments BEFORE the freeze early-return, so a frozen turn still counts', () => {
    const adv = LOOP.slice(LOOP.indexOf('_advanceGrid() {'));
    const incAt = adv.indexOf('turnCount');
    const freezeAt = adv.indexOf('boosterFrozen');
    expect(incAt).toBeGreaterThan(-1);
    expect(freezeAt).toBeGreaterThan(-1);
    expect(incAt, 'increment must precede the freeze branch — a frozen turn is still a turn')
      .toBeLessThan(freezeAt);
  });

  it('_advanceGrid is the single funnel for turn completion', () => {
    // If a second path could complete a turn without going through _advanceGrid,
    // the counter would under-count and harnesses would stall waiting on it.
    const callers = LOOP.match(/this\._advanceGrid\(\)/g) ?? [];
    expect(callers.length, 'call sites changed — re-verify the counter still sees every turn')
      .toBe(2);
  });

  it('is never read by production logic — observable only', () => {
    // A branch on turnCount would turn a diagnostic into behaviour, and any
    // future change to it would then be a gameplay change.
    // Comments are stripped first — the explanatory block above the increment
    // names turnCount several times, and counting prose would fail spuriously.
    const code = LOOP.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const reads = code.match(/turnCount/g) ?? [];
    expect(reads.length, 'GameLoop should only WRITE turnCount (once), never branch on it').toBe(2);
    expect(code, 'the only occurrence must be the increment itself')
      .toMatch(/gs\.turnCount\s*=\s*\(gs\.turnCount\s*\?\?\s*0\)\s*\+\s*1/);
    for (const f of ['src/game/CombatResolver.js', 'src/simulation/SimulationRunner.js']) {
      if (!fs.existsSync(f)) continue;
      expect(fs.readFileSync(f, 'utf8'), `${f} must not read turnCount`).not.toMatch(/turnCount/);
    }
  });
});
