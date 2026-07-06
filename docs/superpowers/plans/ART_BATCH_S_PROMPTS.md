# Batch S V2 — CALM strip panels (top-tier hierarchy pass)

User benchmarked against Clash Royale / Kingdom Rush: V1 strips read "crowded".
Root cause analysis (encode in ALL future art): in top-tier games the DECOR layer
is calm — big flat shapes, muted palette, low contrast — so gameplay pops. V1 art
has micro-detail every ~10px at full saturation, competing with cars/bombs.

## V2 STYLE PREFIX (replaces V1 prefix; same 6 filenames + band layout)

> Mobile game BACKGROUND art for the sides of a play field — it must visually
> RECEDE, never compete with foreground gameplay. Style: Royal Match environment
> art. Image 1024×1792 portrait; the only artwork is a vertical strip ~1/8 of the
> canvas width flush against the edge I specify, everything else pure white.
> Inside the strip: LARGE, SIMPLE building shapes viewed top-down 3/4 — each
> building is ONE dominant muted color plus at most 2-3 accent details (one
> awning OR one window row, not both). Between buildings leave plain calm wall
> or roof sections as visual rest. Soft, low-contrast, slightly desaturated
> palette (background layer); NO high-frequency detail, no busy patterns, no
> tiny repeated elements. 3 buildings maximum per strip, stacked, seamless
> top-to-bottom wrap. Road-facing edge: one clean simple curb line. No text,
> cars, people.

Per-image content lines: same as V1 (world1 sunny / world2 industrial / world3
neon, left/right mirrored) but honor the calm rules above. ALSO generate Batch R
road tiles (below) in the SAME palette family per world — palette unity between
road, panels and bomb zone is half of the "one scene" feel.

Runtime insurance (already in code): CityEdges tints strip panels 0xb2b2b8 (~30%
dim) so decor sits behind gameplay in the visual hierarchy regardless of art.

---

# Batch S V1 (original spec — superseded by V2 above)

Target: the REAL rendered strip = **49×708 px, aspect 1:14.45** (4-lane levels, 37/40).
Generation canvas: **1024×1792 portrait**; the panel is drawn as a **124px-wide band**
at one canvas edge (124:1792 ≡ 1:14.45 exactly) — rest of the canvas pure white.
Processing crops the band → straight width-fit in game, NO cover-crop, nothing sliced.

Save results to `sprite-sources/raw/split/` as:
`strip-world1-left.png`, `strip-world1-right.png`, `strip-world2-left.png`,
`strip-world2-right.png`, `strip-world3-left.png`, `strip-world3-right.png`

---

## STYLE PREFIX (paste before every prompt)

> Mobile game environment art, Royal Match / Toon Blast quality: glossy, chunky,
> saturated colors, soft top-down light, clean shapes readable at small size.
> Image size 1024×1792 portrait. The ONLY artwork is a narrow VERTICAL STRIP about
> one-eighth of the canvas width (~124 pixels wide) running the FULL height,
> flush against the canvas edge I specify; ALL remaining canvas is PURE FLAT WHITE
> (#FFFFFF), no shadows spilling onto it. Inside the strip: buildings viewed from
> a top-down 3/4 angle fill the strip's ENTIRE width edge-to-edge — no margin, no
> road, no empty ground inside the strip. Stack 3-4 DIFFERENT building fronts
> vertically, back to back like one continuous street wall. The strip's top and
> bottom edges must TILE SEAMLESSLY (building wall continues across the wrap —
> cut mid-wall, not at a roofline). No text, no cars, no people, no watermark.

## THE 6 PROMPTS (style prefix + one of these each)

**1 — strip-world1-left**
> Strip flush against the LEFT canvas edge. Sunny storybook city: 3-4 charming
> low-rise shopfronts in cream, teal, coral and soft yellow — striped awnings,
> flower boxes, small balconies. The strip's RIGHT edge (road side) is a neat
> continuous light-grey sidewalk curb line, perfectly straight, with tiny
> planters or a slim tree every so often.

**2 — strip-world1-right**
> Same sunny storybook city street wall, mirrored: strip flush against the RIGHT
> canvas edge; the strip's LEFT edge (road side) is the neat straight sidewalk
> curb line with planters. Different building colors/order than typical (yellow,
> mint, pink, cream) so left and right sides don't look identical.

**3 — strip-world2-left**
> Strip flush against the LEFT canvas edge. Gritty industrial district: 3-4
> different factory/warehouse fronts — red brick with arched windows, corrugated
> steel sheds, loading doors, pipes and vents, orange hazard stripe accents;
> muted rust-and-steel palette with warm orange highlights. RIGHT edge (road
> side): a straight concrete curb with occasional bollards.

**4 — strip-world2-right**
> Same industrial street wall mirrored: strip flush against the RIGHT canvas
> edge, LEFT edge is the straight concrete curb with bollards. Vary the building
> order/types (steel silo front, brick workshop, container stack) vs the left side.

**5 — strip-world3-left**
> Strip flush against the LEFT canvas edge. Neon night city: 3-4 dark building
> fronts with glowing purple/cyan/pink neon signs and warmly lit windows, wet
> reflective pavement tones, near-black blue-purple palette with vivid neon
> accents. RIGHT edge (road side): a straight dark curb catching subtle neon
> reflections, with an occasional glowing street lamp.

**6 — strip-world3-right**
> Same neon night street wall mirrored: strip flush against the RIGHT canvas
> edge, LEFT edge is the reflective dark curb with street lamps. Vary the neon
> colors/building order (more magenta/orange signs) vs the left side.

---

## Integration spec (for the wiring session — do NOT cover-crop)

1. Process: auto-crop the non-white band (flood-fill/threshold from the white side),
   resize to **98×1416** (2× display for crispness) → `public/sprites/designed/strip-world{n}-{side}.png`.
2. CityEdges `_addWorldPanel`: replace cover-crop with **width-fit**: scale = stripW/texW,
   then vertical TilingSprite (art is seamless) to fill 708px; anchored to screen edge.
   L1-L3 (wider strips): same width-fit — art scales up ~1.7-3×, acceptable softness,
   or keep the old wide panels for L1-L3 only (decide at review).
3. Manifest: replace/append family in `assetManifest.js` (audit guards files).
4. Verify: `npm run test:visual` + L5/L20/L35 screenshots; junction should meet the
   road with the art's own curb line — no shadow-gutter hack needed (Part 1 stays reverted).
