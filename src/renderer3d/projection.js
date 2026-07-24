// projection — THE single source of truth for the 3D ortho camera frustum and
// every world↔screen conversion. Pure math: no Three, no Pixi, no DOM — safe to
// import from renderers, input code, headless tests, and the visual harness.
//
// WHY THIS FILE EXISTS (bug class C — coordinate divergence):
// The 2D layer (PositionRegistry, roadGeometry, CityEdges) used to hardcode
// mirror constants of the camera math (FRUSTUM_HALF_X = 9.650, road band
// 44..510). When ROAD_Z_FAR moved -22 → -26 (gridRows 16 road extension), the
// camera formula auto-adapted but every hardcoded mirror silently kept the old
// projection — cars rendered ~17px away from where the 2D layer thought they
// were. The visual harness caught it (tests-visual/smoke/layout.spec.js).
// Rule going forward: NOTHING may hardcode a projected value; derive it here.

// ── World-space layout (Z axis: negative = far/top of screen) ─────────────────
export const ROAD_Z_FAR       = -26;   // gameplay zone far edge (cars spawn here)
export const ROAD_Z_NEAR      =   0;   // gameplay zone near edge (breach line)
export const ROAD_Z_VANISHING = -65;   // road surface extends here visually (no gameplay)

// Extra world units revealed above ROAD_Z_FAR so a bigrig body (half-depth ≈2.52)
// is fully visible before it crosses the spawn line.
export const SPAWN_VIEWPORT_EXTRA = 4.0;

// Cars stop one row SHORT of the breach line so the front car never renders down
// over the bomb queue: position 100 maps to POS_NEAR_Z, not ROAD_Z_NEAR.
export const POS_NEAR_Z = -2.6;

export const CELL = 4.0;               // lane width / laneToX pitch (world units)

// ── Stage + 2D design anchors the frustum is DERIVED from ────────────────────
// These two Y values are inputs to the camera formula (they define the scale of
// the pre-extension frustum), NOT the on-screen road band. The actual projected
// band is exported below (PROJ_*, BREACH_LINE_Y).
export const APP_W = 390;
export const APP_H = 844;
export const DESIGN_ROAD_TOP_Y    = 44;
// 2026-07-13: 510 → 540 to grow the car viewport ~5.9% (px/wu increases
// proportionally), funded by shrinking the bomb queue — see BOMB_ZONE_SCALE
// below. Approved budget: B=0.82 is the largest bomb-zone shrink that still
// keeps queue slots comfortably tappable at this car-growth target.
//
// 2026-07-23 (THREE_LANE_REDESIGN_BATCH.md §1): band is now LANE-COUNT-KEYED,
// not a single global value. 4-lane's own road width is what capped how far
// this could grow (the road alone fills the 390px screen around band≈650-700
// at 4 lanes); dropping to 3 lanes removes that cap. `DESIGN_ROAD_BOTTOM_Y` is
// still the ONE value computeFrustum() reads — it's just reassigned by
// setActiveLaneCount() below instead of frozen at import time. Every derived
// export in this file (F, FRUSTUM_HALF_X, PROJ_ROAD_TOP_Y, PROJ_ROAD_BOTTOM_Y,
// BREACH_LINE_Y, PX_PER_WU, BOMB_SLOT_CLEARANCE_Z) is `let`, recomputed by
// setActiveLaneCount() below, and re-exported as a live binding — importers
// that `import { X } from './projection.js'` see the updated value automatically,
// no call-site changes needed anywhere else in the codebase.
const BAND_4_LANE = 540;   // unchanged shipped value — 1/2/4-lane levels
// 2026-07-23 CORRECTION: 730 shipped broken — the bomb queue computed off-stage
// entirely (see the "Bomb queue geometry" comment block below for the full
// story and the growth/legibility tradeoff this is bound by). 600 is a
// conservative, verified-safe placeholder (growth 1.109x, queue scale ≈0.56,
// ball radius ≈12px, comfortably above MIN_LEGIBLE_SCALE) pending the user's
// call on the real target — see THREE_LANE_REDESIGN_BATCH.md §7b.
const BAND_3_LANE = 600;
export function bandForLaneCount(activeLaneCount) {
  return activeLaneCount === 3 ? BAND_3_LANE : BAND_4_LANE;
}
export let DESIGN_ROAD_BOTTOM_Y = BAND_4_LANE;

