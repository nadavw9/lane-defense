// Every baked gameplay backdrop the game can ask for must exist on disk — a
// missing file would load as a black plane over the whole scene.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { BACKDROP_KEYS, backdropUrlFor } from '../src/renderer/assetManifest.js';

describe('baked gameplay backdrops', () => {
  it('every listed backdrop file exists', () => {
    for (const k of BACKDROP_KEYS) {
      expect(fs.existsSync(`public/sprites/designed/backdrop-${k}.jpg`), k).toBe(true);
    }
  });
  it('covers every shipped level (world × variant × lane count)', async () => {
    const { LevelManager } = await import('../src/game/LevelManager.js');
    const lm = new LevelManager();
    let checked = 0;
    for (let id = 1; id <= 40; id++) {
      lm.goToLevel(id);
      const cfg = lm.current;
      expect(cfg.id).toBe(id);
      expect(backdropUrlFor(id, cfg.laneCount), `L${id}`).not.toBeNull();
      checked++;
    }
    expect(checked).toBe(40);
  });
});
