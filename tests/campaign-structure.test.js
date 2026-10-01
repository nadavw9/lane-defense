// The campaign is data-driven: the map, progress and tools all derive from the level
// table. These pin the invariants that adding levels must not break.
import { describe, it, expect } from 'vitest';
import { LEVEL_COUNT, LevelManager, isBossLevel, levelConfigFor } from '../src/game/LevelManager.js';
import { MAP_WORLDS, mapNodes, worldForLevel } from '../src/screens/levelMapLayout.js';
import { bandFor } from '../tools/bands.mjs';
import { ProgressManager } from '../src/game/ProgressManager.js';

describe('campaign structure', () => {
  it('level ids are contiguous 1..LEVEL_COUNT', () => {
    for (let id = 1; id <= LEVEL_COUNT; id++) expect(levelConfigFor(id)?.id).toBe(id);
    expect(levelConfigFor(LEVEL_COUNT + 1)).toBeNull();
  });

  it('a boss closes every tenth level', () => {
    for (let id = 10; id <= LEVEL_COUNT; id += 10) expect(isBossLevel(id), `L${id}`).toBe(true);
  });

  it('only every tenth level is a boss', () => {
    for (let id = 1; id <= LEVEL_COUNT; id++) if (id % 10 !== 0) expect(isBossLevel(id), `L${id}`).toBe(false);
  });

  it('map pages tile the campaign exactly, in order, with no gaps', () => {
    let next = 1;
    for (const w of MAP_WORLDS) {
      expect(w.first).toBe(next);
      next = w.last + 1;
      const nodes = mapNodes(w.page);
      expect(nodes.length).toBe(w.last - w.first + 1);
    }
    expect(next - 1).toBe(LEVEL_COUNT);
  });

  it('every level maps to a world page', () => {
    for (let id = 1; id <= LEVEL_COUNT; id++) {
      const w = worldForLevel(id);
      expect(id >= w.first && id <= w.last, `L${id}`).toBe(true);
    }
  });

  it('winning the last level does not unlock a level that does not exist', () => {
    const p = new ProgressManager();
    for (let id = 1; id <= LEVEL_COUNT; id++) p.recordWin(id, 3);
    expect(p.unlockedLevel).toBe(LEVEL_COUNT);
  });

  it('LevelManager walks the whole table and stops at the end', () => {
    const lm = new LevelManager();
    let n = 1;
    while (!lm.isFinalLevel) { lm.advance(); n++; }
    expect(n).toBe(LEVEL_COUNT);
    expect(lm.levelNumber).toBe(LEVEL_COUNT);
  });

  it('every level has a win-rate band and bosses get the boss band', () => {
    for (let id = 1; id <= 100; id++) {
      const b = bandFor(id);
      expect(b.lo).toBeLessThan(b.hi);
      if (isBossLevel(id)) expect(b.boss).toBe(true);
    }
  });
});
