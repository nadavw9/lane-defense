// When the HUD shows the "×N COMBO" text and glow. A tutorial hint (hand + highlighted
// cars) holds it back so it never covers what the hint points at (PrimeTestLab 10510, S-01).
export function comboVisible(chain, held) {
  return !held && chain >= 2;
}