// ── Camera frustum (must stay identical to Scene3D._computeFrustum) ──────────
export function computeFrustum(width = APP_W, height = APP_H) {
  const roadZSpan  = ROAD_Z_NEAR - ROAD_Z_FAR;
  const pixiRoadH  = DESIGN_ROAD_BOTTOM_Y - DESIGN_ROAD_TOP_Y;
  const fHalfZ     = roadZSpan * height / (2 * pixiRoadH);
  const topFrac    = DESIGN_ROAD_TOP_Y / height;
  const baseCenter = ROAD_Z_FAR + fHalfZ * (1 - 2 * topFrac);

  // Keep frustum bottom fixed; extend top only (spawn reveal).
  const bottomZ = baseCenter + fHalfZ;
  const topZ    = ROAD_Z_FAR - SPAWN_VIEWPORT_EXTRA;
  const halfZe  = (bottomZ - topZ) / 2;
  const zCenter = (bottomZ + topZ) / 2;
  const halfX   = halfZe * (width / height);
  return { halfX, halfZe, zCenter, topZ, bottomZ };
}

// Default-stage frustum — the game always renders the 390×844 stage.
// `let`, not `const`: reassigned by setActiveLaneCount() so every consumer
// (worldXToScreenX, zToScreenY, bombSlotZ, ...) automatically uses the
// current level's band without changing their own call signatures — they all
// close over this binding and read it fresh at call time.
let F = computeFrustum();
export let FRUSTUM_HALF_X = F.halfX;    // ≈ 11.237 (was hardcoded 9.650 — stale)

// ── Pure lane math ────────────────────────────────────────────────────────────
export function laneToXPure(laneIdx, n) {
  return -(n * CELL) / 2 + CELL / 2 + laneIdx * CELL;
}
export function roadHalfWPure(n) { return n * 2.0 + 0.4; }

// ── World ↔ screen (390×844 stage coordinates) ────────────────────────────────
export function worldXToScreenX(x) { return ((x + F.halfX) / (2 * F.halfX)) * APP_W; }
export function screenXToWorldX(sx) { return (sx / APP_W) * 2 * F.halfX - F.halfX; }
export function zToScreenY(z)  { return ((z - F.topZ) / (2 * F.halfZe)) * APP_H; }
export function screenYToZ(y)  { return F.topZ + (y / APP_H) * 2 * F.halfZe; }

// Game position [0-100] ↔ world Z / screen Y (matches Scene3D.posToZ exactly).
export function posToZPure(position) {
  return ROAD_Z_FAR + (position / 100) * (POS_NEAR_Z - ROAD_Z_FAR);
}
export function posToScreenYProjected(position) { return zToScreenY(posToZPure(position)); }

// ── Derived on-screen anchors (use THESE, never hardcode) ─────────────────────
// `let`, recomputed by setActiveLaneCount() below (live-bound exports — every
// `import { X } from './projection.js'` call site sees the update automatically).
export let PROJ_ROAD_TOP_Y    = zToScreenY(posToZPure(0));     // ≈ 69.4 — position-0 car centre
export let PROJ_ROAD_BOTTOM_Y = zToScreenY(posToZPure(100));   // ≈ 475.4 — position-100 car centre
export let BREACH_LINE_Y      = zToScreenY(ROAD_Z_NEAR);       // ≈ 551.2 — 3D breach line
export const HUD_BOTTOM_Y     = DESIGN_ROAD_TOP_Y;              // 44 — 2D layout band top (HUD edge), band-independent

// Screen pixels per world unit — the ortho projection is linear in Z, so any
// two samples give the true (constant) scale.
export let PX_PER_WU = zToScreenY(1) - zToScreenY(0);

// ── Bomb queue geometry — THE single source of truth for "where is bomb slot
// N" (world Z, ball radius, slot spacing). Previously duplicated THREE times
// (Shooter3D's own slotZ formula, a hand-mirrored copy in PositionRegistry,
// and hardcoded TOP_Y/SECOND_Y/THIRD_Y pixel constants in ShooterRenderer
// that DragDrop hit-tests against) — the rendered ball, its drawn socket
// ring, and its touch target silently drifted apart from each other whenever
// one copy was edited and the others weren't (2026-07-13). Every consumer
// (Shooter3D's 3D ball, PositionRegistry, ShooterRenderer, DragDrop) must
// call bombSlotZ/bombSlotScreenY — never re-derive this elsewhere. ─────────

// Merged-bomb group enlargement (front slot only, see Shooter3D.update()) — a
// multiplier ON TOP of BOMB_R, not itself scaled by BOMB_ZONE_SCALE (it's a
// relative "how much bigger than a normal bomb", independent of base size).
export const MERGE_SCALE = 1.22;

const BREACH_STRIPE_HALF_PX = 8;
const BREACH_MARGIN_PX      = 6;

