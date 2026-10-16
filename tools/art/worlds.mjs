// Flat world surfaces as SVG: the road tile and the dispatch floor under the
// bomb queue, per world. (The side verges are 3D dioramas baked by the sprite
// studio — tools/art/studio — so they share the vehicles' camera and light.)
//
// Road-tile contract (Road3D): 512×512, seamless, one lane wide, the lane dash
// on the vertical centre-line — Road3D offsets the tile so that line lands on
// every divider.

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function specks(r, n, colors, opacity = 0.55) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = r() * 512, y = r() * 512, rad = 0.8 + r() * 1.8;
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="${colors[Math.floor(r() * colors.length)]}" opacity="${opacity}"/>`;
  }
  return out;
}

const ROAD = {
  // Town asphalt, cream dash.
  world1: () => {
    const r = rng(7);
    return `<rect width="512" height="512" fill="#5A5E70"/>${specks(r, 260, ['#6A6E80', '#4C4F5E'])}
      <rect x="0" y="0" width="512" height="512" fill="none"/>
      <rect x="243" y="154" width="26" height="204" rx="13" fill="#F4F1E6"/>`;
  },
  // Industrial concrete slabs with expansion joints, hazard-yellow dash.
  world2: () => {
    const r = rng(11);
    const joints = [0, 128, 256, 384].map(y => `<rect x="0" y="${y}" width="512" height="4" fill="#6F717A" opacity=".7"/>`).join('');
    return `<rect width="512" height="512" fill="#858791"/>${specks(r, 300, ['#979AA3', '#747680'])}${joints}
      <rect x="0" y="0" width="4" height="512" fill="#6F717A" opacity=".5"/>
      <rect x="243" y="154" width="26" height="204" rx="4" fill="#F2C230"/>`;
  },
  // Night highway: dark asphalt, glowing cyan dash.
  world3: () => {
    const r = rng(13);
    return `<defs><filter id="g" x="-200%" y="-20%" width="500%" height="140%"><feGaussianBlur stdDeviation="9"/></filter></defs>
      <rect width="512" height="512" fill="#22263A"/>${specks(r, 240, ['#2E3350', '#1A1D2E'])}
      <rect x="237" y="146" width="38" height="220" rx="19" fill="#39E6FF" opacity=".55" filter="url(#g)"/>
      <rect x="245" y="156" width="22" height="200" rx="11" fill="#B8F6FF"/>`;
  },
};

ROAD.world4 = () => {            // sun-bleached desert asphalt, cream dash
  const r = rng(17);
  return `<rect width="512" height="512" fill="#7A6C5E"/>${specks(r, 280, ['#8A7B6B', '#6B5E51', '#9A8A76'])}
    <rect x="243" y="154" width="26" height="204" rx="13" fill="#FFF1D2"/>`;
};
ROAD.world5 = () => {            // icy asphalt with snow flecks, white dash
  const r = rng(19);
  return `<rect width="512" height="512" fill="#566070"/>${specks(r, 220, ['#647084', '#4A5362'])}${specks(r, 90, ['#F4F8FF'], 0.5)}
    <rect x="243" y="154" width="26" height="204" rx="13" fill="#F4F8FF"/>`;
};
ROAD.world6 = () => {            // wet blue-grey dock concrete, expansion joints, sky-blue dash
  const r = rng(23);
  const joints = [0, 128, 256, 384].map(y => `<rect x="0" y="${y}" width="512" height="4" fill="#47525E" opacity=".7"/>`).join('');
  return `<rect width="512" height="512" fill="#55616E"/>${specks(r, 300, ['#66737F', '#4A5561'])}${joints}
    <rect x="0" y="0" width="4" height="512" fill="#47525E" opacity=".5"/>
    <rect x="243" y="154" width="26" height="204" rx="4" fill="#3FA9F5"/>`;
};
ROAD.world7 = () => {            // violet space-night asphalt, glowing magenta dash
  const r = rng(29);
  return `<defs><filter id="g" x="-200%" y="-20%" width="500%" height="140%"><feGaussianBlur stdDeviation="9"/></filter></defs>
    <rect width="512" height="512" fill="#2B2145"/>${specks(r, 200, ['#3A2E60', '#21183A'])}${specks(r, 40, ['#FFFFFF', '#CFC3FF'], 0.7)}
    <rect x="237" y="146" width="38" height="220" rx="19" fill="#FF4FD8" opacity=".55" filter="url(#g)"/>
    <rect x="245" y="156" width="22" height="200" rx="11" fill="#FFD0F4"/>`;
};

export function roadTileSVG(world = 'world1') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${ROAD[world]()}</svg>`;
}

// Dispatch floor under the bomb queue — 780 wide, 4 rows of 65 so it tiles.
const FLOOR = {
  world1: { base: '#3A3550', tile: '#443E5E', edge: null },
  world2: { base: '#4A4E5A', tile: '#565B68', edge: '#6B7180' },   // steel plate
  world3: { base: '#1B1F36', tile: '#20264A', edge: '#39E6FF' },   // neon grid
  world4: { base: '#B9996B', tile: '#C7A878', edge: null },          // sandstone flags
  world5: { base: '#A9BBCD', tile: '#C0D0DF', edge: null },          // packed snow
  world6: { base: '#4C5967', tile: '#5A6876', edge: '#FF8A1C' },     // dock plate
  world7: { base: '#17102E', tile: '#201640', edge: '#A35CFF' },     // violet grid
};
export function zoneFloorSVG(world = 'world1', H = 260) {
  const W = 780, f = FLOOR[world];
  let tiles = '';
  for (let x = 0; x < W; x += 65) for (let y = 4; y < H; y += 65) {
    tiles += `<rect x="${x + 4}" y="${y}" width="57" height="57" rx="${world === 'world2' || world === 'world6' ? 4 : 12}" fill="${f.tile}" opacity=".7"/>`;
    if (world === 'world2' || world === 'world6') {  // diamond-plate studs
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        tiles += `<rect x="${x + 14 + i * 16}" y="${y + 10 + j * 16}" width="9" height="3" rx="1.5" fill="#7B8190" transform="rotate(35 ${x + 18 + i * 16} ${y + 11 + j * 16})"/>`;
      }
    }
    if (f.edge && (world === 'world3' || world === 'world7')) tiles += `<rect x="${x + 4}" y="${y}" width="57" height="57" rx="12" fill="none" stroke="${f.edge}" stroke-width="1.5" opacity=".28"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${f.base}"/>${tiles}</svg>`;
}
