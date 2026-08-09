// Repair public/sprites/ui/icon-hand.png — the FTUE tutorial hand.
//
// The shipped asset is 128x128 with its opaque content spanning y 0..127: zero
// padding, and the index fingertip is a FLAT 40px-wide column from y=0 to y=3 with
// no outline across the top. A drawn fingertip tapers over ~15-20px, so that much
// is missing from the file. The owner saw it as "the hand is cut" on L1.
//
// This does not invent new art — it closes the shape the existing art already
// defines, using that art's own measured geometry and colours:
//     white outer stroke  x 17..56   -> radius 19.5 about cx 36.5
//     dark outline        x 21..54   -> radius 16.5
//     cream fill          x 24..51   -> radius 13.5
// The cap is drawn FIRST and the original composited ON TOP, so the original's own
// pixels win everywhere they exist and only the missing tip is new.
//
// The cuff at the bottom is also clipped (y=127 is a flat 22px edge) but it is
// already tapering to a near-point there, so it just gets PADDING — an added
// ellipse read as a white nub hanging off the wrist, which looked worse than the
// 22px flat it was closing.
import sharp from 'sharp';
import fs from 'fs';

const SRC = 'public/sprites/ui/icon-hand.png';
const raw = fs.readFileSync(SRC);
const { width: W, height: H } = await sharp(raw).metadata();

// Measured from the source; see the header.
const TIP_CX = 36.5, TIP_R_WHITE = 19.5, TIP_R_DARK = 16.5, TIP_R_FILL = 13.5;
const PAD_TOP = 22;                       // room for the reconstructed tip
const PAD_BOT = 10;                       // room to close the cuff
const CUFF_CX = 67.5, CUFF_RX = 13, CUFF_RY = 8;   // y=127 span x 57..78

const WHITE = 'rgb(236,235,235)';
const DARK  = 'rgb(68,61,50)';
const CREAM = 'rgb(249,242,227)';

const CANVAS_H = H + PAD_TOP + PAD_BOT;

// Cap shapes, in the padded canvas's coordinates.
const tipCY  = PAD_TOP;                       // the finger's original y=0
const cuffCY = PAD_TOP + H - 1;               // the cuff's original y=127
const svg = `<svg width="${W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${TIP_CX}" cy="${tipCY}" r="${TIP_R_WHITE}" fill="${WHITE}"/>
  <circle cx="${TIP_CX}" cy="${tipCY}" r="${TIP_R_DARK}"  fill="${DARK}"/>
  <circle cx="${TIP_CX}" cy="${tipCY}" r="${TIP_R_FILL}"  fill="${CREAM}"/>
</svg>`;

const capped = await sharp({ create: { width: W, height: CANVAS_H, channels: 4,
                                       background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([
    { input: Buffer.from(svg), top: 0, left: 0 },
    { input: raw, top: PAD_TOP, left: 0 },       // original wins wherever it exists
  ])
  .png().toBuffer();

// Fit back into a square 128x128 with breathing room, matching icon-car/icon-book
// which carry 13-15px gaps. uiIcon scales by the longest side, so padding here
// makes the hand render slightly smaller at the same requested size — which is
// correct: it was previously oversized BECAUSE it was bleeding to the edges.
const out = await sharp(capped)
  .resize({ width: W, height: H, fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png().toBuffer();

fs.writeFileSync(SRC, out);

// Verify: nothing may touch an edge any more.
const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
let minY = 1e9, maxY = -1, minX = 1e9, maxX = -1;
for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
  if (data[(y * info.width + x) * info.channels + 3] > 10) {
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
  }
}
console.log(`repaired ${SRC}: ${info.width}x${info.height}`);
console.log(`  opaque bbox x ${minX}..${maxX}  y ${minY}..${maxY}`);
console.log(`  gaps -> top:${minY} bottom:${info.height - 1 - maxY} left:${minX} right:${info.width - 1 - maxX}`);
