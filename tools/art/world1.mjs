// Toy Town scenery for World 1 (L1-15): road tile, verge strips, dispatch floor.
//
// Same visual language as vehicles.mjs — flat fills, thick dark outlines, one
// highlight — but deliberately CALMER: scenery must recede so the cars and
// bombs are always the most saturated pixels on screen (Royal Match rule).
// All SVG; scripts/render-toy-sprites.mjs rasterises it.

const INK = '#1F1A33';

// Deterministic RNG so re-running the renderer reproduces identical art.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ── Road tile: 512×512, seamless, one lane wide. The lane dash sits on the tile
// centre-line; Road3D offsets the tile so that line lands on each divider.
export function roadTileSVG() {
  const r = rng(7);
  let speck = '';
  for (let i = 0; i < 260; i++) {
    const x = r() * 512, y = r() * 512, rad = 0.8 + r() * 1.8;
    speck += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="${r() < 0.5 ? '#6A6E80' : '#4C4F5E'}" opacity=".55"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
    <rect width="512" height="512" fill="#5A5E70"/>${speck}
    <rect x="243" y="154" width="26" height="204" rx="13" fill="#F4F1E6"/>
  </svg>`;
}

// ── Verge strip: 196 px wide (displayed width-fit at ~65 px), tiles vertically.
// `side` puts the kerb on the road-facing edge. `seed` varies the layout per
// scene variant so neighbouring levels don't look identical.
const ROOFS = [
  ['#E86A5A', '#B8443A'], ['#5A9BE0', '#3A70B0'], ['#F2B84A', '#C48A22'],
  ['#9C7BE0', '#7050B8'], ['#EE8A4A', '#C0602A'],
];
// Top-down pitched roof: sunlit half + shaded half meeting at the ridge, with
// eave overhang and a chimney — reads as a house, not a box.
function house(x, y, w, h, [roof, dark]) {
  const m = x + w / 2;
  return `<g>
    <rect x="${x + 6}" y="${y + 8}" width="${w}" height="${h}" rx="6" fill="#000" opacity=".18"/>
    <rect x="${x}" y="${y}" width="${w / 2}" height="${h}" fill="${roof}"/>
    <rect x="${m}" y="${y}" width="${w / 2}" height="${h}" fill="${dark}"/>
    ${[0.25, 0.5, 0.75].map(f => `<line x1="${x + 4}" y1="${y + h * f}" x2="${x + w - 4}" y2="${y + h * f}" stroke="${INK}" stroke-width="2" opacity=".18"/>`).join('')}
    <line x1="${m}" y1="${y}" x2="${m}" y2="${y + h}" stroke="${INK}" stroke-width="4" opacity=".55"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="none" stroke="${INK}" stroke-width="6"/>
    <rect x="${x + w * 0.66}" y="${y + h * 0.16}" width="${w * 0.15}" height="${w * 0.15}" rx="2" fill="#B9B2A6" stroke="${INK}" stroke-width="4"/>
  </g>`;
}
function tree(x, y, s) {
  return `<g>
    <circle cx="${x + 5}" cy="${y + 7}" r="${s}" fill="#000" opacity=".16"/>
    <circle cx="${x}" cy="${y}" r="${s}" fill="#3FA652" stroke="${INK}" stroke-width="6"/>
    <circle cx="${x - s * 0.3}" cy="${y - s * 0.3}" r="${s * 0.35}" fill="#7BD37E" opacity=".9"/>
  </g>`;
}
function bush(x, y, s) {
  return `<g>
    <circle cx="${x - s * 0.6}" cy="${y}" r="${s * 0.7}" fill="#4DB560" stroke="${INK}" stroke-width="5"/>
    <circle cx="${x + s * 0.6}" cy="${y + s * 0.1}" r="${s * 0.75}" fill="#4DB560" stroke="${INK}" stroke-width="5"/>
  </g>`;
}

export function vergeStripSVG(side, seed = 1, H = 1024) {
  const W = 196, r = rng(seed * 31 + (side === 'left' ? 0 : 17));
  const kerbX = side === 'left' ? W - 22 : 0;          // road-facing edge
  const inner = side === 'left' ? 16 : 34;             // usable content band
  let grass = '';
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = r() * H;
    grass += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(6 + r() * 10).toFixed(0)}" ry="${(3 + r() * 5).toFixed(0)}" fill="#8AD56A" opacity=".45"/>`;
  }
  // Content in a column, kept clear of the top/bottom edges so the tile is seamless.
  let items = '', y = 40;
  while (y < H - 150) {
    const pick = r();
    if (pick < 0.5) {
      const w = 110 + r() * 24, h = 118 + r() * 30;
      items += house(inner + r() * 10, y, w, h, ROOFS[Math.floor(r() * ROOFS.length)]);
      y += h + 44 + r() * 30;
    } else if (pick < 0.85) {
      const s = 30 + r() * 10;
      items += tree(inner + 40 + r() * 30, y + s, s) + tree(inner + 96 + r() * 20, y + s * 2.1, s * 0.8);
      y += s * 3.2 + 30;
    } else {
      items += bush(inner + 70, y + 30, 26);
      y += 100;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#6CBF4E"/>${grass}${items}
    <rect x="${kerbX}" y="0" width="22" height="${H}" fill="#EDE6D2"/>
    <rect x="${side === 'left' ? kerbX : kerbX + 16}" y="0" width="6" height="${H}" fill="${INK}" opacity=".85"/>
  </svg>`;
}

// ── Dispatch floor under the bomb queue: deep plum, faint rounded tiles.
export function zoneFloorSVG(H = 260) {   // 4 rows of 65 → tiles seamlessly
  const W = 780;
  let tiles = '';
  for (let x = 0; x < W; x += 65) for (let y = 4; y < H; y += 65) {
    tiles += `<rect x="${x + 4}" y="${y}" width="57" height="57" rx="12" fill="#443E5E" opacity=".55"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#3A3550"/>${tiles}
  </svg>`;
}
