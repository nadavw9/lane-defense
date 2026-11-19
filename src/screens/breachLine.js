// The gold line on the breach (continue) screen: how many cars were still needed, so the
// player can judge whether a continue is worth it (PrimeTestLab 10510, S-03).
export function breachLine(goalLeft, goalTotal) {
  if (!(goalLeft > 0)) return 'Keep going from right here?';
  if (goalLeft === 1) return 'Just ONE car left to win!';
  if (goalTotal > 0 && goalLeft <= goalTotal * 0.3) return `Only ${goalLeft} cars left to win!`;
  return `${goalLeft} cars left to win. Keep going?`;
}
