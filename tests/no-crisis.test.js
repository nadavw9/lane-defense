// The CRISIS assist is gone (2026-10-30, docs/superpowers/specs/2026-10-30-lane-barriers-design.md
// §3.4). It injected a matching bomb whenever a car passed 70% of its lane, invisibly, and the
// simulator never modelled it — which is how "never lost a level" and "74-84% in band" were
// both true at once. Lane barriers are the visible replacement. This test keeps it gone.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

describe('no crisis assist', () => {
  it('no source file mentions a crisis', () => {
    const hits = walk('src').filter(p => /crisis/i.test(readFileSync(p, 'utf8')));
    expect(hits).toEqual([]);
  });
});
