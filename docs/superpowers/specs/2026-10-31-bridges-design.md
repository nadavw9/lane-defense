# Bridges, demonstrations instead of notices, a bench that fills — design (2026-10-31)

Owner, 31 Oct 2026, after a friend reached L10 ("easy, repetitive, no thinking") and after
watching testers skip every card: *"Is there a case where a shot on one lane also hits the lane
next to it? We must assume people forward every explanation without reading, and anything that is
not understood on the board is a problem (the number at the side, how far you got, is not
understood). Let's do it differently: for two cars to be hit you must CREATE A LINK between them
(guided). In two adjacent lanes whose cars are the same colour you can make a link; then hitting one
hits the other. There is also a bug: only two bombs go into the slots. Making the link needs a UI
sign in the game."* Then: drag gesture; not necessarily the front cars; a speeder ("turbo") on only
one of them should break the bridge, so with a speeder you bridge when one is in front and shoot at
once; a triple bridge is allowed; the level should NOT be passable without bridging, so speeders
should be more frequent; all notices become demonstrations and everything on the board must be
understood; fix the bug; "all of this is my suggestion, implement everything to a final standard".

## 1. Why

The CHAIN REACTION (2026-10-27, `src/game/spread.js`) passed an explosion to same-colour FRONT cars
in the neighbouring lanes automatically. Nobody reads the L6 card, so on the board it is a car in a
lane you did not shoot blowing up for no visible reason: it reads as noise, not as a tool, and the
player who does not understand it cannot plan with it. The turn still has one obvious move (match
the front car), which is why L10 feels like a treadmill. A link the player MAKES, SEES and then
CASHES IN is a decision (which pair, when, before the speeder ruins it), and a level tuned so that
the diligent bridger wins while the non-bridger loses makes that decision the game.

## 2. Goals / non-goals

Goals: (a) a bridge mechanic that is created by the player, always visible, and necessary; (b) every
first-time explanation is a picture that moves, not a sentence; (c) nothing on the board that a
non-reader cannot decode; (d) the bench takes four bombs; (e) the simulator plays bridges so the
bands mean something; (f) shipped to both phones with release notes.

Non-goals: new vehicles, new boosters, map/meta changes, iOS listing work.

## 3. The bridge model (`src/game/bridges.js`, pure, shared by GameLoop and the sim)

- **Eligible pair:** two cars in ADJACENT lanes (|laneA − laneB| = 1), SAME colour (chameleons use
  their current colour), SIDE BY SIDE (`|rowA − rowB| < 1e-6`), both on the visible road
  (`row >= 1`), neither armoured/plated at that moment (armour would swallow the shared hit and
  confuse the picture; a stripped car is eligible again). Any row, not only the front: a bridge made
  deep in the lanes is a plan that pays when the pair arrives.
- **Creation:** the player drags from one car of an eligible pair to the other (§4). Free: no turn
  passes, traffic does not move. No limit on the number of bridges.
- **Pairs only** (revised the same evening, §14): a bridged car takes no second bridge, because the
  pair is drawn as one vehicle. `connected()` still walks the bridge graph; it finds two cars.
- **Effect:** when a bridged car takes a hit from a queue bomb (plain, charged: each of its hits, or
  rainbow: the hit in that lane), every connected car takes the SAME hit at the same moment, through
  `CombatResolver`'s damage path (one rung off, armour rules as usual), even when that car is not the
  front car of its lane. Kills through a bridge are part of the SHOT: `kills` (multi-kill bonus
  +50 each), goals, combo, supercharge streak, bomb-booster count, rainbow multi-kill count. Not the
  3-kill FREEZE earn (lane-only, as before). The BOMB booster's lane clear does not cross bridges.
- **Breaking (visible snap):** a bridge dies when either car is destroyed, when the two rows differ
  (a speeder moves two steps a turn, so a speeder bridged to a normal car survives only until the
  next advance), when the colours differ (chameleon flip), on CONTINUE/rescue reset (`resetLevel`),
  and at level end. `pruneBridges(lanes, bridges)` runs after every advance and after every hit.
