// GameApp — PixiJS bootstrap and render loop.
//
// Responsibilities:
//   • Create all subsystems (directors, game state, loop, renderers, input)
//   • Run the RENDER ticker (variable rate, reads GameState, never writes it)
//   • Screen routing: Title → LevelSelect → Game → Win/Lose → LevelSelect
//   • Persist progress (stars, coins, boosters) to localStorage via ProgressManager
//   • Phase 3A juice: lane flash, deploy punch, car death, combo glow,
//     screen transitions, breach camera, Swap/Peek boosters
//
// Data flow:
//   InputManager → DragDrop → GameLoop.deploy() → GameState mutation
//   GameState → CarRenderer / ShooterRenderer / HUDRenderer / ParticleSystem
import { Application, Assets, Container, Graphics, Text, Ticker, TextStyle, FillGradient } from 'pixi.js';
// Display fonts, bundled (no network needed on device): Fredoka for all UI
// text, Lilita One for big titles (PremiumUI.TITLE_FONT).
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/lilita-one/400.css';

import { GameRenderer3D }  from '../renderer3d/GameRenderer3D.js';
import { assetLoader }     from '../renderer3d/AssetLoader.js';
import { LayerManager }    from './LayerManager.js';
import { LaneRenderer, laneCenterX, posToScreenY, ROAD_TOP_Y, ROAD_BOTTOM_Y, screenYToRow, frontRowTapMargin, recomputeRoadGeometry } from './LaneRenderer.js';
import { spriteFlags }     from './SpriteFlags.js';
import { CityBackground }  from './CityBackground.js';
import { CityEdges }       from './CityEdges.js';
import { CarRenderer }     from './CarRenderer.js';
import { ShooterRenderer } from './ShooterRenderer.js';
import { HUDRenderer }     from './HUDRenderer.js';
import { ParticleSystem }  from './ParticleSystem.js';
import { LaneFlash }       from './LaneFlash.js';
import { ComboGlow }       from './ComboGlow.js';

import { DragDrop }        from '../input/DragDrop.js';
import { InputManager }    from '../input/InputManager.js';
import { BenchStorage }    from '../game/BenchStorage.js';
import { BenchRenderer, benchY, benchSlotH } from './BenchRenderer.js';

import { GameState }       from '../game/GameState.js';
import { GameLoop }        from '../game/GameLoop.js';
import { CombatResolver }  from '../game/CombatResolver.js';
import { LevelManager, LEVEL_COUNT, openingRowsForLevel, clampInitialCarsToDepth, streakEnabledFor } from '../game/LevelManager.js';
import { BoosterState }    from '../game/BoosterState.js';
import { ProgressManager } from '../game/ProgressManager.js';
import { applyDda }         from '../game/dda.js';
import { HapticsManager }  from '../game/HapticsManager.js';
import { setColorblindMode } from '../game/ColorblindMode.js';

import {
  setActiveCounts, getLaneScreenX, getColumnScreenX, getColumnScreenY, getColumnSlotScreenY,
  getLaneScreenBounds, getActiveLaneCount, getActiveColCount,
} from './PositionRegistry.js';
import { CarDirector }     from '../director/CarDirector.js';
import { ShooterDirector } from '../director/ShooterDirector.js';
import { FairnessArbiter } from '../director/FairnessArbiter.js';
import { IntensityPhase }  from '../director/IntensityPhase.js';
import { SeededRandom }    from '../utils/SeededRandom.js';
import { Lane }            from '../models/Lane.js';
import { Column }          from '../models/Column.js';

import { WinScreen, calcStars }       from '../screens/WinScreen.js';
import { LoseScreen }                  from '../screens/LoseScreen.js';
import { RescueOverlay }              from '../screens/RescueOverlay.js';
import { ColorPicker }                from '../screens/ColorPicker.js';
import { PreLevelScreen }             from '../screens/PreLevelScreen.js';
import { BoosterUnlockScreen }        from '../screens/BoosterUnlockScreen.js';
import { FTUEOverlay, FeatureBanners } from '../screens/FTUEOverlay.js';
import { OnboardingHints }    from '../screens/OnboardingHints.js';
import { ModeHint } from './ModeHint.js';
import { BoosterSpotlight }      from '../screens/BoosterSpotlight.js';
import { TransitionOverlay }      from '../screens/TransitionOverlay.js';
import { TitleScreen }            from '../screens/TitleScreen.js';
import { LevelSelectScreen }      from '../screens/LevelSelectScreen.js';
import { ShopScreen }             from '../screens/ShopScreen.js';
import { DailyRewardScreen }      from '../screens/DailyRewardScreen.js';
import { SettingsScreen }         from '../screens/SettingsScreen.js';
import { PauseScreen }            from '../screens/PauseScreen.js';
import { CarManualScreen }        from '../screens/CarManualScreen.js';
import { HpGuideOverlay }         from '../screens/HpGuideOverlay.js';
import { HowToPlayOverlay }       from '../screens/HowToPlayOverlay.js';
import { TutorialOrchestrator }   from '../screens/TutorialOrchestrator.js';
import { AchievementsScreen }     from '../screens/AchievementsScreen.js';
import { StatsScreen }            from '../screens/StatsScreen.js';
import { AudioManager }           from '../audio/AudioManager.js';
import { BoosterBar }             from './BoosterBar.js';
import { GoalCounterUI }          from './GoalCounterUI.js';
import { StreakMeter }            from './StreakMeter.js';
import { adManager }            from '../ads/AdManager.js';
import { PopupQueue, PRIORITY }  from './PopupQueue.js';
import { Analytics, logEvent, setAnalyticsEnabled } from '../analytics/Analytics.js';
import { AutoTuner }             from '../analytics/AutoTuner.js';
import { AchievementManager }     from '../game/AchievementManager.js';
import { DailyChallengeManager }  from '../game/DailyChallengeManager.js';
import { CarTypeIntroCard, hasIntroCard } from '../screens/CarTypeIntroCard.js';
import { spawnableTypesFor, carHpFor } from '../director/CarTypes.js';
import { roundButton as premiumRoundButton, ribbon as premiumRibbon } from './PremiumUI.js';
import { inventorySpent } from '../game/BoosterInventory.js';
import { bombBallScreenRadius } from '../renderer3d/projection.js';
import { ComboFX } from './ComboFX.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const APP_W       = 390;
const APP_H       = 844;
const TOTAL_LANES = 4;
const TOTAL_COLS  = 4;

// Breach camera: zoom toward the breaching lane for this many seconds before
// showing the rescue overlay.
const BREACH_CAM_DURATION = 0.50; // seconds
const BREACH_CAM_ZOOM     = 0.08; // fraction over 1.0 (8% zoom-in at peak)

// ── Floating chain-hit labels ─────────────────────────────────────────────────

const CHAIN_HIT_STYLE = {
  fontSize:   26,
  fontWeight: 'bold',
  fill:       0xffdd00,
  dropShadow: { color: 0x000000, blur: 6, distance: 2, alpha: 0.9 },
};

function spawnChainHit(parent, laneIdx, position = 85) {
  const t01 = position / 100;
  const x = laneCenterX(laneIdx, t01) + (Math.random() - 0.5) * 40;
  const y = posToScreenY(position);
  const t = new Text({ text: 'CHAIN HIT!', style: CHAIN_HIT_STYLE });
  t.anchor.set(0.5);
  t.x     = x;
  t.y     = y;
  t.alpha = 1;
  parent.addChild(t);
  return { sprite: t, vy: -55, life: 1.0 };
}

function tickFloatingTexts(texts, dt) {
  for (let i = texts.length - 1; i >= 0; i--) {
    const ft     = texts[i];
    ft.life     -= dt;
    ft.sprite.y += ft.vy * dt;
    ft.sprite.alpha = Math.max(0, ft.life);
    if (ft.life <= 0) {
      ft.sprite.destroy();
      texts.splice(i, 1);
    }
  }
}

// Spawn a short-lived floating text centred horizontally at (x, y).
function spawnFloatingText(parent, x, y, text, color = 0xffffff) {
  // Chunky title face with an ink outline, so callouts read over any road/theme.
  const t = new Text({
    text,
    style: {
      fontFamily: '"Lilita One", Fredoka, Arial, sans-serif',
      fontSize:   22,
      fill:       color,
      letterSpacing: 1,
      stroke:     { color: INK, width: 5, join: 'round' },
      dropShadow: { color: 0x000000, blur: 2, distance: 3, alpha: 0.45, angle: Math.PI / 2 },
    },
  });
  t.anchor.set(0.5);
  t.x     = x;
  t.y     = y;
  t.alpha = 1;
  parent.addChild(t);
  return { sprite: t, vy: -30, life: 1.2 };
}

// ── Sprite manifest ───────────────────────────────────────────────────────────
// All sprite URL arrays + level→theme helpers live in assetManifest.js so the
// headless audit tests can verify every URL against the files on disk
// (exact-case + not-gitignored). Add new sprite families THERE, not here.

