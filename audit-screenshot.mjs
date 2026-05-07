// Full audit: inject progress so L1-L20 are unlocked, screenshot each level.
// Reloads the page between levels for clean state (avoids in-game quit navigation issues).
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5173';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const page = await ctx.newPage();

async function seedAndLoad() {
  await page.addInitScript(() => {
    const stars = {};
    for (let i = 1; i <= 20; i++) stars[i] = 1;
    const data = {
      unlockedLevel: 21, stars, coins: 50, hearts: 5,
      boosters: { swap: 3, peek: 3, freeze: 3 },
      dailyReward: { day: 0, lastClaim: null },
      seenComboTip: true,
      seenUnlocks: { '6': true, '8': true, '12': true, '14': true, '20': true },
      achievements: {},
      totalCoinsEarned: 0, totalBenchUses: 0, totalBoostersPurchased: 0,
      totalDailyClaims: 0, dailyChallenge: { date: '', completed: false },
      totalCarsDestroyed: 0, longestCombo: 0, totalAccurateShots: 0, totalShots: 0,
      boosterUseCounts: { swap: 0, peek: 0, freeze: 0 },
      heartsLastDepleted: null, colorblindMode: false,
      hapticsEnabled: false, sfxVolume: 1.0, musicVolume: 1.0,
      loginStreak: { count: 1, lastLogin: new Date().toISOString().slice(0,10) },
      ratingPromptShown: true, survivalBest: { wave: 0, kills: 0 },
      bestStats: {}, streakShields: 1, lastSessionMs: null, offlineCoinsCollected: 0,
    };
    localStorage.setItem('lane-defense-v1', JSON.stringify(data));
    localStorage.setItem('ftue_banners', JSON.stringify([
      'first_car','first_shot','first_kill','first_miss','first_combo','multi_lane','bench_appear',
    ]));
    localStorage.setItem('ftue_completed', JSON.stringify([
      'first_car','bench','swap','peek','freeze','bomb',
    ]));
  });
}

async function tap(x, y, waitMs = 1500) {
  await page.mouse.click(x, y);
  await page.waitForTimeout(waitMs);
}

// Load fresh page with pre-seeded data, navigate to level select.
async function reloadToLevelSelect(label) {
  await seedAndLoad();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `audit-dbg-${label}-title.png` });
  await tap(195, 496, 2500);  // PLAY → level select
  await page.screenshot({ path: `audit-dbg-${label}-levelselect.png` });
}

// ── Level select ──────────────────────────────────────────────────────────────
await seedAndLoad();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 25000 });
await page.waitForTimeout(3500);
await tap(195, 496, 2500);
await page.screenshot({ path: 'audit-00-level-select.png' });
console.log('00 — level select captured');

// Exact node centres from LevelSelectScreen.js:
//   COLS_X=[52,150,240,338], ROWS_Y=[138,302,466,630,794], NODE_R=26
//   L1=(52,794),  L4=(338,794), L8=(52,630),  L13=(338,302)
//   L15=(150,302), L20=(338,138)

// ── L1  (bottom-left, row 0 LTR col 0) ───────────────────────────────────────
await tap(52, 794, 1200);
await page.screenshot({ path: 'audit-dbg-L1-popup.png' });
await tap(195, 435, 5000);
await page.waitForTimeout(14000);
await page.screenshot({ path: 'audit-L1.png' });
console.log('L1 done');

// ── L4  (bottom-right, row 0 LTR col 3) ──────────────────────────────────────
await reloadToLevelSelect('L4');
await tap(338, 794, 1200);
await page.screenshot({ path: 'audit-dbg-L4-popup.png' });
await tap(195, 435, 5000);
await page.waitForTimeout(14000);
await page.screenshot({ path: 'audit-L4.png' });
console.log('L4 done');

// ── L8  (left, row 1 RTL col 3→COLS_X[0]=52, y=630) ─────────────────────────
await reloadToLevelSelect('L8');
await tap(52, 630, 1200);
await page.screenshot({ path: 'audit-dbg-L8-popup.png' });
await tap(195, 435, 5000);
await page.waitForTimeout(14000);
await page.screenshot({ path: 'audit-L8.png' });
console.log('L8 done');

// ── L13 (right, row 3 RTL col 0→COLS_X[3]=338, y=302) ───────────────────────
await reloadToLevelSelect('L13');
await tap(338, 302, 1200);
await page.screenshot({ path: 'audit-dbg-L13-popup.png' });
await tap(195, 435, 5000);
await page.waitForTimeout(14000);
await page.screenshot({ path: 'audit-L13.png' });
console.log('L13 done');

// ── L15 (row 3 RTL col 2→COLS_X[1]=150, y=302) ───────────────────────────────
await reloadToLevelSelect('L15');
await tap(150, 302, 1200);
await page.screenshot({ path: 'audit-dbg-L15-popup.png' });
await tap(195, 435, 5000);
await page.waitForTimeout(14000);
await page.screenshot({ path: 'audit-L15.png' });
console.log('L15 done');

// ── L20 (row 4 LTR col 3→COLS_X[3]=338, y=138) ───────────────────────────────
await reloadToLevelSelect('L20');
await tap(338, 138, 1200);
await page.screenshot({ path: 'audit-dbg-L20-popup.png' });
await tap(195, 435, 5000);
await page.waitForTimeout(14000);
await page.screenshot({ path: 'audit-L20.png' });
console.log('L20 done');

await browser.close();
console.log('Audit complete — check audit-L1.png, audit-L8.png, audit-L15.png, audit-L20.png');