- **State:** `gs.bridges: Array<{a:{lane,car}, b:{lane,car}}>` (car = object reference, cars have no
  id) + `gs.bridgesEnabled` (per level, `bridgesEnabledFor(cfg)`, `BRIDGES_FROM = 6`, `cfg.bridges`
  boolean override; daily = on). `gs.bridgesMade`, `gs.bridgeKills` for stats/achievement.
- API: `eligiblePairs(lanes, activeLaneCount) -> [{a:{lane,car}, b:{lane,car}}]`,
  `canBridge(lanes, carA, carB)`, `addBridge(bridges, laneA, carA, laneB, carB)` (idempotent),
  `connected(bridges, car) -> Set<car>` (transitive), `pruneBridges(lanes, bridges) -> removed[]`,
  `bridgeHits(lanes, bridges, hitCar, damage) -> [{lane, car, destroyed}]` (applies the damage to
  every OTHER connected car, removes dead cars from their lanes like `spreadAcross` did).

The automatic spread is removed entirely (`spread.js`, `_onSpread`, `onSpread` VFX reused for the
bridge blast, `spreadKills` → `bridgeKills`, `chain_reaction` card → `bridge` card). L6 is renamed
"Bridges" and keeps its light goal.

## 4. The gesture (`DragDrop`)

- Pointer DOWN on a car that belongs to at least one eligible pair starts a BRIDGE drag (state
  `'bridging'`), before the bomb pickup test (a car and a bomb never overlap: cars live above
  `laneDropBottomY()`, bombs below). Car hit test: nearest car within a lane half-width
  horizontally and 0.6 row vertically of the pointer, via `getLaneFromScreenX` + `screenYToRow`.
- MOVE: a rubber-band line from the source car to the finger; when the finger is over the partner
  car (same test) the line turns solid green and the partner glows; otherwise thin white.
- UP over the partner: `onBridge(laneA, carA, laneB, carB)` → GameLoop `addBridge` → the bridge
  snaps in (flash, chain-link sound, light haptic). UP elsewhere: the band fades, nothing happens.
- Blocked while `inputBlocked`, in BOMB/COLOR modes, or while a shot is in flight (same as deploys).
- QA hooks: `_nav.bridges()`, `_nav.bridgeable()`, `_nav.makeBridge(laneA, laneB)` (dev only).

## 5. What the player sees (`BridgeLayer`, Pixi overlay on the particle layer; positions from
PositionRegistry/roadGeometry per frame so it rides the cars)

- **Candidate hint:** every eligible pair that is not yet bridged shows a dotted white link between
  the two cars (6 px dots, alpha 0.55, slowly flowing toward each other) with a small white
  "LINK" pill at its middle. Always on (not only the first times): it is the board explaining
  itself. Hidden while that pair is being dragged.
- **Bridge:** a solid gold-and-ink beam between the two cars (two rails + three rungs, like the toy
  barriers, 10 px tall) with a soft pulse; on creation it scales in from the drag line and sparks.
- **Blast:** on a hit, the existing arc effect (`GameRenderer3D.onSpread` → `onBridgeBlast`) runs
  from the hit car along each bridge to its partner (40 ms apart), then the partner's flash /
  explosion; a floating "BRIDGE x2!" / "x3!" tag replaces "CHAIN xN!".
- **Snap:** when a bridge breaks (speeder, chameleon, kill of one side by other means) the beam
  cracks in the middle and the halves fall away over 0.3 s with a short wood-snap sound.
- The 3D danger aura, barriers, waves tags are unchanged.

## 6. Spawning for bridges

