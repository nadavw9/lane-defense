// Full-screen gameplay mockups (390 x 844) for the visual-direction review.
//
// Geometry follows the shipped board so what's shown is buildable: 3 lanes on a
// 260px road, 8 rows, cars ~45px long (FIT x row pitch), breach stripe, 3x3 bomb
// queue. The one proposed layout change: the four bench slots move into the side
// gutters beside the queue instead of their own strip, which frees a band and lets
// the bombs grow from ~28px to ~42px across. Meta chrome (level, coins, pause)
// moves into the top bar; mute lives in the pause menu.
import { vehicleSVG, bombSVG, PALETTE } from './vehicles.mjs';

const W = 390, H = 844;
const ROAD_L = 65, ROAD_R = 325, ROAD_W = ROAD_R - ROAD_L;
const TOP = 96, BREACH = 606;
const LANE_X = [0, 1, 2].map(i => ROAD_L + ROAD_W * (i + 0.5) / 3);
const ROW_Y = (r) => 134 + r * 62;            // row 0 .. row 7 (front at 568)
const LEN = { small: 44, big: 45, jeep: 46, truck: 47, tank: 48, bigrig: 49 };

// The board: a mid-level state, one car of every type, front car in danger.
// Two cars per lane — the live laneTargetCarCount — so the density is honest.
const BOARD = [
  { lane: 0, row: 7, type: 'big',    color: 'Red',    danger: true },
  { lane: 0, row: 4, type: 'small',  color: 'Blue' },
  { lane: 1, row: 5, type: 'truck',  color: 'Green' },
  { lane: 1, row: 2, type: 'jeep',   color: 'Yellow' },
  { lane: 2, row: 6, type: 'bigrig', color: 'Orange' },
  { lane: 2, row: 3, type: 'tank',   color: 'Purple' },
];
const QUEUE = [   // [column][row], row 0 = playable front
  [['Red', 6], ['Blue', 4], ['Green', 5]],
  [['Green', 5], ['Purple', 7], ['Red', 3]],
  [['Blue', 6], ['Yellow', 4], ['Orange', 6]],
];
const BENCH = [['Purple', 8], null, null, null];

// Place an <svg ...> string at a box, keeping its aspect (nested svg scales).
function place(svgStr, cx, cy, len) {
  const vb = svgStr.match(/viewBox="([-\d. ]+)"/)[1].split(' ').map(Number);
  const h = len, w = len * vb[2] / vb[3];
  return svgStr.replace(/^<svg /, `<svg x="${cx - w / 2}" y="${cy - h / 2}" `)
               .replace(/ width="[\d.]+" height="[\d.]+"/, ` width="${w}" height="${h}"`);
}

const THEMES = {
  toy: {
    label: 'A — Toy Town',
    sky: '#8ED16E', grassDot: '#7CC05C', road: '#5B6076', roadEdge: '#E9E4D6', dash: '#FFFFFF',
    panel: '#3A3159', panelEdge: '#1F1A33', socket: '#2A2346', socketRing: '#524878',
    topBar: '#3A3159', card: '#FFFFFF', cardInk: '#1F1A33', accent: '#FFC93C',
    breachA: '#FFD23C', breachB: '#1F1A33', font: '#1F1A33',
  },
  pop: {
    label: 'B — Candy Pop',
    sky: '#FFE3D3', grassDot: '#FFD2BD', road: '#EDE7FA', roadEdge: '#FFFFFF', dash: '#CFC3EE',
    panel: '#FFFFFF', panelEdge: '#E8DDF8', socket: '#F2ECFC', socketRing: '#DCCFF5',
    topBar: '#FFFFFF', card: '#F6F1FF', cardInk: '#3B2E66', accent: '#FF6FA8',
    breachA: '#FF6FA8', breachB: '#FFFFFF', font: '#3B2E66',
  },
  neon: {
    label: 'C — Neon Night',
    sky: '#0B0F24', grassDot: '#141A3A', road: '#121833', roadEdge: '#3FE0FF', dash: '#3FE0FF',
    panel: '#0D1230', panelEdge: '#3FE0FF', socket: '#070B1E', socketRing: '#2A3570',
    topBar: '#0D1230', card: '#161D45', cardInk: '#E8F6FF', accent: '#FF3FD1',
    breachA: '#FF3FD1', breachB: '#0B0F24', font: '#E8F6FF',
  },
};

