# THREE-LANE REDESIGN — execution spec (Fable exit, 2026-07-22, amended 2026-07-23)

Written for a Sonnet-class session to execute WITHOUT re-deriving design judgment. Same
contract as `GEOMETRY_MECHANICS_BATCH.md`: this is an EXECUTABLE spec (what to build, which
files, how to verify, what NOT to touch) — the design decision is made and closed. Read
`docs/superpowers/SESSION_HANDOFF.md` first if you haven't; this doc builds directly on its §2
findings and doesn't re-derive them.

**Standing rules unchanged:** one commit per logical change, full validation recipe before
each (§7 below), screenshots to `docs/review/` per the standing workflow, user review gate
before every commit, push → `gh run watch` to REAL deploy-green.

**2026-07-23 amendment:** two changes from the user before any code lands: (1) `VISION.md` is
the user's own decision, not something that rides along in a code commit — it's now a
standalone amendment (§0a), approved on its own, separate from any implementation commit. (2)
Sim-in-band is not sufficient for the 4 canonical bosses — added §4, a hard play-test gate for
boss IDENTITY, not just win rate.

---

## 0. THE DECISION — settled, do not re-open

**Go all-in on 3-lane. Convert all 37 currently-4-lane levels (L4–L40). Do not do a partial
rollout. Do not go further than 3-lane (no 2-lane, no per-world lane variation) without new
evidence.**

Reasoning, for anyone who picks this up without the full arc in memory:

- Every cheap lever is proven exhausted (bomb-queue compaction +2.5%, frustum/brightness
  tricks, both dead ends — see `SESSION_HANDOFF.md` §1). The sister's verdict ("both" — not
  big enough AND not spaced enough) closes off the remaining "maybe it's readability, not
  size" hope. 3-lane is the only lever left that is both (a) proven by a real render, not a
  projection, and (b) large enough to matter.
- **Partial rollout is self-defeating.** The complaint is "the game" feels small, not "some
  levels." Shipping 3-lane on 5 levels and 4-lane on 35 creates a worse problem than today:
  cars visibly change size mid-game, which reads as a bug, not a fix. If we're paying the
  retune cost at all, pay it everywhere.
- **Going further than 3-lane (2-lane, etc.) is unproven and unnecessary.** Nobody has
  rendered or measured 2-lane. The game's pitch is "reading the board 3 moves ahead" — fewer
  lanes reduces the puzzle's information density, and at some point that stops being "bigger
  cars" and starts being "a simpler game." 3-lane already clears the growth target with real
  margin (37.6px panel vs. 40.7px shipped, at the Phase 1 pilot's locked band=730 — see §1;
  **680 was carried forward from the prior investigation as a strong prior and did NOT hold up
  under precise measurement — it only delivered 1.25× car growth, short of the 1.3× target; 730
  is the value Phase 1 actually validated and shipped in the pilot**). There is no evidence
  2-lane is needed, and reaching for it now would be solving a problem we haven't measured. If
  3-lane ships and the sister STILL says "too small," that's the trigger to investigate 2-lane
  with the same render-first discipline used here — not before.
- **This is not architecturally risky**, which is why "go big" is the right call rather than
  another cautious increment: the rendering/input layer needs zero rework (DragDrop,
  ShooterRenderer, Shooter3D, PositionRegistry, GameLoop, GameState already key off
  `activeLaneCount`/`activeColCount`, proven live today by L1/L2/L3). The entire cost is
  content re-tuning using knobs (`spawnBudget`, `hpMultiplier`, `speed.base`) that are already
  the standard difficulty levers for all 40 levels today. This is a large but mechanical
  effort, not a novel-risk one.
- **A nice side effect:** today the tutorial ramp goes 1→2→3 lanes (L1→L2→L3) and then jumps
  to 4 at L4 — an inconsistency baked into the current game. Converting L4–L40 to 3-lane makes
  the ramp 1→2→3→3→3…→3, which is *more* consistent, not less.

---

## 0a. VISION.md amendment — standalone, the user's call, not a code-commit rider