- **Pair bias** (`CarDirector.setPairBias(p)`, GameLoop passes the colour of the car that arrived in
  the previous lane THIS refill at the same row): from `BRIDGES_FROM`, when lane i spawns at a row
  where lane i−1 just spawned, the colour copies the neighbour with probability `PAIR_P = 0.45`
  (`DirectorConfig.PAIR_P`). A `firstColors` script and convoy lanes win over the bias. Opening
  rows: `_primeInitialCars` applies the same rule per row across lanes, so the first board already
  shows a pair or two.
- **Speeders:** `SPEEDER_BOOST = 1.6` multiplies the level's `traits.speeder` probability in
  `rollTrait` (clamped to 0.6) from L9 (where speeders start). Speeders also show the small flame
  decal they already have; no new art.

## 7. The simulator plays bridges

`SimulationRunner`: before choosing a shot each turn, the bot bridges EVERY eligible pair (the
diligent player; `bridgesMade++`), prunes after every advance/hit, and applies `bridgeHits` on its
hits exactly like GameLoop (`bridgeKills` in the result). The bench model stores while there is
room (no one-store-per-turn, §10). Then `tune-levels.mjs 1-200 300 --write` and `tune-stars.mjs`
regenerate every level and star target; `balance-sim --skill=human` regenerates the report, with
a second column run `--no-bridges` for L6–L30 to show the non-bridger's win rate (must sit clearly
under the band: the mechanic is necessary, not optional).

## 8. Teaching bridges

- **L6 start card (`BridgeIntroCard`, animated, once ever):** two lanes, two same-colour cars side by
  side with the dotted LINK hint; a hand drags from one to the other; the beam snaps in; a bomb
  drops on the left car; BOTH explode; tag "ONE SHOT, TWO CARS". Loop. Title "BRIDGES", caption
  "Drag car to car. One hit takes both."
- **Guided first bridge (same level, on the board):** the first time an eligible pair is on the board
  in L6 (checked after every advance), the game pauses through the modal queue with a GuideCard
  step whose target is the pair's rect, `hand: 'drag'` from car A to car B, no body text beyond
  "DRAG ONE CAR TO THE OTHER"; the card dismisses itself when the real bridge is made
  (`onBridge` → `completeIfActive('bridge')` through TutorialOrchestrator semantics: input NOT
  blocked for that card, like the bench tutorial). Once ever (`featureBanners` key `bridge_guide`).
- Speeder card (L9 reactive, first speeder on the board): demonstration of the flame car moving two
  steps and a bridge snapping — the one place the "bridge when it is in front, then shoot" lesson is
  shown (§9 scene `speeder`).

## 9. Every notice becomes a demonstration (`DemoCard` + `demoScenes.js`)

A generic animated card: the same shell as `CarTypeIntroCard` (ribbon, title, strip, caption, GOT
IT), with a MINI BOARD in the strip (1–3 lanes, up to 3 rows, cars drawn with the real sprites at
small scale, a small bomb tray under the road) and a scripted, looping timeline. Scenes are data in
`src/screens/demoScenes.js`:

```
scene = { lanes, rows, cars: [{lane,row,color,type?,trait?}], bombs: ['Red','Blue',...], barriers?,
          loop: 3.6, steps: [ [t, 'drag', bombIdx, lane], [t, 'hit', lane], [t, 'boom', lane],
          [t, 'shrink', lane], [t, 'advance'], [t, 'bounce', bombIdx, lane], [t, 'tag', text, lane?],
          [t, 'bridge', laneA, laneB], [t, 'snap', laneA, laneB], [t, 'glow', bombIdx],
          [t, 'light', lane, 'red'|'green'], [t, 'freeze'], [t, 'boosterTap', 'freeze'|'swap'|'bomb'],
          [t, 'recolor', color], [t, 'goalTick', n], [t, 'barrierSmash', lane], [t, 'speed', lane] ] }
```

`stepsFor(key)` returns a DemoCard scene when `demoScenes[key]` exists; the old text-only GuideCard
stays only for cards that point at a real board element with a hand (`second_colour`, the L1 tour's
YOUR BOMBS step, the guided bridge). Scenes for every key in `CARDS`:

