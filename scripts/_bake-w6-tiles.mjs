import sharp from 'sharp';
import { roadTileSVG, zoneFloorSVG } from '../tools/art/worlds.mjs';
const OUT = 'public/sprites/designed';
const png = (svg, file) => sharp(Buffer.from(svg)).png().toFile(`${OUT}/${file}`);
const w = 'world6';
await png(roadTileSVG(w), `road-${w}.png`);
for (const v of ['a', 'b', 'c']) await png(zoneFloorSVG(w), `zone-${w}-${v}.png`);
console.log('road + zone tiles written for world6 only');
