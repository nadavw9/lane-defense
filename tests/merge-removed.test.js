// THE BOMB MERGE MECHANIC IS GONE. IT MUST NOT COME BACK.
//
// Removed 2026-08-08 by owner decision. The reason is worth keeping, because the
// mechanic LOOKED like depth and measured as the opposite: a merged bomb one-shot
// its target 100% of the time against 2-5 HP cars, so merging spent THREE bombs to
// overkill ONE car. That is strictly worse than firing the three separately, and
// worse than the BOMB booster's lane clear on a crowded lane. It added cost, not
// choice.
//
// This is a permanent removal, not a feature flag. It is guarded because the
// mechanic was wired across eleven source files — GameLoop's detection/apply
// engine, GameApp's animation sequencer with its own pause/defer race machinery,
// Shooter3D's enlarged front-slot visual and merge-ready preview pulse,
// ShooterRenderer's halo overlay, BenchRenderer's enlarged benched sprite, the
// isMerged/mergeColorBomb model fields, MERGE_SCALE, a dedicated sprite set, and a
// tutorial page. A partial revival would reintroduce exactly the class of bug the
// retired stash caused twice: code that still LOOKS live for a mechanic the player
// cannot reach.
//
// WHAT DELIBERATELY SURVIVED, and must not be mistaken for leftovers:
//   - QUEUE REORDER and BENCH-RETURN. These were gated behind a flag named
//     `_mergeEnabled` because lining up merges was their original purpose, but they
//     are independent mechanics (rearranging the queue, pulling a bomb back from
//     the bench). The flag is now `_reorderEnabled`; the features are untouched.
//   - projection.QUEUE_CLEARANCE_MARGIN (1.22). This WAS MERGE_SCALE, the
//     worst-case bomb radius the queue-fit solver and breach clearance were sized
//     against. The value is retained deliberately: dropping it to 1.0 would let the
//     solver grow every bomb, which is a size/FIT change needing an owner decision,
//     not a side effect of this removal.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Shooter } from '../src/models/Shooter.js';
import { GameLoop } from '../src/game/GameLoop.js';

function allSourceFiles(dir = 'src', acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) allSourceFiles(p, acc);
    else if (e.name.endsWith('.js')) acc.push(p);
  }
  return acc;
}

// Comments may still MENTION merging — that history explains why the clearance
// margin is 1.22 and why the reorder gate unlocks at L5, and deleting it would
// erase the lesson. What must never return is merge CODE.
const CODE_PATTERNS = [
  [/\bpeekMerges\s*\(/,         'GameLoop.peekMerges()'],
  [/\bevaluateMerges\s*\(/,     'GameLoop.evaluateMerges()'],
  [/\b_evaluateMerges\s*\(/,    'GameLoop._evaluateMerges()'],
  [/\b_findMerges\s*\(/,        'GameLoop._findMerges()'],
  [/\b_applyMerge\s*\(/,        'GameLoop._applyMerge()'],
  [/\b_verifyPlannedMerge\s*\(/,'GameLoop._verifyPlannedMerge()'],
  [/\b_settleStartingMerges\s*\(/, 'GameLoop._settleStartingMerges()'],
  [/\b_onMerge\b/,              'GameLoop._onMerge callback'],
  [/\b_onAutoFill\b/,           'GameLoop._onAutoFill (merge re-check hook)'],
  [/\bmergeSequencer\b/,        'GameApp mergeSequencer'],
  [/\bdrawMergeOverlay\s*\(/,   'ShooterRenderer.drawMergeOverlay()'],
  [/\bisMerged\b/,              'Shooter.isMerged'],
  [/\bmergeColorBomb\b/,        'Shooter.mergeColorBomb'],
  [/\bMERGE_SCALE\b/,           'projection.MERGE_SCALE'],
  [/\bsetMergeEnabled\s*\(/,    'DragDrop.setMergeEnabled()'],
  [/\b_mergeEnabled\b/,         'DragDrop._mergeEnabled'],
  [/\blastMerged\b/,            'Shooter3D slot.lastMerged'],
  [/powerball-merged-/,         'merged-bomb sprite'],
  [/\brefillQueue\s*\(/,        'GameLoop.refillQueue() (existed only for the sequencer)'],
];

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('the removed merge mechanic stays removed', () => {
  it('no merge CODE remains anywhere in src/', () => {
    const offenders = [];
    for (const file of allSourceFiles()) {
      const code = stripComments(fs.readFileSync(file, 'utf8'));
      for (const [re, label] of CODE_PATTERNS) {
        if (re.test(code)) offenders.push(`${file}: ${label}`);
      }
    }
    expect(offenders, `merge code is back:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });

  it('Shooter carries no merge fields', () => {
    const s = new Shooter({ color: 'Red', damage: 3, column: 0 });
    expect(s.isMerged, 'Shooter.isMerged is back').toBeUndefined();
    expect(s.mergeColorBomb, 'Shooter.mergeColorBomb is back').toBeUndefined();
    // The surviving surface is unchanged.
    expect(s.color).toBe('Red');
    expect(s.damage).toBe(3);
    expect(s.isColorBomb).toBe(false);
    // A merge field must not be settable through the constructor either.
    const s2 = new Shooter({ color: 'Blue', damage: 2, column: 1, isMerged: true });
    expect(s2.isMerged, 'the constructor still accepts isMerged').toBeUndefined();
  });

  it('GameLoop exposes no merge API', () => {
    for (const m of ['peekMerges', 'evaluateMerges', '_evaluateMerges', '_findMerges',
                     '_applyMerge', '_verifyPlannedMerge', '_settleStartingMerges', 'refillQueue']) {
      expect(GameLoop.prototype[m], `GameLoop.${m}() is back`).toBeUndefined();
    }
  });

  it('the merged-bomb sprites are not preloaded and the tutorial page is gone', () => {
    const manifest = fs.readFileSync('src/renderer/assetManifest.js', 'utf8');
    expect(manifest, 'merged-bomb sprites are being preloaded again').not.toMatch(/powerball-merged-/);
    expect(manifest, 'the merge tutorial page is back').not.toMatch(/03-merge/);
    const howTo = fs.readFileSync('src/screens/HowToPlayOverlay.js', 'utf8');
    expect(howTo, 'How-to-play teaches merging again').not.toMatch(/MERGE COMBOS|03-merge/);
  });

  it('queue reorder and bench-return SURVIVED the removal', () => {
    // These shared the merge unlock flag but are their own mechanics. If this test
    // fails, the removal went too far rather than not far enough.
    const dd = fs.readFileSync('src/input/DragDrop.js', 'utf8');
    expect(dd, 'the reorder gate is gone').toMatch(/setReorderEnabled\s*\(/);
    expect(dd, 'reorder handling is gone').toMatch(/_handleQueueReorder\s*\(/);
    expect(dd, 'bench-to-queue return is gone').toMatch(/_handleBenchToQueueReturn\s*\(/);
    const app = fs.readFileSync('src/renderer/GameApp.js', 'utf8');
    expect(app, 'GameApp no longer wires the reorder gate').toMatch(/setReorderEnabled\(/);
  });
});
