// THE STASH IS GONE. IT MUST NOT COME BACK.
//
// The stash was a per-column "set a bomb aside" slot, retired when the BENCH
// became the sole storage mechanic. Retiring it was done by making
// `DragDrop._hitTestStashArea()` return `false` — which neutralised the FEATURE
// while leaving the whole implementation wired: Column.stash/stashBomb/
// retrieveStash, five DragDrop handlers, per-level Shooter3D meshes, Pixi
// sprites/graphics/text in ShooterRenderer, a GameApp pulse loop, a
// GameRenderer3D passthrough, and STASH_Y.
//
// That remnant then caused TWO of the seven bugs in this project's
// create-before-configure / stale-value class:
//   - Shooter3D.SLOT_COUNT stayed 4 ("the 4th slot is the stash"), so crisis
//     inject produced a bomb rendered nowhere and hit-tested nowhere
//   - the queue-fit solver reserved space for slot index 3 — the stash — which
//     shrank every bomb and hid a real overflow behind a phantom margin
//
// Dead code that still *looks* live is worse than no code: it makes a future
// session reason about a mechanic the player cannot reach. Removed 2026-08-06.
// If the stash is ever revived, revive it deliberately — start from git history,
// not from leftovers.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Column } from '../src/models/Column.js';

// Every source file that referenced the stash before removal, plus the whole tree
// so a new reference anywhere is caught.
function allSourceFiles(dir = 'src', acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) allSourceFiles(p, acc);
    else if (e.name.endsWith('.js')) acc.push(p);
  }
  return acc;
}

// Comments may still MENTION the stash — that history explains why SLOT_COUNT is
// 3 and why the solver targets slot 2, and deleting it would erase the lesson.
// What must never return is stash CODE.
const CODE_PATTERNS = [
  [/\bstashBomb\s*\(/,        'Column.stashBomb()'],
  [/\bretrieveStash\s*\(/,    'Column.retrieveStash()'],
  [/\bcol\.stash\b/,          'col.stash access'],
  [/\bthis\.stash\b/,         'this.stash field'],
  [/\b_stashSlots\b/,         'Shooter3D._stashSlots'],
  [/\b_stashPulse\b/,         'Shooter3D._stashPulse'],
  [/\bpulseStash\s*\(/,       'pulseStash()'],
  [/\b_createStashSlot\s*\(/, 'Shooter3D._createStashSlot()'],
  [/\bgetStashCenter\s*\(/,   'ShooterRenderer.getStashCenter()'],
  [/\bSTASH_Y\b/,             'ShooterRenderer.STASH_Y'],
  [/\b_hitTestStash\w*\s*\(/, 'DragDrop stash hit-tests'],
  [/\b_handleStash\w*\s*\(/,  'DragDrop stash handlers'],
  [/\b_stashGraphics\b|\b_stashSprites\b|\b_stashTexts\b/, 'ShooterRenderer stash display objects'],
  [/\bstashZ\s*\(/,           'Shooter3D.stashZ()'],
];

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('the retired stash stays removed', () => {
  it('no stash CODE remains anywhere in src/', () => {
    const offenders = [];
    for (const file of allSourceFiles()) {
      const code = stripComments(fs.readFileSync(file, 'utf8'));
      for (const [re, label] of CODE_PATTERNS) {
        if (re.test(code)) offenders.push(`${file}: ${label}`);
      }
    }
    expect(offenders, `stash code is back:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });

  it('Column exposes no stash surface', () => {
    const col = new Column({ id: 0 });
    expect(col.stash, 'Column.stash field is back').toBeUndefined();
    expect(col.stashBomb, 'Column.stashBomb() is back').toBeUndefined();
    expect(col.retrieveStash, 'Column.retrieveStash() is back').toBeUndefined();
    // The queue API the bench actually uses must be untouched.
    expect(typeof col.top).toBe('function');
    expect(typeof col.consume).toBe('function');
    expect(typeof col.pushBottom).toBe('function');
    expect(typeof col.needsRefill).toBe('function');
  });

  it('a Column still behaves exactly as before for the live queue path', () => {
    // Removal must be behaviour-neutral for everything that is NOT the stash.
    const col = new Column({ id: 1 });
    expect(col.top()).toBeNull();
    expect(col.needsRefill()).toBe(true);
    col.pushBottom({ color: 'Red', damage: 3 });
    col.pushBottom({ color: 'Blue', damage: 4 });
    col.pushBottom({ color: 'Green', damage: 5 });
    expect(col.needsRefill()).toBe(false);
    expect(col.top().color).toBe('Red');
    col.consume();
    expect(col.top().color).toBe('Blue');
    expect(col.shooters).toHaveLength(2);
    expect(col.needsRefill()).toBe(true);
  });

  it('the dev-hook surface no longer offers stashBomb', () => {
    const app = fs.readFileSync('src/renderer/GameApp.js', 'utf8');
    expect(stripComments(app), 'the _nav.stashBomb dev hook is back')
      .not.toMatch(/stashBomb\s*:/);
  });
});
