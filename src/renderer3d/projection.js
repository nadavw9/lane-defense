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
export const DESIGN_ROAD_BOTTOM_Y = 565;

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
const F = computeFrustum();
export const FRUSTUM_HALF_X = F.halfX;    // ≈ 11.237 (was hardcoded 9.650 — stale)

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
export const PROJ_ROAD_TOP_Y    = zToScreenY(posToZPure(0));     // ≈ 69.4 — position-0 car centre
export const PROJ_ROAD_BOTTOM_Y = zToScreenY(posToZPure(100));   // ≈ 475.4 — position-100 car centre
export const BREACH_LINE_Y      = zToScreenY(ROAD_Z_NEAR);       // ≈ 551.2 — 3D breach line
export const HUD_BOTTOM_Y       = DESIGN_ROAD_TOP_Y;             // 44 — 2D layout band top (HUD edge)

// Screen pixels per world unit — the ortho projection is linear in Z, so any
// two samples give the true (constant) scale.
export const PX_PER_WU = zToScreenY(1) - zToScreenY(0);

// ── Bomb queue geometry — THE single source of truth for "where is bomb slot
// N" (world Z, ball radius, slot spacing). Previously duplicated THREE times
// (Shooter3D's own slotZ formula, a hand-mirrored copy in PositionRegistry,
// and hardcoded TOP_Y/SECOND_Y/THIRD_Y pixel constants in ShooterRenderer
// that DragDrop hit-tests against) — the rendered ball, its drawn socket
// ring, and its touch target silently drifted apart from each other whenever
// one copy was edited and the others weren't (2026-07-13). Every consumer
// (Shooter3D's 3D ball, PositionRegistry, ShooterRenderer, DragDrop) must
// call bombSlotZ/bombSlotScreenY — never re-derive this elsewhere. ─────────

// BOMB_ZONE_SCALE is the ONE lever for the whole bomb queue's size: ball
// radius, badge/number size (Shooter3D scales its badge world size by this
// too, preserving the number's proportion to the ball), and slot-to-slot
// spacing all derive from it. Approved 2026-07-13: 0.82 is the largest scale
// that still fits the queue (3 slots + stash) below the breach line with a
// comfortable clearance margin at the DESIGN_ROAD_BOTTOM_Y=540 car-viewport
// size — see the budget analysis in SESSION_HANDOFF / commit message.
export const BOMB_ZONE_SCALE = 0.82;

// Ball body radius. Unscaled formula: cell_height × 0.38 = CELL × 0.70 × 0.38
// ≈ CELL × 0.266 — then × BOMB_ZONE_SCALE.
export const BOMB_R = CELL * 0.266 * BOMB_ZONE_SCALE;

// Merged-bomb group enlargement (front slot only, see Shooter3D.update()) — a
// multiplier ON TOP of BOMB_R, not itself scaled by BOMB_ZONE_SCALE (it's a
// relative "how much bigger than a normal bomb", independent of base size).
export const MERGE_SCALE = 1.22;

// World-unit spacing between adjacent bomb-slot centers.
export const BOMB_SLOT_PITCH_WU = CELL * 0.70 * BOMB_ZONE_SCALE;

// BOMB_SLOT_CLEARANCE_Z pushes every row a fixed extra distance from the
// breach line so the front slot's ball, AT ITS LARGEST rendered size (a
// merged bomb, MERGE_SCALE), never crosses under the 2D hazard stripe —
// derived from the stripe's actual screen geometry, not eyeballed. The
// stripe is drawn BREACH_STRIPE_HALF_PX below BREACH_LINE_Y (mirrors the ±8
// span ShooterRenderer draws it at); the worst-case ball top must clear that
// edge by BREACH_MARGIN_PX.
const BREACH_STRIPE_HALF_PX = 8;
const BREACH_MARGIN_PX      = 6;
function _computeBombSlotClearanceZ() {
  const stripeBottomY     = BREACH_LINE_Y + BREACH_STRIPE_HALF_PX;
  const worstCaseRadiusPx = BOMB_R * MERGE_SCALE * PX_PER_WU;
  const slot0CenterYMin   = stripeBottomY + BREACH_MARGIN_PX + worstCaseRadiusPx;
  const slot0ZMin         = screenYToZ(slot0CenterYMin);
  const baseSlot0Z        = 0.5 * BOMB_SLOT_PITCH_WU;
  return Math.max(0, slot0ZMin - baseSlot0Z);
}
export const BOMB_SLOT_CLEARANCE_Z = _computeBombSlotClearanceZ();

// Canonical bomb-queue slot position (world Z / screen Y). rowIdx: 0=front,
// 1=second, 2=third, 3=stash. Non-integer rowIdx is valid arithmetic (e.g.
// 3.5 = the stash cell's bottom edge) — used for panel-height derivations.
export function bombSlotZ(rowIdx) {
  return (rowIdx + 0.5) * BOMB_SLOT_PITCH_WU + BOMB_SLOT_CLEARANCE_Z;
}
export function bombSlotScreenY(rowIdx) {
  return zToScreenY(bombSlotZ(rowIdx));
}