// ── Bomb queue geometry — SCALE compensates for band, POSITION stays
// breach-line-relative ──────────────────────────────────────────────────────
// 2026-07-23 bug (THREE_LANE_REDESIGN_BATCH.md §1 follow-up, found live on a
// real device): at band=730 the queue's slots computed past Y=844 (off-stage)
// entirely — the "bomb-queue vertical clipping" check from the Phase 1 sweep
// was a qualitative visual scan, not real math, and missed it completely.
//
// First fix attempt (reverted): pin the queue to a FIXED screen position,
// decoupled entirely from the live camera. WRONG — the 2D breach/hazard
// stripe (roadGeometry.js's ROAD_BOTTOM_Y, tied to the SAME live BREACH_LINE_Y)
// still moves down with band. A fixed-position queue would end up floating
// ABOVE the stripe at high bands — overlapping the road itself instead of
// sitting below it. Position must stay relative to the LIVE breach line to
// preserve the road → stripe → queue → booster-bar ordering.
//
// Correct fix: SCALE is the only thing that compensates for band. Growing
// band pushes the breach line down toward the fixed booster bar (BoosterBar.js
// positions it at BOOSTER_BAR_TOP_Y=754, independent of road geometry) — the
// queue must shrink to fit whatever room remains. maxQueueScaleForBand()
// binary-searches the largest BOMB_ZONE_SCALE whose slot-3 (stash) bottom
// edge still clears the booster bar by QUEUE_BOTTOM_MARGIN_PX, using the
// SAME breach-clearance formula as before — just re-solved per band instead
// of fixed at the 2026-07-13-approved 0.82.
//
// IMPORTANT — this is a real product tradeoff, not just a formula fix: ball
// tap-targets are already decoupled from visual size (ShooterRenderer.js's
// TOP_RADIUS/SECOND_RADIUS/THIRD_RADIUS are fixed regardless of BOMB_ZONE_SCALE),
// so shrinking the ball doesn't hurt tappability — but it DOES hurt legibility
// (the HP-number badge shrinks in lockstep, BADGE_WORLD_W/H below). Measured:
// digit height stays comfortably readable (≈13-17px) down to roughly
// scale≈0.55 (~12px ball radius); it gets marginal below ~0.45 (~10px radius,
// ~11px digits) and drops off fast beyond that. MIN_LEGIBLE_SCALE below is a
// hard floor — bandForLaneCount() must not pick a band that needs less than
// this, or the queue becomes readable-fit but illegible. Don't raise
// BAND_3_LANE without re-running this tradeoff and confirming the resulting
// scale against a real render, not just the math.
// Mirrors BoosterBar.js's BAR_Y=752 (fixed, band-independent screen Y where
// the booster bar starts). projection.js must stay Pixi/Three/DOM-free (see
// file header), so this can't be a live import — it's a duplicated constant,
// guarded against drift by tests/bomb-slot-position-sync.test.js's
// "BOOSTER_BAR_TOP_Y mirrors BoosterBar.BAR_Y" check. If BoosterBar.js's
// BAR_Y ever changes, update this to match or the queue-fit solver below will
// silently target the wrong boundary.
export const BOOSTER_BAR_TOP_Y = 752;
const QUEUE_BOTTOM_MARGIN_PX = 12;    // clearance above the booster bar
const MIN_LEGIBLE_SCALE      = 0.45;  // ≈10px ball radius / ≈11px digit height — hard floor

export const BOMB_ZONE_SCALE_AT_540 = 0.82;   // the 2026-07-13-approved ceiling — never scale up past this

function _worstCaseSlot3BottomEdge(scale) {
  const bombR    = CELL * 0.266 * scale;
  const pitchWu  = CELL * 0.70  * scale;
  const stripeBottomY     = BREACH_LINE_Y + BREACH_STRIPE_HALF_PX;
  const worstCaseRadiusPx = bombR * MERGE_SCALE * PX_PER_WU;
  const slot0CenterYMin   = stripeBottomY + BREACH_MARGIN_PX + worstCaseRadiusPx;
  const slot0ZMin         = screenYToZ(slot0CenterYMin);
  const baseSlot0Z        = 0.5 * pitchWu;
  const clearanceZ        = Math.max(0, slot0ZMin - baseSlot0Z);
  const slot3Z            = 3.5 * pitchWu + clearanceZ;
  return zToScreenY(slot3Z) + bombR * PX_PER_WU;
}

