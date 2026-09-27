// Colour-blind shape symbols, drawn as canvas paths (not font glyphs, which vary
// by phone and can be missing). One shape per game colour, matching the
// ColorblindMode.SHAPES table: Red ●, Blue ▲, Green ■, Yellow ★, Purple ◆,
// Orange ▼. Used on the car roof badges (Car3D) and the bomb badges (Shooter3D).

const INK = '#1F1A33';

function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

const PATHS = {
  Red:    (ctx, cx, cy, r) => { ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2); },
  Blue:   (ctx, cx, cy, r) => { ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.95, cy + r * 0.72); ctx.lineTo(cx - r * 0.95, cy + r * 0.72); ctx.closePath(); },
  Green:  (ctx, cx, cy, r) => { ctx.beginPath(); ctx.rect(cx - r * 0.74, cy - r * 0.74, r * 1.48, r * 1.48); },
  Yellow: (ctx, cx, cy, r) => starPath(ctx, cx, cy, r * 1.05),
  Purple: (ctx, cx, cy, r) => { ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.8, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.8, cy); ctx.closePath(); },
  Orange: (ctx, cx, cy, r) => { ctx.beginPath(); ctx.moveTo(cx - r * 0.95, cy - r * 0.72); ctx.lineTo(cx + r * 0.95, cy - r * 0.72); ctx.lineTo(cx, cy + r); ctx.closePath(); },
};

/**
 * A white disc with the colour's shape in ink — reads on any car or bomb
 * colour. (cx, cy) centre, r = disc radius, all in canvas pixels.
 */
export function drawColorShapeBadge(ctx, color, cx, cy, r) {
  const path = PATHS[color];
  if (!path) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.16);
  ctx.strokeStyle = INK;
  ctx.stroke();
  path(ctx, cx, cy, r * 0.58);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.restore();
}