import {
  ALL_SPRITE_URLS, CRITICAL_SPRITE_URLS, WORLD_ROAD_URLS,
  buildingSetForLevel, worldPanelForLevel, sceneVariantForLevel, backdropUrlFor,
} from './assetManifest.js';
import { uiIcon } from './UIIcon.js';
import { INK, SUN, toyPanel } from './ToyStyle.js';
import { fitToSafeArea } from './SafeArea.js';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function main() {
  // Every Pixi Text without an explicit family uses Fredoka. Load the faces
  // first: Pixi rasterises text once, so text drawn before the font arrives
  // would stay in the fallback face.
  TextStyle.defaultTextStyle.fontFamily = 'Fredoka, Arial, sans-serif';
  try {
    await Promise.race([
      Promise.all(['500 20px Fredoka', '600 20px Fredoka', '700 20px Fredoka', '20px "Lilita One"'].map(f => document.fonts.load(f))),
      new Promise(r => setTimeout(r, 2500)),
    ]);
  } catch { /* fall back to Arial */ }
  const app = new Application();
  await app.init({
    width:           APP_W,
    height:          APP_H,
    backgroundAlpha: 0,               // transparent so Three.js canvas shows through
    // HUD at DPR > 2 buys nothing visible and costs fill rate on phones; MSAA is
    // only worth it on low-density screens, where HUD curves would otherwise stair-step.
    antialias:       (window.devicePixelRatio || 1) < 2,
    resolution:      Math.min(window.devicePixelRatio || 1, 2),
    autoDensity:     true,
  });
  document.body.appendChild(app.canvas);

  // ── Fit canvas to viewport ────────────────────────────────────────────────
  // (Declared early so the loading screen is already correctly sized.)
  // Letterboxed into the SAFE area (clear of notch, status and gesture bars —
  // see SafeArea.js); the 3D canvas copies this size and position.
  const _fitCanvas = () => {
    const box = fitToSafeArea(APP_W, APP_H);
    app.canvas.style.width     = box.width;
    app.canvas.style.height    = box.height;
    app.canvas.style.position  = 'absolute';
    app.canvas.style.top       = box.top;
    app.canvas.style.left      = box.left;
    app.canvas.style.transform = 'translate(-50%, -50%)';
  };
  _fitCanvas();
  window.addEventListener('resize', _fitCanvas);
  // Capacitor publishes the insets shortly AFTER load (and again when the bars
  // change) without a resize event. Re-run every resize listener a few times
  // during start-up so the fit, the 3D canvas and the cached pointer rect all
  // pick the real insets up together.
  for (const ms of [300, 1000, 2500]) setTimeout(() => window.dispatchEvent(new Event('resize')), ms);

  // ── Loading screen ────────────────────────────────────────────────────────
  // Branded loading screen: dark gradient backdrop, the TRAFFIC BOMB title in the
  // same yellow→orange gradient as TitleScreen, and a progress bar that fills as
  // assets load (no spinner, no plain "Loading..." text).
  const loadScreen = new Container();
  app.stage.addChild(loadScreen);

  const loadBg = new Graphics();
  loadBg.rect(0, 0, APP_W, APP_H);                   loadBg.fill(0x0b1226);
  loadBg.rect(0, APP_H * 0.45, APP_W, APP_H * 0.55); loadBg.fill(0x060912);
  loadScreen.addChild(loadBg);

  const loadTitle = new Text({
    text: 'TRAFFIC\nBOMB',
    style: {
      fontSize: 56, fontWeight: 'bold', align: 'center', letterSpacing: 3,
      fill: [0xFFD600, 0xFF6F00], fillGradientStops: [0, 1], fillGradientType: 0,
      stroke: { color: 0x4A1A00, width: 5 },
      dropShadow: { color: 0xFF6F00, blur: 18, distance: 0, alpha: 0.5 },
    },
  });
  loadTitle.anchor.set(0.5);
  loadTitle.x = APP_W / 2; loadTitle.y = APP_H * 0.40;
  loadScreen.addChild(loadTitle);

  // Progress bar (track + fill), centred below the title.
  const BAR_W = 260, BAR_H = 16, BAR_X = (APP_W - BAR_W) / 2, BAR_Y = APP_H * 0.56;
  const barTrack = new Graphics();
  barTrack.roundRect(BAR_X, BAR_Y, BAR_W, BAR_H, BAR_H / 2);
  barTrack.fill({ color: 0x1a2238, alpha: 0.95 });
  barTrack.roundRect(BAR_X, BAR_Y, BAR_W, BAR_H, BAR_H / 2);
  barTrack.stroke({ color: 0xFFB300, width: 2, alpha: 0.35 });
  loadScreen.addChild(barTrack);

  const barFill = new Graphics();
  loadScreen.addChild(barFill);
  const drawBar = (frac) => {
    const f = Math.max(0, Math.min(1, frac));
    barFill.clear();
    const fw = Math.max(BAR_H, BAR_W * f);   // keep the rounded cap visible from 0
    barFill.roundRect(BAR_X, BAR_Y, fw, BAR_H, BAR_H / 2);
    barFill.fill(0xFFA000);
    barFill.roundRect(BAR_X + 3, BAR_Y + 3, Math.max(2, fw - 6), BAR_H / 2 - 2, BAR_H / 4);
    barFill.fill({ color: 0xFFFFFF, alpha: 0.22 });
  };
  drawBar(0);

  // Preload sprite textures before any renderer is created. Load each one
  // INDEPENDENTLY (Promise.allSettled) so a single 404 can't reject the whole
  // batch — that was the production bug where one missing cosmetic sprite blanked
  // the entire scene. spriteFlags.loaded gates the sprite render path; it stays
  // true as long as the CRITICAL sprites (cars, bombs, boosters) load. A failed
  // cosmetic sprite (building/tree/grass) just degrades at its use-site, which
  // already guards a missing texture. The bar reserves the last 10% for GLB loading.
  let _loadedCount = 0;
  const _loadTotal = ALL_SPRITE_URLS.length;
  const _loadResults = await Promise.allSettled(
    ALL_SPRITE_URLS.map(url => Assets.load(url).then(() => url, (e) => { throw { url, err: e }; })
      .finally(() => { _loadedCount++; drawBar(0.9 * (_loadedCount / _loadTotal)); })),
  );
  const _failedCritical = [];
  for (const r of _loadResults) {
    if (r.status === 'rejected') {
      const url = r.reason?.url ?? '(unknown)';
      console.warn(`[GameApp] Sprite failed to load (continuing): ${url}`, r.reason?.err);
      if (CRITICAL_SPRITE_URLS.has(url)) _failedCritical.push(url);
    }
  }
  spriteFlags.loaded = _failedCritical.length === 0;
  if (!spriteFlags.loaded) {
    console.warn(`[GameApp] ${_failedCritical.length} CRITICAL sprite(s) failed — using programmatic graphics fallback.`, _failedCritical);
  }

  drawBar(0.9);
  try {
    await assetLoader.loadAll();
  } catch (e) {
    console.warn('[GameApp] GLB loading failed — 3D models will use box fallback.', e);
  }

  // Fill the bar to 100% and hold briefly so the completion reads, then remove.
  drawBar(1);
  await new Promise(r => setTimeout(r, 280));
  loadScreen.destroy({ children: true });

  // ── Analytics (fire-and-forget, anonymous) ────────────────────────────────
  // Consent is resolved first (UMP); analytics send nothing until it allows.
  const analytics = new Analytics();

  // ── Progress (localStorage) ──────────────────────────────────────────────
  const progress = new ProgressManager();

  // ── Haptics + Colorblind ─────────────────────────────────────────────────
  await adManager.init();
  setAnalyticsEnabled(adManager.consentGranted);
  adManager.onConsentChange = setAnalyticsEnabled;
  analytics.recordSessionStart();

  const haptics = new HapticsManager();
  haptics.enabled = progress.hapticsEnabled;

  // Apply saved colorblind preference immediately on startup.
  setColorblindMode(progress.colorblindMode);

  // Touch login streak (for title screen badge + achievements).
  const streakResult = progress.touchLoginStreak();
  const loginStreak  = streakResult.count;

  // Offline coin reward — computed once on startup; shown after title appears.
  const offlineReward = progress.claimOfflineReward();

  // ── Layers ───────────────────────────────────────────────────────────────
  const layers      = new LayerManager(app.stage);
  const laneRenderer = new LaneRenderer(layers, APP_W);
  const cityBg       = new CityBackground(layers, APP_W);
  const cityEdges    = new CityEdges(layers, APP_W);

  // ── 3D Renderer — replaces LaneRenderer + CityBackground during gameplay ─
  // Wrapped in try/catch: if WebGL is unavailable (some mobile browsers, quota
  // limits, or low-end GPUs) the game falls back to 2D-only mode gracefully.
  let gameRenderer3D;
  try {
    gameRenderer3D = new GameRenderer3D(APP_W, APP_H);
    gameRenderer3D.init();
    gameRenderer3D.hide();
    window.addEventListener('resize', () => gameRenderer3D.onResize());
  } catch (e) {
    console.warn('[GameApp] 3D renderer init failed — running in 2D mode.', e);
    // Null-safe stub: every method is a no-op so the rest of GameApp works unchanged.
    gameRenderer3D = new Proxy({}, { get: () => () => {} });
  }

  // ── Directors ────────────────────────────────────────────────────────────
  const rng        = new SeededRandom(1);
  const arbiter    = new FairnessArbiter();
  const carDir     = new CarDirector({}, rng);
  const shooterDir = new ShooterDirector({}, rng, arbiter);

  // ── Level manager ─────────────────────────────────────────────────────────
  const levelManager = new LevelManager();

  // AutoTuner: load cached modifiers from localStorage, then fetch fresh data
  // from Firebase in the background.  Never blocks startup.
  const autoTuner = new AutoTuner();
  levelManager.setAutoTuner(autoTuner);
  autoTuner.startFetch();

  const initialCfg = levelManager.current;

  // ── Fixed arrays: always 4 lanes and 4 columns ───────────────────────────
  const lanes   = Array.from({ length: TOTAL_LANES }, (_, id) => new Lane({ id }));
  const columns = Array.from({ length: TOTAL_COLS },  (_, id) => new Column({ id }));

  // ── Game state ───────────────────────────────────────────────────────────
  const phaseMan = new IntensityPhase(initialCfg.duration);
  const gs = new GameState({
    lanes, columns,
    colors:    initialCfg.colors,
    world:     initialCfg.worldConfig,
    duration:  initialCfg.duration,
    phaseMan,
    laneCount: initialCfg.laneCount,
    colCount:  initialCfg.colCount,
  });

  // ── Combat ───────────────────────────────────────────────────────────────
  const combatResolver = new CombatResolver();

  // ── Pass stable game-data refs to 3D renderer ─────────────────────────────
  // lanes, columns, and gs.firingSlots are stable array objects; their
  // contents change each frame but the refs never change.
  gameRenderer3D.setGameData(lanes, columns, gs.firingSlots);

  // ── Audio ─────────────────────────────────────────────────────────────────
  const audio = new AudioManager();

  // ── Boosters ──────────────────────────────────────────────────────────────
  // FIX 4E: booster counts no longer persist between levels — each level is seeded
  // fresh in _startLevel (0 + any pre-level "Power Up?" ad grant). They start empty.
  const boosterState = new BoosterState();
  // Pending booster bundle from the pre-level "Power Up?" screen, consumed by _startLevel.
  let _pendingBoosterGrant = null;
  let preLevelScreen = null;   // active "Power Up?" screen
  let colorPicker    = null;   // active COLOR CHANGE color picker
  // §3e transient (session-only, not persisted): a win that CHANGED a building's
  // state to repaired stashes { building, prior } here so the next level-select
  // entry plays the repair pop once. prior===2 (replay-win, nothing changed) never
  // sets it → grinding a beaten level pays zero animation tax.
  let _pendingCityAnim = null;

  // ── Bench storage + renderer ──────────────────────────────────────────────
  const benchStorage  = new BenchStorage();
  const benchRenderer = new BenchRenderer(layers, benchStorage, APP_W);

  // ── HUD + Particles + juice effects ───────────────────────────────────────
  gs.boosterState = boosterState;   // expose to HUDRenderer for frozen badge
  const hudRenderer   = new HUDRenderer(layers, gs, APP_W, audio);
  hudRenderer.setLevel(levelManager.levelNumber);
  const particles     = new ParticleSystem(layers);
  const floatingTexts = [];
  const laneFlash     = new LaneFlash(layers);
  const comboGlow     = new ComboGlow(layers, APP_W, APP_H);
  const goalCounterUI = new GoalCounterUI(layers.get('hudLayer'), APP_W, {
    onComplete: () => audio.play('coin_collect'),   // booster-earned SFX on goal complete
  });
  // V2 Hot Streak meter (on the breach stripe). Anchors = every bomb the player
  // could fire next: the column tops and any filled bench slot.
  const streakMeter = new StreakMeter(layers.get('hudLayer'));
  streakMeter.setAnchors(() => {
    const out = [];
    for (let c = 0; c < gs.activeColCount; c++) {
      if (gs.columns[c]?.top()) out.push({ x: getColumnScreenX(c), y: getColumnScreenY(), r: bombBallScreenRadius() });
    }
    for (let i = 0; i < benchStorage.size; i++) {
      if (benchStorage.getSlot(i)) { const p = benchRenderer.getSlotCenter(i); out.push({ x: p.x, y: p.y, r: 22 }); }
    }
    return out;
  });
  const boosterBar    = new BoosterBar(
    layers, boosterState, gs, APP_W,
    () => {
      // COLOR CHANGE button — toggle "tap a car" mode; cancel dismisses the picker too.
      if (boosterState.colorChangeMode) { boosterState.cancelColorChange(); _dismissColorPicker(); return; }
      if (boosterState.activateColorChange()) {
        audio.play('booster_activate');
        boostersUsedThisLevel.push('colorchange');
        logEvent('booster_used', { booster: 'colorchange', levelId: currentLevelIsDaily ? 'daily' : levelManager.levelNumber });
        tutOrch?.completeIfActive('colorchange');
        featureBanners.fire('colorchange_use', 'Tap a car, pick a color — ALL cars of that color transform!');
      }
    },
    () => {
      // Already frozen: a second tap would spend a charge for the same frozen turn.
      if (boosterState.isFrozen()) return;
      audio.play('booster_activate'); audio.play('freeze_tinkle'); boosterState.activateFreeze(); boostersUsedThisLevel.push('freeze'); logEvent('booster_used', { booster: 'freeze', levelId: currentLevelIsDaily ? 'daily' : levelManager.levelNumber }); tutOrch?.completeIfActive('freeze');
    },
    () => {
      // BOMB button — toggle placement mode on/off.
      if (boosterState.bombMode) {
        boosterState.cancelBomb();
      } else if (boosterState.activateBomb()) {
        audio.play('booster_activate');
        boostersUsedThisLevel.push('bomb');
        logEvent('booster_used', { booster: 'bomb', levelId: currentLevelIsDaily ? 'daily' : levelManager.levelNumber });
        tutOrch?.completeIfActive('bomb');
      }
    },
  );
  // BoosterBar draws a full-width bg on hudLayer; lift the HUD flank elements
  // (volume / level / coins) back above it so they render on the booster row.
  hudRenderer.bringToFront();


  // ── Per-level booster tracking (for analytics) ───────────────────────────
  let boostersUsedThisLevel = [];

  // ── Per-level tutorial state ───────────────────────────────────────────────
  let firstDeployTooltipShown = false;
  let firstKillDoneThisLevel  = false;

  // Cars destroyed by the most recent shot — set in onHit, read by the multi-kill
  // popup (onHit runs just before _onMultiKill, so this is the current shot's count).
  let _lastShotKills = 0;

  // ── Popup queue — single source of truth for all banner popups ────────────
  const popupQueue = new PopupQueue(layers.get('hudLayer'), APP_W);
  const modeHint   = new ModeHint(layers.get('hudLayer'), APP_W);

  // ── FTUE per-feature banners (once-per-lifetime, persisted to localStorage) ─
  const featureBanners = new FeatureBanners(popupQueue, APP_W);
  // Tips, achievements and ambient toasts dock under the goal band, clear of
  // the breach zone where the losing car is decided. Read at show time.

  // ── Onboarding hints — three lifetime one-time tutorial MODAL cards (HP/book,
  //    match-damage, cars-advance). Rendered on app.stage, above the HUD. ───────
  const onboardingHints = new OnboardingHints(app.stage, APP_W, APP_H);
  // ── Unified modal-card queue (FIX 2) ──────────────────────────────────────
  // ALL modal cards (onboarding hints, car-type intros, color-bomb intro) route
  // through here so only one is ever visible at a time. The loop pauses while any
  // card is up and resumes when the queue drains. `show` is (onDone) => void and
  // MUST call onDone() when its card fully dismisses.
  const _modalQueue = [];
  let _modalActive  = false;
  function _enqueueModal(show) {
    _modalQueue.push(show);
    if (!_modalActive) _runNextModal();
  }
  function _runNextModal() {
    if (_modalQueue.length === 0) {
      if (_modalActive) {
        _modalActive = false;
        // Resume only if nothing else holds the game: the pause menu (or a screen
        // opened from it) owns the pause and resumes on its own RESUME.
        if (gameLoopStarted && !gs.isOver && !pauseScreen && !settingsScreen && !carManualScreen && !levelSelectScreen) gameLoop.resume();
      }
      return;
    }
    if (!_modalActive) {
      _modalActive = true;
      if (gameLoopStarted && !gameLoop.paused && !gs.isOver) gameLoop.pause();
    }
    const show = _modalQueue.shift();
    show(() => _runNextModal());
  }
  // Everything that owns the input above the board (names, for QA hooks too).
  function _boardBlockers() {
    const b = [];
    if (_modalActive) b.push('modal');
    if (colorPicker) b.push('picker');
    if (pauseScreen) b.push('pause');
    if (settingsScreen) b.push('settings');
    if (carManualScreen) b.push('carManual');
    if (hpGuideOverlay) b.push('hpGuide');
    if (howToPlayOverlay) b.push('howToPlay');
    if (rescueOverlay) b.push('rescue');
    if (winScreen) b.push('win');
    if (unlockScreen) b.push('unlock');
    if (carTypeIntroCard) b.push('introCard');
    if (gs?.isOver) b.push('over');
    return b;
  }
  function _clearModalQueue() { _modalQueue.length = 0; _modalActive = false; }
  // Back-compat alias: onboarding hint call sites use _showHintCard(show).
  const _showHintCard = _enqueueModal;

  // ── FTUE overlay ──────────────────────────────────────────────────────────
  let ftueOverlay = null;  // created in _startLevel
  let tutOrch     = null;  // assigned after gameLoop is constructed

  // ── Car type intro card ───────────────────────────────────────────────────
  // Bug A: intros fire at level start ONLY, once per type EVER (persisted in
  // ProgressManager.introducedCarTypes). The old flow re-showed cards mid-level
  // whenever a refill spawned a type (localStorage key + no backfill).
  let carTypeIntroCard    = null;  // active intro card (only one at a time)
  let carTypeIntroTimer   = null;  // setTimeout handle for level-start intro delay

  // Canonical reveal order when one level introduces several new types at once.
  const INTRO_ORDER = ['small', 'big', 'jeep', 'truck', 'bigrig', 'tank'];

  // ── End-of-game screens ───────────────────────────────────────────────────
  let winScreen        = null;
  let rescueOverlay    = null;
  let unlockScreen     = null;
  let boosterSpotlight = null;

  // ── Meta screens ─────────────────────────────────────────────────────────
  let titleScreen        = null;
  let levelSelectScreen  = null;
  let shopScreen         = null;
  let dailyRewardScreen  = null;
  let settingsScreen     = null;
  let pauseScreen        = null;
  let carManualScreen    = null;
  let hpGuideOverlay     = null;
  let howToPlayOverlay   = null;
  let achievementsScreen = null;
  let statsScreen        = null;
  // Back-action per open screen, registered where each screen is created, so the
  // Android back button (and Escape on desktop) does exactly what that screen's
  // own Back / Close button does. See _handleBack().
  const _closers = {};

  // ── Achievement system ────────────────────────────────────────────────────
  const achievementManager    = new AchievementManager(progress);
  const dailyChallengeManager = new DailyChallengeManager();
  const weeklyPlaylist        = dailyChallengeManager.getWeeklyPlaylist();

  // ── Per-level daily/no-rescue flags ───────────────────────────────────────
  let currentLevelIsDaily  = false;
  // The level config currently in play. The CAR HP manual reads spawnScript /
  // initialCars off this to decide which types the level can actually produce;
  // GameState does not carry them, and a stale copy here is exactly the drift the
  // manual was fixed for, so it is assigned on every level start.
  let currentLevelCfg      = null;
  let noRescueThisLevel    = false;
  let dailyDateKey         = '';
  let coinsAtLevelStart    = 0;

  // ── Transition overlay (always topmost) ───────────────────────────────────
  const transition = new TransitionOverlay(app.stage, APP_W, APP_H);

  // ── Pause button (|| icon, top-right of HUD, shown during gameplay) ──────
  const pauseBtn = (() => {
    // Header, top-right (where top games put it): the same round premium button
    // as the car-HP button on the left. How-to-play lives in the pause menu.
    const glyph = new Graphics();
    glyph.roundRect(-7, -8, 5, 16, 1.5).fill(0xFFFFFF).stroke({ color: INK, width: 1.5 });
    glyph.roundRect(2, -8, 5, 16, 1.5).fill(0xFFFFFF).stroke({ color: INK, width: 1.5 });
    const g = premiumRoundButton(glyph, { r: 21, color: 0x3F63C8, onTap: () => showPause() });
    g.x = APP_W - 32; g.y = 46;
    g.visible = false;
    layers.get('hudLayer').addChild(g);
    return g;
  })();

  // ── Book icon — opens car encyclopedia (top-left of HUD, shown during gameplay) ─
  const bookBtn = (() => {
    const HIT = 44;
    const g   = new Graphics();
    g.roundRect(0, 0, HIT, HIT, 8);
    g.fill({ color: 0x000000, alpha: 0.40 });
    // Bottom info bar, left-of-centre (top zone is goals-only now).
    g.x       = 116;
    g.y       = 702;
    g.eventMode = 'static';
    g.cursor    = 'pointer';
    g.visible   = false;
    g.on('pointerdown', () => showCarManual());
    g.on('pointerover',  () => { g.alpha = 0.70; });
    g.on('pointerout',   () => { g.alpha = 1.00; });
    const icon = uiIcon('book', 26, '📖');   // sprite (glyph fallback), same slot
    icon.x = HIT / 2; icon.y = HIT / 2;
    g.addChild(icon);
    layers.get('hudLayer').addChild(g);
    return g;
  })();

  // ── Goal-bar flank buttons — HP guide (🚗 left) + how-to-play (❓ right) ────────
  // On the goal pill row (~y=47). Shown during gameplay; open a paused overlay.
  function _makeGoalBarBtn(glyph, x, onTap, iconName = null) {
    // Round premium icon button (PremiumUI.roundButton), centred on the goal
    // slots' row inside the header band.
    const icon = iconName ? uiIcon(iconName, 24, glyph)
      : new Text({ text: glyph, style: { fontFamily: '"Lilita One", Fredoka, Arial, sans-serif', fontSize: 24, fill: 0xFFFFFF,
          stroke: { color: INK, width: 4, join: 'round' } } });
    icon.anchor?.set?.(0.5, 0.5);
    const g = premiumRoundButton(icon, { r: 21, color: 0x3F63C8, onTap });
    g.x = x; g.y = 46;
    g.visible = false;
    layers.get('hudLayer').addChild(g);
    return g;
  }
  const hpGuideBtn   = _makeGoalBarBtn('🚗', 32,          () => showHpGuide(), 'car');
  // How-to-play moved into the pause menu; the header's right slot is pause.
  const howToPlayBtn = { visible: false, destroyed: true };

  // (Color-bomb streak pip counter removed — color bombs are now earned by a
  //  single-shot MULTI-KILL of 2+ cars, not by a consecutive-shot streak. FIX 4.)

  // ── Stage effects ─────────────────────────────────────────────────────────
  let shakeTime = 0;
  let breachCam = null;       // null | { laneIdx, t, done }

  // ── Game-loop flag — start() called only once ─────────────────────────────
  let gameLoopStarted = false;
  // ── Renderers ────────────────────────────────────────────────────────────
  const carRenderer     = new CarRenderer(layers, lanes);
  const shooterRenderer = new ShooterRenderer(layers, columns, boosterState);

  // ── Level config helper ───────────────────────────────────────────────────
  function applyLevelConfig(cfg) {
    gs.activeLaneCount    = cfg.laneCount;
    gs.activeColCount     = cfg.colCount;
    gs.colors             = cfg.colors;
    // §3d DDA + safety: gs.world is ALWAYS a fresh deep copy (via applyDda),
    // never a reference to LevelManager's config — a raw ref would let any
    // downstream write poison the balance source of truth, catastrophic for
    // shared presets. The fail-streak mercy factor (base 1.0) is folded into
    // the copy's heft (spawn mix) here and nowhere else; the copy is what the
    // Director reads. Daily challenge never gets mercy (non-numeric id → 0).
    const failStreak = typeof cfg.id === 'number' ? progress.getFailStreak(cfg.id) : 0;
    gs.world = applyDda(cfg.worldConfig, failStreak);
    gs.phaseMan           = new IntensityPhase(cfg.duration);
    gameLoop.baseDuration = cfg.duration;
    // Turn-based target: use explicit targetKills or compute from duration.
    gs.targetKills = cfg.targetKills ?? Math.max(5, Math.round((cfg.duration ?? 60) * 0.12));
    gs.gridRows    = cfg.gridRows ?? 10;  // default 10 road slots
    // Opening depth is gridRows-aware (2026-07-25 rows-8 pilot): shallow boards
    // get a shallower deal, or the opening alone floods the runway. Scripted
    // openings (L10/L40) go through the same depth rule. Both derived from the
    // ONE source in LevelManager — never re-derive here (sim reads the same).
    gs.initialCars = clampInitialCarsToDepth(cfg.initialCars ?? null, gs.gridRows);
    gs.openingRows = openingRowsForLevel(cfg.id, gs.gridRows);
    // Spawn budget & lane fill target (budget-based win replaces kill-count win).
    gs.spawnBudget         = cfg.spawnBudget        ?? null;
    gs._initialSpawnBudget = cfg.spawnBudget        ?? null;
    gs.laneTargetCarCount  = cfg.laneTargetCarCount ?? 2;
    // Level Goal System: propagate this level's goals into GameState (restart() →
    // resetLevel() re-derives goalProgress from _initialGoals each play).
    gs.goals          = cfg.goals ?? [];
    gs._initialGoals  = cfg.goals ? JSON.parse(JSON.stringify(cfg.goals)) : [];
    gs.goalProgress   = gs.goals.map(g => g.count);
    carDir.setLevel(typeof cfg.id === 'number' ? cfg.id : 1);
    carDir.setSpawnScript(cfg.spawnScript ?? null);   // §3c staged boss waves (INFRA-C)
    carDir.setTraits(cfg.traits ?? null, cfg.colors);  // V2 special cars (TrafficRules)
    gs.streakEnabled = streakEnabledFor(cfg);           // V2 Hot Streak
    streakMeter.setEnabled(gs.streakEnabled);
    streakMeter.reset();
    shooterDir.setColorBias(cfg.shooterColorWeights ?? null);   // §3c L10 v2 supply bias
  }

  // ── Core level-start routine ──────────────────────────────────────────────
  // Called both for normal levels (levelId: number) and for the daily challenge
  // (levelIdOrConfig: full config object with isDaily:true).
  // ── Owned boosters (inventory) ─────────────────────────────────────────────
  // A level starts with its ad grant PLUS the player's owned boosters. When it
  // ends, only what was actually spent comes off the inventory; the ad grant is
  // spent first (it is level-only). Idempotent per level: _levelInv clears on
  // settle, so several exit paths may call it safely. A missed exit (app killed
  // mid-level) costs the player nothing.
  let _levelInv = null;
  let _lossRecorded = false;   // _recordFinalLoss runs once per level
  function _settleInventory() {
    if (!_levelInv) return;
    const { taken } = _levelInv;
    _levelInv = null;
    const spent = inventorySpent(taken, { colorChange: boosterState.colorChange, freeze: boosterState.freeze, bombs: boosterState.bombs });
    for (const [key, used] of Object.entries(spent)) if (used > 0) progress.addInventory(key, -used);
  }

  function _startLevel(levelIdOrConfig) {
    _settleInventory();   // restart / next level: debit the previous attempt first
    // Tear down any lingering overlay screens.
    winScreen?.destroy();           winScreen        = null;
    rescueOverlay?.destroy();       rescueOverlay    = null;
    ftueOverlay?.destroy();         ftueOverlay      = null;
    unlockScreen?.destroy();        unlockScreen     = null;
    boosterSpotlight?.destroy();    boosterSpotlight = null;
    tutOrch?.dismiss();
    clearTimeout(carTypeIntroTimer); carTypeIntroTimer   = null;
    carTypeIntroCard?._destroy();   carTypeIntroCard    = null;
    _dismissColorPicker();                 // FIX 4B: clear any open picker
    preLevelScreen?.destroy(); preLevelScreen = null;   // FIX 4D
    _clearModalQueue();
    breachCam = null;   // a breach camera from the previous attempt must not open a rescue on this one

    // Resolve config from either a number or a pre-built config object.
    let cfg;
    let levelId;
    if (typeof levelIdOrConfig === 'object' && levelIdOrConfig !== null) {
      cfg     = levelIdOrConfig;
      levelId = 'daily';
    } else {
      levelManager.goToLevel(levelIdOrConfig);
      cfg     = levelManager.current;
      levelId = levelIdOrConfig;
    }

    logEvent('level_started', { levelId });

    currentLevelCfg     = cfg;
    currentLevelIsDaily = cfg.isDaily  ?? false;
    noRescueThisLevel   = cfg.noRescue ?? false;
    dailyDateKey        = currentLevelIsDaily ? dailyChallengeManager.getTodayKey() : '';

    // FIX 4E: booster counts reset every level — they do NOT carry over. The only
    // starting boosters come from the pre-level "Power Up?" ad offer (_pendingBoosterGrant).
    boosterState.cancelColorChange();
    boosterState.freezeShots = 0;
    boosterState.cancelBomb();
    boosterState.queueActionUsed = false;  // free queue action available at level start
    const grant = _pendingBoosterGrant ?? { colorChange: 0, freeze: 0, bombs: 0 };
    _pendingBoosterGrant = null;
    const inv = progress.getInventory();
    const taken = {
      colorChange: inv.colorChange ?? 0,
      freeze:      inv.freeze ?? 0,
      bombs:       Math.max(0, Math.min(inv.bombs ?? 0, boosterState.bombsMax - Math.min(boosterState.bombsMax, grant.bombs ?? 0))),
    };
    boosterState.colorChange = (grant.colorChange ?? 0) + taken.colorChange;
    boosterState.freeze      = (grant.freeze ?? 0) + taken.freeze;
    boosterState.bombs       = Math.min(boosterState.bombsMax, grant.bombs ?? 0) + taken.bombs;
    _levelInv = { taken };
    _lossRecorded = false;
    adManager.resetForLevel();

    applyLevelConfig(cfg);
    // Queue-reorder unlock gate (L5+): set the 1-indexed level on GameState. Daily
    // uses a high id so the advanced daily challenge always has reorder enabled.
    gs.levelId = (typeof levelId === 'number') ? levelId : 99;
    dragDrop.setReorderEnabled((typeof levelId === 'number' ? levelId : 99) >= 5);
    dragDrop.setGridRows(gs.gridRows);   // board depth drives the BOMB front-row tap margin
    // Use levelNumber for normal levels; 'D' label for daily challenge.
    hudRenderer.setLevel(currentLevelIsDaily ? 'D' : levelManager.levelNumber);

    // Set goals for the level (if any). gs.goals is set by the level config.
    // If empty, goalCounterUI hides itself automatically.
    // Stays HERE, at its original point in level start: moving it later (past
    // setActiveLaneCount, to get the projection configured first) regressed the
    // L5 deploy smoke tests in CI. The band's depth-aware height is applied
    // afterwards instead, via setGridRows, which re-lays out the existing cards.
    goalCounterUI.setGoals(gs.goals ?? []);

    // Feature gating: bench unlocks at L4 (hidden for L1-3). COLOR CHANGE and FREEZE
    // are now earned in-level (coin threshold / 3-car chain) or via the pre-level ad
    // offer, so both booster buttons are visible from the start (FIX 4).
    const benchUnlocked  = currentLevelIsDaily || levelId >= 4;
    benchStorage.reset();
    benchRenderer.setVisible(benchUnlocked);
    boosterBar.setButtonVisibility(true, true);

    boostersUsedThisLevel       = [];
    firstDeployTooltipShown     = false;
    firstKillDoneThisLevel      = false;
    popupQueue.clear();
    popupQueue.setSuppressed(false);   // lift any end-screen toast suppression
    boosterBar.setVisible(true);       // restore bar hidden by a prior end-screen

    // FTUE feature banners fired at level start when a feature first appears.
    if ((cfg.laneCount ?? 4) >= 3) featureBanners.fire('multi_lane', 'New lane open! Each lane needs a matching-color bomb.');
    if (benchUnlocked && levelId === 4) featureBanners.fire('bench_appear', 'Bench unlocked — store a bomb here for later!');
    setActiveCounts({ laneCount: cfg.laneCount ?? 4, colCount: cfg.colCount ?? 4 });
    // FIX 4: route the level's intro hint through the unified notification queue
    // (safe gap, one-at-a-time) instead of FTUEOverlay's own bottom banner — except
    // the L1 drag-arrow hint, which stays in the overlay because it points at the bomb.
    let ftueCfg = cfg;
    if (cfg.hintText && !cfg.showArrow && typeof levelId === 'number') {
      // NEW!/BOSS! intros are already the level card's headline (every level
      // start goes through _showPreLevel); repeating them in-game only covered
      // the board. Other hints still fire once as a tip.
      if (!/^(NEW!|BOSS!|FINAL BOSS!)/.test(cfg.hintText)) featureBanners.fire(`hint_L${levelId}`, cfg.hintText);
      ftueCfg = { ...cfg, hintText: null };
    }
    // FTUEOverlay must be created AFTER setActiveCounts so that PositionRegistry
    // returns correct lane/column screen positions for the current level geometry.
    ftueOverlay = _makeFTUEOverlay(app.stage, APP_W, APP_H, ftueCfg);
    carRenderer.clearAll();
    gameRenderer3D.resetLevel();
    gameRenderer3D.applyTheme(levelId);
    gameRenderer3D.setActiveLaneCount(cfg.laneCount ?? 4);
    gameRenderer3D.setActiveColCount(cfg.colCount ?? 4);
    // Board depth — MUST be set before any car mesh is created: Car3D bakes each
    // car's scale at creation from gridRows and never rescales it. Uses gs.gridRows
    // (already defaulted above) rather than cfg, so the daily challenge and any
    // other config without an explicit gridRows gets the same value the game logic
    // uses, not a second guess. See GameRenderer3D.setGridRows for the bug history.
    gameRenderer3D.setGridRows(gs.gridRows);

    // Goal-band depth. MUST come after setActiveLaneCount above: the band's
    // row-0 occlusion floor is computed through projection.js, whose scale is
    // lane-count-keyed, so sizing it earlier measures the PREVIOUS level's band.
    // (Found by screenshot — the unit tests passed because they set the lane
    // count themselves. Same create-before-configure shape as the gridRows bug,
    // one dependency further out.)
    // setGoals already ran above, so this re-lays out the existing cards with
    // the correct depth rather than reordering level start around it.
    goalCounterUI.setGridRows(gs.gridRows);
    // projection.js's band is now lane-count-keyed (THREE_LANE_REDESIGN_BATCH.md
    // §1) — setActiveLaneCount() above already updated it (via Scene3D). Refresh
    // the 2D chrome geometry (breach stripe, road strips, tap-to-row mapping)
    // that derives from it BEFORE anything below reads ROAD_TOP_Y/ROAD_BOTTOM_Y/
    // screenYToRow — cityEdges.setLaneCount() a few lines down calls its own
    // ROAD_H refresh, but only after this has run.
    recomputeRoadGeometry();
    // Unified world scene: panels + dispatch floor rotate a/b/c variants per
    // level; the road tile is per-world (sliced from the same scene family).
    const world        = worldPanelForLevel(levelId);
    const worldVariant = `${world}-${sceneVariantForLevel(levelId)}`;
    cityEdges.setBuildingSet(buildingSetForLevel(levelId));   // programmatic fallback
    cityEdges.setWorldPanel(worldVariant);                    // scene-variant panels
    cityEdges.setLaneCount(cfg.laneCount ?? 4);
    gameRenderer3D.setRoadTexture(WORLD_ROAD_URLS[world] ?? null);
    // Baked full-scene backdrop, when one exists for this world/variant/lanes:
    // it carries the road, verges and bomb depot, so the strips step aside.
    const backdrop = backdropUrlFor(levelId, cfg.laneCount ?? 4);
    gameRenderer3D.setBackdrop(backdrop);
    cityEdges.setBackdropActive(!!backdrop);
    // Zone floor renders as a 3D plane UNDER the bombs (a Pixi floor would
    // occlude the 3D bomb spheres — front canvas covers back canvas).
    gameRenderer3D.setZoneTexture(`${import.meta.env.BASE_URL}sprites/designed/zone-${worldVariant}.png`);
    shooterRenderer.setWorld(worldVariant);                   // (sockets only now)
    shooterRenderer.setLaneCount(cfg.laneCount ?? 4);
    gameRenderer3D.startLevelIntro();
    gameRenderer3D.setCombo(0);
    _clearModalQueue();   // drop any queued cards from a previous level
    shooterRenderer.enable3DMode(true);
    shooterRenderer.container.visible = false;

    // Start the game-loop ticker exactly once; restart() resets state each time.
    if (!gameLoopStarted) {
      gameLoopStarted = true;
      gameLoop.start();
    }
    gameLoop.resume();   // un-pause if coming from a Quit
    gameLoop.restart();

    // Level-start car-type intros (Bug A): every type this level can spawn that
    // the player has never been introduced to gets its card now — nothing fires
    // mid-level. Cards route through the modal queue, so multiple new types show
    // one after another in INTRO_ORDER. Fires after the splash clears (1.5 s), or
    // after the FTUE drag-arrow window on L1 (4.5 s = 1.35 s splash + 3 s FTUE).
    {
      // L1's motorbike is the baseline car, not a "new" one: the card popped up
      // 4.5 s in — mid-drag for a first-time player — and ate the drag. Mark it
      // seen silently; cards start at L2 (the car).
      if (levelId === 1 && !progress.getIntroducedCarTypes().has('small')) progress.markCarTypeIntroduced('small');
      const introduced = progress.getIntroducedCarTypes();
      const newTypes = INTRO_ORDER.filter(
        (t) => _levelCarTypes(cfg).has(t) && hasIntroCard(t) && !introduced.has(t),
      );
      if (newTypes.length > 0) {
        const delay = 1500;   // right after the level splash, before the first move
        carTypeIntroTimer = setTimeout(() => {
          carTypeIntroTimer = null;
          if (gs.isOver) return;
          for (const t of newTypes) {
            progress.markCarTypeIntroduced(t);
            _triggerCarTypeIntro(t);
          }
        }, delay);
      }
    }

    pauseBtn.visible = true;
    bookBtn.visible  = false;  // in-game manual button hidden; reachable via pause screen

    // ── Booster unlock popup (once per feature, normal levels only) ───────────
    // FIX 4: COLOR CHANGE and FREEZE are now available from L1 (earned in-level or via
    // the pre-level ad offer), so the only remaining unlock is the L4 bench. COLOR
    // CHANGE / FREEZE are introduced by their first-use banner and earn toasts.
    const UNLOCK_LEVELS = [4];
    const SPOTLIGHT_BOOSTER = {};   // no booster-bar spotlight; L4 → bench tutorial below
    const TUTOR_BOOSTER = {};

    if (!currentLevelIsDaily && UNLOCK_LEVELS.includes(levelId) && !progress.hasSeenUnlock(levelId)) {
      gameLoop.pause();
      // The screen calls onPlay synchronously from its constructor when it has
      // nothing to show (L4's entry is the bench tutorial, not a card) — so the
      // assignment below must not resurrect a screen onPlay already closed.
      let unlockClosed = false;
      const scr = new BoosterUnlockScreen(app.stage, APP_W, APP_H, levelId, {
        onPlay: () => {
          unlockClosed = true;
          progress.markSeenUnlock(levelId);
          unlockScreen?.destroy();
          unlockScreen = null;
          const spotBooster = SPOTLIGHT_BOOSTER[levelId];
          if (spotBooster) {
            boosterSpotlight = new BoosterSpotlight(app.stage, APP_W, APP_H, spotBooster, () => {
              boosterSpotlight = null;
              gameLoop.resume();
              const tc = TUTOR_BOOSTER[spotBooster];
              if (tc) tutOrch?.start({ ...tc, pauseGame: true });
            });
          } else {
            gameLoop.resume();
            // L4 bench tutorial
            tutOrch?.start({
              id:        'bench',
              text:      'New BENCH — drag a bomb here to store it for later!',
              bounds:    () => ({ x: 12, y: benchY(), w: APP_W - 24, h: benchSlotH() }),
              handStart: { x: 195, y: benchY() - 70 },
              handEnd:   { x: 195, y: benchY() + benchSlotH() / 2 - 8 },
              pauseGame: true,
            });
          }
        },
      });
      if (!unlockClosed) unlockScreen = scr; else scr.destroy?.();
    }

    // Start gameplay music from CALM; phase updates will crossfade as needed.
    audio.resetMusicPhase();
    audio.playMusic('gameplay_calm');
    audio.play('level_start');

    // Restore accumulated coins AFTER restart() (which zeros gs.coins).
    gs.coins         = progress.coins;
    coinsAtLevelStart = progress.coins;

    // ── Level intro splash ("LEVEL X" bounce-in) ──────────────────────────
    if (typeof levelIdOrConfig === 'number') {
      _showLevelIntroSplash(levelManager.levelNumber, () => {});
    }

    // ── Switch to 3D renderer for gameplay ────────────────────────────────
    layers.get('backgroundLayer').visible   = false;
    layers.get('laneLayer').visible         = false;
    layers.get('carLayer').visible          = false;
    layers.get('shooterColumnLayer').visible = true;
    layers.get('activeShooterLayer').visible = true;
    gameRenderer3D.show();
  }

  // ── Level intro splash — compact top-center pill badge (1.2 s) ───────────
  function _showLevelIntroSplash(levelNumber, onComplete) {
    // Premium ribbon over the middle of the road (it used to be a dark pill at
    // the top, colliding with the header-docked tips). Pops in, holds, fades.
    const c = new Container();
    c.y = Math.round((ROAD_TOP_Y + ROAD_BOTTOM_Y) / 2) - 40;
    app.stage.addChild(c);
    c.addChild(premiumRibbon(`LEVEL ${levelNumber}`, 250, { size: 34 }));
    c.x     = APP_W / 2;
    c.alpha = 0;

    let t = 0;
    // Pixi 8's ticker.add returns the TICKER, not the listener — removing that
    // matched nothing, so this ran forever: destroy() and onComplete() every
    // frame after the splash, one more listener per level. Keep the function.
    const unsub = (ticker) => {
      t += ticker.deltaMS / 1000;
      if (t < 0.2) {
        c.alpha = t / 0.2;
        c.scale.set(0.6 + 0.5 * Math.sin((t / 0.2) * Math.PI / 2));
      } else if (t < 1.0) {
        c.alpha = 1;
        c.scale.set(1.1 - 0.1 * Math.min(1, (t - 0.2) / 0.15));
      } else if (t < 1.2) {
        c.alpha = 1 - (t - 1.0) / 0.2;
      } else {
        app.ticker.remove(unsub);
        c.destroy({ children: true });
        onComplete?.();   // FIX 1: reveal the objective only after the banner clears
      }
    };
    app.ticker.add(unsub);
  }

  // ── Car type intro (Royal Match "Meet the new blocker!" moment) ──────────
  // Routes through the unified modal queue so it never overlaps another card.
  function _triggerCarTypeIntro(typeKey) {
    _enqueueModal((done) => {
      carTypeIntroCard = new CarTypeIntroCard(
        app.stage, APP_W, APP_H, typeKey,
        () => { carTypeIntroCard = null; done(); },
        carHpFor(typeKey, gs.world?.hpMultiplier ?? 1.0),
      );
    });
  }

  // Every car type a level can put on the road. Delegates to the canonical
  // CarTypes.spawnableTypesFor so the level-start intro cards and the CAR HP
  // manual can never disagree about what a level spawns.
  function _levelCarTypes(cfg) {
    const level = typeof cfg.id === 'number' ? cfg.id : 1;   // mirrors carDir.setLevel
    return spawnableTypesFor(level, cfg.gridRows ?? 16, cfg);
  }


  // ── COLOR CHANGE picker (FIX 4B step 2) ──────────────────────────────────
  function _dismissColorPicker() {
    colorPicker?.destroy();
    colorPicker = null;
  }
  function _showColorPicker(fromColor) {
    _dismissColorPicker();
    colorPicker?.destroy();   // never orphan a live one (see showTitle)
    colorPicker = new ColorPicker(app.stage, APP_W, APP_H, gs.colors, fromColor, {
      onPick: (toColor) => {
        // Lanes with a matching car BEFORE the recolor — flash them on success.
        const changedLanes = [];
        gs.activeLanes.forEach((lane, i) => {
          if (lane.cars.some((c) => c.color === fromColor)) changedLanes.push(i);
        });
        const n = gameLoop.applyColorChange(fromColor, toColor);
        if (n > 0) {
          changedLanes.forEach((i) => gameRenderer3D.onImpact(i, toColor));   // 200ms flash → new tint
          audio.play('color_bomb', { color: toColor });
          haptics.medium();
          floatingTexts.push(spawnFloatingText(
            layers.get('particleLayer'), APP_W / 2, 470, 'COLOR CHANGED!', 0xffe14a,
          ));
        } else {
          boosterState.cancelColorChange();
        }
        _dismissColorPicker();
      },
      onCancel: () => { boosterState.cancelColorChange(); _dismissColorPicker(); },
    });
  }

  // ── Pre-level "Power Up?" ad offer (FIX 4D) ──────────────────────────────
  function _showPreLevel(levelId) {
    const label = typeof levelId === 'number' ? `LEVEL ${levelId}` : null;
    const levelCfg = (() => { if (typeof levelId !== 'number') return null; const lm = new LevelManager(); lm.goToLevel(levelId); return lm.current; })();
    const start = (bundle) => {
      _pendingBoosterGrant = bundle;
      preLevelScreen?.destroy();
      preLevelScreen = null;
      levelSelectScreen?.destroy();
      levelSelectScreen = null;
      transition.fadeOut(0.25, () => { _startLevel(levelId); transition.fadeIn(0.25, null); });
    };
    // §3d DDA mercy: after 2 consecutive fails, offer 1 free COLOR CHANGE (no ad)
    // as an "ON THE HOUSE" gift row. Numeric levels only (daily excluded). Base
    // hp-mercy is already applied in applyLevelConfig; this is the visible half.
    const failStreak  = typeof levelId === 'number' ? progress.getFailStreak(levelId) : 0;
    const freeBooster = failStreak >= 2
      ? { key: 'colorchange', emoji: '🎨', desc: 'Recolor', bundle: { colorChange: 1, freeze: 0, bombs: 0 } }
      : null;
    preLevelScreen?.destroy();   // never orphan a live one (see showTitle)
    preLevelScreen = new PreLevelScreen(app.stage, APP_W, APP_H, label, {
      onSelect: (adCount, bundle) => {
        if (adCount <= 0) { start(bundle); return; }
        // Show `adCount` rewarded ads in sequence, then start with the bundle.
        let remaining = adCount;
        const showOne = () => {
          if (remaining <= 0) { start(bundle); return; }
          remaining--;
          // Skipped / failed / unavailable ad → no reward: start without the booster.
          adManager.showRewarded(() => showOne(), () => start({ colorChange: 0, freeze: 0, bombs: 0 }));
        };
        showOne();
      },
      onClose: () => { preLevelScreen?.destroy(); preLevelScreen = null; if (!levelSelectScreen) showLevelSelect(); },
      audio,
      freeBooster,
      level: levelCfg,
      owned: progress.getInventory(),
    });
  }

  // ── Screen: Title ─────────────────────────────────────────────────────────
  function showTitle() {
    // Idempotent: a caller that returns to the title without tearing the old
    // one down (TROPHIES → back did exactly that) would otherwise orphan a
    // full-screen title over the next level — invisible to getScreens, and it
    // swallows every booster tap.
    titleScreen?.destroy();
    titleScreen = null;
    pauseBtn.visible = false;
    bookBtn.visible  = false;
    audio.playMusic('title');
    // Keep 2D shooter layers hidden — 3D renderer handles shooter visuals.
    gameRenderer3D.hide();
    layers.get('backgroundLayer').visible    = true;
    layers.get('laneLayer').visible          = true;
    layers.get('carLayer').visible           = true;
    titleScreen = new TitleScreen(app.stage, APP_W, APP_H, {
      onPlay: () => {
        titleScreen?.destroy();
        titleScreen = null;
        showLevelSelect();
      },
      onDaily:            () => { showDailyReward(); },
      hasDailyReward:     progress.canClaimDaily(),
      onDailyChallenge:   () => { startDailyChallenge(); },
      onAchievements:     () => { showAchievements(() => { achievementsScreen?.destroy(); achievementsScreen = null; showTitle(); }); },
      onStats:            () => { showStats(); },
      loginStreak:        progress.loginStreak,
      dailyChallengeDone: progress.isDailyChallengeCompleted(dailyChallengeManager.getTodayKey()),
      onSettings: () => {
        showSettings(() => {
          settingsScreen.destroy();
          settingsScreen = null;
        });
      },
      audio,
    });
  }

  // ── Screen: Daily Reward ──────────────────────────────────────────────────
  function showDailyReward(after = null) {
    dailyRewardScreen?.destroy();   // never orphan a live one (see showTitle)
    dailyRewardScreen = new DailyRewardScreen(app.stage, APP_W, APP_H, progress, {
      onClose: _closers.daily = () => {
        dailyRewardScreen.destroy();
        dailyRewardScreen = null;
        // Check if the daily_claim achievement was just earned.
        const newAch = achievementManager.check('daily_claim');
        newAch.forEach(a => popupQueue.enqueue(PRIORITY.ACHIEVEMENT, (w) => _buildAchievementPopup(w, a), 3.0));
        if (after) { after(); return; }
        if (titleScreen) {
          titleScreen.destroy();
          titleScreen = null;
          showTitle();
        }
      },
      audio,
    });
  }

  // ── Screen: Level Select ──────────────────────────────────────────────────
  function showLevelSelect() {
    levelSelectScreen?.destroy();   // idempotent — never orphan a map (see showTitle)
    levelSelectScreen = null;
    pauseBtn.visible = false;
    goalCounterUI.setVisible(false);
    audio.playMusic('title');
    layers.get('backgroundLayer').visible = false;  // hide CityBackground behind LevelSelect (F-07)
    layers.get('laneLayer').visible       = false;
    layers.get('carLayer').visible        = false;
    levelSelectScreen = new LevelSelectScreen(app.stage, APP_W, APP_H, progress, {
      onSelectLevel: (levelId) => {
        // Hearts/energy gate removed (FIX 3) — levels are always startable.
        // The level card opens OVER the map (the map is torn down on PLAY).
        _showPreLevel(levelId);
      },
      onBack: _closers.levelSelect = () => {
        levelSelectScreen.destroy();
        levelSelectScreen = null;
        showTitle();
      },
      onShop: () => {
        levelSelectScreen.destroy();
        levelSelectScreen = null;
        showShop();
      },
      onAchievements: () => {
        levelSelectScreen.destroy();
        levelSelectScreen = null;
        showAchievements(() => {
          achievementsScreen?.destroy();
          achievementsScreen = null;
          showLevelSelect();
        });
      },
      audio,
      weeklyLevels: weeklyPlaylist.levels,
      cityAnim: _pendingCityAnim,   // §3e repair pop (consumed once, then cleared)
    });
    _pendingCityAnim = null;
  }
  function showShop() {
    shopScreen?.destroy();   // never orphan a live one (see showTitle)
    shopScreen = new ShopScreen(app.stage, APP_W, APP_H, progress, boosterState, {
      onBack: _closers.shop = () => {
        shopScreen.destroy();
        shopScreen = null;
        showLevelSelect();
      },
      onPurchase: () => {
        const newAch = achievementManager.check('shop_purchase');
        newAch.forEach(a => popupQueue.enqueue(PRIORITY.ACHIEVEMENT, (w) => _buildAchievementPopup(w, a), 3.0));
      },
      onDaily: () => {
        shopScreen.destroy();
        shopScreen = null;
        showDailyReward(() => showShop());
      },
      onWatchAd: (onEarned) => adManager.showRewarded(onEarned, () => {}),
      audio,
    });
  }

  // ── Screen: Achievements ─────────────────────────────────────────────────
  function showAchievements(onBack) {
    pauseBtn.visible = false;
    audio.playMusic('title');
    _closers.achievements = onBack;
    achievementsScreen?.destroy();   // never orphan a live one (see showTitle)
    achievementsScreen = new AchievementsScreen(app.stage, APP_W, APP_H, progress, {
      onBack,
      audio,
    });
  }

  // ── Screen: Stats ─────────────────────────────────────────────────────────
  function showStats() {
    pauseBtn.visible = false;
    audio.playMusic('title');
    titleScreen?.destroy();
    titleScreen = null;
    statsScreen?.destroy();   // never orphan a live one (see showTitle)
    statsScreen = new StatsScreen(app.stage, APP_W, APP_H, {
      app,
      progressManager: progress,
      onBack: _closers.stats = () => {
        statsScreen?.destroy();
        statsScreen = null;
        showTitle();
      },
      audio,
    });
    statsScreen.show();
  }

  // ── Daily Challenge ───────────────────────────────────────────────────────
  function startDailyChallenge() {
    titleScreen?.destroy();
    titleScreen = null;
    const cfg = dailyChallengeManager.getChallenge();
    transition.fadeOut(0.25, () => {
      _startLevel(cfg);
      transition.fadeIn(0.25, null);
    });
  }

  // ── Screen: Settings ─────────────────────────────────────────────────────
  // onClose is provided by the caller so the same screen works from both
  // the title gear and the in-game pause menu.
  function showSettings(onClose) {
    _closers.settings = onClose;
    settingsScreen?.destroy();   // never orphan a live one (see showTitle)
    settingsScreen = new SettingsScreen(app.stage, APP_W, APP_H, audio, {
      onClose,
      // Help opens OVER settings; closing returns to settings as it was.
      onHowToPlay: () => {
        if (howToPlayOverlay) return;
        howToPlayOverlay?.destroy();   // never orphan a live one (see showTitle)
        howToPlayOverlay = new HowToPlayOverlay(app.stage, APP_W, APP_H, {
          ticker: app.ticker,
          onClose: _closers.howToPlay = () => { howToPlayOverlay?.destroy(); howToPlayOverlay = null; },
        });
      },
      onCarGuide: () => {
        if (carManualScreen) return;
        carManualScreen?.destroy();   // never orphan a live one (see showTitle)
        carManualScreen = new CarManualScreen(app.stage, APP_W, APP_H, {
          seenTypes: progress.getIntroducedCarTypes(),
          unlockedLevel: Math.max(progress.unlockedLevel ?? 1, gs?.levelId ?? 1),
          onClose: _closers.carManual = () => { carManualScreen?.destroy(); carManualScreen = null; },
        });
      },
    }, progress, haptics);
  }

  // ── Screen: Car Manual ────────────────────────────────────────────────────
  function showCarManual(fromPause = false) {
    const wasPlaying = gameLoopStarted && !gameLoop.paused && !gs.isOver;
    if (wasPlaying) gameLoop.pause();
    bookBtn.visible  = false;
    pauseBtn.visible = false;
    carManualScreen?.destroy();   // never orphan a live one (see showTitle)
    carManualScreen = new CarManualScreen(app.stage, APP_W, APP_H, {
      seenTypes: progress.getIntroducedCarTypes(),
      unlockedLevel: Math.max(progress.unlockedLevel ?? 1, gs?.levelId ?? 1),
      onClose: _closers.carManual = () => {
        carManualScreen?.destroy();
        carManualScreen = null;
        if (fromPause) {
          showPause();
        } else {
          bookBtn.visible  = false;  // in-game manual button hidden; reachable via pause screen
          pauseBtn.visible = true;
          if (wasPlaying) gameLoop.resume();
        }
      },
    });
  }

  // ── Goal-bar overlays: HP guide + how-to-play (pause while open) ───────────
  function _openGoalOverlay(make) {
    const wasPlaying = gameLoopStarted && !gameLoop.paused && !gs.isOver;
    if (wasPlaying) gameLoop.pause();
    const prev = { hp: hpGuideBtn.visible, htp: howToPlayBtn.visible, pause: pauseBtn.visible };
    hpGuideBtn.visible = false; howToPlayBtn.visible = false; pauseBtn.visible = false;
    const restore = () => {
      hpGuideBtn.visible = prev.hp; howToPlayBtn.visible = prev.htp; pauseBtn.visible = prev.pause;
      if (wasPlaying) gameLoop.resume();
    };
    return { restore };
  }

  function showHpGuide() {
    if (hpGuideOverlay) return;
    const { restore } = _openGoalOverlay();
    // LIVE level context, read at open time — not a snapshot from boot. The panel
    // computes each type's real HP from these, so it cannot drift from the board.
    // gs.world is the DDA-adjusted copy the loop is actually spawning from, which
    // is what the player is looking at; the base config would be a different lie.
    hpGuideOverlay?.destroy();   // never orphan a live one (see showTitle)
    hpGuideOverlay = new HpGuideOverlay(app.stage, APP_W, APP_H, {
      onClose: _closers.hpGuide = () => { hpGuideOverlay?.destroy(); hpGuideOverlay = null; restore(); },
      level: {
        levelId:      gs.levelId,
        hpMultiplier: gs.world?.hpMultiplier ?? 1.0,
        gridRows:     gs.gridRows,
        cfg:          currentLevelCfg,
      },
    });
  }

  function showHowToPlay() {
    if (howToPlayOverlay) return;
    const { restore } = _openGoalOverlay();
    howToPlayOverlay?.destroy();   // never orphan a live one (see showTitle)
    howToPlayOverlay = new HowToPlayOverlay(app.stage, APP_W, APP_H, {
      ticker: app.ticker,
      onClose: _closers.howToPlay = () => { howToPlayOverlay?.destroy(); howToPlayOverlay = null; restore(); },
    });
  }

  // ── Screen: Pause ─────────────────────────────────────────────────────────
  function showPause() {
    gameLoop.pause();
    pauseBtn.visible = false;
    bookBtn.visible  = false;
    pauseScreen?.destroy();   // never orphan a live one (see showTitle)
    pauseScreen = new PauseScreen(app.stage, APP_W, APP_H, {
      onResume: _closers.pause = () => {
        pauseScreen.destroy();
        pauseScreen      = null;
        pauseBtn.visible = true;
        bookBtn.visible  = false;  // in-game manual button hidden; reachable via pause screen
        gameLoop.resume();
      },
      onRestart: () => {
        pauseScreen.destroy();
        pauseScreen = null;
        const id = currentLevelIsDaily ? currentLevelCfg : levelManager.levelNumber;
        transition.fadeOut(0.25, () => { _startLevel(id); transition.fadeIn(0.25, null); });
      },
      onCarManual: () => {
        pauseScreen.destroy();
        pauseScreen = null;
        showCarManual(true);
      },
      onHowToPlay: () => {
        pauseScreen.destroy();
        pauseScreen = null;
        howToPlayOverlay?.destroy();   // never orphan a live one (see showTitle)
        howToPlayOverlay = new HowToPlayOverlay(app.stage, APP_W, APP_H, {
          ticker: app.ticker,
          onClose: _closers.howToPlay = () => { howToPlayOverlay?.destroy(); howToPlayOverlay = null; showPause(); },
        });
      },
      onSettings: () => {
        pauseScreen.destroy();
        pauseScreen = null;
        showSettings(() => {
          settingsScreen.destroy();
          settingsScreen = null;
          showPause();   // rebuild pause screen on settings close
        });
      },
      onQuit: () => {
        _settleInventory();
        pauseScreen.destroy();
        pauseScreen = null;
        // Nothing from the abandoned level may fire over the map: the car-intro
        // timer, queued modal cards and tutorials (their dismissal also resumed
        // the abandoned loop behind the map).
        clearTimeout(carTypeIntroTimer); carTypeIntroTimer = null;
        carTypeIntroCard?._destroy();    carTypeIntroCard  = null;
        _clearModalQueue();
        tutOrch?.dismiss();
        gameLoop.pause();
        // Leave gameLoop paused — _startLevel() will resume it.
        transition.fadeOut(0.25, () => {
          showLevelSelect();
          transition.fadeIn(0.25, null);
        });
      },
      audio,
    });
  }

  // ── Screen: Win ───────────────────────────────────────────────────────────
  function showWin() {
    _settleInventory();
    tutOrch?.dismiss();
    pauseBtn.visible = false;
    bookBtn.visible  = false;
    // Clear gameplay UI behind the modal: suppress toasts (achievements still
    // recorded), hide the booster bar and any FTUE hint banner.
    popupQueue.setSuppressed(true);
    boosterBar.setVisible(false);
    ftueOverlay?.setVisible(false);
    audio.stopMusic();
    // Delay fanfare slightly so the screen fade-in completes first.
    setTimeout(() => audio.play('win_fanfare'), 300);

    // Persist coins. Boosters no longer carry over between levels (FIX 4E).
    progress.setCoins(gs.coins);

    // Track coins earned this level for the Collector achievement.
    const coinsEarned = Math.max(0, gs.coins - coinsAtLevelStart);
    if (coinsEarned > 0) progress.addEarnedCoins(coinsEarned);
    const coinAch = achievementManager.check('coins_earned');
    coinAch.forEach(a => popupQueue.enqueue(PRIORITY.ACHIEVEMENT, (w) => _buildAchievementPopup(w, a), 3.0));

    // Level-end achievements.
    const endAch = achievementManager.check('level_end', {
      won:          true,
      totalDeploys: gs.totalDeploys,
      wrongDeploys: gs.wrongDeploys,
      elapsed:      gs.elapsed,
      rescueUsed:   gs.rescueUsed,
      boostersUsed: boostersUsedThisLevel.length > 0,
    });
    endAch.forEach(a => popupQueue.enqueue(PRIORITY.ACHIEVEMENT, (w) => _buildAchievementPopup(w, a), 3.0));

    let onNext;
    let improved   = [];
    let winLevelId = null;
    if (currentLevelIsDaily) {
      // The bonus goes through gs.coins: the wallet is re-saved from gs.coins
      // below, which used to overwrite a bonus added straight to progress.
      // First clear of the day only. Replays are allowed (for fun) but pay
      // nothing — winning it again used to pay +25 every time: a coin farm.
      if (!progress.isDailyChallengeCompleted(dailyDateKey)) {
        progress.completeDailyChallenge(dailyDateKey, 0);
        gs.coins += 25;
        progress.addEarnedCoins(25);
        const dcAch = achievementManager.check('daily_challenge');
        dcAch.forEach(a => popupQueue.enqueue(PRIORITY.ACHIEVEMENT, (w) => _buildAchievementPopup(w, a), 3.0));
      }
      onNext = null;
    } else {
      const levelId = levelManager.levelNumber;
      const stars   = calcStars(gs);
      // §3e City Repair: a win repairs the level's building (→ repaired). Capture
      // the PRIOR state first — if it actually changed (prior !== 2), the next
      // level-select entry plays the brief repair pop; a replay-win (2→2) is silent.
      const bId       = progress.buildingForLevel(levelId);
      const priorCity = progress.getCityState()[String(bId)] ?? 0;
      progress.recordWin(levelId, stars);
      progress.repairBuilding(bId);
      if (priorCity !== 2) _pendingCityAnim = { building: bId, prior: priorCity };

      // Weekly playlist bonus: +15 coins for winning a featured level this week.
      const { levels: featuredLevels, weekKey: wk } = weeklyPlaylist;
      if (featuredLevels.includes(levelId) && !progress.hasClaimedWeeklyLevel(levelId, wk)) {
        gs.coins += 15;
        progress.markClaimedWeeklyLevel(levelId, wk);
        floatingTexts.push(spawnFloatingText(
          layers.get('particleLayer'), APP_W / 2, APP_H / 2 - 60,
          '⭐ WEEKLY BONUS  +15', 0xffcc00,
        ));
        // weekly_hero achievement
        const weeklyAch = achievementManager.check('weekly_win');
        weeklyAch.forEach(a => popupQueue.enqueue(PRIORITY.ACHIEVEMENT, (w) => _buildAchievementPopup(w, a), 3.0));
      }
      // Update personal best and detect new records.
      improved   = progress.updateBestStats(levelId, { combo: gs.maxSingleShotKills, time: gs.elapsed, stars });
      winLevelId = levelId;
      onNext = () => {
        winScreen.destroy();
        winScreen = null;
        // After the final level there is no "next": NEXT used to replay L40.
        // Go back to the map (the whole city repaired is the ending).
        if (levelId >= LEVEL_COUNT) { showLevelSelect(); return; }
        // Offer the pre-level card before the next level — same as starting a
        // level fresh from the map (onSelectLevel → _showPreLevel).
        _showPreLevel(levelId + 1);
      };

      // Rating prompt: show after first ever 3-star win (native integration TBD in Phase 4).
      if (stars === 3 && !progress.ratingPromptShown) {
        progress.markRatingPromptShown();
      }
    }

    // Re-save coins (captures any weekly bonus added above) and set display
    // delta so WinScreen shows what was earned this level, not the wallet total.
    progress.setCoins(gs.coins);
    gs.coins = Math.max(0, gs.coins - coinsAtLevelStart);

    winScreen?.destroy();   // never orphan a live one (see showTitle)
    winScreen = new WinScreen(
      app.stage, APP_W, APP_H, gs,
      onNext,
      () => {
        winScreen.destroy();
        winScreen = null;
        transition.fadeOut(0.25, () => {
          showLevelSelect();
          transition.fadeIn(0.25, null);
        });
      },
      audio,
      improved,
      winLevelId,
    );
  }
  // The FINAL-loss moment, shared by every way a level can be failed: the
  // no-rescue lose screen AND declining the rescue offer (RETRY / Give up) —
  // those used to skip it, so a player who never watched the ad never built a
  // fail streak (no DDA mercy, no free booster) and kept unspent inventory.
  // §3d DDA: bump the fail streak so the next attempt gets the mercy factor
  // (daily challenge excluded). §3e City Repair damage fires here too — a
  // rescued-then-won breach is not a fail. Guarded so it counts once per level.
  function _recordFinalLoss() {
    _settleInventory();
    if (_lossRecorded) return;
    _lossRecorded = true;
    if (!currentLevelIsDaily) {
      const lvl = levelManager.levelNumber;
      progress.recordLoss(lvl);
      progress.damageBuilding(progress.buildingForLevel(lvl));
    }
  }

  function _showNoRescueLose() {
    _recordFinalLoss();
    tutOrch?.dismiss();

    pauseBtn.visible = false;
    bookBtn.visible  = false;
    // Same modal cleanup as the win screen.
    popupQueue.setSuppressed(true);
    boosterBar.setVisible(false);
    ftueOverlay?.setVisible(false);
    audio.stopMusic();
    audio.play('lose_tone');

    let loseScreen = null;
    loseScreen = new LoseScreen(
      app.stage, APP_W, APP_H,
      {
        onRetry: () => {
          loseScreen?.destroy();
          loseScreen = null;
          rescueOverlay = null;
          const cfg = currentLevelIsDaily ? dailyChallengeManager.getChallenge() : levelManager.levelNumber;
          adManager.showInterstitial().then(() => {
            transition.fadeOut(0.20, () => { _startLevel(cfg); transition.fadeIn(0.20, null); });
          });
        },
        onMenu: () => {
          loseScreen?.destroy();
          loseScreen = null;
          rescueOverlay = null;
          adManager.showInterstitial().then(() => {
            transition.fadeOut(0.20, () => { showLevelSelect(); transition.fadeIn(0.20, null); });
          });
        },
        audio,
      },
      gs,
      null,   // FIX 3: no hearts/lives row on the final game-over screen
    );

    // Reuse rescueOverlay slot so _startLevel cleans up correctly.
    rescueOverlay = {
      update(dt) { loseScreen?.update(dt); },
      destroy()  { loseScreen?.destroy(); loseScreen = null; },
    };
  }

  // ── Screen: Rescue ────────────────────────────────────────────────────────
  function showRescue() {
    tutOrch?.dismiss();
    pauseBtn.visible = false;
    // FIX 2: hide the booster bar + suppress toasts behind the game-over modal,
    // exactly like the win/final-lose screens do.
    boosterBar.setVisible(false);
    popupQueue.setSuppressed(true);
    audio.play('rescue_offer');
    rescueOverlay?.destroy();   // never orphan a live one (see showTitle)
    rescueOverlay = new RescueOverlay(app.stage, APP_W, APP_H, gs, {
      onRescueAd: () => {
        adManager.showRewarded(
          () => {
            if (!rescueOverlay) return;    // already resolved (a second reward callback)
            gs.rescue(10);
            gameLoop.prepareForRescue();   // FIX 2: refill lanes + columns the breach skipped
            rescueOverlay.destroy();
            rescueOverlay = null;
            // Resuming play — restore the booster bar + toasts.
            boosterBar.setVisible(true);
            popupQueue.setSuppressed(false);
            audio.resetMusicPhase();
            audio.playMusic('gameplay_calm');
            pauseBtn.visible = true;
          },
          null,   // dismissed without reward — leave rescue overlay on screen
        );
      },
      onRescueCoins: () => {
        gs.coins -= 50;
        progress.setCoins(gs.coins);
        gs.rescue(10);
        gameLoop.prepareForRescue();   // FIX 2: refill lanes + columns the breach skipped
        rescueOverlay.destroy();
        rescueOverlay = null;
        audio.resetMusicPhase();
        audio.playMusic('gameplay_calm');
        pauseBtn.visible = true;
      },
      onRetry: () => {
        // RETRY — free, immediate restart of the current level (no ad).
        _recordFinalLoss();
        rescueOverlay.destroy();
        rescueOverlay = null;
        const cfg = currentLevelIsDaily ? dailyChallengeManager.getChallenge() : levelManager.levelNumber;
        transition.fadeOut(0.20, () => { _startLevel(cfg); transition.fadeIn(0.20, null); });
      },
      onLevelSelect: () => {
        // Declined the one-time rescue → level failed; back to the map.
        _recordFinalLoss();
        rescueOverlay.destroy();
        rescueOverlay = null;
        adManager.showInterstitial().then(() => {
          transition.fadeOut(0.20, () => { showLevelSelect(); transition.fadeIn(0.20, null); });
        });
      },
    });
  }

  // ── Combo FX (screen flash + floating power text) ────────────────────────
  const comboFX = new ComboFX(layers.get('glowLayer'), layers.get('hudLayer'), APP_W, APP_H);

  // ── Game loop ─────────────────────────────────────────────────────────────
  const gameLoop = new GameLoop({
    app, gameState: gs, carDir, shooterDir,
    combatResolver, rng, boosterState, benchStorage,

    onKill: (combo) => {
      hudRenderer.bumpCombo(combo);
      gameRenderer3D.setCombo(combo);
      if (combo === 4 || combo === 7 || combo === 11) {
        audio.play('combo_milestone', { combo });
        haptics.comboMilestone();
      }

      featureBanners.fire('first_kill', 'First kill! Chain kills quickly for combos and bonus coins.');
      if (combo >= 3) featureBanners.fire('first_combo', 'COMBO! Rapid kills earn bonus coins and speed boosts.');

      // L2: notify FTUE overlay on first kill so it can show the combo hint.
      if (!firstKillDoneThisLevel) {
        firstKillDoneThisLevel = true;
        // L2 combo hint routes through the unified queue (one-at-a-time, safe
        // gap) — FTUEOverlay's own bottom banner could stack over a queued
        // toast (design-audit CLUTTER item: two banners covering the game).
        if (gs.levelId === 2) {
          featureBanners.fire('combo_hint_L2',
            'COMBO! Chain kills quickly for bonus coins and faster fire speed!');
        }
      }

      // One-time combo explanation popup the first time combo reaches 3.
      if (combo >= 3 && !progress.seenComboTip) {
        progress.markSeenComboTip();
        popupQueue.enqueue(PRIORITY.COMBO, (w) => _buildComboPopup(w), 3.0);
      }

      // Achievement checks for kill events.
      const killAch = achievementManager.check('kill', { combo });
      killAch.forEach(a => popupQueue.enqueue(PRIORITY.ACHIEVEMENT, (w) => _buildAchievementPopup(w, a), 3.0));
    },

    onChainHit: (laneIdx, position) => {
      // No mid-road "CHAIN HIT!" floater — a 2+ kill is a multi-kill, already
      // surfaced by the unified MULTI-KILL notification in the safe gap (FIX 4),
      // so this no longer overlaps the cars.
      // chain_reaction achievement: 2+ kills from one shot.
      const chainAch = achievementManager.check('chain_kill');
      chainAch.forEach(a => popupQueue.enqueue(PRIORITY.ACHIEVEMENT, (w) => _buildAchievementPopup(w, a), 3.0));
    },

    onShoot: (damage, laneIdx, colIdx) => {
      tutOrch?.completeIfActive('first_car');
      audio.play('shoot', { damage });
      featureBanners.fire('first_shot', 'Direct hit! Color-matched shots deal damage to cars.');

      // On very first deploy: dismiss arrow hint and (for L1-L5) show damage tooltip.
      const tipDamage = (!firstDeployTooltipShown && levelManager.levelNumber <= 5)
        ? damage : undefined;
      firstDeployTooltipShown = true;
      ftueOverlay?.onFirstDeploy(tipDamage);

      // Lane flash disabled — no lane glow during gameplay.
      if (colIdx  >= 0) shooterRenderer.triggerDeployPunch(colIdx);
      if (colIdx  >= 0) gameRenderer3D.triggerDeployPunch(colIdx);
      if (laneIdx >= 0) gameRenderer3D.onShoot(laneIdx);
      haptics.light();
    },

    onHit: (laneIdx, gameX, color, damage, killCount, power = false) => {
      const isKill = killCount > 0;
      if (power) {
        // Hot Streak supercharged shot landed.
        audio.play('power_shot');
        haptics.heavy();
        shakeTime = Math.max(shakeTime, 0.25);
        popupQueue.enqueue(PRIORITY.COMBO, (w) => _buildFlashText(w, 'POWER SHOT!', 0xFF7A1F), 1.0);
      }
      _lastShotKills = killCount;   // for the multi-kill popup (fired next via _onMultiKill)
      particles.spawnHit(laneIdx, gameX, color);
      particles.spawnDamageNumber(laneIdx, gameX, damage);
      gameRenderer3D.onHit(laneIdx, color, damage, killCount);
      if (isKill) {
        particles.spawnExplosion(laneIdx, gameX, color);
        audio.play('car_destroy', { kills: killCount });   // 6B: escalates with kills
        audio.play('kill_ding');                            // 6A: bright kill ding
        if (killCount === 1) haptics.medium();   // single kill; multi-kill (2+) → heavy via _onMultiKill
      } else {
        audio.play('hit_match');
        haptics.medium();
      }

      // Danger pulse — once per advance (onHit fires per advancing shot) when any
      // active car has reached the last rows of the grid (rows 14-15 of 16).
      // 2026-07-25 (rows-8 pilot): the "last 2 rows" window is a FRACTION of
      // board depth, not a constant — 2 of 16 is 12.5% of the road, but 2 of 8
      // would be 25%, firing the warning haptic twice as often on a shallow
      // board and cheapening it. Rounds to 2 at gridRows 16 (unchanged), 1 at 8.
      const _dangerRow = gs.gridRows - Math.max(1, Math.round(gs.gridRows * (2 / 16)));
      if (gs.lanes.slice(0, gs.activeLaneCount).some(l => l.cars.some(c => c.row >= _dangerRow))) {
        haptics.warning();
      }

      // ── One-time onboarding modal cards (lifetime, localStorage-flagged) ────
      // Show at most one card per hit; the other (if eligible) fires next hit.
      let _hintShownThisHit = false;
      // Hint C — first correct-colour shot on L1: explain that all cars advance.
      // A tip, not a modal: a blocking card after the very first kill paused the
      // board on the player's first success.
      if (levelManager.levelNumber === 1 && !progress.hintAdvanceShown) {
        progress.markHintAdvance();
        featureBanners.fire('advance', 'Every hit moves ALL cars one step closer. Clear them before they reach the line!');
        _hintShownThisHit = true;
      }
      // Hint A — first time a car SURVIVES a hit (any level): point to the book.
      const _bossLane = gs.lanes[laneIdx]?.frontCar()?.type === 'boss';   // a boss light is not an HP miss
      if (!_hintShownThisHit && !isKill && damage > 0 && !_bossLane && !progress.hintHpMissShown) {
        progress.markHintHpMiss();
        _showHintCard((done) => onboardingHints.showHpMiss(done));
      }
    },

    onMiss: (laneIdx, gameX) => {
      particles.spawnMiss(laneIdx, gameX);
      gameRenderer3D.onMiss(laneIdx);
      audio.play('wrong_bounce');   // 6A/1D: descending "rejected" boing
      featureBanners.fire('first_miss', 'No damage! Bomb color must match the car color.');
    },

    onEnd: (won, laneIdx) => {
      // 'lose'   = breach after rescue already used (true final loss)
      // 'win'    = timer ran out
      const result = won ? 'win' : (gs.rescueUsed ? 'lose' : 'rescue');
      analytics.recordSession({
        levelId:        currentLevelIsDaily ? 'daily' : levelManager.levelNumber,
        result,
        duration:       gs.elapsed,
        deploys:        gs.totalDeploys,
        correctDeploys: gs.correctDeploys,
        wrongDeploys:   gs.wrongDeploys,
        maxCombo:       gs.maxCombo,
        carsKilled:     gs.totalKills,
        carryOvers:     gs.carryOvers,
        rescueUsed:     gs.rescueUsed,
        boostersUsed:   [...boostersUsedThisLevel],
        benchUsed:      gs.benchUsed,
      });

      const _evtLevelId = currentLevelIsDaily ? 'daily' : levelManager.levelNumber;
      if (won) {
        logEvent('level_completed', { levelId: _evtLevelId });
        haptics.success();
        showWin();
      } else {
        logEvent('level_failed', { levelId: _evtLevelId });
        audio.stopMusic();
        audio.play('lose_tone');
        shakeTime = 0;
        gameRenderer3D.onBreach();
        haptics.heavy();                                   // breach double-pulse
        setTimeout(() => haptics.heavy(), 200);
        // FIX 3: no hearts. One breach = game over with a one-time CONTINUE (ad)
        // rescue. A second breach (rescue already used) → final game over.
        breachCam = { laneIdx: laneIdx ?? 0, t: 0, done: false,
                      skipRescue: noRescueThisLevel || gs.rescueUsed };
        pauseBtn.visible = false;   // no pause/restart inside the breach beat
      }
    },

    onCrisis: (colIdx) => {
      // CRISIS assist fired — a guaranteed-match shooter was injected at the
      // top of this column. Gold flash + sound cue to signal the cavalry arrived.
      gameRenderer3D.triggerCrisisGlow(colIdx);
      shooterRenderer.triggerCrisisFlash(colIdx);
      audio.play('crisis_assist');
      haptics.medium();
      floatingTexts.push(spawnFloatingText(
        layers.get('particleLayer'),
        // Above the column that received the assist (2026-09-27). Was hardcoded to a
        // 4-column X and Y=560 — wrong column at 3 lanes, and inside the queue since
        // the queue moved. Both now come from the registry, like every other anchor.
        getColumnScreenX(colIdx), getColumnScreenY() - 40,
        '⚡ CRISIS ASSIST', 0xffcc00,
      ));
      progress.incrementCrisisAssists();
      const crisisAch = achievementManager.check('crisis_assist');
      crisisAch.forEach(a => popupQueue.enqueue(PRIORITY.ACHIEVEMENT, (w) => _buildAchievementPopup(w, a), 3.0));
    },
  });

  // ── Bomb system callbacks ─────────────────────────────────────────────────
  // FIX 4C: a 3+ car chain kill earns a FREEZE charge.
  gameLoop._onFreezeEarned = (kills) => {
    audio.play('freeze_tinkle');
    haptics.medium();   // booster earned
    floatingTexts.push(spawnFloatingText(
      layers.get('particleLayer'), APP_W / 2, 470,
      `${kills}-CAR CHAIN! Freeze earned!`, 0x88ddff,
    ));
  };
  // Earned by chaining two strictly-consecutive multi-kills (GameLoop._updateColorChangeCombo).
  gameLoop._onColorChangeEarned = () => {
    audio.play('coin_collect');
    haptics.medium();   // booster earned
    floatingTexts.push(spawnFloatingText(
      layers.get('particleLayer'), APP_W / 2, 470,
      '2× COMBO! Color Change ready!', 0xCC66FF,
    ));
  };
  gameLoop._onBombEarned = () => {
    audio.play('coin_collect');
    haptics.medium();   // booster earned
    // Centered notification flash (centered so the longer text doesn't clip).
    floatingTexts.push(spawnFloatingText(
      layers.get('particleLayer'), APP_W / 2, 470,   // mid-board: the tutorial caption owns the bottom
      'BOMB READY! (10 kills)', 0xffaa00,
    ));
    // Bounds/hand must match the BOMB booster card exactly (BoosterBar CARD_X[2]):
    // x 237-301 (centre 269), y 754-818. The fixed 3-button bar is identical on
    // every level, so these constants are correct for all 1/2/3/4-lane levels.
    // Not on the shot that ends the level: the tutorial paused the loop and its
    // spotlight stayed over the win screen and into the next level's card.
    if (!gs.isOver && !(gs.goals.length > 0 && gs.isGoalMet())) tutOrch?.start({
      id:        'bomb',
      text:      '💣 BOMB earned — tap it, then tap a lane to blast every car on it!',
      bounds:    () => { const b = boosterBar?._bombBtn?.getBounds(); return b ? { x: b.x, y: b.y, w: b.width, h: b.height } : { x: 235, y: 764, w: 72, h: 77 }; },
      pauseGame: true,
    });
  };
  gameLoop._onBombExplode = (bombPos, carsHit, laneIdx = null) => {
    gameRenderer3D.onBombExplode(bombPos, carsHit, laneIdx);
    // 2D particle fallback: explosion at each hit car position.
    // (GameRenderer3D handles 3D; we fire audio and 2D haptics here.)
    audio.play('car_destroy');
    haptics.heavy();
    if (carsHit > 0) {
      floatingTexts.push(spawnFloatingText(
        layers.get('particleLayer'), APP_W / 2, 200,
        carsHit === 1 ? 'DIRECT HIT!' : `BOOM! ×${carsHit}`,
        0xffdd00,
      ));
    }
  };

  // ── V2 callbacks: Hot Streak, armour, bosses (TrafficRules) ───────────────
  gameLoop._onStreak = (streak, charged, { justCharged }) => {
    streakMeter.setState(streak, charged);
    if (streak > 0 && !charged) audio.play('pip_fill', { index: streak - 1 });
    if (justCharged) {
      audio.play('supercharge');
      haptics.medium();
      popupQueue.enqueue(PRIORITY.COMBO, (w) => _buildFlashText(w, 'SUPERCHARGED!', 0xFF7A1F), 1.2);
      featureBanners.fire('streak_charged',
        'SUPERCHARGED! Your next bomb does double damage and smashes through ANY colour behind the first car.');
    }
  };
  gameLoop._onArmorBreak = (laneIdx, gameX, _color, armorLeft = 0) => {
    audio.play('armor_clang');
    haptics.medium();
    particles.spawnHit(laneIdx, gameX, 'Blue');
    floatingTexts.push(spawnFloatingText(layers.get('particleLayer'),
      getLaneScreenX(laneIdx), getColumnScreenY() - 90, armorLeft > 0 ? 'PLATE OFF!' : 'ARMOUR OFF!', 0xE6ECF5));
    if (armorLeft > 0) featureBanners.fire('plate_break', 'Heavy plating: it takes TWO hits, any colour, to strip it.');
    else featureBanners.fire('armor_break', 'Armour off! Now hit it with its own colour.');
  };
  gameLoop._onSurge = (srcLane) => {
    audio.play('surge');
    haptics.heavy();
    shakeTime = Math.max(shakeTime, 0.3);
    floatingTexts.push(spawnFloatingText(layers.get('particleLayer'),
      getLaneScreenX(srcLane), getColumnScreenY() - 90, 'SURGE!', 0xFF8A1C));
    featureBanners.fire('volatile_surge', 'Volatile! When it blows, every OTHER lane lurches forward a row.');
  };
  gameLoop._onMend = () => {
    audio.play('mend');
    featureBanners.fire('mender_heal', 'Menders repair 1 HP each turn they are not hit. Keep shooting them!');
  };
  gameLoop._onBossHit = (laneIdx, boss, dead) => {
    if (dead) {
      audio.play('boss_destroyed');
      haptics.heavy(); setTimeout(() => haptics.heavy(), 160);
      shakeTime = Math.max(shakeTime, 0.45);
      popupQueue.enqueue(PRIORITY.COMBO, (w) => _buildFlashText(w, 'BOSS DESTROYED!', 0xFFD42A), 1.6);
    } else {
      // The boss's own roof panel knocks the pip out; no floating count on top of
      // the boss (it collided with the boss art and the combo line).
      audio.play('boss_light', { left: boss.hp });
      haptics.medium();
    }
  };

  // ── Combo power-shot callbacks ────────────────────────────────────────────
  gameLoop._onAdvance = () => {
    gameRenderer3D.onAdvance();
  };
  // Immediate impact reaction (squash + flash) the moment a bomb lands, before the
  // hit-stop resolves combat. Color bombs run their own cascade flash on resolve.
  gameLoop._onImpact = (laneIdx, color, isColorBomb) => {
    if (!isColorBomb) gameRenderer3D.onImpact(laneIdx, color);
  };
  gameLoop._onColorBomb = (color, killed) => {
    comboFX.triggerColorBomb(color);                 // edge vignette only
    gameRenderer3D.onColorBomb(color, killed);
    popupQueue.enqueue(PRIORITY.COMBO, (w) => _buildFlashText(w, 'COLOR BOMB!', 0xffcc44), 1.5);
    audio.play('color_bomb', { color });
    haptics.heavy();
  };
  gameLoop._onComboFreeze = () => {
    comboFX.triggerFreeze();
    popupQueue.enqueue(PRIORITY.COMBO, (w) => _buildFlashText(w, 'FROZEN!', 0x88ddff), 1.5);
    audio.play('freeze_activate');
    audio.play('freeze_tinkle');   // 6A: ice-crystal tinkle
    haptics.medium();
  };
  // §3d near-miss drama: fired by GameLoop when the player is ≥80% to winning AND a
  // car reached the last two rows (see GameLoop._checkNearMiss re-arm gate). Dread,
  // NOT impact — timeScale 0.35 (gentler than the 0.3 combo bullet-time), the low
  // heartbeat double-thump, and a red edge pulse that throbs in sync.
  gameLoop._onNearMiss = () => {
    gs.timeScale       = 0.35;
    gs.slowMoRemaining = 0.5;
    comboFX.triggerNearMiss();
    audio.play('heartbeat');
    haptics.medium();
  };
  // Progress feedback per multi-kill (1/3, 2/3) — through the unified queue (FIX 4).
  gameLoop._onMultiKill = (count, needed) => {
    audio.play('pip_fill', { index: count - 1 });   // 6A: ascending pip-fill note
    haptics.heavy();                                 // multi-kill (2+ cars)
    if (count < needed) {
      // 0.8s, was 1.4s (2026-07-30). User: "the combo appears for too long, it
      // should appear for a moment and disappear." 1.4s was tuned on 16-row
      // boards; the rows-8 pilot runs levels 20-25% shorter, so the same duration
      // now occupies a proportionally larger share of a level and of the turn
      // cycle it interrupts. Specced in GEOMETRY_MECHANICS_BATCH.
      popupQueue.enqueue(PRIORITY.COMBO, (w) => _buildMultiKillPopup(w, _lastShotKills), 0.8);
    }
  };
  // Color bomb EARNED after 3 multi-kills. Edge flash + queued "3 MULTI-KILLS!"
  // notification + SFX; rainbow is now in the queue. The first time ever, show the
  // one-time COLOR BOMB intro card (FIX 5), routed through the modal queue.

  gameLoop._onColorBombEarned = () => {
    comboFX.triggerColorBomb('Rainbow');
    popupQueue.enqueue(PRIORITY.COMBO, (w) => _buildFlashText(w, '3 MULTI-KILLS!', 0xffe14a), 1.6);
    audio.play('color_bomb', { color: 'Rainbow' });
    haptics.heavy();
    if (!progress.hintColorBombShown) {
      progress.markHintColorBomb();
      _enqueueModal((done) => onboardingHints.showColorBomb(done));
    }
  };

  // ── Tutorial orchestrator (needs gameLoop ref, created here) ─────────────
  tutOrch = new TutorialOrchestrator(app.stage, gameLoop);

  // ── Input ────────────────────────────────────────────────────────────────
  const dragDrop = new DragDrop(
    layers, columns, gs.lanes, benchStorage, shooterRenderer, benchRenderer,
    {
      onDeploy: (colIdx, laneIdx, release, dragged) => {
        if (colIdx >= gs.activeColCount || laneIdx >= gs.activeLaneCount) return;
        gameRenderer3D.setDropStart(laneIdx, release);   // bomb travels FROM release
        gameLoop.deploy(colIdx, laneIdx, dragged);
      },
      onBombPlaced: (x, y, laneIdx) => {
        // BOMB booster clears the tapped car's entire LANE — every car in it, any
        // colour, any row (2026-07-30; was a row-clear across lanes).
        // The frontmost row's car centre sits ON ROAD_BOTTOM_Y, so accept taps up
        // to half a row below the breach line; screenYToRow clamps to the last row
        // so those taps map to gridRows-1 rather than overflowing out of bounds.
        if (y < ROAD_TOP_Y || y > ROAD_BOTTOM_Y + frontRowTapMargin(gs.gridRows)) return;
        const rows = gs.gridRows ?? 10;
        gameLoop.placeBombOnLane(laneIdx, screenYToRow(y, rows));
      },
      onColorChangeTap: (laneIdx) => {
        // FIX 4B: player tapped a car (lane) during COLOR CHANGE mode → use that
        // lane's front car as the source color, then show the color picker.
        const lane = gs.activeLanes[laneIdx];
        const car  = lane?.frontCar?.() ?? lane?.cars?.[0] ?? null;
        if (!car) return;
        boosterState.setColorChangeCar(car.color);
        _showColorPicker(car.color);
      },
      onDeployFromBench: (shooter, laneIdx, release) => {
        if (laneIdx >= gs.activeLaneCount) return;
        gameRenderer3D.setDropStart(laneIdx, release);   // bomb travels FROM release
        gameLoop.deployFromBench(shooter, laneIdx);
        // progress.incrementBenchUses() was called inside deployFromBench.
        const benchAch = achievementManager.check('bench_deploy');
        benchAch.forEach(a => popupQueue.enqueue(PRIORITY.ACHIEVEMENT, (w) => _buildAchievementPopup(w, a), 3.0));
      },
      onBenchStore: (_colIdx) => {
        tutOrch?.completeIfActive('bench');
        // Column refills automatically via ShooterDirector next tick.
      },
      onReorder: (_srcCol, _srcRow, _tgtCol, _tgtRow) => {
      },
      onColorMismatch: () => {
        audio.play('hit_miss');
        haptics.error();   // wrong-colour bounce
      },
      onBenchFull: () => {
        audio.play('hit_miss');
        floatingTexts.push(spawnFloatingText(
          layers.get('particleLayer'),
          APP_W / 2, 700,
          'BENCH FULL', 0xff6644,
        ));
      },
      onLaneHover: (laneIdx, colorHex) => {
        gameRenderer3D.showLaneGlow(laneIdx, colorHex);
      },
      onLaneClear: () => {
        gameRenderer3D.clearLaneGlow();
      },
      getColorBombArmed: () => gs.colorBombArmed,
      // Hint B — first bomb pickup on L1: intercept the pickup, show the
      // match-damage modal card, and let the player drag once it's dismissed.
      onColumnPickup: () => {
        haptics.light();   // bomb pickup / drag start
        // (Hint B used to intercept the FIRST pickup on L1 with a modal card, so
        // a new player's first drag did nothing. L1 bombs always out-damage its
        // cars; the damage rule is taught by hint A the first time a hit fails.)
        return false;
      },
    },
    boosterState,
    null,
    gs.firingSlots,
  );
  new InputManager(app, dragDrop);

  let _lastPointerY = 300;
  let _lastPointerX = APP_W / 2;
  // Rect cached for the same reason as InputManager's: getBoundingClientRect()
  // forces a synchronous layout flush and this fires on every pointermove.
  // Invalidated on layout changes; refreshed lazily on the next move.
  let _ptrRect = null;
  const _invalidatePtrRect = () => { _ptrRect = null; };
  window.addEventListener('resize', _invalidatePtrRect);
  window.addEventListener('orientationchange', _invalidatePtrRect);
  app.canvas.addEventListener('pointerdown', _invalidatePtrRect, { passive: true });
  app.canvas.addEventListener('pointermove', (e) => {
    if (!_ptrRect) _ptrRect = app.canvas.getBoundingClientRect();
    const scaleY = app.screen.height / _ptrRect.height;
    const scaleX = app.screen.width  / _ptrRect.width;
    _lastPointerY = (e.clientY - _ptrRect.top)  * scaleY;
    _lastPointerX = (e.clientX - _ptrRect.left) * scaleX;
  }, { passive: true });

  // ── Tab-visibility auto-pause ─────────────────────────────────────────────
  // When the player backgrounds the app the game loop should pause so that:
  //   a) The game doesn't tick silently in the background wasting battery.
  //   b) On return, the accumulated deltaTime doesn't cause a multi-frame
  //      stutter spike (both tickers already cap dt at 50 ms, but pausing
  //      removes the issue entirely).
  let _hiddenWhilePlaying = false;
  // ── Back button (Android hardware/gesture back, Escape on desktop) ──────────
  // Mirrors each screen's own Back/Close button, top-most first. Without this the
  // Android default applies: back exits the app, even in the middle of a level.
  function _handleBack() {
    const close = (open, key) => { if (open && _closers[key]) { _closers[key](); return true; } return false; };
    // Overlays that can open over Settings close before Settings does.
    if (close(carManualScreen, 'carManual') || close(hpGuideOverlay, 'hpGuide')
      || close(howToPlayOverlay, 'howToPlay') || close(settingsScreen, 'settings')
      || close(dailyRewardScreen, 'daily') || close(achievementsScreen, 'achievements')
      || close(statsScreen, 'stats') || close(shopScreen, 'shop') || close(pauseScreen, 'pause')) return;
    if (preLevelScreen) {
      preLevelScreen.destroy();
      preLevelScreen = null;
      if (!levelSelectScreen) showLevelSelect();
      return;
    }
    if (close(levelSelectScreen, 'levelSelect')) return;
    // An armed booster / open colour picker: back cancels it (the Android habit),
    // rather than being swallowed or pausing over it.
    if (colorPicker) { boosterState.cancelColorChange(); _dismissColorPicker(); return; }
    if (boosterState.colorChangeMode) { boosterState.cancelColorChange(); return; }
    if (boosterState.bombMode) { boosterState.cancelBomb(); return; }
    // Mid-level: back pauses (the pause menu then offers resume / quit).
    if (gameLoopStarted && !gs.isOver && pauseBtn.visible && !colorPicker) { showPause(); return; }
    // Title: leave the app. Everywhere else (win / lose / continue offer, colour
    // picker, intro cards) back is swallowed — those need an explicit choice.
    if (titleScreen && Capacitor.isNativePlatform()) CapApp.exitApp();
  }
  if (Capacitor.isNativePlatform()) CapApp.addListener('backButton', _handleBack);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') _handleBack(); });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Pause logic tick when tab is hidden (only if actively playing).
      if (gameLoopStarted && !gameLoop.paused && !gs.isOver) {
        gameLoop.pause();
        _hiddenWhilePlaying = true;
      }
    } else {
      // Resume on return — but only if WE paused it (not the user).
      if (_hiddenWhilePlaying && pauseScreen === null) {
        _hiddenWhilePlaying = false;
        // Coming back from another app: land on the pause menu rather than a
        // board that is already running under a player who isn't looking yet.
        if (pauseBtn.visible && !_modalActive && !colorPicker) showPause(); else gameLoop.resume();
      } else {
        _hiddenWhilePlaying = false;
      }
      // Resume AudioContext if the browser suspended it.
      if (audio._ctx?.state === 'suspended') audio._ctx.resume().catch(() => {});
    }
  });

  // ── WebGL context-lost recovery ───────────────────────────────────────────
  app.canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    gameLoop.pause();
    // A tiny non-intrusive toast — same helper used elsewhere in GameApp.
    _buildSimpleToast(app, APP_W, 'Display connection lost — tap to reload', 0x1a0a0a, 0xff8866);
  });
  app.canvas.addEventListener('webglcontextrestored', () => {
    // Safest recovery is a reload; the game auto-saves progress to localStorage.
    location.reload();
  });

  // ── Render ticker (variable rate) ────────────────────────────────────────
  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);

    // 3D scene update + render (runs when gameRenderer3D is visible/active).
    // dt is scaled by gs.timeScale so a 3+ multi-kill plays back in brief bullet-time.
    const fxDt = dt * (gs.timeScale ?? 1);
    // NOTE: this payload is a hand-built literal, so any field GameRenderer3D
    // reads but this object omits is silently `undefined` — a dead read with no
    // error, which is exactly how the gridRows sync went unnoticed (see
    // GameRenderer3D.setGridRows) and how the bomb-concussion freeze visual
    // never once fired. Keep this in sync with the fields
    // GameRenderer3D.update() actually reads; tests/entity-creation-geometry
    // enforces that every `gameState.X` the renderer reads appears here.
    //
    // `gs.bombFreezeUntil` is deliberately NOT passed — the renderer no longer
    // reads it either. See the "DORMANT ON PURPOSE" note in GameRenderer3D's
    // isFrozen; turning that effect on is its own reviewed change.
    gameRenderer3D.update({ lanes: gs.lanes, boosterState, isBreaching: gs.isOver && !gs.won,
                             comboFreezeShots: gs.comboFreezeShots,
                             colorBombArmed: gs.colorBombArmed }, fxDt, gs.elapsed);


    // 3B: reflect the grabbed bomb (tracked by the 2D drag layer) into the 3D bombs.
    gameRenderer3D.setSelectedBomb(shooterRenderer.draggingColumn ?? -1);

    gameRenderer3D.render();

    // Combo power-shot FX (vignette + floating text).
    comboFX.update(dt);

    // Background + road + overlay updates
    cityBg.update(gs.elapsed);
    laneRenderer.update(gs.elapsed);
    cityEdges.update(dt);
    unlockScreen?.update(dt);
    boosterSpotlight?.update(dt);
    tutOrch?.update(dt);
    // Armed-booster prompt: what to tap next. Only while the board is live.
    modeHint.set(gs.isOver || _boardBlockers().length > 0 ? null
      : boosterState.bombMode ? 'TAP A LANE TO BLAST IT'
      : boosterState.colorChangeMode && !colorPicker ? 'TAP A CAR TO RECOLOUR' : null);
    modeHint.update(dt);

    // Modal cards (onboarding hints, car-type intro, color-bomb intro) all run
    // through the unified queue; block drag input while ANY card is up (FIX 2).
    onboardingHints.update(dt);
    // Drive the active car-type intro card's animation. Its onDismiss nulls the
    // ref and advances the queue, so capture the ref to avoid nulling a NEW card
    // that the queue may have started during this same update.
    if (carTypeIntroCard) {
      const _c = carTypeIntroCard;
      if (!_c.update(dt) && carTypeIntroCard === _c) carTypeIntroCard = null;
    }
    // Any screen or overlay above the board owns the input. Without this, taps on
    // the pause menu / HUD buttons reached DragDrop too: with BOMB armed, tapping
    // RESUME fired the bomb into the lane under the button. (Not gameLoop.paused:
    // a pausing tutorial waits for a REAL drag, which must get through.)
    dragDrop.minBoardTapY = goalCounterUI?.bandBottom ?? 0;
    dragDrop.inputBlocked = _boardBlockers().length > 0;

    // Juice updates
    laneFlash.update(dt);
    comboGlow.update(dt, gs.combo);
    boosterBar.update(dt);
    if (gs.goalProgress) goalCounterUI.update(gs.goalProgress, dt);
    streakMeter.update(dt);
    // Goal-bar help buttons share the pause button's gameplay visibility (overlays
    // hide pauseBtn while open, so these follow suit).
    hpGuideBtn.visible = pauseBtn.visible;
    transition.update(dt);

    // Core renderer updates
    hudRenderer.update(dt);
    particles.update(dt);
    carRenderer.update(dt, boosterState.isFrozen());
    shooterRenderer.update(gs.elapsed, dt);
    // Project bomb slots through the 3D camera so the halo lands exactly on the bomb.
    benchRenderer.update();

    // Disable lane hover tints while any tutorial / combo / achievement overlay
    // is on screen so the colored lane flash doesn't bleed through the UI.
    dragDrop.uiOverlayActive = !!(ftueOverlay || popupQueue.hasActive());

    dragDrop.update(dt);

    tickFloatingTexts(floatingTexts, dt);

    // ── Popup queue ────────────────────────────────────────────────────────
    popupQueue.setTutorialActive(!!(ftueOverlay || tutOrch?.isAnyActive()));
    popupQueue.update(dt);

    // First-car FTUE banner: fires once the first enemy becomes visible.
    if (gameLoopStarted && !gs.isOver && gs.lanes.some(l => l.cars.length > 0)) {
      featureBanners.fire('first_car', 'Cars incoming! Drag a bomb to the lane with a matching color.');
    }

    // ── Breach camera ──────────────────────────────────────────────────────
    if (breachCam && !breachCam.done) {
      breachCam.t += dt;
      const prog    = Math.min(1, breachCam.t / BREACH_CAM_DURATION);
      const zoomAmt = BREACH_CAM_ZOOM * Math.sin(Math.PI * prog);
      const scale   = 1 + zoomAmt;
      const pivotX  = APP_W / 2;
      const pivotY  = ROAD_BOTTOM_Y;

      app.stage.scale.set(scale);
      app.stage.pivot.set(pivotX, pivotY);
      app.stage.position.set(pivotX, pivotY);

      if (breachCam.t >= BREACH_CAM_DURATION) {
        breachCam.done = true;
        app.stage.scale.set(1);
        app.stage.pivot.set(0, 0);
        app.stage.position.set(0, 0);
        if (breachCam.skipRescue) {
          _showNoRescueLose();
        } else {
          showRescue();
        }
      }
    } else {
      if (shakeTime > 0) {
        shakeTime = Math.max(0, shakeTime - dt);
        const mag = (shakeTime / 0.35) * 7;
        app.stage.x = (Math.random() - 0.5) * 2 * mag;
        app.stage.y = (Math.random() - 0.5) * 2 * mag;
      } else {
        app.stage.x = 0;
        app.stage.y = 0;
      }
    }

    if (rescueOverlay)    rescueOverlay.update(dt);
    if (preLevelScreen)   preLevelScreen.update?.(dt);
    if (ftueOverlay)      ftueOverlay.update(dt);
    if (titleScreen)      titleScreen.update?.(dt);
    if (winScreen)        winScreen.update?.(dt);

    if (levelSelectScreen) levelSelectScreen.update(dt);

    // Phase-based music transitions during active gameplay only.
    if (gameLoopStarted && !gameLoop.paused && !gs.isOver) {
      audio.updateMusicPhase(gs.phase);
    }
  });

  // ── Debug nav handle (used by Playwright audit screenshots) ─────────────
  const _dbgCleanAll = () => {
    titleScreen?.destroy();        titleScreen        = null;
    levelSelectScreen?.destroy();  levelSelectScreen  = null;
    shopScreen?.destroy();         shopScreen         = null;
    dailyRewardScreen?.destroy();  dailyRewardScreen  = null;
    settingsScreen?.destroy();     settingsScreen     = null;
    pauseScreen?.destroy();        pauseScreen        = null;
    carManualScreen?.destroy();    carManualScreen    = null;
    achievementsScreen?.destroy(); achievementsScreen = null;
    statsScreen?.destroy();        statsScreen        = null;
    winScreen?.destroy();          winScreen          = null;
    rescueOverlay?.destroy();      rescueOverlay      = null;
    ftueOverlay?.destroy();        ftueOverlay        = null;
    carTypeIntroCard?._destroy();  carTypeIntroCard   = null;
    preLevelScreen?.destroy();     preLevelScreen     = null;
    howToPlayOverlay?.destroy();   howToPlayOverlay   = null;
    hpGuideOverlay?.destroy();     hpGuideOverlay     = null;
    _dismissColorPicker();
  };
  // ── Dev navigation API ────────────────────────────────────────────────────
  if (import.meta.env.DEV) {
    window._nav = {
      startLevel: (n) => {
        [titleScreen, levelSelectScreen, winScreen].forEach(s => s?.destroy());
        titleScreen = levelSelectScreen = winScreen = null;
        _startLevel(n);
      },
      showWin: () => showWin(),
      showLose: () => _showNoRescueLose(),
      showLevelSelect: () => showLevelSelect(),
      // FIX 4D/4B/1 dev hooks for screenshot verification.
      showPreLevel: (n) => { _dbgCleanAll(); _showPreLevel(n); },
      showRescue:   () => { showRescue(); },
      showShop:     () => { showShop(); },
      showPause:    () => { showPause(); },
      showTitle:    () => { showTitle(); },
      showSettings: () => { showSettings(() => showTitle()); },
      showDaily:    () => { showDailyReward(); },
      showStats:    () => { showStats(); },
      cleanAll:     () => { _dbgCleanAll(); },
      showAchievements: () => { showAchievements(() => { achievementsScreen?.destroy(); achievementsScreen = null; showTitle(); }); },
      showHowToPlay: () => { showHowToPlay(); },
      showHpGuide:  () => { showHpGuide(); },
      showCarManual: () => { showCarManual(false); },
      showCarIntro: (t) => { _triggerCarTypeIntro(t); },
      openColorPicker: () => {
        boosterState.colorChange = Math.max(1, boosterState.colorChange);
        boosterState.activateColorChange();
        boosterState.setColorChangeCar(gs.colors[0]);
        _showColorPicker(gs.colors[0]);
      },
      getGs: () => gs,
      // Which screens/overlays are up (autoplay QA bot: rescue / win / lose flows).
      getScreens: () => ({ blockers: _boardBlockers(), daily: !!dailyRewardScreen, achievements: !!achievementsScreen, stats: !!statsScreen, settings: !!settingsScreen, shop: !!shopScreen, carManual: !!carManualScreen, howToPlay: !!howToPlayOverlay, paused: gameLoop.paused, win: !!winScreen, rescue: !!rescueOverlay, pause: !!pauseScreen, levelSelect: !!levelSelectScreen,
        preLevel: !!preLevelScreen, title: !!titleScreen, modal: _modalActive, picker: !!colorPicker, introCard: !!carTypeIntroCard,
        pauseBtn: pauseBtn.visible, boosters: { colorChange: boosterState.colorChange, freeze: boosterState.freeze, bombs: boosterState.bombs },
        inventory: progress.getInventory(), coins: progress.coins }),
      getBoosterState: () => boosterState,
      startDaily: () => { [titleScreen, levelSelectScreen, winScreen].forEach(x => x?.destroy()); titleScreen = levelSelectScreen = winScreen = null; startDailyChallenge(); },
      stageTop: (x, y) => {
        const hit = app.renderer.events.rootBoundary.hitTest(x, y);
        const chain = []; for (let o = hit; o; o = o.parent) { const bb = o.getBounds?.(); chain.push(`${o.constructor?.name}${o.label ? ':' + o.label : ''}[${o.eventMode}]${bb ? ` @${bb.x | 0},${bb.y | 0} ${bb.width | 0}x${bb.height | 0}` : ''}${o.texture?.label ? ' tex=' + o.texture.label : ''}${o.texture?.source?.label ? ' src=' + o.texture.source.label : ''} idx=${o.parent ? o.parent.children.indexOf(o) : -1}`); }
        const ev = app.renderer.events;
        return { chain, scale: app.stage.scale.x, pivot: [app.stage.pivot.x, app.stage.pivot.y], pos: [app.stage.x, app.stage.y],
          stage: { em: app.stage.eventMode, ic: app.stage.interactiveChildren, vis: app.stage.visible, n: app.stage.children.length },
          root: ev.rootBoundary.rootTarget === app.stage, feats: ev.features,
          kids: app.stage.children.map(c => `${c.constructor.name}:${c.eventMode}:${c.visible ? 'v' : 'h'}:${c.interactiveChildren ? 'i' : 'x'}`) };
      },
      dbgRescue: () => {
        const r = rescueOverlay; if (!r) return null; const c = r._container;
        const walk = (o, d = 0) => d > 3 ? [] : [`${'  '.repeat(d)}${o.constructor.name}:${o.eventMode}:${o.visible ? 'v' : 'h'}:a${o.alpha?.toFixed(2)}:${o.destroyed ? 'DESTROYED' : ''}`, ...(o.children ?? []).slice(0, 6).flatMap(k => walk(k, d + 1))];
        return { idx: app.stage.children.indexOf(c), built: r._panelBuilt, flash: r._flashLife, tree: walk(c), ticker: app.ticker.started, lastTime: app.ticker.lastTime, fps: app.ticker.FPS };
      },
      getColorPickerSwatches: () => colorPicker?.swatches ?? null,
      getMapNode: (n) => levelSelectScreen?.nodePosition?.(n) ?? null,
      getPreLevelPlayY: () => { const b = preLevelScreen?._play; if (!b) return null; const r = b.getBounds(); return r.y + r.height / 2; },
      getWinNextY: () => { const b = winScreen?._nextBtn; if (!b) return null; const r = b.getBounds(); return r.y + r.height / 2; },
      // Profiling handle: lets a harness wrap DragDrop's handlers to attribute
      // input-path cost (see scripts/_perf-handlers.mjs). Dev-only, like the
      // rest of this block.
      getDragDrop: () => dragDrop,
      // Bomb-queue 3D slot groups. Balls are Three meshes, sockets are Pixi
      // circles — two renderers, so their alignment can only be checked by
      // reading BOTH, which needs this handle.
      getShooter3D: () => gameRenderer3D?._shooters ?? null,
      // ── Harness observability (dev-only, see the block guard above) ─────────
      // THE REAL PAUSE STATE, not a proxy. Four things pause the loop:
      //   1. _modalActive (hint / colour-bomb cards)   -> sets dragDrop.inputBlocked
      //   2. the colour picker                          -> sets dragDrop.inputBlocked
      //   3. TutorialOrchestrator.show(pauseGame)       -> sets NO FLAG AT ALL
      //   4. player pause / tab-hidden / context-lost   -> sets no flag
      // A harness inferring pause from dragDrop.inputBlocked therefore sees only
      // (1) and (2), and silently counts runs frozen by (3) or (4) as CLEAN.
      // That is what invalidated five diagnostic instruments in this project:
      // implausible readings ("8/9 shots deal no damage", "0/23 turns advanced")
      // that were a paused game, not a broken one. Assert `!getGameLoop().paused`
      // instead of guessing which mechanism froze things.
      getGameLoop: () => gameLoop,
      // Deterministic tutorial dismissal. TutorialOrchestrator resumes the loop
      // only via completeIfActive(id) — which needs the player to perform the
      // required action, e.g. a real drag — or an explicit dismiss(). Tapping a
      // pixel does nothing, which is how harnesses got stuck on the
      // "drag the bomb" screen with the loop paused underneath.
      dismissTutorial: () => { tutOrch?.dismiss?.(); return !gameLoop.paused; },
      // Test hook: enqueue a sample achievement toast (verifies popup z-order /
      // end-screen suppression).
      fireTestAchievement: () => popupQueue.enqueue(
        PRIORITY.ACHIEVEMENT,
        (w) => _buildAchievementPopup(w, { name: 'Sharp Shooter', desc: 'Test achievement toast' }),
        4.0,
      ),
      setBoosters: (colorChange = 3, freeze = 3, bombs = 3) => {
        boosterState.colorChange = colorChange; boosterState.freeze = freeze; boosterState.bombs = bombs;
      },
      // Manual shot + freeze drivers for automated playtest verification.
      deploy: (colIdx, laneIdx) => gameLoop.deploy(colIdx, laneIdx),
      activateFreeze: () => boosterState.activateFreeze(),
      freezeState: () => ({ freeze: boosterState.freeze, freezeShots: boosterState.freezeShots, isFrozen: boosterState.isFrozen() }),
      // ── Visual-harness hooks (tests-visual/) ─────────────────────────────────
      // The game's OWN source of truth for where things render — tests assert
      // pixels/taps against these instead of re-deriving frustum math (which
      // would just duplicate-and-drift, the exact bug class being tested).
      // Every car with BOTH its logical slot (lane/row) and its screen point, read
      // from the app's OWN projection instance. A probe that imports LaneRenderer or
      // projection.js from page context gets a SECOND module instance stuck at
      // band-540 defaults (CLAUDE.md §6) and taps the wrong pixels — which is how a
      // BOMB probe could "miss" and report the wrong blast shape.
      getCarScreenPositions: () => gs.lanes.flatMap((lane, li) =>
        lane.cars.map(c => ({
          lane: li, row: c.row, position: c.position, color: c.color, hp: c.hp,
          x: getLaneScreenX(li), y: posToScreenY(c.position),
        }))),
      getPositions: () => ({
        laneCount: getActiveLaneCount(),
        colCount:  getActiveColCount(),
        laneX:     Array.from({ length: getActiveLaneCount() }, (_, i) => getLaneScreenX(i)),
        laneBounds: Array.from({ length: getActiveLaneCount() }, (_, i) => getLaneScreenBounds(i)),
        colX:      Array.from({ length: getActiveColCount() },  (_, i) => getColumnScreenX(i)),
        slotY:     [0, 1, 2].map(r => getColumnSlotScreenY(r)),
      }),
      // Named HUD rects (stage coords) for overlap/containment assertions.
      getHudBounds: () => {
        const grab = (o) => {
          if (!o || o.destroyed || !o.visible) return null;
          const b = o.getBounds();
          return { x: b.x, y: b.y, w: b.width, h: b.height };
        };
        return {
          pauseBtn:     grab(pauseBtn),
          bookBtn:      grab(bookBtn),
          hpGuideBtn:   grab(hpGuideBtn),
          howToPlayBtn: grab(howToPlayBtn),
          goalCounter:  grab(goalCounterUI?._container),
          boosterColor:  grab(boosterBar?._colorChangeBtn),
          boosterFreeze: grab(boosterBar?._freezeBtn),
          boosterBomb:   grab(boosterBar?._bombBtn),
        };
      },
      // Force goal completion → normal win path (for level-transition tests).
      winLevel: () => {
        if (!gs || gs.isOver) return false;
        gs.goalProgress = gs.goalProgress.map(() => 0);
        gameLoop._settleAfterClear();
        return gs.isOver;
      },
      // Live 3D camera frustum — lets the harness assert PositionRegistry's 2D
      // math against what the ortho camera ACTUALLY projects (bug class C).
      getFrustum: () => {
        const cam = gameRenderer3D?._scene3d?.camera;
        if (!cam) return null;
        return {
          left: cam.left, right: cam.right, top: cam.top, bottom: cam.bottom,
          zoom: cam.zoom, pos: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
          effectiveHalfX: (cam.right - cam.left) / 2 / cam.zoom,
        };
      },
      // Animation proof hooks — drive each render effect directly for capture/verification.
      _fx: {
        advance:  () => gameRenderer3D.onAdvance(),
        hitFlash: (lane = 0) => gameRenderer3D.onImpact(lane, gs.colors[0]),
        colorBomb: (color) => {
          const c = color ?? gs.colors[0];
          const killed = [];
          for (let li = 0; li < gs.activeLaneCount; li++)
            for (const car of gs.lanes[li].cars)
              if (car.color === c) killed.push({ laneIdx: li, position: car.position });
          gameRenderer3D.onColorBomb(c, killed);
          return killed.length;
        },
        pressColorChange: () => { if (boosterBar._colorChangeBtn) boosterBar._colorChangeBtn._pressT = 0; },
        pressFreeze: () => { if (boosterBar._freezeBtn) boosterBar._freezeBtn._pressT = 0; },
        kill:        (lane = 0, n = 1) => gameRenderer3D.onHit(lane, gs.colors[0], 5, n),
        multiKill:   (n = 3) => popupQueue.enqueue(PRIORITY.COMBO, (w) => _buildMultiKillPopup(w, n), 1.6),
        carScale:    (lane = 0) => gameRenderer3D.peekCarScale(lane),
        bombTutorial: () => gameLoop._onBombEarned?.(),   // show the BOMB-earned tutorial
        btnScales:   () => ({
          colorChange: boosterBar._colorChangeBtn?.scale?.x,
          freeze:      boosterBar._freezeBtn?.scale?.x,
          bomb:        boosterBar._bombBtn?.scale?.x,
        }),
      },
    };
  }

  // ── Boot: show title screen (game loop not started yet) ───────────────────
  showTitle();

  // ── Post-boot overlays (deferred so title is visible first) ───────────────

  // Streak master achievement — needs achievementManager which is declared later.
  {
    const sAch = achievementManager.check('login_streak', { streak: loginStreak });
    sAch.forEach(a => popupQueue.enqueue(PRIORITY.ACHIEVEMENT, (w) => _buildAchievementPopup(w, a), 3.0));
  }

  // Offline coin reward popup.
  if (offlineReward) {
    setTimeout(() => _showOfflineRewardPopup(app, offlineReward), 800);
  }

  // Streak shield offer: player's streak was reset but they have a shield.
  if (streakResult.wasReset && streakResult.prevCount >= 3 && progress.hasStreakShield()) {
    setTimeout(() => _showStreakShieldOffer(app, streakResult, progress), offlineReward ? 3500 : 800);
  }
}