| key | scene (one sentence) | caption |
|---|---|---|
| lane_2 | two lanes; a red bomb goes to the red car in lane 1, a blue one to the blue car in lane 2 | Each bomb to a car of its color |
| lane_3 | three lanes; the car nearest the red line pulses; the bomb goes there first | Nearest to the line first |
| bridge (new) | §8 | Drag car to car. One hit takes both |
| combo | three hits in a row, a counter x1 x2 x3 and coins | Hit after hit = bonus |
| supercharge | five kills in a row, a fire ring on the front bombs, the next shot hits twice (two rungs) | 5 in a row = a double hit |
| goal_colour | the goal plaque with a blue car icon 0/3; a red kill does not tick, a blue one does | Only this color counts |
| freeze_booster | FREEZE tapped, a shot lands, the cars do NOT move (ghost arrows crossed out) | Next shot: cars stand still |
| colour_change_booster | COLOR tapped, a red car tapped, a swatch picked, all red cars turn blue | Repaint every car of one color |
| gift_car | a car with a bow explodes into a booster icon that flies to the tray | A bow = a free booster |
| traffic_light | a red light over one lane with "3", shots elsewhere count it down, the lane stands still | Red = that lane waits |
| convoy | one lane of motorbikes, one hit each, three pop in a row | One hit each. Clear them fast |
| rainbow_bomb | three multi-kill shots, a rainbow bomb appears, fired: one car of its colour in every lane pops | Hits one color in every lane |
| freeze_earned | a bomb kills 3 (a bridged triple), the FREEZE icon lights +1 | 3 in one shot = a FREEZE |
| colour_change_earned | two multi-kills, COLOR icon lights +1 | 2 multi-kills = a COLOR SWAP |
| first_kill | a car pops, a counter 1/10 with the BOMB icon fills | 10 cars = a BOMB booster |
| first_miss | a blue bomb dragged to a red car bounces back, "no damage" cross | A bomb only hurts its own color |
| barrier_down | existing BarrierIntroCard (kept) | |
| wave_incoming | existing WaveIntroCard (kept) | |
| streak_charged | fire ring on the front bombs, the shot hits twice, the other rings go out | Fire a charged bomb: it hits twice |
| plate_break | a plated car: two hits of any colour strip the plates, the third (own colour) hurts | Two hits strip the plating |
| armor_break | an armoured car: any colour pops the plate, then its own colour hurts | Then its own color |
| volatile_surge | a volatile car pops, the other lanes lurch one step | When it blows, the others jump |
| mender_heal | a shrunk mender grows back a size after two quiet moves | Left alone, it grows back |
| speeder (new, L9) | a flame car moves two steps while the others move one; a bridge to it snaps | Bridge it when it is in front, then shoot |
| bench (L13, replaces the spotlight text) | the top bomb is dragged DOWN to a slot, the one behind rises | Park a bomb. Take it back any time |

The HowToPlay overlay reuses the same scenes (one per page) instead of its static illustrations where
one exists. Every scene is captured by `scripts/_demo-cards-shots.mjs` into `docs/review/cards`.

## 10. Board clarity

- **Step ruler:** the number badge goes (owner: "the number at the side is not understood"). The
  dots stay, warming to red near the line; the glowing marker becomes a small plain dot riding
  level with the nearest car. The L1 tour's MOVES LEFT step is removed (tour = GOAL, RED LINE, YOUR
  BOMBS).
- **Bench:** every empty slot takes a bomb in the same turn (done, `fb2413c`); the bench→queue
  return keeps one-per-turn. A refused store (bench full) already says "BENCH FULL".
- **Audit:** after the build, L6 / L13 / L21 frames are captured and every HUD element is checked
  with the question "what does a non-reader take from this?"; anything that fails is fixed or
  removed in this branch and listed in the PR.

## 11. Tests