// Largest BOMB_ZONE_SCALE (capped at the approved 0.82 ceiling) whose queue
// still clears the booster bar with margin, at the CURRENT live band. Must be
// called AFTER PX_PER_WU/BREACH_LINE_Y are updated for the new band.
function _maxQueueScaleForBand() {
  let lo = 0.02, hi = BOMB_ZONE_SCALE_AT_540;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (_worstCaseSlot3BottomEdge(mid) <= BOOSTER_BAR_TOP_Y - QUEUE_BOTTOM_MARGIN_PX) lo = mid;
    else hi = mid;
  }
  return lo;
}

export let BOMB_ZONE_SCALE = BOMB_ZONE_SCALE_AT_540;
export let BOMB_R = CELL * 0.266 * BOMB_ZONE_SCALE;
export let BOMB_SLOT_PITCH_WU = CELL * 0.70 * BOMB_ZONE_SCALE;

// BOMB_SLOT_CLEARANCE_Z pushes every row a fixed extra distance from the
// breach line so the front slot's ball, AT ITS LARGEST rendered size (a
// merged bomb, MERGE_SCALE), never crosses under the 2D hazard stripe —
// derived from the stripe's actual screen geometry, not eyeballed.
function _computeBombSlotClearanceZ() {
  const stripeBottomY     = BREACH_LINE_Y + BREACH_STRIPE_HALF_PX;
  const worstCaseRadiusPx = BOMB_R * MERGE_SCALE * PX_PER_WU;
  const slot0CenterYMin   = stripeBottomY + BREACH_MARGIN_PX + worstCaseRadiusPx;
  const slot0ZMin         = screenYToZ(slot0CenterYMin);
  const baseSlot0Z        = 0.5 * BOMB_SLOT_PITCH_WU;
  return Math.max(0, slot0ZMin - baseSlot0Z);
}
export let BOMB_SLOT_CLEARANCE_Z = _computeBombSlotClearanceZ();

// ── Lane-count-aware band activation ──────────────────────────────────────────
// Call at level start, BEFORE any frustum-consuming geometry is built for that
// level. Single call site: Scene3D.setLaneCount(n), which already runs first in
// the per-level rebuild sequence (GameRenderer3D.setActiveLaneCount → Scene3D →
// Road3D → cameraFX/shooters/cars/environment) — every downstream computeFrustum()
// call (Road3D's zone-floor build, the road-cap build, GameRenderer3D's own
// pxPerWu calc) reads the module-scope DESIGN_ROAD_BOTTOM_Y fresh, so setting it
// here before that sequence runs is sufficient; no other call site needs to change.
export function setActiveLaneCount(activeLaneCount) {
  DESIGN_ROAD_BOTTOM_Y = bandForLaneCount(activeLaneCount);
  F              = computeFrustum();
  FRUSTUM_HALF_X = F.halfX;
  PROJ_ROAD_TOP_Y    = zToScreenY(posToZPure(0));
  PROJ_ROAD_BOTTOM_Y = zToScreenY(posToZPure(100));
  BREACH_LINE_Y      = zToScreenY(ROAD_Z_NEAR);
  PX_PER_WU          = zToScreenY(1) - zToScreenY(0);
  // Queue scale re-solved for the new band — see the comment block above.
  BOMB_ZONE_SCALE    = _maxQueueScaleForBand();
  if (BOMB_ZONE_SCALE < MIN_LEGIBLE_SCALE) {
    console.error(
      `[projection] bandForLaneCount(${activeLaneCount}) requires ` +
      `BOMB_ZONE_SCALE=${BOMB_ZONE_SCALE.toFixed(3)}, below the MIN_LEGIBLE_SCALE ` +
      `floor (${MIN_LEGIBLE_SCALE}) — the bomb-queue HP numbers will not be ` +
      `legible at this band. Do not ship this band value without either ` +
      `raising the floor's justification or picking a smaller band.`,
    );
  }
  BOMB_R             = CELL * 0.266 * BOMB_ZONE_SCALE;
  BOMB_SLOT_PITCH_WU = CELL * 0.70  * BOMB_ZONE_SCALE;
  BOMB_SLOT_CLEARANCE_Z = _computeBombSlotClearanceZ();
}

// Canonical bomb-queue slot position (world Z / screen Y). rowIdx: 0=front,
// 1=second, 2=third, 3=stash. Non-integer rowIdx is valid arithmetic (e.g.
// 3.5 = the stash cell's bottom edge) — used for panel-height derivations.
export function bombSlotZ(rowIdx) {
  return (rowIdx + 0.5) * BOMB_SLOT_PITCH_WU + BOMB_SLOT_CLEARANCE_Z;
}
export function bombSlotScreenY(rowIdx) {
  return zToScreenY(bombSlotZ(rowIdx));
}