function _makeFTUEOverlay(stage, w, h, cfg) {
  if (cfg.laneCount >= 4 && cfg.colCount >= 4 && !cfg.showArrow && !cfg.hintText && !cfg.showAreaLabels) return null;
  return new FTUEOverlay(stage, w, h, cfg);
}

// Single-line celebratory flash for the unified notification queue (FIX 4).
// Sits at the PopupQueue safe-gap Y; top-anchored so it stays in the road↔bomb gap.
function _buildFlashText(w, text, colorHex) {
  const grp = new Container();
  const t = new Text({
    text,
    style: { fontSize: 22, fontWeight: '900', fill: colorHex, align: 'center',
      dropShadow: { color: 0x000000, blur: 8, distance: 0, alpha: 0.9 } },
  });
  t.anchor.set(0.5, 0); t.x = w / 2; t.y = 0;
  grp.addChild(t);
  return grp;
}

function _buildComboPopup(w) {
  const grp = new Container();
  const PW = 180, PH = 52;
  const PX = (w - PW) / 2;

  const bg = new Graphics();
  bg.roundRect(PX, 0, PW, PH, 14);
  bg.fill({ color: 0x1a0800, alpha: 0.82 });
  bg.roundRect(PX, 0, PW, PH, 14);
  bg.stroke({ color: 0xff9922, width: 1.5, alpha: 0.75 });
  grp.addChild(bg);

  const title = new Text({
    text: 'COMBO ×3!',
    style: { fontSize: 22, fontWeight: 'bold', fill: 0xffcc22,
      dropShadow: { color: 0x000000, blur: 4, distance: 2, alpha: 0.9 } },
  });
  title.anchor.set(0.5, 0);
  title.x = w / 2;
  title.y = 4;
  grp.addChild(title);

  const body = new Text({
    text: 'Chain kills for bonus coins!',
    style: { fontSize: 11, fontWeight: 'bold', fill: 0xffe8aa, align: 'center',
      wordWrap: true, wordWrapWidth: PW - 20,
      dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.9 } },
  });
  body.anchor.set(0.5, 0);
  body.x = w / 2;
  body.y = 32;
  grp.addChild(body);

  return grp;
}