// ── Side scenery ─────────────────────────────────────────────────────────────
function scenery(style, t) {
  let g = `<rect x="0" y="0" width="${W}" height="${H}" fill="${t.sky}"/>`;
  const rnd = mulberry(7);
  if (style === 'toy') {
    for (let i = 0; i < 120; i++) g += `<circle cx="${rnd() * W}" cy="${TOP + rnd() * (BREACH - TOP)}" r="${1.5 + rnd() * 2}" fill="${t.grassDot}"/>`;
    // little top-down houses and round trees down both verges
    for (const side of [0, 1]) {
      const x0 = side ? ROAD_R + 8 : 6;
      for (let y = TOP + 10, k = 0; y < BREACH - 40; y += 78, k++) {
        const roof = ['#E8574B', '#F2A33A', '#4E8FE0', '#9A6BD8'][(k + side) % 4];
        if ((k + side) % 2 === 0) {
          g += `<g stroke="#1F1A33" stroke-width="3" stroke-linejoin="round">
            <rect x="${x0 + 2}" y="${y}" width="46" height="40" rx="4" fill="${roof}"/>
            <line x1="${x0 + 25}" y1="${y + 2}" x2="${x0 + 25}" y2="${y + 38}" stroke-width="2.4"/>
            <rect x="${x0 + 33}" y="${y + 6}" width="7" height="9" fill="#C9C2B4" stroke-width="2"/></g>`;
        } else {
          for (const [dx, dy, r] of [[12, 14, 13], [34, 26, 11], [18, 40, 9]])
            g += `<circle cx="${x0 + dx}" cy="${y + dy}" r="${r}" fill="#3FA34D" stroke="#1F1A33" stroke-width="3"/>
                  <circle cx="${x0 + dx - r / 3}" cy="${y + dy - r / 3}" r="${r / 3}" fill="#7ED36B"/>`;
        }
      }
    }
  } else if (style === 'pop') {
    for (const side of [0, 1]) {
      const x0 = side ? ROAD_R + 10 : 8;
      for (let y = TOP + 12, k = 0; y < BREACH - 30; y += 64, k++) {
        const col = ['#FFB3C7', '#B9E8FF', '#FFE08A', '#C9F2C4'][(k + side * 2) % 4];
        g += `<rect x="${x0}" y="${y}" width="46" height="50" rx="14" fill="${col}"/>`;
        if (k % 2) g += `<circle cx="${x0 + 23}" cy="${y + 25}" r="11" fill="#fff" opacity=".7"/>`;
        else g += `<rect x="${x0 + 10}" y="${y + 12}" width="26" height="26" rx="8" fill="#fff" opacity=".6"/>`;
      }
    }
  } else {
    for (const side of [0, 1]) {
      const x0 = side ? ROAD_R + 8 : 6;
      for (let y = TOP + 6, k = 0; y < BREACH - 30; y += 70, k++) {
        g += `<rect x="${x0}" y="${y}" width="50" height="60" rx="5" fill="#161D45" stroke="#232C66" stroke-width="2"/>`;
        for (let wy = 0; wy < 4; wy++) for (let wx = 0; wx < 3; wx++)
          if (rnd() > 0.45) g += `<rect x="${x0 + 7 + wx * 14}" y="${y + 8 + wy * 13}" width="8" height="6" rx="1.5" fill="${rnd() > .5 ? '#FF3FD1' : '#3FE0FF'}" opacity="${0.5 + rnd() * .5}"/>`;
      }
    }
  }
  return g;
}

function road(style, t) {
  let g = `<rect x="${ROAD_L}" y="${TOP}" width="${ROAD_W}" height="${BREACH - TOP}" fill="${t.road}"/>`;
  const edge = style === 'neon'
    ? `stroke="${t.roadEdge}" stroke-width="3" filter="url(#glow)"`
    : `stroke="${t.roadEdge}" stroke-width="${style === 'toy' ? 6 : 5}"`;
  g += `<line x1="${ROAD_L}" y1="${TOP}" x2="${ROAD_L}" y2="${BREACH}" ${edge}/>
        <line x1="${ROAD_R}" y1="${TOP}" x2="${ROAD_R}" y2="${BREACH}" ${edge}/>`;
  if (style === 'toy') g += `<line x1="${ROAD_L - 4}" y1="${TOP}" x2="${ROAD_L - 4}" y2="${BREACH}" stroke="#1F1A33" stroke-width="2.5"/>
                             <line x1="${ROAD_R + 4}" y1="${TOP}" x2="${ROAD_R + 4}" y2="${BREACH}" stroke="#1F1A33" stroke-width="2.5"/>`;
  for (const i of [1, 2]) {
    const x = ROAD_L + ROAD_W * i / 3;
    g += `<line x1="${x}" y1="${TOP + 8}" x2="${x}" y2="${BREACH - 8}" stroke="${t.dash}" stroke-width="${style === 'neon' ? 2.5 : 4}"
          stroke-dasharray="22 20" stroke-linecap="round" ${style === 'neon' ? 'filter="url(#glow)" opacity=".8"' : 'opacity=".9"'}/>`;
  }
  return g;
}