`docs/VISION.md` is a LOCKED contract ("Status: LOCKED. Do not modify without explicit user
approval"). Its opening line reads *"Players scan 4 lanes, see danger approaching…"* — the only
place in the file that names lane count (confirmed by reading the full document; no other
line needs to change). This sentence becomes false the moment L4 ships at 3-lane, so the edit
is necessary eventually — but it is **the user's decision to make on its own terms, not a diff
bundled into a code commit for convenience.**

**Exact proposed wording:**

```diff
- Players scan 4 lanes, see danger approaching, and sequence their bomb queue
+ Players scan 3 lanes, see danger approaching, and sequence their bomb queue
```

**Process:** this amendment is proposed and approved standalone, independent of Phase 1's
`projection.js` work and independent of any level conversion. It does **not** get committed
together with the band-lookup change or any level-config change — if/when the user approves it,
it lands as its own commit with its own message (e.g. `docs: VISION.md — 4 lanes → 3 lanes
(pending 3-lane redesign)`), on its own schedule. Implementation of Phase 1 onward proceeds
against whatever `VISION.md` currently says; it does not require this amendment to have landed
first, but no phase should ship game-facing 3-lane content to players while `VISION.md` still
contradicts it — get this approved before Phase 2's pilot goes out for the sister's device
verdict, even if Phase 1's geometry-only groundwork lands first.

---

## 1. Phase 1 — Geometry: lock the band value

**RESULT (2026-07-23, executed as part of the pilot): band = 730, not 680.** Precise math
(`PX_PER_WU` at band=680 ÷ `PX_PER_WU` at shipped band=540) showed 680 gives only **1.25×** car
growth — short of the 1.3× target — contrary to the prior investigation's "comfortably clears"
read, which had conflated panel-width margin with the actual growth ratio. A finer sweep
(700/710/715/720/725/730/735/740/750) found growth crosses 1.3× at band≈710 (1.3038×, no real
margin) and clears with margin by band=730 (1.3384×, +3.8pp over target) while panel width
(37.6px) stays well clear of the 33.6px danger zone that caused the historical L35 CI brightness
regression. 730 was verified against the REAL fixed-median brightness sampler
(`tests-visual/smoke/worlds.spec.js`, using L5 — now in the pilot — as the World-1 case) and
passed at `minBrightness=12` with margin. See §7a — the band value was the easy part; making it
actually render correctly took two separate production-bug fixes.

**Goal:** determine and lock the `DESIGN_ROAD_BOTTOM_Y` ("band") value that 3-lane levels will
render at, empirically, not by copying the 680 demonstration number blind.

**Key architectural decision for this phase (new, not in prior docs):** band must NOT become a
single global constant re-pointed at 680. If it did, every currently-4-lane level would break
the moment this commits, forcing a risky flag-day conversion of all 37 levels in one shot. This
project's own investigation methodology (`SESSION_HANDOFF.md` §4) already treats lane count as
a first-class dynamic per-level input — this phase does the same for band:

- Replace the single `DESIGN_ROAD_BOTTOM_Y` constant in `src/renderer3d/projection.js` with a
  small lookup keyed on `activeLaneCount`, e.g. conceptually:
  `bandForLaneCount(activeLaneCount)` returning **540 for 1/2/4-lane** (unchanged, current
  shipped value) and the **new validated value for 3-lane**. `computeFrustum()` already
  receives lane-count-derived inputs (`roadHalfWPure(activeLaneCount)` per the handoff) — wire
  the band lookup in alongside that, at whatever the actual call site looks like.
  - **You have not been given the literal current contents of `projection.js` in this spec** —
    the design-crystallization pass that produced this doc worked from architectural summaries
    only, to conserve tokens. Read the file yourself before implementing; confirm
    `computeFrustum()`'s actual signature and where `DESIGN_ROAD_BOTTOM_Y` is consumed, and
    wire the lookup to match the real code, not an assumed shape. The single-source-of-truth
    principle is the hard requirement — however you wire it, every screen-space computation
    must still trace back to one function.
  - This is what makes the phased rollout in §3 safe: 4-lane levels keep rendering exactly as
    they do today (band 540) while 3-lane levels get the new value, with no cross-talk, right
    up until the last 4-lane level converts and the 4-lane branch of the lookup becomes dead
    code (delete it then, not now).

**Determining the value — sweep methodology (reuse this project's established pattern):**
temporarily patch `LevelManager.js` to force L13 (the level already used in the proof render)
to `laneCount: 3, colCount: 3`, spin up an isolated throwaway `vite` dev server on a scratch
port (fresh process per value — the batch doc's own finding: reusing one hot-reloading server
gives non-monotonic readings), screenshot/measure via Playwright, revert everything in a
`finally` block. Script under `scripts/_*.mjs`, delete when done, never commit.

Sweep `band ∈ {620, 650, 680, 710, 740}` (680 is the known-good demonstration point — start
there, only search wider if it fails a check below). At each value measure:

1. **Car growth.** On-screen height in px of a fixed reference car (sedan, row 0, lane-center)
   vs. the same measurement at the CURRENT SHIPPED baseline (3-lane not yet applied, band 540,
   4-lane road, i.e. today's live game — the ~1.04× state the sister already rejected).
   **Target: ratio ≥ 1.3×.** This is growth *beyond* what she already said was too small, which
   is the number that actually has a chance of moving her verdict — not 1.3× over some older
   pre-1.04× baseline.
2. **Side-panel width**, both sides. Sanity check only (not the primary target) — confirms
   panels stay visually present. Shipped reference: 40.7px at 4-lane/band-540.
3. **Side-panel brightness**, all 3 world themes (morning/industrial/night), using the FIXED
   5-point median sampler from `tests-visual/smoke/worlds.spec.js` (commit `32956ca` — do not
   use the old single-point sampler, it's the one that was proven flaky). Must clear
   `minBrightness=8` **with real margin** — the L35 regression that shipped and got caught by
   CI swung between 8.85 (pass) and 7.25 (fail) on states that looked similar, a ~1.6-unit
   swing from sampling luck alone even after the fix reduces that noise. **Require measured
   brightness ≥ 9.5** at every sample point, every theme, not just clearing 8.0 nominally.
4. **Bomb-queue vertical clipping.** Visual check — all queue slots fully on-screen, nothing
   cut off at the bottom edge.

Pick the **smallest** band value that clears all four checks with margin (not the biggest that
technically passes — avoids the `MIN_STRIP_PX`-clamp edge case flagged in the original
car-size-ceiling report, whose risk zone starts around band≈560-600 for 4-lane; 3-lane's
equivalent risk zone hasn't been computed, so don't approach it needlessly). If 680 clears
everything with margin, use 680 and stop — no need to search further.

**After locking the value:** spot-check L1 (1-lane) and L2 (2-lane) still render correctly
(they stay on the 540 branch of the lookup in this phase, so this should be a no-op, but verify
— don't assume). Run the byte-identity sim check from `GEOMETRY_MECHANICS_BATCH.md` §0b
(`for l in 5 13 20 30; do node tools/balance-sim.js --level=$l --runs=300; done`) — **for
levels still at 4-lane, this must be byte-identical to today's baseline** (L5 90.0 / L13 79.7 /
L20 43.0 / L30 46.3 @ 300 runs), since band on the 4-lane branch is unchanged. This confirms the
lookup wiring didn't leak into the 4-lane path.

**Commit:** the `projection.js` lookup change ALONE, its own commit, after user reviews the
sweep screenshots and the locked band value. **Do not bundle the `VISION.md` edit into this
commit — that's §0a, standalone, on the user's own approval.** This commit alone changes
nothing visible yet (no level is on the 3-lane branch until Phase 2) — it's safe to land ahead
of any level conversion, and ahead of the `VISION.md` amendment landing too.

---

## 2. Phase 2 — Pilot batch: L4–L8, prove the retune methodology cheaply

**Goal:** convert the first 5 post-tutorial levels, prove the sim-driven retune loop works and
produces a game that still feels like the intended difficulty wave, and get this in front of
the sister on a real device BEFORE spending the effort retuning the other 32 levels. This is
the same "propose, render, prove" discipline the whole arc has used — don't commit to 32 more
levels of retuning until the pilot's verdict is in.

**Why L4–L8 specifically:** it's the first full post-tutorial slice (L1–3 stay untouched), it's
cheap (5 levels), and it already spans 4 of the 4 difficulty tiers per the canonical table —
Hard (L4), Easy-relief (L5), Medium (L6), Hard (L7), Boss-Hard (L8) — so a methodology problem
would likely surface here rather than only showing up 30 levels in. None of L4–L8 is a
canonical boss (those are L10/20/30/40), so the boss-identity gate in §4 does not apply to the
pilot — it starts in Phase 3.

### 2a. The retune algorithm (apply to every level in every phase, not just this one)

For each level being converted:

1. Set `laneCount: 3, colCount: 3` (from whatever it is today — 4 for L4–L40). Leave every
   other field (`gridRows`, palette, goals, `hpMultiplier`, `speed.base`, `spawnBudget`,
   `laneTargetCarCount`, duration) untouched as a baseline.
2. Run `node tools/balance-sim.js --level=N --runs=300` (300 for fast iteration; 500 is the
   final gate before commit per VISION rule 6). Naive 3-lane baseline numbers are already known
   for L5/L13/L20/L30 (`SESSION_HANDOFF.md` §2 table: +10 to +44 percentage points over
   shipped) — expect every level to come in similarly too-easy; that's the known, expected
   starting point, not a surprise to re-diagnose.
3. **Target band: use `bandFor(levelId)` in `tools/balance-sim.js` verbatim — NOT the generic
   Easy/Medium/Hard/Boss-Hard tier table in `GAME_DESIGN.md`.** An earlier draft of this spec
   mapped `GAME_DESIGN.md`'s descriptive tier labels (e.g. "L4 Hard," "L8 Boss-Hard") onto that
   generic table — wrong. The tier labels are flavor/design-intent text; the band the sim
   actually enforces, and the one every shipped level is already tuned against (confirmed by
   reading `LevelManager.js`'s own inline comments — L4/L5/L7/L8 all carry "~92–93%" retune
   notes), is **position-based**, from `tools/balance-sim.js`'s `bandFor()`:

   | Levels | Target win rate |
   |---|---|
   | L1–3 (tutorial) | exempt (~100%, no losing mechanism by design) |
   | L4–9 (FTUE) | 85–95% |
   | L10–26 non-boss (mid) | 70–82% |
   | L27–40 non-boss (late) | 60–75% |
   | L10/20/30/40 (canonical bosses) | 40–55% (booster-aware default profile) |

   For the pilot (L4–L8): **every level targets the same 85–95% FTUE band** — there is no
   per-level tier variation within this slice. Don't be surprised that L4 ("Hard" in
   `GAME_DESIGN.md`'s prose) and L8 ("Boss-Hard" in the same prose) share one target; the prose
   tiers describe difficulty-wave FEEL within the block, the sim band describes the actual
   pass-rate contract, and for L4–9 that contract is uniform.

4. If win rate is above the target band (it will be, for every level, initially), add pressure
   in this order, re-running the sim after each step:
   a. **CORRECTED 2026-07-23, verified against the pilot's actual runs — read before applying
      to Phases 3-6:** `spawnBudget` was originally specified as the first lever here, on the
      assumption it's the primary density knob (per `GAME_DESIGN.md`'s "dens" column framing).
      **This does not hold in the current `SimulationRunner` implementation.** Sweeping L4's
      `spawnBudget` from 8 to 48 in steps of 2 produced ZERO change in win rate (99.7% at every
      value) — `SimulationRunner._refillLanes()` tops every lane up to `laneTargetCarCount` on
      every advance with no budget gate; the `spawnBudget`-derived `totalBudget` variable in
      that file is effectively vestigial for this purpose (comment there literally says "No
      budget limit — lanes refill indefinitely to match goal-based play"). **Use
      `laneTargetCarCount` as the first, primary lever instead.** All 5 pilot levels (L4-L8)
      converged on `laneTargetCarCount: 2→4` to land in-band — roughly double, compensating for
      one fewer lane. Confirm this still holds for whatever level you're tuning (don't assume
      4 is universal — it was verified for L4-L8's specific starting configs, re-derive per
      level via the sim) before trusting it blind for L9-L40.
   b. If `laneTargetCarCount` alone would need to grow enough to push standard deviation above
      25% of mean shots, or produce any unwinnable seed in 500 runs, add **`hpMultiplier`** next
      (shots-per-kill pressure — appropriate for Hard/Boss-Hard tiers, whose stated design
      intent already leans on multi-shot planning).
   c. **`speed.base`** is last resort — and per the same `SimulationRunner` comment as above,
      "speed.base has NO effect" on the sim's own win-rate number at all (the sim is turn-based,
      not real-time), so it cannot be used to hit the band numerically regardless of tier. It
      still matters for real-device FEEL (breach timing is real-time in the live game even
      though the sim abstracts it away), so don't ignore it for player experience — just don't
      expect it to move the sim number, and still skip it for levels whose documented identity
      is explicitly NOT reflex-based (L10 "Bench Test" and L30 "Industrial Finale" are planning
      puzzles per `GAME_DESIGN.md`'s boss specs).
5. Stop when win rate is inside the target band AND std-dev < 25% of mean shots AND 0
   unwinnable seeds in 500 runs (the existing `GAME_DESIGN.md` "Simulation-Driven Balancing"
   targets — unchanged by this project).
6. **Check block-level shape, not just the individual level's number.** After retuning a full
   block, sanity-check that win rate still falls easy→medium→hard→relief→harder across the
   block the way it did before (GAME_DESIGN.md rule 3, "difficulty is a wave, not a ramp") — a
   level landing exactly in its target band in isolation can still break the wave shape if its
   neighbors shifted differently. Eyeball the sequence, don't just check each number in
   isolation.
7. Record every delta as an inline config comment (old value → new value → why), matching the
   project's existing convention (e.g. L4's "hp lowered 1.80→0.90 historically (outlier)").
   **Do NOT blindly copy the four documented "deliberate outlier" corrections (L2/L4/L16/L24,
   `GAME_DESIGN.md` §3a D4)** — those were tuned for 4-lane dynamics (e.g. L2's "2-col sim
   bias"). Re-derive each through the same sim loop under 3-lane; if a level lands in-band
   without needing a special-case correction anymore, drop it and say so in the comment (the
   3-lane geometry may have simply removed the underlying bias that motivated the original
   outlier fix).

### 2b. Pilot-specific notes

- L8 is Boss-Hard tier but NOT one of the 4 canonical VISION bosses (`GAME_DESIGN.md` flags
  this explicitly) — use the 20–35% tool-less band for it, not the 40–55% booster-aware band
  reserved for L10/20/30/40.
- Screenshot L4–L8 boards post-retune, one commit for the whole pilot batch (5 levels is small
  enough to land together, unlike the "one boss per commit" rule for the larger canonical-boss
  work later).
- Sim check: run `--runs=500` on all 5 pilot levels before commit (VISION rule 6).

**Checkpoint — do not proceed to Phase 3 without this:** get the pilot batch in front of the
sister on a real device. Her verdict gates the remaining 32-level effort:
- **"Good now"** → proceed to Phase 3, convert the rest.
- **"Still not enough"** → STOP. Do not spend Phase 3–6 effort on more of the same lever. This
  is the signal to open the 2-lane investigation (render-first, same discipline as this whole
  arc) or reconsider the growth target itself, before touching L9–L40's balance.
- **"Better, but something else feels off"** (e.g. spacing improved but a different complaint
  surfaces) → treat as a new investigation, don't assume Phase 3–6 will fix it by extrapolation.

---

## 3. Phases 3–6 — Full rollout, block by block

**Only start these after the pilot checkpoint clears.** Same algorithm as §2a, applied to the
remaining levels in ~8-level chunks, one commit-and-review cycle per chunk (matches the "ONE
COMMIT PER ITEM" / "one boss per commit" discipline already established for the canonical
bosses):

- **Phase 3: L9–L16** — includes canonical boss L10 ("The Bench Test") and mini-boss L15.
- **Phase 4: L17–L24** — includes canonical boss L20 ("The Surge").
- **Phase 5: L25–L32** — includes canonical boss L30 ("Industrial Finale").
- **Phase 6: L33–L40** — includes canonical boss L40 ("Grandmaster Finale").

For each phase: apply §2a per level, check block shape, screenshot, sim-verify at `--runs=500`,
**for the canonical boss in that phase, also clear the §4 boss-identity play-test gate before
committing**, user review, commit, push, `gh run watch` to deploy-green — **before starting the
next phase**. Bisection matters if a band regresses; don't batch multiple 8-level chunks into
one commit.

**Canonical bosses (L10/20/30/40) — explicit scope note:** `GAME_DESIGN.md` already has a
separate, not-yet-built spec for these four ("Boss Design — Scripted Waves," INFRA-A/B/C,
`spawnScript`, per-boss identity/wave design). **That project is out of scope here.** For this
redesign, treat L10/20/30/40 with the same generic §2a algorithm (spawnBudget/hp) as any other
level — do not block this work on building INFRA-A/B/C first, and do not attempt to design
their scripted waves as part of this batch. Whoever eventually builds the scripted-wave project
on top of this should just re-run the sim bands afterward; `spawnScript`/`CarDirector` already
consumes `cfg.laneCount` transparently per the handoff, so no special interaction is expected,
but it hasn't been verified and isn't this batch's job to verify. **§4's play-test gate applies
regardless of whether INFRA-A/B/C exists yet** — even the current, non-scripted versions of
these bosses have hand-built identity (L10's color-clustered `initialCars`, per
`GAME_DESIGN.md`) that a numeric retune can silently break.

**Once Phase 6 lands, L1–L40 are entirely off the 4-lane band branch.** Go back to
`projection.js` and delete the now-dead 4-lane entry in the band lookup (§1) — the "540 for
1/2/4-lane" case becomes "540 for 1/2-lane," and note in a comment that 4-lane is retired, not
silently drop the case (someone debugging six months from now shouldn't have to reconstruct
why 4-lane vanished from a lookup table).

---

## 4. Boss-identity review gate (NEW, 2026-07-23) — required for the 4 canonical bosses

**Sim-in-band is necessary but not sufficient for L10/L20/L30/L40.** Each canonical boss
(`GAME_DESIGN.md` "Boss Design — Scripted Waves") has a designed IDENTITY — a specific intended
solution the player is meant to discover — and that identity can depend on lane-count-specific
math, not just on aggregate win rate. Retuning `spawnBudget`/`hpMultiplier` to land a boss in
its 40–55% booster-aware band can succeed numerically while silently destroying the identity —
the sim measures OUTCOMES, not whether the intended solution is what produced them. This is the
same class of blind spot that caused L10 v1 to read harder in the sim than it actually played:
an unmodeled mechanic distorted the number without the board itself having a problem. Here the
risk runs the other way — the number can look fine while the board's puzzle has quietly
changed.

**Specific known risks (not exhaustive — review every boss fresh; absence of a flagged risk
below is not evidence a boss is safe):**

- **L10 "The Bench Test."** Its identity is pigeonhole math: 2 colors spread over 4 lanes means
  a bomb almost always finds a same-color car UNLESS the board is deliberately color-clustered
  (today: lanes 0&2 all-Blue, lanes 1&3 all-Red, per the v1 `initialCars` spec in
  `GAME_DESIGN.md`) — that clustering is what forces the bench. At 3 lanes, the same 2-color
  palette over one fewer lane changes the match probability the lock is built on. The lock could
  get weaker (fewer lanes to keep off-color, easier to accidentally line up a match) or stronger
  (less room to hide a matching lane at all) — don't assume a direction, measure it by playing
  it. If the clustering pattern needs to change for 3 lanes, or if a queue-side color-bias knob
  (confirm the actual mechanism and field name in `ShooterDirector`/level config at
  implementation time — do not assume it is literally named `shooterColorWeights`, that's a
  description of the concept, not a verified API) needs retuning to preserve the lock's bite, do
  that here. A version of L10 that's in-band but no longer forces a bench is not ready.
- **L40 "Grandmaster Finale."** The 3-stage pincer (bike swarm → truck wall → tank/bigrig
  pincer) is designed around 4-lane spawn pressure filling the board across lanes in sequence.
  At 3 lanes the same stage weights may crest differently — review whether the staged identity
  (reflex → bench/streak → color-bomb/freeze) still reads as intended in play, not just whether
  the final win rate landed in band.
- **L20 "The Surge" and L30 "Industrial Finale"** have no specific known risk flagged here — review
  them with the same rigor anyway. The whole point of this gate is that identity drift isn't
  something the sim surfaces; not having pre-identified a risk is not evidence one doesn't
  exist.

**Hard requirement, gates each boss's Phase 3–6 commit:** after sim-retuning a canonical boss
into its target band, **PLAY it** — via the dev server, a real manual run, not a simulated one
— and confirm:

1. The intended solution (bench for L10, freeze-timing for L20, multi-shot tank planning for
   L30, the staged mechanic sequence for L40) is still the thing that actually gets you through
   the level, not incidentally winnable while ignoring it.
2. The board still visibly presents its puzzle (e.g., L10's color clustering is still obvious
   lane-to-lane at 3 lanes, not diluted into noise).

If a boss is in-band but its identity has drifted, retuning is not done — keep adjusting the
identity-carrying knob (clustering pattern, stage weights, whatever governs the lock for that
boss), re-sim, re-play, until both the band AND the identity check pass. Landing in the win-rate
band is a necessary condition for that boss's commit to be ready for review, not a sufficient
one.

---

## 5. Cross-dependency check — side-building siding art

`GEOMETRY_MECHANICS_BATCH.md` §4 (the single non-repeating siding sprite work, if it has
shipped by the time this lands) computed its art aspect ratio (40.7px × ~551px, ≈1:13.6) **at
`DESIGN_ROAD_BOTTOM_Y=540`**, with an explicit note in that doc: *"if §0a's band value ever
changes, re-run this calc, don't reuse these numbers."* This redesign changes the band for
every level once Phase 6 completes. Before Phase 6's commit:

- Check whether that siding-art work has shipped (grep `CityEdges` / `assetManifest` for the
  `STRIP-family` sprites, or check git log for the `siding-world{1,2,3}` filenames).
- If it has shipped: recompute the side-strip on-screen aspect ratio at the new locked band
  value (§1) for 3-lane levels, and re-crop/re-export the siding sprites to match — the
  existing 128×1792 crop was sized for the old, narrower panel geometry and will look distorted
  or under-filled at the new, wider 3-lane panel width.
- If it hasn't shipped yet: no action needed now, just flag it in the Phase 6 commit message so
  whoever builds that feature later starts from the new band value, not the stale 540-based
  numbers still sitting in the batch doc.

---

## 6. Files touched (summary)

- `src/renderer3d/projection.js` — replace single `DESIGN_ROAD_BOTTOM_Y` constant with a
  lane-count-keyed lookup (Phase 1). New unit test asserting the lookup returns the correct
  value per lane count (this is new production logic, not just data — needs a real test, not
  just the sim/visual-smoke checks that cover config-only changes).
- `src/game/LevelManager.js` — `laneCount`/`colCount` 4→3 plus retuned `spawnBudget`/
  `hpMultiplier`/`speed.base` per level, L4–L40 (Phases 2–6, one phase per commit). For
  L10/20/30/40 specifically, may also touch whatever field carries the boss's identity-specific
  configuration (e.g. `initialCars` clustering for L10) — see §4.
- `docs/VISION.md` — one line, "4 lanes" → "3 lanes" — **standalone amendment, §0a, its own
  commit, on the user's own approval, never bundled with a code change.**
- `docs/GAME_DESIGN.md` — update the canonical table's header note ("All levels are 4-lane/4-col
  EXCEPT L1/L2/L3" → "All levels are 3-lane/3-col from L4 onward, EXCEPT L1 (1×1), L2 (2×2), L3
  (3×3)") and every changed `hp/spd`/`dens` cell, after each phase lands — keep this doc in sync
  phase by phase, not as one giant diff at the end.
- Possibly `public/sprites/designed/siding-*` + `CityEdges` art integration — conditional, see
  §5.
- **NOT touched:** `tools/balance-sim.js` / `SimulationRunner` (already correctly consumes
  `cfg.laneCount` per level, confirmed in `SESSION_HANDOFF.md` §4 — no code change needed
  there). Rendering/input files (`DragDrop.js`, `ShooterRenderer.js`, `Shooter3D.js`,
  `PositionRegistry.js`, `GameLoop.js`, `GameState.js`) — already dynamic, proven live by
  L1–L3, zero rework required. `gridRows` per level — untouched by this redesign; it's a
  separate axis (row/breach-turns) from lane/col (road-span), and the already-rejected
  low-gridRows flood-break finding (`GEOMETRY_MECHANICS_BATCH.md` §0a) is irrelevant here.
  Boss `spawnScript`/INFRA-A/B/C work — separate, not-yet-built project, out of scope (§3).

---

## 7. Validation recipe (every phase)

Same recipe as `GEOMETRY_MECHANICS_BATCH.md` §5, unchanged, plus §4's play-test gate for any
phase containing a canonical boss:

`npx vitest run` → full local `tests-visual/smoke` suite (`npx playwright test
tests-visual/smoke`; run `scripts/kill-browser.bat` first if zombie Chrome processes have piled
up) → sim check at `--runs=500` for every level touched in the phase, confirm each is inside
its target band from §2a → **for L10/20/30/40, also clear the §4 manual play-test identity
gate** → screenshots to `docs/review/` (wipe + `00-labels.txt` per the standing workflow) →
user review → commit → push → `gh run watch` to REAL deploy-green (confirm the actual run — the
car-size arc's own history shows vitest + sim + manual renders can all pass locally while a
real regression ships; only the full CI visual-smoke run is trustworthy).

## 7a. Real bugs found during pilot execution (2026-07-23) — not hypothetical, read before Phase 3

Making band lane-count-keyed (§1) is architecturally simple in isolation, but this codebase has
years of code that assumed band was a true constant and cached derived values from it at
**module-load time** instead of computing them live. Two bug classes surfaced, both would have
shipped silently broken if the pilot had stopped at "sim is in-band, ship it":

1. **Frozen 2D-chrome geometry constants.** `PositionRegistry.js`'s `LANE_HALF_PX`,
   `roadGeometry.js`'s `ROAD_BOTTOM_Y`/`ROAD_HEIGHT`/`POS_TOP_Y`/`POS_HEIGHT`/
   `FRONT_ROW_TAP_MARGIN`, and `CityEdges.js`'s `ROAD_H` were all `const`, computed once at
   import time from projection.js's (formerly-constant, now-mutable) band. Real, measurable
   consequences on 3-lane levels: lane hit-test bounds narrower than actual lane spacing
   (dead zones up to ~25px between lanes, drag-deploys missing the outer lane), the breach
   stripe drawn at the pre-band-change Y (misaligned with where cars actually stop), and
   city-edge buildings/trees positioned against the wrong panel height. Fixed by converting
   these to `let` + explicit recompute functions (`recomputeRoadGeometry()`, `recomputeRoadH()`),
   called from the same per-level choke point right after `gameRenderer3D.setActiveLaneCount()`
   in `GameApp.js` (see the inline comments there and in each fixed file for the exact
   ordering — it matters).
2. **`CameraFX.js`'s frozen camera resting position — the worse one.** `CameraFX`'s constructor
   captured `camera.position` ONCE (`this._baseP = camera.position.clone()`), and its per-frame
   `update()` unconditionally reset the camera to `_baseP` (+ shake offset) every single frame.
   `setLaneCount(n)` was a documented no-op ("frustum adapts in Scene3D; nothing to do") — true
   before this project, false after: Scene3D correctly computed the new per-level `zCenter`, but
   CameraFX silently reverted it every frame. Symptom: cars existed in game state, correctly
   positioned in world space, but **nothing rendered on screen at all** — a completely empty
   road — on every 3-lane level (this pilot's L4-L8, and, as a spillover, L3, which shares the
   same lane-count-keyed band despite not being explicitly touched by this pilot — see the
   note below). Root-caused by direct Three.js scene/camera inspection (`camera.position` vs.
   the value `computeFrustum()` actually returned), not by staring at coordinates — the
   discrepancy between the two was the tell. Fixed: `CameraFX.setLaneCount(n)` now re-captures
   `_baseP` from the camera's CURRENT position, and relies on being called after
   `Scene3D.setLaneCount()` in the existing call order (confirmed, not assumed).

**L3 spillover, explicitly flagged, not hidden:** band is keyed purely on `activeLaneCount`, and
L3 has always shipped at 3 lanes (config unchanged by this pilot). It therefore automatically
picks up band=730 too, as an architectural consequence, not a scope decision — L3's own
`worldConfig` was never retuned. This is very likely benign (L3 is documented as "no losing
mechanism by design, ~100% win rate," so it has no win-rate contract to break, and it now gets
the same validated-safe 3-lane geometry L4+ will ship with — arguably a consistency win per §0's
"nice side effect" point) but it was not requested and should be called out explicitly in
review, not discovered later.

**Test suite also needed real updates, not just number bumps** — `tests-visual/fixtures/game.js`
had its own SEPARATE, Node-process-side import of `projection.js` (`rowToStageY`) that shared
the same frozen-at-load bug class; several `tests-visual/smoke/*.spec.js` tests hardcoded L5's
former 4-lane identity (lane 3 as "rightmost," win-detection heuristics that broke once
`laneTargetCarCount`'s increase made refill-after-kill fast enough to mask a kill inside the
test's own read window); and `tests/audit-level-config.test.js` /
`tests/regression-level-start.test.js` hardcoded the old `laneTargetCarCount` ceiling/formula.
All updated — see each file's inline 2026-07-23 comments for specifics.

## 8. Open items ledger

- **STATUS as of 2026-07-23:** Phase 1 (band lookup + lock) and Phase 2 (L4–L8 pilot retune)
  are IMPLEMENTED locally — not committed, not pushed, nothing shipped. `npx vitest run` and
  the local `tests-visual/smoke` suite are green (one pre-existing timing-sensitive flake on
  `L5: deploying into lane i`, confirmed non-blocking — passes on retry, unrelated to any
  geometry issue). Waiting on: user approval of the VISION.md wording (§0a), user review of the
  sim table + screenshots, then the sister's device verdict (§2 checkpoint) before Phase 3.
- **Pilot verdict pending** (§2, checkpoint): the sister's read on L4–L8 at 3-lane gates
  whether Phases 3–6 happen at all.
- **Band value: locked at 730, not 680** (§1's RESULT note) — the 680 number carried forward
  from the prior investigation did not survive precise measurement (only 1.25× growth, short of
  1.3×). Don't reuse 680 anywhere downstream; 730 is the shipped, validated value.
- **Retune lever: `laneTargetCarCount`, not `spawnBudget`** (§2a's CORRECTED step 4a) —
  `spawnBudget` was verified to have zero effect on win rate in the current `SimulationRunner`.
  Re-verify this holds for each level in Phases 3–6 rather than assuming it's universal.
- **Two real production bugs found and fixed during Phase 1/2 execution** (§7a) — frozen
  2D-chrome geometry constants (PositionRegistry/roadGeometry/CityEdges) and a frozen
  CameraFX resting position that made 3-lane levels render with zero visible cars. Both are
  now fixed via live recomputation triggered from the existing per-level choke points. Anyone
  touching camera/geometry code in Phases 3–6 should read §7a before assuming "it's just a
  config change."
- **VISION.md amendment** (§0a) is a standalone approval, not a hard blocker on Phase 1's
  commit — but it must land before Phase 2's pilot goes to the sister for a device verdict, so
  the contract never contradicts what's shipping to a real player.
- **Boss-identity gate** (§4) is new and unvalidated as a process — the pilot (Phase 2) doesn't
  exercise it (no canonical boss in L4–L8), so Phase 3 (first boss: L10) is also this gate's
  first real test. If it turns out to be too vague to act on in practice, tighten it before
  Phase 4 rather than skipping it for L20/30/40.
- If the pilot verdict is "still not enough," the next investigation (2-lane, or something
  structurally different) is explicitly NOT scoped by this document and needs its own
  render-first investigation before any spec gets written for it.