// Linear interpolate between two 0xRRGGBB colors. t=0 → a, t=1 → b.
function _lerpHex(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

// Celebration popup for a multi-kill (2/3/4+ cars in one shot). Warm radial burst
// behind a large, tier-colored kill count, with a spring scale-pop on entry.
// PopupQueue anchors the returned container at y=505 and owns its fade-out, so the
// entry animation only touches scale (Ticker-driven, matching _buildAchievementPopup).
function _buildMultiKillPopup(w, killCount) {
  const n = Math.max(2, killCount);
  const grp   = new Container();
  const inner = new Container();
  grp.addChild(inner);

  const cx = w / 2;
  const cy = -45;   // lift the burst up from the y=505 anchor into the lower-board area

  // ── Radial gradient burst: warm pale-gold center fading to deep orange edge ──
  const burst = new Graphics();
  const R = 90, RINGS = 18;   // was 138 — shrunk so the celebration doesn't dominate the board
  for (let i = RINGS; i >= 1; i--) {
    const f = i / RINGS;                       // 1 at outer edge … →0 at center
    const col = _lerpHex(0xFFF2B0, 0xE0531A, f);
    const a   = 0.12 + (1 - f) * 0.62;         // brighter / more opaque toward center
    burst.circle(cx, cy, R * f);
    burst.fill({ color: col, alpha: a });
  }
  inner.addChild(burst);

  // Tier color for the number: 2 = gold, 3 = orange, 4+ = red/pink.
  const tierCol = n >= 4 ? 0xFF1744 : n === 3 ? 0xFF8C00 : 0xFFD700;

  // Bright ring in the tier color to frame the burst.
  const ring = new Graphics();
  ring.circle(cx, cy, R * 0.66);
  ring.stroke({ color: tierCol, width: 3, alpha: 0.85 });
  inner.addChild(ring);

  // ── Big tier-colored kill count (the hero) ──
  const num = new Text({
    text: `${n}×`,
    style: { fontSize: 50, fontWeight: '900', fill: tierCol, align: 'center',
      stroke: { color: 0x3a1400, width: 5 },
      dropShadow: { color: 0x000000, blur: 9, distance: 0, alpha: 0.9 } },
  });
  num.anchor.set(0.5, 0.5);
  num.x = cx; num.y = cy + 5;
  inner.addChild(num);

  // ── Label above the number ──
  const label = new Text({
    text: 'MULTI-KILL!',
    style: { fontSize: 16, fontWeight: '900', fill: 0xffffff, letterSpacing: 2,
      stroke: { color: tierCol, width: 3 },
      dropShadow: { color: 0x000000, blur: 5, distance: 0, alpha: 0.9 } },
  });
  label.anchor.set(0.5, 1);
  label.x = cx; label.y = cy - 24;
  inner.addChild(label);

  // ── Scale-pop entry: 0.7 → 1.0 with a spring overshoot over ~120ms ──
  inner.pivot.set(cx, cy);
  inner.position.set(cx, cy);
  inner.scale.set(0.7);
  const c1 = 1.70158, c3 = c1 + 1;
  const easeOutBack = (x) => 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  let t = 0;
  const DUR = 0.12;
  const pop = (ticker) => {
    if (grp.destroyed) { Ticker.shared.remove(pop); return; }
    t += ticker.deltaTime / 60;
    const p = Math.min(1, t / DUR);
    inner.scale.set(0.7 + 0.3 * easeOutBack(p));
    if (p >= 1) { inner.scale.set(1); Ticker.shared.remove(pop); }
  };
  Ticker.shared.add(pop);

  return grp;
}

function _buildAchievementPopup(w, achievement) {
  // Trophy pill that drops over the header band (PopupQueue docks it there), so
  // it never covers the lanes. Indigo + gold like every other premium surface.
  const TW = 258, TH = 58, TX = (w - TW) / 2;   // fits between the round header buttons
  const outer = new Container();
  const grp = new Container();
  grp.y = -TH - 20;                                   // start above the screen, drop in
  outer.addChild(grp);

  const bg = new Graphics();
  bg.roundRect(TX + 2, 5, TW, TH, TH / 2).fill({ color: 0x000000, alpha: 0.35 });
  bg.roundRect(TX, 0, TW, TH, TH / 2).fill(new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
    colorStops: [{ offset: 0, color: 0x4A3FA0 }, { offset: 1, color: 0x241F5A }] }));
  bg.roundRect(TX + 10, 4, TW - 20, TH * 0.3, 10).fill({ color: 0xffffff, alpha: 0.12 });
  bg.roundRect(TX, 0, TW, TH, TH / 2).stroke({ color: 0xFFC93C, width: 3 });
  bg.circle(TX + TH / 2, TH / 2, TH / 2 - 7).fill(0x17143A).stroke({ color: 0xB9771C, width: 2 });
  grp.addChild(bg);

  const icon = uiIcon('trophy', 34, '🏆');
  icon.x = TX + TH / 2; icon.y = TH / 2;
  grp.addChild(icon);

  const label = new Text({ text: 'TROPHY UNLOCKED', style: { fontSize: 11, fontWeight: '800', fill: 0xFFC93C, letterSpacing: 1.2 } });
  label.x = TX + TH + 4; label.y = 9;
  grp.addChild(label);
  const nameText = new Text({ text: achievement.name, style: { fontFamily: '"Lilita One", Fredoka, Arial, sans-serif', fontSize: 21, fill: 0xFFFFFF,
    stroke: { color: 0x1F1A33, width: 4, join: 'round' } } });
  nameText.x = TX + TH + 4; nameText.y = 24;
  grp.addChild(nameText);

  const t0 = performance.now();
  const drop = () => {
    if (outer.destroyed) { Ticker.shared.remove(drop); return; }
    const e = Math.min(1, (performance.now() - t0) / 320);
    const k = 1 - Math.pow(1 - e, 3);
    grp.y = (-TH - 20) * (1 - k) + Math.sin(e * Math.PI) * 4;
    if (e >= 1) { grp.y = 0; Ticker.shared.remove(drop); }
  };
  Ticker.shared.add(drop);
  return outer;
}

