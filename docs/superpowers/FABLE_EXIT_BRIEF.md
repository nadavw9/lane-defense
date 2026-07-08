# Fable Exit Brief — read this before touching WS3

Written by Fable, 2026-07-08, for whichever model continues this session. Not a tutorial —
watch-outs and decisions a cheaper model will not derive from the code alone.

---

## 1. Codebase traps

**Projection-coordinate bug class.** `src/renderer3d/projection.js` is the ONLY place screen
math may live. Past incident: a hardcoded `FRUSTUM_HALF_X = 9.650` silently drifted ~17px off
the real camera frustum after a road-length change, and every 2D overlay/tap anchor was wrong
for weeks before the visual harness caught it. Rule: if you write a numeric screen coordinate
that could instead be derived from `projection.js`, you have already made the bug. New
conversions go IN that file, never beside it.

**The 62%-ish balance baseline is fragile, not solid.** Three independent reasons:
1. `SimulationRunner` (`src/simulation/SimulationRunner.js`) does NOT model boosters
   (SWAP/BENCH/FREEZE/COLOR CHANGE) — its AI never uses them. Real players do. So sim win-rates
   for Hard/Boss-Hard levels are a FLOOR, systematically lower than felt difficulty. Don't
   compare a sim number to "does this feel right" 1:1 — that gap is real and expected until §3b
   ships booster-aware profiles.
2. The sim always simulates 4 lanes/4 columns, even for levels that are narrower in the real
   game (e.g. L2 is 2-lane/2-col). `LevelManager.js` has hand-compensated presets for this
   (`R_L2`, hpMultiplier 0.90 — see the inline comment "L2 2-col sim bias"). If you see an
   oddly aggressive-looking preset, check for a sim-bias comment before "fixing" it — it may be
   deliberately overtuned to compensate for the sim's blind spot, not a mistake.
2b. Presets are SHARED BY REFERENCE across levels (`R_3C_MED` is the literal object used by
   L11, L14, L18 simultaneously). Editing a shared const changes every level using it. Before
   touching any `B#_*` / `R_#C_*` constant, grep which levels reference it.
3. `docs/balance-report-realistic.md` (generated 2026-05-15) is measured against an OLDER
   version of these presets — several have inline comments like "L4 only: lowered 1.80→0.90
   (outlier)" showing post-report retuning already happened. **Do not trust that report's
   per-level numbers as current** — they're a legacy directional reference only. Fresh numbers
   require a real `--runs=500 --level=all` sim run (§3f), which is expensive; don't run it
   speculatively, only as the final gate after real config changes.

**LivesManager ↔ City Repair: same save-schema migration, not two.** The hearts/lives economy
was intentionally decommissioned (`_showNoHeartsPanel` was deleted as a dead orphan this
session — see playbook §2c "RESOLVED"). `LivesManager` is still instantiated and `tick()`'d
pointlessly, and `ProgressManager` still persists `hearts`/`heartsLastDepleted`. WS3e's City
Repair needs to add a NEW `cityState` field to that same persisted object. **These must land in
ONE version bump / one migration function** — removing the hearts fields separately, then
adding cityState later, upgrades existing players' saves twice for no reason and doubles the
chance of a migration bug. Do not touch `ProgressManager`'s schema for one without doing the
other in the same commit.

**Real regression vs. load-flake.** Two Playwright specs are known to intermittently fail ONLY
under parallel-worker load: `rapid level hopping (L5→L20→L35)` (transitions.spec.js) and the
full-sweep L24/world-panel-render tests — both are texture-load timeouts, not logic bugs. They
always pass solo (`npx playwright test <file> -g "<name>" --retries=0`) and almost always pass
on retry. **Rule: if a smoke/full-sweep failure is a timeout on one of these two, or looks like
a texture/asset didn't finish loading, rerun solo before treating it as a regression.** A REAL
regression fails solo too, or produces a screenshot with something visibly wrong (misplaced
element, wrong color, missing sprite) — not just a slow load.

