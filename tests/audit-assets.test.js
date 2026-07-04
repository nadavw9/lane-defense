// Asset manifest audit (bug class B — production-only 404s).
//
// Every sprite URL the game preloads must resolve to a real file under public/
// with an EXACT-case path match, and must not be gitignored. Both failure modes
// have shipped before and were invisible locally:
//   - powerball-Yellow.png (preload) vs powerball-yellow.png (disk) → 404 only on
//     GitHub Pages, whose host is case-sensitive while Windows/dev is not.
//   - tree/grass/panel sprites living in a gitignored folder → never deployed,
//     404 in production, placeholders on the live site.
//
// Headless, no browser: walks the manifest from src/renderer/assetManifest.js
// against the real filesystem.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ALL_SPRITE_URLS } from '../src/renderer/assetManifest.js';

const ROOT   = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const BASE   = import.meta.env.BASE_URL ?? '/';

// URL (e.g. "/sprites/cars/car-red.png") → path segments under public/.
function urlToSegments(url) {
  const rel = url.startsWith(BASE) ? url.slice(BASE.length) : url.replace(/^\//, '');
  return rel.split('/').filter(Boolean);
}

// Case-SENSITIVE existence check that works on case-insensitive filesystems
// (Windows/macOS): walk segment by segment and require an exact string match
// against the actual directory listing.
function existsExactCase(baseDir, segments) {
  let dir = baseDir;
  for (const seg of segments) {
    let entries;
    try { entries = fs.readdirSync(dir); } catch { return { ok: false, at: dir }; }
    if (!entries.includes(seg)) return { ok: false, at: path.join(dir, seg) };
    dir = path.join(dir, seg);
  }
  return { ok: true };
}

describe('audit: sprite manifest vs disk', () => {
  it('manifest is non-trivial', () => {
    expect(ALL_SPRITE_URLS.length).toBeGreaterThan(50);
  });

  it('every preloaded sprite exists under public/ with EXACT-case path', () => {
    const missing = [];
    for (const url of ALL_SPRITE_URLS) {
      const res = existsExactCase(PUBLIC, urlToSegments(url));
      if (!res.ok) missing.push(`${url}  (no exact-case match at ${res.at})`);
    }
    expect(missing, `Missing / case-mismatched sprites:\n${missing.join('\n')}`).toEqual([]);
  });

  it('no preloaded sprite lives in a gitignored path (would 404 after deploy)', () => {
    const relPaths = ALL_SPRITE_URLS.map(u => 'public/' + urlToSegments(u).join('/'));
    const res = spawnSync('git', ['check-ignore', ...relPaths], { cwd: ROOT, encoding: 'utf8' });
    // exit 0 → at least one path IS ignored (bad); 1 → none ignored (good).
    const ignored = (res.stdout ?? '').trim();
    expect(ignored, `Gitignored sprites (will be missing on Pages):\n${ignored}`).toBe('');
  });

  it('no duplicate URLs in the manifest', () => {
    const seen = new Set();
    const dupes = ALL_SPRITE_URLS.filter(u => (seen.has(u) ? true : (seen.add(u), false)));
    expect(dupes).toEqual([]);
  });
});