`tests/bridges.test.js` (pure rules: eligibility, chains, prune on row/colour/kill, hits through a
non-front car, armour), `tests/bridges-gameloop.test.js` (a shot on a bridged car kills both,
kills/goals/multi-kill counted, FREEZE earn lane-only, BOMB booster does not cross, prune after
advance), `tests/pair-bias.test.js`, `tests/speeder-boost.test.js`, `tests/dragdrop-bridge.test.js`
(hit test and state machine with stubbed geometry), `tests/demo-scenes.test.js` (every CARDS key
that is not hand-guided has a scene; every scene's steps reference existing lanes/bombs; captions
≤ 40 chars), `tests/step-ruler.test.js` updated, `tests/no-spread.test.js` (spread stays out),
intro-schedule and visual-fixture keys updated. `scripts/_pair-shots.mjs` (was `_bridge-shots.mjs`) captures the drag, the
pair forming, the blast and the snap on L6/L9.

## 12. Rollout

Branch `feat/bridges` → PR → CI → merge (pre-approved) → `android-release.yml` to
`internal,alpha` with notes in `play/whatsnew` → `ios-release.yml` to TestFlight (+ add the build
to the Friends group, owner click or approval) → the owner gets the notes, the two friend links and
the Hebrew summary; the Math Wolf session gets the build message.

## 13. VISION.md amendment (applied with the merge, under the 2026-10-30 approval of "no invisible
help"): the CHAIN REACTION paragraph is replaced by BRIDGES as described in §3; "nothing on the
board the player did not do or cannot see".

## 14. Revision, the same evening: the pair is ONE vehicle (owner-directed)

The owner saw the first visuals and rejected them in turn: the gold beam over the gap ("looks very
bad"), a plank, then the two cars sliding together with a hitch ("the connection itself visually
doesn't look good... create a new visual of two connected cars as one unit and not try to combine
them with an extra layer on top... and create this layer for each combination of two cars"; "it
should just be two cars" before the link, no grey marker). He chose, from a 3D concept sheet, the
yellow coupling clamp with the cars pulled half-way together. What changed against §3, §5, §9:

- **Rules:** a bridge is a PAIR. `inBridge(bridges, car)`; `eligiblePairs(lanes, n, bridges)` and
  `canBridge(..., bridges)` skip bridged cars; `addBridge` refuses a second bridge on a car. No
  triples (the pair sprite has two cars). The sim passes its bridges. Levels and stars retuned.
- **Art:** `render-3d-sprites.mjs pairs` bakes `pair-<l>-<r>-<color>[-sl|-sr].png` for the
  unordered rung pairs (small < big < jeep), six colours, speeder flames on the left or right car
  (`studio.pair()`, `JOINT_HD.clamp`, cars scaled so the projected body length is FIT x row pitch,
  exactly a single car's size), and GENERATES `src/renderer3d/pairSpriteGeometry.js`
  (`tests/pair-sprites.test.js` pins the 108 files and the geometry).
- **Renderer:** `Car3D.setPairs(gs.bridges)`: the two singles slide to their slots in the pair
  (~0.3 s), hide, and one plane with the pair texture takes over (mirrored for the other type
  order), riding the left car's glide, bob, lean and tint; a hit swaps the combination with a pop;
  when the bridge goes the singles reappear in their slots and slide home. `onPairJoined` fires at
  the swap. `BridgeLayer` draws no hint and no bridge: only a one-off pulse when a pair BECOMES
  linkable (not the opening board), the drag band, gold rings on the drop, sparks at the seam on
  join, a crack on snap, the blast flash.
- **Cards:** the DemoCard `bridge` op slides the two cars together and swaps in the pair sprite;
  `snap`/`boom`/`advance` split it; `freeze_earned` shows a pair plus a charged shot (no triple).
  The HowToPlay BRIDGES slide shows the pair sprite.
- Review captures: `scripts/_pair-shots.mjs`; concept sheets `_pair-concept.mjs`, `_wide-concept.mjs`.