**Boss-level labeling conflict (found this session, not yet resolved — see §3a delta list).**
`LevelManager.js`'s own header comment lists SEVEN "boss levels" — L10, L15, L20, L25, L30,
L35, L40 (every 5th level from 10) — each with a "BOSS" design comment. `VISION.md` rule 5's
own bullet list names only FOUR: L10, L20, L30, L40 (every 10th). The user's own WS3 Task 3
wording ("L10/20/30/40") already resolves this in VISION's favor for scripted-boss-design scope
— but don't assume every code-commented "BOSS" is one of the four canonical VISION bosses. L15,
L25, L35 read as designed "mini-boss" moments in the code but are NOT in scope for the
scripted-wave treatment unless the user says otherwise.

---

## 2. Judgment vs. safe-to-delegate

**Needs a smart model (Fable/Opus):** balance TUNING numbers (what hpMultiplier/speed value
achieves a target band), boss mechanic CONTENT (what the scripted wave actually does), any
change touching `VISION.md`'s intent, DDA parameter choices, canonical-table judgment calls
(how to resolve a doc/code conflict), art direction.

**Safe to delegate (Sonnet/Haiku) once a smart model has decided the "what":** implementing a
spec that's already fully written (this playbook's §3b/§3d/§3e specs are written to this
standard — a cheap model can execute them directly), asset processing/slicing runs, screenshot
capture + visual-smoke/vitest runs, doc formatting and tracker updates, repo grep-and-report
exploration, mechanical band-fitting once target numbers are chosen (`tools/goal-search.mjs`
exists for this).

Rule of thumb unchanged from the playbook: if the spec answers "what and how," route cheap. If
the task is choosing the "what," route smart.

---

## 3. Never-violate constraints

1. **DDA (fail-streak mercy) applies ONLY to the copy of the level config passed to the
   Director at level start** (`GameApp._startLevel`, per playbook §3d). NEVER mutate
   `LevelManager`'s `PROGRESSION` entries or the shared preset constants directly — the sim and
   every other player must still see base difficulty. Confirmed correct in the existing spec;
   do not "simplify" this by editing configs in place.
2. **The simulator is the balance gate** (VISION rule 6). Any change to `LevelManager.js`,
   `CarTypes.js`, or `SimulationRunner.js` requires `node tools/balance-sim.js --level=all
   --runs=500` in band before commit. If a level fails, fix the level config — never loosen the
   simulator to make numbers pass.
3. **Screen coordinates only from `src/renderer3d/projection.js`.** No exceptions, no "just
   this once."
4. **`VISION.md` is locked.** Do not edit it without explicit user approval. If code conflicts
   with vision, the fix is to change the code — but FLAG the conflict for the user rather than
   silently picking a side when the resolution isn't obvious (see the boss-labeling conflict
   above — that one WAS obvious enough to note and move on; not all will be).
5. **Never touch `android/lane-defense-release.keystore`.** Losing it forever loses Play Store
   update ability.
6. **Every commit: vitest green (treat 1062 as a floor, it will grow) + `npm run test:visual`
   green (17+ smoke).** Full 40-level sweep only after a batch of related commits, not per-commit
   (it's ~7-8 min).
7. **No popups outside `PopupQueue`. No lane/column position math outside `PositionRegistry`.**

---

## 4. Where the actual design specs live

`docs/superpowers/plans/IMPLEMENTATION_PLAYBOOK.md` §4 (WS3) already contains Fable-level specs
for §3b (booster-aware sim), §3d (DDA exact spec), §3e (City Repair schema + hooks + file/line
pointers). Those are written to the "cheap model can execute directly" standard — do not
re-derive them, follow them. Only §3a (canonical table, in progress) and §3c (boss content)
needed fresh judgment, which is what this session is spending its budget on.
