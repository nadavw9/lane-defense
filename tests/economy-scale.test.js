// Coin economy scale: a win must buy about ONE booster, not eight. COINS_PER_CAR was 10
// (a win paid ~300 against 20-40 coin boosters), which made the shop, the video-ad
// coins and the booster-limited late game meaningless.
import { describe, it, expect } from 'vitest';
import { COINS_PER_CAR, RESCUE_COIN_COST } from '../src/director/DirectorConfig.js';
import { SHOP_ITEMS } from '../src/screens/ShopScreen.js';
import { LevelManager } from '../src/game/LevelManager.js';

describe('coin economy scale', () => {
  const lm = new LevelManager();
  it('a typical win pays between one and three cheapest-booster prices', () => {
    const cheapest = Math.min(...SHOP_ITEMS.map(i => i.cost));
    for (const id of [5, 20, 45, 70, 99]) {
      lm.goToLevel(id);
      const cars = lm.current.goals.filter(g => g.type !== 'defeatBoss').reduce((a, g) => a + g.count, 0) || 24;
      const win = cars * COINS_PER_CAR;
      expect(win, `L${id} pays ${win}`).toBeGreaterThanOrEqual(cheapest);
      expect(win, `L${id} pays ${win}`).toBeLessThanOrEqual(cheapest * 4);
    }
  });
  it('continuing with coins costs more than any single booster', () => {
    expect(RESCUE_COIN_COST).toBeGreaterThan(Math.max(...SHOP_ITEMS.map(i => i.cost)));
  });
});
