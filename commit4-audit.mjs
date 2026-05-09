// commit4-audit.mjs — verify glow rings absent, L1/L2 intro cards, L5 regression
// Uses separate browser contexts per test family to avoid addInitScript accumulation.
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5174';
const VIEWPORT = { width: 390, height: 844 };
const browser = await chromium.launch({ headless: true });

async function newCtx() {
  return browser.newContext({ viewport: VIEWPORT, hasTouch: true });
}
async function tap(page, x, y, waitMs = 1000) {
  await page.mouse.click(x, y);
  await page.waitForTimeout(waitMs);
}
async function sc(page, name) {
  const path = `c4-${name}.png`;
  await page.screenshot({ path });
  console.log(`  captured ${path}`);
}

function buildSave(unlockedLevel, nStars = 0) {
  const stars = {};
  for (let i = 1; i <= nStars; i++) stars[i] = 1;
  return {
    unlockedLevel, stars, coins: 500, hearts: 5,
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
}

function seedScript(unlockedLevel, nStars, seenCarTypes = []) {
  const save = buildSave(unlockedLevel, nStars);
  return `() => {
    localStorage.setItem('lane-defense-v1', JSON.stringify(${JSON.stringify(save)}));
    localStorage.setItem('lane_defense_seen_car_types', JSON.stringify(${JSON.stringify(seenCarTypes)}));
    localStorage.setItem('ftue_banners', JSON.stringify(['first_car','first_shot','first_kill','first_miss','first_combo','multi_lane','bench_appear']));
    localStorage.setItem('ftue_completed', JSON.stringify(['first_car','bench','swap','peek','freeze','bomb']));
  }`;
}

// ── T1: Glow ring check — screenshot the shooter zone at L1 ──────────────────
console.log('\n=== T1: GLOW RING CHECK ===');
{
  const ctx  = await newCtx();
  const page = await ctx.newPage();
  await page.addInitScript(eval(seedScript(2, 1, ['small'])));
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(3500);
  await tap(page, 195, 496, 2500);  // PLAY
  await tap(page, 52,  794, 1500);  // L1 node
  await tap(page, 195, 360, 4500);  // START — wait 4.5 s
  // Shooter area — bottom 320 px of screen
  await page.screenshot({ path: 'c4-glow-ring-check.png', clip: { x: 0, y: 524, width: 390, height: 320 } });
  console.log('  captured c4-glow-ring-check.png');
  await ctx.close();
}

// ── T2: L1 Motorbike intro — fresh player, TIP card ───────────────────────────
// Card fires 4.5 s after level start (splash 1.35 s + FTUE 3 s buffer).
console.log('\n=== T2: L1 MOTORBIKE INTRO ===');
{
  const ctx  = await newCtx();
  const page = await ctx.newPage();
  await page.addInitScript(eval(seedScript(2, 1, [])));  // no types seen
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(3500);
  await tap(page, 195, 496, 2500);  // PLAY
  await tap(page, 52,  794, 1500);  // L1 node
  await tap(page, 195, 360, 4700);  // START — wait 4.7 s (inside 4.5–7.2 s window)
  await sc(page, 'L1-motorbike-card');
  await page.waitForTimeout(3500);  // let card auto-dismiss
  await sc(page, 'L1-after-motorbike');
  await ctx.close();
}

// ── T3: L2 Sedan intro ────────────────────────────────────────────────────────
// 'small' already seen; 'big' is fresh. Card fires 1.5 s after level start.
// unlockedLevel: 3 so L2 is accessible. Use unlockedLevel 6 so map is stable.
console.log('\n=== T3: L2 SEDAN INTRO ===');
{
  const ctx  = await newCtx();
  const page = await ctx.newPage();
  // Use unlockedLevel 6 so L2 node coordinates match the fully-unlocked map.
  // Stars 1–2 so L1/L2 are "completed" — avoids any first-time unlock screens.
  await page.addInitScript(eval(seedScript(6, 5, ['small'])));
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(3500);
  // Debug: take level-select screenshot to see node positions
  await tap(page, 195, 496, 2500);  // PLAY — now on level select
  await page.screenshot({ path: 'c4-L2-map-debug.png' });
  console.log('  captured c4-L2-map-debug.png');
  // L2 node: on the world map from a previous audit it sat at ~(140, 794)
  // Using multiple candidate taps — whichever one opens the L2 popup wins
  await tap(page, 140, 794, 800);
  await page.screenshot({ path: 'c4-L2-node-debug.png' });
  console.log('  captured c4-L2-node-debug.png');
  await tap(page, 195, 360, 2000);  // START
  await sc(page, 'L2-sedan-card');
  await page.waitForTimeout(3500);
  await sc(page, 'L2-after-sedan');
  await ctx.close();
}

// ── T4: L5 Van intro — regression ─────────────────────────────────────────────
// 'small' and 'big' already seen; 'jeep' is fresh.
console.log('\n=== T4: L5 VAN INTRO (regression) ===');
{
  const ctx  = await newCtx();
  const page = await ctx.newPage();
  await page.addInitScript(eval(seedScript(6, 5, ['small', 'big'])));
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(3500);
  await tap(page, 195, 496, 2500);  // PLAY
  await tap(page, 338, 630, 1500);  // L5 node
  await tap(page, 195, 360, 2000);  // START
  await sc(page, 'L5-van-card');
  await page.waitForTimeout(3500);
  await sc(page, 'L5-after-van');
  await ctx.close();
}

// ── T5: L1 replay — motorbike intro must NOT appear ───────────────────────────
console.log('\n=== T5: L1 REPLAY — NO SECOND INTRO ===');
{
  const ctx  = await newCtx();
  const page = await ctx.newPage();
  // 'small' already seen → intro must not fire
  await page.addInitScript(eval(seedScript(2, 1, ['small', 'big', 'jeep'])));
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(3500);
  await tap(page, 195, 496, 2500);
  await tap(page, 52,  794, 1500);  // L1 node
  await tap(page, 195, 360, 5500);  // wait past entire intro window
  await sc(page, 'L1-replay-no-intro');
  await ctx.close();
}

await browser.close();
console.log('\nAudit complete!');
console.log('Pass criteria:');
console.log('  c4-glow-ring-check     — candy bombs with colored ground halos, NO dark rings above them');
console.log('  c4-L1-motorbike-card   — "TIP / MOTORBIKE / 2 HP" card, backdrop dimmed');
console.log('  c4-L1-after-motorbike  — card gone, gameplay resumed');
console.log('  c4-L2-sedan-card       — "MEET THE / SEDAN / 4 HP" card');
console.log('  c4-L5-van-card         — "MEET THE / VAN / 5 HP" card (regression)');
console.log('  c4-L1-replay-no-intro  — clean gameplay, no motorbike card');
