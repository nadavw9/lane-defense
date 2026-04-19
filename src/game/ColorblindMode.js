// ColorblindMode — shape-symbol system for color-dependent UI elements.
//
// When colorblind mode is enabled, each color gets a distinct shape symbol
// drawn on top of / beside the color-coded object.  This makes the game
// playable for players with red-green or other color vision deficiencies.
//
// Usage:
//   import { isColorblind, SHAPES } from '../game/ColorblindMode.js';
//   if (isColorblind()) drawShapeSymbol(SHAPES[car.color]);

// ── Symbol map — one unique shape per game color ───────────────────────────
export const SHAPES = {
  Red:    '●',   // filled circle
  Blue:   '▲',   // up-triangle
  Green:  '■',   // filled square
  Yellow: '★',   // star
  Purple: '◆',   // diamond
  Orange: '▼',   // down-triangle
};

// ── Module-level toggle (set by SettingsScreen / GameApp) ─────────────────
let _enabled = false;

export function setColorblindMode(on) { _enabled = !!on; }
export function isColorblind()        { return _enabled; }

/** Return the shape symbol for a color name, or '' if colorblind off. */
export function shapeFor(colorName) {
  return _enabled ? (SHAPES[colorName] ?? '?') : '';
}
