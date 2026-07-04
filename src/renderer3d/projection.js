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
export const DESIGN_ROAD_BOTTOM_Y = 510;

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
export const BREACH_LINE_Y      = zToScreenY(ROAD_Z_NEAR);       // ≈ 520.6 — 3D breach line
export const HUD_BOTTOM_Y       = DESIGN_ROAD_TOP_Y;             // 44 — 2D layout band top (HUD edge)
