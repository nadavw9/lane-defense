// Level map layout — pure data, shared by the level-select screen (Pixi) and the
// map background bake (scripts/render-3d-sprites.mjs map), so the baked road
// runs exactly through the nodes the screen draws.
//
// One page per game world (15 / 15 / 10 levels). Nodes snake bottom → top in
// rows of four; each level's city-repair building sits on a plot just above
// its node.

export const MAP_W = 390, MAP_H = 844;
export const MAP_TOP = 178, MAP_BOTTOM = 772;   // node band (header above, safe margin below)
const COLS_X = [62, 154, 236, 328];

export const MAP_WORLDS = [
  { page: 1, first: 1,  last: 15, name: 'Tutorial City',   theme: 'world1' },
  { page: 2, first: 16, last: 30, name: 'Industrial Zone', theme: 'world2' },
  { page: 3, first: 31, last: 40, name: 'Night Highway',   theme: 'world3' },
];

export function worldForLevel(levelId) {
  return MAP_WORLDS.find(w => levelId >= w.first && levelId <= w.last) ?? MAP_WORLDS[0];
}

/** Nodes of a map page, in play order: [{ levelId, x, y, plotX, plotY }]. */
export function mapNodes(page) {
  const w = MAP_WORLDS[page - 1];
  const n = w.last - w.first + 1;
  const rows = Math.ceil(n / 4);
  const pitch = (MAP_BOTTOM - MAP_TOP) / Math.max(1, rows - 1);
  const out = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / 4), pos = i % 4;
    const col = row % 2 === 0 ? pos : 3 - pos;
    const x = COLS_X[col];
    const y = MAP_BOTTOM - row * pitch;
    // Edge-column plots step inward, clear of the U-turn road at the row ends.
    const plotX = col === 0 ? x + 18 : col === 3 ? x - 18 : x;
    out.push({ levelId: w.first + i, x, y, plotX, plotY: y - Math.min(66, pitch * 0.42) });
  }
  return out;
}

/**
 * The road through a page's nodes as a dense polyline [[x, y], ...] in map px.
 * Nodes in a row join with a straight road; at the end of a row it swings out
 * in a U-turn toward the screen edge, so it never runs over the end building.
 */
export function mapRoadPath(page) {
  const nodes = mapNodes(page);
  const pts = [];
  const push = (x, y) => pts.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  // Lead-in from below the first node.
  push(nodes[0].x - 70, nodes[0].y + 40);
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    push(a.x, a.y);
    const b = nodes[i + 1];
    if (!b) break;
    if (Math.abs(b.y - a.y) < 1) continue;               // same row: straight
    // Row change: cubic U-turn out to the edge.
    const side = a.x > MAP_W / 2 ? 1 : -1;
    const ex = side > 0 ? MAP_W - 8 : 8;
    const steps = 18;
    for (let s = 1; s < steps; s++) {
      const t = s / steps, u = 1 - t;
      const x = u * u * u * a.x + 3 * u * u * t * ex + 3 * u * t * t * ex + t * t * t * b.x;
      const y = u * u * u * a.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t * t * t * b.y;
      push(x, y);
    }
  }
  const last = nodes[nodes.length - 1];
  push(last.x + (last.x > MAP_W / 2 ? -60 : 60), last.y - 30);
  return pts;
}
