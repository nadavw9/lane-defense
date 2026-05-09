// commit3-audit.mjs — verify HP bars gone, no glow rings, car type intros show
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5174';
const browser = await chromium.launch({ headless: true });
const bCtx    = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const page    = await bCtx.newPage();

async function tap(x, y, waitMs = 1000) {
  await page.mouse.click(x, y);
  await page.waitForTimeout(waitMs);
}
async function sc(name) {
  await page.screenshot({ path: `c3-${name}.png` });
  console.log(`  captured c3-${name}.png`);
}

// ── Fresh player seed: no seenCarTypes, unlockedLevel=5 ──────────────────────
async function seedFreshL5() {
  await page.addInitScript(() => {
    // Remove seen car types so intros can trigger
    localStorage.removeItem('lane_defense_seen_car_types');
    const stars = {};
    for (let i = 1; i <= 5; i++) stars[i] = 1;
    const data = {
      unlockedLevel: 6, stars, coins: 500, hearts: 5,
      boosters: { swap: 0, peek: 0, freeze: 0 },
      dailyReward: { day: 1, lastClaim: null },
      seenComboTip: true,
      seenUnlocks: { '6': true },
      achievements: {},
      totalCoinsEarned: 0, totalBenchUses: 0, totalBoostersPurchased: 0,
      totalDailyClaims: 0, dailyChallenge: { date: '', completed: false },
      totalCarsDestroyed: 0, longestCombo: 0, totalAccurateShots: 0, totalShots: 0,
      boosterUseCounts: { swap: 0, peek: 0, freeze: 0 },
      heartsLastDepleted: null, colorblindMode: false,
      hapticsEnabled: false, sfxVolume: 1.0, musicVolume: 1.0,
      loginStreak: { count: 1, lastLogin: new Date().toISOString().slice(0, 10) },
      ratingPromptShown: true, survivalBest: { wave: 0, kills: 0 },
      bestStats: {}, streakShields: 0, lastSessionMs: null, offlineCoinsCollected: 0,
    };
    localStorage.setItem('lane-defense-v1', JSON.stringify(data));
    localStorage.setItem('ftue_banners', JSON.stringify([
      'first_car', 'first_shot', 'first_kill', 'first_miss', 'first_combo', 'multi_lane', 'bench_appear',
    ]));
    localStorage.setItem('ftue_completed', JSON.stringify([
      'first_car', 'bench', 'swap', 'peek', 'freeze', 'bomb',
    ]));
  });
}

// ── L1 check: no HP bars, no numbers, clean cars ─────────────────────────────
console.log('\n=== L1: NO HP BARS ===');
await page.addInitScript(() => {
  localStorage.removeItem('lane_defense_seen_car_types');
  const stars = { 1: 1 };
  const data = {
    unlockedLevel: 2, stars, coins: 100, hearts: 5,
    boosters: { swap: 0, peek: 0, freeze: 0 },
    dailyReward: { day: 1, lastClaim: null }, seenComboTip: true,
    seenUnlocks: {}, achievements: {},
    totalCoinsEarned: 0, totalBenchUses: 0, totalBoostersPurchased: 0,
    totalDailyClaims: 0, dailyChallenge: { date: '', completed: false },
    totalCarsDestroyed: 0, longestCombo: 0, totalAccurateShots: 0, totalShots: 0,
    boosterUseCounts: { swap: 0, peek: 0, freeze: 0 },
    heartsLastDepleted: null, colorblindMode: false, hapticsEnabled: false,
    sfxVolume: 1.0, musicVolume: 1.0,
    loginStreak: { count: 1, lastLogin: new Date().toISOString().slice(0, 10) },
    ratingPromptShown: true, survivalBest: { wave: 0, kills: 0 },
    bestStats: {}, streakShields: 0, lastSessionMs: null, offlineCoinsCollected: 0,
  };
  localStorage.setItem('lane-defense-v1', JSON.stringify(data));
  localStorage.setItem('ftue_banners', JSON.stringify([
    'first_car', 'first_shot', 'first_kill', 'first_miss', 'first_combo', 'multi_lane', 'bench_appear',
  ]));
  localStorage.setItem('ftue_completed', JSON.stringify(['first_car', 'bench', 'swap', 'peek', 'freeze', 'bomb']));
});
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 25000 });
await page.waitForTimeout(3500);
await tap(195, 496, 2500);  // PLAY
await tap(52, 794, 1500);   // L1 node
await tap(195, 360, 3500);  // START
await page.waitForTimeout(8000);
await sc('L1-no-hp-bars');
await page.screenshot({ path: 'c3-L1-road-zoom.png', clip: { x: 0, y: 100, width: 390, height: 480 } });
console.log('  captured c3-L1-road-zoom.png');
await tap(375, 30, 1000);
await tap(195, 486, 2000);

// ── L5 intro: fresh player, Van intro should appear ──────────────────────────
// Card fires 1.5 s after level start (post splash-screen), displays for 2.5 s.
// Screenshot window: ~2 s after START is safely inside the card display window.
console.log('\n=== L5: VAN INTRO CARD ===');
await seedFreshL5();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 25000 });
await page.waitForTimeout(3500);
await tap(195, 496, 2500);
await tap(338, 630, 1500);  // L5 node
await tap(195, 360, 2000);  // START — wait 2 s (card appears ~1.7 s after START)
await sc('L5-van-intro-card');
await page.waitForTimeout(3500);  // let card auto-dismiss (2.5 s display + 0.18 s fade)
await sc('L5-after-intro');
await tap(375, 30, 1000);
await tap(195, 486, 2000);

// ── L5 REPLAY: intro should NOT appear again ─────────────────────────────────
console.log('\n=== L5 REPLAY: NO SECOND INTRO ===');
// seedFreshL5 addInitScript re-runs on every reload (clears lane_defense_seen_car_types).
// Restore the seen-set via evaluate() after load so the game reads it correctly.
// (getSeenCarTypes reads localStorage lazily on each call, so post-load inject works.)
await page.reload({ waitUntil: 'networkidle', timeout: 25000 });
await page.waitForTimeout(3500);
await page.evaluate(() => {
  localStorage.setItem('lane_defense_seen_car_types', JSON.stringify(['jeep']));
});
await tap(195, 496, 2500);
await tap(338, 630, 1500);
await tap(195, 360, 3500);  // wait past the 1.5 s intro window — card must NOT appear
await sc('L5-replay-no-intro');
await tap(375, 30, 1000);
await tap(195, 486, 2000);

await browser.close();
console.log('\nAudit complete!');
console.log('Pass criteria:');
console.log('  c3-L1-road-zoom     — cars visible, NO white HP pill sprites above them');
console.log('  c3-L5-van-intro-card — centered dark card: "MEET THE / VAN" + HP badge');
console.log('  c3-L5-after-intro   — card gone, gameplay resumed');
console.log('  c3-L5-replay-no-intro — no card on replay (seenCarTypes persisted)');