function cars(style) {
  let g = '';
  for (const c of BOARD) {
    const cx = LANE_X[c.lane], cy = ROW_Y(c.row);
    if (c.danger) {
      g += `<ellipse cx="${cx}" cy="${cy}" rx="34" ry="36" fill="#FF2D2D" opacity=".28"/>
            <ellipse cx="${cx}" cy="${cy}" rx="26" ry="29" fill="none" stroke="#FF2D2D" stroke-width="3" opacity=".7"/>`;
    }
    g += place(vehicleSVG(c.type, c.color, style), cx, cy, LEN[c.type] + 12);
  }
  return g;
}

function breach(t) {
  let g = `<rect x="${ROAD_L}" y="${BREACH - 7}" width="${ROAD_W}" height="14" fill="${t.breachB}"/>`;
  for (let x = ROAD_L - 14; x < ROAD_R; x += 20)
    g += `<polygon points="${x},${BREACH + 7} ${x + 10},${BREACH + 7} ${x + 24},${BREACH - 7} ${x + 14},${BREACH - 7}" fill="${t.breachA}"/>`;
  return `<g clip-path="url(#roadclip)">${g}</g>`;
}

function bottom(style, t) {
  const y0 = BREACH + 8;
  let g = `<rect x="0" y="${y0}" width="${W}" height="${H - y0}" fill="${t.panel}"/>
           <line x1="0" y1="${y0}" x2="${W}" y2="${y0}" stroke="${t.panelEdge}" stroke-width="3" ${style === 'neon' ? 'filter="url(#glow)"' : ''}/>`;
  // queue: 3 columns under the lanes, 3 rows, front row biggest
  const rowY = [648, 692, 734], R = [22, 18, 18];
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) {
    const cx = LANE_X[c], cy = rowY[r];
    g += `<circle cx="${cx}" cy="${cy}" r="${R[r] + 5}" fill="${t.socket}" stroke="${t.socketRing}" stroke-width="2.5"/>`;
    const [col, dmg] = QUEUE[c][r];
    g += place(bombSVG(col, dmg, style), cx, cy, R[r] * 2 * 116 / 88);
    if (r === 0) g += `<circle cx="${cx}" cy="${cy}" r="${R[r] + 8}" fill="none" stroke="${t.accent}" stroke-width="2.5" stroke-dasharray="6 5" opacity=".9"/>`;
  }
  // bench: two slots in each side gutter
  const benchPos = [[34, 670], [34, 718], [356, 670], [356, 718]];
  g += `<text x="34" y="646" text-anchor="middle" font-size="10" font-weight="800" fill="${t.font}" opacity=".6" font-family="Fredoka, Arial">HOLD</text>
        <text x="356" y="646" text-anchor="middle" font-size="10" font-weight="800" fill="${t.font}" opacity=".6" font-family="Fredoka, Arial">HOLD</text>`;
  benchPos.forEach(([x, y], i) => {
    g += `<rect x="${x - 21}" y="${y - 21}" width="42" height="42" rx="12" fill="${t.socket}" stroke="${t.socketRing}" stroke-width="2.5" stroke-dasharray="${BENCH[i] ? '' : '5 4'}"/>`;
    if (BENCH[i]) g += place(bombSVG(BENCH[i][0], BENCH[i][1], style), x, y, 40);
  });
  // boosters
  const boost = [['COLOR', 2, '#A35CFF'], ['FREEZE', 1, '#2FC4FF'], ['BOMB', 1, '#FF8A1C']];
  boost.forEach(([name, n, col], i) => {
    const x = 70 + i * 125, y = 796;
    const fill = style === 'neon' ? '#161D45' : col;
    const ring = style === 'neon' ? `stroke="${col}" stroke-width="3" filter="url(#glow)"` : style === 'toy' ? 'stroke="#1F1A33" stroke-width="3.5"' : 'stroke="#fff" stroke-width="4"';
    g += `<rect x="${x - 56}" y="${y - 25}" width="112" height="50" rx="16" fill="${fill}" ${ring}/>
          ${boosterIcon(name, x - 33, y, style)}
          <text x="${x + 12}" y="${y + 6}" text-anchor="middle" font-family="Fredoka, 'Arial Rounded MT Bold', Arial" font-weight="700" font-size="16"
            fill="#fff" stroke="${style === 'neon' ? 'none' : '#1F1A33'}" stroke-width="3.5" paint-order="stroke">${name}</text>
          <circle cx="${x + 48}" cy="${y - 22}" r="12" fill="${t.accent}" stroke="#1F1A33" stroke-width="2.5"/>
          <text x="${x + 48}" y="${y - 17.5}" text-anchor="middle" font-family="Fredoka, Arial" font-weight="800" font-size="13" fill="#1F1A33">${n}</text>`;
  });
  return g;
}

