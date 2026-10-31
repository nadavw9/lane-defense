// The automatic CHAIN REACTION (spread.js, 2026-10-27) is gone: a hit crosses lanes only over a
// bridge the player made (src/game/bridges.js, 2026-10-31). This keeps it out.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

describe('no automatic spread', () => {
  it('the module is gone', () => {
    expect(existsSync(join(SRC, 'game', 'spread.js'))).toBe(false);
  });
  it('nothing in src references it', () => {
    const offenders = walk(SRC).filter(p => /spreadAcross|spreadEnabledFor|SPREAD_FROM|spreadEnabled\b|_onSpread\b/.test(readFileSync(p, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
