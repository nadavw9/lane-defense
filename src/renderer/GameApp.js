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
import { LaneRenderer, laneCenterX, posToScreenY, ROAD_TOP_Y, ROAD_BOTTOM_Y } from './LaneRenderer.js';
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
import { LivesManager }    from '../game/LivesManager.js';
import { HapticsManager }  from '../game/HapticsManager.js';
import { setColorblindMode } from '../game/ColorblindMode.js';

import { setActiveCounts } from './PositionRegistry.js';
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
import { TutorialOrchestrator }   from '../screens/TutorialOrchestrator.js';
import { AchievementsScreen }     from '../screens/AchievementsScreen.js';
import { StatsScreen }            from '../screens/StatsScreen.js';
import { AudioManager }           from '../audio/AudioManager.js';
import { BoosterBar }             from './BoosterBar.js';
import { adManager }            from '../ads/AdManager.js';
import { PopupQueue, PRIORITY }  from './PopupQueue.js';
import { Analytics, logEvent }    from '../analytics/Analytics.js';
import { AutoTuner }             from '../analytics/AutoTuner.js';
import { AchievementManager }     from '../game/AchievementManager.js';
import { DailyChallengeManager }  from '../game/DailyChallengeManager.js';
import { CarTypeIntroCard, shouldShowIntro, markCarTypeSeen } from '../screens/CarTypeIntroCard.js';
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

const COLORS   = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
const _B       = import.meta.env.BASE_URL;   // '' in dev, '/lane-defense/' on GH Pages
const CAR_URLS = [
  ...COLORS.map(c => `${_B}sprites/cars/car-${c}.png`),
  `${_B}sprites/cars/car-boss.png`,
];
const SHOOTER_URLS = COLORS.flatMap(c => [
  `${_B}sprites/shooters/shooter-${c}-idle.png`,
  `${_B}sprites/shooters/shooter-${c}-fire.png`,
]);
// Three theme building sets, swapped by world (see buildingSetForLevel).
const BUILDING_SETS = {
  tutorial:   [1, 2, 3, 4, 5].map(i => `${_B}sprites/designed/building-tutorial-${i}.png`),
  industrial: [1, 2, 3, 4, 5].map(i => `${_B}sprites/designed/building-industrial-${i}.png`),
  night:      [1, 2, 3, 4, 5].map(i => `${_B}sprites/designed/building-night-${i}.png`),
};
const BUILDING_URLS = [...BUILDING_SETS.tutorial, ...BUILDING_SETS.industrial, ...BUILDING_SETS.night];

// World → building set. Tutorial City L1–15, Industrial Zone L16–30, Night Highway L31–40.
// Daily challenge (non-numeric levelId) uses the tutorial set.
function buildingSetForLevel(levelId) {
  if (typeof levelId !== 'number') return 'tutorial';
  if (levelId <= 15) return 'tutorial';
  if (levelId <= 30) return 'industrial';
  return 'night';
}
const TREE_URLS     = ['oak', 'elm', 'pine'].map(t => `${_B}sprites/designed/tree-${t}-topdown.png`);
const ENV_URLS      = [
  `${_B}sprites/designed/sidewalk-grass-strip.png`,
  `${_B}sprites/designed/panel-workshop-surface.png`,
  `${_B}sprites/designed/park-grass-tile.png`,
];
const BOOSTER_URLS  = ['swap', 'freeze', 'bomb'].map(b => `${_B}sprites/designed/booster-${b}.png`);
const ALL_SPRITE_URLS = [...CAR_URLS, ...SHOOTER_URLS, ...BUILDING_URLS, ...TREE_URLS, ...ENV_URLS, ...BOOSTER_URLS];