function boosterIcon(name, x, y, style) {
  const ink = style === 'neon' ? '#fff' : '#1F1A33';
  if (name === 'BOMB') return `<circle cx="${x}" cy="${y + 2}" r="10" fill="#2A2440" stroke="${ink}" stroke-width="2"/>
      <path d="M${x + 5} ${y - 7} q5 -6 9 -3" fill="none" stroke="${ink}" stroke-width="2.4"/><circle cx="${x + 14}" cy="${y - 11}" r="3" fill="#FFD42A"/>`;
  if (name === 'FREEZE') return [0, 60, 120].map(a => `<line x1="${x}" y1="${y - 11}" x2="${x}" y2="${y + 11}" stroke="#fff" stroke-width="3.2" stroke-linecap="round" transform="rotate(${a} ${x} ${y})"/>`).join('')
      + `<circle cx="${x}" cy="${y}" r="3.5" fill="#fff"/>`;
  return ['#FF3D3D', '#FFD42A', '#2FCC55', '#2F8CFF'].map((c, i) =>
      `<circle cx="${x - 6 + (i % 2) * 12}" cy="${y - 6 + Math.floor(i / 2) * 12}" r="6" fill="${c}" stroke="${ink}" stroke-width="1.6"/>`).join('');
}

function topBar(style, t) {
  let g = `<rect x="0" y="0" width="${W}" height="${TOP}" fill="${t.topBar}"/>
           <line x1="0" y1="${TOP}" x2="${W}" y2="${TOP}" stroke="${t.panelEdge}" stroke-width="3" ${style === 'neon' ? 'filter="url(#glow)"' : ''}/>`;
  // level + coins (left), pause (right)
  const pill = style === 'neon' ? `fill="#161D45" stroke="#3FE0FF" stroke-width="2"` : style === 'pop' ? `fill="${t.accent}"` : `fill="${t.accent}" stroke="#1F1A33" stroke-width="3"`;
  g += `<rect x="12" y="18" width="58" height="30" rx="15" ${pill}/>
        <text x="41" y="39" text-anchor="middle" font-family="Fredoka, Arial" font-weight="800" font-size="16" fill="${style === 'neon' ? '#fff' : '#1F1A33'}">L 8</text>
        <circle cx="26" cy="68" r="9" fill="#FFD42A" stroke="#1F1A33" stroke-width="2"/>
        <text x="40" y="73" font-family="Fredoka, Arial" font-weight="800" font-size="14" fill="${t.font}">340</text>
        <rect x="${W - 58}" y="22" width="44" height="44" rx="14" ${pill}/>
        <rect x="${W - 44}" y="33" width="6" height="22" rx="2" fill="${style === 'neon' ? '#fff' : '#1F1A33'}"/>
        <rect x="${W - 34}" y="33" width="6" height="22" rx="2" fill="${style === 'neon' ? '#fff' : '#1F1A33'}"/>`;
  // goal cards
  const goals = [['big', 'Red', 6], ['truck', 'Green', 2]];
  goals.forEach(([type, col, n], i) => {
    const x = 104 + i * 106, y = 16;
    const cardStroke = style === 'toy' ? 'stroke="#1F1A33" stroke-width="3"' : style === 'neon' ? `stroke="${PALETTE[col].base}" stroke-width="2" filter="url(#glow)"` : '';
    g += `<rect x="${x - 10}" y="${y}" width="96" height="64" rx="16" fill="${t.card}" ${cardStroke}/>`;
    g += place(vehicleSVG(type, col, style), x + 18, y + 32, 50);
    g += `<text x="${x + 60}" y="${y + 43}" text-anchor="middle" font-family="Fredoka, 'Arial Rounded MT Bold', Arial" font-weight="800" font-size="30" fill="${t.cardInk}">${n}</text>`;
  });
  return g;
}

export function sceneSVG(style) {
  const t = THEMES[style];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <defs>
      <clipPath id="roadclip"><rect x="${ROAD_L}" y="0" width="${ROAD_W}" height="${H}"/></clipPath>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    ${scenery(style, t)}${road(style, t)}${cars(style)}${breach(t)}${bottom(style, t)}${topBar(style, t)}
  </svg>`;
}

export const STYLES = Object.keys(THEMES);
export const STYLE_LABEL = Object.fromEntries(Object.entries(THEMES).map(([k, v]) => [k, v.label]));

function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