main().catch(err => {
  // Surface fatal startup errors visibly so they're debuggable on mobile
  // (where there's no easy access to DevTools).
  console.error('[GameApp] Fatal startup error:', err);
  document.body.innerHTML = `
    <div style="color:#ff4466;font-family:monospace;padding:24px;background:#0a0a14;min-height:100vh">
      <b>Traffic Bomb failed to start</b><br><br>
      ${err?.message ?? String(err)}<br><br>
      <small>Check browser console for full stack trace.</small>
    </div>`;
});

// ── Simple toast helper ────────────────────────────────────────────────────────
// Shows a timed banner at the top of the stage for 3.5 s then self-destructs.
// onMount (optional) is called immediately for any side-effects (e.g. shield use).
function _buildSimpleToast(app, w, message, bgColor, textColor, onMount) {
  onMount?.();
  const stage = app.stage;
  const grp = new Container();

  const PW = w - 40, PH = 72;
  const bg = new Graphics();
  bg.roundRect(20, 0, PW, PH, 14);
  bg.fill({ color: bgColor, alpha: 0.96 });
  bg.roundRect(20, 0, PW, PH, 14);
  bg.stroke({ color: textColor, width: 2, alpha: 0.70 });
  grp.addChild(bg);

  const txt = new Text({
    text: message,
    style: {
      fontSize:    16,
      fontWeight:  'bold',
      fill:        textColor,
      align:       'center',
      wordWrap:    true,
      wordWrapWidth: PW - 32,
      dropShadow:  { color: 0x000000, blur: 5, distance: 0, alpha: 0.8 },
    },
  });
  txt.anchor.set(0.5, 0.5);
  txt.x = w / 2;
  txt.y = PH / 2;
  grp.addChild(txt);

  grp.y = 50;
  stage.addChild(grp);

  const TOTAL = 3.5;
  let elapsed = 0;
  const unsub = (ticker) => {
    elapsed += ticker.deltaMS / 1000;
    if (elapsed > TOTAL - 0.8) grp.alpha = Math.max(0, (TOTAL - elapsed) / 0.8);
    if (elapsed >= TOTAL) {
      app.ticker.remove(unsub);
      grp.destroy({ children: true });
    }
  };
  app.ticker.add(unsub);
}

// ── Offline reward popup ───────────────────────────────────────────────────────
function _showOfflineRewardPopup(app, reward) {
  const hours = Math.floor(reward.awayMin / 60);
  const mins  = reward.awayMin % 60;
  const away  = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  _buildSimpleToast(app, 390, `☁️ Away for ${away} — welcome back!  +${reward.coins} coins`, 0x0a1a08, 0x55ff99);
}

// ── Streak shield offer ────────────────────────────────────────────────────────
function _showStreakShieldOffer(app, streakResult, progress) {
  _buildSimpleToast(
    app, 390,
    `🛡 Streak shield activated! Your ${streakResult.prevCount}-day streak is safe.`,
    0x120820, 0xaa77ff,
    () => progress.useStreakShield(streakResult.prevCount),
  );
}