// Critical sprites gate spriteFlags.loaded — gameplay must have its car icons,
// bomb/shooter sprites, and booster icons. Cosmetic sprites (buildings, trees,
// grass) may fail to load and degrade to empty/programmatic edges instead of
// blanking the whole scene. See the resilient loader in main().
const CRITICAL_SPRITE_URLS = new Set([...CAR_URLS, ...SHOOTER_URLS, ...BOOSTER_URLS]);

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
  const loadBg = new Graphics();
  loadBg.rect(0, 0, APP_W, APP_H);
  loadBg.fill(0x060610);
  app.stage.addChild(loadBg);

  const loadText = new Text({
    text: 'Loading...',
    style: { fontSize: 28, fontWeight: 'bold', fill: 0x44ff88,
      dropShadow: { color: 0x00cc44, blur: 16, distance: 0, alpha: 0.7 } },
  });
  loadText.anchor.set(0.5);
  loadText.x = APP_W / 2;
  loadText.y = APP_H / 2;
  app.stage.addChild(loadText);

  // Preload sprite textures before any renderer is created. Load each one
  // INDEPENDENTLY (Promise.allSettled) so a single 404 can't reject the whole
  // batch — that was the production bug where one missing cosmetic sprite blanked
  // the entire scene. spriteFlags.loaded gates the sprite render path; it stays
  // true as long as the CRITICAL sprites (cars, bombs, boosters) load. A failed
  // cosmetic sprite (building/tree/grass) just degrades at its use-site, which
  // already guards a missing texture.
  const _loadResults = await Promise.allSettled(
    ALL_SPRITE_URLS.map(url => Assets.load(url).then(() => url, (e) => { throw { url, err: e }; })),
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

  try {
    await assetLoader.loadAll();
  } catch (e) {
    console.warn('[GameApp] GLB loading failed — 3D models will use box fallback.', e);
  }

  loadBg.destroy();
  loadText.destroy();

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

  // ── Boosters — init from saved inventory ──────────────────────────────────
  const boosterState = new BoosterState();
  {
    const saved = progress.getBoosters();
    boosterState.swap   = saved.swap;
    boosterState.freeze = saved.freeze ?? 0;
  }

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
  const boosterBar    = new BoosterBar(
    layers, boosterState, gs, APP_W,
    () => { audio.play('booster_activate'); boosterState.activateSwap(); boostersUsedThisLevel.push('swap'); logEvent('booster_used', { booster: 'swap', levelId: currentLevelIsDaily ? 'daily' : levelManager.levelNumber }); tutOrch?.completeIfActive('swap'); },
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


  // ── Per-level booster tracking (for analytics) ───────────────────────────
  let boostersUsedThisLevel = [];

  // ── Per-level tutorial state ───────────────────────────────────────────────
  let firstDeployTooltipShown = false;
  let firstKillDoneThisLevel  = false;

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
  let carTypeIntroCard    = null;  // active intro card (only one at a time)
  let carTypeIntroTimer   = null;  // setTimeout handle for level-start intro delay

  // First level that introduces each car type — intro fires here if type is unseen.
  // delay: ms after level start before card shows. L1 uses 4500 to fire after
  // the FTUE drag-arrow clears (~1.35 s splash + 3 s FTUE window).
  const LEVEL_INTRO_TYPE = {
    1:  { type: 'small',  delay: 4500 },
    2:  { type: 'big',    delay: 1500 },
    5:  { type: 'jeep',   delay: 1500 },
    9:  { type: 'truck',  delay: 1500 },
    13: { type: 'bigrig', delay: 1500 },
    15: { type: 'tank',   delay: 1500 },
  };

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
    const HIT = 40;           // tap-target size
    const g   = new Graphics();
    // Background pill
    g.roundRect(0, 0, HIT, HIT, 8);
    g.fill({ color: 0x000000, alpha: 0.40 });
    // Two vertical bars of the || symbol
    g.rect(10, 10, 6, 20);
    g.fill({ color: 0xffffff, alpha: 0.90 });
    g.rect(24, 10, 6, 20);
    g.fill({ color: 0xffffff, alpha: 0.90 });
    g.x       = APP_W - HIT - 4;
    g.y       = 2;
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
    const HIT = 40;
    const g   = new Graphics();
    g.roundRect(0, 0, HIT, HIT, 8);
    g.fill({ color: 0x000000, alpha: 0.40 });
    g.x       = 4;
    g.y       = 2;
    g.eventMode = 'static';
    g.cursor    = 'pointer';
    g.visible   = false;
    g.on('pointerdown', () => showCarManual());
    g.on('pointerover',  () => { g.alpha = 0.70; });
    g.on('pointerout',   () => { g.alpha = 1.00; });
    const icon = new Text({ text: '📖', style: { fontSize: 22 } });
    icon.anchor.set(0.5, 0.5);
    icon.x = HIT / 2; icon.y = HIT / 2;
    g.addChild(icon);
    layers.get('hudLayer').addChild(g);
    return g;
  })();

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
    gs.world              = cfg.worldConfig;
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
    carDir.setLevel(typeof cfg.id === 'number' ? cfg.id : 1);
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

    // Restore persistent booster inventory for this level.
    // L14 first-visit: grant 2 free freeze charges if player has none.
    const savedBoosters = progress.getBoosters();
    if (levelId === 14 && savedBoosters.freeze === 0) {
      progress.setBoosters(savedBoosters.swap, 2);
      savedBoosters.freeze = 2;
    }
    boosterState.swap        = savedBoosters.swap;
    boosterState.freeze      = savedBoosters.freeze ?? 0;
    boosterState.swapMode    = false;
    boosterState.swapFirst   = -1;
    boosterState.freezeShots = 0;
    boosterState.cancelBomb();

    // Apply any ad-earned boosters from the pre-level popup BEFORE starting.
    // resetForLevel() is called AFTER applying so progress isn't cleared first.
    if (adManager.isUnlocked('swap'))   boosterState.swap   = Math.min(5, boosterState.swap   + 1);
    if (adManager.isUnlocked('freeze')) boosterState.freeze = Math.min(5, boosterState.freeze + 1);
    if (adManager.isUnlocked('bomb'))   boosterState.bombs  = Math.min(boosterState.bombsMax, boosterState.bombs + 1);
    adManager.resetForLevel();

    applyLevelConfig(cfg);
    // Use levelNumber for normal levels; 'D' label for daily challenge.
    hudRenderer.setLevel(currentLevelIsDaily ? 'D' : levelManager.levelNumber);
    const objTotal = gs.spawnBudget !== null ? gs.spawnBudget : gs.targetKills;
    const _objectiveText = `Defeat ${objTotal} cars`;
    // FIX 1: show the objective AFTER the "LEVEL X" splash so the banner never
    // overlaps it. Numeric levels defer to the splash's completion (below);
    // non-numeric levels (daily challenge — no splash) show it immediately.
    if (typeof levelIdOrConfig !== 'number') hudRenderer.showObjective(_objectiveText);

    // Feature gating: daily challenge unlocks everything; normal levels gate by id.
    const benchUnlocked  = currentLevelIsDaily || levelId >= 6;
    const swapUnlocked   = currentLevelIsDaily || levelId >= 8;
    const freezeUnlocked = currentLevelIsDaily || levelId >= 14;
    benchStorage.reset();
    benchRenderer.setVisible(benchUnlocked);
    boosterBar.setButtonVisibility(swapUnlocked, freezeUnlocked);

    boostersUsedThisLevel       = [];
    firstDeployTooltipShown     = false;
    firstKillDoneThisLevel      = false;
    popupQueue.clear();
    popupQueue.setSuppressed(false);   // lift any end-screen toast suppression
    boosterBar.setVisible(true);       // restore bar hidden by a prior end-screen

    // FTUE feature banners fired at level start when a feature first appears.
    if ((cfg.laneCount ?? 4) >= 3) featureBanners.fire('multi_lane', 'New lane open! Each lane needs a matching-color bomb.');
    if (benchUnlocked && levelId === 6) featureBanners.fire('bench_appear', 'Bench unlocked — store a bomb here for later!');
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
    cityEdges.setBuildingSet(buildingSetForLevel(levelId));
    cityEdges.setLaneCount(cfg.laneCount ?? 4);
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
    // Mid-game backup: trigger intro when a new type is first spawned via shot-refill.
    gameLoop.onNewCarType = (typeKey) => {
      if (shouldShowIntro(typeKey)) {
        markCarTypeSeen(typeKey);
        _triggerCarTypeIntro(typeKey);
      }
    };
    gameLoop.restart();

    // Level-start intro: fires after splash clears (standard 1.5 s) or after the
    // FTUE drag-arrow window (L1: 4.5 s — splash 1.35 s + 3 s FTUE buffer).
    if (typeof levelId === 'number') {
      const entry = LEVEL_INTRO_TYPE[levelId];
      if (entry && shouldShowIntro(entry.type)) {
        const { type: introType, delay } = entry;
        carTypeIntroTimer = setTimeout(() => {
          carTypeIntroTimer = null;
          if (!gs.isOver && shouldShowIntro(introType)) {
            markCarTypeSeen(introType);
            _triggerCarTypeIntro(introType);
          }
        }, delay);
      }
    }

    pauseBtn.visible = true;
    bookBtn.visible  = true;

    // ── Booster unlock popup (once per feature, normal levels only) ───────────
    const UNLOCK_LEVELS = [6, 8, 14];
    // Maps level ID → booster bar key for the spotlight (level 6 = bench, no spotlight)
    const SPOTLIGHT_BOOSTER = { 8: 'swap', 14: 'freeze' };
    // Spotlight-to-tutorial configs for each booster (bounds match BoosterBar layout)
    const TUTOR_BOOSTER = {
      swap:   { id: 'swap',   text: 'SWAP — tap to swap two bombs instantly!',        bounds: { x: 109, y: 760, w: 52, h: 52 }, handStart: { x: 135, y: 728 }, handEnd: { x: 135, y: 786 } },
      freeze: { id: 'freeze', text: 'FREEZE — tap for one free shot, no cars advance!', bounds: { x: 169, y: 760, w: 52, h: 52 }, handStart: { x: 195, y: 728 }, handEnd: { x: 195, y: 786 } },
    };

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
            // L6 bench tutorial
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
      _showLevelIntroSplash(levelManager.levelNumber, () => hudRenderer.showObjective(_objectiveText));
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
  // ── No Hearts panel ─────────────────────────────────────────────────────
  // Shown when player tries to start a level with 0 hearts.
  function _showNoHeartsPanel() {
    const c = new Container();
    app.stage.addChild(c);

    const backdrop = new Graphics();
    backdrop.rect(0, 0, APP_W, APP_H);
    backdrop.fill({ color: 0x000000, alpha: 0.75 });
    backdrop.eventMode = 'static';
    c.addChild(backdrop);

    const PW = 300, PH = 260, px = (APP_W - PW) / 2, py = (APP_H - PH) / 2 - 20;
    const panel = new Graphics();
    panel.roundRect(px, py, PW, PH, 18);
    panel.fill({ color: 0x1a0510, alpha: 0.97 });
    panel.roundRect(px, py, PW, PH, 18);
    panel.stroke({ color: 0xff4466, width: 2, alpha: 0.6 });
    c.addChild(panel);

    const cx = APP_W / 2;
    let cy = py + 44;

    const addT = (text, x, y, style) => {
      const t = new Text({ text, style: { fontWeight: 'bold', ...style } });
      t.anchor.set(0.5, 0.5); t.x = x; t.y = y;
      c.addChild(t);
    };

    addT('OUT OF HEARTS', cx, cy, { fontSize: 24, fill: 0xff4466 });
    cy += 34;

    // Hearts row
    for (let i = 0; i < 5; i++) {
      const hx = cx - 4 * 22 / 2 + i * 22;
      const ht = new Text({ text: '♥', style: { fontSize: 20, fill: 0x333344 } });
      ht.anchor.set(0.5, 0.5); ht.x = hx; ht.y = cy;
      c.addChild(ht);
    }
    cy += 32;

    // Timer until next heart
    const timerTxt = new Text({
      text: `Next heart in ${livesManager.formatTimeUntilNext()}`,
      style: { fontSize: 13, fill: 0x7799aa, fontWeight: 'normal' },
    });
    timerTxt.anchor.set(0.5, 0.5); timerTxt.x = cx; timerTxt.y = cy;
    c.addChild(timerTxt);

    // Update timer every second
    let timerInterval = setInterval(() => {
      livesManager.tick();
      if (livesManager.hasHearts()) {
        clearInterval(timerInterval);
        c.destroy({ children: true });
        return;
      }
      timerTxt.text = `Next heart in ${livesManager.formatTimeUntilNext()}`;
    }, 1000);

    cy += 40;

    // OK button
    const btn = new Graphics();
    btn.roundRect(-90, -22, 180, 44, 12); btn.fill(0x1a1a2e);
    btn.x = cx; btn.y = cy;
    btn.eventMode = 'static'; btn.cursor = 'pointer';
    btn.on('pointerdown', () => {
      clearInterval(timerInterval);
      c.destroy({ children: true });
      audio.play('button_tap');
    });
    btn.on('pointerover', () => { btn.alpha = 0.78; });
    btn.on('pointerout',  () => { btn.alpha = 1.00; });
    const bt = new Text({ text: 'OK', style: { fontSize: 18, fontWeight: 'bold', fill: 0x88aacc } });
    bt.anchor.set(0.5, 0.5); btn.addChild(bt); c.addChild(btn);
  }

  function showLevelSelect() {
    pauseBtn.visible = false;
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
        transition.fadeOut(0.25, () => {
          _startLevel(levelId);
          transition.fadeIn(0.25, null);
        });
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
      onClose: () => {
        carManualScreen?.destroy();
        carManualScreen = null;
        if (fromPause) {
          showPause();
        } else {
          bookBtn.visible  = true;
          pauseBtn.visible = true;
          if (wasPlaying) gameLoop.resume();
        }
      },
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
        bookBtn.visible  = true;
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

    // Persist coins and boosters.
    progress.setCoins(gs.coins);
    progress.setBoosters(boosterState.swap, boosterState.freeze);

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
        transition.fadeOut(0.30, () => {
          _startLevel(nextId);
          transition.fadeIn(0.30, null);
        });
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
            gameLoop.shuffleForRescue();
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
        gameLoop.shuffleForRescue();
        rescueOverlay.destroy();
        rescueOverlay = null;
        audio.resetMusicPhase();
        audio.playMusic('gameplay_calm');
        pauseBtn.visible = true;
      },
      onRetry: () => {
        // "LEVEL SELECT" — declined the one-time rescue → level failed. (FIX 3)
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
        ftueOverlay?.onFirstKill();
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
      particles.spawnHit(laneIdx, gameX, color);
      particles.spawnDamageNumber(laneIdx, gameX, damage);
      gameRenderer3D.onHit(laneIdx, color, damage, killCount);
      if (isKill) {
        particles.spawnExplosion(laneIdx, gameX, color);
        audio.play('car_destroy', { kills: killCount });   // 6B: escalates with kills
        audio.play('kill_ding');                            // 6A: bright kill ding
        haptics.killDouble();
      } else {
        audio.play('hit_match');
        haptics.medium();
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
        showWin();
      } else {
        logEvent('level_failed', { levelId: _evtLevelId });
        audio.stopMusic();
        audio.play('lose_tone');
        shakeTime = 0;
        gameRenderer3D.onBreach();
        haptics.heavy();
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
  gameLoop._onBombEarned = () => {
    audio.play('coin_collect');
    haptics.light();
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
  // Progress feedback per multi-kill (1/3, 2/3) — through the unified queue (FIX 4).
  gameLoop._onMultiKill = (count, needed) => {
    audio.play('pip_fill', { index: count - 1 });   // 6A: ascending pip-fill note
    if (count < needed) {
      popupQueue.enqueue(PRIORITY.COMBO, (w) => _buildFlashText(w, `MULTI-KILL!  ${count}/${needed}`, 0xffcc44), 1.2);
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
      onDeploy: (colIdx, laneIdx, release) => {
        if (colIdx >= gs.activeColCount || laneIdx >= gs.activeLaneCount) return;
        gameRenderer3D.setDropStart(laneIdx, release);   // bomb travels FROM release
        gameLoop.deploy(colIdx, laneIdx);
      },
      onBombPlaced: (x, y) => {
        if (y < ROAD_TOP_Y || y > ROAD_BOTTOM_Y) return;
        // Route through the same lane-count-aware hit-test as drag deploys so the
        // bomb lands on the correct lane for 1/2/3/4-lane levels (not a fixed
        // 4-lane / full-width split, which mis-targeted on 3-lane boards).
        const laneIdx = dragDrop._hitTestLane(x, y);
        if (laneIdx < 0) return;
        gameLoop.placeBombOnLane(laneIdx);
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
      onColorMismatch: () => {
        audio.play('hit_miss');
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
  let _prevSwap = boosterState.swap;                  // 6A: detect a completed swap
  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);

    // 6A: a swap consumed a charge → whoosh (synced to the 4B arc).
    if (boosterState.swap < _prevSwap) audio.play('swap_whoosh');
    _prevSwap = boosterState.swap;

    // 3D scene update + render (runs when gameRenderer3D is visible/active).
    // dt is scaled by gs.timeScale so a 3+ multi-kill plays back in brief bullet-time.
    const fxDt = dt * (gs.timeScale ?? 1);
    gameRenderer3D.update({ lanes: gs.lanes, boosterState, isBreaching: gs.isOver && !gs.won,
                             comboFreezeShots: gs.comboFreezeShots,
                             colorBombArmed: gs.colorBombArmed }, fxDt, gs.elapsed);

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
    dragDrop.inputBlocked = _modalActive;

    // Juice updates
    laneFlash.update(dt);
    comboGlow.update(dt, gs.combo);
    boosterBar.update(dt);
    transition.update(dt);

    // Core renderer updates
    hudRenderer.update(dt);
    particles.update(dt);
    carRenderer.update(dt, boosterState.isFrozen());
    shooterRenderer.update(gs.elapsed, dt);
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
      stashBomb: (colIdx = 0) => gs?.columns[colIdx]?.stashBomb() ?? false,
      getGs: () => gs,
      // Test hook: enqueue a sample achievement toast (verifies popup z-order /
      // end-screen suppression).
      fireTestAchievement: () => popupQueue.enqueue(
        PRIORITY.ACHIEVEMENT,
        (w) => _buildAchievementPopup(w, { name: 'Sharp Shooter', desc: 'Test achievement toast' }),
        4.0,
      ),
      setBoosters: (swap = 3, freeze = 3, bombs = 3) => {
        boosterState.swap = swap; boosterState.freeze = freeze; boosterState.bombs = bombs;
      },
      // Manual shot + freeze drivers for automated playtest verification.
      deploy: (colIdx, laneIdx) => gameLoop.deploy(colIdx, laneIdx),
      activateFreeze: () => boosterState.activateFreeze(),
      freezeState: () => ({ freeze: boosterState.freeze, freezeShots: boosterState.freezeShots, isFrozen: boosterState.isFrozen() }),
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
        pressSwap:   () => { if (boosterBar._swapBtn)   boosterBar._swapBtn._pressT   = 0; },
        pressFreeze: () => { if (boosterBar._freezeBtn) boosterBar._freezeBtn._pressT = 0; },
        kill:        (lane = 0, n = 1) => gameRenderer3D.onHit(lane, gs.colors[0], 5, n),
        carScale:    (lane = 0) => gameRenderer3D.peekCarScale(lane),
        bombTutorial: () => gameLoop._onBombEarned?.(),   // show the BOMB-earned tutorial
        btnScales:   () => ({
          swap:   boosterBar._swapBtn?.scale?.x,
          freeze: boosterBar._freezeBtn?.scale?.x,
          bomb:   boosterBar._bombBtn?.scale?.x,
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

  const icon = new Text({ text: '🏆', style: { fontSize: 26 } });
  icon.x = TX + 10;
  icon.y = (TH - 32) / 2;
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
