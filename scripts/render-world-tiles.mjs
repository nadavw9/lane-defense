// Rasterise the flat world surfaces (tools/art/worlds.mjs): per world, the road
// tile and the three scene-variant dispatch floors.
//
//   node scripts/render-world-tiles.mjs
//
// Vehicles, bombs and side verges are 3D — see scripts/render-3d-sprites.mjs.
import sharp from 'sharp';
import { roadTileSVG, zoneFloorSVG } from '../tools/art/worlds.mjs';

const OUT = 'public/sprites/designed';
const png = (svg, file) => sharp(Buffer.from(svg)).png().toFile(`${OUT}/${file}`);

for (const w of ['world1', 'world2', 'world3']) {
  await png(roadTileSVG(w), `road-${w}.png`);
  for (const v of ['a', 'b', 'c']) await png(zoneFloorSVG(w), `zone-${w}-${v}.png`);
}
console.log('road tiles + dispatch floors written for world1-3');
