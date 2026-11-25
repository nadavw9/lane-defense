// Security review (24 Nov 2026): the live database was locked (no reads, no writes), so every
// analytics row the game sent was dropped. Owner decision (25 Nov): let the game ADD rows again,
// append-only and validated, with no reads at all; and remove AutoTuner's remote read, so data
// written by anyone can never change difficulty for every player.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const rules = JSON.parse(read('firebase-rules/database.rules.json')).rules;

describe('analytics database rules', () => {
  it('never allows reads, anywhere', () => {
    expect(rules['.read']).toBe(false);
    expect(JSON.stringify(rules)).not.toMatch(/"\.read"\s*:\s*(true|")/);
  });

  it('only appends validated rows to events and sessions', () => {
    expect(rules['.write']).toBe(false);
    for (const c of ['events', 'sessions']) {
      const w = rules[c]?.$id?.['.write'];
      expect(w, c).toContain('!data.exists()');
      expect(w, c).toContain("newData.child('playerId').isString()");
    }
  });
});

describe('AutoTuner', () => {
  it('never reads the shared database', () => {
    expect(read('src/analytics/AutoTuner.js')).not.toMatch(/fetch\(/);
    expect(read('src/renderer/GameApp.js')).not.toContain('autoTuner.startFetch()');
  });
});
