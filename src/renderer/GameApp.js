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
import { Application, Assets, Container, Graphics, Text, Ticker } from 'pixi.js';

import { GameRenderer3D }  from '../renderer3d/GameRenderer3D.js';
import { assetLoader }     from '../renderer3d/AssetLoader.js';
import { LayerManager }    from './LayerManager.js';
import { LaneRenderer, laneCenterX, posToScreenY, ROAD_TOP_Y, ROAD_BOTTOM_Y, screenYToRow, FRONT_ROW_TAP_MARGIN } from './LaneRenderer.js';
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
import { BenchRenderer }   from './BenchRenderer.js';

import { GameState }       from '../game/GameState.js';
import { GameLoop }        from '../game/GameLoop.js';
import { CombatResolver }  from '../game/CombatResolver.js';
import { LevelManager, openingRowsForLevel } from '../game/LevelManager.js';
import { BoosterState }    from '../game/BoosterState.js';
import { ProgressManager } from '../game/ProgressManager.js';
import { applyDda }         from '../game/dda.js';
import { LivesManager }    from '../game/LivesManager.js';
import { HapticsManager }  from '../game/HapticsManager.js';
import { setColorblindMode } from '../game/ColorblindMode.js';

import {
  setActiveCounts, getLaneScreenX, getColumnScreenX, getColumnSlotScreenY,
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
import { adManager }            from '../ads/AdManager.js';
import { PopupQueue, PRIORITY }  from './PopupQueue.js';
import { Analytics, logEvent }    from '../analytics/Analytics.js';
import { AutoTuner }             from '../analytics/AutoTuner.js';
import { AchievementManager }     from '../game/AchievementManager.js';
import { DailyChallengeManager }  from '../game/DailyChallengeManager.js';
import { CarTypeIntroCard, hasIntroCard } from '../screens/CarTypeIntroCard.js';
import { bandWeights } from '../director/CarTypes.js';
import { ComboFX } from './ComboFX.js';
import { MERGE_SCALE } from '../renderer3d/projection.js';

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
  const t = new Text({
    text,
    style: {
      fontSize:   18,
      fontWeight: 'bold',
      fill:       color,
      dropShadow: { color: 0x000000, blur: 5, distance: 2, alpha: 0.9 },
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
  buildingSetForLevel, worldPanelForLevel, sceneVariantForLevel,
} from './assetManifest.js';
import { uiIcon } from './UIIcon.js';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function main() {
  const app = new Application();
  await app.init({
    width:           APP_W,
    height:          APP_H,
    backgroundAlpha: 0,               // transparent so Three.js canvas shows through
    antialias:       true,
    resolution:      window.devicePixelRatio || 1,
    autoDensity:     true,
  });
  document.body.appendChild(app.canvas);

  // ── Fit canvas to viewport ────────────────────────────────────────────────
  // (Declared early so the loading screen is already correctly sized.)
  const _fitCanvas = () => {
    const scale = Math.min(window.innerWidth / APP_W, window.innerHeight / APP_H);
    app.canvas.style.width     = `${APP_W * scale}px`;
    app.canvas.style.height    = `${APP_H * scale}px`;
    // Match THREE.js canvas positioning (position:absolute, centred via transform).
    app.canvas.style.position  = 'absolute';
    app.canvas.style.top       = '50%';
    app.canvas.style.left      = '50%';
    app.canvas.style.transform = 'translate(-50%, -50%)';
  };
  _fitCanvas();
  window.addEventListener('resize', _fitCanvas);

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
  const analytics = new Analytics();
  analytics.recordSessionStart();

  // ── Progress (localStorage) ──────────────────────────────────────────────
  const progress = new ProgressManager();

  // ── Lives + Haptics + Colorblind ─────────────────────────────────────────
  const livesManager = new LivesManager(progress);
  livesManager.tick();   // credit any regenerated hearts immediately
  await adManager.init();

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
    () => { audio.play('booster_activate'); audio.play('freeze_tinkle'); boosterState.activateFreeze(); boostersUsedThisLevel.push('freeze'); logEvent('booster_used', { booster: 'freeze', levelId: currentLevelIsDaily ? 'daily' : levelManager.levelNumber }); tutOrch?.completeIfActive('freeze'); },
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

  // ── FTUE per-feature banners (once-per-lifetime, persisted to localStorage) ─
  const featureBanners = new FeatureBanners(popupQueue, APP_W);

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
        if (gameLoopStarted && !gs.isOver) gameLoop.resume();
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

  // ── Achievement system ────────────────────────────────────────────────────
  const achievementManager    = new AchievementManager(progress);
  const dailyChallengeManager = new DailyChallengeManager();
  const weeklyPlaylist        = dailyChallengeManager.getWeeklyPlaylist();

  // ── Per-level daily/no-rescue flags ───────────────────────────────────────
  let currentLevelIsDaily  = false;
  let noRescueThisLevel    = false;
  let dailyDateKey         = '';
  let coinsAtLevelStart    = 0;

  // ── Transition overlay (always topmost) ───────────────────────────────────
  const transition = new TransitionOverlay(app.stage, APP_W, APP_H);

  // ── Pause button (|| icon, top-right of HUD, shown during gameplay) ──────
  const pauseBtn = (() => {
    const HIT = 44;           // tap-target size (min 44px)
    const g   = new Graphics();
    // Background pill
    g.roundRect(0, 0, HIT, HIT, 8);
    g.fill({ color: 0x000000, alpha: 0.40 });
    // Two vertical bars of the || symbol (centred in the 44px pill)
    g.rect(14, 12, 6, 20);
    g.fill({ color: 0xffffff, alpha: 0.90 });
    g.rect(26, 12, 6, 20);
    g.fill({ color: 0xffffff, alpha: 0.90 });
    // Right gutter of the booster row, centred on the booster card centre (y=786).
    g.x       = APP_W - HIT;
    g.y       = 764;
    g.eventMode = 'static';
    g.cursor    = 'pointer';
    g.visible   = false;
    g.on('pointerdown', () => showPause());
    g.on('pointerover',  () => { g.alpha = 0.70; });
    g.on('pointerout',   () => { g.alpha = 1.00; });
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
    const HIT = 38;
    const g   = new Graphics();
    g.roundRect(0, 0, HIT, HIT, 9);
    g.fill({ color: 0x000000, alpha: 0.45 });
    g.roundRect(0, 0, HIT, HIT, 9);
    g.stroke({ color: 0xffffff, width: 1, alpha: 0.18 });
    g.x = x; g.y = 28;
    g.eventMode = 'static';
    g.cursor    = 'pointer';
    g.visible   = false;
    g.on('pointerdown', onTap);
    g.on('pointerover', () => { g.alpha = 0.75; });
    g.on('pointerout',  () => { g.alpha = 1.00; });
    const icon = iconName ? uiIcon(iconName, 24, glyph) : new Text({ text: glyph, style: { fontSize: 20 } });
    icon.anchor.set(0.5, 0.5);
    icon.x = HIT / 2; icon.y = HIT / 2;
    g.addChild(icon);
    layers.get('hudLayer').addChild(g);
    return g;
  }
  const hpGuideBtn   = _makeGoalBarBtn('🚗', 6,           () => showHpGuide(), 'car');
  const howToPlayBtn = _makeGoalBarBtn('❓', APP_W - 44,  () => showHowToPlay());

  // (Color-bomb streak pip counter removed — color bombs are now earned by a
  //  single-shot MULTI-KILL of 2+ cars, not by a consecutive-shot streak. FIX 4.)

  // ── Stage effects ─────────────────────────────────────────────────────────
  let shakeTime = 0;
  let breachCam = null;       // null | { laneIdx, t, done }

  // ── Game-loop flag — start() called only once ─────────────────────────────
  let gameLoopStarted = false;
  let _startSettleToken = 0;   // invalidates a pending level-start merge settle if the level changes

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
    // the copy's hpMultiplier here and nowhere else; the copy is what the
    // Director reads. Daily challenge never gets mercy (non-numeric id → 0).
    const failStreak = typeof cfg.id === 'number' ? progress.getFailStreak(cfg.id) : 0;
    gs.world = applyDda(cfg.worldConfig, failStreak);
    gs.phaseMan           = new IntensityPhase(cfg.duration);
    gameLoop.baseDuration = cfg.duration;
    // Turn-based target: use explicit targetKills or compute from duration.
    gs.targetKills = cfg.targetKills ?? Math.max(5, Math.round((cfg.duration ?? 60) * 0.12));
    gs.gridRows    = cfg.gridRows ?? 10;  // default 10 road slots
    gs.initialCars = cfg.initialCars ?? null;
    gs.openingRows = openingRowsForLevel(cfg.id);   // uniform 3-car opening, rows [0,1,2]
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
    shooterDir.setColorBias(cfg.shooterColorWeights ?? null);   // §3c L10 v2 supply bias
  }

  // ── Core level-start routine ──────────────────────────────────────────────
  // Called both for normal levels (levelId: number) and for the daily challenge
  // (levelIdOrConfig: full config object with isDaily:true).
  function _startLevel(levelIdOrConfig) {
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
    boosterState.colorChange = grant.colorChange ?? 0;
    boosterState.freeze      = grant.freeze ?? 0;
    boosterState.bombs       = Math.min(boosterState.bombsMax, grant.bombs ?? 0);
    adManager.resetForLevel();

    applyLevelConfig(cfg);
    // Merge unlock gate (L5+): set the 1-indexed level on GameState. Daily uses a
    // high id so the advanced daily challenge always has merges enabled.
    gs.levelId = (typeof levelId === 'number') ? levelId : 99;
    dragDrop.setMergeEnabled((typeof levelId === 'number' ? levelId : 99) >= 5);
    // Use levelNumber for normal levels; 'D' label for daily challenge.
    hudRenderer.setLevel(currentLevelIsDaily ? 'D' : levelManager.levelNumber);

    // Set goals for the level (if any). gs.goals is set by the level config.
    // If empty, goalCounterUI hides itself automatically.
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
      featureBanners.fire(`hint_L${levelId}`, cfg.hintText);
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
    // Unified world scene: panels + dispatch floor rotate a/b/c variants per
    // level; the road tile is per-world (sliced from the same scene family).
    const world        = worldPanelForLevel(levelId);
    const worldVariant = `${world}-${sceneVariantForLevel(levelId)}`;
    cityEdges.setBuildingSet(buildingSetForLevel(levelId));   // programmatic fallback
    cityEdges.setWorldPanel(worldVariant);                    // scene-variant panels
    cityEdges.setLaneCount(cfg.laneCount ?? 4);
    gameRenderer3D.setRoadTexture(WORLD_ROAD_URLS[world] ?? null);
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

    // Drop any merge sequence left running by the PREVIOUS level so it can't (a) make
    // this level's start() early-return — silently dropping the settle until the
    // first swap — or (b) apply a stale merge to the freshly-filled board.
    mergeSequencer.abort();

    // Animated level-start settle (Candy-Crush "board settles before first move"):
    // the board renders fully first, then the merge sequence plays on any pre-made
    // merges. The queue is filled SYNCHRONOUSLY in restart() above, so it is ready
    // immediately; we still defer ~1s so all bombs are visibly on the board before
    // anything animates. Gated to L5+ via peekMerges() (no-op otherwise). Retries on a
    // short interval if the sequencer is momentarily busy, so the settle is never
    // dropped; token-guarded so a level change cancels it.
    const _settleToken = ++_startSettleToken;
    const _trySettle = () => {
      if (_settleToken !== _startSettleToken || !gameLoopStarted || gs.isOver) return;  // superseded / over
      if (mergeSequencer.active) { setTimeout(_trySettle, 150); return; }                // busy — wait, don't drop
      mergeSequencer.start();   // no-op if there are no pre-made merges
    };
    setTimeout(_trySettle, 1000);

    // Level-start car-type intros (Bug A): every type this level can spawn that
    // the player has never been introduced to gets its card now — nothing fires
    // mid-level. Cards route through the modal queue, so multiple new types show
    // one after another in INTRO_ORDER. Fires after the splash clears (1.5 s), or
    // after the FTUE drag-arrow window on L1 (4.5 s = 1.35 s splash + 3 s FTUE).
    {
      const introduced = progress.getIntroducedCarTypes();
      const newTypes = INTRO_ORDER.filter(
        (t) => _levelCarTypes(cfg).has(t) && hasIntroCard(t) && !introduced.has(t),
      );
      if (newTypes.length > 0) {
        const delay = levelId === 1 ? 4500 : 1500;
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
      unlockScreen = new BoosterUnlockScreen(app.stage, APP_W, APP_H, levelId, {
        onPlay: () => {
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
              bounds:    { x: 0, y: 703, w: 390, h: 50 },
              handStart: { x: 195, y: 672 },
              handEnd:   { x: 195, y: 728 },
              pauseGame: true,
            });
          }
        },
      });
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
    const c = new Container();
    c.y = 66;   // pill top = 66-22 = 44 → flush with road top, never covers road or cars
    app.stage.addChild(c);

    const PW = 160, PH = 44;
    const bg = new Graphics();
    bg.roundRect(-PW / 2, -PH / 2, PW, PH, 12);
    bg.fill({ color: 0x1a1a2e, alpha: 0.85 });
    c.addChild(bg);

    const txt = new Text({
      text: `LEVEL ${levelNumber}`,
      style: {
        fontSize:   20,
        fontWeight: 'bold',
        fill:       0xffffff,
        dropShadow: { color: 0x000000, blur: 6, distance: 0, alpha: 0.7 },
      },
    });
    txt.anchor.set(0.5, 0.5);
    c.addChild(txt);

    c.x     = APP_W / 2;
    c.alpha = 0;

    let t = 0;
    const unsub = app.ticker.add((ticker) => {
      t += ticker.deltaMS / 1000;
      if (t < 0.2) {
        c.alpha = t / 0.2;
      } else if (t < 1.0) {
        c.alpha = 1;
      } else if (t < 1.2) {
        c.alpha = 1 - (t - 1.0) / 0.2;
      } else {
        app.ticker.remove(unsub);
        c.destroy({ children: true });
        onComplete?.();   // FIX 1: reveal the objective only after the banner clears
      }
    });
  }

  // ── Car type intro (Royal Match "Meet the new blocker!" moment) ──────────
  // Routes through the unified modal queue so it never overlaps another card.
  function _triggerCarTypeIntro(typeKey) {
    _enqueueModal((done) => {
      carTypeIntroCard = new CarTypeIntroCard(
        app.stage, APP_W, APP_H, typeKey,
        () => { carTypeIntroCard = null; done(); },
      );
    });
  }

  // Every car type a level can put on the road: band-weight table for its level
  // (same level key CarDirector uses) ∪ spawnScript stage weights ∪ the scripted
  // opening board. Drives the level-start intro check (Bug A).
  function _levelCarTypes(cfg) {
    const types = new Set();
    const level = typeof cfg.id === 'number' ? cfg.id : 1;   // mirrors carDir.setLevel
    for (const phase of Object.values(bandWeights(level))) {
      for (const w of phase) types.add(w.value);
    }
    // spawnScript weights are a { type: weight } OBJECT (the shape CarDirector's
    // Object.entries consumes), not a bandWeights-style [{value,weight}] array.
    for (const stage of cfg.spawnScript ?? []) {
      for (const t of Object.keys(stage.weights ?? {})) types.add(t);
    }
    for (const car of cfg.initialCars ?? []) {
      if (car.type) types.add(car.type);
    }
    return types;
  }

  // ── COLOR CHANGE picker (FIX 4B step 2) ──────────────────────────────────
  function _dismissColorPicker() {
    colorPicker?.destroy();
    colorPicker = null;
  }
  function _showColorPicker(fromColor) {
    _dismissColorPicker();
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
    const label = typeof levelId === 'number' ? `Level ${levelId}` : null;
    const start = (bundle) => {
      _pendingBoosterGrant = bundle;
      preLevelScreen?.destroy();
      preLevelScreen = null;
      transition.fadeOut(0.25, () => { _startLevel(levelId); transition.fadeIn(0.25, null); });
    };
    // §3d DDA mercy: after 2 consecutive fails, offer 1 free COLOR CHANGE (no ad)
    // as an "ON THE HOUSE" gift row. Numeric levels only (daily excluded). Base
    // hp-mercy is already applied in applyLevelConfig; this is the visible half.
    const failStreak  = typeof levelId === 'number' ? progress.getFailStreak(levelId) : 0;
    const freeBooster = failStreak >= 2
      ? { key: 'colorchange', emoji: '🎨', desc: 'Recolor', bundle: { colorChange: 1, freeze: 0, bombs: 0 } }
      : null;
    preLevelScreen = new PreLevelScreen(app.stage, APP_W, APP_H, label, {
      onSelect: (adCount, bundle) => {
        if (adCount <= 0) { start(bundle); return; }
        // Show `adCount` rewarded ads in sequence, then start with the bundle.
        let remaining = adCount;
        const showOne = () => {
          if (remaining <= 0) { start(bundle); return; }
          remaining--;
          adManager.showRewarded(() => showOne(), () => start(bundle));
        };
        showOne();
      },
      audio,
      freeBooster,
    });
  }

  // ── Screen: Title ─────────────────────────────────────────────────────────
  function showTitle() {
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
  function showDailyReward() {
    dailyRewardScreen = new DailyRewardScreen(app.stage, APP_W, APP_H, progress, {
      onClose: () => {
        dailyRewardScreen.destroy();
        dailyRewardScreen = null;
        // Check if the daily_claim achievement was just earned.
        const newAch = achievementManager.check('daily_claim');
        newAch.forEach(a => popupQueue.enqueue(PRIORITY.ACHIEVEMENT, (w) => _buildAchievementPopup(w, a), 3.0));
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
    pauseBtn.visible = false;
    goalCounterUI.setVisible(false);
    audio.playMusic('title');
    layers.get('backgroundLayer').visible = false;  // hide CityBackground behind LevelSelect (F-07)
    layers.get('laneLayer').visible       = false;
    layers.get('carLayer').visible        = false;
    livesManager.tick();   // credit any regenerated hearts before showing
    levelSelectScreen = new LevelSelectScreen(app.stage, APP_W, APP_H, progress, {
      onSelectLevel: (levelId) => {
        // Hearts/energy gate removed (FIX 3) — levels are always startable.
        levelSelectScreen.destroy();
        levelSelectScreen = null;
        // FIX 4D: offer the optional "Power Up?" ad screen before the level starts.
        _showPreLevel(levelId);
      },
      onBack: () => {
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
    }, livesManager);
  }
  function showShop() {
    shopScreen = new ShopScreen(app.stage, APP_W, APP_H, progress, boosterState, {
      onBack: () => {
        shopScreen.destroy();
        shopScreen = null;
        showLevelSelect();
      },
      onPurchase: () => {
        const newAch = achievementManager.check('shop_purchase');
        newAch.forEach(a => popupQueue.enqueue(PRIORITY.ACHIEVEMENT, (w) => _buildAchievementPopup(w, a), 3.0));
      },
      audio,
    });
  }

  // ── Screen: Achievements ─────────────────────────────────────────────────
  function showAchievements(onBack) {
    pauseBtn.visible = false;
    audio.playMusic('title');
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
    statsScreen = new StatsScreen(app.stage, APP_W, APP_H, {
      app,
      progressManager: progress,
      onBack: () => {
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
    settingsScreen = new SettingsScreen(app.stage, APP_W, APP_H, audio, { onClose }, progress, haptics);
  }

  // ── Screen: Car Manual ────────────────────────────────────────────────────
  function showCarManual(fromPause = false) {
    const wasPlaying = gameLoopStarted && !gameLoop.paused && !gs.isOver;
    if (wasPlaying) gameLoop.pause();
    bookBtn.visible  = false;
    pauseBtn.visible = false;
    carManualScreen = new CarManualScreen(app.stage, APP_W, APP_H, {
      seenTypes: progress.getIntroducedCarTypes(),
      onClose: () => {
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
    hpGuideOverlay = new HpGuideOverlay(app.stage, APP_W, APP_H, {
      onClose: () => { hpGuideOverlay?.destroy(); hpGuideOverlay = null; restore(); },
    });
  }

  function showHowToPlay() {
    if (howToPlayOverlay) return;
    const { restore } = _openGoalOverlay();
    howToPlayOverlay = new HowToPlayOverlay(app.stage, APP_W, APP_H, {
      ticker: app.ticker,
      onClose: () => { howToPlayOverlay?.destroy(); howToPlayOverlay = null; restore(); },
    });
  }

  // ── Screen: Pause ─────────────────────────────────────────────────────────
  function showPause() {
    gameLoop.pause();
    pauseBtn.visible = false;
    bookBtn.visible  = false;
    pauseScreen = new PauseScreen(app.stage, APP_W, APP_H, {
      onResume: () => {
        pauseScreen.destroy();
        pauseScreen      = null;
        pauseBtn.visible = true;
        bookBtn.visible  = false;  // in-game manual button hidden; reachable via pause screen
        gameLoop.resume();
      },
      onCarManual: () => {
        pauseScreen.destroy();
        pauseScreen = null;
        showCarManual(true);
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
        pauseScreen.destroy();
        pauseScreen = null;
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
      progress.completeDailyChallenge(dailyDateKey);
      const dcAch = achievementManager.check('daily_challenge');
      dcAch.forEach(a => popupQueue.enqueue(PRIORITY.ACHIEVEMENT, (w) => _buildAchievementPopup(w, a), 3.0));
      onNext = null;
    } else {
      const levelId = levelManager.levelNumber;
      const stars   = calcStars(gs);
      progress.recordWin(levelId, stars);

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
        const nextId = Math.min(40, levelId + 1);
        // Offer the pre-level "Power Up?" screen before the next level — same as
        // starting a level fresh from the map (onSelectLevel → _showPreLevel).
        _showPreLevel(nextId);
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
  function _showNoRescueLose() {
    // §3d DDA: this is the FINAL-loss moment (a breach that gets rescued and
    // then won never reaches here). Bump the fail streak so the next attempt's
    // config copy gets the mercy factor. Daily challenge excluded inside
    // recordLoss (non-numeric levelId), but guard here too for clarity.
    if (!currentLevelIsDaily) progress.recordLoss(levelManager.levelNumber);

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
    pauseBtn.visible = false;
    // FIX 2: hide the booster bar + suppress toasts behind the game-over modal,
    // exactly like the win/final-lose screens do.
    boosterBar.setVisible(false);
    popupQueue.setSuppressed(true);
    audio.play('rescue_offer');
    rescueOverlay = new RescueOverlay(app.stage, APP_W, APP_H, gs, {
      onRescueAd: () => {
        adManager.showRewarded(
          () => {
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
        rescueOverlay.destroy();
        rescueOverlay = null;
        const cfg = currentLevelIsDaily ? dailyChallengeManager.getChallenge() : levelManager.levelNumber;
        transition.fadeOut(0.20, () => { _startLevel(cfg); transition.fadeIn(0.20, null); });
      },
      onLevelSelect: () => {
        // Declined the one-time rescue → level failed; back to the map.
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

    onHit: (laneIdx, gameX, color, damage, killCount) => {
      const isKill = killCount > 0;
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
      // active car has reached the last 2 rows of the grid (row 14-15 of 16).
      const _dangerRow = gs.gridRows - 2;
      if (gs.lanes.slice(0, gs.activeLaneCount).some(l => l.cars.some(c => c.row >= _dangerRow))) {
        haptics.warning();
      }

      // ── One-time onboarding modal cards (lifetime, localStorage-flagged) ────
      // Show at most one card per hit; the other (if eligible) fires next hit.
      let _hintShownThisHit = false;
      // Hint C — first correct-colour shot on L1: explain that all cars advance.
      if (levelManager.levelNumber === 1 && !progress.hintAdvanceShown) {
        progress.markHintAdvance();
        _showHintCard((done) => onboardingHints.showAdvance(done));
        _hintShownThisHit = true;
      }
      // Hint A — first time a car SURVIVES a hit (any level): point to the book.
      if (!_hintShownThisHit && !isKill && damage > 0 && !progress.hintHpMissShown) {
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
        (colIdx + 0.5) * (APP_W / 4), 560,
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
      layers.get('particleLayer'), APP_W / 2, 700,
      `${kills}-CAR CHAIN! Freeze earned!`, 0x88ddff,
    ));
  };
  // Earned by chaining two strictly-consecutive multi-kills (GameLoop._updateColorChangeCombo).
  gameLoop._onColorChangeEarned = () => {
    audio.play('coin_collect');
    haptics.medium();   // booster earned
    floatingTexts.push(spawnFloatingText(
      layers.get('particleLayer'), APP_W / 2, 700,
      '2× COMBO! Color Change ready!', 0xCC66FF,
    ));
  };
  gameLoop._onBombEarned = () => {
    audio.play('coin_collect');
    haptics.medium();   // booster earned
    // Centered notification flash (centered so the longer text doesn't clip).
    floatingTexts.push(spawnFloatingText(
      layers.get('particleLayer'), APP_W / 2, 748,
      'BOMB READY! (10 kills)', 0xffaa00,
    ));
    // Bounds/hand must match the BOMB booster card exactly (BoosterBar CARD_X[2]):
    // x 237-301 (centre 269), y 754-818. The fixed 3-button bar is identical on
    // every level, so these constants are correct for all 1/2/3/4-lane levels.
    tutOrch?.start({
      id:        'bomb',
      text:      '💣 BOMB earned — tap it, then tap a lane to blast every car on it!',
      bounds:    { x: 237, y: 754, w: 64, h: 64 },
      handStart: { x: 269, y: 726 },
      handEnd:   { x: 269, y: 790 },
      pauseGame: true,
    });
  };
  gameLoop._onBombExplode = (bombPos, carsHit) => {
    gameRenderer3D.onBombExplode(bombPos, carsHit);
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
      popupQueue.enqueue(PRIORITY.COMBO, (w) => _buildMultiKillPopup(w, _lastShotKills), 1.4);
    }
  };
  // Color bomb EARNED after 3 multi-kills. Edge flash + queued "3 MULTI-KILLS!"
  // notification + SFX; rainbow is now in the queue. The first time ever, show the
  // one-time COLOR BOMB intro card (FIX 5), routed through the modal queue.
  gameLoop._onMerge = (descriptor) => {
    // Burst at the merged bomb's ACTUAL screen position (camera-projected), + SFX.
    // Fired from evaluateMerges(), which the sequencer calls at the burst+pop step.
    const col = descriptor.midCol ?? descriptor.column ?? 0;
    const screen = gameRenderer3D.getBombSlotScreenXY(col, 0);
    if (screen) particles.spawnBurstAt(screen.x, screen.y, descriptor.color, 8);
    audio.play('combo_milestone', { combo: 4 });
    haptics.medium();
  };

  // ── Merge animation sequencer ─────────────────────────────────────────────────
  // Full Candy-Crush sequence: HIGHLIGHT → TRAVEL → BURST+POP → DROP-IN, then
  // re-peek and CHAIN (up to 5×) before resuming. Merge DATA stays synchronous
  // (evaluateMerges at the burst step, refillQueue at the drop-in step — tests and
  // economy unchanged); this only animates the 3D bombs around it. Game is paused
  // and queue input blocked for the whole sequence. Only the merging/new bombs are
  // ever locked — every other queue bomb renders normally throughout.
  const EB1 = 1.70158, EB3 = EB1 + 1;
  const easeOutBack = (p) => 1 + EB3 * Math.pow(p - 1, 3) + EB1 * Math.pow(p - 1, 2);  // 0 → overshoot → 1
  const mergeSequencer = {
    active: false, phase: null, t: 0, plan: null, drops: null, chain: 0, _prevBlocked: false, _pending: false,
    // Entry point for ALL merge triggers (player action + auto-fill). If a sequence
    // is mid-play, queue a re-check for when it finishes rather than dropping it
    // (would re-introduce DEFECT 1) or overlapping it (visual chaos).
    // DRAG/MERGE MUTUAL EXCLUSION: never start while the player is holding a bomb —
    // starting mid-drag set inputBlocked under the player's finger, swallowing the
    // release into a zombie drag (leaked draggingColumn = invisible merged bomb;
    // stale next-tap resolution = double-count corruption). Deferred checks are
    // drained by update() the frame after the drag resolves.
    requestCheck() {
      if (this.active || dragDrop.isDragging()) { this._pending = true; return; }
      this.start();
    },
    start() {
      if (this.active) return;
      const plan = gameLoop.peekMerges();
      if (!plan.length) return;                 // nothing to merge — don't pause
      this.active = true; this.chain = 0;
      gameLoop.pause();
      this._prevBlocked = dragDrop.inputBlocked;   // no queue input mid-sequence
      dragDrop.inputBlocked = true;
      this._beginBatch(plan);
    },
    _beginBatch(plan) {
      this.plan = plan; this.phase = 'highlight'; this.t = 0;
      for (const m of plan) {
        for (const sl of [m.dest, ...m.travelers]) gameRenderer3D.lockBombSlot(sl.col, sl.row, true);
        m._destW = gameRenderer3D.getBombSlotWorld(m.dest.col, m.dest.row);
        for (const tr of m.travelers) tr._w = gameRenderer3D.getBombSlotWorld(tr.col, tr.row);
      }
    },
    update(dt) {
      if (!this.active) {
        // Drain a deferred check once idle AND no drag is in flight (fresh state
        // is re-peeked inside start(), so the deferral never acts on a snapshot).
        if (this._pending && !dragDrop.isDragging()) { this._pending = false; this.start(); }
        return;
      }
      this.t += dt;
      if (this.phase === 'highlight') {                       // 100ms — pulse the 3 sources
        const s = 1.0 + 0.15 * Math.min(1, this.t / 0.10);
        for (const m of this.plan) for (const sl of [m.dest, ...m.travelers]) gameRenderer3D.setBombSlotScale(sl.col, sl.row, s);
        if (this.t >= 0.10) { this.phase = 'travel'; this.t = 0; }
      } else if (this.phase === 'travel') {                   // 150ms — 2 outers fly to dest, shrink
        const p = Math.min(1, this.t / 0.15);
        for (const m of this.plan) for (const tr of m.travelers) {
          if (!tr._w || !m._destW) continue;
          gameRenderer3D.setBombSlotWorld(tr.col, tr.row,
            tr._w.x + (m._destW.x - tr._w.x) * p,
            tr._w.y + (m._destW.y - tr._w.y) * p,
            tr._w.z + (m._destW.z - tr._w.z) * p);
          gameRenderer3D.setBombSlotScale(tr.col, tr.row, 1.15 * (1 - p));
        }
        if (this.t >= 0.15) {
          // APPLY EXACTLY WHAT WAS ANIMATED: pass the peeked plan; each entry is
          // re-verified against fresh state inside evaluateMerges(plan) (stale →
          // skipped, no phantom merged bomb). Fires _onMerge per applied (burst+SFX).
          const applied = gameLoop.evaluateMerges(this.plan);
          const survivors = applied.map(d => d.planEntry).filter(Boolean);
          // Any dropped entries (stale by verify): release their slots untouched.
          for (const m of this.plan) {
            if (survivors.includes(m)) continue;
            for (const sl of [m.dest, ...m.travelers]) {
              gameRenderer3D.resetBombSlot(sl.col, sl.row);
              gameRenderer3D.lockBombSlot(sl.col, sl.row, false);
            }
          }
          this.plan = survivors;
          if (!this.plan.length) { this._afterFill(); return; }   // nothing applied → re-check/finish
          for (const m of this.plan) {
            for (const tr of m.travelers) gameRenderer3D.setBombSlotScale(tr.col, tr.row, 0);
            gameRenderer3D.setBombSlotScale(m.dest.col, m.dest.row, 0);   // pop from 0
          }
          this.phase = 'pop'; this.t = 0;
        }
      } else if (this.phase === 'pop') {                      // 120ms — merged bomb springs in
        // Pop peak MUST land on MERGE_SCALE (the merged bomb's actual resting
        // scale) — a stale hardcoded peak here that doesn't match the resting
        // scale _beginFill lands on produces a visible extra jump/shrink
        // right after the spring settles (2026-07-13).
        const p = Math.min(1, this.t / 0.12);
        for (const m of this.plan) gameRenderer3D.setBombSlotScale(m.dest.col, m.dest.row, MERGE_SCALE * easeOutBack(p));
        if (this.t >= 0.12) this._beginFill();
      } else if (this.phase === 'fill') {                     // new bombs fall in from above, overshoot
        const DROP_START_Z = -1.0;                            // above the queue's front row
        let done = true;
        for (const d of this.drops) {
          const lt = this.t - d.delay;
          let z = DROP_START_Z;
          if (lt < 0) { done = false; }
          else {
            const p = Math.min(1, lt / 0.15);
            if (p < 1) done = false;
            z = DROP_START_Z + (d.target.z - DROP_START_Z) * easeOutBack(p);   // overshoot past slot, settle
          }
          gameRenderer3D.setBombSlotWorld(d.c, d.row, d.target.x, d.target.y, z);
          gameRenderer3D.setBombSlotScale(d.c, d.row, 1);
        }
        if (done) {
          for (const d of this.drops) { gameRenderer3D.resetBombSlot(d.c, d.row); gameRenderer3D.lockBombSlot(d.c, d.row, false); }
          this._afterFill();
        }
      }
    },
    _beginFill() {
      // Unlock the merge slots so the merged bomb (+ any data-compacted bombs) render.
      for (const m of this.plan) for (const sl of [m.dest, ...m.travelers]) {
        gameRenderer3D.resetBombSlot(sl.col, sl.row);
        gameRenderer3D.lockBombSlot(sl.col, sl.row, false);
      }
      // Refill the gaps; the newly appended bombs (rows >= old length) drop in.
      const preLen = [];
      for (let c = 0; c < gs.activeColCount; c++) preLen[c] = gs.columns[c].shooters.length;
      gameLoop.refillQueue();
      this.drops = [];
      for (let c = 0; c < gs.activeColCount; c++) {
        const len = gs.columns[c].shooters.length;
        for (let row = preLen[c]; row < len && row < 3; row++) {
          gameRenderer3D.lockBombSlot(c, row, true);
          const target = gameRenderer3D.getBombSlotBaseWorld(c, row);
          if (target) this.drops.push({ c, row, target, delay: (row - preLen[c]) * 0.05 });   // 50ms stagger per column
          else gameRenderer3D.lockBombSlot(c, row, false);
        }
      }
      this.t = 0;
      if (this.drops.length) this.phase = 'fill';
      else this._afterFill();
    },
    _afterFill() {
      this.chain++;
      if (this.chain < 5) {                       // cap cascades
        const next = gameLoop.peekMerges();
        if (next.length) { this._beginBatch(next); return; }
      }
      this._finish();
    },
    _finish() {
      gameRenderer3D.clearBombAnimLocks();         // safety: release any remaining locks
      this.active = false; this.phase = null; this.plan = null; this.drops = null;
      dragDrop.inputBlocked = this._prevBlocked ?? false;
      gameLoop.resume();
      // Absorb any auto-fill merge that was requested WHILE this sequence played:
      // evaluate the settled board now that we're idle (no-op if no lines remain).
      if (this._pending) { this._pending = false; this.start(); }
    },
    // Hard-stop a sequence at a LEVEL CHANGE: drop all animation state WITHOUT
    // applying any pending merge (the board it was animating is gone). Without this
    // a sequence left active from the previous level (a) makes the new level's
    // start() early-return — silently dropping its settle until the first swap — and
    // (b) would call evaluateMerges() on the NEW board at its burst step. Cheap no-op
    // when idle.
    abort() {
      this._pending = false;   // a queued re-check must not leak into the next level
      if (!this.active) return;
      gameRenderer3D.clearBombAnimLocks();
      this.active = false; this.phase = null; this.plan = null; this.drops = null;
      dragDrop.inputBlocked = false;
    },
  };
  // DEFECT 1+2 FIX: an auto-fill that added bombs (post-fire refill, bench refill,
  // crisis inject) routes through the SAME sequencer as player-action merges — so
  // mid-game merges both FIRE and play the full highlight→travel→pop→drop-in cascade,
  // with position/isMerged/cascade all inherited from the one path.
  gameLoop._onAutoFill = () => mergeSequencer.requestCheck();
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
      onDeploy: (colIdx, laneIdx, release) => {
        if (colIdx >= gs.activeColCount || laneIdx >= gs.activeLaneCount) return;
        gameRenderer3D.setDropStart(laneIdx, release);   // bomb travels FROM release
        gameLoop.deploy(colIdx, laneIdx);
      },
      onBombPlaced: (x, y) => {
        // BOMB booster clears an entire ROW — every car in it, any colour, any lane.
        // The frontmost row's car centre sits ON ROAD_BOTTOM_Y, so accept taps up
        // to half a row below the breach line; screenYToRow clamps to the last row
        // so those taps map to gridRows-1 rather than overflowing out of bounds.
        if (y < ROAD_TOP_Y || y > ROAD_BOTTOM_Y + FRONT_ROW_TAP_MARGIN) return;
        const rows = gs.gridRows ?? 10;
        gameLoop.placeBombOnRow(screenYToRow(y, rows));
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
        // After a reorder/bench-return, play the animated merge sequence (which
        // applies the merge at its burst step). No merge → no pause, just the SFX.
        audio.play('tap_generic');
        mergeSequencer.start();
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
        if (levelManager.levelNumber === 1 && !progress.hintDamageShown) {
          progress.markHintDamage();
          _showHintCard((done) => onboardingHints.showDamage(done));
          return true;   // intercept this pickup; the drag does not start
        }
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
  app.canvas.addEventListener('pointermove', (e) => {
    const rect   = app.canvas.getBoundingClientRect();
    const scaleY = app.screen.height / rect.height;
    const scaleX = app.screen.width  / rect.width;
    _lastPointerY = (e.clientY - rect.top)  * scaleY;
    _lastPointerX = (e.clientX - rect.left) * scaleX;
  }, { passive: true });

  // ── Tab-visibility auto-pause ─────────────────────────────────────────────
  // When the player backgrounds the app the game loop should pause so that:
  //   a) The game doesn't tick silently in the background wasting battery.
  //   b) On return, the accumulated deltaTime doesn't cause a multi-frame
  //      stutter spike (both tickers already cap dt at 50 ms, but pausing
  //      removes the issue entirely).
  let _hiddenWhilePlaying = false;
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
        gameLoop.resume();
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
  const _prevStash = [false, false, false, false];   // 3D: per-column stash presence
  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);

    // 3D scene update + render (runs when gameRenderer3D is visible/active).
    // dt is scaled by gs.timeScale so a 3+ multi-kill plays back in brief bullet-time.
    const fxDt = dt * (gs.timeScale ?? 1);
    gameRenderer3D.update({ lanes: gs.lanes, boosterState, isBreaching: gs.isOver && !gs.won,
                             comboFreezeShots: gs.comboFreezeShots,
                             colorBombArmed: gs.colorBombArmed }, fxDt, gs.elapsed);

    // Merge sequence drives locked 3D bomb slots (after Shooter3D.update skipped them,
    // before render). Real-time dt so the animation isn't slowed by bullet-time.
    mergeSequencer.update(dt);

    // 3B: reflect the grabbed bomb (tracked by the 2D drag layer) into the 3D bombs.
    gameRenderer3D.setSelectedBomb(shooterRenderer.draggingColumn ?? -1);
    // 3D: pulse a stash slot whenever its contents change (place or retrieve).
    for (let c = 0; c < gs.activeColCount; c++) {
      const has = gs.columns[c]?.stash != null;
      if (has !== _prevStash[c]) { gameRenderer3D.pulseStash(c); _prevStash[c] = has; }
    }

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
    dragDrop.inputBlocked = _modalActive || !!colorPicker;   // FIX 4B: block road drags while the picker is up

    // Juice updates
    laneFlash.update(dt);
    comboGlow.update(dt, gs.combo);
    boosterBar.update(dt);
    if (gs.goalProgress) goalCounterUI.update(gs.goalProgress, dt);
    // Goal-bar help buttons share the pause button's gameplay visibility (overlays
    // hide pauseBtn while open, so these follow suit).
    hpGuideBtn.visible = howToPlayBtn.visible = pauseBtn.visible;
    transition.update(dt);

    // Core renderer updates
    hudRenderer.update(dt);
    particles.update(dt);
    carRenderer.update(dt, boosterState.isFrozen());
    shooterRenderer.update(gs.elapsed, dt);
    // Project bomb slots through the 3D camera so the halo lands exactly on the bomb.
    shooterRenderer.drawMergeOverlay(gs.elapsed, (c, r) => gameRenderer3D.getBombSlotScreenXY(c, r));
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
      showTitle:    () => { showTitle(); },
      showSettings: () => { showSettings(() => showTitle()); },
      showDaily:    () => { showDailyReward(); },
      showStats:    () => { showStats(); },
      openColorPicker: () => {
        boosterState.colorChange = Math.max(1, boosterState.colorChange);
        boosterState.activateColorChange();
        boosterState.setColorChangeCar(gs.colors[0]);
        _showColorPicker(gs.colors[0]);
      },
      stashBomb: (colIdx = 0) => gs?.columns[colIdx]?.stashBomb() ?? false,
      getGs: () => gs,
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
        // ── Merge visual setup hooks (L5+ only) ───────────────────────────────
        // Each setup PAUSES the loop (so the director can't refill the columns we
        // clear) and zeroes ALL columns before staging only the intended pattern,
        // so before/after captures show exactly one merge with no contamination.
        mergeSetupVertical: () => {
          if (!gameLoopStarted || gs.levelId < 5) return 'Not in a level >= L5';
          gameLoop.pause();
          gs.columns.forEach(c => { c.shooters = []; });
          gs.columns[0].shooters = [
            { color: 'Red', damage: 2, isMerged: false, isColorBomb: false },
            { color: 'Red', damage: 2, isMerged: false, isColorBomb: false },
            { color: 'Red', damage: 2, isMerged: false, isColorBomb: false },
          ];
          return 'Vertical staged: col0=[R,R,R], cols 1-3 empty (loop paused)';
        },
        // Stage col0=[R,R,R] over the FULL board (cols 1-3 keep their bombs) — to
        // verify the merge animation leaves non-merge bombs fully visible.
        mergeSetupVerticalKeep: () => {
          if (!gameLoopStarted || gs.levelId < 5) return 'Not in a level >= L5';
          gameLoop.pause();
          gs.columns[0].shooters = [
            { color: 'Red', damage: 5, isMerged: false, isColorBomb: false },
            { color: 'Red', damage: 6, isMerged: false, isColorBomb: false },
            { color: 'Red', damage: 7, isMerged: false, isColorBomb: false },
          ];
          return 'col0=[R,R,R] over full board (loop paused)';
        },
        mergeSetupHorizontal: () => {
          if (!gameLoopStarted || gs.levelId < 5) return 'Not in a level >= L5';
          gameLoop.pause();
          gs.columns.forEach(c => { c.shooters = []; });
          // Row 0 of cols 0,1,2 = Red (the triple); col 3 = a different color so no
          // col1-2-3 triple forms; each column has 1 bomb so no vertical fires.
          for (let i = 0; i < 3; i++) gs.columns[i].shooters = [{ color: 'Red', damage: 2, isMerged: false, isColorBomb: false }];
          gs.columns[3].shooters = [{ color: 'Blue', damage: 2, isMerged: false, isColorBomb: false }];
          return 'Horizontal staged: row0 col0-2=R, col3=B, rows 1-2 empty (loop paused)';
        },
        mergeFire: () => {
          if (!gameLoopStarted || gs.levelId < 5) return 'Not in a level >= L5';
          const applied = gameLoop.evaluateMerges();
          return `Merges applied: ${applied.length} (${applied.map(m => m.type).join(', ')})`;
        },
        // Play the ANIMATED merge sequence (highlight→travel→burst+pop) for whatever
        // is currently staged — used to capture the sequence frames.
        mergeAnimate: () => {
          if (!gameLoopStarted || gs.levelId < 5) return 'Not in a level >= L5';
          gameLoop.resume();             // undo the setup-hook pause so the merge applies cleanly
          mergeSequencer.start();
          return mergeSequencer.active ? 'animating' : 'no merges';
        },
        mergeResume: () => { gameLoop.resume(); return 'resumed'; },
        // Faithful mid-game auto-fill demo: stage a 3-line over the LIVE full board
        // (loop NOT paused, cols 1-3 keep their bombs), then fire the real _onAutoFill
        // signal — the exact production path (refill → re-check → same sequencer +
        // visible drop-in cascade). Used to screenshot DEFECT 2.
        mergeAutoFillDemo: () => {
          if (!gameLoopStarted || gs.levelId < 5) return 'Not in a level >= L5';
          gs.columns[0].shooters = [
            { color: 'Red', damage: 5, isMerged: false, isColorBomb: false },
            { color: 'Red', damage: 6, isMerged: false, isColorBomb: false },
            { color: 'Red', damage: 7, isMerged: false, isColorBomb: false },
          ];
          gameLoop._onAutoFill();
          return mergeSequencer.active ? 'auto-fill merge animating' : 'no merge';
        },
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
  // Compact top-right toast: 274×62px, 8px from right edge
  const TW = 274, TH = 62, TX = w - TW - 8;

  const outer = new Container();
  const grp = new Container();
  grp.x = w;  // start off-screen right for slide-in
  outer.addChild(grp);

  const bg = new Graphics();
  bg.roundRect(TX, 0, TW, TH, 14);
  bg.fill({ color: 0x0a0a1a, alpha: 0.88 });
  bg.roundRect(TX, 0, TW, TH, 14);
  bg.stroke({ color: 0xf5c842, width: 1.5, alpha: 0.85 });
  grp.addChild(bg);

  const icon = uiIcon('trophy', 32, '🏆');   // center-anchored → place at glyph-box centre
  icon.x = TX + 10 + 16;
  icon.y = (TH - 32) / 2 + 16;
  grp.addChild(icon);

  const textX = TX + 46;

  const label = new Text({
    text: 'ACHIEVEMENT UNLOCKED',
    style: { fontSize: 9, fontWeight: 'bold', fill: 0xf5c842, letterSpacing: 1.0 },
  });
  label.x = textX;
  label.y = 7;
  grp.addChild(label);

  const nameText = new Text({
    text: achievement.name,
    style: { fontSize: 14, fontWeight: 'bold', fill: 0xffeebb,
      dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.9 } },
  });
  nameText.x = textX;
  nameText.y = 22;
  grp.addChild(nameText);

  const descText = new Text({
    text: achievement.desc,
    style: { fontSize: 10, fill: 0xaa9966, fontWeight: 'normal', wordWrap: true, wordWrapWidth: TW - 56 },
  });
  descText.x = textX;
  descText.y = 42;
  grp.addChild(descText);

  // Slide in from right
  const slideListener = (ticker) => {
    if (outer.destroyed) { Ticker.shared.remove(slideListener); return; }
    grp.x = Math.max(0, grp.x - w * 8 * (ticker.deltaTime / 60));
    if (grp.x <= 0) { grp.x = 0; Ticker.shared.remove(slideListener); }
  };
  Ticker.shared.add(slideListener);

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
  const unsub = app.ticker.add((ticker) => {
    elapsed += ticker.deltaMS / 1000;
    if (elapsed > TOTAL - 0.8) grp.alpha = Math.max(0, (TOTAL - elapsed) / 0.8);
    if (elapsed >= TOTAL) {
      app.ticker.remove(unsub);
      grp.destroy({ children: true });
    }
  });
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
